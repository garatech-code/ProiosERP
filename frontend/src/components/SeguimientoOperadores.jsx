import { useState, useEffect } from 'react';
import axios from '../api/axios';
import LogoSpinner from './LogoSpinner';

export default function SeguimientoOperadores() {
  const [loading, setLoading] = useState(true);
  const [operators, setOperators] = useState([]);
  const [operations, setOperations] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, opsRes] = await Promise.all([
        axios.get('/usuarios/users/?role=OPERADOR'),
        axios.get('/operaciones/operations/?page_size=500') // fetch recent ops
      ]);
      setOperators(usersRes.data?.results || usersRes.data || []);
      setOperations(opsRes.data?.results || opsRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const calculateMetrics = (operatorId) => {
    // Cotizadas por este operador
    const quotedOps = operations.filter(op => op.quoted_by === operatorId && op.quotation_sent_date);
    // Confirmadas (que el operador haya cotizado o esté asignado y que tengan fecha de confirmación)
    const confirmedOps = operations.filter(op => 
      (op.quoted_by === operatorId || op.operadores_id?.includes(operatorId)) && op.client_confirmed_date
    );
    // Cerradas por este operador
    const closedOps = operations.filter(op => op.closed_by === operatorId && op.closed_date);

    // Calcular promedios de tiempo
    let totalQuoteTime = 0;
    let validQuoteTimes = 0;
    quotedOps.forEach(op => {
      if (op.order_received_date && op.quotation_sent_date) {
        const diff = new Date(op.quotation_sent_date) - new Date(op.order_received_date);
        if (diff > 0) {
          totalQuoteTime += diff;
          validQuoteTimes++;
        }
      }
    });

    let totalCloseTime = 0;
    let validCloseTimes = 0;
    closedOps.forEach(op => {
      if (op.client_confirmed_date && op.closed_date) {
        const diff = new Date(op.closed_date) - new Date(op.client_confirmed_date);
        if (diff > 0) {
          totalCloseTime += diff;
          validCloseTimes++;
        }
      }
    });

    return {
      quotedCount: quotedOps.length,
      confirmedCount: confirmedOps.length,
      closedCount: closedOps.length,
      avgQuoteTimeMs: validQuoteTimes > 0 ? totalQuoteTime / validQuoteTimes : 0,
      avgCloseTimeMs: validCloseTimes > 0 ? totalCloseTime / validCloseTimes : 0
    };
  };

  const formatDuration = (ms) => {
    if (ms === 0) return 'N/A';
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const delayedQuotedOps = operations.filter(op => {
    if (op.dificil_conseguir || op.quotation_sent_date || op.estado === 'cancelada') return false;
    if (!op.order_received_date) return false;
    const hoursDiff = (new Date() - new Date(op.order_received_date)) / (1000 * 60 * 60);
    return hoursDiff >= 24;
  });

  if (loading) return <div className="flex justify-center p-8"><LogoSpinner size="w-12 h-12" /></div>;

  return (
    <div className="space-y-6">
      {/* Alertas */}
      {delayedQuotedOps.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl shadow-sm">
          <div className="flex items-center gap-2 text-red-800 font-bold mb-2">
            <i className="bi bi-exclamation-triangle-fill"></i>
            Operaciones Demoradas para Cotizar ({'>'}24hs)
          </div>
          <ul className="text-sm text-red-700 space-y-1">
            {delayedQuotedOps.map(op => {
               const hours = Math.floor((new Date() - new Date(op.order_received_date)) / (1000 * 60 * 60));
               return (
                 <li key={op.id}>
                   <span className="font-semibold">OP-{op.id}</span> ({op.client_name}) - Demora: {hours}hs
                 </li>
               )
            })}
          </ul>
        </div>
      )}

      {/* Tarjetas de Operadores */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {operators.map(operator => {
          const metrics = calculateMetrics(operator.id);
          return (
            <div key={operator.id} className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                  {operator.first_name?.[0] || operator.username?.[0]}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">{operator.first_name} {operator.last_name}</h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">{operator.email}</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 dark:text-slate-400">Operaciones Cotizadas</span>
                  <span className="font-bold text-gray-900 dark:text-white">{metrics.quotedCount}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 dark:text-slate-400">Operaciones Confirmadas</span>
                  <span className="font-bold text-green-600 dark:text-green-400">{metrics.confirmedCount}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 dark:text-slate-400">Operaciones Cerradas</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">{metrics.closedCount}</span>
                </div>
                
                <div className="border-t border-gray-100 dark:border-slate-700 my-2 pt-2 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-500 dark:text-slate-400">Tiempo Prom. Cotización</span>
                    <span className="font-semibold text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded-lg">
                      {formatDuration(metrics.avgQuoteTimeMs)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-500 dark:text-slate-400">Tiempo Prom. Ejecución</span>
                    <span className="font-semibold text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded-lg">
                      {formatDuration(metrics.avgCloseTimeMs)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
