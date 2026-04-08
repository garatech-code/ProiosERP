import { Suspense, lazy } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Importaciones perezosas (Lazy Loading)
// El navegador solo descargará el archivo que corresponda al rol del usuario.
const OwnerDashboard = lazy(() => import('../dashboards/OwnerDashboard'));
const OperadorDashboard = lazy(() => import('../dashboards/OperadorDashboard'));
const ContableDashboard = lazy(() => import('../dashboards/ContableDashboard'));
const OperarioDashboard = lazy(() => import('../dashboards/OperarioDashboard'));


export default function DashboardRouter() {
    const { user } = useAuth();

    // Pantalla de carga mientras se descarga el chunk del componente correspondiente
    const LoadingFallback = () => (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <p className="text-gray-500 font-medium tracking-wide">Cargando tu espacio de trabajo...</p>
        </div>
    );

    // Si no hay usuario cargado aún (por seguridad o latencia)
    if (!user || !user.role) {
        return <LoadingFallback />;
    }

    // Renderizamos el dashboard específico según el rol
    const renderDashboard = () => {
        switch (user.role) {
            case 'OWNER':
                return <OwnerDashboard />;
            case 'OPERADOR':
                return <OperadorDashboard />;
            case 'CONTABLE':
                return <ContableDashboard />;
            case 'OPERARIO':
                return <OperarioDashboard />;
            default:
                // Fallback por si hay un rol no reconocido
                console.warn(`Rol no reconocido: ${user.role}`);
                return <Navigate to="/unauthorized" replace />;
        }
    };

    return (
        <Suspense fallback={<LoadingFallback />}>
            {renderDashboard()}
        </Suspense>
    );
}