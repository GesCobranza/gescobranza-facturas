import { NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Lista blanca: todo queda protegido salvo lo que aparece aqui.
// /portal y /api/portal tienen que quedar fuera porque los clientes entran sin
// la cookie interna -- cada ruta de portal valida su propia clave del lado del
// servidor con validarClavePortal.
// ---------------------------------------------------------------------------
const RUTAS_SIN_PROTEGER = [
  '/portal',
  '/api/portal',
  '/acceso-interno',
  '/api/acceso-interno',
  '/direccion',      // tiene su propia clave, validada en /api/pulso
  '/api/pulso',      // valida la clave del grupo __direccion__ en el servidor
  '/icon.svg',
  '/logo_full_horizontal.svg',
  '/logo_icon.svg',
];

// ---------------------------------------------------------------------------
// VERIFICACION DE LA COOKIE FIRMADA
//
// La cookie trae  <expira>.<firma>.  Se recalcula el HMAC de <expira> con
// SECRETO_SESION y se compara: si no coincide, el valor fue inventado. Antes
// bastaba con escribir acceso_interno=ok para entrar, y ese texto estaba a la
// vista en el repositorio.
//
// Tambien se revisa la fecha: la sesion caduca aunque la firma sea buena.
// ---------------------------------------------------------------------------
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

async function sesionValida(valor) {
  if (!valor) return false;
  const secreto = process.env.SECRETO_SESION;
  if (!secreto) return false; // sin llave no se valida nada: se niega el paso

  const partes = String(valor).split('.');
  if (partes.length !== 2) return false;

  const expira = parseInt(partes[0], 10);
  if (!expira || Number.isNaN(expira)) return false;
  if (Date.now() > expira) return false; // caducada

  const esperada = await firmar(partes[0], secreto);
  if (esperada.length !== partes[1].length) return false;

  // Comparacion de largo constante: no revela por donde difiere
  let dif = 0;
  for (let i = 0; i < esperada.length; i += 1) {
    dif |= esperada.charCodeAt(i) ^ partes[1].charCodeAt(i);
  }
  return dif === 0;
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  if (RUTAS_SIN_PROTEGER.some((r) => pathname === r || pathname.startsWith(r + '/'))) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get('acceso_interno');
  if (await sesionValida(cookie?.value)) {
    return NextResponse.next();
  }

  // Las rutas de API responden 401 en vez de redirigir: una redireccion a una
  // pantalla de login no le sirve a una peticion de datos, y ademas devolveria
  // 200 con HTML, que confunde al que la llama.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ ok: false, error: 'Sesión no válida o expirada.' }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = '/acceso-interno';
  url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
