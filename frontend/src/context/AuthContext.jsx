import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('access_token');
        if (token) {
            // Decode JWT to get user info, or fetch from backend
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                setUser({ username: payload.username, role: payload.role });
            } catch (e) {
                logout();
            }
        }
        setLoading(false);

        const handleLogoutEvent = () => logout();
        window.addEventListener('auth:logout', handleLogoutEvent);
        return () => window.removeEventListener('auth:logout', handleLogoutEvent);
    }, []);

    const login = async (username, password) => {
        const response = await api.post('/core/auth/login/', { username, password });
        localStorage.setItem('access_token', response.data.access);
        localStorage.setItem('refresh_token', response.data.refresh);

        // Parse JWT to set user
        const payload = JSON.parse(atob(response.data.access.split('.')[1]));
        setUser({ username: payload.username, role: payload.role });
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
