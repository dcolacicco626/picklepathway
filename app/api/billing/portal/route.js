export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { getStripe } from "@/lib/stripe";

export async function POST() {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const c = cookies();

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let orgId = c.get("active_org")?.value ?? null;
    if (!orgId) {
      const { data: m } = await supabase
        .from("memberships").select("org_id")
        .eq("user_id", user.id).order("last_used_at", { ascending: false })
        .limit(1).maybeSingle();
      orgId = m?.org_id ?? null;
    }
    if (!orgId) return NextResponse.json({ error: "No active org" }, { status: 400 });

    const { data: membership } = await supabase
      .from("memberships").select("org_id")
      .eq("org_id", orgId).eq("user_id", user.id).maybeSingle();
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data: org, error } = await supabase
      .from("orgs").select("stripe_customer_id").eq("id", orgId).single();
    if (error || !org?.stripe_customer_id) {
      return NextResponse.json({ error: "No Stripe customer" }, { status: 400 });
    }

    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL}/admin?billing=portal-return`,
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("portal error", e);
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
