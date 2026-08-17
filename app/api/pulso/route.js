import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const dias = Math.min(365, Math.max(1, parseInt(searchParams.get('dias') || '30', 10)));
    const desde = searchParams.get('desde') || null;
    const hasta = searchParams.get('hasta') || null;

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc('pulso_operativo', {
      p_dias: dias,
      p_desde: desde,
      p_hasta: hasta,
    });
    if (error) throw error;

    return NextResponse.json({ ok: true, pulso: data });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e && e.message ? e.message : 'Error de servidor.' },
      { status: 500 }
    );
  }
}
