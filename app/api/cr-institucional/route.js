import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();

    if (body.accion === 'vaciar') {
      const { error } = await supabase
        .from('cr_institucional')
        .delete()
        .not('comprobante', 'is', null);
      if (error) throw error;
      return Response.json({ ok: true, mensaje: 'Tabla vaciada' });
    }

    const filas = Array.isArray(body.filas) ? body.filas : [];
    if (filas.length === 0) {
      return Response.json({ ok: true, guardadas: 0 });
    }

    const { error } = await supabase
      .from('cr_institucional')
      .upsert(filas, { onConflict: 'comprobante,prov_no_norm' });

    if (error) throw error;

    return Response.json({ ok: true, guardadas: filas.length });
  } catch (e) {
    return Response.json(
      { ok: false, error: e && e.message ? e.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}
