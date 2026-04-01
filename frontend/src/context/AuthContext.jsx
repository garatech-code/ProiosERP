import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('access_token');
        if (token) {
            // El interceptor ya pondrá el token en las peticiones, pero también lo guardamos en el estado
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                setUser({ username: payload.username, role: payload.role });
            } catch (e) {
                console.error('Error decoding token', e);
                logout(); // Token inválido, limpiamos
            }
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
            setUser({ username: payload.username, role: payload.role });
        } catch (error) {
            console.error('Login error', error);
            throw error;
        }
    };

    const logout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);