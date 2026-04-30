import React, { useState, useEffect } from 'react';
import axios from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function AgendaEventModal({ isOpen, onClose, eventToEdit, onSave }) {
    const { user } = useAuth();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [assignedTo, setAssignedTo] = useState('');
    
    const [operators, setOperators] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const DRAFT_KEY = 'draft_agenda_event';

    const isOwner = user?.role === 'OWNER' || user?.role === 'CONTABLE';

    useEffect(() => {
        if (isOpen) {
            if (isOwner) {
                fetchOperators();
            } else {
                setAssignedTo(user.id);
            }

            if (eventToEdit) {
                setTitle(eventToEdit.title || '');
                setDescription(eventToEdit.description || '');
                setStartDate(eventToEdit.start_date ? new Date(eventToEdit.start_date).toISOString().slice(0, 16) : '');
                setEndDate(eventToEdit.end_date ? new Date(eventToEdit.end_date).toISOString().slice(0, 16) : '');
                setAssignedTo(String(eventToEdit.assigned_to || user.id));
            } else {
                // Intentar cargar borrador si no es edición
                const saved = localStorage.getItem(DRAFT_KEY);
                if (saved) {
                    try {
                        const draft = JSON.parse(saved);
                        setTitle(draft.title || '');
                        setDescription(draft.description || '');
                        setStartDate(draft.startDate || '');
                        setEndDate(draft.endDate || '');
                        setAssignedTo(draft.assignedTo || String(user.id));
                    } catch (e) {
                        console.error("Error al cargar borrador de agenda:", e);
                    }
                } else {
                    setTitle('');
                    setDescription('');
                    setStartDate('');
                    setEndDate('');
                    setAssignedTo(String(user.id));
                }
                setError(null);
            }
        }
    }, [isOpen, eventToEdit, user, isOwner]);

    // Autosave silencioso
    useEffect(() => {
        if (isOpen && !eventToEdit) {
            const draft = { title, description, startDate, endDate, assignedTo };
            localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        }
    }, [title, description, startDate, endDate, assignedTo, isOpen, eventToEdit]);

    const handleClose = () => {
        if (!eventToEdit) localStorage.removeItem(DRAFT_KEY);
        onClose();
    };

    const fetchOperators = async () => {
        try {
            const res = await axios.get('/usuarios/users/?role=OPERADOR');
            // Filtrar explícitamente al propio usuario actual si llegara a venir en la lista
            const filteredOps = res.data.filter(op => String(op.id) !== String(user.id));
            setOperators(filteredOps);
        } catch (err) {
            console.error("Error fetching operators:", err);
            setOperators([]);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        if (!title || !startDate || !assignedTo) {
            setError("Por favor completa todos los campos requeridos.");
            setLoading(false);
            return;
        }

        const eventData = {
            title,
            description,
            start_date: new Date(startDate).toISOString(),
            end_date: endDate ? new Date(endDate).toISOString() : null,
            assigned_to: assignedTo
        };

        try {
            if (eventToEdit) {
                await axios.put(`/operaciones/events/${eventToEdit.id}/`, eventData);
            } else {
                await axios.post('/operaciones/events/', eventData);
            }
            localStorage.removeItem(DRAFT_KEY);
            onSave();
            onClose();
        } catch (err) {
            console.error("Error guardando evento:", err);
            setError(err.response?.data?.detail || "Ocurrió un error al guardar el evento.");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('¿Está seguro de eliminar este evento de agenda?')) return;
        setLoading(true);
        try {
            await axios.delete(`/operaciones/events/${eventToEdit.id}/`);
            onSave();
            onClose();
        } catch (err) {
            console.error("Error eliminando evento:", err);
            setError(err.response?.data?.detail || "Ocurrió un error al eliminar el evento.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-indigo-50/50 dark:bg-slate-700/50">
                    <h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-300">
                        {eventToEdit ? 'Editar Evento de Agenda' : 'Nuevo Evento de Agenda'}
                    </h3>
                    <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                        <i className="bi bi-x-lg text-xl"></i>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto max-h-[80vh] dark:bg-slate-800">
                    {error && (
                        <div className="mb-4 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 p-3 rounded-xl text-sm border border-red-200 dark:border-red-800">
                            {error}
                        </div>
                    )}

                    <form id="event-form" onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Título del Evento *</label>
                            <input
                                type="text"
                                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                                placeholder="Ej: Visita al buque, Reunión de coordinación..."
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Descripción</label>
                            <textarea
                                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[80px] transition-colors"
                                placeholder="Detalles adicionales..."
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Fecha de Inicio *</label>
                                <input
                                    type="datetime-local"
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                                    value={startDate}
                                    onChange={e => setStartDate(e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Fecha de Fin</label>
                                <input
                                    type="datetime-local"
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                                    value={endDate}
                                    onChange={e => setEndDate(e.target.value)}
                                />
                            </div>
                        </div>

                        {isOwner && (
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Asignar a *</label>
                                <select
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                                    value={assignedTo}
                                    onChange={e => setAssignedTo(e.target.value)}
                                    required
                                >
                                    <option value={String(user.id)}>Mí mismo ({user.username})</option>
                                    {operators.map(op => (
                                        <option key={op.id} value={String(op.id)}>
                                            Operador: {op.username}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </form>
                </div>

                <div className="px-6 py-4 bg-gray-50 dark:bg-slate-700/50 border-t border-gray-100 dark:border-slate-700 flex justify-between gap-3">
                    <div>
                        {eventToEdit && eventToEdit.created_by === user.id && (
                            <button
                                type="button"
                                onClick={handleDelete}
                                className="px-4 py-2 text-sm font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors flex items-center gap-1"
                                disabled={loading}
                            >
                                <i className="bi bi-trash"></i> Eliminar
                            </button>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors"
                            disabled={loading}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            form="event-form"
                            className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                            disabled={loading}
                        >
                            {loading && <i className="bi bi-arrow-repeat animate-spin"></i>}
                            Guardar Evento
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
