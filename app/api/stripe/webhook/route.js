import { stripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs"; // needed for raw body/signature verification

export async function POST(req) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });

  let event;
  try {
    const buf = Buffer.from(await req.arrayBuffer());
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object;
        const orgId =
          s?.metadata?.org_id ||
          s?.subscription_details?.metadata?.org_id ||
          null;
        const customerId = s.customer;
        const subscriptionId = s.subscription;

        if (orgId && subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          const price = sub.items.data[0]?.price;
          const plan = price?.nickname || price?.id || "unknown";
          const currentPeriodEnd = new Date(sub.current_period_end * 1000);

          await supa
            .from("orgs")
            .update({
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              plan,
              active_until: currentPeriodEnd.toISOString(),
            })
            .eq("id", orgId);
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const orgId = sub?.metadata?.org_id || null;
        const price = sub?.items?.data?.[0]?.price;
        const plan = price?.nickname || price?.id || null;
        const currentPeriodEnd = sub?.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null;

        if (orgId) {
          await supa
            .from("orgs")
            .update({
              stripe_subscription_id: sub.id,
              plan,
              active_until: currentPeriodEnd,
            })
            .eq("id", orgId);
        }
        break;
      }

      default:
        // noop for other events
        break;
    }

    return new Response("ok", { status: 200 });
  } catch (e) {
    return new Response(`Handler error: ${e?.message || e}`, { status: 500 });
  }
}
