import { useState, useEffect, useMemo } from 'react';
import axios from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import LogoSpinner from '../components/LogoSpinner';
import { format } from 'date-fns';
import es from 'date-fns/locale/es';

export default function OperarioDashboard() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [operaciones, setOperaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [completando, setCompletando] = useState({});
  const [subiendoRemito, setSubiendoRemito] = useState({});
  const [modalOperacionId, setModalOperacionId] = useState(null);
  const [remitoFile, setRemitoFile] = useState(null);
  const [productionOrders, setProductionOrders] = useState({});

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchOperaciones = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/operaciones/operations/');
      setOperaciones(res.data);
      setError(null);
      
      const ordersMap = {};
      for (const op of res.data) {
        try {
          const ordersRes = await axios.get(`/operaciones/operations/${op.id}/ordenes_produccion/`);
          const pendientes = ordersRes.data.filter(orden => !orden.completada);
          ordersMap[op.id] = pendientes;
        } catch (err) {
          console.error(`Error cargando órdenes para OP-${op.id}:`, err);
          ordersMap[op.id] = [];
        }
      }
      setProductionOrders(ordersMap);
    } catch (err) {
      console.error(err);
      setError('No se pudieron cargar las operaciones asignadas.');
      showToast('Error al cargar operaciones', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOperaciones();
  }, []);

  const handleCompletarOrden = async (ordenId) => {
    if (!window.confirm('¿Marcar esta orden como completada? Se consumirán los insumos y se sumará el stock del producto final.')) return;
    setCompletando(prev => ({ ...prev, [ordenId]: true }));
    try {
      await axios.post(`/produccion/ordenes/${ordenId}/completar/`);
      showToast('Producción completada exitosamente', 'success');
      fetchOperaciones();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.error || 'Error al completar producción';
      showToast(msg, 'error');
    } finally {
      setCompletando(prev => ({ ...prev, [ordenId]: false }));
    }
  };

  const openRemitoModal = (operacionId) => {
    setModalOperacionId(operacionId);
    setRemitoFile(null);
  };

  const handleRemitoUpload = async () => {
    if (!remitoFile) {
      showToast('Seleccione un archivo de remito', 'error');
      return;
    }
    if (!modalOperacionId) return;

    setSubiendoRemito(prev => ({ ...prev, [modalOperacionId]: true }));
    const formData = new FormData();
    formData.append('file', remitoFile);

    try {
      await axios.post(`/operaciones/operations/${modalOperacionId}/upload_remito/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      showToast('Remito subido correctamente', 'success');
      setModalOperacionId(null);
      fetchOperaciones();
    } catch (err) {
      console.error(err);
      showToast('Error al subir remito', 'error');
    } finally {
      setSubiendoRemito(prev => ({ ...prev, [modalOperacionId]: false }));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col md:flex-row font-sans overflow-hidden transition-colors duration-200">
      {/* Sidebar Desktop */}
      <aside className={`relative bg-slate-900 text-white flex-col hidden md:flex h-screen sticky top-0 shadow-xl z-20 transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20 items-center'}`}>
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute -right-3 top-8 bg-indigo-600 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-md hover:bg-indigo-500 transition-colors z-30"
          title={isSidebarOpen ? 'Colapsar menú' : 'Expandir menú'}
        >
          <i className={`bi ${isSidebarOpen ? 'bi-chevron-left' : 'bi-chevron-right'} text-[10px]`}></i>
        </button>

        <div className={`p-6 flex items-center border-b border-slate-800 ${isSidebarOpen ? 'gap-3' : 'justify-center'}`}>
          <div className="w-10 h-10 bg-indigo-500 rounded-xl flex shrink-0 items-center justify-center font-black text-xl shadow-lg">P</div>
          {isSidebarOpen && (
            <div className="animate-fadeIn">
              <h1 className="font-black text-xl tracking-tight leading-none text-white whitespace-nowrap">ProIOS</h1>
              <span className="text-[10px] uppercase text-indigo-300 font-bold tracking-widest block">Producción</span>
            </div>
          )}
        </div>

        <div className={`py-6 flex-1 space-y-1 ${isSidebarOpen ? 'px-4' : 'px-2 flex flex-col items-center'}`}>
          {isSidebarOpen && <p className="px-2 text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Principal</p>}
          <button
            title={!isSidebarOpen ? "Mis tareas" : ""}
            className={`flex items-center rounded-xl font-medium text-sm transition-all ${isSidebarOpen ? 'w-full gap-3 px-3 py-2.5' : 'w-12 h-12 justify-center'} bg-indigo-600 text-white shadow-md cursor-default`}
          >
            <i className="bi bi-clipboard-check text-lg shrink-0"></i>
            {isSidebarOpen && <span>Mis operaciones</span>}
          </button>
        </div>

        <div className={`border-t border-slate-800 bg-slate-900 flex ${isSidebarOpen ? 'p-4 flex-col' : 'p-2 py-4 flex-col items-center gap-4'}`}>
          <div className={`flex items-center gap-3 ${isSidebarOpen ? 'mb-4 px-2' : ''}`}>
            <div className="w-9 h-9 shrink-0 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-sm text-indigo-400">
              {user?.username?.[0]?.toUpperCase()}
            </div>
            {isSidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{user?.username}</p>
                <p className="text-xs text-slate-400 capitalize truncate">Operario</p>
              </div>
            )}
          </div>
          <button
            title={!isSidebarOpen ? "Salir" : ""}
            onClick={logout}
            className={`flex justify-center items-center gap-2 py-2.5 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-xl text-sm font-semibold transition-colors ${isSidebarOpen ? 'w-full' : 'w-10 h-10'}`}
          >
            <i className="bi bi-box-arrow-right text-lg"></i>
            {isSidebarOpen && <span>Salir</span>}
          </button>
        </div>
      </aside>

      {/* Navbar Mobile */}
      <div className="md:hidden bg-slate-900 text-white p-4 flex justify-between items-center sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center font-black">P</div>
          <h1 className="font-black text-lg">ProIOS</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleTheme} className="bg-indigo-900/80 text-indigo-300 p-2 rounded-lg">
            <i className={`bi ${theme === 'dark' ? 'bi-sun-fill' : 'bi-moon-stars-fill'}`}></i>
          </button>
        </div>
      </div>

      {/* Mobile Bottom Tabs */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700 z-30 flex justify-around p-2 pb-safe">
        <button className="flex flex-col items-center p-2 text-indigo-600">
          <i className="bi bi-clipboard-check text-xl"></i>
          <span className="text-[10px] mt-1 font-semibold">Operaciones</span>
        </button>
        <button onClick={logout} className="flex flex-col items-center p-2 text-gray-400">
          <i className="bi bi-box-arrow-right text-xl"></i>
          <span className="text-[10px] mt-1 font-semibold">Salir</span>
        </button>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 relative pb-16 md:pb-0 transition-colors duration-200">
        <header className="hidden md:flex bg-white dark:bg-slate-800 px-8 py-4 items-center justify-between border-b border-gray-200 dark:border-slate-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Mis operaciones asignadas</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400">Productos a entregar y órdenes de fabricación</p>
          </div>
          <button onClick={toggleTheme} className="p-2 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300">
            <i className={`bi ${theme === 'dark' ? 'bi-sun-fill' : 'bi-moon-stars-fill'} text-lg`}></i>
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-8 custom-scrollbar">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <LogoSpinner size="w-12 h-12" />
            </div>
          )}

          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg shadow-sm mb-6">
              <p className="text-red-700 font-medium">{error}</p>
              <button onClick={fetchOperaciones} className="mt-2 text-sm text-red-600 underline">Reintentar</button>
            </div>
          )}

          {!loading && !error && (
            <div className="space-y-6">
              {operaciones.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-8 text-center border border-gray-200 dark:border-slate-700">
                  <i className="bi bi-info-circle-fill text-blue-500 text-5xl mb-3 block"></i>
                  <h3 className="text-xl font-bold text-gray-800 dark:text-white">Sin operaciones asignadas</h3>
                  <p className="text-gray-500 dark:text-slate-400 mt-1">No estás asignado a ninguna operación. Contacta con el administrador.</p>
                </div>
              ) : (
                operaciones.map(op => {
                  const ordenes = productionOrders[op.id] || [];
                  const tieneRemito = !!op.remito_file;
                  const productos = op.products || [];
                  
                  return (
                    <div key={op.id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden transition-all hover:shadow-md">
                      {/* Cabecera de operación */}
                      <div className="bg-indigo-50 dark:bg-indigo-900/30 px-4 py-3 border-b border-indigo-100 dark:border-indigo-800">
                        <div className="flex justify-between items-start flex-wrap gap-2">
                          <div>
                            <h2 className="font-black text-gray-800 dark:text-white text-lg">
                              {op.nombre || `OP-${op.id}`}
                            </h2>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-slate-400 mt-1">
                              <span className="flex items-center gap-1"><i className="bi bi-geo-alt-fill"></i> {op.ship_name || 'Buque no asignado'}</span>
                              <span className="flex items-center gap-1"><i className="bi bi-pin-map-fill"></i> {op.port_name || 'Puerto no asignado'}</span>
                              {op.eta && (
                                <span className="flex items-center gap-1"><i className="bi bi-calendar-event"></i> ETA: {format(new Date(op.eta), "dd/MM/yy HH:mm", { locale: es })}</span>
                              )}
                            </div>
                          </div>
                          <span className="bg-indigo-200 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-200 text-xs font-bold px-3 py-1 rounded-full">
                            {op.estado || 'En proceso'}
                          </span>
                        </div>
                      </div>

                      {/* Sección: Productos de la operación (ventas) */}
                      <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700">
                        <h3 className="text-sm font-bold text-gray-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                          <i className="bi bi-box-seam text-indigo-500"></i> Productos a entregar
                        </h3>
                        {productos.length === 0 ? (
                          <p className="text-sm text-gray-500 dark:text-slate-400 italic">No hay productos registrados en esta operación.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                              <thead className="bg-gray-50 dark:bg-slate-700/50">
                                <tr>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-slate-400">Producto</th>
                                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-slate-400">Cantidad</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-slate-400">Presentación</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                                {productos.map((prod, idx) => (
                                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                                    <td className="px-3 py-2 font-medium text-gray-800 dark:text-white">{prod.product_name}</td>
                                    <td className="px-3 py-2 text-center text-gray-700 dark:text-slate-300">{prod.quantity}</td>
                                    <td className="px-3 py-2 text-gray-600 dark:text-slate-400">{prod.presentation || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* Sección: Órdenes de fabricación (si las hay) */}
                      {ordenes.length > 0 && (
                        <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700">
                          <h3 className="text-sm font-bold text-gray-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                            <i className="bi bi-gear-fill text-emerald-500"></i> Órdenes de fabricación pendientes
                          </h3>
                          <div className="divide-y divide-gray-100 dark:divide-slate-700">
                            {ordenes.map(tarea => (
                              <div key={tarea.id} className="py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div>
                                  <p className="font-medium text-gray-800 dark:text-white">{tarea.articulo_final_nombre}</p>
                                  <p className="text-xs text-gray-500 dark:text-slate-400">
                                    Cantidad: {parseFloat(tarea.cantidad_a_producir).toFixed(2)} • Fórmula: {tarea.formula_nombre}
                                  </p>
                                </div>
                                <button
                                  onClick={() => handleCompletarOrden(tarea.id)}
                                  disabled={completando[tarea.id]}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-1.5 px-3 rounded-lg transition flex items-center gap-1 disabled:opacity-50"
                                >
                                  {completando[tarea.id] ? (
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                  ) : (
                                    <><i className="bi bi-check-lg"></i> Completar producción</>
                                  )}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Sección: Remito */}
                      <div className="bg-gray-50 dark:bg-slate-800/50 px-4 py-3 border-t border-gray-200 dark:border-slate-700 flex justify-between items-center">
                        <span className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1">
                          <i className="bi bi-file-earmark-text"></i> Remito
                        </span>
                        {tieneRemito ? (
                          <span className="text-xs font-bold text-green-600 dark:text-green-400 flex items-center gap-1">
                            <i className="bi bi-check-circle-fill"></i> Ya subido
                          </span>
                        ) : (
                          <button
                            onClick={() => openRemitoModal(op.id)}
                            className="bg-white dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200 text-sm font-bold py-2 px-4 rounded-xl shadow-sm transition flex items-center gap-2"
                          >
                            <i className="bi bi-cloud-arrow-up"></i> Subir remito
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </main>

      {/* Modal para subir remito */}
      {modalOperacionId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center sm:items-center animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl animate-slideUp">
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-slate-700">
              <h3 className="font-bold text-gray-800 dark:text-white">Subir remito firmado</h3>
              <button onClick={() => setModalOperacionId(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <i className="bi bi-x-lg text-xl"></i>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-xl p-6 text-center bg-gray-50 dark:bg-slate-700/30">
                <input
                  type="file"
                  id="remitoFileModal"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setRemitoFile(e.target.files[0])}
                />
                <label htmlFor="remitoFileModal" className="cursor-pointer flex flex-col items-center gap-2">
                  <i className="bi bi-cloud-upload text-4xl text-indigo-400"></i>
                  <span className="text-sm font-medium text-gray-600 dark:text-slate-300">
                    {remitoFile ? remitoFile.name : 'Toca para seleccionar archivo (PDF o imagen)'}
                  </span>
                </label>
              </div>
              <button
                onClick={handleRemitoUpload}
                disabled={!remitoFile || subiendoRemito[modalOperacionId]}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {subiendoRemito[modalOperacionId] ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <><i className="bi bi-check-lg"></i> Subir remito</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
          @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
          .animate-slideUp { animation: slideUp 0.3s ease-out; }
          .custom-scrollbar::-webkit-scrollbar { width: 8px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 20px; border: 2px solid #f8fafc; }
          .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
        `
      }} />
    </div>
  );
}