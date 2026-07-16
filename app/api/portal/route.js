import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

export async function POST(request) {
  const body = await request.json();
  const grupo = String(body.grupo || '').trim();
  const clave = String(body.clave || '').trim();

  if (!grupo || !clave) {
    return NextResponse.json({ ok: false, error: 'Grupo o clave incorrectos.' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  const { data: claveRow, error: errClave } = await supabase
    .from('claves_portal')
    .select('*')
    .eq('grupo', grupo)
    .maybeSingle();

  if (errClave) {
    return NextResponse.json({ ok: false, error: 'Error de servidor.' }, { status: 500 });
  }

  if (!claveRow || claveRow.clave !== clave) {
    return NextResponse.json({ ok: false, error: 'Grupo o clave incorrectos.' }, { status: 401 });
  }

  const { data: facturas, error: errFact } = await supabase
    .from('facturas')
    .select('id, alta, grupo, empresa, delegacion, importe, tiene_cr, comprobante, alerta_importe, fecha_captura')
    .eq('grupo', grupo)
    .order('fecha_captura', { ascending: false });

  if (errFact) {
    return NextResponse.json({ ok: false, error: 'Error de servidor.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, facturas });
}
