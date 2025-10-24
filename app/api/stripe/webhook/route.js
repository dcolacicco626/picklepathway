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

// Map Stripe price IDs to canonical plans your app understands
const PRICE_TO_PLAN = {
  [process.env.STRIPE_PRICE_STARTER]: "starter",
  [process.env.STRIPE_PRICE_PRO]: "pro",
};

async function updateOrgFromSubscription(supa, sub, fallbackCustomerId) {
  // Determine plan from price id
  const price = sub?.items?.data?.[0]?.price || null;
  const priceId = price?.id || null;
  const plan = PRICE_TO_PLAN[priceId] || null;

  // Compute active_until from Stripe period end (ms)
  const activeUntil = sub?.current_period_end
    ? new Date(sub.current_period_end * 1000).toISOString()
    : null;

  const payload = {
    plan, // may be null if price isn't mapped (won't overwrite if you like)
    subscription_status: sub?.status || null,
    active_until: activeUntil,
    stripe_subscription_id: sub?.id || null,
    stripe_customer_id: (typeof sub?.customer === "string" ? sub.customer : null) || fallbackCustomerId || null,
  };

  return payload;
}

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

  // ----- 2) Handle subscription lifecycle events -----
  try {
    const stripe = getStripe();
    const supa = createClient(
      need("NEXT_PUBLIC_SUPABASE_URL"),
      need("SUPABASE_SERVICE_ROLE_KEY")
    );

    // Helper to locate org by metadata OR by subscription/customer
    async function resolveOrgId({ metadataOrgId, subscriptionId, customerId }) {
      if (metadataOrgId) return metadataOrgId;

      // try by subscription id
      if (subscriptionId) {
        const { data: orgBySub } = await supa
          .from("orgs")
          .select("id")
          .eq("stripe_subscription_id", subscriptionId)
          .maybeSingle();
        if (orgBySub?.id) return orgBySub.id;
      }

      // try by customer id
      if (customerId) {
        const { data: orgByCust } = await supa
          .from("orgs")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();
        if (orgByCust?.id) return orgByCust.id;
      }

      return null;
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object;
        const metadataOrgId =
          s?.metadata?.org_id ||
          s?.subscription_details?.metadata?.org_id || // older format fallback (rare)
          null;

        const customerId = typeof s?.customer === "string" ? s.customer : null;
        const subscriptionId = typeof s?.subscription === "string" ? s.subscription : null;

        const orgId = await resolveOrgId({ metadataOrgId, subscriptionId, customerId });
        if (!orgId || !subscriptionId) return new Response("ok", { status: 200 });

        // Pull full subscription to get price + status + period end
        const sub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ["items.data.price"] });
        const patch = await updateOrgFromSubscription(supa, sub, customerId);

        const { error } = await supa
          .from("orgs")
          .update(patch)
          .eq("id", orgId);

        if (error) console.error("❌ supabase update (session.completed):", error);
        return new Response("ok", { status: 200 });
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object;

        // orgId via explicit metadata (best), else look up by subscription or customer
        const metadataOrgId = sub?.metadata?.org_id || null;
        const customerId = typeof sub?.customer === "string" ? sub.customer : null;
        const orgId = await resolveOrgId({ metadataOrgId, subscriptionId: sub?.id, customerId });

        if (!orgId) return new Response("ok", { status: 200 });

        if (event.type === "customer.subscription.deleted") {
          // Clear subscription + revert to trial
          const { error } = await supa
            .from("orgs")
            .update({
              plan: "trial",
              subscription_status: "canceled",
              active_until: new Date().toISOString(),
              stripe_subscription_id: null,
              stripe_customer_id: customerId || null, // keep customer id if we know it
            })
            .eq("id", orgId);
          if (error) console.error("❌ supabase update (sub.deleted):", error);
          return new Response("ok", { status: 200 });
        }

        // created/updated → sync details
        const patch = await updateOrgFromSubscription(supa, sub, customerId);
        const { error } = await supa
          .from("orgs")
          .update(patch)
          .eq("id", orgId);
        if (error) console.error("❌ supabase update (sub.updated/created):", error);
        return new Response("ok", { status: 200 });
      }

      default: {
        // acknowledge everything else to prevent retries
        return new Response("ok", { status: 200 });
      }
    }
  } catch (err) {
    console.error("❌ Handler error:", err);
    return new Response("Internal error", { status: 500 });
  }
}
