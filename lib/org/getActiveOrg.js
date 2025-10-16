import { headers } from "next/headers";
import { resolveOrgIdFromRequest } from "./resolve";

export async function getActiveOrgId() {
  const h = headers();
  const host = h.get("x-host") || "";
  const path = h.get("x-pathname") || "/";
  return await resolveOrgIdFromRequest(host, path);
}
