import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// CANDADO DE GUIA UNICA
//
// Un paquete fisico tiene un solo numero de guia y un solo destino. Cuando la
// misma guia queda en dos paquetes no hay forma de saber cual rastrear en
// Paquetexpress: el sitio devuelve un resultado y no se sabe a que envio
// corresponde. Paso 5 veces (delegaciones vecinas o el mismo dia), porque al
// capturar en serie se arrastra el numero anterior.
// ---------------------------------------------------------------------------
async function guiaYaUsada(supabase, guia, excluirEnvioId) {
  const limpia = String(guia || '').trim();
  if (!limpia) return null;
  let q = supabase
    .from('envios')
    .select('id, guia, delegacion, fecha_envio, enviado_por')
    .eq('guia', limpia)
    .limit(1);
  if (excluirEnvioId) q = q.neq('id', excluirEnvioId);
  const { data } = await q;
  return data && data.length > 0 ? data[0] : null;
}

function fmtFecha(iso) {
  if (!iso) return 'sin fecha';
  const p = String(iso).slice(0, 10).split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(iso);
}

const ESTATUS_VALIDOS = ['sin_verificar', 'en_transito', 'entregada', 'no_entregada'];

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const supabase = getSupabaseAdmin();

    // -----------------------------------------------------------------------
    // Verificacion en vivo de guia repetida, desde el formulario
    // -----------------------------------------------------------------------
    const verificar = String(searchParams.get('verificarGuia') || '').trim();
    if (verificar) {
      const dup = await guiaYaUsada(supabase, verificar, null);
      return NextResponse.json({
        ok: true,
        libre: !dup,
        usadaPor: dup ? {
          delegacion: dup.delegacion,
          fecha: fmtFecha(dup.fecha_envio),
          enviadoPor: dup.enviado_por,
        } : null,
      });
    }

    // -----------------------------------------------------------------------
    // LISTA DE RASTREO: paquetes CON guia que todavia tienen facturas sin CR.
    // Es lo que se revisa en la pagina de Paquetexpress para confirmar si ya
    // se entregaron. Si esta entregada y el CR no sale, hay con que reclamar.
    // -----------------------------------------------------------------------
    if (searchParams.get('rastreo') === '1') {
      const { data: envios, error: errE } = await supabase
        .from('envios')
        .select('id, guia, delegacion, fecha_envio, enviado_por, estatus_entrega, verificado_por, fecha_verificacion')
        .not('guia', 'is', null)
        .neq('guia', '')
        .order('fecha_envio', { ascending: true })
        .order('id', { ascending: true })
        .limit(500);
      if (errE) throw errE;

      const ids = (envios || []).map((e) => e.id);
      let porEnvio = {};
      if (ids.length > 0) {
        // Solo las que siguen SIN contra recibo: si ya salio el CR, el paquete
        // llego y no hay nada que rastrear.
        const { data: fs } = await supabase
          .from('facturas')
          .select('envio_id, importe')
          .in('envio_id', ids)
          .eq('tiene_cr', false);
        (fs || []).forEach((f) => {
          if (!porEnvio[f.envio_id]) porEnvio[f.envio_id] = { n: 0, importe: 0 };
          porEnvio[f.envio_id].n += 1;
          porEnvio[f.envio_id].importe += Number(f.importe || 0);
        });
      }

      // Guias que aparecen en mas de un paquete: no se puede saber cual
      // corresponde al resultado del rastreo. Se marcan para revisar el acuse.
      const cuenta = {};
      (envios || []).forEach((e) => {
        const g = String(e.guia || '').trim();
        cuenta[g] = (cuenta[g] || 0) + 1;
      });

      const lista = (envios || [])
        .filter((e) => porEnvio[e.id])
        .map((e) => ({
          id: e.id,
          guia: e.guia,
          delegacion: e.delegacion,
          fecha_envio: e.fecha_envio,
          enviado_por: e.enviado_por,
          estatus_entrega: e.estatus_entrega || 'sin_verificar',
          verificado_por: e.verificado_por,
          fecha_verificacion: e.fecha_verificacion,
          facturas: porEnvio[e.id].n,
          importe: porEnvio[e.id].importe,
          guia_repetida: cuenta[String(e.guia || '').trim()] > 1,
        }));

      return NextResponse.json({ ok: true, rastreo: lista });
    }

    // -----------------------------------------------------------------------
    // Facturas listas para enviar de una delegacion
    // -----------------------------------------------------------------------
    const delegacion = String(searchParams.get('delegacion') || '').trim();
    if (!delegacion) return NextResponse.json({ ok: true, facturas: [] });

    const { data, error } = await supabase
      .from('facturas')
      .select('id, alta, grupo, empresa, importe, pdf, num_factura, fecha_captura')
      .eq('delegacion', delegacion)
      .eq('tiene_cr', false)
      .eq('enviada_gestor', false)
      .is('envio_id', null)
      .order('alta')
      .order('id', { ascending: true }) // desempate unico: alta se repite entre proveedores
      .limit(1000);

    if (error) throw error;

    // Paquetes que ya salieron pero siguen sin número de guía.
    const { data: pendientes } = await supabase
      .from('envios')
      .select('id, delegacion, fecha_envio, enviado_por, notas, guia')
      .or('guia.is.null,guia.eq.')
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

export async function POST(request) {
  try {
    const body = await request.json();
    const supabase = getSupabaseAdmin();

    // -----------------------------------------------------------------------
    // GUARDAR EL ESTATUS DE ENTREGA tras revisar en Paquetexpress
    // -----------------------------------------------------------------------
    if (body.accion === 'estatus_entrega') {
      const envioId = String(body.envioId || '').trim();
      const estatus = String(body.estatus || '').trim();
      const quien = String(body.verificadoPor || '').trim();
      if (!envioId || !ESTATUS_VALIDOS.includes(estatus)) {
        return NextResponse.json({ ok: false, error: 'Falta el paquete o el estatus es inválido.' }, { status: 400 });
      }
      if (estatus !== 'sin_verificar' && !quien) {
        return NextResponse.json({ ok: false, error: 'Indica quién hizo la verificación.' }, { status: 400 });
      }
      const { data: act, error: errS } = await supabase
        .from('envios')
        .update({
          estatus_entrega: estatus,
          verificado_por: estatus === 'sin_verificar' ? null : quien,
          fecha_verificacion: estatus === 'sin_verificar' ? null : new Date().toISOString(),
        })
        .eq('id', envioId)
        .select('id, estatus_entrega, verificado_por, fecha_verificacion');
      if (errS) throw errS;
      if (!act || act.length === 0) {
        return NextResponse.json({ ok: false, error: 'No se encontró ese paquete.' }, { status: 404 });
      }
      return NextResponse.json({ ok: true, envio: act[0] });
    }

    // -----------------------------------------------------------------------
    // ASIGNAR GUIA A UN PAQUETE QUE YA SALIO.
    // Va antes de las validaciones de paquete nuevo: este caso solo manda
    // accion, envioId y guia. Si se mueve abajo, la primera validacion corta
    // con 400 y el boton Guardar deja de funcionar. No mover de aqui.
    // -----------------------------------------------------------------------
    if (body.accion === 'asignar_guia') {
      const envioId = String(body.envioId || '').trim();
      const nuevaGuia = String(body.guia || '').trim();
      if (!envioId || !nuevaGuia) {
        return NextResponse.json({ ok: false, error: 'Falta el paquete o el número de guía.' }, { status: 400 });
      }

      const dup = await guiaYaUsada(supabase, nuevaGuia, envioId);
      if (dup && body.forzarGuiaRepetida !== true) {
        return NextResponse.json({
          ok: false,
          guiaRepetida: true,
          error: 'La guía ' + nuevaGuia + ' ya está registrada en el paquete de '
                 + dup.delegacion + ' del ' + fmtFecha(dup.fecha_envio)
                 + '. Revisa el acuse: un paquete no puede tener dos destinos.',
        }, { status: 409 });
      }

      const { data: act, error: errG } = await supabase
        .from('envios')
        .update({ guia: nuevaGuia })
        .eq('id', envioId)
        .select('id, guia');
      if (errG) throw errG;
      if (!act || act.length === 0) {
        return NextResponse.json({ ok: false, error: 'No se encontró ese paquete.' }, { status: 404 });
      }
      return NextResponse.json({ ok: true, envioId: envioId, guia: nuevaGuia });
    }

    // ----------------------- Registrar un paquete nuevo ---------------------
    const delegacion = String(body.delegacion || '').trim();
    const guia = String(body.guia || '').trim();
    const fechaEnvio = String(body.fechaEnvio || '').trim();
    const enviadoPor = String(body.enviadoPor || '').trim();
    const notas = String(body.notas || '').trim();
    const ids = Array.isArray(body.ids) ? body.ids : [];

    if (!delegacion || !fechaEnvio) {
      return NextResponse.json({ ok: false, error: 'Falta la delegación o la fecha de envío.' }, { status: 400 });
    }
    if (!guia && body.permitirSinGuia !== true) {
      return NextResponse.json({ ok: false, error: 'Falta el número de guía.' }, { status: 400 });
    }
    if (!enviadoPor) {
      return NextResponse.json({ ok: false, error: 'Falta indicar quién envía el paquete.' }, { status: 400 });
    }
    if (ids.length === 0) {
      return NextResponse.json({ ok: false, error: 'No seleccionaste ninguna factura.' }, { status: 400 });
    }

    if (guia) {
      const dup = await guiaYaUsada(supabase, guia, null);
      if (dup && body.forzarGuiaRepetida !== true) {
        return NextResponse.json({
          ok: false,
          guiaRepetida: true,
          error: 'La guía ' + guia + ' ya está registrada en el paquete de '
                 + dup.delegacion + ' del ' + fmtFecha(dup.fecha_envio)
                 + '. Revisa el acuse: un paquete no puede tener dos destinos.',
        }, { status: 409 });
      }
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
