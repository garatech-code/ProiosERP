import { useEffect, useState } from 'react';
import { Joyride, STATUS } from 'react-joyride';
import { useAuth } from '../context/AuthContext';
import { useTourStore } from '../stores/tourStore';
import { tourSteps } from '../config/tours';
import { useTheme } from '../context/ThemeContext';

export default function GlobalTour() {
    const { user } = useAuth();
    const { theme } = useTheme();
    const { run, forceStart, stopTour, handleJoyrideCallback } = useTourStore();
    const [steps, setSteps] = useState([]);
    const [isClient, setIsClient] = useState(false);
    const [tourKey, setTourKey] = useState(0);

    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        if (!user || !user.role) return;
        const role = user.role.toLowerCase();
        
        let roleSteps = [];
        if (role === 'owner') roleSteps = tourSteps.owner;
        else if (role === 'operador') roleSteps = tourSteps.operador;
        else if (role === 'operario') roleSteps = tourSteps.operario;
        
        setSteps(roleSteps);
    }, [user]);

    useEffect(() => {
        if (!user || !isClient) return;

        // Auto-start logic
        const tourKey = `hasSeenTour_${user.id}`;
        const hasSeen = localStorage.getItem(tourKey);

        if (!hasSeen && !forceStart && steps.length > 0) {
            // Un pequeño delay para asegurar que el DOM cargó
            const timer = setTimeout(() => {
                setTourKey(prev => prev + 1);
                useTourStore.getState().startTour();
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [user, steps, forceStart, isClient]);

    // Escuchar cambios en forceStart para reiniciar la key
    useEffect(() => {
        if (forceStart) {
            setTourKey(prev => prev + 1);
        }
    }, [forceStart]);

    const handleCallback = (data) => {
        const { status } = data;
        
        if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
            if (user) {
                localStorage.setItem(`hasSeenTour_${user.id}`, 'true');
            }
        }
        
        handleJoyrideCallback(data);
    };

    if (!isClient || steps.length === 0) return null;

    return (
        <Joyride
            key={tourKey}
            callback={handleCallback}
            continuous
            hideCloseButton
            run={run}
            scrollToFirstStep
            showProgress
            showSkipButton
            steps={steps}
            styles={{
                options: {
                    arrowColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                    backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                    overlayColor: theme === 'dark' ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',
                    primaryColor: '#4f46e5',
                    textColor: theme === 'dark' ? '#f8fafc' : '#1e293b',
                    zIndex: 1000,
                },
                tooltipContainer: {
                    textAlign: 'left',
                },
                buttonNext: {
                    backgroundColor: '#4f46e5',
                    borderRadius: '8px',
                    color: '#ffffff',
                    padding: '8px 16px',
                    fontWeight: 'bold',
                },
                buttonBack: {
                    color: theme === 'dark' ? '#94a3b8' : '#64748b',
                    marginRight: '8px',
                },
                buttonSkip: {
                    color: theme === 'dark' ? '#94a3b8' : '#64748b',
                    fontWeight: 'bold',
                }
            }}
            locale={{
                back: 'Atrás',
                close: 'Cerrar',
                last: 'Finalizar',
                next: 'Siguiente',
                open: 'Abrir diálogo',
                skip: 'Saltar tour'
            }}
        />
    );
}
