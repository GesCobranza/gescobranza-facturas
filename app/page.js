'use client';
import { useState, useEffect, Fragment } from 'react';
import * as XLSX from 'xlsx';
import { subirArchivoDirecto } from '../lib/supabaseClient';

export default function Home() {
  const [tab, setTab] = useState('captura');

  // Permite volver directo a una pestaña (ej. /?tab=gestores desde Registrar envío)
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t) setTab(t);
  }, []);
  const [catalogos, setCatalogos] = useState({ grupos: [], delegaciones: [] });
  const [cargando, setCargando] = useState(true);
  const [seleccionados, setSeleccionados] = useState(new Set());

  // ---- Consulta ----
  const [cFiltroGrupo, setCFiltroGrupo] = useState('');
  const [cFiltroDeleg, setCFiltroDeleg] = useState('');
  const [cFiltroProvNo, setCFiltroProvNo] = useState('');
  const [cFiltroEstatus, setCFiltroEstatus] = useState('');
  const [cFiltroObservacion, setCFiltroObservacion] = useState(false);
  const [cBusquedaInput, setCBusquedaInput] = useState('');
  const [cBusqueda, setCBusqueda] = useState('');
  const [cFiltroCapturista, setCFiltroCapturista] = useState('');
  const [cFiltroFechaDesde, setCFiltroFechaDesde] = useState('');
  const [cFiltroFechaHasta, setCFiltroFechaHasta] = useState('');
  const [cPagina, setCPagina] = useState(1);
  const [consultaData, setConsultaData] = useState({ facturas: [], total: 0 });
  const [consultaCargando, setConsultaCargando] = useState(false);
  const CONSULTA_POR_PAGINA = 50;

  // ---- Panel KPI ----
  const [kFiltroGrupo, setKFiltroGrupo] = useState('');
  const [kFiltroDeleg, setKFiltroDeleg] = useState('');
  const [kFiltroProvNo, setKFiltroProvNo] = useState('');
  const [kpiData, setKpiData] = useState(null);
  const [kpiCargando, setKpiCargando] = useState(false);

  // ---- Seguimiento (gestores) ----
  const [gPagina, setGPagina] = useState(1);
  const [seguimientoData, setSeguimientoData] = useState({ resumenPorDelegacion: [], resumenEsperando: [], esperando: [], filasGestores: [], totalFilasGestores: 0 });
  const [verTodasPend, setVerTodasPend] = useState(false);
  const [verTodasEsp, setVerTodasEsp] = useState(false);
  const [gCargando, setGCargando] = useState(false);
  const GESTORES_POR_PAGINA = 50;

  // ---- Captura ----
  const [grupo, setGrupo] = useState('');
  const [empresaNumero, setEmpresaNumero] = useState('');
  const [delegacion, setDelegacion] = useState('');
  const [pdf, setPdf] = useState('');
  const [numFactura, setNumFactura] = useState('');
  const [alta, setAlta] = useState('');
  const [altaExiste, setAltaExiste] = useState(false);
  const [verificandoAlta, setVerificandoAlta] = useState(false);
  const [alta5005, setAlta5005] = useState(null);
  const [altaOtroProv, setAltaOtroProv] = useState(null);
  const [importeTexto, setImporteTexto] = useState('');
  const [importeRaw, setImporteRaw] = useState(0);
  const [capturista, setCapturista] = useState('Sophie');

  // ---- Captura: por lotes (mismo susceptible/PDF, varias facturas) ----
  const [loteActivo, setLoteActivo] = useState(false);
  const [loteCantidadTexto, setLoteCantidadTexto] = useState('');
  const [loteFilas, setLoteFilas] = useState([]);
  const [loteGuardando, setLoteGuardando] = useState(false);
  const [loteMensaje, setLoteMensaje] = useState('');
  const [loteMensajeTipo, setLoteMensajeTipo] = useState('');
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

  // ---- Gestores: filtros de detalle ----
  const [gFiltroDeleg, setGFiltroDeleg] = useState('');
  const [gFiltroEnvio, setGFiltroEnvio] = useState('');
  const [gOrden, setGOrden] = useState('reciente');

  // ---- Consulta: edición inline ----
  const [editandoId, setEditandoId] = useState(null);
  const [editAlta, setEditAlta] = useState('');
  const [editImporte, setEditImporte] = useState('');
  const [editMensaje, setEditMensaje] = useState('');
  const [editGuardando, setEditGuardando] = useState(false);
  const [exportando, setExportando] = useState(false);

  // ---- Comentarios (Seguimiento Envío) ----
  const [comentarioFacturaId, setComentarioFacturaId] = useState(null);
  const [agruparPor, setAgruparPor] = useState('ninguno');
  const [comprobantePanelAbierto, setComprobantePanelAbierto] = useState(false);
  const [comprobanteArchivo, setComprobanteArchivo] = useState(null);
  const [comprobanteNumero, setComprobanteNumero] = useState('');
  const [comprobanteSubiendo, setComprobanteSubiendo] = useState(false);
  const [comprobanteMensaje, setComprobanteMensaje] = useState('');
  const [comentarios, setComentarios] = useState([]);
  const [comentarioTexto, setComentarioTexto] = useState('');
  const [comentarioCargando, setComentarioCargando] = useState(false);
  const [comentarioGuardando, setComentarioGuardando] = useState(false);

  // ---- Cruce 5005 ----
  const [raw5005Files, setRaw5005Files] = useState([]);
  const [raw5005Mensaje, setRaw5005Mensaje] = useState('');
  const [cruceMensaje, setCruceMensaje] = useState('');
  const [cargandoCruce, setCargandoCruce] = useState(false);
  const [auditoriaResultado, setAuditoriaResultado] = useState(null);
  const [cargandoAuditoria, setCargandoAuditoria] = useState(false);
  const [diagAltaInput, setDiagAltaInput] = useState('');
  const [diagResultado, setDiagResultado] = useState(null);
  const [diagCargando, setDiagCargando] = useState(false);

  useEffect(() => { cargarCatalogos(); }, []);

  useEffect(() => {
    const t = setTimeout(() => { setCBusqueda(cBusquedaInput); setCPagina(1); }, 400);
    return () => clearTimeout(t);
  }, [cBusquedaInput]);

  useEffect(() => {
    if (tab === 'consulta') cargarConsulta();
  }, [tab, cFiltroGrupo, cFiltroDeleg, cFiltroProvNo, cFiltroEstatus, cFiltroObservacion, cFiltroCapturista, cFiltroFechaDesde, cFiltroFechaHasta, cBusqueda, cPagina]);

  useEffect(() => {
    if (tab === 'panel') cargarKpi();
  }, [tab, kFiltroGrupo, kFiltroDeleg, kFiltroProvNo]);

  useEffect(() => {
    if (tab === 'gestores') cargarSeguimiento();
  }, [tab, gFiltroDeleg, gFiltroEnvio, gOrden, gPagina]);

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

  async function cargarConsulta() {
    setConsultaCargando(true);
    const params = new URLSearchParams({ pagina: cPagina, porPagina: CONSULTA_POR_PAGINA });
    if (cFiltroGrupo) params.set('grupo', cFiltroGrupo);
    if (cFiltroDeleg) params.set('delegacion', cFiltroDeleg);
    if (cFiltroProvNo) params.set('provNo', cFiltroProvNo);
    if (cFiltroEstatus) params.set('estatus', cFiltroEstatus);
    if (cFiltroObservacion) params.set('conObservacion', '1');
    if (cFiltroCapturista) params.set('capturista', cFiltroCapturista);
    if (cFiltroFechaDesde) params.set('fechaDesde', cFiltroFechaDesde);
    if (cFiltroFechaHasta) params.set('fechaHasta', cFiltroFechaHasta);
    if (cBusqueda) params.set('busqueda', cBusqueda);
    const res = await fetch('/api/facturas?' + params.toString());
    const data = await res.json();
    setConsultaData({ facturas: data.facturas || [], total: data.total || 0 });
    setConsultaCargando(false);
  }

  async function cargarKpi() {
    setKpiCargando(true);
    const params = new URLSearchParams();
    if (kFiltroGrupo) params.set('grupo', kFiltroGrupo);
    if (kFiltroDeleg) params.set('delegacion', kFiltroDeleg);
    if (kFiltroProvNo) params.set('provNo', kFiltroProvNo);
    const res = await fetch('/api/kpi?' + params.toString());
    const data = await res.json();
    setKpiData(data.ok ? data : null);
    setKpiCargando(false);
  }

  async function cargarSeguimiento() {
    setGCargando(true);
    const params = new URLSearchParams({ pagina: gPagina, porPagina: GESTORES_POR_PAGINA });
    if (gFiltroDeleg) params.set('delegacion', gFiltroDeleg);
    if (gFiltroEnvio) params.set('envio', gFiltroEnvio);
    params.set('orden', gOrden);
    const res = await fetch('/api/seguimiento?' + params.toString());
    const data = await res.json();
    if (data.ok) setSeguimientoData(data);
    setGCargando(false);
  }

  const grupoObj = catalogos.grupos.find((g) => g.nombre === grupo);
  const empresas = grupoObj ? grupoObj.empresas : [];
  const empresaObj = empresas.find((e) => e.numero === empresaNumero);

  function formatearFechaCaptura(valor) {
    if (!valor) return '—';
    const d = new Date(valor);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  // Quita caracteres invisibles (U+200B..U+200F, U+202A..U+202E, etc.) que se pegan
  // solos al copiar desde Word o PDF y hacen que dos altas idénticas a la vista no lo sean.
  function limpiarInvisibles(v) {
    return String(v == null ? '' : v).replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, '');
  }

  const FORMATO_ALTA = /^[0-9]{6}-[0-9]{6}$/;

  async function verificarAltaExistente(valor) {
    const limpio = limpiarInvisibles(valor).trim();
    if (limpio !== String(valor || '')) setAlta(limpio);
    if (!limpio) { setAltaExiste(false); setAlta5005(null); return; }
    setVerificandoAlta(true);
    try {
      const provActual = empresaObj ? String(empresaObj.numero).replace(/^0+/, '') : '';
      const res = await fetch('/api/facturas/existe?alta=' + encodeURIComponent(limpio) + '&prov=' + encodeURIComponent(provActual));
      const data = await res.json();
      setAltaExiste(data.ok ? data.existe : false);
      setAltaOtroProv(data.ok && data.otroProveedor ? data.detalleOtro : null);
    } catch (err) {
      // si falla la verificación, no bloqueamos — el servidor la revisa de todas formas al guardar
    }
    try {
      const r2 = await fetch('/api/altas/verificar?alta=' + encodeURIComponent(limpio));
      const d2 = await r2.json();
      setAlta5005(d2 && d2.ok ? d2 : null);
    } catch (err) {
      setAlta5005(null);
    }
    setVerificandoAlta(false);
  }

  // Trae del 5005 el importe y avisa si el proveedor elegido no corresponde
  function usarDatos5005() {
    if (!alta5005 || !alta5005.encontrada || !alta5005.candidatos.length) return;
    const c = alta5005.candidatos[0];
    const centavos = Math.round(Number(c.importe || 0) * 100);
    formatearImporte(String(centavos));
    if (c.grupo && c.grupo !== grupo) setGrupo(c.grupo);
    if (c.numeroCatalogo) setEmpresaNumero(c.numeroCatalogo);
  }

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

  // ---- Captura por lotes: acciones ----
  function generarFilasLote() {
    const n = Math.max(2, Math.min(30, parseInt(loteCantidadTexto, 10) || 0));
    if (!n) {
      setLoteMensaje('Escribe cuántas facturas incluye este susceptible (mínimo 2).');
      setLoteMensajeTipo('error');
      return;
    }
    setLoteFilas(Array.from({ length: n }, () => ({ alta: '', importeTexto: '', importeRaw: 0, numFactura: '' })));
    setLoteMensaje('');
  }

  function actualizarFilaLote(idx, campo, valor) {
    const limpio = campo === 'alta' ? limpiarInvisibles(valor) : valor;
    setLoteFilas((prev) => prev.map((f, i) => (i === idx ? { ...f, [campo]: limpio, ...(campo === 'alta' ? { info5005: null } : {}) } : f)));
  }

  function formatearImporteLote(idx, valorInput) {
    let digitos = valorInput.replace(/\D/g, '');
    digitos = digitos.replace(/^0+/, '') || '0';
    if (digitos.length > 11) digitos = digitos.slice(0, 11);
    const valor = parseInt(digitos, 10) / 100;
    setLoteFilas((prev) => prev.map((f, i) => (i === idx
      ? { ...f, importeRaw: valor, importeTexto: valor.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) }
      : f)));
  }

  function validarAltaLote(altaValor) {
    if (!deleg || !altaValor) return { ok: false, hint: deleg ? `Debe iniciar con ${deleg.codigo.split(',').join(' o ')}` : '' };
    const codigos = deleg.codigo.split(',');
    const ok = codigos.some((c) => altaValor.startsWith(c));
    return { ok, hint: ok ? `✓ Coincide con ${codigos.join(' o ')}` : `✗ Debe iniciar con ${codigos.join(' o ')}` };
  }

  async function verificarAltaLoteExistente(idx, valor) {
    const limpio = limpiarInvisibles(valor).trim();
    if (!limpio) return;
    try {
      const provActual = empresaObj ? String(empresaObj.numero).replace(/^0+/, '') : '';
      const res = await fetch('/api/facturas/existe?alta=' + encodeURIComponent(limpio) + '&prov=' + encodeURIComponent(provActual));
      const data = await res.json();
      if (data.ok) {
        setLoteFilas((prev) => prev.map((f, i) => (i === idx ? { ...f, existeEnServidor: data.existe, otroProv: data.otroProveedor ? data.detalleOtro : null } : f)));
      }
    } catch (err) {
      // si falla, no bloqueamos aquí — el servidor lo revisa de nuevo al guardar
    }
    try {
      const r2 = await fetch('/api/altas/verificar?alta=' + encodeURIComponent(limpio));
      const d2 = await r2.json();
      setLoteFilas((prev) => prev.map((f, i) => (i === idx ? { ...f, info5005: (d2 && d2.ok ? d2 : null) } : f)));
    } catch (err) {
      setLoteFilas((prev) => prev.map((f, i) => (i === idx ? { ...f, info5005: null } : f)));
    }
  }

  // Trae el importe del 5005 a un renglón del lote
  function usarImporte5005Lote(idx) {
    setLoteFilas((prev) => prev.map((f, i) => {
      if (i !== idx || !f.info5005 || !f.info5005.encontrada || !f.info5005.candidatos.length) return f;
      const valor = Number(f.info5005.candidatos[0].importe || 0);
      return { ...f, importeRaw: valor, importeTexto: valor.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) };
    }));
  }

  const loteTodoListo = loteFilas.length > 0
    && grupo && empresaObj && delegacion && pdf
    && loteFilas.every((f) => f.alta && f.importeRaw > 0 && FORMATO_ALTA.test(f.alta.trim()) && validarAltaLote(f.alta).ok && !f.existeEnServidor);

  const loteAltasDuplicadasEntreSi = (() => {
    const vistos = new Set();
    const dup = new Set();
    loteFilas.forEach((f) => {
      const a = f.alta.trim().toLowerCase();
      if (!a) return;
      if (vistos.has(a)) dup.add(a); else vistos.add(a);
    });
    return dup;
  })();

  async function guardarLote() {
    setLoteGuardando(true);
    setLoteMensaje('');
    const res = await fetch('/api/facturas/lote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grupo, empresa: empresaObj.nombre, delegacion, pdf,
        provNo: empresaObj.numero, provNombre: empresaObj.nombre,
        capturista, fechaRecepcion,
        filas: loteFilas.map((f) => ({ alta: f.alta, importe: f.importeRaw, numFactura: f.numFactura })),
      }),
    });
    const data = await res.json();
    setLoteGuardando(false);
    if (data.ok) {
      setLoteMensaje(`✓ ${data.insertadas} facturas guardadas correctamente para este susceptible.`);
      setLoteMensajeTipo('ok');
      setPdf(''); setLoteFilas([]); setLoteCantidadTexto('');
    } else {
      setLoteMensaje(data.error || 'No se pudo guardar el lote.');
      setLoteMensajeTipo('error');
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
    await cargarSeguimiento();
  }
  async function quitarEnviada(id) {
    await fetch('/api/facturas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'quitarEnviada', id }),
    });
    await cargarSeguimiento();
  }

  async function subirComprobante() {
    if (!comprobanteArchivo || seleccionados.size === 0) return;
    setComprobanteSubiendo(true);
    setComprobanteMensaje('');
    try {
      const resSolicitud = await fetch('/api/storage/solicitar-subida', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ carpeta: 'comprobantes', archivos: [{ nombre: comprobanteArchivo.name }] }),
      });
      const dataSolicitud = await resSolicitud.json();
      if (!dataSolicitud.ok) {
        setComprobanteMensaje('Error: ' + dataSolicitud.error);
        setComprobanteSubiendo(false);
        return;
      }
      const info = dataSolicitud.archivos[0];
      await subirArchivoDirecto(comprobanteArchivo, info.path, info.token);

      const resAdjuntar = await fetch('/api/facturas/adjuntar-comprobante', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(seleccionados), path: info.path, numeroComprobante: comprobanteNumero }),
      });
      const dataAdjuntar = await resAdjuntar.json();
      if (dataAdjuntar.ok) {
        setComprobantePanelAbierto(false);
        setComprobanteArchivo(null);
        setComprobanteNumero('');
        setSeleccionados(new Set());
        await cargarSeguimiento();
      } else {
        setComprobanteMensaje('Error: ' + dataAdjuntar.error);
      }
    } catch (err) {
      setComprobanteMensaje('Error al subir: ' + err.message);
    }
    setComprobanteSubiendo(false);
  }

  async function verComprobante(path) {
    const res = await fetch('/api/storage/descargar?path=' + encodeURIComponent(path));
    const data = await res.json();
    if (data.ok) window.open(data.url, '_blank');
  }

  // ---- Consulta: editar (solo alta e importe) ----
  function empezarEdicion(f) {
    setEditandoId(f.id);
    setEditAlta(f.alta);
    setEditImporte(String(f.importe));
    setEditMensaje('');
  }
  function cancelarEdicion() {
    setEditandoId(null);
    setEditMensaje('');
  }
  async function guardarEdicion(id) {
    setEditGuardando(true);
    setEditMensaje('');
    const res = await fetch('/api/facturas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'editar', id, alta: editAlta, importe: parseFloat(editImporte) }),
    });
    const data = await res.json();
    setEditGuardando(false);
    if (data.ok) {
      setEditandoId(null);
      await cargarConsulta();
    } else {
      setEditMensaje(data.error || 'No se pudo guardar.');
    }
  }

  // ---- Consulta: exportar a Excel ----
  async function exportarConsultaExcel() {
    setExportando(true);
    const params = new URLSearchParams({ exportar: '1' });
    if (cFiltroGrupo) params.set('grupo', cFiltroGrupo);
    if (cFiltroDeleg) params.set('delegacion', cFiltroDeleg);
    if (cFiltroProvNo) params.set('provNo', cFiltroProvNo);
    if (cFiltroEstatus) params.set('estatus', cFiltroEstatus);
    if (cFiltroObservacion) params.set('conObservacion', '1');
    if (cFiltroCapturista) params.set('capturista', cFiltroCapturista);
    if (cFiltroFechaDesde) params.set('fechaDesde', cFiltroFechaDesde);
    if (cFiltroFechaHasta) params.set('fechaHasta', cFiltroFechaHasta);
    if (cBusqueda) params.set('busqueda', cBusqueda);
    const res = await fetch('/api/facturas?' + params.toString());
    const data = await res.json();
    const filas = (data.facturas || []).map((f) => ({
      Alta: f.alta, Grupo: f.grupo, Empresa: f.empresa, Delegación: f.delegacion,
      Importe: Number(f.importe), CR: f.tiene_cr ? 'Con CR' : 'Sin CR',
      Comprobante: f.comprobante || '', 'PDF/Susceptible': f.pdf || '', 'No. Factura': f.num_factura || '',
      Capturista: f.capturista || '', 'Fecha Captura': f.fecha_captura || '',
    }));
    const ws = XLSX.utils.json_to_sheet(filas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Consulta');
    XLSX.writeFile(wb, 'consulta-facturas.xlsx');
    setExportando(false);
  }

  // ---- Comentarios ----
  async function abrirComentarios(facturaId) {
    setComentarioFacturaId(facturaId);
    setComentarioTexto('');
    setComentarioCargando(true);
    const res = await fetch('/api/comentarios?facturaId=' + facturaId);
    const data = await res.json();
    setComentarios(data.ok ? data.comentarios : []);
    setComentarioCargando(false);
  }
  function cerrarComentarios() {
    setComentarioFacturaId(null);
    setComentarios([]);
  }
  async function guardarComentario() {
    if (!comentarioTexto.trim()) return;
    setComentarioGuardando(true);
    await fetch('/api/comentarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ facturaId: comentarioFacturaId, comentario: comentarioTexto.trim() }),
    });
    setComentarioTexto('');
    setComentarioGuardando(false);
    await abrirComentarios(comentarioFacturaId);
    await cargarSeguimiento();
  }

  // ---- Cruce 5005: acciones ----
  async function cargarArchivo5005() {
    if (!raw5005Files || raw5005Files.length === 0) {
      setRaw5005Mensaje('Selecciona primero el archivo (o archivos) del 5005.');
      return;
    }
    let totalCargadas = 0;
    let primerBloqueGlobal = true; // solo se borra la tabla una vez, en el primer bloque del primer archivo de toda la selección
    try {
      for (let f = 0; f < raw5005Files.length; f++) {
        const archivo = raw5005Files[f];
        setRaw5005Mensaje(`Leyendo archivo ${f + 1} de ${raw5005Files.length}: ${archivo.name}…`);
        const buffer = await archivo.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const hoja = wb.Sheets[wb.SheetNames[0]];
        const filasCrudas = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: '' });

        // Busca automáticamente en qué fila están los encabezados y en qué columna está cada dato
        let idxHeader = -1, colProv = -1, colAlta = -1, colImporte = -1, colComp = -1;
        for (let i = 0; i < Math.min(filasCrudas.length, 10); i++) {
          const fila = filasCrudas[i].map((c) => String(c).toLowerCase().trim());
          const p = fila.findIndex((c) => c.includes('proveedor'));
          const a = fila.findIndex((c) => c.includes('ent alm') || c === 'alta');
          const imp = fila.findIndex((c) => c.includes('importe'));
          const comp = fila.findIndex((c) => c.includes('comprobante'));
          if (p > -1 && a > -1 && imp > -1 && comp > -1) {
            idxHeader = i; colProv = p; colAlta = a; colImporte = imp; colComp = comp;
            break;
          }
        }
        if (idxHeader === -1) {
          setRaw5005Mensaje(`⚠ El archivo "${archivo.name}" no tiene las columnas esperadas — se omitió. Cargadas hasta ahora: ${totalCargadas} filas.`);
          continue;
        }

        const filas = [];
        for (let i = idxHeader + 1; i < filasCrudas.length; i++) {
          const fila = filasCrudas[i];
          const proveedor = String(fila[colProv] || '').trim();
          const alta = String(fila[colAlta] || '').trim();
          const importeNum = parseFloat(String(fila[colImporte]).replace(/[^0-9.\-]/g, ''));
          const comprobante = String(fila[colComp] || '').trim();
          if (!alta || !proveedor || isNaN(importeNum)) continue;
          filas.push({ proveedor, alta, importe: importeNum, comprobante });
        }

        if (filas.length === 0) {
          setRaw5005Mensaje(`⚠ El archivo "${archivo.name}" no tiene filas de datos válidas — se omitió. Cargadas hasta ahora: ${totalCargadas} filas.`);
          continue;
        }

        const TAMANO_BLOQUE = 2000;
        const bloques = [];
        for (let i = 0; i < filas.length; i += TAMANO_BLOQUE) bloques.push(filas.slice(i, i + TAMANO_BLOQUE));

        for (let b = 0; b < bloques.length; b++) {
          setRaw5005Mensaje(`Archivo ${f + 1} de ${raw5005Files.length} (${archivo.name}) — bloque ${b + 1} de ${bloques.length}… (${totalCargadas} filas cargadas hasta ahora)`);
          const res = await fetch('/api/raw5005', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filas: bloques[b], primerBloque: primerBloqueGlobal }),
          });
          const data = await res.json();
          if (!data.ok) {
            setRaw5005Mensaje(`Error en "${archivo.name}", bloque ${b + 1}: ${data.error}. Se cargaron ${totalCargadas} filas antes del error.`);
            return;
          }
          totalCargadas += data.cargadas;
          primerBloqueGlobal = false;
        }
      }
      setRaw5005Mensaje(`✓ Carga terminada: ${totalCargadas} filas de ${raw5005Files.length} archivo(s). Ya puedes cruzar.`);
    } catch (err) {
      setRaw5005Mensaje('Error leyendo los archivos: ' + err.message);
    }
  }

async function cruzarCon5005() {
    setCargandoCruce(true);
    setCruceMensaje('Cruzando…');
    try {
      const res = await fetch('/api/cruce5005', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        const totalTexto = data.totalConAlertaActual !== null && data.totalConAlertaActual !== undefined
          ? ` · Total con alerta de importe activa AHORA en toda la base: ${data.totalConAlertaActual} (este es el número que debe coincidir con "Solo con observaciones" en Consulta).`
          : '';
        setCruceMensaje(`Cruce terminado: ${data.encontrados} CR encontrados, ${data.corregidos} corregidos (ya tenían CR y se les actualizó comprobante/importe), ${data.alertasLimpiadas} alertas de importe viejas limpiadas, ${data.alertasImporte} alertas de importe nuevas/vigentes en esta corrida, ${data.pendientesImss} facturas sin CR que están en el 5005 pero el IMSS aún no les asigna comprobante (quedan Sin CR sin alerta, es su estado normal), ${data.ambiguos} casos ambiguos, ${data.incompletos} filas con datos incompletos.${totalTexto}`);
      } else {
        setCruceMensaje(`Error: ${data.error}`);
      }
    } catch (err) {
      setCruceMensaje('Error de conexión: ' + err.message);
    } finally {
      setCargandoCruce(false);
    }
  }

  async function auditarCon5005() {
    setCargandoAuditoria(true);
    setAuditoriaResultado(null);
    try {
      const res = await fetch('/api/auditar5005', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setAuditoriaResultado(data);
      } else {
        setAuditoriaResultado({ ok: false, error: data.error });
      }
    } catch (err) {
      setAuditoriaResultado({ ok: false, error: err.message });
    } finally {
      setCargandoAuditoria(false);
    }
  }

  async function buscarDiagnostico() {
    if (!diagAltaInput.trim()) return;
    setDiagCargando(true);
    setDiagResultado(null);
    try {
      const res = await fetch('/api/diagnostico5005?alta=' + encodeURIComponent(diagAltaInput.trim()));
      const data = await res.json();
      setDiagResultado(data);
    } catch (err) {
      setDiagResultado({ ok: false, error: err.message });
    } finally {
      setDiagCargando(false);
    }
  }

  const grupoCatObj = catalogos.grupos.find((g) => g.nombre === catGrupoSel);
  const empresasCat = grupoCatObj ? grupoCatObj.empresas : [];

  // ---- Gestores: "esperando CR" con días calculados ----
  const esperando = (seguimientoData.esperando || [])
    .map((f) => ({ ...f, dias: Math.floor((Date.now() - new Date(f.fecha_envio)) / 86400000) }))
    .sort((a, b) => b.dias - a.dias);
  const gruposEsperando = agruparPor === 'ninguno'
    ? null
    : Object.entries(
        esperando.reduce((acc, f) => {
          const clave = agruparPor === 'grupo' ? f.grupo : f.delegacion;
          if (!acc[clave]) acc[clave] = [];
          acc[clave].push(f);
          return acc;
        }, {})
      ).sort((a, b) => b[1].length - a[1].length);
  const maxPend = Math.max(1, ...(seguimientoData.resumenPorDelegacion || []).map((v) => v.n));
  const pendOrdenadas = [...(seguimientoData.resumenPorDelegacion || [])].sort((a, b) => Number(b.importe || 0) - Number(a.importe || 0));
  const espOrdenadas = [...(seguimientoData.resumenEsperando || [])].sort((a, b) => Number(b.importe_fuera_meta || 0) - Number(a.importe_fuera_meta || 0));
  const TARJETAS_VISIBLES = 12;

  // Meta: 6 días desde el envío. El color solo mira los días de espera.
  function colorMeta(dias) {
    if (dias == null) return { fondo: 'var(--card)', borde: 'var(--line)', texto: 'var(--navy)' };
    if (dias > 12) return { fondo: 'var(--red-soft)', borde: 'var(--red)', texto: 'var(--red)' };
    if (dias > 6) return { fondo: 'var(--amber-soft)', borde: 'var(--amber)', texto: 'var(--amber)' };
    return { fondo: 'var(--green-soft)', borde: 'var(--green)', texto: 'var(--green)' };
  }

  // Al elegir una delegación desde las tarjetas, baja al detalle para que se vea el efecto.
  function filtrarPorDelegacion(deleg, tipoEnvio) {
    setGFiltroDeleg(deleg);
    setGFiltroEnvio(tipoEnvio);
    setGPagina(1);
    setTimeout(() => {
      const el = document.getElementById('detalle-seguimiento');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  }

  function mmm(n) {
    const v = Number(n || 0);
    if (v >= 1000000) return '$' + (v / 1000000).toFixed(1) + ' M';
    if (v >= 1000) return '$' + Math.round(v / 1000) + ' mil';
    return '$' + v.toFixed(0);
  }

  function filaEsperando(f) {
    return (
      <Fragment key={f.id}>
        <tr>
          <td><input type="checkbox" checked={seleccionados.has(f.id)} onChange={() => toggleSeleccion(f.id)} /></td>
          <td>{f.alta}</td><td>{f.empresa}</td>
          <td>{f.pdf ? <a href={`/documentos?folio=${f.pdf}`} target="_blank" rel="noreferrer">{f.pdf} · Ver PDF</a> : '—'}</td>
          <td>{f.delegacion}</td>
          <td>${Number(f.importe).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
          <td className="muted">{formatearFechaCaptura(f.fecha_captura)}</td>
          <td>{f.dias > 15 ? <span className="tag" style={{ background: 'var(--red-soft)', color: 'var(--red)' }}>{f.dias}d</span> : <span className="muted">{f.dias}d</span>}</td>
          <td>
            <button className="btn btn-ghost btn-sm" onClick={() => comentarioFacturaId === f.id ? cerrarComentarios() : abrirComentarios(f.id)}>
              💬 {f.comentarios_count > 0 ? f.comentarios_count : ''}
            </button>
          </td>
        </tr>
        {comentarioFacturaId === f.id && (
          <tr>
            <td colSpan={9} style={{ background: 'var(--bg-soft, #f7f8fa)', padding: 16 }}>
              <div className="row-inline">
                <input
                  placeholder="Ej. Gestor indica falta firma en el comprobante, se reenvía 10/07"
                  value={comentarioTexto}
                  onChange={(e) => setComentarioTexto(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') guardarComentario(); }}
                  autoFocus
                />
                <button className="btn btn-primary btn-sm" onClick={guardarComentario} disabled={comentarioGuardando}>
                  {comentarioGuardando ? 'Guardando…' : 'Agregar'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={cerrarComentarios}>Cerrar</button>
              </div>
              {comentarioCargando ? <p className="muted">Cargando…</p> : (
                comentarios.length === 0 ? <p className="muted">Sin comentarios todavía.</p> : (
                  <div style={{ marginTop: 10 }}>
                    {comentarios.map((c) => (
                      <div key={c.id} style={{ padding: '8px 0', borderTop: '1px solid var(--border, #e5e7eb)' }}>
                        <div className="muted" style={{ fontSize: 12 }}>{new Date(c.fecha).toLocaleString('es-MX')}</div>
                        <div>{c.comentario}</div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </td>
          </tr>
        )}
      </Fragment>
    );
  }

  const filasGestores = seguimientoData.filasGestores || [];
  const totalPaginasGestores = Math.max(1, Math.ceil((seguimientoData.totalFilasGestores || 0) / GESTORES_POR_PAGINA));
  const totalPaginasConsulta = Math.max(1, Math.ceil((consultaData.total || 0) / CONSULTA_POR_PAGINA));

  // Suma de importes de las facturas seleccionadas — para comparar contra el total del CR físico
  const sumaSeleccionados = (() => {
    const mapaImportes = {};
    [...esperando, ...filasGestores].forEach((f) => { mapaImportes[f.id] = Number(f.importe) || 0; });
    return Array.from(seleccionados).reduce((total, id) => total + (mapaImportes[id] || 0), 0);
  })();

  // ---- Consulta: empresas del grupo elegido en el filtro, para el selector de proveedor ----
  const grupoFiltroObj = catalogos.grupos.find((g) => g.nombre === cFiltroGrupo);
  const empresasFiltroConsulta = grupoFiltroObj ? grupoFiltroObj.empresas : [];
  const grupoFiltroKpiObj = catalogos.grupos.find((g) => g.nombre === kFiltroGrupo);
  const empresasFiltroKpi = grupoFiltroKpiObj ? grupoFiltroKpiObj.empresas : [];

  if (cargando) return <div className="app"><p>Cargando…</p></div>;

  return (
    <div className="app">
      <div className="hero">
        <div className="brandline">
          <img src="/logo_icon.svg" alt="Ges Cobranza" style={{ height: 46, width: 46, flexShrink: 0 }} />
          <div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", color: '#fff', fontSize: 15, fontWeight: 800, lineHeight: 1.15 }}>GESTIÓN ESPECIALIZADA</div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--green)', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em' }}>EN COBRANZA</div>
          </div>
        </div>
        <div className="slogan">Gestión con profesionalismo...</div>
        <div className="divider-sub">Control de captura y seguimiento de facturas.</div>
      </div>

      <nav className="tabs">
        <button className={tab === 'captura' ? 'active' : ''} onClick={() => setTab('captura')}>Captura</button>
        <button className={tab === 'consulta' ? 'active' : ''} onClick={() => setTab('consulta')}>Consulta</button>
        <button className={tab === 'panel' ? 'active' : ''} onClick={() => setTab('panel')}>Panel KPI</button>
        <button className={tab === 'gestores' ? 'active' : ''} onClick={() => setTab('gestores')}>Seguimiento Envío</button>
        <a href="/cr-institucional" style={{ padding: '9px 16px', borderRadius: 8, fontWeight: 600, fontSize: 13, color: 'var(--text-soft)', textDecoration: 'none' }}>Centro de Cargas</a>
        <a href="/envios" style={{ padding: '9px 16px', borderRadius: 8, fontWeight: 600, fontSize: 13, color: 'var(--text-soft)', textDecoration: 'none' }}>Registrar envío</a>
        <button className={tab === 'catalogos' ? 'active' : ''} onClick={() => setTab('catalogos')}>Catálogos</button>
        <a href="/documentos" style={{ padding: '9px 16px', borderRadius: 8, fontWeight: 600, fontSize: 13, color: 'var(--text-soft)', textDecoration: 'none' }}>Carga de PDFs</a>
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
              <label>No. de PDF / Susceptible</label>
              <input value={pdf} onChange={(e) => setPdf(e.target.value)} placeholder="Ej. PDF-00231" />
            </div>
            {!loteActivo && (
              <div className="field">
                <label>Número de factura</label>
                <input value={numFactura} onChange={(e) => setNumFactura(e.target.value)} placeholder="Si es distinto al PDF" />
              </div>
            )}
            <div className="field">
              <label>Fecha de recepción</label>
              <input type="date" value={fechaRecepcion} onChange={(e) => setFechaRecepcion(e.target.value)} />
            </div>
          </div>

          <div className="field" style={{ marginBottom: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={loteActivo}
                onChange={(e) => { setLoteActivo(e.target.checked); setLoteFilas([]); setLoteCantidadTexto(''); setLoteMensaje(''); }}
                style={{ width: 'auto' }}
              />
              Este susceptible incluye varias facturas (mismo grupo, proveedor y delegación)
            </label>
          </div>

          {!loteActivo ? (
            <>
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
                  <input
                    value={alta}
                    onChange={(e) => { setAlta(limpiarInvisibles(e.target.value)); setAltaExiste(false); setAlta5005(null); setAltaOtroProv(null); }}
                    onBlur={(e) => verificarAltaExistente(e.target.value)}
                    placeholder="Ej. AL-2026-00981"
                  />
                  {verificandoAlta && <span className="hint muted">Verificando…</span>}
                  {altaExiste && <span className="hint" style={{ color: 'var(--red)' }}>🔒 Esta alta ya fue capturada antes con este mismo proveedor — revisa si es duplicado</span>}
                  {!altaExiste && altaOtroProv && (
                    <span className="hint" style={{ color: 'var(--amber)' }}>ℹ Este número de alta ya existe, pero de {altaOtroProv.empresa} ({altaOtroProv.grupo}). El IMSS reutiliza altas entre ejercicios — puedes guardar.</span>
                  )}
                  {alta.trim() !== '' && !FORMATO_ALTA.test(alta.trim()) && (
                    <span className="hint" style={{ color: 'var(--red)' }}>✖ Formato inválido — debe ser 6 dígitos, guion, 6 dígitos (ej. 118001-106261)</span>
                  )}
                  {alta5005 && alta5005.encontrada === false && FORMATO_ALTA.test(alta.trim()) && (
                    <span className="hint" style={{ color: 'var(--amber)' }}>⚠ Esta alta todavía no aparece en el 5005 — puedes guardar, pero revisa que esté bien escrita</span>
                  )}
                  {alta5005 && alta5005.encontrada && alta5005.candidatos.length > 0 && (
                    <div style={{ marginTop: 8, padding: '10px 12px', background: 'var(--green-soft)', border: '1px solid #cdeadd', borderRadius: 8, fontSize: 12.5 }}>
                      <div style={{ fontWeight: 600, color: 'var(--green)', marginBottom: 4 }}>✓ Encontrada en el 5005 del IMSS</div>
                      <div>Proveedor: <b>{alta5005.candidatos[0].empresa || ('No. ' + alta5005.candidatos[0].provNo)}</b>{alta5005.candidatos[0].grupo ? ' · ' + alta5005.candidatos[0].grupo : ''}</div>
                      <div>Importe según el IMSS: <b>{Number(alta5005.candidatos[0].importe || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</b></div>
                      {alta5005.candidatos[0].comprobante && <div>Ya tiene contra recibo: <b>{alta5005.candidatos[0].comprobante}</b></div>}
                      {alta5005.ambigua && <div style={{ color: 'var(--amber)', marginTop: 4 }}>⚠ Esta alta aparece más de una vez en el 5005 (posible reúso entre ejercicios) — verifica antes de guardar</div>}
                      <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={usarDatos5005}>Usar estos datos</button>
                      {empresaObj && alta5005.candidatos[0].provNorm && String(empresaObj.numero).replace(/^0+/, '') !== alta5005.candidatos[0].provNorm && (
                        <div style={{ color: 'var(--red)', marginTop: 6, fontWeight: 600 }}>✖ El proveedor que elegiste NO es el que el IMSS tiene para esta alta</div>
                      )}
                      {importeRaw > 0 && Math.abs(importeRaw - Number(alta5005.candidatos[0].importe || 0)) > 0.01 && (
                        <div style={{ color: 'var(--red)', marginTop: 4, fontWeight: 600 }}>✖ El importe que capturaste no coincide con el del IMSS</div>
                      )}
                    </div>
                  )}
                  <span className="hint">{altaHint}</span>
                </div>
              </div>
              <div className="field" style={{ maxWidth: 220, marginBottom: 16 }}>
                <label>Capturista</label>
                <select value={capturista} onChange={(e) => setCapturista(e.target.value)}>
                  <option value="Sophie">Sophie</option>
                  <option value="Mariano">Mariano</option>
                  <option value="Sarahi">Sarahi</option>
                </select>
              </div>
              <button className="btn btn-primary" onClick={guardar} disabled={guardando || altaExiste || (alta.trim() !== '' && !FORMATO_ALTA.test(alta.trim()))}>
                {guardando ? 'Guardando…' : 'Guardar factura'}
              </button>
            </>
          ) : (
            <>
              <p className="muted" style={{ marginBottom: 12 }}>
                Proveedor: <b>{empresaObj ? empresaObj.nombre : '— elige empresa arriba —'}</b> · Delegación: <b>{delegacion || '— elige delegación arriba —'}</b>
                {deleg && <> · el alta debe iniciar con <b>{deleg.codigo.split(',').join(' o ')}</b></>}
              </p>
              {loteFilas.length === 0 ? (
                <div className="row-inline">
                  <input
                    type="number" min="2" max="30"
                    value={loteCantidadTexto}
                    onChange={(e) => setLoteCantidadTexto(e.target.value)}
                    placeholder="¿Cuántas facturas incluye? (ej. 12)"
                    style={{ maxWidth: 260 }}
                  />
                  <button className="btn btn-primary btn-sm" onClick={generarFilasLote}>Generar filas</button>
                </div>
              ) : (
                <>
                  <table>
                    <thead><tr><th style={{ width: 40 }}>#</th><th>Alta ⚠</th><th>Importe</th><th>No. de factura</th></tr></thead>
                    <tbody>
                      {loteFilas.map((f, idx) => {
                        const val = validarAltaLote(f.alta);
                        const dup = loteAltasDuplicadasEntreSi.has(f.alta.trim().toLowerCase());
                        return (
                          <tr key={idx}>
                            <td className="muted">{idx + 1}</td>
                            <td>
                              <input
                                value={f.alta}
                                onChange={(e) => actualizarFilaLote(idx, 'alta', e.target.value)}
                                onBlur={(e) => verificarAltaLoteExistente(idx, e.target.value)}
                                placeholder="Ej. AL-2026-00981"
                                style={{ minWidth: 160 }}
                              />
                              {f.alta && (
                                <span className="hint" style={{ color: dup ? 'var(--red)' : (val.ok ? 'var(--green)' : 'var(--red)') }}>
                                  {dup ? '✗ Alta repetida en este mismo lote' : val.hint}
                                </span>
                              )}
                              {f.existeEnServidor && <span className="hint" style={{ color: 'var(--red)' }}>🔒 Ya fue capturada con este proveedor</span>}
                              {!f.existeEnServidor && f.otroProv && (
                                <span className="hint" style={{ color: 'var(--amber)' }}>ℹ Alta reutilizada — la otra es de {f.otroProv.empresa}</span>
                              )}
                              {f.alta.trim() !== '' && !FORMATO_ALTA.test(f.alta.trim()) && (
                                <span className="hint" style={{ color: 'var(--red)' }}>✖ Formato inválido — 6 dígitos, guion, 6 dígitos</span>
                              )}
                              {f.info5005 && f.info5005.encontrada === false && FORMATO_ALTA.test(f.alta.trim()) && (
                                <span className="hint" style={{ color: 'var(--amber)' }}>⚠ Aún no aparece en el 5005</span>
                              )}
                              {f.info5005 && f.info5005.encontrada && f.info5005.candidatos.length > 0 && (
                                <span className="hint" style={{ color: 'var(--green)' }}>
                                  ✓ IMSS: {Number(f.info5005.candidatos[0].importe || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                                  {f.info5005.candidatos[0].empresa ? ' · ' + f.info5005.candidatos[0].empresa : ''}
                                </span>
                              )}
                              {f.info5005 && f.info5005.encontrada && f.info5005.candidatos.length > 0 && empresaObj
                                && String(empresaObj.numero).replace(/^0+/, '') !== f.info5005.candidatos[0].provNorm && (
                                <span className="hint" style={{ color: 'var(--red)', fontWeight: 600 }}>✖ Esta alta es de OTRO proveedor</span>
                              )}
                            </td>
                            <td>
                              <input value={f.importeTexto} onChange={(e) => formatearImporteLote(idx, e.target.value)} placeholder="$0.00" style={{ minWidth: 120 }} />
                              {f.info5005 && f.info5005.encontrada && f.info5005.candidatos.length > 0 && Math.abs(Number(f.importeRaw || 0) - Number(f.info5005.candidatos[0].importe || 0)) > 0.01 && (
                                <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 4, display: 'block' }} onClick={() => usarImporte5005Lote(idx)}>Usar el del IMSS</button>
                              )}
                            </td>
                            <td><input value={f.numFactura} onChange={(e) => actualizarFilaLote(idx, 'numFactura', e.target.value)} placeholder="Si es distinto al PDF" style={{ minWidth: 140 }} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="field" style={{ maxWidth: 220, margin: '16px 0' }}>
                    <label>Capturista</label>
                    <select value={capturista} onChange={(e) => setCapturista(e.target.value)}>
                      <option value="Sophie">Sophie</option>
                      <option value="Mariano">Mariano</option>
                      <option value="Sarahi">Sarahi</option>
                    </select>
                  </div>
                  <div className="toolbar">
                    <button
                      className="btn btn-primary"
                      onClick={guardarLote}
                      disabled={loteGuardando || !loteTodoListo || loteAltasDuplicadasEntreSi.size > 0}
                    >
                      {loteGuardando ? 'Guardando…' : `Guardar ${loteFilas.length} facturas`}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setLoteFilas([]); setLoteCantidadTexto(''); }}>Empezar de nuevo</button>
                  </div>
                  {!loteTodoListo && <p className="muted" style={{ marginTop: 8 }}>Completa grupo, empresa, delegación y todas las filas (alta válida + importe) para poder guardar.</p>}
                </>
              )}
              {loteMensaje && <div className={`alert ${loteMensajeTipo}`} style={{ marginTop: 12 }}>{loteMensaje}</div>}
            </>
          )}
        </div>
      )}

      {tab === 'consulta' && (
        <div className="card">
          <div className="toolbar" style={{ justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0 }}>Registros capturados</h2>
            <button className="btn btn-ghost btn-sm" onClick={exportarConsultaExcel} disabled={exportando}>
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
            <select value={cFiltroGrupo} onChange={(e) => { setCFiltroGrupo(e.target.value); setCFiltroProvNo(''); setCPagina(1); }}>
              <option value="">Todos los grupos</option>
              {catalogos.grupos.map((g) => <option key={g.nombre} value={g.nombre}>{g.nombre}</option>)}
            </select>
            <select value={cFiltroProvNo} onChange={(e) => { setCFiltroProvNo(e.target.value); setCPagina(1); }} disabled={!cFiltroGrupo}>
              <option value="">{cFiltroGrupo ? 'Todos los proveedores' : 'Elige un grupo primero'}</option>
              {empresasFiltroConsulta.map((e) => <option key={e.numero} value={e.numero}>{e.nombre}</option>)}
            </select>
            <select value={cFiltroDeleg} onChange={(e) => { setCFiltroDeleg(e.target.value); setCPagina(1); }}>
              <option value="">Todas las delegaciones</option>
              {catalogos.delegaciones.map((d) => <option key={d.nombre} value={d.nombre}>{d.nombre}</option>)}
            </select>
            <select value={cFiltroEstatus} onChange={(e) => { setCFiltroEstatus(e.target.value); setCPagina(1); }}>
              <option value="">Todos los estatus</option>
              <option value="con_cr">Con CR</option>
              <option value="sin_cr">Sin CR</option>
            </select>
            <select value={cFiltroCapturista} onChange={(e) => { setCFiltroCapturista(e.target.value); setCPagina(1); }}>
              <option value="">Todos los capturistas</option>
              <option value="Sophie">Sophie</option>
              <option value="Mariano">Mariano</option>
              <option value="Sarahi">Sarahi</option>
            </select>
            <button
              className={cFiltroObservacion ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
              onClick={() => { setCFiltroObservacion((v) => !v); setCPagina(1); }}
            >
              ⚠ Solo con observaciones
            </button>
          </div>
          <div className="toolbar">
            <div className="field" style={{ maxWidth: 180 }}>
              <label>Capturado desde</label>
              <input type="date" value={cFiltroFechaDesde} onChange={(e) => { setCFiltroFechaDesde(e.target.value); setCPagina(1); }} />
            </div>
            <div className="field" style={{ maxWidth: 180 }}>
              <label>Capturado hasta</label>
              <input type="date" value={cFiltroFechaHasta} onChange={(e) => { setCFiltroFechaHasta(e.target.value); setCPagina(1); }} />
            </div>
            {(cFiltroFechaDesde || cFiltroFechaHasta) && (
              <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-end' }} onClick={() => { setCFiltroFechaDesde(''); setCFiltroFechaHasta(''); setCPagina(1); }}>
                Quitar fechas
              </button>
            )}
          </div>
          {consultaCargando ? <p className="muted">Cargando…</p> : (
            <>
              <table>
                <thead><tr><th>Alta</th><th>PDF / Susceptible</th><th>Grupo</th><th>Empresa</th><th>Delegación</th><th>Importe</th><th>Fecha captura</th><th>CR</th><th>Comprobante</th><th></th></tr></thead>
                <tbody>
                  {consultaData.facturas.map((f) => (
                    <tr key={f.id}>
                      {editandoId === f.id ? (
                        <>
                          <td><input value={editAlta} onChange={(e) => setEditAlta(e.target.value)} style={{ maxWidth: 140 }} /></td>
                          <td>{f.pdf || '—'}</td><td>{f.grupo}</td><td>{f.empresa}</td><td>{f.delegacion}</td>
                          <td><input value={editImporte} onChange={(e) => setEditImporte(e.target.value)} style={{ maxWidth: 100 }} /></td>
                          <td className="muted">{formatearFechaCaptura(f.fecha_captura)}</td>
                          <td>{f.tiene_cr ? <span className="tag tag-green">Con CR</span> : <span className="tag tag-amber">Sin CR</span>}</td>
                          <td>{f.comprobante || '—'}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <button className="btn btn-primary btn-sm" onClick={() => guardarEdicion(f.id)} disabled={editGuardando}>Guardar</button>{' '}
                            <button className="btn btn-ghost btn-sm" onClick={cancelarEdicion}>Cancelar</button>
                            {editMensaje && <div className="muted" style={{ color: 'var(--red)' }}>{editMensaje}</div>}
                          </td>
                        </>
                      ) : (
                        <>
                          <td>{f.alta}</td><td>{f.pdf || '—'}</td><td>{f.grupo}</td><td>{f.empresa}</td><td>{f.delegacion}</td>
                          <td>${Number(f.importe).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                          <td className="muted">{formatearFechaCaptura(f.fecha_captura)}</td>
                          <td>{f.tiene_cr ? <span className="tag tag-green">Con CR</span> : <span className="tag tag-amber">Sin CR</span>}</td>
                         <td>
                            {f.comprobante || '—'}
                           {f.comprobante && (
                              <div><a href={'/contra-recibo?comprobante=' + encodeURIComponent(f.comprobante) + '&prov=' + encodeURIComponent(f.prov_no || '')} target="_blank" rel="noopener noreferrer">📄 Ver contra recibo</a></div>
                            )}
                            {f.comprobante_archivo && (
                              <div><a href="#" onClick={(e) => { e.preventDefault(); verComprobante(f.comprobante_archivo); }}>📎 Ver escaneo</a></div>
                            )}
                            {f.alerta_importe && <div className="muted" style={{ color: 'var(--red)' }}>{f.alerta_importe}</div>}
                          </td>
                          <td><button className="btn btn-ghost btn-sm" onClick={() => empezarEdicion(f)}>Editar</button></td>
                        </>
                      )}
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
              <select value={kFiltroGrupo} onChange={(e) => { setKFiltroGrupo(e.target.value); setKFiltroProvNo(''); }}>
                <option value="">Todos los grupos</option>
                {catalogos.grupos.map((g) => <option key={g.nombre} value={g.nombre}>{g.nombre}</option>)}
              </select>
              <select value={kFiltroProvNo} onChange={(e) => setKFiltroProvNo(e.target.value)} disabled={!kFiltroGrupo}>
                <option value="">{kFiltroGrupo ? 'Todos los proveedores' : 'Elige un grupo primero'}</option>
                {empresasFiltroKpi.map((e) => <option key={e.numero} value={e.numero}>{e.nombre}</option>)}
              </select>
              <select value={kFiltroDeleg} onChange={(e) => setKFiltroDeleg(e.target.value)}>
                <option value="">Todas las delegaciones</option>
                {catalogos.delegaciones.map((d) => <option key={d.nombre} value={d.nombre}>{d.nombre}</option>)}
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
                <h2>Por grupo</h2>
                <table>
                  <thead><tr><th>Grupo</th><th>Total</th><th>Con CR</th><th>Sin CR</th><th>% avance</th></tr></thead>
                  <tbody>
                    {kpiData.por_grupo.map((g) => (
                      <tr key={g.grupo}>
                        <td>{g.grupo}</td><td>{g.total}</td><td>{g.con_cr}</td><td>{g.total - g.con_cr}</td>
                        <td>{g.total ? Math.round((g.con_cr / g.total) * 100) : 0}%</td>
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

      {tab === 'gestores' && (
        <>
          <div className="card">
            <h2>Pendientes por enviar</h2>
            <p className="muted" style={{ marginBottom: 12 }}>Capturadas, sin contra recibo y aún sin envío registrado. Ordenadas por importe.</p>
            {pendOrdenadas.length === 0 && <p className="muted">No hay pendientes por enviar.</p>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10 }}>
              {(verTodasPend ? pendOrdenadas : pendOrdenadas.slice(0, TARJETAS_VISIBLES)).map((v) => (
                <div key={v.delegacion}
                  style={{ background: 'var(--card)', border: gFiltroDeleg === v.delegacion && gFiltroEnvio === 'noenviada' ? '2px solid var(--navy)' : '1px solid var(--line)', borderLeft: '3px solid var(--navy-soft)', borderRadius: 8, padding: '10px 12px', cursor: 'pointer' }}
                  onClick={() => filtrarPorDelegacion(v.delegacion, 'noenviada')}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--navy)', lineHeight: 1.3, minHeight: 32 }}>{v.delegacion}</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--navy)', marginTop: 6 }}>{mmm(v.importe)}</div>
                  <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{v.n} factura(s)</div>
                  <a href={'/envios?delegacion=' + encodeURIComponent(v.delegacion)} onClick={(e) => e.stopPropagation()} style={{ fontSize: 11.5, display: 'inline-block', marginTop: 6 }}>Registrar envío →</a>
                </div>
              ))}
            </div>
            {pendOrdenadas.length > TARJETAS_VISIBLES && (
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => setVerTodasPend(!verTodasPend)}>
                {verTodasPend ? 'Ver solo las 12 mayores' : 'Ver las ' + (pendOrdenadas.length - TARJETAS_VISIBLES) + ' restantes'}
              </button>
            )}
          </div>

          <div className="card">
            <h2>Esperando contra recibo, por delegación</h2>
            <p className="muted" style={{ marginBottom: 12 }}>Ya enviadas y sin respuesta del IMSS. Ordenadas por importe fuera de la meta de 6 días.</p>
            {espOrdenadas.length === 0 && <p className="muted">No hay facturas esperando respuesta.</p>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10 }}>
              {(verTodasEsp ? espOrdenadas : espOrdenadas.slice(0, TARJETAS_VISIBLES)).map((v) => {
                const c = colorMeta(v.dias_max);
                return (
                  <div key={v.delegacion}
                    style={{ background: c.fondo, border: gFiltroDeleg === v.delegacion && gFiltroEnvio === 'enviada' ? '2px solid var(--navy)' : '1px solid var(--line)', borderLeft: '3px solid ' + c.borde, borderRadius: 8, padding: '10px 12px', cursor: 'pointer' }}
                    onClick={() => filtrarPorDelegacion(v.delegacion, 'enviada')}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--navy)', lineHeight: 1.3, minHeight: 32 }}>{v.delegacion}</div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: c.texto, marginTop: 6 }}>{mmm(v.importe)}</div>
                    <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>
                      {v.n} factura(s) · <b style={{ color: c.texto }}>{v.dias_max} días</b>
                    </div>
                    {v.fuera_meta > 0 && (
                      <div style={{ fontSize: 11.5, color: c.texto, marginTop: 3 }}>{v.fuera_meta} fuera de meta · {mmm(v.importe_fuera_meta)}</div>
                    )}
                  </div>
                );
              })}
            </div>
            {espOrdenadas.length > TARJETAS_VISIBLES && (
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => setVerTodasEsp(!verTodasEsp)}>
                {verTodasEsp ? 'Ver solo las 12 mayores' : 'Ver las ' + (espOrdenadas.length - TARJETAS_VISIBLES) + ' restantes'}
              </button>
            )}
          </div>

          <div className="card">
            <div className="toolbar" style={{ justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0 }} id="detalle-seguimiento">Enviadas — esperando contra recibo</h2>
              <select value={agruparPor} onChange={(e) => setAgruparPor(e.target.value)}>
                <option value="ninguno">Sin agrupar</option>
                <option value="delegacion">Agrupar por delegación</option>
                <option value="grupo">Agrupar por grupo</option>
              </select>
            </div>
            <p className="muted" style={{ marginBottom: 12 }}>Hasta las 500 más antiguas — si tienes más, resuélvelas por aquí primero.</p>
            {gFiltroDeleg && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--navy)', color: '#fff', borderRadius: 20, padding: '5px 8px 5px 14px', fontSize: 12.5, fontWeight: 600, marginBottom: 12 }}>
                Mostrando solo: {gFiltroDeleg}
                <button onClick={() => { setGFiltroDeleg(''); setGFiltroEnvio(''); setGPagina(1); }}
                  style={{ background: 'rgba(255,255,255,.2)', border: 'none', color: '#fff', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
              </div>
            )}
            {esperando.length === 0 && <p className="muted">No hay facturas esperando respuesta ahora mismo.</p>}
            {esperando.length > 0 && seleccionados.size > 0 && (
              <div className="alert ok" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span>{seleccionados.size} seleccionada(s) · Suma: ${sumaSeleccionados.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                <button className="btn btn-primary btn-sm" onClick={() => setComprobantePanelAbierto((v) => !v)}>Adjuntar comprobante CR</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setSeleccionados(new Set())}>Cancelar selección</button>
              </div>
            )}
            {comprobantePanelAbierto && (
              <div className="card" style={{ border: '2px solid var(--green)', margin: '0 0 12px' }}>
                <h2>Adjuntar comprobante de contra recibo</h2>
                <p className="muted" style={{ marginBottom: 12 }}>
                  Esto marca las {seleccionados.size} facturas seleccionadas como <b>Con CR</b> de inmediato — no espera al Cruce 5005.
                </p>
                <div className="alert ok" style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
                  Suma seleccionada: ${sumaSeleccionados.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  <span className="muted" style={{ fontWeight: 400, fontSize: 13, display: 'block', marginTop: 2 }}>
                    Compárala contra el importe total que trae el CR físico antes de subir.
                  </span>
                </div>
                <div className="field" style={{ marginBottom: 12 }}>
                  <label>Archivo del comprobante (foto o escaneo)</label>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setComprobanteArchivo(e.target.files[0] || null)} />
                </div>
                <div className="field" style={{ maxWidth: 260, marginBottom: 12 }}>
                  <label>Número de comprobante (opcional)</label>
                  <input value={comprobanteNumero} onChange={(e) => setComprobanteNumero(e.target.value)} placeholder="Si lo tienes a la mano" />
                </div>
                {comprobanteMensaje && <div className="alert error">{comprobanteMensaje}</div>}
                <button className="btn btn-primary" onClick={subirComprobante} disabled={comprobanteSubiendo || !comprobanteArchivo}>
                  {comprobanteSubiendo ? 'Subiendo…' : 'Guardar y marcar Con CR'}
                </button>{' '}
                <button className="btn btn-ghost" onClick={() => setComprobantePanelAbierto(false)}>Cancelar</button>
              </div>
            )}
            {esperando.length > 0 && (
              agruparPor === 'ninguno' ? (
                <table>
                  <thead><tr><th></th><th>Alta</th><th>Empresa</th><th>PDF / Susceptible</th><th>Delegación</th><th>Importe</th><th>Fecha captura</th><th>Días esperando</th><th>Comentarios</th></tr></thead>
                  <tbody>{esperando.map((f) => filaEsperando(f))}</tbody>
                </table>
              ) : (
                gruposEsperando.map(([nombreGrupo, filas]) => (
                  <details key={nombreGrupo} open style={{ marginBottom: 10 }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 600, padding: '8px 0', color: 'var(--navy)' }}>
                      {nombreGrupo || '(sin dato)'} — {filas.length} factura{filas.length !== 1 ? 's' : ''}
                    </summary>
                    <table>
                      <thead><tr><th></th><th>Alta</th><th>Empresa</th><th>PDF / Susceptible</th><th>Delegación</th><th>Importe</th><th>Fecha captura</th><th>Días esperando</th><th>Comentarios</th></tr></thead>
                      <tbody>{filas.map((f) => filaEsperando(f))}</tbody>
                    </table>
                  </details>
                ))
              )
            )}
          </div>

          <div className="card">
            <h2>Detalle y marcar envío</h2>
            <div className="toolbar">
              <select value={gFiltroDeleg} onChange={(e) => { setGFiltroDeleg(e.target.value); setGPagina(1); }}>
                <option value="">Todas las delegaciones</option>
                {catalogos.delegaciones.map((d) => <option key={d.nombre} value={d.nombre}>{d.nombre}</option>)}
              </select>
              <select value={gFiltroEnvio} onChange={(e) => { setGFiltroEnvio(e.target.value); setGPagina(1); }}>
                <option value="">Todas — enviadas y no enviadas</option>
                <option value="noenviada">Aún no enviada</option>
                <option value="enviada">Ya enviada, esperando CR</option>
              </select>
              <select value={gOrden} onChange={(e) => { setGOrden(e.target.value); setGPagina(1); }}>
                <option value="reciente">Más reciente primero</option>
                <option value="importe_desc">Importe: mayor a menor</option>
                <option value="importe_asc">Importe: menor a mayor</option>
              </select>
            </div>
            {seleccionados.size > 0 && (
              <div className="alert ok" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span>{seleccionados.size} seleccionada(s) · Suma: ${sumaSeleccionados.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                <button className="btn btn-primary btn-sm" onClick={marcarSeleccionadasComoEnviadas}>Marcar como enviadas a gestor</button>
                <button className="btn btn-primary btn-sm" onClick={() => setComprobantePanelAbierto((v) => !v)}>Adjuntar comprobante CR</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setSeleccionados(new Set())}>Cancelar selección</button>
              </div>
            )}
            {gCargando ? <p className="muted">Cargando…</p> : (
              <>
                <table>
                  <thead><tr><th></th><th>Alta</th><th>Empresa</th><th>PDF / Susceptible</th><th>Delegación</th><th>Importe</th><th>Fecha captura</th><th>Envío</th><th>Comentarios</th></tr></thead>
                  <tbody>
                    {filasGestores.map((f) => (
                      <tr key={f.id}>
                        <td><input type="checkbox" checked={seleccionados.has(f.id)} onChange={() => toggleSeleccion(f.id)} /></td>
                        <td>{f.alta}</td><td>{f.empresa}</td><td>{f.pdf ? <a href={`/documentos?folio=${f.pdf}`} target="_blank" rel="noreferrer">{f.pdf} · Ver PDF</a> : '—'}</td><td>{f.delegacion}</td>
                        <td>${Number(f.importe).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                        <td className="muted">{formatearFechaCaptura(f.fecha_captura)}</td>
                        <td>{f.enviada_gestor
                          ? <>
                              <span className="tag tag-enviada">Enviada</span>{' '}
                              <a href="#" onClick={(e) => { e.preventDefault(); quitarEnviada(f.id); }} className="muted">deshacer</a>
                            </>
                          : <span className="muted">Sin enviar</span>}
                        </td>
                        <td>
                          {f.enviada_gestor && (
                            <button className="btn btn-ghost btn-sm" onClick={() => abrirComentarios(f.id)}>
                              💬 {f.comentarios_count > 0 ? f.comentarios_count : ''}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="toolbar" style={{ justifyContent: 'space-between', marginTop: 12 }}>
                  <p className="muted">{seguimientoData.totalFilasGestores} facturas pendientes de CR con estos filtros.</p>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button className="btn btn-ghost btn-sm" disabled={gPagina <= 1} onClick={() => setGPagina((p) => p - 1)}>Anterior</button>
                    <span className="muted">Página {gPagina} de {totalPaginasGestores}</span>
                    <button className="btn btn-ghost btn-sm" disabled={gPagina >= totalPaginasGestores} onClick={() => setGPagina((p) => p + 1)}>Siguiente</button>
                  </div>
                </div>
              </>
            )}
          </div>

          {comentarioFacturaId && (
            <div className="card" style={{ border: '2px solid var(--green)' }}>
              <div className="toolbar" style={{ justifyContent: 'space-between' }}>
                <h2 style={{ margin: 0 }}>Comentarios de la factura</h2>
                <button className="btn btn-ghost btn-sm" onClick={cerrarComentarios}>Cerrar</button>
              </div>
              <div className="row-inline">
                <input
                  placeholder="Ej. Gestor indica falta firma en el comprobante, se reenvía 10/07"
                  value={comentarioTexto}
                  onChange={(e) => setComentarioTexto(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') guardarComentario(); }}
                />
                <button className="btn btn-primary btn-sm" onClick={guardarComentario} disabled={comentarioGuardando}>
                  {comentarioGuardando ? 'Guardando…' : 'Agregar comentario'}
                </button>
              </div>
              {comentarioCargando ? <p className="muted">Cargando…</p> : (
                comentarios.length === 0 ? <p className="muted">Sin comentarios todavía.</p> : (
                  <div style={{ marginTop: 10 }}>
                    {comentarios.map((c) => (
                      <div key={c.id} className="card" style={{ padding: 12, marginBottom: 8 }}>
                        <div className="muted" style={{ fontSize: 12 }}>{new Date(c.fecha).toLocaleString('es-MX')}</div>
                        <div>{c.comentario}</div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          )}
        </>
      )}

      {tab === 'cruce' && (
        <>
          <div className="card">
            <h2>1. Cargar el reporte 5005</h2>
            <p className="muted" style={{ marginBottom: 12 }}>
              Sube los archivos del 5005 tal cual te los entrega el IMSS — puedes seleccionar varios a la vez (Ctrl+clic
              o Ctrl+A en el explorador). El sistema encuentra solo las columnas que necesita en cada uno
              (Proveedor, Num Ent Alm, Importe, Comprobante). Ya no hace falta unificarlos tú antes de subirlos:
              juntos reemplazan por completo lo que tenías cargado.
            </p>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              multiple
              onChange={(e) => setRaw5005Files(Array.from(e.target.files || []))}
            />
            {raw5005Files.length > 0 && (
              <p className="muted" style={{ marginTop: 6 }}>{raw5005Files.length} archivo(s) seleccionado(s).</p>
            )}
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-primary" onClick={cargarArchivo5005}>Cargar archivo del 5005</button>
            </div>
            {raw5005Mensaje && <p className="muted" style={{ marginTop: 8 }}>{raw5005Mensaje}</p>}
          </div>

          <div className="card">
            <h2>2. Cruzar</h2>
            <p className="muted" style={{ marginBottom: 12 }}>
              Compara Alta + Proveedor + Importe contra lo que acabas de cargar. Si el importe no coincide pero la combinación
              es única, marca el CR igual y te avisa que corrijas el importe — nunca te bloquea el resultado.
            </p>
            <button className="btn btn-primary" onClick={cruzarCon5005} disabled={cargandoCruce}>
              {cargandoCruce ? 'Cruzando…' : 'Cruzar con 5005'}
            </button>
            {cruceMensaje && <p className="muted" style={{ marginTop: 10 }}>{cruceMensaje}</p>}
          </div>

          <div className="card">
            <h2>3. Auditar facturas que ya tienen CR</h2>
            <p className="muted" style={{ marginBottom: 12 }}>
              Compara las facturas <b>ya marcadas Con CR</b> contra el 5005 que acabas de cargar, para confirmar que el
              comprobante y el importe guardados siguen coincidiendo. <b>No corrige nada automáticamente</b> — solo te
              muestra las diferencias para que tú decidas caso por caso en Consulta.
            </p>
            <button className="btn btn-primary" onClick={auditarCon5005} disabled={cargandoAuditoria}>
              {cargandoAuditoria ? 'Auditando…' : 'Auditar facturas Con CR'}
            </button>

            {auditoriaResultado && !auditoriaResultado.ok && (
              <p className="muted" style={{ marginTop: 10, color: 'var(--red)' }}>Error: {auditoriaResultado.error}</p>
            )}

            {auditoriaResultado && auditoriaResultado.ok && (
              <>
                <p className="muted" style={{ marginTop: 10 }}>
                  {auditoriaResultado.totalAuditadas} facturas Con CR auditadas · {auditoriaResultado.coinciden} coinciden ·{' '}
                  {auditoriaResultado.sinCandidato} sin esa alta en el 5005 cargado (normal si ese proveedor no viene en el archivo) ·{' '}
                  <b>{auditoriaResultado.discrepancias.length} con diferencias</b>
                </p>
                {auditoriaResultado.discrepancias.length > 0 && (
                  <table style={{ marginTop: 12 }}>
                    <thead>
                      <tr>
                        <th>Alta</th><th>Grupo</th><th>Empresa</th>
                        <th>Comprobante guardado</th><th>Importe guardado</th>
                        <th>Lo que dice el 5005 cargado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditoriaResultado.discrepancias.map((d) => (
                        <tr key={d.id}>
                          <td>{d.alta}</td><td>{d.grupo}</td><td>{d.empresa}</td>
                          <td>{d.comprobanteGuardado || '—'}</td>
                          <td>${Number(d.importeGuardado).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                          <td>
                            {d.candidatos5005.map((c, i) => (
                              <div key={i}>Comprobante {c.comprobante} · ${Number(c.importe).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </div>

          <div className="card">
            <h2>4. Diagnóstico — comparar una alta específica</h2>
            <p className="muted" style={{ marginBottom: 12 }}>
              Escribe una alta que sepas que debería tener CR y no lo tiene. Te muestro exactamente lo que tiene guardado
              tu sistema y todas las altas que trae el 5005 cargado para ese mismo proveedor, para ver a simple vista si
              hay una diferencia de escritura.
            </p>
            <div className="row-inline" style={{ marginBottom: 12 }}>
              <input
                value={diagAltaInput}
                onChange={(e) => setDiagAltaInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') buscarDiagnostico(); }}
                placeholder="Ej. 018001-106297"
                style={{ maxWidth: 260 }}
              />
              <button className="btn btn-primary btn-sm" onClick={buscarDiagnostico} disabled={diagCargando}>
                {diagCargando ? 'Buscando…' : 'Buscar'}
              </button>
            </div>

            {diagResultado && !diagResultado.ok && (
              <p className="muted" style={{ color: 'var(--red)' }}>{diagResultado.error}</p>
            )}

            {diagResultado && diagResultado.ok && (
              <>
                <div className="card" style={{ background: 'var(--bg)', marginBottom: 12 }}>
                  <p style={{ margin: '4px 0' }}><b>Guardado en tu sistema:</b></p>
                  <p style={{ margin: '4px 0' }}>Alta: <code>{diagResultado.factura.alta}</code></p>
                  <p style={{ margin: '4px 0' }}>Proveedor: <code>{diagResultado.factura.prov_no}</code> (normalizado: {diagResultado.factura.prov_no_normalizado})</p>
                  <p style={{ margin: '4px 0' }}>Importe: ${Number(diagResultado.factura.importe).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                  <p style={{ margin: '4px 0' }}>CR: {diagResultado.factura.tiene_cr ? 'Sí' : 'No'} · Alerta: {diagResultado.factura.alerta_importe || '—'}</p>
                </div>

                {diagResultado.coincidenciaExactaAlta.length > 0 ? (
                  <div className="alert error" style={{ marginBottom: 12 }}>
                    <b>Sí hay {diagResultado.coincidenciaExactaAlta.length} fila(s) con la misma alta (ignorando mayúsculas) para este proveedor en el 5005 cargado</b>, pero el cruce no la tomó — esto apunta a un problema en la lógica del cruce, no en los datos. Compara los códigos de caracteres abajo, puede haber un espacio invisible u otro carácter oculto:
                    {diagResultado.coincidenciaExactaAlta.map((c, i) => (
                      <div key={i} style={{ marginTop: 8, fontFamily: 'monospace', fontSize: 11 }}>
                        5005 alta: "{c.alta}" · comprobante: {c.comprobante} · importe: ${c.importe}<br />
                        Códigos de caracteres (5005): [{c.alta_bytes.join(', ')}]<br />
                        Códigos de caracteres (tu sistema): [{diagResultado.factura.alta_bytes.join(', ')}]
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted" style={{ marginBottom: 12 }}>
                    No hay ninguna fila con esta alta exacta para este proveedor en el 5005 cargado — el problema no es de formato invisible, la alta simplemente no está en el archivo que subiste (o está bajo un proveedor distinto).
                  </p>
                )}

                <p className="muted">
                  Este proveedor tiene {diagResultado.totalFilasProveedorEn5005} filas en el 5005 cargado. Muestra de hasta 30 altas registradas para él:
                </p>
                <table>
                  <thead><tr><th>Alta en 5005</th><th>Proveedor en 5005</th><th>Importe</th><th>Comprobante</th></tr></thead>
                  <tbody>
                    {diagResultado.muestraAltasDelProveedor.map((r, i) => (
                      <tr key={i}>
                        <td>{r.alta}</td><td>{r.proveedor}</td>
                        <td>${Number(r.importe).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                        <td>{r.comprobante || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
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
