import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(req) {
  try {
    const supabase = createClient(url, anon, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });
    const body = await req.json();
    const { orgId, promoCode } = body || {};
    if (!orgId || !promoCode) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    // For now, just save it; later, you’ll validate/redeem in Stripe or your own table
    const { error } = await supabase.from("orgs").update({ promo_code: promoCode.trim() }).eq("id", orgId);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}
