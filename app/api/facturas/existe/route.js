import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const alta = String(searchParams.get('alta') || '').trim();
  if (!alta) return NextResponse.json({ ok: true, existe: false });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('facturas').select('id').ilike('alta', alta).limit(1);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, existe: (data || []).length > 0 });
}
