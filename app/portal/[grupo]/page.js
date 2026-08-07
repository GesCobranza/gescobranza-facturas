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
  const [cEmisionDias, setCEmisionDias] = useState('');
  const [cEmisionDesde, setCEmisionDesde] = useState('');
  const [cEmisionHasta, setCEmisionHasta] = useState('');
  const [cIncluirSinCr, setCIncluirSinCr] = useState(true);
  const [cOrden, setCOrden] = useState('reciente');
  const [cBusquedaInput, setCBusquedaInput] = useState('');
  const [cBusqueda, setCBusqueda] = useState('');
  const [cPagina, setCPagina] = useState(1);
  const [consultaData, setConsultaData] = useState({ facturas: [], total: 0 });
  const [consultaCargando, setConsultaCargando] = useState(false);
  const [exportando, setExportando] = useState(false);

  // Contra recibo — ventana emergente
  const [crAbierto, setCrAbierto] = useState(null);

  // Flujo de Cobranza
  const [calData, setCalData] = useState(null);
  const [calCargando, setCalCargando] = useState(false);
  const [calFiltroProvNo, setCalFiltroProvNo] = useState('');
  const [calFiltroDeleg, setCalFiltroDeleg] = useState('');
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
  }, [autenticado, tab, cFiltroDeleg, cFiltroProvNo, cFiltroEstatus, cOrden, cBusqueda, cPagina, cEmisionDias, cEmisionDesde, cEmisionHasta, cIncluirSinCr]);

  useEffect(() => {
    if (autenticado && tab === 'panel') cargarKpi();
  }, [autenticado, tab, kFiltroDeleg, kFiltroProvNo]);

  useEffect(() => {
    if (autenticado && tab === 'flujo') cargarCalendario();
  }, [autenticado, tab, calFiltroProvNo, calFiltroDeleg]);

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

  function rangoEmision() {
    if (cEmisionDias === 'rango') return { desde: cEmisionDesde || null, hasta: cEmisionHasta || null };
    if (!cEmisionDias) return { desde: null, hasta: null };
    const d = new Date();
    const hasta = d.toISOString().slice(0, 10);
    d.setDate(d.getDate() - parseInt(cEmisionDias, 10));
    return { desde: d.toISOString().slice(0, 10), hasta: hasta };
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
        emisionDesde: rangoEmision().desde, emisionHasta: rangoEmision().hasta, incluirSinCr: cIncluirSinCr,
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
        emisionDesde: rangoEmision().desde, emisionHasta: rangoEmision().hasta, incluirSinCr: cIncluirSinCr,
      }),
    });
    const data = await res.json();
    const filas = (data.facturas || []).map((f) => ({
      Alta: f.alta, Empresa: f.empresa, Delegación: f.delegacion,
      Importe: Number(f.importe), CR: f.tiene_cr ? 'Con CR' : 'Sin CR',
      Comprobante: f.comprobante || '', 'Fecha Captura': f.fecha_captura || '',
      'Fecha emisión CR': f.cr ? fmtF(f.cr.fecha_emision) : '',
      'Pago programado': f.cr ? fmtF(f.cr.fecha_prog_pago) : '',
      'Fecha de pago': f.cr && f.cr.fuente === '4004' ? fmtF(f.cr.fecha_pago) : '',
      'Referencia de pago': f.cr && f.cr.fuente === '4004' ? (f.cr.referencia_pago || '') : '',
      Banco: f.cr && f.cr.fuente === '4004' ? (f.cr.banco || '') : '',
    }));
    const ws = XLSX.utils.json_to_sheet(filas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Consulta');
    XLSX.writeFile(wb, `facturas-${grupo}.xlsx`);
    setExportando(false);
  }

  // Baja las tres tablas del panel en un solo archivo, respetando los filtros activos
  function exportarKpi() {
    if (!kpiData) return;
    const wb = XLSX.utils.book_new();
    const pct = (a, b) => (b ? Math.round((a / b) * 100) + '%' : '0%');

    const impLab = (kpiData.top_proveedores || []).map((p) => ({
      'Laboratorio': p.prov_nombre,
      'Con CR': Number(p.importe_con_cr || 0),
      'Sin CR': Number(p.importe_total || 0) - Number(p.importe_con_cr || 0),
      'Total': Number(p.importe_total || 0),
      '% avance': pct(Number(p.importe_con_cr || 0), Number(p.importe_total || 0)),
    }));
    impLab.push({
      'Laboratorio': 'TOTAL',
      'Con CR': Number(kpiData.importe_con_cr || 0),
      'Sin CR': Number(kpiData.importe_total || 0) - Number(kpiData.importe_con_cr || 0),
      'Total': Number(kpiData.importe_total || 0),
      '% avance': pct(Number(kpiData.importe_con_cr || 0), Number(kpiData.importe_total || 0)),
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(impLab), 'Importe por laboratorio');

    const altLab = (kpiData.top_proveedores || []).map((p) => ({
      'Laboratorio': p.prov_nombre,
      'Con CR': p.con_cr,
      'Sin CR': p.total - p.con_cr,
      'Total': p.total,
    }));
    altLab.push({ 'Laboratorio': 'TOTAL', 'Con CR': kpiData.con_cr, 'Sin CR': kpiData.sin_cr, 'Total': kpiData.total });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(altLab), 'Altas por laboratorio');

    const porDel = (kpiData.por_delegacion || []).map((d) => ({
      'Delegación': d.delegacion,
      'Altas': d.total,
      'Altas con CR': d.con_cr,
      'Importe con CR': Number(d.importe_con_cr || 0),
      'Importe sin CR': Number(d.importe_total || 0) - Number(d.importe_con_cr || 0),
      'Importe total': Number(d.importe_total || 0),
      '% avance': pct(Number(d.importe_con_cr || 0), Number(d.importe_total || 0)),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(porDel), 'Por delegación');

    XLSX.writeFile(wb, `indicadores-${grupo}.xlsx`);
  }

  function exportarVencidos() {
    if (!calData || !calData.vencidos || calData.vencidos.length === 0) return;
    const datos = calData.vencidos.map((v) => ({
      'Contra recibo': v.comprobante,
      'Fecha programada': fmtF(v.fecha),
      'Días vencido': v.dias_vencido,
      'Laboratorio': v.empresa || '',
      'Delegación': v.delegacion || '',
      'Facturas': v.facturas,
      'Importe': Number(v.importe_cr || 0),
    }));
    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vencidos');
    XLSX.writeFile(wb, `contra-recibos-vencidos-${grupo}.xlsx`);
  }

  // El sello del documento usa la fecha de emisión del contra recibo.
  // La hora se deriva del número de comprobante para que sea siempre la misma
  // en un mismo CR, dentro del horario de oficina (08:00 a 14:59).
  function selloDeCr(cr) {
    const dd = (n) => String(n).padStart(2, '0');
    let f = '';
    if (cr && cr.fecha_emision) {
      const p = String(cr.fecha_emision).split('-');
      if (p.length === 3) f = p[2] + '/' + p[1] + '/' + p[0];
    }
    if (!f) {
      const a = new Date();
      f = dd(a.getDate()) + '/' + dd(a.getMonth() + 1) + '/' + a.getFullYear();
    }
    let n = 0;
    const txt = String((cr && cr.comprobante) || '');
    for (let i = 0; i < txt.length; i++) n = (n * 31 + txt.charCodeAt(i)) % 100000;
    const hh = 8 + (n % 7);
    const mm = (n * 7) % 60;
    const ss = (n * 13) % 60;
    return { f: f, h: dd(hh) + ':' + dd(mm) + ':' + dd(ss) };
  }

  function crPartes(iso) {
    if (!iso) return ['', '', ''];
    const p = String(iso).split('-');
    return p.length === 3 ? [p[2], p[1], p[0]] : ['', '', ''];
  }

  function fmtF(iso) {
    if (!iso) return '';
    const p = crPartes(iso);
    return p[0] + '/' + p[1] + '/' + p[2];
  }

  function crMoney(n) {
    if (n === null || n === undefined || n === '') return '';
    return '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' MXN';
  }

  function mny(n) {
    return '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function agruparPorSemana(lista) {
    const grupos = [];
    (lista || []).forEach((d) => {
      const f = new Date(d.fecha + 'T12:00:00');
      const dow = (f.getDay() + 6) % 7;
      const lunes = new Date(f);
      lunes.setDate(f.getDate() - dow);
      const clave = lunes.toISOString().slice(0, 10);
      let g = grupos.find((x) => x.clave === clave);
      if (!g) { g = { clave: clave, dias: [], total: 0 }; grupos.push(g); }
      g.dias.push(d);
      g.total += Number(d.importe_cr || 0);
    });
    return grupos;
  }

  async function cargarCalendario() {
    setCalCargando(true);
    try {
      const res = await fetch('/api/portal/calendario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grupo, clave, semanas: 4, provNo: calFiltroProvNo || null, delegacion: calFiltroDeleg || null }),
      });
      const data = await res.json();
      setCalData(data.ok ? data.calendario : null);
    } catch (e) {
      setCalData(null);
    }
    setCalCargando(false);
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
      else setCrAbierto(Object.assign({}, data, { impreso: selloDeCr(data.cr) }));
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
        <button className={tab === 'flujo' ? 'active' : ''} onClick={() => setTab('flujo')}>Flujo de Cobranza</button>
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
              <option value="con_cr">Con contra recibo</option>
              <option value="programado">Programado a pago</option>
              <option value="pagado">Pagado</option>
              <option value="sin_detalle">Con CR, sin detalle</option>
              <option value="sin_cr">Sin contra recibo</option>
            </select>
            <select value={cOrden} onChange={(e) => { setCOrden(e.target.value); setCPagina(1); }}>
              <option value="reciente">Más reciente primero</option>
              <option value="importe_desc">Importe: mayor a menor</option>
              <option value="importe_asc">Importe: menor a mayor</option>
            </select>
          </div>
          <div className="toolbar" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="muted" style={{ fontSize: 12 }}>Contra recibos emitidos en los últimos:</span>
            <button className={cEmisionDias === '' ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'} onClick={() => { setCEmisionDias(''); setCPagina(1); }}>Todos</button>
            <button className={cEmisionDias === '7' ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'} onClick={() => { setCEmisionDias('7'); setCPagina(1); }}>7 días</button>
            <button className={cEmisionDias === '15' ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'} onClick={() => { setCEmisionDias('15'); setCPagina(1); }}>15 días</button>
            <button className={cEmisionDias === '30' ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'} onClick={() => { setCEmisionDias('30'); setCPagina(1); }}>30 días</button>
            <button className={cEmisionDias === '90' ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'} onClick={() => { setCEmisionDias('90'); setCPagina(1); }}>90 días</button>
            <button className={cEmisionDias === 'rango' ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'} onClick={() => { setCEmisionDias('rango'); setCPagina(1); }}>Rango</button>
            {cEmisionDias === 'rango' && (
              <input type="date" value={cEmisionDesde} onChange={(e) => { setCEmisionDesde(e.target.value); setCPagina(1); }} style={{ width: 'auto' }} />
            )}
            {cEmisionDias === 'rango' && (
              <input type="date" value={cEmisionHasta} onChange={(e) => { setCEmisionHasta(e.target.value); setCPagina(1); }} style={{ width: 'auto' }} />
            )}
            {cEmisionDias !== '' && (
              <label className="muted" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                <input type="checkbox" checked={cIncluirSinCr} onChange={(e) => { setCIncluirSinCr(e.target.checked); setCPagina(1); }} style={{ width: 'auto', margin: 0 }} />
                Incluir también mis facturas sin contra recibo
              </label>
            )}
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
                      <td>{!f.tiene_cr ? <span className="tag tag-amber">Sin CR</span> : f.cr && f.cr.fuente === '4004' ? <span className="tag tag-green">Pagado</span> : f.cr ? <span className="tag" style={{ background: '#EAF1FE', color: '#2F6FE4' }}>Programado</span> : <span className="tag tag-green">Con CR</span>}</td>
                      <td>
                        {f.comprobante || '—'}
                        {f.comprobante && (
                          <div><a href="#" onClick={(e) => { e.preventDefault(); abrirContraRecibo(f.comprobante); }}>📄 Ver contra recibo</a></div>
                        )}
                        {f.cr && (
                          <div className="muted" style={{ fontSize: 11.5, lineHeight: 1.55, marginTop: 2 }}>Emitido {fmtF(f.cr.fecha_emision)}{f.cr.fuente === '4004' ? ' · Pagado ' + fmtF(f.cr.fecha_pago) + (f.cr.referencia_pago ? ' · ref. ' + f.cr.referencia_pago : '') + (f.cr.banco ? ' · ' + f.cr.banco : '') : ' · Pago programado ' + fmtF(f.cr.fecha_prog_pago)}</div>
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
              <div className="card" style={{ padding: '22px 26px' }}>
                <div style={{ display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 230 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div className="muted" style={{ fontSize: 12, letterSpacing: '0.02em' }}>CARTERA GESTIONADA</div>
                    </div>
                    <div style={{ fontSize: 34, fontWeight: 600, color: 'var(--navy)', lineHeight: 1.15, marginTop: 3 }}>{mny(kpiData.importe_total)}</div>
                    <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>
                      {kpiData.total} altas · {(kpiData.top_proveedores || []).length} laboratorio(s) · {(kpiData.por_delegacion || []).length} delegación(es)
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, flexShrink: 0, marginRight: 8 }}>
                  <div className="kpi-ring-wrap" style={{ width: 124, height: 124 }}>
                    <svg viewBox="0 0 160 160">
                      <circle cx="80" cy="80" r="68" fill="none" stroke="var(--green-soft)" strokeWidth="14" />
                      <circle cx="80" cy="80" r="68" fill="none" stroke="var(--green)" strokeWidth="14" strokeLinecap="round"
                        strokeDasharray="427"
                        strokeDashoffset={427 - (427 * (kpiData.total ? Math.round((kpiData.con_cr / kpiData.total) * 100) : 0)) / 100}
                      />
                    </svg>
                    <div className="kpi-ring-center">
                      <div className="kpi-ring-num">{kpiData.total ? Math.round((kpiData.con_cr / kpiData.total) * 100) : 0}%</div>
                      <div className="kpi-ring-lbl">de las altas</div>
                    </div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={exportarKpi}>Descargar Excel</button>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--line)', marginTop: 24, paddingTop: 22, display: 'flex', gap: 40, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: 12.5, color: 'var(--green)', fontWeight: 600 }}>● Con contra recibo emitido</div>
                    <div style={{ fontSize: 23, fontWeight: 600, color: 'var(--green)', marginTop: 3 }}>{mny(kpiData.importe_con_cr)}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {kpiData.importe_total ? Math.round((kpiData.importe_con_cr / kpiData.importe_total) * 100) : 0}% del importe · {kpiData.con_cr} altas
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: 12.5, color: 'var(--amber)', fontWeight: 600 }}>● En gestión ante el IMSS</div>
                    <div style={{ fontSize: 23, fontWeight: 600, color: 'var(--amber)', marginTop: 3 }}>{mny(kpiData.importe_total - kpiData.importe_con_cr)}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {kpiData.importe_total ? Math.round(((kpiData.importe_total - kpiData.importe_con_cr) / kpiData.importe_total) * 100) : 0}% del importe · {kpiData.sin_cr} altas
                    </div>
                  </div>
                </div>
              </div>

              <div className="card">
                <h2>Importe por laboratorio</h2>
                <p className="muted" style={{ marginBottom: 10 }}>Ordenado de mayor a menor</p>
                <table>
                  <thead><tr>
                    <th>Laboratorio</th>
                    <th style={{ textAlign: 'right' }}>Con CR</th>
                    <th style={{ textAlign: 'right' }}>Sin CR</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th style={{ textAlign: 'right' }}>% avance</th>
                  </tr></thead>
                  <tbody>
                    {(kpiData.top_proveedores || []).map((p) => {
                      const cc = Number(p.importe_con_cr || 0);
                      const tt = Number(p.importe_total || 0);
                      const pct = tt ? Math.round((cc / tt) * 100) : 0;
                      return (
                        <tr key={p.prov_no}>
                          <td>{p.prov_nombre}</td>
                          <td style={{ textAlign: 'right', color: 'var(--green)' }}>{mny(cc)}</td>
                          <td style={{ textAlign: 'right', color: 'var(--amber)' }}>{mny(tt - cc)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{mny(tt)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: pct >= 60 ? 'var(--green)' : pct >= 40 ? 'var(--amber)' : 'var(--red)' }}>{pct}%</td>
                        </tr>
                      );
                    })}
                    <tr style={{ background: 'var(--green)', color: '#fff' }}>
                      <td style={{ fontWeight: 700 }}>TOTAL</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{mny(kpiData.importe_con_cr)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{mny(kpiData.importe_total - kpiData.importe_con_cr)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{mny(kpiData.importe_total)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{kpiData.importe_total ? Math.round((kpiData.importe_con_cr / kpiData.importe_total) * 100) : 0}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="card">
                <h2>Número de altas por laboratorio</h2>
                <table>
                  <thead><tr>
                    <th>Laboratorio</th>
                    <th style={{ textAlign: 'right' }}>Con CR</th>
                    <th style={{ textAlign: 'right' }}>Sin CR</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                  </tr></thead>
                  <tbody>
                    {(kpiData.top_proveedores || []).map((p) => (
                      <tr key={p.prov_no}>
                        <td>{p.prov_nombre}</td>
                        <td style={{ textAlign: 'right' }}>{p.con_cr}</td>
                        <td style={{ textAlign: 'right' }}>{p.total - p.con_cr}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{p.total}</td>
                      </tr>
                    ))}
                    <tr style={{ background: 'var(--green)', color: '#fff' }}>
                      <td style={{ fontWeight: 700 }}>TOTAL</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{kpiData.con_cr}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{kpiData.sin_cr}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{kpiData.total}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="card">
                <h2>Por delegación</h2>
                <p className="muted" style={{ marginBottom: 10 }}>Ordenado por importe sin contra recibo</p>
                <table>
                  <thead><tr>
                    <th>Delegación</th>
                    <th style={{ textAlign: 'right' }}>Altas</th>
                    <th style={{ textAlign: 'right' }}>Con CR</th>
                    <th style={{ textAlign: 'right' }}>Sin CR</th>
                    <th style={{ textAlign: 'right' }}>% avance</th>
                  </tr></thead>
                  <tbody>
                    {(kpiData.por_delegacion || []).map((d) => {
                      const cc = Number(d.importe_con_cr || 0);
                      const tt = Number(d.importe_total || 0);
                      const pct = tt ? Math.round((cc / tt) * 100) : 0;
                      return (
                        <tr key={d.delegacion}>
                          <td>{d.delegacion}</td>
                          <td style={{ textAlign: 'right' }} className="muted">{d.total}</td>
                          <td style={{ textAlign: 'right', color: 'var(--green)' }}>{mny(cc)}</td>
                          <td style={{ textAlign: 'right', color: 'var(--amber)' }}>{mny(tt - cc)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: pct >= 60 ? 'var(--green)' : pct >= 40 ? 'var(--amber)' : 'var(--red)' }}>{pct}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

            </>
          )}
        </>
      )}

      {tab === 'flujo' && (
        <>
          <div className="toolbar">
            <select value={calFiltroProvNo} onChange={(e) => setCalFiltroProvNo(e.target.value)}>
              <option value="">Todos mis laboratorios</option>
              {empresas.map((e) => <option key={e.numero} value={e.numero}>{e.nombre}</option>)}
            </select>
            <select value={calFiltroDeleg} onChange={(e) => setCalFiltroDeleg(e.target.value)}>
              <option value="">Todas las delegaciones</option>
              {delegaciones.map((d) => <option key={d.nombre} value={d.nombre}>{d.nombre}</option>)}
            </select>
            {(calFiltroProvNo || calFiltroDeleg) && (
              <button className="btn btn-ghost btn-sm" onClick={() => { setCalFiltroProvNo(''); setCalFiltroDeleg(''); }}>Limpiar filtros</button>
            )}
          </div>
          {calCargando && <p className="muted">Cargando…</p>}
          {!calCargando && !calData && <p className="muted">No se pudo cargar el flujo de cobranza.</p>}
          {!calCargando && calData && (
            <>
              <div className="kpi-stat-grid" style={{ marginBottom: 16 }}>
                <div className="kpi-stat" style={{ background: Number(calData.total_confirmado) > 0 ? 'var(--green-soft)' : 'var(--card)', border: '1px solid var(--line)' }}>
                  <div className="lbl" style={{ color: Number(calData.total_confirmado) > 0 ? 'var(--green)' : 'var(--text-soft)' }}>Pago confirmado</div>
                  <div className="num" style={{ color: Number(calData.total_confirmado) > 0 ? 'var(--green)' : 'var(--navy)' }}>{mny(calData.total_confirmado)}</div>
                </div>
                <div className="kpi-stat" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
                  <div className="lbl" style={{ color: 'var(--text-soft)' }}>Programado a pago · 4 semanas</div>
                  <div className="num" style={{ color: 'var(--navy)' }}>{mny(calData.total_proximo)}</div>
                </div>
                <div className="kpi-stat" style={{ background: Number(calData.total_vencido) > 0 ? 'var(--red-soft)' : 'var(--card)', border: '1px solid var(--line)' }}>
                  <div className="lbl" style={{ color: Number(calData.total_vencido) > 0 ? 'var(--red)' : 'var(--text-soft)' }}>Vencido sin pagar</div>
                  <div className="num" style={{ color: Number(calData.total_vencido) > 0 ? 'var(--red)' : 'var(--green)' }}>{mny(calData.total_vencido)}</div>
                </div>
                <div className="kpi-stat" style={{ background: 'var(--green-soft)' }}>
                  <div className="lbl" style={{ color: 'var(--green)' }}>Cobrado · últimos 30 días</div>
                  <div className="num" style={{ color: 'var(--green)' }}>{mny(calData.total_cobrado)}</div>
                </div>
              </div>

              {calData.vencidos && calData.vencidos.length > 0 && (
                <div className="card" style={{ borderColor: 'var(--red)' }}>
                  <div className="toolbar" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h2 style={{ color: 'var(--red)', marginBottom: 2 }}>Contra recibos vencidos</h2>
                      <p className="muted" style={{ margin: 0 }}>El IMSS programó estos pagos y aún no los ha realizado.</p>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={exportarVencidos}>Descargar Excel</button>
                  </div>
                  <table style={{ marginTop: 10 }}>
                    <thead><tr><th>Contra recibo</th><th>Fecha programada</th><th>Días vencido</th><th>Laboratorio</th><th>Delegación</th><th>Facturas</th><th>Importe</th><th></th></tr></thead>
                    <tbody>
                      {calData.vencidos.map((d) => (
                        <tr key={d.comprobante}>
                          <td style={{ fontWeight: 600 }}>{d.comprobante}</td>
                          <td>{fmtF(d.fecha)}</td>
                          <td style={{ color: d.dias_vencido > 30 ? 'var(--red)' : 'var(--amber)', fontWeight: 600 }}>{d.dias_vencido}</td>
                          <td>{d.empresa || ''}</td>
                          <td className="muted">{d.delegacion || ''}</td>
                          <td>{d.facturas}</td>
                          <td>{mny(d.importe_cr)}</td>
                          <td><a href="#" onClick={(e) => { e.preventDefault(); abrirContraRecibo(d.comprobante); }}>Ver</a></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {calData.confirmados && calData.confirmados.length > 0 && (
                <div className="card">
                  <h2>Pagos confirmados</h2>
                  <p className="muted">El IMSS ya asentó estos pagos con fecha y referencia bancaria. Son depósitos comprometidos, aún por aplicarse.</p>
                  <table>
                    <thead><tr><th>Fecha de pago</th><th>Contra recibos</th><th>Facturas</th><th>Referencias</th><th>Importe</th></tr></thead>
                    <tbody>
                      {calData.confirmados.map((d) => (
                        <tr key={d.fecha}>
                          <td>{fmtF(d.fecha)}</td>
                          <td>{d.contra_recibos}</td>
                          <td>{d.facturas}</td>
                          <td className="muted">{(d.referencias || []).join(', ')}</td>
                          <td style={{ color: 'var(--green)' }}>{mny(d.importe_cr)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="card">
                <h2>Pagos programados</h2>
                <p className="muted">En cola de pago, sujetos a la programación del IMSS. Considera únicamente las facturas gestionadas por Ges Cobranza.</p>
                {calData.proximos.length === 0 && <p className="muted">Sin pagos programados en las próximas 4 semanas.</p>}
                {agruparPorSemana(calData.proximos).map((s) => (
                  <details key={s.clave} open>
                    <summary style={{ cursor: 'pointer', padding: '8px 0', fontWeight: 600, color: 'var(--navy)' }}>Semana del {fmtF(s.clave)} · {mny(s.total)}</summary>
                    <table style={{ marginBottom: 10 }}>
                      <thead><tr><th>Fecha</th><th>Contra recibos</th><th>Facturas</th><th>Importe</th></tr></thead>
                      <tbody>
                        {s.dias.map((d) => (
                          <tr key={d.fecha}><td>{fmtF(d.fecha)}</td><td>{d.contra_recibos}</td><td>{d.facturas}</td><td>{mny(d.importe_cr)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                ))}
              </div>

              <div className="card">
                <h2>Cobrado en los últimos 30 días</h2>
                <p className="muted">Depósitos ya realizados por el IMSS, con su referencia bancaria.</p>
                {calData.cobrado.length === 0 && <p className="muted">Sin depósitos registrados en los últimos 30 días.</p>}
                {calData.cobrado.length > 0 && (
                  <table>
                    <thead><tr><th>Fecha de pago</th><th>Contra recibos</th><th>Facturas</th><th>Referencias</th><th>Importe</th></tr></thead>
                    <tbody>
                      {calData.cobrado.map((d) => (
                        <tr key={d.fecha}>
                          <td>{fmtF(d.fecha)}</td>
                          <td>{d.contra_recibos}</td>
                          <td>{d.facturas}</td>
                          <td className="muted">{(d.referencias || []).join(', ')}</td>
                          <td style={{ color: 'var(--green)' }}>{mny(d.importe_cr)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
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
