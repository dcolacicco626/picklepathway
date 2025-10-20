// app/api/stripe/webhook/route.js
export const runtime = "nodejs";

import { getStripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";

// helper to enforce required envs with a clear error
const need = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env: ${k}`);
  return v;
};

export async function POST(req) {
  // ----- 1) Verify signature -----
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });

  let event;
  try {
    const buf = Buffer.from(await req.arrayBuffer());
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(buf, sig, need("STRIPE_WEBHOOK_SECRET"));
    console.log("stripe_webhook", { type: event.type });
  } catch (err) {
    console.error("❌ Webhook verify/env error:", err);
    const isSigErr =
      String(err?.message || "").includes("No signatures found") ||
      String(err?.message || "").includes("Signature verification") ||
      String(err?.message || "").startsWith("Missing env:");
    return new Response(`Webhook Error: ${err.message}`, { status: isSigErr ? 400 : 500 });
  }

  // ----- 2) Handle only subscription-related events -----
  try {
    if (
      event.type !== "checkout.session.completed" &&
      event.type !== "customer.subscription.updated" &&
      event.type !== "customer.subscription.deleted"
    ) {
      // acknowledge everything else to prevent retries
      return new Response("ok", { status: 200 });
    }

    const supa = createClient(
      need("NEXT_PUBLIC_SUPABASE_URL"),
      need("SUPABASE_SERVICE_ROLE_KEY")
    );

    if (event.type === "checkout.session.completed") {
      const s = event.data.object;
      const orgId = s?.metadata?.org_id || s?.subscription_details?.metadata?.org_id || null;
      const customerId = s?.customer || null;
      const subscriptionId = s?.subscription || null;

      if (!orgId || !subscriptionId) {
        return new Response("ok", { status: 200 });
      }

      const stripe = getStripe();
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const price = sub.items?.data?.[0]?.price;
      const plan = price?.nickname || price?.id || "unknown";
      const activeUntil = new Date(sub.current_period_end * 1000).toISOString();

      console.log("stripe_update_org", { event: event.type, orgId, plan, active_until: activeUntil });

      const { error } = await supa
        .from("orgs")
        .update({
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          plan,
          active_until: activeUntil,
        })
        .eq("id", orgId);

      if (error) console.error("❌ supabase update (session.completed):", error);
      return new Response("ok", { status: 200 });
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const sub = event.data.object;
      const orgId = sub?.metadata?.org_id || null;
      if (!orgId) {
        return new Response("ok", { status: 200 });
      }

      const price = sub?.items?.data?.[0]?.price || null;
      const plan = price?.nickname || price?.id || null;
      const activeUntil = sub?.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null;

      console.log("stripe_update_org", { event: event.type, orgId, plan, active_until: activeUntil });

      const { error } = await supa
        .from("orgs")
        .update({
          stripe_subscription_id: sub.id,
          plan,
          active_until: activeUntil,
        })
        .eq("id", orgId);

      if (error) console.error("❌ supabase update (sub.updated/deleted):", error);
      return new Response("ok", { status: 200 });
    }

    // fallback (shouldn't hit because we returned above)
    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("❌ Handler error:", err);
    return new Response("Internal error", { status: 500 });
  }
}
