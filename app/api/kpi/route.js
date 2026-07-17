import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const grupo = searchParams.get('grupo') || null;
  const delegacion = searchParams.get('delegacion') || null;
  const provNo = searchParams.get('provNo') || null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc('kpi_dashboard', {
    p_grupo: grupo,
    p_delegacion: delegacion,
    p_provno: provNo,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, ...data });
}
