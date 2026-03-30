import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { useState } from 'react';

const Dashboard = () => {
    const { user, logout } = useAuth();
    const [resData, setResData] = useState(null);

    const testEndpoint = async () => {
        try {
            // Try to fetch resources to test endpoint auth and DB
            const res = await api.get('/operations/resources/');
            setResData(res.data);
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="min-h-screen bg-proios-bg">
            {/* Navbar */}
            <nav className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center">
                            <span className="text-2xl font-bold text-proios-dark">PROIOS</span>
                        </div>
                        <div className="flex items-center space-x-4">
                            <span className="text-sm font-medium">Hello, {user?.username} ({user?.role})</span>
                            <button onClick={logout} className="text-sm text-red-600 hover:text-red-800">
                                Cerrar Sesión
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <div className="px-4 py-6 sm:px-0">
                    <div className="border-4 border-dashed border-gray-200 rounded-lg h-96 p-6 bg-proios-card shadow-sm flex flex-col items-start space-y-4">
                        <h2 className="text-xl font-bold mb-4">Panel de Control (Minimal Industrial UI)</h2>
                        <p className="text-gray-600">
                            Bienvenido al sistema Proios. Este es el proyecto base que incluye Autenticación JWT, RBAC, y validación estricta de base de datos.
                        </p>

                        <button onClick={testEndpoint} className="btn-primary">
                            Probar Endpoint Protegido (Test Atomic/Locking)
                        </button>

                        {resData && (
                            <div className="w-full bg-gray-50 border p-4 rounded mt-4 overflow-auto">
                                <pre className="text-sm text-gray-700">{JSON.stringify(resData, null, 2)}</pre>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Dashboard;
