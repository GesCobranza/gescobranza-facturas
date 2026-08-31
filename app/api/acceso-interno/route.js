import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// ---------------------------------------------------------------------------
// SESION FIRMADA
//
// Antes la cookie guardaba el texto fijo 'ok'. httpOnly impide que el
// JavaScript de la pagina la lea, pero NO impide que alguien la escriba desde
// las herramientas del navegador o mande la peticion con esa cookie puesta. Y
// el valor estaba a la vista en el repositorio: no habia nada que adivinar.
//
// Ahora la cookie lleva  <expira>.<firma>  donde la firma es un HMAC que solo
// el servidor puede calcular, con la llave SECRETO_SESION que vive en Vercel y
// nunca sale de ahi. Si alguien inventa el valor, la firma no cuadra y el
// middleware lo rechaza. Si cambia la fecha para estirar la sesion, tampoco:
// la fecha es parte de lo que se firma.
// ---------------------------------------------------------------------------

const HORAS_SESION = 12;

async function firmar(texto, secreto) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secreto),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(texto));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(request) {
  const body = await request.json();
  const clave = String(body.clave || '');

  if (!process.env.CLAVE_INTERNA) {
    return NextResponse.json({ ok: false, error: 'El sistema no tiene configurada la clave interna todavía (falta la variable CLAVE_INTERNA en Vercel).' }, { status: 500 });
  }
  if (!process.env.SECRETO_SESION) {
    return NextResponse.json({ ok: false, error: 'Falta la variable SECRETO_SESION en Vercel. Sin ella no se puede firmar la sesión.' }, { status: 500 });
  }
  if (clave !== process.env.CLAVE_INTERNA) {
    return NextResponse.json({ ok: false, error: 'Clave incorrecta.' }, { status: 401 });
  }

  const expira = Date.now() + HORAS_SESION * 60 * 60 * 1000;
  const firma = await firmar(String(expira), process.env.SECRETO_SESION);
  const valor = expira + '.' + firma;

  const res = NextResponse.json({ ok: true });
  res.cookies.set('acceso_interno', valor, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: HORAS_SESION * 60 * 60,
    path: '/',
  });
  return res;
}

// Cerrar sesión: borra la cookie
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set('acceso_interno', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  return res;
}
