import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../api/axios';
import { useAuth } from '../context/AuthContext';
import OperationTypeSelector from '../components/OperationTypeSelector';
import OperationFormProductos from '../components/OperationFormProductos';
import OperationFormQuimicos from '../components/OperationFormQuimicos';
import OperationFormServicios from '../components/OperationFormServicios';
import InboxView from '../components/InboxView';
import InventoryManagement from '../components/InventoryManagement';
import DebugFeedback from '../components/DebugFeedback'; // <-- IMPORT DEL NUEVO COMPONENTE

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

export default function OwnerDashboard() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState('overview'); // overview, operations, calendar, inbox
    const [operations, setOperations] = useState([]);
    const [filteredOps, setFilteredOps] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [statusFilter, setStatusFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [metrics, setMetrics] = useState({ total: 0, en_proceso: 0, finalizadas: 0, usuarios_activos: 0 });
    const [holidays, setHolidays] = useState([]);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const [calView, setCalView] = useState('week');
    const [calDate, setCalDate] = useState(new Date());

    const [operationModalState, setOperationModalState] = useState({ isOpen: false, type: null, id: null });

    // NUEVO: Estado para controlar el modal de Debug/Sugerencias
    const [showDebugForm, setShowDebugForm] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

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
            const [opsRes, metricsRes, holRes] = await Promise.all([
                axios.get('/operaciones/operations/'),
                axios.get('/operaciones/operations/dashboard_metrics/').catch(() => ({ data: { total: 0, en_proceso: 0, finalizadas: 0 } })),
                axios.get('/operaciones/operations/holidays_ar/').catch(() => ({ data: [] }))
            ]);
            setOperations(opsRes.data);
            setMetrics(metricsRes.data);
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

    const cancelOperation = async (id, event) => {
        event.stopPropagation();
        if (!window.confirm('¿Está seguro de anular esta operación? Esta acción cambiará el estado a Cancelada.')) return;
        try {
            await axios.post(`/operaciones/operations/${id}/cancel_operation/`);
            fetchData();
        } catch (err) {
            console.error(err);
            alert('Error al intentar anular la operación.');
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

    const handleFormSuccess = () => {
        setOperationModalState({ isOpen: false, type: null, id: null });
        fetchData();
    };

    // Preparar eventos para el calendario
    const calendarEvents = useMemo(() => {
        const evts = operations.filter(op => op.eta).map(op => ({
            id: op.id,
            title: `${getTypePrefix(op.tipo_operacion)} OP-${op.id} ${op.ship_name}`,
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

        return [...evts, ...holEvts];
    }, [operations, holidays]);

    const eventStyleGetter = (event) => {
        if (event.type === 'holiday') {
            return { style: { backgroundColor: '#fecdd3', color: '#881337', fontWeight: 'bold', border: 'none', padding: '2px' } };
        }
        return { style: { backgroundColor: '#4f46e5', color: 'white', borderRadius: '4px', border: 'none' } };
    };

    // Renderizado de Contenidos
    const renderOverview = () => (
        <div className="space-y-6 animate-fadeIn">
            <h2 className="text-2xl font-bold text-gray-800">Panorama (KPIs)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
                <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center items-center">
                    <span className="text-xs sm:text-sm font-bold text-gray-500 uppercase tracking-widest mb-2 text-center">T. Operaciones</span>
                    <span className="text-4xl sm:text-5xl font-black text-indigo-600">{metrics.total}</span>
                </div>
                <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center items-center">
                    <span className="text-xs sm:text-sm font-bold text-gray-500 uppercase tracking-widest mb-2 text-center">En Proceso</span>
                    <span className="text-4xl sm:text-5xl font-black text-amber-500">{metrics.en_proceso}</span>
                </div>
                <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center items-center">
                    <span className="text-xs sm:text-sm font-bold text-gray-500 uppercase tracking-widest mb-2 text-center">Finalizadas</span>
                    <span className="text-4xl sm:text-5xl font-black text-emerald-500">{metrics.finalizadas}</span>
                </div>
                <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center items-center">
                    <span className="text-xs sm:text-sm font-bold text-gray-500 uppercase tracking-widest mb-2 text-center">User Activos</span>
                    <span className="text-4xl sm:text-5xl font-black text-blue-500">{metrics.usuarios_activos || 0}</span>
                </div>
            </div>
            {/* Próximamente gráficos */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-100 bg-indigo-50/50 mt-6">
                <h3 className="text-lg font-bold text-indigo-900 mb-2 whitespace-nowrap overflow-hidden text-ellipsis">
                    <i className="bi bi-lightbulb-fill text-amber-500 mr-2 text-xl"></i>
                    Novedades del Sistema
                </h3>
                <p className="text-indigo-700 text-sm mt-1">Se está preparando la funcionalidad de bandejas de entrada integrada. Muy pronto verás los correos empresariales directamente aquí.</p>
            </div>
        </div>
    );

    const renderCalendar = () => (
        <div className="animate-fadeIn bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100 h-[700px] flex flex-col">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Agenda y Arribos Estimados (ETA)</h2>
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
                        if (e.type !== 'holiday') navigate(`/operations/${e.id}`);
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
                <h2 className="text-2xl font-bold text-gray-800 hidden sm:block">Listado de Operaciones</h2>

                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-64">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <i className="bi bi-search text-gray-400"></i>
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar cliente, buque..."
                            className="pl-9 block w-full py-2 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-500 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <select
                        className="py-2 pl-3 pr-8 border border-gray-300 bg-white rounded-xl text-gray-700 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                    >
                        <option value="">Todos los Tipos</option>
                        <option value="productos">■ Productos</option>
                        <option value="quimicos">■ Químicos</option>
                        <option value="servicios">■ Servicios</option>
                    </select>

                    <select
                        className="py-2 pl-3 pr-8 border border-gray-300 bg-white rounded-xl text-gray-700 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
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
                    <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-dashed border-gray-300">
                        <p className="text-gray-500">No hay operaciones que coincidan con los filtros.</p>
                    </div>
                ) : (
                    filteredOps?.map((op) => (
                        <div key={op.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all flex flex-col group relative">
                            <div className={`absolute top-0 left-0 w-1.5 h-full ${op.tipo_operacion === 'quimicos' ? 'bg-emerald-500' : op.tipo_operacion === 'servicios' ? 'bg-amber-500' : 'bg-indigo-500'}`}></div>
                            <div className="p-4 sm:p-5 pl-5 sm:pl-6 flex-1 flex flex-col">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <div className="flex items-center gap-1.5 mb-1">
                                            {getTypeIcon(op.tipo_operacion)}
                                            <span className="text-[10px] font-bold text-gray-400">#OP-{String(op.id).padStart(4, '0')}</span>
                                            {getStatusBadge(op.status || op.estado)}
                                            {op.aprobacion_requerida_owner && (
                                                <span className="ml-1 bg-red-100 text-red-700 text-[10px] font-black px-1.5 py-0.5 rounded animate-pulse"><i className="bi bi-exclamation-triangle-fill mr-1"></i>ACCIÓN REQ</span>
                                            )}
                                        </div>
                                        <h3 className="text-base sm:text-lg font-bold text-gray-900 leading-tight group-hover:text-indigo-600 truncate">{op.ship_name || 'Buque Desconocido'}</h3>
                                    </div>
                                </div>

                                <div className="text-xs sm:text-sm text-gray-600 mb-3 bg-slate-50 p-2 sm:p-3 rounded-lg border border-slate-100 flex-1">
                                    <p className="truncate"><strong>Cliente:</strong> {op.client_name}</p>
                                    <p className="truncate"><strong>Puerto:</strong> {op.port_name}</p>
                                    <p className="truncate text-indigo-700 font-medium"><strong>ETA:</strong> {op.eta ? format(new Date(op.eta), 'dd/MM/yy HH:mm') : 'N/A'}</p>
                                </div>

                                <div className="flex flex-wrap gap-1.5 mb-3">
                                    {renderDocSemaphore('PKG', op.packing_list_file, op.status || op.estado)}
                                    {renderDocSemaphore('RMT', op.remito_file, op.status || op.estado)}
                                    {renderDocSemaphore('RCH', op.rancho_file, op.status || op.estado)}
                                </div>

                                <div className="mt-auto pt-3 flex justify-between items-center border-t border-gray-100">
                                    <div className="font-black text-slate-800 text-sm truncate max-w-[50%]">
                                        $<span className="text-lg">{calculateTotal(op.products).toLocaleString()}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        {op.estado !== 'entregada' && op.estado !== 'cancelada' && (
                                            <button onClick={(e) => cancelOperation(op.id, e)} className="text-xs font-semibold text-gray-400 hover:text-red-600 px-2">Anular</button>
                                        )}
                                        <button onClick={() => navigate(`/operations/${op.id}`)} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold rounded-lg transition-colors">Ver</button>
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
        <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans overflow-hidden">
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
                            <span className="text-[10px] uppercase text-indigo-300 font-bold tracking-widest block">Management</span>
                        </div>
                    )}
                </div>

                <div className={`py-6 flex-1 space-y-1 ${isSidebarOpen ? 'px-4' : 'px-2 flex flex-col items-center'}`}>
                    {isSidebarOpen && <p className="px-2 text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Principal</p>}

                    <button title={!isSidebarOpen ? "Resumen KPIs" : ""} onClick={() => setActiveTab('overview')} className={`flex items-center rounded-xl font-medium text-sm transition-all ${isSidebarOpen ? 'w-full gap-3 px-3 py-2.5' : 'w-12 h-12 justify-center'} ${activeTab === 'overview' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
                        <i className="bi bi-pie-chart-fill text-lg shrink-0"></i>
                        {isSidebarOpen && <span>Resumen KPIs</span>}
                    </button>
                    <button title={!isSidebarOpen ? "Agenda ETAs" : ""} onClick={() => setActiveTab('calendar')} className={`flex items-center rounded-xl font-medium text-sm transition-all ${isSidebarOpen ? 'w-full gap-3 px-3 py-2.5' : 'w-12 h-12 justify-center'} ${activeTab === 'calendar' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
                        <i className="bi bi-calendar-event text-lg shrink-0"></i>
                        {isSidebarOpen && <span>Agenda ETAs</span>}
                    </button>
                    <button title={!isSidebarOpen ? "Operaciones" : ""} onClick={() => setActiveTab('operations')} className={`flex items-center rounded-xl font-medium text-sm transition-all ${isSidebarOpen ? 'w-full gap-3 px-3 py-2.5' : 'w-12 h-12 justify-center'} ${activeTab === 'operations' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
                        <i className="bi bi-list-check text-lg shrink-0"></i>
                        {isSidebarOpen && <span>Operaciones</span>}
                    </button>
                    <button title={!isSidebarOpen ? "Bandeja de Entrada" : ""} onClick={() => setActiveTab('inbox')} className={`flex items-center rounded-xl font-medium text-sm transition-all ${isSidebarOpen ? 'w-full gap-3 px-3 py-2.5 justify-between' : 'w-12 h-12 justify-center relative'} ${activeTab === 'inbox' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
                        <div className="flex items-center gap-3">
                            <i className="bi bi-envelope-open text-lg shrink-0"></i>
                            {isSidebarOpen && <span>Correo Central</span>}
                        </div>
                        {isSidebarOpen ? (
                            <span className="bg-slate-700 text-slate-300 text-[9px] font-black px-2 py-0.5 rounded-full uppercase">Próx</span>
                        ) : (
                            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-indigo-400 border-2 border-slate-900 rounded-full"></span>
                        )}
                    </button>

                    {isSidebarOpen ? (
                        <p className="px-2 text-xs font-black text-slate-500 uppercase tracking-wider mt-8 mb-2">Sistema</p>
                    ) : (
                        <div className="w-full border-t border-slate-800 my-4"></div>
                    )}

                    <button title={!isSidebarOpen ? "Inventario & Recetas" : ""} onClick={() => setActiveTab('inventory')} className={`flex items-center rounded-xl font-medium text-sm transition-all ${isSidebarOpen ? 'w-full gap-3 px-3 py-2.5' : 'w-12 h-12 justify-center'} ${activeTab === 'inventory' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
                        <i className="bi bi-box-seam text-lg shrink-0"></i>
                        {isSidebarOpen && <span>Inventario & Recetas</span>}
                    </button>
                </div>

                <div className={`border-t border-slate-800 bg-slate-900 flex ${isSidebarOpen ? 'p-4 flex-col' : 'p-2 py-4 flex-col items-center gap-4'}`}>
                    {/* BOTÓN DEBUG EN SIDEBAR DESKTOP */}
                    <button
                        title={!isSidebarOpen ? "Reportar Error" : ""}
                        onClick={() => setShowDebugForm(true)}
                        className={`mb-3 flex justify-center items-center gap-2 py-2 bg-indigo-900/50 text-indigo-300 hover:bg-indigo-600 hover:text-white border border-indigo-500/30 rounded-xl text-xs font-bold transition-colors ${isSidebarOpen ? 'w-full' : 'w-10 h-10'}`}
                    >
                        <i className="bi bi-bug-fill text-base"></i>
                        {isSidebarOpen && <span>Testing & Debug</span>}
                    </button>

                    <div className={`flex items-center gap-3 ${isSidebarOpen ? 'mb-4 px-2' : ''}`}>
                        <div className="w-9 h-9 shrink-0 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-sm text-indigo-400">
                            {user?.username?.[0]?.toUpperCase()}
                        </div>
                        {isSidebarOpen && (
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-white truncate">{user?.username}</p>
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
                <div className="flex items-center gap-2">
                    {/* BOTÓN DEBUG EN MOBILE */}
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
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30 flex justify-around p-2 pb-safe">
                <button onClick={() => setActiveTab('overview')} className={`flex flex-col items-center p-2 ${activeTab === 'overview' ? 'text-indigo-600' : 'text-gray-400'}`}>
                    <i className="bi bi-pie-chart-fill text-xl"></i>
                    <span className="text-[10px] mt-1 font-semibold">Resumen</span>
                </button>
                <button onClick={() => setActiveTab('calendar')} className={`flex flex-col items-center p-2 ${activeTab === 'calendar' ? 'text-indigo-600' : 'text-gray-400'}`}>
                    <i className="bi bi-calendar-event text-xl"></i>
                    <span className="text-[10px] mt-1 font-semibold">Agenda</span>
                </button>
                <button onClick={() => setActiveTab('operations')} className={`flex flex-col items-center p-2 ${activeTab === 'operations' ? 'text-indigo-600' : 'text-gray-400'}`}>
                    <i className="bi bi-list-check text-xl"></i>
                    <span className="text-[10px] mt-1 font-semibold">Operaciones</span>
                </button>
                <button onClick={() => setActiveTab('inbox')} className={`flex flex-col items-center p-2 ${activeTab === 'inbox' ? 'text-indigo-600' : 'text-gray-400'}`}>
                    <i className="bi relative bi-envelope-open text-xl">
                        {activeTab !== 'inbox' && <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-indigo-500 border-2 border-white rounded-full"></span>}
                    </i>
                    <span className="text-[10px] mt-1 font-semibold">Correo</span>
                </button>
            </div>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50 relative pb-16 md:pb-0">

                {/* Header Solo Desktop */}
                <header className="hidden md:flex bg-white px-8 py-4 items-center justify-between border-b border-gray-200">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 capitalize">
                            {activeTab === 'overview' && 'Panorama Gerencial'}
                            {activeTab === 'calendar' && 'Planificación & Agenda'}
                            {activeTab === 'operations' && 'Gestión Operativa'}
                            {activeTab === 'inbox' && 'Comunicaciones'}
                            {activeTab === 'inventory' && 'Inventario y Fórmulas'}
                        </h2>
                        <p className="text-sm text-gray-500">
                            {activeTab === 'inventory' ? 'Administra las existencias de productos y recetas químicas de la compañía.' : 'Bienvenido de vuelta, mira lo que pasa en la compañía.'}
                        </p>
                    </div>
                    {activeTab !== 'inventory' && (
                        <button onClick={() => setOperationModalState({ isOpen: true, type: 'selector', id: null })} className="bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 rounded-xl text-white shadow-sm shadow-indigo-200 font-bold text-sm transition-all flex items-center gap-2">
                            <i className="bi bi-plus-lg text-lg"></i>
                            Nueva Operación
                        </button>
                    )}
                </header>

                <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-8 custom-scrollbar">
                    {loading && (
                        <div className="flex flex-col items-center justify-center py-20 space-y-4 h-full">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                            <p className="text-gray-500 font-medium tracking-wider animate-pulse">Sincronizando información...</p>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg shadow-sm mb-6">
                            <p className="text-red-700 font-medium">{error}</p>
                        </div>
                    )}

                    {!loading && !error && (
                        <>
                            {activeTab === 'overview' && renderOverview()}
                            {activeTab === 'calendar' && renderCalendar()}
                            {activeTab === 'operations' && renderOperationsList()}
                            {activeTab === 'inbox' && renderInbox()}
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
                    onClose={() => setOperationModalState({ isOpen: false, type: null, id: null })}
                    onSuccess={handleFormSuccess}
                />
            )}
            {operationModalState.isOpen && operationModalState.type === 'quimicos' && (
                <OperationFormQuimicos
                    id={operationModalState.id}
                    onClose={() => setOperationModalState({ isOpen: false, type: null, id: null })}
                    onSuccess={handleFormSuccess}
                />
            )}
            {operationModalState.isOpen && operationModalState.type === 'servicios' && (
                <OperationFormServicios
                    id={operationModalState.id}
                    onClose={() => setOperationModalState({ isOpen: false, type: null, id: null })}
                    onSuccess={handleFormSuccess}
                />
            )}

            {/* MODAL DE DEBUG & SUGERENCIAS */}
            {showDebugForm && (
                <DebugFeedback onClose={() => setShowDebugForm(false)} />
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fadeIn { animation: fadeIn 0.3s ease-out forwards; }
                .custom-scrollbar::-webkit-scrollbar { width: 8px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 20px; border: 2px solid #f8fafc; }
                .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
                /* Big Calendar Overrides */
                .rbc-calendar { font-family: inherit; }
                .rbc-toolbar button { border-radius: 8px; font-weight: 600; color: #4b5563; }
                .rbc-toolbar button.rbc-active { background-color: #4f46e5; color: white; border-color: #4f46e5; }
                .rbc-event { opacity: 0.9 !important; border-radius: 6px !important; }
                .rbc-today { background-color: #f8fafc !important; }
            `}} />
        </div>
    );
}