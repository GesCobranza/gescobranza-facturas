import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

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

    return new NextResponse(JSON.stringify({ ok: true, pulso: data }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e && e.message ? e.message : 'Error de servidor.' },
      { status: 500 }
    );
  }
}
