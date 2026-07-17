import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';

// Quita ceros a la izquierda, igual que el resto del sistema, para mantener prov_no consistente
function normalizarProvNo(valor) {
  const limpio = String(valor || '').trim().replace(/^0+/, '');
  return limpio || '0';
}

export async function POST(request) {
  const body = await request.json();
  const supabase = getSupabaseAdmin();

  const grupo = String(body.grupo || '').trim();
  const empresa = String(body.empresa || '').trim();
  const delegacion = String(body.delegacion || '').trim();
  const pdf = String(body.pdf || '').trim();
  const provNo = body.provNo;
  const provNombre = body.provNombre;
  const capturista = body.capturista;
  const fechaRecepcion = body.fechaRecepcion || null;
  const filas = Array.isArray(body.filas) ? body.filas : [];

  if (!grupo || !empresa || !delegacion || !pdf || !provNo) {
    return NextResponse.json({ ok: false, error: 'Completa grupo, empresa, delegación y PDF/susceptible.' });
  }
  if (filas.length < 2) {
    return NextResponse.json({ ok: false, error: 'Se necesitan al menos 2 facturas para usar la captura por lotes.' });
  }

  const { data: deleg, error: errDeleg } = await supabase
    .from('catalogo_delegaciones')
    .select('*')
    .eq('nombre', delegacion)
    .maybeSingle();
  if (errDeleg) return NextResponse.json({ ok: false, error: errDeleg.message }, { status: 500 });
  if (!deleg) return NextResponse.json({ ok: false, error: `La delegación "${delegacion}" no existe en tu catálogo.` });
  const codigos = deleg.codigo.split(',');

  // Validar cada fila y detectar duplicados dentro del propio lote
  const altasEnLote = new Set();
  for (let i = 0; i < filas.length; i++) {
    const f = filas[i];
    const alta = String(f.alta || '').trim();
    const importe = Number(f.importe);
    if (!alta || !importe || importe <= 0) {
      return NextResponse.json({ ok: false, error: `Fila ${i + 1}: falta el alta o el importe.` });
    }
    if (!codigos.some((c) => alta.startsWith(c))) {
      return NextResponse.json({ ok: false, error: `Fila ${i + 1}: el alta "${alta}" no coincide con el código de "${deleg.nombre}" (esperado: ${codigos.join(' o ')}).` });
    }
    if (altasEnLote.has(alta.toLowerCase())) {
      return NextResponse.json({ ok: false, error: `Fila ${i + 1}: el alta "${alta}" está repetida dentro de este mismo lote.` });
    }
    altasEnLote.add(alta.toLowerCase());
  }

  // Validar que ninguna ya exista en el sistema
  const altas = filas.map((f) => String(f.alta).trim());
  const { data: existentes, error: errDup } = await supabase.from('facturas').select('alta').in('alta', altas);
  if (errDup) return NextResponse.json({ ok: false, error: errDup.message }, { status: 500 });
  if (existentes && existentes.length > 0) {
    return NextResponse.json({ ok: false, error: `Ya existe(n) en el sistema: ${existentes.map((e) => e.alta).join(', ')}.` });
  }

  const payloads = filas.map((f) => ({
    grupo, empresa, delegacion,
    pdf, num_factura: f.numFactura || pdf,
    prov_no: normalizarProvNo(provNo), prov_nombre: provNombre,
    alta: String(f.alta).trim(), importe: Number(f.importe),
    capturista, fecha_recepcion: fechaRecepcion,
  }));

  const { error: errInsert } = await supabase.from('facturas').insert(payloads);
  if (errInsert) return NextResponse.json({ ok: false, error: errInsert.message }, { status: 500 });

  return NextResponse.json({ ok: true, insertadas: payloads.length });
}
