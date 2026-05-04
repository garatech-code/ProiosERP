// src/components/OperationDetail.jsx
import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from '../api/axios';
import { useAuth } from '../context/AuthContext';
import OperarioActionPanel from './OperarioActionPanel';
import OperationTracker from './OperationTracker';
import ProductSearchCards from './ProductSearchCards'; // NUEVO COMPONENTE
import OperationEmails from './OperationEmails'; // COMPONENTE DE CORREOS
import LogoSpinner from './LogoSpinner';
import * as XLSX from 'xlsx';

export default function OperationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [operation, setOperation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showPackingModal, setShowPackingModal] = useState(false);
  const [stockVerification, setStockVerification] = useState(null);
  const [checkingStock, setCheckingStock] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [excelPreviewHtml, setExcelPreviewHtml] = useState(null);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [packingData, setPackingData] = useState({
    operation_id: '', client: '', ship: '', port: '', eta: '', products: [], total_weight: 0, total_price: 0
  }); // Evitamos undefined

  // Estados del workflow de revisión Operador <-> Owner
  const [mensajeRevision, setMensajeRevision] = useState('');
  const [revisionActionLoading, setRevisionActionLoading] = useState(false);
  const isOperador = user?.role === 'OPERADOR';

  // Nuevos estados para los desplegables del packing list
  const [proveedor, setProveedor] = useState('PROIOS SA'); // opción por defecto
  const [paisDestino, setPaisDestino] = useState('argentina'); // 'argentina' o 'bandera'

  // Edit nombre inline
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState('');

  useEffect(() => {
    if (operation) {
      setTempName(operation.nombre || '');
    }
  }, [operation]);

  const handleSaveName = async () => {
    try {
      await axios.patch(`/operaciones/operations/${id}/`, { nombre: tempName });
      showToast('Nombre actualizado correctamente', 'success');
      setEditingName(false);
      fetchOperation();
    } catch (err) {
      console.error(err);
      showToast('Error al actualizar nombre', 'error');
    }
  };

  const showToast = (message, type = 'info') => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Parser con Regex para auto-detectar productos en texto libre
  const detectedProducts = useMemo(() => {
    if (!operation?.texto_pedido) return [];

    const lines = operation.texto_pedido.split('\n');
    let parsedProducts = [];
    let idCounter = 1;

    // Diferentes "modelos" o patrones de heurística Regex para procesar el texto plano
    const patterns = [
      // Modelo 1: Producto - Cantidad: X [Unidad]
      {
        regex: /(.+?)[–\-:]\s*(?:Cant(?:idad|\.)?)\s*(?::)?\s*(\d+)\s*(.*)/i,
        extract: (m) => ({ nombre: m[1], cantidad: m[2], unidad: m[3] })
      },
      // Modelo 2: X [Unidad] de Producto
      {
        regex: /^(\d+)\s+([a-zA-Z]+)?\s*(?:de|del)?\s+(.+)$/i,
        extract: (m) => ({ nombre: m[3], cantidad: m[1], unidad: m[2] })
      },
      // Modelo 3: Producto x X [Unidad]
      {
        regex: /(.+?)\s+x\s*(\d+)\s*(.*)/i,
        extract: (m) => ({ nombre: m[1], cantidad: m[2], unidad: m[3] })
      },
      // Modelo 4: Producto (X [Unidad])
      {
        regex: /(.+?)\s*\((\d+)\s*([a-zA-Z]+)?\)/i,
        extract: (m) => ({ nombre: m[1], cantidad: m[2], unidad: m[3] })
      },
      // Modelo 5: QTY: X - Producto
      {
        regex: /(?:Qty|Cantidad)(?::)?\s*(\d+)\s*([a-zA-Z]+)?\s*[\-\|]\s*(.+)/i,
        extract: (m) => ({ nombre: m[3], cantidad: m[1], unidad: m[2] })
      }
    ];

    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.length < 3) return; // Ignorar líneas muy cortas o vacías

      let matched = false;

      // Evaluar cada line en orden secuencial según el banco de patrones
      for (const pattern of patterns) {
        const match = trimmedLine.match(pattern.regex);
        if (match) {
          const { nombre, cantidad, unidad } = pattern.extract(match);

          // Prevenir falsos positivos filtrando nombres inusualmente largos o vacíos
          const safeName = nombre ? nombre.trim().replace(/^[\-\:]|[\-\:]$/g, '').trim() : '';

          if (safeName && safeName.length > 2 && safeName.length < 80) {
            parsedProducts.push({
              id: `auto_${idCounter++}`,
              nombre: safeName,
              cantidad: parseInt(cantidad, 10) || 1,
              unidad: unidad ? unidad.trim() : 'unidades'
            });
            matched = true;
            break; // Si un modelo procesó la línea con éxito, no evalúa más modelos para esta línea
          }
        }
      }
    });

    return parsedProducts;
  }, [operation?.texto_pedido]);

  useEffect(() => {
    fetchOperation();
  }, [id]);

  useEffect(() => {
    if (operation && (operation.status === 'pending' || operation.estado === 'solicitada' || operation.estado === 'armado_packing')) {
      checkStock();
    }
  }, [operation]);

  const fetchOperation = async () => {
    try {
      const res = await axios.get(`/operaciones/operations/${id}/`);
      setOperation(res.data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Error al cargar la operación');
    } finally {
      setLoading(false);
    }
  };

  const checkStock = async () => {
    setCheckingStock(true);
    try {
      const res = await axios.get(`/operaciones/operations/${id}/verificar_stock/`);
      setStockVerification(res.data);
    } catch (err) {
      console.error('Error verificando stock:', err);
    } finally {
      setCheckingStock(false);
    }
  };

  const handleAction = async (action, confirmMessage) => {
    if (action === 'start_coordination') {
      if (!stockVerification?.todo_suficiente) {
        showToast('No se puede confirmar: Hay productos sin stock suficiente.', 'error');
        return;
      }
      if (confirmMessage && !window.confirm(confirmMessage)) return;
    } else {
      if (confirmMessage && !window.confirm(confirmMessage)) return;
    }

    setActionLoading(true);
    try {
      await axios.post(`/operaciones/operations/${id}/${action}/`);
      if (action === 'confirm_operation') {
        showToast('Operación confirmada y stock consumido correctamente', 'success');
      }
      fetchOperation();
    } catch (err) {
      console.error(err);
      const errorMsg = err.response?.data?.error || err.response?.data?.message || 'Error al ejecutar la acción';
      showToast(errorMsg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestReview = async () => {
    setRevisionActionLoading(true);
    try {
      await axios.post(`/operaciones/operations/${id}/request_review/`, {
        mensaje_revision: mensajeRevision
      });
      showToast('Revisión solicitada exitosamente', 'success');
      setMensajeRevision('');
      fetchOperation();
    } catch (err) {
      console.error(err);
      showToast('Error al solicitar revisión', 'error');
    } finally {
      setRevisionActionLoading(false);
    }
  };

  const handleResolveReview = async (actionStr) => {
    if (!window.confirm(`¿Desea ${actionStr === 'approve' ? 'APROBAR' : 'RECHAZAR'} esta etapa?`)) return;
    setRevisionActionLoading(true);
    try {
      await axios.post(`/operaciones/operations/${id}/resolve_review/`, {
        action: actionStr,
        mensaje_revision: mensajeRevision
      });
      showToast(`Revisión ${actionStr === 'approve' ? 'Aprobada' : 'Rechazada'}`, 'success');
      setMensajeRevision('');
      fetchOperation();
    } catch (err) {
      console.error(err);
      showToast('Error al resolver revisión', 'error');
    } finally {
      setRevisionActionLoading(false);
    }
  };

  const handleFileUpload = async (event, type, confirmMessage) => {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    const file = event.target.files[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      await axios.post(`/operaciones/operations/${id}/${type}/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      fetchOperation();
    } catch (err) {
      console.error(err);
      showToast('Error al subir archivo', 'error');
    } finally {
      setUploading(false);
    }
  };

  const openPreview = (url) => {
    if (!url) return;
    let type = 'pdf';
    if (url.match(/\.(jpe?g|png|gif|bmp|webp)$/i)) type = 'image';
    else if (url.match(/\.pdf$/i)) type = 'pdf';
    else if (url.match(/\.xlsx?$/i)) type = 'excel';
    else type = 'unknown';
    setPreviewFile({ url, type });
  };

  const downloadPackingListExcel = async () => {
    try {
      // Construir URL con parámetros
      let url = `/operaciones/operations/${id}/packing_list_excel/`;
      const params = new URLSearchParams();
      params.append('proveedor', proveedor);
      params.append('pais_destino', paisDestino);
      url += `?${params.toString()}`;

      const response = await axios.get(url, {
        responseType: 'blob',
      });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', `packing_list_${id}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
      showToast('Descargando Packing List...', 'success');
    } catch (error) {
      console.error(error);
      showToast('Error al descargar el archivo', 'error');
    }
  };

  const previewPackingListExcel = async () => {
    try {
      let url = `/operaciones/operations/${id}/packing_list_excel/`;
      const params = new URLSearchParams();
      params.append('proveedor', proveedor);
      params.append('pais_destino', paisDestino);
      url += `?${params.toString()}`;

      const response = await axios.get(url, {
        responseType: 'blob',
      });
      const data = await response.data.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const html = XLSX.utils.sheet_to_html(firstSheet, { editable: false });
      setExcelPreviewHtml(html);
      setShowExcelModal(true);
    } catch (error) {
      console.error(error);
      showToast('Error al previsualizar el archivo', 'error');
    }
  };

  const statusBadge = (status) => {
    const colors = {
      solicitada: 'bg-yellow-100 text-yellow-800',
      armado_packing: 'bg-blue-100 text-blue-800',
      en_aduana: 'bg-orange-100 text-orange-800',
      lista_para_envio: 'bg-green-100 text-green-800',
      remitada: 'bg-indigo-100 text-indigo-800',
      entregada: 'bg-gray-100 text-gray-800',
      cancelada: 'bg-red-100 text-red-800',
    };
    const labels = {
      solicitada: 'Delivery Note',
      armado_packing: 'Suministros',
      en_aduana: 'Aduanas',
      lista_para_envio: 'Logística',
      remitada: 'Remito Enviado',
      entregada: 'Entregada',
      cancelada: 'Cancelada',
    };
    return (
      <span className={`px-3 py-1.5 inline-flex text-xs leading-5 font-black uppercase tracking-wider rounded-lg ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString();
  };

  const calculateTotal = () => {
    if (!operation?.products) return 0;
    return operation.products.reduce((sum, p) => sum + (p.quantity * p.unit_price), 0);
  };

  const isOperario = user?.role === 'OPERARIO';
  const isOwner = user?.role === 'OWNER';

  if (loading) return <div className="flex justify-center mt-20"><LogoSpinner size="w-16 h-16" /></div>;
  if (error) return <div className="text-center text-red-600 mt-10 font-bold bg-red-50 p-4 rounded-xl max-w-lg mx-auto">{error}</div>;
  if (!operation) return <div className="text-center mt-10">No se encontró la operación</div>;

  // Obtener bandera del buque para mostrar en el select de país destino (si aplica)
  const shipFlag = operation.ship_flag || (operation.ship ? operation.ship.flag : '');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
      <nav className="bg-white dark:bg-slate-800 shadow-sm sticky top-0 z-40 border-b border-transparent dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/')} className="text-slate-400 hover:text-indigo-600 transition-colors p-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30">
                <i className="bi bi-arrow-left text-xl"></i>
              </button>

              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                    className="px-2 py-1 text-sm bg-white dark:bg-slate-700 border border-indigo-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-white w-64"
                    autoFocus
                  />
                  <button onClick={handleSaveName} className="text-emerald-600 hover:text-emerald-700 p-1"><i className="bi bi-check-lg"></i></button>
                  <button onClick={() => { setEditingName(false); setTempName(operation.nombre || ''); }} className="text-red-500 hover:text-red-600 p-1"><i className="bi bi-x-lg"></i></button>
                </div>
              ) : (
                <div className="flex flex-col justify-center group relative">
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                      {operation.nombre || `OP-${String(operation.id).padStart(4, '0')}`}
                    </h1>
                    <button onClick={() => setEditingName(true)} className="text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      <i className="bi bi-pencil-square"></i>
                    </button>
                  </div>
                  {operation.nombre && (
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold tracking-widest uppercase mt-[-2px]">
                      OP-{String(operation.id).padStart(4, '0')}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-400 hidden sm:block">Hola, {user?.username}</span>
              <button onClick={logout} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors" title="Cerrar sesión">
                <i className="bi bi-box-arrow-right text-lg"></i>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="py-8">
        {toastMessage && (
          <div className={`fixed top-20 right-4 z-50 px-4 py-3 rounded-xl shadow-lg border flex items-center gap-3 animate-fadeIn ${toastMessage.type === 'error' ? 'bg-red-50 text-red-800 border-red-200' :
            toastMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
              'bg-blue-50 text-blue-800 border-blue-200'
            }`}>
            <i className={`bi text-lg ${toastMessage.type === 'error' ? 'bi-x-circle-fill text-red-500' : toastMessage.type === 'success' ? 'bi-check-circle-fill text-emerald-500' : 'bi-info-circle-fill text-blue-500'}`}></i>
            <span className="font-bold text-sm tracking-tight">{toastMessage.message}</span>
          </div>
        )}

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* BANNER DE REVISIÓN */}
          {operation.estado_revision === 'pending' && (
            <div className="mb-6 bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl shadow-sm flex items-start gap-3">
              <i className="bi bi-clock-history text-amber-500 text-xl mt-0.5"></i>
              <div>
                <h4 className="text-amber-800 font-bold">Esta operación está en Revisión</h4>
                <p className="text-amber-700 text-sm">{isOwner ? 'El Operador ha solicitado revisión. Por favor verifica antes de continuar.' : 'Has solicitado una revisión. Funciones bloqueadas temporalmente.'}</p>
                {operation.mensaje_revision && (
                  <div className="mt-2 p-2 bg-white/60 rounded text-amber-900 text-xs shadow-sm italic">
                    "{operation.mensaje_revision}"
                  </div>
                )}
              </div>
            </div>
          )}

          {operation.estado_revision === 'rejected' && isOperador && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl shadow-sm flex items-start gap-3">
              <i className="bi bi-exclamation-octagon-fill text-red-500 text-xl mt-0.5"></i>
              <div>
                <h4 className="text-red-800 font-bold">Se requieren correcciones</h4>
                <p className="text-red-700 text-sm">El administrador ha rechazado tu solicitud previa.</p>
                {operation.mensaje_revision && (
                  <div className="mt-2 p-2 bg-white/60 rounded text-red-900 text-xs shadow-sm italic">
                    "{operation.mensaje_revision}"
                  </div>
                )}
              </div>
            </div>
          )}

          {operation.estado_revision === 'approved' && isOperador && (
            <div className="mb-6 bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-r-xl shadow-sm flex items-start gap-3">
              <i className="bi bi-shield-check text-emerald-500 text-xl mt-0.5"></i>
              <div>
                <h4 className="text-emerald-800 font-bold">Revisión Aprobada</h4>
                <p className="text-emerald-700 text-sm">El administrador dio el OK. Ahora puedes continuar la operación al siguiente nivel.</p>
                {operation.mensaje_revision && (
                  <div className="mt-2 p-2 bg-white/60 rounded text-emerald-900 text-xs shadow-sm italic">
                    "{operation.mensaje_revision}"
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

            <div className="lg:col-span-2 space-y-6">

              <div className="bg-white dark:bg-slate-800 shadow-sm overflow-hidden sm:rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="px-4 py-5 sm:px-6 flex justify-between items-center border-b border-slate-100 dark:border-slate-700">
                  <div>
                    <h3 className="text-lg leading-6 font-black text-slate-900 dark:text-white">Resumen Operativo</h3>
                    <p className="mt-1 max-w-2xl text-sm font-medium text-slate-500 dark:text-slate-400">Información logística y de tiempos</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {checkingStock && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>}
                    {statusBadge(operation.status || operation.estado)}
                  </div>
                </div>

                <div>
                  <dl className="grid grid-cols-1 sm:grid-cols-2">
                    <div className="px-4 py-4 sm:px-6 border-b sm:border-r border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
                      <dt className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Cliente</dt>
                      <dd className="text-sm font-semibold text-slate-900 dark:text-white">{operation.client_name}</dd>
                    </div>
                    <div className="px-4 py-4 sm:px-6 border-b border-slate-100 dark:border-slate-700">
                      <dt className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Buque</dt>
                      <dd className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <i className="bi bi-geo-alt-fill text-indigo-400"></i> {operation.ship_name}
                      </dd>
                    </div>
                    <div className="px-4 py-4 sm:px-6 border-b sm:border-r border-slate-100 dark:border-slate-700">
                      <dt className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Puerto</dt>
                      <dd className="text-sm font-semibold text-slate-900 dark:text-white">{operation.port_name}</dd>
                    </div>
                    <div className="px-4 py-4 sm:px-6 border-b border-slate-100 dark:border-slate-700 bg-indigo-50/30 dark:bg-indigo-900/20">
                      <dt className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">ETA (Arribo)</dt>
                      <dd className="text-sm font-black text-indigo-700 dark:text-indigo-400">{formatDate(operation.eta)}</dd>
                    </div>
                    <div className="px-4 py-4 sm:px-6 border-b sm:border-r border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
                      <dt className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Agencia / Entrega</dt>
                      <dd className="text-sm font-semibold text-slate-900 dark:text-white">
                        {operation.agency_name || 'Sin agencia'} • <span className="capitalize">{operation.delivery_method}</span>
                      </dd>
                    </div>
                    <div className="px-4 py-4 sm:px-6 border-b border-slate-100 dark:border-slate-700">
                      <dt className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Notas</dt>
                      <dd className="text-sm font-medium text-slate-600 dark:text-slate-300 line-clamp-2">{operation.notes || 'Sin anotaciones'}</dd>
                    </div>
                  </dl>

                  {isOwner && (
                    <div className="bg-slate-800 px-4 py-4 sm:px-6 text-white">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest flex items-center gap-2">
                        <i className="bi bi-people-fill"></i> Personal de Misión Asignado
                      </p>
                      <div className="flex gap-4 text-xs">
                        <span className="bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-600 font-bold">
                          Operadores (Oficina): {operation.operadores_id?.length || 0}
                        </span>
                        <span className="bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-600 font-bold">
                          Operarios (Planta): {operation.operarios_id?.length || 0}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 shadow-sm sm:rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                {!isOperario ? (
                  <>
                    <div className="px-4 py-5 sm:px-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg leading-6 font-black text-slate-900 dark:text-white flex items-center gap-2">
                          <i className="bi bi-box-seam text-indigo-500"></i> Detalle de Carga
                        </h3>
                        {(operation.status === 'pending' || operation.estado === 'solicitada' || operation.estado === 'armado_packing') && (
                          <button onClick={checkStock} disabled={checkingStock} className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 border border-indigo-100 bg-white">
                            {checkingStock ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-indigo-600"></div> : <i className="bi bi-arrow-repeat"></i>}
                            Verificar Stock
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead>
                          <tr className="bg-white dark:bg-slate-700 uppercase tracking-wider text-[10px] font-black text-slate-400 dark:text-slate-400">
                            <th className="px-6 py-4 text-left">Producto</th>
                            <th className="px-6 py-4 text-center">Cant.</th>
                            <th className="px-6 py-4 text-center">Disponibilidad</th>
                            <th className="px-6 py-4 text-right text-indigo-400">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700">
                          {operation.products?.map((prod, idx) => {
                            const isSuficiente = prod.suficiente !== undefined ? prod.suficiente : true;
                            return (
                              <tr key={idx} className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${!isSuficiente ? 'bg-red-50/50 dark:bg-red-900/20' : ''}`}>
                                <td className="px-6 py-4">
                                  <p className="text-sm font-bold text-slate-800 dark:text-white">{prod.product_name}</p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">${prod.unit_price} / unidad</p>
                                </td>
                                <td className="px-6 py-4 text-center text-sm text-slate-700 dark:text-slate-300 font-black">{prod.quantity}</td>
                                <td className="px-6 py-4 text-center">
                                  {prod.stock_actual >= prod.quantity ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black bg-emerald-50 text-emerald-600 border border-emerald-200 uppercase">
                                      <i className="bi bi-check-circle-fill"></i> OK ({prod.stock_actual?.toFixed(0)})
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black bg-red-50 text-red-600 border border-red-200 uppercase">
                                      <i className="bi bi-x-circle-fill"></i> Faltan ({prod.stock_actual?.toFixed(0) || '0'})
                                    </span>
                                  )}
                                </td>
                                <td className="px-6 py-4 text-right text-sm font-black text-indigo-700">
                                  ${(prod.quantity * prod.unit_price).toFixed(2)}
                                </td>
                              </tr>
                            );
                          })}
                          <tr className="bg-indigo-50/30 dark:bg-indigo-900/20">
                            <td colSpan="3" className="px-6 py-4 text-right text-xs font-black text-indigo-400 uppercase tracking-widest">Total Operación</td>
                            <td className="px-6 py-4 text-right text-xl font-black text-indigo-600 dark:text-indigo-400 tracking-tighter">${calculateTotal().toFixed(2)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {stockVerification && !stockVerification.todo_suficiente && (operation.status === 'pending' || operation.estado === 'solicitada' || operation.estado === 'armado_packing') && (
                      <div className="m-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                        <i className="bi bi-exclamation-triangle-fill text-red-500 text-lg mt-0.5"></i>
                        <div>
                          <h4 className="text-sm font-bold text-red-800">No se puede avanzar: Stock insuficiente</h4>
                          <ul className="mt-2 text-xs font-medium text-red-700 space-y-1">
                            {stockVerification.errores?.map((err, idx) => (
                              <li key={idx}>• {err.nombre}: Piden {err.necesario}, pero hay {err.disponible}.</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <OperarioActionPanel products={operation.products} />
                )}
              </div>

              {operation.texto_pedido && (
                <div className="bg-white dark:bg-slate-800 shadow-sm sm:rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden mb-6">
                  <div className="px-4 py-5 sm:px-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
                    <h3 className="text-lg leading-6 font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <i className="bi bi-chat-left-text-fill text-indigo-500"></i> Delivery Note Original
                    </h3>
                  </div>
                  <div className="p-4 sm:p-6 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-mono bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 overflow-x-auto">
                    {operation.texto_pedido}
                  </div>

                  {/* COMPONENTE DE TARJETAS DE BUSQUEDA INYECTADO AQUÍ */}
                  {(!isOperario) && (
                    <div className="px-4 py-4 sm:px-6 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                      <ProductSearchCards initialProducts={detectedProducts} />
                    </div>
                  )}
                </div>
              )}

              {/* NUEVO BLOQUE: Opciones para el Packing List */}
              <div className="bg-white dark:bg-slate-800 shadow-sm sm:rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="px-4 py-5 sm:px-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg leading-6 font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <i className="bi bi-file-earmark-spreadsheet-fill text-emerald-600"></i> Opciones del Packing List
                    </h3>
                  </div>
                </div>
                <div className="p-4 sm:p-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-2">PROVEEDOR</label>
                      <select
                        value={proveedor}
                        onChange={(e) => setProveedor(e.target.value)}
                        className="block w-full py-2 px-3 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
                      >
                        <option value="PROIOS SA">PROIOS SA (CUIT: 30-63661723-3)</option>
                        <option value="PROIOS SALVAGE SA">PROIOS SALVAGE SA (CUIT: 33-71087653-9)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-2">PAÍS DE DESTINO DE LA FACTURA</label>
                      <select
                        value={paisDestino}
                        onChange={(e) => setPaisDestino(e.target.value)}
                        className="block w-full py-2 px-3 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
                      >
                        <option value="argentina">Argentina (empresa argentina)</option>
                        <option value="bandera">Bandera del buque (cliente extranjero)</option>
                      </select>
                      <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                        {paisDestino === 'argentina' ? 'Se usará Argentina' : (shipFlag ? `Se usará la bandera: ${shipFlag}` : 'Bandera no especificada en el buque')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 shadow-sm sm:rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="px-4 py-5 sm:px-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
                  <h3 className="text-lg leading-6 font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <i className="bi bi-folder-fill text-indigo-500"></i> Documentación
                  </h3>
                </div>
                <div className="p-4 sm:p-6 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-700/50 shadow-sm hover:shadow-md transition-shadow gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-white">Packing List</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Listado detallado de mercadería para aduana y remito.</p>
                      {operation.packing_list_file && (
                        <button
                          onClick={() => openPreview(operation.packing_list_file)}
                          className="inline-flex mt-2 text-indigo-600 hover:text-indigo-800 text-xs font-bold items-center gap-1 bg-indigo-50 px-2 py-1 rounded"
                        >
                          <i className="bi bi-eye-fill"></i> Ver Documento
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap sm:flex-nowrap gap-2 shrink-0 w-full sm:w-auto">
                      <button
                        onClick={previewPackingListExcel}
                        className="flex-1 sm:flex-none justify-center px-3 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
                      >
                        <i className="bi bi-eye-fill"></i> Vista Previa
                      </button>
                      <button
                        onClick={downloadPackingListExcel}
                        className="flex-1 sm:flex-none justify-center px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
                      >
                        <i className="bi bi-file-earmark-spreadsheet"></i> Exportar
                      </button>
                      <label className={`flex-1 sm:flex-none justify-center cursor-pointer px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-indigo-600 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 shadow-sm ${uploading || (isOperador && operation.estado_revision === 'pending') ? 'opacity-50 pointer-events-none' : ''}`}>
                        <i className="bi bi-cloud-arrow-up-fill"></i> Subir
                        <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'upload_packing', '¿Subir packing list?')} disabled={uploading || (isOperador && operation.estado_revision === 'pending')} />
                      </label>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-700/50 shadow-sm hover:shadow-md transition-shadow gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-white">Remito Firmado</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Constancia de entrega sellada por la tripulación.</p>
                      {operation.remito_file && (
                        <button
                          onClick={() => openPreview(operation.remito_file)}
                          className="inline-flex mt-2 text-indigo-600 hover:text-indigo-800 text-xs font-bold items-center gap-1 bg-indigo-50 px-2 py-1 rounded"
                        >
                          <i className="bi bi-eye-fill"></i> Ver Documento
                        </button>
                      )}
                    </div>
                    <label className={`w-full sm:w-auto justify-center cursor-pointer px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-indigo-600 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 shadow-sm shrink-0 ${uploading || (isOperador && operation.estado_revision === 'pending') ? 'opacity-50 pointer-events-none' : ''}`}>
                      <i className="bi bi-cloud-arrow-up-fill"></i> Subir Remito
                      <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'upload_remito', '¿Subir remito firmado?')} disabled={uploading || (isOperador && operation.estado_revision === 'pending')} />
                    </label>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-700/50 shadow-sm hover:shadow-md transition-shadow gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-white">Rancho / Permiso Aduanero</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Autorización oficial de embarque de provisiones.</p>
                      {operation.rancho_file && (
                        <button
                          onClick={() => openPreview(operation.rancho_file)}
                          className="inline-flex mt-2 text-indigo-600 hover:text-indigo-800 text-xs font-bold items-center gap-1 bg-indigo-50 px-2 py-1 rounded"
                        >
                          <i className="bi bi-eye-fill"></i> Ver Documento
                        </button>
                      )}
                    </div>
                    <label className={`w-full sm:w-auto justify-center cursor-pointer px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-indigo-600 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 shadow-sm shrink-0 ${uploading || (isOperador && operation.estado_revision === 'pending') ? 'opacity-50 pointer-events-none' : ''}`}>
                      <i className="bi bi-cloud-arrow-up-fill"></i> Subir Rancho
                      <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'upload_rancho', '¿Subir documentación aduanera (rancho)?')} disabled={uploading || (isOperador && operation.estado_revision === 'pending')} />
                    </label>
                  </div>
                </div>
              </div>

              {/* INTEGRACIÓN DEL NUEVO COMPONENTE DE CORREOS */}
              <div className="mt-8 mb-8">
                <OperationEmails operacionId={id} />
              </div>

              <div className="bg-slate-800 shadow-lg sm:rounded-2xl overflow-hidden p-4 sm:p-6 mb-10 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-white w-full sm:w-auto text-center sm:text-left">
                  <h4 className="font-black text-lg">Controles Operativos</h4>
                  <p className="text-xs text-slate-400 font-medium">Avanza la operación a la siguiente fase.</p>
                </div>

                <div className="flex flex-col sm:flex-row flex-wrap gap-3 w-full sm:w-auto sm:justify-end">
                  {isOwner && operation.status !== 'closed' && operation.estado !== 'entregada' && operation.status !== 'cancelled' && operation.estado !== 'cancelada' && (
                    <button
                      onClick={() => handleAction('cancel_operation', '¿Cancelar esta operación? Se marcará como cancelada y el stock retenido (si lo hay) no regresará automáticamente en esta versión beta.')}
                      disabled={actionLoading}
                      className="w-full sm:w-auto px-4 py-2 border-2 border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      <i className="bi bi-x-octagon-fill"></i> Anular
                    </button>
                  )}
                  {isOwner && (
                    <button onClick={() => navigate(`/operations/${id}/edit`)} className="w-full sm:w-auto px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                      <i className="bi bi-pencil-fill"></i> Editar Info
                    </button>
                  )}

                  {/* BLOQUE DE FLUJO DE REVISIONES Y CORTES CONDICIONALES PARA OPERADORES */}
                  {isOperador && operation.estado_revision !== 'approved' && operation.estado_revision !== 'pending' && operation.estado !== 'entregada' && operation.estado !== 'cancelada' && (
                    <div className="w-full bg-slate-700/50 p-4 rounded-xl border border-slate-600 mt-2 sm:mt-0 sm:max-w-sm sm:ml-auto">
                      <h5 className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-2"><i className="bi bi-shield-check"></i> Solicitar Revisión</h5>
                      <textarea
                        value={mensajeRevision}
                        onChange={(e) => setMensajeRevision(e.target.value)}
                        placeholder="Nota o reporte para el administrador..."
                        className="w-full text-sm bg-slate-800 text-white border-slate-600 rounded-lg p-2 focus:ring-indigo-500 focus:border-indigo-500 mb-2"
                        rows="2"
                      />
                      <button
                        onClick={handleRequestReview}
                        disabled={revisionActionLoading}
                        className="w-full px-5 py-2.5 text-sm font-black rounded-lg shadow-lg bg-indigo-500 text-white hover:bg-indigo-400 transition-all font-bold"
                      >
                        {revisionActionLoading ? 'Enviando...' : 'Enviar a Revisión'}
                      </button>
                    </div>
                  )}

                  {isOwner && operation.estado_revision === 'pending' && (
                    <div className="w-full bg-amber-900/30 p-4 rounded-xl border border-amber-500/30 mt-2 sm:mt-0 sm:max-w-sm sm:ml-auto text-amber-100">
                      <h5 className="text-xs font-bold uppercase tracking-widest mb-2"><i className="bi bi-check-all"></i> Responder a Revisión</h5>
                      <textarea
                        value={mensajeRevision}
                        onChange={(e) => setMensajeRevision(e.target.value)}
                        placeholder="Escribe tu feedback de aprobación/rechazo..."
                        className="w-full text-sm bg-slate-800 text-white border-slate-600 rounded-lg p-2 focus:ring-amber-500 focus:border-amber-500 mb-2 placeholder-slate-400"
                        rows="2"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleResolveReview('reject')}
                          disabled={revisionActionLoading}
                          className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-lg transition-all"
                        >
                          Rechazar
                        </button>
                        <button
                          onClick={() => handleResolveReview('approve')}
                          disabled={revisionActionLoading}
                          className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-all"
                        >
                          Aprobar
                        </button>
                      </div>
                    </div>
                  )}

                  {(!isOperador || operation.estado_revision === 'approved') && operation.can_confirm && !isOperario && (
                    <button
                      onClick={() => handleAction('confirm_operation', '¿Declarar Delivery Note ingresado y pasar al estado de Armado de Packing List?')}
                      disabled={actionLoading}
                      className="w-full sm:w-auto px-5 py-2.5 bg-emerald-500 text-white hover:bg-emerald-400 font-black rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                      {actionLoading ? 'Procesando...' : <><i className="bi bi-box-seam"></i> Armar Packing List</>}
                    </button>
                  )}
                  {(!isOperador || operation.estado_revision === 'approved') && operation.can_send_to_customs && !isOperario && (
                    <button
                      onClick={() => handleAction('start_coordination', '¿Enviar Packing List a Aduanas? Esto consumirá el stock del inventario.')}
                      disabled={actionLoading || (stockVerification && !stockVerification.todo_suficiente)}
                      className={`w-full sm:w-auto px-5 py-2.5 text-sm font-black rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 ${(stockVerification && !stockVerification.todo_suficiente)
                        ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                        : 'bg-indigo-500 text-white hover:bg-indigo-400 hover:shadow-indigo-500/30'
                        }`}
                    >
                      {actionLoading ? 'Procesando...' : <><i className="bi bi-building-check"></i> Enviar a Aduanas</>}
                    </button>
                  )}
                  {(!isOperador || operation.estado_revision === 'approved') && operation.can_coordinate && !isOperario && (
                    <button onClick={() => handleAction('finalize_production', '¿Aduana dio el Rancho? Pasar a logística.')} disabled={actionLoading} className="w-full sm:w-auto px-5 py-2.5 bg-purple-500 hover:bg-purple-400 text-white text-sm font-black rounded-xl shadow-lg shadow-purple-500/30 transition-all text-center">
                      {actionLoading ? 'Procesando...' : 'Autorizar Logística'}
                    </button>
                  )}
                  {(!isOperador || operation.estado_revision === 'approved') && operation.can_deliver && !isOperario && (
                    <button onClick={() => handleAction('mark_delivered', '¿Emitir el remito de entrega final?')} disabled={actionLoading} className="w-full sm:w-auto px-5 py-2.5 bg-blue-500 hover:bg-blue-400 text-white text-sm font-black rounded-xl shadow-lg shadow-blue-500/30 transition-all text-center">
                      {actionLoading ? 'Procesando...' : 'Emitir Remito'}
                    </button>
                  )}
                  {(!isOperador || operation.estado_revision === 'approved') && operation.estado === 'remitada' && !isOperario && (
                    <button onClick={() => handleAction('close_operation', '¿Finalizar la orden por completo?')} disabled={actionLoading} className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-black rounded-xl shadow-lg transition-all text-center">
                      {actionLoading ? 'Procesando...' : 'Cerrar Operación'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-1 sticky top-24 self-start">
              <OperationTracker currentState={operation.status || operation.estado} />
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Packing List (vista previa HTML) */}
      {showPackingModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-center items-center p-2 sm:p-4 animate-fadeIn" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden my-auto border border-slate-200">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="text-lg leading-6 font-black text-slate-800 flex items-center gap-2">
                <i className="bi bi-file-earmark-text-fill text-indigo-500"></i> Packing List - #{packingData.operation_id}
              </h3>
              <button onClick={() => setShowPackingModal(false)} className="text-slate-400 hover:text-slate-600 bg-white border border-slate-200 rounded-lg p-1.5 shadow-sm"><i className="bi bi-x-lg"></i></button>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto w-full custom-scrollbar bg-white">
              <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cliente</p><p className="text-sm font-semibold text-slate-800 truncate">{packingData.client}</p></div>
                <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Buque</p><p className="text-sm font-semibold text-slate-800 truncate">{packingData.ship}</p></div>
                <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Puerto</p><p className="text-sm font-semibold text-slate-800 truncate">{packingData.port}</p></div>
                <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ETA</p><p className="text-sm font-semibold text-indigo-600">{new Date(packingData.eta).toLocaleString()}</p></div>
              </div>
              <div className="overflow-hidden border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr className="uppercase tracking-wider text-[10px] font-black text-slate-500">
                      <th className="px-4 py-3 text-left">Producto</th>
                      <th className="px-4 py-3 text-center">Cant.</th>
                      <th className="px-4 py-3 text-left">Pres.</th>
                      <th className="px-4 py-3 text-right">Peso Unit.</th>
                      <th className="px-4 py-3 text-right">Peso Total</th>
                      <th className="px-4 py-3 text-right">Precio Unit.</th>
                      <th className="px-4 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {packingData.products.map((prod, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm font-bold text-slate-800 whitespace-nowrap">{prod.name}</td>
                        <td className="px-4 py-3 text-sm text-center font-bold text-slate-600">{prod.quantity}</td>
                        <td className="px-4 py-3 text-xs font-medium text-slate-500 whitespace-nowrap">{prod.presentation}</td>
                        <td className="px-4 py-3 text-sm text-right text-slate-600 whitespace-nowrap">{prod.unit_weight} kg</td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-slate-800 whitespace-nowrap">{prod.total_weight} kg</td>
                        <td className="px-4 py-3 text-sm text-right text-slate-500 whitespace-nowrap">${prod.unit_price}</td>
                        <td className="px-4 py-3 text-sm text-right font-black text-indigo-700 whitespace-nowrap">${prod.subtotal}</td>
                      </tr>
                    ))}
                    <tr className="bg-indigo-50/50">
                      <td colSpan="4" className="px-4 py-4 text-right text-xs font-black text-indigo-400 uppercase tracking-widest">Totales de Carga</td>
                      <td className="px-4 py-4 text-right text-sm font-black text-indigo-800 whitespace-nowrap">{packingData.total_weight} kg</td>
                      <td></td>
                      <td className="px-4 py-4 text-right text-lg font-black text-indigo-700 whitespace-nowrap">${packingData.total_price.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="bg-slate-50 px-4 py-4 border-t border-slate-200 sm:px-6 sm:flex sm:flex-row-reverse shrink-0 gap-2">
              <button type="button" className="w-full sm:w-auto px-6 py-2 bg-indigo-600 text-white font-bold text-sm rounded-xl hover:bg-indigo-700 transition-colors shadow-sm flex justify-center items-center gap-2" onClick={() => window.print()}>
                <i className="bi bi-printer-fill"></i> Imprimir Documento
              </button>
              <button type="button" className="mt-3 sm:mt-0 w-full sm:w-auto px-6 py-2 bg-white text-slate-700 font-bold text-sm border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors shadow-sm flex justify-center items-center" onClick={() => setShowPackingModal(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para vista previa de Excel */}
      {showExcelModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex justify-center items-center p-2 sm:p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <i className="bi bi-file-earmark-spreadsheet-fill text-emerald-600"></i>
                Vista previa del Packing List (Excel)
              </h3>
              <button
                onClick={() => setShowExcelModal(false)}
                className="text-slate-400 hover:text-slate-600 bg-white rounded-lg p-1.5 border border-slate-200 shadow-sm"
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-white p-4">
              <div dangerouslySetInnerHTML={{ __html: excelPreviewHtml }} className="excel-preview" />
            </div>
            <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setShowExcelModal(false)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium text-sm"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para vista previa de PDF / Imagen / Otros */}
      {previewFile && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex justify-center items-center p-2 sm:p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <i className="bi bi-file-earmark-text-fill text-indigo-500"></i>
                Vista previa del documento
              </h3>
              <button
                onClick={() => setPreviewFile(null)}
                className="text-slate-400 hover:text-slate-600 bg-white rounded-lg p-1.5 border border-slate-200 shadow-sm"
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-slate-100 p-2 flex justify-center items-center">
              {previewFile.type === 'pdf' && (
                <iframe
                  src={previewFile.url}
                  className="w-full h-full min-h-[80vh] border-0 rounded-lg"
                  title="Vista previa PDF"
                />
              )}
              {previewFile.type === 'image' && (
                <img
                  src={previewFile.url}
                  alt="Vista previa"
                  className="max-w-full max-h-[85vh] object-contain shadow-lg rounded-lg"
                />
              )}
              {previewFile.type === 'excel' && (
                <div className="text-center p-8 bg-white rounded-xl shadow-md">
                  <i className="bi bi-file-earmark-spreadsheet text-5xl text-emerald-500 mb-3 block"></i>
                  <p className="text-slate-600">Para ver el contenido del Excel, usa el botón "Vista Previa" específico.</p>
                  <a
                    href={previewFile.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-block bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold"
                  >
                    Descargar archivo
                  </a>
                </div>
              )}
              {previewFile.type === 'unknown' && (
                <div className="text-center p-8 bg-white rounded-xl shadow-md">
                  <i className="bi bi-file-earmark-excel text-5xl text-amber-500 mb-3 block"></i>
                  <p className="text-slate-600">No se puede previsualizar este tipo de archivo.</p>
                  <a
                    href={previewFile.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-block bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold"
                  >
                    Descargar archivo
                  </a>
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 shrink-0">
              <a
                href={previewFile.url}
                download
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-100 font-medium text-sm"
              >
                <i className="bi bi-download me-1"></i> Descargar
              </a>
              <button
                onClick={() => setPreviewFile(null)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium text-sm"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out forwards; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 10px; }
        .excel-preview table { border-collapse: collapse; width: 100%; }
        .excel-preview th, .excel-preview td { border: 1px solid #ccc; padding: 8px; text-align: left; }
        .excel-preview th { background-color: #f2f2f2; font-weight: bold; }
        `,
      }} />
    </div>
  );
}