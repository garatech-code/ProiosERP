import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Login from './components/Login';
import DashboardRouter from './components/DashboardRouter';
import OperationFormProductos from './components/OperationFormProductos';
import OperationDetail from './components/OperationDetail';
import ChangePassword from './components/ChangePassword';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (!user) {
    // Guardamos la URL exacta en la que estaba (incluyendo query params)
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  }
  if (user.must_change_password && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
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


        // Timeout a 15 minutos
        const timeoutMs = 15 * 60 * 1000;

        if (now - lastActivity > timeoutMs) {
          // Si expira, redirigir guardando la URL actual usando un param GET si es posible,
          // o confiar en el AuthContext/ProtectedRoute que atrapará el redireccionamiento.
          // Como usamos window.location.href, pasamos el redirect_to
          const currentPath = window.location.pathname + window.location.search;
          logout();
          window.location.href = `/login?redirect_to=${encodeURIComponent(currentPath)}`;
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
      <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
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