import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from '../api/axios';

export default function OperationForm() {
  const { id } = useParams();
  const navigate = useNavigate();
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
  const [clients, setClients] = useState([]);
  const [ships, setShips] = useState([]);
  const [ports, setPorts] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [products, setProducts] = useState([]);
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
    const fetchSelectData = async () => {
      try {
        const [clientsRes, shipsRes, portsRes, agenciesRes, productsRes] = await Promise.all([
          axios.get('/operations/clients/'),
          axios.get('/operations/ships/'),
          axios.get('/operations/ports/'),
          axios.get('/operations/agencies/'),
          axios.get('/operations/products/'),
        ]);
        setClients(clientsRes.data);
        setShips(shipsRes.data);
        setPorts(portsRes.data);
        setAgencies(agenciesRes.data);
        setProducts(productsRes.data);
      } catch (err) {
        console.error(err);
        setError('Error cargando datos iniciales.');
      }
    };

    fetchSelectData();

    if (id) {
      const fetchOperation = async () => {
        try {
          const res = await axios.get(`/operations/operations/${id}/`);
          const operation = res.data;
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
        } catch (err) {
          console.error(err);
          setError('Error cargando la operación.');
        } finally {
          setFetchingData(false);
        }
      };
      fetchOperation();
    } else {
      setFetchingData(false);
    }
  }, [id]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleProductChange = (index, field, value) => {
    const newProducts = [...formData.products];
    newProducts[index][field] = value;
    setFormData({ ...formData, products: newProducts });
  };

  const addProduct = () => {
    setFormData({
      ...formData,
      products: [...formData.products, { product: '', quantity: 1, unit_price: 0 }],
    });
  };

  const removeProduct = (index) => {
    const newProducts = formData.products.filter((_, i) => i !== index);
    setFormData({ ...formData, products: newProducts });
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      let response;
      if (id) {
        response = await axios.put(`/operations/operations/${id}/`, formData);
        navigate(`/operations/${response.data.id}`);
      } else {
        response = await axios.post('/operations/operations/', formData);
        navigate(`/operations/${response.data.id}`);
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
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              {id ? 'Editar operación' : 'Nueva operación'}
            </h3>
            <form onSubmit={handleSubmit} className="mt-5 space-y-6">
              {error && <div className="text-red-600 text-sm">{error}</div>}

              {/* Datos principales */}
              <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Cliente *</label>
                  <select
                    name="client"
                    value={formData.client}
                    onChange={handleChange}
                    required
                    className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  >
                    <option value="">Seleccionar</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Buque *</label>
                  <select
                    name="ship"
                    value={formData.ship}
                    onChange={handleChange}
                    required
                    className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  >
                    <option value="">Seleccionar</option>
                    {ships.map(s => <option key={s.id} value={s.id}>{s.name} (IMO: {s.imo})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Puerto *</label>
                  <select
                    name="port"
                    value={formData.port}
                    onChange={handleChange}
                    required
                    className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  >
                    <option value="">Seleccionar</option>
                    {ports.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Agencia</label>
                  <select
                    name="agency"
                    value={formData.agency}
                    onChange={handleChange}
                    className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  >
                    <option value="">Seleccionar</option>
                    {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
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
                {/* Nuevos campos: fecha entrega y cierre */}
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

              {/* Productos */}
              <div>
                <div className="flex justify-between items-center">
                  <h4 className="text-md font-medium text-gray-900">Productos</h4>
                  <button type="button" onClick={addProduct} className="text-sm text-indigo-600 hover:text-indigo-500">
                    + Agregar producto
                  </button>
                </div>
                <div className="mt-4 space-y-4">
                  {formData.products.map((prod, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-4 items-end border-b pb-4">
                      <div className="col-span-5">
                        <label className="block text-sm font-medium text-gray-700">Producto</label>
                        <select
                          value={prod.product}
                          onChange={(e) => handleProductChange(idx, 'product', e.target.value)}
                          className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        >
                          <option value="">Seleccionar</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Cantidad</label>
                        <input
                          type="number"
                          value={prod.quantity}
                          onChange={(e) => handleProductChange(idx, 'quantity', parseInt(e.target.value))}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                      </div>
                      <div className="col-span-3">
                        <label className="block text-sm font-medium text-gray-700">Precio unitario</label>
                        <input
                          type="number"
                          step="0.01"
                          value={prod.unit_price}
                          onChange={(e) => handleProductChange(idx, 'unit_price', parseFloat(e.target.value))}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                      </div>
                      <div className="col-span-2">
                        <button type="button" onClick={() => removeProduct(idx)} className="text-red-600 hover:text-red-800">
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {formData.products.length > 0 && (
                  <div className="mt-4 flex justify-end">
                    <span className="text-sm font-medium text-gray-700">Total estimado: ${calculateTotal().toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Documentos (solo en modo edición) */}
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
                  onClick={() => navigate('/')}
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