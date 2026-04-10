import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from '../api/axios';
import { useAuth } from '../context/AuthContext';
import OperarioActionPanel from './OperarioActionPanel';

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

  useEffect(() => {
    fetchOperation();
  }, [id]);

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

  const fetchPackingData = async () => {
    setLoadingPacking(true);
    try {
      const res = await axios.get(`/operaciones/operations/${id}/packing_list_json/`);
      setPackingData(res.data);
      setShowPackingModal(true);
    } catch (err) {
      console.error(err);
      alert('Error al cargar el packing list');
    } finally {
      setLoadingPacking(false);
    }
  };

  const handleAction = async (action, confirmMessage) => {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setActionLoading(true);
    try {
      await axios.post(`/operaciones/operations/${id}/${action}/`);
      fetchOperation();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Error al ejecutar la acción');
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
      alert('Error al subir archivo');
    } finally {
      setUploading(false);
    }
  };

  const statusBadge = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      price_checked: 'bg-blue-100 text-blue-800',
      confirmed: 'bg-green-100 text-green-800',
      in_coordination: 'bg-purple-100 text-purple-800',
      delivered: 'bg-indigo-100 text-indigo-800',
      closed: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    const labels = {
      pending: 'Pendiente',
      price_checked: 'Precio verificado',
      confirmed: 'Confirmada',
      in_coordination: 'En coordinación',
      delivered: 'Entregada',
      closed: 'Cerrada',
      cancelled: 'Cancelada',
    };
    return (
      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${colors[status]}`}>
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
  if (error) return <div className="text-center text-red-600 mt-10">{error}</div>;
  if (!operation) return <div className="text-center mt-10">No se encontró la operación</div>;

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">ProIOS - Operación #{operation.id}</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Hola, {user?.username}</span>
              <button onClick={logout} className="px-4 py-2 text-sm text-white bg-red-600 rounded-md hover:bg-red-700">
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="py-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-4">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-900"
            >
              ← Volver al dashboard
            </button>
          </div>

          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
              <div>
                <h3 className="text-lg leading-6 font-medium text-gray-900">Detalles de la operación</h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">Información completa y documentos</p>
              </div>
              {statusBadge(operation.status)}
            </div>

            <div className="border-t border-gray-200">
              <dl className="divide-y divide-gray-200">
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Cliente</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{operation.client_name}</dd>
                </div>
                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Buque</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{operation.ship_name}</dd>
                </div>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Puerto</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{operation.port_name}</dd>
                </div>
                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">ETA</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{formatDate(operation.eta)}</dd>
                </div>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Método de entrega</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {operation.delivery_method === 'muelle' ? 'Muelle' : 'Lancha'}
                  </dd>
                </div>
                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Agencia</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{operation.agency_name || 'No especificada'}</dd>
                </div>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Notas</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{operation.notes || '-'}</dd>
                </div>

                {/* Fechas clave */}
                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Pedido recibido</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{formatDate(operation.order_received_date)}</dd>
                </div>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Confirmación del cliente</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{formatDate(operation.client_confirmed_date)}</dd>
                </div>
                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Fecha de entrega</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{formatDate(operation.delivery_date)}</dd>
                </div>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Fecha de cierre</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{formatDate(operation.closed_date)}</dd>
                </div>
                {/* Personal Asignado (Solo Owner) */}
                {isOwner && (
                  <div className="bg-white px-4 py-4 sm:px-6 border-t border-gray-100 italic">
                    <p className="text-[10px] font-black text-gray-400 uppercase mb-2 text-center tracking-widest">Personal de Misión Asignado</p>
                    <div className="flex justify-around text-xs">
                      <span className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg border border-indigo-100 font-bold">Operadores: {operation.operadores_id?.length || 0}</span>
                      <span className="bg-purple-50 text-purple-700 px-3 py-1.5 rounded-lg border border-purple-100 font-bold">Operarios: {operation.operarios_id?.length || 0}</span>
                    </div>
                  </div>
                )}
              </dl>
            </div>

            {/* Productos / Vista Operario */}
            <div className="border-t border-gray-200">
              {!isOperario ? (
                <div className="px-4 py-5 sm:px-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 tracking-tight">Detalle de Productos</h3>
                  <div className="mt-4 flex flex-col">
                    <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                      <div className="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
                        <div className="shadow-sm overflow-hidden border border-gray-200 rounded-xl">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead>
                              <tr className="bg-slate-50 uppercase tracking-wider text-[10px] font-black text-slate-500">
                                <th className="px-6 py-4 text-left">Producto</th>
                                <th className="px-6 py-4 text-left">Cantidad</th>
                                <th className="px-6 py-4 text-left">Precio unitario</th>
                                <th className="px-6 py-4 text-left text-indigo-600">Total</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {operation.products?.map((prod, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50 transition">
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{prod.product_name}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">{prod.quantity}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${prod.unit_price}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-indigo-600">${(prod.quantity * prod.unit_price).toFixed(2)}</td>
                                </tr>
                              ))}
                              <tr className="bg-indigo-50/30">
                                <td colSpan="3" className="px-6 py-6 text-right text-sm font-black text-indigo-900 uppercase tracking-widest">Total general</td>
                                <td className="px-6 py-6 whitespace-nowrap text-xl font-black text-indigo-700 tracking-tighter">${calculateTotal().toFixed(2)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <OperarioActionPanel products={operation.products} />
              )}
            </div>

            {/* Documentos */}
            <div className="border-t border-gray-200">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Documentos</h3>
                <div className="mt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-gray-700">Packing List</span>
                      {operation.packing_list_file && (
                        <a href={operation.packing_list_file} target="_blank" rel="noopener noreferrer" className="ml-2 text-indigo-600 hover:text-indigo-900 text-sm">
                          Ver archivo
                        </a>
                      )}
                    </div>
                    <label className={`cursor-pointer bg-white py-2 px-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      Subir nuevo
                      <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'upload_packing', '¿Subir packing list?')} disabled={uploading} />
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-gray-700">Remito firmado</span>
                      {operation.remito_file && (
                        <a href={operation.remito_file} target="_blank" rel="noopener noreferrer" className="ml-2 text-indigo-600 hover:text-indigo-900 text-sm">
                          Ver archivo
                        </a>
                      )}
                    </div>
                    <label className={`cursor-pointer bg-white py-2 px-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      Subir remito
                      <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'upload_remito', '¿Subir remito firmado?')} disabled={uploading} />
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-gray-700">Rancho (Documentación Aduanera)</span>
                      {operation.rancho_file && (
                        <a href={operation.rancho_file} target="_blank" rel="noopener noreferrer" className="ml-2 text-indigo-600 hover:text-indigo-900 text-sm">
                          Ver archivo
                        </a>
                      )}
                    </div>
                    <label className={`cursor-pointer bg-white py-2 px-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      Subir rancho
                      <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'upload_rancho', '¿Subir documentación aduanera (rancho)?')} disabled={uploading} />
                    </label>
                  </div>
                  {/* Botón para ver/imprimir packing list */}
                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={fetchPackingData}
                      disabled={loadingPacking}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      📄 Ver / Imprimir Packing List
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Acciones */}
            <div className="border-t border-gray-200 px-4 py-5 sm:px-6 bg-slate-50">
              <div className="flex flex-wrap gap-4 justify-between items-center">
                <div className="flex gap-2">
                  {operation.can_confirm && !isOperario && (
                    <button
                      onClick={() => handleAction('confirm_operation', '¿Confirmar la operación? Esto marcará que el cliente confirmó.')}
                      disabled={actionLoading}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-bold rounded-xl shadow-sm text-white bg-green-600 hover:bg-green-700"
                    >
                      {actionLoading ? 'Procesando...' : 'Confirmar operación'}
                    </button>
                  )}
                  {operation.can_coordinate && !isOperario && (
                    <button
                      onClick={() => handleAction('start_coordination', '¿Iniciar coordinación? Esto marca que se contactará a la agencia.')}
                      disabled={actionLoading}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-bold rounded-xl shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                    >
                      {actionLoading ? 'Procesando...' : 'Iniciar coordinación'}
                    </button>
                  )}
                  {operation.can_deliver && !isOperario && (
                    <button
                      onClick={() => handleAction('mark_delivered', '¿Marcar como entregada? Asegúrate de tener el remito firmado.')}
                      disabled={actionLoading}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-bold rounded-xl shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                    >
                      {actionLoading ? 'Procesando...' : 'Marcar como entregada'}
                    </button>
                  )}
                </div>

                <div className="flex gap-2">
                  {isOwner && (
                    <button
                      onClick={() => navigate(`/operations/${id}/edit`)}
                      className="inline-flex items-center px-4 py-2 border-2 border-slate-200 text-sm font-bold rounded-xl shadow-sm text-slate-700 bg-white hover:bg-slate-50"
                    >
                      Configurar / Editar
                    </button>
                  )}

                  {isOwner && operation.status !== 'closed' && operation.status !== 'cancelled' && (
                    <button
                      onClick={() => handleAction('cancel_operation', '¿Cancelar esta operación? Se marcará como cancelada y no se podrá continuar.')}
                      disabled={actionLoading}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-bold rounded-xl shadow-sm text-white bg-red-500 hover:bg-red-600"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Packing List */}
      {showPackingModal && packingData && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setShowPackingModal(false)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                      Packing List - Operación #{packingData.operation_id}
                    </h3>
                    <div className="mt-2">
                      <div className="text-sm text-gray-500 mb-4">
                        <p><strong>Cliente:</strong> {packingData.client}</p>
                        <p><strong>Buque:</strong> {packingData.ship}</p>
                        <p><strong>Puerto:</strong> {packingData.port}</p>
                        <p><strong>ETA:</strong> {new Date(packingData.eta).toLocaleString()}</p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Presentación</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Peso unitario (kg)</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Peso total (kg)</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio unitario</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {packingData.products.map((prod, idx) => (
                              <tr key={idx}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{prod.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{prod.quantity}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{prod.presentation}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{prod.unit_weight}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{prod.total_weight}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${prod.unit_price}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${prod.subtotal}</td>
                              </tr>
                            ))}
                            <tr className="bg-gray-50">
                              <td colSpan="4" className="px-6 py-4 text-right text-sm font-medium text-gray-900">Totales</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{packingData.total_weight} kg</td>
                              <td></td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">${packingData.total_price.toFixed(2)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => window.print()}
                >
                  🖨️ Imprimir
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => setShowPackingModal(false)}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}