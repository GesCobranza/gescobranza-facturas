import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

export async function POST(request) {
  const body = await request.json();
  const filas = body.filas || [];
  const primerBloque = body.primerBloque !== false; // por compatibilidad, default true
  const supabase = getSupabaseAdmin();

  // Solo se borra el 5005 anterior en el primer bloque de la subida — los bloques siguientes se agregan
  if (primerBloque) {
    const { error: errDel } = await supabase.from('raw_5005').delete().not('id', 'is', null);
    if (errDel) return NextResponse.json({ ok: false, error: errDel.message });
  }

  if (filas.length > 0) {
    const { error: errIns } = await supabase.from('raw_5005').insert(filas);
    if (errIns) return NextResponse.json({ ok: false, error: errIns.message });
  }

  return NextResponse.json({ ok: true, cargadas: filas.length });
}
