'use client';

import { useState, useEffect } from 'react';

const NAVY = '#232B3E';
const VERDE = '#227056';
const AMBAR = '#B8791A';
const ROJO = '#C23B3B';
const GRIS = '#6E7178';
const LINEA = '#E3E6EC';

const CATEGORIAS = ['Casa', 'Comida', 'Transporte', 'Escuela', 'Salud', 'Personal', 'Otros'];

function mny(n) {
  return '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function mCorto(n) {
  return '$' + Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 });
}
function fmtD(iso) {
  if (!iso) return '';
  const p = String(iso).slice(0, 10).split('-');
  return p.length === 3 ? p[2] + '/' + p[1] : '';
}
function mesActual() {
  return new Date().toISOString().slice(0, 7);
}
function nombreMes(m) {
  const N = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const [a, mm] = m.split('-').map(Number);
  return N[mm - 1] + ' ' + a;
}

export default function Finanzas() {
  const [entrada, setEntrada] = useState('');
  const [autenticado, setAutenticado] = useState(false);
  const [errorClave, setErrorClave] = useState('');

  const [mes, setMes] = useState(mesActual());
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);

  const [tipo, setTipo] = useState('gasto');
  const [monto, setMonto] = useState('');
  const [categoria, setCategoria] = useState('Comida');
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (autenticado) cargar();
  }, [autenticado, mes]);

  async function cargar() {
    setCargando(true);
    try {
      const res = await fetch('/api/finanzas?mes=' + mes);
      const d = await res.json();
      setDatos(d.ok ? d : null);
    } catch (e) {
      setDatos(null);
    }
    setCargando(false);
  }

  async function registrar() {
    const v = parseFloat(String(monto).replace(/[^0-9.]/g, ''));
    if (!v || v <= 0) return;
    setGuardando(true);
    try {
      await fetch('/api/finanzas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, monto: v, categoria: tipo === 'gasto' ? categoria : null, nota }),
      });
      setMonto(''); setNota('');
      await cargar();
    } catch (e) { /* se ignora */ }
    setGuardando(false);
  }

  async function cobrar(id) {
    if (!window.confirm('¿Marcar como cobrado? Entrará como ingreso.')) return;
    await fetch('/api/finanzas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'cobrar', id }),
    });
    cargar();
  }

  async function borrar(id) {
    if (!window.confirm('¿Borrar este movimiento?')) return;
    await fetch('/api/finanzas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'borrar', id }),
    });
    cargar();
  }

  function entrar() {
    if (entrada === 'MisFinanzas2026') { setAutenticado(true); setErrorClave(''); }
    else setErrorClave('Clave incorrecta.');
  }

  if (!autenticado) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F6F8', fontFamily: 'Inter, system-ui, sans-serif', padding: 20 }}>
        <div style={{ background: '#fff', border: '1px solid ' + LINEA, borderRadius: 12, padding: '30px 28px', width: '100%', maxWidth: 340 }}>
          <h1 style={{ fontSize: 20, color: NAVY, margin: '0 0 4px' }}>Mis finanzas</h1>
          <p style={{ fontSize: 12.5, color: GRIS, margin: '0 0 18px' }}>Acceso personal</p>
          <input type="password" value={entrada} onChange={(e) => setEntrada(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') entrar(); }}
            placeholder="Clave" style={{ width: '100%', padding: '11px 12px', border: '1px solid ' + LINEA, borderRadius: 8, fontSize: 15 }} />
          {errorClave && <p style={{ color: ROJO, fontSize: 12.5, marginTop: 8 }}>{errorClave}</p>}
          <button onClick={entrar} style={{ width: '100%', marginTop: 14, padding: 12, border: 'none', borderRadius: 8, background: NAVY, color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Entrar</button>
        </div>
      </div>
    );
  }

  const d = datos || {};
  const movs = d.movimientos || [];
  const cfg = d.config || {};
  const ingresos = movs.filter((x) => x.tipo === 'ingreso').reduce((s, x) => s + Number(x.monto), 0);
  const gastos = movs.filter((x) => x.tipo === 'gasto').reduce((s, x) => s + Number(x.monto), 0);
  const ahorro = movs.filter((x) => x.tipo === 'ahorro').reduce((s, x) => s + Number(x.monto), 0);
  const metaAhorro = Number(cfg.meta_ahorro || 0);
  const pctMeta = metaAhorro ? Math.min(100, Math.round((ahorro / metaAhorro) * 100)) : 0;

  const porCat = {};
  movs.filter((x) => x.tipo === 'gasto').forEach((x) => {
    const k = x.categoria || 'Sin categoría';
    porCat[k] = (porCat[k] || 0) + Number(x.monto);
  });
  const cats = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
  const maxCat = cats.length ? cats[0][1] : 0;

  const card = { background: '#fff', border: '1px solid ' + LINEA, borderRadius: 12, padding: 16, marginBottom: 12 };

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '20px 14px 60px', fontFamily: 'Inter, system-ui, sans-serif', background: '#F5F6F8', minHeight: '100vh' }}>
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ fontSize: 22, color: NAVY, margin: 0 }}>Mis finanzas</h1>
        <p style={{ fontSize: 12.5, color: GRIS, margin: '2px 0 0', textTransform: 'capitalize' }}>{nombreMes(mes)}</p>
      </div>

      <div style={{ ...card, background: NAVY, border: 'none' }}>
        <div style={{ fontSize: 12, color: '#9AA9C4' }}>Saldo disponible</div>
        <div style={{ fontSize: 32, fontWeight: 700, color: '#fff', marginTop: 2 }}>{mny(d.saldo)}</div>
        <div style={{ display: 'flex', gap: 20, marginTop: 14, paddingTop: 12, borderTop: '1px solid #3A4257' }}>
          <div>
            <div style={{ fontSize: 11, color: '#9AA9C4' }}>Ahorro acumulado</div>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#4FB68C' }}>{mCorto(d.ahorroTotal)}</div>
          </div>
          {(d.porCobrar || []).length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: '#9AA9C4' }}>Por cobrar</div>
              <div style={{ fontSize: 17, fontWeight: 600, color: '#E0B252' }}>
                {mCorto((d.porCobrar || []).reduce((s, x) => s + Number(x.monto), 0))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 600, color: NAVY, marginBottom: 10 }}>Registrar</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {[['gasto', 'Gasto'], ['ingreso', 'Ingreso'], ['ahorro', 'Ahorro']].map(([v, t]) => (
            <button key={v} onClick={() => setTipo(v)}
              style={{ flex: 1, padding: '9px 0', border: '1px solid ' + LINEA, borderRadius: 8,
                background: tipo === v ? (v === 'gasto' ? ROJO : v === 'ingreso' ? VERDE : NAVY) : '#fff',
                color: tipo === v ? '#fff' : NAVY, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>{t}</button>
          ))}
        </div>
        <input inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)}
          placeholder="$0.00"
          style={{ width: '100%', padding: '13px 12px', border: '1px solid ' + LINEA, borderRadius: 8, fontSize: 22, fontWeight: 600, textAlign: 'center', marginBottom: 9 }} />
        {tipo === 'gasto' && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 9 }}>
            {CATEGORIAS.map((c) => (
              <button key={c} onClick={() => setCategoria(c)}
                style={{ padding: '7px 12px', border: '1px solid ' + LINEA, borderRadius: 20,
                  background: categoria === c ? NAVY : '#fff', color: categoria === c ? '#fff' : GRIS,
                  fontSize: 12.5, cursor: 'pointer' }}>{c}</button>
            ))}
          </div>
        )}
        <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota (opcional)"
          style={{ width: '100%', padding: '10px 12px', border: '1px solid ' + LINEA, borderRadius: 8, fontSize: 14, marginBottom: 10 }} />
        <button onClick={registrar} disabled={guardando || !monto}
          style={{ width: '100%', padding: 13, border: 'none', borderRadius: 8,
            background: (guardando || !monto) ? '#B9BCC2' : VERDE, color: '#fff', fontSize: 15, fontWeight: 600,
            cursor: (guardando || !monto) ? 'default' : 'pointer' }}>
          {guardando ? 'Guardando…' : 'Registrar'}
        </button>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>Meta de ahorro</div>
          <div style={{ fontSize: 12.5, color: GRIS }}>{mCorto(ahorro)} de {mCorto(metaAhorro)}</div>
        </div>
        <div style={{ height: 10, background: '#EFEFF2', borderRadius: 5, overflow: 'hidden' }}>
          <div style={{ width: pctMeta + '%', height: '100%', background: pctMeta >= 100 ? VERDE : pctMeta >= 50 ? VERDE : AMBAR }} />
        </div>
        <div style={{ fontSize: 12, color: GRIS, marginTop: 6 }}>{pctMeta}% de la meta del mes</div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <div style={{ ...card, flex: 1, margin: 0 }}>
          <div style={{ fontSize: 11.5, color: GRIS }}>Ingresos del mes</div>
          <div style={{ fontSize: 19, fontWeight: 700, color: VERDE, marginTop: 2 }}>{mCorto(ingresos)}</div>
        </div>
        <div style={{ ...card, flex: 1, margin: 0 }}>
          <div style={{ fontSize: 11.5, color: GRIS }}>Gastos del mes</div>
          <div style={{ fontSize: 19, fontWeight: 700, color: ROJO, marginTop: 2 }}>{mCorto(gastos)}</div>
        </div>
      </div>

      {(d.porCobrar || []).length > 0 && (
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 600, color: NAVY, marginBottom: 8 }}>Por cobrar</div>
          {(d.porCobrar || []).map((c) => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderTop: '1px solid #F1F2F5' }}>
              <div>
                <div style={{ fontSize: 13.5 }}>{c.concepto}</div>
                <div style={{ fontSize: 11.5, color: GRIS }}>esperado {fmtD(c.fecha_esperada)}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: AMBAR }}>{mCorto(c.monto)}</span>
                <button onClick={() => cobrar(c.id)}
                  style={{ padding: '6px 12px', border: 'none', borderRadius: 7, background: VERDE, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Cobrado</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {cats.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 600, color: NAVY, marginBottom: 10 }}>En qué se fue</div>
          {cats.map(([c, v]) => (
            <div key={c} style={{ marginBottom: 9 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 3 }}>
                <span>{c}</span>
                <span style={{ fontWeight: 600 }}>{mCorto(v)}</span>
              </div>
              <div style={{ height: 6, background: '#EFEFF2', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: (maxCat ? (v / maxCat) * 100 : 0) + '%', height: '100%', background: NAVY }} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 600, color: NAVY, marginBottom: 6 }}>Movimientos</div>
        {cargando && <p style={{ fontSize: 12.5, color: GRIS }}>Cargando…</p>}
        {!cargando && movs.length === 0 && <p style={{ fontSize: 12.5, color: GRIS }}>Sin movimientos este mes.</p>}
        {movs.map((m) => (
          <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderTop: '1px solid #F1F2F5' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5 }}>{m.categoria || (m.tipo === 'ingreso' ? 'Ingreso' : m.tipo === 'ahorro' ? 'Ahorro' : 'Gasto')}</div>
              <div style={{ fontSize: 11.5, color: GRIS, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {fmtD(m.fecha)}{m.nota ? ' · ' + m.nota : ''}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <span style={{ fontSize: 14.5, fontWeight: 600, color: m.tipo === 'ingreso' ? VERDE : m.tipo === 'ahorro' ? NAVY : ROJO }}>
                {m.tipo === 'ingreso' ? '+' : '−'}{mCorto(m.monto)}
              </span>
              <button onClick={() => borrar(m.id)}
                style={{ background: 'none', border: 'none', color: '#C4C6CC', fontSize: 17, cursor: 'pointer', padding: 0 }}>×</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
