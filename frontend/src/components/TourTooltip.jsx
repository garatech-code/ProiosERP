import React from 'react';

export default function TourTooltip({
    index,
    step,
    backProps,
    closeProps,
    primaryProps,
    skipProps,
    tooltipProps,
    isLastStep,
}) {
    return (
        <div 
            {...tooltipProps} 
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-[320px] sm:w-[380px] overflow-hidden border border-slate-200 dark:border-slate-700"
        >
            <div className="p-5 relative">
                {/* Botón de Cerrar (X) */}
                <button 
                    {...closeProps} 
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    title="Cerrar"
                >
                    <i className="bi bi-x-lg"></i>
                </button>
                
                {/* Título y Contenido */}
                {step.title && (
                    <h3 className="text-lg font-black text-slate-800 dark:text-white mb-2 pr-6">
                        {step.title}
                    </h3>
                )}
                <div className="text-sm text-slate-600 dark:text-slate-300 font-medium mb-6">
                    {step.content}
                </div>
                
                {/* Botones de Acción */}
                <div className="flex justify-between items-center mt-2">
                    {/* Botón Atrás o Saltar (Desactivar) */}
                    {index > 0 ? (
                        <button 
                            {...backProps} 
                            className="text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors px-2 py-1"
                        >
                            Atrás
                        </button>
                    ) : (
                        <button 
                            {...skipProps} 
                            className="text-sm font-bold text-slate-400 hover:text-red-500 transition-colors px-2 py-1"
                            title="Desactivar todos los tours futuros"
                        >
                            Desactivar tours
                        </button>
                    )}
                    
                    {/* Botón Principal (Siguiente / Finalizar) */}
                    <button 
                        {...primaryProps} 
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all active:scale-95"
                    >
                        {isLastStep ? 'Finalizar' : 'Siguiente'}
                    </button>
                </div>
            </div>
        </div>
    );
}
