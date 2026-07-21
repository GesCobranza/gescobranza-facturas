'use client';
import { useState, useEffect, Fragment } from 'react';
import * as XLSX from 'xlsx';

export default function Home() {
  const [tab, setTab] = useState('captura');
  const [catalogos, setCatalogos] = useState({ grupos: [], delegaciones: [] });
  const [cargando, setCargando] = useState(true);
  const [seleccionados, setSeleccionados] = useState(new Set());

  // ---- Consulta ----
  const [cFiltroGrupo, setCFiltroGrupo] = useState('');
  const [cFiltroDeleg, setCFiltroDeleg] = useState('');
  const [cFiltroProvNo, setCFiltroProvNo] = useState('');
  const [cFiltroEstatus, setCFiltroEstatus] = useState('');
  const [cFiltroObservacion, setCFiltroObservacion] = useState(false);
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
  const [seguimientoData, setSeguimientoData] = useState({ resumenPorDelegacion: [], esperando: [], filasGestores: [], totalFilasGestores: 0 });
  const [gCargando, setGCargando] = useState(false);
  const GESTORES_POR_PAGINA = 50;

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
  const [comentarios, setComentarios] = useState([]);
  const [comentarioTexto, setComentarioTexto] = useState('');
  const [comentarioCargando, setComentarioCargando] = useState(false);
  const [comentarioGuardando, setComentarioGuardando] = useState(false);

  // ---- Cruce 5005 ----
  const [raw5005File, setRaw5005File] = useState(null);
  const [raw5005Mensaje, setRaw5005Mensaje] = useState('');
  const [cruceMensaje, setCruceMensaje] = useState('');
  const [cargandoCruce, setCargandoCruce] = useState(false);

  useEffect(() => { cargarCatalogos(); }, []);

  useEffect(() => {
    if (tab === 'consulta') cargarConsulta();
  }, [tab, cFiltroGrupo, cFiltroDeleg, cFiltroProvNo, cFiltroEstatus, cFiltroObservacion, cFiltroCapturista, cFiltroFechaDesde, cFiltroFechaHasta, cPagina]);

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
    setLoteFilas((prev) => prev.map((f, i) => (i === idx ? { ...f, [campo]: valor } : f)));
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

  const loteTodoListo = loteFilas.length > 0
    && grupo && empresaObj && delegacion && pdf
    && loteFilas.every((f) => f.alta && f.importeRaw > 0 && validarAltaLote(f.alta).ok);

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
    if (!raw5005File) {
      setRaw5005Mensaje('Selecciona primero el archivo del 5005.');
      return;
    }
    setRaw5005Mensaje('Leyendo archivo…');
    try {
      const buffer = await raw5005File.arrayBuffer();
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
        setRaw5005Mensaje('No encontré las columnas esperadas (Proveedor, Num Ent Alm, Importe, Comprobante) en las primeras filas del archivo — revisa que sea el reporte 5005 correcto.');
        return;
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
        setRaw5005Mensaje('No se detectaron filas de datos válidas en el archivo.');
        return;
      }

     const TAMANO_BLOQUE = 2000;
      const bloques = [];
      for (let i = 0; i < filas.length; i += TAMANO_BLOQUE) bloques.push(filas.slice(i, i + TAMANO_BLOQUE));

      let totalCargadas = 0;
      for (let i = 0; i < bloques.length; i++) {
        setRaw5005Mensaje(`Subiendo bloque ${i + 1} de ${bloques.length} (${filas.length} filas en total)…`);
        const res = await fetch('/api/raw5005', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filas: bloques[i], primerBloque: i === 0 }),
        });
        const data = await res.json();
        if (!data.ok) {
          setRaw5005Mensaje(`Error en el bloque ${i + 1}: ${data.error}. Se cargaron ${totalCargadas} filas antes del error.`);
          return;
        }
        totalCargadas += data.cargadas;
      }
      setRaw5005Mensaje(`✓ Archivo cargado: ${totalCargadas} filas del 5005. Ya puedes cruzar.`);
    } catch (err) {
      setRaw5005Mensaje('Error leyendo el archivo: ' + err.message);
    }
  }

async function cruzarCon5005() {
    setCargandoCruce(true);
    setCruceMensaje('Cruzando…');
    try {
      const res = await fetch('/api/cruce5005', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setCruceMensaje(`Cruce terminado: ${data.encontrados} CR encontrados, ${data.alertasImporte} alertas de importe, ${data.ambiguos} casos ambiguos, ${data.incompletos} filas con datos incompletos.`);
      } else {
        setCruceMensaje(`Error: ${data.error}`);
      }
    } catch (err) {
      setCruceMensaje('Error de conexión: ' + err.message);
    } finally {
      setCargandoCruce(false);
    }
  }

  const grupoCatObj = catalogos.grupos.find((g) => g.nombre === catGrupoSel);
  const empresasCat = grupoCatObj ? grupoCatObj.empresas : [];

  // ---- Gestores: "esperando CR" con días calculados ----
  const esperando = (seguimientoData.esperando || [])
    .map((f) => ({ ...f, dias: Math.floor((Date.now() - new Date(f.fecha_envio)) / 86400000) }))
    .sort((a, b) => b.dias - a.dias);
  const maxPend = Math.max(1, ...(seguimientoData.resumenPorDelegacion || []).map((v) => v.n));
  const filasGestores = seguimientoData.filasGestores || [];
  const totalPaginasGestores = Math.max(1, Math.ceil((seguimientoData.totalFilasGestores || 0) / GESTORES_POR_PAGINA));
  const totalPaginasConsulta = Math.max(1, Math.ceil((consultaData.total || 0) / CONSULTA_POR_PAGINA));

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
        <button className={tab === 'cruce' ? 'active' : ''} onClick={() => setTab('cruce')}>Cruce 5005</button>
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
                              <input value={f.alta} onChange={(e) => actualizarFilaLote(idx, 'alta', e.target.value)} placeholder="Ej. AL-2026-00981" style={{ minWidth: 160 }} />
                              {f.alta && (
                                <span className="hint" style={{ color: dup ? 'var(--red)' : (val.ok ? 'var(--green)' : 'var(--red)') }}>
                                  {dup ? '✗ Alta repetida en este mismo lote' : val.hint}
                                </span>
                              )}
                            </td>
                            <td><input value={f.importeTexto} onChange={(e) => formatearImporteLote(idx, e.target.value)} placeholder="$0.00" style={{ minWidth: 120 }} /></td>
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
                <thead><tr><th>Alta</th><th>Grupo</th><th>Empresa</th><th>Delegación</th><th>Importe</th><th>CR</th><th>Comprobante</th><th></th></tr></thead>
                <tbody>
                  {consultaData.facturas.map((f) => (
                    <tr key={f.id}>
                      {editandoId === f.id ? (
                        <>
                          <td><input value={editAlta} onChange={(e) => setEditAlta(e.target.value)} style={{ maxWidth: 140 }} /></td>
                          <td>{f.grupo}</td><td>{f.empresa}</td><td>{f.delegacion}</td>
                          <td><input value={editImporte} onChange={(e) => setEditImporte(e.target.value)} style={{ maxWidth: 100 }} /></td>
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
                          <td>{f.alta}</td><td>{f.grupo}</td><td>{f.empresa}</td><td>{f.delegacion}</td>
                          <td>${Number(f.importe).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                          <td>{f.tiene_cr ? <span className="tag tag-green">Con CR</span> : <span className="tag tag-amber">Sin CR</span>}</td>
                          <td>
                            {f.comprobante || '—'}
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
            <h2>Pendientes por enviar, por delegación</h2>
            <p className="muted" style={{ marginBottom: 12 }}>Sin contra recibo y aún no enviadas a ningún gestor.</p>
            {(seguimientoData.resumenPorDelegacion || []).length === 0 && <p className="muted">No hay pendientes por enviar.</p>}
            {(seguimientoData.resumenPorDelegacion || []).map((v) => (
              <div className="bar-row" key={v.delegacion} style={{ cursor: 'pointer' }} onClick={() => { setGFiltroDeleg(v.delegacion); setGFiltroEnvio('noenviada'); setGPagina(1); }}>
                <div className="bar-label" style={{ width: 220 }}>{v.delegacion}</div>
                <div className="bar-track"><div className="bar-fill" style={{ width: (v.n / maxPend) * 100 + '%' }} /></div>
                <div className="bar-val">{v.n}</div>
                <div className="muted" style={{ width: 120, textAlign: 'right' }}>${Number(v.importe).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
              </div>
            ))}
          </div>

          <div className="card">
            <h2>Enviadas — esperando contra recibo</h2>
            <p className="muted" style={{ marginBottom: 12 }}>Hasta las 500 más antiguas — si tienes más, resuélvelas por aquí primero.</p>
            {esperando.length === 0 && <p className="muted">No hay facturas esperando respuesta ahora mismo.</p>}
            {esperando.length > 0 && (
              <table>
                <thead><tr><th>Alta</th><th>Empresa</th><th>PDF / Susceptible</th><th>Delegación</th><th>Importe</th><th>Días esperando</th><th>Comentarios</th></tr></thead>
                <tbody>
                  {esperando.map((f) => (
                    <Fragment key={f.id}>
                      <tr>
                        <td>{f.alta}</td><td>{f.empresa}</td><td>{f.pdf || '—'}</td><td>{f.delegacion}</td>
                        <td>${Number(f.importe).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                        <td>{f.dias > 15 ? <span className="tag" style={{ background: 'var(--red-soft)', color: 'var(--red)' }}>{f.dias}d</span> : <span className="muted">{f.dias}d</span>}</td>
                        <td>
                          <button className="btn btn-ghost btn-sm" onClick={() => comentarioFacturaId === f.id ? cerrarComentarios() : abrirComentarios(f.id)}>
                            💬 {f.comentarios_count > 0 ? f.comentarios_count : ''}
                          </button>
                        </td>
                      </tr>
                      {comentarioFacturaId === f.id && (
                        <tr>
                          <td colSpan={6} style={{ background: 'var(--bg-soft, #f7f8fa)', padding: 16 }}>
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
                  ))}
                </tbody>
              </table>
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
              <div className="alert ok" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span>{seleccionados.size} seleccionada(s)</span>
                <button className="btn btn-primary btn-sm" onClick={marcarSeleccionadasComoEnviadas}>Marcar como enviadas a gestor</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setSeleccionados(new Set())}>Cancelar selección</button>
              </div>
            )}
            {gCargando ? <p className="muted">Cargando…</p> : (
              <>
                <table>
                  <thead><tr><th></th><th>Alta</th><th>Empresa</th><th>PDF / Susceptible</th><th>Delegación</th><th>Importe</th><th>Envío</th><th>Comentarios</th></tr></thead>
                  <tbody>
                    {filasGestores.map((f) => (
                      <tr key={f.id}>
                        <td><input type="checkbox" checked={seleccionados.has(f.id)} onChange={() => toggleSeleccion(f.id)} /></td>
                        <td>{f.alta}</td><td>{f.empresa}</td><td>{f.pdf || '—'}</td><td>{f.delegacion}</td>
                        <td>${Number(f.importe).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
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
              Sube tu archivo del 5005 completo, tal cual lo recibes (Excel) — el sistema encuentra solo las columnas que
              necesita (Proveedor, Num Ent Alm, Importe, Comprobante), sin importar cuántas más traiga el archivo.
              Cada archivo nuevo reemplaza al anterior completo.
            </p>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setRaw5005File(e.target.files[0] || null)}
            />
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
