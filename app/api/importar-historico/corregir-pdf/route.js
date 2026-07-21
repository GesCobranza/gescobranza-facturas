import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';

export const maxDuration = 60;

function trocear(arr, tamano) {
  const bloques = [];
  for (let i = 0; i < arr.length; i += tamano) bloques.push(arr.slice(i, i + tamano));
  return bloques;
}

export async function POST(request) {
  const body = await request.json();
  const filas = Array.isArray(body.filas) ? body.filas : [];
  if (filas.length === 0) {
    return NextResponse.json({ ok: false, error: 'No se recibieron filas.' });
  }

  const supabase = getSupabaseAdmin();

  // Candidatas: solo filas que sí traen un PDF real en el archivo
  const candidatas = filas
    .map((f) => ({ alta: String(f.alta || '').trim(), pdf: String(f.pdf || '').trim(), numFactura: String(f.numFactura || '').trim() }))
    .filter((f) => f.alta && f.pdf);

  let corregidas = 0;
  let sinCambios = 0;
  let noEncontradas = 0;

  const bloques = trocear(candidatas, 300);
  for (const bloque of bloques) {
    const altas = bloque.map((f) => f.alta);
    const { data: existentes, error: errSel } = await supabase
      .from('facturas')
      .select('id, alta, pdf, num_factura')
      .in('alta', altas);
    if (errSel) return NextResponse.json({ ok: false, error: errSel.message }, { status: 500 });

    const mapaExistentes = {};
    (existentes || []).forEach((e) => { mapaExistentes[e.alta] = e; });

    for (const f of bloque) {
      const actual = mapaExistentes[f.alta];
      if (!actual) { noEncontradas++; continue; }
      const nuevoPdf = f.pdf;
      const nuevoNumFactura = f.numFactura || nuevoPdf;
      if (String(actual.pdf || '') === nuevoPdf && String(actual.num_factura || '') === nuevoNumFactura) {
        sinCambios++;
        continue;
      }
      const { error: errUpd } = await supabase
        .from('facturas')
        .update({ pdf: nuevoPdf, num_factura: nuevoNumFactura })
        .eq('id', actual.id);
      if (errUpd) return NextResponse.json({ ok: false, error: errUpd.message }, { status: 500 });
      corregidas++;
    }
  }

  return NextResponse.json({ ok: true, corregidas, sinCambios, noEncontradas });
}
