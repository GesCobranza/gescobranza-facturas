import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const grupo = searchParams.get('grupo') || null;
  const delegacion = searchParams.get('delegacion') || null;
  const provNo = searchParams.get('provNo') || null;
  const estatus = searchParams.get('estatus') || null; // 'con_cr' | 'sin_cr' | null (todos)
  const pagina = Math.max(1, parseInt(searchParams.get('pagina') || '1', 10));
  const porPagina = Math.min(200, Math.max(10, parseInt(searchParams.get('porPagina') || '50', 10)));

  const supabase = getSupabaseAdmin();
  let query = supabase.from('facturas').select('*', { count: 'exact' }).order('fecha_captura', { ascending: false });
  if (grupo) query = query.eq('grupo', grupo);
  if (delegacion) query = query.eq('delegacion', delegacion);
  if (provNo) query = query.eq('prov_no', provNo);
  if (estatus === 'con_cr') query = query.eq('tiene_cr', true);
  if (estatus === 'sin_cr') query = query.eq('tiene_cr', false);

  const desde = (pagina - 1) * porPagina;
  query = query.range(desde, desde + porPagina - 1);

  const { data, error, count } = await query;
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

  // Duplicado
  const { data: existentes, error: errDup } = await supabase
    .from('facturas')
    .select('id')
    .ilike('alta', alta);
  if (errDup) return NextResponse.json({ ok: false, error: errDup.message }, { status: 500 });
  if (existentes && existentes.length > 0) {
    return NextResponse.json({ ok: false, error: 'Ese número de alta ya fue capturado antes — revisa si es duplicado.' });
  }

  // Validación de prefijo contra la delegación elegida
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
