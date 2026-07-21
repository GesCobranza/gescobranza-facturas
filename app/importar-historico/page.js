'use client';
import { useState } from 'react';
import * as XLSX from 'xlsx';

export default function ImportarHistorico() {
  const [archivo, setArchivo] = useState(null);
  const [filasLeidas, setFilasLeidas] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const [resultado, setResultado] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [resultadoCorreccion, setResultadoCorreccion] = useState(null);

  function formatearFecha(valor) {
    if (!valor) return null;
    if (valor instanceof Date && !isNaN(valor)) return valor.toISOString().slice(0, 10);
    const intento = new Date(valor);
    if (!isNaN(intento)) return intento.toISOString().slice(0, 10);
    return null;
  }

  async function leerArchivo() {
    if (!archivo) { setMensaje('Selecciona primero tu archivo de Excel.'); return; }
    setMensaje('Leyendo archivo…');
    setResultado(null);
    try {
      const buffer = await archivo.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
      const hoja = wb.Sheets[wb.SheetNames[0]];
      const filasCrudas = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: '' });

      let idxHeader = -1, colMap = {};
      for (let i = 0; i < Math.min(filasCrudas.length, 10); i++) {
        const fila = filasCrudas[i].map((c) => String(c).toLowerCase().trim());
        const g = fila.findIndex((c) => c.includes('grupo'));
        const e = fila.findIndex((c) => c.includes('empresa') || c.includes('proveedor') || c.includes('laboratorio'));
        const d = fila.findIndex((c) => c.includes('delegac') || c.includes('ooad') || c.includes('umae'));
        const a = fila.findIndex((c) => c.includes('alta'));
        const imp = fila.findIndex((c) => c.includes('importe'));
        if (g > -1 && e > -1 && d > -1 && a > -1 && imp > -1) {
          idxHeader = i;
          colMap = {
            grupo: g, empresa: e, delegacion: d, alta: a, importe: imp,
            capturista: fila.findIndex((c) => c.includes('capturista')),
            fechaRecepcion: fila.findIndex((c) => c.includes('fecha')),
            pdf: fila.findIndex((c) => c.includes('pdf') || c.includes('factura')),
            provNo: fila.findIndex((c) => c.includes('prov') && (c.includes('no') || c.includes('num'))),
          };
          break;
        }
      }
      if (idxHeader === -1) {
        setMensaje('No encontré las columnas obligatorias (Grupo, Empresa, Delegación, Alta, Importe) en las primeras filas. Revisa que tu archivo tenga esos encabezados.');
        return;
      }

      const filas = [];
      for (let i = idxHeader + 1; i < filasCrudas.length; i++) {
        const fila = filasCrudas[i];
        if (!fila || fila.every((c) => c === '')) continue;
        filas.push({
          grupo: fila[colMap.grupo] || '',
          empresa: fila[colMap.empresa] || '',
          delegacion: fila[colMap.delegacion] || '',
          alta: fila[colMap.alta] || '',
          importe: parseFloat(String(fila[colMap.importe]).replace(/[^0-9.\-]/g, '')),
          capturista: colMap.capturista > -1 ? fila[colMap.capturista] : '',
          fechaRecepcion: colMap.fechaRecepcion > -1 ? formatearFecha(fila[colMap.fechaRecepcion]) : null,
          pdf: colMap.pdf > -1 ? fila[colMap.pdf] : '',
          provNo: colMap.provNo > -1 ? fila[colMap.provNo] : '',
        });
      }

      setFilasLeidas(filas);
      setMensaje(`Se leyeron ${filas.length} filas del archivo. Revisa el resumen abajo y confirma para importar.`);
    } catch (err) {
      setMensaje('Error leyendo el archivo: ' + err.message);
    }
  }

  async function confirmarImportacion() {
    if (!filasLeidas || filasLeidas.length === 0) return;
    setProcesando(true);
    setMensaje('Importando…');
    try {
      const res = await fetch('/api/importar-historico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filas: filasLeidas }),
      });
      const data = await res.json();
      setProcesando(false);
      if (data.ok) {
        setResultado(data);
        setMensaje('');
        setFilasLeidas(null);
      } else {
        setMensaje('Error: ' + (data.error || 'No se pudo importar.'));
      }
    } catch (err) {
      setProcesando(false);
      setMensaje('Error de conexión: ' + err.message);
    }
  }

  async function corregirPdf() {
    if (!filasLeidas || filasLeidas.length === 0) return;
    setCorrigiendo(true);
    setMensaje('Corrigiendo PDF/Susceptible…');
    setResultadoCorreccion(null);
    try {
      const res = await fetch('/api/importar-historico/corregir-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filas: filasLeidas }),
      });
      const data = await res.json();
      setCorrigiendo(false);
      if (data.ok) {
        setResultadoCorreccion(data);
        setMensaje('');
      } else {
        setMensaje('Error: ' + (data.error || 'No se pudo corregir.'));
      }
    } catch (err) {
      setCorrigiendo(false);
      setMensaje('Error de conexión: ' + err.message);
    }
  }

  function descargarOmitidas() {
    if (!resultado || !resultado.detalleOmitidas || resultado.detalleOmitidas.length === 0) return;
    const datos = resultado.detalleOmitidas.map((o) => ({
      'Fila (Excel)': o.fila,
      'Alta': o.alta,
      'Motivo': o.motivo,
      'Categoría': o.categoria === 'revisar' ? 'Requiere revisión' : 'Informativo (normal)',
    }));
    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Omitidas');
    XLSX.writeFile(wb, 'facturas-omitidas.xlsx');
  }

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <div className="mark">CR</div>
          <div>
            <h1>Ges Cobranza</h1>
            <p>Importar histórico de facturas</p>
          </div>
        </div>
      </header>

      <div className="card">
        <h2>1. Cargar archivo</h2>
        <p className="muted" style={{ marginBottom: 12 }}>
          Debe tener columnas con encabezados que incluyan: Grupo, Empresa (o Proveedor), Delegación (u OOAD/UMAE), Alta,
          Importe. Opcionalmente: Capturista, Fecha de recepción, PDF/Factura, No. de proveedor.
          Todas las filas entran marcadas como <b>Sin CR</b> — el estatus real se actualiza corriendo el Cruce 5005 después.
        </p>
        <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setArchivo(e.target.files[0] || null)} />
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-primary" onClick={leerArchivo}>Leer archivo</button>
        </div>
        {mensaje && <p className="muted" style={{ marginTop: 10 }}>{mensaje}</p>}
      </div>

      {filasLeidas && filasLeidas.length > 0 && (
        <div className="card">
          <h2>2. Confirmar</h2>
          <p className="muted" style={{ marginBottom: 12 }}>
            Se detectaron <b>{filasLeidas.length}</b> filas. Vista previa de las primeras 5:
          </p>
          <table>
            <thead><tr><th>Grupo</th><th>Empresa</th><th>Delegación</th><th>Alta</th><th>Importe</th></tr></thead>
            <tbody>
              {filasLeidas.slice(0, 5).map((f, i) => (
                <tr key={i}>
                  <td>{f.grupo}</td><td>{f.empresa}</td><td>{f.delegacion}</td><td>{f.alta}</td>
                  <td>{isNaN(f.importe) ? '—' : f.importe.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={confirmarImportacion} disabled={procesando || corrigiendo}>
              {procesando ? 'Importando…' : `Confirmar e importar ${filasLeidas.length} filas`}
            </button>
            <button className="btn btn-ghost" onClick={corregirPdf} disabled={procesando || corrigiendo}>
              {corrigiendo ? 'Corrigiendo…' : 'Corregir PDF/Susceptible de las que ya existen'}
            </button>
          </div>
          <p className="muted" style={{ marginTop: 8 }}>
            El botón de corrección solo actualiza el campo PDF/Susceptible de facturas que ya están en el sistema —
            nunca toca el estatus de CR ni el comprobante. Úsalo cuando este mismo archivo trae datos de PDF más
            correctos que los que ya tienes guardados.
          </p>
          {resultadoCorreccion && (
            <div className="alert ok" style={{ marginTop: 12 }}>
              ✓ {resultadoCorreccion.corregidas} facturas corregidas · {resultadoCorreccion.sinCambios} ya estaban bien ·{' '}
              {resultadoCorreccion.noEncontradas} no existían todavía en el sistema.
            </div>
          )}
        </div>
      )}

      {resultado && (
        <div className="card">
          <div className="card-header-row">
            <h2>Resultado de la importación</h2>
            {resultado.omitidas > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={descargarOmitidas}>Descargar Excel completo</button>
            )}
          </div>
          <div className="alert ok">✓ {resultado.insertadas} facturas importadas correctamente.</div>
          {resultado.omitidasInformativo > 0 && (
            <p className="muted">
              {resultado.omitidasInformativo} filas se saltaron solas sin necesitar nada de ti (ya existían en el sistema o
              estaban repetidas dentro del mismo archivo — normal, no requieren revisión).
            </p>
          )}
          {resultado.omitidasRevisar > 0 ? (
            <>
              <div className="alert error">{resultado.omitidasRevisar} filas sí necesitan tu revisión:</div>
              <table>
                <thead><tr><th>Fila (Excel)</th><th>Alta</th><th>Motivo</th></tr></thead>
                <tbody>
                  {resultado.detalleOmitidas.filter((o) => o.categoria === 'revisar').slice(0, 50).map((o, i) => (
                    <tr key={i}><td>{o.fila}</td><td>{o.alta}</td><td>{o.motivo}</td></tr>
                  ))}
                </tbody>
              </table>
              {resultado.omitidasRevisar > 50 && (
                <p className="muted">Mostrando las primeras 50 en pantalla — descarga el Excel completo para verlas todas.</p>
              )}
            </>
          ) : (
            resultado.omitidas > 0 && <div className="alert ok">✓ Ninguna fila requiere revisión — todo lo demás se saltó por ser normal (duplicados).</div>
          )}
        </div>
      )}
    </div>
  );
}
