import { NextResponse } from 'next/server';

export async function POST(request) {
  const body = await request.json();
  const clave = String(body.clave || '');

  if (!process.env.CLAVE_INTERNA) {
    return NextResponse.json({ ok: false, error: 'El sistema no tiene configurada la clave interna todavía (falta la variable CLAVE_INTERNA en Vercel).' }, { status: 500 });
  }

  if (clave !== process.env.CLAVE_INTERNA) {
    return NextResponse.json({ ok: false, error: 'Clave incorrecta.' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set('acceso_interno', 'ok', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 días
    path: '/',
  });
  return res;
}
