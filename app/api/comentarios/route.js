import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const facturaId = searchParams.get('facturaId');
  if (!facturaId) return NextResponse.json({ ok: false, error: 'Falta facturaId.' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('comentarios_facturas')
    .select('*')
    .eq('factura_id', facturaId)
    .order('fecha', { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, comentarios: data });
}

export async function POST(request) {
  const body = await request.json();
  const facturaId = body.facturaId;
  const comentario = String(body.comentario || '').trim();
  if (!facturaId || !comentario) {
    return NextResponse.json({ ok: false, error: 'Falta la factura o el texto del comentario.' });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('comentarios_facturas').insert({ factura_id: facturaId, comentario });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
