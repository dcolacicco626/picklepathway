"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";

/* ========= Theme ========= */
<div className="p-4 mb-4 rounded-xl bg-green-600 text-white">
  If you see this green bar, Tailwind is working ✅
</div>

const brand = {
  bg: "bg-[#f7fbf8]",
  card: "bg-white shadow-sm rounded-2xl",
  text: "text-slate-800",
  subtext: "text-slate-600",
  ring: "ring-1 ring-slate-200",
  chip: "bg-[#e9f7f0] text-[#0b8857]",
  cta: "bg-[#0ea568] text-white",
  ctaOutline: "border border-[#0ea568] text-[#0ea568] hover:bg-[#e9f7f0]",
  border: "border border-slate-200",
};

// Local date formatter (avoids UTC shift for YYYY-MM-DD)
const fmtMDY = (d) => {
  if (!d) return "";
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split("-").map(Number);
    const dt = new Date(y, m - 1, day);
    return dt.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  }
  const dt = new Date(d);
  return dt.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
};

export default function HomePage() {
  const router = useRouter();

  const [divInput, setDivInput] = useState("");
  const [startDate, setStartDate] = useState("");
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const loadLeagues = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("league")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setLeagues(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadLeagues();
  }, [loadLeagues]);

  const activeLeagues = useMemo(() => leagues.filter((l) => !l.archived), [leagues]);
  const archivedLeagues = useMemo(() => leagues.filter((l) => !!l.archived), [leagues]);

  function toSlug(s) {
    return s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
  }

  async function createLeague() {
    const nameRaw = divInput.trim();
    if (!nameRaw) return alert("Enter a division name");
    const slug = toSlug(nameRaw);
    if (!slug) return alert("Division name must contain letters or numbers");

    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("league")
        .insert({
          slug,
          division: nameRaw,
          start_date: startDate || null,
          courts_enabled: null,
          archived: false,
        })
        .select("*")
        .maybeSingle();
      if (error) throw error;
      setDivInput("");
      setStartDate("");
      await loadLeagues();
      // NEW: push to the new Admin route
      router.push(`/admin/${data.slug}`);
    } catch (e) {
      alert(e?.message || String(e));
    } finally {
      setCreating(false);
    }
  }

  async function archiveDivision(league) {
    const name = league.division || league.slug;
    const ok = confirm(
      `Archive the division "${name}"?\n\nIt will be hidden from active lists but preserved for download later.`
    );
    if (!ok) return;
    try {
      const { error } = await supabase.from("league").update({ archived: true }).eq("id", league.id);
      if (error) throw error;
      await loadLeagues();
      alert("Division archived.");
    } catch (e) {
      if (String(e?.message || "").includes("archived")) {
        alert(
          'Your "league" table needs a boolean column "archived". Run:\n\nalter table league add column if not exists archived boolean not null default false;'
        );
      } else {
        alert(e?.message || String(e));
      }
    }
  }

  /* ===== CSV (standings W1–W6) ===== */
  async function downloadCsvForLeague(league) {
    if (!league?.id) return;
    const [{ data: players }, { data: results }] = await Promise.all([
      supabase.from("players").select("*").eq("league_id", league.id).order("created_at"),
      supabase.from("week_results").select("*").eq("league_id", league.id),
    ]);

    const resBy = {};
    (results || []).forEach((r) => {
      (resBy[r.player_id] ||= {})[r.week] = r.points;
    });

    const rows = (players || []).map((p) => {
      const w = [1, 2, 3, 4, 5, 6].map((i) => {
        const v = resBy[p.id]?.[i];
        return typeof v === "number" ? v : "";
      });
      const filled = w.filter((x) => x !== "");
      const avg = filled.length ? (filled.reduce((a, b) => a + b, 0) / filled.length).toFixed(2) : "";
      return [p.display_name, ...w, avg];
    });

    const header = ["Name", "W1", "W2", "W3", "W4", "W5", "W6", "Avg(1–6)"];
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${league.slug}-standings.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <main className={`${brand.bg} ${brand.text} min-h-screen`}>
      {/* Top bar */}
      <div className="border-b border-slate-200 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center gap-4">
          <img src="/logo.png" alt="Pickle Pathway" className="h-10 w-auto rounded-lg ring-1 ring-slate-200" />
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Pickle Pathway</h1>
            <p className={`${brand.subtext} text-sm mt-1`}>
              Manage divisions, enter scores, and share the player portal.
            </p>
          </div>

          <Link
            href="/admin/email-templates"
            className={`px-3 py-2 rounded-xl ${brand.ctaOutline}`}
            title="Edit email copy used for previews and sends"
          >
            Email templates
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6 space-y-8">
        {/* Create new division */}
        <section className={`${brand.card} ${brand.ring} p-5`}>
          <h2 className="font-semibold text-lg mb-3">Create a new division</h2>
          <div className="grid md:grid-cols-3 gap-3">
            <div className="flex flex-col">
              <label className={`${brand.subtext} text-sm`}>Division name</label>
              <input
                className={`px-3 py-2 rounded-xl ${brand.border}`}
                placeholder="e.g., Intermediate A"
                value={divInput}
                onChange={(e) => setDivInput(e.target.value)}
              />
            </div>
            <div className="flex flex-col">
              <label className={`${brand.subtext} text-sm`}>Start date (optional)</label>
              <input
                type="date"
                className={`px-3 py-2 rounded-xl ${brand.border}`}
                value={startDate || ""}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={createLeague}
                disabled={creating}
                className={`px-4 py-2 rounded-xl ${brand.cta} hover:bg-[#0b8857] disabled:opacity-60`}
              >
                {creating ? "Creating…" : "Create division"}
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            The division name becomes the public URL slug automatically (e.g., <code>intermediate-a</code>).
          </p>
        </section>

        {/* Active divisions */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">Active divisions</h2>
            {loading && <span className="text-sm text-slate-500">Loading…</span>}
          </div>

          {activeLeagues.length === 0 ? (
            <p className="text-sm text-slate-500">No active divisions yet.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeLeagues.map((l) => (
                <div key={l.id} className={`${brand.card} ${brand.ring} p-4`}>
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-slate-800">{l.division || l.slug}</div>
                    {l.start_date ? (
                      <div className={`${brand.chip} px-2 py-0.5 rounded-full text-xs`}>
                        Starts {fmtMDY(l.start_date)}
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a href={`/admin/${l.slug}`} className={`px-3 py-2 rounded-xl ${brand.ctaOutline}`}>
                      Admin
                    </a>
                    <a href={`/player/${l.slug}`} className={`px-3 py-2 rounded-xl ${brand.ctaOutline}`}>
                      Player
                    </a>
                    <a href={`/subs/${l.slug}`} className={`px-3 py-2 rounded-xl ${brand.ctaOutline}`}>
                      Sub form
                    </a>
                    <a href={`/player/${l.slug}#subs`} className={`px-3 py-2 rounded-xl ${brand.ctaOutline}`}>
                      Sub list
                    </a>
                    <button
                      onClick={() => archiveDivision(l)}
                      className={`px-3 py-2 rounded-xl ${brand.ctaOutline}`}
                      title="Archive this division"
                    >
                      Archive
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Toggle archived */}
        <div className="pt-2">
          <button
            onClick={() => setShowArchived((v) => !v)}
            className={`px-4 py-2 rounded-xl ${brand.ctaOutline}`}
          >
            {showArchived ? "Hide archived leagues" : "View archived leagues"}
          </button>
        </div>

        {/* Archived list with CSV downloads */}
        {showArchived ? (
          <section className={`${brand.card} ${brand.ring} p-5`}>
            <h2 className="font-semibold text-lg mb-3">Archived leagues</h2>
            {archivedLeagues.length === 0 ? (
              <p className="text-sm text-slate-500">No archived leagues.</p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {archivedLeagues.map((l) => (
                  <div key={l.id} className="p-4 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{l.division || l.slug}</div>
                      {l.start_date ? (
                        <div className={`${brand.chip} px-2 py-0.5 rounded-full text-xs`}>
                          Started {fmtMDY(l.start_date)}
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => downloadCsvForLeague(l)}
                        className={`px-3 py-2 rounded-xl ${brand.ctaOutline}`}
                        title="Download standings CSV (Weeks 1–6)"
                      >
                        Download CSV
                      </button>
                      <a href={`/player/${l.slug}`} className={`px-3 py-2 rounded-xl ${brand.ctaOutline}`}>
                        Player
                      </a>
                      <a href={`/player/${l.slug}#subs`} className={`px-3 py-2 rounded-xl ${brand.ctaOutline}`}>
                        Sub list
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-500 mt-3">
              CSV includes player name, W1–W6 points, and average. Week 7 is handled on-site.
            </p>
          </section>
        ) : null}
      </div>
    </main>
  );
}
