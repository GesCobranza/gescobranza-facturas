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
    // Solo audita facturas que YA tienen CR — nunca toca ni modifica nada, solo compara y reporta.
    facturas = await traerTodas(supabase, 'facturas', (q) => q.eq('tiene_cr', true));
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

  const discrepancias = [];
  let sinCandidato = 0;
  let coinciden = 0;

  for (const f of facturas) {
    if (!f.alta || !f.prov_no) continue;
    const key = String(f.alta).trim() + '|' + normalizarProveedor(f.prov_no);
    const candidatos = mapa[key];
    if (!candidatos || candidatos.length === 0) {
      sinCandidato++;
      continue; // esta alta no aparece en el 5005 actual — no es necesariamente un error, puede que ese proveedor no venga en el archivo cargado
    }
    const importeGuardado = Number(f.importe);
    const comprobanteGuardado = f.comprobante ? String(f.comprobante).trim() : '';
    const coincideExacto = candidatos.some(
      (c) => c.comprobante === comprobanteGuardado && Math.abs(c.importe - importeGuardado) < 0.01
    );
    if (coincideExacto) {
      coinciden++;
    } else {
      discrepancias.push({
        id: f.id,
        alta: f.alta,
        empresa: f.empresa,
        grupo: f.grupo,
        comprobanteGuardado,
        importeGuardado,
        candidatos5005: candidatos,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    totalAuditadas: facturas.length,
    coinciden,
    sinCandidato,
    discrepancias,
  });
}
