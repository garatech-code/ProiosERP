import { useState, useEffect } from 'react';
import axios from '../api/axios';
import LogoSpinner from './LogoSpinner';
import * as XLSX from 'xlsx';

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
        axios.get('/usuarios/users/'),
        axios.get('/operaciones/operations/?page_size=500') // fetch recent ops
      ]);
      const allUsers = usersRes.data?.results || usersRes.data || [];
      const opUsers = allUsers.filter(u => u.role === 'OPERADOR' || u.role === 'OPERADOR_JR');
      setOperators(opUsers);
      setOperations(opsRes.data?.results || opsRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const calculateOperationValue = (op) => {
    if (!op.products || !Array.isArray(op.products)) return 0;
    return op.products.reduce((sum, p) => sum + (p.quantity * (parseFloat(p.unit_price) || 0)), 0);
  };

  const validProjectedStates = ['confirmed', 'in_coordination', 'delivered', 'closed'];

  const calculateGlobalKPIs = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    let currentMonthTotal = 0;
    let previousMonthTotal = 0;
    let totalQuotedGlobal = 0;
    let totalConfirmedGlobal = 0;

    operations.forEach(op => {
      // Conversion Global
      if (op.quotation_sent_date) {
        totalQuotedGlobal++;
        if (op.client_confirmed_date) {
          totalConfirmedGlobal++;
        }
      }

      // Projected Values based on confirmed date
      if (validProjectedStates.includes(op.status) && op.client_confirmed_date) {
        const confirmedDate = new Date(op.client_confirmed_date);
        const opValue = calculateOperationValue(op);
        
        if (confirmedDate.getMonth() === currentMonth && confirmedDate.getFullYear() === currentYear) {
          currentMonthTotal += opValue;
        } else if (confirmedDate.getMonth() === previousMonth && confirmedDate.getFullYear() === previousYear) {
          previousMonthTotal += opValue;
        }
      }
    });

    const conversionRate = totalQuotedGlobal > 0 ? (totalConfirmedGlobal / totalQuotedGlobal) * 100 : 0;
    
    let monthOverMonthChange = 0;
    if (previousMonthTotal > 0) {
      monthOverMonthChange = ((currentMonthTotal - previousMonthTotal) / previousMonthTotal) * 100;
    } else if (currentMonthTotal > 0) {
      monthOverMonthChange = 100;
    }

    return { currentMonthTotal, previousMonthTotal, conversionRate, monthOverMonthChange };
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

    // New metrics
    const conversionRate = quotedOps.length > 0 ? (confirmedOps.length / quotedOps.length) * 100 : 0;
    let projectedValue = 0;
    confirmedOps.forEach(op => {
       if (validProjectedStates.includes(op.status)) {
           projectedValue += calculateOperationValue(op);
       }
    });

    return {
      quotedCount: quotedOps.length,
      confirmedCount: confirmedOps.length,
      closedCount: closedOps.length,
      avgQuoteTimeMs: validQuoteTimes > 0 ? totalQuoteTime / validQuoteTimes : 0,
      avgCloseTimeMs: validCloseTimes > 0 ? totalCloseTime / validCloseTimes : 0,
      conversionRate,
      projectedValue
    };
  };

  const formatDuration = (ms) => {
    if (ms === 0) return 'N/A';
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  };

  const delayedQuotedOps = operations.filter(op => {
    if (op.dificil_conseguir || op.quotation_sent_date || op.estado === 'cancelada') return false;
    if (!op.order_received_date) return false;
    const hoursDiff = (new Date() - new Date(op.order_received_date)) / (1000 * 60 * 60);
    return hoursDiff >= 24;
  });

  if (loading) return <div className="flex justify-center p-8"><LogoSpinner size="w-12 h-12" /></div>;

  const globalKPIs = calculateGlobalKPIs();

  const handleExportExcel = () => {
    // 1. Prepare Global Data
    const globalData = [{
      "Total Proyectado (Mes Actual)": globalKPIs.currentMonthTotal, // RAW value for Excel to format if needed, but since formatCurrency has symbol, we output string
      "Total Proyectado (String)": formatCurrency(globalKPIs.currentMonthTotal),
      "Tasa de Conversión Global": globalKPIs.conversionRate.toFixed(1) + "%",
      "Proyectado Mes Anterior": formatCurrency(globalKPIs.previousMonthTotal),
      "Crecimiento Intermensual": globalKPIs.monthOverMonthChange.toFixed(1) + "%"
    }];

    // 2. Prepare Operator Data
    const operatorData = operators.map(op => {
      const m = calculateMetrics(op.id);
      return {
        "Operador": `${op.first_name || ''} ${op.last_name || ''}`.trim() || op.username,
        "Email": op.email,
        "Aporte Proyectado": formatCurrency(m.projectedValue),
        "Tasa Conversión": m.conversionRate.toFixed(1) + "%",
        "Cotizadas": m.quotedCount,
        "Confirmadas": m.confirmedCount,
        "Cerradas": m.closedCount,
        "Tiempo Prom. Cotización": formatDuration(m.avgQuoteTimeMs),
        "Tiempo Prom. Cierre": formatDuration(m.avgCloseTimeMs)
      };
    });

    // 3. Create Workbook
    const wb = XLSX.utils.book_new();
    const wsGlobal = XLSX.utils.json_to_sheet(globalData);
    const wsOperators = XLSX.utils.json_to_sheet(operatorData);
    
    // Auto-size columns (basic)
    wsOperators['!cols'] = [
      { wch: 25 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, 
      { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 22 }, { wch: 22 }
    ];

    XLSX.utils.book_append_sheet(wb, wsGlobal, "KPIs Globales");
    XLSX.utils.book_append_sheet(wb, wsOperators, "Rendimiento Operadores");

    // 4. Download
    XLSX.writeFile(wb, "Seguimiento_Operadores.xlsx");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-black text-gray-900 dark:text-white">Seguimiento Comercial</h2>
        <button 
          onClick={handleExportExcel}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-xl flex items-center gap-2 shadow-sm transition-colors text-sm"
        >
          <i className="bi bi-file-earmark-excel"></i>
          Exportar a Excel
        </button>
      </div>

      {/* Panel de KPIs Globales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Total Proyectado */}
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
           <div className="relative z-10">
              <h3 className="text-indigo-100 text-sm font-medium uppercase tracking-wider mb-1">Total Proyectado (Mes Actual)</h3>
              <div className="text-4xl font-black mb-2">{formatCurrency(globalKPIs.currentMonthTotal)}</div>
              <div className="flex items-center gap-2 text-sm font-medium">
                 <span className={`px-2 py-0.5 rounded-full ${globalKPIs.monthOverMonthChange >= 0 ? 'bg-green-400/20 text-green-100' : 'bg-red-400/20 text-red-100'}`}>
                    {globalKPIs.monthOverMonthChange >= 0 ? '↑' : '↓'} {Math.abs(globalKPIs.monthOverMonthChange).toFixed(1)}% vs anterior
                 </span>
              </div>
           </div>
           <i className="bi bi-graph-up-arrow absolute -right-6 -bottom-6 text-9xl opacity-10"></i>
        </div>

        {/* Tasa de Conversión Global */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-sm flex flex-col justify-between">
           <div>
              <h3 className="text-gray-500 dark:text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">Tasa de Conversión Global</h3>
              <div className="text-4xl font-black text-gray-900 dark:text-white">{globalKPIs.conversionRate.toFixed(1)}%</div>
           </div>
           <p className="text-sm text-gray-500 mt-4 font-medium">Cotizaciones convertidas en ventas firmes.</p>
        </div>

        {/* Comparativa Mes Anterior */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-sm flex flex-col justify-between">
           <div>
              <h3 className="text-gray-500 dark:text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">Proyectado Mes Anterior</h3>
              <div className="text-4xl font-black text-gray-400 dark:text-slate-500">{formatCurrency(globalKPIs.previousMonthTotal)}</div>
           </div>
           <p className="text-sm text-gray-500 mt-4 font-medium">Cierre total de operaciones del mes pasado.</p>
        </div>
      </div>

      {/* Alertas */}
      {delayedQuotedOps.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-xl shadow-sm">
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
      <h3 className="text-lg font-black text-gray-900 dark:text-white mb-4">Rendimiento por Operador</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {operators.map(operator => {
          const metrics = calculateMetrics(operator.id);
          return (
            <div key={operator.id} className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                    {operator.first_name?.[0] || operator.username?.[0]}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">{operator.first_name} {operator.last_name}</h3>
                    <p className="text-xs text-gray-500 dark:text-slate-400">{operator.email}</p>
                  </div>
                </div>
                {/* Tasa de conversión individual badge */}
                <div className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded-lg text-xs font-bold border border-indigo-100 dark:border-indigo-800">
                  {metrics.conversionRate.toFixed(1)}% Conv.
                </div>
              </div>
              
              <div className="space-y-3">
                {/* Valor Proyectado Individual (Highlight) */}
                <div className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-xl mb-4 border border-slate-100 dark:border-slate-600">
                   <p className="text-xs text-gray-500 dark:text-slate-400 font-medium uppercase tracking-wider mb-1">Aporte Proyectado</p>
                   <p className="text-xl font-black text-indigo-600 dark:text-indigo-400">{formatCurrency(metrics.projectedValue)}</p>
                </div>

                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 dark:text-slate-400">Cotizadas</span>
                  <span className="font-bold text-gray-900 dark:text-white">{metrics.quotedCount}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 dark:text-slate-400">Confirmadas</span>
                  <span className="font-bold text-green-600 dark:text-green-400">{metrics.confirmedCount}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 dark:text-slate-400">Cerradas</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">{metrics.closedCount}</span>
                </div>
                
                <div className="border-t border-gray-100 dark:border-slate-700 my-2 pt-2 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-500 dark:text-slate-400">T. Prom. Cotización</span>
                    <span className="font-semibold text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded-lg">
                      {formatDuration(metrics.avgQuoteTimeMs)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-500 dark:text-slate-400">T. Prom. Ejecución</span>
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
