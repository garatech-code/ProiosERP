import { useState, useEffect } from 'react';
import axios from '../api/axios';
import AutocompleteCreate from './AutocompleteCreate';
import { useAuth } from '../context/AuthContext';

/* =========================
   PRODUCT ROW
========================= */
function ProductRow({ product, index, onUpdate, onRemove }) {
  const [selectedProduct, setSelectedProduct] = useState(
    product.product ? { id: product.product } : null
  );

  const handleProductSelect = (item) => {
    setSelectedProduct(item);
    onUpdate(index, 'product', item ? item.id : '');
    onUpdate(index, 'weight_kg', item ? item.weight_kg : null);
    onUpdate(index, 'presentation', item ? item.presentation : '');
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end p-4 bg-gray-50 rounded-xl border border-gray-100 mb-3 relative group">
      <div className="sm:col-span-4">
        <AutocompleteCreate
          label="Producto"
          endpoint="/operations/products/"
          value={selectedProduct?.id || ''}
          onSelect={handleProductSelect}
          createFields={[
            { name: 'presentation', label: 'Presentación', required: true },
            { name: 'weight_kg', label: 'Peso unitario (kg)', type: 'number', required: true },
          ]}
        />
      </div>

      <div className="sm:col-span-2">
        <label className="block text-xs font-medium text-gray-700 mb-1">Peso (kg)</label>
        <input
          type="number"
          value={product.weight_kg || ''}
          disabled
          className="block w-full py-2 px-3 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 sm:text-sm"
        />
      </div>

      <div className="sm:col-span-2">
        <label className="block text-xs font-medium text-gray-700 mb-1">Cantidad</label>
        <input
          type="number"
          min="1"
          value={product.quantity}
          onChange={(e) => onUpdate(index, 'quantity', parseInt(e.target.value) || 0)}
          className="block w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
        />
      </div>

      <div className="sm:col-span-3">
        <label className="block text-xs font-medium text-gray-700 mb-1">Precio Unit. ($)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={product.unit_price}
          onChange={(e) => onUpdate(index, 'unit_price', parseFloat(e.target.value) || 0)}
          className="block w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
        />
      </div>

      <div className="sm:col-span-1 flex justify-end">
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          title="Eliminar ítem"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
        </button>
      </div>
    </div>
  );
}

/* =========================
   MAIN COMPONENT
========================= */
export default function OperationForm({ id, onClose, onSuccess }) {
  const { user: currentUser } = useAuth();

  const [availableUsers, setAvailableUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [error, setError] = useState(null);

  // Estados para la búsqueda por IMO
  const [imoNumber, setImoNumber] = useState('');
  const [searchingImo, setSearchingImo] = useState(false);
  const [imoSuccess, setImoSuccess] = useState(false);

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
    operarios_id: [],
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        if (currentUser?.role === 'OWNER') {
          const res = await axios.get('/usuarios/users/');

          console.log("Respuesta cruda de /usuarios/:", res.data);

          const fetchedUsers = res.data?.results || res.data;

          if (Array.isArray(fetchedUsers)) {
            setAvailableUsers(fetchedUsers);
          } else {
            console.error("La API de usuarios no devolvió una lista:", fetchedUsers);
            setAvailableUsers([]);
          }
        }

        if (id) {
          const res = await axios.get(`/operations/operations/${id}/`);
          const op = res.data;
          const format = (d) => d ? new Date(d).toISOString().slice(0, 16) : '';

          setFormData({
            client: op.client || '',
            ship: op.ship || '',
            port: op.port || '',
            agency: op.agency || '',
            eta: format(op.eta),
            delivery_method: op.delivery_method || 'muelle',
            notes: op.notes || '',
            products: op.products || [],
            delivery_date: format(op.delivery_date),
            closed_date: format(op.closed_date),
            order_received_date: format(op.order_received_date),
            client_confirmed_date: format(op.client_confirmed_date),
            operadores_id: op.operadores_id || [],
            operarios_id: op.operarios_id || [],
          });
        }
      } catch (err) {
        console.error(err);
        setError('Error cargando datos del formulario.');
      } finally {
        setFetchingData(false);
      }
    };

    loadData();
  }, [id, currentUser]);


  /* --- Funciones Auxiliares --- */
  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleProductUpdate = (i, field, value) => {
    const updated = [...formData.products];
    updated[i] = { ...updated[i], [field]: value };
    setFormData(prev => ({ ...prev, products: updated }));
  };

  const addProduct = () => {
    setFormData(prev => ({
      ...prev,
      products: [...prev.products, { product: '', quantity: 1, unit_price: 0 }],
    }));
  };

  const removeProduct = (i) => {
    setFormData(prev => ({
      ...prev,
      products: prev.products.filter((_, idx) => idx !== i),
    }));
  };

  const formatDate = (d) => d ? new Date(d).toISOString() : null;

  /* --- Búsqueda IMO --- */
  const handleImoSearch = async () => {
    if (!imoNumber || imoNumber.length !== 7 || isNaN(imoNumber)) {
      setError('El número IMO debe tener exactamente 7 dígitos numéricos.');
      return;
    }

    // 1. Limpiamos los datos del buque/puerto/eta anterior antes de buscar
    setFormData(prev => ({
      ...prev,
      ship: '',
      port: '',
      eta: ''
    }));

    setSearchingImo(true);
    setError(null);
    setImoSuccess(false);

    try {
      // 2. Corregido: Usamos la variable imoNumber en lugar del valor hardcodeado
      const res = await axios.get('/operations/operations/auto_complete_imo/', {
        params: { imo: imoNumber }
      });
      const data = res.data;

      const formatETA = (d) => d ? new Date(d).toISOString().slice(0, 16) : '';

      setFormData(prev => ({
        ...prev,
        ship: data.ship_id || prev.ship,
        port: data.port_id || prev.port,
        eta: data.eta ? formatETA(data.eta) : prev.eta,
      }));

      setImoSuccess(true);
      setTimeout(() => setImoSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al conectar con el servicio de búsqueda IMO.');
    } finally {
      setSearchingImo(false);
    }
  };

  /* --- Manejo del Cierre del Modal --- */
  const handleCloseModal = () => {
    // Reseteamos el campo del IMO en caso de que lo oculten sin desmontarlo
    setImoNumber('');
    onClose();
  };

  /* --- Submit --- */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        ...formData,
        products: products,
        eta: formatDate(formData.eta),
        delivery_date: formatDate(formData.delivery_date),
        closed_date: formatDate(formData.closed_date),
        order_received_date: formatDate(formData.order_received_date),
        client_confirmed_date: formatDate(formData.client_confirmed_date),
      };
      console.log("PAYLOAD LISTO PARA ENVIAR:", payload);
      const res = id
        ? await axios.put(`/operations/operations/${id}/`, payload)
        : await axios.post('/operations/operations/', payload);

      onSuccess?.(res.data.id);
    } catch (err) {
      console.error(err);
      setError('Ocurrió un error al guardar la operación. Verifique los datos.');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () => formData.products.reduce((sum, p) => sum + (p.quantity * p.unit_price), 0);

  if (fetchingData) return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white p-6 rounded-2xl flex flex-col items-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-4"></div>
        <p className="text-gray-600 font-medium">Preparando formulario...</p>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-full flex flex-col overflow-hidden my-auto">

        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-slate-50">
          <h2 className="text-xl font-bold text-gray-800">
            {id ? `Editar Operación #${id}` : 'Nueva Operación'}
          </h2>
          {/* Corregido: Llamamos a handleCloseModal en lugar de onClose directo */}
          <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full p-2 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">

          {error && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
              <p className="text-red-700 text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Sección Opcional IMO */}
          {!id && (
            <div className="mb-8 bg-indigo-50/50 border border-indigo-100 rounded-xl p-5">
              <label className="block text-sm font-bold text-indigo-900 mb-2">Búsqueda Automática por IMO (Opcional)</label>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Ej: 9432658"
                  value={imoNumber}
                  onChange={(e) => setImoNumber(e.target.value)}
                  className="flex-1 block w-full py-2.5 px-4 border border-indigo-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white"
                />
                <button
                  type="button"
                  onClick={handleImoSearch}
                  disabled={searchingImo}
                  className="px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
                >
                  {searchingImo ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                  )}
                  Buscar
                </button>
              </div>
              {imoSuccess && <p className="text-green-600 text-xs font-semibold mt-2">¡Datos del buque y puerto encontrados y cargados!</p>}
              <p className="text-xs text-indigo-400 mt-2">Si ingresa un IMO válido, intentaremos autocompletar Buque, Puerto y ETA.</p>
            </div>
          )}

          <form id="operation-form" onSubmit={handleSubmit} className="space-y-8">

            {/* GRID PRINCIPAL */}
            <div>
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider border-b pb-2 mb-4">Datos Generales</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <AutocompleteCreate
                  label="Cliente"
                  endpoint="/operations/clients/"
                  value={formData.client}
                  onSelect={(i) => setFormData(p => ({ ...p, client: i?.id || '' }))}
                />
                <AutocompleteCreate
                  label="Agencia"
                  endpoint="/operations/agencies/"
                  value={formData.agency}
                  onSelect={(i) => setFormData(p => ({ ...p, agency: i?.id || '' }))}
                />
                <AutocompleteCreate
                key={`ship-${formData.ship}`}
                  label="Buque"
                  endpoint="/operations/ships/"
                  value={formData.ship}
                  onSelect={(i) => setFormData(p => ({ ...p, ship: i?.id || '' }))}
                />
                <AutocompleteCreate
                key={`port-${formData.port}`}
                  label="Puerto"
                  endpoint="/operations/ports/"
                  value={formData.port}
                  onSelect={(i) => setFormData(p => ({ ...p, port: i?.id || '' }))}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ETA Estimado</label>
                  <input
                    type="datetime-local"
                    name="eta"
                    value={formData.eta}
                    onChange={handleChange}
                    className="block w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Método de Entrega</label>
                  <select
                    name="delivery_method"
                    value={formData.delivery_method}
                    onChange={handleChange}
                    className="block w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  >
                    <option value="muelle">Muelle</option>
                    <option value="lancha">Lancha</option>
                    <option value="taller">Taller</option>
                  </select>
                </div>
              </div>
            </div>

            {/* SECCIÓN ASIGNACIONES (Solo Owner) */}
            {currentUser?.role === 'OWNER' && (
              <div>
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider border-b pb-2 mb-4">Equipo Asignado</h3>
                <p className="text-xs text-gray-500 mb-4">Seleccione quiénes tendrán acceso a la gestión operativa y de planta de esta orden.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

                  {/* Operadores */}
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                      <span className="text-sm font-bold text-gray-700">Operadores (Logística)</span>
                    </div>
                    <div className="p-4 max-h-40 overflow-y-auto">
                      {availableUsers.filter(u => u.role === 'OPERADOR').map(u => (
                        <label key={u.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={formData.operadores_id.includes(u.id)}
                            onChange={(e) => {
                              const ids = e.target.checked
                                ? [...formData.operadores_id, u.id]
                                : formData.operadores_id.filter(id => id !== u.id);
                              setFormData(p => ({ ...p, operadores_id: ids }));
                            }}
                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                          />
                          <span className="text-sm text-gray-700 font-medium">{u.username}</span>
                        </label>
                      ))}
                      {availableUsers.filter(u => u.role === 'OPERADOR').length === 0 && <span className="text-sm text-gray-400">No hay operadores disponibles.</span>}
                    </div>
                  </div>

                  {/* Operarios */}
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                      <span className="text-sm font-bold text-gray-700">Operarios (Planta)</span>
                    </div>
                    <div className="p-4 max-h-40 overflow-y-auto">
                      {availableUsers.filter(u => u.role === 'OPERARIO').map(u => (
                        <label key={u.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={formData.operarios_id.includes(u.id)}
                            onChange={(e) => {
                              const ids = e.target.checked
                                ? [...formData.operarios_id, u.id]
                                : formData.operarios_id.filter(id => id !== u.id);
                              setFormData(p => ({ ...p, operarios_id: ids }));
                            }}
                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                          />
                          <span className="text-sm text-gray-700 font-medium">{u.username}</span>
                        </label>
                      ))}
                      {availableUsers.filter(u => u.role === 'OPERARIO').length === 0 && <span className="text-sm text-gray-400">No hay operarios disponibles.</span>}
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* SECCIÓN PRODUCTOS */}
            <div>
              <div className="flex justify-between items-end border-b pb-2 mb-4">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Carga (Productos)</h3>
                <button
                  type="button"
                  onClick={addProduct}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                >
                  <span>+</span> Añadir Ítem
                </button>
              </div>

              {formData.products.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                  <p className="text-gray-500 text-sm">No hay productos en esta operación.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {formData.products.map((p, i) => (
                    <ProductRow key={i} product={p} index={i} onUpdate={handleProductUpdate} onRemove={removeProduct} />
                  ))}
                </div>
              )}

              {/* Total Card */}
              {formData.products.length > 0 && (
                <div className="mt-4 flex justify-end">
                  <div className="bg-slate-800 text-white px-6 py-3 rounded-xl shadow-md flex items-center gap-4">
                    <span className="text-sm font-medium text-slate-300 uppercase tracking-wider">Total Estimado</span>
                    <span className="text-xl font-bold">${calculateTotal().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              )}
            </div>

            {/* NOTAS */}
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-2">Notas Adicionales</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                className="block w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Información extra para logística o planta..."
              />
            </div>

          </form>
        </div>

        {/* Modal Footer (Sticky) */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
          {/* Corregido: Llamamos a handleCloseModal en lugar de onClose directo */}
          <button
            type="button"
            onClick={handleCloseModal}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 shadow-sm transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="operation-form"
            disabled={loading}
            className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-70 disabled:cursor-not-allowed shadow-md transition-colors flex items-center gap-2"
          >
            {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
            {loading ? 'Guardando...' : (id ? 'Guardar Cambios' : 'Confirmar Operación')}
          </button>
        </div>

      </div>

      {/* Scrollbar styling embedded */}
      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 20px; }
      `}} />
    </div>
  );
}