import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const grupoFiltro = searchParams.get('grupo') || null;
  const supabase = getSupabaseAdmin();

  let query = supabase.from('facturas').select('*').order('fecha_captura', { ascending: false });
  if (grupoFiltro) query = query.eq('grupo', grupoFiltro);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ facturas: data });
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
    prov_no: provNo,
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
    const ids = body.ids || [];
    if (ids.length === 0) return NextResponse.json({ ok: false, error: 'No hay facturas seleccionadas.' });
    const { error } = await supabase
      .from('facturas')
      .update({ enviada_gestor: true, fecha_envio: new Date().toISOString() })
      .in('id', ids);
    if (error) return NextResponse.json({ ok: false, error: error.message });
    return NextResponse.json({ ok: true, marcados: ids.length });
  }

  if (body.accion === 'quitarEnviada') {
    const { error } = await supabase
      .from('facturas')
      .update({ enviada_gestor: false, fecha_envio: null })
      .eq('id', body.id);
    if (error) return NextResponse.json({ ok: false, error: error.message });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: 'Acción no reconocida.' });
}
