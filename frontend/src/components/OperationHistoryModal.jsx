import React, { useState, useEffect } from 'react';
import axios from '../api/axios';

export default function OperationHistoryModal({ isOpen, onClose, operation }) {
  const [loading, setLoading] = useState(false);
  const [detailedOp, setDetailedOp] = useState(operation);

  useEffect(() => {
    if (isOpen && operation?.id) {
      setDetailedOp(operation);
      // Fetch fresh operation details to ensure up-to-date history
      setLoading(true);
      axios.get(`/operaciones/operations/${operation.id}/`)
        .then((res) => {
          if (res.data) {
            setDetailedOp(res.data);
          }
        })
        .catch((err) => {
          console.error("Error refreshing operation history:", err);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen, operation?.id]);

  if (!isOpen || !operation) return null;

  const currentOp = detailedOp || operation;

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/D';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const formatStateName = (st) => {
    if (!st) return '';
    return st.replace(/_/g, ' ').toUpperCase();
  };

  const getStatusBadgeClass = (st) => {
    switch (st) {
      case 'recibida':
      case 'solicitud_servicio':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'cotizacion_enviada':
      case 'cotizado':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'solicitada':
      case 'permisos_pna':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      case 'armado_packing':
      case 'en_ejecucion':
        return 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800';
      case 'en_aduana':
      case 'esperando_rancho':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 border-orange-200 dark:border-orange-800';
      case 'lista_para_envio':
      case 'reporte_firmado':
        return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
      case 'entregada':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'cancelada':
        return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  const historial = currentOp.historial_estados || [];
  const fechaCreacion = currentOp.fecha_creacion || currentOp.order_received_date;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div 
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <i className="bi bi-clock-history text-xl"></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-slate-800 dark:text-white">
                  Historial de Movimientos
                </h3>
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500">
                  #OP-{String(currentOp.id).padStart(4, '0')}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-md">
                {currentOp.nombre || currentOp.ship_name || 'Operación'} · {currentOp.client_name || 'Cliente N/D'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 dark:hover:bg-slate-700 transition"
          >
            <i className="bi bi-x-lg text-sm"></i>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5 custom-scrollbar flex-1">
          {/* Tarjeta de Creación */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-700/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <i className="bi bi-file-earmark-plus text-indigo-500"></i> Origen de la Operación
              </span>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                {formatDate(fechaCreacion)}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
              <div>
                <span className="text-slate-400 block text-[11px]">Creado por</span>
                <span className="font-bold text-slate-700 dark:text-slate-200">
                  {currentOp.creado_por_nombre || 'Sistema'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Tipo</span>
                <span className="font-bold capitalize text-slate-700 dark:text-slate-200">
                  {currentOp.tipo_operacion || 'Productos'}
                </span>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <span className="text-slate-400 block text-[11px]">Estado Actual</span>
                <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${getStatusBadgeClass(currentOp.status || currentOp.estado)}`}>
                  {formatStateName(currentOp.status || currentOp.estado)}
                </span>
              </div>
            </div>
          </div>

          {/* Timeline de Movimientos */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <i className="bi bi-bezier2 text-indigo-500"></i> Línea de Tiempo de Avances
              </h4>
              <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                {historial.length} {historial.length === 1 ? 'movimiento' : 'movimientos'}
              </span>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-slate-400">
                <i className="bi bi-arrow-repeat animate-spin text-lg block mb-1"></i>
                Cargando historial...
              </div>
            ) : historial.length === 0 ? (
              <div className="py-8 px-4 text-center rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-dashed border-slate-200 dark:border-slate-700">
                <i className="bi bi-info-circle text-slate-400 text-xl block mb-1"></i>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                  Aún no se registran avances de estado en esta operación.
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Los cambios de fase o avances operativos quedarán registrados automáticamente aquí.
                </p>
              </div>
            ) : (
              <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
                {historial.map((h, idx) => {
                  return (
                    <div key={h.id || idx} className="relative group">
                      {/* Punto indicador */}
                      <div className="absolute -left-6 top-1.5 w-3.5 h-3.5 rounded-full bg-white dark:bg-slate-800 border-2 border-indigo-500 group-hover:scale-125 transition-transform"></div>
                      
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 text-xs shadow-sm hover:border-indigo-300 dark:hover:border-indigo-700 transition">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                            <i className="bi bi-check-circle-fill text-indigo-500 text-xs"></i>
                            Se cambió de estado
                          </span>
                          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            {formatDate(h.fecha)}
                          </span>
                        </div>

                        {/* Transición de estados */}
                        <div className="flex items-center gap-2 flex-wrap my-1.5">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${getStatusBadgeClass(h.estado_anterior)}`}>
                            {formatStateName(h.estado_anterior) || 'INICIO'}
                          </span>
                          <i className="bi bi-arrow-right text-slate-400"></i>
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${getStatusBadgeClass(h.estado_nuevo)}`}>
                            {formatStateName(h.estado_nuevo)}
                          </span>
                        </div>

                        {/* Metadatos */}
                        <div className="flex items-center justify-between text-[11px] pt-2 mt-2 border-t border-slate-200/60 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                          <span>
                            Usuario: <strong className="text-slate-700 dark:text-slate-200">{h.usuario_nombre || 'Sistema'}</strong>
                          </span>
                          {h.motivo && (
                            <span className="italic truncate max-w-[200px]" title={h.motivo}>
                              {h.motivo}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex justify-end bg-slate-50 dark:bg-slate-850">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
