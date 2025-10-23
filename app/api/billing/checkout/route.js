export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { getStripe } from "@/lib/stripe";

const PRICE = {
  pro: process.env.STRIPE_PRICE_PRO,           // e.g. price_123 for monthly
  pro_yearly: process.env.STRIPE_PRICE_PRO_Y,  // optional yearly
  // add other plans if you have them
};


export async function POST(req) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const c = cookies();

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
  const { priceId, plan, orgId: orgIdFromBody } = body;

// resolve orgId as you already do… (unchanged)

let price = priceId;
if (!price && plan) {
  price = PRICE[plan];
}
if (!price) {
  return NextResponse.json(
    { error: "Missing price. Provide priceId or a plan with a configured STRIPE_PRICE_* env." },
    { status: 400 }
  );
}


    let orgId = orgIdFromBody ?? c.get("active_org")?.value ?? null;
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

    // Fetch org to reuse Stripe customer if exists
    const { data: org } = await supabase
      .from("orgs").select("stripe_customer_id").eq("id", orgId).single();

    const stripe = getStripe();

    const price = priceId /* or map plan->price here */;
    if (!price) return NextResponse.json({ error: "Missing priceId" }, { status: 400 });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      allow_promotion_codes: true,
      customer: org?.stripe_customer_id || undefined,
      customer_creation: org?.stripe_customer_id ? undefined : "always",
      line_items: [{ price, quantity: 1 }],
      metadata: { org_id: String(orgId) },
      subscription_data: { metadata: { org_id: String(orgId) } },
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL}/admin?billing=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL}/admin?billing=cancelled`,
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (e) {
    console.error("checkout error", e);
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
