'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [tab, setTab] = useState('captura');
  const [catalogos, setCatalogos] = useState({ grupos: [], delegaciones: [] });
  const [facturas, setFacturas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [seleccionados, setSeleccionados] = useState(new Set());

  // ---- Captura ----
  const [grupo, setGrupo] = useState('');
  const [empresaNumero, setEmpresaNumero] = useState('');
  const [delegacion, setDelegacion] = useState('');
  const [pdf, setPdf] = useState('');
  const [numFactura, setNumFactura] = useState('');
  const [alta, setAlta] = useState('');
  const [importeTexto, setImporteTexto] = useState('');
  const [importeRaw, setImporteRaw] = useState(0);
  const [capturista, setCapturista] = useState('Sophie');
  const [fechaRecepcion, setFechaRecepcion] = useState(() => new Date().toISOString().slice(0, 10));
  const [mensaje, setMensaje] = useState('');
  const [mensajeTipo, setMensajeTipo] = useState('');
  const [guardando, setGuardando] = useState(false);

  // ---- Catalogos ----
  const [catGrupoSel, setCatGrupoSel] = useState('');
  const [catGrupoNuevo, setCatGrupoNuevo] = useState('');
  const [catEmpresaNombre, setCatEmpresaNombre] = useState('');
  const [catEmpresaNumero, setCatEmpresaNumero] = useState('');
  const [catCodigo, setCatCodigo] = useState('');
  const [catDelegNombre, setCatDelegNombre] = useState('');

  // ---- Gestores (seguimiento de envío) ----
  const [gFiltroDeleg, setGFiltroDeleg] = useState('');
  const [gFiltroEnvio, setGFiltroEnvio] = useState('');

  useEffect(() => { cargarCatalogos(); }, []);
  useEffect(() => {
    if (tab === 'consulta' || tab === 'panel' || tab === 'gestores') cargarFacturas();
  }, [tab]);

  async function cargarCatalogos() {
    setCargando(true);
    const res = await fetch('/api/catalogos');
    const data = await res.json();
    setCatalogos(data);
    if (data.grupos && data.grupos.length > 0) {
      setGrupo((g) => g || data.grupos[0].nombre);
      setCatGrupoSel((g) => g || data.grupos[0].nombre);
    }
    setCargando(false);
  }

  async function cargarFacturas() {
    const res = await fetch('/api/facturas');
    const data = await res.json();
    setFacturas(data.facturas || []);
  }

  const grupoObj = catalogos.grupos.find((g) => g.nombre === grupo);
  const empresas = grupoObj ? grupoObj.empresas : [];
  const empresaObj = empresas.find((e) => e.numero === empresaNumero);

  function formatearImporte(valorInput) {
    let digitos = valorInput.replace(/\D/g, '');
    digitos = digitos.replace(/^0+/, '') || '0';
    if (digitos.length > 11) digitos = digitos.slice(0, 11);
    const valor = parseInt(digitos, 10) / 100;
    setImporteRaw(valor);
    setImporteTexto(valor.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }));
  }

  const deleg = catalogos.delegaciones.find((d) => d.nombre === delegacion);
  let altaHint = '';
  let altaOk = true;
  if (deleg) {
    const codigos = deleg.codigo.split(',');
    if (!alta) { altaHint = `Debe iniciar con ${codigos.join(' o ')}`; altaOk = false; }
    else {
      altaOk = codigos.some((c) => alta.startsWith(c));
      altaHint = altaOk ? `✓ Coincide con ${codigos.join(' o ')}` : `✗ Debe iniciar con ${codigos.join(' o ')}`;
    }
  }

  async function guardar() {
    setMensaje('');
    if (!alta || !pdf || !empresaObj || importeRaw <= 0) {
      setMensaje('Completa PDF, empresa, alta e importe (mayor a $0.00).');
      setMensajeTipo('error');
      return;
    }
    if (!altaOk) {
      setMensaje('El número de alta no coincide con el código de la delegación elegida.');
      setMensajeTipo('error');
      return;
    }
    setGuardando(true);
    const res = await fetch('/api/facturas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grupo, empresa: empresaObj.nombre, delegacion, pdf, numFactura,
        provNo: empresaObj.numero, provNombre: empresaObj.nombre, alta,
        importe: importeRaw, capturista, fechaRecepcion,
      }),
    });
    const data = await res.json();
    setGuardando(false);
    if (data.ok) {
      setMensaje('Factura guardada correctamente.');
      setMensajeTipo('ok');
      setPdf(''); setNumFactura(''); setAlta(''); setImporteTexto(''); setImporteRaw(0);
    } else {
      setMensaje(data.error || 'Error al guardar.');
      setMensajeTipo('error');
    }
  }

  // ---- Catalogos: acciones ----
  async function agregarEmpresa() {
    const grupoFinal = catGrupoNuevo.trim() || catGrupoSel;
    if (!grupoFinal || !catEmpresaNombre.trim() || !catEmpresaNumero.trim()) return;
    await fetch('/api/catalogos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'empresa', grupo: grupoFinal, nombre: catEmpresaNombre.trim(), numero: catEmpresaNumero.trim() }),
    });
    setCatGrupoNuevo(''); setCatEmpresaNombre(''); setCatEmpresaNumero('');
    await cargarCatalogos();
  }
  async function eliminarEmpresa(numero) {
    await fetch('/api/catalogos', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'empresa', numero }),
    });
    await cargarCatalogos();
  }
  async function agregarDelegacion() {
    if (!catCodigo.trim() || !catDelegNombre.trim()) return;
    await fetch('/api/catalogos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'delegacion', codigo: catCodigo.trim(), nombre: catDelegNombre.trim() }),
    });
    setCatCodigo(''); setCatDelegNombre('');
    await cargarCatalogos();
  }
  async function eliminarDelegacion(nombre) {
    await fetch('/api/catalogos', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'delegacion', nombre }),
    });
    await cargarCatalogos();
  }

  // ---- Gestores: acciones ----
  function toggleSeleccion(id) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  async function marcarSeleccionadasComoEnviadas() {
    if (seleccionados.size === 0) return;
    await fetch('/api/facturas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'marcarEnviadas', ids: Array.from(seleccionados) }),
    });
    setSeleccionados(new Set());
    await cargarFacturas();
  }
  async function quitarEnviada(id) {
    await fetch('/api/facturas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'quitarEnviada', id }),
    });
    await cargarFacturas();
  }

  // ---- Panel KPI: cálculos ----
  const total = facturas.length;
  const conCR = facturas.filter((f) => f.tiene_cr);
  const sinCR = facturas.filter((f) => !f.tiene_cr);
  const pct = total ? Math.round((conCR.length / total) * 100) : 0;
  const porGrupo = {};
  facturas.forEach((f) => { porGrupo[f.grupo] = (porGrupo[f.grupo] || 0) + 1; });
  const maxGrupo = Math.max(1, ...Object.values(porGrupo));

  const grupoCatObj = catalogos.grupos.find((g) => g.nombre === catGrupoSel);
  const empresasCat = grupoCatObj ? grupoCatObj.empresas : [];

  // ---- Gestores: datos derivados ----
  const pendientes = facturas.filter((f) => !f.tiene_cr && !f.enviada_gestor);
  const pendientesPorDeleg = {};
  pendientes.forEach((f) => {
    if (!pendientesPorDeleg[f.delegacion]) pendientesPorDeleg[f.delegacion] = { n: 0, importe: 0 };
    pendientesPorDeleg[f.delegacion].n++;
    pendientesPorDeleg[f.delegacion].importe += Number(f.importe) || 0;
  });
  const maxPend = Math.max(1, ...Object.values(pendientesPorDeleg).map((v) => v.n));

  const esperando = facturas
    .filter((f) => f.enviada_gestor && !f.tiene_cr)
    .map((f) => ({ ...f, dias: Math.floor((Date.now() - new Date(f.fecha_envio)) / 86400000) }))
    .sort((a, b) => b.dias - a.dias);

  let filasGestores = facturas.filter((f) => !f.tiene_cr);
  if (gFiltroDeleg) filasGestores = filasGestores.filter((f) => f.delegacion === gFiltroDeleg);
  if (gFiltroEnvio === 'enviada') filasGestores = filasGestores.filter((f) => f.enviada_gestor);
  if (gFiltroEnvio === 'noenviada') filasGestores = filasGestores.filter((f) => !f.enviada_gestor);

  if (cargando) return <div className="app"><p>Cargando…</p></div>;

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <div className="mark">CR</div>
          <div>
            <h1>Ges Cobranza</h1>
            <p>Control de captura de facturas</p>
          </div>
        </div>
      </header>

      <nav className="tabs">
        <button className={tab === 'captura' ? 'active' : ''} onClick={() => setTab('captura')}>Captura</button>
        <button className={tab === 'consulta' ? 'active' : ''} onClick={() => setTab('consulta')}>Consulta</button>
        <button className={tab === 'panel' ? 'active' : ''} onClick={() => setTab('panel')}>Panel KPI</button>
        <button className={tab === 'gestores' ? 'active' : ''} onClick={() => setTab('gestores')}>Seguimiento Envío</button>
        <button className={tab === 'catalogos' ? 'active' : ''} onClick={() => setTab('catalogos')}>Catálogos</button>
      </nav>

      {tab === 'captura' && (
        <div className="card">
          <h2>Nueva factura</h2>
          {mensaje && <div className={`alert ${mensajeTipo}`}>{mensaje}</div>}
          <div className="grid">
            <div className="field">
              <label>Grupo / cliente</label>
              <select value={grupo} onChange={(e) => { setGrupo(e.target.value); setEmpresaNumero(''); }}>
                {catalogos.grupos.map((g) => <option key={g.nombre} value={g.nombre}>{g.nombre}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Empresa / laboratorio</label>
              <select value={empresaNumero} onChange={(e) => setEmpresaNumero(e.target.value)}>
                <option value="">— selecciona —</option>
                {empresas.map((e) => <option key={e.numero} value={e.numero}>{e.nombre}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Delegación / OOAD-UMAE</label>
              <select value={delegacion} onChange={(e) => setDelegacion(e.target.value)}>
                <option value="">— selecciona —</option>
                {catalogos.delegaciones.map((d) => <option key={d.nombre} value={d.nombre}>{d.nombre}</option>)}
              </select>
            </div>
          </div>
          <div className="grid">
            <div className="field">
              <label>No. de PDF</label>
              <input value={pdf} onChange={(e) => setPdf(e.target.value)} placeholder="Ej. PDF-00231" />
            </div>
            <div className="field">
              <label>Número de factura</label>
              <input value={numFactura} onChange={(e) => setNumFactura(e.target.value)} placeholder="Si es distinto al PDF" />
            </div>
            <div className="field">
              <label>Fecha de recepción</label>
              <input type="date" value={fechaRecepcion} onChange={(e) => setFechaRecepcion(e.target.value)} />
            </div>
          </div>
          <div className="grid">
            <div className="field">
              <label>Proveedor</label>
              <input readOnly value={empresaObj ? `${empresaObj.nombre} · No. ${empresaObj.numero}` : ''} />
            </div>
            <div className="field">
              <label>Importe</label>
              <input value={importeTexto} onChange={(e) => formatearImporte(e.target.value)} placeholder="$0.00" />
            </div>
            <div className="field">
              <label>Número de alta ⚠ crítico</label>
              <input value={alta} onChange={(e) => setAlta(e.target.value)} placeholder="Ej. AL-2026-00981" />
              <span className="hint">{altaHint}</span>
            </div>
          </div>
          <div className="field" style={{ maxWidth: 220, marginBottom: 16 }}>
            <label>Capturista</label>
            <select value={capturista} onChange={(e) => setCapturista(e.target.value)}>
              <option value="Sophie">Sophie</option>
              <option value="Mariano">Mariano</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar factura'}
          </button>
        </div>
      )}

      {tab === 'consulta' && (
        <div className="card">
          <h2>Registros capturados</h2>
          <table>
            <thead><tr><th>Alta</th><th>Grupo</th><th>Empresa</th><th>Delegación</th><th>Importe</th><th>CR</th></tr></thead>
            <tbody>
              {facturas.map((f) => (
                <tr key={f.id}>
                  <td>{f.alta}</td><td>{f.grupo}</td><td>{f.empresa}</td><td>{f.delegacion}</td>
                  <td>${Number(f.importe).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                  <td>{f.tiene_cr ? <span className="tag tag-green">Con CR</span> : <span className="tag tag-amber">Sin CR</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted">{facturas.length} registros.</p>
        </div>
      )}

      {tab === 'panel' && (
        <>
          <div className="kpi-grid">
            <div className="kpi"><div className="num">{total}</div><div className="lbl">Facturas totales</div></div>
            <div className="kpi"><div className="num" style={{ color: 'var(--green)' }}>{conCR.length}</div><div className="lbl">Con contra recibo</div></div>
            <div className="kpi"><div className="num" style={{ color: 'var(--amber)' }}>{sinCR.length}</div><div className="lbl">Sin contra recibo</div></div>
            <div className="kpi"><div className="num">{pct}%</div><div className="lbl">Tasa de recuperación</div></div>
          </div>
          <div className="card">
            <h2>Distribución por grupo</h2>
            {Object.keys(porGrupo).length === 0 && <p className="muted">Sin datos aún.</p>}
            {Object.entries(porGrupo).map(([g, val]) => (
              <div className="bar-row" key={g}>
                <div className="bar-label">{g}</div>
                <div className="bar-track"><div className="bar-fill" style={{ width: (val / maxGrupo) * 100 + '%' }} /></div>
                <div className="bar-val">{val}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'gestores' && (
        <>
          <div className="card">
            <h2>Pendientes por enviar, por delegación</h2>
            <p className="muted" style={{ marginBottom: 12 }}>Sin contra recibo y aún no enviadas a ningún gestor.</p>
            {Object.keys(pendientesPorDeleg).length === 0 && <p className="muted">No hay pendientes por enviar.</p>}
            {Object.entries(pendientesPorDeleg).sort((a, b) => b[1].n - a[1].n).map(([d, v]) => (
              <div className="bar-row" key={d} style={{ cursor: 'pointer' }} onClick={() => { setGFiltroDeleg(d); setGFiltroEnvio('noenviada'); }}>
                <div className="bar-label" style={{ width: 220 }}>{d}</div>
                <div className="bar-track"><div className="bar-fill" style={{ width: (v.n / maxPend) * 100 + '%' }} /></div>
                <div className="bar-val">{v.n}</div>
                <div className="muted" style={{ width: 120, textAlign: 'right' }}>${v.importe.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
              </div>
            ))}
          </div>

          <div className="card">
            <h2>Enviadas — esperando contra recibo</h2>
            {esperando.length === 0 && <p className="muted">No hay facturas esperando respuesta ahora mismo.</p>}
            {esperando.length > 0 && (
              <table>
                <thead><tr><th>Alta</th><th>Delegación</th><th>Importe</th><th>Días esperando</th></tr></thead>
                <tbody>
                  {esperando.map((f) => (
                    <tr key={f.id}>
                      <td>{f.alta}</td><td>{f.delegacion}</td>
                      <td>${Number(f.importe).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                      <td>{f.dias > 15 ? <span className="tag" style={{ background: 'var(--red-soft)', color: 'var(--red)' }}>{f.dias}d</span> : <span className="muted">{f.dias}d</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card">
            <h2>Detalle y marcar envío</h2>
            <div className="toolbar">
              <select value={gFiltroDeleg} onChange={(e) => setGFiltroDeleg(e.target.value)}>
                <option value="">Todas las delegaciones</option>
                {catalogos.delegaciones.map((d) => <option key={d.nombre} value={d.nombre}>{d.nombre}</option>)}
              </select>
              <select value={gFiltroEnvio} onChange={(e) => setGFiltroEnvio(e.target.value)}>
                <option value="">Todas — enviadas y no enviadas</option>
                <option value="noenviada">Aún no enviada</option>
                <option value="enviada">Ya enviada, esperando CR</option>
              </select>
            </div>
            {seleccionados.size > 0 && (
              <div className="alert ok" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span>{seleccionados.size} seleccionada(s)</span>
                <button className="btn btn-primary btn-sm" onClick={marcarSeleccionadasComoEnviadas}>Marcar como enviadas a gestor</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setSeleccionados(new Set())}>Cancelar selección</button>
              </div>
            )}
            <table>
              <thead><tr><th></th><th>Alta</th><th>Delegación</th><th>Importe</th><th>Envío</th></tr></thead>
              <tbody>
                {filasGestores.map((f) => (
                  <tr key={f.id}>
                    <td><input type="checkbox" checked={seleccionados.has(f.id)} onChange={() => toggleSeleccion(f.id)} /></td>
                    <td>{f.alta}</td><td>{f.delegacion}</td>
                    <td>${Number(f.importe).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                    <td>{f.enviada_gestor
                      ? <>
                          <span className="tag" style={{ background: 'var(--blue-soft)', color: 'var(--blue)' }}>Enviada</span>{' '}
                          <a href="#" onClick={(e) => { e.preventDefault(); quitarEnviada(f.id); }} className="muted">deshacer</a>
                        </>
                      : <span className="muted">Sin enviar</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted">{filasGestores.length} facturas pendientes de CR con estos filtros.</p>
          </div>
        </>
      )}

      {tab === 'catalogos' && (
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="card">
            <h2>Empresas por grupo</h2>
            <div className="field">
              <label>Grupo activo</label>
              <select value={catGrupoSel} onChange={(e) => setCatGrupoSel(e.target.value)}>
                {catalogos.grupos.map((g) => <option key={g.nombre} value={g.nombre}>{g.nombre}</option>)}
              </select>
            </div>
            <div className="row-inline">
              <input placeholder="Grupo (nuevo o existente)" value={catGrupoNuevo} onChange={(e) => setCatGrupoNuevo(e.target.value)} />
            </div>
            <div className="row-inline">
              <input placeholder="Nombre de empresa" value={catEmpresaNombre} onChange={(e) => setCatEmpresaNombre(e.target.value)} />
              <input placeholder="No. proveedor" value={catEmpresaNumero} onChange={(e) => setCatEmpresaNumero(e.target.value)} style={{ maxWidth: 140 }} />
              <button className="btn btn-primary btn-sm" onClick={agregarEmpresa}>Agregar</button>
            </div>
            <div className="catalog-list">
              {empresasCat.length === 0 && <p className="muted">Sin empresas en este grupo.</p>}
              {empresasCat.map((e) => (
                <div className="catalog-item" key={e.numero}>
                  <span>{e.nombre} <span className="muted">· No. {e.numero}</span></span>
                  <button className="btn btn-danger btn-sm" onClick={() => eliminarEmpresa(e.numero)}>Eliminar</button>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <h2>Delegaciones / OOAD-UMAE</h2>
            <div className="row-inline">
              <input placeholder="Código (ej. 29)" value={catCodigo} onChange={(e) => setCatCodigo(e.target.value)} style={{ maxWidth: 120 }} />
              <input placeholder="Ej. OOAD 29 - Tamaulipas" value={catDelegNombre} onChange={(e) => setCatDelegNombre(e.target.value)} />
              <button className="btn btn-primary btn-sm" onClick={agregarDelegacion}>Agregar</button>
            </div>
            <div className="catalog-list">
              {catalogos.delegaciones.map((d) => (
                <div className="catalog-item" key={d.nombre}>
                  <span><b>{d.codigo}</b> · {d.nombre}</span>
                  <button className="btn btn-danger btn-sm" onClick={() => eliminarDelegacion(d.nombre)}>Eliminar</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
