import { useState, useEffect } from 'react';
import axios from '../api/axios';
import AutocompleteCreate from './AutocompleteCreate';
import { useAuth } from '../context/AuthContext'; // Asegúrate de tener este import si usas currentUser

// Componente para una fila de producto
function ProductRow({ product, index, onUpdate, onRemove }) {
  const [selectedProduct, setSelectedProduct] = useState(product.product ? { id: product.product } : null);

  const handleProductSelect = (item) => {
    setSelectedProduct(item);

    // 👇 Escudo 1: Extraemos el ID o el Nombre de forma ultra segura
    const productValue = item ? (item.id || item.name || item.inputValue || '') : '';

    onUpdate(index, 'product', productValue);
    onUpdate(index, 'weight_kg', item ? item.weight_kg : null);
    onUpdate(index, 'presentation', item ? item.presentation : '');
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end border-b border-gray-100 pb-4 mb-2 bg-gray-50 p-4 rounded-xl">
      <div className="sm:col-span-5">
        <AutocompleteCreate
          label="Producto *"
          endpoint="/operations/products/"
          value={selectedProduct?.id || ''}
          onSelect={handleProductSelect}
          createFields={[
            { name: 'presentation', label: 'Presentación', required: true },
            { name: 'weight_kg', label: 'Peso unitario (kg)', type: 'number', required: true },
          ]}
          placeholder="Buscar o crear producto..."
        />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">Peso unitario (kg)</label>
        <input
          type="number"
          value={product.weight_kg || ''}
          disabled
          className="block w-full py-2 px-3 border border-gray-200 rounded-md bg-gray-100 text-gray-500 sm:text-sm"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad *</label>
        <input
          type="number"
          min="1"
          value={product.quantity}
          onChange={(e) => onUpdate(index, 'quantity', parseInt(e.target.value) || 0)}
          className="block w-full py-2 px-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">Precio Unit. ($)</label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={product.unit_price}
          onChange={(e) => onUpdate(index, 'unit_price', parseFloat(e.target.value) || 0)}
          className="block w-full py-2 px-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
      </div>
      <div className="sm:col-span-1 flex justify-end pb-1">
        <button type="button" onClick={() => onRemove(index)} className="p-2 text-red-500 hover:bg-red-50 hover:text-red-700 rounded-md transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
        </button>
      </div>
    </div>
  );
}

export default function OperationFormWithIMO({ id, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    client: '',
    ship: '',
    port: '',
    agency: '',
    eta: '',
    delivery_method: 'muelle',
    notes: '',
    products: [],
    delivery_date: '',
    closed_date: '',
    order_received_date: '',
    client_confirmed_date: '',
    operadores_id: [],
    operarios_id: []
  });

  const [fetchingData, setFetchingData] = useState(true);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [deletingFile, setDeletingFile] = useState(false);
  const [existingFiles, setExistingFiles] = useState({
    packing_list_file: null,
    remito_file: null,
    rancho_file: null,
  });

  const [imoInput, setImoInput] = useState('');
  const [autoCompleting, setAutoCompleting] = useState(false);
  const [autoCompleteFlag, setAutoCompleteFlag] = useState('');

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        if (id) {
          const opRes = await axios.get(`/operations/operations/${id}/`);
          const operation = opRes.data;

          const formatToDatetimeLocal = (isoString) => {
            if (!isoString) return '';
            try {
              const date = new Date(isoString);
              return isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 16);
            } catch { return ''; }
          };

          operation.eta = formatToDatetimeLocal(operation.eta);
          operation.delivery_date = formatToDatetimeLocal(operation.delivery_date);
          operation.closed_date = formatToDatetimeLocal(operation.closed_date);
          operation.order_received_date = formatToDatetimeLocal(operation.order_received_date);
          operation.client_confirmed_date = formatToDatetimeLocal(operation.client_confirmed_date);

          setFormData(operation);
          setExistingFiles({
            packing_list_file: operation.packing_list_file,
            remito_file: operation.remito_file,
            rancho_file: operation.rancho_file,
          });

          if (operation.ship) {
            try {
              const shipRes = await axios.get(`/operations/ships/${operation.ship}/`);
              if (shipRes.data.imo) setImoInput(shipRes.data.imo);
              if (shipRes.data.flag) setAutoCompleteFlag(shipRes.data.flag);
            } catch (err) { console.error("Error al obtener datos del buque:", err); }
          }
        }
      } catch (err) {
        console.error(err);
        setError('Error cargando datos iniciales.');
      } finally {
        setFetchingData(false);
      }
    };
    loadInitialData();
  }, [id]);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleProductUpdate = (index, field, value) => {
    setFormData(prev => {
      const newProducts = [...prev.products];
      newProducts[index] = { ...newProducts[index], [field]: value };
      return { ...prev, products: newProducts };
    });
  };

  const addProduct = () => {
    setFormData(prev => ({
      ...prev,
      products: [...prev.products, { product: '', quantity: 1, unit_price: 0 }],
    }));
  };

  const removeProduct = (index) => {
    setFormData(prev => ({
      ...prev,
      products: prev.products.filter((_, i) => i !== index)
    }));
  };

  const handleFileUpload = async (event, type) => {
    const file = event.target.files[0];
    if (!file) return;
    setUploading(true);
    const formDataFile = new FormData();
    formDataFile.append('file', file);
    try {
      await axios.patch(`/operations/operations/${id}/`, formDataFile, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const res = await axios.get(`/operations/operations/${id}/`);
      const operation = res.data;
      setExistingFiles({
        packing_list_file: operation.packing_list_file,
        remito_file: operation.remito_file,
        rancho_file: operation.rancho_file,
      });
    } catch (err) {
      console.error(err);
      alert('Error al subir archivo');
    } finally {
      setUploading(false);
    }
  };

  const handleFileDelete = async (fileType) => {
    if (!window.confirm(`¿Eliminar ${fileType}?`)) return;
    setDeletingFile(true);
    try {
      // Usamos el patch para enviar null al archivo
      const data = {};
      data[`${fileType}_file`] = null;
      await axios.patch(`/operations/operations/${id}/`, data);
      setExistingFiles(prev => ({ ...prev, [`${fileType}_file`]: null }));
    } catch (err) {
      console.error(err);
      alert('Error al eliminar archivo');
    } finally {
      setDeletingFile(false);
    }
  };

  const handleAutoComplete = async () => {
    if (!imoInput || imoInput.length !== 7) {
      alert('Ingrese un IMO válido de 7 dígitos');
      return;
    }
    setAutoCompleting(true);
    try {
      const response = await axios.get(`/operations/operations/auto_complete_imo/`, {
        params: { imo: imoInput }
      });
      const data = response.data;

      const formatToDatetimeLocal = (isoString) => {
        if (!isoString) return '';
        try {
          const date = new Date(isoString);
          return isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 16);
        } catch { return ''; }
      };

      setFormData(prev => ({
        ...prev,
        ship: data.ship_id,
        port: data.port_id || '',
        eta: formatToDatetimeLocal(data.eta),
      }));
      setAutoCompleteFlag(data.flag || '');
      alert(`Buque "${data.ship_name}" cargado.\nBandera: ${data.flag || 'No disponible'}\nPuerto: ${data.port_name || 'No detectado'}`);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Error al obtener datos del IMO');
    } finally {
      setAutoCompleting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 👇 Escudo 2: Validación estricta de productos vacíos antes de enviar
      const validProducts = formData.products.filter(p => p.product && String(p.product).trim() !== '');

      if (formData.products.length > 0 && validProducts.length !== formData.products.length) {
        setError("Error: Tienes filas de productos vacías en la lista. Por favor selecciona un producto o elimina la fila con el botón de la basura.");
        setLoading(false);
        return; // Bloquea el envío al backend
      }

      const safeFormatDate = (dateStr) => {
        if (!dateStr || String(dateStr).trim() === '') return null;
        try {
          const d = new Date(dateStr);
          return isNaN(d.getTime()) ? null : d.toISOString();
        } catch { return null; }
      };

      const payload = {
        ...formData,
        products: validProducts, // Enviamos solo los garantizados
        eta: safeFormatDate(formData.eta),
        delivery_date: safeFormatDate(formData.delivery_date),
        closed_date: safeFormatDate(formData.closed_date),
        order_received_date: safeFormatDate(formData.order_received_date),
        client_confirmed_date: safeFormatDate(formData.client_confirmed_date),
      };

      let response;
      if (id) {
        response = await axios.put(`/operations/operations/${id}/`, payload);
      } else {
        response = await axios.post('/operations/operations/', payload);
      }

      if (onSuccess) onSuccess(response.data.id);
      if (onClose) onClose();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data ? JSON.stringify(err.response.data) : 'Revisa los campos obligatorios.';
      setError(`Error al guardar: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () => {
    return formData.products.reduce((sum, p) => sum + (p.quantity * p.unit_price), 0);
  };

  if (fetchingData) return <div className="text-center mt-10">Cargando...</div>;

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={onClose}></div>
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          <div className="px-6 py-5 sm:p-8">
            <h3 className="text-2xl leading-6 font-bold text-gray-900 border-b pb-4">
              {id ? `Editar Operación #${id}` : 'Nueva Operación Marítima'}
            </h3>

            <form onSubmit={handleSubmit} className="mt-6 space-y-8">
              {error && <div className="bg-red-50 border-l-4 border-red-500 p-4 text-red-700 font-medium rounded-r-md">{error}</div>}

              {/* Autocompletado IMO */}
              {!id && (
                <div className="bg-indigo-50 p-5 rounded-xl border border-indigo-100">
                  <label className="block text-sm font-bold text-indigo-900 mb-2">Autocompletado Mágico (IMO)</label>
                  <div className="flex items-end space-x-3">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={imoInput}
                        onChange={(e) => setImoInput(e.target.value)}
                        placeholder="Ej: 9432658"
                        className="block w-full border border-indigo-200 rounded-lg py-2.5 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAutoComplete}
                      disabled={autoCompleting}
                      className="py-2.5 px-5 shadow-sm text-sm font-bold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
                    >
                      {autoCompleting ? 'Buscando...' : 'Buscar IMO'}
                    </button>
                  </div>
                </div>
              )}

              {/* GRID PRINCIPAL */}
              <div className="grid grid-cols-1 gap-y-6 gap-x-6 sm:grid-cols-2">
                <AutocompleteCreate
                  label="Cliente *"
                  endpoint="/operations/clients/"
                  value={formData.client}
                  onSelect={(item) => setFormData(prev => ({ ...prev, client: item?.id || '' }))}
                  extraCreateData={{ email: 'default@email.com' }}
                  createFields={[{ name: 'contact_person', label: 'Persona de contacto' }, { name: 'phone', label: 'Teléfono' }]}
                />

                <AutocompleteCreate
                  label="Agencia"
                  endpoint="/operations/agencies/"
                  value={formData.agency}
                  onSelect={(item) => setFormData(prev => ({ ...prev, agency: item?.id || '' }))}
                />

                <div>
                  <AutocompleteCreate
                    label="Buque *"
                    endpoint="/operations/ships/"
                    value={formData.ship}
                    onSelect={(item) => {
                      setFormData(prev => ({ ...prev, ship: item?.id || '' }));
                      if (item && item.flag) setAutoCompleteFlag(item.flag);
                    }}
                    createFields={[
                      { name: 'imo', label: 'IMO *', required: true },
                      { name: 'flag', label: 'Bandera *', required: true },
                    ]}
                  />
                  {autoCompleteFlag && <p className="text-xs text-gray-500 mt-1 font-medium">Bandera: {autoCompleteFlag}</p>}
                </div>

                <AutocompleteCreate
                  label="Puerto *"
                  endpoint="/operations/ports/"
                  value={formData.port}
                  onSelect={(item) => setFormData(prev => ({ ...prev, port: item?.id || '' }))}
                  createFields={[{ name: 'country', label: 'País *', required: true }, { name: 'code', label: 'Código' }]}
                />

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">ETA Estimado *</label>
                  <input
                    type="datetime-local"
                    name="eta"
                    value={formData.eta}
                    onChange={handleChange}
                    required
                    className="block w-full py-2 px-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Método de Entrega</label>
                  <select
                    name="delivery_method"
                    value={formData.delivery_method}
                    onChange={handleChange}
                    className="block w-full py-2 px-3 border border-gray-300 bg-white rounded-md focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  >
                    <option value="muelle">Muelle</option>
                    <option value="lancha">Lancha</option>
                  </select>
                </div>
              </div>

              {/* PRODUCTOS */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex justify-between items-center border-b pb-3 mb-4">
                  <h4 className="text-lg font-bold text-gray-900">Mercadería</h4>
                  <button type="button" onClick={addProduct} className="text-sm font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors">
                    + Agregar Fila
                  </button>
                </div>

                {formData.products.length === 0 ? (
                  <div className="text-center py-6 text-gray-500 text-sm font-medium">No se han añadido productos.</div>
                ) : (
                  <div className="space-y-2">
                    {formData.products.map((prod, idx) => (
                      <ProductRow key={idx} product={prod} index={idx} onUpdate={handleProductUpdate} onRemove={removeProduct} />
                    ))}
                  </div>
                )}

                {formData.products.length > 0 && (
                  <div className="mt-4 flex justify-end">
                    <div className="bg-slate-800 text-white px-5 py-2.5 rounded-lg shadow-sm">
                      <span className="text-sm text-slate-300 mr-3">Total Estimado:</span>
                      <span className="font-bold text-lg">${calculateTotal().toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* NOTAS */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Notas Operativas</label>
                <textarea
                  name="notes"
                  rows={3}
                  value={formData.notes}
                  onChange={handleChange}
                  className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>

              {/* Documentos (solo edición) */}
              {id && (
                <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                  <h4 className="text-md font-bold text-gray-900 mb-4 border-b pb-2">Documentos de la Operación</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                    <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between">
                      <div>
                        <span className="text-sm font-bold text-gray-800 block">Packing List</span>
                        {existingFiles.packing_list_file ? (
                          <a href={existingFiles.packing_list_file} target="_blank" rel="noreferrer" className="text-indigo-600 text-xs font-medium hover:underline">Ver Archivo</a>
                        ) : <span className="text-xs text-gray-400">Sin archivo</span>}
                      </div>
                      <label className="mt-3 cursor-pointer bg-slate-100 py-1.5 px-3 text-center rounded text-xs font-bold text-slate-700 hover:bg-slate-200 transition-colors">
                        {existingFiles.packing_list_file ? 'Reemplazar' : 'Subir'}
                        <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'packing_list_file')} disabled={uploading} />
                      </label>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between">
                      <div>
                        <span className="text-sm font-bold text-gray-800 block">Remito</span>
                        {existingFiles.remito_file ? (
                          <a href={existingFiles.remito_file} target="_blank" rel="noreferrer" className="text-emerald-600 text-xs font-medium hover:underline">Ver Archivo</a>
                        ) : <span className="text-xs text-gray-400">Sin archivo</span>}
                      </div>
                      <label className="mt-3 cursor-pointer bg-slate-100 py-1.5 px-3 text-center rounded text-xs font-bold text-slate-700 hover:bg-slate-200 transition-colors">
                        {existingFiles.remito_file ? 'Reemplazar' : 'Subir'}
                        <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'remito_file')} disabled={uploading} />
                      </label>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between">
                      <div>
                        <span className="text-sm font-bold text-gray-800 block">Rancho</span>
                        {existingFiles.rancho_file ? (
                          <a href={existingFiles.rancho_file} target="_blank" rel="noreferrer" className="text-amber-600 text-xs font-medium hover:underline">Ver Archivo</a>
                        ) : <span className="text-xs text-gray-400">Sin archivo</span>}
                      </div>
                      <label className="mt-3 cursor-pointer bg-slate-100 py-1.5 px-3 text-center rounded text-xs font-bold text-slate-700 hover:bg-slate-200 transition-colors">
                        {existingFiles.rancho_file ? 'Reemplazar' : 'Subir'}
                        <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'rancho_file')} disabled={uploading} />
                      </label>
                    </div>

                  </div>
                </div>
              )}

              {/* Botones */}
              <div className="pt-5 border-t border-gray-200 flex justify-end gap-3">
                <button type="button" onClick={onClose} className="bg-white py-2.5 px-5 border border-gray-300 rounded-lg shadow-sm text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={loading} className="py-2.5 px-6 border border-transparent shadow-sm text-sm font-bold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none disabled:opacity-70 transition-colors flex items-center gap-2">
                  {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                  {id ? 'Guardar Cambios' : 'Confirmar Operación'}
                </button>
              </div>

            </form>
          </div>
        </div>
      </div>
    </div>
  );
}