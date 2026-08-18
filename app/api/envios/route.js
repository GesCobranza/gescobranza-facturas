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
      .eq('enviada_gestor', false)
      .is('envio_id', null)
      .order('alta')
      .limit(1000);

    if (error) throw error;

    // Paquetes que ya salieron pero siguen sin número de guía
    const { data: pendientes } = await supabase
      .from('envios')
      .select('id, delegacion, fecha_envio, enviado_por, notas')
      .is('guia', null)
      .order('fecha_envio', { ascending: false })
      .limit(50);

    let conConteo = [];
    if (pendientes && pendientes.length > 0) {
      const ids = pendientes.map((e) => e.id);
      const { data: fs } = await supabase
        .from('facturas')
        .select('envio_id, importe')
        .in('envio_id', ids);
      conConteo = pendientes.map((e) => {
        const mias = (fs || []).filter((f) => f.envio_id === e.id);
        return {
          ...e,
          facturas: mias.length,
          importe: mias.reduce((s, f) => s + Number(f.importe || 0), 0),
        };
      });
    }

    return NextResponse.json({ ok: true, facturas: data || [], sinGuia: conConteo });
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
    // Desde «Seguimiento Envío» el paquete se crea sin guía (aún no la dan en la
    // paquetería) y se marca con permitirSinGuia. Cuando se registra a mano desde
    // «Registrar envío» el número ya se tiene, así que aquí sí se exige.
    if (!guia && body.permitirSinGuia !== true) {
      return NextResponse.json({ ok: false, error: 'Falta el número de guía.' }, { status: 400 });
    }
    if (!enviadoPor) {
      return NextResponse.json({ ok: false, error: 'Falta indicar quién envía el paquete.' }, { status: 400 });
    }
    if (ids.length === 0) {
      return NextResponse.json({ ok: false, error: 'No seleccionaste ninguna factura.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Asigna el número de guía a un paquete que ya salió
    if (body.accion === 'asignar_guia') {
      if (!body.envioId || !String(body.guia || '').trim()) {
        return NextResponse.json({ ok: false, error: 'Falta el paquete o el número de guía.' }, { status: 400 });
      }
      const { error: errG } = await supabase
        .from('envios')
        .update({ guia: String(body.guia).trim() })
        .eq('id', body.envioId);
      if (errG) throw errG;
      return NextResponse.json({ ok: true });
    }

    const { data: envio, error: errEnvio } = await supabase
      .from('envios')
      .insert({
        guia: guia || null,
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
