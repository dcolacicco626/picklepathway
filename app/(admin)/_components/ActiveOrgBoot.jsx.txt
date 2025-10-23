// app/(admin)/_components/ActiveOrgBoot.jsx
"use client";

import { useEffect } from "react";

export default function ActiveOrgBoot() {
  useEffect(() => {
    (async () => {
      try {
        // 1) Do we already have an active org cookie?
        const r = await fetch("/api/admin/active-org", { cache: "no-store" });
        const { orgId } = await r.json();
        if (orgId) return; // nothing to do

        // 2) No cookie → ask your backend who this user belongs to.
        //    If you already have an endpoint that returns memberships, use it.
        //    Here we reuse your existing membership status route.
        const ms = await fetch("/api/membership/status", { cache: "no-store" });
        const data = await ms.json();

        // Try common shapes:
        const candidate =
          data?.orgId ||
          data?.org_id ||
          data?.membership?.org_id ||
          data?.memberships?.[0]?.org_id ||
          null;

        if (!candidate) return; // user may have no orgs yet

        // 3) Set the cookie for subsequent API calls (checkout/portal/etc.)
        await fetch("/api/admin/active-org", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orgId: candidate }),
        });

        // Optional: refresh the page/state so UI picks up the cookie immediately
        // location.reload();
      } catch (_) {
        // ignore; we don't want to block rendering
      }
    })();
  }, []);

  return null;
}
