// app/api/membership/status/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const need = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env: ${k}`);
  return v;
};

function computeStatus(org) {
  const now = new Date();

  // trial window
  const started = org.trial_started_at ? new Date(org.trial_started_at) : null;
  const days = Number.isFinite(org.trial_days) ? org.trial_days : 14;
  const trialEnd =
    started && days > 0
      ? new Date(started.getTime() + days * 24 * 3600 * 1000)
      : null;
  const remainingDays =
    trialEnd && trialEnd > now
      ? Math.max(0, Math.ceil((trialEnd - now) / (24 * 3600 * 1000)))
      : 0;

  // paid/active window
  const activeUntil = org.active_until ? new Date(org.active_until) : null;
  const subStatus = String(org.subscription_status || "").toLowerCase();
  const hasActiveSub =
    !!org.stripe_subscription_id &&
    (["active", "trialing", "incomplete", "past_due"].includes(subStatus) ||
      (activeUntil && activeUntil > now));

  // lock rules
  const locked = hasActiveSub ? false : remainingDays <= 0;

  // normalize plan label for UI
  const plan =
    hasActiveSub
      ? String(org.plan || "starter").toLowerCase()
      : remainingDays > 0
      ? "trial"
      : String(org.plan || "starter").toLowerCase();

  return { plan, remainingDays, locked };
}

export async function GET(req) {
  try {
    // orgId from query OR cookie
    const url = new URL(req.url);
    const qOrgId = url.searchParams.get("orgId");
    const cOrgId = cookies().get("org_id")?.value || null;
    const orgId = qOrgId || cOrgId;

    if (!orgId) {
      return NextResponse.json({ error: "No active org" }, { status: 400 });
    }

    // Server-side: use service role to bypass RLS safely
    const supa = createClient(
      need("NEXT_PUBLIC_SUPABASE_URL"),
      need("SUPABASE_SERVICE_ROLE_KEY")
    );

    const { data: org, error } = await supa
      .from("orgs")
      .select(
        "id, name, slug, plan, trial_started_at, trial_days, active_until, subscription_status, promo_code, stripe_customer_id, stripe_subscription_id"
      )
      .eq("id", orgId)
      .single();

    if (error || !org) {
      return NextResponse.json(
        { error: error?.message || "Org not found" },
        { status: 404 }
      );
    }

    const { plan, remainingDays, locked } = computeStatus(org);

    return NextResponse.json({
      orgId: org.id,
      name: org.name,
      slug: org.slug,
      plan,
      remainingDays,
      locked,
      promo_code: org.promo_code || null,
      stripe: {
        customer: org.stripe_customer_id || null,
        subscription: org.stripe_subscription_id || null,
        status: org.subscription_status || null,
        active_until: org.active_until,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
