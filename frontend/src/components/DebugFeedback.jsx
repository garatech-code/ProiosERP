import { useState, useEffect } from 'react';
import axios from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function DebugFeedback({ onClose }) {
    const { user } = useAuth();
    const [feedbacks, setFeedbacks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    // Quitamos "tipo" porque tu modelo FeedbackItem no lo necesita
    const [newFeedback, setNewFeedback] = useState({ titulo: '', descripcion: '' });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchFeedbacks();
    }, []);

    const fetchFeedbacks = async () => {
        try {
            const res = await axios.get('usuarios/feedbacks/');
            setFeedbacks(res.data);
        } catch (err) {
            console.error('Error fetching feedback:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newFeedback.titulo.trim() || !newFeedback.descripcion.trim()) return;

        setSubmitting(true);
        try {
            await axios.post('usuarios/feedbacks/', newFeedback);
            setNewFeedback({ titulo: '', descripcion: '' });
            setShowForm(false);
            fetchFeedbacks();
        } catch (err) {
            console.error('Error creating feedback:', err);
            alert('Error al enviar el reporte.');
        } finally {
            setSubmitting(false);
        }
    };

    const updateStatus = async (id, newStatus) => {
        if (user?.role !== 'OWNER') {
            alert("Solo Gerencia puede cambiar el estado de los tickets.");
            return;
        }
        try {
            await axios.patch(`usuarios/feedbacks/${id}/`, { estado: newStatus });
            fetchFeedbacks();
        } catch (err) {
            console.error('Error updating status:', err);
        }
    };

    const deleteFeedback = async (id) => {
        if (user?.role !== 'OWNER') return;
        if (!window.confirm("¿Eliminar este ticket definitivamente?")) return;
        try {
            await axios.delete(`usuarios/feedbacks/${id}/`);
            fetchFeedbacks();
        } catch (err) {
            console.error('Error deleting feedback:', err);
        }
    };

    // Filtrar usando los estados exactos de tu models.py
    const colPendientes = feedbacks.filter(f => f.estado === 'pendiente');
    const colRevisando = feedbacks.filter(f => f.estado === 'en_progreso');
    const colSolucionados = feedbacks.filter(f => f.estado === 'resuelto');

    const FeedbackCard = ({ fb }) => (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-3 group hover:shadow-md transition-all relative">
            {user?.role === 'OWNER' && (
                <button onClick={() => deleteFeedback(fb.id)} className="absolute top-3 right-3 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            )}
            <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-indigo-500 font-bold flex items-center gap-1 bg-indigo-50 px-2 py-0.5 rounded-md">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                    {fb.creado_por_username} {/* Usando el campo correcto de tu serializador */}
                </span>
            </div>
            <h4 className="font-bold text-slate-800 text-sm mb-1">{fb.titulo}</h4>
            <p className="text-xs text-slate-600 mb-4 line-clamp-3">{fb.descripcion}</p>

            {/* Controles de Owner */}
            {user?.role === 'OWNER' && (
                <div className="flex gap-1 pt-3 border-t border-slate-100">
                    {fb.estado !== 'pendiente' && (
                        <button onClick={() => updateStatus(fb.id, 'pendiente')} className="flex-1 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold rounded transition-colors">A Pendiente</button>
                    )}
                    {fb.estado === 'pendiente' && (
                        <button onClick={() => updateStatus(fb.id, 'en_progreso')} className="flex-1 py-1 bg-amber-100 hover:bg-amber-200 text-amber-700 text-[10px] font-bold rounded transition-colors">Revisar</button>
                    )}
                    {fb.estado !== 'resuelto' && (
                        <button onClick={() => updateStatus(fb.id, 'resuelto')} className="flex-1 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-[10px] font-bold rounded transition-colors">Solucionar</button>
                    )}
                </div>
            )}
        </div>
    );

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-50 rounded-2xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden">

                {/* Header */}
                <div className="px-6 py-4 bg-white border-b border-slate-200 flex justify-between items-center z-10 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path></svg>
                        </div>
                        <div>
                            <h2 className="text-xl font-extrabold text-slate-800">Testing & Debug</h2>
                            <p className="text-xs font-medium text-slate-500">Reporte de errores y sugerencias de mejora</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-colors shadow-sm flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                            Nuevo Reporte
                        </button>
                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden relative flex">
                    {/* Panel Lateral de Nuevo Reporte (Deslizable y con estructura Flex corregida) */}
                    <div className={`absolute top-0 bottom-0 left-0 w-80 bg-white border-r border-slate-200 flex flex-col z-20 transition-transform duration-300 transform ${showForm ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>
                        <div className="p-6 pb-4 border-b border-slate-200 shrink-0">
                            <h3 className="font-bold text-slate-800">Crear Ticket</h3>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 pt-4 custom-scrollbar">
                            <form onSubmit={handleSubmit} className="flex flex-col gap-4 min-h-full">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Título corto</label>
                                    <input type="text" required value={newFeedback.titulo} onChange={e => setNewFeedback({ ...newFeedback, titulo: e.target.value })} className="w-full text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="Ej: El botón no funciona" />
                                </div>
                                <div className="flex-1 flex flex-col min-h-[150px]">
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Descripción detallada</label>
                                    <textarea required value={newFeedback.descripcion} onChange={e => setNewFeedback({ ...newFeedback, descripcion: e.target.value })} className="w-full flex-1 p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm resize-none" placeholder="Explica cómo reproducir el error o tu idea..."></textarea>
                                </div>

                                <div className="flex gap-2 pt-4 mt-auto">
                                    <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-colors">Cancelar</button>
                                    <button type="submit" disabled={submitting} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50">Enviar</button>
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* Tablero Kanban */}
                    {loading ? (
                        <div className="flex-1 flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div></div>
                    ) : (
                        <div className="flex-1 flex gap-6 p-6 overflow-x-auto bg-slate-100/50">
                            {/* Columna Pendientes */}
                            <div className="flex-1 min-w-[300px] max-w-sm flex flex-col h-full">
                                <div className="flex items-center justify-between mb-3 px-1 shrink-0">
                                    <h3 className="font-extrabold text-slate-700 uppercase tracking-wider text-xs flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-slate-400"></span> Pendientes
                                    </h3>
                                    <span className="bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full">{colPendientes.length}</span>
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 pb-4">
                                    {colPendientes.map(fb => <FeedbackCard key={fb.id} fb={fb} />)}
                                    {colPendientes.length === 0 && <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-400 text-sm font-medium">No hay tickets pendientes</div>}
                                </div>
                            </div>

                            {/* Columna Revisando */}
                            <div className="flex-1 min-w-[300px] max-w-sm flex flex-col h-full">
                                <div className="flex items-center justify-between mb-3 px-1 shrink-0">
                                    <h3 className="font-extrabold text-amber-700 uppercase tracking-wider text-xs flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span> En Revisión
                                    </h3>
                                    <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{colRevisando.length}</span>
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 pb-4">
                                    {colRevisando.map(fb => <FeedbackCard key={fb.id} fb={fb} />)}
                                    {colRevisando.length === 0 && <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-400 text-sm font-medium">Nada en revisión</div>}
                                </div>
                            </div>

                            {/* Columna Solucionados */}
                            <div className="flex-1 min-w-[300px] max-w-sm flex flex-col h-full">
                                <div className="flex items-center justify-between mb-3 px-1 shrink-0">
                                    <h3 className="font-extrabold text-emerald-700 uppercase tracking-wider text-xs flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Solucionados
                                    </h3>
                                    <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{colSolucionados.length}</span>
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 pb-4">
                                    {colSolucionados.map(fb => <FeedbackCard key={fb.id} fb={fb} />)}
                                    {colSolucionados.length === 0 && <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-400 text-sm font-medium">Aún no hay soluciones</div>}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <style dangerouslySetInnerHTML={{ __html: `.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 10px; }` }} />
        </div>
    );
}