export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function GET() {
  const c = cookies();
  return NextResponse.json({ orgId: c.get("active_org")?.value ?? null });
}

export async function POST(req) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const c = cookies();

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body = {}; try { body = await req.json(); } catch {}
    let orgId = body.orgId ?? null;

    if (!orgId) {
      const { data: m } = await supabase
        .from("memberships")
        .select("org_id")
        .eq("user_id", user.id)
        .order("last_used_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      orgId = m?.org_id ?? null;
    }
    if (!orgId) return NextResponse.json({ error: "No active org" }, { status: 400 });

    // Verify membership
    const { data: membership } = await supabase
      .from("memberships")
      .select("org_id")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Set cookie on the response
    const res = NextResponse.json({ ok: true, orgId });
    res.cookies.set("active_org", orgId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 180,
    });

    // Optional: update "last used"
    await supabase
      .from("memberships")
      .update({ last_used_at: new Date().toISOString() })
      .eq("org_id", orgId)
      .eq("user_id", user.id);

    return res;
  } catch (err) {
    console.error("active-org POST failed", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
