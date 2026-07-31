import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';

function norm(v) {
  return String(v == null ? '' : v).trim().replace(/^0+/, '') || '';
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const alta = String(searchParams.get('alta') || '').trim();
  const prov = norm(searchParams.get('prov') || '');
  if (!alta) return NextResponse.json({ ok: true, existe: false });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('facturas')
    .select('id, prov_no, grupo, empresa')
    .ilike('alta', alta)
    .limit(20);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const filas = data || [];

  if (!prov) {
    return NextResponse.json({ ok: true, existe: filas.length > 0, mismoProveedor: filas.length > 0 });
  }

  const mismo = filas.filter((f) => norm(f.prov_no) === prov);
  const otros = filas.filter((f) => norm(f.prov_no) !== prov);

  return NextResponse.json({
    ok: true,
    existe: mismo.length > 0,
    mismoProveedor: mismo.length > 0,
    otroProveedor: otros.length > 0,
    detalleOtro: otros.length > 0 ? { grupo: otros[0].grupo, empresa: otros[0].empresa } : null,
  });
}
