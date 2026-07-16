import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

export const maxDuration = 60;

async function traerTodas(supabase, tabla, filtro) {
  const PAGINA = 1000;
  let desde = 0;
  let todas = [];
  while (true) {
    let query = supabase.from(tabla).select('*').range(desde, desde + PAGINA - 1);
    if (filtro) query = filtro(query);
    const { data, error } = await query;
    if (error) throw error;
    todas = todas.concat(data);
    if (data.length < PAGINA) break;
    desde += PAGINA;
  }
  return todas;
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
  raw.forEach((r) => {
    if (!r.alta || !r.proveedor) return;
    const key = String(r.alta).trim() + '|' + String(r.proveedor).trim();
    if (!mapa[key]) mapa[key] = [];
    mapa[key].push({ importe: Number(r.importe) || 0, comprobante: r.comprobante ? String(r.comprobante).trim() : '' });
  });

  let encontrados = 0, alertasImporte = 0, ambiguos = 0, incompletos = 0;
  const actualizaciones = [];

  for (const f of facturas) {
    if (!f.alta || !f.prov_no || !f.importe || Number(f.importe) <= 0) {
      incompletos++;
      actualizaciones.push({ id: f.id, alerta_importe: 'Falta Alta, Proveedor o Importe — no se pudo cruzar contra el 5005' });
      continue;
    }
    const key = String(f.alta).trim() + '|' + String(f.prov_no).trim();
    const candidatos = mapa[key];
    if (!candidatos || candidatos.length === 0) continue;

    const importeCapturado = Number(f.importe);
    const exacto = candidatos.find((c) => Math.abs(c.importe - importeCapturado) < 0.01 && c.comprobante);

    if (exacto) {
      actualizaciones.push({ id: f.id, tiene_cr: true, fecha_cr: new Date().toISOString(), comprobante: exacto.comprobante, alerta_importe: null });
      encontrados++;
    } else if (candidatos.length === 1) {
      const unico = candidatos[0];
      const upd = { id: f.id };
      if (unico.comprobante) {
        upd.tiene_cr = true;
        upd.fecha_cr = new Date().toISOString();
        upd.comprobante = unico.comprobante;
        encontrados++;
      }
      if (Math.abs(unico.importe - importeCapturado) >= 0.01) {
        upd.alerta_importe = `5005 registra $${unico.importe} vs $${importeCapturado} capturado — corrige el importe`;
        alertasImporte++;
      }
      if (Object.keys(upd).length > 1) actualizaciones.push(upd);
    } else {
      actualizaciones.push({ id: f.id, alerta_importe: `Hay ${candidatos.length} registros en 5005 con esta Alta+Proveedor y ninguno coincide en importe — revisar a mano` });
      ambiguos++;
    }
  }

  const TAMANO_BLOQUE = 200;
  for (let i = 0; i < actualizaciones.length; i += TAMANO_BLOQUE) {
    const bloque = actualizaciones.slice(i, i + TAMANO_BLOQUE);
    await Promise.all(
      bloque.map((upd) => {
        const { id, ...campos } = upd;
        return supabase.from('facturas').update(campos).eq('id', id);
      })
    );
  }

  return NextResponse.json({ ok: true, encontrados, alertasImporte, ambiguos, incompletos });
}
