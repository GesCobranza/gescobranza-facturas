import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

export const maxDuration = 60;

async function traerTodas(supabase, tabla, filtro) {
  const PAGINA = 1000;
  let desde = 0;
  let todas = [];
  while (true) {
    let query = supabase.from(tabla).select('*');
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
    if (!candidatos || candidatos.length === 0) continue; // aún no aparece en el 5005

    const importeCapturado = Number(f.importe);
    const exacto = candidatos.find((c) => Math.abs(c.importe - importeCapturado) < 0.01 && c.comprobante);

    if (exacto) {
      actualizaciones.push({ id: f.id, tiene_cr: true, fecha_cr: new Date().toISOString(), comprobante: exacto.comprobante, alerta_importe: null });
      encontrados++;
    } else if (candidatos.length === 1) {
