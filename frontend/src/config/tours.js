export const tourSteps = {
    owner: {
        welcome: [
            {
                target: 'body',
                placement: 'center',
                title: '¡Bienvenido a TECHSHIP!',
                content: 'Este es tu Panel de Control. A medida que explores las pestañas, te iremos mostrando pequeños recorridos para cada sección. Si ya conoces el sistema, presiona "Desactivar tours" ahora para silenciar todos los recorridos.',
                skipBeacon: true,
                showSkipButton: true,
            },
            {
                target: '.tour-owner-kpis',
                placement: 'right',
                title: 'Navegación Inteligente',
                content: '¡Perfecto! A partir de ahora, cada vez que visites una pestaña nueva por primera vez, te explicaremos brevemente sus herramientas. Haz clic en "Finalizar" para continuar a tu panel.',
                skipBeacon: true,
                showSkipButton: true,
            }
        ],
        overview: [
            {
                target: '.tour-kpi-ops',
                title: 'Estado Operativo',
                content: 'Este panel te muestra en tiempo real cuántas operaciones están en proceso, finalizadas o canceladas.',
                placement: 'bottom',
                skipBeacon: true,
                showSkipButton: true,
            },
            {
                target: '.tour-kpi-types',
                title: 'Distribución por Tipo',
                content: 'Aquí puedes ver un desglose de las operaciones según si son entregas de Productos, Químicos o Servicios.',
                placement: 'bottom',
                skipBeacon: true,
                showSkipButton: true,
            },
            {
                target: '.tour-kpi-inventory',
                title: 'Alertas de Inventario',
                content: 'Un resumen rápido de tu stock. Te alertaremos en rojo si algún artículo está por debajo del mínimo.',
                placement: 'left',
                skipBeacon: true,
                showSkipButton: true,
            }
        ],
        calendar: [
            {
                target: '.tour-cal-filter',
                title: 'Filtro por Operador',
                content: 'Puedes ver la agenda global o filtrar para ver los eventos asignados a un operador específico.',
                placement: 'bottom',
                skipBeacon: true,
                showSkipButton: true,
            },
            {
                target: '.tour-cal-new',
                title: 'Crear Evento Manual',
                content: 'Si necesitas agendar una reunión o un evento logístico que no está vinculado a una operación, hazlo desde aquí.',
                placement: 'bottom',
                skipBeacon: true,
                showSkipButton: true,
            },
            {
                target: '.tour-cal-view',
                title: 'Calendario Interactivo',
                content: 'Haz clic en cualquier evento para ver sus detalles. Los ETAs de los buques aparecerán automáticamente aquí.',
                placement: 'top',
                skipBeacon: true,
                showSkipButton: true,
            }
        ],
        operations: [
            {
                target: '.tour-new-op-btn',
                title: 'Crear Operación',
                content: 'Haz clic aquí para iniciar el registro de un nuevo requerimiento, cotización o servicio para un buque.',
                placement: 'bottom',
                skipBeacon: true,
                showSkipButton: true,
            },
            {
                target: '.tour-ops-search',
                title: 'Búsqueda Rápida',
                content: 'Usa este buscador para encontrar rápidamente operaciones por cliente, buque o número de operación.',
                placement: 'bottom',
                skipBeacon: true,
                showSkipButton: true,
            },
            {
                target: '.tour-ops-filters',
                title: 'Filtros Dinámicos',
                content: 'Filtra las operaciones según su tipo (productos, servicios) o su estado actual (presupuestada, en producción).',
                placement: 'bottom',
                skipBeacon: true,
                showSkipButton: true,
            },
            {
                target: '.tour-ops-list',
                title: 'Tarjetas de Operación',
                content: 'Haz clic en cualquier tarjeta para ver y editar los detalles completos de la operación.',
                placement: 'top',
                skipBeacon: true,
                showSkipButton: true,
            }
        ],
        inbox: [
            {
                target: '.tour-inbox-filters',
                title: 'Bandeja y Plantillas',
                content: 'Filtra correos recibidos/enviados o gestiona tus Plantillas predefinidas para responder más rápido.',
                placement: 'bottom',
                skipBeacon: true,
                showSkipButton: true,
            },
            {
                target: '.tour-inbox-compose',
                title: 'Redactar Nuevo',
                content: 'Inicia un nuevo correo desde cero si necesitas comunicarte proactivamente con un buque o cliente.',
                placement: 'bottom',
                skipBeacon: true,
                showSkipButton: true,
            },
            {
                target: '.tour-inbox-search',
                title: 'Buscador de Correos',
                content: 'Encuentra al instante cualquier comunicación pasada buscando por asunto o contenido.',
                placement: 'bottom',
                skipBeacon: true,
                showSkipButton: true,
            }
        ],
        approvals: [
            {
                target: '.tour-ops-list',
                title: 'Notificaciones y Aprobaciones',
                content: 'Aquí verás las operaciones que requieren tu revisión. Estas son generadas por los Operadores y esperan tu aprobación.',
                placement: 'top',
                skipBeacon: true,
                showSkipButton: true,
            }
        ],
        inventory: [
            {
                target: '.tour-inv-tabs',
                title: 'Navegación de Inventario',
                content: 'Alterna fácilmente entre tus insumos, recetas químicas (BOM), proveedores y alertas de abastecimiento crítico.',
                placement: 'bottom',
                skipBeacon: true,
                showSkipButton: true,
            },
            {
                target: '.tour-inv-actions',
                title: 'Herramientas y Acciones',
                content: 'Agrega nuevos productos, importa inventarios masivos desde Excel o descarga reportes desde aquí.',
                placement: 'bottom',
                skipBeacon: true,
                showSkipButton: true,
            }
        ],
        staff: [
            {
                target: '.tour-staff-actions',
                title: 'Gestión de Personal',
                content: 'Agrega nuevos empleados a tu equipo, realiza cargas masivas mediante Excel o exporta tu lista de personal.',
                placement: 'bottom',
                skipBeacon: true,
                showSkipButton: true,
            },
            {
                target: '.tour-staff-filters',
                title: 'Búsqueda Inteligente',
                content: 'Encuentra operarios en segundos filtrando por nombre, DNI o su estado de actividad.',
                placement: 'bottom',
                skipBeacon: true,
                showSkipButton: true,
            },
            {
                target: '.tour-staff-table',
                title: 'Listado de Operarios',
                content: 'Administra los roles, revisa el estado de acceso de cada miembro y utiliza los botones laterales para editar o eliminar.',
                placement: 'top',
                skipBeacon: true,
                showSkipButton: true,
            }
        ],
        movements: [
            {
                target: '.tour-movements-filters',
                title: 'Filtros de Movimientos',
                content: 'Busca un producto específico o filtra por tipo de movimiento (Ingreso, Salida, Ajuste) y fecha.',
                placement: 'bottom',
                skipBeacon: true,
                showSkipButton: true,
            },
            {
                target: '.tour-movements-actions',
                title: 'Exportar Reportes',
                content: 'Descarga un archivo Excel o CSV con el historial completo de los movimientos de inventario.',
                placement: 'left',
                skipBeacon: true,
                showSkipButton: true,
            },
            {
                target: '.tour-movements-table',
                title: 'Historial de Transacciones',
                content: 'Visualiza la fecha, quién hizo el movimiento, el stock resultante y la razón u operación asociada.',
                placement: 'top',
                skipBeacon: true,
                showSkipButton: true,
            }
        ],
        users: [
            {
                target: '.tour-users-header',
                title: 'Gestión de Accesos',
                content: 'Crea nuevos usuarios desde aquí para que tus empleados puedan ingresar al sistema con el rol adecuado.',
                placement: 'bottom',
                skipBeacon: true,
                showSkipButton: true,
            },
            {
                target: '.tour-users-table',
                title: 'Usuarios Activos',
                content: 'Revisa qué rol tiene asignado cada usuario, si ya cambiaron su contraseña por defecto, o elimina accesos.',
                placement: 'top',
                skipBeacon: true,
                showSkipButton: true,
            }
        ],
        tracking: [
            {
                target: '.tour-tracking-header',
                title: 'Seguimiento Comercial',
                content: 'Aquí puedes exportar a Excel todos los KPIs y evaluar el rendimiento global y de cada operador.',
                placement: 'bottom',
                skipBeacon: true,
                showSkipButton: true,
            },
            {
                target: '.tour-tracking-kpis',
                title: 'Métricas Globales',
                content: 'Analiza la facturación proyectada, la tasa de conversión y el crecimiento intermensual de tu empresa.',
                placement: 'bottom',
                skipBeacon: true,
                showSkipButton: true,
            },
            {
                target: '.tour-tracking-operators',
                title: 'Rendimiento por Operador',
                content: 'Mide la eficiencia de cada operador evaluando sus tasas de conversión, aportes proyectados y tiempos de respuesta.',
                placement: 'top',
                skipBeacon: true,
                showSkipButton: true,
            }
        ],
        operation_selector: [
            {
                target: '.tour-selector-productos',
                title: 'Insumos y Repuestos',
                content: 'Selecciona esta opción si necesitas cotizar repuestos generales, herramientas o provisiones de pañol para el buque.',
                placement: 'bottom',
                skipBeacon: true,
                showSkipButton: true,
            },
            {
                target: '.tour-selector-quimicos',
                title: 'Fórmulas Químicas',
                content: 'Utiliza esta opción para despachos de especialidades químicas producidas por tu laboratorio.',
                placement: 'bottom',
                skipBeacon: true,
                showSkipButton: true,
            },
            {
                target: '.tour-selector-servicios',
                title: 'Servicios Técnicos',
                content: 'Para reparaciones a bordo o trabajos técnicos. Podrás cargar horas de técnicos y costos adicionales.',
                placement: 'bottom',
                skipBeacon: true,
                showSkipButton: true,
            }
        ]
    },
    operador: {
        welcome: [
            {
                target: 'body',
                placement: 'center',
                title: '¡Bienvenido a TECHSHIP!',
                content: 'Este es tu panel logístico y de oficina. A medida que explores las pestañas, te iremos mostrando pequeños recorridos para cada sección. Si ya conoces el sistema, presiona "Desactivar tours" ahora para silenciar todos los recorridos.',
                skipBeacon: true,
                showSkipButton: true,
            },
            {
                target: '.tour-operador-ops',
                placement: 'right',
                title: 'Navegación Inteligente',
                content: '¡Perfecto! A partir de ahora, cada vez que visites una pestaña nueva por primera vez, te explicaremos brevemente sus herramientas. Haz clic en "Finalizar" para continuar a tu panel.',
                skipBeacon: true,
                showSkipButton: true,
            }
        ],
        operations: [
            {
                target: '.tour-new-op-btn',
                title: 'Crear Operación',
                content: 'Haz clic aquí para iniciar el registro de un nuevo requerimiento, cotización o servicio para un buque.',
                placement: 'bottom',
                skipBeacon: true,
                showSkipButton: true,
            },
            {
                target: '.tour-ops-search',
                title: 'Búsqueda Rápida',
                content: 'Usa este buscador para encontrar rápidamente operaciones por cliente, buque o número de operación.',
                placement: 'bottom',
                skipBeacon: true,
                showSkipButton: true,
            },
            {
                target: '.tour-ops-filters',
                title: 'Filtrar Operaciones',
                content: 'Filtra por tipo de operación o por el estado actual del trámite.',
                placement: 'bottom',
                skipBeacon: true,
                showSkipButton: true,
            },
            {
                target: '.tour-ops-list',
                title: 'Lista de Operaciones',
                content: 'Aquí verás las operaciones asignadas a ti. Haz clic en cualquiera para ver los detalles.',
                placement: 'top',
                skipBeacon: true,
                showSkipButton: true,
            }
        ],
        calendar: [
            {
                target: '.tour-cal-new',
                title: 'Crear Evento',
                content: 'Añade eventos manuales a tu agenda como reuniones, recordatorios o tareas pendientes.',
                placement: 'left',
                skipBeacon: true,
                showSkipButton: true,
            },
            {
                target: '.tour-cal-view',
                title: 'Vista de Agenda',
                content: 'Aquí verás tus eventos manuales y las llegadas estimadas (ETA) de los buques. Puedes cambiar la vista a mes, semana o día.',
                placement: 'top',
                skipBeacon: true,
                showSkipButton: true,
            }
        ],
        inbox: [
            {
                target: '.tour-inbox-filters',
                title: 'Bandejas y Filtros',
                content: 'Filtra correos recibidos o enviados para organizar tu tráfico marítimo.',
                placement: 'bottom',
                skipBeacon: true,
                showSkipButton: true,
            },
            {
                target: '.tour-inbox-compose',
                title: 'Redactar Nuevo',
                content: 'Inicia un nuevo correo desde cero si necesitas comunicarte proactivamente con un buque o cliente.',
                placement: 'bottom',
                skipBeacon: true,
                showSkipButton: true,
            },
            {
                target: '.tour-inbox-search',
                title: 'Buscador de Correos',
                content: 'Encuentra rápidamente cualquier correo buscando por asunto o contenido.',
                placement: 'bottom',
                skipBeacon: true,
                showSkipButton: true,
            }
        ],
        inventory: [
            {
                target: '.tour-inv-tabs',
                title: 'Navegación de Inventario',
                content: 'Cambia entre la vista de Insumos (pañol), Químicos, y Recetas de producción.',
                placement: 'bottom',
                skipBeacon: true,
                showSkipButton: true,
            },
            {
                target: '.tour-inv-actions',
                title: 'Gestión Rápida',
                content: 'Utiliza estos botones para añadir nuevos artículos, modificar stock manualmente o exportar el inventario actual.',
                placement: 'left',
                skipBeacon: true,
                showSkipButton: true,
            }
        ],
        operation_selector: [
            {
                target: '.tour-selector-productos',
                title: 'Insumos y Repuestos',
                content: 'Selecciona esta opción si necesitas cotizar repuestos generales, herramientas o provisiones de pañol para el buque.',
                placement: 'bottom',
                skipBeacon: true,
                showSkipButton: true,
            },
            {
                target: '.tour-selector-quimicos',
                title: 'Fórmulas Químicas',
                content: 'Utiliza esta opción para despachos de especialidades químicas producidas por tu laboratorio.',
                placement: 'bottom',
                skipBeacon: true,
                showSkipButton: true,
            },
            {
                target: '.tour-selector-servicios',
                title: 'Servicios Técnicos',
                content: 'Para reparaciones a bordo o trabajos técnicos. Podrás cargar horas de técnicos y costos adicionales.',
                placement: 'bottom',
                skipBeacon: true,
                showSkipButton: true,
            }
        ]
    },
    operario: [
        {
            target: 'body',
            placement: 'center',
            title: '¡Bienvenido a TECHSHIP!',
            content: 'Este es tu panel de planta y depósito. Aquí encontrarás todo lo necesario para cumplir con las preparaciones.',
            disableBeacon: true,
            showSkipButton: true,
        },
        {
            target: '.tour-operario-ops',
            title: 'Mis Tareas Asignadas',
            content: 'Aquí encontrarás la lista de empaque o las órdenes de fabricación (recetas) que debes preparar para despachar.',
            placement: 'right',
            disableBeacon: true,
            showSkipButton: true,
        },
        {
            target: '.tour-system-menu',
            title: 'Configuración',
            content: 'Cambia el aspecto visual al Modo Oscuro para cuidar tu vista o cierra tu sesión al finalizar el turno.',
            placement: 'top',
            disableBeacon: true,
            showSkipButton: true,
        }
    ]
};
