"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

export default function AdminIndexClient() {
  const [loading, setLoading] = useState(true);
  const [orgs, setOrgs] = useState([]);
  const [msg, setMsg] = useState("");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }
        const { data, error } = await supabase
          .from("memberships")
          .select("orgs:org_id ( id, name, slug, logo_url )")
          .eq("user_id", user.id);
        if (error) throw error;
        const list = (data || []).map((r) => r.orgs).filter(Boolean);
        if (alive) setOrgs(list);
      } catch (e) {
        if (alive) setMsg(e?.message || String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  async function sendMagicLink(e) {
    e.preventDefault();
    setMsg("");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin + "/admin" },
      });
      if (error) throw error;
      setSent(true);
    } catch (e) {
      setMsg(e?.message || String(e));
    }
  }

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;

  // Not signed in -> show magic-link form
  if (orgs.length === 0 && !msg && !sent) {
    return (
      <div style={{ maxWidth: 420, margin: "40px auto", padding: 24 }}>
        <h1 style={{ fontWeight: 700, fontSize: 22, marginBottom: 12 }}>Sign in</h1>
        <form onSubmit={sendMagicLink} style={{ display: "grid", gap: 12 }}>
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: 10, borderRadius: 8, border: "1px solid #e5e7eb" }}
          />
          <button type="submit" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #0ea568" }}>
            Send magic link
          </button>
        </form>
        <p style={{ color: "#64748b", fontSize: 13, marginTop: 8 }}>
          We’ll email you a login link. After clicking it, you’ll return to /admin.
        </p>
      </div>
    );
  }

  if (sent) return <div style={{ padding: 24 }}>Check your email for the sign-in link.</div>;
  if (msg) return <div style={{ padding: 24 }}>{msg}</div>;

  // Signed in and has orgs
  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontWeight: 700, fontSize: 22, marginBottom: 12 }}>Your Clubs</h1>
      <ul style={{ display: "grid", gap: 12 }}>
        {orgs.map((o) => (
          <li key={o.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {o.logo_url ? <img src={o.logo_url} alt="" style={{ height: 40 }} /> : null}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{o.name}</div>
                <div style={{ color: "#64748b", fontSize: 12 }}>{o.slug}</div>
              </div>
              <Link href={`/admin/${o.slug}`} className="px-3 py-2 rounded border">Open</Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
