import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from '../api/axios';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.png';
import { formatUserName, getUserInitials } from '../utils/formatters';
import OperationTypeSelector from '../components/OperationTypeSelector';
import OperationFormProductos from '../components/OperationFormProductos';
import OperationFormQuimicos from '../components/OperationFormQuimicos';
import OperationFormServicios from '../components/OperationFormServicios';
import OperationFormOtros from '../components/OperationFormOtros';
import InboxView from '../components/InboxView';
import InventoryManagement from '../components/InventoryManagement';
import StaffManagement from '../components/StaffManagement';
import DebugFeedback from '../components/DebugFeedback';
import AgendaEventModal from '../components/AgendaEventModal';
import { useTheme } from '../context/ThemeContext';
import { useTourStore } from '../stores/tourStore';
import LogoSpinner from '../components/LogoSpinner';
import StockMovements from '../components/StockMovements'; // NUEVO
import UserManagement from '../components/UserManagement';
import SeguimientoOperadores from '../components/SeguimientoOperadores';
import RegistrosManagement from '../components/RegistrosManagement';
import AppVersionInfo from '../components/AppVersionInfo';
import TarifarioModal from '../components/TarifarioModal';
import OperationHistoryModal from '../components/OperationHistoryModal';
import NotificationMenu from '../components/NotificationMenu';

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
    const { theme, toggleTheme } = useTheme();
    const { startTour, run } = useTourStore();
    const navigate = useNavigate();
    const location = useLocation();

    const [activeTab, setActiveTab] = useState(() => localStorage.getItem('ownerDashboard_activeTab') || 'overview');
    const [operations, setOperations] = useState([]);
    const [filteredOps, setFilteredOps] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [statusFilter, setStatusFilter] = useState('');
    const [operatorFilter, setOperatorFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [metrics, setMetrics] = useState({ total: 0, en_proceso: 0, finalizadas: 0, usuarios_activos: 0 });
    const [holidays, setHolidays] = useState([]);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Collapsible states for KPIs
    const [opsExpanded, setOpsExpanded] = useState(true);
    const [invExpanded, setInvExpanded] = useState(true);
    const [usrExpanded, setUsrExpanded] = useState(true);

    const [calView, setCalView] = useState('week');
    const [calDate, setCalDate] = useState(new Date());

    const [operationModalState, setOperationModalState] = useState(() => {
        const saved = localStorage.getItem('ownerDashboard_operationModalState');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { }
        }
        return { isOpen: false, type: null, id: null };
    });
    const [emailSource, setEmailSource] = useState(null);
    const [showTarifarioModal, setShowTarifarioModal] = useState(false);
    const [selectedHistoryOp, setSelectedHistoryOp] = useState(null);
    const [notifCategoryFilter, setNotifCategoryFilter] = useState('all');
    const [notifSearchTerm, setNotifSearchTerm] = useState('');


    const handleCreateFromEmail = (email) => {
        setEmailSource(email);
        setOperationModalState({ isOpen: true, type: 'selector', id: null });
    };

    // Eventos de Agenda
    const [agendaEvents, setAgendaEvents] = useState([]);
    const [agendaEventModalState, setAgendaEventModalState] = useState(() => {
        const saved = localStorage.getItem('ownerDashboard_agendaEventModalState');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { }
        }
        return { isOpen: false, eventToEdit: null };
    });
    const [selectedOperatorFilter, setSelectedOperatorFilter] = useState(user?.id || '');
    const [operators, setOperators] = useState([]);
    const [hasNewAgendaEvent, setHasNewAgendaEvent] = useState(false);
    const [unreadEmailsCount, setUnreadEmailsCount] = useState(0);

    const [showDebugForm, setShowDebugForm] = useState(false);

    const fetchUnreadEmails = async () => {
        try {
            const res = await axios.get('/correos/inbox/?unread=true');
            const data = res.data.results || res.data;
            if (data && Array.isArray(data)) {
                const unread = data.filter(e => e.direction === 'inbound' && !e.is_read);
                setUnreadEmailsCount(unread.length);
            }
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchData();
        fetchOperators();
        fetchUnreadEmails();
        const interval = setInterval(fetchUnreadEmails, 60000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        fetchAgendaEvents();
    }, [selectedOperatorFilter]);

    useEffect(() => {
        localStorage.setItem('ownerDashboard_activeTab', activeTab);
        if (activeTab === 'calendar') {
            setHasNewAgendaEvent(false);
            localStorage.setItem('last_seen_agenda', new Date().toISOString());
        }
    }, [activeTab]);

    useEffect(() => {
        localStorage.setItem('ownerDashboard_operationModalState', JSON.stringify(operationModalState));
    }, [operationModalState]);

    useEffect(() => {
        localStorage.setItem('ownerDashboard_agendaEventModalState', JSON.stringify(agendaEventModalState));
    }, [agendaEventModalState]);

    // Contextual Tours Logic
    useEffect(() => {
        if (!user || !user.id || run) return;
        
        // 1. Check if all tours are permanently disabled
        const isAllDisabled = localStorage.getItem(`tours_disabled_${user.id}`) === 'true';
        if (isAllDisabled) return;

        // 2. Check Welcome Tour
        const welcomeSeen = localStorage.getItem(`hasSeenTour_${user.id}_welcome`) === 'true';
        if (!welcomeSeen) {
            const timer = setTimeout(() => {
                startTour('welcome');
            }, 800);
            return () => clearTimeout(timer);
        }

        // 3. Check Contextual Tab Tour
        const tabTourMap = {
            'overview': 'overview',
            'calendar': 'calendar',
            'operations': 'operations',
            'inbox': 'inbox',
            'inventory': 'inventory',
            'staff': 'staff',
            'stockMovements': 'movements',
            'users': 'users',
            'seguimiento_operadores': 'tracking'
        };

        const currentTabTour = tabTourMap[activeTab];
        if (currentTabTour) {
            const tabSeen = localStorage.getItem(`hasSeenTour_${user.id}_${currentTabTour}`) === 'true';
            if (!tabSeen) {
                const timer = setTimeout(() => {
                    startTour(currentTabTour);
                }, 500);
                return () => clearTimeout(timer);
            }
        }
    }, [user, activeTab, startTour, run]);

    const fetchOperators = async () => {
        try {
            const res = await axios.get('/usuarios/users/');
            if (res.data) {
                let filtered = res.data.filter(u => u.role === 'OPERADOR');
                if (user?.role === 'OWNER') {
                    const owners = res.data.filter(u => u.role === 'OWNER');
                    filtered = [...filtered, ...owners];
                }
                setOperators(filtered);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const fetchAgendaEvents = async () => {
        try {
            let url = '/operaciones/events/';
            if (selectedOperatorFilter) {
                url += `?user_id=${selectedOperatorFilter}`;
            }
            const res = await axios.get(url);
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
        if (operatorFilter) {
            filtered = filtered.filter(op => op.operadores_id && op.operadores_id.includes(Number(operatorFilter)));
        }
        if (typeFilter) {
            filtered = filtered.filter(op => op.tipo_operacion === typeFilter);
        }
        if (statusFilter) {
            filtered = filtered.filter(op => op.status === statusFilter || op.estado === statusFilter);
        }
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(op =>
                op.client_name?.toLowerCase().includes(term) ||
                op.ship_name?.toLowerCase().includes(term) ||
                (op.operadores_nombres && op.operadores_nombres.some(name => name.toLowerCase().includes(term)))
            );
        }
        setFilteredOps(filtered);
    }, [operations, operatorFilter, typeFilter, statusFilter, searchTerm]);

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

    const calculateTotal = (op) => {
        let total = 0;
        if (op.products && op.products.length > 0) {
            total += op.products.reduce((sum, p) => sum + ((p.quantity || 0) * (p.unit_price || 0)), 0);
        }
        if (op.tipo_operacion === 'servicios') {
            if (op.items_cotizacion_servicio && op.items_cotizacion_servicio.length > 0) {
                total += op.items_cotizacion_servicio.reduce((sum, item) => {
                    const imp = parseFloat(item.importe);
                    if (!isNaN(imp) && item.importe !== '' && item.importe !== null) return sum + imp;
                    return sum + ((parseFloat(item.cantidad) || 0) * (parseFloat(item.precio_unitario || item.precio) || 0));
                }, 0);
            } else {
                total += (parseFloat(op.valor_servicio) || 0);
            }
        }
        return total;
    };

    const getStatusBadge = (status) => {
        const maps = {
            pending: { color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800', label: 'Solicitada' },
            solicitada: { color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800', label: 'Solicitada' },
            draft: { color: 'bg-orange-100 text-orange-800', label: 'Borrador' },
            price_checked: { color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800', label: 'Presupuestada' },
            presupuestada: { color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800', label: 'Presupuestada' },
            confirmed: { color: 'bg-green-100 dark:bg-green-900/30 text-green-800', label: 'Lista para envío' },
            lista_para_envio: { color: 'bg-green-100 dark:bg-green-900/30 text-green-800', label: 'Lista para envío' },
            in_coordination: { color: 'bg-purple-100 text-purple-800', label: 'En producción' },
            en_produccion: { color: 'bg-purple-100 text-purple-800', label: 'En producción' },
            delivered: { color: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800', label: 'Remitada' },
            remitada: { color: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800', label: 'Remitada' },
            closed: { color: 'bg-gray-100 text-gray-800', label: 'Entregada' },
            entregada: { color: 'bg-gray-100 text-gray-800', label: 'Entregada' },
            cancelled: { color: 'bg-red-100 dark:bg-red-900/30 text-red-800', label: 'Cancelada' },
            cancelada: { color: 'bg-red-100 dark:bg-red-900/30 text-red-800', label: 'Cancelada' },
        };
        const mapped = maps[status] || { color: 'bg-gray-100 text-gray-800', label: status };
        return (
            <span className={`px-2 py-1 inline-flex text-[10px] sm:text-xs leading-4 font-semibold rounded-full ${mapped.color}`}>
                {mapped.label}
            </span>
        );
    };

    const getTypeIcon = (type) => {
        if (type === 'quimicos') return <i title="Químicos" className="bi bi-droplet-half text-emerald-500 text-sm"></i>;
        if (type === 'servicios') return <i title="Servicios" className="bi bi-tools text-amber-500 text-sm"></i>;
        if (type === 'otros') return <i title="Otros" className="bi bi-folder text-gray-500 text-sm"></i>;
        return <i title="Productos" className="bi bi-box-seam text-indigo-500 text-sm"></i>;
    };

    const getTypePrefix = (type) => {
        if (type === 'quimicos') return '[QMC]';
        if (type === 'servicios') return '[SRV]';
        if (type === 'otros') return '[OTR]';
        return '[PRD]';
    };

    const renderDocSemaphore = (label, fileUrl, opStatus) => {
        let statusConfig = {};
        if (fileUrl) {
            statusConfig = { dot: 'bg-emerald-500', box: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 text-emerald-700', title: 'Completado' };
        } else {
            const inProgressStates = ['in_coordination', 'en_produccion', 'confirmed', 'lista_para_envio', 'delivered', 'remitada'];
            if (inProgressStates.includes(opStatus)) {
                statusConfig = { dot: 'bg-amber-400 animate-pulse', box: 'bg-amber-50 border-amber-200 text-amber-700', title: 'En Proceso' };
            } else {
                statusConfig = { dot: 'bg-red-500', box: 'bg-red-50 dark:bg-red-900/20 border-red-200 text-red-700', title: 'Faltante' };
            }
        }
        return (
            <div title={`${label}: ${statusConfig.title}`} className={`flex items-center gap-1.5 px-2 py-1 rounded border ${statusConfig.box} text-[10px] font-bold uppercase tracking-wider`}>
                <div className={`w-2 h-2 rounded-full ${statusConfig.dot}`}></div>
                {label}
            </div>
        );
    };

    const handleFormSuccess = (createdOrUpdatedId) => {
        const isCreation = !operationModalState.id;
        const targetId = typeof createdOrUpdatedId === 'object' && createdOrUpdatedId !== null
            ? createdOrUpdatedId.id
            : createdOrUpdatedId;

        setOperationModalState({ isOpen: false, type: null, id: null });
        setEmailSource(null);
        fetchData();

        if (isCreation && targetId) {
            window.open(`/operations/${targetId}`, '_blank');
        }
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

    const eventStyleGetter = (event) => {
        if (event.type === 'holiday') {
            return { style: { backgroundColor: '#fecdd3', color: '#881337', fontWeight: 'bold', border: 'none', padding: '2px' } };
        }
        if (event.type === 'agenda') {
            return { style: { backgroundColor: '#10b981', color: 'white', borderRadius: '4px', border: 'none' } };
        }
        return { style: { backgroundColor: '#4f46e5', color: 'white', borderRadius: '4px', border: 'none' } };
    };

    // Renderizado de Contenidos
    const renderOverview = () => (
        <div className="space-y-8 animate-fadeIn">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">Panorama (KPIs)</h2>

            {/* Operaciones */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 transition-all">
                <div
                    className="flex justify-between items-center cursor-pointer select-none mb-4"
                    onClick={() => setOpsExpanded(!opsExpanded)}
                >
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2 mb-0">
                        <i className="bi bi-list-check text-indigo-500"></i>
                        Estado de Operaciones
                    </h3>
                    <button className="text-gray-400 hover:text-indigo-500 transition-colors">
                        <i className={`bi bi-chevron-${opsExpanded ? 'up' : 'down'}`}></i>
                    </button>
                </div>
                {opsExpanded && (
                    <>
                        <div className="tour-kpi-ops grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-2xl flex flex-col justify-center items-center">
                                <span className="text-[10px] sm:text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-1 text-center">Total</span>
                                <span className="text-3xl sm:text-4xl font-black text-indigo-600">{metrics.operaciones?.total || metrics.total || 0}</span>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-2xl flex flex-col justify-center items-center">
                                <span className="text-[10px] sm:text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-1 text-center">En Proceso</span>
                                <span className="text-3xl sm:text-4xl font-black text-amber-500">{metrics.operaciones?.en_proceso || metrics.en_proceso || 0}</span>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-2xl flex flex-col justify-center items-center">
                                <span className="text-[10px] sm:text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-1 text-center">Finalizadas</span>
                                <span className="text-3xl sm:text-4xl font-black text-emerald-500">{metrics.operaciones?.finalizadas || metrics.finalizadas || 0}</span>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-2xl flex flex-col justify-center items-center">
                                <span className="text-[10px] sm:text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-1 text-center">Canceladas</span>
                                <span className="text-3xl sm:text-4xl font-black text-red-500">{metrics.operaciones?.canceladas || 0}</span>
                            </div>
                        </div>

                        <div className="tour-kpi-types grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                            <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600">
                                    <i className="bi bi-box-seam"></i>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Productos</p>
                                    <p className="text-lg font-black text-gray-800 dark:text-gray-100">{metrics.operaciones?.por_tipo?.productos || 0}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl">
                                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600">
                                    <i className="bi bi-droplet-half"></i>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Químicos</p>
                                    <p className="text-lg font-black text-gray-800 dark:text-gray-100">{metrics.operaciones?.por_tipo?.quimicos || 0}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl">
                                <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-600">
                                    <i className="bi bi-tools"></i>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Servicios</p>
                                    <p className="text-lg font-black text-gray-800 dark:text-gray-100">{metrics.operaciones?.por_tipo?.servicios || 0}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl">
                                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-400">
                                    <i className="bi bi-folder"></i>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Otros</p>
                                    <p className="text-lg font-black text-gray-800 dark:text-gray-100">{metrics.operaciones?.por_tipo?.otros || 0}</p>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Inventario */}
                <div className="tour-kpi-inventory bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 transition-all">
                    <div
                        className="flex justify-between items-center cursor-pointer select-none mb-4"
                        onClick={() => setInvExpanded(!invExpanded)}
                    >
                        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2 mb-0">
                            <i className="bi bi-boxes text-emerald-500"></i>
                            Inventario
                        </h3>
                        <button className="text-gray-400 hover:text-emerald-500 transition-colors">
                            <i className={`bi bi-chevron-${invExpanded ? 'up' : 'down'}`}></i>
                        </button>
                    </div>
                    {invExpanded && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-2xl">
                                <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest block mb-1">Total Artículos</span>
                                <span className="text-3xl font-black text-emerald-600">{metrics.inventario?.total_articulos || 0}</span>
                            </div>
                            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-2xl">
                                <span className="text-[10px] font-bold text-red-500 dark:text-red-400 uppercase tracking-widest block mb-1">Bajo Stock</span>
                                <span className="text-3xl font-black text-red-600">{metrics.inventario?.bajo_stock || 0}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Usuarios */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 transition-all">
                    <div
                        className="flex justify-between items-center cursor-pointer select-none mb-4"
                        onClick={() => setUsrExpanded(!usrExpanded)}
                    >
                        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2 mb-0">
                            <i className="bi bi-people-fill text-blue-500"></i>
                            Usuarios
                        </h3>
                        <button className="text-gray-400 hover:text-blue-500 transition-colors">
                            <i className={`bi bi-chevron-${usrExpanded ? 'up' : 'down'}`}></i>
                        </button>
                    </div>
                    {usrExpanded && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-2xl flex flex-col justify-center">
                                <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest block mb-1">Usuarios Activos</span>
                                <span className="text-3xl font-black text-blue-600">{metrics.usuarios?.activos || metrics.usuarios_activos || 0}</span>
                            </div>
                            <div className="flex flex-col gap-2 justify-center">
                                <div className="flex justify-between items-center text-sm bg-slate-50 dark:bg-slate-700/30 px-3 py-1.5 rounded-lg">
                                    <span className="font-semibold text-gray-600 dark:text-slate-300">Owners</span>
                                    <span className="font-black text-gray-800 dark:text-gray-100">{metrics.usuarios?.owner || 0}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm bg-slate-50 dark:bg-slate-700/30 px-3 py-1.5 rounded-lg">
                                    <span className="font-semibold text-gray-600 dark:text-slate-300">Operadores</span>
                                    <span className="font-black text-gray-800 dark:text-gray-100">{metrics.usuarios?.operadores || 0}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm bg-slate-50 dark:bg-slate-700/30 px-3 py-1.5 rounded-lg">
                                    <span className="font-semibold text-gray-600 dark:text-slate-300">Operarios</span>
                                    <span className="font-black text-gray-800 dark:text-gray-100">{metrics.usuarios?.operarios || 0}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    const renderCalendar = () => (
        <div className="animate-fadeIn bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 h-[700px] flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Agenda y Arribos Estimados (ETA)</h2>
                <div className="flex items-center gap-3">
                    <select
                        className="tour-cal-filter py-1.5 pl-3 pr-8 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white bg-white rounded-xl text-gray-700 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
                        value={selectedOperatorFilter}
                        onChange={(e) => setSelectedOperatorFilter(e.target.value)}
                    >
                        <option value={user?.id || ''}>Mi Agenda</option>
                        <option value="">Todos los Operadores</option>
                        {operators.map(op => (
                            <option key={op.id} value={op.id}>{formatUserName(op)}</option>
                        ))}
                    </select>
                    <button
                        onClick={() => setAgendaEventModalState({ isOpen: true, eventToEdit: null })}
                        className="tour-cal-new bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl text-sm font-bold shadow-sm flex items-center gap-1"
                    >
                        <i className="bi bi-plus-lg"></i> Nuevo Evento
                    </button>
                </div>
            </div>
            <div className="tour-cal-view flex-1 min-h-0">
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

    const renderOperatorSummary = () => {
        if (!operators.length) return null;
        
        const operatorStats = operators.map(op => {
            const opCount = operations.filter(o => 
                o.operadores_id && o.operadores_id.includes(op.id) && 
                o.estado !== 'entregada' && o.estado !== 'cancelada'
            ).length;
            return { ...op, opCount };
        }).sort((a, b) => b.opCount - a.opCount);

        return (
            <div className="mb-6 bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                    <i className="bi bi-person-badge text-indigo-500"></i>
                    Resumen por Operador (Activas)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {operatorStats.map(op => (
                        <div 
                            key={op.id} 
                            onClick={() => setOperatorFilter(operatorFilter === String(op.id) ? '' : String(op.id))}
                            className={`cursor-pointer p-3 rounded-xl border flex justify-between items-center transition-all ${operatorFilter === String(op.id) ? 'bg-indigo-50 border-indigo-300 dark:bg-indigo-900/40 shadow-sm' : 'bg-slate-50 border-slate-100 dark:bg-slate-700/50 hover:bg-slate-100 dark:border-slate-600'}`}
                        >
                            <span className={`text-sm font-semibold ${operatorFilter === String(op.id) ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-700 dark:text-slate-300'}`}>{formatUserName(op)}</span>
                            <span className={`py-0.5 px-2 rounded-full text-xs font-black ${operatorFilter === String(op.id) ? 'bg-indigo-200 text-indigo-800' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'}`}>{op.opCount}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderOperationsList = (opsToRender) => (
        <div className="animate-fadeIn">
            <div className="tour-ops-search flex flex-col sm:flex-row gap-3 mb-6 items-end justify-between">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 hidden sm:block">Listado de Operaciones</h2>

                <div className="tour-ops-filters flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
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
                        <option value="otros">■ Otros</option>
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

                    <select
                        className="py-2 pl-3 pr-8 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white bg-white rounded-xl text-gray-700 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
                        value={operatorFilter}
                        onChange={(e) => setOperatorFilter(e.target.value)}
                    >
                        <option value="">Todos los Operadores</option>
                        {operators.map(op => (
                            <option key={op.id} value={op.id}>{formatUserName(op)}</option>
                        ))}
                    </select>

                    <button
                        type="button"
                        onClick={() => setShowTarifarioModal(true)}
                        className="py-2 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition shadow-sm flex items-center justify-center gap-2 shrink-0"
                        title="Ver y editar precios de horas hombre (Mecánica, Caldera, Electricidad, etc.)"
                    >
                        <i className="bi bi-clock-history"></i>
                        <span>Tarifario Horas Hombre</span>
                    </button>
                </div>
            </div>


            <div className="tour-ops-list grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
                {opsToRender?.length === 0 ? (
                    <div className="col-span-full py-16 text-center bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-gray-300 dark:border-slate-600">
                        <p className="text-gray-500 dark:text-slate-400">No hay operaciones en esta vista.</p>
                    </div>
                ) : (
                    opsToRender?.map((op) => (
                        <div
                            key={op.id}
                            onClick={() => navigate(`/operations/${op.id}`)}
                            className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden hover:shadow-md transition-all flex flex-col group relative cursor-pointer"
                        >
                            <div className={`absolute top-0 left-0 w-1.5 h-full ${op.tipo_operacion === 'quimicos' ? 'bg-emerald-500' : op.tipo_operacion === 'servicios' ? 'bg-amber-500' : op.tipo_operacion === 'otros' ? 'bg-gray-500' : 'bg-indigo-500'}`}></div>

                            {/* Botón de Historial con posición fija en la esquina superior derecha */}
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedHistoryOp(op);
                                }}
                                className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 z-10 p-1 px-2 rounded-lg bg-slate-100 hover:bg-indigo-50 dark:bg-slate-700/60 dark:hover:bg-indigo-950/50 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300 border border-slate-200 dark:border-slate-700 transition flex items-center gap-1 text-xs font-bold shrink-0 shadow-sm"
                                title="Ver historial de avances y creación"
                            >
                                <i className="bi bi-clock-history text-xs text-indigo-500"></i>
                                <span className="text-[10px]">Historial</span>
                            </button>

                            <div className="p-4 sm:p-5 pl-5 sm:pl-6 flex-1 flex flex-col">
                                <div className="mb-2 pr-20 min-w-0">
                                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                        {getTypeIcon(op.tipo_operacion)}
                                        <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500">#{getTypePrefix(op.tipo_operacion)}OP-{String(op.id).padStart(4, '0')}</span>
                                        {getStatusBadge(op.status || op.estado)}
                                        {op.estado_revision === 'pending' && (
                                            <span className="ml-1 bg-amber-100 text-amber-700 text-[10px] font-black px-1.5 py-0.5 rounded animate-pulse" title="Requiere ser revisada"><i className="bi bi-shield-exclamation mr-1"></i>REVISAR</span>
                                        )}
                                    </div>
                                    <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white leading-tight group-hover:text-indigo-600 truncate" title={op.nombre || op.ship_name || 'Operación sin nombre'}>
                                        {op.nombre || op.ship_name || 'Operación sin nombre'}
                                    </h3>
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
                                        $<span className="text-lg">{calculateTotal(op).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex gap-2 items-center">
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                window.open(`/operations/${op.id}`, '_blank');
                                            }}
                                            className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity mr-2"
                                        >
                                            Ver Detalles <i className="bi bi-chevron-right"></i>
                                        </button>
                                        {op.estado !== 'entregada' && op.estado !== 'cancelada' && (
                                            <button onClick={(e) => cancelOperation(op.id, e)} className="text-xs font-semibold text-gray-400 hover:text-red-600 px-2 transition-colors">Anular</button>
                                        )}
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
        <InboxView onCreateFromEmail={handleCreateFromEmail} />
    );

    const getOperacionPendingInfo = (op) => {
        const tipo = op.tipo_operacion;
        const estado = op.status || op.estado;
        const prefijo = getTypePrefix(tipo);
        const opTag = `#${prefijo}OP-${String(op.id).padStart(4, '0')}`;
        const buque = op.ship_name || 'Buque N/D';

        let usuarioStr = 'Operador no asignado';
        if (op.operadores_nombres && op.operadores_nombres.length > 0) {
            usuarioStr = op.operadores_nombres.join(', ');
        } else if (op.creado_por_nombre) {
            usuarioStr = op.creado_por_nombre;
        }

        let faseNombre = 'Operación en curso';
        let accion = `gestionar la fase ${estado}`;
        let icon = 'bi-bell';
        let category = 'otras';

        if (tipo === 'servicios') {
            if (estado === 'solicitud_servicio' || estado === 'recibida') {
                faseNombre = 'Cotización de Servicio';
                accion = 'cotizar el servicio';
                icon = 'bi-cash-coin';
                category = 'cotizacion';
            } else if (estado === 'cotizado') {
                faseNombre = 'Aprobación de Cotización';
                accion = 'el seguimiento y confirmación del cliente';
                icon = 'bi-envelope-check';
                category = 'cotizacion';
            } else if (estado === 'permisos_pna') {
                faseNombre = 'Permisos PNA';
                accion = 'tramitar los permisos PNA';
                icon = 'bi-shield-check';
                category = 'ejecucion';
            } else if (estado === 'en_ejecucion') {
                faseNombre = 'Ejecución de Servicio';
                accion = 'la ejecución y avance del servicio técnico';
                icon = 'bi-tools';
                category = 'ejecucion';
            } else if (estado === 'reporte_firmado') {
                faseNombre = 'Cierre Operativo';
                accion = 'la firma de reporte y entrega final';
                icon = 'bi-check2-circle';
                category = 'logistica';
            }
        } else {
            if (estado === 'recibida') {
                faseNombre = 'Cotización Inicial';
                accion = 'cotizar la operación';
                icon = 'bi-cash-coin';
                category = 'cotizacion';
            } else if (estado === 'cotizacion_enviada') {
                faseNombre = 'Confirmación de Cliente';
                accion = 'el seguimiento y confirmación del cliente';
                icon = 'bi-envelope-check';
                category = 'cotizacion';
            } else if (estado === 'solicitada') {
                faseNombre = 'Armado de Packing List';
                accion = 'el armado de Packing List';
                icon = 'bi-box-seam';
                category = 'ejecucion';
            } else if (estado === 'armado_packing') {
                faseNombre = 'Preparación de Suministros';
                accion = 'la preparación y verificación de bultos';
                icon = 'bi-boxes';
                category = 'ejecucion';
            } else if (estado === 'en_aduana') {
                faseNombre = 'Trámite Aduanal';
                accion = 'el trámite de Aduana y Rancho';
                icon = 'bi-shield-check';
                category = 'aduana';
            } else if (estado === 'esperando_rancho') {
                faseNombre = 'Confirmación de Rancho';
                accion = 'la confirmación de Rancho en Aduana';
                icon = 'bi-hourglass-split';
                category = 'aduana';
            } else if (estado === 'lista_para_envio') {
                faseNombre = 'Logística y Despacho';
                accion = 'la emisión de Remito y coordinación de logística';
                icon = 'bi-truck';
                category = 'logistica';
            }
        }

        const isPendingReview = op.estado_revision === 'pending';
        let mensaje = '';
        if (isPendingReview) {
            mensaje = `El usuario ${usuarioStr} tiene pendiente tu revisión y aprobación de Owner en la operación ${opTag} (${buque}).`;
        } else {
            mensaje = `El usuario ${usuarioStr} tiene pendiente ${accion} en la operación ${opTag} (${buque}).`;
        }

        return {
            faseNombre,
            accion,
            usuarioStr,
            opTag,
            buque,
            icon,
            category,
            isPendingReview,
            mensaje
        };
    };

    const renderNotificationsView = () => {
        const pendingOps = (operations || []).filter(op => op.estado !== 'entregada' && op.estado !== 'cancelada');

        const itemsWithInfo = pendingOps.map(op => ({
            op,
            info: getOperacionPendingInfo(op)
        }));

        const filteredNotifications = itemsWithInfo.filter(({ op, info }) => {
            if (notifCategoryFilter === 'revision' && !info.isPendingReview) return false;
            if (notifCategoryFilter === 'cotizacion' && info.category !== 'cotizacion') return false;
            if (notifCategoryFilter === 'ejecucion' && info.category !== 'ejecucion') return false;
            if (notifCategoryFilter === 'aduana_logistica' && info.category !== 'aduana' && info.category !== 'logistica') return false;

            if (notifSearchTerm) {
                const term = notifSearchTerm.toLowerCase();
                const matchMsg = info.mensaje.toLowerCase().includes(term);
                const matchUser = info.usuarioStr.toLowerCase().includes(term);
                const matchShip = (op.ship_name || '').toLowerCase().includes(term);
                const matchClient = (op.client_name || '').toLowerCase().includes(term);
                if (!matchMsg && !matchUser && !matchShip && !matchClient) return false;
            }
            return true;
        });

        const totalPendientes = itemsWithInfo.length;
        const totalRevision = itemsWithInfo.filter(x => x.info.isPendingReview).length;
        const totalCotizacion = itemsWithInfo.filter(x => x.info.category === 'cotizacion').length;
        const totalEjecucion = itemsWithInfo.filter(x => x.info.category === 'ejecucion').length;
        const totalAduanaLog = itemsWithInfo.filter(x => x.info.category === 'aduana' || x.info.category === 'logistica').length;

        return (
            <div className="space-y-6 animate-fadeIn pb-12">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div 
                        onClick={() => setNotifCategoryFilter('all')}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all ${notifCategoryFilter === 'all' ? 'bg-indigo-50 border-indigo-300 dark:bg-indigo-950/50 dark:border-indigo-800 shadow-sm' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}
                    >
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase block mb-1">Total Pendientes</span>
                        <div className="flex items-baseline justify-between">
                            <span className="text-2xl font-black text-slate-900 dark:text-white">{totalPendientes}</span>
                            <i className="bi bi-bell text-indigo-500 text-lg"></i>
                        </div>
                    </div>

                    <div 
                        onClick={() => setNotifCategoryFilter('cotizacion')}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all ${notifCategoryFilter === 'cotizacion' ? 'bg-amber-50 border-amber-300 dark:bg-amber-950/50 dark:border-amber-800 shadow-sm' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}
                    >
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase block mb-1">Cotizaciones</span>
                        <div className="flex items-baseline justify-between">
                            <span className="text-2xl font-black text-amber-600 dark:text-amber-400">{totalCotizacion}</span>
                            <i className="bi bi-cash-coin text-amber-500 text-lg"></i>
                        </div>
                    </div>

                    <div 
                        onClick={() => setNotifCategoryFilter('ejecucion')}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all ${notifCategoryFilter === 'ejecucion' ? 'bg-cyan-50 border-cyan-300 dark:bg-cyan-950/50 dark:border-cyan-800 shadow-sm' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}
                    >
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase block mb-1">En Ejecución</span>
                        <div className="flex items-baseline justify-between">
                            <span className="text-2xl font-black text-cyan-600 dark:text-cyan-400">{totalEjecucion}</span>
                            <i className="bi bi-tools text-cyan-500 text-lg"></i>
                        </div>
                    </div>

                    <div 
                        onClick={() => setNotifCategoryFilter('revision')}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all ${notifCategoryFilter === 'revision' ? 'bg-red-50 border-red-300 dark:bg-red-950/50 dark:border-red-800 shadow-sm' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}
                    >
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase block mb-1">Requiere Aprobación</span>
                        <div className="flex items-baseline justify-between">
                            <span className="text-2xl font-black text-red-600 dark:text-red-400">{totalRevision}</span>
                            <i className="bi bi-shield-exclamation text-red-500 text-lg"></i>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row gap-3 justify-between items-center">
                    <div className="flex flex-wrap gap-2 w-full md:w-auto">
                        <button
                            onClick={() => setNotifCategoryFilter('all')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${notifCategoryFilter === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
                        >
                            Todas ({totalPendientes})
                        </button>
                        <button
                            onClick={() => setNotifCategoryFilter('cotizacion')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${notifCategoryFilter === 'cotizacion' ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
                        >
                            Cotizaciones ({totalCotizacion})
                        </button>
                        <button
                            onClick={() => setNotifCategoryFilter('ejecucion')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${notifCategoryFilter === 'ejecucion' ? 'bg-cyan-600 text-white shadow-sm' : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
                        >
                            Ejecución & Packing ({totalEjecucion})
                        </button>
                        <button
                            onClick={() => setNotifCategoryFilter('aduana_logistica')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${notifCategoryFilter === 'aduana_logistica' ? 'bg-orange-600 text-white shadow-sm' : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
                        >
                            Aduana & Despacho ({totalAduanaLog})
                        </button>
                        {totalRevision > 0 && (
                            <button
                                onClick={() => setNotifCategoryFilter('revision')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${notifCategoryFilter === 'revision' ? 'bg-red-600 text-white shadow-sm' : 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-200'}`}
                            >
                                <i className="bi bi-shield-exclamation mr-1"></i> Requiere Aprobación ({totalRevision})
                            </button>
                        )}
                    </div>

                    <div className="relative w-full md:w-72">
                        <i className="bi bi-search absolute left-3.5 top-2.5 text-slate-400 text-xs"></i>
                        <input
                            type="text"
                            value={notifSearchTerm}
                            onChange={(e) => setNotifSearchTerm(e.target.value)}
                            placeholder="Buscar operador, buque o acción..."
                            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                        {notifSearchTerm && (
                            <button onClick={() => setNotifSearchTerm('')} className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs">
                                <i className="bi bi-x-circle-fill"></i>
                            </button>
                        )}
                    </div>
                </div>

                <div className="space-y-3">
                    {filteredNotifications.length === 0 ? (
                        <div className="py-16 text-center bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-gray-300 dark:border-slate-700 p-6">
                            <i className="bi bi-check-circle text-emerald-500 text-4xl block mb-2"></i>
                            <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">No hay notificaciones pendientes</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                No se encontraron tareas pendientes con el filtro seleccionado.
                            </p>
                        </div>
                    ) : (
                        filteredNotifications.map(({ op, info }) => (
                            <div
                                key={op.id}
                                onClick={() => navigate(`/operations/${op.id}`)}
                                className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 group relative overflow-hidden"
                            >
                                <div className={`absolute top-0 left-0 w-1.5 h-full ${op.tipo_operacion === 'servicios' ? 'bg-amber-500' : op.tipo_operacion === 'quimicos' ? 'bg-emerald-500' : 'bg-indigo-500'}`}></div>

                                <div className="flex items-start gap-3.5 pl-2">
                                    <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-slate-700/80 border border-indigo-100 dark:border-slate-600 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5 group-hover:scale-110 transition-transform shadow-sm">
                                        <i className={`bi ${info.icon} text-lg`}></i>
                                    </div>

                                    <div>
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                                                {info.opTag}
                                            </span>
                                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                                                {info.faseNombre}
                                            </span>
                                            {info.isPendingReview && (
                                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-300 border border-red-200 animate-pulse">
                                                    <i className="bi bi-shield-exclamation mr-1"></i> Requiere Aprobación Owner
                                                </span>
                                            )}
                                        </div>

                                        <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                                            {info.mensaje}
                                        </h4>

                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-slate-500 dark:text-slate-400">
                                            <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                                                <i className="bi bi-water text-indigo-500"></i> {op.ship_name || 'Buque N/D'}
                                            </span>
                                            <span>•</span>
                                            <span><i className="bi bi-building"></i> {op.client_name || 'Cliente N/D'}</span>
                                            <span>•</span>
                                            <span><i className="bi bi-geo-alt"></i> {op.port_name || 'Puerto N/D'}</span>
                                            {op.eta && (
                                                <>
                                                    <span>•</span>
                                                    <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                                                        <i className="bi bi-clock"></i> ETA: {format(new Date(op.eta), 'dd/MM/yy HH:mm')}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 self-end md:self-center shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-750 w-full md:w-auto justify-end">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedHistoryOp(op);
                                        }}
                                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 text-xs font-bold transition flex items-center gap-1.5"
                                        title="Ver historial de la operación"
                                    >
                                        <i className="bi bi-clock-history text-xs text-indigo-500"></i> Historial
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => navigate(`/operations/${op.id}`)}
                                        className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm shadow-indigo-200 dark:shadow-none"
                                    >
                                        Ver Operación <i className="bi bi-chevron-right text-xs"></i>
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col md:flex-row font-sans overflow-hidden transition-colors duration-200">
            {/* Sidebar Desktop */}
            <aside className={`relative bg-slate-900 text-white flex-col hidden md:flex h-screen sticky top-0 shadow-xl z-20 transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20 items-center'}`}>
                <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="absolute -right-3 top-8 bg-indigo-600 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-md hover:bg-indigo-500 transition-colors z-30"
                    title={isSidebarOpen ? 'Colapsar menú' : 'Expandir menú'}
                >
                    <i className={`bi ${isSidebarOpen ? 'bi-chevron-left' : 'bi-chevron-right'} text-[10px]`}></i>
                </button>

                <div className={`p-6 flex items-center border-b border-slate-800 ${isSidebarOpen ? 'gap-3' : 'justify-center'}`}>
                    <img src={logo} alt="TECHSHIP Logo" className="w-10 h-10 object-contain shrink-0" />
                    {isSidebarOpen && (
                        <div className="animate-fadeIn">
                            <h1 className="font-black text-xl tracking-tight leading-none text-white whitespace-nowrap">TECHSHIP</h1>
                        </div>
                    )}
                </div>

                <div className={`py-6 flex-1 space-y-1 overflow-y-auto ${isSidebarOpen ? 'px-4' : 'px-2 flex flex-col items-center'}`}>
                    {isSidebarOpen && <p className="px-2 text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Principal</p>}
                    <button title={!isSidebarOpen ? "Resumen KPIs" : ""} onClick={() => setActiveTab('overview')} className={`tour-owner-kpis flex items-center rounded-xl font-medium text-sm transition-all ${isSidebarOpen ? 'w-full gap-3 px-3 py-2.5' : 'w-12 h-12 justify-center'} ${activeTab === 'overview' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
                        <i className="bi bi-pie-chart-fill text-lg shrink-0"></i>
                        {isSidebarOpen && <span>Resumen KPIs</span>}
                    </button>
                    <button title={!isSidebarOpen ? "Agenda ETAs" : ""} onClick={() => setActiveTab('calendar')} className={`tour-owner-agenda flex items-center rounded-xl font-medium text-sm transition-all ${isSidebarOpen ? 'w-full gap-3 px-3 py-2.5' : 'w-12 h-12 justify-center'} ${activeTab === 'calendar' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
                        <i className="bi relative bi-calendar-event text-lg shrink-0">
                            {hasNewAgendaEvent && activeTab !== 'calendar' && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 border-2 border-slate-900 rounded-full animate-pulse"></span>}
                        </i>
                        {isSidebarOpen && <span>Agenda ETAs</span>}
                    </button>
                    <button title={!isSidebarOpen ? "Operaciones" : ""} onClick={() => setActiveTab('operations')} className={`tour-owner-ops flex items-center rounded-xl font-medium text-sm transition-all ${isSidebarOpen ? 'w-full gap-3 px-3 py-2.5' : 'w-12 h-12 justify-center'} ${activeTab === 'operations' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
                        <i className="bi bi-list-check text-lg shrink-0"></i>
                        {isSidebarOpen && <span>Operaciones</span>}
                    </button>
                    <button title={!isSidebarOpen ? "Bandeja de Entrada" : ""} onClick={() => setActiveTab('inbox')} className={`tour-owner-inbox flex items-center rounded-xl font-medium text-sm transition-all ${isSidebarOpen ? 'w-full gap-3 px-3 py-2.5 justify-between' : 'w-12 h-12 justify-center relative'} ${activeTab === 'inbox' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
                        <div className="flex items-center gap-3">
                            <i className="bi bi-envelope-open text-lg shrink-0"></i>
                            {isSidebarOpen && <span>Correo Central</span>}
                        </div>
                        {isSidebarOpen ? (
                            unreadEmailsCount > 0 ? <span className="bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase animate-pulse">Nuevo</span> : null
                        ) : (
                            unreadEmailsCount > 0 ? <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 border-2 border-slate-900 rounded-full animate-pulse"></span> : null
                        )}
                    </button>
                    <button title={!isSidebarOpen ? "Notificaciones" : ""} onClick={() => setActiveTab('approvals')} className={`tour-owner-approvals flex items-center rounded-xl font-medium text-sm transition-all ${isSidebarOpen ? 'w-full gap-3 px-3 py-2.5 justify-between' : 'w-12 h-12 justify-center relative'} ${activeTab === 'approvals' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
                        <div className="flex items-center gap-3">
                            <i className="bi bi-bell text-lg shrink-0"></i>
                            {isSidebarOpen && <span>Notificaciones</span>}
                        </div>
                        {isSidebarOpen ? (
                            (operations || []).some(op => op.estado_revision === 'pending') && <span className="bg-amber-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase animate-pulse">Info</span>
                        ) : (
                            (operations || []).some(op => op.estado_revision === 'pending') && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-amber-500 border-2 border-slate-900 rounded-full animate-bounce"></span>
                        )}
                    </button>
                    {isSidebarOpen ? (
                        <p className="px-2 text-xs font-black text-slate-500 uppercase tracking-wider mt-8 mb-2">Sistema</p>
                    ) : (
                        <div className="w-full border-t border-slate-800 my-4"></div>
                    )}
                    <button title={!isSidebarOpen ? "Inventario & Recetas" : ""} onClick={() => setActiveTab('inventory')} className={`tour-owner-inventory flex items-center rounded-xl font-medium text-sm transition-all ${isSidebarOpen ? 'w-full gap-3 px-3 py-2.5' : 'w-12 h-12 justify-center'} ${activeTab === 'inventory' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
                        <i className="bi bi-box-seam text-lg shrink-0"></i>
                        {isSidebarOpen && <span>Inventario & Recetas</span>}
                    </button>
                    <button title={!isSidebarOpen ? "Plantel Operarios" : ""} onClick={() => setActiveTab('staff')} className={`tour-owner-staff flex items-center rounded-xl font-medium text-sm transition-all ${isSidebarOpen ? 'w-full gap-3 px-3 py-2.5' : 'w-12 h-12 justify-center'} ${activeTab === 'staff' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
                        <i className="bi bi-people-fill text-lg shrink-0"></i>
                        {isSidebarOpen && <span>Plantel Operarios</span>}
                    </button>
                    <button title={!isSidebarOpen ? "Movimientos Stock" : ""} onClick={() => setActiveTab('stockMovements')} className={`tour-owner-stock flex items-center rounded-xl font-medium text-sm transition-all ${isSidebarOpen ? 'w-full gap-3 px-3 py-2.5' : 'w-12 h-12 justify-center'} ${activeTab === 'stockMovements' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
                        <i className="bi bi-boxes text-lg shrink-0"></i>
                        {isSidebarOpen && <span>Movimientos Stock</span>}
                    </button>
                    <button title={!isSidebarOpen ? "Gestión Usuarios" : ""} onClick={() => setActiveTab('users')} className={`tour-owner-users flex items-center rounded-xl font-medium text-sm transition-all ${isSidebarOpen ? 'w-full gap-3 px-3 py-2.5' : 'w-12 h-12 justify-center'} ${activeTab === 'users' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
                        <i className="bi bi-person-gear text-lg shrink-0"></i>
                        {isSidebarOpen && <span>Gestión Usuarios</span>}
                    </button>
                    <button title={!isSidebarOpen ? "Seguimiento Ops" : ""} onClick={() => setActiveTab('seguimiento_operadores')} className={`flex items-center rounded-xl font-medium text-sm transition-all ${isSidebarOpen ? 'w-full gap-3 px-3 py-2.5' : 'w-12 h-12 justify-center'} ${activeTab === 'seguimiento_operadores' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
                        <i className="bi bi-activity text-lg shrink-0"></i>
                        {isSidebarOpen && <span>Seguimiento Ops</span>}
                    </button>
                    <button title={!isSidebarOpen ? "Registros" : ""} onClick={() => setActiveTab('registros')} className={`flex items-center rounded-xl font-medium text-sm transition-all ${isSidebarOpen ? 'w-full gap-3 px-3 py-2.5' : 'w-12 h-12 justify-center'} ${activeTab === 'registros' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
                        <i className="bi bi-journal-bookmark text-lg shrink-0"></i>
                        {isSidebarOpen && <span>Registros</span>}
                    </button>
                </div>

                <div className={`tour-system-menu border-t border-slate-800 bg-slate-900 flex ${isSidebarOpen ? 'p-4 flex-col' : 'p-2 py-4 flex-col items-center gap-4'}`}>
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
                    <AppVersionInfo isSidebarOpen={isSidebarOpen} />
                </div>
            </aside>

            {/* Navbar Mobile */}
            <div className="md:hidden bg-slate-900 text-white p-4 flex justify-between items-center sticky top-0 z-30 shadow-md">
                <div className="flex items-center gap-2">
                    <img src={logo} alt="TECHSHIP Logo" className="w-8 h-8 object-contain shrink-0" />
                    <h1 className="font-black text-lg">TECHSHIP</h1>
                </div>
                <div className="flex items-center gap-2">
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
                <button onClick={() => { setActiveTab('overview'); setIsMobileMenuOpen(false); }} className={`flex flex-col items-center p-2 ${activeTab === 'overview' && !isMobileMenuOpen ? 'text-indigo-600' : 'text-gray-400'}`}>
                    <i className="bi bi-pie-chart-fill text-xl"></i>
                    <span className="text-[10px] mt-1 font-semibold">Resumen</span>
                </button>
                <button onClick={() => { setActiveTab('operations'); setIsMobileMenuOpen(false); }} className={`flex flex-col items-center p-2 ${activeTab === 'operations' && !isMobileMenuOpen ? 'text-indigo-600' : 'text-gray-400'}`}>
                    <i className="bi bi-list-check text-xl"></i>
                    <span className="text-[10px] mt-1 font-semibold">Operaciones</span>
                </button>
                <button onClick={() => { setActiveTab('inbox'); setIsMobileMenuOpen(false); }} className={`flex flex-col items-center p-2 ${activeTab === 'inbox' && !isMobileMenuOpen ? 'text-indigo-600' : 'text-gray-400'}`}>
                    <i className="bi relative bi-envelope-open text-xl">
                        {unreadEmailsCount > 0 && activeTab !== 'inbox' && <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>}
                    </i>
                    <span className="text-[10px] mt-1 font-semibold">Correo</span>
                </button>
                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className={`flex flex-col items-center p-2 ${isMobileMenuOpen ? 'text-indigo-600' : 'text-gray-400'}`}>
                    <i className="bi relative bi-list text-xl">
                        {(hasNewAgendaEvent || (operations || []).some(op => op.estado_revision === 'pending')) && <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-amber-500 border-2 border-white rounded-full"></span>}
                    </i>
                    <span className="text-[10px] mt-1 font-semibold">Menú</span>
                </button>
            </div>

            {/* Mobile Menu Overlay */}
            {isMobileMenuOpen && (
                <div className="md:hidden fixed inset-0 z-20 flex flex-col bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}>
                    <div className="mt-auto bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl p-6 pb-24 overflow-y-auto max-h-[80vh] border-t border-gray-100 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
                        <div className="w-12 h-1.5 bg-gray-300 dark:bg-slate-700 rounded-full mx-auto mb-6"></div>
                        
                        <h3 className="text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-4">Gestión y Herramientas</h3>
                        <div className="grid grid-cols-4 gap-4 mb-8">
                            <button onClick={() => { setActiveTab('calendar'); setIsMobileMenuOpen(false); }} className={`flex flex-col items-center gap-2 ${activeTab === 'calendar' ? 'text-indigo-600' : 'text-gray-600 dark:text-slate-300'}`}>
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center relative shadow-sm border ${activeTab === 'calendar' ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/30 dark:border-indigo-800' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
                                    <i className="bi bi-calendar-event text-xl"></i>
                                    {hasNewAgendaEvent && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-white dark:border-slate-800 rounded-full"></span>}
                                </div>
                                <span className="text-[10px] font-semibold text-center leading-tight">Agenda</span>
                            </button>
                            <button onClick={() => { setActiveTab('approvals'); setIsMobileMenuOpen(false); }} className={`flex flex-col items-center gap-2 ${activeTab === 'approvals' ? 'text-indigo-600' : 'text-gray-600 dark:text-slate-300'}`}>
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center relative shadow-sm border ${activeTab === 'approvals' ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/30 dark:border-indigo-800' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
                                    <i className="bi bi-bell text-xl"></i>
                                    {(operations || []).some(op => op.estado_revision === 'pending') && <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 border-2 border-white dark:border-slate-800 rounded-full"></span>}
                                </div>
                                <span className="text-[10px] font-semibold text-center leading-tight">Alertas</span>
                            </button>
                            <button onClick={() => { setActiveTab('stockMovements'); setIsMobileMenuOpen(false); }} className={`flex flex-col items-center gap-2 ${activeTab === 'stockMovements' ? 'text-indigo-600' : 'text-gray-600 dark:text-slate-300'}`}>
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm border ${activeTab === 'stockMovements' ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/30 dark:border-indigo-800' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
                                    <i className="bi bi-boxes text-xl"></i>
                                </div>
                                <span className="text-[10px] font-semibold text-center leading-tight">Stock</span>
                            </button>
                            <button onClick={() => { setActiveTab('inventory'); setIsMobileMenuOpen(false); }} className={`flex flex-col items-center gap-2 ${activeTab === 'inventory' ? 'text-indigo-600' : 'text-gray-600 dark:text-slate-300'}`}>
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm border ${activeTab === 'inventory' ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/30 dark:border-indigo-800' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
                                    <i className="bi bi-box-seam text-xl"></i>
                                </div>
                                <span className="text-[10px] font-semibold text-center leading-tight">Inventario</span>
                            </button>
                            <button onClick={() => { setActiveTab('staff'); setIsMobileMenuOpen(false); }} className={`flex flex-col items-center gap-2 ${activeTab === 'staff' ? 'text-indigo-600' : 'text-gray-600 dark:text-slate-300'}`}>
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm border ${activeTab === 'staff' ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/30 dark:border-indigo-800' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
                                    <i className="bi bi-people text-xl"></i>
                                </div>
                                <span className="text-[10px] font-semibold text-center leading-tight">Plantel</span>
                            </button>
                            <button onClick={() => { setActiveTab('users'); setIsMobileMenuOpen(false); }} className={`flex flex-col items-center gap-2 ${activeTab === 'users' ? 'text-indigo-600' : 'text-gray-600 dark:text-slate-300'}`}>
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm border ${activeTab === 'users' ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/30 dark:border-indigo-800' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
                                    <i className="bi bi-person-gear text-xl"></i>
                                </div>
                                <span className="text-[10px] font-semibold text-center leading-tight">Usuarios</span>
                            </button>
                            <button onClick={() => { setActiveTab('seguimiento_operadores'); setIsMobileMenuOpen(false); }} className={`flex flex-col items-center gap-2 ${activeTab === 'seguimiento_operadores' ? 'text-indigo-600' : 'text-gray-600 dark:text-slate-300'}`}>
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm border ${activeTab === 'seguimiento_operadores' ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/30 dark:border-indigo-800' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
                                    <i className="bi bi-activity text-xl"></i>
                                </div>
                                <span className="text-[10px] font-semibold text-center leading-tight">KPIs</span>
                            </button>
                            <button onClick={() => { setActiveTab('registros'); setIsMobileMenuOpen(false); }} className={`flex flex-col items-center gap-2 ${activeTab === 'registros' ? 'text-indigo-600' : 'text-gray-600 dark:text-slate-300'}`}>
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm border ${activeTab === 'registros' ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/30 dark:border-indigo-800' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
                                    <i className="bi bi-journal-bookmark text-xl"></i>
                                </div>
                                <span className="text-[10px] font-semibold text-center leading-tight">Registros</span>
                            </button>
                        </div>
                        
                        <h3 className="text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-4">Ajustes</h3>
                        <div className="space-y-3">
                            <button onClick={() => { toggleTheme(); setIsMobileMenuOpen(false); }} className="w-full flex items-center gap-3 p-3.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-700 border border-slate-100 dark:border-slate-700 rounded-xl font-bold text-sm text-gray-700 dark:text-slate-300 transition-colors">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                    <i className={`bi ${theme === 'dark' ? 'bi-sun-fill' : 'bi-moon-stars-fill'} text-base`}></i>
                                </div>
                                {theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
                            </button>
                            <button onClick={() => { logout(); setIsMobileMenuOpen(false); }} className="w-full flex items-center gap-3 p-3.5 bg-red-50 hover:bg-red-100 dark:bg-red-900/10 dark:hover:bg-red-900/30 border border-red-100 dark:border-red-900/30 rounded-xl font-bold text-sm text-red-600 dark:text-red-400 transition-colors">
                                <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center text-red-600 dark:text-red-400">
                                    <i className="bi bi-box-arrow-right text-base"></i>
                                </div>
                                Cerrar Sesión
                            </button>
                        </div>
                    </div>
                </div>
            )}


            {/* Main Content Area */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 relative pb-16 md:pb-0 transition-colors duration-200">
                <header className="hidden md:flex bg-white dark:bg-slate-800 px-8 py-4 items-center justify-between border-b border-gray-200 dark:border-slate-700 transition-colors duration-200">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 capitalize">
                            {activeTab === 'overview' && 'Panorama Gerencial'}
                            {activeTab === 'calendar' && 'Planificación & Agenda'}
                            {activeTab === 'operations' && 'Gestión Operativa'}
                            {activeTab === 'inbox' && 'Comunicaciones'}
                            {activeTab === 'approvals' && 'Notificaciones Operativas'}
                            {activeTab === 'inventory' && 'Inventario y Fórmulas'}
                            {activeTab === 'staff' && 'Personal de Plantel'}
                            {activeTab === 'stockMovements' && 'Movimientos de Stock'}
                            {activeTab === 'users' && 'Gestión de Usuarios'}
                            {activeTab === 'seguimiento_operadores' && 'Rendimiento y Seguimiento'}
                            {activeTab === 'registros' && 'Directorio de Registros'}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-slate-400">
                            {activeTab === 'inventory' ? 'Administra las existencias de productos y recetas químicas de la compañía.' :
                                activeTab === 'approvals' ? 'Verifica los reportes y aprueba los pasos administrativos de los operadores.' :
                                    activeTab === 'staff' ? 'Administración del personal operativo disponible para la empresa.' :
                                        activeTab === 'stockMovements' ? 'Historial detallado de entradas, salidas y ajustes de inventario.' :
                                            activeTab === 'users' ? 'Crea y administra las cuentas de acceso web para tus empleados.' :
                                                activeTab === 'seguimiento_operadores' ? 'Métricas de rendimiento de operadores y tiempos de cierre.' :
                                                    activeTab === 'registros' ? 'Directorio central de clientes y agencias marítimas de la empresa.' :
                                                        'Bienvenido de vuelta, mira lo que pasa en la compañía.'}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <NotificationMenu />
                        {activeTab !== 'inventory' && activeTab !== 'staff' && activeTab !== 'stockMovements' && activeTab !== 'users' && activeTab !== 'seguimiento_operadores' && activeTab !== 'registros' && (
                            <button onClick={() => setOperationModalState({ isOpen: true, type: 'selector', id: null })} className="tour-new-op-btn bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 rounded-xl text-white shadow-sm shadow-indigo-200 font-bold text-sm transition-all flex items-center gap-2">
                                <i className="bi bi-plus-lg text-lg"></i>
                                Nueva Operación
                            </button>
                        )}
                    </div>
                </header>

                <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-8 custom-scrollbar">
                    {loading && (
                        <div className="flex-1 flex items-center justify-center">
                            <LogoSpinner size="w-16 h-16" />
                        </div>
                    )}
                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-lg shadow-sm mb-6">
                            <p className="text-red-700 font-medium">{error}</p>
                        </div>
                    )}
                    {!loading && !error && (
                        <>
                            {activeTab === 'overview' && renderOverview()}
                            {activeTab === 'calendar' && renderCalendar()}
                            {activeTab === 'operations' && renderOperationsList(filteredOps)}
                            {activeTab === 'approvals' && renderNotificationsView()}
                            {activeTab === 'inbox' && renderInbox()}
                            {activeTab === 'inventory' && <InventoryManagement />}
                            {activeTab === 'staff' && <StaffManagement />}
                            {activeTab === 'stockMovements' && <StockMovements />} {/* NUEVO */}
                            {activeTab === 'users' && <UserManagement />}
                            {activeTab === 'seguimiento_operadores' && <SeguimientoOperadores />}
                            {activeTab === 'registros' && <RegistrosManagement />}
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

            {showDebugForm && (
                <DebugFeedback onClose={() => setShowDebugForm(false)} />
            )}

            <AgendaEventModal
                isOpen={agendaEventModalState.isOpen}
                onClose={() => setAgendaEventModalState({ isOpen: false, eventToEdit: null })}
                eventToEdit={agendaEventModalState.eventToEdit}
                onSave={fetchAgendaEvents}
            />

            <TarifarioModal
                isOpen={showTarifarioModal}
                onClose={() => setShowTarifarioModal(false)}
            />

            <OperationHistoryModal
                isOpen={!!selectedHistoryOp}
                onClose={() => setSelectedHistoryOp(null)}
                operation={selectedHistoryOp}
            />


            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fadeIn { animation: fadeIn 0.3s ease-out forwards; }
                .custom-scrollbar::-webkit-scrollbar { width: 8px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 20px; border: 2px solid #f8fafc; }
                .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
                .rbc-calendar { font-family: inherit; }
                .rbc-toolbar button { border-radius: 8px; font-weight: 600; color: #4b5563; }
                .rbc-toolbar button.rbc-active { background-color: #4f46e5; color: white; border-color: #4f46e5; }
                .rbc-event { opacity: 0.9 !important; border-radius: 6px !important; }
                .rbc-today { background-color: #f8fafc !important; }
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