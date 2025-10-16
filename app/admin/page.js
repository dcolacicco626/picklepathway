// /app/admin/page.js
export const dynamic = "force-dynamic";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import Link from "next/link";

async function getSupabaseServer() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        // New API: get/set/remove
        get(name) {
          return cookieStore.get(name)?.value;
        },
        set() {
          // no-op during RSC render
        },
        remove() {
          // no-op during RSC render
        },
      },
    }
  );
}

export default async function AdminIndexPage() {
  // Guard: environment variables
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Missing environment variables</h1>
        <p>
          Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in your Vercel project (Production env).
        </p>
      </div>
    );
  }

  let supabase;
  try {
    supabase = await getSupabaseServer();
  } catch (e) {
    return <div style={{ padding: 24 }}>Supabase init error: {String(e?.message || e)}</div>;
  }

  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data?.user || null;
  } catch (e) {
    return <div style={{ padding: 24 }}>auth.getUser error: {String(e?.message || e)}</div>;
  }

  if (!user) {
    return <div style={{ padding: 24 }}>Please sign in to view your organizations.</div>;
  }

  let rows = [];
  try {
    const { data, error } = await supabase
      .from("memberships")
      .select("orgs:org_id ( id, name, slug, logo_url )")
      .eq("user_id", user.id);

    if (error) throw error;
    rows = data || [];
  } catch (e) {
    return <div style={{ padding: 24 }}>Query error: {String(e?.message || e)}</div>;
  }

  const orgs = rows.map((r) => r.orgs).filter(Boolean);

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
                <Link href={`/admin/${o.slug}`} className="px-3 py-2 rounded-xl border">
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
