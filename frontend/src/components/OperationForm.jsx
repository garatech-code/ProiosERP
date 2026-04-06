import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../api/axios';
import AutocompleteCreate from '../components/AutocompleteCreate';

// Componente para una fila de producto (para mantener estado local)
function ProductRow({ product, index, onUpdate, onRemove }) {
  const [selectedProduct, setSelectedProduct] = useState(product.product ? { id: product.product } : null);

  const handleProductSelect = (item) => {
    setSelectedProduct(item);

    onUpdate(index, 'product', item ? item.id : '');
    onUpdate(index, 'weight_kg', item ? item.weight_kg : null); // 🔥
    onUpdate(index, 'presentation', item ? item.presentation : '');
  };

  return (
    <div className="grid grid-cols-14 gap-4 items-end border-b pb-4">
      <div className="col-span-5">
        <AutocompleteCreate
          label="Producto"
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
      <div className="col-span-2">
        <label className="block text-sm font-medium text-gray-700">Peso unitario (kg)</label>
        <input
          type="number"
          value={product.weight_kg || ''}
          disabled
          className="mt-1 block w-full border border-gray-300 rounded-md bg-gray-100 py-2 px-3 text-sm"
        />
      </div>
      <div className="col-span-2">
        <label className="block text-sm font-medium text-gray-700">Cantidad</label>
        <input
          type="number"
          value={product.quantity}
          onChange={(e) => onUpdate(index, 'quantity', parseInt(e.target.value) || 0)}
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
      </div>
      <div className="col-span-3">
        <label className="block text-sm font-medium text-gray-700">Precio unitario</label>
        <input
          type="number"
          step="0.01"
          value={product.unit_price}
          onChange={(e) => onUpdate(index, 'unit_price', parseFloat(e.target.value) || 0)}
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
      </div>
      <div className="col-span-2">
        <button type="button" onClick={() => onRemove(index)} className="text-red-600 hover:text-red-800">
          Eliminar
        </button>
      </div>
    </div>
  );
}

export default function OperationForm({ id, onClose, onSuccess }) {
  const navigate = useNavigate(); // Kept for viewing the final operation if needed, or we can use onSuccess
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

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        if (id) {
          const opRes = await axios.get(`/operations/operations/${id}/`);
          const operation = opRes.data;
          if (operation.eta) {
            operation.eta = new Date(operation.eta).toISOString().slice(0, 16);
          }
          if (operation.delivery_date) {
            operation.delivery_date = new Date(operation.delivery_date).toISOString().slice(0, 16);
          }
          if (operation.closed_date) {
            operation.closed_date = new Date(operation.closed_date).toISOString().slice(0, 16);
          }
          setFormData(operation);
          setExistingFiles({
            packing_list_file: operation.packing_list_file,
            remito_file: operation.remito_file,
            rancho_file: operation.rancho_file,
          });
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
      await axios.post(`/operations/operations/${id}/${type}/`, formDataFile, {
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
      await axios.delete(`/operations/operations/${id}/delete_${fileType}/`);
      setExistingFiles(prev => ({ ...prev, [`${fileType}_file`]: null }));
    } catch (err) {
      console.error(err);
      alert('Error al eliminar archivo');
    } finally {
      setDeletingFile(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return null;
    return new Date(dateString).toISOString();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        ...formData,
        eta: formatDate(formData.eta),
        delivery_date: formatDate(formData.delivery_date),
        closed_date: formatDate(formData.closed_date),
      };

      let response;

      if (id) {
        response = await axios.put(`/operations/operations/${id}/`, payload);
      } else {
        response = await axios.post('/operations/operations/', payload);
      }

      if (onSuccess) {
        onSuccess(response.data.id);
      }
      if (onClose) {
        onClose();
      }
    } catch (err) {
      console.error(err);
      setError('Error al guardar la operación. Revisa los datos.');
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
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              {id ? 'Editar operación' : 'Nueva operación'}
            </h3>
            <form onSubmit={handleSubmit} className="mt-5 space-y-6">
              {error && <div className="text-red-600 text-sm">{error}</div>}

              <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                <AutocompleteCreate
                  label="Cliente *"
                  endpoint="/operations/clients/"
                  value={formData.client}
                  onSelect={(item) => setFormData(prev => ({ ...prev, client: item?.id || '' }))}
                  extraCreateData={{ email: 'default@email.com' }}
                  createFields={[
                    { name: 'contact_person', label: 'Persona de contacto' },
                    { name: 'phone', label: 'Teléfono' },
                  ]}
                />

                <AutocompleteCreate
                  label="Buque *"
                  endpoint="/operations/ships/"
                  value={formData.ship}
                  onSelect={(item) => setFormData(prev => ({ ...prev, ship: item?.id || '' }))}
                  createFields={[
                    { name: 'imo', label: 'IMO *', required: true },
                    { name: 'flag', label: 'Bandera *', required: true },
                    { name: 'call_sign', label: 'Indicativo' },
                    { name: 'gross_tonnage', label: 'Tonelaje bruto', type: 'number' },
                  ]}
                />

                <AutocompleteCreate
                  label="Puerto *"
                  endpoint="/operations/ports/"
                  value={formData.port}
                  onSelect={(item) => setFormData(prev => ({ ...prev, port: item?.id || '' }))}
                  createFields={[
                    { name: 'country', label: 'País *', required: true },
                    { name: 'code', label: 'Código' },
                  ]}
                />

                <AutocompleteCreate
                  label="Agencia"
                  endpoint="/operations/agencies/"
                  value={formData.agency}
                  onSelect={(item) => setFormData(prev => ({ ...prev, agency: item?.id || '' }))}
                  createFields={[
                    { name: 'contact_name', label: 'Persona de contacto' },
                    { name: 'phone', label: 'Teléfono' },
                    { name: 'email', label: 'Email' },
                  ]}
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700">ETA *</label>
                  <input
                    type="datetime-local"
                    name="eta"
                    value={formData.eta}
                    onChange={handleChange}
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Método de entrega</label>
                  <select
                    name="delivery_method"
                    value={formData.delivery_method}
                    onChange={handleChange}
                    className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  >
                    <option value="muelle">Muelle</option>
                    <option value="lancha">Lancha</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Fecha de entrega</label>
                  <input
                    type="datetime-local"
                    name="delivery_date"
                    value={formData.delivery_date}
                    onChange={handleChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Fecha de cierre</label>
                  <input
                    type="datetime-local"
                    name="closed_date"
                    value={formData.closed_date}
                    onChange={handleChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Notas</label>
                  <textarea
                    name="notes"
                    rows={3}
                    value={formData.notes}
                    onChange={handleChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
              </div>

              {/* Productos con AutocompleteCreate */}
              <div>
                <div className="flex justify-between items-center">
                  <h4 className="text-md font-medium text-gray-900">Productos</h4>
                  <button type="button" onClick={addProduct} className="text-sm text-indigo-600 hover:text-indigo-500">
                    + Agregar producto
                  </button>
                </div>
                <div className="mt-4 space-y-4">
                  {formData.products.map((prod, idx) => (
                    <ProductRow
                      key={idx}
                      product={prod}
                      index={idx}
                      onUpdate={handleProductUpdate}
                      onRemove={removeProduct}
                    />
                  ))}
                </div>
                {formData.products.length > 0 && (
                  <div className="mt-4 flex justify-end">
                    <span className="text-sm font-medium text-gray-700">Total estimado: ${calculateTotal().toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Documentos (solo edición) */}
              {id && (
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-4">Documentos</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-gray-700">Packing List</span>
                        {existingFiles.packing_list_file && (
                          <div className="flex items-center gap-2 mt-1">
                            <a href={existingFiles.packing_list_file} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-900 text-sm">
                              Ver archivo
                            </a>
                            <button
                              type="button"
                              onClick={() => handleFileDelete('packing')}
                              disabled={deletingFile}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              Eliminar
                            </button>
                          </div>
                        )}
                      </div>
                      <label className={`cursor-pointer bg-white py-2 px-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        Subir nuevo
                        <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'upload_packing')} disabled={uploading} />
                      </label>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-gray-700">Remito firmado</span>
                        {existingFiles.remito_file && (
                          <div className="flex items-center gap-2 mt-1">
                            <a href={existingFiles.remito_file} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-900 text-sm">
                              Ver archivo
                            </a>
                            <button
                              type="button"
                              onClick={() => handleFileDelete('remito')}
                              disabled={deletingFile}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              Eliminar
                            </button>
                          </div>
                        )}
                      </div>
                      <label className={`cursor-pointer bg-white py-2 px-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        Subir remito
                        <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'upload_remito')} disabled={uploading} />
                      </label>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-gray-700">Rancho (Documentación Aduanera)</span>
                        {existingFiles.rancho_file && (
                          <div className="flex items-center gap-2 mt-1">
                            <a href={existingFiles.rancho_file} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-900 text-sm">
                              Ver archivo
                            </a>
                            <button
                              type="button"
                              onClick={() => handleFileDelete('rancho')}
                              disabled={deletingFile}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              Eliminar
                            </button>
                          </div>
                        )}
                      </div>
                      <label className={`cursor-pointer bg-white py-2 px-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        Subir rancho
                        <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'upload_rancho')} disabled={uploading} />
                      </label>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {loading ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}