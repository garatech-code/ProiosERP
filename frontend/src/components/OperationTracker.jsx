// src/components/OperationTracker.jsx
import React from 'react';

export const STEPS_PRODUCT = [
    { num: 1, label: 'Recibida', shortLabel: 'Recibida', icon: 'bi-inbox', desc: 'Solicitud ingresada' },
    { num: 2, label: 'Cotización enviada', shortLabel: 'Cotización', icon: 'bi-send-check', desc: 'Esperando respuesta' },
    { num: 3, label: 'Preparación', shortLabel: 'Prep.', icon: 'bi-file-earmark-text', desc: 'Aprobada por cliente' },
    { num: 4, label: 'Suministros', shortLabel: 'Packing', icon: 'bi-box-seam', desc: 'Armado Packing List' },
    { num: 5, label: 'Aduanas', shortLabel: 'Aduana', icon: 'bi-building-check', desc: 'Esperando Rancho' },
    { num: 6, label: 'Logística', shortLabel: 'Logística', icon: 'bi-truck', desc: 'Despacho y remito' },
    { num: 7, label: 'Cerrar Operación', shortLabel: 'Fin', icon: 'bi-check-circle-fill', desc: 'Operación cerrada' },
];

export const STEPS_SERVICE = [
    { num: 1, label: 'Solicitud Recibida', shortLabel: 'Recibida', icon: 'bi-file-earmark-text', desc: 'Análisis de servicio' },
    { num: 2, label: 'Cotización enviada', shortLabel: 'Cotización', icon: 'bi-send-check', desc: 'Esperando respuesta' },
    { num: 3, label: 'Ejecución', shortLabel: 'Ejecución', icon: 'bi-tools', desc: 'Trabajo a bordo' },
    { num: 4, label: 'Cerrar Operación', shortLabel: 'Reporte', icon: 'bi-check-circle-fill', desc: 'Servicio finalizado' },
];

export const getActiveTrackerStep = (state, isService) => {
    if (state === 'cancelada' || state === 'cancelled') return -1;

    if (isService) {
        switch (state) {
            case 'recibida':
            case 'solicitud_servicio':
            case 'solicitada': // Fallback si quedó con el estado viejo
                return 1;
            case 'cotizado':
                return 2;
            case 'permisos_pna':
            case 'en_ejecucion':
                return 3;
            case 'reporte_firmado':
            case 'entregada':
            case 'closed':
                return 4;
            default:
                return 1;
        }
    } else {
        switch (state) {
            case 'recibida':
                return 1;
            case 'cotizacion_enviada':
                return 2;
            case 'solicitada':
                return 3;
            case 'armado_packing':
                return 4;
            case 'en_aduana':
                return 5;
            case 'lista_para_envio':
            case 'remitada':
                return 6;
            case 'entregada':
            case 'closed':
                return 7;
            default:
                return 1;
        }
    }
};

export function QuickOperationTracker({ currentState, operationType }) {
    const isService = operationType === 'servicios';
    const activeStep = getActiveTrackerStep(currentState, isService);
    const isCancelled = activeStep === -1;
    const steps = isService ? STEPS_SERVICE : STEPS_PRODUCT;

    if (isCancelled) {
        return (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-xl text-xs font-bold border border-red-200 dark:border-red-800">
                <i className="bi bi-x-octagon-fill text-red-500 text-sm"></i>
                <span>Operación Anulada</span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-100/90 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/80 px-2 sm:px-3 py-1 rounded-xl shadow-xs">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0">
                <i className="bi bi-signpost-split text-indigo-500 text-sm"></i>
                <span className="hidden xl:inline text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Flujo:
                </span>
                <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-200/50 dark:border-indigo-800/50">
                    {activeStep}/{steps.length}
                </span>
            </div>

            <div className="flex items-center gap-1">
                {steps.map((step, idx) => {
                    const isCompleted = step.num < activeStep;
                    const isCurrent = step.num === activeStep;

                    return (
                        <React.Fragment key={step.num}>
                            {idx > 0 && (
                                <div className={`h-0.5 w-1.5 sm:w-2 rounded-full transition-colors ${
                                    isCompleted ? 'bg-emerald-500' : isCurrent ? 'bg-indigo-400' : 'bg-slate-200 dark:bg-slate-700'
                                }`} />
                            )}

                            {isCurrent ? (
                                <div
                                    title={`Fase Actual (${step.num}/${steps.length}): ${step.label} - ${step.desc}`}
                                    className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-sm shadow-indigo-500/25 ring-2 ring-indigo-400/40 animate-pulse cursor-help"
                                >
                                    <i className={`bi ${step.icon} text-xs`}></i>
                                    <span className="whitespace-nowrap font-black">{step.label}</span>
                                </div>
                            ) : isCompleted ? (
                                <div
                                    title={`${step.num}. ${step.label} (Completado) - ${step.desc}`}
                                    className="w-6 h-6 rounded-lg bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shadow-xs hover:scale-105 transition-transform cursor-help"
                                >
                                    <i className="bi bi-check-lg text-xs"></i>
                                </div>
                            ) : (
                                <div
                                    title={`${step.num}. ${step.label} (Pendiente) - ${step.desc}`}
                                    className="w-6 h-6 rounded-lg bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[10px] font-bold hover:scale-105 transition-transform cursor-help"
                                >
                                    {step.num}
                                </div>
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
}

export default function OperationTracker({ currentState, operationType, operation }) {
    const isService = operationType === 'servicios';
    const activeStep = getActiveTrackerStep(currentState, isService);
    const isCancelled = activeStep === -1;
    const steps = isService ? STEPS_SERVICE : STEPS_PRODUCT;
    const isClosed = currentState === 'entregada' || currentState === 'closed';

    if (isCancelled) {
        return (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-6 flex flex-col items-center justify-center text-center h-full min-h-[400px]">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/50 text-red-500 rounded-full flex items-center justify-center text-2xl mb-4 shadow-inner">
                    <i className="bi bi-x-octagon-fill"></i>
                </div>
                <h3 className="text-red-800 dark:text-red-300 font-black text-lg">Operación Anulada</h3>
                <p className="text-red-600 dark:text-red-400 text-xs font-medium mt-2 px-4">El flujo de esta operación ha sido interrumpido permanentemente.</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 h-full flex flex-col sticky top-24 min-h-[500px]">
            <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-4 shrink-0">
                <i className="bi bi-signpost-split text-indigo-500 text-lg"></i>
                Estado del Flujo {isService && <span className="text-[10px] bg-slate-100 dark:bg-slate-900/30 text-slate-600 px-2 py-0.5 rounded ml-auto">SERVICIOS</span>}
            </h3>

            <div className="flex-1 relative py-2">
                {/* Línea vertical de fondo */}
                <div className="absolute left-[19px] top-6 bottom-6 w-0.5 bg-slate-100 dark:bg-slate-700"></div>

                {/* Línea vertical animada (progreso) */}
                <div
                    className={`absolute left-[19px] top-6 w-0.5 transition-all duration-1000 ease-in-out ${isClosed ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                    style={{ height: `${Math.max(0, ((activeStep - 1) / (steps.length - 1)) * 100)}%` }}
                ></div>

                <div className="flex flex-col justify-between h-full relative z-10">
                    {steps.map((step) => {
                        const isCompleted = step.num < activeStep || (isClosed && step.num === steps.length);
                        const isCurrent = step.num === activeStep && !isClosed;
                        const isPending = step.num > activeStep;
                        const isFinalCompleted = isClosed && step.num === steps.length;

                        return (
                            <div key={step.num} className={`flex items-start gap-4 group transition-opacity duration-500 ${isPending ? 'opacity-40' : 'opacity-100'}`}>
                                {/* Indicador Circular */}
                                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 transition-all duration-500 shadow-sm
                  ${isFinalCompleted ? 'bg-emerald-500 border-emerald-500 text-white ring-4 ring-emerald-50 dark:ring-emerald-900/40' : ''}
                  ${isCompleted && !isFinalCompleted ? 'bg-indigo-500 border-indigo-500 text-white' : ''}
                  ${isCurrent ? 'bg-white dark:bg-slate-800 border-indigo-500 text-indigo-600 ring-4 ring-indigo-50 dark:ring-indigo-900/50 scale-110' : ''}
                  ${isPending ? 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-500' : ''}
                `}>
                                    {isFinalCompleted ? (
                                        <i className="bi bi-check-circle-fill text-lg"></i>
                                    ) : isCompleted ? (
                                        <i className="bi bi-check-lg text-lg"></i>
                                    ) : (
                                        <i className={`bi ${step.icon} text-sm`}></i>
                                    )}
                                </div>

                                {/* Textos */}
                                <div className={`pt-1 transition-all duration-300 ${isCurrent ? 'transform translate-x-1' : ''}`}>
                                    <h4 className={`text-sm font-bold ${isFinalCompleted ? 'text-emerald-700 dark:text-emerald-400' : isCurrent ? 'text-indigo-700 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                        {step.label}
                                    </h4>
                                    <p className="text-xs font-medium text-slate-500 dark:text-slate-500 mt-0.5 leading-tight">{step.desc}</p>

                                    {isFinalCompleted && (
                                        <span className="inline-block mt-2 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[9px] font-black rounded uppercase tracking-wider">
                                            Operación Cerrada
                                        </span>
                                    )}

                                    {isCurrent && (
                                        <span className="inline-block mt-2 px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 text-[9px] font-black rounded uppercase tracking-wider animate-pulse">
                                            Fase Actual
                                        </span>
                                    )}

                                    {/* Contador de inactividad de 24hs en Paso 1 */}
                                    {step.num === 1 && operation && (
                                        operation.alerta_inactividad_24h_enviada ? (
                                            <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-[9px] font-bold rounded">
                                                <i className="bi bi-exclamation-triangle-fill"></i> Alerta 24h enviada a Eva
                                            </span>
                                        ) : !operation.presenta_avances && operation.fecha_inicio_control_operador && operation.tiempo_restante_24h !== null && operation.tiempo_restante_24h !== undefined ? (
                                            <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 text-[9px] font-bold rounded">
                                                <i className="bi bi-stopwatch"></i> Plazo: {operation.tiempo_restante_24h}h restantes
                                            </span>
                                        ) : operation.presenta_avances ? (
                                            <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-[9px] font-semibold rounded">
                                                <i className="bi bi-check2"></i> Avance registrado
                                            </span>
                                        ) : null
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}