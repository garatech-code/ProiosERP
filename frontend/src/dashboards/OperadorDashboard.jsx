import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { formatUserName, getUserInitials } from '../utils/formatters';
import InboxView from '../components/InboxView';
import InventoryManagement from '../components/InventoryManagement';
import OperationTypeSelector from '../components/OperationTypeSelector';
import OperationFormProductos from '../components/OperationFormProductos';
import OperationFormQuimicos from '../components/OperationFormQuimicos';
import OperationFormServicios from '../components/OperationFormServicios';
import OperationFormOtros from '../components/OperationFormOtros';
import DebugFeedback from '../components/DebugFeedback';
import AgendaEventModal from '../components/AgendaEventModal';
import NotificationMenu from '../components/NotificationMenu';
import { useTheme } from '../context/ThemeContext';
import LogoSpinner from '../components/LogoSpinner';

// Calendar
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import es from 'date-fns/locale/es';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const locales = {
    'es': es,
}
const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
    getDay,
    locales,
});

export default function OperadorDashboard() {
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const location = useLocation();

    // El Operador no tiene pestaña overview, así que el inicio es operations
    const [activeTab, setActiveTab] = useState(() => localStorage.getItem('operadorDashboard_activeTab') || 'operations'); // operations, calendar, inbox, inventory
    const [operations, setOperations] = useState([]);
    const [filteredOps, setFilteredOps] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [statusFilter, setStatusFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [holidays, setHolidays] = useState([]);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const [calView, setCalView] = useState('week');
    const [calDate, setCalDate] = useState(new Date());

    const [operationModalState, setOperationModalState] = useState(() => {
        const saved = localStorage.getItem('operadorDashboard_operationModalState');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { }
        }
        return { isOpen: false, type: null, id: null };
    });
    const [emailSource, setEmailSource] = useState(null);

    const handleCreateFromEmail = (email) => {
        setEmailSource(email);
        setOperationModalState({ isOpen: true, type: 'selector', id: null });
    };

    const [showDebugForm, setShowDebugForm] = useState(false);

    // Eventos de Agenda
    const [agendaEvents, setAgendaEvents] = useState([]);
    const [agendaEventModalState, setAgendaEventModalState] = useState(() => {
        const saved = localStorage.getItem('operadorDashboard_agendaEventModalState');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { }
        }
        return { isOpen: false, eventToEdit: null };
    });
    const [hasNewAgendaEvent, setHasNewAgendaEvent] = useState(false);

    useEffect(() => {
        fetchData();
        fetchAgendaEvents();
    }, []);

    useEffect(() => {
        localStorage.setItem('operadorDashboard_activeTab', activeTab);
        if (activeTab === 'calendar') {
            setHasNewAgendaEvent(false);
            localStorage.setItem('last_seen_agenda', new Date().toISOString());
        }
    }, [activeTab]);

    useEffect(() => {
        localStorage.setItem('operadorDashboard_agendaEventModalState', JSON.stringify(agendaEventModalState));
    }, [agendaEventModalState]);

    useEffect(() => {
        localStorage.setItem('operadorDashboard_operationModalState', JSON.stringify(operationModalState));
    }, [operationModalState]);

    const fetchAgendaEvents = async () => {
        try {
            const res = await axios.get('/operaciones/events/');
            setAgendaEvents(res.data);

            const lastSeen = localStorage.getItem('last_seen_agenda');
            if (res.data.length > 0) {
                const latestEvent = new Date(Math.max(...res.data.map(e => new Date(e.created_at))));
                if (!lastSeen || latestEvent > new Date(lastSeen)) {
                    if (activeTab !== 'calendar') {
                        setHasNewAgendaEvent(true);
                    }
                }
            }
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        let filtered = operations;
        if (statusFilter) {
            filtered = filtered.filter(op => op.status === statusFilter || op.estado === statusFilter);
        }
        if (typeFilter) {
            filtered = filtered.filter(op => op.tipo_operacion === typeFilter);
        }
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(op =>
                op.client_name?.toLowerCase().includes(term) ||
                op.ship_name?.toLowerCase().includes(term)
            );
        }
        setFilteredOps(filtered);
    }, [operations, statusFilter, typeFilter, searchTerm]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [opsRes, holRes] = await Promise.all([
                axios.get('/operaciones/operations/'),
                axios.get('/operaciones/operations/holidays_ar/').catch(() => ({ data: [] }))
            ]);
            let dataOps = opsRes.data?.results || opsRes.data;
            setOperations(Array.isArray(dataOps) ? dataOps : []);
            if (Array.isArray(holRes.data)) {
                setHolidays(holRes.data);
            }
            setError(null);
        } catch (err) {
            console.error(err);
            setError('Error al cargar datos del dashboard.');
        } finally {
            setLoading(false);
        }
    };

    const calculateTotal = (products) => {
        if (!products) return 0;
        return products.reduce((sum, p) => sum + (p.quantity * p.unit_price), 0);
    };

    const getStatusBadge = (status) => {
        const maps = {
            pending: { color: 'bg-yellow-100 text-yellow-800', label: 'Solicitada' },
            solicitada: { color: 'bg-yellow-100 text-yellow-800', label: 'Solicitada' },
            draft: { color: 'bg-orange-100 text-orange-800', label: 'Borrador' },
            price_checked: { color: 'bg-blue-100 text-blue-800', label: 'Presupuestada' },
            presupuestada: { color: 'bg-blue-100 text-blue-800', label: 'Presupuestada' },
            confirmed: { color: 'bg-green-100 text-green-800', label: 'Lista para envío' },
            lista_para_envio: { color: 'bg-green-100 text-green-800', label: 'Lista para envío' },
            in_coordination: { color: 'bg-purple-100 text-purple-800', label: 'En producción' },
            en_produccion: { color: 'bg-purple-100 text-purple-800', label: 'En producción' },
            delivered: { color: 'bg-indigo-100 text-indigo-800', label: 'Remitada' },
            remitada: { color: 'bg-indigo-100 text-indigo-800', label: 'Remitada' },
            closed: { color: 'bg-gray-100 text-gray-800', label: 'Entregada' },
            entregada: { color: 'bg-gray-100 text-gray-800', label: 'Entregada' },
            cancelled: { color: 'bg-red-100 text-red-800', label: 'Cancelada' },
            cancelada: { color: 'bg-red-100 text-red-800', label: 'Cancelada' },
        };
        const mapped = maps[status] || { color: 'bg-gray-100 text-gray-800', label: status };
        return (
            <span className={`px-2 py-1 inline-flex text-[10px] sm:text-xs leading-4 font-semibold rounded-full ${mapped.color}`}>
                {mapped.label}
            </span>
        );
    };

    const getTypeIcon = (type) => {
        if (type === 'quimicos') return <i title="Químicos" className="bi bi-flask-fill text-emerald-500 text-sm"></i>;
        if (type === 'servicios') return <i title="Servicios" className="bi bi-tools text-amber-500 text-sm"></i>;
        return <i title="Productos" className="bi bi-box-seam text-indigo-500 text-sm"></i>;
    };

    const getTypePrefix = (type) => {
        if (type === 'quimicos') return '[QMC]';
        if (type === 'servicios') return '[SRV]';
        return '[PRD]';
    };

    const renderDocSemaphore = (label, fileUrl, opStatus) => {
        let statusConfig = {};
        if (fileUrl) {
            statusConfig = { dot: 'bg-emerald-500', box: 'bg-emerald-50 border-emerald-200 text-emerald-700', title: 'Completado' };
        } else {
            const inProgressStates = ['in_coordination', 'en_produccion', 'confirmed', 'lista_para_envio', 'delivered', 'remitada'];
            if (inProgressStates.includes(opStatus)) {
                statusConfig = { dot: 'bg-amber-400 animate-pulse', box: 'bg-amber-50 border-amber-200 text-amber-700', title: 'En Proceso' };
            } else {
                statusConfig = { dot: 'bg-red-500', box: 'bg-red-50 border-red-200 text-red-700', title: 'Faltante' };
            }
        }
        return (
            <div title={`${label}: ${statusConfig.title}`} className={`flex items-center gap-1.5 px-2 py-1 rounded border ${statusConfig.box} text-[10px] font-bold uppercase tracking-wider`}>
                <div className={`w-2 h-2 rounded-full ${statusConfig.dot}`}></div>
                {label}
            </div>
        );
    };

    const calendarEvents = useMemo(() => {
        const evts = operations.filter(op => op.eta).map(op => ({
            id: op.id,
            title: `${getTypePrefix(op.tipo_operacion)} OP-${op.id} ${op.nombre || op.ship_name || 'Sin nombre'}`,
            start: new Date(op.eta),
            end: new Date(op.eta),
            resource: op,
            type: 'eta'
        }));

        const holEvts = holidays.map((h, i) => ({
            id: `hol-${i}`,
            title: `[FERIADO] ${h.name}`,
            start: new Date(`${h.date}T00:00:00`),
            end: new Date(`${h.date}T23:59:59`),
            allDay: true,
            type: 'holiday'
        }));

        const agendaEvts = agendaEvents.map(e => ({
            id: `agenda-${e.id}`,
            original_id: e.id,
            title: `[AGENDA] ${e.title}`,
            start: new Date(e.start_date),
            end: e.end_date ? new Date(e.end_date) : new Date(e.start_date),
            resource: e,
            type: 'agenda'
        }));

        return [...evts, ...holEvts, ...agendaEvts];
    }, [operations, holidays, agendaEvents]);

    const handleFormSuccess = () => {
        setOperationModalState({ isOpen: false, type: null, id: null });
        fetchData();
    };

    const eventStyleGetter = (event) => {
        if (event.type === 'holiday') {
            return { style: { backgroundColor: '#fecdd3', color: '#881337', fontWeight: 'bold', border: 'none', padding: '2px' } };
        }
        if (event.type === 'agenda') {
            return { style: { backgroundColor: '#10b981', color: 'white', borderRadius: '4px', border: 'none' } };
        }
        return { style: { backgroundColor: '#4f46e5', color: 'white', borderRadius: '4px', border: 'none' } };
    };

    const renderCalendar = () => (
        <div className="animate-fadeIn bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 h-[700px] flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Agenda y Arribos Estimados (ETA)</h2>
                <button
                    onClick={() => setAgendaEventModalState({ isOpen: true, eventToEdit: null })}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl text-sm font-bold shadow-sm flex items-center gap-1"
                >
                    <i className="bi bi-plus-lg"></i> Nuevo Evento
                </button>
            </div>
            <div className="flex-1 min-h-0">
                <Calendar
                    localizer={localizer}
                    events={calendarEvents}
                    startAccessor="start"
                    endAccessor="end"
                    culture="es"
                    views={['month', 'week', 'day', 'agenda']}
                    view={calView}
                    onView={setCalView}
                    date={calDate}
                    onNavigate={setCalDate}
                    eventPropGetter={eventStyleGetter}
                    onSelectEvent={(e) => {
                        if (e.type === 'eta') navigate(`/operations/${e.id}`);
                        if (e.type === 'agenda') setAgendaEventModalState({ isOpen: true, eventToEdit: e.resource });
                    }}
                    messages={{
                        next: "Sig",
                        previous: "Ant",
                        today: "Hoy",
                        month: "Mes",
                        week: "Semana",
                        day: "Día",
                        agenda: "Agenda",
                    }}
                />
            </div>
        </div>
    );

    const renderOperationsList = () => (
        <div className="animate-fadeIn">
            <div className="flex flex-col sm:flex-row gap-3 mb-6 items-end justify-between">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 hidden sm:block">Mis Operaciones (Asignadas)</h2>

                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-64">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <i className="bi bi-search text-gray-400"></i>
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar cliente, buque..."
                            className="pl-9 block w-full py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400 rounded-xl leading-5 bg-white placeholder-gray-500 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <select
                        className="py-2 pl-3 pr-8 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white bg-white rounded-xl text-gray-700 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                    >
                        <option value="">Todos los Tipos</option>
                        <option value="productos">■ Productos</option>
                        <option value="quimicos">■ Químicos</option>
                        <option value="servicios">■ Servicios</option>
                    </select>

                    <select
                        className="py-2 pl-3 pr-8 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white bg-white rounded-xl text-gray-700 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="">Todos los Estados</option>
                        <option value="solicitada">Solicitadas</option>
                        <option value="presupuestada">Presupuestadas</option>
                        <option value="en_produccion">En Producción</option>
                        <option value="lista_para_envio">Listas Envío</option>
                        <option value="remitada">Remitadas</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
                {filteredOps?.length === 0 ? (
                    <div className="col-span-full py-16 text-center bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-gray-300 dark:border-slate-600">
                        <p className="text-gray-500 dark:text-slate-400">No hay operaciones que coincidan con los filtros.</p>
                    </div>
                ) : (
                    filteredOps?.map((op) => (
                        <div
                            key={op.id}
                            onClick={() => navigate(`/operations/${op.id}`)}
                            className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden hover:shadow-md transition-all flex flex-col group relative cursor-pointer"
                        >
                            <div className={`absolute top-0 left-0 w-1.5 h-full ${op.tipo_operacion === 'quimicos' ? 'bg-emerald-500' : op.tipo_operacion === 'servicios' ? 'bg-amber-500' : 'bg-indigo-500'}`}></div>
                            <div className="p-4 sm:p-5 pl-5 sm:pl-6 flex-1 flex flex-col">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <div className="flex items-center gap-1.5 mb-1">
                                            {getTypeIcon(op.tipo_operacion)}
                                            <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500">#OP-{String(op.id).padStart(4, '0')}</span>
                                            {getStatusBadge(op.status || op.estado)}
                                            {op.estado_revision === 'pending' && (
                                                <span className="ml-1 bg-amber-100 text-amber-700 text-[10px] font-black px-1.5 py-0.5 rounded animate-pulse"><i className="bi bi-clock-history mr-1"></i>EN REVISIÓN</span>
                                            )}
                                        </div>
                                        <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white leading-tight group-hover:text-indigo-600 truncate" title={op.nombre || op.ship_name || 'Operación sin nombre'}>
                                            {op.nombre || op.ship_name || 'Operación sin nombre'}
                                        </h3>
                                    </div>
                                </div>

                                <div className="text-xs sm:text-sm text-gray-600 dark:text-slate-300 mb-3 bg-slate-50 dark:bg-slate-700/50 p-2 sm:p-3 rounded-lg border border-slate-100 dark:border-slate-700 flex-1">
                                    <p className="truncate flex items-center gap-1">
                                        <span className="font-semibold text-slate-700 dark:text-slate-300">{op.ship_name || 'Buque N/D'}</span>
                                        <span className="text-slate-400">|</span>
                                        <span>{op.client_name || 'Cliente N/D'}</span>
                                    </p>
                                    <p className="truncate mt-1"><strong>Puerto:</strong> {op.port_name}</p>
                                    <p className="truncate text-indigo-600 dark:text-indigo-400 font-medium"><strong>ETA:</strong> {op.eta ? format(new Date(op.eta), 'dd/MM/yy HH:mm') : 'N/A'}</p>
                                </div>

                                <div className="flex flex-wrap gap-1.5 mb-3">
                                    {renderDocSemaphore('PKG', op.packing_list_file, op.status || op.estado)}
                                    {renderDocSemaphore('RMT', op.remito_file, op.status || op.estado)}
                                    {renderDocSemaphore('RCH', op.rancho_file, op.status || op.estado)}
                                </div>

                                <div className="mt-auto pt-3 flex justify-between items-center border-t border-gray-100 dark:border-slate-700">
                                    <div className="font-black text-slate-800 dark:text-white text-sm truncate max-w-[50%]">
                                        $<span className="text-lg">{calculateTotal(op.products).toLocaleString()}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">Ver Detalles <i className="bi bi-chevron-right"></i></span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );

    const renderInbox = () => (
        <InboxView />
    );

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col md:flex-row font-sans overflow-hidden transition-colors duration-200">
            {/* Sidebar Desktop */}
            <aside className={`relative bg-slate-900 text-white flex-col hidden md:flex h-screen sticky top-0 shadow-xl z-20 transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20 items-center'}`}>
                {/* Toggle Button */}
                <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="absolute -right-3 top-8 bg-indigo-600 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-md hover:bg-indigo-500 transition-colors z-30"
                    title={isSidebarOpen ? 'Colapsar menú' : 'Expandir menú'}
                >
                    <i className={`bi ${isSidebarOpen ? 'bi-chevron-left' : 'bi-chevron-right'} text-[10px]`}></i>
                </button>

                <div className={`p-6 flex items-center border-b border-slate-800 ${isSidebarOpen ? 'gap-3' : 'justify-center'}`}>
                    <div className="w-10 h-10 bg-indigo-500 rounded-xl flex shrink-0 items-center justify-center font-black text-xl shadow-lg">P</div>
                    {isSidebarOpen && (
                        <div className="animate-fadeIn">
                            <h1 className="font-black text-xl tracking-tight leading-none text-white whitespace-nowrap">ProIOS</h1>
                            <span className="text-[10px] uppercase text-indigo-300 font-bold tracking-widest block">Operador</span>
                        </div>
                    )}
                </div>

                <div className={`py-6 flex-1 space-y-1 overflow-y-auto ${isSidebarOpen ? 'px-4' : 'px-2 flex flex-col items-center'}`}>
                    {isSidebarOpen && <p className="px-2 text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Oficina / Logística</p>}

                    <button title={!isSidebarOpen ? "Mis Operaciones" : ""} onClick={() => setActiveTab('operations')} className={`flex items-center rounded-xl font-medium text-sm transition-all ${isSidebarOpen ? 'w-full gap-3 px-3 py-2.5' : 'w-12 h-12 justify-center'} ${activeTab === 'operations' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
                        <i className="bi bi-list-check text-lg shrink-0"></i>
                        {isSidebarOpen && <span>Mis Operaciones</span>}
                    </button>
                    <button title={!isSidebarOpen ? "Agenda ETAs" : ""} onClick={() => setActiveTab('calendar')} className={`flex items-center rounded-xl font-medium text-sm transition-all ${isSidebarOpen ? 'w-full gap-3 px-3 py-2.5' : 'w-12 h-12 justify-center'} ${activeTab === 'calendar' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
                        <i className="bi relative bi-calendar-event text-lg shrink-0">
                            {hasNewAgendaEvent && activeTab !== 'calendar' && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 border-2 border-slate-900 rounded-full animate-pulse"></span>}
                        </i>
                        {isSidebarOpen && <span>Agenda ETAs</span>}
                    </button>
                    <button title={!isSidebarOpen ? "Tráfico Marítimo" : ""} onClick={() => setActiveTab('inbox')} className={`flex items-center rounded-xl font-medium text-sm transition-all ${isSidebarOpen ? 'w-full gap-3 px-3 py-2.5 justify-between' : 'w-12 h-12 justify-center relative'} ${activeTab === 'inbox' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
                        <div className="flex items-center gap-3">
                            <i className="bi bi-envelope-open text-lg shrink-0"></i>
                            {isSidebarOpen && <span>Bandejas Entrada</span>}
                        </div>
                    </button>

                    {isSidebarOpen ? (
                        <p className="px-2 text-xs font-black text-slate-500 uppercase tracking-wider mt-8 mb-2">Sistema</p>
                    ) : (
                        <div className="w-full border-t border-slate-800 my-4"></div>
                    )}

                    <button title={!isSidebarOpen ? "Inventario & Fórmulas" : ""} onClick={() => setActiveTab('inventory')} className={`flex items-center rounded-xl font-medium text-sm transition-all ${isSidebarOpen ? 'w-full gap-3 px-3 py-2.5' : 'w-12 h-12 justify-center'} ${activeTab === 'inventory' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
                        <i className="bi bi-box-seam text-lg shrink-0"></i>
                        {isSidebarOpen && <span>Inventario & Fórmulas</span>}
                    </button>
                </div>

                <div className={`border-t border-slate-800 bg-slate-900 flex ${isSidebarOpen ? 'p-4 flex-col' : 'p-2 py-4 flex-col items-center gap-4'}`}>
                    <button
                        title={!isSidebarOpen ? "Reportar Error" : ""}
                        onClick={() => setShowDebugForm(true)}
                        className={`mb-3 flex justify-center items-center gap-2 py-2 bg-indigo-900/50 text-indigo-300 hover:bg-indigo-600 hover:text-white border border-indigo-500/30 rounded-xl text-xs font-bold transition-colors ${isSidebarOpen ? 'w-full' : 'w-10 h-10'}`}
                    >
                        <i className="bi bi-bug-fill text-base"></i>
                        {isSidebarOpen && <span>Testing & Debug</span>}
                    </button>

                    <button
                        title={!isSidebarOpen ? "Cambiar Tema" : ""}
                        onClick={toggleTheme}
                        className={`mb-4 flex justify-center items-center gap-2 py-2 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700 rounded-xl text-xs font-bold transition-colors ${isSidebarOpen ? 'w-full' : 'w-10 h-10'}`}
                    >
                        <i className={`bi ${theme === 'dark' ? 'bi-sun-fill' : 'bi-moon-stars-fill'} text-base`}></i>
                        {isSidebarOpen && <span>{theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}</span>}
                    </button>

                    <div className={`flex items-center gap-3 ${isSidebarOpen ? 'mb-4 px-2' : ''}`}>
                        <div className="w-9 h-9 shrink-0 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-sm text-indigo-400">
                            {getUserInitials(user)}
                        </div>
                        {isSidebarOpen && (
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-white truncate">{formatUserName(user)}</p>
                                <p className="text-xs text-slate-400 capitalize truncate">{user?.role?.toLowerCase()}</p>
                            </div>
                        )}
                    </div>
                    <button title={!isSidebarOpen ? "Salir" : ""} onClick={logout} className={`flex justify-center items-center gap-2 py-2.5 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-xl text-sm font-semibold transition-colors ${isSidebarOpen ? 'w-full' : 'w-10 h-10'}`}>
                        <i className="bi bi-box-arrow-right text-lg"></i>
                        {isSidebarOpen && <span>Salir</span>}
                    </button>
                </div>
            </aside>

            {/* Navbar Mobile */}
            <div className="md:hidden bg-slate-900 text-white p-4 flex justify-between items-center sticky top-0 z-30 shadow-md">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center font-black">P</div>
                    <h1 className="font-black text-lg">ProIOS</h1>
                </div>
                <div className="flex items-center gap-3">
                    <NotificationMenu />
                    <button
                        onClick={() => setShowDebugForm(true)}
                        className="bg-indigo-900/80 text-indigo-300 hover:bg-indigo-600 hover:text-white p-2 rounded-lg font-bold text-sm transition-colors border border-indigo-500/50"
                        title="Reportar Error"
                    >
                        <i className="bi bi-bug-fill"></i>
                    </button>
                    <button onClick={() => setOperationModalState({ isOpen: true, type: 'selector', id: null })} className="bg-indigo-600 hover:bg-indigo-700 p-2 rounded-lg text-white shadow-sm font-bold text-sm flex items-center gap-1">
                        <i className="bi bi-plus-lg"></i>
                        Añadir
                    </button>
                </div>
            </div>

            {/* Mobile Bottom Tabs */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700 z-30 flex justify-around p-2 pb-safe">
                <button onClick={() => setActiveTab('operations')} className={`flex flex-col items-center p-2 ${activeTab === 'operations' ? 'text-indigo-600' : 'text-gray-400'}`}>
                    <i className="bi bi-list-check text-xl"></i>
                    <span className="text-[10px] mt-1 font-semibold">Operaciones</span>
                </button>
                <button onClick={() => setActiveTab('calendar')} className={`flex flex-col items-center p-2 ${activeTab === 'calendar' ? 'text-indigo-600' : 'text-gray-400'}`}>
                    <i className="bi relative bi-calendar-event text-xl">
                        {hasNewAgendaEvent && activeTab !== 'calendar' && <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 border-2 border-white rounded-full"></span>}
                    </i>
                    <span className="text-[10px] mt-1 font-semibold">Agenda</span>
                </button>
                <button onClick={() => setActiveTab('inbox')} className={`flex flex-col items-center p-2 ${activeTab === 'inbox' ? 'text-indigo-600' : 'text-gray-400'}`}>
                    <i className="bi relative bi-envelope-open text-xl"></i>
                    <span className="text-[10px] mt-1 font-semibold">Correo</span>
                </button>
            </div>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 relative pb-16 md:pb-0 transition-colors duration-200">
                {/* Header Solo Desktop */}
                <header className="hidden md:flex bg-white dark:bg-slate-800 px-8 py-4 items-center justify-between border-b border-gray-200 dark:border-slate-700 transition-colors duration-200">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 capitalize">
                            {activeTab === 'calendar' && 'Planificación & Agenda'}
                            {activeTab === 'operations' && 'Gestión Operativa'}
                            {activeTab === 'inbox' && 'Tráfico Marítimo'}
                            {activeTab === 'inventory' && 'Inventario y Fórmulas'}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-slate-400">
                            {activeTab === 'operations' ? 'Gestiona la logística y cumplimiento de las operaciones.' : 'Bandeja de gestión de oficina.'}
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <NotificationMenu />
                        {activeTab !== 'inventory' && (
                            <button onClick={() => setOperationModalState({ isOpen: true, type: 'selector', id: null })} className="bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 rounded-xl text-white shadow-sm shadow-indigo-200 font-bold text-sm transition-all flex items-center gap-2">
                                <i className="bi bi-plus-lg text-lg"></i>
                                Nueva Operación
                            </button>
                        )}
                    </div>
                </header>

                <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-8 custom-scrollbar">
                    {loading && (
                        <div className="flex-1 flex items-center justify-center py-20 h-full">
                            <LogoSpinner size="w-16 h-16" />
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg shadow-sm mb-6">
                            <p className="text-red-700 font-medium">{error}</p>
                        </div>
                    )}

                    {!loading && !error && (
                        <>
                            {activeTab === 'operations' && renderOperationsList()}
                            {activeTab === 'calendar' && renderCalendar()}
                            {activeTab === 'inbox' && <InboxView onCreateFromEmail={handleCreateFromEmail} />}
                            {activeTab === 'inventory' && <InventoryManagement />}
                        </>
                    )}
                </div>
            </main>

            {/* Modal de Creación / Selector */}
            {operationModalState.isOpen && operationModalState.type === 'selector' && (
                <OperationTypeSelector
                    onClose={() => setOperationModalState({ isOpen: false, type: null, id: null })}
                    onSelect={(type) => setOperationModalState({ isOpen: true, type, id: null })}
                />
            )}
            {operationModalState.isOpen && operationModalState.type === 'productos' && (
                <OperationFormProductos
                    id={operationModalState.id}
                    onClose={() => { setOperationModalState({ isOpen: false, type: null, id: null }); setEmailSource(null); }}
                    onSuccess={handleFormSuccess}
                    initialEmailData={emailSource}
                />
            )}
            {operationModalState.isOpen && operationModalState.type === 'quimicos' && (
                <OperationFormQuimicos
                    id={operationModalState.id}
                    onClose={() => { setOperationModalState({ isOpen: false, type: null, id: null }); setEmailSource(null); }}
                    onSuccess={handleFormSuccess}
                    initialEmailData={emailSource}
                />
            )}
            {operationModalState.isOpen && operationModalState.type === 'servicios' && (
                <OperationFormServicios
                    id={operationModalState.id}
                    onClose={() => { setOperationModalState({ isOpen: false, type: null, id: null }); setEmailSource(null); }}
                    onSuccess={handleFormSuccess}
                    initialEmailData={emailSource}
                />
            )}
            {operationModalState.isOpen && operationModalState.type === 'otros' && (
                <OperationFormOtros
                    id={operationModalState.id}
                    onClose={() => { setOperationModalState({ isOpen: false, type: null, id: null }); setEmailSource(null); }}
                    onSuccess={handleFormSuccess}
                    initialEmailData={emailSource}
                />
            )}

            {/* MODAL DE DEBUG & SUGERENCIAS */}
            {showDebugForm && (
                <DebugFeedback onClose={() => setShowDebugForm(false)} />
            )}

            <AgendaEventModal
                isOpen={agendaEventModalState.isOpen}
                onClose={() => setAgendaEventModalState({ isOpen: false, eventToEdit: null })}
                eventToEdit={agendaEventModalState.eventToEdit}
                onSave={fetchAgendaEvents}
            />

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fadeIn { animation: fadeIn 0.3s ease-out forwards; }
                .custom-scrollbar::-webkit-scrollbar { width: 8px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 20px; border: 2px solid #f8fafc; }
                .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
                /* Big Calendar Overrides - Light */
                .rbc-calendar { font-family: inherit; }
                .rbc-toolbar button { border-radius: 8px; font-weight: 600; color: #4b5563; }
                .rbc-toolbar button.rbc-active { background-color: #4f46e5; color: white; border-color: #4f46e5; }
                .rbc-event { opacity: 0.9 !important; border-radius: 6px !important; }
                .rbc-today { background-color: #f8fafc !important; }
                /* Big Calendar Overrides - Dark Mode */
                .dark .rbc-calendar { background: transparent; color: #e2e8f0; }
                .dark .rbc-toolbar button { color: #94a3b8; background: #334155; border-color: #475569; }
                .dark .rbc-toolbar button:hover { background: #475569; color: #f1f5f9; }
                .dark .rbc-toolbar button.rbc-active { background-color: #4f46e5; color: white; border-color: #4f46e5; }
                .dark .rbc-month-view, .dark .rbc-time-view, .dark .rbc-agenda-view { border-color: #334155; }
                .dark .rbc-header { background: #1e293b; color: #94a3b8; border-color: #334155; }
                .dark .rbc-day-bg { background: #1e293b; }
                .dark .rbc-off-range-bg { background: #0f172a; }
                .dark .rbc-today { background-color: #1e3a5f !important; }
                .dark .rbc-date-cell { color: #94a3b8; }
                .dark .rbc-date-cell.rbc-now { color: #818cf8; font-weight: bold; }
                .dark .rbc-month-row { border-color: #334155; }
                .dark .rbc-day-slot .rbc-time-slot { border-color: #334155; }
                .dark .rbc-time-header-content { border-color: #334155; }
                .dark .rbc-time-content { border-color: #334155; }
                .dark .rbc-agenda-table { color: #cbd5e1; }
                .dark .rbc-agenda-table thead { background: #1e293b; color: #64748b; }
                .dark .rbc-agenda-date-cell, .dark .rbc-agenda-time-cell { color: #94a3b8; }
                .dark .rbc-agenda-empty { color: #64748b; }
            `}} />
        </div>
    );
}