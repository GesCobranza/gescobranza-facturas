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
    if (provNo) qf = qf.eq('prov_no', provNo);
    const { data: facs, error: errF } = await qf;
    if (errF) throw errF;

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
      .in('comprobante', comprobantes.slice(0, 1000));
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

    // Un contra recibo por página
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const NEGRO = rgb(0.1, 0.1, 0.1);
    const GRIS = rgb(0.45, 0.45, 0.45);

    for (const c of validos) {
      const info = claves[c.comprobante + '|' + c.prov_no_norm] || {};
      const pg = pdf.addPage([612, 792]);
      const { height } = pg.getSize();
      let y = height - 60;

      pg.drawText('INSTITUTO MEXICANO DEL SEGURO SOCIAL', { x: 50, y: y, size: 11, font: bold, color: NEGRO });
      y -= 16;
      pg.drawText('CONTRA RECIBO', { x: 50, y: y, size: 15, font: bold, color: NEGRO });
      y -= 26;
      pg.drawLine({ start: { x: 50, y: y }, end: { x: 562, y: y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
      y -= 26;

      const campo = (etq, val) => {
        pg.drawText(etq, { x: 50, y: y, size: 9, font: font, color: GRIS });
        pg.drawText(String(val == null ? '' : val), { x: 190, y: y, size: 11, font: bold, color: NEGRO });
        y -= 20;
      };

      campo('No. de contra recibo', c.comprobante);
      campo('Unidad', (c.un || '') + (c.origen ? '  ·  origen ' + c.origen : ''));
      campo('Proveedor', '(' + (c.prov_no || '') + ')  ' + (c.prov_nombre || ''));
      campo('Importe', money(c.importe_mxn));
      campo('Factura', c.factura_texto || '—');
      campo('Fecha de emision', partes(c.fecha_emision).join('/'));
      campo('Pago programado', partes(c.fecha_prog_pago).join('/'));

      if (c.fuente === '4004' && c.fecha_pago) {
        campo('Fecha de pago', partes(c.fecha_pago).join('/'));
        campo('Referencia', (c.referencia_pago || 's/r') + (c.banco ? '  ·  ' + c.banco : ''));
      }
      campo('Facturas amparadas', info.facturas || 0);
      campo('Usuario', c.usuario || '—');

      y -= 10;
      pg.drawLine({ start: { x: 50, y: y }, end: { x: 562, y: y }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
      y -= 18;
      pg.drawText(info.empresa || '', { x: 50, y: y, size: 10, font: font, color: GRIS });

      pg.drawText('Documento generado por Gestion Especializada en Cobranza  ·  gescobranza.com',
        { x: 50, y: 40, size: 7.5, font: font, color: rgb(0.6, 0.6, 0.6) });
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
