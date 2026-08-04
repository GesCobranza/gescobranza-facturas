import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

// GET: facturas listas para enviar de una delegación
// (capturadas, sin contra recibo y sin envío registrado)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const delegacion = String(searchParams.get('delegacion') || '').trim();
    if (!delegacion) return NextResponse.json({ ok: true, facturas: [] });

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('facturas')
      .select('id, alta, grupo, empresa, importe, pdf, num_factura, fecha_captura')
      .eq('delegacion', delegacion)
      .eq('tiene_cr', false)
      .is('envio_id', null)
      .order('alta')
      .limit(1000);

    if (error) throw error;
    return NextResponse.json({ ok: true, facturas: data || [] });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e && e.message ? e.message : 'Error de servidor.' },
      { status: 500 }
    );
  }
}

// POST: registra un paquete y liga las facturas seleccionadas
export async function POST(request) {
  try {
    const body = await request.json();
    const delegacion = String(body.delegacion || '').trim();
    const guia = String(body.guia || '').trim();
    const fechaEnvio = String(body.fechaEnvio || '').trim();
    const enviadoPor = String(body.enviadoPor || '').trim();
    const notas = String(body.notas || '').trim();
    const ids = Array.isArray(body.ids) ? body.ids : [];

    if (!delegacion || !fechaEnvio) {
      return NextResponse.json({ ok: false, error: 'Falta la delegación o la fecha de envío.' }, { status: 400 });
    }
    // La guía es la prueba de entrega: sin ella el envío no sirve para reclamar.
    if (!guia) {
      return NextResponse.json({ ok: false, error: 'Falta el número de guía.' }, { status: 400 });
    }
    if (!enviadoPor) {
      return NextResponse.json({ ok: false, error: 'Falta indicar quién envía el paquete.' }, { status: 400 });
    }
    if (ids.length === 0) {
      return NextResponse.json({ ok: false, error: 'No seleccionaste ninguna factura.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: envio, error: errEnvio } = await supabase
      .from('envios')
      .insert({
        guia: guia,
        paqueteria: 'Paquetexpress',
        delegacion: delegacion,
        fecha_envio: fechaEnvio,
        enviado_por: enviadoPor,
        notas: notas || null,
      })
      .select('id')
      .single();

    if (errEnvio) throw errEnvio;

    // Solo se marcan las que sigan sin envío: si otra persona registró el mismo
    // paquete al mismo tiempo, esta condición evita pisar su registro.
    const { data: actualizadas, error: errUpd } = await supabase
      .from('facturas')
      .update({ envio_id: envio.id, enviada_gestor: true, fecha_envio: fechaEnvio })
      .in('id', ids)
      .is('envio_id', null)
      .select('id');

    if (errUpd) throw errUpd;

    return NextResponse.json({
      ok: true,
      envioId: envio.id,
      guia: guia,
      marcadas: (actualizadas || []).length,
      solicitadas: ids.length,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e && e.message ? e.message : 'Error de servidor.' },
      { status: 500 }
    );
  }
}
