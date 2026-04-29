import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Login from './components/Login';
import DashboardRouter from './components/DashboardRouter';
import OperationFormProductos from './components/OperationFormProductos';
import OperationDetail from './components/OperationDetail';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

const AppRoutes = () => {
  const { user, logout } = useAuth();

  useEffect(() => {
    let intervalId;

    const updateActivity = () => {
      if (user) {
        localStorage.setItem('last_activity', Date.now().toString());
      }
    };

    const checkInactivity = () => {
      if (user) {
        const lastActivity = parseInt(localStorage.getItem('last_activity') || Date.now().toString(), 10);
        const now = Date.now();
        // 5 minutos de inactividad
        if (now - lastActivity > 5 * 60 * 1000) {
          logout();
          window.location.href = '/login';
        }
      }
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    if (user) {
      // Inicializar
      updateActivity();
      events.forEach(e => window.addEventListener(e, updateActivity));
      
      // Chequear cada 10 segundos
      intervalId = setInterval(checkInactivity, 10000);
    }

    return () => {
      clearInterval(intervalId);
      events.forEach(e => window.removeEventListener(e, updateActivity));
    };
  }, [user, logout]);

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardRouter /></ProtectedRoute>} />
      <Route path="/operations/new" element={<ProtectedRoute><OperationFormProductos /></ProtectedRoute>} />
      <Route path="/operations/:id/edit" element={<ProtectedRoute><OperationFormProductos /></ProtectedRoute>} />
      <Route path="/operations/:id" element={<ProtectedRoute><OperationDetail /></ProtectedRoute>} />
    </Routes>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <ThemeProvider>
        <Router>
          <div className="min-h-screen">
            <AppRoutes />
          </div>
        </Router>
      </ThemeProvider>
    </AuthProvider>
  );
};

export default App;