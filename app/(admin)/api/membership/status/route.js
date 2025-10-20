import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId");
    const supabase = createClient(url, anon, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });

    const { data, error } = await supabase
      .from("orgs")
      .select("plan, trial_started_at, trial_days, subscription_status, promo_code")
      .eq("id", orgId)
      .maybeSingle();
    if (error || !data) throw error || new Error("Org not found");

    const started = data.trial_started_at ? new Date(data.trial_started_at) : null;
    const days = data.trial_days || 14;
    const now = new Date();
    const remainingDays = started ? Math.max(0, Math.ceil((started.getTime() + days*864e5 - now.getTime()) / 864e5)) : 0;

    const locked = (data.plan === "trial" && remainingDays <= 0) ||
                   (data.subscription_status && ["canceled", "past_due"].includes(data.subscription_status));

    return NextResponse.json({ ...data, remainingDays, locked });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}
