// src/app/api/scoresheets/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { Document, Page, Text, View, StyleSheet, pdf, Image } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { createClient } from "@supabase/supabase-js";

/* ------------------ Supabase (server) ------------------ */
const service = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

/* ------------------ Date helpers ------------------ */
function fmtMDY(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric", month: "numeric", day: "numeric",
  });
}
function addDaysISO(iso, n) {
  if (!iso) return null;
  const dt = new Date(iso);
  dt.setDate(dt.getDate() + n);
  return dt.toISOString().slice(0, 10);
}
function weekDateISO(startISO, week) {
  if (!startISO) return null;
  return addDaysISO(startISO, (week - 1) * 7);
}

/* -------- Deterministic shuffle for Week 1 -------- */
function seededShuffle(arr, seedStr) {
  const a = [...arr];
  let s = 0;
  const seed = String(seedStr || "");
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  const rnd = () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return ((s >>> 0) % 1000) / 1000;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* --- Average up to (but not including) target week --- */
function priorAvgUpToWeek(resultsBy, pid, targetWeek) {
  let sum = 0, cnt = 0;
  for (let w = 1; w < targetWeek; w++) {
    const r = resultsBy[pid]?.[w];
    if (r?.points != null) { sum += r.points; cnt++; }
  }
  return cnt ? sum / cnt : 0;
}

/* ----- Build assignments (Week1 random; Week2+ by avg) ----- */
function buildAssignments({ league, players, resultsBy, targetWeek }) {
  if (!Array.isArray(players) || players.length === 0) return [];
  // Courts: saved selection or minimal needed (max 10)
  let courts = Array.isArray(league?.courts_enabled) && league.courts_enabled.length
    ? [...league.courts_enabled].sort((a, b) => a - b)
    : [];
  if (!courts.length) {
    const need = Math.ceil(players.length / 4);
    courts = Array.from({ length: Math.min(need, 10) }, (_, i) => i + 1);
  }

  let ordered;
  if (targetWeek === 1) {
    const seed = league?.random_seed || league?.id || league?.slug || "seed";
    ordered = seededShuffle(players, seed);
  } else {
    ordered = [...players]
      .map((p) => ({ ...p, _avg: priorAvgUpToWeek(resultsBy, p.id, targetWeek) }))
      .sort((a, b) => b._avg - a._avg || a.display_name.localeCompare(b.display_name));
  }

  const chunks = [];
  for (let i = 0; i < ordered.length; i += 4) chunks.push(ordered.slice(i, i + 4));

  const courtsDesc = [...courts].sort((a, b) => b - a);
  const assignments = [];
  for (let i = 0; i < chunks.length; i++) {
    assignments.push({ court: courtsDesc[i % courtsDesc.length], players: chunks[i] });
  }
  assignments.sort((a, b) => b.court - a.court);
  return assignments;
}

/* ---------------- PDF styles ---------------- */
const styles = StyleSheet.create({
  page: { padding: 40, flexDirection: "column", fontFamily: "Helvetica" },
  header: { marginBottom: 20 },
  title: { fontSize: 26, fontWeight: 700 },
  sub: { fontSize: 16, color: "#475569", marginTop: 6 },

  tableWrap: { marginTop: 20, borderWidth: 2, borderColor: "#0f172a", borderRadius: 6 },
  row: { flexDirection: "row" },

  cell: {
    borderRightWidth: 2, borderRightColor: "#0f172a",
    borderBottomWidth: 2, borderBottomColor: "#0f172a",
    paddingHorizontal: 12, height: 60, justifyContent: "center",
  },
  lastCell: { borderRightWidth: 0 },

  head: { backgroundColor: "#f1f5f9" },
  headText: { fontSize: 14, fontWeight: 700 },

  cellText: { fontSize: 14 },
  nameText: { fontSize: 14 },

  notesBox: { marginTop: 20 },
  notes: { fontSize: 16, color: "#475569" },

  qrRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 24, gap: 16 },
  qrLabel: { fontSize: 24, color: "#0f172a", flexGrow: 1, maxWidth: 575 },
  qrImg: { width: 65, height: 65, borderWidth: 2, borderColor: "#e5e7eb" },
});

/* -------------- GET: return scoresheets PDF --------------
   Query:
     - slug: league slug  (required)
     - week: 1..6 (optional; if missing, compute “upcoming”)
----------------------------------------------------------- */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug");
    let week = Number(searchParams.get("week"));

    if (!slug) {
      return NextResponse.json({ ok: false, error: "Missing slug" }, { status: 400 });
    }

    // Load league, players, results (server key bypasses any RLS that would block)
    const { data: league, error: le } = await service.from("league").select("*").eq("slug", slug).maybeSingle();
    if (le || !league) {
      return NextResponse.json({ ok: false, error: le?.message || "League not found" }, { status: 404 });
    }

    const [{ data: players }, { data: res }] = await Promise.all([
      service.from("players").select("*").eq("league_id", league.id).order("created_at"),
      service.from("week_results").select("*").eq("league_id", league.id),
    ]);

    const resultsBy = {};
    (res || []).forEach((r) => {
      (resultsBy[r.player_id] ||= {})[r.week] = { points: r.points };
    });

    // Determine “upcoming” week if not provided
    if (!Number.isFinite(week) || week < 1) {
      const nowNY = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
      const start = league.start_date ? new Date(league.start_date + "T00:00:00") : null;
      let w = 1;
      if (start) {
        const diffDays = Math.floor((nowNY - start) / (1000 * 60 * 60 * 24));
        w = Math.floor(diffDays / 7) + 1;
        if (w < 1) w = 1;
        if (w > 6) w = 6;
      }
      week = w;
    }
    if (week > 6) week = 6;

    // Build assignments for that week
    const groups = buildAssignments({ league, players: players || [], resultsBy, targetWeek: week });

    // Build QR code → **player portal on picklepathway** (new path)
    const base =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL || // fallback if you had this before
      "https://picklepathway.com";
    const portalUrl = `${base}/player/${league.slug}`;
    const qrDataUrl = await QRCode.toDataURL(portalUrl, { margin: 1, scale: 6 });

    // Build PDF (one page per court)
    const wkIso = weekDateISO(league.start_date, week);
    const wkLabel = fmtMDY(wkIso);

    const Doc = (
      <Document title={`Scoresheets_Week${week}_${league.slug}`}>
        {groups.map((g, idx) => {
          const names = (g.players || []).map((p) => p.display_name);
          while (names.length < 4) names.push("—");

          const W_ROW = 1.2, W_COL = 0.8;

          return (
            <Page key={idx} size="LETTER" orientation="landscape" style={styles.page}>
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>
                  {league.division || league.slug} — Court {g.court} — Week {week}{wkLabel ? ` (${wkLabel})` : ""}
                </Text>
              </View>

              {/* Table */}
              <View style={styles.tableWrap}>
                {/* Header row */}
                <View style={[styles.row, styles.head]}>
                  <View style={[styles.cell, { flex: W_ROW }]}>
                    <Text style={styles.headText}>COURT {g.court}</Text>
                  </View>
                  {[1,2,3,4,5,6].map((k) => (
                    <View key={k} style={[styles.cell, { flex: W_COL }]}>
                      <Text style={styles.headText}>Game {k}</Text>
                    </View>
                  ))}
                  <View style={[styles.cell, styles.lastCell, { flex: W_COL }]}>
                    <Text style={styles.headText}>Total</Text>
                  </View>
                </View>

                {/* Player rows */}
                {names.map((n, i) => (
                  <View key={i} style={styles.row}>
                    <View style={[styles.cell, { flex: W_ROW }]}>
                      <Text wrap={false} maxLines={1} style={styles.nameText}>
                        {n && n !== "" ? n : "—"}
                      </Text>
                    </View>
                    {[1,2,3,4,5,6].map((k) => (
                      <View key={k} style={[styles.cell, { flex: W_COL }]} />
                    ))}
                    <View style={[styles.cell, styles.lastCell, { flex: W_COL }]} />
                  </View>
                ))}
              </View>

              {/* QR + note */}
              <View style={styles.qrRow}>
                <Text style={styles.qrLabel}>
                  Scan this QR at the end of the night to record your TOTAL score and see live standings:
                  {"\n"}
                  {portalUrl}
                </Text>
                <Image src={qrDataUrl} style={styles.qrImg} />
              </View>
            </Page>
          );
        })}
      </Document>
    );

    const pdfBuf = await pdf(Doc).toBuffer();
    const filename = `scoresheets_${league.slug}_week${week}.pdf`;

    return new NextResponse(pdfBuf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
