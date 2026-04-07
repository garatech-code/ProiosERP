import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../api/axios';
import { useAuth } from '../context/AuthContext';
import OperationForm from './OperationForm';
import OperationFormWithIMO from './OperationFormWithIMO';

export default function Dashboard() {
  const [operations, setOperations] = useState([]);
  const [filteredOps, setFilteredOps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [showNormalForm, setShowNormalForm] = useState(false);
  const [showIMOForm, setShowIMOForm] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const roleDisplay = {
    OWNER: 'Gerencia',
    OPERADOR: 'Operador',
    CONTABLE: 'Contabilidad',
    OPERARIO: 'Operaciones de Planta',
    ADMIN: 'System Admin',
  };

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
    event.stopPropagation();
    if (!window.confirm('¿Cancelar esta operación?')) return;
    try {
      await axios.post(`/operations/operations/${id}/cancel_operation/`);
      fetchOperations();
    } catch (err) {
      console.error(err);
      alert('Error al cancelar la operación');
    }
  };

  const approveOperation = async (id, event) => {
    event.stopPropagation();
    if (!window.confirm('¿Aprobar esta transición (Owner)?')) return;
    alert(`Operación ${id} aprobada.`);
  };

  const getStatusBadge = (status) => {
    const maps = {
      pending: { color: 'bg-yellow-100 text-yellow-800', label: 'Pendiente' },
      pendiente_aprobacion: { color: 'bg-orange-100 text-orange-800 animate-pulse', label: 'Requiere Aprobación' },
      price_checked: { color: 'bg-blue-100 text-blue-800', label: 'Verificado' },
      confirmed: { color: 'bg-green-100 text-green-800', label: 'Confirmada' },
      in_coordination: { color: 'bg-purple-100 text-purple-800', label: 'En proceso' },
      delivered: { color: 'bg-indigo-100 text-indigo-800', label: 'Entregada' },
      closed: { color: 'bg-gray-100 text-gray-800', label: 'Cerrada' },
      cancelled: { color: 'bg-red-100 text-red-800', label: 'Cancelada' },
    };

    const mapped = maps[status] || { color: 'bg-gray-100 text-gray-800', label: status };

    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${mapped.color}`}>
        {mapped.label}
      </span>
    );
  };

  const calculateTotal = (products) => {
    if (!products) return 0;
    return products.reduce((sum, p) => sum + (p.quantity * p.unit_price), 0);
  };

  const isOwner = user?.role === 'OWNER';
  const isOperario = user?.role === 'OPERARIO';

  const closeForms = () => {
    setShowNormalForm(false);
    setShowIMOForm(false);
    setShowMobileMenu(false);
  };

  const handleSuccess = (id) => {
    closeForms();
    navigate(`/operations/${id}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* HEADER */}
      <nav className="bg-white shadow-sm sticky top-0 z-50 px-4 py-3 flex justify-between items-center">
        <h1 className="font-bold text-lg">ProIOS</h1>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm font-semibold">{user?.username}</div>
            <div className="text-xs text-indigo-600">{roleDisplay[user?.role]}</div>
          </div>
          <button onClick={logout}>Salir</button>
        </div>
      </nav>

      {/* MAIN */}
      <main className="p-4 flex-1">

        {/* TOP */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Tablero Operativo</h2>

          {!isOperario && (
            <div className="hidden sm:flex gap-2">
              <button onClick={() => setShowNormalForm(true)} className="btn">
                + Sin IMO
              </button>
              <button onClick={() => setShowIMOForm(true)} className="btn-primary">
                + Con IMO
              </button>
            </div>
          )}
        </div>

        {/* LIST */}
        {filteredOps.map(op => (
          <div key={op.id} className="bg-white p-4 rounded mb-3 shadow">
            <div className="flex justify-between">
              <div>
                <h3>{op.ship_name}</h3>
                <p>{op.client_name}</p>
              </div>
              {getStatusBadge(op.status)}
            </div>

            <div className="flex justify-between mt-3">
              <span>${calculateTotal(op.products)}</span>

              <div className="flex gap-2">
                {isOwner && (
                  <button onClick={(e) => cancelOperation(op.id, e)}>Anular</button>
                )}
                <button onClick={() => navigate(`/operations/${op.id}`)}>
                  Ver
                </button>
              </div>
            </div>
          </div>
        ))}

      </main>

      {/* FAB MOBILE */}
      {!isOperario && (
        <div className="fixed bottom-5 right-5">
          {showMobileMenu && (
            <div className="flex flex-col gap-2 mb-2">
              <button onClick={() => setShowNormalForm(true)}>Sin IMO</button>
              <button onClick={() => setShowIMOForm(true)}>Con IMO</button>
            </div>
          )}
          <button onClick={() => setShowMobileMenu(!showMobileMenu)}>
            +
          </button>
        </div>
      )}

      {/* MODALS */}
      {showNormalForm && (
        <OperationForm onClose={closeForms} onSuccess={handleSuccess} />
      )}

      {showIMOForm && (
        <OperationFormWithIMO onClose={closeForms} onSuccess={handleSuccess} />
      )}

    </div>
  );
}