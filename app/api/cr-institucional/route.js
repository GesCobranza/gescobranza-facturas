import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();

    // Recarga total — solo para casos excepcionales
    if (body.accion === 'vaciar') {
      const { error } = await supabase
        .from('cr_institucional')
        .delete()
        .not('comprobante', 'is', null);
      if (error) throw error;
      return Response.json({ ok: true, mensaje: 'Tabla vaciada' });
    }

    // Borra los pendientes (1003) de un proveedor antes de recargarlos.
    // Un CR programado puede cancelarse o cambiar de fecha, así que sus
    // pendientes se reemplazan completos en cada carga.
    if (body.accion === 'limpiar_pendientes_proveedor') {
      const prov = String(body.provNorm || '').trim();
      if (!prov) return Response.json({ ok: true, borrados: 0 });
      const { data, error } = await supabase
        .from('cr_institucional')
        .delete()
        .eq('fuente', '1003')
        .eq('prov_no_norm', prov)
        .select('comprobante');
      if (error) throw error;
      return Response.json({ ok: true, borrados: (data || []).length });
    }

    const filas = Array.isArray(body.filas) ? body.filas : [];
    if (filas.length === 0) {
      return Response.json({ ok: true, guardadas: 0 });
    }

    // Un CR que ya se pagó sale del 1003 y entra al 4004. Si estaba guardado
    // como pendiente, se elimina esa versión para que no quede en ambos estados.
    const pagados = filas.filter((f) => f.fuente === '4004');
    let promovidos = 0;
    if (pagados.length > 0) {
      const comprobantes = Array.from(new Set(pagados.map((f) => f.comprobante)));
      const BLOQUE = 200;
      for (let i = 0; i < comprobantes.length; i += BLOQUE) {
        const lote = comprobantes.slice(i, i + BLOQUE);
        const { data, error: errDel } = await supabase
          .from('cr_institucional')
          .delete()
          .eq('fuente', '1003')
          .in('comprobante', lote)
          .select('comprobante');
        if (errDel) throw errDel;
        promovidos += (data || []).length;
      }
    }

    const { error } = await supabase
      .from('cr_institucional')
      .upsert(filas, { onConflict: 'comprobante,prov_no_norm' });

    if (error) throw error;

    return Response.json({ ok: true, guardadas: filas.length, promovidos: promovidos });
  } catch (e) {
    return Response.json(
      { ok: false, error: e && e.message ? e.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}
