import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

export const maxDuration = 60;

async function traerTodas(supabase, tabla, filtro) {
  const PAGINA = 1000;
  let desde = 0;
  let todas = [];
  while (true) {
    let query = supabase.from(tabla).select('*').order('id', { ascending: true });
    if (filtro) query = filtro(query);
    query = query.range(desde, desde + PAGINA - 1);
    const { data, error } = await query;
    if (error) throw error;
    todas = todas.concat(data);
    if (data.length < PAGINA) break;
    desde += PAGINA;
  }
  return todas;
}

function normalizarProveedor(valor) {
  const limpio = String(valor || '').trim().replace(/^0+/, '');
  return limpio || '0';
}

export async function POST() {
  const supabase = getSupabaseAdmin();

  let raw, facturas;
  try {
    raw = await traerTodas(supabase, 'raw_5005');
    facturas = await traerTodas(supabase, 'facturas', (q) => q.eq('tiene_cr', false));
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message });
  }

  const mapa = {};
  let rawConAltaYProveedor = 0;
  raw.forEach((r) => {
    if (!r.alta || !r.proveedor) return;
    rawConAltaYProveedor++;
    const key = String(r.alta).trim() + '|' + normalizarProveedor(r.proveedor);
    if (!mapa[key]) mapa[key] = [];
    mapa[key].push({ importe: Number(r.importe) || 0, comprobante: r.comprobante ? String(r.comprobante).trim() : '' });
  });

  let facturasConDatosCompletos = 0;
  let keysEncontradasEnMapa = 0;
  let ejemploFactura = null;
  let ejemploKeyBuscada = null;
  let ejemploExisteEnMapa = null;

  for (const f of facturas) {
    if (!f.alta || !f.prov_no || !f.importe || Number(f.importe) <= 0) continue;
    facturasConDatosCompletos++;
    const key = String(f.alta).trim() + '|' + normalizarProveedor(f.prov_no);
    if (mapa[key]) keysEncontradasEnMapa++;
    if (!ejemploFactura) {
      ejemploFactura = { alta: f.alta, prov_no: f.prov_no, tipo_prov_no: typeof f.prov_no };
      ejemploKeyBuscada = key;
      ejemploExisteEnMapa = !!mapa[key];
    }
  }

  return NextResponse.json({
    ok: true,
    diagnostico: {
      total_raw_leidas: raw.length,
      raw_con_alta_y_proveedor: rawConAltaYProveedor,
      total_facturas_sin_cr_leidas: facturas.length,
      facturas_con_datos_completos: facturasConDatosCompletos,
      keys_que_si_matchean: keysEncontradasEnMapa,
      ejemplo_factura: ejemploFactura,
      ejemplo_key_buscada: ejemploKeyBuscada,
      ejemplo_existe_en_mapa: ejemploExisteEnMapa,
      total_keys_unicas_en_mapa: Object.keys(mapa).length,
    },
  });
}
