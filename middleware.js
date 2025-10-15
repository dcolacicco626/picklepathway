import { NextResponse } from 'next/server';

export function middleware(req) {
  const { pathname } = req.nextUrl;
  const needsAuth = pathname === '/' || pathname.startsWith('/l/');

  if (!needsAuth) return NextResponse.next();

  const header = req.headers.get('authorization') || '';
  const [type, creds] = header.split(' ');
  const [user, pass] = type === 'Basic' ? atob(creds || '').split(':') : [];

  if (user === 'admin' && pass === process.env.ADMIN_PASSWORD) {
    return NextResponse.next();
  }

  return new NextResponse('Unauthorized', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Restricted"' },
  });
}

// If you also want /timer protected, include it.
export const config = { matcher: ['/', '/l/:path*'] };
