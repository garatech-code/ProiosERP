import { create } from 'zustand';

export const useTourStore = create((set, get) => ({
    run: false,
    stepIndex: 0,
    forceStart: false,

    startTour: () => {
        set({ run: true, stepIndex: 0, forceStart: true });
    },
    
    stopTour: () => {
        set({ run: false, forceStart: false });
    },
    
    setStepIndex: (index) => {
        // Obsoleto, ya no se usa porque Joyride es no-controlado
        // set({ stepIndex: index });
    },

    handleJoyrideCallback: (data) => {
        const { action, index, status, type } = data;

        if (status === 'finished' || status === 'skipped') {
            get().stopTour();
        }
        // Ya no controlamos el stepIndex aquí, lo hace Joyride internamente
    }
}));
