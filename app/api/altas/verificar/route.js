import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

// Quita caracteres invisibles que se pegan al copiar desde Word o PDF
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

    // El 5005 es la fuente: dice el proveedor, el importe y la unidad de cada alta
    const { data: filas5005, error: err5005 } = await supabase
      .from('raw_5005')
      .select('alta, proveedor, importe, comprobante, un_ap')
      .eq('alta', alta)
      .limit(20);

    if (err5005) throw err5005;

    let crudas = filas5005 || [];
    if (crudas.length === 0) {
      const { data: d2 } = await supabase
        .from('raw_5005')
        .select('alta, proveedor, importe, comprobante, un_ap')
        .ilike('alta', '%' + alta.replace(/^0+/, ''))
        .limit(20);
      crudas = (d2 || []).filter((f) => norm(f.alta) === norm(alta));
    }

    if (crudas.length === 0) {
      return NextResponse.json({ ok: true, formatoOk, encontrada: false, candidatos: [] });
    }

    const [{ data: empresas }, { data: delegs }] = await Promise.all([
      supabase.from('catalogo_empresas').select('numero, nombre, grupo').limit(2000),
      supabase.from('catalogo_delegaciones').select('nombre, un_imss').limit(200),
    ]);

    // Una delegación puede cubrir varias unidades (ej. "35,36")
    function delegacionDe(unAp) {
      const u = norm(unAp);
      const lista = delegs || [];
      for (const d of lista) {
        const partes = String(d.un_imss || '').split(',').map((x) => norm(x));
        if (partes.indexOf(u) !== -1) return d.nombre;
      }
      return null;
    }

    // El IMSS reutiliza altas entre ejercicios, así que puede haber varios candidatos
    const vistos = {};
    const candidatos = [];
    for (const f of crudas) {
      const provNorm = norm(f.proveedor);
      const clave = provNorm + '|' + norm(f.un_ap) + '|' + Number(f.importe || 0).toFixed(2);
      if (vistos[clave]) continue;
      vistos[clave] = true;

      const emp = (empresas || []).find((e) => norm(e.numero) === provNorm);
      candidatos.push({
        alta: f.alta,
        provNo: f.proveedor,
        provNorm: provNorm,
        importe: Number(f.importe || 0),
        comprobante: f.comprobante || '',
        unAp: f.un_ap || '',
        delegacion: delegacionDe(f.un_ap),
        empresa: emp ? emp.nombre : null,
        grupo: emp ? emp.grupo : null,
        numeroCatalogo: emp ? emp.numero : null,
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
