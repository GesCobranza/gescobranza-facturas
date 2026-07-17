import { NextResponse } from 'next/server';

const RUTAS_SIN_PROTEGER = [
  '/portal',
  '/api/portal',
  '/acceso-interno',
  '/api/acceso-interno',
  '/icon.svg',
  '/logo_full_horizontal.svg',
  '/logo_icon.svg',
];

export function middleware(request) {
  const { pathname } = request.nextUrl;

  if (RUTAS_SIN_PROTEGER.some((r) => pathname === r || pathname.startsWith(r + '/'))) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get('acceso_interno');
  if (cookie?.value === 'ok') {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = '/acceso-interno';
  url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
