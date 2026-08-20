import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

async function agregarConteoComentarios(supabase, filas) {
  const ids = filas.filter((f) => f.enviada_gestor).map((f) => f.id);
  if (ids.length === 0) return filas;
  const { data: comentarios } = await supabase
    .from('comentarios_facturas')
    .select('factura_id')
    .in('factura_id', ids);
  const conteo = {};
  (comentarios || []).forEach((c) => { conteo[c.factura_id] = (conteo[c.factura_id] || 0) + 1; });
  return filas.map((f) => ({ ...f, comentarios_count: conteo[f.id] || 0 }));
}

// ---------------------------------------------------------------------------
// Trae la guia y la fecha REAL de salida del paquete de cada factura.
// La fecha que vive en facturas.fecha_envio no sirve para esto: en las filas
// que vinieron de la importacion historica guarda la fecha de la carga, no la
// de salida. La unica confiable es envios.fecha_envio, y solo existe cuando
// hay envio_id.
// ---------------------------------------------------------------------------
async function agregarDatosEnvio(supabase, filas) {
  const ids = [...new Set(filas.map((f) => f.envio_id).filter(Boolean))];
  if (ids.length === 0) {
    return filas.map((f) => ({ ...f, envio_guia: null, envio_fecha: null }));
  }
  const { data: envios } = await supabase
    .from('envios')
    .select('id, guia, fecha_envio')
    .in('id', ids);
  const porId = {};
  (envios || []).forEach((e) => { porId[e.id] = e; });
  return filas.map((f) => {
    const e = f.envio_id ? porId[f.envio_id] : null;
    return {
      ...f,
      envio_guia: e && e.guia ? e.guia : null,
      envio_fecha: e && e.fecha_envio ? e.fecha_envio : null,
    };
  });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const delegacion = searchParams.get('delegacion') || null;
  const envio = searchParams.get('envio') || null; // 'enviada' | 'noenviada'
  const orden = searchParams.get('orden') || 'reciente'; // 'reciente' | 'importe_desc' | 'importe_asc'
  const pagina = Math.max(1, parseInt(searchParams.get('pagina') || '1', 10));
  const porPagina = Math.min(200, Math.max(10, parseInt(searchParams.get('porPagina') || '50', 10)));

  const supabase = getSupabaseAdmin();

  const { data: dash, error: errDash } = await supabase.rpc('seguimiento_dashboard');
  if (errDash) return NextResponse.json({ ok: false, error: errDash.message }, { status: 500 });

  // Resumen de las enviadas sin límite de filas: el bloque `esperando` de abajo
  // solo trae 500, así que los totales por delegación se calculan en la base.
  const { data: espResumen, error: errResumen } = await supabase.rpc('resumen_esperando_cr');
  if (errResumen) return NextResponse.json({ ok: false, error: errResumen.message }, { status: 500 });

  // Respeta el filtro de delegación: sin esto la lista mostraba facturas de otras
  // delegaciones aunque la pantalla dijera estar filtrada.
  let qEsperando = supabase
    .from('facturas')
    .select('*')
    .eq('tiene_cr', false)
    .eq('enviada_gestor', true)
    .order('fecha_envio', { ascending: true })
    .order('id', { ascending: true }) // desempate unico: sin esto el limite corta filas al azar
    .limit(500);
  if (delegacion) qEsperando = qEsperando.eq('delegacion', delegacion);
  const { data: esperandoRaw, error: errEsp } = await qEsperando;
  if (errEsp) return NextResponse.json({ ok: false, error: errEsp.message }, { status: 500 });
  const esperandoConEnvio = await agregarDatosEnvio(supabase, esperandoRaw || []);
  const esperando = await agregarConteoComentarios(supabase, esperandoConEnvio);

  let query = supabase.from('facturas').select('*', { count: 'exact' }).eq('tiene_cr', false);
  if (orden === 'importe_desc') query = query.order('importe', { ascending: false });
  else if (orden === 'importe_asc') query = query.order('importe', { ascending: true });
  else query = query.order('fecha_captura', { ascending: false });

  // -------------------------------------------------------------------------
  // DESEMPATE OBLIGATORIO. No quitar.
  // fecha_captura e importe NO son unicos: las cargas masivas dejan miles de
  // filas con el mismo valor. Postgres no garantiza orden entre empates, y
  // cada pagina de .range() es una consulta nueva que puede devolverlas
  // barajadas distinto: una factura sale repetida en una pagina y AUSENTE en
  // todas. En esta tabla eso significa que nunca se marca como enviada.
  // -------------------------------------------------------------------------
  query = query.order('id', { ascending: true });

  if (delegacion) query = query.eq('delegacion', delegacion);
  if (envio === 'enviada') query = query.eq('enviada_gestor', true);
  if (envio === 'noenviada') query = query.eq('enviada_gestor', false);

  const desde = (pagina - 1) * porPagina;
  query = query.range(desde, desde + porPagina - 1);

  const { data: filasGestoresRaw, error: errFilas, count } = await query;
  if (errFilas) return NextResponse.json({ ok: false, error: errFilas.message }, { status: 500 });
  const filasConEnvio = await agregarDatosEnvio(supabase, filasGestoresRaw || []);
  const filasGestores = await agregarConteoComentarios(supabase, filasConEnvio);

  return NextResponse.json({
    ok: true,
    resumenPorDelegacion: dash.resumen_por_delegacion,
    resumenEsperando: espResumen || [],
    esperando,
    filasGestores,
    totalFilasGestores: count,
    pagina,
    porPagina,
  });
}
