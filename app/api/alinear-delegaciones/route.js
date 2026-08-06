import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

// Compara cada factura contra la unidad que el IMSS reporta en el 5005.
// Con aplicar=false solo revisa; con aplicar=true corrige y respalda.
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const aplicar = body.aplicar === true;

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc('alinear_delegaciones', { p_aplicar: aplicar });

    if (error) throw error;

    return NextResponse.json({ ok: true, resultado: data });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e && e.message ? e.message : 'Error de servidor.' },
      { status: 500 }
    );
  }
}
