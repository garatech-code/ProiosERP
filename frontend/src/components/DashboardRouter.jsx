import { Suspense, lazy } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LogoSpinner from './LogoSpinner';

// Importaciones perezosas (Lazy Loading)
// El navegador solo descargará el archivo que corresponda al rol del usuario.
const OwnerDashboard = lazy(() => import('../dashboards/OwnerDashboard'));
const OperadorDashboard = lazy(() => import('../dashboards/OperadorDashboard'));
const ContableDashboard = lazy(() => import('../dashboards/ContableDashboard'));
const OperarioDashboard = lazy(() => import('../dashboards/OperarioDashboard'));

const LoadingFallback = () => (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center space-y-4">
        <LogoSpinner size="w-16 h-16" />
        <p className="text-gray-500 font-medium tracking-wide">Cargando tu espacio de trabajo...</p>
    </div>
);

export default function DashboardRouter() {
    const { user } = useAuth();

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
            case 'OPERADOR_JR':
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