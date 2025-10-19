// /middleware.js
import { NextResponse } from "next/server";

export const config = {
  // run everywhere except API
  matcher: ["/((?!api/).*)"],
};

const CANONICAL_HOST = "www.picklepathway.com";

export function middleware(req) {
  const url = req.nextUrl;
  const host = req.headers.get("host") || "";
  const proto = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");

  const env = process.env.VERCEL_ENV || process.env.NODE_ENV || "development";
  const isProd = env === "production";
  const isVercelPreview = host.endsWith(".vercel.app");
  const isLocal = host.startsWith("localhost:");

  // 1) Redirect HTTP -> HTTPS in production (but not for vercel preview/local)
  if (isProd && !isVercelPreview && !isLocal && proto !== "https") {
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
  }

  // 2) Redirect any non-www custom host -> www.picklepathway.com in production
  //    (skip vercel preview/local)
  const isNonWwwCustom =
    isProd &&
    !isVercelPreview &&
    !isLocal &&
    host !== CANONICAL_HOST;

  if (isNonWwwCustom) {
    url.hostname = CANONICAL_HOST;
    // preserve path/search
    return NextResponse.redirect(url, 308);
  }

  // 3) Optional: preview-only Basic Auth for /admin (not in prod)
  if (url.pathname.startsWith("/admin") && !isProd) {
    const header = req.headers.get("authorization") || "";
    const [type, creds] = header.split(" ");
    let user = "", pass = "";
    if (type === "Basic" && creds) {
      try {
        const decoded =
          typeof atob === "function" ? atob(creds) : Buffer.from(creds, "base64").toString("utf8");
        [user, pass] = decoded.split(":");
      } catch {}
    }
    const ok = user === "admin" && !!process.env.ADMIN_PASSWORD && pass === process.env.ADMIN_PASSWORD;
    if (!ok) {
      return new NextResponse("Unauthorized", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="Admin (preview only)"' },
      });
    }
  }

  return NextResponse.next();
}
