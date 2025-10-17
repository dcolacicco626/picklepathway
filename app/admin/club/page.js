// /app/admin/club/page.js
"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient"; // adjust path if your lib is elsewhere
import OrgHome from "../[org]/OrgHome"; // reuse your existing component

export default function MyClubPage() {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [orgId, setOrgId] = useState(null);
  const [orgOptions, setOrgOptions] = useState([]); // [{id, name, slug}]
  const [choice, setChoice] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // 1) Must be signed in
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setMsg("Please sign in to view your club.");
          return;
        }

        // 2) Load memberships → get orgs the user belongs to
        const { data: mems, error: mErr } = await supabase
          .from("memberships")
          .select("orgs:org_id ( id, name, slug )")
          .eq("user_id", user.id);
        if (mErr) throw mErr;

        const orgs = (mems || []).map(m => m.orgs).filter(Boolean);
        setOrgOptions(orgs);

        if (orgs.length === 0) {
          setMsg("You don't belong to any clubs yet.");
          return;
        }

        // 3) Try user_prefs.active_org_id
        const { data: pref } = await supabase
          .from("user_prefs")
          .select("active_org_id")
          .eq("user_id", user.id)
          .maybeSingle();

        const prefId = pref?.active_org_id || null;

        if (prefId && orgs.some(o => o.id === prefId)) {
          setOrgId(prefId);
          return;
        }

        // 4) If exactly one org, use it
        if (orgs.length === 1) {
          setOrgId(orgs[0].id);
          return;
        }

        // 5) Multiple orgs → ask user to pick
        setChoice(orgs[0].id);
      } catch (e) {
        setMsg(e?.message || String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  async function saveDefaultAndOpen() {
    try {
      if (!choice) return;
      // Upsert their preference
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setMsg("Please sign in again."); return; }

      await supabase
        .from("user_prefs")
        .upsert({ user_id: user.id, active_org_id: choice });

      setOrgId(choice);
    } catch (e) {
      setMsg(e?.message || String(e));
    }
  }

  const chosenOrg = useMemo(
    () => orgOptions.find(o => o.id === orgId) || null,
    [orgId, orgOptions]
  );

  // Loading / errors
  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (msg && !orgId && orgOptions.length === 0) return <div style={{ padding: 24 }}>{msg}</div>;

  // Multi-org picker
  if (!orgId && orgOptions.length > 1) {
    return (
      <div style={{ maxWidth: 520, margin: "60px auto", padding: 24 }}>
        <h1 style={{ fontWeight: 700, fontSize: 22, marginBottom: 8 }}>Choose your club</h1>
        <p style={{ color: "#64748b", marginBottom: 12 }}>
          You belong to multiple clubs. Pick one to open. You can change this later in Admin Settings.
        </p>
        <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
          <select
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
            style={{ padding: 10, borderRadius: 8, border: "1px solid #e5e7eb" }}
          >
            {orgOptions.map(o => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={saveDefaultAndOpen}
          style={{ padding: "10px 14px", borderRadius: 8, background: "#0ea568", color: "white", border: "none" }}
        >
          Set as default & continue
        </button>
        {msg && <p style={{ marginTop: 10, color: "#64748b" }}>{msg}</p>}
      </div>
    );
  }

  // Single org (or default set) → render the same OrgHome you use at /admin/[slug]
  if (orgId) {
    return <OrgHome orgId={orgId} />;
  }

  return <div style={{ padding: 24 }}>{msg || "No club found."}</div>;
}
// /app/admin/club/page.js
"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient"; // adjust path if your lib is elsewhere
import OrgHome from "../[org]/OrgHome"; // reuse your existing component

export default function MyClubPage() {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [orgId, setOrgId] = useState(null);
  const [orgOptions, setOrgOptions] = useState([]); // [{id, name, slug}]
  const [choice, setChoice] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // 1) Must be signed in
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setMsg("Please sign in to view your club.");
          return;
        }

        // 2) Load memberships → get orgs the user belongs to
        const { data: mems, error: mErr } = await supabase
          .from("memberships")
          .select("orgs:org_id ( id, name, slug )")
          .eq("user_id", user.id);
        if (mErr) throw mErr;

        const orgs = (mems || []).map(m => m.orgs).filter(Boolean);
        setOrgOptions(orgs);

        if (orgs.length === 0) {
          setMsg("You don't belong to any clubs yet.");
          return;
        }

        // 3) Try user_prefs.active_org_id
        const { data: pref } = await supabase
          .from("user_prefs")
          .select("active_org_id")
          .eq("user_id", user.id)
          .maybeSingle();

        const prefId = pref?.active_org_id || null;

        if (prefId && orgs.some(o => o.id === prefId)) {
          setOrgId(prefId);
          return;
        }

        // 4) If exactly one org, use it
        if (orgs.length === 1) {
          setOrgId(orgs[0].id);
          return;
        }

        // 5) Multiple orgs → ask user to pick
        setChoice(orgs[0].id);
      } catch (e) {
        setMsg(e?.message || String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  async function saveDefaultAndOpen() {
    try {
      if (!choice) return;
      // Upsert their preference
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setMsg("Please sign in again."); return; }

      await supabase
        .from("user_prefs")
        .upsert({ user_id: user.id, active_org_id: choice });

      setOrgId(choice);
    } catch (e) {
      setMsg(e?.message || String(e));
    }
  }

  const chosenOrg = useMemo(
    () => orgOptions.find(o => o.id === orgId) || null,
    [orgId, orgOptions]
  );

  // Loading / errors
  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (msg && !orgId && orgOptions.length === 0) return <div style={{ padding: 24 }}>{msg}</div>;

  // Multi-org picker
  if (!orgId && orgOptions.length > 1) {
    return (
      <div style={{ maxWidth: 520, margin: "60px auto", padding: 24 }}>
        <h1 style={{ fontWeight: 700, fontSize: 22, marginBottom: 8 }}>Choose your club</h1>
        <p style={{ color: "#64748b", marginBottom: 12 }}>
          You belong to multiple clubs. Pick one to open. You can change this later in Admin Settings.
        </p>
        <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
          <select
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
            style={{ padding: 10, borderRadius: 8, border: "1px solid #e5e7eb" }}
          >
            {orgOptions.map(o => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={saveDefaultAndOpen}
          style={{ padding: "10px 14px", borderRadius: 8, background: "#0ea568", color: "white", border: "none" }}
        >
          Set as default & continue
        </button>
        {msg && <p style={{ marginTop: 10, color: "#64748b" }}>{msg}</p>}
      </div>
    );
  }

  // Single org (or default set) → render the same OrgHome you use at /admin/[slug]
  if (orgId) {
    return <OrgHome orgId={orgId} />;
  }

  return <div style={{ padding: 24 }}>{msg || "No club found."}</div>;
}
