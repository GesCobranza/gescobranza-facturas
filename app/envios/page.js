'use client';

import { useState, useEffect } from 'react';

const NAVY = '#232B3E';
const VERDE = '#227056';
const GRIS = '#6E7178';

function mny(n) {
  return '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function hoyISO() {
  const a = new Date();
  const dd = (n) => String(n).padStart(2, '0');
  return a.getFullYear() + '-' + dd(a.getMonth() + 1) + '-' + dd(a.getDate());
}

export default function RegistrarEnvio() {
  const [delegaciones, setDelegaciones] = useState([]);
  const [delegacion, setDelegacion] = useState('');
  const [guia, setGuia] = useState('');
  const [fechaEnvio, setFechaEnvio] = useState(hoyISO());
  const [enviadoPor, setEnviadoPor] = useState('');
  const [notas, setNotas] = useState('');

  const [facturas, setFacturas] = useState([]);
  const [seleccion, setSeleccion] = useState({});
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  useEffect(() => {
    fetch('/api/catalogos')
      .then((r) => r.json())
      .then((d) => setDelegaciones(d.delegaciones || []))
      .catch(() => setDelegaciones([]));
    // Si se llegó desde Seguimiento Envío, la delegación viene en la liga.
    const q = new URLSearchParams(window.location.search);
    const desdeLiga = q.get('delegacion');
    if (desdeLiga) setDelegacion(desdeLiga);
  }, []);

  useEffect(() => {
    if (!delegacion) { setFacturas([]); setSeleccion({}); return; }
    setCargando(true);
    setMensaje(null);
    fetch('/api/envios?delegacion=' + encodeURIComponent(delegacion))
      .then((r) => r.json())
      .then((d) => {
        const lista = d.ok ? d.facturas : [];
        setFacturas(lista);
        const sel = {};
        lista.forEach((f) => { sel[f.id] = true; });
        setSeleccion(sel);
      })
      .catch(() => setFacturas([]))
      .finally(() => setCargando(false));
  }, [delegacion]);

  const elegidas = facturas.filter((f) => seleccion[f.id]);
  const total = elegidas.reduce((s, f) => s + Number(f.importe || 0), 0);
  const labs = new Set(elegidas.map((f) => f.empresa)).size;
  const grupos = new Set(elegidas.map((f) => f.grupo)).size;
  const todas = facturas.length > 0 && elegidas.length === facturas.length;

  const faltantes = [];
  if (!delegacion) faltantes.push('la delegación');
  if (!guia.trim()) faltantes.push('el número de guía');
  if (!fechaEnvio) faltantes.push('la fecha de envío');
  if (!enviadoPor) faltantes.push('quién lo envía');
  if (elegidas.length === 0) faltantes.push('al menos una factura');
  const listo = faltantes.length === 0;

  function alternarTodas() {
    const sel = {};
    if (!todas) facturas.forEach((f) => { sel[f.id] = true; });
    setSeleccion(sel);
  }

  async function registrar() {
    if (!listo) return;
    setGuardando(true);
    setMensaje(null);
    try {
      const res = await fetch('/api/envios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delegacion, guia, fechaEnvio, enviadoPor, notas,
          ids: elegidas.map((f) => f.id),
        }),
      });
      const d = await res.json();
      if (!d.ok) {
        setMensaje({ tipo: 'err', txt: d.error || 'No se pudo registrar el envío.' });
      } else {
        const aviso = d.marcadas !== d.solicitadas
          ? ' Atención: se pidieron ' + d.solicitadas + ' pero solo se marcaron ' + d.marcadas + ' (alguna ya tenía envío registrado).'
          : '';
        setMensaje({ tipo: 'ok', txt: '✓ Envío registrado: ' + d.marcadas + ' facturas' + (guia ? ' · guía ' + guia : '') + '.' + aviso });
        setGuia('');
        setNotas('');
        const r2 = await fetch('/api/envios?delegacion=' + encodeURIComponent(delegacion));
        const d2 = await r2.json();
        const lista = d2.ok ? d2.facturas : [];
        setFacturas(lista);
        const sel = {};
        lista.forEach((f) => { sel[f.id] = true; });
        setSeleccion(sel);
      }
    } catch (e) {
      setMensaje({ tipo: 'err', txt: 'Error de conexión: ' + (e.message || e) });
    }
    setGuardando(false);
  }

  const campo = { fontSize: 14, width: '100%' };
  const etiqueta = { display: 'block', fontSize: 12.5, color: GRIS, marginBottom: 4 };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 20px 80px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <a href="/?tab=gestores" className="btn btn-ghost btn-sm" style={{ display: 'inline-block', marginBottom: 16, textDecoration: 'none' }}>← Regresar a Seguimiento Envío</a>

      <h1 style={{ fontSize: 22, color: NAVY, marginBottom: 4 }}>Registrar envío por paquetería</h1>
      <p style={{ color: GRIS, fontSize: 14, marginTop: 0, marginBottom: 24 }}>
        Elige la delegación, captura la guía y marca las facturas que van en el paquete.
      </p>

      <div style={{ border: '1px solid #E3E6EC', borderRadius: 10, padding: 20, background: '#fff', marginBottom: 18 }}>
        <h2 style={{ fontSize: 15, color: NAVY, marginTop: 0, marginBottom: 14 }}>Datos del paquete</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
          <div>
            <label style={etiqueta}>Delegación</label>
            <select value={delegacion} onChange={(e) => setDelegacion(e.target.value)} style={campo}>
              <option value="">— selecciona —</option>
              {delegaciones.map((d) => <option key={d.nombre} value={d.nombre}>{d.nombre}</option>)}
            </select>
          </div>
          <div>
            <label style={etiqueta}>No. de guía</label>
            <input value={guia} onChange={(e) => setGuia(e.target.value)} placeholder="Ej. 7749208311" style={{ ...campo, borderColor: guia.trim() ? undefined : '#E0A6A6' }} />
          </div>
          <div>
            <label style={etiqueta}>Fecha de envío</label>
            <input type="date" value={fechaEnvio} onChange={(e) => setFechaEnvio(e.target.value)} style={campo} />
          </div>
          <div>
            <label style={etiqueta}>Enviado por</label>
            <select value={enviadoPor} onChange={(e) => setEnviadoPor(e.target.value)} style={{ ...campo, borderColor: enviadoPor ? undefined : '#E0A6A6' }}>
              <option value="">— quién lo envía —</option>
              <option value="Gabriel">Gabriel</option>
              <option value="Sophie">Sophie</option>
              <option value="Mariano">Mariano</option>
              <option value="Sari">Sari</option>
              <option value="Sarahi">Sarahi</option>
            </select>
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <label style={etiqueta}>Notas (opcional)</label>
          <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Cualquier observación del paquete" style={campo} />
        </div>
        <p style={{ fontSize: 12.5, color: GRIS, marginTop: 12, marginBottom: 0 }}>Paquetería: <b>Paquetexpress</b></p>
      </div>

      {mensaje && (
        <div style={{
          padding: '11px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13.5,
          background: mensaje.tipo === 'ok' ? '#E7F5EE' : '#FBEAEA',
          color: mensaje.tipo === 'ok' ? VERDE : '#C23B3B',
        }}>{mensaje.txt}</div>
      )}

      <div style={{ border: '1px solid #E3E6EC', borderRadius: 10, background: '#fff', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #E3E6EC' }}>
          <h2 style={{ fontSize: 15, color: NAVY, margin: 0 }}>Facturas por enviar a esta delegación</h2>
          <p style={{ fontSize: 12.5, color: GRIS, margin: '3px 0 0' }}>Capturadas, sin contra recibo y sin envío registrado</p>
        </div>

        {!delegacion && <p style={{ padding: 18, fontSize: 13.5, color: GRIS, margin: 0 }}>Elige una delegación para ver sus facturas pendientes.</p>}
        {delegacion && cargando && <p style={{ padding: 18, fontSize: 13.5, color: GRIS, margin: 0 }}>Cargando…</p>}
        {delegacion && !cargando && facturas.length === 0 && (
          <p style={{ padding: 18, fontSize: 13.5, color: GRIS, margin: 0 }}>No hay facturas pendientes de envío en esta delegación.</p>
        )}

        {facturas.length > 0 && (
          <>
            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead style={{ position: 'sticky', top: 0, background: '#F7F8FA' }}>
                  <tr>
                    <th style={{ padding: '8px 10px', textAlign: 'left', width: 34 }}>
                      <input type="checkbox" checked={todas} onChange={alternarTodas} style={{ width: 'auto', margin: 0 }} />
                    </th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', color: GRIS, fontWeight: 600 }}>Alta</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', color: GRIS, fontWeight: 600 }}>Laboratorio</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', color: GRIS, fontWeight: 600 }}>Grupo</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', color: GRIS, fontWeight: 600 }}>PDF</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', color: GRIS, fontWeight: 600 }}>Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {facturas.map((f) => (
                    <tr key={f.id} style={{ borderTop: '1px solid #F1F2F5' }}>
                      <td style={{ padding: '7px 10px' }}>
                        <input type="checkbox" checked={!!seleccion[f.id]}
                          onChange={(e) => setSeleccion({ ...seleccion, [f.id]: e.target.checked })}
                          style={{ width: 'auto', margin: 0 }} />
                      </td>
                      <td style={{ padding: '7px 10px', fontFamily: 'monospace' }}>{f.alta}</td>
                      <td style={{ padding: '7px 10px', color: GRIS }}>{f.empresa}</td>
                      <td style={{ padding: '7px 10px', color: GRIS }}>{f.grupo}</td>
                      <td style={{ padding: '7px 10px', color: GRIS }}>{f.pdf || ''}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right' }}>{mny(f.importe)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ padding: '14px 18px', borderTop: '1px solid #E3E6EC', background: '#F7F8FA', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <span style={{ fontSize: 13.5, color: GRIS }}>
                {elegidas.length} seleccionadas · {labs} laboratorio(s) · {grupos} grupo(s) · <b style={{ color: NAVY }}>{mny(total)}</b>
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                {!listo && (
                  <span style={{ fontSize: 12.5, color: '#B8791A' }}>Falta capturar: {faltantes.join(', ')}</span>
                )}
                <button onClick={registrar} disabled={guardando || !listo}
                  style={{
                    padding: '11px 22px', border: 'none', borderRadius: 7,
                    background: guardando || !listo ? '#B9BCC2' : VERDE,
                    color: '#fff', fontSize: 14, fontWeight: 600,
                    cursor: guardando || !listo ? 'default' : 'pointer',
                  }}>
                  {guardando ? 'Registrando…' : 'Registrar envío'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
