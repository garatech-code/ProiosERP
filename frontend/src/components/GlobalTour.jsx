import { useEffect, useState } from 'react';
import { Joyride, STATUS } from 'react-joyride';
import { useAuth } from '../context/AuthContext';
import { useTourStore } from '../stores/tourStore';
import { tourSteps } from '../config/tours';
import { useTheme } from '../context/ThemeContext';
import TourTooltip from './TourTooltip';

export default function GlobalTour() {
    const { user } = useAuth();
    const { theme } = useTheme();
    const { run, forceStart, stopTour, handleJoyrideCallback, tourKey, currentTourId } = useTourStore();
    const [steps, setSteps] = useState([]);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        if (!user || !user.role) return;
        const role = user.role.toLowerCase();

        let roleSteps = [];
        if (role === 'owner') {
            if (currentTourId && tourSteps.owner[currentTourId]) {
                roleSteps = tourSteps.owner[currentTourId];
            }
        }
        else if (role === 'operador') roleSteps = tourSteps.operador;
        else if (role === 'operario') roleSteps = tourSteps.operario;

        setSteps(roleSteps);
    }, [user, currentTourId]);

    useEffect(() => {
        if (!user || !isClient) return;
        if (user.role.toLowerCase() === 'owner') return; // Owner auto-start is handled in OwnerDashboard

        // Auto-start logic for legacy roles
        const tourKey = `hasSeenTour_${user.id}`;
        const hasSeen = localStorage.getItem(tourKey);

        if (!hasSeen && !forceStart && steps.length > 0) {
            const timer = setTimeout(() => {
                useTourStore.getState().startTour();
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [user, steps, forceStart, isClient]);

    const handleCallback = (data) => {
        // En roles antiguos (no modular), marcamos el tour global
        if (user && user.role.toLowerCase() !== 'owner') {
            const { status, action } = data;
            if (['finished', 'skipped'].includes(status) || action === 'close' || action === 'skip') {
                localStorage.setItem(`hasSeenTour_${user.id}`, 'true');
                stopTour();
            }
        }

        handleJoyrideCallback(data, user?.id);
    };

    if (!isClient || steps.length === 0) return null;

    return (
        <>
            {run && (
                <Joyride
                    key={tourKey}
                    onEvent={handleCallback}
                    continuous
                    run={run}
                    scrollToFirstStep
                    showProgress
                    showSkipButton={true}
                    steps={steps}
                    tooltipComponent={TourTooltip}
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
                            borderRadius: '6px',
                            color: '#ffffff',
                            padding: '8px 16px',
                            fontWeight: '600',
                            border: 'none',
                        },
                        buttonBack: {
                            color: theme === 'dark' ? '#94a3b8' : '#64748b',
                            marginRight: '12px',
                            fontWeight: '500',
                        },
                        buttonSkip: {
                            color: theme === 'dark' ? '#cbd5e1' : '#475569',
                            fontWeight: '600',
                        }
                    }}
                    locale={{
                        back: 'Atrás',
                        close: 'Cerrar',
                        last: 'Finalizar',
                        next: 'Siguiente',
                        open: 'Abrir diálogo',
                        skip: 'Desactivar tours'
                    }}
                />
            )}
        </>
    );
}
