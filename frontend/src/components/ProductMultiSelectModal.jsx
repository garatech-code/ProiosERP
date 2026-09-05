import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from '../api/axios';
import LogoSpinner from './LogoSpinner';

export default function ProductMultiSelectModal({ isOpen, onClose, onAddProducts, existingProductIds = [], categoryFilter, onCreateNew }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState({}); // { productId: { quantity: 1 } }

  const pageSize = 10;

  // Obtener productos paginados (sin filtro de categoría)
  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page,
        page_size: pageSize,
        ...(search && { search }),
        ...(categoryFilter && { categoria: categoryFilter }),
        ordering: 'nombre',
      });
      const res = await axios.get(`/inventario/products/?${params}`);
      setProducts(res.data.results || []);
      setTotalCount(res.data.count || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setPage(1);
      fetchProducts();
    }
  }, [isOpen, page, search]);

  const handleSelectProduct = (productId, checked) => {
    if (checked) {
      setSelected(prev => ({ ...prev, [productId]: { quantity: 1 } }));
    } else {
      const newSelected = { ...selected };
      delete newSelected[productId];
      setSelected(newSelected);
    }
  };

  const handleQuantityChange = (productId, quantity) => {
    setSelected(prev => ({
      ...prev,
      [productId]: { ...prev[productId], quantity: parseInt(quantity) || 1 },
    }));
  };

  const handleAddSelected = () => {
    const selectedProducts = Object.entries(selected).map(([id, data]) => {
      const product = products.find(p => p.id === parseInt(id));
      if (!product) {
        console.error(`Producto con id ${id} no encontrado en la lista actual`);
        return null;
      }
      return {
        product: product.id,
        product_name: product.nombre,
        quantity: data.quantity,
        unit_price: parseFloat(product.precio_venta) || 0,
        stock_actual: product.stock_actual || 0,
        weight_kg: product.peso_kg || 0,
        presentation: product.presentacion || '',
      };
    }).filter(p => p !== null);

    console.log('Productos a agregar:', selectedProducts);
    onAddProducts(selectedProducts);
    onClose();
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[150] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b flex justify-between items-center bg-indigo-50 dark:bg-slate-700 rounded-t-2xl">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">Seleccionar productos</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-300">
            <i className="bi bi-x-lg text-xl"></i>
          </button>
        </div>

        <div className="p-4 border-b dark:border-slate-600 flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Buscar producto..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="flex-1 px-3 py-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-20"><LogoSpinner size="w-10 h-10" /></div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-600">
              <thead className="bg-gray-50 dark:bg-slate-700">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Selecc.</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Nombre</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Presentación</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Stock</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Cantidad a agregar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-600">
                {products.map(product => {
                  const isSelected = !!selected[product.id];
                  const isAlreadyInOperation = existingProductIds.includes(product.id);
                  return (
                    <tr key={product.id} className={isAlreadyInOperation ? 'bg-gray-100 dark:bg-slate-700/50' : ''}>
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isAlreadyInOperation}
                          onChange={(e) => handleSelectProduct(product.id, e.target.checked)}
                          className="w-4 h-4 text-indigo-600"
                        />
                      </td>
                      <td className="px-4 py-2 text-sm">{product.nombre}</td>
                      <td className="px-4 py-2 text-sm">{product.presentacion}</td>
                      <td className="px-4 py-2 text-sm font-semibold">{product.stock_actual}</td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={selected[product.id]?.quantity !== undefined ? String(selected[product.id].quantity).replace('.', ',') : '1'}
                          disabled={!isSelected || isAlreadyInOperation}
                          onChange={(e) => {
                            let val = e.target.value.replace(/[^0-9,.]/g, '').replace('.', ',');
                            // Allow only one comma
                            const parts = val.split(',');
                            if (parts.length > 2) val = parts[0] + ',' + parts.slice(1).join('');
                            handleQuantityChange(product.id, val);
                          }}
                          onBlur={(e) => {
                            let val = parseFloat(e.target.value.replace(',', '.'));
                            if (isNaN(val) || val <= 0) val = 1;
                            handleQuantityChange(product.id, val);
                          }}
                          className="w-20 px-2 py-1 border rounded text-center dark:bg-slate-600"
                        />
                      </td>
                    </tr>
                  );
                })}
                {products.length === 0 && (
                  <tr>
                    <td colSpan="5" className="text-center py-10 text-gray-500">
                      No se encontraron productos. 
                      {onCreateNew && (
                        <div className="mt-4">
                          <button
                            type="button"
                            onClick={onCreateNew}
                            className="text-sm font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 px-4 py-2 rounded-lg transition-colors"
                          >
                            + Crear producto nuevo
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className="p-4 border-t flex justify-between items-center bg-gray-50 dark:bg-slate-700 rounded-b-2xl">
          <div className="text-sm text-gray-600">
            {totalCount} productos | Página {page} de {totalPages}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
          <button
            onClick={handleAddSelected}
            disabled={Object.keys(selected).length === 0}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50"
          >
            Agregar {Object.keys(selected).length} producto(s)
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}