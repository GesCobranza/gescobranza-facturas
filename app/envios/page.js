'use client';

import { useState, useEffect } from 'react';

const NAVY = '#232B3E';
const VERDE = '#227056';
const AMBAR = '#B8791A';
const ROJO = '#C23B3B';
const GRIS = '#6E7178';

function mny(n) {
  return '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtFecha(v) {
  if (!v) return '';
  const s = String(v).slice(0, 10).split('-');
  return s.length === 3 ? s[2] + '/' + s[1] + '/' + s[0] : '';
}

function hoyISO() {
  const a = new Date();
  const dd = (n) => String(n).padStart(2, '0');
  return a.getFullYear() + '-' + dd(a.getMonth() + 1) + '-' + dd(a.getDate());
}

// El p90 medido de envio a contra recibo es de 14 dias. Ese es el umbral real,
// no una meta inventada: pasado eso, el paquete ya se salio de lo normal.
const META_DIAS = 14;

const ESTATUS = [
  { v: 'sin_verificar', txt: 'Sin verificar', color: GRIS,  fondo: '#F1F2F5' },
  { v: 'en_transito',   txt: 'En tránsito',   color: AMBAR, fondo: '#FBF0DD' },
  { v: 'entregada',     txt: 'Entregada',     color: VERDE, fondo: '#E7F5EE' },
  { v: 'no_entregada',  txt: 'No entregada',  color: ROJO,  fondo: '#FBEAEA' },
];

const PERSONAS = ['Gabriel', 'Sophie', 'Mariano', 'Sari', 'Sarahi'];

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
  const [sinGuia, setSinGuia] = useState([]);
  const [guiaPend, setGuiaPend] = useState({});

  // ---- Rastreo de paquetes con guia ----
  const [rastreo, setRastreo] = useState([]);
  const [quienVerifica, setQuienVerifica] = useState('');
  const [filtroRastreo, setFiltroRastreo] = useState('pendientes');
  const [guardandoEst, setGuardandoEst] = useState('');

  useEffect(() => {
    fetch('/api/catalogos')
      .then((r) => r.json())
      .then((d) => setDelegaciones(d.delegaciones || []))
      .catch(() => setDelegaciones([]));
    const q = new URLSearchParams(window.location.search);
    const desdeLiga = q.get('delegacion');
    if (desdeLiga) setDelegacion(desdeLiga);
    cargarPendientes();
    cargarRastreo();
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

  async function cargarPendientes() {
    try {
      const r = await fetch('/api/envios?delegacion=' + encodeURIComponent('__pendientes__'));
      const d = await r.json();
      setSinGuia(d.ok ? (d.sinGuia || []) : []);
    } catch (e) {
      setSinGuia([]);
    }
  }

  async function cargarRastreo() {
    try {
      const r = await fetch('/api/envios?rastreo=1');
      const d = await r.json();
      setRastreo(d.ok ? (d.rastreo || []) : []);
    } catch (e) {
      setRastreo([]);
    }
  }

  async function guardarGuia(envioId) {
    const g = String(guiaPend[envioId] || '').trim();
    if (!g) return;
    const res = await fetch('/api/envios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'asignar_guia', envioId: envioId, guia: g }),
    });
    const d = await res.json();
    if (!d.ok) { setMensaje({ tipo: 'err', txt: d.error || 'No se pudo guardar la guía.' }); return; }
    setGuiaPend({ ...guiaPend, [envioId]: '' });
    setMensaje({ tipo: 'ok', txt: '✓ Guía registrada.' });
    cargarPendientes();
    cargarRastreo();
  }

  async function marcarEstatus(envioId, estatus) {
    if (!quienVerifica && estatus !== 'sin_verificar') {
      setMensaje({ tipo: 'err', txt: 'Elige primero quién está verificando, arriba de la lista.' });
      return;
    }
    setGuardandoEst(envioId);
    try {
      const res = await fetch('/api/envios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'estatus_entrega', envioId: envioId,
          estatus: estatus, verificadoPor: quienVerifica,
        }),
      });
      const d = await res.json();
      if (!d.ok) setMensaje({ tipo: 'err', txt: d.error || 'No se pudo guardar el estatus.' });
      else await cargarRastreo();
    } catch (e) {
      setMensaje({ tipo: 'err', txt: 'Error de conexión: ' + (e.message || e) });
    }
    setGuardandoEst('');
  }

  function diasDesde(iso) {
    if (!iso) return 0;
    return Math.round((new Date() - new Date(String(iso).slice(0, 10) + 'T12:00:00')) / 86400000);
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
        cargarPendientes();
        cargarRastreo();
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

  const rastreoVisible = filtroRastreo === 'todos'
    ? rastreo
    : rastreo.filter((e) => e.estatus_entrega === 'sin_verificar' || e.estatus_entrega === 'en_transito');
  const fueraMeta = rastreo.filter((e) => diasDesde(e.fecha_envio) > META_DIAS).length;
  const importeRastreo = rastreoVisible.reduce((s, e) => s + Number(e.importe || 0), 0);

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 20px 80px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <a href="/?tab=gestores" className="btn btn-ghost btn-sm" style={{ display: 'inline-block', marginBottom: 16, textDecoration: 'none' }}>← Regresar a Seguimiento Envío</a>

      <h1 style={{ fontSize: 22, color: NAVY, marginBottom: 4 }}>Registrar envío por paquetería</h1>
      <p style={{ color: GRIS, fontSize: 14, marginTop: 0, marginBottom: 24 }}>
        Elige la delegación, captura la guía y marca las facturas que van en el paquete.
      </p>

      {sinGuia.length > 0 && (
        <div style={{ border: '1px solid #EFDCB3', borderRadius: 10, padding: 20, background: '#FBF0DD', marginBottom: 18 }}>
          <h2 style={{ fontSize: 15, color: '#9A5B00', marginTop: 0, marginBottom: 4 }}>
            {sinGuia.length} paquete(s) esperando su guía
          </h2>
          <p style={{ fontSize: 12.5, color: '#9A5B00', margin: '0 0 14px' }}>
            Ya salieron desde Seguimiento Envío. Captura el número que te dio la paquetería.
          </p>
          {sinGuia.map((e) => {
            const d = diasDesde(e.fecha_envio);
            return (
              <div key={e.id} style={{ background: '#fff', border: '1px solid #EFDCB3', borderRadius: 8, padding: '12px 14px', marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: NAVY }}>{e.delegacion}</div>
                    <div style={{ fontSize: 12, color: GRIS, marginTop: 2 }}>
                      {e.facturas} factura(s) · {Number(e.importe || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                      {' · salió el '}{String(e.fecha_envio).slice(8, 10)}/{String(e.fecha_envio).slice(5, 7)}
                      {d > 1 && <b style={{ color: d > 3 ? ROJO : '#9A5B00' }}>{' · hace ' + d + ' días'}</b>}
                    </div>
                    {e.enviado_por && <div style={{ fontSize: 11.5, color: GRIS }}>enviado por {e.enviado_por}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                    <input value={guiaPend[e.id] || ''} onChange={(ev) => setGuiaPend({ ...guiaPend, [e.id]: ev.target.value })}
                      onKeyDown={(ev) => { if (ev.key === 'Enter') guardarGuia(e.id); }}
                      placeholder="No. de guía" style={{ width: 160, fontSize: 13.5 }} />
                    <button type="button" onClick={() => guardarGuia(e.id)} disabled={!String(guiaPend[e.id] || '').trim()}
                      style={{ padding: '9px 16px', border: 'none', borderRadius: 7,
                        background: String(guiaPend[e.id] || '').trim() ? VERDE : '#B9BCC2',
                        color: '#fff', fontSize: 13, fontWeight: 600,
                        cursor: String(guiaPend[e.id] || '').trim() ? 'pointer' : 'default' }}>
                      Guardar
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ border: '1px solid #E3E6EC', borderRadius: 10, padding: 20, background: '#fff', marginBottom: 18 }}>
        <h2 style={{ fontSize: 15, color: NAVY, marginTop: 0, marginBottom: 14 }}>Registrar un paquete nuevo</h2>
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
              {PERSONAS.map((p) => <option key={p} value={p}>{p}</option>)}
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
          color: mensaje.tipo === 'ok' ? VERDE : ROJO,
        }}>{mensaje.txt}</div>
      )}

      <div style={{ border: '1px solid #E3E6EC', borderRadius: 10, background: '#fff', overflow: 'hidden', marginBottom: 18 }}>
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
                    <th style={{ padding: '8px 10px', textAlign: 'left', color: GRIS, fontWeight: 600 }}>Capturada</th>
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
                      <td style={{ padding: '7px 10px', color: GRIS }}>{fmtFecha(f.fecha_captura)}</td>
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
                  <span style={{ fontSize: 12.5, color: AMBAR }}>Falta capturar: {faltantes.join(', ')}</span>
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

      {/* ================================================================
          RASTREO: paquetes con guia que siguen sin contra recibo.
          Se pica el numero de guia, abre Paquetexpress en pestaña nueva,
          y se marca aqui lo que diga la pagina.
         ================================================================ */}
      <div style={{ border: '1px solid #E3E6EC', borderRadius: 10, background: '#fff', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #E3E6EC' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ fontSize: 15, color: NAVY, margin: 0 }}>Rastreo de paquetes enviados</h2>
              <p style={{ fontSize: 12.5, color: GRIS, margin: '3px 0 0' }}>
                Con guía registrada y todavía sin contra recibo. Pica la guía para abrir Paquetexpress.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <select value={quienVerifica} onChange={(e) => setQuienVerifica(e.target.value)}
                style={{ fontSize: 13, width: 'auto', borderColor: quienVerifica ? undefined : '#E0A6A6' }}>
                <option value="">— quién verifica —</option>
                {PERSONAS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <button type="button" onClick={() => setFiltroRastreo(filtroRastreo === 'todos' ? 'pendientes' : 'todos')}
                style={{ padding: '7px 13px', border: '1px solid #E3E6EC', borderRadius: 7, background: '#fff',
                  color: NAVY, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                {filtroRastreo === 'todos' ? 'Ver solo por verificar' : 'Ver todos'}
              </button>
            </div>
          </div>
          <div style={{ fontSize: 12.5, color: GRIS, marginTop: 10 }}>
            {rastreoVisible.length} paquete(s) · <b style={{ color: NAVY }}>{mny(importeRastreo)}</b>
            {fueraMeta > 0 && <b style={{ color: ROJO }}>{' · ' + fueraMeta + ' con más de ' + META_DIAS + ' días'}</b>}
          </div>
        </div>

        {rastreoVisible.length === 0 && (
          <p style={{ padding: 18, fontSize: 13.5, color: GRIS, margin: 0 }}>
            No hay paquetes por verificar.
          </p>
        )}

        {rastreoVisible.map((e) => {
          const d = diasDesde(e.fecha_envio);
          const tarde = d > META_DIAS;
          const est = ESTATUS.find((x) => x.v === e.estatus_entrega) || ESTATUS[0];
          return (
            <div key={e.id} style={{
              padding: '13px 18px', borderTop: '1px solid #F1F2F5',
              borderLeft: '3px solid ' + (tarde ? ROJO : '#E3E6EC'),
              background: tarde ? '#FDF7F7' : '#fff',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ minWidth: 260 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: NAVY }}>{e.delegacion}</div>
                  <div style={{ marginTop: 4 }}>
                    <a href={'https://www.paquetexpress.com.mx/rastreo/' + encodeURIComponent(e.guia)}
                       target="_blank" rel="noopener noreferrer"
                       style={{ fontSize: 14, fontFamily: 'monospace', fontWeight: 600 }}>
                      {e.guia} ↗
                    </a>
                  </div>
                  <div style={{ fontSize: 12, color: GRIS, marginTop: 3 }}>
                    Salió el {fmtFecha(e.fecha_envio)} ·{' '}
                    <b style={{ color: tarde ? ROJO : GRIS }}>{d} días</b>
                    {' · '}{e.facturas} factura(s) · {mny(e.importe)}
                  </div>
                  {e.enviado_por && <div style={{ fontSize: 11.5, color: GRIS }}>enviado por {e.enviado_por}</div>}
                  {e.guia_repetida && (
                    <div style={{ fontSize: 11.5, color: ROJO, background: '#FBEAEA', borderRadius: 5, padding: '3px 7px', marginTop: 5, display: 'inline-block' }}>
                      ⚠ Esta guía está en más de un paquete — revisa el acuse antes de marcar
                    </div>
                  )}
                  {e.verificado_por && (
                    <div style={{ fontSize: 11.5, color: GRIS, marginTop: 4 }}>
                      Verificó {e.verificado_por} el {fmtFecha(e.fecha_verificacion)}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: est.color, background: est.fondo, borderRadius: 5, padding: '3px 9px' }}>
                    {est.txt}
                  </span>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {ESTATUS.filter((x) => x.v !== 'sin_verificar').map((x) => (
                      <button key={x.v} type="button" disabled={guardandoEst === e.id}
                        onClick={() => marcarEstatus(e.id, x.v)}
                        style={{
                          padding: '6px 11px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                          cursor: guardandoEst === e.id ? 'default' : 'pointer',
                          border: '1px solid ' + (e.estatus_entrega === x.v ? x.color : '#E3E6EC'),
                          background: e.estatus_entrega === x.v ? x.color : '#fff',
                          color: e.estatus_entrega === x.v ? '#fff' : x.color,
                        }}>
                        {x.txt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
