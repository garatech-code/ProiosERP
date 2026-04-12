import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import DashboardRouter from './components/DashboardRouter';
import OperationForm from './components/OperationForm';
import OperationDetail from './components/OperationDetail';
import InventoryManagement from './components/InventoryManagement';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardRouter /></ProtectedRoute>} />
      <Route path="/operations/new" element={<ProtectedRoute><OperationForm /></ProtectedRoute>} />
      <Route path="/operations/:id/edit" element={<ProtectedRoute><OperationForm /></ProtectedRoute>} />
      <Route path="/operations/:id" element={<ProtectedRoute><OperationDetail /></ProtectedRoute>} />
      <Route path="/inventory" element={<InventoryManagement />} />
    </Routes>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
};

export default App;