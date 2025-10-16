// /app/admin/page.js
import { createServerClient } from "@supabase/ssr";
import Link from "next/link";

export default async function AdminIndexPage() {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  // Grab the authed user (cookie-based session)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return <div style={{ padding: 24 }}>Please sign in to view your organizations.</div>;
  }

  // Fetch orgs via memberships
  const { data: rows, error } = await supabase
    .from("memberships")
    .select("orgs:org_id ( id, name, slug, logo_url )")
    .eq("user_id", user.id);

  if (error) return <div style={{ padding: 24 }}>Error: {error.message}</div>;

  const orgs = (rows || []).map((r) => r.orgs).filter(Boolean);

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
