'use client';

import { useState, useEffect } from 'react';

const NAVY = '#232B3E';
const VERDE = '#227056';
const AMBAR = '#B8791A';
const ROJO = '#C23B3B';
const GRIS = '#6E7178';
const LINEA = '#E3E6EC';

function mny(n) {
  return '$' + Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 });
}
function mmm(n) {
  const v = Number(n || 0);
  if (v >= 1000000) return '$' + (v / 1000000).toFixed(1) + ' M';
  if (v >= 1000) return '$' + Math.round(v / 1000) + ' mil';
  return '$' + v.toFixed(0);
}
function fmtD(iso) {
  if (!iso) return '';
  const p = String(iso).slice(0, 10).split('-');
  return p.length === 3 ? p[2] + '/' + p[1] : '';
}

export default function Direccion() {
  const [clave, setClave] = useState('');
  const [entrada, setEntrada] = useState('');
  const [autenticado, setAutenticado] = useState(false);
  const [error, setError] = useState('');
  const [verificando, setVerificando] = useState(false);
  const [dias, setDias] = useState(30);
  const [rangoLibre, setRangoLibre] = useState(false);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [pulso, setPulso] = useState(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (autenticado) cargar(clave);
  }, [autenticado, dias, rangoLibre, desde, hasta]);

  // -------------------------------------------------------------------------
  // La clave viaja al servidor en cada consulta y se valida contra la base.
  // Antes se comparaba aqui en el navegador con una variable NEXT_PUBLIC_, que
  // Next.js incrusta en el codigo descargado: cualquiera la leia con F12. Y la
  // ruta /api/pulso no pedia nada, asi que la pantalla solo escondia la vista.
  // -------------------------------------------------------------------------
  async function cargar(claveUsada) {
    setCargando(true);
    try {
      const cuerpo = rangoLibre && desde && hasta
        ? { clave: claveUsada, desde: desde, hasta: hasta }
        : { clave: claveUsada, dias: dias };
      const res = await fetch('/api/pulso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      });
      const d = await res.json();
      if (!d.ok) {
        // Si la clave dejo de ser valida (por ejemplo, se roto), se regresa al login
        if (res.status === 401) {
          setAutenticado(false);
          setClave('');
          setError('La sesión expiró o la clave cambió. Vuelve a entrar.');
        }
        setPulso(null);
      } else {
        setPulso(d.pulso);
      }
    } catch (e) {
      setPulso(null);
    }
    setCargando(false);
  }

  async function entrar() {
    const c = entrada.trim();
    if (!c) { setError('Escribe la clave.'); return; }
    setVerificando(true);
    setError('');
    try {
      // Se valida pidiendo datos: si el servidor responde ok, la clave sirve.
      const res = await fetch('/api/pulso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clave: c, dias: dias }),
      });
      const d = await res.json();
      if (d.ok) {
        setClave(c);
        setPulso(d.pulso);
        setAutenticado(true);
        setEntrada('');
      } else {
        setError(d.error || 'Clave incorrecta.');
      }
    } catch (e) {
      setError('No se pudo conectar. Intenta de nuevo.');
    }
    setVerificando(false);
  }

  if (!autenticado) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F6F8', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ background: '#fff', border: '1px solid ' + LINEA, borderRadius: 12, padding: '32px 34px', width: 340 }}>
          <div style={{ fontSize: 11, letterSpacing: 1, color: VERDE, fontWeight: 700, marginBottom: 6 }}>GES COBRANZA</div>
          <h1 style={{ fontSize: 21, color: NAVY, margin: '0 0 4px' }}>Tablero de dirección</h1>
          <p style={{ fontSize: 12.5, color: GRIS, margin: '0 0 20px' }}>Acceso restringido</p>
          <input type="password" value={entrada} onChange={(e) => setEntrada(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') entrar(); }}
            placeholder="Clave" style={{ width: '100%', padding: '10px 12px', border: '1px solid ' + LINEA, borderRadius: 7, fontSize: 14 }} />
          {error && <p style={{ color: ROJO, fontSize: 12.5, marginTop: 8 }}>{error}</p>}
          <button onClick={entrar} disabled={verificando}
            style={{ width: '100%', marginTop: 14, padding: '11px', border: 'none', borderRadius: 7, background: verificando ? '#B9BCC2' : NAVY, color: '#fff', fontSize: 14, fontWeight: 600, cursor: verificando ? 'default' : 'pointer' }}>
            {verificando ? 'Verificando…' : 'Entrar'}
          </button>
        </div>
      </div>
    );
  }

  const p = pulso || {};
  const serieE = p.serie_emision || [];
  const serieC = p.serie_captura || [];
  const caps = p.por_capturista || [];

  // Capacidad: ritmo actual contra el mejor día demostrado
  const ritmo = caps.reduce((s, c) => s + Number(c.por_dia || 0), 0);
  const pico = caps.reduce((s, c) => s + Number(c.mejor_dia || 0), 0);
  const usoPct = pico ? Math.round((ritmo / pico) * 100) : 0;

  const card = { background: '#fff', border: '1px solid ' + LINEA, borderRadius: 10, padding: '16px 18px', marginBottom: 12 };
  const th = { textAlign: 'left', padding: '8px 10px', fontSize: 11, fontWeight: 600, color: GRIS, borderBottom: '1px solid ' + LINEA };
  const td = { padding: '7px 10px', fontSize: 12.5, borderBottom: '1px solid #F1F2F5' };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '26px 20px 70px', fontFamily: 'Inter, system-ui, sans-serif', background: '#F5F6F8', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 1, color: VERDE, fontWeight: 700 }}>GES COBRANZA</div>
          <h1 style={{ fontSize: 26, color: NAVY, margin: '2px 0 2px' }}>Tablero de dirección</h1>
          <p style={{ fontSize: 12.5, color: GRIS, margin: 0 }}>
            {p.desde ? 'Del ' + fmtD(p.desde) + ' al ' + fmtD(p.hasta) : 'Corte al ' + fmtD(p.hoy)}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {[7, 30, 60, 90].map((d) => (
            <button key={d} onClick={() => { setDias(d); setRangoLibre(false); }}
              style={{ padding: '7px 13px', border: '1px solid ' + LINEA, borderRadius: 7, background: (!rangoLibre && dias === d) ? NAVY : '#fff', color: (!rangoLibre && dias === d) ? '#fff' : NAVY, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
              {d} días
            </button>
          ))}
          <button onClick={() => setRangoLibre(!rangoLibre)}
            style={{ padding: '7px 13px', border: '1px solid ' + LINEA, borderRadius: 7, background: rangoLibre ? NAVY : '#fff', color: rangoLibre ? '#fff' : NAVY, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
            Rango
          </button>
          {rangoLibre && (
            <>
              <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
                style={{ padding: '6px 9px', border: '1px solid ' + LINEA, borderRadius: 7, fontSize: 12.5 }} />
              <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
                style={{ padding: '6px 9px', border: '1px solid ' + LINEA, borderRadius: 7, fontSize: 12.5 }} />
            </>
          )}
          <button onClick={() => { setAutenticado(false); setClave(''); setPulso(null); }}
            style={{ padding: '7px 13px', border: '1px solid ' + LINEA, borderRadius: 7, background: '#fff', color: GRIS, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
            Salir
          </button>
        </div>
      </div>

      {cargando && <p style={{ color: GRIS, fontSize: 13 }}>Cargando…</p>}

      {pulso && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
            <div style={card}>
              <div style={{ fontSize: 12, color: GRIS }}>Emitido hoy</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: NAVY, marginTop: 3 }}>{mmm(p.importe_hoy)}</div>
              <div style={{ fontSize: 11.5, color: GRIS }}>{p.emitidos_hoy} contra recibos</div>
            </div>
            <div style={card}>
              <div style={{ fontSize: 12, color: GRIS }}>Emitido en el periodo</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: VERDE, marginTop: 3 }}>{mmm(p.importe_periodo)}</div>
              <div style={{ fontSize: 11.5, color: GRIS }}>{p.emitidos_periodo} contra recibos</div>
            </div>
            <div style={card}>
              <div style={{ fontSize: 12, color: GRIS }}>Ritmo de captura</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: NAVY, marginTop: 3 }}>{ritmo.toFixed(0)}</div>
              <div style={{ fontSize: 11.5, color: GRIS }}>altas por día</div>
            </div>
            <div style={{ ...card, background: usoPct > 80 ? '#FBEAEA' : usoPct > 60 ? '#FBF0DD' : '#E7F1EC' }}>
              <div style={{ fontSize: 12, color: usoPct > 80 ? ROJO : usoPct > 60 ? AMBAR : VERDE }}>Capacidad usada</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: usoPct > 80 ? ROJO : usoPct > 60 ? AMBAR : VERDE, marginTop: 3 }}>{usoPct}%</div>
              <div style={{ fontSize: 11.5, color: GRIS }}>pico demostrado: {pico.toFixed(0)}/día</div>
            </div>
          </div>

          {serieE.length > 0 && (() => {
            const max = Math.max(...serieE.map((x) => Number(x.crs || 0))) * 1.12;
            const AL = 150, ANCHO = Math.max(560, serieE.length * 30);
            const paso = (ANCHO - 52) / serieE.length;
            const bw = Math.min(24, paso - 5);
            return (
              <div style={card}>
                <div style={{ fontSize: 15, fontWeight: 600, color: NAVY }}>Contra recibos emitidos por día</div>
                <div style={{ fontSize: 12, color: GRIS, marginBottom: 10 }}>Cuántos liberó el IMSS, día por día</div>
                <div style={{ overflowX: 'auto' }}>
                  <svg width={ANCHO} height={AL + 56}>
                    {[0, 0.5, 1].map((f, i) => (
                      <g key={i}>
                        <line x1="52" y1={12 + AL - AL * f} x2={ANCHO} y2={12 + AL - AL * f} stroke="#EEEEEE" />
                        <text x="0" y={12 + AL - AL * f + 4} fontSize="10" fill="#8B8D93">{Math.round(max * f)}</text>
                      </g>
                    ))}
                    {serieE.map((x, i) => {
                      const h = max ? (Number(x.crs) / max) * AL : 0;
                      return (
                        <g key={x.fecha}>
                          <rect x={52 + i * paso + (paso - bw) / 2} y={12 + AL - h} width={bw} height={Math.max(h, 1)} fill={VERDE} rx="2">
                            <title>{fmtD(x.fecha) + ' — ' + x.crs + ' contra recibos · ' + mny(x.importe)}</title>
                          </rect>
                          {(serieE.length <= 24 || i % 2 === 0) && (
                            <text x={52 + i * paso + paso / 2} y={12 + AL + 16} fontSize="9.5" fill="#8B8D93" textAnchor="middle">{fmtD(x.fecha)}</text>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>
            );
          })()}

          <div style={card}>
            <div style={{ fontSize: 15, fontWeight: 600, color: NAVY }}>Emitido por cliente</div>
            <div style={{ fontSize: 12, color: GRIS, marginBottom: 8 }}>Lo que el IMSS liberó en el periodo</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={th}>Cliente</th>
                <th style={{ ...th, textAlign: 'right' }}>Contra recibos</th>
                <th style={{ ...th, textAlign: 'right' }}>Importe</th>
                <th style={{ ...th, textAlign: 'right' }}>% del total</th>
              </tr></thead>
              <tbody>
                {(p.por_grupo || []).map((g) => (
                  <tr key={g.grupo}>
                    <td style={{ ...td, fontWeight: 600 }}>{g.grupo}</td>
                    <td style={{ ...td, textAlign: 'right', color: GRIS }}>{g.crs}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 600, color: VERDE }}>{mny(g.importe)}</td>
                    <td style={{ ...td, textAlign: 'right', color: GRIS }}>
                      {p.importe_periodo ? Math.round((Number(g.importe) / Number(p.importe_periodo)) * 100) : 0}%
                    </td>
                  </tr>
                ))}
                <tr style={{ background: VERDE, color: '#fff' }}>
                  <td style={{ ...td, fontWeight: 700, border: 'none' }}>TOTAL</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700, border: 'none' }}>{p.emitidos_periodo}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700, border: 'none' }}>{mny(p.importe_periodo)}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700, border: 'none' }}>100%</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={card}>
            <div style={{ fontSize: 15, fontWeight: 600, color: NAVY }}>Productividad del equipo</div>
            <div style={{ fontSize: 12, color: GRIS, marginBottom: 8 }}>Altas capturadas en el periodo</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={th}>Capturista</th>
                <th style={{ ...th, textAlign: 'right' }}>Altas</th>
                <th style={{ ...th, textAlign: 'right' }}>Días</th>
                <th style={{ ...th, textAlign: 'right' }}>Por día</th>
                <th style={{ ...th, textAlign: 'right' }}>Su mejor día</th>
              </tr></thead>
              <tbody>
                {caps.map((c) => (
                  <tr key={c.capturista}>
                    <td style={td}>{c.capturista}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{c.altas}</td>
                    <td style={{ ...td, textAlign: 'right', color: GRIS }}>{c.dias}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{c.por_dia}</td>
                    <td style={{ ...td, textAlign: 'right', color: GRIS }}>{c.mejor_dia}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: NAVY }}>Envíos a delegaciones</div>
                <div style={{ fontSize: 12, color: GRIS, marginBottom: 8 }}>Paquetería registrada en el periodo</div>
              </div>
              {Number(p.sin_registrar) > 0 && (
                <div style={{ fontSize: 11.5, color: AMBAR, background: '#FBF0DD', padding: '5px 10px', borderRadius: 6 }}>
                  ⚠ {p.sin_registrar} factura(s) marcadas como enviadas sin guía registrada
                </div>
              )}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
              <thead><tr>
                <th style={th}>Responsable</th>
                <th style={{ ...th, textAlign: 'right' }}>Paquetes</th>
                <th style={{ ...th, textAlign: 'right' }}>Facturas</th>
                <th style={{ ...th, textAlign: 'right' }}>Importe</th>
                <th style={{ ...th, textAlign: 'right' }}>Jornadas</th>
                <th style={{ ...th, textAlign: 'right' }}>Por jornada</th>
                <th style={{ ...th, textAlign: 'right' }}>Su mejor día</th>
              </tr></thead>
              <tbody>
                {(p.envios_resumen || []).map((e) => (
                  <tr key={e.enviado_por}>
                    <td style={{ ...td, fontWeight: 600 }}>{e.enviado_por}</td>
                    <td style={{ ...td, textAlign: 'right', color: GRIS }}>{e.paquetes}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{e.facturas}</td>
                    <td style={{ ...td, textAlign: 'right', color: VERDE }}>{mny(e.importe)}</td>
                    <td style={{ ...td, textAlign: 'right', color: GRIS }}>{e.jornadas}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{e.por_jornada}</td>
                    <td style={{ ...td, textAlign: 'right', color: GRIS }}>{e.mejor_jornada}</td>
                  </tr>
                ))}
                {(p.envios_resumen || []).length === 0 && (
                  <tr><td colSpan={7} style={{ ...td, color: GRIS }}>Sin envíos registrados en este periodo.</td></tr>
                )}
              </tbody>
            </table>

            {(p.envios_dia || []).length > 0 && (
              <>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: NAVY, marginBottom: 6 }}>Jornadas de envío</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    <th style={th}>Fecha</th>
                    <th style={th}>Responsable</th>
                    <th style={{ ...th, textAlign: 'right' }}>Paquetes</th>
                    <th style={{ ...th, textAlign: 'right' }}>Delegaciones</th>
                    <th style={{ ...th, textAlign: 'right' }}>Facturas</th>
                    <th style={{ ...th, textAlign: 'right' }}>Importe</th>
                  </tr></thead>
                  <tbody>
                    {(p.envios_dia || []).map((e) => (
                      <tr key={e.fecha}>
                        <td style={td}>{fmtD(e.fecha)}</td>
                        <td style={{ ...td, color: GRIS }}>{e.quien}</td>
                        <td style={{ ...td, textAlign: 'right', color: GRIS }}>{e.paquetes}</td>
                        <td style={{ ...td, textAlign: 'right', color: GRIS }}>{e.delegaciones}</td>
                        <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{e.facturas}</td>
                        <td style={{ ...td, textAlign: 'right', color: VERDE }}>{mny(e.importe)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>

          <div style={card}>
            <div style={{ fontSize: 15, fontWeight: 600, color: NAVY }}>Dónde presionar</div>
            <div style={{ fontSize: 12, color: GRIS, marginBottom: 8 }}>Delegaciones con más dinero sin contra recibo</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={th}>Delegación</th>
                <th style={{ ...th, textAlign: 'right' }}>Altas</th>
                <th style={{ ...th, textAlign: 'right' }}>Con CR</th>
                <th style={{ ...th, textAlign: 'right' }}>Sin CR</th>
                <th style={{ ...th, textAlign: 'right' }}>% avance</th>
              </tr></thead>
              <tbody>
                {(p.peores_delegaciones || []).map((d) => (
                  <tr key={d.delegacion}>
                    <td style={td}>{d.delegacion}</td>
                    <td style={{ ...td, textAlign: 'right', color: GRIS }}>{d.altas}</td>
                    <td style={{ ...td, textAlign: 'right', color: GRIS }}>{d.con_cr}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 600, color: AMBAR }}>{mny(d.importe_sin_cr)}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 600, color: d.pct >= 60 ? VERDE : d.pct >= 40 ? AMBAR : ROJO }}>{d.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={card}>
            <div style={{ fontSize: 15, fontWeight: 600, color: NAVY }}>Las que mejor responden</div>
            <div style={{ fontSize: 12, color: GRIS, marginBottom: 8 }}>Mayor porcentaje de contra recibos emitidos</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={th}>Delegación</th>
                <th style={{ ...th, textAlign: 'right' }}>Altas</th>
                <th style={{ ...th, textAlign: 'right' }}>% avance</th>
              </tr></thead>
              <tbody>
                {(p.mejores_delegaciones || []).map((d) => (
                  <tr key={d.delegacion}>
                    <td style={td}>{d.delegacion}</td>
                    <td style={{ ...td, textAlign: 'right', color: GRIS }}>{d.altas}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 600, color: VERDE }}>{d.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
