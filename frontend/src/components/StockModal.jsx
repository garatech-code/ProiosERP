import { useState, useEffect } from 'react';
import axios from '../api/axios';

export default function StockModal({ operationId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [stockData, setStockData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStock = async () => {
      try {
        const res = await axios.get(`/operaciones/operations/${operationId}/verificar_stock/`);
        setStockData(res.data);
        setError(null);
      } catch (err) {
        console.error('Error verificando stock:', err);
        setError(err.response?.data?.error || 'Error al verificar el stock');
      } finally {
        setLoading(false);
      }
    };
    fetchStock();
  }, [operationId]);

  const getStockStatusBadge = (suficiente) => {
    if (suficiente) {
      return (
        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 flex items-center gap-1 w-fit">
          <i className="bi bi-check-circle-fill"></i> Suficiente
        </span>
      );
    }
    return (
      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 dark:bg-red-900/30 text-red-800 flex items-center gap-1 w-fit">
        <i className="bi bi-exclamation-triangle-fill"></i> Insuficiente
      </span>
    );
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex justify-center items-center p-2 sm:p-4 animate-fadeIn"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[95vh] flex flex-col overflow-hidden my-auto">

        {/* HEADER */}
        <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-slate-50 dark:bg-slate-900/20 shrink-0">
          <h3 className="text-lg leading-6 font-bold text-gray-900 dark:text-white" id="modal-title">
            Verificación de Stock - Operación #{operationId}
          </h3>
        </div>

        {/* BODY */}
        <div className="p-4 sm:p-6 overflow-y-auto w-full">
          <div className="mt-2">

            {loading && (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-md">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            {!loading && !error && stockData && (
              <>
                {!stockData.todo_suficiente && (
                  <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-lg flex gap-2">
                    <i className="bi bi-exclamation-triangle-fill text-red-600 mt-0.5"></i>
                    <p className="text-red-800 text-sm font-medium">
                      Stock insuficiente para confirmar la operación.
                    </p>
                  </div>
                )}

                {stockData.detalles && stockData.detalles.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 dark:bg-slate-900/50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Producto
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Cantidad necesaria
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Stock actual
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Estado
                          </th>
                        </tr>
                      </thead>

                      <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200">
                        {stockData.detalles.map((item, idx) => (
                          <tr key={idx} className={!item.suficiente ? 'bg-red-50 dark:bg-red-900/20' : ''}>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                              {item.nombre}
                              {item.error && (
                                <span className="ml-2 text-xs text-red-600">
                                  {item.error}
                                </span>
                              )}
                            </td>

                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                              {item.cantidad_necesaria}
                            </td>

                            <td className="px-4 py-3 text-sm">
                              <span className={!item.suficiente ? 'text-red-600 font-bold' : 'text-gray-900 dark:text-white'}>
                                {item.stock_actual}
                              </span>
                            </td>

                            <td className="px-4 py-3">
                              {getStockStatusBadge(item.suficiente)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">
                    No hay productos en esta operación.
                  </p>
                )}
              </>
            )}

          </div>
        </div>

        {/* FOOTER */}
        <div className="bg-slate-50 dark:bg-slate-900/20 px-4 py-3 border-t border-gray-100 sm:px-6 sm:flex sm:flex-row-reverse shrink-0">
          <button
            type="button"
            className="mt-3 w-full inline-flex justify-center rounded-xl border border-gray-300 shadow-sm px-4 py-2 bg-white dark:bg-slate-800 text-base font-bold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm transition-colors"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}