import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { getActiveOrgId } from "./org/getActiveOrg";

export async function supabaseForOrg() {
  const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { get: (key) => cookieStore.get(key)?.value } }
  );

  const orgId = await getActiveOrgId();
  if (!orgId) throw new Error("No active org resolved");

  return { supabase, orgId };
}
