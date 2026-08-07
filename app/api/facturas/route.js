import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

export const maxDuration = 60;

// Quita ceros a la izquierda para que "0000146440" y "146440" se reconozcan como el mismo proveedor
function normalizarProvNo(valor) {
  const limpio = String(valor || '').trim().replace(/^0+/, '');
  return limpio || '0';
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const grupo = searchParams.get('grupo') || null;
  const delegacion = searchParams.get('delegacion') || null;
  const provNo = searchParams.get('provNo') || null;
  const estatus = searchParams.get('estatus') || null; // 'con_cr' | 'sin_cr' | null (todos)
  const conObservacion = searchParams.get('conObservacion') === '1';
  const capturista = searchParams.get('capturista') || null;
  const fechaDesde = searchParams.get('fechaDesde') || null;
  const fechaHasta = searchParams.get('fechaHasta') || null;
  const busqueda = searchParams.get('busqueda') || null;
  const exportar = searchParams.get('exportar') === '1';
  const emisionDesde = searchParams.get('emisionDesde') || null;
  const emisionHasta = searchParams.get('emisionHasta') || null;

  const supabase = getSupabaseAdmin();

  function construirQuery() {
    // Se lee de facturas_cr (facturas + detalle del contra recibo) para poder
    // filtrar por fecha de emisión y mostrar el estatus institucional.
    let q = supabase.from('facturas_cr').select('*', { count: 'exact' }).order('fecha_captura', { ascending: false });
    if (grupo) q = q.eq('grupo', grupo);
    if (delegacion) q = q.eq('delegacion', delegacion);
    if (provNo) q = q.eq('prov_no_norm', normalizarProvNo(provNo));
    if (estatus === 'con_cr') q = q.eq('tiene_cr', true);
    if (estatus === 'sin_cr') q = q.eq('tiene_cr', false);
    if (conObservacion) q = q.not('alerta_importe', 'is', null);
    if (capturista) q = q.eq('capturista', capturista);
    if (fechaDesde) q = q.gte('fecha_captura', fechaDesde + 'T00:00:00');
    if (busqueda) {
      const esc = busqueda.trim().replace(/[%_]/g, '\\$&');
      q = q.or(`alta.ilike.%${esc}%,num_factura.ilike.%${esc}%`);
    }
    if (fechaHasta) q = q.lte('fecha_captura', fechaHasta + 'T23:59:59');
    if (emisionDesde) q = q.gte('cr_fecha_emision', emisionDesde);
    if (emisionHasta) q = q.lte('cr_fecha_emision', emisionHasta);
    return q;
  }

  if (exportar) {
    // Trae TODAS las filas que coincidan con los filtros, sin límite de página (para exportar a Excel)
    const PAGINA = 1000;
    let desde = 0;
    let todas = [];
    while (true) {
      const { data, error } = await construirQuery().range(desde, desde + PAGINA - 1);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      todas = todas.concat(data);
      if (data.length < PAGINA) break;
      desde += PAGINA;
    }
    return NextResponse.json({ facturas: todas, total: todas.length });
  }

  const pagina = Math.max(1, parseInt(searchParams.get('pagina') || '1', 10));
  const porPagina = Math.min(200, Math.max(10, parseInt(searchParams.get('porPagina') || '50', 10)));
  const desde = (pagina - 1) * porPagina;

  const { data, error, count } = await construirQuery().range(desde, desde + porPagina - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ facturas: data, total: count, pagina, porPagina });
}

export async function POST(request) {
  const body = await request.json();
  const supabase = getSupabaseAdmin();

  const alta = String(body.alta || '').trim();
  const pdf = String(body.pdf || '').trim();
  const provNo = body.provNo;
  const importe = Number(body.importe);

  if (!alta || !pdf || !provNo || !importe || importe <= 0) {
    return NextResponse.json({ ok: false, error: 'Completa PDF, empresa, alta e importe (mayor a $0.00).' });
  }

  const { data: existentes, error: errDup } = await supabase
    .from('facturas')
    .select('id')
    .ilike('alta', alta);
  if (errDup) return NextResponse.json({ ok: false, error: errDup.message }, { status: 500 });
  if (existentes && existentes.length > 0) {
    return NextResponse.json({ ok: false, error: 'Ese número de alta ya fue capturado antes — revisa si es duplicado.' });
  }

  const { data: deleg, error: errDeleg } = await supabase
    .from('catalogo_delegaciones')
    .select('*')
    .eq('nombre', body.delegacion)
    .maybeSingle();
  if (errDeleg) return NextResponse.json({ ok: false, error: errDeleg.message }, { status: 500 });
  if (deleg) {
    const codigos = deleg.codigo.split(',');
    const cumple = codigos.some((c) => alta.startsWith(c));
    if (!cumple) {
      return NextResponse.json({
        ok: false,
        error: `El número de alta debe iniciar con ${codigos.join(' o ')} para coincidir con "${deleg.nombre}". No se guardó.`,
      });
    }
  }

  const nuevaFactura = {
    grupo: body.grupo,
    empresa: body.empresa,
    delegacion: body.delegacion,
    pdf,
    num_factura: body.numFactura || pdf,
    prov_no: normalizarProvNo(provNo),
    prov_nombre: body.provNombre,
    alta,
    importe,
    capturista: body.capturista,
    fecha_recepcion: body.fechaRecepcion || null,
  };

  const { error: errInsert } = await supabase.from('facturas').insert(nuevaFactura);
  if (errInsert) return NextResponse.json({ ok: false, error: errInsert.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function PATCH(request) {
  const body = await request.json();
  const supabase = getSupabaseAdmin();

  if (body.accion === 'marcarEnviadas') {
    const ids = Array.isArray(body.ids) ? body.ids : [];
    if (ids.length === 0) return NextResponse.json({ ok: false, error: 'No se recibieron facturas para marcar.' });
    const { error } = await supabase
      .from('facturas')
      .update({ enviada_gestor: true, fecha_envio: new Date().toISOString() })
      .in('id', ids);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.accion === 'quitarEnviada') {
    if (!body.id) return NextResponse.json({ ok: false, error: 'Falta el id de la factura.' });
    const { error } = await supabase
      .from('facturas')
      .update({ enviada_gestor: false, fecha_envio: null })
      .eq('id', body.id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.accion === 'editar') {
    const id = body.id;
    const nuevaAlta = String(body.alta || '').trim();
    const nuevoImporte = Number(body.importe);
    if (!id || !nuevaAlta || !nuevoImporte || nuevoImporte <= 0) {
      return NextResponse.json({ ok: false, error: 'Alta e importe (mayor a $0.00) son obligatorios.' });
    }

    const { data: actual, error: errActual } = await supabase.from('facturas').select('*').eq('id', id).maybeSingle();
    if (errActual) return NextResponse.json({ ok: false, error: errActual.message }, { status: 500 });
    if (!actual) return NextResponse.json({ ok: false, error: 'Esa factura ya no existe.' });

    if (nuevaAlta.toLowerCase() !== String(actual.alta).toLowerCase()) {
      const { data: dup, error: errDup } = await supabase
        .from('facturas')
        .select('id')
        .ilike('alta', nuevaAlta)
        .neq('id', id);
      if (errDup) return NextResponse.json({ ok: false, error: errDup.message }, { status: 500 });
      if (dup && dup.length > 0) {
        return NextResponse.json({ ok: false, error: 'Ya existe otra factura con ese número de alta.' });
      }
    }

    const { data: deleg, error: errDeleg } = await supabase
      .from('catalogo_delegaciones')
      .select('*')
      .eq('nombre', actual.delegacion)
      .maybeSingle();
    if (errDeleg) return NextResponse.json({ ok: false, error: errDeleg.message }, { status: 500 });
    if (deleg) {
      const codigos = deleg.codigo.split(',');
      const cumple = codigos.some((c) => nuevaAlta.startsWith(c));
      if (!cumple) {
        return NextResponse.json({
          ok: false,
          error: `El número de alta debe iniciar con ${codigos.join(' o ')} para coincidir con "${deleg.nombre}" (delegación ya asignada a esta factura). No se guardó.`,
        });
      }
    }

    const { error: errUpdate } = await supabase
      .from('facturas')
      .update({ alta: nuevaAlta, importe: nuevoImporte })
      .eq('id', id);
    if (errUpdate) return NextResponse.json({ ok: false, error: errUpdate.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: 'Acción no reconocida.' });
}
