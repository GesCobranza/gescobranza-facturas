'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [tab, setTab] = useState('captura');
  const [catalogos, setCatalogos] = useState({ grupos: [], delegaciones: [] });
  const [facturas, setFacturas] = useState([]);
  const [cargando, setCargando] = useState(true);

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

  useEffect(() => {
    cargarCatalogos();
  }, []);

  useEffect(() => {
    if (tab === 'consulta') cargarFacturas();
  }, [tab]);

  async function cargarCatalogos() {
    setCargando(true);
    const res = await fetch('/api/catalogos');
    const data = await res.json();
    setCatalogos(data);
    if (data.grupos && data.grupos.length > 0) setGrupo(data.grupos[0].nombre);
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
    if (!alta) {
      altaHint = `Debe iniciar con ${codigos.join(' o ')}`;
      altaOk = false;
    } else {
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
        grupo,
        empresa: empresaObj.nombre,
        delegacion,
        pdf,
        numFactura,
        provNo: empresaObj.numero,
        provNombre: empresaObj.nombre,
        alta,
        importe: importeRaw,
        capturista,
        fechaRecepcion,
      }),
    });
    const data = await res.json();
    setGuardando(false);
    if (data.ok) {
      setMensaje('Factura guardada correctamente.');
      setMensajeTipo('ok');
      setPdf('');
      setNumFactura('');
      setAlta('');
      setImporteTexto('');
      setImporteRaw(0);
    } else {
      setMensaje(data.error || 'Error al guardar.');
      setMensajeTipo('error');
    }
  }

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
            <thead>
              <tr>
                <th>Alta</th><th>Grupo</th><th>Empresa</th><th>Delegación</th><th>Importe</th><th>CR</th>
              </tr>
            </thead>
            <tbody>
              {facturas.map((f) => (
                <tr key={f.id}>
                  <td>{f.alta}</td>
                  <td>{f.grupo}</td>
                  <td>{f.empresa}</td>
                  <td>{f.delegacion}</td>
                  <td>${Number(f.importe).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                  <td>{f.tiene_cr ? 'Con CR' : 'Sin CR'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted">{facturas.length} registros.</p>
        </div>
      )}
    </div>
  );
}
