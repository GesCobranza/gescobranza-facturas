import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const TOPE = 150;

function money(n) {
  return '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function partes(iso) {
  if (!iso) return ['', '', ''];
  const p = String(iso).slice(0, 10).split('-');
  return p.length === 3 ? [p[2], p[1], p[0]] : ['', '', ''];
}

export async function POST(request) {
  try {
    const body = await request.json();
    const grupo = String(body.grupo || '').trim();
    const clave = String(body.clave || '').trim();
    const provNo = String(body.provNo || '').trim();
    const desde = body.desde || null;
    const hasta = body.hasta || null;
    const soloContar = body.soloContar === true;

    if (!grupo || !clave) {
      return Response.json({ ok: false, error: 'Falta el acceso.' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // El candado del portal: la clave debe corresponder al grupo
    const { data: g } = await supabase
      .from('claves_portal')
      .select('grupo, clave')
      .eq('grupo', grupo)
      .maybeSingle();
    if (!g || g.clave !== clave) {
      return Response.json({ ok: false, error: 'Acceso no válido.' }, { status: 401 });
    }

    // Comprobantes ligados a facturas de este grupo
    let qf = supabase
      .from('facturas')
      .select('comprobante, prov_no, empresa')
      .eq('grupo', grupo)
      .eq('tiene_cr', true)
      .not('comprobante', 'is', null)
      .limit(5000);
    const { data: facsTodos, error: errF } = await qf;
    if (errF) throw errF;
    // El proveedor viene del catálogo con ceros (0000153480) pero en facturas
    // se guarda sin ellos (153480): se compara normalizado.
    const provNorm = provNo.replace(/^0+/, '');
    const facs = provNorm
      ? (facsTodos || []).filter((f) => String(f.prov_no || '').replace(/^0+/, '') === provNorm)
      : (facsTodos || []);

    const claves = {};
    (facs || []).forEach((f) => {
      const k = f.comprobante + '|' + String(f.prov_no || '').replace(/^0+/, '');
      if (!claves[k]) claves[k] = { comprobante: f.comprobante, prov: String(f.prov_no || '').replace(/^0+/, ''), empresa: f.empresa, facturas: 0 };
      claves[k].facturas += 1;
    });

    const comprobantes = Object.values(claves).map((c) => c.comprobante);
    if (comprobantes.length === 0) {
      return Response.json({ ok: true, total: 0, importe: 0, facturas: 0, lista: [] });
    }

    // Detalle institucional, filtrado por fecha de emisión
    let qc = supabase
      .from('cr_institucional')
      .select('*')
      .in('comprobante', comprobantes.slice(0, 5000));
    if (desde) qc = qc.gte('fecha_emision', desde);
    if (hasta) qc = qc.lte('fecha_emision', hasta);
    const { data: crs, error: errC } = await qc;
    if (errC) throw errC;

    const validos = (crs || []).filter((c) => claves[c.comprobante + '|' + c.prov_no_norm]);
    validos.sort((a, b) => String(b.fecha_emision || '').localeCompare(String(a.fecha_emision || '')));

    const importe = validos.reduce((s, c) => s + Number(c.importe_mxn || 0), 0);
    const nFacturas = validos.reduce((s, c) => s + ((claves[c.comprobante + '|' + c.prov_no_norm] || {}).facturas || 0), 0);

    if (soloContar) {
      return Response.json({
        ok: true,
        total: validos.length,
        importe: importe,
        facturas: nFacturas,
        tope: TOPE,
        lista: validos.slice(0, 40).map((c) => {
          const info = claves[c.comprobante + '|' + c.prov_no_norm] || {};
          return {
            comprobante: c.comprobante,
            empresa: info.empresa || c.prov_nombre,
            fecha_emision: c.fecha_emision,
            facturas: info.facturas || 0,
            importe: Number(c.importe_mxn || 0),
          };
        }),
      });
    }

    if (validos.length === 0) {
      return Response.json({ ok: false, error: 'No hay contra recibos en ese rango.' }, { status: 400 });
    }
    if (validos.length > TOPE) {
      return Response.json({
        ok: false,
        error: 'Son ' + validos.length + ' contra recibos y el máximo por descarga es ' + TOPE + '. Reduce el rango de fechas o filtra por laboratorio.',
      }, { status: 400 });
    }

    // Un contra recibo por página, replicando el formato del IMSS:
    // un cuarto de hoja carta, pegado a la esquina superior izquierda.
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const NEGRO = rgb(0.102, 0.102, 0.102);

    const W = 306, H = 396, Y0 = 792;

    for (const c of validos) {
      const pg = pdf.addPage([612, 792]);
      const px = (v) => (v / 100) * W;
      const py = (v) => Y0 - (v / 100) * H;
      const T = (t, x, y) => pg.drawText(String(t == null ? '' : t), {
        x: px(x), y: py(y), size: 7.5, font: font, color: NEGRO,
      });

      const em = partes(c.fecha_emision);
      const pp = partes(c.fecha_prog_pago);
      const sello = partes(c.fecha_emision).join('/');

      T(sello, 65, 10);
      T(c.un, 1, 17);
      T(c.origen, 27, 17);
      T(c.comprobante, 8, 25);
      T('(' + (c.prov_no || '') + ') ' + (c.prov_nombre || ''), 8, 44);
      T(money(c.importe_mxn), 15, 51);
      T(c.factura_texto || '', 20, 58);
      T(em[0], 58, 63); T(em[1], 68, 63); T(em[2], 78, 63);
      T(pp[0], 58, 71); T(pp[1], 68, 71); T(pp[2], 78, 71);
      T(c.usuario || '', 37, 90);
    }

    const bytes = await pdf.save();
    return new Response(Buffer.from(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="contra-recibos-' + grupo + '.pdf"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return Response.json({ ok: false, error: e && e.message ? e.message : 'Error al generar el PDF.' }, { status: 500 });
  }
}
