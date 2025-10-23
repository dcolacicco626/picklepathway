// middleware.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const config = {
  // run for everything except API routes and static assets
  matcher: ["/((?!api/|_next/|static/|favicon.ico).*)"],
};

const CANONICAL_HOST = "www.picklepathway.com";

function isPreviewOrLocal(host, env) {
  const isVercelPreview = host.endsWith(".vercel.app");
  const isLocal = host.startsWith("localhost:") || host.startsWith("127.0.0.1:");
  const isDev = env !== "production";
  return isVercelPreview || isLocal || isDev;
}

export async function middleware(req) {
  const url = req.nextUrl;
  const host = (req.headers.get("host") || "").toLowerCase();
  const proto = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  const env = process.env.VERCEL_ENV || process.env.NODE_ENV || "development";
  const previewOrLocal = isPreviewOrLocal(host, env);

  // 1) Force HTTPS in production (but not for preview/local)
  if (env === "production" && !previewOrLocal && proto !== "https") {
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
  }

  // 2) Resolve custom domain -> org and set cookie
  //    Skip on preview/local to keep DX fast.
  let orgIdToSet = null;

  if (!previewOrLocal) {
    try {
      // If host is your canonical app domain, we don't change org cookie here.
      if (host !== CANONICAL_HOST) {
        const supa = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          { global: { headers: { "X-App-Env": env } } }
        );

        // Query the public view of verified sites
        const { data, error } = await supa
          .from("sites_public")
          .select("org_id")
          .eq("host", host)
          .maybeSingle();

        if (!error && data?.org_id) {
          orgIdToSet = String(data.org_id);
        }
      }
    } catch {
      // noop; don't block navigation if supabase edge call fails
    }
  }

  const res = NextResponse.next();

  // If we found a mapping, set cookie for downstream routes (SSR, API reads)
  if (orgIdToSet) {
    res.cookies.set("org_id", orgIdToSet, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: env === "production",
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });
  }

  return res;
}
