"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient"; // adjust path if needed
import OrgHome from "./OrgHome";

export default function OrgLandingClient() {
  const { org: slug } = useParams(); // e.g. 'ddwm'
  const [orgId, setOrgId] = useState(null);
  const [msg, setMsg] = useState("Loading…");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // (Optional) ensure user is signed in
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setMsg("Please sign in to view this organization.");
          return;
        }

        // Look up org by slug (RLS will allow this because you’re signed in and have a membership)
        const { data, error } = await supabase
          .from("orgs")
          .select("id")
          .eq("slug", slug)
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          setMsg("No organization found for this URL.");
          return;
        }
        if (alive) setOrgId(data.id);
      } catch (e) {
        if (alive) setMsg(e?.message || String(e));
      } finally {
        if (alive) setMsg(null);
      }
    })();
    return () => { alive = false; };
  }, [slug]);

  if (msg) return <div style={{ padding: 24 }}>{msg}</div>;
  if (!orgId) return <div style={{ padding: 24 }}>No organization found for this URL.</div>;

  return <OrgHome orgId={orgId} />;
}
