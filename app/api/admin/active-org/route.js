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

// app/api/admin/active-org/route.js
const isProd = process.env.NODE_ENV === "production";
res.cookies.set("org_id", String(orgId), {
  path: "/",
  httpOnly: true,
  sameSite: "lax",
  secure: isProd,          // <- only secure in prod
  maxAge: 60 * 60 * 24 * 365,
});

  return res;
}
