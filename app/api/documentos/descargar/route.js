import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ ok: false, error: 'Falta el id del documento.' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: doc, error: errDoc } = await supabase.from('documentos').select('storage_path, nombre_original').eq('id', id).maybeSingle();
  if (errDoc) return NextResponse.json({ ok: false, error: errDoc.message }, { status: 500 });
  if (!doc) return NextResponse.json({ ok: false, error: 'Documento no encontrado.' }, { status: 404 });

  const { data, error } = await supabase.storage.from('documentos').createSignedUrl(doc.storage_path, 120, { download: doc.nombre_original });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, url: data.signedUrl });
}
