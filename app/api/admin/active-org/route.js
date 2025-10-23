import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

function getSupabase(token) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  );
  const baseFetch = supabase.fetch.bind(supabase);
  supabase.fetch = (url, init = {}) => {
    init.headers = Object.assign({}, init.headers, token ? { Authorization: `Bearer ${token}` } : {});
    return baseFetch(url, init);
  };
  return supabase;
}

function getAccessTokenFromCookies(c) {
  const direct = c.get("sb-access-token")?.value;
  if (direct) return direct;
  const entry = [...c.getAll().values()].find(ck => ck.name.startsWith("sb-") && ck.name.endsWith("-auth-token"));
  if (entry?.value) {
    try {
      const parsed = JSON.parse(entry.value);
      return parsed?.access_token || parsed?.currentSession?.access_token || null;
    } catch { return null; }
  }
  return null;
}

export async function GET() {
  const c = cookies();
  return NextResponse.json({ orgId: c.get("active_org")?.value ?? null });
}

export async function POST(req) {
  try {
    const c = cookies();
    const token = getAccessTokenFromCookies(c);
    const supabase = getSupabase(token);

    const { data: userData, error: authErr } = await supabase.auth.getUser(token || undefined);
    const user = userData?.user;
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body = {};
    try { body = await req.json(); } catch {}
    let orgId = body.orgId;

    if (!orgId) {
      const { data: m } = await supabase
        .from("org_members")
        .select("org_id")
        .eq("user_id", user.id)
        .order("last_used_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (m?.org_id) orgId = m.org_id;
    }

    if (!orgId) {
      return NextResponse.json({ error: "No active org. Please switch to a club first." }, { status: 400 });
    }

    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: "Not a member of that org" }, { status: 403 });
    }

    const res = NextResponse.json({ ok: true, orgId });
    res.cookies.set("active_org", orgId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 180,
    });

    await supabase
      .from("org_members")
      .update({ last_used_at: new Date().toISOString() })
      .eq("org_id", orgId)
      .eq("user_id", user.id);

    return res;
  } catch (err) {
    console.error("active-org POST failed", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
