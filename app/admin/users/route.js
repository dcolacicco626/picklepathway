// /app/api/admin/users/route.js
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, createClient } from "@supabase/supabase-js"; // service+browser SDK

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE; // <-- server-only!

function authedClientFromCookies() {
  const cookieStore = cookies();
  // This client reads the caller’s session (for authz check). No service role here.
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { "X-Client-Info": "pp-admin-users-api" } },
    auth: {
      persistSession: false,
      detectSessionInUrl: false,
      storage: {
        getItem: (key) => cookieStore.get(key)?.value ?? null,
        setItem: () => {},
        removeItem: () => {},
      },
    },
  });
}

function serviceClient() {
  // This client performs privileged actions after we authorize the caller.
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false },
  });
}

// ---- helpers ----
async function requireAdminOrOwner(orgId) {
  const supabase = authedClientFromCookies();
  const { data: { user } = { user: null } } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, msg: "Not signed in" };

  // must be owner or admin of this org
  const { data: rows, error } = await supabase
    .from("memberships")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", user.id);

  if (error) return { ok: false, status: 500, msg: error.message };
  const role = rows?.[0]?.role;
  if (!role || !["owner", "admin", "manager"].includes(role)) {
    return { ok: false, status: 403, msg: "Forbidden" };
  }
  return { ok: true, userId: user.id, role };
}

// GET /api/admin/users?orgId=...
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "Missing orgId" }, { status: 400 });

  const authz = await requireAdminOrOwner(orgId);
  if (!authz.ok) return NextResponse.json({ error: authz.msg }, { status: authz.status });

  // Use service role to join with auth.users to show emails
  const admin = serviceClient();

  // 1) get memberships
  const { data: mems, error: memErr } = await admin
    .from("memberships")
    .select("user_id, role")
    .eq("org_id", orgId);

  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 });

  if (!mems?.length) return NextResponse.json({ users: [] });

  // 2) fetch emails from auth.users
  const ids = mems.map((m) => m.user_id);
  const { data: users, error: userErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 2000 });
  if (userErr) return NextResponse.json({ error: userErr.message }, { status: 500 });

  const emailById = new Map(users.users.map((u) => [u.id, u.email]));
  const display = mems.map((m) => ({
    user_id: m.user_id,
    email: emailById.get(m.user_id) || "(unknown)",
    role: m.role,
  }));

  return NextResponse.json({ users: display });
}

// POST /api/admin/users  { orgId, email, role, name? }
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const { orgId, email, role = "admin", name } = body || {};
  if (!orgId || !email) return NextResponse.json({ error: "Missing orgId or email" }, { status: 400 });

  const authz = await requireAdminOrOwner(orgId);
  if (!authz.ok) return NextResponse.json({ error: authz.msg }, { status: authz.status });

  const admin = serviceClient();

  // 1) find or create user by email (send invite email)
  let userId = null;

  // try to find existing user first
  const { data: all, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 2000 });
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });
  const existing = all.users.find((u) => (u.email || "").toLowerCase() === email.toLowerCase());
  if (existing) {
    userId = existing.id;
  } else {
    // invite (they’ll set password via email)
    const { data: invited, error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || ""}/login`,
    });
    if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 });
    userId = invited?.user?.id;
  }

  if (!userId) return NextResponse.json({ error: "Could not create or find user" }, { status: 500 });

  // 2) upsert membership
  const { error: memErr } = await admin
    .from("memberships")
    .insert({ user_id: userId, org_id: orgId, role })
    .select("*")
    .maybeSingle();
  if (memErr && !String(memErr.message).includes("duplicate")) {
    return NextResponse.json({ error: memErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/users  { orgId, userId }
export async function DELETE(req) {
  const body = await req.json().catch(() => ({}));
  const { orgId, userId } = body || {};
  if (!orgId || !userId) return NextResponse.json({ error: "Missing orgId or userId" }, { status: 400 });

  const authz = await requireAdminOrOwner(orgId);
  if (!authz.ok) return NextResponse.json({ error: authz.msg }, { status: authz.status });

  // Optional guard: don’t allow removing yourself if you’re the last owner
  const admin = serviceClient();

  // Count owners
  const { data: owners, error: ownersErr } = await admin
    .from("memberships")
    .select("user_id")
    .eq("org_id", orgId)
    .eq("role", "owner");
  if (ownersErr) return NextResponse.json({ error: ownersErr.message }, { status: 500 });

  const isSelf = authz.userId === userId;
  const isLastOwner = (owners || []).length <= 1 && (owners || [])[0]?.user_id === userId;
  if (isSelf && isLastOwner) {
    return NextResponse.json({ error: "Cannot remove the last owner." }, { status: 400 });
  }

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
      "Allow": "GET,POST,DELETE,OPTIONS,HEAD",
      "Vary": "Origin",
    },
  });
}

export async function HEAD() {
  return new Response(null, {
    status: 204,
    headers: { "Allow": "GET,POST,DELETE,OPTIONS,HEAD" },
  });
}
