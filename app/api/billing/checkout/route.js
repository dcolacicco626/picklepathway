import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { priceId, orgId: orgIdFromBody } = body;
    if (!priceId) {
      return NextResponse.json({ error: "Missing priceId" }, { status: 400 });
    }

    // Identify active org
    const orgId = cookies().get("org_id")?.value || orgIdFromBody;
    if (!orgId) {
      return NextResponse.json({ error: "No active org" }, { status: 400 });
    }

    const supa = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: org } = await supa
      .from("orgs")
      .select("id, stripe_customer_id")
      .eq("id", orgId)
      .single();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      allow_promotion_codes: true,
      customer: org?.stripe_customer_id || undefined,
      customer_creation: org?.stripe_customer_id ? undefined : "always",
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { org_id: String(orgId) },
      subscription_data: { metadata: { org_id: String(orgId) } },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/admin/club?billing=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/admin/club?billing=cancelled`,
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
