import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

export async function POST(request) {
  const body = await request.json();
  const filas = body.filas || [];
  const supabase = getSupabaseAdmin();

  // Reemplaza todo el contenido anterior — cada 5005 nuevo trae el histórico completo
  const { error: errDel } = await supabase.from('raw_5005').delete().not('id', 'is', null);
  if (errDel) return NextResponse.json({ ok: false, error: errDel.message });

  if (filas.length > 0) {
    const { error: errIns } = await supabase.from('raw_5005').insert(filas);
    if (errIns) return NextResponse.json({ ok: false, error: errIns.message });
  }

  return NextResponse.json({ ok: true, cargadas: filas.length });
}
