import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        const token = localStorage.getItem('access_token');
        if (token) {
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                return { 
                    id: payload.user_id, 
                    username: payload.username, 
                    role: payload.role, 
                    must_change_password: payload.must_change_password,
                    first_name: payload.first_name,
                    last_name: payload.last_name
                };
            } catch (e) {
                return null;
            }
        }
        return null;
    });
    const [loading, setLoading] = useState(true);

    const logout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        setUser(null);
    };

    useEffect(() => {
        // En un caso real podrías validar el token en el servidor aquí
        const token = localStorage.getItem('access_token');
        if (token && !user) {
             // fallback si por alguna razon falló la init síncrona
        } else if (!token && user) {
            logout();
        }
        setLoading(false);

        // Escuchar evento de logout (por si se dispara desde el interceptor)
        const handleLogoutEvent = () => logout();
        window.addEventListener('auth:logout', handleLogoutEvent);
        return () => window.removeEventListener('auth:logout', handleLogoutEvent);
    }, []);

    const login = async (username, password) => {
        try {
            const response = await api.post('/core/auth/login/', { username, password });
            const { access, refresh } = response.data;
            localStorage.setItem('access_token', access);
            localStorage.setItem('refresh_token', refresh);
            // Decodificar token
            const payload = JSON.parse(atob(access.split('.')[1]));
            setUser({ 
                id: payload.user_id, 
                username: payload.username, 
                role: payload.role, 
                must_change_password: payload.must_change_password,
                first_name: payload.first_name,
                last_name: payload.last_name
            });
        } catch (error) {
            console.error('Login error', error);
            throw error;
        }
    };

    const updateAuthUser = (access, refresh) => {
        localStorage.setItem('access_token', access);
        localStorage.setItem('refresh_token', refresh);
        const payload = JSON.parse(atob(access.split('.')[1]));
        setUser({
            id: payload.user_id,
            username: payload.username,
            role: payload.role,
            must_change_password: payload.must_change_password,
            first_name: payload.first_name,
            last_name: payload.last_name
        });
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, updateAuthUser }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);