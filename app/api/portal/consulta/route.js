import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { validarClavePortal } from '../../../../lib/portalAuth';

const COLUMNAS_SEGURAS = 'id, alta, grupo, empresa, delegacion, importe, tiene_cr, comprobante, alerta_importe, fecha_captura, prov_no';

// Quita ceros a la izquierda para que "0000146440" y "146440" se reconozcan como el mismo proveedor
function normalizarProvNo(valor) {
  const limpio = String(valor || '').trim().replace(/^0+/, '');
  return limpio || '0';
}

export async function POST(request) {
  const body = await request.json();
  const grupo = String(body.grupo || '').trim();
  const clave = String(body.clave || '').trim();
  if (!grupo || !clave) return NextResponse.json({ ok: false, error: 'Grupo o clave incorrectos.' }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const auth = await validarClavePortal(supabase, grupo, clave);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const delegacion = body.delegacion || null;
  const provNo = body.provNo || null;
  const estatus = body.estatus || null; // 'con_cr' | 'sin_cr' | null
  const exportar = body.exportar === true;

  function construirQuery() {
    // .eq('grupo', grupo) siempre presente y siempre el grupo YA AUTENTICADO — nunca uno enviado libremente por el cliente
    let q = supabase.from('facturas').select(COLUMNAS_SEGURAS, { count: 'exact' }).eq('grupo', grupo).order('fecha_captura', { ascending: false });
    if (delegacion) q = q.eq('delegacion', delegacion);
    if (provNo) q = q.eq('prov_no', normalizarProvNo(provNo));
    if (estatus === 'con_cr') q = q.eq('tiene_cr', true);
    if (estatus === 'sin_cr') q = q.eq('tiene_cr', false);
    return q;
  }

  if (exportar) {
    const PAGINA = 1000;
    let desde = 0;
    let todas = [];
    while (true) {
      const { data, error } = await construirQuery().range(desde, desde + PAGINA - 1);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      todas = todas.concat(data);
      if (data.length < PAGINA) break;
      desde += PAGINA;
    }
    return NextResponse.json({ ok: true, facturas: todas, total: todas.length });
  }

  const pagina = Math.max(1, parseInt(body.pagina || 1, 10));
  const porPagina = Math.min(200, Math.max(10, parseInt(body.porPagina || 50, 10)));
  const desde = (pagina - 1) * porPagina;

  const { data, error, count } = await construirQuery().range(desde, desde + porPagina - 1);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, facturas: data, total: count, pagina, porPagina });
}
