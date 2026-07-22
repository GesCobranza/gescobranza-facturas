import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function POST(request) {
  const body = await request.json();
  const ids = Array.isArray(body.ids) ? body.ids : [];
  const path = body.path;
  const numeroComprobante = body.numeroComprobante ? String(body.numeroComprobante).trim() : null;

  if (ids.length === 0) return NextResponse.json({ ok: false, error: 'No se seleccionó ninguna factura.' });
  if (!path) return NextResponse.json({ ok: false, error: 'Falta el archivo del comprobante.' });

  const supabase = getSupabaseAdmin();

  const cambios = {
    comprobante_archivo: path,
    tiene_cr: true,
    fecha_cr: new Date().toISOString(),
    alerta_importe: null,
  };
  if (numeroComprobante) cambios.comprobante = numeroComprobante;

  const { error } = await supabase.from('facturas').update(cambios).in('id', ids);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, actualizadas: ids.length });
}
