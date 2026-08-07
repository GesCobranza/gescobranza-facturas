import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';

// Extrae secuencias de dígitos del nombre del archivo, de la más larga a la más corta,
// para intentar encontrar cuál coincide con un folio de PDF/susceptible ya conocido.
function extraerCandidatosFolio(nombre) {
  const matches = nombre.match(/\d{3,}/g) || [];
  return [...new Set(matches)].sort((a, b) => b.length - a.length);
}

export async function POST(request) {
  const body = await request.json();
  const archivos = Array.isArray(body.archivos) ? body.archivos : [];
  const subidoPor = body.subidoPor || null;
  if (archivos.length === 0) return NextResponse.json({ ok: false, error: 'No se recibieron archivos.' });

  const supabase = getSupabaseAdmin();
  const resultado = [];

  for (const a of archivos) {
    const path = a.path;
    const nombreOriginal = a.nombreOriginal || 'archivo.pdf';
    let folioDetectado = null, grupo = null, delegacion = null, identificado = false;

    const candidatos = extraerCandidatosFolio(nombreOriginal);
    for (const c of candidatos) {
      const { data: coincidencia } = await supabase
        .from('facturas')
        .select('grupo, delegacion, pdf')
        // El susceptible puede traer varios folios en un solo nombre
        // (ej. 1107155-1107154-1107637), así que se busca el número dentro del campo.
        .ilike('pdf', `%${c}%`)
        .limit(1)
        .maybeSingle();
      if (coincidencia) {
        folioDetectado = c;
        grupo = coincidencia.grupo;
        delegacion = coincidencia.delegacion;
        identificado = true;
        break;
      }
    }

    const { error: errIns } = await supabase.from('documentos').insert({
      storage_path: path,
      nombre_original: nombreOriginal,
      folio_detectado: folioDetectado,
      grupo,
      delegacion,
      identificado,
      subido_por: subidoPor,
    });
    if (errIns) return NextResponse.json({ ok: false, error: errIns.message }, { status: 500 });

    resultado.push({ nombreOriginal, identificado, folioDetectado, grupo, delegacion });
  }

  return NextResponse.json({ ok: true, resultado });
}
