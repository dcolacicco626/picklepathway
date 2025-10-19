// /app/api/admin/users/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";   // service-role / bearer-bound client
import { createServerClient } from "@supabase/ssr";     // cookie-based SSR client

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

// --- Cookie (SSR) client: lets the route read sb-* cookies if present ---
function authedClientFromCookies() {
  const cookieStore = cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value;
      },
      set() {},     // no-op in route handlers
      remove() {},  // no-op
    },
  });
}

// --- Service-role client: for privileged DB/admin ops (after authZ) ---
function serviceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false },
  });
}

// --- Request-bound client: prefer Authorization Bearer; fallback to cookies ---
function authedClientFromRequest(req) {
  const authHeader = req.headers.get("authorization") || "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (bearer) {
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    });
  }
  return authedClientFromCookies();
}


// ---- helpers (admin / sub-admin only) ----
async function getSessionAndRoleForOrg(supabase, orgId) {
  const { data: { user } = { user: null } } = await supabase.auth.getUser();
  if (!user) return { user: null, role: null, userId: null };

  const { data: row, error } = await supabase
    .from("memberships")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !row) return { user, role: null, userId: user.id };
  return { user, role: row.role, userId: user.id };
}

async function requireRole(supabase, orgId, allowedRoles = []) {
  const { user, role, userId } = await getSessionAndRoleForOrg(supabase, orgId);
  if (!user) return { ok: false, status: 401, msg: "Not signed in" };
  if (!allowedRoles.includes(role)) return { ok: false, status: 403, msg: "Forbidden" };
  return { ok: true, userId, role };
}

// --------------------- HANDLERS ----------------------

// GET /api/admin/users?orgId=...
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "Missing orgId" }, { status: 400 });

  const supabaseAuth = authedClientFromRequest(req);
  const authz = await requireRole(supabaseAuth, orgId, ["admin", "sub-admin"]);
  if (!authz.ok) return NextResponse.json({ error: authz.msg }, { status: authz.status });

  // Use service role to join with auth.users to show emails
  const admin = serviceClient();

  // 1) get memberships
  const { data: mems, error: memErr } = await admin
    .from("memberships")
    .select("user_id, role")
    .eq("org_id", orgId);
  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 });
  if (!mems?.length) return NextResponse.json({ users: [], yourRole: authz.role });

  // 2) fetch emails from auth.users
  const { data: usersList, error: userErr } = await admin.auth.admin.listUsers({
    page: 1, perPage: 2000,
  });
  if (userErr) return NextResponse.json({ error: userErr.message }, { status: 500 });

// Map both email and metadata for name
const byId = new Map(
  usersList.users.map((u) => [
    u.id,
    {
      email: u.email,
      meta: u.user_metadata || {},
    },
  ])
);

const display = mems.map((m) => {
  const entry = byId.get(m.user_id) || { email: "(unknown)", meta: {} };
  // Try multiple common keys for a display name
  const name =
    entry.meta.full_name ||
    entry.meta.name ||
    entry.meta.display_name ||
    null;

  return {
    user_id: m.user_id,
    email: entry.email || "(unknown)",
    name,
    role: m.role,
  };
});

return NextResponse.json({ users: display, yourRole: authz.role });

}

// POST /api/admin/users  { orgId, email, role, name? }
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const { orgId, email, role = "admin", name } = body || {};
  if (!orgId || !email) {
    return NextResponse.json({ error: "Missing orgId or email" }, { status: 400 });
  }

  // AuthZ: admin only
  const supabaseAuth = authedClientFromRequest(req);
  const authz = await requireRole(supabaseAuth, orgId, ["admin"]);
  if (!authz.ok) {
    return NextResponse.json({ error: authz.msg }, { status: authz.status });
  }

  const admin = serviceClient();
  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL || ""}/login`;

  // 1) Does a user with this email already exist?
  const { data: all, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 2000 });
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });

  const existing = all.users.find(
    (u) => (u.email || "").toLowerCase() === email.toLowerCase()
  );

  let userId = null;
  let actionLink = null;

  if (existing) {
    // Existing user → generate a MAGIC LINK and (optionally) email it
    userId = existing.id;

    // a) Generate a link you can surface in the UI
    const { data: linkRes, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });
    if (!linkErr) actionLink = linkRes?.properties?.action_link;

    // b) Also try to send the magic-link email (does not block success)
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, detectSessionInUrl: false },
    });
    await anon.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
  } else {
    // New user → official INVITE email
    const { data: invited, error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
    });
    if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 });
    userId = invited?.user?.id;

    // Also generate an invite link to show in the UI as a backup
    const { data: linkRes, error: linkErr } = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo },
    });
    if (!linkErr) actionLink = linkRes?.properties?.action_link;
  }

  if (!userId) {
    return NextResponse.json({ error: "Could not create or find user" }, { status: 500 });
  }
// If a display name was supplied, store it on the auth user for future reads
if (name) {
  try {
    await admin.auth.admin.updateUserById(userId, {
      user_metadata: { full_name: name },
    });
  } catch (e) {
    // non-fatal: metadata write failed
  }
}


  // 2) Upsert membership
  const { error: memErr } = await admin
    .from("memberships")
    .insert({ user_id: userId, org_id: orgId, role })
    .select("*")
    .maybeSingle();

  if (memErr && !String(memErr.message).includes("duplicate")) {
    return NextResponse.json({ error: memErr.message }, { status: 500 });
  }

  // Return a direct action link so you can copy/share if the email is filtered
  return NextResponse.json({ ok: true, link: actionLink });
}

// DELETE /api/admin/users  { orgId, userId }
export async function DELETE(req) {
  const body = await req.json().catch(() => ({}));
  const { orgId, userId } = body || {};
  if (!orgId || !userId) return NextResponse.json({ error: "Missing orgId or userId" }, { status: 400 });

  const supabaseAuth = authedClientFromRequest(req);
  const authz = await requireRole(supabaseAuth, orgId, ["admin"]);
  if (!authz.ok) return NextResponse.json({ error: authz.msg }, { status: authz.status });

  const admin = serviceClient();

  const { error: delErr } = await admin
    .from("memberships")
    .delete()
    .eq("org_id", orgId)
    .eq("user_id", userId);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// Allow preflight / method probing
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS,HEAD",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      Allow: "GET,POST,DELETE,OPTIONS,HEAD",
      Vary: "Origin",
    },
  });
}

export async function HEAD() {
  return new Response(null, {
    status: 204,
    headers: { Allow: "GET,POST,DELETE,OPTIONS,HEAD" },
  });
}

