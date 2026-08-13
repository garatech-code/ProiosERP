import { useState, useEffect } from 'react';
import axios from '../api/axios';
import LogoSpinner from './LogoSpinner';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';

export default function StaffManagement() {
    const { user } = useAuth();
    const [staff, setStaff] = useState([]);
    const [filteredStaff, setFilteredStaff] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState('all'); // all, active, inactive

    // Modals
    const [showFormModal, setShowFormModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [editingMember, setEditingMember] = useState(null);

    // Form state
    const [formData, setFormData] = useState({
        nombres: '',
        apellidos: '',
        dni: '',
        rol: '',
        activo: true
    });

    // Selection
    const [selectedIds, setSelectedIds] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [importFeedback, setImportFeedback] = useState(null);
    const [toast, setToast] = useState(null);

    const showToast = (message, type = 'info') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    };

    const formatDni = (dni) => dni ? String(dni).replace(/\.0$/, '') : '';

    const downloadTemplate = () => {
        const headers = [['NOMBRES', 'APELLIDOS', 'DNI', 'ROL']];
        const ws = XLSX.utils.aoa_to_sheet(headers);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
        XLSX.writeFile(wb, "plantel_template.xlsx");
    };

    const exportToExcel = () => {
        const dataToExport = filteredStaff.map(member => ({
            'Nombres': member.nombres,
            'Apellidos': member.apellidos,
            'DNI': formatDni(member.dni),
            'Rol': member.rol,
            'Estado': member.activo ? 'Activo' : 'Inactivo',
            'Fecha de Registro': member.fecha_registro ? new Date(member.fecha_registro).toLocaleDateString() : '-'
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Plantel");
        XLSX.writeFile(wb, "plantel_export.xlsx");
    };

    const fetchStaff = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/usuarios/plantel/');
            setStaff(res.data);
            setFilteredStaff(res.data);
        } catch (err) {
            console.error(err);
            showToast('Error al cargar el plantel', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStaff();
    }, []);

    useEffect(() => {
        let filtered = staff;
        if (activeFilter === 'active') filtered = staff.filter(s => s.activo);
        if (activeFilter === 'inactive') filtered = staff.filter(s => !s.activo);

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(s =>
                s.nombres.toLowerCase().includes(term) ||
                s.apellidos.toLowerCase().includes(term) ||
                formatDni(s.dni).toLowerCase().includes(term) ||
                s.rol.toLowerCase().includes(term)
            );
        }
        setFilteredStaff(filtered);
    }, [searchTerm, activeFilter, staff]);

    const handleOpenCreate = () => {
        setEditingMember(null);
        setFormData({ nombres: '', apellidos: '', dni: '', rol: '', activo: true });
        setShowFormModal(true);
    };

    const handleOpenEdit = (member) => {
        setEditingMember(member);
        setFormData({ ...member, dni: formatDni(member.dni) });
        setShowFormModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (editingMember) {
                await axios.put(`/usuarios/plantel/${editingMember.id}/`, formData);
                showToast('Personal actualizado con éxito', 'success');
            } else {
                await axios.post('/usuarios/plantel/', formData);
                showToast('Personal agregado con éxito', 'success');
            }
            setShowFormModal(false);
            fetchStaff();
        } catch (err) {
            const errorMsg = err.response?.data?.dni ? 'El DNI ya existe' : 'Error al guardar datos';
            showToast(errorMsg, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`¿Estás seguro de eliminar a ${name}?`)) return;
        try {
            await axios.delete(`/usuarios/plantel/${id}/`);
            showToast('Registro eliminado', 'success');
            fetchStaff();
        } catch (err) {
            showToast('Error al eliminar', 'error');
        }
    };

    const handleBulkDelete = async () => {
        const ids = Object.keys(selectedIds).filter(id => selectedIds[id]);
        if (!ids.length) return;
        if (!window.confirm(`¿Eliminar ${ids.length} registros seleccionados?`)) return;

        try {
            await axios.post('/usuarios/plantel/bulk_delete/', { ids });
            showToast('Registros eliminados', 'success');
            setSelectedIds({});
            fetchStaff();
        } catch (err) {
            showToast('Error en eliminación masiva', 'error');
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const fd = new FormData();
        fd.append('file', file);
        setIsSubmitting(true);
        setImportFeedback(null);

        try {
            const res = await axios.post('/usuarios/plantel/bulk_import/', fd, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            showToast('Importación exitosa', 'success');
            setImportFeedback({ type: 'success', message: res.data.message });
            fetchStaff();
            setTimeout(() => setShowImportModal(false), 2000);
        } catch (err) {
            const msg = err.response?.data?.error || 'Error al importar archivo';
            setImportFeedback({ type: 'error', message: msg });
            showToast('Error al importar', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleSelect = (id) => {
        setSelectedIds(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const toggleSelectAll = () => {
        const allSelected = filteredStaff.every(s => selectedIds[s.id]);
        const next = {};
        filteredStaff.forEach(s => next[s.id] = !allSelected);
        setSelectedIds(next);
    };

    const selectedCount = Object.values(selectedIds).filter(Boolean).length;

    return (
        <>
            <div className="space-y-6 animate-fadeIn pb-20">
            {toast && (
                <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-2xl border flex items-center gap-3 animate-slideIn ${
                    toast.type === 'error' ? 'bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800' : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
                }`}>
                    <i className={`bi ${toast.type === 'error' ? 'bi-exclamation-triangle-fill' : 'bi-check-circle-fill'} text-lg`}></i>
                    <span className="font-bold text-sm">{toast.message}</span>
                </div>
            )}

            {/* Header y Acciones */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div className="w-full lg:w-auto">
                    <div className="flex items-center gap-2 mb-1">
                        <i className="bi bi-people-fill text-indigo-500 text-xl"></i>
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Administración de Plantel</h2>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-slate-400">Gestiona el personal operativo para asignación y documentación.</p>
                </div>

                <div className="flex flex-wrap gap-2">
                    {user?.role === 'OWNER' && (
                        <button
                            onClick={exportToExcel}
                            className="px-4 py-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-sm font-bold rounded-xl hover:bg-emerald-100 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 transition-all flex items-center gap-2"
                        >
                            <i className="bi bi-file-earmark-spreadsheet"></i> Exportar
                        </button>
                    )}
                    <button
                        onClick={downloadTemplate}
                        className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-sm font-bold rounded-xl hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 transition-all flex items-center gap-2"
                    >
                        <i className="bi bi-file-earmark-arrow-down"></i> Formato
                    </button>
                    <button
                        onClick={() => setShowImportModal(true)}
                        className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none transition-all flex items-center gap-2"
                    >
                        <i className="bi bi-file-earmark-excel"></i> Carga Masiva
                    </button>
                    <button
                        onClick={handleOpenCreate}
                        className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-200 dark:shadow-none transition-all flex items-center gap-2"
                    >
                        <i className="bi bi-plus-lg"></i> Nuevo
                    </button>
                </div>
            </div>

            {/* Filtros y Búsqueda */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                        <input 
                            type="text" 
                            placeholder="Buscar por nombre, apellido, DNI o rol..." 
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 dark:text-white transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex bg-slate-50 dark:bg-slate-900/50 p-1 rounded-xl">
                        {[
                            { id: 'all', label: 'Todos', icon: 'bi-grid-fill' },
                            { id: 'active', label: 'Activos', icon: 'bi-person-check-fill' },
                            { id: 'inactive', label: 'Inactivos', icon: 'bi-person-x-fill' }
                        ].map(f => (
                            <button
                                key={f.id}
                                onClick={() => setActiveFilter(f.id)}
                                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeFilter === f.id ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <i className={`bi ${f.icon}`}></i>
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>

                {selectedCount > 0 && (
                    <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/20 px-4 py-2 rounded-xl border border-indigo-100 dark:border-indigo-800/50 animate-fadeIn">
                        <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">
                            <i className="bi bi-check2-all mr-2"></i>
                            {selectedCount} seleccionados
                        </span>
                        <button 
                            onClick={handleBulkDelete}
                            className="text-xs font-black text-red-600 hover:text-red-700 uppercase tracking-wider"
                        >
                            Eliminar Selección
                        </button>
                    </div>
                )}
            </div>

            {/* Tabla */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-gray-100 dark:border-slate-700">
                                <th className="p-4 w-10">
                                    <input 
                                        type="checkbox" 
                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        checked={filteredStaff.length > 0 && filteredStaff.every(s => selectedIds[s.id])}
                                        onChange={toggleSelectAll}
                                    />
                                </th>
                                <th className="p-4 text-xs font-black text-gray-500 dark:text-slate-400 uppercase tracking-widest">Personal</th>
                                <th className="p-4 text-xs font-black text-gray-500 dark:text-slate-400 uppercase tracking-widest">DNI</th>
                                <th className="p-4 text-xs font-black text-gray-500 dark:text-slate-400 uppercase tracking-widest">Rol</th>
                                <th className="p-4 text-xs font-black text-gray-500 dark:text-slate-400 uppercase tracking-widest text-center">Estado</th>
                                <th className="p-4 text-xs font-black text-gray-500 dark:text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="p-20 text-center">
                                        <LogoSpinner size="w-10 h-10" />
                                    </td>
                                </tr>
                            ) : filteredStaff.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="p-20 text-center animate-fadeIn">
                                        <div className="w-20 h-20 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <i className="bi bi-people text-4xl text-slate-400"></i>
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">No hay registros</h3>
                                        <p className="text-slate-500 dark:text-slate-400 max-w-xs mx-auto mt-2">No se encontraron miembros del plantel que coincidan con tu búsqueda.</p>
                                    </td>
                                </tr>
                            ) : filteredStaff.map((member, idx) => (
                                <tr 
                                    key={member.id} 
                                    className="hover:bg-slate-50 dark:bg-slate-900/20/50 dark:hover:bg-slate-900/30 transition-all group animate-slideUp"
                                    style={{ animationDelay: `${idx * 0.05}s` }}
                                >
                                    <td className="p-4">
                                        <input 
                                            type="checkbox" 
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                            checked={!!selectedIds[member.id]}
                                            onChange={() => toggleSelect(member.id)}
                                        />
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-sm">
                                                {member.nombres[0]}{member.apellidos[0]}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-800 dark:text-white leading-none mb-1">{member.apellidos}, {member.nombres}</p>
                                                <p className="text-[10px] text-gray-400 uppercase font-black">Registrado: {new Date(member.fecha_registro).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className="text-sm font-mono text-gray-600 dark:text-slate-300">{formatDni(member.dni)}</span>
                                    </td>
                                    <td className="p-4">
                                        <span className="text-xs font-bold px-2 py-1 bg-slate-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 rounded-lg">{member.rol}</span>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                                            member.activo ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                        }`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${member.activo ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                                            {member.activo ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={() => handleOpenEdit(member)}
                                                className="p-2 text-indigo-600 hover:bg-indigo-50 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                                                title="Editar"
                                            >
                                                <i className="bi bi-pencil-fill"></i>
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(member.id, `${member.nombres} ${member.apellidos}`)}
                                                className="p-2 text-red-600 hover:bg-red-50 dark:bg-red-900/20 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                                title="Eliminar"
                                            >
                                                <i className="bi bi-trash-fill"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <style>{`
                @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
                .animate-slideIn { animation: slideIn 0.3s ease-out forwards; }
            `}</style>
        </div>

        {/* Modal Formulario */}
            {showFormModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700 my-auto">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                            <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                                <i className="bi bi-person-badge text-indigo-500"></i>
                                {editingMember ? 'Editar Personal' : 'Nuevo Personal'}
                            </h3>
                            <button onClick={() => setShowFormModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg p-1.5 shadow-sm transition-colors">
                                <i className="bi bi-x-lg"></i>
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Nombres *</label>
                                    <input 
                                        required
                                        type="text" 
                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-lg text-sm dark:text-white focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                                        value={formData.nombres}
                                        onChange={(e) => setFormData({...formData, nombres: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Apellidos *</label>
                                    <input 
                                        required
                                        type="text" 
                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-lg text-sm dark:text-white focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                                        value={formData.apellidos}
                                        onChange={(e) => setFormData({...formData, apellidos: e.target.value})}
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">DNI *</label>
                                <input 
                                    required
                                    type="text" 
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-lg text-sm dark:text-white focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                                    value={formData.dni}
                                    onChange={(e) => setFormData({...formData, dni: e.target.value})}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Rol / Función *</label>
                                <input 
                                    required
                                    type="text" 
                                    placeholder="Ej: Operario, Capataz..."
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-lg text-sm dark:text-white focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                                    value={formData.rol}
                                    onChange={(e) => setFormData({...formData, rol: e.target.value})}
                                />
                            </div>
                            <div className="flex items-center gap-3 py-2">
                                <input 
                                    type="checkbox" 
                                    id="activo"
                                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                                    checked={formData.activo}
                                    onChange={(e) => setFormData({...formData, activo: e.target.checked})}
                                />
                                <label htmlFor="activo" className="text-sm font-bold text-slate-700 dark:text-slate-300 cursor-pointer">Personal Activo</label>
                            </div>
                            <div className="pt-4 mt-2 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3 shrink-0">
                                <button 
                                    type="button"
                                    onClick={() => setShowFormModal(false)}
                                    className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:bg-slate-900/20 dark:hover:bg-slate-700 rounded-lg text-sm font-bold transition-colors shadow-sm"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    disabled={isSubmitting}
                                    type="submit"
                                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-sm shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                            Guardando...
                                        </>
                                    ) : (
                                        <>
                                            <i className="bi bi-save-fill"></i> Guardar
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Importación */}
            {showImportModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700 my-auto">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                            <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                                <i className="bi bi-file-earmark-excel text-emerald-500"></i>
                                Importar desde Excel
                            </h3>
                            <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg p-1.5 shadow-sm transition-colors">
                                <i className="bi bi-x-lg"></i>
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-800/50">
                                <h4 className="text-xs font-black text-indigo-700 dark:text-indigo-300 uppercase tracking-widest mb-2">Instrucciones</h4>
                                <p className="text-xs text-indigo-600 dark:text-indigo-400 leading-relaxed">
                                    El archivo debe ser .xlsx o .xls y contener las siguientes columnas exactas:
                                    <br /><br />
                                    <code className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">NOMBRES, APELLIDOS, DNI, ROL</code>
                                </p>
                            </div>

                            <div className="space-y-4">
                                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-2xl cursor-pointer hover:bg-slate-50 dark:bg-slate-900/20 dark:hover:bg-slate-900/50 transition-all">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                                        <i className="bi bi-cloud-arrow-up text-3xl text-indigo-500 mb-2"></i>
                                        <p className="text-sm font-bold text-gray-600 dark:text-slate-300">Haz clic para subir archivo</p>
                                        <p className="text-[10px] text-gray-400 uppercase font-black">XLSX, XLS (MAX. 5MB)</p>
                                    </div>
                                    <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} disabled={isSubmitting} />
                                </label>

                                {isSubmitting && (
                                    <div className="flex items-center justify-center gap-2 text-indigo-600 font-bold text-sm">
                                        <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                        Procesando archivo...
                                    </div>
                                )}

                                {importFeedback && (
                                    <div className={`p-3 rounded-xl text-xs font-bold ${
                                        importFeedback.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 border border-emerald-200' : 'bg-red-50 dark:bg-red-900/20 text-red-700 border border-red-200'
                                    }`}>
                                        {importFeedback.message}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </>
    );
}
