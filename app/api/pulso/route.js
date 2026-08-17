import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const dias = Math.min(180, Math.max(7, parseInt(searchParams.get('dias') || '30', 10)));

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc('pulso_operativo', { p_dias: dias });
    if (error) throw error;

    return NextResponse.json({ ok: true, pulso: data });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e && e.message ? e.message : 'Error de servidor.' },
      { status: 500 }
    );
  }
}
