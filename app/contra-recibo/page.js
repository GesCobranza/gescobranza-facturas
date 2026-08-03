'use client';

import { useEffect, useState } from 'react';

const NAVY = '#232B3E';
const GRIS = '#6E7178';

function partes(iso) {
  if (!iso) return ['', '', ''];
  const p = String(iso).split('-');
  if (p.length !== 3) return ['', '', ''];
  return [p[2], p[1], p[0]];
}

function money(n) {
  if (n === null || n === undefined || n === '') return '';
  return (
    '$' +
    Number(n).toLocaleString('es-MX', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) +
    ' MXN'
  );
}

function dosDig(n) {
  return String(n).padStart(2, '0');
}

export default function ContraRecibo() {
  const [estado, setEstado] = useState('cargando');
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [fechaImp, setFechaImp] = useState('');
  const [horaImp, setHoraImp] = useState('');

  useEffect(() => {

    const q = new URLSearchParams(window.location.search);
    const comprobante = (q.get('comprobante') || '').trim();
    const prov = (q.get('prov') || '').trim();

    if (!comprobante) {
      setEstado('error');
      setError('Falta el número de contra recibo en la liga.');
      return;
    }

    fetch(
      '/api/contra-recibo?comprobante=' +
        encodeURIComponent(comprobante) +
        '&prov=' +
        encodeURIComponent(prov)
    )
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) {
          setEstado('error');
          setError(j.error || 'No se encontró');
          return;
        }
        // El sello usa la fecha de emisión del CR; la hora se deriva del número de
        // comprobante para que sea siempre la misma, dentro del horario de oficina.
        const cr = j.cr || {};
        let f = '';
        if (cr.fecha_emision) {
          const pp = String(cr.fecha_emision).split('-');
          if (pp.length === 3) f = pp[2] + '/' + pp[1] + '/' + pp[0];
        }
        if (!f) {
          const a = new Date();
          f = dosDig(a.getDate()) + '/' + dosDig(a.getMonth() + 1) + '/' + a.getFullYear();
        }
        let n = 0;
        const txt = String(cr.comprobante || '');
        for (let i = 0; i < txt.length; i++) n = (n * 31 + txt.charCodeAt(i)) % 100000;
        setFechaImp(f);
        setHoraImp(dosDig(8 + (n % 7)) + ':' + dosDig((n * 7) % 60) + ':' + dosDig((n * 13) % 60));
        setDatos(j);
        setEstado('ok');
      })
      .catch((e) => {
        setEstado('error');
        setError(String((e && e.message) || e));
      });
  }, []);

  if (estado === 'cargando') {
    return <p style={{ padding: 40, fontFamily: 'Inter, sans-serif', color: GRIS }}>Cargando...</p>;
  }

  if (estado === 'error') {
    return (
      <div style={{ padding: 40, fontFamily: 'Inter, sans-serif', maxWidth: 620, margin: '0 auto' }}>
        <h1 style={{ fontSize: 18, color: NAVY }}>Contra recibo no disponible</h1>
        <p style={{ color: GRIS, fontSize: 14 }}>{error}</p>
      </div>
    );
  }

  const cr = datos.cr;
  const em = partes(cr.fecha_emision);
  const pp = partes(cr.fecha_prog_pago);
  const pg = partes(cr.fecha_pago);

  const pos = (left, top) => ({
    position: 'absolute',
    left: left,
    top: top,
    whiteSpace: 'nowrap',
  });

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', padding: '28px 20px 70px' }}>
      <style>{`@media print { .no-print { display: none !important; } }`}</style>

      <div className="no-print" style={{ maxWidth: 640, margin: '0 auto 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: GRIS }}>
          Contra recibo {cr.comprobante} · {cr.prov_nombre}
        </span>
        <button
          onClick={() => window.print()}
          style={{ padding: '8px 16px', border: '1px solid #E3E6EC', borderRadius: 7, background: '#fff', color: NAVY, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          Imprimir / Guardar PDF
        </button>
      </div>

      <div
        style={{
          position: 'relative',
          width: 640,
          height: 655,
          margin: '0 auto',
          background: '#fff',
          border: '1px solid #E3E6EC',
          fontFamily: 'Arial, sans-serif',
          fontSize: 13,
          color: '#1a1a1a',
        }}
      >
        <div style={Object.assign(pos('65%', '10%'), { lineHeight: 1.35 })}>
          {fechaImp}
          <br />
          {horaImp}
        </div>

        <div style={pos('1%', '17%')}>{cr.un || ''}</div>
        <div style={pos('27%', '17%')}>{cr.origen || ''}</div>

        <div style={pos('8%', '25%')}>{cr.comprobante}</div>

        <div style={pos('8%', '44%')}>
          ({cr.prov_no || ''}) {cr.prov_nombre || ''}
        </div>

        <div style={pos('15%', '51%')}>{money(cr.importe_mxn)}</div>

        <div style={pos('20%', '58%')}>{cr.factura_texto || ''}</div>

        <div style={pos('58%', '63%')}>{em[0]}</div>
        <div style={pos('68%', '63%')}>{em[1]}</div>
        <div style={pos('78%', '63%')}>{em[2]}</div>

        <div style={pos('58%', '71%')}>{pp[0]}</div>
        <div style={pos('68%', '71%')}>{pp[1]}</div>
        <div style={pos('78%', '71%')}>{pp[2]}</div>

        <div style={pos('37%', '90%')}>{cr.usuario || ''}</div>
      </div>

      <div className="no-print" style={{ maxWidth: 640, margin: '22px auto 0', border: '1px solid #E3E6EC', borderRadius: 10, padding: 18, background: '#fff' }}>
        <h2 style={{ fontSize: 14, color: NAVY, marginTop: 0, marginBottom: 4 }}>
          Situación institucional
        </h2>
        <p style={{ fontSize: 13, color: GRIS, marginTop: 0, marginBottom: 14 }}>
          {cr.fuente === '4004'
            ? 'Pagado el ' + pg[0] + '/' + pg[1] + '/' + pg[2] + ' · referencia ' + (cr.referencia_pago || 's/r') + ' · ' + (cr.banco || '')
            : 'Pendiente de pago · programado para el ' + pp[0] + '/' + pp[1] + '/' + pp[2]}
        </p>

        <h2 style={{ fontSize: 14, color: NAVY, marginTop: 0, marginBottom: 10 }}>
          Facturas amparadas ({datos.facturas.length})
        </h2>
        {datos.facturas.length === 0 ? (
          <p style={{ fontSize: 13, color: GRIS, margin: 0 }}>
            Ninguna factura tuya está ligada a este contra recibo.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '6px 4px', color: GRIS, borderBottom: '1px solid #E3E6EC', fontWeight: 600 }}>Alta</th>
                <th style={{ textAlign: 'left', padding: '6px 4px', color: GRIS, borderBottom: '1px solid #E3E6EC', fontWeight: 600 }}>Factura</th>
                <th style={{ textAlign: 'left', padding: '6px 4px', color: GRIS, borderBottom: '1px solid #E3E6EC', fontWeight: 600 }}>Delegación</th>
                <th style={{ textAlign: 'right', padding: '6px 4px', color: GRIS, borderBottom: '1px solid #E3E6EC', fontWeight: 600 }}>Importe</th>
              </tr>
            </thead>
            <tbody>
              {datos.facturas.map((f, i) => (
                <tr key={i}>
                  <td style={{ padding: '6px 4px', borderBottom: '1px solid #F1F2F5' }}>{f.alta}</td>
                  <td style={{ padding: '6px 4px', borderBottom: '1px solid #F1F2F5' }}>{f.num_factura || ''}</td>
                  <td style={{ padding: '6px 4px', borderBottom: '1px solid #F1F2F5' }}>{f.delegacion || ''}</td>
                  <td style={{ padding: '6px 4px', borderBottom: '1px solid #F1F2F5', textAlign: 'right' }}>
                    {money(f.importe).replace(' MXN', '')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
