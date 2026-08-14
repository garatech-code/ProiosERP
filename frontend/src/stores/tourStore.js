import { create } from 'zustand';

export const useTourStore = create((set, get) => ({
    run: false,
    forceStart: false,
    tourKey: 0,
    currentTourId: null,

    startTour: (tourId = null) => {
        set((state) => ({ 
            run: true, 
            forceStart: true, 
            tourKey: state.tourKey + 1,
            currentTourId: tourId
        }));
    },
    
    stopTour: () => {
        set({ run: false, forceStart: false, currentTourId: null });
    },
    
    setStepIndex: (index) => {
        // Obsoleto, ya no se usa porque Joyride es no-controlado
        // set({ stepIndex: index });
    },

    disableAllTours: (userId) => {
        if (userId) {
            localStorage.setItem(`tours_disabled_${userId}`, 'true');
        }
        get().stopTour();
    },

    markTourAsSeen: (userId, tourId) => {
        if (userId && tourId) {
            localStorage.setItem(`hasSeenTour_${userId}_${tourId}`, 'true');
        }
    },

    handleJoyrideCallback: (data, userId) => {
        const { action, status, type } = data;
        const currentTourId = get().currentTourId;

        // Si se finalizó normalmente o si apretó "Saltar" en un mini-tour
        if (['finished', 'skipped'].includes(status) || ['close', 'skip'].includes(action)) {
            // Guardar que vio este mini-tour específico
            get().markTourAsSeen(userId, currentTourId);

            // Si es el tour de bienvenida y presionó SKIP, deshabilitamos TODOS los tours
            if (action === 'skip' && currentTourId === 'welcome') {
                get().disableAllTours(userId);
            }

            get().stopTour();
        }

        if (type === 'error:target_not_found' || type === 'error') {
            get().stopTour();
        }
    }
}));
