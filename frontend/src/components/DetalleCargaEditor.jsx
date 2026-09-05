import React, { useState, useEffect } from 'react';
import axios from '../api/axios';
import AutocompleteCreate from './AutocompleteCreate';
import ProductMultiSelectModal from './ProductMultiSelectModal';

function ProductRow({ product, index, onUpdate, onRemove, canEdit }) {
  const [selectedProduct, setSelectedProduct] = useState(
    product.product ? { id: product.product, stock_actual: product.stock_actual || 0 } : null
  );

  const handleProductSelect = (item) => {
    setSelectedProduct(item);
    let productValue = item?.id ? Number(item.id) : '';
    onUpdate(index, 'product', productValue);
    onUpdate(index, 'weight_kg', item?.peso_kg || item?.weight_kg || null);
    onUpdate(index, 'presentation', item?.presentacion || item?.presentation || '');
    onUpdate(index, 'stock_actual', item?.stock_actual || 0);
    onUpdate(index, 'unit_price', parseFloat(item?.precio_venta) || 0);
  };

  const cantidad = product.quantity !== undefined ? product.quantity : 1;
  const stockActual = product.stock_actual || 0;
  const isStockInsufficient = cantidad > stockActual;

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-12 gap-3 items-end p-4 rounded-xl border mb-3 relative group transition-colors ${isStockInsufficient ? 'bg-red-50 border-red-300' : 'bg-gray-50 dark:bg-slate-900/50 border-gray-100'}`}>
      <div className="sm:col-span-4">
        {canEdit ? (
          <AutocompleteCreate
            label="Producto *"
            endpoint="/inventario/products/"
            value={selectedProduct?.id || ''}
            onSelect={handleProductSelect}
            createFields={[
              { name: 'presentacion', label: 'Presentación', required: true },
              { name: 'peso_kg', label: 'Peso unitario (kg)', type: 'number', required: true },
              { name: 'precio_venta', label: 'Precio Unit. ($)', type: 'number', required: false },
            ]}
            extraCreateData={{ categoria: 'otros' }}
            nameField="nombre"
            placeholder="Buscar o crear..."
          />
        ) : (
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Producto</label>
            <div className="text-sm font-bold text-gray-900 dark:text-white p-2 border border-transparent">{product.product_name || `ID: ${product.product}`}</div>
          </div>
        )}
      </div>

      <div className="sm:col-span-1">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Peso (kg)</label>
        <input
          type="number"
          value={product.weight_kg !== null && product.weight_kg !== undefined ? Number(product.weight_kg).toFixed(2) : ''}
          disabled
          className="block w-full py-2 px-2 border border-gray-200 rounded-lg bg-gray-100 dark:bg-slate-800/50 text-gray-500 sm:text-sm text-center"
        />
      </div>

      <div className="sm:col-span-2">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Cantidad *</label>
        {canEdit ? (
          <input
            type="text"
            inputMode="decimal"
            value={String(cantidad).replace('.', ',')}
            onChange={(e) => {
              let val = e.target.value.replace(/[^0-9,.]/g, '').replace('.', ',');
              const parts = val.split(',');
              if (parts.length > 2) val = parts[0] + ',' + parts.slice(1).join('');
              onUpdate(index, 'quantity', val);
            }}
            onBlur={(e) => {
              let val = parseFloat(e.target.value.replace(',', '.'));
              if (isNaN(val) || val <= 0) val = 1;
              onUpdate(index, 'quantity', val);
            }}
            className={`block w-full py-2 px-3 border rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors dark:bg-slate-700 dark:text-white ${isStockInsufficient ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-300 dark:border-slate-600'}`}
          />
        ) : (
          <div className="text-sm font-bold text-gray-900 dark:text-white p-2 border border-transparent text-center">
            {Number(cantidad) % 1 === 0 ? Number(cantidad) : Number(cantidad).toLocaleString('es-AR', { maximumFractionDigits: 2 })}
          </div>
        )}
      </div>

      <div className="sm:col-span-1">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Stock</label>
        <div className="text-sm font-semibold text-gray-800 dark:text-slate-200 text-center py-2">{Number(stockActual || 0).toFixed(2)}</div>
      </div>

      <div className="sm:col-span-3">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Precio Unit. ($)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={product.unit_price || 0}
          onChange={(e) => onUpdate(index, 'unit_price', parseFloat(e.target.value) || 0)}
          disabled={!canEdit}
          className="block w-full py-2 px-3 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
      </div>

      {canEdit && (
        <div className="sm:col-span-1 flex justify-end">
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:bg-red-900/20 rounded-lg transition-colors"
            title="Eliminar ítem"
          >
            <i className="bi bi-trash-fill"></i>
          </button>
        </div>
      )}
    </div>
  );
}

export default function DetalleCargaEditor({ operationId, initialProducts, canEdit, onSaved }) {
  const [products, setProducts] = useState(initialProducts || []);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showMultiSelectModal, setShowMultiSelectModal] = useState(false);

  useEffect(() => {
    setProducts(initialProducts || []);
    setHasChanges(false);
  }, [initialProducts]);

  const addProductRow = () => {
    setProducts([...products, { product: '', quantity: 1, unit_price: 0, weight_kg: null, presentation: '' }]);
    setHasChanges(true);
  };

  const handleAddMultipleProducts = (selectedProducts) => {
    const newProds = [];
    Object.entries(selectedProducts).forEach(([productId, data]) => {
      const exists = products.find(p => p.product === productId || String(p.product) === String(productId));
      if (!exists) {
        newProds.push({
          product: productId,
          quantity: data.quantity || 1,
          unit_price: 0,
          weight_kg: null,
          presentation: ''
        });
      }
    });
    if (newProds.length > 0) {
      setProducts([...products, ...newProds]);
      setHasChanges(true);
    }
    setShowMultiSelectModal(false);
  };

  const updateProduct = (index, field, value) => {
    const newProds = [...products];
    newProds[index][field] = value;
    setProducts(newProds);
    setHasChanges(true);
  };

  const removeProduct = (index) => {
    const newProds = [...products];
    newProds.splice(index, 1);
    setProducts(newProds);
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!canEdit) return;
    
    // Validate
    if (products.some(p => !p.product)) {
      alert("Todos los items deben tener un producto seleccionado.");
      return;
    }

    setSaving(true);
    try {
      await axios.patch(`/operaciones/operations/${operationId}/`, {
        products: products.map(p => ({
          ...p,
          quantity: typeof p.quantity === 'string' ? parseFloat(p.quantity.replace(',', '.')) : p.quantity
        }))
      });
      setHasChanges(false);
      if (onSaved) onSaved();
    } catch (err) {
      console.error(err);
      alert("Error al guardar el detalle de carga.");
    } finally {
      setSaving(false);
    }
  };

  const total = products.reduce((acc, curr) => {
    const qty = typeof curr.quantity === 'string' ? parseFloat(curr.quantity.replace(',', '.')) : (curr.quantity || 0);
    return acc + (qty * parseFloat(curr.unit_price || 0));
  }, 0);

  return (
    <div className="w-full">
      {products.length === 0 ? (
        <div className="text-center py-6 text-sm text-slate-500">
          No hay elementos cargados.
        </div>
      ) : (
        <div className="space-y-1">
          {products.map((prod, idx) => (
            <ProductRow 
              key={idx} 
              index={idx} 
              product={prod} 
              onUpdate={updateProduct} 
              onRemove={removeProduct} 
              canEdit={canEdit}
            />
          ))}
        </div>
      )}

      {canEdit && (
        <div className="mt-4 flex flex-col sm:flex-row justify-between items-center gap-4 border-t border-slate-100 dark:border-slate-700 pt-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={addProductRow}
              className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
            >
              <i className="bi bi-plus-circle-fill"></i> Fila Manual
            </button>
            <button
              type="button"
              onClick={() => setShowMultiSelectModal(true)}
              className="px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
            >
              <i className="bi bi-ui-checks-grid"></i> Añadir items
            </button>
          </div>
          
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
              Total: <span className="text-indigo-600 text-lg">${total.toFixed(2)}</span>
            </div>
            {hasChanges && (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow transition-colors flex items-center gap-2"
              >
                {saving ? (
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                ) : (
                  <i className="bi bi-check-circle-fill"></i>
                )}
                Guardar Cambios de Carga
              </button>
            )}
          </div>
        </div>
      )}

      {showMultiSelectModal && (
        <ProductMultiSelectModal
          isOpen={showMultiSelectModal}
          onClose={() => setShowMultiSelectModal(false)}
          onAddProducts={handleAddMultipleProducts}
          onCreateNew={() => {
            setShowMultiSelectModal(false);
            addProductRow();
          }}
          existingProductIds={products.map(p => p.product).filter(id => id)}
        />
      )}
    </div>
  );
}
