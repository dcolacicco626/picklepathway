"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { AnimatePresence, motion } from "framer-motion";


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
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
}

/* ========= Main Component ========= */
export default function OrgHome({ orgId }) {
  const router = useRouter();

  // ----- Create league form -----
  const [leagueType, setLeagueType] = useState("ladder"); // only option for now
  const [divInput, setDivInput] = useState("");
  const [startDate, setStartDate] = useState("");

  // ----- Data -----
  const [leagues, setLeagues] = useState([]);
  const [archivedLeagues, setArchivedLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // ----- Settings modal -----
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState("club"); // club | users | billing | emails | archived
  const [clubName, setClubName] = useState("");
  const [clubSlug, setClubSlug] = useState("");
  const [settingsMsg, setSettingsMsg] = useState("");

  // Users tab
  const [members, setMembers] = useState([]);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("admin");
  const [loadingMembers, setLoadingMembers] = useState(false);

// Switch Club state
const [orgOptions, setOrgOptions] = useState([]); // [{id, name}]
const [switchChoice, setSwitchChoice] = useState("");
const [savingSwitch, setSavingSwitch] = useState(false);

const [orgData, setOrgData] = useState(null);
const [myUserId, setMyUserId] = useState(null);
const [backupInviteUrl, setBackupInviteUrl] = useState("");

// Personal (account) details state
const [personalName, setPersonalName] = useState("");
const [personalEmail, setPersonalEmail] = useState("");
const [personalPw, setPersonalPw] = useState("");
const [savingProfile, setSavingProfile] = useState(false);
const [savingPw, setSavingPw] = useState(false);
// Club name saving toggle (needed by the Save button in the Club tab)
const [savingClub, setSavingClub] = useState(false);





async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
useEffect(() => {
  (async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setMyUserId(user?.id || null);
  })();
}, []);



useEffect(() => {
  async function loadOrg() {
    const { data, error } = await supabase
      .from("orgs")
      .select("id, name, slug")
      .eq("id", orgId)
      .maybeSingle();
    if (!error) setOrgData(data);
  }
  if (orgId) loadOrg();
}, [orgId]);

useEffect(() => {
  (async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setPersonalName(
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.user_metadata?.display_name ||
      ""
    );
    setPersonalEmail(user.email || "");
  })();
}, []);
useEffect(() => {
  if (orgData?.name) setClubName(orgData.name);
}, [orgData?.name]);





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
    const [{ data: act }, { data: arc }] = await Promise.all([
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
    setLeagues(Array.isArray(act) ? act : []);
    setArchivedLeagues(Array.isArray(arc) ? arc : []);
    setLoading(false);
  }, [orgId]);

  /* ===== Load members (via secure API) ===== */
  const loadMembers = useCallback(async () => {
    setLoadingMembers(true);
    try {
    const res = await fetch(`/api/admin/users?orgId=${orgId}`, {
  cache: "no-store",
  headers: await authHeaders(),
});

      const json = await res.json();
      setMembers(json?.users || []);
    } catch {
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  }, [orgId]);

const loadMyOrgs = useCallback(async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from("memberships")
      .select("orgs:org_id ( id, name, slug )")
      .eq("user_id", user.id);
    if (error) throw error;
    const orgs = (data || []).map(r => r.orgs).filter(Boolean);
    setOrgOptions(orgs);
    // preselect: current org
    if (orgs.length && !switchChoice) {
      const current = orgs.find(o => o.id === orgId) || orgs[0];
      setSwitchChoice(current.id);
    }
  } catch (e) {
    console.error("loadMyOrgs failed", e);
    setOrgOptions([]);
  }
}, [orgId, switchChoice]);


  useEffect(() => {
    loadOrg();
    loadLeagues();
    loadMembers();
loadMyOrgs();   // 👈 add this
}, [loadOrg, loadLeagues, loadMembers, loadMyOrgs]);

  const activeLeagues = useMemo(() => leagues, [leagues]);

  /* ===== Create League ===== */
  async function createLeague() {
    const raw = divInput.trim();
    if (!raw) return alert("Enter a league division name");
    const slug = toSlug(raw);
    if (!slug) return alert("League division name must contain letters or numbers");

    setCreating(true);
    try {
      // Try inserting with optional 'kind' column; fallback if absent
      let res = await supabase
        .from("league")
        .insert({
          org_id: orgId,
          slug,
          division: raw,
          start_date: startDate || null,
          archived: false,
          kind: leagueType,
        })
        .select("*")
        .maybeSingle();

      if (res.error && /column .* kind .* does not exist/i.test(res.error.message)) {
        res = await supabase
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
      if (res.error) throw res.error;

      setDivInput("");
      setStartDate("");
      await loadLeagues();
      router.push(`/l/${res.data.slug}`);
    } catch (e) {
      alert(e?.message || String(e));
    } finally {
      setCreating(false);
    }
  }

  /* ===== Archive League ===== */
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

  /* ===== CSV Export for Archived ===== */
  async function downloadCsvForLeague(league) {
    if (!league?.id) return;
    const [{ data: players }, { data: results }] = await Promise.all([
      supabase.from("players").select("*").eq("league_id", league.id).eq("org_id", orgId).order("created_at"),
      supabase.from("week_results").select("*").eq("league_id", league.id).eq("org_id", orgId),
    ]);

    const resBy = {};
    (results || []).forEach((r) => ((resBy[r.player_id] ||= {})[r.week] = r.points));

    const rows = (players || []).map((p) => {
      const weeks = [1, 2, 3, 4, 5, 6].map((i) => {
        const v = resBy[p.id]?.[i];
        return typeof v === "number" ? v : "";
      });
      const filled = weeks.filter((x) => x !== "");
      const avg = filled.length ? (filled.reduce((a, b) => a + b, 0) / filled.length).toFixed(2) : "";
      return [p.display_name, ...weeks, avg];
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
  setSavingClub(true);
  try {
    if (!clubName?.trim()) throw new Error("Please enter a club name.");
    // Update in your DB (example using your existing admin endpoint)
    const res = await fetch("/api/admin/org", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeaders()),
      },
      body: JSON.stringify({ orgId, name: clubName.trim() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Failed to save club name");
    setSettingsMsg("Club name saved.");
    // Optional: refresh local org data if you have a loader
    if (typeof loadOrg === "function") await loadOrg();
  } catch (e) {
    setSettingsMsg(e?.message || String(e));
  } finally {
    setSavingClub(false);
  }
}


async function savePersonalDetails(e) {
  e?.preventDefault?.();
  setSettingsMsg("");
  setSavingProfile(true);
  try {
    const updates = {
      data: { full_name: personalName || null },
    };
    // Update email if it changed
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Please sign in again.");
    if (personalEmail && personalEmail !== user.email) {
      updates.email = personalEmail;
    }
    const { error } = await supabase.auth.updateUser(updates);
    if (error) throw error;

    setSettingsMsg(
      updates.email
        ? "Personal details saved. If you changed email, please check your inbox to confirm."
        : "Personal details saved."
    );
  } catch (e) {
    setSettingsMsg(e?.message || String(e));
  } finally {
    setSavingProfile(false);
  }
}

async function updatePassword(e) {
  e?.preventDefault?.();
  setSettingsMsg("");
  setSavingPw(true);
  try {
    if (!personalPw || personalPw.length < 6)
      throw new Error("Password must be at least 6 characters.");
    const { error } = await supabase.auth.updateUser({ password: personalPw });
    if (error) throw error;
    setPersonalPw("");
    setSettingsMsg("Password updated.");
  } catch (e) {
    setSettingsMsg(e?.message || String(e));
  } finally {
    setSavingPw(false);
  }
}


async function inviteUser() {
  setSettingsMsg("");
  try {
    if (!inviteEmail) throw new Error("Email required");

    const headers = {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    };

    const body = JSON.stringify({
      orgId,
      email: inviteEmail.trim(),
      role: inviteRole,
      name: inviteName || null,
    });

    const res = await fetch("/api/admin/users", { method: "POST", headers, body });
    const data = await res.json();

    if (res.ok) {
      setInviteName("");
      setInviteEmail("");
      setInviteRole("admin");
      await loadMembers();
      setSettingsMsg("Invite sent and membership created.");

      if (data.link) {
        setBackupInviteUrl(data.link); // Optional: show a "Copy invite link" button
      }
    } else {
      setSettingsMsg(data?.error || "Invite failed");
    }
  } catch (e) {
    console.error("Invite failed:", e);
    setSettingsMsg(e?.message || String(e));
  }
}
async function removeUser(userId) {
  setSettingsMsg("");
  try {
    const res = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeaders()),
      },
      body: JSON.stringify({ orgId, userId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Remove failed");
    await loadMembers();
  } catch (e) {
    setSettingsMsg(e?.message || String(e));
  }
}


async function saveDefaultClub() {
  setSavingSwitch(true);
  setSettingsMsg("");
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Please sign in again.");
    if (!switchChoice) throw new Error("Select a club first.");

    // upsert user preference
    const { error } = await supabase
      .from("user_prefs")
      .upsert({ user_id: user.id, active_org_id: switchChoice });
    if (error) throw error;

    setSettingsMsg("Default club updated.");
  } catch (e) {
    setSettingsMsg(e?.message || String(e));
  } finally {
    setSavingSwitch(false);
  }
}

async function switchNow() {
  if (!switchChoice) return;
  const target = orgOptions.find(o => o.id === switchChoice);
  if (!target) return;
  // Navigate directly to that club dashboard
  router.replace(`/admin/${target.slug}`);
}


  return (
    <main className={`${brand.bg} ${brand.text} min-h-screen`}>
     {/* Top bar (refined, no slug line) */}
<div className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
  <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
    {/* Left: Logo + name */}
    <div className="flex items-center gap-4">
      <div className="shrink-0">
        <img
          src="/logo.png"
          alt="Pickle Pathway"
          className="h-12 md:h-14 w-auto rounded-lg shadow-sm ring-1 ring-slate-200 object-contain"
        />
      </div>

      <div className="leading-tight">
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">
          {orgData?.name || "Club Dashboard"}
        </h1>
        <div className="text-sm text-slate-500">
          Manage leagues & settings
        </div>
      </div>
    </div>

    {/* Right: Actions */}
    <div className="flex items-center gap-2">
      <button
        onClick={() => {
          setSettingsOpen(true);
          setSettingsTab("club");
        }}
        className={`px-4 py-2 rounded-xl ${brand.ctaOutline}`}
        title="Admin settings"
      >
        Admin Settings
      </button>
    </div>
  </div>
</div>


      <div className="max-w-5xl mx-auto p-6 space-y-8">
        {/* Create new league */}
        <section className={`${brand.card} ${brand.ring} p-5`}>
          <h2 className="font-semibold text-lg mb-3">Create a new league</h2>

          <div className="grid md:grid-cols-4 gap-3">
            {/* League type */}
            <div className="flex flex-col">
              <label className={`${brand.subtext} text-sm`}>League type</label>
              <select className={`px-3 py-2 rounded-xl ${brand.border}`} value={leagueType} onChange={(e) => setLeagueType(e.target.value)}>
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
              <input type="date" className={`px-3 py-2 rounded-xl ${brand.border}`} value={startDate || ""} onChange={(e) => setStartDate(e.target.value)} />
            </div>

            <div className="flex items-end">
              <button onClick={createLeague} disabled={creating} className={`px-4 py-2 rounded-xl ${brand.cta} hover:bg-[#0b8857] disabled:opacity-60`}>
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
                    {l.start_date ? <div className={`${brand.chip} px-2 py-0.5 rounded-full text-xs`}>Starts {fmtMDY(l.start_date)}</div> : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a href={`/l/${l.slug}`} className={`px-3 py-2 rounded-xl ${brand.ctaOutline}`}>Admin</a>
                    <a href={`/player/${l.slug}`} className={`px-3 py-2 rounded-xl ${brand.ctaOutline}`}>Player</a>
                    <a href={`/subs/${l.slug}`} className={`px-3 py-2 rounded-xl ${brand.ctaOutline}`}>Sub form</a>
                    <a href={`/player/${l.slug}#subs`} className={`px-3 py-2 rounded-xl ${brand.ctaOutline}`}>Sub list</a>
                    <button onClick={() => archiveDivision(l)} className={`px-3 py-2 rounded-xl ${brand.ctaOutline}`} title="Archive this league">Archive</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

{/* ===== Admin Settings Modal (refined) ===== */}
<AnimatePresence>
  {settingsOpen && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.15 }}
        className={`${brand.card} ${brand.ring} w-full max-w-3xl p-0 flex flex-col overflow-hidden`}
      >
        {/* Header */}
        <div className="flex-none flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <div className="font-semibold">Admin Settings</div>
          <button onClick={() => setSettingsOpen(false)} className="text-slate-500">
            Close
          </button>
        </div>

        {/* Tabs */}
        <div className="flex-none border-b border-slate-200 px-5 py-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              ["club", "Club & Personal Details"],
              ["users", "Manage Users"],
              ["billing", "Manage Payment"],
              ["emails", "Default Email Templates"],
              ["archived", "View Archived Leagues"],
              ["switch", "Switch Club"],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSettingsTab(key)}
                className={`py-2 rounded-lg text-sm font-medium transition
                  ${
                    settingsTab === key
                      ? "bg-[#e9f7f0] text-[#0ea568] border border-[#0ea568]"
                      : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6 min-h-[460px]">
          {/* --- Change Club Name --- */}
{settingsTab === "club" && (
  <div className="space-y-5">
    {/* Club name */}
    <form onSubmit={saveClubName} className="space-y-3">
      <label className={`${brand.subtext} text-sm`}>Change Club Name</label>
      <div className="grid sm:grid-cols-3 gap-3">
        <input
          className={`w-full px-3 py-2 rounded-xl ${brand.border} sm:col-span-2`}
          value={clubName}
          onChange={(e) => setClubName(e.target.value)}
          placeholder="Club name"
        />
        <button
          disabled={savingClub}
          className={`px-4 py-2 rounded-xl ${brand.cta} hover:bg-[#0b8857] disabled:opacity-60`}
        >
          {savingClub ? "Saving…" : "Save"}
        </button>
      </div>
      {settingsMsg ? (
        <div className="text-sm text-slate-600">{settingsMsg}</div>
      ) : null}
    </form>

    {/* Personal details */}
    <div className="border-t border-slate-200 pt-5">
      <h4 className="font-semibold mb-3">Personal Details</h4>

      <form onSubmit={savePersonalDetails} className="space-y-4">
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="sm:col-span-1">
            <label className={`${brand.subtext} text-sm`}>Personal Name</label>
            <input
              className={`w-full px-3 py-2 rounded-xl ${brand.border}`}
              value={personalName}
              onChange={(e) => setPersonalName(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <div className="sm:col-span-2">
            <label className={`${brand.subtext} text-sm`}>Personal Email</label>
            <input
              className={`w-full px-3 py-2 rounded-xl ${brand.border}`}
              value={personalEmail}
              onChange={(e) => setPersonalEmail(e.target.value)}
              placeholder="you@club.com"
              type="email"
            />
          </div>
        </div>

        <div className="flex">
          <button
            disabled={savingProfile}
            className={`px-4 py-2 rounded-xl ${brand.cta} hover:bg-[#0b8857] disabled:opacity-60`}
          >
            {savingProfile ? "Saving…" : "Save personal details"}
          </button>
        </div>
      </form>

      {/* Password */}
      <div className="mt-6">
        <label className={`${brand.subtext} text-sm`}>Password</label>
        <div className="grid sm:grid-cols-3 gap-3 items-end">
          <input
            className={`w-full px-3 py-2 rounded-xl ${brand.border} sm:col-span-2`}
            value={personalPw}
            onChange={(e) => setPersonalPw(e.target.value)}
            placeholder="New password"
            type="password"
          />
          <button
            onClick={updatePassword}
            disabled={savingPw}
            className={`px-4 py-2 rounded-xl ${brand.cta} hover:bg-[#0b8857] disabled:opacity-60`}
          >
            {savingPw ? "Updating…" : "Update password"}
          </button>
        </div>
      </div>
    </div>
  </div>
)}


          {/* --- Manage Users --- */}
          {settingsTab === "users" && (
            <div className="space-y-6">
              {/* Invite */}
              <div className="grid sm:grid-cols-3 gap-3 items-end">
                <div>
                  <label className={`${brand.subtext} text-sm`}>Name (optional)</label>
                  <input
                    className={`w-full px-3 py-2 rounded-xl ${brand.border}`}
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="Jane Admin"
                  />
                </div>
                <div>
                  <label className={`${brand.subtext} text-sm`}>Email</label>
                  <input
                    className={`w-full px-3 py-2 rounded-xl ${brand.border}`}
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="user@club.com"
                  />
                </div>
                <div>
                  <label className={`${brand.subtext} text-sm`}>Role</label>
                  <select
                    className={`w-full px-3 py-2 rounded-xl ${brand.border}`}
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                  >
                    <option value="admin">Admin</option>
                    <option value="sub-admin">Sub-admin</option>
                  
                  </select>
                </div>
                <div className="sm:col-span-3">
                  <button onClick={inviteUser} className={`px-4 py-2 rounded-xl ${brand.cta} hover:bg-[#0b8857]`}>
                    Invite user
                  </button>
                </div>
              </div>
{backupInviteUrl ? (
  <div className="sm:col-span-3 mt-2 text-sm">
    <button
      onClick={() => {
        navigator.clipboard.writeText(backupInviteUrl);
        setSettingsMsg("Invite link copied to clipboard.");
      }}
      className={`px-3 py-1.5 rounded-lg ${brand.ctaOutline}`}
    >
      Copy invite link
    </button>
    <span className="ml-2 text-slate-500 break-all">{backupInviteUrl}</span>
  </div>
) : null}


              {/* Current users */}
              <div className="border-t border-slate-200 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">Current users</h4>
                  <button onClick={loadMembers} className={`px-3 py-1.5 rounded-lg ${brand.ctaOutline}`}>
                    Refresh
                  </button>
                </div>
                {loadingMembers ? (
                  <div className="text-sm text-slate-500">Loading members…</div>
                ) : members.length === 0 ? (
                  <div className="text-sm text-slate-500">No users yet.</div>
                ) : (
                  <div className="grid gap-2">
       {members.map((m) => (
  <div
    key={m.user_id}
    className="flex items-center justify-between p-3 rounded-xl border border-slate-200"
  >
<div className="text-sm">
  <div className="font-medium">{m.name || "(no name yet)"}</div>
  <div className="text-slate-500">{m.email}</div>
  <div className="text-slate-500 text-xs mt-1">{m.role}</div>
</div>


    {m.user_id !== myUserId ? (
      <button
        onClick={() => removeUser(m.user_id)}
        className={`px-3 py-1.5 rounded-lg ${brand.ctaOutline}`}
      >
        Remove
      </button>
    ) : (
      <button
        disabled
        title="You can't remove yourself"
        className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-400 cursor-not-allowed"
      >
        Remove
      </button>
    )}
  </div>
))}

                  </div>
                )}
              </div>
              {settingsMsg ? <div className="text-sm text-slate-600">{settingsMsg}</div> : null}
            </div>
          )}

          {/* --- Manage Payment --- */}
          {settingsTab === "billing" && (
            <div className="space-y-1 text-sm text-slate-600">
              Stripe integration coming soon. Update plan and payment method here.
            </div>
          )}

          {/* --- Email Templates --- */}
          {settingsTab === "emails" && (
            <div className="space-y-2">
              <Link href="/admin/email-templates" className={`inline-block px-3 py-2 rounded-xl ${brand.ctaOutline}`}>
                Ladder League Templates
              </Link>
            
            </div>
          )}

          {/* --- View Archived Leagues --- */}
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
                          <div className={`${brand.chip} px-2 py-0.5 rounded-full text-xs`}>Started {fmtMDY(l.start_date)}</div>
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
                        <a href={`/player/${l.slug}`} className={`px-3 py-2 rounded-xl ${brand.ctaOutline}`}>Player</a>
                        <a href={`/player/${l.slug}#subs`} className={`px-3 py-2 rounded-xl ${brand.ctaOutline}`}>Sub list</a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* --- Switch Club --- */}
          {settingsTab === "switch" && (
            <div className="space-y-4">
              <div className="text-sm text-slate-600">
                Choose another club you belong to. You can set it as your default and/or switch immediately.
              </div>

              <div className="grid sm:grid-cols-3 gap-3 items-end">
                <div className="sm:col-span-2">
                  <label className={`${brand.subtext} text-sm`}>Select club</label>
                  <select
                    className={`w-full px-3 py-2 rounded-xl ${brand.border}`}
                    value={switchChoice}
                    onChange={(e) => setSwitchChoice(e.target.value)}
                  >
                    {orgOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name} ({o.slug})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={saveDefaultClub}
                    disabled={savingSwitch || !switchChoice}
                    className={`px-3 py-2 rounded-xl ${brand.cta} disabled:opacity-60`}
                  >
                    {savingSwitch ? "Saving…" : "Set as default"}
                  </button>
                  <button onClick={switchNow} disabled={!switchChoice} className={`px-3 py-2 rounded-xl ${brand.ctaOutline}`}>
                    Switch now
                  </button>
                </div>
              </div>

              {settingsMsg ? <div className="text-sm text-slate-600">{settingsMsg}</div> : null}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )}
</AnimatePresence>

    </main>
  );
}
