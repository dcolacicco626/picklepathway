"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

/* ============== Theme ============== */
const brand = {
  bg: "bg-[#f7fbf8]",
  card: "bg-white shadow-sm rounded-2xl",
  text: "text-slate-800",
  subtext: "text-slate-600",
  ring: "ring-1 ring-slate-200",
  cta: "bg-[#0ea568] text-white",
  ctaOutline: "border border-[#0ea568] text-[#0ea568] hover:bg-[#e9f7f0]",
  border: "border border-slate-200",
  chip: "bg-[#e9f7f0] text-[#0b8857]",
  warn: "bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800",
};

// ---- Date helpers ----
const fmtMD = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    month: "numeric",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
};

const fmtMDY = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
};

const addDaysISO = (iso, n) => {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const weekDateISO = (startISO, week) =>
  startISO ? addDaysISO(startISO, (week - 1) * 7) : null;

// ---- Week auto-suggest helpers ----
const parseISOToLocalMidnight = (iso) => {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const daysUntilLocal = (targetISO) => {
  const today = new Date();
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = parseISOToLocalMidnight(targetISO);
  if (!target) return Infinity;
  const ms = target - todayMid;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
};

// Suggest default week based on “≤6 days out”
const suggestWeek = (startISO, maxWeek) => {
  if (!startISO) return 1;
  for (let w = 1; w <= maxWeek; w++) {
    const wISO = weekDateISO(startISO, w);
    const d = daysUntilLocal(wISO);
    if (d >= 0 && d <= 6) return w;
  }
  const today = new Date();
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  for (let w = 1; w <= maxWeek; w++) {
    const wDate = parseISOToLocalMidnight(weekDateISO(startISO, w));
    if (wDate >= todayMid) return w;
  }
  return maxWeek;
};

const ADMIN_TOKEN = process.env.NEXT_PUBLIC_ADMIN_TOKEN || "";

/* Deterministic shuffle (Week 1) */
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

export default function AdminLeaguePage() {
  const { slug } = useParams();

  const [league, setLeague] = useState(null);
  const suppressRealtime = useRef(false);
  const [players, setPlayers] = useState([]);
  const [results, setResults] = useState([]);
  const [subs, setSubs] = useState([]);

  // UI state
  const [courtsEnabledUI, setCourtsEnabledUI] = useState([]);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newDuprId, setNewDuprId] = useState("");

  // CSV import state
  const [csvFile, setCsvFile] = useState(null);
  const [csvPreview, setCsvPreview] = useState([]);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvMsg, setCsvMsg] = useState("");

  const [week, setWeek] = useState(1);
  const [playerId, setPlayerId] = useState("");
  const [points, setPoints] = useState("");
  const [isSub, setIsSub] = useState(false);
  const [note, setNote] = useState("");

  const [assignmentsWeek, setAssignmentsWeek] = useState(null);
  const [subPopup, setSubPopup] = useState(null);

  // Inline edit state
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editDuprId, setEditDuprId] = useState("");

  // Email preview state
  const [emailPhase, setEmailPhase] = useState("intro");
  const [emailPreview, setEmailPreview] = useState({ subject: "", html: "" });
  const [previewLoading, setPreviewLoading] = useState(false);

  // League settings fields
  const [division, setDivision] = useState("");
  const [startDate, setStartDate] = useState(""); // yyyy-mm-dd

  const [subNotesWeek, setSubNotesWeek] = useState(1);
  const [subNotesText, setSubNotesText] = useState("");

  /* ---------- Load league ---------- */
  const loadLeague = useCallback(async () => {
    const { data, error } = await supabase.from("league").select("*").eq("slug", slug).maybeSingle();
    if (!error && data) {
      setLeague(data);
      setCourtsEnabledUI(Array.isArray(data.courts_enabled) ? data.courts_enabled : []);
    }
  }, [slug]);

  useEffect(() => {
    if (!league) return;
    setDivision(league.division || "");
    setStartDate(league.start_date ? String(league.start_date).slice(0, 10) : "");
  }, [league]);

  // Auto-select default weeks
  useEffect(() => {
    if (!startDate) return;
    setWeek(suggestWeek(startDate, 6));     // Results 1–6
    setSubNotesWeek(suggestWeek(startDate, 7)); // Notes 1–7
  }, [startDate]);

  useEffect(() => {
    if (!league) return;
    const map = (league.sub_notes_by_week ?? {}) || {};
    const txt = typeof map[subNotesWeek] === "string" ? map[subNotesWeek] : "";
    setSubNotesText(txt);
  }, [league, subNotesWeek]);

  /* ---------- Load data ---------- */
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

  /* ---------- Realtime sync ---------- */
  useEffect(() => {
    if (!league?.id) return;

    const ch = supabase
      .channel(`live-${league.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "league", filter: `id=eq.${league.id}` },
        (payload) => {
          setLeague((prev) => ({ ...(prev || {}), ...(payload.new || {}) }));
          if (payload?.new?.courts_enabled) setCourtsEnabledUI(payload.new.courts_enabled);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `league_id=eq.${league.id}` },
        async () => {
          if (suppressRealtime.current) return;
          await loadData();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "week_results", filter: `league_id=eq.${league.id}` },
        async () => {
          if (suppressRealtime.current) return;
          await loadData();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subs_pool", filter: `league_id=eq.${league.id}` },
        async () => {
          if (suppressRealtime.current) return;
          await loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [league?.id, loadData]);

  /* ---------- Derived ---------- */
  const resultsBy = useMemo(() => {
    const m = {};
    for (const r of results) {
      (m[r.player_id] ||= {})[r.week] = { points: r.points, is_sub: !!r.is_sub, note: r.note || "" };
    }
    return m;
  }, [results]);

  function effectivePointsForWeek(playerId, w) {
    const r = resultsBy[playerId]?.[w];
    if (!r || typeof r.points !== "number") return null;
    return r.points;
  }

  const avgByPlayer = useMemo(() => {
    const out = {};
    for (const p of players) {
      let sum = 0, cnt = 0;
      for (let w = 1; w <= 6; w++) {
        const pts = effectivePointsForWeek(p.id, w);
        if (pts != null) { sum += pts; cnt++; }
      }
      out[p.id] = cnt ? sum / cnt : 0;
    }
    return out;
  }, [players, resultsBy]);

  const rows = useMemo(
    () =>
      players
        .map((p) => ({
          id: p.id,
          name: p.display_name,
          email: p.email || "",
          dupr_id: p.dupr_id || "",
          avg: avgByPlayer[p.id] || 0,
        }))
        .sort((a, b) => b.avg - a.avg || a.name.localeCompare(b.name)),
    [players, avgByPlayer]
  );

  const completedWeeks = useMemo(() => {
    const s = new Set();
    for (const r of results) if (r.week >= 1 && r.week <= 6 && r.points != null) s.add(r.week);
    return s;
  }, [results]);

  /* ---------- Assignments ---------- */
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
        const group = chunks[i];
        const court = courtsDesc[i % courtsDesc.length] ?? (i + 1);
        assignments.push({ court, players: group });
      }
      return assignments;
    },
    [players, league, resultsBy]
  );

  /* ---------- Email preview ---------- */
  const assignmentsTableHTML = (groups) => {
    if (!groups?.length) return "<p>No court assignments available yet.</p>";
    const rows = groups
      .map(
        (g) => `
      <tr>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;"><strong>Court ${g.court}</strong></td>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;">${g.players.map((p) => p.display_name).join(", ")}</td>
      </tr>`
      )
      .join("");
    return `
      <table cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #e5e7eb;width:100%;max-width:700px">
        <tbody>${rows}</tbody>
      </table>
    `;
  };

  useEffect(() => {
    if (!league?.id) return;

    const run = async () => {
      setPreviewLoading(true);
      try {
        const phaseToWeek = (phase) => {
          if (phase === "intro") return 1;
          const m = { w1: 2, w2: 3, w3: 4, w4: 5, w5: 6 };
          return m[phase] ?? 1;
        };
        const targetWeek = phaseToWeek(emailPhase);
        const groups = buildAssignments(targetWeek);
        const assignmentsHtml = assignmentsTableHTML(groups);

        const res = await fetch("/api/email/preview", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            leagueId: league.id,
            week: targetWeek,
            assignmentsHtml,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Preview failed");

        setEmailPreview({
          subject: data.subject || "",
          html: data.html || "<p>Empty preview.</p>",
        });
      } catch (e) {
        console.error(e);
        setEmailPreview({
          subject: "",
          html: `<p style="color:#b91c1c">Preview error: ${e.message || String(e)}</p>`,
        });
      } finally {
        setPreviewLoading(false);
      }
    };

    run();
  }, [league?.id, emailPhase, buildAssignments]);

  /* ---------- Actions ---------- */
  function toggleCourt(n) {
    setCourtsEnabledUI((prev) => {
      const set = new Set(prev || []);
      if (set.has(n)) set.delete(n);
      else set.add(n);
      return [...set].sort((a, b) => a - b);
    });
  }

  async function saveLeagueSettings() {
    if (!league?.id) return;

    const payload = {
      division: division || null,
      start_date: startDate || null,
      courts_enabled: courtsEnabledUI || [],
    };

    const { error } = await supabase.from("league").update(payload).eq("id", league.id);
    if (error) {
      alert(error.message);
      return;
    }
    alert("Settings saved");
  }

  async function saveSubNotes() {
    if (!league?.id) return;

    try {
      const existing = (league.sub_notes_by_week ?? {}) || {};
      const next = { ...existing, [subNotesWeek]: subNotesText };

      const { error } = await supabase
        .from("league")
        .update({ sub_notes_by_week: next })
        .eq("id", league.id);

      if (error) {
        if (/column .*sub_notes_by_week.* does not exist/i.test(error.message)) {
          alert(
            "Your 'league' table is missing the 'sub_notes_by_week' JSONB column.\n\nRun this:\nALTER TABLE public.league ADD COLUMN sub_notes_by_week jsonb DEFAULT '{}'::jsonb;"
          );
        } else {
          alert(error.message);
        }
        return;
      }

      setLeague((prev) => (prev ? { ...prev, sub_notes_by_week: next } : prev));
      alert("Sub notes saved");
    } catch (e) {
      alert(e.message || String(e));
    }
  }

  async function rerollWeek1() {
    if (!league?.id) return;
    if (!("random_seed" in (league || {}))) {
      alert(
        "The column random_seed is missing on the 'league' table. Add it, then try again."
      );
      return;
    }
    const ok = confirm(
      "Re-roll Week 1 court assignments?\n\nThis sets a NEW seed so Week 1 groupings change for everyone."
    );
    if (!ok) return;
    const newSeed = `seed-${league.id}-${Date.now()}`;
    const { error } = await supabase.from("league").update({ random_seed: newSeed }).eq("id", league.id);
    if (error) return alert(error.message);
  }

  async function addPlayer() {
    if (!league?.id) return;
    const name = newName.trim();
    if (!name) return alert("Enter a player name");
    const email = newEmail.trim() || null;
    const dupr_id = newDuprId.trim() || null;
    const { error } = await supabase
      .from("players")
      .insert({ league_id: league.id, display_name: name, email, dupr_id });
    if (error) return alert(error.message);
    setNewName("");
    setNewEmail("");
    setNewDuprId("");
  }

  async function deletePlayer(pid) {
    if (!league?.id) return;
    const pl = players.find((p) => p.id === pid);
    const ok = confirm(`Remove ${pl?.display_name || "this player"} and their results?`);
    if (!ok) return;
    const { error: e1 } = await supabase.from("week_results").delete().eq("player_id", pid);
    if (e1) return alert(e1.message);
    const { error: e2 } = await supabase.from("players").delete().eq("id", pid);
    if (e2) return alert(e2.message);
  }

  async function deleteSub(id) {
    if (!league?.id) return;

    const sub = subs.find((s) => s.id === id);
    if (!confirm(`Remove sub ${sub?.name || "this sub"}?`)) return;

    try {
      const res = await fetch("/api/subs/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subId: id,
          leagueId: league.id,
          adminToken: process.env.NEXT_PUBLIC_ADMIN_TOKEN,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Delete failed");

      setSubs((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      alert("Delete error: " + err.message);
    }
  }

  // --- CSV/XLSX helpers ---
  function isLikelyXlsx(ab) {
    const u8 = new Uint8Array(ab.slice(0, 4));
    return u8[0] === 0x50 && u8[1] === 0x4B; // 'P''K'
  }

  function decodeToUtf8Text(ab) {
    const u8 = new Uint8Array(ab);
    if (u8.length >= 3 && u8[0] === 0xEF && u8[1] === 0xBB && u8[2] === 0xBF) {
      return new TextDecoder("utf-8").decode(u8.subarray(3));
    }
    if (u8.length >= 2 && u8[0] === 0xFF && u8[1] === 0xFE) {
      return new TextDecoder("utf-16le").decode(u8.subarray(2));
    }
    if (u8.length >= 2 && u8[0] === 0xFE && u8[1] === 0xFF) {
      return new TextDecoder("utf-16be").decode(u8.subarray(2));
    }
    return new TextDecoder("utf-8", { fatal: false }).decode(u8);
  }

  function parseCsvText(text) {
    const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = [];
    let i = 0, cur = "", inQ = false;
    while (i < src.length) {
      const ch = src[i];
      if (ch === '"') {
        if (inQ && src[i + 1] === '"') { cur += '"'; i += 2; continue; }
        inQ = !inQ; i++; continue;
      }
      if (!inQ && ch === '\n') { lines.push(cur); cur = ""; i++; continue; }
      cur += ch; i++;
    }
    if (cur.length) lines.push(cur);

    const rows = lines.map(line => {
      const out = [];
      let j = 0, cell = "", q = false;
      while (j < line.length) {
        const c = line[j];
        if (c === '"') {
          if (q && line[j + 1] === '"') { cell += '"'; j += 2; continue; }
          q = !q; j++; continue;
        }
        if (!q && c === ',') { out.push(cell.trim()); cell = ""; j++; continue; }
        cell += c; j++;
      }
      out.push(cell.trim());
      return out;
    });

    return rows;
  }

  function rowsToObjects(matrix) {
    if (!matrix.length) return [];
    const header = matrix[0].map(h => (h || "").toLowerCase().trim());
    const hasHeader = header.some(h => ["name", "email", "full name", "member email"].includes(h));
    const body = hasHeader ? matrix.slice(1) : matrix;

    const findIdx = (labels) => hasHeader
      ? labels.map(l => header.indexOf(l)).find(i => i >= 0) ?? -1
      : -1;

    const nameIdx  = hasHeader ? findIdx(["name", "full name"])        : 0;
    const emailIdx = hasHeader ? findIdx(["email", "member email"])    : 1;
    const duprIdx = header.findIndex((h) => /(dupr[\s_]*id|duprid|dupr)/.test(h));

    const out = [];
    for (const r of body) {
      const name  = (r[nameIdx]  ?? r[0] ?? "").toString().trim();
      const email = (r[emailIdx] ?? r[1] ?? "").toString().trim();
      const dupr_id = duprIdx >= 0 ? (r[duprIdx] ?? "").toString().trim() : "";
      if (!name && !email) continue;
      out.push({ name, email, dupr_id });
    }
    return out;
  }

  const handleCsvFile = async (file) => {
    setCsvFile(file);
    setCsvMsg("");
    setCsvPreview([]);
    if (!file) return;

    try {
      const ab = await file.arrayBuffer();
      const looksXlsx = isLikelyXlsx(ab) ||
        /sheet|excel|spreadsheet/i.test(file.type) ||
        /\.xlsx$/i.test(file.name);

      if (looksXlsx) {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(new Uint8Array(ab), { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        const rows = rowsToObjects(matrix);
        if (!rows.length) {
          setCsvMsg("No rows found in the first worksheet. Expected columns like: Full Name, Member Email.");
          return;
        }
        setCsvPreview(rows);
        setCsvMsg(`Previewing ${rows.length} row(s) from Excel. Ready to import.`);
        return;
      }

      const text = decodeToUtf8Text(ab);
      const matrix = parseCsvText(text);
      const rows = rowsToObjects(matrix);
      if (!rows.length) {
        setCsvMsg("No rows found. Expected columns like: Full Name, Member Email (or name,email).");
        return;
      }
      setCsvPreview(rows);
      setCsvMsg(`Previewing ${rows.length} row(s). Ready to import.`);
    } catch (err) {
      console.error(err);
      setCsvMsg("Could not read this file. Please upload a real CSV or XLSX export.");
    }
  };

  async function addPlayerToLeague(name, email, dupr_id) {
    if (!league?.id) return;

    const trimmedName = (name || "").trim();
    const trimmedEmail = (email || "").trim();
    const trimmedDupr = (dupr_id || "").trim();

    if (!trimmedName) return;

    const { data: existing, error: fetchErr } = await supabase
      .from("players")
      .select("id, display_name, email")
      .eq("league_id", league.id);

    if (fetchErr) throw fetchErr;

    const alreadyThere = (existing || []).some((p) => {
      const sameName = p.display_name?.trim().toLowerCase() === trimmedName.toLowerCase();
      const sameEmail =
        trimmedEmail &&
        (p.email || "").trim().toLowerCase() === trimmedEmail.toLowerCase();
      return sameName || sameEmail;
    });

    if (alreadyThere) return;

    const { error: insertErr } = await supabase.from("players").insert({
      league_id: league.id,
      display_name: trimmedName,
      email: trimmedEmail || null,
      dupr_id: trimmedDupr || null,
    });
    if (insertErr) throw insertErr;
  }

  const importCsvRows = async () => {
    if (!csvPreview.length) return;
    try {
      setCsvImporting(true);
      for (const { name, email, dupr_id } of csvPreview) {
        if (!name) continue;
        await addPlayerToLeague(name, email, dupr_id);
      }
      setCsvMsg(`Imported ${csvPreview.length} player(s)`);
      setCsvPreview([]);
      setCsvFile(null);
    } catch (err) {
      console.error(err);
      alert("Error importing: " + (err?.message || err));
    } finally {
      setCsvImporting(false);
    }
  };

  function beginEdit(row) {
    setEditingId(row.id);
    setEditName(row.name || "");
    setEditEmail(row.email || "");
    const p = players.find((x) => x.id === row.id);
    setEditDuprId((row.dupr_id ?? p?.dupr_id) || "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditEmail("");
    setEditDuprId("");
  }

  async function saveEdit() {
    if (!league?.id || !editingId) return;
    const name = editName.trim();
    const email = editEmail.trim() || null;
    const dupr_id = (editDuprId || "").trim() || null;

    if (!name) {
      alert("Name is required");
      return;
    }

    const { error } = await supabase
      .from("players")
      .update({ display_name: name, email, dupr_id })
      .eq("id", editingId);

    if (error) {
      alert(error.message);
      return;
    }

    cancelEdit();
  }

  async function saveResult() {
    if (!league?.id) return;

    const w = Number(week);
    if (!Number.isInteger(w) || w < 1 || w > 6) {
      alert("Week 7 is playoffs and not entered here. Use Weeks 1–6.");
      return;
    }
    if (!playerId) {
      alert("Choose a player");
      return;
    }
    const entered = Number(points);
    if (!Number.isFinite(entered) || entered < 0 || entered > 72) {
      alert("Enter a score between 0 and 72");
      return;
    }

    let credited = entered;
    if (isSub) {
      let sum = 0, cnt = 0;
      for (let i = 1; i <= 6; i++) {
        if (i === w) continue;
        const r = resultsBy[playerId]?.[i];
        if (r?.points != null) { sum += r.points; cnt++; }
      }
      const priorAvg = cnt ? sum / cnt : null;
      if (priorAvg != null) {
        credited = Math.min(Math.max(entered, priorAvg - 15), priorAvg);
      }
    }
    credited = Math.round(Math.max(0, Math.min(72, credited)));

    suppressRealtime.current = true;
    try {
      {
        const { error } = await supabase
          .from("week_results")
          .upsert(
            {
              league_id: league.id,
              player_id: playerId,
              week: w,
              points: credited,
              is_sub: isSub,
              note,
            },
            { onConflict: "league_id,player_id,week" }
          );
        if (error) throw error;
      }

      if (w === 2) {
        const { data: w1, error: e1 } = await supabase
          .from("week_results")
          .select("points,is_sub,note")
          .eq("league_id", league.id)
          .eq("player_id", playerId)
          .eq("week", 1)
          .maybeSingle();
        if (e1) throw e1;

        if (w1?.is_sub && typeof w1.points === "number") {
          const averaged = Math.round((w1.points + credited) / 2);
          const { error: e2 } = await supabase
            .from("week_results")
            .update({
              points: averaged,
              note: (w1.note ? `${w1.note} — ` : "") + "Adjusted to avg of W1 & W2",
            })
            .eq("league_id", league.id)
            .eq("player_id", playerId)
            .eq("week", 1);
          if (e2) throw e2;
        }
      }

      await loadData();
    } catch (err) {
      console.error(err);
      alert(err.message || String(err));
    } finally {
      setTimeout(() => { suppressRealtime.current = false; }, 400);
    }

    setPoints("");
    setIsSub(false);
    setNote("");
  }

  function exportCSV() {
    const headers = ["Seed","Name","Email","W1","W2","W3","W4","W5","W6","Avg(1–6)"];
    const rowsOut = [];

    rows.forEach((r, i) => {
      const pts = [1, 2, 3, 4, 5, 6].map((w) => {
        const v = effectivePointsForWeek(r.id, w);
        return v == null ? "" : String(v);
      });
      const avg = avgByPlayer[r.id] || 0;
      rowsOut.push([String(i + 1), r.name, r.email || "", ...pts, avg.toFixed(2)]);
    });

    const escapeCSV = (val) => {
      const s = String(val ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const csv =
      headers.join(",") + "\n" +
      rowsOut.map((arr) => arr.map(escapeCSV).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${league?.slug || "league"}-scores.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const scoreCell = (pid, w) => {
    const obj = resultsBy[pid]?.[w];
    const pts = effectivePointsForWeek(pid, w);
    if (!obj || pts == null) return "—";

    if (!obj.is_sub) return <span>{pts}</span>;

    const open = () =>
      setSubPopup({
        week: w,
        points: pts,
        name: players.find((p) => p.id === pid)?.display_name || "Player",
        note: obj.note || "",
      });

    const adjusted = w === 1 && resultsBy[pid]?.[2]?.points != null;

    return (
      <button
        className={"font-semibold underline decoration-dotted underline-offset-2 " + (adjusted ? "text-orange-600" : "text-red-600")}
        title={adjusted ? "Adjusted: avg of Week 1 sub & Week 2" : "Click to see sub name"}
        onClick={open}
      >
        {pts}{adjusted ? "*" : ""}
      </button>
    );
  };

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

  // Use the new route structure + relative root (works on picklepathway.com)
  const playerPortalUrl = `/player/${league?.slug || ""}`;

  /* ---------- Render ---------- */
  return (
    <main className={`${brand.bg} ${brand.text} min-h-screen`}>
      {/* Header */}
      <div className="border-b border-slate-200 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <img src="/logo.png" alt="Pickle Pathway" className="h-40 w-auto rounded-lg ring-1 ring-slate-200" />
          <div className="flex-1">
            <h1 className="text-xl font-bold">Admin</h1>
            <div className="flex flex-wrap items-center gap-3 mt-1 text-sm">
              <span className={`${brand.chip} px-2 py-0.5 rounded-full`}>Division: {league?.division || league?.slug}</span>
              {league?.start_date ? (
                <span className={`${brand.chip} px-2 py-0.5 rounded-full`}>Start: {fmtMDY(league.start_date)}</span>
              ) : null}
              {league?.random_seed ? (
                <span className={`${brand.chip} px-2 py-0.5 rounded-full`}>Week 1 seed set</span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={playerPortalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`px-3 py-2 rounded-xl ${brand.ctaOutline}`}
            >
              View player portal
            </a>

            <a
              href="/"
              className={`px-3 py-2 rounded-xl ${brand.cta} hover:bg-[#0b8857]`}
            >
              Home Page
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 space-y-8">
        {/* Week 7 note */}
        <div className={`${brand.warn} p-3 rounded-xl`}>
          <strong>Reminder:</strong> Week 7 (playoffs) is handled on-site. Only Weeks 1–6 are entered here.
        </div>

        {/* League settings */}
        <section className={`${brand.card} ${brand.ring} p-5`}>
          <h2 className="font-semibold text-lg mb-3">League settings</h2>

          {/* Division + Start date */}
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm text-slate-600 mb-1">Division</label>
              <input
                type="text"
                value={division}
                onChange={(e) => setDivision(e.target.value)}
                placeholder="e.g., 3.25–3.75"
                className={`w-full px-3 py-2 rounded-xl ${brand.border} focus:outline-none focus:ring-2 focus:ring-emerald-500`}
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Start date (Week 1)</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl ${brand.border} focus:outline-none focus:ring-2 focus:ring-emerald-500`}
              />
            </div>
          </div>

          {/* Courts used */}
          <div className="space-y-2">
            <div className="font-medium">Courts used</div>
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <label key={n} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={courtsEnabledUI?.includes(n) || false}
                    onChange={() => toggleCourt(n)}
                  />
                  Court {n}
                </label>
              ))}
            </div>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <button onClick={saveLeagueSettings} className={`px-4 py-2 rounded-xl ${brand.cta} hover:bg-[#0b8857]`}>
              Save settings
            </button>
            <button onClick={rerollWeek1} className={`px-4 py-2 rounded-xl ${brand.ctaOutline}`}>
              Re-roll Week 1
            </button>
            <a
              href={`/api/scoresheets?slug=${league?.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`px-4 py-2 rounded-xl ${brand.ctaOutline}`}
            >
              View Scoresheets
            </a>
          </div>
        </section>

        {/* Add player */}
        <section className={`${brand.card} ${brand.ring} p-5`}>
          <h2 className="font-semibold text-lg mb-3">Add a player</h2>
          <div className="grid md:grid-cols-3 gap-3">
            <input
              className={`px-3 py-2 rounded-xl ${brand.border}`}
              placeholder="Player name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <input
              className={`px-3 py-2 rounded-xl ${brand.border}`}
              placeholder="Email (hidden for players)"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
            <input
              className="w-full px-2 py-1 rounded-lg border border-slate-300"
              value={newDuprId}
              onChange={(e) => setNewDuprId(e.target.value)}
              placeholder="DUPR ID (optional)"
            />
            <button onClick={addPlayer} className={`px-4 py-2 rounded-xl ${brand.cta} hover:bg-[#0b8857]`}>
              Add
            </button>
          </div>

          {/* CSV upload */}
          <div className="mt-5 pt-5 border-t border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">Upload Spreadsheet</h3>
              <button
                type="button"
                onClick={() => {
                  const csv = "Full Name,Member Email,DUPR ID\nJane Doe,jane@example.com,AE654R\nJohn Smith,john@example.com,BRH76Q\n";
                  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "players-template.csv";
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  URL.revokeObjectURL(url);
                }}
                className="text-sm px-3 py-1 rounded-lg border border-slate-300 hover:bg-slate-50"
                title="Download a sample Spreadsheet with the correct columns"
              >
                Download template
              </button>
            </div>

            <p className="text-sm text-slate-600 mb-2">
              Spreadsheet columns: <code>Full Name, Member Email &amp; DUPR ID</code>. We’ll skip duplicates already in this league.
            </p>

            <div className="flex flex-col md:flex-row gap-3 md:items-center">
              <input
                type="file"
                accept=".csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx"
                onChange={(e) => handleCsvFile(e.target.files?.[0] || null)}
                className={`px-3 py-2 rounded-xl ${brand.border}`}
              />

              <button
                type="button"
                disabled={!csvPreview.length || csvImporting}
                onClick={importCsvRows}
                className={`px-4 py-2 rounded-xl ${brand.cta} hover:bg-[#0b8857] disabled:opacity-50`}
              >
                {csvImporting ? "Importing…" : "Import"}
              </button>
              {csvMsg ? <span className="text-sm text-slate-600">{csvMsg}</span> : null}
            </div>

            {csvPreview.length ? (
              <div className="mt-3 text-xs text-slate-500">
                Previewing {csvPreview.length} row(s). First few:
                <ul className="list-disc pl-5">
                  {csvPreview.slice(0, 5).map((r, i) => (
                    <li key={i}><span className="font-medium">{r.name}</span>{r.email ? ` — ${r.email}` : ""}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>

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
            <select className={`px-3 py-2 rounded-xl ${brand.border}`} value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
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
          <button onClick={saveResult} className={`mt-4 px-5 py-2.5 rounded-xl ${brand.cta} hover:bg-[#0b8857]`}>
            Save result
          </button>
        </section>

        {/* Scores + assignments */}
        <section className={`${brand.card} ${brand.ring} p-5 overflow-x-auto`}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg mb-3">Scores By Week</h2>
            <button onClick={exportCSV} className={`px-3 py-2 rounded-xl ${brand.ctaOutline}`}>
              Export CSV
            </button>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-2 pr-2">Seed</th>
                <th className="py-2 pr-2">Name / Email</th>
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
                <th className="text-right py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className="border-t border-slate-200">
                  <td className="py-2 pr-2">{i + 1}</td>
                  <td className="py-2 pr-2 align-top">
                    {editingId === r.id ? (
                      <div className="space-y-2">
                        <input
                          className="w-full px-2 py-1 rounded-lg border border-slate-300"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Player name"
                        />
                        <input
                          className="w-full px-2 py-1 rounded-lg border border-slate-300"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          placeholder="Email (optional)"
                          type="email"
                        />
                        <input
                          className="w-full px-2 py-1 rounded-lg border border-slate-300"
                          value={editDuprId}
                          onChange={(e) => setEditDuprId(e.target.value)}
                          placeholder="DUPR ID (optional)"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={saveEdit}
                            className="px-3 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                            title="Save"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="px-3 py-1 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                            title="Cancel"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">{r.name}</div>
                          <div className="text-xs text-slate-500">{r.email || "—"}</div>
                          {r.dupr_id ? (
                            <div className="text-[11px] text-slate-400">DUPR ID: {r.dupr_id}</div>
                          ) : null}
                        </div>
                        <button
                          onClick={() => beginEdit(r)}
                          className="p-1 rounded-md border border-slate-200 hover:bg-slate-50"
                          title="Edit name/email"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="text-slate-600" viewBox="0 0 16 16">
                            <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-9 9A.5.5 0 0 1 6.5 13H4a1 1 0 0 1-1-1V9.5a.5.5 0 0 1 .146-.354l9-9zM11.207 2 3 10.207V12h1.793L13 3.793 11.207 2z"/>
                          </svg>
                        </button>
                      </div>
                    )}
                  </td>

                  <td className="text-right py-2">{(r.avg || 0).toFixed(2)}</td>
                  <td className="text-right py-2">{scoreCell(r.id, 1)}</td>
                  <td className="text-right py-2">{scoreCell(r.id, 2)}</td>
                  <td className="text-right py-2">{scoreCell(r.id, 3)}</td>
                  <td className="text-right py-2">{scoreCell(r.id, 4)}</td>
                  <td className="text-right py-2">{scoreCell(r.id, 5)}</td>
                  <td className="text-right py-2">{scoreCell(r.id, 6)}</td>

                  <td className="text-right py-2">
                    <button
                      onClick={() => deletePlayer(r.id)}
                      className="px-2 py-1 rounded-lg border border-red-300 text-red-700 hover:bg-red-50"
                      title="Delete player"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Sub rules */}
          <div className="mt-4 p-4 rounded-xl border border-slate-200">
            <div className="font-semibold mb-1">Sub Rules</div>
            <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
              <li>Enter the sub’s name in the “Enter sub name here” box.</li>
              <li>
                Sub scores are shown in <span className="font-semibold text-red-600">red</span>. Click a red score to see the sub’s name.
              </li>
              <li>
                When a sub plays, the credited score is limited to the player’s prior average (Weeks 1–6, excluding the current week) and cannot be more than 15 points below it.
              </li>
              <li>
                If Week 1 is a sub, Week 1 is saved normally at first; after you enter Week 2, Week 1 is automatically updated to the average of Week 1 and Week 2 (rounded).
              </li>
            </ul>
          </div>
        </section>

        {/* Sub Notes (per-week) */}
        <section className={`${brand.card} ${brand.ring} p-5`}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-lg">Sub Notes</h2>
            <select
              className={`px-3 py-2 rounded-xl ${brand.border}`}
              value={subNotesWeek}
              onChange={(e) => setSubNotesWeek(Number(e.target.value))}
              title="Choose week"
            >
              {[1,2,3,4,5,6,7].map((w) => (
                <option key={w} value={w}>
                  Week {w}
                  {league?.start_date && w <= 7
                    ? ` (${fmtMD(weekDateISO(league.start_date, w))})`
                    : ""}
                </option>
              ))}
            </select>
          </div>

          <textarea
            className={`w-full min-h[120px] px-3 py-2 rounded-xl ${brand.border} focus:outline-none focus:ring-2 focus:ring-emerald-500`}
            placeholder="Please enter any weekly sub notes here"
            value={subNotesText}
            onChange={(e) => setSubNotesText(e.target.value)}
          />

          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={saveSubNotes}
              className={`px-4 py-2 rounded-xl ${brand.cta} hover:bg-[#0b8857]`}
            >
              Save notes
            </button>
            <span className="text-sm text-slate-500">
              These notes are stored per week and per league.
            </span>
          </div>
        </section>

        {/* Subs list */}
        <section className={`${brand.card} ${brand.ring} p-5`} id="subs">
          <h2 className="font-semibold text-lg mb-3">Subs list</h2>
          {subs.length === 0 ? (
            <p className={brand.subtext}>No subs yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2">Name</th>
                  <th className="py-2">Phone</th>
                  <th className="py-2">Email</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={s.id} className="border-b border-slate-200">
                    <td className="py-2">{s.name}</td>
                    <td className="py-2">{s.phone || "—"}</td>
                    <td className="py-2">{s.email || "—"}</td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => deleteSub(s.id)}
                        className="px-2 py-1 rounded-lg border border-red-300 text-red-700 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {league?.slug ? (
            <p className="text-xs text-slate-500 mt-2">
              Public sub signup form:&nbsp;
              <a className="underline" href={`/subs/${league.slug}`}>
                /subs/{league.slug}
              </a>
            </p>
          ) : null}
        </section>

        {/* Email Preview */}
        <section className={`${brand.card} ${brand.ring} p-5`}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-lg">Email Preview</h2>
            <div className="flex items-center gap-3">
              <select
                className={`px-3 py-2 rounded-xl ${brand.border}`}
                value={emailPhase}
                onChange={(e) => setEmailPhase(e.target.value)}
              >
                <option value="intro">Email before Week 1</option>
                <option value="w1">Email before Week 2</option>
                <option value="w2">Email before Week 3</option>
                <option value="w3">Email before Week 4</option>
                <option value="w4">Email before Week 5</option>
                <option value="w5">Email before Week 6</option>
              </select>
            </div>
          </div>

          {previewLoading ? (
            <div className="text-slate-500 text-sm">Rendering preview…</div>
          ) : (
            <div>
              <div className="mb-3 text-sm text-slate-600">
                <div><span className="font-medium">Subject:</span> {emailPreview.subject || "—"}</div>
              </div>
              <div className="rounded-xl border border-slate-200 p-4 bg-white">
                <div dangerouslySetInnerHTML={{ __html: emailPreview.html }} />
              </div>
            </div>
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
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <div className="text-sm text-slate-600">Week 1 uses a deterministic random shuffle based on the league seed.</div>
                    <button onClick={rerollWeek1} className={`px-3 py-1.5 rounded-lg ${brand.ctaOutline}`}>
                      Re-roll Week 1
                    </button>
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
            <div>
              <span className="font-medium">Player:</span> {subPopup.name}
            </div>
            <div>
              <span className="font-medium">Week:</span> {subPopup.week}
            </div>
            <div>
              <span className="font-medium">Credited points:</span> {subPopup.points}
            </div>
            <div>
              <span className="font-medium">Sub name:</span>{" "}
              {subPopup.note ? subPopup.note : <span className="text-slate-500">Not provided</span>}
            </div>
          </div>
        ) : null}
      </Modal>

      <div className="text-xs text-slate-400 mt-8">Build v1.2.5</div>
    </main>
  );
}
