import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

export const dynamic = 'force-dynamic';

function norm(v) {
  return String(v == null ? '' : v).trim().replace(/^0+/, '') || '0';
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const comprobante = (searchParams.get('comprobante') || '').trim();
    const prov = norm(searchParams.get('prov') || '');

    if (!comprobante) {
      return Response.json(
        { ok: false, error: 'Falta el número de contra recibo' },
        { status: 400 }
      );
    }

    let q = supabase
      .from('cr_institucional')
      .select('*')
      .eq('comprobante', comprobante);

    if (prov && prov !== '0') q = q.eq('prov_no_norm', prov);

    const { data: filas, error } = await q.limit(2);
    if (error) throw error;

    if (!filas || filas.length === 0) {
      return Response.json(
        { ok: false, error: 'No hay datos institucionales para este contra recibo' },
        { status: 404 }
      );
    }

    const cr = filas[0];

    const { data: facs } = await supabase
      .from('facturas')
      .select('alta, num_factura, importe, delegacion, grupo, empresa, prov_no')
      .eq('comprobante', comprobante)
      .order('alta');

    const amparadas = (facs || []).filter(
      (f) => norm(f.prov_no) === cr.prov_no_norm
    );

    return Response.json({ ok: true, cr: cr, facturas: amparadas });
  } catch (e) {
    return Response.json(
      { ok: false, error: e && e.message ? e.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}
