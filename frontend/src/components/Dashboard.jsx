import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const [operations, setOperations] = useState([]);
  const [filteredOps, setFilteredOps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchOperations();
  }, []);

  useEffect(() => {
    let filtered = operations;
    if (statusFilter) {
      filtered = filtered.filter(op => op.status === statusFilter);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(op =>
        op.client_name?.toLowerCase().includes(term) ||
        op.ship_name?.toLowerCase().includes(term)
      );
    }
    setFilteredOps(filtered);
  }, [operations, statusFilter, searchTerm]);

  const fetchOperations = async () => {
    try {
      const res = await axios.get('/operations/operations/');
      setOperations(res.data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Error al cargar las operaciones.');
    } finally {
      setLoading(false);
    }
  };

  const cancelOperation = async (id, event) => {
    event.stopPropagation(); // evitar que se navegue al detalle al hacer clic en el botón
    if (!window.confirm('¿Cancelar esta operación? Se marcará como cancelada.')) return;
    try {
      await axios.post(`/operations/operations/${id}/cancel_operation/`);
      fetchOperations(); // recargar lista
    } catch (err) {
      console.error(err);
      alert('Error al cancelar la operación');
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      price_checked: 'bg-blue-100 text-blue-800',
      confirmed: 'bg-green-100 text-green-800',
      in_coordination: 'bg-purple-100 text-purple-800',
      delivered: 'bg-indigo-100 text-indigo-800',
      closed: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    const labels = {
      pending: 'Pendiente',
      price_checked: 'Precio verificado',
      confirmed: 'Confirmada',
      in_coordination: 'En coordinación',
      delivered: 'Entregada',
      closed: 'Cerrada',
      cancelled: 'Cancelada',
    };
    return (
      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const calculateTotal = (products) => {
    if (!products) return 0;
    return products.reduce((sum, p) => sum + (p.quantity * p.unit_price), 0);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">ProIOS - Operaciones Químicas</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Hola, {user?.username || 'Usuario'} ({user?.role || 'operador'})</span>
              <button
                onClick={logout}
                className="px-4 py-2 text-sm text-white bg-red-600 rounded-md hover:bg-red-700"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <h2 className="text-2xl font-bold text-gray-900">Operaciones</h2>
            <div className="flex flex-col sm:flex-row gap-4">
              <input
                type="text"
                placeholder="Buscar por cliente o buque..."
                className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <select
                className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">Todos los estados</option>
                <option value="pending">Pendiente</option>
                <option value="price_checked">Precio verificado</option>
                <option value="confirmed">Confirmada</option>
                <option value="in_coordination">En coordinación</option>
                <option value="delivered">Entregada</option>
                <option value="closed">Cerrada</option>
                <option value="cancelled">Cancelada</option>
              </select>
              <button
                onClick={() => navigate('/operations/new')}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
              >
                + Nueva operación
              </button>
            </div>
          </div>

          {loading && (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          )}
          {error && <p className="text-center text-red-600">{error}</p>}

          {!loading && !error && (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              {filteredOps.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No se encontraron operaciones.</p>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {filteredOps.map((op) => (
                    <li key={op.id}>
                      <div
                        className="px-4 py-4 sm:px-6 hover:bg-gray-50 cursor-pointer"
                        onClick={() => navigate(`/operations/${op.id}`)}
                      >
                        <div className="flex items-center justify-between flex-wrap">
                          <div className="flex flex-col sm:flex-row sm:space-x-4">
                            <p className="text-sm font-medium text-indigo-600">
                              Op #{op.id}
                            </p>
                            <p className="text-sm text-gray-900">
                              {op.client_name || op.client}
                            </p>
                            <p className="text-sm text-gray-500">
                              {op.ship_name || op.ship}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2 mt-2 sm:mt-0">
                            {getStatusBadge(op.status)}
                            <span className="text-sm text-gray-500">
                              ETA: {new Date(op.eta).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="mt-2 sm:flex sm:justify-between">
                          <div className="sm:flex">
                            <p className="flex items-center text-sm text-gray-500">
                              Puerto: {op.port_name || op.port}
                            </p>
                            <p className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0 sm:ml-6">
                              Entrega: {op.delivery_method === 'muelle' ? 'Muelle' : 'Lancha'}
                            </p>
                          </div>
                          <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                            <span className="font-medium">Total: ${calculateTotal(op.products).toFixed(2)}</span>
                            <span className="ml-4">{op.products?.length || 0} productos</span>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap justify-between text-xs text-gray-500">
                          <span>
                            Inicio: {op.order_received_date ? new Date(op.order_received_date).toLocaleDateString() : '-'}
                          </span>
                          <span>
                            Finalización: {op.closed_date ? new Date(op.closed_date).toLocaleDateString() : (op.delivery_date ? new Date(op.delivery_date).toLocaleDateString() : '-')}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap justify-between items-center">
                          <div className="flex flex-wrap gap-4 text-xs">
                            <span className={op.packing_list_file ? 'text-green-600 font-medium' : 'text-gray-400'}>
                              📄 Packing {op.packing_list_file ? '✓' : '✗'}
                            </span>
                            <span className={op.remito_file ? 'text-green-600 font-medium' : 'text-gray-400'}>
                              📋 Remito {op.remito_file ? '✓' : '✗'}
                            </span>
                            <span className={op.rancho_file ? 'text-green-600 font-medium' : 'text-gray-400'}>
                              🧾 Rancho {op.rancho_file ? '✓' : '✗'}
                            </span>
                          </div>
                          {op.status !== 'closed' && op.status !== 'cancelled' && (
                            <button
                              onClick={(e) => cancelOperation(op.id, e)}
                              className="text-xs text-red-600 hover:text-red-800 font-medium"
                            >
                              Cancelar
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}