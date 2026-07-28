import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { validarClavePortal } from '../../../../lib/portalAuth';

function normalizarProvNo(valor) {
  const limpio = String(valor || '').trim().replace(/^0+/, '');
  return limpio || '0';
}

export async function POST(request) {
  try {
    const body = await request.json();
    const grupo = String(body.grupo || '').trim();
    const clave = String(body.clave || '').trim();
    const comprobante = String(body.comprobante || '').trim();

    if (!grupo || !clave) {
      return NextResponse.json({ ok: false, error: 'Grupo o clave incorrectos.' }, { status: 401 });
    }
    if (!comprobante) {
      return NextResponse.json({ ok: false, error: 'Falta el contra recibo.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const auth = await validarClavePortal(supabase, grupo, clave);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    // Candado: solo se entrega si ese contra recibo ampara facturas DEL GRUPO AUTENTICADO.
    // El grupo nunca se toma de lo que mande el navegador sin validar antes la clave.
    const { data: facturas, error: errFac } = await supabase
      .from('facturas')
      .select('alta, num_factura, importe, delegacion, empresa, prov_no')
      .eq('grupo', grupo)
      .eq('comprobante', comprobante)
      .order('alta');

    if (errFac) throw errFac;

    if (!facturas || facturas.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Este contra recibo no corresponde a ninguna de sus facturas.' },
        { status: 404 }
      );
    }

    const provNorm = normalizarProvNo(facturas[0].prov_no);

    const { data: crs, error: errCr } = await supabase
      .from('cr_institucional')
      .select('*')
      .eq('comprobante', comprobante)
      .eq('prov_no_norm', provNorm)
      .limit(1);

    if (errCr) throw errCr;

    if (!crs || crs.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Todavía no tenemos el detalle institucional de este contra recibo.' },
        { status: 404 }
      );
    }

    const limpias = facturas.map((f) => ({
      alta: f.alta,
      num_factura: f.num_factura,
      importe: f.importe,
      delegacion: f.delegacion,
      empresa: f.empresa,
    }));

    return NextResponse.json({ ok: true, cr: crs[0], facturas: limpias });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e && e.message ? e.message : 'Error de servidor.' },
      { status: 500 }
    );
  }
}
