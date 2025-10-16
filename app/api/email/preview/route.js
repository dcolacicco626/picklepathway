// app/api/email/preview/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchTemplate, renderTemplate } from "../../../../lib/emailRenderer";

/* ------------- Date helpers (UTC-safe for labels) ------------- */
function addDaysISO(iso, days) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function weekDateISO(startISO, week) {
  return startISO ? addDaysISO(startISO, (week - 1) * 7) : null;
}
function fmtMDY(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/* ---------------------- POST ---------------------- */
export async function POST(req) {
  try {
    const { leagueId, week, assignmentsHtml } = await req.json();

    if (!leagueId) {
      return NextResponse.json({ error: "missing_league_id" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      // prefer standard var; fall back to legacy name if present
      process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: league, error: le } = await supabase
      .from("league")
      .select("*")
      .eq("id", leagueId)
      .maybeSingle();

    if (le || !league) {
      return NextResponse.json({ error: "league_not_found" }, { status: 404 });
    }

    const phase = Number(week) === 1 ? "intro" : "weekly";
    const tmpl = await fetchTemplate(league.id ?? null, phase);

    if (!tmpl || !tmpl.subject_template || !tmpl.html_template) {
      return NextResponse.json({ error: "template_not_found" }, { status: 404 });
    }

    // Base site URL → new paths use /player/[slug]
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://picklepathway.com";

    const subjectHtml = renderTemplate(
      tmpl.subject_template,
      tmpl.html_template,
      {
        league,
        week,
        weekLabel: fmtMDY(weekDateISO(league.start_date, week)),
        assignmentsHtml: assignmentsHtml || "",
        subPolicyHtml: "",
        playerPortalUrl: `${baseUrl}/player/${league.slug}`,
      }
    );

    // renderTemplate returns { subject, html }
    return NextResponse.json(subjectHtml);
  } catch (e) {
    return NextResponse.json(
      { error: e?.message || "unknown_error" },
      { status: 500 }
    );
  }
}
