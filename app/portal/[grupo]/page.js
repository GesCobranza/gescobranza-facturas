'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';

export default function PortalGrupo() {
  const params = useParams();
  const grupo = decodeURIComponent(params.grupo);

  const [clave, setClave] = useState('');
  const [autenticado, setAutenticado] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [error, setError] = useState('');
  const [facturas, setFacturas] = useState([]);

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
        setFacturas(data.facturas || []);
        setAutenticado(true);
      } else {
        setError(data.error || 'Grupo o clave incorrectos.');
      }
    } catch (err) {
      setError('Error de conexión. Intenta de nuevo.');
    }
    setVerificando(false);
  }

  const total = facturas.length;
  const conCR = facturas.filter((f) => f.tiene_cr);
  const sinCR = facturas.filter((f) => !f.tiene_cr);
  const pct = total ? Math.round((conCR.length / total) * 100) : 0;
  const porDelegacion = {};
  facturas.forEach((f) => { porDelegacion[f.delegacion] = (porDelegacion[f.delegacion] || 0) + 1; });
  const maxDeleg = Math.max(1, ...Object.values(porDelegacion));

  if (!autenticado) {
    return (
      <div className="app" style={{ maxWidth: 420, paddingTop: 80 }}>
        <header className="top">
          <div className="brand">
            <div className="mark">CR</div>
            <div>
              <h1>Ges Cobranza</h1>
              <p>Portal de consulta — {grupo}</p>
            </div>
          </div>
        </header>
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
      </div>
    );
  }

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <div className="mark">CR</div>
          <div>
            <h1>Ges Cobranza</h1>
            <p>Portal de consulta — {grupo}</p>
          </div>
        </div>
      </header>

      <div className="kpi-grid">
        <div className="kpi"><div className="num">{total}</div><div className="lbl">Facturas totales</div></div>
        <div className="kpi"><div className="num" style={{ color: 'var(--green)' }}>{conCR.length}</div><div className="lbl">Con contra recibo</div></div>
        <div className="kpi"><div className="num" style={{ color: 'var(--amber)' }}>{sinCR.length}</div><div className="lbl">Sin contra recibo</div></div>
        <div className="kpi"><div className="num">{pct}%</div><div className="lbl">Tasa de recuperación</div></div>
      </div>

      <div className="card">
        <h2>Distribución por delegación</h2>
        {Object.keys(porDelegacion).length === 0 && <p className="muted">Sin datos aún.</p>}
        {Object.entries(porDelegacion).sort((a, b) => b[1] - a[1]).map(([d, val]) => (
          <div className="bar-row" key={d}>
            <div className="bar-label" style={{ width: 220 }}>{d}</div>
            <div className="bar-track"><div className="bar-fill" style={{ width: (val / maxDeleg) * 100 + '%' }} /></div>
            <div className="bar-val">{val}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Registros</h2>
        <table>
          <thead><tr><th>Alta</th><th>Empresa</th><th>Delegación</th><th>Importe</th><th>CR</th><th>Comprobante</th></tr></thead>
          <tbody>
            {facturas.map((f) => (
              <tr key={f.id}>
                <td>{f.alta}</td><td>{f.empresa}</td><td>{f.delegacion}</td>
                <td>${Number(f.importe).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                <td>{f.tiene_cr ? <span className="tag tag-green">Con CR</span> : <span className="tag tag-amber">Sin CR</span>}</td>
                <td>
                  {f.comprobante || '—'}
                  {f.alerta_importe && <div className="muted" style={{ color: 'var(--red)' }}>{f.alerta_importe}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted">{facturas.length} registros.</p>
      </div>
    </div>
  );
}
