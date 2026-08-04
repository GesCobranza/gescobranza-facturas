import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

// Devuelve todas las facturas enviadas y sin contra recibo de una delegación,
// con la guía y fecha del paquete en el que viajaron, para armar el reclamo.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const delegacion = String(searchParams.get('delegacion') || '').trim();
    if (!delegacion) {
      return NextResponse.json({ ok: false, error: 'Falta la delegación.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: facturas, error } = await supabase
      .from('facturas')
      .select('alta, num_factura, pdf, empresa, grupo, importe, fecha_envio, envio_id')
      .eq('delegacion', delegacion)
      .eq('tiene_cr', false)
      .eq('enviada_gestor', true)
      .order('importe', { ascending: false })
      .limit(2000);

    if (error) throw error;

    const filas = facturas || [];
    const idsEnvio = Array.from(new Set(filas.map((f) => f.envio_id).filter(Boolean)));

    const guias = {};
    if (idsEnvio.length > 0) {
      const { data: envios } = await supabase
        .from('envios')
        .select('id, guia, fecha_envio, paqueteria')
        .in('id', idsEnvio);
      (envios || []).forEach((e) => { guias[e.id] = e; });
    }

    const salida = filas.map((f) => {
      const e = f.envio_id ? guias[f.envio_id] : null;
      return {
        alta: f.alta,
        num_factura: f.num_factura || f.pdf || '',
        empresa: f.empresa,
        grupo: f.grupo,
        importe: Number(f.importe || 0),
        guia: e ? (e.guia || '') : '',
        fecha_envio: (e && e.fecha_envio) || f.fecha_envio || null,
      };
    });

    // Agrupa por guía para el resumen del correo
    const porGuia = {};
    salida.forEach((f) => {
      const clave = f.guia || 'SIN_GUIA';
      if (!porGuia[clave]) porGuia[clave] = { guia: f.guia, fecha_envio: f.fecha_envio, facturas: 0, importe: 0 };
      porGuia[clave].facturas += 1;
      porGuia[clave].importe += f.importe;
      if (f.fecha_envio && (!porGuia[clave].fecha_envio || f.fecha_envio < porGuia[clave].fecha_envio)) {
        porGuia[clave].fecha_envio = f.fecha_envio;
      }
    });

    return NextResponse.json({
      ok: true,
      delegacion: delegacion,
      facturas: salida,
      paquetes: Object.values(porGuia).sort((a, b) => b.importe - a.importe),
      total: salida.length,
      importe: salida.reduce((s, f) => s + f.importe, 0),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e && e.message ? e.message : 'Error de servidor.' },
      { status: 500 }
    );
  }
}
