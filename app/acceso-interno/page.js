'use client';
import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function FormularioAcceso() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/';

  const [clave, setClave] = useState('');
  const [verificando, setVerificando] = useState(false);
  const [error, setError] = useState('');

  async function ingresar(e) {
    e.preventDefault();
    setError('');
    setVerificando(true);
    try {
      const res = await fetch('/api/acceso-interno', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clave }),
      });
      const data = await res.json();
      if (data.ok) {
        window.location.href = next;
      } else {
        setError(data.error || 'Clave incorrecta.');
      }
    } catch (err) {
      setError('Error de conexión. Intenta de nuevo.');
    }
    setVerificando(false);
  }

  return (
    <div className="app" style={{ maxWidth: 420, paddingTop: 80 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <img src="/logo_icon.svg" alt="Ges Cobranza" style={{ height: 46, width: 46, flexShrink: 0 }} />
        <div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--navy)', fontSize: 15, fontWeight: 800, lineHeight: 1.15 }}>GESTIÓN ESPECIALIZADA</div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--green)', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em' }}>EN COBRANZA</div>
        </div>
      </div>
      <div className="card">
        <h2>Acceso al sistema interno</h2>
        {error && <div className="alert error">{error}</div>}
        <form onSubmit={ingresar}>
          <div className="field" style={{ marginBottom: 16 }}>
            <label>Clave de acceso</label>
            <input
              type="password"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              placeholder="Clave del equipo interno"
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

export default function AccesoInterno() {
  return (
    <Suspense fallback={<div className="app" style={{ paddingTop: 80 }}><p>Cargando…</p></div>}>
      <FormularioAcceso />
    </Suspense>
  );
}
