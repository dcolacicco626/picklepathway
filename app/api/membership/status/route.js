import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  );
}

export async function POST(req) {
  try {
    const c = cookies();
    let body = {};
    try { body = await req.json(); } catch {}

    const orgId = body.orgId || c.get("active_org")?.value;
    if (!orgId) return NextResponse.json({ error: "No active org." }, { status: 400 });

    const supabase = getSupabase();
    const { data: org, error: orgErr } = await supabase
      .from("orgs")
      .select("id, plan, stripe_customer_id, stripe_subscription_id, subscription_status, active_until")
      .eq("id", orgId)
      .maybeSingle();

    if (orgErr || !org) return NextResponse.json({ error: "Org not found." }, { status: 404 });

    let sub = null;
    if (org.stripe_subscription_id) {
      try { sub = await stripe.subscriptions.retrieve(org.stripe_subscription_id); } catch {}
    }

    let portal_url = null;
    if (org.stripe_customer_id) {
      const session = await stripe.billingPortal.sessions.create({
        customer: org.stripe_customer_id,
        return_url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://www.picklepathway.com"}/admin`,
      });
      portal_url = session.url;
    }

    return NextResponse.json({
      orgId,
      plan: org.plan,
      subscription_status: sub?.status || org.subscription_status || null,
      active_until: org.active_until,
      portal_url,
    });
  } catch (err) {
    console.error("/api/membership/status error", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
