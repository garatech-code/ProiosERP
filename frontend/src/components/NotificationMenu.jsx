import React, { useState, useEffect } from 'react';
import axios from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function NotificationMenu() {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    // Solo mostramos las notificaciones si es OPERADOR (Senior)
    if (user?.role !== 'OPERADOR') return null;

    useEffect(() => {
        fetchNotifications();
        // Opcional: polling cada 30 segundos
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchNotifications = async () => {
        try {
            const res = await axios.get('/usuarios/notificaciones/');
            const data = res.data?.results || res.data;
            if (Array.isArray(data)) {
                setNotifications(data);
                setUnreadCount(data.filter(n => !n.leida).length);
            }
        } catch (err) {
            console.error("Error al cargar notificaciones:", err);
        }
    };

    const markAsRead = async (id) => {
        try {
            await axios.post(`/usuarios/notificaciones/${id}/mark_read/`);
            fetchNotifications();
        } catch (err) {
            console.error(err);
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

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full"
                title="Notificaciones de Seguimiento"
            >
                <i className="bi bi-bell-fill text-lg"></i>
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse border-2 border-white dark:border-slate-800">
                        {unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-fadeIn">
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                        <h3 className="font-bold text-sm text-slate-800 dark:text-white">Notificaciones</h3>
                        {unreadCount > 0 && (
                            <button onClick={markAllRead} className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 font-semibold">
                                Marcar todo leído
                            </button>
                        )}
                    </div>
                    
                    <div className="max-h-80 overflow-y-auto custom-scrollbar">
                        {notifications.length === 0 ? (
                            <div className="p-6 text-center text-slate-500 text-sm">
                                No tienes notificaciones nuevas.
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 dark:divide-slate-700">
                                {notifications.map(n => (
                                    <div 
                                        key={n.id} 
                                        className={`p-4 transition-colors ${!n.leida ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : 'hover:bg-slate-50 dark:bg-slate-900/20 dark:hover:bg-slate-700/50'}`}
                                        onClick={() => !n.leida && markAsRead(n.id)}
                                    >
                                        <div className="flex gap-3 items-start cursor-pointer">
                                            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                                                <i className="bi bi-info-circle-fill"></i>
                                            </div>
                                            <div>
                                                <p className={`text-sm ${!n.leida ? 'text-slate-900 dark:text-white font-semibold' : 'text-slate-600 dark:text-slate-300'}`}>
                                                    {n.mensaje}
                                                </p>
                                                <span className="text-[10px] text-slate-400 mt-1 block">
                                                    {new Date(n.fecha_creacion).toLocaleString()}
                                                </span>
                                            </div>
                                            {!n.leida && (
                                                <div className="w-2 h-2 rounded-full bg-indigo-600 shrink-0 mt-1.5"></div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            {/* Click outside overlay */}
            {isOpen && (
                <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsOpen(false)}
                ></div>
            )}
        </div>
    );
}
