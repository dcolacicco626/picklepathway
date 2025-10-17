"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
// Adjust this import to your actual client path:
import { supabase } from "../../lib/supabaseClient";

export default function AdminIndexClient() {
  const [loading, setLoading] = useState(true);
  const [orgs, setOrgs] = useState([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // 1) Ensure envs are present (helpful message if not)
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
          setMsg("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel env.");
          return;
        }

        // 2) Get the current user from browser session
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          setMsg("Please sign in to view your organizations.");
          return;
        }

        // 3) Pull orgs via memberships
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

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (msg) return <div style={{ padding: 24 }}>{msg}</div>;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontWeight: 700, fontSize: 22, marginBottom: 12 }}>Your Clubs</h1>
      {orgs.length === 0 ? (
        <p>No organizations yet. Ask an owner to invite you.</p>
      ) : (
        <ul style={{ display: "grid", gap: 12 }}>
          {orgs.map((o) => (
            <li key={o.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {o.logo_url ? <img src={o.logo_url} alt="" style={{ height: 40 }} /> : null}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{o.name}</div>
                  <div style={{ color: "#64748b", fontSize: 12 }}>{o.slug}</div>
                </div>
                <Link href={`/admin/${o.slug}`} className="px-3 py-2 rounded border">
                  Open
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
