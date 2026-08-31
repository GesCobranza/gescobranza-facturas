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
//
// Devuelve el paquete que ya usa esa guia, o null si esta libre.
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

// GET: facturas listas para enviar de una delegación
// (capturadas, sin contra recibo y sin envío registrado)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    // Verificacion en vivo desde el formulario: ?verificarGuia=123456
    const verificar = String(searchParams.get('verificarGuia') || '').trim();
    if (verificar) {
      const supabase = getSupabaseAdmin();
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
      .order('id', { ascending: true }) // desempate unico: alta se repite entre proveedores
      .limit(1000);

    if (error) throw error;

    // Paquetes que ya salieron pero siguen sin número de guía.
    // La guia puede quedar como NULL o como cadena vacia segun por donde se
    // haya creado el paquete: hay que contemplar las dos.
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

// POST: registra un paquete y liga las facturas seleccionadas
export async function POST(request) {
  try {
    const body = await request.json();

    const supabase = getSupabaseAdmin();

    // -----------------------------------------------------------------------
    // ASIGNAR GUIA A UN PAQUETE QUE YA SALIO.
    //
    // Va PRIMERO, antes de cualquier otra validacion. Este caso solo manda
    // accion, envioId y guia -- el paquete ya existe, asi que no trae
    // delegacion, fecha, enviadoPor ni ids. Cuando este bloque estaba despues
    // de las validaciones de paquete nuevo, la primera de ellas cortaba con
    // 400 "Falta la delegacion o la fecha de envio" y el boton Guardar no
    // hacia nada. No mover de aqui.
    // -----------------------------------------------------------------------
    if (body.accion === 'asignar_guia') {
      const envioId = String(body.envioId || '').trim();
      const nuevaGuia = String(body.guia || '').trim();
      if (!envioId || !nuevaGuia) {
        return NextResponse.json({ ok: false, error: 'Falta el paquete o el número de guía.' }, { status: 400 });
      }

      // Candado: esa guia no puede estar ya en otro paquete
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

    // Candado: la guia no puede estar ya en otro paquete
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
