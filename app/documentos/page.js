'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { subirArchivoDirecto } from '../../lib/supabaseClient';

function DocumentosInterior() {
  const searchParams = useSearchParams();

  const [catalogos, setCatalogos] = useState({ grupos: [], delegaciones: [] });
  const [filtroFolio, setFiltroFolio] = useState(searchParams.get('folio') || '');
  const [filtroGrupo, setFiltroGrupo] = useState('');
  const [filtroDeleg, setFiltroDeleg] = useState('');
  const [filtroIdentificado, setFiltroIdentificado] = useState('');
  const [pagina, setPagina] = useState(1);
  const [data, setData] = useState({ documentos: [], total: 0 });
  const [cargando, setCargando] = useState(true);
  const POR_PAGINA = 50;

  const [archivosSubiendo, setArchivosSubiendo] = useState([]);
  const [subiendo, setSubiendo] = useState(false);

  const [editandoId, setEditandoId] = useState(null);
  const [editGrupo, setEditGrupo] = useState('');
  const [editDeleg, setEditDeleg] = useState('');

  useEffect(() => {
    fetch('/api/catalogos').then((r) => r.json()).then(setCatalogos);
  }, []);

  useEffect(() => {
    cargar();
  }, [filtroFolio, filtroGrupo, filtroDeleg, filtroIdentificado, pagina]);

  async function cargar() {
    setCargando(true);
    const params = new URLSearchParams({ pagina, porPagina: POR_PAGINA });
    if (filtroFolio) params.set('folio', filtroFolio);
    if (filtroGrupo) params.set('grupo', filtroGrupo);
    if (filtroDeleg) params.set('delegacion', filtroDeleg);
    if (filtroIdentificado) params.set('identificado', filtroIdentificado);
    const res = await fetch('/api/documentos?' + params.toString());
    const json = await res.json();
    if (json.ok) setData({ documentos: json.documentos, total: json.total });
    setCargando(false);
  }

  async function subirArchivos(fileList) {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setSubiendo(true);
    setArchivosSubiendo(files.map((f) => ({ nombre: f.name, estado: 'esperando' })));

    try {
      const res = await fetch('/api/storage/solicitar-subida', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ carpeta: 'documentos', archivos: files.map((f) => ({ nombre: f.name })) }),
      });
      const data = await res.json();
      if (!data.ok) {
        setArchivosSubiendo(files.map((f) => ({ nombre: f.name, estado: 'error', detalle: data.error })));
        setSubiendo(false);
        return;
      }

      const registrar = [];
      for (let i = 0; i < files.length; i++) {
        const info = data.archivos[i];
        try {
          await subirArchivoDirecto(files[i], info.path, info.token);
          setArchivosSubiendo((prev) => prev.map((a, idx) => (idx === i ? { ...a, estado: 'subido' } : a)));
          registrar.push({ path: info.path, nombreOriginal: info.nombreOriginal });
        } catch (err) {
          setArchivosSubiendo((prev) => prev.map((a, idx) => (idx === i ? { ...a, estado: 'error', detalle: err.message } : a)));
        }
      }

      if (registrar.length > 0) {
        await fetch('/api/documentos/registrar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ archivos: registrar }),
        });
      }
      await cargar();
    } catch (err) {
      setArchivosSubiendo(files.map((f) => ({ nombre: f.name, estado: 'error', detalle: err.message })));
    }
    setSubiendo(false);
  }

  async function descargar(id) {
    const res = await fetch('/api/documentos/descargar?id=' + id);
    const data = await res.json();
    if (data.ok) window.open(data.url, '_blank');
  }

  function empezarEdicion(doc) {
    setEditandoId(doc.id);
    setEditGrupo(doc.grupo || '');
    setEditDeleg(doc.delegacion || '');
  }

  async function guardarEtiqueta(id) {
    await fetch('/api/documentos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, grupo: editGrupo, delegacion: editDeleg }),
    });
    setEditandoId(null);
    await cargar();
  }

  const totalPaginas = Math.max(1, Math.ceil((data.total || 0) / POR_PAGINA));

  return (
    <div className="app">
      <a href="/" className="btn btn-ghost btn-sm" style={{ display: 'inline-block', marginBottom: 16, textDecoration: 'none' }}>← Regresar al menú principal</a>
      <div className="hero">
        <div className="brandline">
          <img src="/logo_full_horizontal.svg" alt="Gestión Especializada en Cobranza" style={{ height: 40, width: 'auto', flexShrink: 0, filter: 'brightness(0) invert(1)' }} />
        </div>
        <div className="slogan">Carga de PDFs</div>
        <div className="divider-sub">Repositorio de PDFs de los clientes — súbelos aquí y jálalos por folio.</div>
      </div>

      <div className="card">
        <h2>Subir archivos</h2>
        <p className="muted" style={{ marginBottom: 12 }}>
          Puedes seleccionar varios PDFs a la vez. El sistema busca el folio de PDF/susceptible en el nombre del
          archivo y lo etiqueta solo si lo reconoce — si no, queda marcado como "Sin identificar" para etiquetarlo a mano.
        </p>
        <input type="file" accept=".pdf" multiple onChange={(e) => subirArchivos(e.target.files)} disabled={subiendo} />
        {archivosSubiendo.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {archivosSubiendo.map((a, i) => (
              <div key={i} className="muted" style={{ fontSize: 12.5, marginBottom: 4 }}>
                {a.estado === 'subido' && '✓ '}
                {a.estado === 'error' && '✗ '}
                {a.nombre} — {a.estado}{a.detalle ? `: ${a.detalle}` : ''}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2>Buscar documentos</h2>
        <div className="toolbar">
          <input
            value={filtroFolio}
            onChange={(e) => { setFiltroFolio(e.target.value); setPagina(1); }}
            placeholder="Buscar por folio de PDF/susceptible…"
            style={{ minWidth: 240 }}
          />
          <select value={filtroGrupo} onChange={(e) => { setFiltroGrupo(e.target.value); setPagina(1); }}>
            <option value="">Todos los grupos</option>
            {catalogos.grupos.map((g) => <option key={g.nombre} value={g.nombre}>{g.nombre}</option>)}
          </select>
          <select value={filtroDeleg} onChange={(e) => { setFiltroDeleg(e.target.value); setPagina(1); }}>
            <option value="">Todas las delegaciones</option>
            {catalogos.delegaciones.map((d) => <option key={d.nombre} value={d.nombre}>{d.nombre}</option>)}
          </select>
          <select value={filtroIdentificado} onChange={(e) => { setFiltroIdentificado(e.target.value); setPagina(1); }}>
            <option value="">Todos</option>
            <option value="1">Identificados</option>
            <option value="0">Sin identificar</option>
          </select>
        </div>

        {cargando ? <p className="muted">Cargando…</p> : (
          <>
            <table>
              <thead><tr><th>Archivo</th><th>Folio detectado</th><th>Grupo</th><th>Delegación</th><th>Subido</th><th></th></tr></thead>
              <tbody>
                {data.documentos.map((d) => (
                  <tr key={d.id}>
                    <td>{d.nombre_original}</td>
                    <td>{d.folio_detectado || '—'}</td>
                    {editandoId === d.id ? (
                      <>
                        <td>
                          <select value={editGrupo} onChange={(e) => setEditGrupo(e.target.value)}>
                            <option value="">— elige —</option>
                            {catalogos.grupos.map((g) => <option key={g.nombre} value={g.nombre}>{g.nombre}</option>)}
                          </select>
                        </td>
                        <td>
                          <select value={editDeleg} onChange={(e) => setEditDeleg(e.target.value)}>
                            <option value="">— elige —</option>
                            {catalogos.delegaciones.map((dl) => <option key={dl.nombre} value={dl.nombre}>{dl.nombre}</option>)}
                          </select>
                        </td>
                        <td className="muted">{new Date(d.fecha_subida).toLocaleDateString('es-MX')}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button className="btn btn-primary btn-sm" onClick={() => guardarEtiqueta(d.id)}>Guardar</button>{' '}
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditandoId(null)}>Cancelar</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{d.grupo || <span className="tag tag-amber">Sin identificar</span>}</td>
                        <td>{d.delegacion || '—'}</td>
                        <td className="muted">{new Date(d.fecha_subida).toLocaleDateString('es-MX')}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => descargar(d.id)}>Descargar</button>{' '}
                          <button className="btn btn-ghost btn-sm" onClick={() => empezarEdicion(d)}>Etiquetar</button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="toolbar" style={{ justifyContent: 'space-between', marginTop: 12 }}>
              <p className="muted">{data.total} documentos con estos filtros.</p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="btn btn-ghost btn-sm" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>Anterior</button>
                <span className="muted">Página {pagina} de {totalPaginas}</span>
                <button className="btn btn-ghost btn-sm" disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => p + 1)}>Siguiente</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Documentos() {
  return (
    <Suspense fallback={<div className="app"><p>Cargando…</p></div>}>
      <DocumentosInterior />
    </Suspense>
  );
}
