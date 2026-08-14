import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Login from './components/Login';
import DashboardRouter from './components/DashboardRouter';
import OperationFormProductos from './components/OperationFormProductos';
import OperationDetail from './components/OperationDetail';
import ChangePassword from './components/ChangePassword';
import { ErrorBoundary } from './components/ErrorBoundary';
import GlobalTour from './components/GlobalTour';

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
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleMaintenance = () => setIsMaintenanceMode(true);
    window.addEventListener('app:maintenance', handleMaintenance);
    return () => window.removeEventListener('app:maintenance', handleMaintenance);
  }, []);

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

    let keySequence = '';
    const handleGlobalKeyPress = (e) => {
      if (e.key) {
        keySequence += e.key;
        if (keySequence.length > 4) {
          keySequence = keySequence.slice(-4);
        }
        if (keySequence.slice(-3) === '+99') {
          window.open(`http://${window.location.hostname}:4000`, '_blank');
          keySequence = '';
        } else if (keySequence === '++33') {
          keySequence = '';
          const secret = window.prompt("Kill Switch (Clave secreta):");
          if (secret) {
            fetch('/api/usuarios/users/toggle_maintenance/', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ secret: secret.trim() })
            })
            .then(res => {
              if (res.ok) window.location.reload();
              else alert('Clave incorrecta o error en el servidor.');
            })
            .catch(() => alert('Error de conexión.'));
          }
        }
      }
    };

    if (user) {
      // Inicializar
      updateActivity();
      events.forEach(e => window.addEventListener(e, updateActivity));

      // Chequear cada 10 segundos
      intervalId = setInterval(checkInactivity, 10000);
    }
    
    // Listener global de teclado (independiente de si hay usuario o no)
    window.addEventListener('keypress', handleGlobalKeyPress);

    return () => {
      clearInterval(intervalId);
      events.forEach(e => window.removeEventListener(e, updateActivity));
      window.removeEventListener('keypress', handleGlobalKeyPress);
    };
  }, [user, logout]);

  if (isMaintenanceMode && location.pathname !== '/login') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="bg-white dark:bg-gray-800 p-10 rounded-xl shadow-lg text-center max-w-md w-full">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-4">Mantenimiento Programado</h1>
          <p className="text-gray-600 dark:text-gray-400">
            El sistema se encuentra temporalmente en mantenimiento. Por favor, intente más tarde.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <GlobalTour />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardRouter /></ProtectedRoute>} />
      <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
      <Route path="/operations/new" element={<ProtectedRoute><OperationFormProductos /></ProtectedRoute>} />
      <Route path="/operations/:id/edit" element={<ProtectedRoute><OperationFormProductos /></ProtectedRoute>} />
      <Route path="/operations/:id" element={<ProtectedRoute><ErrorBoundary><OperationDetail /></ErrorBoundary></ProtectedRoute>} />
      </Routes>
    </>
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