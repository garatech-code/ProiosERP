export const tourSteps = {
    owner: [
        {
            target: 'body',
            placement: 'center',
            title: '¡Bienvenido a TECHSHIP!',
            content: 'Este es tu Panel de Control Principal (Owner). A continuación, te daremos un breve recorrido por las herramientas clave para gestionar toda la operativa.',
            disableBeacon: true,
        },
        {
            target: '.tour-owner-kpis',
            title: 'Panorama General',
            content: 'Aquí podrás visualizar en tiempo real el estado financiero, métricas clave y el volumen de operaciones de la empresa.',
            placement: 'right',
        },
        {
            target: '.tour-owner-agenda',
            title: 'Agenda y ETAs',
            content: 'Accede al calendario interactivo para ver los arribos de buques, eventos logísticos y coordinar con tu equipo.',
            placement: 'right',
        },
        {
            target: '.tour-owner-ops',
            title: 'Gestión Operativa',
            content: 'El corazón del sistema. Desde aquí puedes supervisar todas las operaciones, presupuestos y su estado de avance.',
            placement: 'right',
        },
        {
            target: '.tour-owner-inbox',
            title: 'Tráfico Marítimo',
            content: 'Una bandeja centralizada para procesar solicitudes por correo de los buques y convertirlas en operaciones con un par de clics.',
            placement: 'right',
        },
        {
            target: '.tour-owner-inventory',
            title: 'Inventario y Fórmulas',
            content: 'Control total sobre el stock, creación de recetas de fabricación (químicos/servicios) y alertas de bajo stock.',
            placement: 'right',
        },
        {
            target: '.tour-owner-staff',
            title: 'Gestión de Plantel',
            content: 'Administra los accesos de tu equipo (Operadores y Operarios), asigna roles y supervisa su rendimiento.',
            placement: 'right',
        },
        {
            target: '.tour-system-menu',
            title: 'Sistema y Configuración',
            content: 'Desde aquí puedes cambiar entre Modo Claro y Oscuro, reportar incidencias técnicas y cerrar tu sesión.',
            placement: 'right',
        }
    ],
    operador: [
        {
            target: 'body',
            placement: 'center',
            title: '¡Bienvenido a TECHSHIP!',
            content: 'Este es tu panel logístico y de oficina. Te mostraremos cómo utilizar tus herramientas de trabajo diarias.',
            disableBeacon: true,
        },
        {
            target: '.tour-operador-ops',
            title: 'Mis Operaciones',
            content: 'Aquí verás las operaciones asignadas a tu cargo. Podrás gestionar presupuestos, listas de empaque y seguimiento.',
            placement: 'right',
        },
        {
            target: '.tour-operador-agenda',
            title: 'Agenda',
            content: 'Tu planificador personal. Carga vencimientos, reuniones o revisa los ETA de los buques a tu cargo.',
            placement: 'right',
        },
        {
            target: '.tour-operador-inbox',
            title: 'Bandeja de Entrada',
            content: 'Revisa los correos entrantes y crea cotizaciones rápidas basadas en el texto de las solicitudes.',
            placement: 'right',
        },
        {
            target: '.tour-operador-inventory',
            title: 'Consultas de Inventario',
            content: 'Verifica la disponibilidad de stock, precios y recetas para presupuestar con precisión.',
            placement: 'right',
        },
        {
            target: '.tour-navbar-add',
            title: 'Acción Rápida',
            content: 'Usa este botón en cualquier momento para registrar una nueva operación manualmente sin salir de la vista actual.',
            placement: 'left',
        }
    ],
    operario: [
        {
            target: 'body',
            placement: 'center',
            title: '¡Bienvenido a TECHSHIP!',
            content: 'Este es tu panel de planta y depósito. Aquí encontrarás todo lo necesario para cumplir con las preparaciones.',
            disableBeacon: true,
        },
        {
            target: '.tour-operario-ops',
            title: 'Mis Tareas Asignadas',
            content: 'Aquí encontrarás la lista de empaque o las órdenes de fabricación (recetas) que debes preparar para despachar.',
            placement: 'right',
        },
        {
            target: '.tour-system-menu',
            title: 'Configuración',
            content: 'Cambia el aspecto visual al Modo Oscuro para cuidar tu vista o cierra tu sesión al finalizar el turno.',
            placement: 'top',
        }
    ]
};
