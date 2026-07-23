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
    facturas = await traerTodas(supabase, 'facturas');
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message });
  }
  const mapa = {};
  raw.forEach((r) => {
    if (!r.alta || !r.proveedor) return;
    const comprobante = r.comprobante ? String(r.comprobante).trim() : '';
    if (!comprobante) return;
    const key = String(r.alta).trim() + '|' + normalizarProveedor(r.proveedor);
    if (!mapa[key]) mapa[key] = [];
    const candidato = { importe: Number(r.importe) || 0, comprobante };
    const yaExiste = mapa[key].some((c) => Math.abs(c.importe - candidato.importe) < 0.01 && c.comprobante === candidato.comprobante);
    if (!yaExiste) mapa[key].push(candidato);
  });
  let encontrados = 0, alertasImporte = 0, ambiguos = 0, incompletos = 0, corregidos = 0, alertasLimpiadas = 0;
  const actualizaciones = [];
  for (const f of facturas) {
    if (!f.alta || !f.prov_no || !f.importe || Number(f.importe) <= 0) {
      if (!f.tiene_cr && f.alerta_importe !== 'Falta Alta, Proveedor o Importe — no se pudo cruzar contra el 5005') {
        incompletos++;
        actualizaciones.push({ id: f.id, alerta_importe: 'Falta Alta, Proveedor o Importe — no se pudo cruzar contra el 5005' });
      } else if (!f.tiene_cr) {
        incompletos++;
      }
      continue;
    }
    const key = String(f.alta).trim() + '|' + normalizarProveedor(f.prov_no);
    const candidatos = mapa[key];
    if (!candidatos || candidatos.length === 0) continue; // sin candidato: no se toca, se queda como estaba (Con o Sin CR, y su alerta previa se conserva)
    const importeCapturado = Number(f.importe);
    const comprobanteGuardado = f.comprobante ? String(f.comprobante).trim() : '';
    const exacto = candidatos.find((c) => Math.abs(c.importe - importeCapturado) < 0.01 && c.comprobante);
    if (exacto) {
      const yaEstabaIgual = f.tiene_cr && comprobanteGuardado === exacto.comprobante && Math.abs(importeCapturado - exacto.importe) < 0.01 && !f.alerta_importe;
      if (!yaEstabaIgual) {
        actualizaciones.push({ id: f.id, tiene_cr: true, fecha_cr: new Date().toISOString(), comprobante: exacto.comprobante, alerta_importe: null });
        if (f.tiene_cr) corregidos++; else encontrados++;
        if (f.alerta_importe) alertasLimpiadas++;
      }
    } else if (candidatos.length === 1) {
      const unico = candidatos[0];
      const upd = { id: f.id };
      let cambia = false;
      if (unico.comprobante && (!f.tiene_cr || comprobanteGuardado !== unico.comprobante)) {
        upd.tiene_cr = true;
        upd.fecha_cr = new Date().toISOString();
        upd.comprobante = unico.comprobante;
        if (f.tiene_cr) corregidos++; else encontrados++;
        cambia = true;
      }
      const importeCoincide = Math.abs(unico.importe - importeCapturado) < 0.01;
      if (!importeCoincide) {
        upd.alerta_importe = `5005 registra $${unico.importe} vs $${importeCapturado} capturado — corrige el importe`;
        alertasImporte++;
        cambia = true;
      } else if (f.alerta_importe) {
        // El importe ya coincide ahora — si tenía una alerta de importe vieja, se limpia.
        upd.alerta_importe = null;
        alertasLimpiadas++;
        cambia = true;
      }
      if (cambia) actualizaciones.push(upd);
    } else if (!f.tiene_cr) {
      const mensaje = `Hay ${candidatos.length} registros en 5005 con esta Alta+Proveedor y ninguno coincide en importe — revisar a mano`;
      if (f.alerta_importe !== mensaje) actualizaciones.push({ id: f.id, alerta_importe: mensaje });
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
  return NextResponse.json({ ok: true, encontrados, corregidos, alertasImporte, ambiguos, incompletos, alertasLimpiadas });
}
