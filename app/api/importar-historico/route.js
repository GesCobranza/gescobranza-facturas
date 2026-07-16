import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

export async function POST(request) {
  const body = await request.json();
  const filas = Array.isArray(body.filas) ? body.filas : [];
  if (filas.length === 0) {
    return NextResponse.json({ ok: false, error: 'No se recibieron filas para importar.' });
  }

  const supabase = getSupabaseAdmin();

  const { data: delegacionesData, error: errDeleg } = await supabase.from('catalogo_delegaciones').select('*');
  if (errDeleg) return NextResponse.json({ ok: false, error: errDeleg.message }, { status: 500 });
  const delegMap = {};
  delegacionesData.forEach((d) => { delegMap[d.nombre] = d.codigo.split(','); });

  const { data: existentesData, error: errExist } = await supabase.from('facturas').select('alta');
  if (errExist) return NextResponse.json({ ok: false, error: errExist.message }, { status: 500 });
  const altasExistentes = new Set(existentesData.map((f) => String(f.alta).toLowerCase()));

  const paraInsertar = [];
  const omitidas = [];
  const altasEnEsteArchivo = new Set();

  filas.forEach((f, idx) => {
    const grupo = String(f.grupo || '').trim();
    const empresa = String(f.empresa || '').trim();
    const delegacion = String(f.delegacion || '').trim();
    const alta = String(f.alta || '').trim();
    const importe = Number(f.importe);
    const capturista = String(f.capturista || '').trim() || 'Importación histórica';
    const fechaRecepcion = f.fechaRecepcion || null;
    const provNo = String(f.provNo || '').trim();
    const pdf = String(f.pdf || alta).trim();

    if (!grupo || !empresa || !delegacion || !alta || !importe || importe <= 0) {
      omitidas.push({ fila: idx + 2, alta: alta || '(sin alta)', motivo: 'Faltan datos obligatorios (grupo, empresa, delegación, alta o importe).' });
      return;
    }
    if (altasExistentes.has(alta.toLowerCase())) {
      omitidas.push({ fila: idx + 2, alta, motivo: 'Ese número de alta ya existía en el sistema antes de esta importación.' });
      return;
    }
    if (altasEnEsteArchivo.has(alta.toLowerCase())) {
      omitidas.push({ fila: idx + 2, alta, motivo: 'Número de alta repetido dentro de este mismo archivo.' });
      return;
    }
    const codigos = delegMap[delegacion];
    if (!codigos) {
      omitidas.push({ fila: idx + 2, alta, motivo: `La delegación "${delegacion}" no existe en tu catálogo — revisa el nombre exacto.` });
      return;
    }
    if (!codigos.some((c) => alta.startsWith(c))) {
      omitidas.push({ fila: idx + 2, alta, motivo: `El alta no coincide con el código de "${delegacion}" (esperado: ${codigos.join(' o ')}).` });
      return;
    }

    altasEnEsteArchivo.add(alta.toLowerCase());
    paraInsertar.push({
      grupo, empresa, delegacion, pdf, num_factura: pdf,
      prov_no: provNo || null, prov_nombre: empresa,
      alta, importe, capturista,
      fecha_recepcion: fechaRecepcion,
      tiene_cr: false,
    });
  });

  if (paraInsertar.length > 0) {
    const { error: errInsert } = await supabase.from('facturas').insert(paraInsertar);
    if (errInsert) return NextResponse.json({ ok: false, error: errInsert.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    insertadas: paraInsertar.length,
    omitidas: omitidas.length,
    detalleOmitidas: omitidas,
  });
}
