// /middleware.js
import { NextResponse } from "next/server";

export const config = { matcher: ["/", "/l/:path*"] };

export function middleware(req) {
  // Only runs for "/" and "/l/*"
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
      headers: { "WWW-Authenticate": 'Basic realm="Restricted"' },
    });
  }
  return NextResponse.next();
}
