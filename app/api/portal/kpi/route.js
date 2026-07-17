import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { validarClavePortal } from '../../../../lib/portalAuth';

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

  const { data, error } = await supabase.rpc('kpi_dashboard', {
    p_grupo: grupo, // siempre el grupo YA AUTENTICADO, nunca uno enviado libremente por el cliente
    p_delegacion: delegacion,
    p_provno: provNo,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // Se quita "por_grupo" a propósito — el portal es de un solo grupo, no tiene sentido mostrarlo y evita cualquier riesgo de fuga
  const { por_grupo, ...kpiSeguro } = data;
  return NextResponse.json({ ok: true, ...kpiSeguro });
}
