export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

// Shared core so GET and POST behave the same
async function handleStatus(req) {
  const supabase = createRouteHandlerClient({ cookies }); // pass the function
  const c = cookies();

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Allow orgId from body OR query OR cookie
  let orgId = null;

  // 1) query string
  try {
    const url = new URL(req.url);
    orgId = url.searchParams.get("orgId") || null;
  } catch {}

  // 2) body
  if (!orgId && req.method === "POST") {
    try {
      const body = await req.json();
      orgId = body?.orgId || null;
    } catch {}
  }

  // 3) cookie
  if (!orgId) {
    orgId = c.get("active_org")?.value || null;
  }

  // 4) last-used fallback
  if (!orgId) {
    const { data: m } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .order("last_used_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    orgId = m?.org_id || null;
  }

  if (!orgId) return NextResponse.json({ error: "No active org." }, { status: 400 });

  // Verify membership
  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Load org
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
}

export async function POST(req) {
  try {
    return await handleStatus(req);
  } catch (err) {
    console.error("/api/membership/status POST error", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    return await handleStatus(req);
  } catch (err) {
    console.error("/api/membership/status GET error", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
