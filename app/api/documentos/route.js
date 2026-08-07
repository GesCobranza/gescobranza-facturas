import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const folio = searchParams.get('folio') || null;
  const grupo = searchParams.get('grupo') || null;
  const delegacion = searchParams.get('delegacion') || null;
  const identificado = searchParams.get('identificado'); // '1' | '0' | null (todos)
  const pagina = Math.max(1, parseInt(searchParams.get('pagina') || '1', 10));
  const porPagina = Math.min(200, Math.max(10, parseInt(searchParams.get('porPagina') || '50', 10)));

  const supabase = getSupabaseAdmin();
  let q = supabase.from('documentos').select('*', { count: 'exact' }).order('fecha_subida', { ascending: false });
  // Busca también en el nombre del archivo: un PDF con varios folios no queda
  // identificado y sería invisible buscando solo por folio_detectado.
  if (folio) q = q.or(`folio_detectado.ilike.%${folio}%,nombre_original.ilike.%${folio}%`);
  if (grupo) q = q.eq('grupo', grupo);
  if (delegacion) q = q.eq('delegacion', delegacion);
  if (identificado === '1') q = q.eq('identificado', true);
  if (identificado === '0') q = q.eq('identificado', false);

  const desde = (pagina - 1) * porPagina;
  const { data, error, count } = await q.range(desde, desde + porPagina - 1);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, documentos: data, total: count, pagina, porPagina });
}

export async function PATCH(request) {
  const body = await request.json();
  const id = body.id;
  const grupo = body.grupo || null;
  const delegacion = body.delegacion || null;
  if (!id) return NextResponse.json({ ok: false, error: 'Falta el id del documento.' });

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('documentos')
    .update({ grupo, delegacion, identificado: !!(grupo && delegacion) })
    .eq('id', id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ ok: false, error: 'Falta el id del documento.' });

  const supabase = getSupabaseAdmin();
  const { data: doc, error: errDoc } = await supabase.from('documentos').select('storage_path').eq('id', id).maybeSingle();
  if (errDoc) return NextResponse.json({ ok: false, error: errDoc.message }, { status: 500 });
  if (!doc) return NextResponse.json({ ok: false, error: 'Ese documento ya no existe.' });

  const { error: errStorage } = await supabase.storage.from('documentos').remove([doc.storage_path]);
  if (errStorage) return NextResponse.json({ ok: false, error: errStorage.message }, { status: 500 });

  const { error: errDelete } = await supabase.from('documentos').delete().eq('id', id);
  if (errDelete) return NextResponse.json({ ok: false, error: errDelete.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
