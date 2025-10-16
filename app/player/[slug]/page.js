"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

/* ============== Theme ============== */
const brand = {
  bg: "bg-[#f7fbf8]",
  card: "bg-white shadow-sm rounded-2xl",
  text: "text-slate-800",
  subtext: "text-slate-600",
  ring: "ring-1 ring-slate-200",
  cta: "bg-[#0ea568] text-white",
  border: "border border-slate-200",
  chip: "bg-[#e9f7f0] text-[#0b8857]",
  warn: "bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800",
};

// ---- Local date helpers (no UTC shift) ----
function parseYMDLocal(iso) {
  if (!iso) return null;
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
const fmtMD = (d) =>
  d ? parseYMDLocal(d).toLocaleDateString(undefined, { month: "numeric", day: "numeric" }) : "";
const fmtMDY = (d) =>
  d ? parseYMDLocal(d).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "";
function addDaysISOLocal(iso, n) {
  const dt = parseYMDLocal(iso);
  if (!dt) return null;
  dt.setDate(dt.getDate() + n);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
const weekDateISO = (startISO, week) => (startISO ? addDaysISOLocal(startISO, (week - 1) * 7) : null);

// Suggest the default week for the player's “Enter a weekly result” dropdown.
function suggestResultWeek(startISO) {
  if (!startISO) return 1;

  const today = new Date();
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  // 1) Week within 0–6 days
  for (let w = 1; w <= 6; w++) {
    const wDate = parseYMDLocal(weekDateISO(startISO, w));
    if (!wDate) continue;
    const ms = wDate - todayMid;
    const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
    if (days >= 0 && days <= 6) return w;
  }
  // 2) Earliest future week
  for (let w = 1; w <= 6; w++) {
    const wDate = parseYMDLocal(weekDateISO(startISO, w));
    if (wDate && wDate >= todayMid) return w;
  }
  // 3) All past → 6
  return 6;
}

/* Deterministic shuffle (week 1) */
function seededShuffle(arr, seedStr) {
  const a = [...arr];
  let s = 0;
  const seed = String(seedStr || "");
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  const rnd = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1000) / 1000;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* Simple modal */
function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-[min(860px,92vw)] max-h-[85vh] overflow-auto bg-white rounded-2xl shadow-xl ring-1 ring-black/5">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-sm px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50">
            Close
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export default function PlayerLeaguePage() {
  const { slug } = useParams();

  const [league, setLeague] = useState(null);
  const [players, setPlayers] = useState([]);
  const [results, setResults] = useState([]);
  const [subs, setSubs] = useState([]);

  const [week, setWeek] = useState(1);
  const [playerId, setPlayerId] = useState("");
  const [points, setPoints] = useState("");
  const [isSub, setIsSub] = useState(false);
  const [note, setNote] = useState("");

  const [assignmentsWeek, setAssignmentsWeek] = useState(null);
  const [subPopup, setSubPopup] = useState(null);

  /* ---------- Load league & data ---------- */
  const loadLeague = useCallback(async () => {
    const { data, error } = await supabase.from("league").select("*").eq("slug", slug).maybeSingle();
    if (!error && data) setLeague(data);
  }, [slug]);

  const loadData = useCallback(async () => {
    if (!league?.id) return;
    const [{ data: p }, { data: r }, { data: s }] = await Promise.all([
      supabase.from("players").select("*").eq("league_id", league.id).order("created_at"),
      supabase.from("week_results").select("*").eq("league_id", league.id),
      supabase.from("subs_pool").select("*").eq("league_id", league.id).order("created_at", { ascending: false }),
    ]);
    setPlayers(Array.isArray(p) ? p : []);
    setResults(Array.isArray(r) ? r : []);
    setSubs(Array.isArray(s) ? s : []);
  }, [league?.id]);

  useEffect(() => {
    loadLeague();
  }, [loadLeague]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-default week once start_date is known
  useEffect(() => {
    if (!league?.start_date) return;
    setWeek(suggestResultWeek(league.start_date));
  }, [league?.start_date]);

  /* ---------- Realtime sync ---------- */
  useEffect(() => {
    if (!league?.id) return;
    const ch = supabase
      .channel(`live-p-${league.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "league", filter: `id=eq.${league.id}` },
        (payload) => setLeague((prev) => ({ ...(prev || {}), ...(payload.new || {}) }))
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `league_id=eq.${league.id}` },
        () => loadData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "week_results", filter: `league_id=eq.${league.id}` },
        () => loadData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subs_pool", filter: `league_id=eq.${league.id}` },
        () => loadData()
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [league?.id, loadData]);

  /* -------- Derived -------- */
  const resultsBy = useMemo(() => {
    const m = {};
    for (const r of results) {
      (m[r.player_id] ||= {})[r.week] = { points: r.points, is_sub: !!r.is_sub, note: r.note || "" };
    }
    return m;
  }, [results]);

  const avgByPlayer = useMemo(() => {
    const out = {};
    for (const p of players) {
      let sum = 0, cnt = 0;
      for (let w = 1; w <= 6; w++) {
        const obj = resultsBy[p.id]?.[w];
        if (obj && typeof obj.points === "number") {
          sum += obj.points;
          cnt++;
        }
      }
      out[p.id] = cnt ? sum / cnt : 0;
    }
    return out;
  }, [players, resultsBy]);

  const rows = useMemo(
    () =>
      players
        .map((p) => ({ id: p.id, name: p.display_name, avg: avgByPlayer[p.id] || 0 }))
        .sort((a, b) => b.avg - a.avg || a.name.localeCompare(b.name)),
    [players, avgByPlayer]
  );

  /* -------- Assignments -------- */
  function priorAvgUpToWeek(pid, targetWeek) {
    let sum = 0, cnt = 0;
    for (let w = 1; w < targetWeek; w++) {
      const r = resultsBy[pid]?.[w];
      if (r?.points != null) {
        sum += r.points;
        cnt++;
      }
    }
    return cnt ? sum / cnt : 0;
  }

  const buildAssignments = useCallback(
    (targetWeek) => {
      if (!Array.isArray(players) || players.length === 0) return [];
      let courts =
        Array.isArray(league?.courts_enabled) && league.courts_enabled.length
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
          .map((p) => ({ ...p, _avg: priorAvgUpToWeek(p.id, targetWeek) }))
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
    },
    [players, league?.courts_enabled, league?.random_seed, league?.id, league?.slug, resultsBy]
  );

  /* -------- Enter score (no overwrites in player UI) -------- */
  async function saveResult() {
    if (!league?.id) return;

    const w = Number(week);
    if (w < 1 || w > 6) return alert("Week 7 is handled on-site.");
    if (!playerId) return alert("Choose your name");

    const entered = Number(points);
    if (!Number.isFinite(entered) || entered < 0 || entered > 72) return alert("Enter 0–72");

    // Disallow overwriting an existing score in this UI
    if (resultsBy[playerId]?.[w]) return alert("A score for this week is already submitted for this player.");

    // Sub clamp (cap by prior avg; not more than 15 below it)
    let credited = entered;
    if (isSub) {
      let sum = 0, cnt = 0;
      for (let i = 1; i <= 6; i++) {
        if (i === w) continue;
        const r = resultsBy[playerId]?.[i];
        if (r?.points != null) { sum += r.points; cnt++; }
      }
      const priorAvg = cnt ? sum / cnt : null;
      if (priorAvg != null) credited = Math.min(Math.max(entered, priorAvg - 15), priorAvg);
    }
    credited = Math.round(Math.max(0, Math.min(72, credited)));

    try {
      // 1) Save this week
      const { error: e1 } = await supabase.from("week_results").insert({
        league_id: league.id,
        player_id: playerId,
        week: w,
        points: credited,
        is_sub: isSub,
        note,
      });
      if (e1) throw e1;

      // 2) If entering Week 2 and Week 1 was a sub, average W1 & W2.
      if (w === 2) {
        const { data: w1row, error: e2 } = await supabase
          .from("week_results")
          .select("points,is_sub")
          .eq("league_id", league.id)
          .eq("player_id", playerId)
          .eq("week", 1)
          .maybeSingle();
        if (e2) throw e2;

        if (w1row?.is_sub && typeof w1row.points === "number") {
          const averaged = Math.round((w1row.points + credited) / 2);
          const { error: e3 } = await supabase
            .from("week_results")
            .update({ points: averaged, is_sub: true, note })
            .eq("league_id", league.id)
            .eq("player_id", playerId)
            .eq("week", 1);
          if (e3) throw e3;
        }
      }
    } catch (err) {
      console.error(err);
      return alert(err.message || String(err));
    }

    await loadData();
    setPoints("");
    setIsSub(false);
    setNote("");
  }

  const scoreCell = (pid, w) => {
    const obj = resultsBy[pid]?.[w];
    if (!obj) return "—";
    if (!obj.is_sub) return <span>{obj.points}</span>;
    const open = () =>
      setSubPopup({
        week: w,
        points: obj.points,
        name: players.find((p) => p.id === pid)?.display_name || "Player",
        note: obj.note || "",
      });
    return (
      <button
        className="text-red-600 font-semibold underline decoration-dotted underline-offset-2"
        title="Click to see sub name"
        onClick={open}
      >
        {obj.points}
      </button>
    );
  };

  // Gating assignments by completion of previous week (except Week 1)
  const allScoresEnteredForWeek = useCallback(
    (wk) => {
      if (!players?.length) return false;
      return players.every((p) => {
        const r = resultsBy[p.id]?.[wk];
        return r && typeof r.points === "number";
      });
    },
    [players, resultsBy]
  );

  const missingCountForWeek = useCallback(
    (wk) => {
      if (!players?.length) return 0;
      return players.reduce((acc, p) => {
        const r = resultsBy[p.id]?.[wk];
        return acc + (r && typeof r.points === "number" ? 0 : 1);
      }, 0);
    },
    [players, resultsBy]
  );

  const canOpenAssignmentsForWeek = useCallback(
    (wk) => {
      if (wk === 1) return true;
      return allScoresEnteredForWeek(wk - 1);
    },
    [allScoresEnteredForWeek]
  );

  /* ---------- Render ---------- */
  return (
    <main className={`${brand.bg} ${brand.text} min-h-screen`}>
      {/* Header */}
      <div className="border-b border-slate-200 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <img src="/logo.png" alt="Pickle Pathway" className="h-10 w-auto rounded-lg ring-1 ring-slate-200" />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3 mt-1 text-sm">
              <span className={`${brand.chip} px-2 py-0.5 rounded-full`}>
                Division: {league?.division || league?.slug}
              </span>
              {league?.start_date ? (
                <span className={`${brand.chip} px-2 py-0.5 rounded-full`}>
                  Start: {fmtMDY(league.start_date)}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 space-y-8">
        {/* Week 7 notice */}
        <div className={`${brand.warn} p-3 rounded-xl`}>
          <strong>Reminder:</strong> Week 7 (playoffs) is handled on-site. Only Weeks 1–6 are entered here.
        </div>

        {/* Enter result */}
        <section className={`${brand.card} ${brand.ring} p-5`}>
          <h2 className="font-semibold text-lg mb-3">Enter a weekly result (Weeks 1–6 only)</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <select className={`px-3 py-2 rounded-xl ${brand.border}`} value={week} onChange={(e) => setWeek(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6].map((w) => (
                <option key={w} value={w}>
                  Week {w}
                  {league?.start_date ? ` (${fmtMD(weekDateISO(league.start_date, w))})` : ""}
                </option>
              ))}
            </select>

            <select
              className={`px-3 py-2 rounded-xl ${brand.border}`}
              value={playerId}
              onChange={(e) => setPlayerId(e.target.value)}
            >
              <option value="">-- choose player --</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name}
                </option>
              ))}
            </select>

            <input
              className={`px-3 py-2 rounded-xl ${brand.border} md:col-span-2`}
              placeholder="Points (0–72)"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
            />
            <label className="flex items-center gap-2 md:col-span-2">
              <input type="checkbox" checked={isSub} onChange={(e) => setIsSub(e.target.checked)} /> Sub played?
            </label>
            <input
              className={`px-3 py-2 rounded-xl ${brand.border} md:col-span-2`}
              placeholder="Enter sub name here"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <button className={`mt-4 px-5 py-2.5 rounded-xl ${brand.cta} hover:bg-[#0b8857]`} onClick={saveResult}>
            Save result
          </button>
          <p className="text-xs text-slate-500 mt-2">You can’t change a score once it has been submitted. Contact the staff if any changes are needed.</p>
        </section>

        {/* Scores + assignments */}
        <section className={`${brand.card} ${brand.ring} p-5 overflow-x-auto`}>
          <h2 className="font-semibold text-lg mb-3">Scores By Week</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-2 pr-2">Seed</th>
                <th className="py-2 pr-2">Name</th>
                <th className="text-right py-2">Avg (1–6)</th>
                {[1,2,3,4,5,6].map((w) => {
                  const canOpen = canOpenAssignmentsForWeek(w);
                  const label = `W${w}${league?.start_date ? ` (${fmtMD(weekDateISO(league.start_date, w))})` : ""}`;
                  return (
                    <th key={w} className="text-right py-2">
                      <button
                        disabled={!canOpen}
                        onClick={() => canOpen && setAssignmentsWeek(w)}
                        className={`px-2 py-1 rounded-lg border border-slate-200 ${
                          canOpen ? "hover:bg-slate-50 underline underline-offset-2" : "opacity-40 cursor-not-allowed"
                        }`}
                        title={
                          canOpen
                            ? "View court assignments"
                            : w === 1
                              ? "Assignments not available yet"
                              : `Assignments locked — waiting on ${missingCountForWeek(w - 1)} player(s) to submit Week ${w - 1}`
                        }
                      >
                        {label}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className="border-t border-slate-200">
                  <td className="py-2 pr-2">{i + 1}</td>
                  <td className="py-2 pr-2">{r.name}</td>
                  <td className="text-right py-2">{(r.avg || 0).toFixed(2)}</td>
                  <td className="text-right py-2">{scoreCell(r.id, 1)}</td>
                  <td className="text-right py-2">{scoreCell(r.id, 2)}</td>
                  <td className="text-right py-2">{scoreCell(r.id, 3)}</td>
                  <td className="text-right py-2">{scoreCell(r.id, 4)}</td>
                  <td className="text-right py-2">{scoreCell(r.id, 5)}</td>
                  <td className="text-right py-2">{scoreCell(r.id, 6)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 p-4 rounded-xl border border-slate-200">
            <div className="font-semibold mb-1">Sub Rules (summary)</div>
            <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
              <li>Enter the sub’s name in the “Enter sub name here” box.</li>
              <li>
                Sub scores show in <span className="font-semibold text-red-600">red</span>. Tap to see the sub’s name.
              </li>
              <li>When a sub plays, your credited score is capped by your prior average and not more than 15 points below it.</li>
              <li>If Week 1 is a sub, after Week 2 is entered, Week 1 becomes the average of Weeks 1 &amp; 2 (rounded).</li>
            </ul>
          </div>
        </section>

        {/* Subs list */}
        <section className={`${brand.card} ${brand.ring} p-5`} id="subs">
          <h2 className="font-semibold text-lg mb-3">Subs list</h2>
          {subs.length === 0 ? (
            <p className={brand.subtext}>No subs yet.</p>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {subs.map((s) => (
                  <div key={s.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="font-medium text-base">{s.name}</div>
                    <div className="mt-1 text-sm text-slate-700">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 w-14 shrink-0">Phone</span>
                        {s.phone ? (
                          <a href={`tel:${s.phone}`} className="underline">
                            {formatPhone(s.phone)}
                          </a>
                        ) : (
                          <span>—</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-slate-500 w-14 shrink-0">Email</span>
                        {s.email ? (
                          <a href={`mailto:${s.email}`} className="underline break-all">
                            {s.email}
                          </a>
                        ) : (
                          <span>—</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <table className="hidden md:table w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    <th className="py-2">Name</th>
                    <th className="py-2">Phone</th>
                    <th className="py-2">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {subs.map((s) => (
                    <tr key={s.id} className="border-b border-slate-200">
                      <td className="py-2">{s.name}</td>
                      <td className="py-2">
                        {s.phone ? <a href={`tel:${s.phone}`} className="underline">{formatPhone(s.phone)}</a> : "—"}
                      </td>
                      <td className="py-2 break-all">
                        {s.email ? <a href={`mailto:${s.email}`} className="underline">{s.email}</a> : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>
      </div>

      {/* COURT ASSIGNMENTS MODAL */}
      <Modal
        open={assignmentsWeek != null}
        title={
          assignmentsWeek
            ? `Court Assignments — Week ${assignmentsWeek}${
                league?.start_date ? ` (${fmtMD(weekDateISO(league.start_date, assignmentsWeek))})` : ""
              }`
            : ""
        }
        onClose={() => setAssignmentsWeek(null)}
      >
        {assignmentsWeek != null ? (
          (() => {
            const groups = buildAssignments(assignmentsWeek);
            return groups.length === 0 ? (
              <p>No assignments to show.</p>
            ) : (
              <div className="space-y-3">
                {assignmentsWeek === 1 ? (
                  <div className="text-sm text-slate-600 pb-2 border-b border-slate-200">
                    Week 1 uses a deterministic random shuffle selected by your organizer.
                  </div>
                ) : null}
                {groups.map((g) => (
                  <div key={g.court} className="p-3 rounded-xl border border-slate-200">
                    <div className="font-semibold mb-1">Court {g.court}</div>
                    <div className="text-slate-700">{g.players.map((p) => p.display_name).join(", ")}</div>
                  </div>
                ))}
              </div>
            );
          })()
        ) : null}
      </Modal>

      {/* SUB DETAIL MODAL */}
      <Modal open={!!(subPopup && subPopup.name)} title="Sub Score" onClose={() => setSubPopup(null)}>
        {subPopup ? (
          <div className="space-y-2">
            <div><span className="font-medium">Player:</span> {subPopup.name}</div>
            <div><span className="font-medium">Week:</span> {subPopup.week}</div>
            <div><span className="font-medium">Credited points:</span> {subPopup.points}</div>
            <div>
              <span className="font-medium">Sub name:</span>{" "}
              {subPopup.note ? subPopup.note : <span className="text-slate-500">Not provided</span>}
            </div>
          </div>
        ) : null}
      </Modal>
    </main>
  );
}

// local helper for phone formatting in subs list section
function formatPhone(p) {
  if (!p) return "";
  const digits = String(p).replace(/\D/g, "");
  if (digits.length === 10) return `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`;
  return p;
}
