"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import OrgHome from "./OrgHome"; // file should live at app/admin/club/OrgHome.js

export default function ClubAdminPage() {
  const [orgId, setOrgId] = useState(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setMsg("Please sign in to view your club.");
          return;
        }

        // 1) Try user preference
        const { data: pref } = await supabase
          .from("user_prefs")
          .select("active_org_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (pref?.active_org_id) {
          setOrgId(pref.active_org_id);
          return;
        }

        // 2) Fallback to first membership
        const { data: mems, error } = await supabase
          .from("memberships")
          .select("org_id")
          .eq("user_id", user.id);

        if (error) throw error;

        const firstOrgId = Array.isArray(mems) && mems[0]?.org_id;
        if (firstOrgId) {
          setOrgId(firstOrgId);
        } else {
          setMsg("No clubs found for your account yet.");
        }
      } catch (e) {
        setMsg(e?.message || "Failed to load club.");
      }
    })();
  }, []);

  if (!orgId) {
    return <div style={{ padding: 24 }}>{msg || "Loading club…"}</div>;
  }

  return <OrgHome orgId={orgId} />;
}
