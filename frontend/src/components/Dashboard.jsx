import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../api/axios';
import { useAuth } from '../context/AuthContext';
import OperationFormProductos from './OperationFormProductos';
import OperationFormWithIMO from './OperationFormWithIMO';

export default function Dashboard() {
  const [operations, setOperations] = useState([]);
  const [filteredOps, setFilteredOps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Estados de la NUEVA versión para los formularios modales y el menú móvil
  const [showNormalForm, setShowNormalForm] = useState(false);
  const [showIMOForm, setShowIMOForm] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Mapeo amigable de roles (Versión vieja)
  const roleDisplay = {
    'OWNER': 'Gerencia',
    'OPERADOR': 'Operador',
    'CONTABLE': 'Contabilidad',
    'OPERARIO': 'Operaciones de Planta',
    'ADMIN': 'System Admin',
  };

  useEffect(() => {
    fetchOperations();
  }, []);

  useEffect(() => {
    let filtered = operations;
    if (statusFilter) {
      filtered = filtered.filter(op => op.status === statusFilter);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(op =>
        op.client_name?.toLowerCase().includes(term) ||
        op.ship_name?.toLowerCase().includes(term)
      );
    }
    setFilteredOps(filtered);
  }, [operations, statusFilter, searchTerm]);

  const fetchOperations = async () => {
    try {
      const res = await axios.get('/operaciones/operations/');
      setOperations(res.data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Error al cargar las operaciones.');
    } finally {
      setLoading(false);
    }
  };

  const cancelOperation = async (id, event) => {
    event.stopPropagation();
    if (!window.confirm('¿Cancelar esta operación? Se marcará como cancelada.')) return;
    try {
      await axios.post(`/operaciones/operations/${id}/cancel_operation/`);
      fetchOperations();
    } catch (err) {
      console.error(err);
      alert('Error al cancelar la operación');
    }
  };

  const approveOperation = async (id, event) => {
    event.stopPropagation();
    if (!window.confirm('¿Aprobar esta transición (Exclusivo Owner)?')) return;
    alert(`Operación ${id} aprobada.`);
  };

  // Badges estéticos de la VERSIÓN VIEJA
  const getStatusBadge = (status) => {
    const maps = {
      pending: { color: 'bg-yellow-100 text-yellow-800', label: 'Pendiente' },
      pendiente_aprobacion: { color: 'bg-orange-100 text-orange-800 border bg-orange-50 border-orange-200 animate-pulse', label: 'Requiere Aprobación' },
      price_checked: { color: 'bg-blue-100 text-blue-800', label: 'Verificado' },
      confirmed: { color: 'bg-green-100 text-green-800', label: 'Confirmada' },
      in_coordination: { color: 'bg-purple-100 text-purple-800', label: 'En proceso' },
      delivered: { color: 'bg-indigo-100 text-indigo-800', label: 'Entregada' },
      closed: { color: 'bg-gray-100 text-gray-800', label: 'Cerrada' },
      cancelled: { color: 'bg-red-100 text-red-800', label: 'Cancelada' },
    };
    const mapped = maps[status] || { color: 'bg-gray-100 text-gray-800', label: status };
    return (
      <span className={`px-2 py-1 inline-flex text-xs leading-4 font-semibold rounded-full ${mapped.color}`}>
        {mapped.label}
      </span>
    );
  };

  const calculateTotal = (products) => {
    if (!products) return 0;
    return products.reduce((sum, p) => sum + (p.quantity * p.unit_price), 0);
  };

  const isOwner = user?.role === 'OWNER';
  const isOperario = user?.role === 'OPERARIO';

  // Lógica de Modales de la NUEVA versión
  const closeForms = () => {
    setShowNormalForm(false);
    setShowIMOForm(false);
    setShowMobileMenu(false);
  };

  const handleSuccess = (id) => {
    closeForms();
    navigate(`/operations/${id}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header Sticky Mobile-First (Estética Vieja) */}
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 text-white rounded flex items-center justify-center font-bold text-lg shadow-sm">
                P
              </div>
              <h1 className="text-xl font-bold text-gray-900 hidden sm:block tracking-tight">ProIOS</h1>
              <h1 className="text-lg font-bold text-gray-900 sm:hidden tracking-tight">ProIOS</h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex flex-col text-right">
                <span className="text-sm font-semibold text-gray-900 leading-tight">{user?.username || 'Usuario'}</span>
                <span className="text-xs text-indigo-600 font-medium">{roleDisplay[user?.role] || user?.role}</span>
              </div>
              <button
                onClick={logout}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                title="Cerrar sesión"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24">

        {/* Top Controls Area */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex justify-between items-end">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Tablero Operativo</h2>

            {/* Botones Desktop integrados con la lógica de Modales */}
            {!isOperario && (
              <div className="hidden sm:flex items-center gap-3">
                <button
                  onClick={() => setShowNormalForm(true)}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 shadow-sm transition-all focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  + Sin IMO
                </button>
                <button
                  onClick={() => setShowIMOForm(true)}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  + Con IMO
                </button>
              </div>
            )}
          </div>

          {/* Filters - Scrollable on mobile (Estética Vieja) */}
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible sm:flex-wrap hide-scrollbar">
            <div className="relative flex-shrink-0 w-64 sm:w-auto sm:flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
              </div>
              <input
                type="text"
                placeholder="Buscar cliente, buque..."
                className="pl-10 block w-full py-2.5 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm shadow-sm transition"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <select
              className="flex-shrink-0 py-2.5 pl-3 pr-8 border border-gray-300 bg-white rounded-xl text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm shadow-sm appearance-none font-medium"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Status: Todos</option>
              <option value="pendiente_aprobacion">Requiere Aprobación</option>
              <option value="pending">Pendientes</option>
              <option value="confirmed">Confirmadas</option>
              <option value="in_coordination">En Proceso</option>
            </select>
          </div>
        </div>

        {/* Loading / Error States */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
            <p className="text-gray-500 font-medium">Sincronizando operaciones...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg shadow-sm">
            <p className="text-red-700 font-medium">{error}</p>
          </div>
        )}

        {/* Lista de Operaciones (Estética Vieja) */}
        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredOps?.length === 0 ? (
              <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-dashed border-gray-300">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No hay operaciones</h3>
                <p className="mt-1 text-sm text-gray-500">Crea una nueva operación para comenzar.</p>
              </div>
            ) : (
              filteredOps?.map((op) => (
                <div
                  key={op.id}
                  className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md hover:border-indigo-300 transition-all flex flex-col group relative"
                >
                  {/* Decorative indicator band */}
                  <div className={`absolute top-0 left-0 w-1 h-full ${op.status === 'pendiente_aprobacion' ? 'bg-orange-400 animate-pulse' : op.status === 'closed' ? 'bg-gray-300' : 'bg-indigo-500'}`}></div>

                  <div className="p-5 pl-6 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-gray-400">#OP-{String(op.id).padStart(4, '0')}</span>
                          {getStatusBadge(op.status)}
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 leading-tight group-hover:text-indigo-600 transition-colors line-clamp-1" title={op.nombre || 'Operación sin nombre'}>
                          {op.nombre || 'Operación sin nombre'}
                        </h3>
                        <p className="text-sm font-medium text-gray-600 flex flex-wrap items-center gap-1">
                          <span className="font-semibold text-gray-700">{op.ship_name || op.ship || 'Buque N/D'}</span>
                          <span className="text-gray-400 text-xs hidden sm:inline">|</span>
                          <span className="line-clamp-1">{op.client_name || op.client || 'Cliente N/D'}</span>
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm text-gray-600 mt-2 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div>
                        <p className="text-xs text-gray-400 font-medium mb-0.5">Puerto</p>
                        <p className="font-semibold text-gray-800 line-clamp-1">{op.port_name || op.port || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 font-medium mb-0.5">Método</p>
                        <p className="font-semibold text-gray-800 capitalize">{op.delivery_method || 'Muelle'}</p>
                      </div>
                      <div className="col-span-2 flex items-center gap-2 text-gray-500 text-xs">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        ETA: <span className="font-medium text-gray-700">{op.eta ? new Date(op.eta).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Sin fecha'}</span>
                      </div>
                    </div>

                    <div className="mt-auto pt-3 border-t border-gray-100 flex justify-between items-center">
                      <div className="flex flex-col">
                        {!isOperario ? (
                          <>
                            <span className="text-xs text-gray-400 font-medium">Valor Total</span>
                            <span className="text-sm font-bold text-gray-900">${calculateTotal(op.products).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </>
                        ) : (
                          <>
                            <span className="text-xs text-gray-400 font-medium">Items de Carga</span>
                            <span className="text-sm font-bold text-gray-900">{op.products?.length || 0} ítems</span>
                          </>
                        )}
                      </div>

                      {/* Botones de acción dentro de la tarjeta */}
                      <div className="flex gap-2">
                        {isOwner && op.status === 'pendiente_aprobacion' && (
                          <button
                            onClick={(e) => approveOperation(op.id, e)}
                            className="px-3 py-1.5 bg-orange-100 text-orange-700 hover:bg-orange-200 text-xs font-bold rounded-lg transition-colors shadow-sm"
                          >
                            Autorizar
                          </button>
                        )}

                        {!isOperario && op.status !== 'closed' && op.status !== 'cancelled' && (
                          <button
                            onClick={(e) => cancelOperation(op.id, e)}
                            className="px-3 py-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 text-xs font-semibold rounded-lg transition-colors"
                          >
                            Anular
                          </button>
                        )}

                        <button
                          onClick={() => navigate(`/operations/${op.id}`)}
                          className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold rounded-lg transition-colors shadow-sm cursor-pointer"
                        >
                          Ver Detalles
                        </button>

                        {isOperario && (
                          <button
                            onClick={() => navigate(`/operations/${op.id}`)}
                            className="p-2 bg-indigo-50 text-indigo-600 rounded-lg shrink-0 cursor-pointer hover:bg-indigo-100"
                            title="Ingresar a la orden operativa"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7"></path></svg>
                          </button>
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* FAB Mobile rediseñado con la lógica de menú de la NUEVA versión */}
      {!isOperario && (
        <div className="sm:hidden fixed bottom-6 right-6 z-40 flex flex-col items-end">
          {showMobileMenu && (
            <div className="flex flex-col gap-2 mb-3">
              <button
                onClick={() => { setShowNormalForm(true); setShowMobileMenu(false); }}
                className="px-5 py-2.5 bg-white text-gray-800 rounded-xl shadow-lg border border-gray-100 font-medium w-full text-right hover:bg-gray-50"
              >
                + Operación (Sin IMO)
              </button>
              <button
                onClick={() => { setShowIMOForm(true); setShowMobileMenu(false); }}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl shadow-lg font-medium w-full text-right hover:bg-indigo-700"
              >
                + Operación (Con IMO)
              </button>
            </div>
          )}
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="w-14 h-14 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-xl hover:bg-indigo-700 active:scale-95 transition-all focus:outline-none focus:ring-4 focus:ring-indigo-300"
          >
            {showMobileMenu ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
            )}
          </button>
        </div>
      )}

      {/* Modales integrados al final del archivo */}
      {showNormalForm && (
        <OperationFormProductos onClose={closeForms} onSuccess={handleSuccess} />
      )}

      {showIMOForm && (
        <OperationFormWithIMO onClose={closeForms} onSuccess={handleSuccess} />
      )}

      {/* Estilos adicionales para utilidades visuales */}
      <style dangerouslySetInnerHTML={{
        __html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
    </div>
  );
}