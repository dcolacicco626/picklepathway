export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

export async function POST(req) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const c = cookies();

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { orgId: orgIdFromBody, reason } = body;

    let orgId = orgIdFromBody ?? c.get("active_org")?.value ?? null;
    if (!orgId) return NextResponse.json({ error: "No active org" }, { status: 400 });

    const { data: membership } = await supabase
      .from("memberships").select("org_id")
      .eq("org_id", orgId).eq("user_id", user.id).maybeSingle();
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data: org } = await supabase
      .from("orgs")
      .select("stripe_subscription_id")
      .eq("id", orgId).single();

    if (!org?.stripe_subscription_id) {
      return NextResponse.json({ error: "No active subscription" }, { status: 400 });
    }

    await stripe.subscriptions.update(org.stripe_subscription_id, {
      cancel_at_period_end: true,
      cancellation_details: { comment: reason?.slice(0, 255) || undefined },
    });

    // optionally store reason in DB
    await supabase.from("orgs").update({ cancel_reason: reason || null }).eq("id", orgId);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("cancel error", e);
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
