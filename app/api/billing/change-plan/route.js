export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

const PRICE = {
  starter: process.env.STRIPE_PRICE_STARTER, // e.g. price_live_xxx (recurring)
  pro: process.env.STRIPE_PRICE_PRO,
};

export async function POST(req) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const c = cookies();

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { orgId: orgIdFromBody, toPlan } = body;
    if (!["starter", "pro"].includes(toPlan)) {
      return NextResponse.json({ error: "Invalid target plan" }, { status: 400 });
    }

    // resolve org
    let orgId = orgIdFromBody ?? c.get("active_org")?.value ?? null;
    if (!orgId) {
      const { data: m } = await supabase
        .from("memberships").select("org_id")
        .eq("user_id", user.id)
        .order("last_used_at", { ascending: false })
        .limit(1).maybeSingle();
      orgId = m?.org_id ?? null;
    }
    if (!orgId) return NextResponse.json({ error: "No active org" }, { status: 400 });

    // verify membership
    const { data: membership } = await supabase
      .from("memberships").select("org_id")
      .eq("org_id", orgId).eq("user_id", user.id).maybeSingle();
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // get org + subscription
    const { data: org } = await supabase
      .from("orgs")
      .select("id, plan, stripe_customer_id, stripe_subscription_id")
      .eq("id", orgId).single();

    if (!org?.stripe_subscription_id) {
      return NextResponse.json({ error: "No active subscription to change" }, { status: 400 });
    }
    const targetPrice = PRICE[toPlan];
    if (!targetPrice) {
      return NextResponse.json({ error: `Missing env price for ${toPlan}` }, { status: 400 });
    }

    // load subscription + current item
    const sub = await stripe.subscriptions.retrieve(org.stripe_subscription_id, { expand: ["items.data.price"] });
    const item = sub.items.data[0];
    if (!item) return NextResponse.json({ error: "No subscription item found" }, { status: 400 });

    // update plan (keeps proration by default)
    await stripe.subscriptionItems.update(item.id, { price: targetPrice });

    // reflect on org
    await supabase.from("orgs").update({ plan: toPlan }).eq("id", orgId);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("change-plan error", e);
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
