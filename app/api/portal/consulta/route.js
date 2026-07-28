import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { validarClavePortal } from '../../../../lib/portalAuth';

// Se consulta la vista facturas_cr (facturas + detalle institucional del contra recibo)
const COLUMNAS_SEGURAS =
  'id, alta, grupo, empresa, delegacion, importe, tiene_cr, comprobante, alerta_importe, fecha_captura, prov_no, prov_no_norm, num_factura, cr_fecha_emision, cr_fecha_prog_pago, cr_fecha_pago, cr_referencia_pago, cr_banco, cr_fuente';

// Quita ceros a la izquierda para que "0000146440" y "146440" sean el mismo proveedor
function normalizarProvNo(valor) {
  const limpio = String(valor || '').trim().replace(/^0+/, '');
  return limpio || '0';
}

// Convierte las columnas planas cr_* en un objeto cr, como lo espera el portal
function darForma(filas) {
  return (filas || []).map((f) => {
    const salida = {
      id: f.id,
      alta: f.alta,
      grupo: f.grupo,
      empresa: f.empresa,
      delegacion: f.delegacion,
      importe: f.importe,
      tiene_cr: f.tiene_cr,
      comprobante: f.comprobante,
      alerta_importe: f.alerta_importe,
      fecha_captura: f.fecha_captura,
      prov_no: f.prov_no,
      num_factura: f.num_factura,
    };
    if (f.cr_fuente) {
      salida.cr = {
        fecha_emision: f.cr_fecha_emision,
        fecha_prog_pago: f.cr_fecha_prog_pago,
        fecha_pago: f.cr_fecha_pago,
        referencia_pago: f.cr_referencia_pago,
        banco: f.cr_banco,
        fuente: f.cr_fuente,
      };
    }
    return salida;
  });
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
  const estatus = body.estatus || null; // con_cr | sin_cr | programado | pagado | sin_detalle
  const orden = body.orden || 'reciente';
  const busqueda = String(body.busqueda || '').trim();
  const exportar = body.exportar === true;
  const emisionDesde = body.emisionDesde || null;
  const emisionHasta = body.emisionHasta || null;
  const incluirSinCr = body.incluirSinCr !== false;

  function construirQuery() {
    // .eq('grupo', grupo) siempre con el grupo YA AUTENTICADO — nunca uno enviado libremente por el navegador
    let q = supabase.from('facturas_cr').select(COLUMNAS_SEGURAS, { count: 'exact' }).eq('grupo', grupo);

    if (orden === 'importe_desc') q = q.order('importe', { ascending: false });
    else if (orden === 'importe_asc') q = q.order('importe', { ascending: true });
    else q = q.order('fecha_captura', { ascending: false });

    if (delegacion) q = q.eq('delegacion', delegacion);
    if (provNo) q = q.eq('prov_no_norm', normalizarProvNo(provNo));

    if (estatus === 'con_cr') q = q.eq('tiene_cr', true);
    else if (estatus === 'sin_cr') q = q.eq('tiene_cr', false);
    else if (estatus === 'programado') q = q.eq('tiene_cr', true).eq('cr_fuente', '1003');
    else if (estatus === 'pagado') q = q.eq('tiene_cr', true).eq('cr_fuente', '4004');
    else if (estatus === 'sin_detalle') q = q.eq('tiene_cr', true).is('cr_fuente', null);

    if (emisionDesde || emisionHasta) {
      const partes = [];
      if (emisionDesde) partes.push('cr_fecha_emision.gte.' + emisionDesde);
      if (emisionHasta) partes.push('cr_fecha_emision.lte.' + emisionHasta);
      if (incluirSinCr) {
        const cond = partes.length > 1 ? 'and(' + partes.join(',') + ')' : partes[0];
        q = q.or(cond + ',tiene_cr.is.false');
      } else {
        if (emisionDesde) q = q.gte('cr_fecha_emision', emisionDesde);
        if (emisionHasta) q = q.lte('cr_fecha_emision', emisionHasta);
      }
    }

    if (busqueda) {
      const esc = busqueda.replace(/[%_]/g, '\\$&');
      q = q.or(`alta.ilike.%${esc}%,num_factura.ilike.%${esc}%`);
    }
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
    const salida = darForma(todas);
    return NextResponse.json({ ok: true, facturas: salida, total: salida.length });
  }

  const pagina = Math.max(1, parseInt(body.pagina || 1, 10));
  const porPagina = Math.min(200, Math.max(10, parseInt(body.porPagina || 50, 10)));
  const desde = (pagina - 1) * porPagina;

  const { data, error, count } = await construirQuery().range(desde, desde + porPagina - 1);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, facturas: darForma(data), total: count, pagina, porPagina });
}
