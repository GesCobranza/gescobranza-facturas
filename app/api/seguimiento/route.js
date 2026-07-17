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

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const delegacion = searchParams.get('delegacion') || null;
  const envio = searchParams.get('envio') || null; // 'enviada' | 'noenviada'
  const pagina = Math.max(1, parseInt(searchParams.get('pagina') || '1', 10));
  const porPagina = Math.min(200, Math.max(10, parseInt(searchParams.get('porPagina') || '50', 10)));

  const supabase = getSupabaseAdmin();

  const { data: dash, error: errDash } = await supabase.rpc('seguimiento_dashboard');
  if (errDash) return NextResponse.json({ ok: false, error: errDash.message }, { status: 500 });

  const { data: esperandoRaw, error: errEsp } = await supabase
    .from('facturas')
    .select('*')
    .eq('tiene_cr', false)
    .eq('enviada_gestor', true)
    .order('fecha_envio', { ascending: true })
    .limit(500);
  if (errEsp) return NextResponse.json({ ok: false, error: errEsp.message }, { status: 500 });
  const esperando = await agregarConteoComentarios(supabase, esperandoRaw);

  let query = supabase.from('facturas').select('*', { count: 'exact' }).eq('tiene_cr', false).order('fecha_captura', { ascending: false });
  if (delegacion) query = query.eq('delegacion', delegacion);
  if (envio === 'enviada') query = query.eq('enviada_gestor', true);
  if (envio === 'noenviada') query = query.eq('enviada_gestor', false);
  const desde = (pagina - 1) * porPagina;
  query = query.range(desde, desde + porPagina - 1);
  const { data: filasGestoresRaw, error: errFilas, count } = await query;
  if (errFilas) return NextResponse.json({ ok: false, error: errFilas.message }, { status: 500 });
  const filasGestores = await agregarConteoComentarios(supabase, filasGestoresRaw);

  return NextResponse.json({
    ok: true,
    resumenPorDelegacion: dash.resumen_por_delegacion,
    esperando,
    filasGestores,
    totalFilasGestores: count,
    pagina,
    porPagina,
  });
}
