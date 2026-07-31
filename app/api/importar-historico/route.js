import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

export const maxDuration = 60;

function trocear(arr, tamano) {
  const bloques = [];
  for (let i = 0; i < arr.length; i += tamano) bloques.push(arr.slice(i, i + tamano));
  return bloques;
}

// Quita ceros a la izquierda para comparar altas y proveedores de forma consistente
function sinCeros(v) {
  return String(v == null ? '' : v).trim().replace(/^0+/, '') || '';
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
      omitidas.push({ fila, alta: alta || '(sin alta)', motivo: 'Faltan datos obligatorios (grupo, empresa, delegación, alta o importe).', categoria: 'revisar' });
      return;
    }
    if (altasEnEsteArchivo.has(alta.toLowerCase())) {
      omitidas.push({ fila, alta, motivo: 'Número de alta repetido dentro de este mismo archivo.', categoria: 'informativo' });
      return;
    }

    const clave = claveDelegacion(delegacionTexto);
    const deleg = clave ? indiceDeleg[clave] : null;
    if (!deleg) {
      omitidas.push({ fila, alta, motivo: `No reconozco la delegación "${delegacionTexto}" — no coincide con ningún OOAD/UMAE de tu catálogo.`, categoria: 'revisar' });
      return;
    }
    const codigos = deleg.codigo.split(',');
    if (!codigos.some((c) => alta.startsWith(c))) {
      omitidas.push({ fila, alta, motivo: `El alta no coincide con el código de "${deleg.nombre}" (esperado: ${codigos.join(' o ')}).`, categoria: 'revisar' });
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
    const altasBloque = bloque.map((c) => c.payload.alta);

    // El IMSS reutiliza números de alta entre ejercicios, así que una misma alta
    // puede pertenecer a dos proveedores distintos. Solo es duplicado si coinciden ambos.
    const { data: yaExisten, error: errBusca } = await supabase
      .from('facturas')
      .select('alta, prov_no')
      .in('alta', altasBloque);

    if (errBusca) {
      return NextResponse.json({
        ok: false,
        error: `Se importaron ${insertadas} filas antes de un error al revisar duplicados. Detalle: ${errBusca.message}`,
      }, { status: 500 });
    }

    const clavesExistentes = new Set(
      (yaExisten || []).map((r) => sinCeros(r.alta) + '|' + sinCeros(r.prov_no))
    );

    const nuevos = [];
    bloque.forEach((c) => {
      const clave = sinCeros(c.payload.alta) + '|' + sinCeros(c.payload.prov_no);
      if (clavesExistentes.has(clave)) {
        omitidas.push({ fila: c.fila, alta: c.payload.alta, motivo: 'Esa alta ya existía en el sistema con el mismo proveedor.', categoria: 'informativo' });
      } else {
        clavesExistentes.add(clave);
        nuevos.push(c.payload);
      }
    });

    if (nuevos.length > 0) {
      const { error: errIns } = await supabase.from('facturas').insert(nuevos);
      if (errIns) {
        return NextResponse.json({
          ok: false,
          error: `Se importaron ${insertadas} filas antes de un error. Detalle: ${errIns.message}`,
        }, { status: 500 });
      }
      insertadas += nuevos.length;
    }
  }

  const omitidasRevisar = omitidas.filter((o) => o.categoria === 'revisar');
  const omitidasInformativo = omitidas.filter((o) => o.categoria === 'informativo');

  return NextResponse.json({
    ok: true,
    insertadas,
    omitidas: omitidas.length,
    omitidasRevisar: omitidasRevisar.length,
    omitidasInformativo: omitidasInformativo.length,
    detalleOmitidas: omitidas,
  });
}
