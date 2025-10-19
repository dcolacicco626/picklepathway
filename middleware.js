// /middleware.js
import { NextResponse } from "next/server";

// Only evaluate middleware on /admin; keep /, /l/*, and all /api/* untouched.
export const config = {
  matcher: ["/admin/:path*"],
};

export function middleware(req) {
  // Double-guard: never intercept API calls
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // In production: do not use Basic Auth. Let your app's Supabase auth handle /admin.
  const env = process.env.VERCEL_ENV || process.env.NODE_ENV;
  const isPreview = env !== "production";
  if (!isPreview) {
    return NextResponse.next();
  }

  // In preview/dev: optional Basic Auth to keep the admin area private
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

  return NextResponse.next();
}
