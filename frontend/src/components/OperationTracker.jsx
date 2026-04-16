// src/components/OperationTracker.jsx
import React from 'react';

export default function OperationTracker({ currentState }) {
    // Mapeo robusto de estados (soporta los tuyos en español e inglés)
    const getActiveStep = (state) => {
        if (state === 'cancelada' || state === 'cancelled') return -1;
        switch (state) {
            case 'solicitada':
            case 'pending':
                return 1;
            case 'presupuestada':
            case 'price_checked':
                return 2;
            case 'en_produccion':
            case 'in_coordination':
                return 3;
            case 'lista_para_envio':
            case 'confirmed':
            case 'remitada':
            case 'delivered':
                return 4;
            case 'entregada':
            case 'closed':
                return 5;
            default:
                return 1;
        }
    };

    const activeStep = getActiveStep(currentState);
    const isCancelled = activeStep === -1;

    const steps = [
        { num: 1, label: 'Solicitada', icon: 'bi-file-earmark-text', desc: 'Orden ingresada' },
        { num: 2, label: 'Presupuestada', icon: 'bi-calculator', desc: 'Precios y stock' },
        { num: 3, label: 'En Producción', icon: 'bi-gear-fill', desc: 'Preparando carga' },
        { num: 4, label: 'Logística', icon: 'bi-truck', desc: 'Despacho y remito' },
        { num: 5, label: 'Finalizada', icon: 'bi-check-circle-fill', desc: 'Operación cerrada' },
    ];

    if (isCancelled) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex flex-col items-center justify-center text-center h-full min-h-[400px]">
                <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center text-2xl mb-4 shadow-inner">
                    <i className="bi bi-x-octagon-fill"></i>
                </div>
                <h3 className="text-red-800 font-black text-lg">Operación Anulada</h3>
                <p className="text-red-600 text-xs font-medium mt-2 px-4">El flujo de esta operación ha sido interrumpido permanentemente.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 h-full flex flex-col sticky top-24 min-h-[500px]">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-slate-100 pb-4 shrink-0">
                <i className="bi bi-signpost-split text-indigo-500 text-lg"></i>
                Estado del Flujo
            </h3>

            <div className="flex-1 relative py-2">
                {/* Línea vertical de fondo */}
                <div className="absolute left-[19px] top-6 bottom-6 w-0.5 bg-slate-100"></div>

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
                  ${isCurrent ? 'bg-white border-indigo-500 text-indigo-600 ring-4 ring-indigo-50 scale-110' : ''}
                  ${isPending ? 'bg-white border-slate-200 text-slate-400' : ''}
                `}>
                                    {isCompleted ? <i className="bi bi-check-lg text-lg"></i> : <i className={`bi ${step.icon} text-sm`}></i>}
                                </div>

                                {/* Textos */}
                                <div className={`pt-1 transition-all duration-300 ${isCurrent ? 'transform translate-x-1' : ''}`}>
                                    <h4 className={`text-sm font-bold ${isCurrent ? 'text-indigo-700' : 'text-slate-700'}`}>
                                        {step.label}
                                    </h4>
                                    <p className="text-xs font-medium text-slate-500 mt-0.5 leading-tight">{step.desc}</p>

                                    {isCurrent && (
                                        <span className="inline-block mt-2 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[9px] font-black rounded uppercase tracking-wider animate-pulse">
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