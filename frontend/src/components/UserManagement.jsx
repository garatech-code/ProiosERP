import React, { useState, useEffect } from 'react';
import axios from '../api/axios';
import { formatUserName } from '../utils/formatters';

const ROLE_LABELS = {
    OWNER: 'Dueño / Admin',
    OPERADOR: 'Operador Senior',
    OPERADOR_JR: 'Operador Junior',
    CONTABLE: 'Contable',
    OPERARIO: 'Operario de Planta',
};

const ROLE_BADGES = {
    OWNER: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    OPERADOR: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    OPERADOR_JR: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300 border-sky-200 dark:border-sky-800',
    CONTABLE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    OPERARIO: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
};

export default function UserManagement() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        username: '', // DNI
        first_name: '',
        last_name: '',
        role: 'OPERARIO',
    });
    const [formError, setFormError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/usuarios/users/');
            setUsers(res.data);
            setError('');
        } catch (err) {
            console.error(err);
            setError('Error al cargar la lista de usuarios.');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleOpenModal = () => {
        setFormData({
            username: '',
            first_name: '',
            last_name: '',
            role: 'OPERARIO',
        });
        setFormError('');
        setIsModalOpen(true);
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setFormError('');

        // Basic DNI validation
        if (!/^\d+$/.test(formData.username)) {
            setFormError('El DNI debe contener solo números.');
            setSubmitting(false);
            return;
        }

        try {
            await axios.post('/usuarios/users/', formData);
            setSuccessMessage('Usuario creado con éxito.');
            setIsModalOpen(false);
            fetchUsers();
            setTimeout(() => setSuccessMessage(''), 5000);
        } catch (err) {
            console.error(err);
            setFormError(err.response?.data?.detail || 'Error al crear el usuario. Verifique los datos.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteUser = async (id, username) => {
        if (!window.confirm(`¿Está seguro de eliminar el usuario con DNI ${username}? Esta acción no se puede deshacer.`)) {
            return;
        }

        try {
            await axios.delete(`/usuarios/users/${id}/`);
            setSuccessMessage('Usuario eliminado correctamente.');
            fetchUsers();
            setTimeout(() => setSuccessMessage(''), 5000);
        } catch (err) {
            console.error(err);
            alert('No se pudo eliminar el usuario.');
        }
    };

    return (
        <div className="space-y-6 animate-fadeIn text-slate-800 dark:text-slate-100">
            {/* Cabecera de Sección */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Gestión de Usuarios del Sistema</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Crea y administra los accesos web para operadores, contables y personal directivo.
                    </p>
                </div>
                <button
                    onClick={handleOpenModal}
                    className="w-full sm:w-auto bg-proios-accent hover:opacity-90 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2"
                >
                    <i className="bi bi-person-plus-fill text-lg"></i>
                    Crear Usuario
                </button>
            </div>

            {/* Toasts / Mensajes */}
            {successMessage && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border-l-4 border-emerald-500 text-emerald-800 dark:text-emerald-200 text-sm font-semibold rounded-r-xl shadow-sm flex items-center gap-2 animate-fadeIn">
                    <i className="bi bi-check-circle-fill text-emerald-500"></i>
                    <span>{successMessage}</span>
                </div>
            )}
            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-950/30 border-l-4 border-red-500 text-red-800 dark:text-red-200 text-sm font-semibold rounded-r-xl shadow-sm flex items-center gap-2">
                    <i className="bi bi-exclamation-triangle-fill text-red-500"></i>
                    <span>{error}</span>
                </div>
            )}

            {/* Listado de Usuarios */}
            {loading ? (
                <div className="py-16 text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-proios-accent mx-auto"></div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-4">Cargando usuarios...</p>
                </div>
            ) : users.length === 0 ? (
                <div className="py-16 text-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl">
                    <i className="bi bi-people text-4xl text-slate-400 mb-3 block"></i>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">No hay usuarios del sistema creados.</p>
                </div>
            ) : (
                <>
                    {/* Tabla de Escritorio */}
                    <div className="hidden md:block bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
                                <thead className="text-xs text-slate-700 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                        <th className="px-6 py-4 font-bold">DNI (Usuario)</th>
                                        <th className="px-6 py-4 font-bold">Nombre Completo</th>
                                        <th className="px-6 py-4 font-bold">Rol</th>
                                        <th className="px-6 py-4 font-bold text-center">Estado de Contraseña</th>
                                        <th className="px-6 py-4 font-bold text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {users.map((u) => (
                                        <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors">
                                            <td className="px-6 py-4 font-mono font-bold text-slate-900 dark:text-white">
                                                {u.username}
                                            </td>
                                            <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                                                {formatUserName(u)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${ROLE_BADGES[u.role] || ''}`}>
                                                    {ROLE_LABELS[u.role] || u.role}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {u.must_change_password ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 rounded-full border border-amber-200 dark:border-amber-900/50 animate-pulse-subtle">
                                                        <i className="bi bi-shield-exclamation text-xs"></i>
                                                        Pendiente de cambio
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 rounded-full border border-emerald-200 dark:border-emerald-900/50">
                                                        <i className="bi bi-shield-check text-xs"></i>
                                                        Establecida
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => handleDeleteUser(u.id, u.username)}
                                                    className="text-red-500 hover:text-red-700 dark:hover:text-red-400 p-2 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors"
                                                    title="Eliminar usuario"
                                                >
                                                    <i className="bi bi-trash text-lg"></i>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Cards de Vista Móvil */}
                    <div className="grid grid-cols-1 gap-4 md:hidden">
                        {users.map((u) => (
                            <div
                                key={u.id}
                                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm space-y-3 relative overflow-hidden"
                            >
                                <div className="absolute top-0 left-0 w-1.5 h-full bg-proios-accent"></div>
                                <div className="pl-2 space-y-2">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-bold text-slate-900 dark:text-white text-base">
                                                {formatUserName(u)}
                                            </h3>
                                            <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
                                                DNI: {u.username}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteUser(u.id, u.username)}
                                            className="text-red-500 hover:text-red-700 dark:hover:text-red-400 p-2 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors"
                                        >
                                            <i className="bi bi-trash text-lg"></i>
                                        </button>
                                    </div>

                                    <div className="text-xs space-y-1 text-slate-600 dark:text-slate-400">
                                        <div className="flex flex-wrap gap-2 pt-2">
                                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${ROLE_BADGES[u.role] || ''}`}>
                                                {ROLE_LABELS[u.role] || u.role}
                                            </span>
                                            {u.must_change_password ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 rounded-full border border-amber-200 dark:border-amber-900/50">
                                                    <i className="bi bi-shield-exclamation text-[10px]"></i>
                                                    Clave inicial
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 rounded-full border border-emerald-200 dark:border-emerald-900/50">
                                                    <i className="bi bi-shield-check text-[10px]"></i>
                                                    Clave modificada
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* Modal de Creación */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700 my-auto">
                        {/* Cabecera Modal */}
                        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                            <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                                <i className="bi bi-person-plus text-proios-accent"></i>
                                Nuevo Usuario
                            </h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg p-1.5 shadow-sm transition-colors"
                            >
                                <i className="bi bi-x-lg"></i>
                            </button>
                        </div>

                        {/* Formulario */}
                        <form onSubmit={handleCreateUser} className="p-6 space-y-4">
                            {formError && (
                                <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-200 text-xs font-semibold rounded-lg flex items-center gap-2">
                                    <i className="bi bi-exclamation-triangle-fill text-red-500"></i>
                                    <span>{formError}</span>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    DNI *
                                </label>
                                <input
                                    type="text"
                                    name="username"
                                    value={formData.username}
                                    onChange={handleInputChange}
                                    required
                                    className="block w-full py-2 px-3 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-proios-accent focus:border-proios-accent sm:text-sm font-medium transition-colors"
                                    placeholder="Ej. 12345678 (Sin puntos)"
                                />
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-1">
                                    <i className="bi bi-info-circle mr-1"></i>
                                    Funcionará como usuario y contraseña temporal inicial.
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Nombre *
                                    </label>
                                    <input
                                        type="text"
                                        name="first_name"
                                        value={formData.first_name}
                                        onChange={handleInputChange}
                                        required
                                        className="block w-full py-2 px-3 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-proios-accent focus:border-proios-accent sm:text-sm font-medium transition-colors"
                                        placeholder="Ej. Juan"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Apellidos *
                                    </label>
                                    <input
                                        type="text"
                                        name="last_name"
                                        value={formData.last_name}
                                        onChange={handleInputChange}
                                        required
                                        className="block w-full py-2 px-3 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-proios-accent focus:border-proios-accent sm:text-sm font-medium transition-colors"
                                        placeholder="Ej. Pérez"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Rol en el Sistema *
                                </label>
                                <select
                                    name="role"
                                    value={formData.role}
                                    onChange={handleInputChange}
                                    className="block w-full py-2 px-3 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-proios-accent focus:border-proios-accent sm:text-sm font-medium transition-colors cursor-pointer"
                                >
                                    {Object.entries(ROLE_LABELS).map(([value, label]) => (
                                        <option key={value} value={value}>
                                            {label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg text-sm font-bold transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-6 py-2 bg-proios-accent hover:opacity-90 text-white rounded-lg text-sm font-bold shadow-sm transition-opacity flex items-center gap-2"
                                >
                                    {submitting ? (
                                        <>
                                            <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                                            Guardando...
                                        </>
                                    ) : (
                                        <>
                                            <i className="bi bi-send"></i>
                                            Crear Usuario
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
