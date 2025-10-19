// /middleware.js
import { NextResponse } from "next/server";

export const config = {
  matcher: ["/((?!api/).*)"], // runs everywhere except /api/*
};

export function middleware(req) {
  const url = req.nextUrl;
  const host = req.headers.get("host") || "";

  // --- 1) Force www in production ---
  const isProd = (process.env.VERCEL_ENV || process.env.NODE_ENV) === "production";
  const isVercelPreview = host.endsWith(".vercel.app");
  const isLocalhost = host.startsWith("localhost:");
  const onApex = host === "picklepathway.com";

  if (isProd && !isVercelPreview && !isLocalhost && onApex) {
    url.hostname = "www.picklepathway.com";
    return NextResponse.redirect(url, 308);
  }

  // --- 2) Optional: Basic Auth for /admin in preview/dev ---
  if (url.pathname.startsWith("/admin")) {
    const isPreview = !isProd;
    if (isPreview) {
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
  }

  return NextResponse.next();
}
