import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { validarClavePortal } from '../../../lib/portalAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

// ---------------------------------------------------------------------------
// El tablero de direccion trae ingresos, productividad del equipo y la cartera
// completa. Antes esta ruta NO pedia ninguna clave: la pantalla la comparaba en
// el navegador y luego solicitaba los datos sin credencial, asi que cualquiera
// que conociera la URL los recibia.
//
// Ahora la clave viaja en el cuerpo de un POST y se valida contra la base con
// validarClavePortal, el mismo mecanismo que ya protege los portales de cliente.
// El grupo __direccion__ vive en claves_portal.
//
// Se deja POST en lugar de GET a proposito: asi la clave no queda escrita en la
// URL, ni en el historial del navegador, ni en los registros del servidor.
// ---------------------------------------------------------------------------

const GRUPO_DIRECCION = '__direccion__';

async function resolver(clave, dias, desde, hasta) {
  const supabase = getSupabaseAdmin();

  const auth = await validarClavePortal(supabase, GRUPO_DIRECCION, String(clave || '').trim());
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const d = Math.min(365, Math.max(1, parseInt(dias || '30', 10)));

  const { data, error } = await supabase.rpc('pulso_operativo', {
    p_dias: d,
    p_desde: desde || null,
    p_hasta: hasta || null,
  });
  if (error) throw error;

  return new NextResponse(JSON.stringify({ ok: true, pulso: data }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    return await resolver(body.clave, body.dias, body.desde, body.hasta);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e && e.message ? e.message : 'Error de servidor.' },
      { status: 500 }
    );
  }
}

// GET queda cerrado: antes era la puerta abierta. Si alguien entra a
// /api/pulso desde el navegador, ya no recibe datos.
export async function GET() {
  return NextResponse.json(
    { ok: false, error: 'Acceso no válido.' },
    { status: 401 }
  );
}
