'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';

const NAVY = '#232B3E';
const VERDE = '#227056';
const GRIS = '#6E7178';

function norm(v) {
  return String(v == null ? '' : v).trim().replace(/^0+/, '') || '0';
}

function aFecha(v) {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) {
    return new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()))
      .toISOString()
      .slice(0, 10);
  }
  const n = Number(v);
  if (!isNaN(n) && n > 1) {
    return new Date(Math.round((n - 25569) * 86400000)).toISOString().slice(0, 10);
  }
  return null;
}

function aNum(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? null : n;
}

export default function CargaCrInstitucional() {
  const [archivos, setArchivos] = useState([]);
  const [vaciarAntes, setVaciarAntes] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [bitacora, setBitacora] = useState([]);

  function log(txt, tipo) {
    setBitacora((b) => [...b, { txt, tipo: tipo || 'info' }]);
  }

  function parsearLibro(buf, nombreArchivo) {
    const wb = XLSX.read(buf, { type: 'array' });
    const sh = wb.Sheets[wb.SheetNames[0]];
    const m = XLSX.utils.sheet_to_json(sh, { header: 1, raw: true, defval: '' });

    let filaEnc = -1;
    for (let i = 0; i < Math.min(6, m.length); i++) {
      const fila = (m[i] || []).map((x) => String(x).trim());
      if (fila.indexOf('Comprobante') !== -1) {
        filaEnc = i;
        break;
      }
    }
    if (filaEnc === -1) {
      throw new Error('No encontré la fila de encabezados (falta "Comprobante")');
    }

    const enc = (m[filaEnc] || []).map((x) => String(x).trim());
    const titulo = String((m[0] || [])[0] || '');

    let fuente = null;
    if (/pendiente/i.test(titulo)) fuente = '1003';
    else if (/pagado/i.test(titulo)) fuente = '4004';
    else fuente = enc.indexOf('Fecha Pago') !== -1 ? '4004' : '1003';

    const mapa = {};
    const filas = [];
    const vistos = {};

    for (let r = filaEnc + 1; r < m.length; r++) {
      const fila = m[r] || [];
      const v = (nombre) => {
        if (!(nombre in mapa)) mapa[nombre] = enc.indexOf(nombre);
        const i = mapa[nombre];
        return i === -1 ? '' : fila[i];
      };

      const comprobante = String(v('Comprobante') || '').trim();
      const provNo = String(v('No. Proveedor') || '').trim();
      if (!comprobante || !provNo) continue;

      const provNorm = norm(provNo);
      const llave = comprobante + '|' + provNorm;
      if (vistos[llave]) continue;
      vistos[llave] = true;

      filas.push({
        comprobante: comprobante,
        prov_no: provNo,
        prov_no_norm: provNorm,
        prov_nombre: String(v('Nombre Proveedor') || '').trim(),
        un: String(v('UN') || '').trim(),
        origen: String(v('Origen') || '').trim(),
        usuario: String(v('Usuario') || '').trim(),
        contrato: String(v('Contrato') || '').trim(),
        factura_texto: String(v('Factura') || '').trim(),
        fecha_emision: aFecha(v('Fecha Emision')),
        fecha_prog_pago: aFecha(v('Fecha Prog Pago')),
        fecha_pago: aFecha(v('Fecha Pago')),
        importe_mxn: aNum(v('Importe MXN')),
        importe_pagado: aNum(v('Importe Pagado')),
        referencia_pago: String(v('Referencia Pago') || '').trim(),
        banco: String(v('Banco') || '').trim(),
        metodo_pago: String(v('Método Pago') || v('Método') || '').trim(),
        estado_pago: String(v('Estado Pago') || '').trim(),
        fuente: fuente,
      });
    }

    return { fuente: fuente, filas: filas, nombreArchivo: nombreArchivo };
  }

  async function enviarBloques(filas) {
    const TAM = 500;
    let total = 0;
    for (let i = 0; i < filas.length; i += TAM) {
      const bloque = filas.slice(i, i + TAM);
      const res = await fetch('/api/cr-institucional', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filas: bloque }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Error del servidor');
      total += json.guardadas || 0;
    }
    return total;
  }

  async function procesar() {
    if (archivos.length === 0) return;
    setTrabajando(true);
    setBitacora([]);

    try {
      if (vaciarAntes) {
        log('Vaciando la tabla antes de cargar...');
        const res = await fetch('/api/cr-institucional', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accion: 'vaciar' }),
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || 'No se pudo vaciar');
        log('Tabla vaciada.', 'ok');
      }

      let granTotal = 0;
      let cont1003 = 0;
      let cont4004 = 0;

      for (let i = 0; i < archivos.length; i++) {
        const f = archivos[i];
        try {
          const buf = await f.arrayBuffer();
          const r = parsearLibro(buf, f.name);
          if (r.filas.length === 0) {
            log(f.name + ' — sin renglones válidos, se omite', 'warn');
            continue;
          }
          const guardadas = await enviarBloques(r.filas);
          granTotal += guardadas;
          if (r.fuente === '1003') cont1003 += guardadas;
          else cont4004 += guardadas;
          log(
            '(' + (i + 1) + '/' + archivos.length + ') ' + f.name +
              ' — reporte ' + r.fuente + ' — ' + guardadas + ' contra recibos',
            'ok'
          );
        } catch (e) {
          log(f.name + ' — ERROR: ' + (e.message || e), 'err');
        }
      }

      log(
        'Listo. Total procesado: ' + granTotal +
          ' (pendientes ' + cont1003 + ' · pagados ' + cont4004 + ')',
        'ok'
      );
    } catch (e) {
      log('ERROR GENERAL: ' + (e.message || e), 'err');
    }

    setTrabajando(false);
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 20px 80px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 22, color: NAVY, marginBottom: 4 }}>
        Carga de reportes 1003 y 4004
      </h1>
      <p style={{ color: GRIS, fontSize: 14, marginTop: 0, marginBottom: 26 }}>
        Detecta solo si cada archivo es 1003 (pendiente de pago) o 4004 (pagado).
        Puedes soltar todos los proveedores de una vez.
      </p>

      <div style={{ border: '1px solid #E3E6EC', borderRadius: 10, padding: 22, background: '#fff' }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: NAVY, marginBottom: 8 }}>
          Archivos (.xls o .xlsx)
        </label>
        <input
          type="file"
          multiple
          accept=".xls,.xlsx"
          onChange={(e) => setArchivos(Array.from(e.target.files || []))}
          disabled={trabajando}
          style={{ fontSize: 14 }}
        />
        {archivos.length > 0 && (
          <p style={{ fontSize: 13, color: GRIS, marginTop: 10 }}>
            {archivos.length} archivo(s) seleccionado(s)
          </p>
        )}

        <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            id="vaciar"
            checked={vaciarAntes}
            onChange={(e) => setVaciarAntes(e.target.checked)}
            disabled={trabajando}
          />
          <label htmlFor="vaciar" style={{ fontSize: 13, color: GRIS }}>
            Vaciar la tabla antes de cargar (recarga total desde cero)
          </label>
        </div>

        <button
          onClick={procesar}
          disabled={trabajando || archivos.length === 0}
          style={{
            marginTop: 20,
            padding: '11px 22px',
            border: 'none',
            borderRadius: 7,
            background: trabajando || archivos.length === 0 ? '#B9BCC2' : VERDE,
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            cursor: trabajando || archivos.length === 0 ? 'default' : 'pointer',
          }}
        >
          {trabajando ? 'Procesando...' : 'Cargar reportes'}
        </button>
      </div>

      {bitacora.length > 0 && (
        <div style={{ marginTop: 22, border: '1px solid #E3E6EC', borderRadius: 10, padding: 18, background: '#fff' }}>
          <h2 style={{ fontSize: 15, color: NAVY, marginTop: 0, marginBottom: 12 }}>Resultado</h2>
          {bitacora.map((b, i) => (
            <div
              key={i}
              style={{
                fontSize: 13,
                lineHeight: 1.7,
                fontFamily: 'monospace',
                color: b.tipo === 'err' ? '#C23B3B' : b.tipo === 'ok' ? VERDE : b.tipo === 'warn' ? '#B8791A' : GRIS,
              }}
            >
              {b.txt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
