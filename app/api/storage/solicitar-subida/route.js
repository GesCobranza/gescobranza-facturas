import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';

// carpeta: 'documentos' o 'comprobantes' — separa los dos tipos de archivo dentro del mismo bucket
export async function POST(request) {
  const body = await request.json();
  const archivos = Array.isArray(body.archivos) ? body.archivos : [];
  const carpeta = body.carpeta === 'comprobantes' ? 'comprobantes' : 'documentos';
  if (archivos.length === 0) return NextResponse.json({ ok: false, error: 'No se recibieron archivos.' });

  const supabase = getSupabaseAdmin();
  const resultado = [];

  for (const a of archivos) {
    const nombreLimpio = String(a.nombre || 'archivo.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${carpeta}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${nombreLimpio}`;
    const { data, error } = await supabase.storage.from('documentos').createSignedUploadUrl(path);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    resultado.push({ nombreOriginal: a.nombre, path, signedUrl: data.signedUrl, token: data.token });
  }

  return NextResponse.json({ ok: true, archivos: resultado });
}
