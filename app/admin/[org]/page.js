// /app/admin/[org]/page.js
import OrgHome from "./OrgHome";
// ⬇️ use relative import instead of "@/lib/..."
import { getActiveOrgId } from "../../../lib/org/getActiveOrg";

export default async function OrgLandingPage() {
  const orgId = await getActiveOrgId();
  if (!orgId) return <div style={{ padding: 24 }}>No organization found for this URL.</div>;
  return <OrgHome orgId={orgId} />;
}
