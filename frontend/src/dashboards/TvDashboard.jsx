import { useState, useEffect } from 'react';
import axios from '../api/axios';
import LogoSpinner from '../components/LogoSpinner';

export default function TvDashboard() {
  const [operations, setOperations] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOperations = async () => {
    try {
      const res = await axios.get('/operaciones/operations/?page_size=100');
      // Filtrar las que no están cerradas ni canceladas
      const activeOps = (res.data?.results || res.data || []).filter(
        op => op.estado !== 'entregada' && op.estado !== 'cancelada'
      );
      setOperations(activeOps);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOperations();
    const interval = setInterval(fetchOperations, 60000); // Refrescar cada 1 min
    return () => clearInterval(interval);
  }, []);

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatElapsed = (startDate) => {
    if (!startDate) return 'N/A';
    const diff = Math.floor((currentTime - new Date(startDate)) / 1000); // en segundos
    if (diff < 0) return '0h 0m';
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    return `${h}h ${m}m`;
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white"><LogoSpinner /></div>;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <header className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-3xl font-black text-indigo-400">PROIOS <span className="text-white">TV</span></h1>
          <p className="text-slate-400">Operaciones Activas</p>
        </div>
        <div className="text-2xl font-bold font-mono text-indigo-400">
          {currentTime.toLocaleTimeString()}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {operations.map(op => {
          const receivedDateStr = op.order_received_date || op.creado_en || op.created_at; // Asumimos un fallback si es vieja
          const receivedDate = receivedDateStr ? new Date(receivedDateStr) : new Date();
          const hoursElapsed = receivedDateStr ? (currentTime - receivedDate) / (1000 * 60 * 60) : 0;
          const isDelayed = hoursElapsed > 24 && op.estado === 'recibida' && !op.dificil_conseguir;

          return (
            <div key={op.id} className={`bg-slate-800 border-l-4 rounded-xl p-6 shadow-lg ${isDelayed ? 'border-red-500' : 'border-indigo-500'}`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-bold">OP-{op.id}</h2>
                  <h3 className="text-slate-300 font-semibold">{op.client_name || op.cliente || 'Cliente no definido'}</h3>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${isDelayed ? 'bg-red-500/20 text-red-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                  {op.estado.replace('_', ' ')}
                </span>
              </div>
              
              <p className="text-sm text-slate-400 mb-4 line-clamp-2">
                {op.ship_name || op.ship || 'Buque no definido'} • ETA: {op.eta ? new Date(op.eta).toLocaleDateString() : 'N/A'}
              </p>

              <div className="bg-slate-900 rounded-lg p-4 flex items-center justify-between">
                <div className="text-sm text-slate-400">Tiempo Activa</div>
                <div className={`text-xl font-mono font-bold ${isDelayed ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
                  {formatElapsed(receivedDateStr)}
                </div>
              </div>
            </div>
          );
        })}
        {operations.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-500">
            No hay operaciones activas en este momento.
          </div>
        )}
      </div>
    </div>
  );
}
