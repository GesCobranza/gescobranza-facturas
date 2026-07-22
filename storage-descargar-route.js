import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path');
  if (!path) return NextResponse.json({ ok: false, error: 'Falta la ruta del archivo.' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage.from('documentos').createSignedUrl(path, 120);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, url: data.signedUrl });
}
