'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import * as XLSX from 'xlsx';

export default function PortalGrupo() {
  const params = useParams();
  const grupo = decodeURIComponent(params.grupo);

  const [clave, setClave] = useState('');
  const [autenticado, setAutenticado] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [error, setError] = useState('');

  const [delegaciones, setDelegaciones] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [tab, setTab] = useState('panel');

  // ---- Consulta ----
  const [cFiltroDeleg, setCFiltroDeleg] = useState('');
  const [cFiltroProvNo, setCFiltroProvNo] = useState('');
  const [cFiltroEstatus, setCFiltroEstatus] = useState('');
  const [cOrden, setCOrden] = useState('reciente');
  const [cBusquedaInput, setCBusquedaInput] = useState('');
  const [cBusqueda, setCBusqueda] = useState('');
  const [cPagina, setCPagina] = useState(1);
  const [consultaData, setConsultaData] = useState({ facturas: [], total: 0 });
  const [consultaCargando, setConsultaCargando] = useState(false);
  const [exportando, setExportando] = useState(false);

  // Contra recibo — ventana emergente
  const [crAbierto, setCrAbierto] = useState(null);
  const CONSULTA_POR_PAGINA = 50;

  // ---- Panel KPI ----
  const [kFiltroDeleg, setKFiltroDeleg] = useState('');
  const [kFiltroProvNo, setKFiltroProvNo] = useState('');
  const [kpiData, setKpiData] = useState(null);
  const [kpiCargando, setKpiCargando] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { setCBusqueda(cBusquedaInput); setCPagina(1); }, 400);
    return () => clearTimeout(t);
  }, [cBusquedaInput]);

  useEffect(() => {
    if (autenticado && tab === 'consulta') cargarConsulta();
  }, [autenticado, tab, cFiltroDeleg, cFiltroProvNo, cFiltroEstatus, cOrden, cBusqueda, cPagina]);

  useEffect(() => {
    if (autenticado && tab === 'panel') cargarKpi();
  }, [autenticado, tab, kFiltroDeleg, kFiltroProvNo]);

  async function ingresar(e) {
    e.preventDefault();
    setError('');
    setVerificando(true);
    try {
      const res = await fetch('/api/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grupo, clave }),
      });
      const data = await res.json();
      if (data.ok) {
        setDelegaciones(data.delegaciones || []);
        setEmpresas(data.empresas || []);
        setAutenticado(true);
      } else {
        setError(data.error || 'Grupo o clave incorrectos.');
      }
    } catch (err) {
      setError('Error de conexión. Intenta de nuevo.');
    }
    setVerificando(false);
  }

  async function cargarConsulta() {
    setConsultaCargando(true);
    const res = await fetch('/api/portal/consulta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grupo, clave,
        delegacion: cFiltroDeleg || null, provNo: cFiltroProvNo || null, estatus: cFiltroEstatus || null, orden: cOrden,
        busqueda: cBusqueda || null,
        pagina: cPagina, porPagina: CONSULTA_POR_PAGINA,
      }),
    });
    const data = await res.json();
    if (data.ok) setConsultaData({ facturas: data.facturas, total: data.total });
    setConsultaCargando(false);
  }

  async function cargarKpi() {
    setKpiCargando(true);
    const res = await fetch('/api/portal/kpi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grupo, clave, delegacion: kFiltroDeleg || null, provNo: kFiltroProvNo || null }),
    });
    const data = await res.json();
    if (data.ok) setKpiData(data);
    setKpiCargando(false);
  }

  async function exportarExcel() {
    setExportando(true);
    const res = await fetch('/api/portal/consulta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grupo, clave, exportar: true,
        delegacion: cFiltroDeleg || null, provNo: cFiltroProvNo || null, estatus: cFiltroEstatus || null, orden: cOrden,
        busqueda: cBusqueda || null,
      }),
    });
    const data = await res.json();
    const filas = (data.facturas || []).map((f) => ({
      Alta: f.alta, Empresa: f.empresa, Delegación: f.delegacion,
      Importe: Number(f.importe), CR: f.tiene_cr ? 'Con CR' : 'Sin CR',
      Comprobante: f.comprobante || '', 'Fecha Captura': f.fecha_captura || '',
    }));
    const ws = XLSX.utils.json_to_sheet(filas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Consulta');
    XLSX.writeFile(wb, `facturas-${grupo}.xlsx`);
    setExportando(false);
  }

  function selloFecha() {
    const a = new Date();
    const dd = (n) => String(n).padStart(2, '0');
    return { f: dd(a.getDate()) + '/' + dd(a.getMonth() + 1) + '/' + a.getFullYear(), h: dd(a.getHours()) + ':' + dd(a.getMinutes()) + ':' + dd(a.getSeconds()) };
  }

  function crPartes(iso) {
    if (!iso) return ['', '', ''];
    const p = String(iso).split('-');
    return p.length === 3 ? [p[2], p[1], p[0]] : ['', '', ''];
  }

  function crMoney(n) {
    if (n === null || n === undefined || n === '') return '';
    return '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' MXN';
  }

  async function abrirContraRecibo(comprobante) {
    setCrAbierto({ cargando: true });
    try {
      const res = await fetch('/api/portal/contra-recibo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grupo, clave, comprobante }),
      });
      const data = await res.json();
      if (!data.ok) setCrAbierto({ error: data.error || 'Contra recibo no disponible.' });
      else setCrAbierto(Object.assign({}, data, { impreso: selloFecha() }));
    } catch (e) {
      setCrAbierto({ error: 'No se pudo abrir el contra recibo.' });
    }
  }

  const totalPaginasConsulta = Math.max(1, Math.ceil((consultaData.total || 0) / CONSULTA_POR_PAGINA));

  if (!autenticado) {
    return (
      <div className="app" style={{ maxWidth: 460, paddingTop: 60 }}>
        <div className="portal-hero">
          <div className="portal-hero-strip"></div>
          <div className="portal-hero-body">
            <div className="brandline">
              <img src="/logo_full_horizontal.svg" alt="Gestión Especializada en Cobranza" style={{ height: 64, width: 'auto', flexShrink: 0 }} />
            </div>
            <div className="eyebrow">Portal de cliente</div>
            <h1>{grupo}</h1>
            <p className="sub">Consulta el avance de tu cobranza y el estatus de tus facturas en un solo lugar.</p>
          </div>
        </div>
        <div className="card">
          <h2>Acceso al portal</h2>
          {error && <div className="alert error">{error}</div>}
          <form onSubmit={ingresar}>
            <div className="field" style={{ marginBottom: 16 }}>
              <label>Clave de acceso</label>
              <input
                type="password"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                placeholder="Clave proporcionada por Ges Cobranza"
                autoFocus
              />
            </div>
            <button className="btn btn-primary" disabled={verificando || !clave}>
              {verificando ? 'Verificando…' : 'Entrar'}
            </button>
          </form>
        </div>
        <p className="muted" style={{ textAlign: 'center', marginTop: 14 }}>✉ atencion@gescobranza.com &nbsp;·&nbsp; ☎ 56 4734 7117</p>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="portal-hero">
        <div className="portal-hero-strip"></div>
        <div className="portal-hero-body">
          <div className="brandline">
            <img src="/logo_full_horizontal.svg" alt="Gestión Especializada en Cobranza" style={{ height: 64, width: 'auto', flexShrink: 0 }} />
          </div>
          <div className="eyebrow">Portal de cliente</div>
          <h1>Bienvenido, {grupo}</h1>
          <p className="sub">Aquí tienes el estatus completo de tus facturas y el avance de tu cobranza, actualizado en tiempo real.</p>
        </div>
      </div>

      <nav className="tabs">
        <button className={tab === 'consulta' ? 'active' : ''} onClick={() => setTab('consulta')}>Consulta</button>
        <button className={tab === 'panel' ? 'active' : ''} onClick={() => setTab('panel')}>Panel KPI</button>
      </nav>

      {tab === 'consulta' && (
        <div className="card">
          <div className="toolbar" style={{ justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0 }}>Registros</h2>
            <button className="btn btn-ghost btn-sm" onClick={exportarExcel} disabled={exportando}>
              {exportando ? 'Generando…' : 'Descargar Excel'}
            </button>
          </div>
          <div className="toolbar">
            <input
              value={cBusquedaInput}
              onChange={(e) => setCBusquedaInput(e.target.value)}
              placeholder="Buscar por número de alta o folio de factura…"
              style={{ minWidth: 280 }}
            />
          </div>
          <div className="toolbar">
            <select value={cFiltroProvNo} onChange={(e) => { setCFiltroProvNo(e.target.value); setCPagina(1); }}>
              <option value="">Todos los proveedores</option>
              {empresas.map((e) => <option key={e.numero} value={e.numero}>{e.nombre}</option>)}
            </select>
            <select value={cFiltroDeleg} onChange={(e) => { setCFiltroDeleg(e.target.value); setCPagina(1); }}>
              <option value="">Todas las delegaciones</option>
              {delegaciones.map((d) => <option key={d.nombre} value={d.nombre}>{d.nombre}</option>)}
            </select>
            <select value={cFiltroEstatus} onChange={(e) => { setCFiltroEstatus(e.target.value); setCPagina(1); }}>
              <option value="">Todos los estatus</option>
              <option value="con_cr">Con CR</option>
              <option value="sin_cr">Sin CR</option>
            </select>
            <select value={cOrden} onChange={(e) => { setCOrden(e.target.value); setCPagina(1); }}>
              <option value="reciente">Más reciente primero</option>
              <option value="importe_desc">Importe: mayor a menor</option>
              <option value="importe_asc">Importe: menor a mayor</option>
            </select>
          </div>
          {consultaCargando ? <p className="muted">Cargando…</p> : (
            <>
              <table>
                <thead><tr><th>Alta</th><th>Empresa</th><th>Delegación</th><th>Importe</th><th>CR</th><th>Comprobante</th></tr></thead>
                <tbody>
                  {consultaData.facturas.map((f) => (
                    <tr key={f.id}>
                      <td>{f.alta}</td><td>{f.empresa}</td><td>{f.delegacion}</td>
                      <td>${Number(f.importe).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                      <td>{f.tiene_cr ? <span className="tag tag-green">Con CR</span> : <span className="tag tag-amber">Sin CR</span>}</td>
                      <td>
                        {f.comprobante || '—'}
                        {f.comprobante && (
                          <div><a href="#" onClick={(e) => { e.preventDefault(); abrirContraRecibo(f.comprobante); }}>📄 Ver contra recibo</a></div>
                        )}
                        {f.alerta_importe && <div className="muted" style={{ color: 'var(--red)' }}>{f.alerta_importe}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="toolbar" style={{ justifyContent: 'space-between', marginTop: 12 }}>
                <p className="muted">{consultaData.total} registros con estos filtros.</p>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button className="btn btn-ghost btn-sm" disabled={cPagina <= 1} onClick={() => setCPagina((p) => p - 1)}>Anterior</button>
                  <span className="muted">Página {cPagina} de {totalPaginasConsulta}</span>
                  <button className="btn btn-ghost btn-sm" disabled={cPagina >= totalPaginasConsulta} onClick={() => setCPagina((p) => p + 1)}>Siguiente</button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'panel' && (
        <>
          <div className="card">
            <div className="toolbar">
              <select value={kFiltroProvNo} onChange={(e) => setKFiltroProvNo(e.target.value)}>
                <option value="">Todos los proveedores</option>
                {empresas.map((e) => <option key={e.numero} value={e.numero}>{e.nombre}</option>)}
              </select>
              <select value={kFiltroDeleg} onChange={(e) => setKFiltroDeleg(e.target.value)}>
                <option value="">Todas las delegaciones</option>
                {delegaciones.map((d) => <option key={d.nombre} value={d.nombre}>{d.nombre}</option>)}
              </select>
            </div>
          </div>

          {kpiCargando || !kpiData ? <p className="muted">Cargando…</p> : (
            <>
              <div className="kpi-ring-row">
                <div className="card-hero kpi-ring-card">
                  <div className="kpi-ring-wrap">
                    <svg viewBox="0 0 160 160">
                      <circle cx="80" cy="80" r="68" fill="none" stroke="var(--green-soft)" strokeWidth="14" />
                      <circle
                        cx="80" cy="80" r="68" fill="none" stroke="var(--green)" strokeWidth="14" strokeLinecap="round"
                        strokeDasharray="427"
                        strokeDashoffset={427 - (427 * (kpiData.total ? Math.round((kpiData.con_cr / kpiData.total) * 100) : 0)) / 100}
                      />
                    </svg>
                    <div className="kpi-ring-center">
                      <div className="kpi-ring-num">{kpiData.total ? Math.round((kpiData.con_cr / kpiData.total) * 100) : 0}%</div>
                      <div className="kpi-ring-lbl">tasa de<br />recuperación</div>
                    </div>
                  </div>
                  <div className="kpi-ring-total">{kpiData.total} facturas totales</div>
                </div>
                <div className="kpi-stat-grid">
                  <div className="kpi-stat" style={{ background: 'var(--green-soft)' }}>
                    <div className="lbl" style={{ color: 'var(--green)' }}>Con contra recibo</div>
                    <div className="num" style={{ color: 'var(--green)' }}>{kpiData.con_cr}</div>
                    <div className="sub" style={{ color: 'var(--green)' }}>${Number(kpiData.importe_con_cr).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
                  </div>
                  <div className="kpi-stat" style={{ background: 'var(--amber-soft)' }}>
                    <div className="lbl" style={{ color: 'var(--amber)' }}>Sin contra recibo</div>
                    <div className="num" style={{ color: 'var(--amber)' }}>{kpiData.sin_cr}</div>
                    <div className="sub" style={{ color: 'var(--amber)' }}>${Number(kpiData.importe_total - kpiData.importe_con_cr).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
                  </div>
                  <div className="kpi-stat" style={{ background: 'var(--card)', border: '1px solid var(--line)', gridColumn: '1 / -1' }}>
                    <div className="lbl" style={{ color: 'var(--text-soft)' }}>Importe total</div>
                    <div className="num" style={{ color: 'var(--navy)' }}>${Number(kpiData.importe_total).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
                  </div>
                </div>
              </div>

              <div className="card">
                <h2>Por delegación</h2>
                <table>
                  <thead><tr><th>Delegación</th><th>Total</th><th>Con CR</th><th>Sin CR</th><th>% avance</th></tr></thead>
                  <tbody>
                    {kpiData.por_delegacion.map((d) => (
                      <tr key={d.delegacion}>
                        <td>{d.delegacion}</td><td>{d.total}</td><td>{d.con_cr}</td><td>{d.total - d.con_cr}</td>
                        <td>{d.total ? Math.round((d.con_cr / d.total) * 100) : 0}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="card">
                <h2>Top proveedores por volumen</h2>
                <table>
                  <thead><tr><th>Proveedor</th><th>Total</th><th>Con CR</th><th>Sin CR</th><th>% avance</th><th>Importe total</th></tr></thead>
                  <tbody>
                    {kpiData.top_proveedores.map((p) => (
                      <tr key={p.prov_no}>
                        <td>{p.prov_nombre}</td><td>{p.total}</td><td>{p.con_cr}</td><td>{p.total - p.con_cr}</td>
                        <td>{p.total ? Math.round((p.con_cr / p.total) * 100) : 0}%</td>
                        <td>${Number(p.importe_total).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {crAbierto && (
        <div onClick={() => setCrAbierto(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(20,25,38,0.55)', zIndex: 999, overflowY: 'auto', padding: '28px 14px' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: 680, margin: '0 auto', background: '#fff', borderRadius: 10, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <strong style={{ fontSize: 15 }}>Contra recibo</strong>
              <button className="btn btn-ghost btn-sm" onClick={() => setCrAbierto(null)}>Cerrar</button>
            </div>
            {crAbierto.cargando && <p className="muted">Cargando…</p>}
            {crAbierto.error && <p className="muted" style={{ color: 'var(--red)' }}>{crAbierto.error}</p>}
            {crAbierto.cr && (
              <>
                <div style={{ position: 'relative', width: '100%', height: 620, border: '1px solid #E3E6EC', fontFamily: 'Arial, sans-serif', fontSize: 13, color: '#1a1a1a' }}>
                  <div style={{ position: 'absolute', left: '65%', top: '10%', lineHeight: 1.35, whiteSpace: 'nowrap' }}>{crAbierto.impreso.f}<br />{crAbierto.impreso.h}</div>
                  <div style={{ position: 'absolute', left: '1%', top: '17%', whiteSpace: 'nowrap' }}>{crAbierto.cr.un || ''}</div>
                  <div style={{ position: 'absolute', left: '27%', top: '17%', whiteSpace: 'nowrap' }}>{crAbierto.cr.origen || ''}</div>
                  <div style={{ position: 'absolute', left: '8%', top: '25%', whiteSpace: 'nowrap' }}>{crAbierto.cr.comprobante}</div>
                  <div style={{ position: 'absolute', left: '8%', top: '44%', whiteSpace: 'nowrap' }}>({crAbierto.cr.prov_no || ''}) {crAbierto.cr.prov_nombre || ''}</div>
                  <div style={{ position: 'absolute', left: '15%', top: '51%', whiteSpace: 'nowrap' }}>{crMoney(crAbierto.cr.importe_mxn)}</div>
                  <div style={{ position: 'absolute', left: '20%', top: '58%', whiteSpace: 'nowrap' }}>{crAbierto.cr.factura_texto || ''}</div>
                  <div style={{ position: 'absolute', left: '58%', top: '63%' }}>{crPartes(crAbierto.cr.fecha_emision)[0]}</div>
                  <div style={{ position: 'absolute', left: '68%', top: '63%' }}>{crPartes(crAbierto.cr.fecha_emision)[1]}</div>
                  <div style={{ position: 'absolute', left: '78%', top: '63%' }}>{crPartes(crAbierto.cr.fecha_emision)[2]}</div>
                  <div style={{ position: 'absolute', left: '58%', top: '71%' }}>{crPartes(crAbierto.cr.fecha_prog_pago)[0]}</div>
                  <div style={{ position: 'absolute', left: '68%', top: '71%' }}>{crPartes(crAbierto.cr.fecha_prog_pago)[1]}</div>
                  <div style={{ position: 'absolute', left: '78%', top: '71%' }}>{crPartes(crAbierto.cr.fecha_prog_pago)[2]}</div>
                  <div style={{ position: 'absolute', left: '37%', top: '90%', whiteSpace: 'nowrap' }}>{crAbierto.cr.usuario || ''}</div>
                </div>
                <p className="muted" style={{ marginTop: 14 }}>{crAbierto.cr.fuente === '4004' ? 'Pagado el ' + crPartes(crAbierto.cr.fecha_pago).join('/') + ' · referencia ' + (crAbierto.cr.referencia_pago || 's/r') + ' · ' + (crAbierto.cr.banco || '') : 'Pendiente de pago · programado para el ' + crPartes(crAbierto.cr.fecha_prog_pago).join('/')}</p>
                <strong style={{ fontSize: 14 }}>Facturas amparadas ({crAbierto.facturas.length})</strong>
                <table style={{ marginTop: 8 }}>
                  <thead><tr><th>Alta</th><th>Factura</th><th>Delegación</th><th>Importe</th></tr></thead>
                  <tbody>
                    {crAbierto.facturas.map((x, i) => (
                      <tr key={i}><td>{x.alta}</td><td>{x.num_factura || ''}</td><td>{x.delegacion || ''}</td><td>{crMoney(x.importe).replace(' MXN', '')}</td></tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>
      )}

      <div className="app-footer">
        <div className="contact-col">
          <div className="eyebrow">Contacto</div>
          <div className="contact-row">✉ admin@gescobranza.com</div>
          <div className="contact-row">✉ atencion@gescobranza.com</div>
          <div className="contact-row">☎ 56 4734 7117</div>
        </div>
        <div className="copy">Gestión Especializada en Cobranza</div>
      </div>
    </div>
  );
}
