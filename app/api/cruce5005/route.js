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
    // Se quitó el filtro .eq('tiene_cr', false): por decisión explícita de Gabriel, el cruce ahora
    // reevalúa TODAS las facturas contra cada carga nueva del 5005, incluyendo las que ya tienen CR.
    // Esto permite corregir CR mal asignados en cargas anteriores (por ejemplo, alta reutilizada entre
    // proveedores distintos). El riesgo aceptado: si una factura ya tenía CR asignado a mano y el 5005
    // trae un comprobante distinto para esa misma Alta+Proveedor, el nuevo valor institucional sobrescribe
    // al manual.
    facturas = await traerTodas(supabase, 'facturas');
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message });
  }
  const mapa = {};
  raw.forEach((r) => {
    if (!r.alta || !r.proveedor) return;
    const comprobante = r.comprobante ? String(r.comprobante).trim() : '';
    // Una fila sin comprobante todavía no tiene CR asignado por el IMSS — nunca puede ser un match válido,
    // así que no debe entrar al pool de candidatos.
    if (!comprobante) return;
    const key = String(r.alta).trim() + '|' + normalizarProveedor(r.proveedor);
    if (!mapa[key]) mapa[key] = [];
    const candidato = { importe: Number(r.importe) || 0, comprobante };
    const yaExiste = mapa[key].some((c) => Math.abs(c.importe - candidato.importe) < 0.01 && c.comprobante === candidato.comprobante);
    if (!yaExiste) mapa[key].push(candidato);
  });
  let encontrados = 0, alertasImporte = 0, ambiguos = 0, incompletos = 0, corregidos = 0;
  const actualizaciones = [];
  for (const f of facturas) {
    if (!f.alta || !f.prov_no || !f.importe || Number(f.importe) <= 0) {
      if (!f.tiene_cr) {
        incompletos++;
        actualizaciones.push({ id: f.id, alerta_importe: 'Falta Alta, Proveedor o Importe — no se pudo cruzar contra el 5005' });
      }
      continue;
    }
    const key = String(f.alta).trim() + '|' + normalizarProveedor(f.prov_no);
    const candidatos = mapa[key];
    if (!candidatos || candidatos.length === 0) continue; // sin candidato: no se toca, se queda como estaba (Con o Sin CR)
    const importeCapturado = Number(f.importe);
    const comprobanteGuardado = f.comprobante ? String(f.comprobante).trim() : '';
    const exacto = candidatos.find((c) => Math.abs(c.importe - importeCapturado) < 0.01 && c.comprobante);
    if (exacto) {
      // Si ya estaba exactamente así, no se reescribe (evita mover fecha_cr sin necesidad)
      const yaEstabaIgual = f.tiene_cr && comprobanteGuardado === exacto.comprobante && Math.abs(importeCapturado - exacto.importe) < 0.01;
      if (!yaEstabaIgual) {
        actualizaciones.push({ id: f.id, tiene_cr: true, fecha_cr: new Date().toISOString(), comprobante: exacto.comprobante, alerta_importe: null });
        if (f.tiene_cr) corregidos++; else encontrados++;
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
      if (Math.abs(unico.importe - importeCapturado) >= 0.01) {
        upd.alerta_importe = `5005 registra $${unico.importe} vs $${importeCapturado} capturado — corrige el importe`;
        alertasImporte++;
        cambia = true;
      }
      if (cambia) actualizaciones.push(upd);
    } else if (!f.tiene_cr) {
      // Los casos ambiguos solo se reportan para las que siguen Sin CR — para las que ya tienen CR
      // con candidatos múltiples no se sobreescribe nada automáticamente, por seguridad.
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
  return NextResponse.json({ ok: true, encontrados, corregidos, alertasImporte, ambiguos, incompletos });
}
