import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function GET() {
  const c = cookies();
  return NextResponse.json({ orgId: c.get("active_org")?.value ?? null });
}

export async function POST(req) {
  try {
    const c = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => c });

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Safe parse
    let body = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    let orgId = body.orgId;

    // Try to infer org if not provided
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
      return NextResponse.json(
        { error: "No active org. Please switch to a club first." },
        { status: 400 }
      );
    }

    // Verify membership
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
