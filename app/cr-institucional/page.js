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

export default function CentroDeCargas() {
  const [archivos, setArchivos] = useState([]);
  const [mostrarAvanzadas, setMostrarAvanzadas] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [bitacora, setBitacora] = useState([]);

  // ---- Bloque 5005 ----
  const [files5005, setFiles5005] = useState([]);
  const [msg5005, setMsg5005] = useState('');
  const [cruceMsg, setCruceMsg] = useState('');
  const [cruzando, setCruzando] = useState(false);
  const [confirmarCruce, setConfirmarCruce] = useState(false);
  const [alineacion, setAlineacion] = useState(null);

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

    const provs = Array.from(new Set(filas.map((f) => f.prov_no_norm)));
    return { fuente: fuente, filas: filas, nombreArchivo: nombreArchivo, provs: provs };
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

  async function vaciarTodo() {
    if (!window.confirm('Esto borra TODO el histórico de contra recibos, incluido lo pagado. ¿Continuar?')) return;
    setTrabajando(true);
    setBitacora([]);
    try {
      const res = await fetch('/api/cr-institucional', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'vaciar' }),
      });
      const json = await res.json();
      log(json.ok ? 'Histórico borrado. Vuelve a cargar el 4004 desde enero.' : ('Error: ' + json.error), json.ok ? 'ok' : 'err');
    } catch (e) {
      log('Error: ' + (e.message || e), 'err');
    }
    setTrabajando(false);
  }

  async function procesar() {
    if (archivos.length === 0) return;
    setTrabajando(true);
    setBitacora([]);

    try {
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
          // Los pendientes (1003) se reemplazan completos por proveedor: un CR
          // programado puede cancelarse o cambiar de fecha. Lo pagado nunca se borra.
          if (r.fuente === '1003') {
            for (const prov of r.provs) {
              await fetch('/api/cr-institucional', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accion: 'limpiar_pendientes_proveedor', provNorm: prov }),
              });
            }
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

  async function cargarArchivo5005() {
    if (!files5005 || files5005.length === 0) {
      setMsg5005('Selecciona primero el archivo (o archivos) del 5005.');
      return;
    }
    let totalCargadas = 0;
    let primerBloqueGlobal = true;
    try {
      for (let f = 0; f < files5005.length; f++) {
        const archivo = files5005[f];
        setMsg5005('Leyendo archivo ' + (f + 1) + ' de ' + files5005.length + ': ' + archivo.name + '…');
        const buffer = await archivo.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const hoja = wb.Sheets[wb.SheetNames[0]];
        const filasCrudas = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: '' });

        let idxHeader = -1, colProv = -1, colAlta = -1, colImporte = -1, colComp = -1, colUn = -1;
        for (let i = 0; i < Math.min(filasCrudas.length, 10); i++) {
          const fila = filasCrudas[i].map((c) => String(c).toLowerCase().trim());
          const p = fila.findIndex((c) => c.includes('proveedor'));
          const al = fila.findIndex((c) => c.includes('ent alm') || c === 'alta');
          const imp = fila.findIndex((c) => c.includes('importe'));
          const comp = fila.findIndex((c) => c.includes('comprobante'));
          if (p > -1 && al > -1 && imp > -1 && comp > -1) {
            idxHeader = i; colProv = p; colAlta = al; colImporte = imp; colComp = comp;
            // La unidad (UN AP) identifica la OOAD o UMAE real de cada alta
            colUn = fila.findIndex((c) => c === 'un ap' || c.startsWith('un ap'));
            break;
          }
        }
        if (idxHeader === -1) {
          setMsg5005('⚠ El archivo "' + archivo.name + '" no tiene las columnas esperadas — se omitió. Cargadas hasta ahora: ' + totalCargadas + ' filas.');
          continue;
        }

        const filas = [];
        for (let i = idxHeader + 1; i < filasCrudas.length; i++) {
          const fila = filasCrudas[i];
          const proveedor = String(fila[colProv] || '').trim();
          const alta = String(fila[colAlta] || '').trim();
          const importeNum = parseFloat(String(fila[colImporte]).replace(/[^0-9.\-]/g, ''));
          const comprobante = String(fila[colComp] || '').trim();
          if (!alta || !proveedor || isNaN(importeNum)) continue;
          const unAp = colUn > -1 ? String(fila[colUn] || '').trim() : '';
          filas.push({ proveedor, alta, importe: importeNum, comprobante, un_ap: unAp || null });
        }

        if (filas.length === 0) {
          setMsg5005('⚠ El archivo "' + archivo.name + '" no tiene filas de datos válidas — se omitió. Cargadas hasta ahora: ' + totalCargadas + ' filas.');
          continue;
        }

        const TAMANO_BLOQUE = 2000;
        const bloques = [];
        for (let i = 0; i < filas.length; i += TAMANO_BLOQUE) bloques.push(filas.slice(i, i + TAMANO_BLOQUE));

        for (let b2 = 0; b2 < bloques.length; b2++) {
          setMsg5005('Archivo ' + (f + 1) + ' de ' + files5005.length + ' (' + archivo.name + ') — bloque ' + (b2 + 1) + ' de ' + bloques.length + '… (' + totalCargadas + ' filas cargadas)');
          const res = await fetch('/api/raw5005', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filas: bloques[b2], primerBloque: primerBloqueGlobal }),
          });
          const data = await res.json();
          if (!data.ok) {
            setMsg5005('Error en "' + archivo.name + '", bloque ' + (b2 + 1) + ': ' + data.error + '. Se cargaron ' + totalCargadas + ' filas antes del error.');
            return;
          }
          totalCargadas += data.cargadas;
          primerBloqueGlobal = false;
        }
      }
      setMsg5005('✓ Carga terminada: ' + totalCargadas + ' filas de ' + files5005.length + ' archivo(s). Ya puedes cruzar.');
    } catch (err) {
      setMsg5005('Error leyendo los archivos: ' + err.message);
    }
  }

  async function revisarDelegaciones(aplicar) {
    try {
      const res = await fetch('/api/alinear-delegaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aplicar: aplicar }),
      });
      const d = await res.json();
      setAlineacion(d.ok ? { ...d.resultado, aplicado: aplicar && d.resultado.total > 0 } : null);
    } catch (e) {
      setAlineacion(null);
    }
  }

  async function cruzarCon5005() {
    setCruzando(true);
    setConfirmarCruce(false);
    setCruceMsg('Cruzando…');
    try {
      const res = await fetch('/api/cruce5005', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        const totalTexto = data.totalConAlertaActual !== null && data.totalConAlertaActual !== undefined
          ? ' · Total con alerta de importe activa AHORA en toda la base: ' + data.totalConAlertaActual + ' (debe coincidir con "Solo con observaciones" en Consulta).'
          : '';
        setCruceMsg('Cruce terminado: ' + data.encontrados + ' CR encontrados, ' + data.corregidos + ' corregidos, ' + data.alertasLimpiadas + ' alertas viejas limpiadas, ' + data.alertasImporte + ' alertas nuevas, ' + data.pendientesImss + ' facturas sin comprobante asignado por el IMSS, ' + data.ambiguos + ' casos ambiguos, ' + data.incompletos + ' filas incompletas.' + totalTexto);
        // Con el 5005 recién cargado se revisa si alguna factura quedó en la delegación equivocada
        await revisarDelegaciones(false);
      } else {
        setCruceMsg('Error: ' + data.error);
      }
    } catch (err) {
      setCruceMsg('Error de conexión: ' + err.message);
    } finally {
      setCruzando(false);
    }
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 20px 80px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <a href="/" className="btn btn-ghost btn-sm" style={{ display: 'inline-block', marginBottom: 16, textDecoration: 'none' }}>← Regresar al menú principal</a>

      <h1 style={{ fontSize: 22, color: NAVY, marginBottom: 4 }}>Centro de Cargas</h1>
      <p style={{ color: GRIS, fontSize: 14, marginTop: 0, marginBottom: 26 }}>
        Todos los reportes institucionales en un solo lugar. Cada bloque es independiente.
      </p>

      <h2 style={{ fontSize: 16, color: NAVY, marginBottom: 4 }}>1 · Reporte 5005 y cruce</h2>
      <p style={{ color: '#9A5B00', fontSize: 13.5, marginTop: 0, marginBottom: 14, background: '#FBF0DD', border: '1px solid #EFDCB3', borderRadius: 8, padding: '10px 13px' }}>
        Se corre primero: el 5005 es el único reporte que liga cada alta con su número de contra recibo. El cruce <b>modifica tus facturas</b> — las marca Con contra recibo y no se puede deshacer.
      </p>

      <div style={{ border: '1px solid #E3E6EC', borderRadius: 10, padding: 22, background: '#fff' }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: NAVY, marginBottom: 8 }}>Archivo 5005 (.xls o .xlsx)</label>
        <input type="file" multiple accept=".xls,.xlsx" onChange={(e) => setFiles5005(Array.from(e.target.files || []))} disabled={cruzando} style={{ fontSize: 14 }} />
        {files5005.length > 0 && <p style={{ fontSize: 13, color: GRIS, marginTop: 10 }}>{files5005.length} archivo(s) seleccionado(s)</p>}

        <div style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={cargarArchivo5005} disabled={cruzando || files5005.length === 0}
            style={{ padding: '11px 22px', border: 'none', borderRadius: 7, background: cruzando || files5005.length === 0 ? '#B9BCC2' : NAVY, color: '#fff', fontSize: 14, fontWeight: 600, cursor: cruzando || files5005.length === 0 ? 'default' : 'pointer' }}>
            Paso 1 · Cargar 5005
          </button>

          {!confirmarCruce && (
            <button onClick={() => setConfirmarCruce(true)} disabled={cruzando}
              style={{ padding: '11px 22px', border: '1px solid #E3E6EC', borderRadius: 7, background: '#fff', color: NAVY, fontSize: 14, fontWeight: 600, cursor: cruzando ? 'default' : 'pointer' }}>
              Paso 2 · Ejecutar cruce
            </button>
          )}
          {confirmarCruce && (
            <button onClick={cruzarCon5005} disabled={cruzando}
              style={{ padding: '11px 22px', border: 'none', borderRadius: 7, background: '#C23B3B', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Sí, cruzar y marcar facturas
            </button>
          )}
          {confirmarCruce && (
            <button onClick={() => setConfirmarCruce(false)}
              style={{ padding: '11px 22px', border: '1px solid #E3E6EC', borderRadius: 7, background: '#fff', color: GRIS, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Cancelar
            </button>
          )}
        </div>

        {msg5005 && <p style={{ fontSize: 13, color: GRIS, marginTop: 14, fontFamily: 'monospace', lineHeight: 1.6 }}>{msg5005}</p>}
        {cruceMsg && <p style={{ fontSize: 13, color: NAVY, marginTop: 10, fontFamily: 'monospace', lineHeight: 1.6 }}>{cruceMsg}</p>}

        {alineacion && alineacion.total === 0 && (
          <p style={{ fontSize: 13, color: VERDE, marginTop: 10 }}>✓ Todas las facturas coinciden con la delegación que reporta el IMSS.</p>
        )}
        {alineacion && alineacion.total > 0 && (
          <div style={{ marginTop: 12, padding: '12px 14px', background: '#FBF0DD', border: '1px solid #EFDCB3', borderRadius: 8 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#9A5B00', marginBottom: 6 }}>
              ⚠ {alineacion.total} factura(s) están en una delegación distinta a la que reporta el IMSS
            </div>
            {(alineacion.detalle || []).slice(0, 8).map((d, i) => (
              <div key={i} style={{ fontSize: 12.5, color: GRIS, lineHeight: 1.7 }}>
                {d.facturas} · {d.vieja} → <b style={{ color: NAVY }}>{d.correcta}</b>
              </div>
            ))}
            {!alineacion.aplicado && (
              <button type="button" onClick={() => revisarDelegaciones(true)}
                style={{ marginTop: 10, padding: '8px 16px', border: 'none', borderRadius: 7, background: VERDE, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Corregirlas ahora
              </button>
            )}
            {alineacion.aplicado && (
              <div style={{ fontSize: 13, color: VERDE, fontWeight: 600, marginTop: 8 }}>✓ Corregidas. Quedó respaldo de cada cambio.</div>
            )}
          </div>
        )}
      </div>

      <h2 style={{ fontSize: 16, color: NAVY, marginTop: 34, marginBottom: 4 }}>2 · Reportes 1003 y 4004</h2>
      <p style={{ color: GRIS, fontSize: 13.5, marginTop: 0, marginBottom: 14 }}>
        Se cargan después del cruce: le dan a cada contra recibo su fecha de emisión, pago programado, fecha de pago y referencia bancaria.
        Detecta solo si cada archivo es 1003 (pendiente) o 4004 (pagado) — suelta los de todos los proveedores juntos. No modifica tus facturas.
        <br /><b>1003:</b> siempre completo. <b>4004:</b> 15 días atrás y 45 adelante.
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

      <div style={{ marginTop: 14 }}>
        <button type="button" onClick={() => setMostrarAvanzadas(!mostrarAvanzadas)}
          style={{ background: 'none', border: 'none', color: GRIS, fontSize: 12.5, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
          {mostrarAvanzadas ? 'Ocultar opciones avanzadas' : 'Opciones avanzadas'}
        </button>
        {mostrarAvanzadas && (
          <div style={{ marginTop: 10, padding: '12px 14px', background: '#FBF0DD', border: '1px solid #EFDCB3', borderRadius: 8 }}>
            <p style={{ fontSize: 12.5, color: '#9A5B00', margin: '0 0 10px' }}>
              Borra <b>todo</b> el histórico de contra recibos, incluido lo ya pagado. Úsalo solo si los datos se corrompieron:
              tendrás que volver a cargar el 4004 desde enero.
            </p>
            <button type="button" onClick={vaciarTodo} disabled={trabajando}
              style={{ padding: '8px 16px', border: 'none', borderRadius: 7, background: '#C23B3B', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Borrar todo el histórico
            </button>
          </div>
        )}
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
