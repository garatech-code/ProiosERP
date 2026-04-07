import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../api/axios';
import AutocompleteCreate from '../components/AutocompleteCreate';
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
        />
      </div>

      <div className="col-span-2">
        <input type="number" value={product.weight_kg || ''} disabled className="input-disabled" />
      </div>

      <div className="col-span-2">
        <input
          type="number"
          value={product.quantity}
          onChange={(e) => onUpdate(index, 'quantity', parseInt(e.target.value) || 0)}
          className="input"
        />
      </div>

      <div className="col-span-3">
        <input
          type="number"
          value={product.unit_price}
          onChange={(e) => onUpdate(index, 'unit_price', parseFloat(e.target.value) || 0)}
          className="input"
        />
      </div>

      <div className="col-span-2">
        <button type="button" onClick={() => onRemove(index)} className="text-red-600">
          Eliminar
        </button>
      </div>
    </div>
  );
}

/* =========================
   MAIN COMPONENT
========================= */
export default function OperationForm({ id, onClose, onSuccess }) {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const [availableUsers, setAvailableUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [error, setError] = useState(null);

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

  /* =========================
     LOAD DATA
  ========================= */
  useEffect(() => {
    const loadData = async () => {
      try {
        if (currentUser?.role === 'OWNER') {
          const res = await axios.get('/usuarios/');
          setAvailableUsers(res.data);
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
        setError('Error cargando datos');
      } finally {
        setFetchingData(false);
      }
    };

    loadData();
  }, [id, currentUser]);

  /* =========================
     HANDLERS
  ========================= */
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        eta: formatDate(formData.eta),
        delivery_date: formatDate(formData.delivery_date),
        closed_date: formatDate(formData.closed_date),
        order_received_date: formatDate(formData.order_received_date),
        client_confirmed_date: formatDate(formData.client_confirmed_date),
      };

      const res = id
        ? await axios.put(`/operations/operations/${id}/`, payload)
        : await axios.post('/operations/operations/', payload);

      onSuccess?.(res.data.id);
      onClose?.();
    } catch (err) {
      console.error(err);
      setError('Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () =>
    formData.products.reduce((sum, p) => sum + (p.quantity * p.unit_price), 0);

  if (fetchingData) return <div>Cargando...</div>;

  return (
    <div className="modal">
      <form onSubmit={handleSubmit} className="space-y-4">

        {error && <div className="text-red-600">{error}</div>}

        {/* CAMPOS PRINCIPALES */}
        <AutocompleteCreate
          label="Cliente"
          endpoint="/operations/clients/"
          value={formData.client}
          onSelect={(i) => setFormData(p => ({ ...p, client: i?.id || '' }))}
        />

        <AutocompleteCreate
          label="Buque"
          endpoint="/operations/ships/"
          value={formData.ship}
          onSelect={(i) => setFormData(p => ({ ...p, ship: i?.id || '' }))}
        />

        {/* FECHAS NUEVAS */}
        <input type="datetime-local" name="order_received_date" value={formData.order_received_date} onChange={handleChange} />
        <input type="datetime-local" name="client_confirmed_date" value={formData.client_confirmed_date} onChange={handleChange} />

        {/* ASIGNACIONES */}
        {currentUser?.role === 'OWNER' && (
          <>
            <div>
              <label>Operadores</label>
              {availableUsers.filter(u => u.role === 'OPERADOR').map(u => (
                <input
                  key={u.id}
                  type="checkbox"
                  checked={formData.operadores_id.includes(u.id)}
                  onChange={(e) => {
                    const ids = e.target.checked
                      ? [...formData.operadores_id, u.id]
                      : formData.operadores_id.filter(id => id !== u.id);
                    setFormData(p => ({ ...p, operadores_id: ids }));
                  }}
                />
              ))}
            </div>

            <div>
              <label>Operarios</label>
              {availableUsers.filter(u => u.role === 'OPERARIO').map(u => (
                <input
                  key={u.id}
                  type="checkbox"
                  checked={formData.operarios_id.includes(u.id)}
                  onChange={(e) => {
                    const ids = e.target.checked
                      ? [...formData.operarios_id, u.id]
                      : formData.operarios_id.filter(id => id !== u.id);
                    setFormData(p => ({ ...p, operarios_id: ids }));
                  }}
                />
              ))}
            </div>
          </>
        )}

        {/* PRODUCTOS */}
        {formData.products.map((p, i) => (
          <ProductRow key={i} product={p} index={i} onUpdate={handleProductUpdate} onRemove={removeProduct} />
        ))}

        <button type="button" onClick={addProduct}>+ Producto</button>

        <div>Total: ${calculateTotal().toFixed(2)}</div>

        {/* ACTIONS */}
        <button type="button" onClick={onClose}>Cancelar</button>
        <button type="submit" disabled={loading}>
          {loading ? 'Guardando...' : 'Guardar'}
        </button>

      </form>
    </div>
  );
}