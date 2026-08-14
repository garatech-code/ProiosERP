import { useTourStore } from '../stores/tourStore';
import logo from '../assets/logo.png';
import { useAuth } from '../context/AuthContext';

export default function AboutModal({ isOpen, onClose, frontendVersion, backendVersion }) {
    const { user } = useAuth();
    if (!isOpen) return null;

    const startTour = () => {
        onClose();
        if (user) {
            localStorage.removeItem(`tours_disabled_${user.id}`);
            const toursToClear = ['welcome', 'overview', 'calendar', 'operations', 'inbox', 'inventory', 'staff', 'approvals', 'movements', 'users', 'tracking', 'operation_selector'];
            toursToClear.forEach(t => localStorage.removeItem(`hasSeenTour_${user.id}_${t}`));
        }
        setTimeout(() => {
            const role = user?.role?.toLowerCase();
            if (['owner', 'operador', 'operador_jr'].includes(role)) {
                useTourStore.getState().startTour('welcome');
            } else {
                useTourStore.getState().startTour();
            }
        }, 300);
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 animate-fadeIn">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-slideUp border border-slate-200 dark:border-slate-700">
                <div className="p-6 text-center relative">
                    <button 
                        onClick={onClose}
                        className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    >
                        <i className="bi bi-x-lg"></i>
                    </button>

                    <div className="flex justify-center mb-4">
                        <div className="bg-indigo-50 dark:bg-indigo-900/30 p-3 rounded-2xl">
                            <img src={logo} alt="TECHSHIP Logo" className="w-16 h-16 object-contain" />
                        </div>
                    </div>

                    <h2 className="text-xl font-black text-slate-800 dark:text-white mb-1">TECHSHIP</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 font-medium">Sistema de Gestión Logística</p>

                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 mb-6 border border-slate-100 dark:border-slate-700/50">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Frontend (UI)</span>
                            <span className="font-mono text-sm font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-600 shadow-sm">{frontendVersion}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Backend (API)</span>
                            <span className="font-mono text-sm font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-600 shadow-sm">{backendVersion}</span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <button 
                            onClick={startTour}
                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 group"
                        >
                            <i className="bi bi-play-circle-fill text-lg group-hover:scale-110 transition-transform"></i>
                            Iniciar Tour Interactivo
                        </button>
                        
                        <button 
                            onClick={onClose}
                            className="w-full py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-xl font-bold transition-all"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
