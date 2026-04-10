import { useState, useEffect } from 'react';
import axios from '../api/axios';

export default function OperadorDashboard() {
    const [operations, setOperations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Estados para el Modal de Documentos
    const [selectedOp, setSelectedOp] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [filesToUpload, setFilesToUpload] = useState({
        packing_list_file: null,
        remito_file: null,
        rancho_file: null
    });

    useEffect(() => {
        fetchMyOperations();
    }, []);

    const fetchMyOperations = async () => {
        try {
            const res = await axios.get('/operaciones/operations/');
            const data = res.data?.results || res.data;
            setOperations(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error(err);
            setError('Error al cargar tus operaciones asignadas.');
        } finally {
            setLoading(false);
        }
    };

    // --- Manejo de Archivos ---
    const openDocsModal = (op) => {
        setSelectedOp(op);
        setFilesToUpload({ packing_list_file: null, remito_file: null, rancho_file: null });
    };

    const handleFileChange = (e, fieldName) => {
        const file = e.target.files[0];
        setFilesToUpload(prev => ({ ...prev, [fieldName]: file || null }));
    };

    const handleUpload = async () => {
        if (!selectedOp) return;

        const formData = new FormData();
        let hasFiles = false;

        if (filesToUpload.packing_list_file) {
            formData.append('packing_list_file', filesToUpload.packing_list_file);
            hasFiles = true;
        }
        if (filesToUpload.remito_file) {
            formData.append('remito_file', filesToUpload.remito_file);
            hasFiles = true;
        }
        if (filesToUpload.rancho_file) {
            formData.append('rancho_file', filesToUpload.rancho_file);
            hasFiles = true;
        }

        if (!hasFiles) {
            alert("No has seleccionado ningún archivo nuevo para subir.");
            return;
        }

        setUploading(true);
        try {
            // Usamos PATCH para actualizar solo los archivos sin tocar el resto de la operación
            await axios.patch(`/operaciones/operations/${selectedOp.id}/`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            // Recargamos la lista para obtener las URLs de los archivos nuevos
            await fetchMyOperations();
            setSelectedOp(null); // Cerramos el modal
        } catch (err) {
            console.error(err);
            alert("Ocurrió un error al subir los documentos. Inténtalo de nuevo.");
        } finally {
            setUploading(false);
        }
    };

    // --- Funciones Auxiliares de UI ---
    const getStatusColor = (status) => {
        const colors = {
            pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
            price_checked: 'bg-amber-100 text-amber-800 border-amber-200',
            in_coordination: 'bg-blue-100 text-blue-800 border-blue-200',
            confirmed: 'bg-indigo-100 text-indigo-800 border-indigo-200',
            delivered: 'bg-emerald-100 text-emerald-800 border-emerald-200',
            closed: 'bg-slate-200 text-slate-800 border-slate-300',
            cancelled: 'bg-red-100 text-red-800 border-red-200'
        };
        return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
    };

    const getStatusLabel = (status) => {
        const labels = {
            pending: 'Solicitada',
            price_checked: 'Presupuestada',
            in_coordination: 'En Producción',
            confirmed: 'Lista p/ Envío',
            delivered: 'Remitada',
            closed: 'Entregada',
            cancelled: 'Cancelada'
        };
        return labels[status] || status;
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Sin ETA';
        return new Date(dateString).toLocaleDateString('es-AR', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-8 max-w-7xl mx-auto bg-slate-50 min-h-screen">
            <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-800">Mis Operaciones (Logística)</h1>
                    <p className="text-sm text-slate-500 mt-1">Gestión de entregas y documentación en muelle o lancha.</p>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r-lg shadow-sm">
                    <p className="text-sm text-red-700 font-medium">{error}</p>
                </div>
            )}

            {operations.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 text-center">
                    <div className="text-indigo-200 mb-4">
                        <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
                    </div>
                    <h3 className="text-lg font-bold text-slate-700">No tienes tareas pendientes</h3>
                    <p className="text-slate-500 text-sm mt-2 max-w-md mx-auto">Tu bandeja está limpia. Las operaciones asignadas a tu usuario aparecerán aquí automáticamente.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {/* Tarjetas de Operación Mobile-First */}
                    {operations.map(op => (
                        <div key={op.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
                            {/* Cabecera */}
                            <div className="p-5 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
                                <div className="pr-2">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">OP #{op.id}</span>
                                    <h3 className="text-lg font-bold text-slate-800 leading-tight mt-1 truncate" title={op.ship_name}>{op.ship_name || 'Buque TBD'}</h3>
                                    <p className="text-xs text-slate-500 font-medium mt-0.5 truncate" title={op.port_name}>{op.port_name || 'Puerto no asignado'}</p>
                                </div>
                                <span className={`px-3 py-1.5 text-xs font-bold rounded-full border whitespace-nowrap ${getStatusColor(op.status)}`}>
                                    {getStatusLabel(op.status)}
                                </span>
                            </div>

                            {/* Cuerpo */}
                            <div className="p-5 flex-1 space-y-4">
                                <div className="flex items-center gap-3 text-sm">
                                    <div className="p-1.5 bg-slate-100 rounded-lg text-slate-500">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                    </div>
                                    <span className="text-slate-600"><span className="font-bold text-slate-700">ETA:</span> {formatDate(op.eta)}</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm">
                                    <div className="p-1.5 bg-slate-100 rounded-lg text-slate-500">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                                    </div>
                                    <span className="text-slate-600"><span className="font-bold text-slate-700">Cliente:</span> {op.client_name || 'TBD'}</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm">
                                    <div className="p-1.5 bg-slate-100 rounded-lg text-slate-500">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                                    </div>
                                    <span className="text-slate-600"><span className="font-bold text-slate-700">Entrega:</span> <span className="capitalize">{op.delivery_method}</span></span>
                                </div>

                                {/* Indicadores de Archivos Subidos */}
                                <div className="pt-2 flex gap-2">
                                    {op.packing_list_file && <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-1 rounded border border-indigo-100">PACKING</span>}
                                    {op.remito_file && <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-2 py-1 rounded border border-emerald-100">REMITO</span>}
                                    {op.rancho_file && <span className="text-[10px] font-bold bg-amber-50 text-amber-600 px-2 py-1 rounded border border-amber-100">RANCHO</span>}
                                </div>
                            </div>

                            {/* Footer de Acciones */}
                            <div className="p-4 pt-0 mt-auto">
                                <button
                                    onClick={() => openDocsModal(op)}
                                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                                    Documentos & Remitos
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal de Carga de Documentos */}
            {selectedOp && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden my-auto">

                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">Gestionar Documentos</h2>
                                <p className="text-xs text-slate-500 font-medium mt-1">OP #{selectedOp.id} - {selectedOp.ship_name}</p>
                            </div>
                            <button onClick={() => setSelectedOp(null)} className="text-slate-400 hover:text-slate-600 bg-white hover:bg-slate-100 rounded-full p-2 transition-colors border border-slate-200">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Input: Packing List */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Packing List</label>
                                {selectedOp.packing_list_file && (
                                    <a href={selectedOp.packing_list_file} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 font-medium hover:underline mb-2 inline-flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                                        Ver documento actual
                                    </a>
                                )}
                                <input
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    onChange={(e) => handleFileChange(e, 'packing_list_file')}
                                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer border border-slate-200 rounded-xl"
                                />
                            </div>

                            {/* Input: Remito / Delivery Note */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Remito Firmado (Delivery Note)</label>
                                {selectedOp.remito_file && (
                                    <a href={selectedOp.remito_file} target="_blank" rel="noreferrer" className="text-xs text-emerald-600 font-medium hover:underline mb-2 inline-flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                                        Ver remito actual
                                    </a>
                                )}
                                <input
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    onChange={(e) => handleFileChange(e, 'remito_file')}
                                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer border border-slate-200 rounded-xl"
                                />
                            </div>

                            {/* Input: Rancho */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Declaración de Rancho</label>
                                {selectedOp.rancho_file && (
                                    <a href={selectedOp.rancho_file} target="_blank" rel="noreferrer" className="text-xs text-amber-600 font-medium hover:underline mb-2 inline-flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                                        Ver rancho actual
                                    </a>
                                )}
                                <input
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    onChange={(e) => handleFileChange(e, 'rancho_file')}
                                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100 cursor-pointer border border-slate-200 rounded-xl"
                                />
                            </div>
                        </div>

                        <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                            <button
                                onClick={() => setSelectedOp(null)}
                                className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleUpload}
                                disabled={uploading}
                                className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-70 flex items-center gap-2 transition-colors shadow-sm"
                            >
                                {uploading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                                {uploading ? 'Subiendo...' : 'Subir Documentos'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}