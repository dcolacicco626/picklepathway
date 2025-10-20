// app/api/subs/delete/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/** ---------------- Supabase (server) ---------------- **/
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  // Use the standard service role env name for consistency with other routes
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_KEY || // fallback if older env name is in use
    "";

  if (!url || !serviceKey) {
    throw new Error("Missing Supabase URL or service role key on the server.");
  }

  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

/** ---------------- Auth guard ---------------- **/
const SERVER_ADMIN_TOKEN =
  process.env.ADMIN_TOKEN || process.env.NEXT_PUBLIC_ADMIN_TOKEN || "";

/** ---------------- POST /api/subs/delete ----------------
 * Expected JSON body:
 *  { subId: string, leagueId: string, adminToken: string }
 * ------------------------------------------------------- */
export async function POST(req) {
  try {
    const { subId, leagueId, adminToken } = await req.json();

    if (!adminToken || adminToken !== SERVER_ADMIN_TOKEN) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    if (!subId || !leagueId) {
      return NextResponse.json({ ok: false, error: "missing subId or leagueId" }, { status: 400 });
    }

    const supabase = getAdminClient();

    const { error } = await supabase
      .from("subs_pool")
      .delete()
      .eq("id", subId)
      .eq("league_id", leagueId);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
