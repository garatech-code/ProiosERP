import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function NotificationMenu() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [filter, setFilter] = useState('all'); // 'all' | 'high'
    const [loading, setLoading] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 25000);
        return () => clearInterval(interval);
    }, []);

    // Cerrar al hacer clic fuera
    useEffect(() => {
        function handleClickOutside(event) {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const fetchNotifications = async () => {
        try {
            const res = await axios.get('/usuarios/notificaciones/');
            const data = res.data?.results || res.data;
            if (Array.isArray(data)) {
                setNotifications(data);
            }
        } catch (err) {
            console.error("Error al cargar notificaciones:", err);
        }
    };

    const handleSelectNotification = async (n) => {
        setIsOpen(false);
        if (n.id && !String(n.id).startsWith('op_')) {
            try {
                await axios.post(`/usuarios/notificaciones/${n.id}/mark_read/`);
            } catch (err) {
                console.error(err);
            }
        }
        if (n.operacion_id) {
            navigate(`/operations/${n.operacion_id}`);
        }
    };

    const markAllRead = async () => {
        try {
            await axios.post(`/usuarios/notificaciones/mark_all_read/`);
            fetchNotifications();
        } catch (err) {
            console.error(err);
        }
    };

    const unreadCount = notifications.filter(n => !n.leida).length;

    const filteredList = notifications.filter(n => {
        if (filter === 'high') return n.prioridad === 'alta';
        return true;
    });

    const getFaseColor = (fase) => {
        switch (fase) {
            case 'Cotización Inicial':
            case 'Cotización de Servicio':
                return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800';
            case 'Confirmación de Cliente':
            case 'Aprobación de Cotización':
                return 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800';
            case 'Armado de Packing List':
            case 'Preparación de Suministros':
            case 'Ejecución de Servicio':
                return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800';
            case 'Trámite Aduanal':
            case 'Confirmación de Rancho':
            case 'Permisos PNA':
                return 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border-orange-200 dark:border-orange-800';
            case 'Logística y Despacho':
            case 'Cierre Operativo':
                return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
            case 'Revisión Pendiente':
                return 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border-red-200 dark:border-red-800 animate-pulse';
            default:
                return 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600';
        }
    };

    const getFaseIcon = (fase) => {
        switch (fase) {
            case 'Cotización Inicial':
            case 'Cotización de Servicio':
                return 'bi-cash-coin';
            case 'Confirmación de Cliente':
            case 'Aprobación de Cotización':
                return 'bi-envelope-check';
            case 'Armado de Packing List':
            case 'Preparación de Suministros':
                return 'bi-box-seam';
            case 'Ejecución de Servicio':
                return 'bi-tools';
            case 'Permisos PNA':
            case 'Trámite Aduanal':
            case 'Confirmación de Rancho':
                return 'bi-shield-check';
            case 'Logística y Despacho':
            case 'Cierre Operativo':
                return 'bi-truck';
            case 'Revisión Pendiente':
                return 'bi-exclamation-triangle-fill';
            default:
                return 'bi-bell';
        }
    };

    const formatTimeAgo = (dateStr) => {
        if (!dateStr) return '';
        try {
            const date = new Date(dateStr);
            const now = new Date();
            const diffMin = Math.round((now - date) / (1000 * 60));
            if (diffMin < 1) return 'Hace un momento';
            if (diffMin < 60) return `Hace ${diffMin} min`;
            const diffHours = Math.round(diffMin / 60);
            if (diffHours < 24) return `Hace ${diffHours} h`;
            return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
        } catch {
            return '';
        }
    };

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2.5 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-all bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center"
                title="Notificaciones de fases operativas"
            >
                <i className="bi bi-bell-fill text-lg"></i>
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-red-500 text-white text-[11px] font-black rounded-full flex items-center justify-center animate-pulse border-2 border-white dark:border-slate-800 shadow-md">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-96 max-w-[92vw] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-fadeIn flex flex-col max-h-[85vh]">
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/80 bg-slate-50/80 dark:bg-slate-900/60 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <i className="bi bi-bell-fill text-indigo-500 text-sm"></i>
                            <h3 className="font-black text-sm text-slate-800 dark:text-white">
                                Notificaciones de Fases
                            </h3>
                            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                                {unreadCount}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={fetchNotifications}
                                className="p-1 rounded text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                                title="Actualizar"
                            >
                                <i className="bi bi-arrow-clockwise text-xs"></i>
                            </button>
                        </div>
                    </div>

                    {/* Tabs / Filtros */}
                    <div className="flex border-b border-slate-100 dark:border-slate-700 px-3 py-1.5 bg-white dark:bg-slate-800 gap-1 text-xs font-bold">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-3 py-1 rounded-lg transition ${filter === 'all' ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                        >
                            Todas ({notifications.length})
                        </button>
                        <button
                            onClick={() => setFilter('high')}
                            className={`px-3 py-1 rounded-lg transition ${filter === 'high' ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-300' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                        >
                            Prioritarias ({notifications.filter(n => n.prioridad === 'alta').length})
                        </button>
                    </div>

                    {/* Contenido / Listado */}
                    <div className="overflow-y-auto max-h-[60vh] divide-y divide-slate-100 dark:divide-slate-750 custom-scrollbar flex-1">
                        {filteredList.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 dark:text-slate-500">
                                <i className="bi bi-check2-circle text-3xl block mb-2 text-emerald-500"></i>
                                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                                    No hay operaciones con tareas pendientes
                                </p>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                    Todas las operaciones activas se encuentran al día.
                                </p>
                            </div>
                        ) : (
                            filteredList.map((n) => (
                                <div
                                    key={n.id}
                                    onClick={() => handleSelectNotification(n)}
                                    className="p-3.5 hover:bg-slate-50 dark:hover:bg-slate-750/50 cursor-pointer transition flex gap-3 items-start group"
                                >
                                    <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-slate-700/80 border border-indigo-100 dark:border-slate-600 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                                        <i className={`bi ${getFaseIcon(n.fase_nombre)} text-sm`}></i>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-1 mb-1">
                                            <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded border ${getFaseColor(n.fase_nombre)}`}>
                                                {n.fase_nombre || 'Fase Activa'}
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                                                {formatTimeAgo(n.fecha_creacion)}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-800 dark:text-slate-100 font-semibold leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                                            {n.mensaje}
                                        </p>
                                        {(n.buque || n.cliente) && (
                                            <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-400 dark:text-slate-400">
                                                {n.buque && <span className="font-medium text-slate-600 dark:text-slate-300"><i className="bi bi-water mr-1"></i>{n.buque}</span>}
                                                {n.cliente && <span className="truncate max-w-[120px]"><i className="bi bi-building mr-1"></i>{n.cliente}</span>}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
