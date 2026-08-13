import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { validarClavePortal } from '../../../../lib/portalAuth';

function normalizarProvNo(valor) {
  const limpio = String(valor || '').trim().replace(/^0+/, '');
  return limpio || '0';
}

export async function POST(request) {
  try {
    const body = await request.json();
    const grupo = String(body.grupo || '').trim();
    const clave = String(body.clave || '').trim();

    if (!grupo || !clave) {
      return NextResponse.json({ ok: false, error: 'Grupo o clave incorrectos.' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const auth = await validarClavePortal(supabase, grupo, clave);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const delegacion = body.delegacion ? String(body.delegacion).trim() : null;
    const provNo = body.provNo ? normalizarProvNo(body.provNo) : null;
    const semanas = Math.min(12, Math.max(1, parseInt(body.semanas || 4, 10)));
    const diasAtras = Math.min(365, Math.max(1, parseInt(body.diasAtras || 30, 10)));

    // p_grupo siempre es el grupo YA AUTENTICADO — nunca uno enviado libremente por el navegador
    const { data, error } = await supabase.rpc('calendario_cobranza', {
      p_grupo: grupo,
      p_delegacion: delegacion,
      p_provno: provNo,
      p_semanas: semanas,
      p_dias_atras: diasAtras,
    });

    if (error) throw error;

    return NextResponse.json({ ok: true, calendario: data });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e && e.message ? e.message : 'Error de servidor.' },
      { status: 500 }
    );
  }
}
