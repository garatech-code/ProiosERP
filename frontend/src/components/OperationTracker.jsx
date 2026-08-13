// src/components/OperationTracker.jsx
import React from 'react';

export default function OperationTracker({ currentState, operationType }) {
    const isService = operationType === 'servicios';

    // Mapeo robusto de estados (soporta los tuyos en español e inglés)
    const getActiveStep = (state) => {
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
                    return 3;
                case 'en_ejecucion':
                    return 4;
                case 'reporte_firmado':
                case 'entregada':
                case 'closed':
                    return 5;
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

    const activeStep = getActiveStep(currentState);
    const isCancelled = activeStep === -1;

    const stepsProduct = [
        { num: 1, label: 'Recibida', icon: 'bi-inbox', desc: 'Solicitud ingresada' },
        { num: 2, label: 'Cotización', icon: 'bi-currency-dollar', desc: 'Cotización enviada' },
        { num: 3, label: 'Preparación', icon: 'bi-file-earmark-text', desc: 'Aprobada por cliente' },
        { num: 4, label: 'Suministros', icon: 'bi-box-seam', desc: 'Armado Packing List' },
        { num: 5, label: 'Aduanas', icon: 'bi-building-check', desc: 'Esperando Rancho' },
        { num: 6, label: 'Logística', icon: 'bi-truck', desc: 'Despacho y remito' },
        { num: 7, label: 'Finalizada', icon: 'bi-check-circle-fill', desc: 'Operación cerrada' },
    ];

    const stepsService = [
        { num: 1, label: 'Solicitud Recibida', icon: 'bi-file-earmark-text', desc: 'Análisis de servicio' },
        { num: 2, label: 'Cotización', icon: 'bi-currency-dollar', desc: 'Cotización enviada' },
        { num: 3, label: 'Permisos', icon: 'bi-shield-check', desc: 'Gestión PNA' },
        { num: 4, label: 'Ejecución', icon: 'bi-tools', desc: 'Trabajo a bordo' },
        { num: 5, label: 'Reporte Final', icon: 'bi-check-circle-fill', desc: 'Servicio finalizado' },
    ];

    const steps = isService ? stepsService : stepsProduct;

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
                    className="absolute left-[19px] top-6 w-0.5 bg-indigo-500 transition-all duration-1000 ease-in-out"
                    style={{ height: `${Math.max(0, ((activeStep - 1) / (steps.length - 1)) * 100)}%` }}
                ></div>

                <div className="flex flex-col justify-between h-full relative z-10">
                    {steps.map((step) => {
                        const isCompleted = step.num < activeStep;
                        const isCurrent = step.num === activeStep;
                        const isPending = step.num > activeStep;

                        return (
                            <div key={step.num} className={`flex items-start gap-4 group transition-opacity duration-500 ${isPending ? 'opacity-40' : 'opacity-100'}`}>
                                {/* Indicador Circular */}
                                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 transition-all duration-500 shadow-sm
                  ${isCompleted ? 'bg-indigo-500 border-indigo-500 text-white' : ''}
                  ${isCurrent ? 'bg-white dark:bg-slate-800 border-indigo-500 text-indigo-600 ring-4 ring-indigo-50 dark:ring-indigo-900/50 scale-110' : ''}
                  ${isPending ? 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-500' : ''}
                `}>
                                    {isCompleted ? <i className="bi bi-check-lg text-lg"></i> : <i className={`bi ${step.icon} text-sm`}></i>}
                                </div>

                                {/* Textos */}
                                <div className={`pt-1 transition-all duration-300 ${isCurrent ? 'transform translate-x-1' : ''}`}>
                                    <h4 className={`text-sm font-bold ${isCurrent ? 'text-indigo-700 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                        {step.label}
                                    </h4>
                                    <p className="text-xs font-medium text-slate-500 dark:text-slate-500 mt-0.5 leading-tight">{step.desc}</p>

                                    {isCurrent && (
                                        <span className="inline-block mt-2 px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 text-[9px] font-black rounded uppercase tracking-wider animate-pulse">
                                            Fase Actual
                                        </span>
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