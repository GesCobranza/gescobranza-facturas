import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

export const maxDuration = 60;

function trocear(arr, tamano) {
  const bloques = [];
  for (let i = 0; i < arr.length; i += tamano) bloques.push(arr.slice(i, i + tamano));
  return bloques;
}

function claveDelegacion(texto) {
  const m = String(texto || '').match(/(OOAD|UMAE)\D{0,5}(\d+)/i);
  if (!m) return null;
  return m[1].toUpperCase() + '-' + String(parseInt(m[2], 10));
}

export async function POST(request) {
  const body = await request.json();
  const filas = Array.isArray(body.filas) ? body.filas : [];
  if (filas.length === 0) {
    return NextResponse.json({ ok: false, error: 'No se recibieron filas para importar.' });
  }

  const supabase = getSupabaseAdmin();

  const { data: delegacionesData, error: errDeleg } = await supabase.from('catalogo_delegaciones').select('*');
  if (errDeleg) return NextResponse.json({ ok: false, error: errDeleg.message }, { status: 500 });

  const indiceDeleg = {};
  delegacionesData.forEach((d) => {
    const clave = claveDelegacion(d.nombre);
    if (clave) indiceDeleg[clave] = d;
  });

  const candidatos = [];
  const omitidas = [];
  const altasEnEsteArchivo = new Set();

  filas.forEach((f, idx) => {
    const grupo = String(f.grupo || '').trim();
    const empresa = String(f.empresa || '').trim();
    const delegacionTexto = String(f.delegacion || '').trim();
    const alta = String(f.alta || '').trim();
    const importe = Number(f.importe);
    const capturista = String(f.capturista || '').trim() || 'Importación histórica';
    const fechaRecepcion = f.fechaRecepcion || null;
    const provNo = String(f.provNo || '').trim();
    const pdf = String(f.pdf || alta).trim();
    const fila = idx + 2;

    if (!grupo || !empresa || !delegacionTexto || !alta || !importe || importe <= 0) {
      omitidas.push({ fila, alta: alta || '(sin alta)', motivo: 'Faltan datos obligatorios (grupo, empresa, delegación, alta o importe).' });
      return;
    }
    if (altasEnEsteArchivo.has(alta.toLowerCase())) {
      omitidas.push({ fila, alta, motivo: 'Número de alta repetido dentro de este mismo archivo.' });
      return;
    }

    const clave = claveDelegacion(delegacionTexto);
    const deleg = clave ? indiceDeleg[clave] : null;
    if (!deleg) {
      omitidas.push({ fila, alta, motivo: `No reconozco la delegación "${delegacionTexto}" — no coincide con ningún OOAD/UMAE de tu catálogo.` });
      return;
    }
    const codigos = deleg.codigo.split(',');
    if (!codigos.some((c) => alta.startsWith(c))) {
      omitidas.push({ fila, alta, motivo: `El alta no coincide con el código de "${deleg.nombre}" (esperado: ${codigos.join(' o ')}).` });
      return;
    }

    altasEnEsteArchivo.add(alta.toLowerCase());
    candidatos.push({
      fila,
      payload: {
        grupo, empresa, delegacion: deleg.nombre, pdf, num_factura: pdf,
        prov_no: provNo || null, prov_nombre: empresa,
        alta, importe, capturista,
        fecha_recepcion: fechaRecepcion,
        tiene_cr: false,
      },
    });
  });

  let insertadas = 0;
  const bloques = trocear(candidatos, 500);

  for (const bloque of bloques) {
    const payloads = bloque.map((c) => c.payload);
    const { data: filasGuardadas, error: errUpsert } = await supabase
      .from('facturas')
      .upsert(payloads, { onConflict: 'alta', ignoreDuplicates: true })
      .select('alta');

    if (errUpsert) {
      return NextResponse.json({
        ok: false,
        error: `Se importaron ${insertadas} filas antes de un error. Detalle: ${errUpsert.message}`,
      }, { status: 500 });
    }

    const altasGuardadas = new Set((filasGuardadas || []).map((r) => r.alta));
    bloque.forEach((c) => {
      if (altasGuardadas.has(c.payload.alta)) {
        insertadas++;
      } else {
        omitidas.push({ fila: c.fila, alta: c.payload.alta, motivo: 'Ese número de alta ya existía en el sistema.' });
      }
    });
  }

  return NextResponse.json({
    ok: true,
    insertadas,
    omitidas: omitidas.length,
    detalleOmitidas: omitidas,
  });
}
