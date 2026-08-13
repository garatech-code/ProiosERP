import { useState, useEffect, useCallback } from 'react';
import axios from '../api/axios';

export default function StockMovements() {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [productos, setProductos] = useState([]);
  const [selectedProducto, setSelectedProducto] = useState('');
  const [tipo, setTipo] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const pageSize = 20;

  const [productoSearch, setProductoSearch] = useState('');
  const [showProductoDropdown, setShowProductoDropdown] = useState(false);

  const fetchProductos = useCallback(async () => {
    try {
      const res = await axios.get('/inventario/products/', { params: { search: productoSearch, limit: 50 } });
      setProductos(res.data.results || res.data);
    } catch (err) {
      console.error('Error cargando productos', err);
    }
  }, [productoSearch]);

  useEffect(() => {
    fetchProductos();
  }, [fetchProductos]);

  const fetchMovimientos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        page_size: pageSize,
      };
      if (selectedProducto) params.articulo_id = selectedProducto;
      if (tipo) params.tipo = tipo;
      if (fechaDesde) params.fecha_desde = fechaDesde;
      if (fechaHasta) params.fecha_hasta = fechaHasta;

      const res = await axios.get('/inventario/products/movimientos/', { params });
      setMovements(res.data.results || res.data);
      // ✅ CORREGIDO: usar 'total' en lugar de 'count'
      setTotalPages(Math.ceil((res.data.total || 0) / pageSize));
      setTotalItems(res.data.total || 0);
    } catch (err) {
      console.error(err);
      setError('Error al cargar los movimientos de stock.');
    } finally {
      setLoading(false);
    }
  }, [page, selectedProducto, tipo, fechaDesde, fechaHasta]);

  useEffect(() => {
    setPage(1);
  }, [selectedProducto, tipo, fechaDesde, fechaHasta]);

  useEffect(() => {
    fetchMovimientos();
  }, [fetchMovimientos, page]);

  const exportData = async (format) => {
    try {
      const params = {
        export: format === 'excel' ? 'excel' : 'csv',
        page: 1,
        page_size: 10000,
      };
      if (selectedProducto) params.articulo_id = selectedProducto;
      if (tipo) params.tipo = tipo;
      if (fechaDesde) params.fecha_desde = fechaDesde;
      if (fechaHasta) params.fecha_hasta = fechaHasta;

      const res = await axios.get('/inventario/products/movimientos/', {
        params,
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      const extension = format === 'excel' ? 'xlsx' : 'csv';
      link.setAttribute('download', `movimientos_stock.${extension}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert(`Error al exportar a ${format.toUpperCase()}`);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getTipoBadge = (tipoMov) => {
    const styles = {
      INGRESO: 'bg-green-100 dark:bg-green-900/30 text-green-800',
      SALIDA: 'bg-red-100 dark:bg-red-900/30 text-red-800',
      AJUSTE: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${styles[tipoMov] || 'bg-gray-100 dark:bg-slate-800/50'}`}>
        {tipoMov}
      </span>
    );
  };

  return (
    <div className="animate-fadeIn space-y-6">
      {/* Filtros */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 sm:p-6">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Producto autocomplete */}
          <div className="flex-1 min-w-[180px] relative">
            <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Producto
            </label>
            <input
              type="text"
              placeholder="Buscar producto..."
              value={productoSearch}
              onChange={(e) => {
                setProductoSearch(e.target.value);
                setShowProductoDropdown(true);
              }}
              onFocus={() => setShowProductoDropdown(true)}
              className="w-full py-2 px-3 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 rounded-xl text-sm"
            />
            {showProductoDropdown && productos.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                {productos.map((prod) => (
                  <div
                    key={prod.id}
                    className="px-3 py-2 hover:bg-indigo-50 dark:bg-indigo-900/20 dark:hover:bg-slate-700 cursor-pointer text-sm"
                    onClick={() => {
                      setSelectedProducto(prod.id);
                      setProductoSearch(prod.nombre);
                      setShowProductoDropdown(false);
                    }}
                  >
                    {prod.nombre} (Cód: {prod.codigo})
                  </div>
                ))}
              </div>
            )}
            {selectedProducto && (
              <button
                onClick={() => {
                  setSelectedProducto('');
                  setProductoSearch('');
                }}
                className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* Tipo */}
          <div className="w-40">
            <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Tipo
            </label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="w-full py-2 px-3 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 rounded-xl text-sm"
            >
              <option value="">Todos</option>
              <option value="INGRESO">INGRESO</option>
              <option value="SALIDA">SALIDA</option>
              <option value="AJUSTE">AJUSTE</option>
            </select>
          </div>

          {/* Fechas */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Desde
            </label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="py-2 px-3 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 rounded-xl text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Hasta
            </label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="py-2 px-3 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 rounded-xl text-sm"
            />
          </div>

          {/* Botones exportación */}
          <div className="flex gap-2">
            <button
              onClick={() => exportData('excel')}
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-xl text-sm font-semibold flex items-center gap-1"
            >
              <i className="bi bi-file-excel"></i> Excel
            </button>
            <button
              onClick={() => exportData('csv')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-sm font-semibold flex items-center gap-1"
            >
              <i className="bi bi-filetype-csv"></i> CSV
            </button>
          </div>
        </div>
      </div>

      {/* Tabla de movimientos */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
            <thead className="bg-gray-50 dark:bg-slate-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Producto</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Usuario</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Cantidad</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Stock resultante</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Razón</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Operación ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center py-10">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="8" className="text-center py-10 text-red-500">{error}</td>
                </tr>
              ) : movements.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-10 text-gray-500">No hay movimientos para mostrar.</td>
                </tr>
              ) : (
                movements.map((mov) => (
                  <tr key={mov.id} className="hover:bg-gray-50 dark:bg-slate-900/50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3 text-sm">{new Date(mov.fecha).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm font-medium">{mov.articulo_nombre}</td>
                    <td className="px-4 py-3 text-sm">{mov.usuario_nombre}</td>
                    <td className="px-4 py-3 text-sm">{getTipoBadge(mov.tipo)}</td>
                    <td className="px-4 py-3 text-sm text-right font-mono">{mov.cantidad}</td>
                    <td className="px-4 py-3 text-sm text-right font-mono">{mov.stock_resultante}</td>
                    <td className="px-4 py-3 text-sm max-w-xs truncate">{mov.razon || '-'}</td>
                    <td className="px-4 py-3 text-sm">
                      {mov.operacion_id ? (
                        <a href={`/operations/${mov.operacion_id}`} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                          OP-{mov.operacion_id}
                        </a>
                      ) : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {!loading && totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-slate-700 flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-slate-400">
              Mostrando {movements.length} de {totalItems} movimientos
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded-lg border border-gray-300 dark:border-slate-600 disabled:opacity-50"
              >
                Anterior
              </button>
              <span className="px-3 py-1">Pág. {page} de {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 rounded-lg border border-gray-300 dark:border-slate-600 disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .print\\:visible, .print\\:visible * { visibility: visible; }
          .print\\:absolute { position: absolute; top: 0; left: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}