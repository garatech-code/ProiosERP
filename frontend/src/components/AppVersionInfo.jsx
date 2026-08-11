import { useState, useEffect } from 'react';
import axios from '../api/axios';
import { APP_VERSION } from '../version';

export default function AppVersionInfo({ isSidebarOpen }) {
    const [backendVersion, setBackendVersion] = useState('...');
    
    useEffect(() => {
        axios.get('/version/')
            .then(res => setBackendVersion(res.data.backend_version))
            .catch(() => setBackendVersion('err'));
    }, []);

    const frontendVersion = APP_VERSION;

    if (!isSidebarOpen) {
        return (
            <div className="mt-2 text-center text-[9px] font-mono text-slate-600 truncate w-full cursor-help" title={`FE: ${frontendVersion}\nBE: ${backendVersion}`}>
                {frontendVersion}
            </div>
        );
    }

    return (
        <div className="mt-4 pt-3 border-t border-slate-800/80 w-full flex flex-col items-center justify-center text-[10px] text-slate-500 font-mono tracking-wider cursor-default" title="Versión del Sistema">
            <span>UI: <strong className="text-slate-400">{frontendVersion}</strong> | API: <strong className="text-slate-400">{backendVersion}</strong></span>
        </div>
    );
}
