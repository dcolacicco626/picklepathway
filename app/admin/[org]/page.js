// /app/admin/[org]/page.js
export const dynamic = "force-dynamic";

import OrgHome from "./OrgHome";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export default async function OrgLandingPage({ params }) {
  const { org: slug } = params; // <-- use the dynamic segment directly

  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        set: () => {},
        remove: () => {},
      },
    }
  );

  // Look up the org by slug
  const { data: org, error } = await supabase
    .from("orgs")
    .select("id, slug, name")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    return <div style={{ padding: 24 }}>Error loading org: {error.message}</div>;
  }
  if (!org) {
    return <div style={{ padding: 24 }}>No organization found for this URL.</div>;
  }

  return <OrgHome orgId={org.id} />;
}
