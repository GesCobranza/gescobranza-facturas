import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
export const maxDuration = 30;
function normalizarProveedor(valor) {
  const limpio = String(valor || '').trim().replace(/^0+/, '');
  return limpio || '0';
}
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const altaBuscada = (searchParams.get('alta') || '').trim();
  if (!altaBuscada) {
    return NextResponse.json({ ok: false, error: 'Escribe una alta para buscar.' });
  }
  const supabase = getSupabaseAdmin();

  const { data: factura, error: errFactura } = await supabase
    .from('facturas')
    .select('*')
    .ilike('alta', altaBuscada)
    .maybeSingle();
  if (errFactura) return NextResponse.json({ ok: false, error: errFactura.message });
  if (!factura) {
    return NextResponse.json({ ok: false, error: `No encontré ninguna factura capturada con alta "${altaBuscada}". Revisa que esté escrita igual que en Consulta.` });
  }

  const provNormalizado = normalizarProveedor(factura.prov_no);

  // Trae TODAS las filas del 5005 cargado que correspondan a ese mismo proveedor, sin importar la alta
  const PAGINA = 1000;
  let desde = 0;
  let filasProveedor = [];
  while (true) {
    const { data, error } = await supabase.from('raw_5005').select('*').range(desde, desde + PAGINA - 1);
    if (error) return NextResponse.json({ ok: false, error: error.message });
    const filtradas = data.filter((r) => normalizarProveedor(r.proveedor) === provNormalizado);
    filasProveedor = filasProveedor.concat(filtradas);
    if (data.length < PAGINA) break;
    desde += PAGINA;
  }

  // Busca coincidencia exacta de alta (texto tal cual, sin normalizar) dentro de ese proveedor,
  // para mostrar explícitamente si SÍ hay una fila con la misma alta pero se está perdiendo por otra razón.
  const coincidenciaExactaAlta = filasProveedor.filter(
    (r) => String(r.alta || '').trim().toLowerCase() === String(factura.alta || '').trim().toLowerCase()
  );

  return NextResponse.json({
    ok: true,
    factura: {
      alta: factura.alta,
      alta_bytes: Array.from(String(factura.alta)).map((c) => c.charCodeAt(0)),
      prov_no: factura.prov_no,
      prov_no_normalizado: provNormalizado,
      importe: factura.importe,
      tiene_cr: factura.tiene_cr,
      alerta_importe: factura.alerta_importe,
    },
    totalFilasProveedorEn5005: filasProveedor.length,
    coincidenciaExactaAlta: coincidenciaExactaAlta.map((r) => ({
      alta: r.alta,
      alta_bytes: Array.from(String(r.alta)).map((c) => c.charCodeAt(0)),
      proveedor: r.proveedor,
      importe: r.importe,
      comprobante: r.comprobante,
    })),
    muestraAltasDelProveedor: filasProveedor.slice(0, 30).map((r) => ({
      alta: r.alta,
      proveedor: r.proveedor,
      importe: r.importe,
      comprobante: r.comprobante,
    })),
  });
}
