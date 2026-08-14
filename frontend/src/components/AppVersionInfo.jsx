import { useState, useEffect } from 'react';
import axios from '../api/axios';
import { APP_VERSION } from '../version';
import AboutModal from './AboutModal';

export default function AppVersionInfo({ isSidebarOpen }) {
    const [backendVersion, setBackendVersion] = useState('...');
    const [isAboutOpen, setIsAboutOpen] = useState(false);
    
    useEffect(() => {
        axios.get('/version/')
            .then(res => setBackendVersion(res.data.backend_version))
            .catch(() => setBackendVersion('err'));
    }, []);

    const frontendVersion = APP_VERSION;

    return (
        <>
            {isSidebarOpen ? (
                <button 
                    onClick={() => setIsAboutOpen(true)} 
                    className="mt-4 pt-3 border-t border-slate-800/80 w-full flex items-center justify-center text-slate-500 hover:text-indigo-400 transition-colors" 
                    title={`FE: ${frontendVersion} | BE: ${backendVersion}\nAyuda y Acerca de`}
                >
                    <div className="w-8 h-8 rounded-full bg-slate-800/50 flex items-center justify-center">
                        <i className="bi bi-question-circle text-lg"></i>
                    </div>
                </button>
            ) : (
                <button 
                    onClick={() => setIsAboutOpen(true)} 
                    className="mt-2 w-full flex items-center justify-center text-slate-500 hover:text-indigo-400 transition-colors" 
                    title={`FE: ${frontendVersion} | BE: ${backendVersion}\nAyuda y Acerca de`}
                >
                    <div className="w-8 h-8 rounded-full bg-slate-800/50 flex items-center justify-center">
                        <i className="bi bi-question-circle text-lg"></i>
                    </div>
                </button>
            )}

            <AboutModal 
                isOpen={isAboutOpen} 
                onClose={() => setIsAboutOpen(false)} 
                frontendVersion={frontendVersion} 
                backendVersion={backendVersion} 
            />
        </>
    );
}
