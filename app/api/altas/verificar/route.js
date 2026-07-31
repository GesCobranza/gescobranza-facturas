import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

function limpiar(v) {
  return String(v == null ? '' : v)
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, '')
    .trim();
}

function norm(v) {
  return limpiar(v).replace(/^0+/, '') || '0';
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const alta = limpiar(searchParams.get('alta'));

    if (!alta) {
      return NextResponse.json({ ok: false, error: 'Falta el alta.' }, { status: 400 });
    }

    const formatoOk = /^[0-9]{6}-[0-9]{6}$/.test(alta);

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('raw_5005')
      .select('alta, proveedor, importe, comprobante')
      .eq('alta', alta)
      .limit(10);

    if (error) throw error;

    let filas = data || [];

    if (filas.length === 0) {
      const { data: d2 } = await supabase
        .from('raw_5005')
        .select('alta, proveedor, importe, comprobante')
        .ilike('alta', '%' + alta.replace(/^0+/, ''))
        .limit(10);
      filas = (d2 || []).filter((f) => norm(f.alta) === norm(alta));
    }

    if (filas.length === 0) {
      return NextResponse.json({ ok: true, formatoOk, encontrada: false, candidatos: [] });
    }

    const candidatos = [];
    for (const f of filas) {
      const provNorm = norm(f.proveedor);
      const { data: emp } = await supabase
        .from('catalogo_empresas')
        .select('numero, nombre, grupo')
        .limit(1000);
      const match = (emp || []).find((e) => norm(e.numero) === provNorm);
      candidatos.push({
        alta: f.alta,
        provNo: f.proveedor,
        provNorm: provNorm,
        importe: f.importe,
        comprobante: f.comprobante || '',
        empresa: match ? match.nombre : null,
        grupo: match ? match.grupo : null,
        numeroCatalogo: match ? match.numero : null,
      });
    }

    return NextResponse.json({
      ok: true,
      formatoOk,
      encontrada: true,
      ambigua: candidatos.length > 1,
      candidatos: candidatos,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e && e.message ? e.message : 'Error de servidor.' },
      { status: 500 }
    );
  }
}
