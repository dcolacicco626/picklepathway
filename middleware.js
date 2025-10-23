// /middleware.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { createClient as createSupabaseAnon } from "@supabase/supabase-js";

export const config = {
  // IMPORTANT: include /api so API routes can see Supabase session cookies
  // and exclude only static assets/images/icons
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

const CANONICAL_HOST = "www.picklepathway.com";

function isPreviewOrLocal(host, env) {
  const isVercelPreview = host.endsWith(".vercel.app");
  const isLocal =
    host.startsWith("localhost:") || host.startsWith("127.0.0.1:");
  const isDev = env !== "production";
  return isVercelPreview || isLocal || isDev;
}

export async function middleware(req) {
  const url = req.nextUrl;
  const host = (req.headers.get("host") || "").toLowerCase();
  const proto = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  const env = process.env.VERCEL_ENV || process.env.NODE_ENV || "development";
  const previewOrLocal = isPreviewOrLocal(host, env);

  // 0) Ensure Supabase session cookies are synced for EVERY request (pages + API)
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  // This call refreshes/attaches auth cookies to the response if needed
  await supabase.auth.getSession();

  // 1) Force HTTPS in production (but not for preview/local)
  if (env === "production" && !previewOrLocal && proto !== "https") {
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
  }

  // 2) Custom domain → org mapping (keep your existing behavior)
  //    If you're on a non-canonical host (e.g., club custom domain),
  //    map host → org and set cookies so SSR/API can resolve the org.
  let mappedOrgId = null;

  if (!previewOrLocal && host !== CANONICAL_HOST) {
    try {
      const supaAnon = createSupabaseAnon(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        { global: { headers: { "X-App-Env": env } } }
      );

      const { data } = await supaAnon
        .from("sites_public")
        .select("org_id")
        .eq("host", host)
        .maybeSingle();

      if (data?.org_id) mappedOrgId = String(data.org_id);
    } catch {
      // don't block navigation on mapping failures
    }
  }

  // 3) If we found a mapping, set BOTH cookies for compatibility
  if (mappedOrgId) {
    const cookieOpts = {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: env === "production",
      maxAge: 60 * 60 * 24 * 365, // 1 year
    };
    // New standard:
    res.cookies.set("active_org", mappedOrgId, cookieOpts);
    // Backward compat:
    res.cookies.set("org_id", mappedOrgId, cookieOpts);
  }

  return res;
}
