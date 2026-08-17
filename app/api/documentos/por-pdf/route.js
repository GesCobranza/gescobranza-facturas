import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

// Abre el PDF de una factura a partir del número de susceptible.
// Un susceptible puede amparar varias facturas, así que el archivo suele
// llamarse con todos los folios juntos: se busca por coincidencia.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const pdf = String(searchParams.get('pdf') || '').trim();
    if (!pdf) {
      return NextResponse.json({ ok: false, error: 'Falta el número de susceptible.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Primero el nombre exacto, luego el que lo contenga
    let doc = null;
    const { data: exacto } = await supabase
      .from('documentos')
      .select('id, storage_path, nombre_original')
      .or(`nombre_original.eq.${pdf}.pdf,nombre_original.eq.${pdf}`)
      .limit(1);
    if (exacto && exacto.length > 0) doc = exacto[0];

    if (!doc) {
      const { data: parcial } = await supabase
        .from('documentos')
        .select('id, storage_path, nombre_original')
        .ilike('nombre_original', '%' + pdf + '%')
        .order('fecha_subida', { ascending: false })
        .limit(1);
      if (parcial && parcial.length > 0) doc = parcial[0];
    }

    if (!doc) {
      return NextResponse.json({ ok: false, error: 'No se ha subido el PDF de este susceptible.' }, { status: 404 });
    }

    const { data, error } = await supabase.storage
      .from('documentos')
      // Una hora: el enlace se guardaba en caché y expiraba antes de abrirlo
      .createSignedUrl(doc.storage_path, 3600);
    if (error) throw error;

    return new NextResponse(JSON.stringify({ ok: true, url: data.signedUrl, nombre: doc.nombre_original }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e && e.message ? e.message : 'Error de servidor.' },
      { status: 500 }
    );
  }
}
