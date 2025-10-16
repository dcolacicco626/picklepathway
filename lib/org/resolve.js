import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function resolveOrgIdFromRequest(host, pathname) {
  // 1. Try to match a custom domain
  const { data: site } = await supabase
    .from("sites")
    .select("org_id")
    .eq("domain", host)
    .maybeSingle();

  if (site && site.org_id) return site.org_id;

  // 2. Fallback: use /admin/:orgSlug or /player/:orgSlug
  const match = pathname.match(/^\/(admin|player)\/([^/]+)/);
  if (match) {
    const slug = match[2];
    const { data: org } = await supabase
      .from("orgs")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (org && org.id) return org.id;
  }

  // 3. Nothing matched
  return null;
}
