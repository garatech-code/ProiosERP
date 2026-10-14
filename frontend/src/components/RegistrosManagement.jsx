import React, { useState, useEffect, useMemo } from 'react';
import axios from '../api/axios';
import LogoSpinner from './LogoSpinner';

export default function RegistrosManagement() {
    const [activeTab, setActiveTab] = useState('clients'); // 'clients' | 'agencies'

    // Data states
    const [clients, setClients] = useState([]);
    const [agencies, setAgencies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal state for Create / Edit
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        contact_person: '',
        contact_name: '',
        email: '',
        phone: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [modalError, setModalError] = useState('');

    // Delete confirmation modal state
    const [deleteModal, setDeleteModal] = useState({
        isOpen: false,
        item: null,
        type: null // 'client' | 'agency'
    });
    const [deleting, setDeleting] = useState(false);

    // Toast notification
    const [toast, setToast] = useState(null);

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [clientsRes, agenciesRes] = await Promise.all([
                axios.get('/operaciones/clients/'),
                axios.get('/operaciones/agencies/')
            ]);
            setClients(Array.isArray(clientsRes.data) ? clientsRes.data : (clientsRes.data?.results || []));
            setAgencies(Array.isArray(agenciesRes.data) ? agenciesRes.data : (agenciesRes.data?.results || []));
        } catch (err) {
            console.error('Error cargando registros:', err);
            showToast('Error al cargar clientes y agencias', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Filtered lists based on search term
    const filteredClients = useMemo(() => {
        if (!searchTerm.trim()) return clients;
        const q = searchTerm.toLowerCase();
        return clients.filter(c =>
            (c.name && c.name.toLowerCase().includes(q)) ||
            (c.contact_person && c.contact_person.toLowerCase().includes(q)) ||
            (c.email && c.email.toLowerCase().includes(q)) ||
            (c.phone && c.phone.toLowerCase().includes(q))
        );
    }, [clients, searchTerm]);

    const filteredAgencies = useMemo(() => {
        if (!searchTerm.trim()) return agencies;
        const q = searchTerm.toLowerCase();
        return agencies.filter(a =>
            (a.name && a.name.toLowerCase().includes(q)) ||
            (a.contact_name && a.contact_name.toLowerCase().includes(q)) ||
            (a.email && a.email.toLowerCase().includes(q)) ||
            (a.phone && a.phone.toLowerCase().includes(q))
        );
    }, [agencies, searchTerm]);

    // Handle Open Create Modal
    const handleOpenCreate = () => {
        setModalMode('create');
        setEditingItem(null);
        setFormData({
            name: '',
            contact_person: '',
            contact_name: '',
            email: '',
            phone: ''
        });
        setModalError('');
        setIsModalOpen(true);
    };

    // Handle Open Edit Modal
    const handleOpenEdit = (item) => {
        setModalMode('edit');
        setEditingItem(item);
        if (activeTab === 'clients') {
            setFormData({
                name: item.name || '',
                contact_person: item.contact_person || '',
                contact_name: '',
                email: item.email || '',
                phone: item.phone || ''
            });
        } else {
            setFormData({
                name: item.name || '',
                contact_person: '',
                contact_name: item.contact_name || '',
                email: item.email || '',
                phone: item.phone || ''
            });
        }
        setModalError('');
        setIsModalOpen(true);
    };

    // Submit Create or Edit
    const handleSubmitForm = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            setModalError('El nombre es obligatorio.');
            return;
        }

        setSubmitting(true);
        setModalError('');

        try {
            if (activeTab === 'clients') {
                const payload = {
                    name: formData.name.trim(),
                    contact_person: formData.contact_person.trim(),
                    email: formData.email.trim(),
                    phone: formData.phone.trim()
                };

                if (modalMode === 'create') {
                    const res = await axios.post('/operaciones/clients/', payload);
                    setClients(prev => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
                    showToast('Cliente creado exitosamente');
                } else {
                    const res = await axios.put(`/operaciones/clients/${editingItem.id}/`, payload);
                    setClients(prev => prev.map(c => c.id === editingItem.id ? res.data : c).sort((a, b) => a.name.localeCompare(b.name)));
                    showToast('Cliente actualizado exitosamente');
                }
            } else {
                const payload = {
                    name: formData.name.trim(),
                    contact_name: formData.contact_name.trim(),
                    email: formData.email.trim(),
                    phone: formData.phone.trim()
                };

                if (modalMode === 'create') {
                    const res = await axios.post('/operaciones/agencies/', payload);
                    setAgencies(prev => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
                    showToast('Agencia creada exitosamente');
                } else {
                    const res = await axios.put(`/operaciones/agencies/${editingItem.id}/`, payload);
                    setAgencies(prev => prev.map(a => a.id === editingItem.id ? res.data : a).sort((a, b) => a.name.localeCompare(b.name)));
                    showToast('Agencia actualizada exitosamente');
                }
            }

            setIsModalOpen(false);
        } catch (err) {
            console.error('Error guardando registro:', err);
            const msg = err.response?.data?.error ||
                (err.response?.data && typeof err.response.data === 'object'
                    ? Object.values(err.response.data).flat().join(' ')
                    : 'Error al procesar la solicitud.');
            setModalError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    // Open Delete confirmation
    const handleConfirmDelete = (item, type) => {
        setDeleteModal({
            isOpen: true,
            item,
            type
        });
    };

    // Execute Delete
    const handleExecuteDelete = async () => {
        const { item, type } = deleteModal;
        if (!item) return;

        setDeleting(true);
        try {
            if (type === 'client') {
                await axios.delete(`/operaciones/clients/${item.id}/`);
                setClients(prev => prev.filter(c => c.id !== item.id));
                showToast('Cliente eliminado correctamente');
            } else {
                await axios.delete(`/operaciones/agencies/${item.id}/`);
                setAgencies(prev => prev.filter(a => a.id !== item.id));
                showToast('Agencia eliminada correctamente');
            }
            setDeleteModal({ isOpen: false, item: null, type: null });
        } catch (err) {
            console.error('Error eliminando registro:', err);
            const errorMsg = err.response?.data?.error || 'No se pudo eliminar el registro seleccionado.';
            showToast(errorMsg, 'error');
            setDeleteModal({ isOpen: false, item: null, type: null });
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Toast Notification */}
            {toast && (
                <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold transition-all duration-300 animate-slideDown ${
                    toast.type === 'error'
                        ? 'bg-red-50 dark:bg-red-900/90 text-red-800 dark:text-red-200 border-red-200 dark:border-red-700'
                        : 'bg-emerald-50 dark:bg-emerald-900/90 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-700'
                }`}>
                    <i className={`bi ${toast.type === 'error' ? 'bi-exclamation-triangle-fill text-red-500' : 'bi-check-circle-fill text-emerald-500'} text-lg`}></i>
                    <span>{toast.message}</span>
                </div>
            )}

            {/* Header & Controls */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 p-5 sm:p-6 transition-colors">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2.5">
                            <i className="bi bi-journal-bookmark-fill text-indigo-600 dark:text-indigo-400"></i>
                            Directorio de Registros
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            Administra la base de datos central de clientes y agencias marítimas autorizadas.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        <button
                            type="button"
                            onClick={fetchData}
                            className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-bold transition-colors shadow-sm"
                            title="Recargar datos"
                        >
                            <i className="bi bi-arrow-clockwise text-lg"></i>
                        </button>

                        <button
                            type="button"
                            onClick={handleOpenCreate}
                            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-sm shadow-indigo-200 dark:shadow-none transition-all flex items-center gap-2"
                        >
                            <i className="bi bi-plus-lg"></i>
                            <span>Nuevo {activeTab === 'clients' ? 'Cliente' : 'Agencia'}</span>
                        </button>
                    </div>
                </div>

                {/* Tabs switcher and Search input */}
                <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Tabs */}
                    <div className="flex p-1 bg-slate-100 dark:bg-slate-900 rounded-xl w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={() => { setActiveTab('clients'); setSearchTerm(''); }}
                            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${
                                activeTab === 'clients'
                                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <i className="bi bi-people-fill text-base"></i>
                            <span>Clientes</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-black ${
                                activeTab === 'clients'
                                    ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300'
                                    : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                            }`}>
                                {clients.length}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => { setActiveTab('agencies'); setSearchTerm(''); }}
                            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${
                                activeTab === 'agencies'
                                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <i className="bi bi-buildings-fill text-base"></i>
                            <span>Agencias</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-black ${
                                activeTab === 'agencies'
                                    ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300'
                                    : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                            }`}>
                                {agencies.length}
                            </span>
                        </button>
                    </div>

                    {/* Search Bar */}
                    <div className="relative w-full sm:w-80">
                        <i className="bi bi-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"></i>
                        <input
                            type="text"
                            placeholder={`Buscar en ${activeTab === 'clients' ? 'clientes' : 'agencias'}...`}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                <i className="bi bi-x-circle-fill"></i>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Content Table / Cards */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <LogoSpinner size="w-14 h-14" />
                    <p className="mt-4 text-sm font-semibold text-slate-500 dark:text-slate-400">Cargando datos...</p>
                </div>
            ) : activeTab === 'clients' ? (
                /* TAB 1: CLIENTES */
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
                    {filteredClients.length === 0 ? (
                        <div className="py-16 text-center px-4">
                            <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                                <i className="bi bi-people"></i>
                            </div>
                            <h3 className="text-base font-bold text-slate-800 dark:text-white">
                                {searchTerm ? 'No se encontraron clientes' : 'No hay clientes registrados aún'}
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                                {searchTerm ? 'Intenta con otro término de búsqueda.' : 'Crea tu primer cliente para comenzar a asignarlo en las operaciones.'}
                            </p>
                            {!searchTerm && (
                                <button
                                    onClick={handleOpenCreate}
                                    className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-colors inline-flex items-center gap-2"
                                >
                                    <i className="bi bi-plus-lg"></i>
                                    Crear Cliente
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                                <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700">
                                    <tr>
                                        <th className="px-6 py-4">Cliente / Razón Social</th>
                                        <th className="px-6 py-4">Persona de Contacto</th>
                                        <th className="px-6 py-4">Correo Electrónico</th>
                                        <th className="px-6 py-4">Teléfono</th>
                                        <th className="px-6 py-4 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
                                    {filteredClients.map((client) => (
                                        <tr key={client.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-black text-sm flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-800">
                                                        {(client.name || 'C')[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-slate-900 dark:text-white block">
                                                            {client.name}
                                                        </span>
                                                        <span className="text-[11px] text-slate-400 font-mono">
                                                            ID #{client.id}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {client.contact_person ? (
                                                    <span className="text-slate-800 dark:text-slate-200">
                                                        {client.contact_person}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 italic text-xs">Sin contacto</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {client.email ? (
                                                    <a
                                                        href={`mailto:${client.email}`}
                                                        className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1.5"
                                                    >
                                                        <i className="bi bi-envelope text-xs"></i>
                                                        <span>{client.email}</span>
                                                    </a>
                                                ) : (
                                                    <span className="text-slate-400 italic text-xs">Sin email</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {client.phone ? (
                                                    <span className="text-slate-700 dark:text-slate-300 font-mono text-xs">
                                                        {client.phone}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 italic text-xs">Sin teléfono</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenEdit(client)}
                                                        className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-400 rounded-lg transition-colors"
                                                        title="Editar cliente"
                                                    >
                                                        <i className="bi bi-pencil-square text-base"></i>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleConfirmDelete(client, 'client')}
                                                        className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:text-red-400 rounded-lg transition-colors"
                                                        title="Eliminar cliente"
                                                    >
                                                        <i className="bi bi-trash-fill text-base"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            ) : (
                /* TAB 2: AGENCIAS */
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
                    {filteredAgencies.length === 0 ? (
                        <div className="py-16 text-center px-4">
                            <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                                <i className="bi bi-buildings"></i>
                            </div>
                            <h3 className="text-base font-bold text-slate-800 dark:text-white">
                                {searchTerm ? 'No se encontraron agencias' : 'No hay agencias registradas aún'}
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                                {searchTerm ? 'Intenta con otro término de búsqueda.' : 'Crea tu primera agencia marítima para asignarla en las operaciones.'}
                            </p>
                            {!searchTerm && (
                                <button
                                    onClick={handleOpenCreate}
                                    className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-colors inline-flex items-center gap-2"
                                >
                                    <i className="bi bi-plus-lg"></i>
                                    Crear Agencia
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                                <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700">
                                    <tr>
                                        <th className="px-6 py-4">Agencia Marítima</th>
                                        <th className="px-6 py-4">Contacto Asignado</th>
                                        <th className="px-6 py-4">Correo Electrónico</th>
                                        <th className="px-6 py-4">Teléfono</th>
                                        <th className="px-6 py-4 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
                                    {filteredAgencies.map((agency) => (
                                        <tr key={agency.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 font-black text-sm flex items-center justify-center shrink-0 border border-purple-100 dark:border-purple-800">
                                                        {(agency.name || 'A')[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-slate-900 dark:text-white block">
                                                            {agency.name}
                                                        </span>
                                                        <span className="text-[11px] text-slate-400 font-mono">
                                                            ID #{agency.id}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {agency.contact_name ? (
                                                    <span className="text-slate-800 dark:text-slate-200">
                                                        {agency.contact_name}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 italic text-xs">Sin contacto</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {agency.email ? (
                                                    <a
                                                        href={`mailto:${agency.email}`}
                                                        className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1.5"
                                                    >
                                                        <i className="bi bi-envelope text-xs"></i>
                                                        <span>{agency.email}</span>
                                                    </a>
                                                ) : (
                                                    <span className="text-slate-400 italic text-xs">Sin email</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {agency.phone ? (
                                                    <span className="text-slate-700 dark:text-slate-300 font-mono text-xs">
                                                        {agency.phone}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 italic text-xs">Sin teléfono</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenEdit(agency)}
                                                        className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-400 rounded-lg transition-colors"
                                                        title="Editar agencia"
                                                    >
                                                        <i className="bi bi-pencil-square text-base"></i>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleConfirmDelete(agency, 'agency')}
                                                        className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:text-red-400 rounded-lg transition-colors"
                                                        title="Eliminar agencia"
                                                    >
                                                        <i className="bi bi-trash-fill text-base"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Modal de Creación / Edición */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-lg w-full overflow-hidden animate-scaleUp">
                        {/* Modal Header */}
                        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/40">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                                    <i className={`bi ${modalMode === 'create' ? 'bi-plus-lg' : 'bi-pencil-square'} text-lg`}></i>
                                </div>
                                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                                    {modalMode === 'create' ? 'Nuevo' : 'Editar'} {activeTab === 'clients' ? 'Cliente' : 'Agencia'}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg transition-colors"
                            >
                                <i className="bi bi-x-lg text-lg"></i>
                            </button>
                        </div>

                        {/* Modal Form */}
                        <form onSubmit={handleSubmitForm} className="p-6 space-y-4">
                            {modalError && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-xs font-semibold">
                                    <i className="bi bi-exclamation-circle-fill mr-1.5"></i>
                                    {modalError}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                                    Nombre / Razón Social <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder={activeTab === 'clients' ? 'Ej. Navios Maritime Holdings' : 'Ej. Agencia Marítima Robinson'}
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white transition-colors"
                                />
                            </div>

                            {activeTab === 'clients' ? (
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                                        Persona de Contacto
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ej. Juan Pérez"
                                        value={formData.contact_person}
                                        onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                                        className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white transition-colors"
                                    />
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                                        Nombre de Contacto
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ej. Martín García"
                                        value={formData.contact_name}
                                        onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                                        className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white transition-colors"
                                    />
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                                        Correo Electrónico
                                    </label>
                                    <input
                                        type="email"
                                        placeholder="contacto@empresa.com"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white transition-colors"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                                        Teléfono
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="+54 9 11 1234-5678"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white transition-colors"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    disabled={submitting}
                                    className="px-4 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                                >
                                    {submitting && <i className="bi bi-arrow-repeat animate-spin"></i>}
                                    <span>{modalMode === 'create' ? 'Guardar' : 'Actualizar'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Confirmación de Eliminación */}
            {deleteModal.isOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-md w-full p-6 animate-scaleUp">
                        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-4 text-2xl">
                            <i className="bi bi-trash"></i>
                        </div>
                        <h3 className="text-lg font-black text-center text-slate-900 dark:text-white mb-2">
                            ¿Eliminar {deleteModal.type === 'client' ? 'Cliente' : 'Agencia'}?
                        </h3>
                        <p className="text-sm text-center text-slate-500 dark:text-slate-400 mb-6">
                            Estás a punto de eliminar a <strong className="text-slate-800 dark:text-slate-200">"{deleteModal.item?.name}"</strong>. Esta acción no se puede deshacer.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setDeleteModal({ isOpen: false, item: null, type: null })}
                                disabled={deleting}
                                className="w-full py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleExecuteDelete}
                                disabled={deleting}
                                className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {deleting && <i className="bi bi-arrow-repeat animate-spin"></i>}
                                <span>Eliminar</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
