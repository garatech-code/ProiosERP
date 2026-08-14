import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTourStore } from '../stores/tourStore';

export default function OperationTypeSelector({ onSelect, onClose }) {
  const { user } = useAuth();
  const { startTour, run } = useTourStore();

  useEffect(() => {
      if (!user || !user.id || run) return;
      const isAllDisabled = localStorage.getItem(`tours_disabled_${user.id}`) === 'true';
      if (isAllDisabled) return;

      const seen = localStorage.getItem(`hasSeenTour_${user.id}_operation_selector`) === 'true';
      if (!seen) {
          const timer = setTimeout(() => {
              startTour('operation_selector');
          }, 500);
          return () => clearTimeout(timer);
      }
  }, [user, startTour, run]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-fadeIn">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[95vh] flex flex-col overflow-hidden my-auto">
        
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-700/50">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">
            ¿Qué tipo de operación deseas registrar?
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-100 dark:bg-slate-600 hover:bg-gray-200 dark:hover:bg-slate-500 rounded-full p-2 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div className="p-6 md:p-8 bg-slate-50 dark:bg-slate-800/50">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Productos */}
            <button
              onClick={() => onSelect('productos')}
              className="tour-selector-productos bg-white dark:bg-slate-700 p-6 rounded-2xl border-2 border-transparent hover:border-indigo-500 hover:shadow-lg transition-all text-left group flex flex-col items-center text-center focus:outline-none focus:ring-4 focus:ring-indigo-100"
            >
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <i className="bi bi-box-seam text-3xl"></i>
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">Insumos y Repuestos</h3>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Gestión de pañol, consumibles, repuestos generales de máquina y cubierta. Cantidades en Kg/Unidades.
              </p>
            </button>

            {/* Químicos */}
            <button
              onClick={() => onSelect('quimicos')}
              className="tour-selector-quimicos bg-white dark:bg-slate-700 p-6 rounded-2xl border-2 border-transparent hover:border-emerald-500 hover:shadow-lg transition-all text-left group flex flex-col items-center text-center focus:outline-none focus:ring-4 focus:ring-emerald-100"
            >
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <i className="bi bi-droplet-half text-3xl"></i>
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">Químicos y Fórmulas</h3>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Producción y despacho de especialidades químicas. Cantidades métricas en Litros o Volumen grueso.
              </p>
            </button>

            {/* Servicios */}
            <button
              onClick={() => onSelect('servicios')}
              className="tour-selector-servicios bg-white dark:bg-slate-700 p-6 rounded-2xl border-2 border-transparent hover:border-amber-500 hover:shadow-lg transition-all text-left group flex flex-col items-center text-center focus:outline-none focus:ring-4 focus:ring-amber-100"
            >
              <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <i className="bi bi-tools text-3xl"></i>
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">Servicios Técnicos</h3>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Reparaciones a bordo, calibraciones o confección de certificados. Permite cotizar horas-hombre y añadir repuestos.
              </p>
            </button>

            {/* Otros (NUEVO) */}
            <button
              onClick={() => onSelect('otros')}
              className="bg-white dark:bg-slate-700 p-6 rounded-2xl border-2 border-transparent hover:border-gray-500 hover:shadow-lg transition-all text-left group flex flex-col items-center text-center focus:outline-none focus:ring-4 focus:ring-gray-200"
            >
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <i className="bi bi-folder text-3xl"></i>
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">Otros</h3>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Operaciones generales, sin clasificación específica. Para todo aquello que no encaje en las categorías anteriores.
              </p>
            </button>

          </div>
        </div>
      </div>
    </div>
  );
}