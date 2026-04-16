// src/components/OperationDetail.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from '../api/axios';
import { useAuth } from '../context/AuthContext';
import OperarioActionPanel from './OperarioActionPanel';
import OperationTracker from './OperationTracker'; // <-- IMPORTANTE: Nuestro nuevo componente

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
  const [packingData, setPackingData] = useState(null);
  const [loadingPacking, setLoadingPacking] = useState(false);

  const [stockVerification, setStockVerification] = useState(null);
  const [checkingStock, setCheckingStock] = useState(false);

  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (message, type = 'info') => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  useEffect(() => {
    fetchOperation();
  }, [id]);

  useEffect(() => {
    // Usamos op.estado o op.status (dependiendo de cómo lo manda tu backend)
    if (operation && (operation.status === 'pending' || operation.estado === 'solicitada')) {
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

  const fetchPackingData = async () => {
    setLoadingPacking(true);
    try {
      const res = await axios.get(`/operaciones/operations/${id}/packing_list_json/`);
      setPackingData(res.data);
      setShowPackingModal(true);
    } catch (err) {
      console.error(err);
      showToast('Error al cargar el packing list', 'error');
    } finally {
      setLoadingPacking(false);
    }
  };

  const handleAction = async (action, confirmMessage) => {
    if (action === 'confirm_operation') {
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
      const response = await axios.post(`/operaciones/operations/${id}/${action}/`);
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

  const statusBadge = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      solicitada: 'bg-yellow-100 text-yellow-800',
      price_checked: 'bg-blue-100 text-blue-800',
      presupuestada: 'bg-blue-100 text-blue-800',
      confirmed: 'bg-green-100 text-green-800',
      lista_para_envio: 'bg-green-100 text-green-800',
      in_coordination: 'bg-purple-100 text-purple-800',
      en_produccion: 'bg-purple-100 text-purple-800',
      delivered: 'bg-indigo-100 text-indigo-800',
      remitada: 'bg-indigo-100 text-indigo-800',
      closed: 'bg-gray-100 text-gray-800',
      entregada: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
      cancelada: 'bg-red-100 text-red-800',
    };
    const labels = {
      pending: 'Solicitada',
      solicitada: 'Solicitada',
      price_checked: 'Presupuestada',
      presupuestada: 'Presupuestada',
      confirmed: 'Lista para Envío',
      lista_para_envio: 'Lista para Envío',
      in_coordination: 'En Producción',
      en_produccion: 'En Producción',
      delivered: 'Remitada',
      remitada: 'Remitada',
      closed: 'Entregada',
      entregada: 'Entregada',
      cancelled: 'Cancelada',
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

  if (loading) return <div className="flex justify-center mt-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;
  if (error) return <div className="text-center text-red-600 mt-10 font-bold bg-red-50 p-4 rounded-xl max-w-lg mx-auto">{error}</div>;
  if (!operation) return <div className="text-center mt-10">No se encontró la operación</div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/')} className="text-slate-400 hover:text-indigo-600 transition-colors p-2 rounded-lg hover:bg-indigo-50">
                <i className="bi bi-arrow-left text-xl"></i>
              </button>
              <h1 className="text-xl font-black text-slate-800 tracking-tight">OP-{String(operation.id).padStart(4, '0')}</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm font-semibold text-slate-600 hidden sm:block">Hola, {user?.username}</span>
              <button onClick={logout} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors" title="Cerrar sesión">
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

          {/* LEYOUT DE PANTALLA DIVIDIDA: Grid 3 columnas (2 para detalles, 1 para Tracker) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

            {/* COLUMNA IZQUIERDA (Info Principal) */}
            <div className="lg:col-span-2 space-y-6">

              <div className="bg-white shadow-sm overflow-hidden sm:rounded-2xl border border-slate-200">
                <div className="px-4 py-5 sm:px-6 flex justify-between items-center border-b border-slate-100">
                  <div>
                    <h3 className="text-lg leading-6 font-black text-slate-900">Resumen Operativo</h3>
                    <p className="mt-1 max-w-2xl text-sm font-medium text-slate-500">Información logística y de tiempos</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {checkingStock && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>}
                    {statusBadge(operation.status || operation.estado)}
                  </div>
                </div>

                <div>
                  <dl className="grid grid-cols-1 sm:grid-cols-2">
                    <div className="px-4 py-4 sm:px-6 border-b sm:border-r border-slate-100 bg-slate-50/50">
                      <dt className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Cliente</dt>
                      <dd className="text-sm font-semibold text-slate-900">{operation.client_name}</dd>
                    </div>
                    <div className="px-4 py-4 sm:px-6 border-b border-slate-100">
                      <dt className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Buque</dt>
                      <dd className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                        <i className="bi bi-geo-alt-fill text-indigo-400"></i> {operation.ship_name}
                      </dd>
                    </div>
                    <div className="px-4 py-4 sm:px-6 border-b sm:border-r border-slate-100">
                      <dt className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Puerto</dt>
                      <dd className="text-sm font-semibold text-slate-900">{operation.port_name}</dd>
                    </div>
                    <div className="px-4 py-4 sm:px-6 border-b border-slate-100 bg-indigo-50/30">
                      <dt className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">ETA (Arribo)</dt>
                      <dd className="text-sm font-black text-indigo-700">{formatDate(operation.eta)}</dd>
                    </div>
                    <div className="px-4 py-4 sm:px-6 border-b sm:border-r border-slate-100 bg-slate-50/50">
                      <dt className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Agencia / Entrega</dt>
                      <dd className="text-sm font-semibold text-slate-900">
                        {operation.agency_name || 'Sin agencia'} • <span className="capitalize">{operation.delivery_method}</span>
                      </dd>
                    </div>
                    <div className="px-4 py-4 sm:px-6 border-b border-slate-100">
                      <dt className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Notas</dt>
                      <dd className="text-sm font-medium text-slate-600 line-clamp-2">{operation.notes || 'Sin anotaciones'}</dd>
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

              {/* PRODUCTOS */}
              <div className="bg-white shadow-sm sm:rounded-2xl border border-slate-200 overflow-hidden">
                {!isOperario ? (
                  <>
                    <div className="px-4 py-5 sm:px-6 border-b border-slate-100 bg-slate-50/50">
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg leading-6 font-black text-slate-900 flex items-center gap-2">
                          <i className="bi bi-box-seam text-indigo-500"></i> Detalle de Carga
                        </h3>
                        {(operation.status === 'pending' || operation.estado === 'solicitada') && (
                          <button onClick={checkStock} disabled={checkingStock} className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 border border-indigo-100 bg-white">
                            {checkingStock ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-indigo-600"></div> : <i className="bi bi-arrow-repeat"></i>}
                            Verificar Stock
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead>
                          <tr className="bg-white uppercase tracking-wider text-[10px] font-black text-slate-400">
                            <th className="px-6 py-4 text-left">Producto</th>
                            <th className="px-6 py-4 text-center">Cant.</th>
                            <th className="px-6 py-4 text-center">Disponibilidad</th>
                            <th className="px-6 py-4 text-right text-indigo-400">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                          {operation.products?.map((prod, idx) => {
                            const isSuficiente = prod.suficiente !== undefined ? prod.suficiente : true;
                            return (
                              <tr key={idx} className={`hover:bg-slate-50 transition-colors ${!isSuficiente ? 'bg-red-50/50' : ''}`}>
                                <td className="px-6 py-4">
                                  <p className="text-sm font-bold text-slate-800">{prod.product_name}</p>
                                  <p className="text-xs text-slate-500 font-medium">${prod.unit_price} / unidad</p>
                                </td>
                                <td className="px-6 py-4 text-center text-sm text-slate-700 font-black">{prod.quantity}</td>
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
                          <tr className="bg-indigo-50/30">
                            <td colSpan="3" className="px-6 py-4 text-right text-xs font-black text-indigo-400 uppercase tracking-widest">Total Operación</td>
                            <td className="px-6 py-4 text-right text-xl font-black text-indigo-600 tracking-tighter">${calculateTotal().toFixed(2)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {stockVerification && !stockVerification.todo_suficiente && (operation.status === 'pending' || operation.estado === 'solicitada') && (
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

              {/* DOCUMENTOS */}
              <div className="bg-white shadow-sm sm:rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-5 sm:px-6 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="text-lg leading-6 font-black text-slate-900 flex items-center gap-2">
                    <i className="bi bi-folder-fill text-indigo-500"></i> Documentación
                  </h3>
                </div>
                <div className="p-4 sm:p-6 space-y-3">
                  {/* Fila Documento */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-shadow gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Packing List</h4>
                      <p className="text-xs text-slate-500 mt-0.5">Listado detallado de mercadería para aduana y remito.</p>
                      {operation.packing_list_file && (
                        <a href={operation.packing_list_file} target="_blank" rel="noopener noreferrer" className="inline-flex mt-2 text-indigo-600 hover:text-indigo-800 text-xs font-bold items-center gap-1 bg-indigo-50 px-2 py-1 rounded">
                          <i className="bi bi-eye-fill"></i> Ver Documento
                        </a>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={fetchPackingData} disabled={loadingPacking} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-2">
                        <i className="bi bi-printer"></i> Imprimir
                      </button>
                      <label className={`cursor-pointer px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-indigo-600 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 shadow-sm ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                        <i className="bi bi-cloud-arrow-up-fill"></i> Subir
                        <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'upload_packing', '¿Subir packing list?')} disabled={uploading} />
                      </label>
                    </div>
                  </div>

                  {/* Fila Documento */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-shadow gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Remito Firmado</h4>
                      <p className="text-xs text-slate-500 mt-0.5">Constancia de entrega sellada por la tripulación.</p>
                      {operation.remito_file && (
                        <a href={operation.remito_file} target="_blank" rel="noopener noreferrer" className="inline-flex mt-2 text-indigo-600 hover:text-indigo-800 text-xs font-bold items-center gap-1 bg-indigo-50 px-2 py-1 rounded">
                          <i className="bi bi-eye-fill"></i> Ver Documento
                        </a>
                      )}
                    </div>
                    <label className={`cursor-pointer px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-indigo-600 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 shadow-sm shrink-0 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                      <i className="bi bi-cloud-arrow-up-fill"></i> Subir Remito
                      <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'upload_remito', '¿Subir remito firmado?')} disabled={uploading} />
                    </label>
                  </div>

                  {/* Fila Documento */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-shadow gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Rancho / Permiso Aduanero</h4>
                      <p className="text-xs text-slate-500 mt-0.5">Autorización oficial de embarque de provisiones.</p>
                      {operation.rancho_file && (
                        <a href={operation.rancho_file} target="_blank" rel="noopener noreferrer" className="inline-flex mt-2 text-indigo-600 hover:text-indigo-800 text-xs font-bold items-center gap-1 bg-indigo-50 px-2 py-1 rounded">
                          <i className="bi bi-eye-fill"></i> Ver Documento
                        </a>
                      )}
                    </div>
                    <label className={`cursor-pointer px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-indigo-600 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 shadow-sm shrink-0 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                      <i className="bi bi-cloud-arrow-up-fill"></i> Subir Rancho
                      <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'upload_rancho', '¿Subir documentación aduanera (rancho)?')} disabled={uploading} />
                    </label>
                  </div>
                </div>
              </div>

              {/* PANEL DE ACCIONES INFERIOR */}
              <div className="bg-slate-800 shadow-lg sm:rounded-2xl overflow-hidden p-4 sm:p-6 mt-8 mb-10 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-white w-full sm:w-auto">
                  <h4 className="font-black text-lg">Controles Operativos</h4>
                  <p className="text-xs text-slate-400 font-medium">Avanza la operación a la siguiente fase.</p>
                </div>

                <div className="flex flex-wrap gap-3 w-full sm:w-auto justify-end">
                  {isOwner && operation.status !== 'closed' && operation.estado !== 'entregada' && operation.status !== 'cancelled' && operation.estado !== 'cancelada' && (
                    <button
                      onClick={() => handleAction('cancel_operation', '¿Cancelar esta operación? Se marcará como cancelada y el stock retenido (si lo hay) no regresará automáticamente en esta versión beta.')}
                      disabled={actionLoading}
                      className="px-4 py-2 border-2 border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white text-sm font-bold rounded-xl transition-colors"
                    >
                      <i className="bi bi-x-octagon-fill mr-1"></i> Anular
                    </button>
                  )}
                  {isOwner && (
                    <button onClick={() => navigate(`/operations/${id}/edit`)} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-bold rounded-xl transition-colors">
                      <i className="bi bi-pencil-fill mr-1"></i> Editar Info
                    </button>
                  )}

                  {/* Botones de flujo */}
                  {operation.can_confirm && !isOperario && (
                    <button
                      onClick={() => handleAction('confirm_operation', '¿Aprobar y Confirmar la operación? Esto consumirá el stock del inventario.')}
                      disabled={actionLoading || (stockVerification && !stockVerification.todo_suficiente)}
                      className={`px-5 py-2.5 text-sm font-black rounded-xl shadow-lg transition-all ${(stockVerification && !stockVerification.todo_suficiente)
                        ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                        : 'bg-emerald-500 text-white hover:bg-emerald-400 hover:shadow-emerald-500/30'
                        }`}
                    >
                      {actionLoading ? 'Procesando...' : <><i className="bi bi-check-circle-fill mr-1"></i> Aprobar & Producir</>}
                    </button>
                  )}
                  {operation.can_coordinate && !isOperario && (
                    <button onClick={() => handleAction('start_coordination', '¿Notificar logística?')} disabled={actionLoading} className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-black rounded-xl shadow-lg shadow-indigo-500/30 transition-all">
                      {actionLoading ? 'Procesando...' : 'Coordinar Entrega'}
                    </button>
                  )}
                  {operation.can_deliver && !isOperario && (
                    <button onClick={() => handleAction('mark_delivered', '¿Finalizar operación?')} disabled={actionLoading} className="px-5 py-2.5 bg-purple-500 hover:bg-purple-400 text-white text-sm font-black rounded-xl shadow-lg shadow-purple-500/30 transition-all">
                      {actionLoading ? 'Procesando...' : 'Cerrar Operación'}
                    </button>
                  )}
                </div>
              </div>

            </div>

            {/* COLUMNA DERECHA (Tracker) */}
            <div className="lg:col-span-1 sticky top-24 self-start">
              <OperationTracker currentState={operation.status || operation.estado} />
            </div>

          </div>
        </div>
      </div>

      {/* Modal de Packing List (Mantenido intacto) */}
      {showPackingModal && packingData && (
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
              <div className="overflow-hidden border border-slate-200 rounded-xl shadow-sm">
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
                        <td className="px-4 py-3 text-sm font-bold text-slate-800">{prod.name}</td>
                        <td className="px-4 py-3 text-sm text-center font-bold text-slate-600">{prod.quantity}</td>
                        <td className="px-4 py-3 text-xs font-medium text-slate-500">{prod.presentation}</td>
                        <td className="px-4 py-3 text-sm text-right text-slate-600">{prod.unit_weight} kg</td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-slate-800">{prod.total_weight} kg</td>
                        <td className="px-4 py-3 text-sm text-right text-slate-500">${prod.unit_price}</td>
                        <td className="px-4 py-3 text-sm text-right font-black text-indigo-700">${prod.subtotal}</td>
                      </tr>
                    ))}
                    <tr className="bg-indigo-50/50">
                      <td colSpan="4" className="px-4 py-4 text-right text-xs font-black text-indigo-400 uppercase tracking-widest">Totales de Carga</td>
                      <td className="px-4 py-4 text-right text-sm font-black text-indigo-800">{packingData.total_weight} kg</td>
                      <td></td>
                      <td className="px-4 py-4 text-right text-lg font-black text-indigo-700">${packingData.total_price.toFixed(2)}</td>
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

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out forwards; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 10px; }
      `}} />
    </div>
  );
}