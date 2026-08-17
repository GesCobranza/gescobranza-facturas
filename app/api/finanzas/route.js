import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET: movimientos del mes, configuración y cuentas por cobrar
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const mes = searchParams.get('mes') || new Date().toISOString().slice(0, 7);
    const ini = mes + '-01';
    const [a, m] = mes.split('-').map(Number);
    const fin = new Date(a, m, 0).toISOString().slice(0, 10);

    const supabase = getSupabaseAdmin();

    const [movs, config, porCobrar, historico] = await Promise.all([
      supabase.from('fin_movimientos').select('*').gte('fecha', ini).lte('fecha', fin).order('fecha', { ascending: false }),
      supabase.from('fin_config').select('*'),
      supabase.from('fin_por_cobrar').select('*').eq('cobrado', false).order('fecha_esperada'),
      supabase.from('fin_movimientos').select('tipo, monto'),
    ]);

    if (movs.error) throw movs.error;

    const cfg = {};
    (config.data || []).forEach((c) => { cfg[c.clave] = Number(c.valor || 0); });

    // El saldo actual arranca del inicial y aplica todo lo registrado
    const todos = historico.data || [];
    const saldo = Number(cfg.saldo_inicial || 0)
      + todos.filter((x) => x.tipo === 'ingreso').reduce((s, x) => s + Number(x.monto), 0)
      - todos.filter((x) => x.tipo === 'gasto').reduce((s, x) => s + Number(x.monto), 0)
      - todos.filter((x) => x.tipo === 'ahorro').reduce((s, x) => s + Number(x.monto), 0);

    const ahorroTotal = todos.filter((x) => x.tipo === 'ahorro').reduce((s, x) => s + Number(x.monto), 0);

    return NextResponse.json({
      ok: true,
      mes,
      movimientos: movs.data || [],
      config: cfg,
      porCobrar: porCobrar.data || [],
      saldo,
      ahorroTotal,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e && e.message ? e.message : 'Error de servidor.' }, { status: 500 });
  }
}

// POST: registra un movimiento, o marca una cuenta por cobrar como cobrada
export async function POST(request) {
  try {
    const body = await request.json();
    const supabase = getSupabaseAdmin();

    if (body.accion === 'cobrar' && body.id) {
      const { data: cxc, error: e1 } = await supabase
        .from('fin_por_cobrar')
        .update({ cobrado: true, fecha_cobro: new Date().toISOString().slice(0, 10) })
        .eq('id', body.id)
        .select('concepto, monto')
        .single();
      if (e1) throw e1;

      // Al cobrarse entra como ingreso
      await supabase.from('fin_movimientos').insert({
        tipo: 'ingreso',
        categoria: 'Cobro de préstamo',
        monto: cxc.monto,
        nota: cxc.concepto,
      });
      return NextResponse.json({ ok: true });
    }

    if (body.accion === 'borrar' && body.id) {
      const { error } = await supabase.from('fin_movimientos').delete().eq('id', body.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    const monto = Number(body.monto || 0);
    if (!body.tipo || monto <= 0) {
      return NextResponse.json({ ok: false, error: 'Falta el tipo o el monto.' }, { status: 400 });
    }

    const { error } = await supabase.from('fin_movimientos').insert({
      fecha: body.fecha || undefined,
      tipo: body.tipo,
      categoria: body.categoria || null,
      monto: monto,
      nota: body.nota || null,
    });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e && e.message ? e.message : 'Error de servidor.' }, { status: 500 });
  }
}
