import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../api/axios';
import { useAuth } from '../context/AuthContext';
import OperationForm from '../components/OperationForm';

export default function OwnerDashboard() {
    const [operations, setOperations] = useState([]);
    const [filteredOps, setFilteredOps] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [statusFilter, setStatusFilter] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const { user, logout } = useAuth();
    const navigate = useNavigate();

    // Control del Modal Único
    const [showOperationForm, setShowOperationForm] = useState(false);

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
            setLoading(true);
            const res = await axios.get('/operations/operations/');
            setOperations(res.data);
            setError(null);
        } catch (err) {
            console.error(err);
            setError('Error al cargar las operaciones. Por favor, intente nuevamente.');
        } finally {
            setLoading(false);
        }
    };

    const cancelOperation = async (id, event) => {
        event.stopPropagation();
        if (!window.confirm('¿Está seguro de anular esta operación? Esta acción cambiará el estado a Cancelada.')) return;
        try {
            await axios.post(`/operations/operations/${id}/cancel_operation/`);
            fetchOperations();
        } catch (err) {
            console.error(err);
            alert('Error al intentar anular la operación.');
        }
    };

    const approveOperation = async (id, event) => {
        event.stopPropagation();
        if (!window.confirm('¿Autorizar esta operación para que pase a la siguiente fase?')) return;
        alert(`Operación ${id} aprobada.`);
    };

    const calculateTotal = (products) => {
        if (!products) return 0;
        return products.reduce((sum, p) => sum + (p.quantity * p.unit_price), 0);
    };

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

    /* =========================================================
       LÓGICA DEL SEMÁFORO DOCUMENTAL
    ========================================================= */
    const renderDocSemaphore = (label, fileUrl, opStatus) => {
        let statusConfig = {};

        if (fileUrl) {
            // 🟢 Verde: El archivo existe
            statusConfig = { dot: 'bg-emerald-500', box: 'bg-emerald-50 border-emerald-200 text-emerald-700', title: 'Completado' };
        } else {
            // Lógica para determinar si debería estar en proceso (Amarillo) o falta (Rojo)
            const inProgressStates = ['in_coordination', 'confirmed', 'delivered'];
            if (inProgressStates.includes(opStatus)) {
                // 🟡 Amarillo: No está, pero la operación está en curso
                statusConfig = { dot: 'bg-amber-400 animate-pulse', box: 'bg-amber-50 border-amber-200 text-amber-700', title: 'En Proceso / Pendiente' };
            } else {
                // 🔴 Rojo: No está, y la operación recién empieza o está frenada
                statusConfig = { dot: 'bg-red-500', box: 'bg-red-50 border-red-200 text-red-700', title: 'Faltante' };
            }
        }

        return (
            <div
                title={`${label}: ${statusConfig.title}`}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md border ${statusConfig.box} text-[10px] font-bold uppercase tracking-wider cursor-help transition-colors`}
            >
                <div className={`w-2 h-2 rounded-full shadow-sm ${statusConfig.dot}`}></div>
                {label}
            </div>
        );
    };

    const handleFormSuccess = (id) => {
        setShowOperationForm(false);
        fetchOperations();
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            {/* Header Sticky */}
            <nav className="bg-white shadow-sm sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-indigo-600 text-white rounded flex items-center justify-center font-bold text-lg shadow-sm">
                                P
                            </div>
                            <h1 className="text-xl font-bold text-gray-900 tracking-tight">ProIOS</h1>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex flex-col text-right">
                                <span className="text-sm font-semibold text-gray-900 leading-tight">{user?.username || 'Owner'}</span>
                                <span className="text-xs text-indigo-600 font-medium">Gerencia</span>
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
                        <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Panel de Gerencia</h2>

                        <button
                            onClick={() => setShowOperationForm(true)}
                            className="hidden sm:inline-flex items-center px-5 py-2.5 text-sm font-medium rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                            + Nueva Operación
                        </button>
                    </div>

                    {/* Filtros */}
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

                {loading && (
                    <div className="flex flex-col items-center justify-center py-20 space-y-4">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                        <p className="text-gray-500 font-medium">Sincronizando operaciones...</p>
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg shadow-sm mb-6">
                        <p className="text-red-700 font-medium">{error}</p>
                    </div>
                )}

                {!loading && !error && (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {filteredOps?.length === 0 ? (
                            <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-dashed border-gray-300">
                                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                                <h3 className="mt-2 text-sm font-medium text-gray-900">No hay operaciones</h3>
                                <p className="mt-1 text-sm text-gray-500">Comience creando una nueva operación.</p>
                            </div>
                        ) : (
                            filteredOps?.map((op) => (
                                <div
                                    key={op.id}
                                    className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md hover:border-indigo-300 transition-all flex flex-col group relative"
                                >
                                    <div className={`absolute top-0 left-0 w-1 h-full ${op.status === 'pendiente_aprobacion' ? 'bg-orange-400 animate-pulse' : op.status === 'closed' ? 'bg-gray-300' : 'bg-indigo-500'}`}></div>

                                    <div className="p-5 pl-6 flex-1 flex flex-col">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-xs font-bold text-gray-400">#OP-{String(op.id).padStart(4, '0')}</span>
                                                    {getStatusBadge(op.status)}
                                                </div>
                                                <h3 className="text-lg font-bold text-gray-900 leading-tight group-hover:text-indigo-600 transition-colors line-clamp-1">{op.ship_name || op.ship || 'Buque Desconocido'}</h3>
                                                <p className="text-sm font-medium text-gray-600">{op.client_name || op.client || 'Cliente N/D'}</p>
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

                                            {/* PANEL DE SEMÁFOROS DOCUMENTALES */}
                                            <div className="col-span-2 mt-1 pt-3 border-t border-slate-200/60">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Estado Documental</p>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    {renderDocSemaphore('Packing List', op.packing_list_file, op.status)}
                                                    {renderDocSemaphore('Remito', op.remito_file, op.status)}
                                                    {renderDocSemaphore('Rancho', op.rancho_file, op.status)}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-auto pt-3 border-t border-gray-100 flex justify-between items-center">
                                            <div className="flex flex-col">
                                                <span className="text-xs text-gray-400 font-medium">Valor Total</span>
                                                <span className="text-sm font-bold text-gray-900">${calculateTotal(op.products).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                            </div>

                                            <div className="flex gap-2 items-center">
                                                {op.status === 'pendiente_aprobacion' && (
                                                    <button onClick={(e) => approveOperation(op.id, e)} className="px-3 py-1.5 bg-orange-100 text-orange-700 hover:bg-orange-200 text-xs font-bold rounded-lg transition-colors shadow-sm">
                                                        Autorizar
                                                    </button>
                                                )}

                                                {op.status !== 'closed' && op.status !== 'cancelled' && (
                                                    <button onClick={(e) => cancelOperation(op.id, e)} className="px-3 py-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 text-xs font-semibold rounded-lg transition-colors">
                                                        Anular
                                                    </button>
                                                )}

                                                {op.status === 'cancelled' && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (window.confirm('¿ELIMINAR DEFINITIVAMENTE esta operación? No se puede deshacer.')) {
                                                                axios.delete(`/operations/operations/${op.id}/`)
                                                                    .then(() => fetchOperations())
                                                                    .catch(err => alert("Error al eliminar"));
                                                            }
                                                        }}
                                                        className="px-3 py-1.5 bg-red-100 text-red-700 hover:bg-red-200 text-xs font-bold rounded-lg transition-colors shadow-sm flex items-center gap-1"
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                                        Eliminar
                                                    </button>
                                                )}

                                                <button onClick={() => navigate(`/operations/${op.id}`)} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold rounded-lg transition-colors shadow-sm cursor-pointer">
                                                    Detalles
                                                </button>
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </main>

            {/* FAB Mobile */}
            <div className="sm:hidden fixed bottom-6 right-6 z-40">
                <button
                    onClick={() => setShowOperationForm(true)}
                    className="w-14 h-14 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-xl hover:bg-indigo-700 active:scale-95 transition-all focus:outline-none focus:ring-4 focus:ring-indigo-300"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                </button>
            </div>

            {/* Modal de Creación */}
            {showOperationForm && (
                <OperationForm
                    onClose={() => setShowOperationForm(false)}
                    onSuccess={handleFormSuccess}
                />
            )}

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