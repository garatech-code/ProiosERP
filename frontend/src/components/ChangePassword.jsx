import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const hasConsecutiveNumbers = (str) => {
    for (let i = 0; i < str.length - 2; i++) {
        const chunk = str.slice(i, i + 3);
        if (/^\d{3}$/.test(chunk)) {
            const val1 = parseInt(chunk[0], 10);
            const val2 = parseInt(chunk[1], 10);
            const val3 = parseInt(chunk[2], 10);
            if ((val2 === val1 + 1 && val3 === val2 + 1) || (val1 === 8 && val2 === 9 && val3 === 0)) {
                return true;
            }
            if ((val2 === val1 - 1 && val3 === val2 - 1) || (val1 === 0 && val2 === 9 && val3 === 8)) {
                return true;
            }
        }
    }
    return false;
};

const hasRepeatingPattern = (str) => {
    const s = str.toLowerCase();
    for (let len = 2; len <= Math.floor(s.length / 2); len++) {
        for (let i = 0; i <= s.length - 2 * len; i++) {
            const pattern = s.slice(i, i + len);
            const next = s.slice(i + len, i + 2 * len);
            if (pattern === next) {
                return true;
            }
        }
    }
    return false;
};

export default function ChangePassword() {
    const { user, updateAuthUser, logout } = useAuth();
    const navigate = useNavigate();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // States of checks
    const [checks, setChecks] = useState({
        length: false,
        uppercase: false,
        lowercase: false,
        specialChar: false,
        notConsecutive: true,
        notRepeating: true,
        notDni: true,
        match: false,
    });

    useEffect(() => {
        const specialCharRegex = /[!@#$%^&*(),.?":{}|<>\-_=+[\]\\/;:'`~]/;
        const uppercaseRegex = /[A-Z]/;
        const lowercaseRegex = /[a-z]/;

        setChecks({
            length: password.length >= 8,
            uppercase: uppercaseRegex.test(password),
            lowercase: lowercaseRegex.test(password),
            specialChar: specialCharRegex.test(password),
            notConsecutive: !hasConsecutiveNumbers(password),
            notRepeating: !hasRepeatingPattern(password),
            notDni: user ? password !== user.username : true,
            match: password === confirmPassword && password.length > 0,
        });
    }, [password, confirmPassword, user]);

    const isAllPassed = Object.values(checks).every(Boolean);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isAllPassed) return;

        setLoading(true);
        setError('');

        try {
            const res = await api.post('/usuarios/users/change_password/', {
                new_password: password,
            });
            const { access, refresh } = res.data;
            updateAuthUser(access, refresh);
            navigate('/dashboard');
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.detail || 'Error al cambiar la contraseña. Inténtelo de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 sm:p-6 font-sans">
            {/* Cabecera / Branding */}
            <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 bg-proios-accent rounded-xl flex items-center justify-center font-black text-2xl text-white shadow-lg shadow-cyan-900/30">
                    P
                </div>
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-white">
                        Proios <span className="text-proios-accent font-light">Manager</span>
                    </h1>
                    <span className="text-[10px] uppercase text-cyan-400 font-bold tracking-widest block">
                        Control de Acceso
                    </span>
                </div>
            </div>

            {/* Contenedor Glassmorphism */}
            <div className="w-full max-w-md bg-slate-800/80 backdrop-blur-xl border border-slate-700/50 shadow-2xl p-6 sm:p-8 rounded-2xl">
                <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                    <i className="bi bi-shield-lock text-proios-accent"></i>
                    Cambiar Contraseña
                </h2>
                <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                    Es obligatorio cambiar tu contraseña temporal en tu primer ingreso para garantizar la seguridad de tu cuenta.
                </p>

                {error && (
                    <div className="mb-4 p-3 bg-red-950/50 border border-red-500/30 text-red-200 text-xs font-semibold rounded-lg flex items-center gap-2">
                        <i className="bi bi-exclamation-triangle-fill text-red-500 text-sm"></i>
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Campo: Nueva Contraseña */}
                    <div>
                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                            Nueva Contraseña
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-3 pr-10 py-2.5 bg-slate-900/60 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-proios-accent focus:border-transparent transition-all"
                                placeholder="Escribe tu nueva contraseña"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                            >
                                <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                            </button>
                        </div>
                    </div>

                    {/* Campo: Confirmar Contraseña */}
                    <div>
                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                            Confirmar Contraseña
                        </label>
                        <div className="relative">
                            <input
                                type={showConfirmPassword ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full pl-3 pr-10 py-2.5 bg-slate-900/60 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-proios-accent focus:border-transparent transition-all"
                                placeholder="Confirma tu contraseña"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                            >
                                <i className={`bi ${showConfirmPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                            </button>
                        </div>
                    </div>

                    {/* Checklist de Validación */}
                    <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 space-y-2 mt-4">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                            Requisitos de Seguridad:
                        </p>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="flex items-center text-xs">
                                <i className={`bi ${checks.length ? 'bi-check-circle-fill text-emerald-400' : 'bi-x-circle-fill text-slate-600'} mr-2`}></i>
                                <span className={checks.length ? 'text-slate-300' : 'text-slate-500'}>Min. 8 caracteres</span>
                            </div>
                            <div className="flex items-center text-xs">
                                <i className={`bi ${checks.uppercase ? 'bi-check-circle-fill text-emerald-400' : 'bi-x-circle-fill text-slate-600'} mr-2`}></i>
                                <span className={checks.uppercase ? 'text-slate-300' : 'text-slate-500'}>Una mayúscula</span>
                            </div>
                            <div className="flex items-center text-xs">
                                <i className={`bi ${checks.lowercase ? 'bi-check-circle-fill text-emerald-400' : 'bi-x-circle-fill text-slate-600'} mr-2`}></i>
                                <span className={checks.lowercase ? 'text-slate-300' : 'text-slate-500'}>Una minúscula</span>
                            </div>
                            <div className="flex items-center text-xs">
                                <i className={`bi ${checks.specialChar ? 'bi-check-circle-fill text-emerald-400' : 'bi-x-circle-fill text-slate-600'} mr-2`}></i>
                                <span className={checks.specialChar ? 'text-slate-300' : 'text-slate-500'}>Carácter especial</span>
                            </div>
                            <div className="flex items-center text-xs">
                                <i className={`bi ${checks.notConsecutive ? 'bi-check-circle-fill text-emerald-400' : 'bi-x-circle-fill text-slate-600'} mr-2`}></i>
                                <span className={checks.notConsecutive ? 'text-slate-300' : 'text-slate-500'}>Sin números consecutivos</span>
                            </div>
                            <div className="flex items-center text-xs">
                                <i className={`bi ${checks.notRepeating ? 'bi-check-circle-fill text-emerald-400' : 'bi-x-circle-fill text-slate-600'} mr-2`}></i>
                                <span className={checks.notRepeating ? 'text-slate-300' : 'text-slate-500'}>Sin patrones repetidos</span>
                            </div>
                            <div className="flex items-center text-xs col-span-1 sm:col-span-2">
                                <i className={`bi ${checks.notDni ? 'bi-check-circle-fill text-emerald-400' : 'bi-x-circle-fill text-slate-600'} mr-2`}></i>
                                <span className={checks.notDni ? 'text-slate-300' : 'text-slate-500'}>No puede ser igual a tu usuario/DNI</span>
                            </div>
                            <div className="flex items-center text-xs col-span-1 sm:col-span-2 border-t border-slate-700/50 pt-2 mt-1">
                                <i className={`bi ${checks.match ? 'bi-check-circle-fill text-emerald-400' : 'bi-x-circle-fill text-slate-600'} mr-2`}></i>
                                <span className={checks.match ? 'text-slate-300' : 'text-slate-500'}>Las contraseñas coinciden</span>
                            </div>
                        </div>
                    </div>

                    {/* Botón Guardar */}
                    <button
                        type="submit"
                        disabled={!isAllPassed || loading}
                        className="w-full py-2.5 bg-proios-accent hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm rounded-lg transition-opacity flex items-center justify-center gap-2 shadow-lg shadow-cyan-900/30"
                    >
                        {loading ? (
                            <>
                                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                                Guardando...
                            </>
                        ) : (
                            <>
                                <i className="bi bi-check2-circle"></i>
                                Guardar Contraseña
                            </>
                        )}
                    </button>
                </form>

                {/* Salir */}
                <div className="mt-6 text-center">
                    <button
                        onClick={logout}
                        className="text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
                    >
                        Cancelar y Cerrar Sesión
                    </button>
                </div>
            </div>
        </div>
    );
}
