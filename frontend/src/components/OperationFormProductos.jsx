import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import axios from '../api/axios';
import { useAuth } from '../context/AuthContext';
import AutocompleteCreate from './AutocompleteCreate';
// NUEVO: Importamos hooks de React Router
import { useParams, useNavigate } from 'react-router-dom';

/* =========================
   PRODUCT ROW (con verificación de stock)
========================= */
function ProductRow({ product, index, onUpdate, onRemove }) {
  const [selectedProduct, setSelectedProduct] = useState(
    product.product ? { id: product.product, stock_actual: product.stock_actual || 0 } : null
  );

  const handleProductSelect = (item) => {
    setSelectedProduct(item);
    // Asegurar que enviamos el ID numérico, no el nombre
    let productValue = item?.id ? Number(item.id) : '';
    onUpdate(index, 'product', productValue);
    onUpdate(index, 'weight_kg', item?.peso_kg || item?.weight_kg || null);
    onUpdate(index, 'presentation', item?.presentacion || item?.presentation || '');
    onUpdate(index, 'stock_actual', item?.stock_actual || 0);
  };

  const cantidad = product.quantity || 0;
  const stockActual = product.stock_actual || 0;
  const isStockInsufficient = cantidad > stockActual;

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-12 gap-3 items-end p-4 rounded-xl border mb-3 relative group transition-colors ${isStockInsufficient ? 'bg-red-50 border-red-300' : 'bg-gray-50 border-gray-100'
      }`}>
      <div className="sm:col-span-4">
        <AutocompleteCreate
          label="Producto *"
          // CORRECCIÓN RUTAS: Quitamos la barra inicial
          endpoint="inventario/products/?categoria=otros"
          value={selectedProduct?.id || ''}
          onSelect={handleProductSelect}
          createFields={[
            { name: 'presentacion', label: 'Presentación', required: true },
            { name: 'peso_kg', label: 'Peso unitario (kg)', type: 'number', required: true },
          ]}
          extraCreateData={{ categoria: 'otros' }}
          nameField="nombre"
          placeholder="Buscar o crear..."
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
        <label className="block text-xs font-medium text-gray-700 mb-1">Cantidad *</label>
        <input
          type="number"
          min="1"
          value={cantidad}
          onChange={(e) => onUpdate(index, 'quantity', parseInt(e.target.value) || 0)}
          className={`block w-full py-2 px-3 border rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors ${isStockInsufficient ? 'border-red-500 bg-red-50' : 'border-gray-300'
            }`}
        />
        {isStockInsufficient && (
          <p className="text-xs text-red-600 mt-1">
            ⚠ Stock insuficiente (disponible: {stockActual})
          </p>
        )}
      </div>

      <div className="sm:col-span-2">
        <label className="block text-xs font-medium text-gray-700 mb-1">Stock actual</label>
        <div className="text-sm font-semibold text-gray-800">{stockActual}</div>
      </div>

      <div className="sm:col-span-1">
        <label className="block text-xs font-medium text-gray-700 mb-1">Precio Unit. ($)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={product.unit_price || 0}
          onChange={(e) => onUpdate(index, 'unit_price', parseFloat(e.target.value) || 0)}
          className="block w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
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
// NUEVO: Renombramos prop id a propId para evitar conflictos
export default function OperationFormProductos({ id: propId, onClose, onSuccess }) {
  const { user: currentUser } = useAuth();

  // NUEVO: Hooks de Router
  const { id: routeId } = useParams();
  const navigate = useNavigate();

  // NUEVO: Prioridad: primero el prop (si es modal), luego URL (si es página)
  const id = propId || routeId;

  const [availableUsers, setAvailableUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [error, setError] = useState(null);

  const [uploading, setUploading] = useState(false);
  const [existingFiles, setExistingFiles] = useState({
    packing_list_file: null,
    remito_file: null,
    rancho_file: null,
  });

  const [imoNumber, setImoNumber] = useState('');
  const [searchingImo, setSearchingImo] = useState(false);
  const [imoSuccess, setImoSuccess] = useState(false);
  const [autoCompleteFlag, setAutoCompleteFlag] = useState('');

  const [formData, setFormData] = useState({
    client: '',
    ship: '',
    port: '',
    agency: '',
    eta: '',
    tipo_operacion: 'productos',
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

  // NUEVA FUNCIÓN: Manejo inteligente de cierre
  const handleCloseModal = () => {
    if (onClose) {
      onClose(); // Ejecutar cierre del modal
    } else {
      navigate(-1); // Volver a la ruta anterior (Operation Detail)
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        if (currentUser?.role === 'OWNER') {
          const res = await axios.get('usuarios/users/');
          const fetchedUsers = res.data?.results || res.data;
          if (Array.isArray(fetchedUsers)) setAvailableUsers(fetchedUsers);
        }

        if (id) {
          const res = await axios.get(`operaciones/operations/${id}/`);
          const op = res.data;

          const formatToDatetimeLocal = (isoString) => {
            if (!isoString) return '';
            try {
              const date = new Date(isoString);
              return isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 16);
            } catch { return ''; }
          };

          // Cargar productos con stock_actual
          const productsWithStock = (op.products || []).map(p => ({
            ...p,
            stock_actual: p.stock_actual || 0
          }));

          setFormData({
            client: op.cliente || '',
            ship: op.ship || '',
            port: op.port || '',
            agency: op.agency || '',
            eta: formatToDatetimeLocal(op.eta),
            tipo_operacion: op.tipo_operacion || 'productos',
            delivery_method: op.delivery_method || 'muelle',
            notes: op.notes || '',
            products: productsWithStock,
            delivery_date: formatToDatetimeLocal(op.delivery_date),
            closed_date: formatToDatetimeLocal(op.closed_date),
            order_received_date: formatToDatetimeLocal(op.order_received_date),
            client_confirmed_date: formatToDatetimeLocal(op.client_confirmed_date),
            operadores_id: op.operadores_id || [],
            operarios_id: op.operarios_id || [],
          });

          setExistingFiles({
            packing_list_file: op.packing_list_file,
            remito_file: op.remito_file,
            rancho_file: op.rancho_file,
          });

          if (op.ship) {
            try {
              const shipRes = await axios.get(`operaciones/ships/${op.ship}/`);
              if (shipRes.data.imo) setImoNumber(shipRes.data.imo);
              if (shipRes.data.flag) setAutoCompleteFlag(shipRes.data.flag);
            } catch (err) { console.error(err); }
          }
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

  const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

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
      products: [...prev.products, { product: '', quantity: 1, unit_price: 0, stock_actual: 0 }],
    }));
  };

  const removeProduct = (i) => {
    setFormData(prev => ({
      ...prev,
      products: prev.products.filter((_, idx) => idx !== i),
    }));
  };

  const hasStockIssues = () => {
    return formData.products.some(p =>
      !p.product || (p.quantity || 0) > (p.stock_actual || 0)
    );
  };

  const handleImoSearch = async () => {
    if (!imoNumber || imoNumber.length !== 7 || isNaN(imoNumber)) {
      setError('El número IMO debe tener exactamente 7 dígitos numéricos.');
      return;
    }

    setFormData(prev => ({ ...prev, ship: '', port: '', eta: '' }));
    setSearchingImo(true);
    setError(null);
    setImoSuccess(false);

    try {
      const res = await axios.get('operaciones/operations/auto_complete_imo/', { params: { imo: imoNumber } });
      const data = res.data;

      const formatToDatetimeLocal = (isoString) => {
        if (!isoString) return '';
        try {
          const date = new Date(isoString);
          return isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 16);
        } catch { return ''; }
      };

      setFormData(prev => ({
        ...prev,
        ship: data.ship_id || prev.ship,
        port: data.port_id || prev.port,
        eta: data.eta ? formatToDatetimeLocal(data.eta) : prev.eta,
      }));
      setAutoCompleteFlag(data.flag || '');

      setImoSuccess(true);
      setTimeout(() => setImoSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al obtener datos del IMO');
    } finally {
      setSearchingImo(false);
    }
  };

  const handleFileUpload = async (event, fieldName) => {
    const file = event.target.files[0];
    if (!file) return;
    setUploading(true);
    const formDataFile = new FormData();
    formDataFile.append(fieldName, file);

    try {
      await axios.patch(`operaciones/operations/${id}/`, formDataFile, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const res = await axios.get(`operaciones/operations/${id}/`);
      setExistingFiles({
        packing_list_file: res.data.packing_list_file,
        remito_file: res.data.remito_file,
        rancho_file: res.data.rancho_file,
      });
    } catch (err) {
      console.error(err);
      alert('Error al subir archivo');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    for (let i = 0; i < formData.products.length; i++) {
      const p = formData.products[i];
      if (!p.product) {
        setError(`Fila ${i + 1}: debe seleccionar un producto.`);
        setLoading(false);
        return;
      }
      if (p.quantity <= 0) {
        setError(`Fila ${i + 1}: la cantidad debe ser mayor a cero.`);
        setLoading(false);
        return;
      }
      if (p.unit_price < 0) {
        setError(`Fila ${i + 1}: el precio unitario no puede ser negativo.`);
        setLoading(false);
        return;
      }
      if (p.quantity > (p.stock_actual || 0)) {
        setError(`Fila ${i + 1}: stock insuficiente para "${p.product_name || p.product}". Disponible: ${p.stock_actual}`);
        setLoading(false);
        return;
      }
    }

    try {
      const validProducts = formData.products.filter(p => p.product && String(p.product).trim() !== '');

      const safeFormatDate = (dateStr) => {
        if (!dateStr || dateStr.trim() === '') return null;
        try {
          const d = new Date(dateStr);
          return isNaN(d.getTime()) ? null : d.toISOString();
        } catch { return null; }
      };

      const payload = {
        ...formData,
        products: validProducts.map(p => ({
          product: Number(p.product),
          quantity: p.quantity,
          unit_price: p.unit_price,
        })),
        eta: safeFormatDate(formData.eta),
        delivery_date: safeFormatDate(formData.delivery_date),
        closed_date: safeFormatDate(formData.closed_date),
        order_received_date: safeFormatDate(formData.order_received_date),
        client_confirmed_date: safeFormatDate(formData.client_confirmed_date),
      };

      let res;
      if (id) {
        res = await axios.put(`operaciones/operations/${id}/`, payload);
      } else {
        res = await axios.post('operaciones/operations/', payload);
      }

      if (onSuccess) onSuccess(res.data.id);

      // NUEVO: Cerramos el modal usando la función inteligente
      handleCloseModal();

    } catch (err) {
      console.error("Error en submit:", err);
      let errorMessage = 'Error al guardar. ';
      if (err.response?.data) {
        if (typeof err.response.data === 'object') {
          errorMessage += JSON.stringify(err.response.data);
        } else {
          errorMessage += err.response.data;
        }
      } else {
        errorMessage += err.message;
      }
      setError(errorMessage);
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
    // NUEVO: Agregamos el onClick al fondo para cerrar el modal
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex justify-center items-center p-2 sm:p-4"
      onMouseDown={handleCloseModal}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden my-auto"
        onMouseDown={(e) => e.stopPropagation()} // Evita que se cierre al hacer click dentro del formulario
      >

        <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-indigo-50 shrink-0">
          <h2 className="text-xl font-bold text-gray-800">
            {id ? `Editar Operación #${id}` : 'Nueva Operación'}
          </h2>
          {/* NUEVO: El botón de cerrar usa la función universal */}
          <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full p-2 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">

          {error && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
              <p className="text-red-700 text-sm font-medium whitespace-pre-wrap">{error}</p>
            </div>
          )}

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

            <div>
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider border-b pb-2 mb-4">Datos Generales</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <AutocompleteCreate
                  label="Cliente *"
                  endpoint="operaciones/clients/"
                  value={formData.client}
                  onSelect={(i) => setFormData(p => ({ ...p, client: i?.id || '' }))}
                  extraCreateData={{ email: 'default@email.com' }}
                  createFields={[{ name: 'contact_person', label: 'Contacto' }, { name: 'phone', label: 'Teléfono' }]}
                />
                <AutocompleteCreate
                  label="Agencia"
                  endpoint="operaciones/agencies/"
                  value={formData.agency}
                  onSelect={(i) => setFormData(p => ({ ...p, agency: i?.id || '' }))}
                />
                <div>
                  <AutocompleteCreate
                    label="Buque *"
                    endpoint="operaciones/ships/"
                    value={formData.ship}
                    onSelect={(i) => {
                      setFormData(p => ({ ...p, ship: i?.id || '' }));
                      if (i && i.flag) setAutoCompleteFlag(i.flag);
                    }}
                    createFields={[{ name: 'imo', label: 'IMO *', required: true }, { name: 'flag', label: 'Bandera *', required: true }]}
                  />
                  {autoCompleteFlag && <p className="text-xs text-gray-500 mt-1 font-medium">Bandera: {autoCompleteFlag}</p>}
                </div>
                <AutocompleteCreate
                  label="Puerto *"
                  endpoint="operaciones/ports/"
                  value={formData.port}
                  onSelect={(i) => setFormData(p => ({ ...p, port: i?.id || '' }))}
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
                    className="block w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Tipo de Operación *</label>
                  <select
                    name="tipo_operacion"
                    value={formData.tipo_operacion}
                    onChange={handleChange}
                    required
                    className="block w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  >
                    <option value="productos">Insumos y Repuestos</option>
                    <option value="quimicos">Productos Químicos</option>
                    <option value="servicios">Servicios y Certificados</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Método de Entrega</label>
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

            {currentUser?.role === 'OWNER' && (
              <div>
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider border-b pb-2 mb-4">Equipo Asignado</h3>
                <p className="text-xs text-gray-500 mb-4">Seleccione quiénes tendrán acceso a la gestión de esta orden.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
                              const ids = e.target.checked ? [...formData.operadores_id, u.id] : formData.operadores_id.filter(id => id !== u.id);
                              setFormData(p => ({ ...p, operadores_id: ids }));
                            }}
                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                          />
                          <span className="text-sm text-gray-700 font-medium">{u.username}</span>
                        </label>
                      ))}
                    </div>
                  </div>

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
                              const ids = e.target.checked ? [...formData.operarios_id, u.id] : formData.operarios_id.filter(id => id !== u.id);
                              setFormData(p => ({ ...p, operarios_id: ids }));
                            }}
                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                          />
                          <span className="text-sm text-gray-700 font-medium">{u.username}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div>
              <div className="flex justify-between items-end border-b pb-2 mb-4">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Carga (Productos)</h3>
                <button
                  type="button"
                  onClick={addProduct}
                  className="text-sm font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
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

              {formData.products.length > 0 && (
                <div className="mt-4 flex justify-end">
                  <div className="bg-slate-800 text-white px-6 py-3 rounded-xl shadow-md flex items-center gap-4">
                    <span className="text-sm font-medium text-slate-300 uppercase tracking-wider">Total Estimado</span>
                    <span className="text-xl font-bold">${calculateTotal().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              )}
            </div>

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

          </form>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 rounded-b-2xl shrink-0">
          {/* NUEVO: El botón cancelar usa la función universal */}
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
            disabled={loading || hasStockIssues()}
            className={`px-6 py-2.5 text-sm font-bold text-white rounded-xl shadow-md transition-colors flex items-center gap-2 ${hasStockIssues() ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            title={hasStockIssues() ? "Hay productos sin stock suficiente o sin seleccionar" : ""}
          >
            {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
            {id ? 'Guardar Cambios' : 'Confirmar Operación'}
          </button>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 20px; }
      `}} />
    </div>
  );
}