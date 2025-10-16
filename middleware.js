// /middleware.js
import { NextResponse } from "next/server";

export const config = {
  // 👇 Middleware will ONLY run for these paths.
  matcher: ["/", "/l/:path*"],
};

export function middleware(req) {
  const { pathname } = req.nextUrl;

  // ✅ If we're here, the path matched ("/" or "/l/*").
  // Everything else (like "/admin" or "/admin/...") will NEVER run this file.

  // --- Basic Auth for "/" and "/l/*" ---
  const header = req.headers.get("authorization") || "";
  const [type, creds] = header.split(" ");
  let user = "", pass = "";
  if (type === "Basic" && creds) {
    try {
      // atob exists in the edge runtime; fallback is just in case.
      const decoded =
        typeof atob === "function" ? atob(creds) : Buffer.from(creds, "base64").toString("utf8");
      [user, pass] = decoded.split(":");
    } catch {}
  }

  const ok =
    user === "admin" &&
    !!process.env.ADMIN_PASSWORD &&
    pass === process.env.ADMIN_PASSWORD;

  if (!ok) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Restricted"' },
    });
  }

  // You were also forwarding headers for org resolution;
  // but since this middleware no longer runs for /admin, we don't need to here.
  return NextResponse.next();
}
