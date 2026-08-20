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
  const [cEmisionDias, setCEmisionDias] = useState('');
  const [cEmisionDesde, setCEmisionDesde] = useState('');
  const [cEmisionHasta, setCEmisionHasta] = useState('');
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
  const [candidatoIdx, setCandidatoIdx] = useState(null);
  const [importeForzado, setImporteForzado] = useState(false);
  const [importeTexto, setImporteTexto] = useState('');
  const [importeRaw, setImporteRaw] = useState(0);
  const [capturista, setCapturista] = useState('Sophie');

  // ---- Captura: por lotes (mismo susceptible/PDF, varias facturas) ----
  const [modoCaptura, setModoCaptura] = useState('');
  const loteActivo = modoCaptura === 'varias';

  function elegirModo(m) {
    setModoCaptura(m);
    setLoteFilas([]);
    setLoteCantidadTexto('');
    setLoteMensaje('');
    setAlta('');
    setAlta5005(null);
    setCandidatoIdx(null);
    setImporteForzado(false);
    setAltaExiste(false);
    setAltaOtroProv(null);
  }
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
  }, [tab, cFiltroGrupo, cFiltroDeleg, cFiltroProvNo, cFiltroEstatus, cFiltroObservacion, cFiltroCapturista, cFiltroFechaDesde, cFiltroFechaHasta, cBusqueda, cPagina, cEmisionDias, cEmisionDesde, cEmisionHasta]);

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

  function rangoEmisionCr() {
    if (cEmisionDias === 'rango') return { desde: cEmisionDesde || null, hasta: cEmisionHasta || null };
    if (!cEmisionDias) return { desde: null, hasta: null };
    const d = new Date();
    const hasta = d.toISOString().slice(0, 10);
    d.setDate(d.getDate() - parseInt(cEmisionDias, 10));
    return { desde: d.toISOString().slice(0, 10), hasta: hasta };
  }

  // Abre el PDF del susceptible en una pestaña nueva
  async function abrirPdfSusceptible(pdf) {
    if (!pdf) return;
    try {
      const res = await fetch('/api/documentos/por-pdf?pdf=' + encodeURIComponent(pdf));
      const d = await res.json();
      if (d.ok && d.url) window.open(d.url, '_blank');
      else alert(d.error || 'No se encontró el PDF de este susceptible.');
    } catch (e) {
      alert('No se pudo abrir el PDF.');
    }
  }

  // Estatus del ciclo completo: de capturada a pagada
  function estatusCiclo(f) {
    if (f.cr_fuente === '4004' && f.cr_fecha_pago) {
      const hoy = new Date().toISOString().slice(0, 10);
      return f.cr_fecha_pago <= hoy
        ? { txt: 'Pagada', cls: 'tag-green', det: 'ref. ' + (f.cr_referencia_pago || '—') }
        : { txt: 'Pago confirmado', cls: 'tag-green', det: fmtFecha(f.cr_fecha_pago) };
    }
    if (f.cr_fuente === '1003' && f.cr_fecha_prog_pago) {
      return { txt: 'Programada', cls: 'tag-blue', det: 'pago ' + fmtFecha(f.cr_fecha_prog_pago) };
    }
    if (f.tiene_cr) return { txt: 'Con CR', cls: 'tag-green', det: f.comprobante || '' };
    if (f.envio_guia) return { txt: 'Enviada', cls: 'tag-amber', det: fmtFecha(f.envio_fecha) + ' · ' + f.envio_guia };
    if (f.enviada_gestor) return { txt: 'Enviada', cls: 'tag-amber', det: f.fecha_envio ? fmtFecha(f.fecha_envio) : 'sin guía' };
    return { txt: 'Por enviar', cls: 'tag-gray', det: '' };
  }

  function fmtFecha(iso) {
    if (!iso) return '';
    const x = String(iso).slice(0, 10).split('-');
    return x.length === 3 ? x[2] + '/' + x[1] : '';
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
    if (rangoEmisionCr().desde) params.set('emisionDesde', rangoEmisionCr().desde);
    if (rangoEmisionCr().hasta) params.set('emisionHasta', rangoEmisionCr().hasta);
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
      // Con un solo candidato no hay nada que elegir: se aplica directo
      if (d2 && d2.ok && d2.encontrada && d2.candidatos.length === 1) {
        aplicarCandidato(d2.candidatos[0], 0);
      }
    } catch (err) {
      setAlta5005(null);
    }
    setVerificandoAlta(false);
  }

  // Trae del 5005 el importe y avisa si el proveedor elegido no corresponde
  // Aplica al formulario los datos que el IMSS tiene para esa alta
  function aplicarCandidato(c, idx) {
    if (!c) return;
    setCandidatoIdx(idx);
    setImporteForzado(false);
    const centavos = Math.round(Number(c.importe || 0) * 100);
    formatearImporte(String(centavos));
    if (c.grupo) setGrupo(c.grupo);
    if (c.numeroCatalogo) setEmpresaNumero(c.numeroCatalogo);
    if (c.delegacion) setDelegacion(c.delegacion);
  }

  const candidatoActivo = (alta5005 && alta5005.encontrada && candidatoIdx !== null)
    ? alta5005.candidatos[candidatoIdx] : null;

  const importeDifiere = candidatoActivo && importeRaw > 0
    && Math.abs(importeRaw - Number(candidatoActivo.importe || 0)) > 0.01;

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
      setLoteFilas((prev) => prev.map((f, i) => {
        if (i !== idx) return f;
        const nueva = { ...f, info5005: (d2 && d2.ok ? d2 : null), candidatoIdx: null };
        // El importe lo pone el IMSS; el capturista solo lo cambia si la factura difiere
        if (d2 && d2.ok && d2.encontrada && d2.candidatos.length === 1) {
          const v = Number(d2.candidatos[0].importe || 0);
          nueva.importeRaw = v;
          nueva.importeTexto = v.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
        }
        return nueva;
      }));
      // La primera alta define el proveedor y la delegación de todo el susceptible
      if (d2 && d2.ok && d2.encontrada && d2.candidatos.length === 1 && idx === 0) {
        const c = d2.candidatos[0];
        if (c.grupo) setGrupo(c.grupo);
        if (c.numeroCatalogo) setEmpresaNumero(c.numeroCatalogo);
        if (c.delegacion) setDelegacion(c.delegacion);
      }
    } catch (err) {
      setLoteFilas((prev) => prev.map((f, i) => (i === idx ? { ...f, info5005: null } : f)));
    }
  }

  // Devuelve el candidato del 5005 que aplica a un renglón: el elegido a mano,
  // o el único cuando el alta no está repetida.
  function candidatoDeFila(f) {
    if (!f || !f.info5005 || !f.info5005.encontrada || !f.info5005.candidatos.length) return null;
    if (typeof f.candidatoIdx === 'number') return f.info5005.candidatos[f.candidatoIdx];
    if (f.info5005.candidatos.length === 1) return f.info5005.candidatos[0];
    return null;
  }

  // Cuando el IMSS reutiliza un alta, el capturista elige cuál corresponde
  function elegirCandidatoLote(idx, i) {
    setLoteFilas((prev) => prev.map((f, k) => {
      if (k !== idx) return f;
      const c = f.info5005.candidatos[i];
      const v = Number(c.importe || 0);
      return { ...f, candidatoIdx: i, importeRaw: v, importeTexto: v.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) };
    }));
    // El proveedor y la delegación del susceptible se toman del renglón elegido:
    // no solo del primero, porque puede resolverse cualquiera antes que los demás.
    const fila = loteFilas[idx];
    const c = fila && fila.info5005 && fila.info5005.candidatos ? fila.info5005.candidatos[i] : null;
    if (c) {
      if (c.grupo) setGrupo(c.grupo);
      if (c.numeroCatalogo) setEmpresaNumero(c.numeroCatalogo);
      if (c.delegacion) setDelegacion(c.delegacion);
    }
  }

  // Trae el importe del 5005 a un renglón del lote
  function usarImporte5005Lote(idx) {
    setLoteFilas((prev) => prev.map((f, i) => {
      if (i !== idx || !f.info5005 || !f.info5005.encontrada || !f.info5005.candidatos.length) return f;
      const cd = candidatoDeFila(f);
      if (!cd) return f;
      const valor = Number(cd.importe || 0);
      return { ...f, importeRaw: valor, importeTexto: valor.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) };
    }));
  }

  // Una fila estorba si el IMSS dice que es de otro proveedor o de otra delegación
  function filaLoteDiscrepa(f) {
    const c = candidatoDeFila(f);
    if (!c) return false;
    const provDistinto = empresaObj && c.provNorm && String(empresaObj.numero).replace(/^0+/, '') !== c.provNorm;
    const delegDistinta = c.delegacion && delegacion && c.delegacion !== delegacion;
    return !!(provDistinto || delegDistinta);
  }

  const loteTodoListo = loteFilas.length > 0
    && grupo && empresaObj && delegacion && pdf
    && loteFilas.every((f) => f.alta && f.importeRaw > 0 && FORMATO_ALTA.test(f.alta.trim()) && validarAltaLote(f.alta).ok && !f.existeEnServidor && !filaLoteDiscrepa(f)
      && !(f.info5005 && f.info5005.encontrada && f.info5005.ambigua && typeof f.candidatoIdx !== 'number'));

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
  // Al marcar la salida se crea el paquete de esa delegación, sin guía.
  // El número se captura después en «Registrar envío».
  async function marcarSeleccionadasComoEnviadas() {
    if (seleccionados.size === 0) return;
    if (!gFiltroDeleg) {
      alert('Elige primero una delegación: cada paquete lleva su propia guía.');
      return;
    }
    const fecha = new Date().toISOString().slice(0, 10);
    if (!window.confirm('Se registrará un paquete a ' + gFiltroDeleg + ' con ' + seleccionados.size + ' factura(s), con fecha de hoy.\n\nEl número de guía se captura después en «Registrar envío».')) return;

    const res = await fetch('/api/envios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        delegacion: gFiltroDeleg,
        guia: '',
        permitirSinGuia: true,
        fechaEnvio: fecha,
        enviadoPor: capturista,
        ids: Array.from(seleccionados),
      }),
    });
    const d = await res.json();
    if (!d.ok) { alert(d.error || 'No se pudo registrar el envío.'); return; }

    setSeleccionados(new Set());
    await cargarSeguimiento();
    alert('✓ Paquete registrado: ' + d.marcadas + ' factura(s) a ' + gFiltroDeleg + '.\n\nCaptura la guía en «Registrar envío».');
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
    if (rangoEmisionCr().desde) params.set('emisionDesde', rangoEmisionCr().desde);
    if (rangoEmisionCr().hasta) params.set('emisionHasta', rangoEmisionCr().hasta);
    if (cBusqueda) params.set('busqueda', cBusqueda);
    const res = await fetch('/api/facturas?' + params.toString());
    const data = await res.json();
    const filas = (data.facturas || []).map((f) => ({
      Alta: f.alta, Grupo: f.grupo, Empresa: f.empresa, Delegación: f.delegacion,
      Importe: Number(f.importe), Estatus: estatusCiclo(f).txt, CR: f.tiene_cr ? 'Con CR' : 'Sin CR',
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

  const [reclamando, setReclamando] = useState('');

  // Arma el reclamo de una delegación: copia el correo al portapapeles y baja el Excel.
  async function generarReclamo(deleg) {
    setReclamando(deleg);
    try {
      const res = await fetch('/api/reclamo?delegacion=' + encodeURIComponent(deleg));
      const d = await res.json();
      if (!d.ok || d.total === 0) {
        alert(d.error || 'No hay facturas pendientes en esta delegación.');
        setReclamando('');
        return;
      }

      const fmtD = (iso) => {
        if (!iso) return 'sin fecha';
        const x = String(iso).split('-');
        return x.length === 3 ? x[2] + '/' + x[1] + '/' + x[0] : String(iso);
      };
      const mnyTxt = (n) => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const hoy = new Date();
      const dd = (n) => String(n).padStart(2, '0');
      const fechaHoy = dd(hoy.getDate()) + '/' + dd(hoy.getMonth() + 1) + '/' + hoy.getFullYear();

      const lineas = d.paquetes.map((g) => {
        const dias = g.fecha_envio ? Math.round((hoy - new Date(g.fecha_envio + 'T12:00:00')) / 86400000) : null;
        return (g.guia ? 'Guía ' + g.guia : 'Envío sin guía registrada')
          + ' — entregada ' + fmtD(g.fecha_envio)
          + ' — ' + g.facturas + ' facturas — ' + mnyTxt(g.importe)
          + (dias != null ? ' — ' + dias + ' días' : '');
      });

      const correo =
        'Jefe de Oficina de Trámite de Erogaciones\n' + deleg + '\n\n' +
        'C.c.p. Jefe de Departamento de Presupuesto, Contabilidad y Erogaciones\n\nPresente.\n\n' +
        'Por este medio solicito su apoyo para conocer el estatus de la documentación entregada en la ' + deleg + ', pendiente de emisión de contra recibo:\n\n' +
        lineas.join('\n') + '\n\n' +
        'Total: ' + d.total + ' facturas — ' + mnyTxt(d.importe) + '\n\n' +
        'Anexo al presente el detalle por número de alta, factura, proveedor e importe.\n\n' +
        'Si existiera alguna observación sobre la documentación entregada, agradeceré me lo indiquen para atenderla de inmediato.\n\n' +
        'Quedo atento a sus comentarios.\n\nGestión Especializada en Cobranza\natencion@gescobranza.com · 56 4734 7117';

      try { await navigator.clipboard.writeText(correo); } catch (err) { /* si el navegador lo bloquea, el Excel igual se descarga */ }

      const enc = [
        ['GESTIÓN ESPECIALIZADA EN COBRANZA'],
        ['Relación de documentación pendiente de contra recibo'],
        [],
        ['Delegación:', deleg],
        ['Fecha de corte:', fechaHoy],
        ['Total de facturas:', d.total],
        ['Importe total:', d.importe],
        [],
        ['ALTA', 'FACTURA', 'LABORATORIO', 'GUÍA', 'FECHA DE ENVÍO', 'DÍAS', 'IMPORTE'],
      ];
      d.facturas.forEach((f) => {
        const dias = f.fecha_envio ? Math.round((hoy - new Date(f.fecha_envio + 'T12:00:00')) / 86400000) : '';
        enc.push([f.alta, f.num_factura, f.empresa, f.guia || 'sin guía', fmtD(f.fecha_envio), dias, f.importe]);
      });

      const ws = XLSX.utils.aoa_to_sheet(enc);
      ws['!cols'] = [{ wch: 17 }, { wch: 15 }, { wch: 40 }, { wch: 16 }, { wch: 15 }, { wch: 8 }, { wch: 16 }];
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
      ];
      if (ws['B7']) ws['B7'].z = '$#,##0.00';
      for (let i = 10; i <= enc.length; i++) { if (ws['G' + i]) ws['G' + i].z = '$#,##0.00'; }
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Pendientes');
      XLSX.writeFile(wb, 'reclamo-' + deleg.replace(/[^A-Za-z0-9]+/g, '-') + '.xlsx');

      alert('Correo copiado al portapapeles y Excel descargado.\n\nPégalo en tu correo y adjunta el archivo.');
    } catch (e) {
      alert('No se pudo generar el reclamo: ' + (e.message || e));
    }
    setReclamando('');
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

  function mny(n) {
    return '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
          <h2>Nueva captura</h2>
          {mensaje && <div className={`alert ${mensajeTipo}`}>{mensaje}</div>}

          <div className="field" style={{ maxWidth: 420, marginBottom: 18 }}>
            <label>1 · Nombre del susceptible</label>
            <input value={pdf} onChange={(e) => setPdf(e.target.value)} placeholder="Ej. 1103859" style={{ fontSize: 16, fontFamily: 'monospace' }} />
          </div>

          <div className="field" style={{ marginBottom: 18 }}>
            <label>2 · ¿Cuántas facturas trae?</label>
            <div className="toolbar" style={{ marginTop: 4 }}>
              <button type="button" className={modoCaptura === 'una' ? 'btn btn-primary' : 'btn btn-ghost'} onClick={() => elegirModo('una')}>Una sola</button>
              <button type="button" className={modoCaptura === 'varias' ? 'btn btn-primary' : 'btn btn-ghost'} onClick={() => elegirModo('varias')}>Varias</button>
              {modoCaptura === 'varias' && (
                <>
                  <input value={loteCantidadTexto} onChange={(e) => setLoteCantidadTexto(e.target.value.replace(/\D/g, ''))}
                    placeholder="0" style={{ width: 70, textAlign: 'center' }} />
                  <span className="muted" style={{ fontSize: 13 }}>facturas</span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={generarFilasLote}>Preparar renglones</button>
                </>
              )}
            </div>
          </div>

          {modoCaptura === 'una' && (
            <>
              <div className="field" style={{ maxWidth: 420, marginBottom: 18 }}>
                <label>3 · Número de alta</label>
                <input
                  value={alta}
                  onChange={(e) => { setAlta(limpiarInvisibles(e.target.value)); setAltaExiste(false); setAlta5005(null); setAltaOtroProv(null); setCandidatoIdx(null); setImporteForzado(false); }}
                  onBlur={(e) => verificarAltaExistente(e.target.value)}
                  placeholder="Ej. 118001-106261"
                  style={{ fontSize: 16, fontFamily: 'monospace' }}
                />
                {verificandoAlta && <span className="hint muted">Consultando el 5005…</span>}
                {altaExiste && <span className="hint" style={{ color: 'var(--red)' }}>🔒 Esta alta ya fue capturada antes con este mismo proveedor — revisa si es duplicado</span>}
                {!altaExiste && altaOtroProv && (
                  <span className="hint" style={{ color: 'var(--amber)' }}>ℹ Este número de alta ya existe, pero de {altaOtroProv.empresa} ({altaOtroProv.grupo}). El IMSS reutiliza altas entre ejercicios — puedes guardar.</span>
                )}
                {alta.trim() !== '' && !FORMATO_ALTA.test(alta.trim()) && (
                  <span className="hint" style={{ color: 'var(--red)' }}>✖ Formato inválido — debe ser 6 dígitos, guion, 6 dígitos</span>
                )}
                {alta5005 && alta5005.encontrada === false && FORMATO_ALTA.test(alta.trim()) && (
                  <div style={{ marginTop: 8, padding: '10px 12px', background: 'var(--amber-soft)', border: '1px solid #EFDCB3', borderRadius: 8, fontSize: 12.5, color: '#9A5B00' }}>
                    ⚠ Esta alta todavía no aparece en el 5005. Verifica que el número esté bien escrito — tendrás que capturar los datos a mano.
                  </div>
                )}
                {alta5005 && alta5005.encontrada && alta5005.ambigua && candidatoIdx === null && (
                  <div style={{ marginTop: 8, padding: '10px 12px', background: 'var(--amber-soft)', border: '1px solid #EFDCB3', borderRadius: 8, fontSize: 12.5 }}>
                    <div style={{ fontWeight: 600, color: '#9A5B00', marginBottom: 6 }}>⚠ Esta alta aparece {alta5005.candidatos.length} veces en el 5005 — elige la que corresponde a tu factura</div>
                    {alta5005.candidatos.map((c, i) => (
                      <button key={i} type="button" className="btn btn-ghost btn-sm" style={{ display: 'block', width: '100%', textAlign: 'left', marginTop: 6 }}
                        onClick={() => aplicarCandidato(c, i)}>
                        <b>{c.empresa || ('No. ' + c.provNo)}</b>{c.grupo ? ' · ' + c.grupo : ''}<br />
                        <span className="muted">{c.delegacion || ('UN ' + c.unAp)} · {Number(c.importe || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}{c.comprobante ? ' · CR ' + c.comprobante : ''}</span>
                      </button>
                    ))}
                  </div>
                )}
                <span className="hint">{altaHint}</span>
              </div>

              <div className="grid" style={{ marginBottom: 4 }}>
                <div className="field">
                  <label>Número de factura</label>
                  <input value={numFactura} onChange={(e) => setNumFactura(e.target.value)} placeholder="Si es distinto al susceptible" />
                </div>
                <div className="field">
                  <label>Importe {candidatoActivo && <span className="muted" style={{ fontWeight: 400 }}>· del IMSS</span>}</label>
                  <input value={importeTexto} onChange={(e) => { formatearImporte(e.target.value); setImporteForzado(false); }} placeholder="$0.00" />
                </div>
                <div className="field">
                  <label>Fecha de recepción</label>
                  <input type="date" value={fechaRecepcion} onChange={(e) => setFechaRecepcion(e.target.value)} />
                </div>
              </div>
              {importeDifiere && !importeForzado && (
                <div style={{ marginBottom: 14, padding: '10px 12px', background: 'var(--red-soft)', border: '1px solid #E8C4C4', borderRadius: 8, fontSize: 12.5 }}>
                  <div style={{ color: 'var(--red)', fontWeight: 600 }}>✖ El importe no coincide con el IMSS ({Number(candidatoActivo.importe || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })})</div>
                  <div style={{ color: 'var(--red)', marginTop: 2 }}>Esta factura debe refacturarse. No se puede guardar así.</div>
                  <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 7 }} onClick={() => setImporteForzado(true)}>Ya revisé la factura física, el importe correcto es el que capturé</button>
                </div>
              )}
              {importeDifiere && importeForzado && (
                <p className="hint" style={{ color: 'var(--amber)', marginBottom: 12 }}>⚠ Guardarás con un importe distinto al del IMSS — quedará marcada para revisión</p>
              )}

              {candidatoActivo && (
                <div style={{ padding: '12px 14px', background: 'var(--green-soft)', border: '1px solid #cdeadd', borderRadius: 10, marginBottom: 14 }}>
                  <div style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600, marginBottom: 8 }}>Datos tomados del IMSS</div>
                  <div className="grid" style={{ fontSize: 13 }}>
                    <div><span className="muted" style={{ fontSize: 11.5 }}>Proveedor</span><br />{candidatoActivo.empresa || ('No. ' + candidatoActivo.provNo)}</div>
                    <div><span className="muted" style={{ fontSize: 11.5 }}>Cliente</span><br />{candidatoActivo.grupo || '—'}</div>
                    <div><span className="muted" style={{ fontSize: 11.5 }}>Delegación</span><br />{candidatoActivo.delegacion || ('UN ' + candidatoActivo.unAp)}</div>
                  </div>
                  {candidatoActivo.comprobante && <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Ya tiene contra recibo: <b>{candidatoActivo.comprobante}</b></div>}
                  {alta5005 && alta5005.ambigua && (
                    <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => { setCandidatoIdx(null); setImporteForzado(false); }}>Elegir otra</button>
                  )}
                </div>
              )}

              <div className="field" style={{ maxWidth: 220, marginBottom: 16 }}>
                <label>Capturista</label>
                <select value={capturista} onChange={(e) => setCapturista(e.target.value)}>
                  <option value="Sophie">Sophie</option>
                  <option value="Mariano">Mariano</option>
                  <option value="Sarahi">Sarahi</option>
                </select>
              </div>
              <button className="btn btn-primary" onClick={guardar} disabled={guardando || altaExiste || !pdf.trim() || (alta.trim() !== '' && !FORMATO_ALTA.test(alta.trim())) || (importeDifiere && !importeForzado) || (alta5005 && alta5005.encontrada && alta5005.ambigua && candidatoIdx === null)}>
                {guardando ? 'Guardando…' : 'Guardar factura'}
              </button>
              {!pdf.trim() && <p className="muted" style={{ marginTop: 8 }}>Captura primero el nombre del susceptible.</p>}
            </>
          )}

          {modoCaptura === 'varias' && loteFilas.length > 0 && (
            <>
              <div className="field" style={{ marginBottom: 6 }}><label>3 · Altas</label></div>
              <table>
                <thead><tr><th style={{ width: 40 }}>#</th><th>Número de alta</th><th>Importe</th><th>No. de factura</th></tr></thead>
                <tbody>
                  {loteFilas.map((f, idx) => {
                    const dup = loteAltasDuplicadasEntreSi.has(f.alta.trim().toLowerCase());
                    const c5 = candidatoDeFila(f);
                    return (
                      <tr key={idx}>
                        <td className="muted">{idx + 1}</td>
                        <td>
                          <input
                            value={f.alta}
                            onChange={(e) => actualizarFilaLote(idx, 'alta', e.target.value)}
                            onBlur={(e) => verificarAltaLoteExistente(idx, e.target.value)}
                            placeholder="Ej. 118001-106261"
                            style={{ minWidth: 170, fontFamily: 'monospace' }}
                          />
                          {dup && <span className="hint" style={{ color: 'var(--red)' }}>✗ Alta repetida en este mismo susceptible</span>}
                          {f.existeEnServidor && <span className="hint" style={{ color: 'var(--red)' }}>🔒 Ya fue capturada con este proveedor</span>}
                          {f.alta.trim() !== '' && !FORMATO_ALTA.test(f.alta.trim()) && (
                            <span className="hint" style={{ color: 'var(--red)' }}>✖ Formato inválido — 6 dígitos, guion, 6 dígitos</span>
                          )}
                          {f.info5005 && f.info5005.encontrada === false && FORMATO_ALTA.test(f.alta.trim()) && (
                            <span className="hint" style={{ color: 'var(--amber)' }}>⚠ Aún no aparece en el 5005</span>
                          )}
                          {c5 && !filaLoteDiscrepa(f) && (
                            <span className="hint" style={{ color: 'var(--green)' }}>✓ {c5.empresa || ('No. ' + c5.provNo)} · {c5.delegacion || ('UN ' + c5.unAp)}</span>
                          )}
                          {c5 && empresaObj && c5.provNorm && String(empresaObj.numero).replace(/^0+/, '') !== c5.provNorm && (
                            <span className="hint" style={{ color: 'var(--red)', fontWeight: 600 }}>✖ El IMSS dice {c5.empresa || ('No. ' + c5.provNo)} — no puede ir en este susceptible</span>
                          )}
                          {c5 && delegacion && c5.delegacion && c5.delegacion !== delegacion && (
                            <span className="hint" style={{ color: 'var(--red)', fontWeight: 600 }}>✖ El IMSS dice {c5.delegacion} — no puede ir en este susceptible</span>
                          )}
                          {f.info5005 && f.info5005.encontrada && f.info5005.ambigua && (
                            <div style={{ marginTop: 6, padding: '8px 10px', background: 'var(--amber-soft)', border: '1px solid #EFDCB3', borderRadius: 7 }}>
                              <div style={{ fontSize: 11.5, fontWeight: 600, color: '#9A5B00', marginBottom: 5 }}>
                                ⚠ Esta alta aparece {f.info5005.candidatos.length} veces en el 5005 — elige la que corresponde
                              </div>
                              {f.info5005.candidatos.map((c, ci) => (
                                <button key={ci} type="button"
                                  className={f.candidatoIdx === ci ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
                                  style={{ display: 'block', width: '100%', textAlign: 'left', marginTop: 4, fontSize: 11.5 }}
                                  onClick={() => elegirCandidatoLote(idx, ci)}>
                                  <b>{c.empresa || ('No. ' + c.provNo)}</b>{c.grupo ? ' · ' + c.grupo : ''} · {Number(c.importe || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                        <td>
                          <input value={f.importeTexto} onChange={(e) => formatearImporteLote(idx, e.target.value)} placeholder="$0.00" style={{ minWidth: 120 }} />
                          {c5 && Math.abs(Number(f.importeRaw || 0) - Number(c5.importe || 0)) > 0.01 && (
                            <>
                              <span className="hint" style={{ color: 'var(--red)' }}>✖ El IMSS dice {Number(c5.importe || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</span>
                              <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 4, display: 'block' }} onClick={() => usarImporte5005Lote(idx)}>Usar el del IMSS</button>
                            </>
                          )}
                        </td>
                        <td><input value={f.numFactura} onChange={(e) => actualizarFilaLote(idx, 'numFactura', e.target.value)} placeholder="Si es distinto" style={{ minWidth: 140 }} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="grid" style={{ marginTop: 16 }}>
                <div className="field">
                  <label>Fecha de recepción</label>
                  <input type="date" value={fechaRecepcion} onChange={(e) => setFechaRecepcion(e.target.value)} />
                </div>
                <div className="field">
                  <label>Capturista</label>
                  <select value={capturista} onChange={(e) => setCapturista(e.target.value)}>
                    <option value="Sophie">Sophie</option>
                    <option value="Mariano">Mariano</option>
                    <option value="Sarahi">Sarahi</option>
                  </select>
                </div>
              </div>

              {empresaObj && (
                <div style={{ padding: '12px 14px', background: 'var(--green-soft)', border: '1px solid #cdeadd', borderRadius: 10, margin: '14px 0' }}>
                  <div style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600, marginBottom: 8 }}>Datos tomados del IMSS</div>
                  <div className="grid" style={{ fontSize: 13 }}>
                    <div><span className="muted" style={{ fontSize: 11.5 }}>Proveedor</span><br />{empresaObj.nombre}</div>
                    <div><span className="muted" style={{ fontSize: 11.5 }}>Cliente</span><br />{grupo || '—'}</div>
                    <div><span className="muted" style={{ fontSize: 11.5 }}>Delegación</span><br />{delegacion || '—'}</div>
                    <div><span className="muted" style={{ fontSize: 11.5 }}>Total</span><br /><b>{loteFilas.reduce((s, f) => s + Number(f.importeRaw || 0), 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</b></div>
                  </div>
                </div>
              )}

              <div className="toolbar">
                <button className="btn btn-primary" onClick={guardarLote}
                  disabled={loteGuardando || !loteTodoListo || loteAltasDuplicadasEntreSi.size > 0 || !pdf.trim()}>
                  {loteGuardando ? 'Guardando…' : `Guardar ${loteFilas.length} facturas`}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => { setLoteFilas([]); setLoteCantidadTexto(''); }}>Empezar de nuevo</button>
              </div>
              {!loteTodoListo && <p className="muted" style={{ marginTop: 8 }}>Captura el alta de cada renglón. El sistema toma del IMSS el proveedor, la delegación y el importe — y avisa si alguna no corresponde a este susceptible.</p>}
              {loteMensaje && <div className={`alert ${loteMensajeTipo}`} style={{ marginTop: 12 }}>{loteMensaje}</div>}
            </>
          )}

          {modoCaptura === 'varias' && loteFilas.length === 0 && (
            <p className="muted">Escribe cuántas facturas trae el susceptible y presiona «Preparar renglones».</p>
          )}
          {modoCaptura === '' && (
            <p className="muted">Captura el nombre del susceptible y elige si trae una o varias facturas.</p>
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
          <div className="toolbar" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="muted" style={{ fontSize: 12.5 }}>Contra recibos emitidos en los últimos:</span>
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
          </div>
          {consultaCargando ? <p className="muted">Cargando…</p> : (
            <>
              <table>
                <thead><tr><th>Alta</th><th>PDF / Susceptible</th><th>Grupo</th><th>Empresa</th><th>Delegación</th><th>Importe</th><th>Fecha captura</th><th>Estatus</th><th>Comprobante</th><th></th></tr></thead>
                <tbody>
                  {consultaData.facturas.map((f) => (
                    <tr key={f.id}>
                      {editandoId === f.id ? (
                        <>
                          <td><input value={editAlta} onChange={(e) => setEditAlta(e.target.value)} style={{ maxWidth: 140 }} /></td>
                          <td>{f.pdf ? <a href="#" onClick={(e) => { e.preventDefault(); abrirPdfSusceptible(f.pdf); }}>{f.pdf}</a> : '—'}</td><td>{f.grupo}</td><td>{f.empresa}</td><td>{f.delegacion}</td>
                          <td><input value={editImporte} onChange={(e) => setEditImporte(e.target.value)} style={{ maxWidth: 100 }} /></td>
                          <td className="muted">{formatearFechaCaptura(f.fecha_captura)}</td>
                          <td>
                            {(() => { const e = estatusCiclo(f); return (
                              <>
                                <span className={'tag ' + e.cls}>{e.txt}</span>
                                {e.det && <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{e.det}</div>}
                              </>
                            ); })()}
                          </td>
                          <td>{f.comprobante || '—'}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <button className="btn btn-primary btn-sm" onClick={() => guardarEdicion(f.id)} disabled={editGuardando}>Guardar</button>{' '}
                            <button className="btn btn-ghost btn-sm" onClick={cancelarEdicion}>Cancelar</button>
                            {editMensaje && <div className="muted" style={{ color: 'var(--red)' }}>{editMensaje}</div>}
                          </td>
                        </>
                      ) : (
                        <>
                          <td>{f.alta}</td><td>{f.pdf ? <a href="#" onClick={(e) => { e.preventDefault(); abrirPdfSusceptible(f.pdf); }}>{f.pdf}</a> : '—'}</td><td>{f.grupo}</td><td>{f.empresa}</td><td>{f.delegacion}</td>
                          <td>${Number(f.importe).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                          <td className="muted">{formatearFechaCaptura(f.fecha_captura)}</td>
                          <td>
                            {(() => { const e = estatusCiclo(f); return (
                              <>
                                <span className={'tag ' + e.cls}>{e.txt}</span>
                                {e.det && <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{e.det}</div>}
                              </>
                            ); })()}
                          </td>
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
              <div className="card" style={{ padding: '22px 26px' }}>
                <div style={{ display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 230 }}>
                    <div className="muted" style={{ fontSize: 12, letterSpacing: '0.02em' }}>
                      {kFiltroGrupo ? 'CARTERA — ' + kFiltroGrupo.toUpperCase() : 'CARTERA TOTAL BAJO GESTIÓN'}
                    </div>
                    <div style={{ fontSize: 34, fontWeight: 600, color: 'var(--navy)', lineHeight: 1.15, marginTop: 3 }}>{mny(kpiData.importe_total)}</div>
                    <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>
                      {kpiData.total} altas · {(kpiData.por_grupo || []).length} cliente(s) · {kpiData.laboratorios} laboratorio(s) · {(kpiData.por_delegacion || []).length} delegación(es)
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, flexShrink: 0, marginRight: 8 }}>
                    <div className="kpi-ring-wrap" style={{ width: 124, height: 124 }}>
                      <svg viewBox="0 0 160 160">
                        <circle cx="80" cy="80" r="68" fill="none" stroke="var(--green-soft)" strokeWidth="14" />
                        <circle cx="80" cy="80" r="68" fill="none" stroke="var(--green)" strokeWidth="14" strokeLinecap="round"
                          strokeDasharray="427"
                          strokeDashoffset={427 - (427 * (kpiData.total ? Math.round((kpiData.con_cr / kpiData.total) * 100) : 0)) / 100} />
                      </svg>
                      <div className="kpi-ring-center">
                        <div className="kpi-ring-num">{kpiData.total ? Math.round((kpiData.con_cr / kpiData.total) * 100) : 0}%</div>
                        <div className="kpi-ring-lbl">de las altas</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--line)', marginTop: 24, paddingTop: 22, display: 'flex', gap: 34, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontSize: 12.5, color: 'var(--green)', fontWeight: 600 }}>● Con contra recibo</div>
                    <div style={{ fontSize: 23, fontWeight: 600, color: 'var(--green)', marginTop: 3 }}>{mny(kpiData.importe_con_cr)}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {kpiData.importe_total ? Math.round((kpiData.importe_con_cr / kpiData.importe_total) * 100) : 0}% del importe · {kpiData.con_cr} altas
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontSize: 12.5, color: 'var(--amber)', fontWeight: 600 }}>● En gestión ante el IMSS</div>
                    <div style={{ fontSize: 23, fontWeight: 600, color: 'var(--amber)', marginTop: 3 }}>{mny(kpiData.importe_total - kpiData.importe_con_cr)}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {kpiData.importe_total ? Math.round(((kpiData.importe_total - kpiData.importe_con_cr) / kpiData.importe_total) * 100) : 0}% del importe · {kpiData.sin_cr} altas
                    </div>
                  </div>
                </div>
              </div>

              <div className="card">
                <h2>Por cliente</h2>
                <p className="muted" style={{ marginBottom: 10 }}>Ordenado por cartera · clic en un renglón para filtrar todo el panel</p>
                <table>
                  <thead><tr>
                    <th>Cliente</th>
                    <th style={{ textAlign: 'right' }}>Altas</th>
                    <th style={{ textAlign: 'right' }}>Con CR</th>
                    <th style={{ textAlign: 'right' }}>Sin CR</th>
                    <th style={{ textAlign: 'right' }}>Cartera</th>
                    <th style={{ textAlign: 'right' }}>% avance</th>
                  </tr></thead>
                  <tbody>
                    {(kpiData.por_grupo || []).map((g) => {
                      const cc = Number(g.importe_con_cr || 0);
                      const tt = Number(g.importe_total || 0);
                      const pct = tt ? Math.round((cc / tt) * 100) : 0;
                      return (
                        <tr key={g.grupo} style={{ cursor: 'pointer', background: kFiltroGrupo === g.grupo ? 'var(--green-soft)' : undefined }}
                          onClick={() => { setKFiltroGrupo(kFiltroGrupo === g.grupo ? '' : g.grupo); setKFiltroProvNo(''); }}>
                          <td style={{ fontWeight: 600 }}>{g.grupo}</td>
                          <td style={{ textAlign: 'right' }} className="muted">{g.total}</td>
                          <td style={{ textAlign: 'right', color: 'var(--green)' }}>{mny(cc)}</td>
                          <td style={{ textAlign: 'right', color: 'var(--amber)' }}>{mny(tt - cc)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{mny(tt)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: pct >= 60 ? 'var(--green)' : pct >= 40 ? 'var(--amber)' : 'var(--red)' }}>{pct}%</td>
                        </tr>
                      );
                    })}
                    <tr style={{ background: 'var(--green)', color: '#fff' }}>
                      <td style={{ fontWeight: 700 }}>TOTAL</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{kpiData.total}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{mny(kpiData.importe_con_cr)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{mny(kpiData.importe_total - kpiData.importe_con_cr)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{mny(kpiData.importe_total)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{kpiData.importe_total ? Math.round((kpiData.importe_con_cr / kpiData.importe_total) * 100) : 0}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="card">
                <h2>Delegaciones que frenan más dinero</h2>
                <p className="muted" style={{ marginBottom: 10 }}>Ordenado por importe sin contra recibo</p>
                <table>
                  <thead><tr>
                    <th>Delegación</th>
                    <th>Clientes</th>
                    <th style={{ textAlign: 'right' }}>Altas</th>
                    <th style={{ textAlign: 'right' }}>Sin CR</th>
                    <th style={{ textAlign: 'right' }}>% avance</th>
                  </tr></thead>
                  <tbody>
                    {(kpiData.por_delegacion || []).slice(0, 20).map((d) => {
                      const cc = Number(d.importe_con_cr || 0);
                      const tt = Number(d.importe_total || 0);
                      const pct = tt ? Math.round((cc / tt) * 100) : 0;
                      return (
                        <tr key={d.delegacion}>
                          <td>{d.delegacion}</td>
                          <td className="muted" style={{ fontSize: 12 }}>{d.grupos}</td>
                          <td style={{ textAlign: 'right' }} className="muted">{d.total}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--amber)' }}>{mny(tt - cc)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: pct >= 60 ? 'var(--green)' : pct >= 40 ? 'var(--amber)' : 'var(--red)' }}>{pct}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="card">
                <h2>Importe por laboratorio</h2>
                <p className="muted" style={{ marginBottom: 10 }}>Ordenado de mayor a menor</p>
                <table>
                  <thead><tr>
                    <th>Laboratorio</th>
                    <th style={{ textAlign: 'right' }}>Altas</th>
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
                          <td style={{ textAlign: 'right' }} className="muted">{p.con_cr} de {p.total}</td>
                          <td style={{ textAlign: 'right', color: 'var(--green)' }}>{mny(cc)}</td>
                          <td style={{ textAlign: 'right', color: 'var(--amber)' }}>{mny(tt - cc)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{mny(tt)}</td>
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
                  {Number(v.viejas) > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--red)', background: 'var(--red-soft)', borderRadius: 5, padding: '3px 6px', marginTop: 5, lineHeight: 1.3 }}>
                      ⚠ {v.viejas} con más de 15 días{v.dias_max ? ' · hasta ' + v.dias_max + 'd' : ''}
                    </div>
                  )}
                  {Number(v.historicas) > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--amber)', background: 'var(--amber-soft)', borderRadius: 5, padding: '3px 6px', marginTop: 4, lineHeight: 1.3 }}>
                      ⚠ OJO — {v.historicas} de importación histórica
                    </div>
                  )}
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
                    <button className="btn btn-ghost btn-sm" style={{ marginTop: 8, fontSize: 11.5, padding: '4px 10px' }}
                      disabled={reclamando === v.delegacion}
                      onClick={(e) => { e.stopPropagation(); generarReclamo(v.delegacion); }}>
                      {reclamando === v.delegacion ? 'Generando…' : '✉ Reclamar'}
                    </button>
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
            <h2 id="detalle-seguimiento">Detalle y marcar envío</h2>
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
                <button className="btn btn-primary btn-sm" onClick={marcarSeleccionadasComoEnviadas}>Marcar como enviadas</button>
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
