// /middleware.js  (update, don’t replace)
import { NextResponse } from "next/server";

export function middleware(req) {
  const { pathname } = req.nextUrl;
  const needsAuth = pathname === "/" || pathname.startsWith("/l/");

  if (needsAuth) {
    const header = req.headers.get("authorization") || "";
    const [type, creds] = header.split(" ");
    const [user, pass] = type === "Basic" ? atob(creds || "").split(":") : [];
    if (user !== "admin" || pass !== process.env.ADMIN_PASSWORD) {
      return new NextResponse("Unauthorized", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="Restricted"' },
      });
    }
  }

  const res = NextResponse.next();
  res.headers.set("x-host", req.headers.get("host") || "");
  res.headers.set("x-pathname", req.nextUrl.pathname);
  return res;
}

export const config = { matcher: ["/", "/l/:path*"] };
