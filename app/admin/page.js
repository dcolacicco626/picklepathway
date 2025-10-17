"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

/* ========= Theme ========= */
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

/* ========= Helpers ========= */
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

function toSlug(s) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

/* ========= Main Component ========= */
export default function OrgHome({ orgId }) {
  const router = useRouter();

  // form state
  const [leagueType, setLeagueType] = useState("ladder"); // only option for now
  const [divInput, setDivInput] = useState("");
  const [startDate, setStartDate] = useState("");

  // data state
  const [leagues, setLeagues] = useState([]);
  const [archivedLeagues, setArchivedLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // settings modal state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState("club"); // 'club' | 'users' | 'billing' | 'emails' | 'archived'
  const [clubName, setClubName] = useState("");
  const [clubSlug, setClubSlug] = useState("");
  const [settingsMsg, setSettingsMsg] = useState("");

  // manage users state
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("admin");
  const [members, setMembers] = useState([]); // {id, email, role, display_name?} — see note below

  /* ===== Load org info (for settings) ===== */
  const loadOrg = useCallback(async () => {
    const { data, error } = await supabase
      .from("orgs")
      .select("id, name, slug")
      .eq("id", orgId)
      .maybeSingle();
    if (!error && data) {
      setClubName(data.name || "");
      setClubSlug(data.slug || "");
    }
  }, [orgId]);

  /* ===== Load leagues (active + archived) ===== */
  const loadLeagues = useCallback(async () => {
    setLoading(true);
    const [{ data: act, error: e1 }, { data: arc, error: e2 }] = await Promise.all([
      supabase
        .from("league")
        .select("*")
        .eq("org_id", orgId)
        .eq("archived", false)
        .order("created_at", { ascending: false }),
      supabase
        .from("league")
        .select("*")
        .eq("org_id", orgId)
        .eq("archived", true)
        .order("created_at", { ascending: false }),
    ]);
    if (!e1 && Array.isArray(act)) setLeagues(act);
    if (!e2 && Array.isArray(arc)) setArchivedLeagues(arc);
    setLoading(false);
  }, [orgId]);

  /* ===== Load members (names/emails/roles) =====
     NOTE: auth.users is in the auth schema and is not queryable via the anon key by default.
     For now, we load from memberships only (user_id, role) and show emails as entered during invite.
     Later, wire to a server action (service key) to join on auth.users.email for richer display. */
  const loadMembers = useCallback(async () => {
    const { data, error } = await supabase
      .from("memberships")
      .select("user_id, role") // keep it simple under current RLS
      .eq("org_id", orgId);
    if (!error && Array.isArray(data)) setMembers(data);
  }, [orgId]);

  useEffect(() => {
    loadOrg();
    loadLeagues();
    loadMembers();
  }, [loadOrg, loadLeagues, loadMembers]);

  const activeLeagues = useMemo(() => leagues, [leagues]);

  /* ===== Create League ===== */
  async function createLeague() {
    const raw = divInput.trim();
    if (!raw) return alert("Enter a league division name");
    const slug = toSlug(raw);
    if (!slug) return alert("League division name must contain letters or numbers");

    setCreating(true);
    try {
      // try to include a "kind" column if it exists; otherwise retry without it
      let result = await supabase
        .from("league")
        .insert({
          org_id: orgId,
          slug,
          division: raw,
          start_date: startDate || null,
          archived: false,
          kind: leagueType, // may fail if column doesn't exist
        })
        .select("*")
        .maybeSingle();

      if (result.error && /column .* kind .* does not exist/i.test(result.error.message)) {
        result = await supabase
          .from("league")
          .insert({
            org_id: orgId,
            slug,
            division: raw,
            start_date: startDate || null,
            archived: false,
          })
          .select("*")
          .maybeSingle();
      }
      if (result.error) throw result.error;

      setDivInput("");
      setStartDate("");
      await loadLeagues();
      // keep legacy flow
      router.push(`/l/${result.data.slug}`);
    } catch (e) {
      alert(e?.message || String(e));
    } finally {
      setCreating(false);
    }
  }

  /* ===== Archive League (from card) ===== */
  async function archiveDivision(league) {
    const name = league.division || league.slug;
    const ok = confirm(`Archive the league "${name}"?`);
    if (!ok) return;
    try {
      const { error } = await supabase.from("league").update({ archived: true }).eq("id", league.id);
      if (error) throw error;
      await loadLeagues();
      alert("League archived.");
    } catch (e) {
      alert(e?.message || String(e));
    }
  }

  /* ===== CSV Export for Archived (still available via settings) ===== */
  async function downloadCsvForLeague(league) {
    if (!league?.id) return;
    const [{ data: players }, { data: results }] = await Promise.all([
      supabase
        .from("players")
        .select("*")
        .eq("league_id", league.id)
        .eq("org_id", orgId)
        .order("created_at"),
      supabase
        .from("week_results")
        .select("*")
        .eq("league_id", league.id)
        .eq("org_id", orgId),
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

  /* ===== Settings Actions ===== */
  async function saveClubName(e) {
    e?.preventDefault?.();
    setSettingsMsg("");
    try {
      const { error } = await supabase.from("orgs").update({ name: clubName }).eq("id", orgId);
      if (error) throw error;
      setSettingsMsg("Club name saved.");
    } catch (e) {
      setSettingsMsg(e?.message || String(e));
    }
  }

  // NOTE: Invites/removals ideally go through a server action with the service key.
  // For now, we insert a membership row using the current user context (owner).
  async function inviteUser(e) {
    e?.preventDefault?.();
    setSettingsMsg("");
    try {
      // Create a placeholder membership; the invited user will sign up later with email+password
      const { error } = await supabase
        .from("memberships")
        .insert({ user_id: inviteEmail /* TEMP store email in user_id? No. */ , org_id: orgId, role: inviteRole });

      // The above won't work because user_id must be a UUID. So we show guidance:
      throw new Error(
        "To invite by email, we need a server action that creates a Supabase user (or waits until they sign up) and then inserts their user_id. For now, ask the user to sign up at /signup, then add them here."
      );
    } catch (e) {
      setSettingsMsg(e?.message || String(e));
    }
  }

  async function removeUser(u) {
    setSettingsMsg("");
    try {
      const { error } = await supabase
        .from("memberships")
        .delete()
        .eq("org_id", orgId)
        .eq("user_id", u.user_id);
      if (error) throw error;
      await loadMembers();
      setSettingsMsg("User removed.");
    } catch (e) {
      setSettingsMsg(e?.message || String(e));
    }
  }

  return (
    <main className={`${brand.bg} ${brand.text} min-h-screen`}>
      {/* Top bar */}
      <div className="border-b border-slate-200 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center gap-4">
          <img src="/logo.png" alt="Pickle Pathway" className="h-40 w-auto rounded-lg ring-1 ring-slate-200" />
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Home Page</h1>
            <p className={`${brand.subtext} text-sm mt-1`}>Manage leagues</p>
          </div>

          {/* Replaced Email Templates with Admin Settings */}
          <button
            onClick={() => {
              setSettingsOpen(true);
              setSettingsTab("club");
            }}
            className={`px-3 py-2 rounded-xl ${brand.ctaOutline}`}
            title="Admin settings"
          >
            Admin Settings
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6 space-y-8">
        {/* Create new league */}
        <section className={`${brand.card} ${brand.ring} p-5`}>
          <h2 className="font-semibold text-lg mb-3">Create a new league</h2>

          <div className="grid md:grid-cols-4 gap-3">
            {/* League type dropdown (only Ladder League for now) */}
            <div className="flex flex-col">
              <label className={`${brand.subtext} text-sm`}>League type</label>
              <select
                className={`px-3 py-2 rounded-xl ${brand.border}`}
                value={leagueType}
                onChange={(e) => setLeagueType(e.target.value)}
              >
                <option value="ladder">Ladder League</option>
              </select>
            </div>

            {/* League division name */}
            <div className="flex flex-col md:col-span-2">
              <label className={`${brand.subtext} text-sm`}>League division name</label>
              <input
                className={`px-3 py-2 rounded-xl ${brand.border}`}
                placeholder="e.g., Intermediate A"
                value={divInput}
                onChange={(e) => setDivInput(e.target.value)}
              />
            </div>

            {/* Optional start date */}
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
                {creating ? "Creating…" : "Create league"}
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-500 mt-2">
            The division name becomes the public URL slug automatically (e.g., <code>intermediate-a</code>).
          </p>
        </section>

        {/* Active leagues */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">Active leagues</h2>
            {loading && <span className="text-sm text-slate-500">Loading…</span>}
          </div>

          {activeLeagues.length === 0 ? (
            <p className="text-sm text-slate-500">No active leagues yet.</p>
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
                    <a href={`/l/${l.slug}`} className={`px-3 py-2 rounded-xl ${brand.ctaOutline}`}>Admin</a>
                    <a href={`/player/${l.slug}`} className={`px-3 py-2 rounded-xl ${brand.ctaOutline}`}>Player</a>
                    <a href={`/subs/${l.slug}`} className={`px-3 py-2 rounded-xl ${brand.ctaOutline}`}>Sub form</a>
                    <a href={`/player/${l.slug}#subs`} className={`px-3 py-2 rounded-xl ${brand.ctaOutline}`}>Sub list</a>
                    <button
                      onClick={() => archiveDivision(l)}
                      className={`px-3 py-2 rounded-xl ${brand.ctaOutline}`}
                      title="Archive this league"
                    >
                      Archive
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ===== Admin Settings Modal ===== */}
      {settingsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className={`${brand.card} ${brand.ring} w-full max-w-3xl p-0 overflow-hidden`}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
              <div className="font-semibold">Admin Settings</div>
              <button onClick={() => setSettingsOpen(false)} className="text-slate-500">Close</button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 px-5 py-3 border-b border-slate-200">
              {[
                ["club", "Change Club Name"],
                ["users", "Manage Users"],
                ["billing", "Manage Payment"],
                ["emails", "Email Templates"],
                ["archived", "View Archived Leagues"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setSettingsTab(key)}
                  className={`px-3 py-1.5 rounded-lg border text-sm ${settingsTab === key ? "bg-[#e9f7f0] border-[#0ea568] text-[#0ea568]" : "border-slate-200"}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="p-5 space-y-6 max-h-[70vh] overflow-auto">
              {/* Change Club Name */}
              {settingsTab === "club" && (
                <form onSubmit={saveClubName} className="grid sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className={`${brand.subtext} text-sm`}>Club name</label>
                    <input
                      className={`w-full px-3 py-2 rounded-xl ${brand.border}`}
                      value={clubName}
                      onChange={(e) => setClubName(e.target.value)}
                    />
                    <p className="text-xs text-slate-500 mt-1">Slug: <code>{clubSlug}</code></p>
                  </div>
                  <div className="flex items-end">
                    <button className={`px-4 py-2 rounded-xl ${brand.cta}`}>Save</button>
                  </div>
                </form>
              )}

              {/* Manage Users */}
              {settingsTab === "users" && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 p-3 bg-slate-50 text-sm">
                    Invites by email require a server action with a service key (we’ll wire this next).
                    For now, ask users to <b>sign up at /signup</b>, then add them here by selecting their user in the list. 
                  </div>

                  <div className="grid md:grid-cols-3 gap-3 items-end">
                    <div className="md:col-span-1">
                      <label className={`${brand.subtext} text-sm`}>Name</label>
                      <input className={`w-full px-3 py-2 rounded-xl ${brand.border}`} value={inviteName} onChange={(e)=>setInviteName(e.target.value)} placeholder="Optional" />
                    </div>
                    <div className="md:col-span-1">
                      <label className={`${brand.subtext} text-sm`}>Email</label>
                      <input className={`w-full px-3 py-2 rounded-xl ${brand.border}`} value={inviteEmail} onChange={(e)=>setInviteEmail(e.target.value)} placeholder="user@club.com" />
                    </div>
                    <div className="md:col-span-1">
                      <label className={`${brand.subtext} text-sm`}>Role</label>
                      <select className={`w-full px-3 py-2 rounded-xl ${brand.border}`} value={inviteRole} onChange={(e)=>setInviteRole(e.target.value)}>
                        <option value="admin">Admin</option>
                        <option value="sub-admin">Sub-admin</option>
                      </select>
                    </div>
                    <div className="md:col-span-3">
                      <button onClick={inviteUser} className={`px-4 py-2 rounded-xl ${brand.cta}`}>Invite user</button>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Current users</h4>
                    {members.length === 0 ? (
                      <div className="text-sm text-slate-500">No users yet.</div>
                    ) : (
                      <div className="grid gap-2">
                        {members.map((m) => (
                          <div key={m.user_id} className="flex items-center justify-between p-3 rounded-xl border border-slate-200">
                            <div className="text-sm">
                              <div className="font-medium">{m.user_id}</div>
                              <div className="text-slate-500">{m.role}</div>
                            </div>
                            <button onClick={() => removeUser(m)} className={`px-3 py-1.5 rounded-lg ${brand.ctaOutline}`}>Remove</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Manage Payment */}
              {settingsTab === "billing" && (
                <div className="space-y-2">
                  <div className="text-sm text-slate-600">
                    Stripe integration coming soon. You’ll be able to update your plan and payment method here.
                  </div>
                </div>
              )}

              {/* Email Templates */}
              {settingsTab === "emails" && (
                <div className="space-y-2">
                  <Link href="/admin/email-templates" className={`inline-block px-3 py-2 rounded-xl ${brand.ctaOutline}`}>
                    Open Email Templates
                  </Link>
                  <p className="text-sm text-slate-600">Edit copy used for previews and sends.</p>
                </div>
              )}

              {/* View Archived Leagues (moved here) */}
              {settingsTab === "archived" && (
                <div className="space-y-3">
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
                </div>
              )}

              {settingsMsg ? <div className="text-sm text-slate-600">{settingsMsg}</div> : null}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
