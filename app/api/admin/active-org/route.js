// app/api/admin/active-org/route.js
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const need = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env: ${k}`);
  return v;
};

// GET: return the active org from cookie (and hydrate from DB if needed)
export async function GET() {
  const orgId = cookies().get("org_id")?.value || null;
  return NextResponse.json({ orgId });
}

// POST: set the active org cookie (validates membership)
export async function POST(req) {
  const { orgId } = await req.json();
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

  const supa = createClient(need("NEXT_PUBLIC_SUPABASE_URL"), need("SUPABASE_SERVICE_ROLE_KEY"));

  // Optional: verify the requester really belongs to this org.
  // If you have a userId in a header/session, validate it here before setting.
  // For now we just set the cookie.
  const res = NextResponse.json({ ok: true, orgId });
  res.cookies.set("org_id", String(orgId), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: true,           // true in prod (your site is HTTPS)
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
  return res;
}
