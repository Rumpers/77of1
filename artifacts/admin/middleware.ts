import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

/** Routes that require engineering role to access. */
const ENGINEERING_ROUTES = ['/admin/system', '/admin/config', '/admin/migrations'];

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const pathname = nextUrl.pathname;

  // Not authenticated — redirect to sign-in.
  if (!session) {
    const signInUrl = new URL('/auth/signin', req.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Engineering-gated routes: reject non-engineering roles.
  const isEngineeringRoute = ENGINEERING_ROUTES.some((r) => pathname.startsWith(r));
  if (isEngineeringRoute && session.user.role !== 'engineering') {
    return new NextResponse('Forbidden', { status: 403 });
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/admin/:path*'],
};
