import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import axios from '../api/axios';
import AutocompleteCreate from './AutocompleteCreate';
import LogoSpinner from './LogoSpinner';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';

// ================= COMPONENTE DE SELECCIÓN DE INGREDIENTE QUÍMICO =================
const ProductSelectionModal = ({ isOpen, onClose, onSelect, categoria = 'quimicos', title = 'Seleccionar Producto' }) => {
    const [chemicals, setChemicals] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Quick create state
    const [showCreate, setShowCreate] = useState(false);
    const [newProduct, setNewProduct] = useState({ nombre: '', nombre_en: '', presentacion: '', costo: 0 });
    const [creating, setCreating] = useState(false);

    const fetchChemicals = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/inventario/products/?categoria=${categoria}&page_size=10000`);
            const data = res.data.results || res.data;
            setChemicals(data || []);
        } catch (err) {
            console.error('Error al cargar productos:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            setShowCreate(false);
            setSearchTerm('');
            fetchChemicals();
        }
    }, [isOpen, categoria]);

    const handleCreate = async () => {
        if (!newProduct.nombre) return;
        setCreating(true);
        try {
            const payload = {
                nombre: newProduct.nombre,
                nombre_en: newProduct.nombre_en,
                presentacion: newProduct.presentacion,
                costo: parseFloat(newProduct.costo) || 0,
                categoria: categoria,
                peso_kg: 1.0,
                stock_minimo: 0.0,
                stock_maximo: 0.0,
                unidad: categoria === 'Empaque' ? 'u' : 'L',
                estado: 'Bueno',
                ubicacion: '-',
                stock_actual: 0,
                precio_venta: 0
            };
            const res = await axios.post('/inventario/products/', payload);
            setNewProduct({ nombre: '', presentacion: '', costo: 0 });
            setShowCreate(false);
            fetchChemicals();
            onSelect(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setCreating(false);
        }
    };

    const filtered = useMemo(() => {
        return chemicals.filter(c => 
            c.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.presentacion?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [chemicals, searchTerm]);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="px-6 py-4 border-b bg-indigo-50 dark:bg-indigo-950/20 flex justify-between items-center">
                    <h3 className="text-lg font-black text-indigo-900 dark:text-indigo-400">
                        {title}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">
                        <i className="bi bi-x-lg text-lg"></i>
                    </button>
                </div>
                {!showCreate && (
                    <div className="p-4 border-b flex gap-2">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                placeholder="Buscar por nombre o presentación..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border rounded-xl dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            />
                            <i className="bi bi-search absolute left-3.5 top-3 text-gray-400"></i>
                        </div>
                        <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 rounded-xl font-bold hover:bg-indigo-200">
                            <i className="bi bi-plus-lg"></i>
                        </button>
                    </div>
                )}
                {showCreate && (
                    <div className="p-4 border-b bg-gray-50 dark:bg-slate-700/50 space-y-3">
                        <h4 className="font-bold text-sm text-gray-700 dark:text-gray-300">Crear Nuevo Producto</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Nombre (Español) *</label>
                                <input type="text" placeholder="Ej: Bidón 20L" className="w-full border p-2 rounded-lg text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={newProduct.nombre} onChange={e => setNewProduct({...newProduct, nombre: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Nombre (Inglés)</label>
                                <input type="text" placeholder="Opcional" className="w-full border p-2 rounded-lg text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={newProduct.nombre_en || ''} onChange={e => setNewProduct({...newProduct, nombre_en: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Presentación *</label>
                                <input type="text" placeholder="Ej: 20 Litros" className="w-full border p-2 rounded-lg text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={newProduct.presentacion} onChange={e => setNewProduct({...newProduct, presentacion: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Costo Unitario ($) *</label>
                                <input type="number" placeholder="Ej: 15.00" step="0.01" className="w-full border p-2 rounded-lg text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={newProduct.costo} onChange={e => setNewProduct({...newProduct, costo: e.target.value})} />
                            </div>
                        </div>
                        <div className="flex gap-2 justify-end mt-2">
                            <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-sm font-bold text-gray-500 hover:text-gray-700">Cancelar</button>
                            <button onClick={handleCreate} disabled={creating || !newProduct.nombre} className="px-3 py-1.5 text-sm font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                                {creating ? 'Guardando...' : 'Guardar y Seleccionar'}
                            </button>
                        </div>
                    </div>
                )}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {loading ? (
                        <div className="flex justify-center py-8"><LogoSpinner size="w-8 h-8" /></div>
                    ) : filtered.length === 0 ? (
                        <p className="text-center text-sm text-gray-500 py-8 italic">No se encontraron productos.</p>
                    ) : (
                        filtered.map(c => (
                            <div 
                                key={c.id} 
                                onClick={() => onSelect(c)}
                                className="flex justify-between items-center p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-indigo-50 dark:bg-indigo-900/20/50 dark:hover:bg-slate-700/50 hover:border-indigo-200 dark:hover:border-slate-600 transition-all cursor-pointer group"
                            >
                                <div>
                                    <h4 className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{c.nombre}</h4>
                                    <p className="text-xs text-gray-500 dark:text-slate-400">Presentación: {c.presentacion}</p>
                                </div>
                                <div className="text-right flex items-center gap-3">
                                    <div>
                                        <span className="text-xs text-gray-400 block">Stock Actual</span>
                                        <span className="text-sm font-black text-slate-700 dark:text-slate-300">{Number(c.stock_actual).toFixed(2)} {c.unidad || 'L'}</span>
                                    </div>
                                    <button className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors">
                                        Elegir
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
                <div className="px-6 py-4 border-t flex justify-end bg-gray-50 dark:bg-slate-750">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:bg-slate-900/50 dark:hover:bg-slate-700 transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

// ================= COMPONENTE DE TARJETA PARA VISTA MÓVIL =================
const ProductCard = ({ product, onEdit, onDelete, onMovimiento, onLogs, onRowClick }) => {
    const stockNum = Number(product.stock_actual);
    const minStock = Number(product.stock_minimo) || 0;
    const maxStock = Number(product.stock_maximo) || 0;
    
    const getBadge = () => {
        if (stockNum === 0) return <span className="bg-red-100 dark:bg-red-900/30 text-red-800 text-xs px-2 py-0.5 rounded-full">Sin stock</span>;
        if (minStock > 0 && stockNum <= minStock) return <span className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 text-xs px-2 py-0.5 rounded-full">Stock bajo</span>;
        if (maxStock > 0 && stockNum >= maxStock) return <span className="bg-orange-100 text-orange-800 text-xs px-2 py-0.5 rounded-full">Stock alto</span>;
        return <span className="bg-green-100 dark:bg-green-900/30 text-green-800 text-xs px-2 py-0.5 rounded-full">Normal</span>;
    };
    
    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => onRowClick(product)}>
            <div className="flex justify-between items-start">
                <h3 className="font-bold text-gray-900 dark:text-white">{product.nombre}</h3>
                <div className="flex gap-1">
                    <button onClick={(e) => { e.stopPropagation(); onEdit(product); }} className="text-indigo-500 hover:text-indigo-700"><i className="bi bi-pencil-square"></i></button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(product); }} className="text-red-500 hover:text-red-700"><i className="bi bi-trash"></i></button>
                    <button onClick={(e) => { e.stopPropagation(); onMovimiento(product); }} className="text-emerald-500 hover:text-emerald-700"><i className="bi bi-plus-circle"></i></button>
                    <button onClick={(e) => { e.stopPropagation(); onLogs(product.id); }} className="text-gray-500 hover:text-gray-700"><i className="bi bi-file-text"></i></button>
                </div>
            </div>
            <p className="text-sm text-gray-500 mt-1">Presentación: {product.presentacion}</p>
            <div className="mt-2 flex justify-between items-center">
                <span className="text-sm font-semibold">Stock: {stockNum}</span>
                {getBadge()}
            </div>
            {product.ubicacion && <p className="text-xs text-gray-400 mt-1">Ubicación: {product.ubicacion}</p>}
            {product.estado && <p className="text-xs text-gray-400">Estado: {product.estado}</p>}
        </div>
    );
};

// ================= COMPONENTE DE PRODUCTOS INCOMPLETOS =================
const IncompleteProductsModal = ({ isOpen, onClose, onEdit, onRowClick }) => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const fetchIncomplete = async () => {
                setLoading(true);
                try {
                    const res = await axios.get('/inventario/products/?page_size=10000');
                    const data = res.data.results || res.data;
                    const filtered = data.filter(p => {
                        return (
                            !p.unidad || p.unidad === '-' || p.unidad === 'xx' ||
                            !p.ubicacion || p.ubicacion === '-' || p.ubicacion === 'xx' ||
                            !p.estado || p.estado === '-' || p.estado === 'xx' ||
                            !p.stock_minimo || Number(p.stock_minimo) === 0 ||
                            !p.stock_maximo || Number(p.stock_maximo) === 0
                        );
                    });
                    setProducts(filtered);
                } catch (err) {
                    console.error('Error', err);
                } finally {
                    setLoading(false);
                }
            };
            fetchIncomplete();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="px-6 py-4 border-b dark:border-slate-700 flex justify-between items-center bg-orange-50 dark:bg-orange-900/30">
                    <h3 className="text-lg font-bold text-orange-800 dark:text-orange-400">
                        <i className="bi bi-exclamation-triangle mr-2"></i>
                        Productos con datos faltantes
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"><i className="bi bi-x-lg"></i></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex justify-center py-8"><LogoSpinner size="w-8 h-8" /></div>
                    ) : products.length === 0 ? (
                        <p className="text-center text-gray-500 dark:text-slate-400 py-8">No hay productos con datos faltantes.</p>
                    ) : (
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                            <thead className="bg-gray-50 dark:bg-slate-700">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase">Nombre</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase">Faltantes probables</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-300 uppercase">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                                {products.map(p => {
                                    const faltantes = [];
                                    if (!p.unidad || p.unidad === '-' || p.unidad === 'xx') faltantes.push('Unidad');
                                    if (!p.ubicacion || p.ubicacion === '-' || p.ubicacion === 'xx') faltantes.push('Ubicación');
                                    if (!p.estado || p.estado === '-' || p.estado === 'xx') faltantes.push('Estado');
                                    if (!p.stock_minimo || Number(p.stock_minimo) === 0) faltantes.push('Min');
                                    if (!p.stock_maximo || Number(p.stock_maximo) === 0) faltantes.push('Max');
                                    
                                    return (
                                        <tr key={p.id} className="hover:bg-orange-50/50 dark:hover:bg-slate-700 cursor-pointer" onClick={() => onRowClick(p)}>
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-slate-200">{p.nombre}</td>
                                            <td className="px-6 py-4 text-sm text-red-600 dark:text-red-400 font-semibold">{faltantes.join(', ')}</td>
                                            <td className="px-6 py-4 text-right">
                                                <button onClick={(e) => { e.stopPropagation(); onEdit(p); }} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 font-medium">Editar</button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
                <div className="px-6 py-4 border-t dark:border-slate-700 flex justify-end bg-gray-50 dark:bg-slate-750">
                    <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:bg-slate-800/50 dark:hover:bg-slate-700">Cerrar</button>
                </div>
            </div>
        </div>,
        document.body
    );
};

// ================= COMPONENTE DE TABLA PROFESIONAL =================
const StockTableView = ({ products, loading, error, filters, onFilterChange, onSort, onPageChange, totalCount, onEdit, onDelete, onMovimiento, onLogs, onRowClick, onSelectRow, selectedRows, onSelectAll, allSelected, allCategorias }) => {
    const getStockBadge = (stock, minStock, maxStock) => {
        const s = Number(stock);
        const min = Number(minStock);
        const max = Number(maxStock);
        if (s === 0) return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800">Sin stock</span>;
        if (min > 0 && s <= min) return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800">Stock bajo</span>;
        if (max > 0 && s >= max) return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">Stock alto</span>;
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800">Normal</span>;
    };

    const ubicacionesUnicas = [...new Set(products.map(p => p.ubicacion).filter(Boolean))];
    const estadosUnicos = [...new Set(products.map(p => p.estado).filter(Boolean))];

    if (loading && products.length === 0) return <div className="flex justify-center py-8"><LogoSpinner size="w-8 h-8" /></div>;
    if (error) return <div className="text-red-500 text-center py-8">Error: {error}</div>;

    const totalPages = Math.ceil(totalCount / filters.page_size);

    return (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
            {/* Barra de filtros */}
            <div className="p-4 border-b dark:border-slate-700 flex flex-wrap gap-4 items-center">
                <input
                    type="text"
                    placeholder="Buscar por nombre..."
                    value={filters.search}
                    onChange={(e) => onFilterChange('search', e.target.value)}
                    className="border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-md px-3 py-2 w-64 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
                <select
                    value={filters.categoria}
                    onChange={(e) => onFilterChange('categoria', e.target.value)}
                    className="border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-md px-3 py-2 text-sm"
                >
                    <option value="">Todas las categorías</option>
                    {allCategorias.map(cat => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                </select>
                <select
                    value={filters.ubicacion}
                    onChange={(e) => onFilterChange('ubicacion', e.target.value)}
                    className="border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-md px-3 py-2 text-sm"
                >
                    <option value="">Todas las ubicaciones</option>
                    {ubicacionesUnicas.map(ubic => <option key={ubic} value={ubic}>{ubic}</option>)}
                </select>
                <select
                    value={filters.estado}
                    onChange={(e) => onFilterChange('estado', e.target.value)}
                    className="border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-md px-3 py-2 text-sm"
                >
                    <option value="">Todos los estados</option>
                    {estadosUnicos.map(est => <option key={est} value={est}>{est}</option>)}
                </select>
                <div className="ml-auto text-sm text-gray-600 dark:text-gray-300">Total: {totalCount} productos</div>
            </div>

            {/* Tabla responsiva con checkboxes */}
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                    <thead className="bg-gray-50 dark:bg-slate-700/50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                <input type="checkbox" checked={allSelected} onChange={onSelectAll} />
                            </th>
                            <th onClick={() => onSort('nombre')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:bg-slate-800/50 dark:hover:bg-slate-700">Nombre</th>
                            <th onClick={() => onSort('presentacion')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:bg-slate-800/50 dark:hover:bg-slate-700">Presentación</th>
                            <th onClick={() => onSort('stock_actual')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:bg-slate-800/50 dark:hover:bg-slate-700">Stock</th>
                            <th onClick={() => onSort('stock_minimo')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:bg-slate-800/50 dark:hover:bg-slate-700">Stock Mínimo</th>
                            <th onClick={() => onSort('stock_maximo')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:bg-slate-800/50 dark:hover:bg-slate-700">Stock Máximo</th>
                            <th onClick={() => onSort('categoria')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:bg-slate-800/50 dark:hover:bg-slate-700">Categoría</th>
                            <th onClick={() => onSort('ubicacion')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:bg-slate-800/50 dark:hover:bg-slate-700">Ubicación</th>
                            <th onClick={() => onSort('estado')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:bg-slate-800/50 dark:hover:bg-slate-700">Estado</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                        {products.map(product => (
                            <tr key={product.id} className="hover:bg-gray-50 dark:bg-slate-900/50 dark:hover:bg-slate-700 cursor-pointer">
                                <td className="px-6 py-4 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                    <input type="checkbox" checked={!!selectedRows[product.id]} onChange={() => onSelectRow(product.id)} />
                                </td>
                                <td onClick={() => onRowClick(product)} className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{product.nombre}</td>
                                <td onClick={() => onRowClick(product)} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{product.presentacion}</td>
                                <td onClick={() => onRowClick(product)} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                    <div className="flex items-center space-x-2">
                                        <span>{Number(product.stock_actual || 0).toFixed(2)}</span>
                                        {getStockBadge(product.stock_actual, product.stock_minimo, product.stock_maximo)}
                                    </div>
                                </td>
                                <td onClick={() => onRowClick(product)} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{Number(product.stock_minimo || 0).toFixed(2)}</td>
                                <td onClick={() => onRowClick(product)} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{Number(product.stock_maximo || 0).toFixed(2)}</td>
                                <td onClick={() => onRowClick(product)} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                    {allCategorias.find(c => c.value === product.categoria)?.label || product.categoria}
                                </td>
                                <td onClick={() => onRowClick(product)} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{product.ubicacion || '-'}</td>
                                <td onClick={() => onRowClick(product)} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{product.estado || '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium" onClick={e => e.stopPropagation()}>
                                    <button onClick={() => onEdit(product)} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 mr-2">Editar</button>
                                    <button onClick={() => onDelete(product)} className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 mr-2">Eliminar</button>
                                    <button onClick={() => onMovimiento(product)} className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300">Movimiento</button>
                                    <button onClick={() => onLogs(product.id)} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white ml-2">Logs</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Paginación */}
            <div className="px-6 py-4 flex items-center justify-between border-t dark:border-slate-700">
                <div className="flex-1 flex justify-between sm:hidden">
                    <button onClick={() => onPageChange(filters.page - 1)} disabled={filters.page === 1} className="px-4 py-2 border dark:border-slate-600 rounded-md disabled:opacity-50 dark:text-white">Anterior</button>
                    <button onClick={() => onPageChange(filters.page + 1)} disabled={filters.page === totalPages} className="px-4 py-2 border dark:border-slate-600 rounded-md disabled:opacity-50 dark:text-white">Siguiente</button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <p className="text-sm text-gray-700 dark:text-gray-300">Mostrando {products.length} de {totalCount} resultados</p>
                    <nav className="inline-flex rounded-md shadow-sm -space-x-px">
                        <button onClick={() => onPageChange(filters.page - 1)} disabled={filters.page === 1} className="px-3 py-1 border dark:border-slate-600 rounded-l-md disabled:opacity-50 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600">Anterior</button>
                        <span className="px-4 py-1 border-t border-b dark:border-slate-600 dark:bg-slate-700 dark:text-white">{filters.page} / {totalPages}</span>
                        <button onClick={() => onPageChange(filters.page + 1)} disabled={filters.page === totalPages} className="px-3 py-1 border dark:border-slate-600 rounded-r-md disabled:opacity-50 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600">Siguiente</button>
                    </nav>
                </div>
            </div>
        </div>
    );
};

// ================= MODAL DE DETALLE =================
const StockDetailModal = ({ product, onClose }) => {
    return createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
                <div className="sticky top-0 bg-white dark:bg-slate-800 px-6 py-4 border-b flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Detalle de {product.nombre}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><i className="bi bi-x-lg text-xl"></i></button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div><span className="font-semibold">Presentación:</span> {product.presentacion}</div>
                        <div><span className="font-semibold">Peso (kg):</span> {product.peso_kg}</div>
                        <div><span className="font-semibold">Stock actual:</span> {product.stock_actual}</div>
                        <div><span className="font-semibold">Stock mínimo:</span> {product.stock_minimo}</div>
                        <div><span className="font-semibold">Stock máximo:</span> {product.stock_maximo}</div>
                        <div><span className="font-semibold">Categoría:</span> {product.categoria}</div>
                        <div><span className="font-semibold">Unidad:</span> {product.unidad || 'N/A'}</div>
                        <div><span className="font-semibold">Ubicación:</span> {product.ubicacion || 'N/A'}</div>
                        <div><span className="font-semibold">Estado:</span> {product.estado || 'N/A'}</div>
                        <div><span className="font-semibold">Serie/Lote:</span> {product.serie_lote || 'N/A'}</div>
                        <div className="col-span-2"><span className="font-semibold">Observaciones:</span> {product.descripcion || 'N/A'}</div>
                    </div>
                </div>
                <div className="px-6 py-4 border-t bg-gray-50 dark:bg-slate-900/50 flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Cerrar</button>
                </div>
            </div>
        </div>,
        document.body
    );
};

// ================= COMPONENTE PRINCIPAL =================
export default function InventoryManagement() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('todo');
    const [loading, setLoading] = useState(true);
    const [toastMessage, setToastMessage] = useState(null);
    const [uploadingExcel, setUploadingExcel] = useState(false);
    const [excelFeedback, setExcelFeedback] = useState(null);
    
    // Estado para la tabla (paginación, filtros, datos)
    const [tableData, setTableData] = useState({ results: [], count: 0 });
    const [tableLoading, setTableLoading] = useState(false);
    const [tableError, setTableError] = useState(null);
    const [tableFilters, setTableFilters] = useState({
        page: 1,
        page_size: 20,
        search: '',
        categoria: '',
        ubicacion: '',
        estado: '',
        ordering: 'id',
    });
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedRows, setSelectedRows] = useState({});
    const [deletingMultiple, setDeletingMultiple] = useState(false);
    const [viewMode, setViewMode] = useState('table');
    const [searchInput, setSearchInput] = useState(tableFilters.search);
    const searchTimeoutRef = useRef(null);
    const [allCategorias, setAllCategorias] = useState([]);  // <-- nuevo estado para categorías
    
    // Estados existentes
    const [products, setProducts] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [proveedores, setProveedores] = useState([]);
    const [filteredProveedores, setFilteredProveedores] = useState([]);
    const [showProveedorModal, setShowProveedorModal] = useState(false);
    const [editingProveedor, setEditingProveedor] = useState(null);
    const [proveedorForm, setProveedorForm] = useState({ nombre: '', contacto: '', telefono: '', email: '', direccion: '', rubro: '', condicion_pago: 'contado' });
    const [submittingProveedor, setSubmittingProveedor] = useState(false);
    const [uploadingProveedores, setUploadingProveedores] = useState(false);
    const [proveedorExcelFeedback, setProveedorExcelFeedback] = useState(null);
    const [productosCriticos, setProductosCriticos] = useState([]);
    const [selectedForBudget, setSelectedForBudget] = useState({});
    const [showProviderSelectionModal, setShowProviderSelectionModal] = useState(false);
    const [pendingBudgetProducts, setPendingBudgetProducts] = useState(null);
    const [selectedProviderForBudget, setSelectedProviderForBudget] = useState('');
    const [showBudgetModal, setShowBudgetModal] = useState(false);
    const [budgetText, setBudgetText] = useState('');
    const [currentProveedor, setCurrentProveedor] = useState(null);
    const [sendingEmail, setSendingEmail] = useState(false);
    const [showProductModal, setShowProductModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [formData, setFormData] = useState({ nombre: '', nombre_en: '', descripcion: '', presentacion: '', peso_kg: '', stock_actual: 0, stock_minimo: 0, stock_maximo: 0, proveedor: '', categoria: '-', costo: 0, precio_venta: 0 });
    const [submitting, setSubmitting] = useState(false);
    const [validationError, setValidationError] = useState('');
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [productToDelete, setProductToDelete] = useState(null);
    const [showMultiDeleteModal, setShowMultiDeleteModal] = useState(false);
    const [selectedProducts, setSelectedProducts] = useState({});
    const [deletingMultipleChem, setDeletingMultipleChem] = useState(false);
    const [formulas, setFormulas] = useState([]);
    const [editingFormula, setEditingFormula] = useState(null);
    const [showFormulaModal, setShowFormulaModal] = useState(false);
    const [selectedQuimico, setSelectedQuimico] = useState(null);
    const [formulaName, setFormulaName] = useState('');
    const [ingredients, setIngredients] = useState([]);
    const [isChemicalBrowserOpen, setIsChemicalBrowserOpen] = useState(false);
    const [isEnvaseBrowserOpen, setIsEnvaseBrowserOpen] = useState(false);
    const [activeIngredientIdx, setActiveIngredientIdx] = useState(null);
    const [showIncompleteModal, setShowIncompleteModal] = useState(false);

    const handleSelectChemical = (chemical) => {
        if (activeIngredientIdx === 'final') {
            setSelectedQuimico(chemical);
            if (!formulaName) {
                setFormulaName(`Fórmula de ${chemical.nombre}`);
            }
        } else if (typeof activeIngredientIdx === 'number') {
            const newIng = [...ingredients];
            
            // Auto-fill capacity if it's an envase
            let defaultCantidad = newIng[activeIngredientIdx].cantidad;
            if (newIng[activeIngredientIdx].is_envase && chemical.presentacion) {
                const match = chemical.presentacion.match(/\d+(\.\d+)?/);
                if (match && match[0]) {
                    defaultCantidad = match[0];
                }
            }

            newIng[activeIngredientIdx] = {
                ...newIng[activeIngredientIdx],
                insumo_id: chemical.id,
                obj: chemical,
                cantidad: defaultCantidad
            };
            setIngredients(newIng);
        }
        setIsChemicalBrowserOpen(false);
        setIsEnvaseBrowserOpen(false);
    };

    const totalPercentage = useMemo(() => {
        return ingredients.reduce((sum, ing) => sum + (parseFloat(ing.cantidad) || 0), 0);
    }, [ingredients]);
    const costoPreparacion = useMemo(() => {
        return ingredients.reduce((sum, ing) => {
            const qty = parseFloat(ing.cantidad) || 0;
            const cost = parseFloat(ing.obj?.costo) || 0;
            if (ing.is_envase) {
                return sum + (qty > 0 ? (cost / qty) : 0);
            }
            return sum + (qty * cost);
        }, 0);
    }, [ingredients]);
    const precioVentaFinal = useMemo(() => {
        return parseFloat(selectedQuimico?.precio_venta) || 0;
    }, [selectedQuimico]);
    const gananciaReceta = precioVentaFinal - costoPreparacion;
    const gananciaPorcentaje = costoPreparacion > 0 ? (gananciaReceta / costoPreparacion) * 100 : 0;
    const [movimientosModal, setMovimientosModal] = useState({ open: false, producto: null, movimientos: [], loading: false, filters: { tipo: '', fecha_desde: '', fecha_hasta: '' }, page: 1, totalPages: 1, exportando: false });
    const [logsModal, setLogsModal] = useState({ open: false, producto: null, logs: [], loading: false });
    const [movimientosGlobal, setMovimientosGlobal] = useState({ open: false, movimientos: [], loading: false, filters: { tipo: '', fecha_desde: '', fecha_hasta: '', articulo_id: '' }, page: 1, totalPages: 1, exportando: false });
    const [movimientoModal, setMovimientoModal] = useState({ open: false, producto: null, tipo: 'INGRESO', cantidad: 1, razon: '' });
    const [registrandoMovimiento, setRegistrandoMovimiento] = useState(false);
    const [criticosSearchTerm, setCriticosSearchTerm] = useState('');
    
    const PRODUCT_DRAFT_KEY = 'draft_inventory_producto';
    const PROVEEDOR_DRAFT_KEY = 'draft_inventory_proveedor';
    
    const showToast = (message, type = 'info') => {
        setToastMessage({ message, type });
        setTimeout(() => setToastMessage(null), 4000);
    };
    
    // Obtener todas las categorías desde el backend
    const fetchCategorias = async () => {
        try {
            const res = await axios.get('/inventario/products/categorias/');
            setAllCategorias(res.data);
        } catch (err) {
            console.error('Error al cargar categorías:', err);
        }
    };
    
    // Debounce para búsqueda
    useEffect(() => {
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = setTimeout(() => {
            if (searchInput !== tableFilters.search) {
                handleTableFilterChange('search', searchInput);
            }
        }, 400);
    }, [searchInput]);
    
    // Autosave
    useEffect(() => {
        if (!editingProduct) localStorage.setItem(PRODUCT_DRAFT_KEY, JSON.stringify(formData));
    }, [formData, editingProduct]);
    useEffect(() => {
        if (!editingProveedor) localStorage.setItem(PROVEEDOR_DRAFT_KEY, JSON.stringify(proveedorForm));
    }, [proveedorForm, editingProveedor]);
    
    // Obtener datos de la tabla
    const fetchTableData = async () => {
        setTableLoading(true);
        try {
            const params = new URLSearchParams({
                page: tableFilters.page,
                page_size: tableFilters.page_size,
                ...(tableFilters.search && { search: tableFilters.search }),
                ...(tableFilters.categoria && { categoria: tableFilters.categoria }),
                ...(tableFilters.ubicacion && { ubicacion: tableFilters.ubicacion }),
                ...(tableFilters.estado && { estado: tableFilters.estado }),
                ...(tableFilters.ordering && { ordering: tableFilters.ordering }),
            });
            const res = await axios.get(`/inventario/products/?${params}`);
            setTableData(res.data);
            setTableError(null);
            // Refrescar categorías después de cada carga (por si hay nuevas)
            fetchCategorias();
        } catch (err) {
            setTableError(err.message);
            showToast('Error al cargar datos', 'error');
        } finally {
            setTableLoading(false);
        }
    };

    const [exportingStock, setExportingStock] = useState(false);
    
    const exportStockData = async () => {
        setExportingStock(true);
        try {
            const params = new URLSearchParams({
                export: 'excel',
                ...(tableFilters.search && { search: tableFilters.search }),
                ...(tableFilters.categoria && { categoria: tableFilters.categoria }),
                ...(tableFilters.ubicacion && { ubicacion: tableFilters.ubicacion }),
                ...(tableFilters.estado && { estado: tableFilters.estado }),
                ...(tableFilters.ordering && { ordering: tableFilters.ordering }),
            });
            const response = await axios.get(`/inventario/products/?${params}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = `inventario_stock.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            showToast('Stock exportado con éxito', 'success');
        } catch (err) {
            showToast('Error al exportar stock', 'error');
        } finally {
            setExportingStock(false);
        }
    };
    
    useEffect(() => {
        if (activeTab === 'todo') {
            fetchTableData();
        }
    }, [activeTab, tableFilters]);
    
    // Cargar categorías al inicio
    useEffect(() => {
        fetchCategorias();
    }, []);
    
    const handleTableFilterChange = (key, value) => {
        setTableFilters(prev => ({ ...prev, [key]: value, page: 1 }));
    };
    
    const handleTableSort = (field) => {
        let ordering = field;
        if (tableFilters.ordering === field) ordering = `-${field}`;
        else if (tableFilters.ordering === `-${field}`) ordering = field;
        setTableFilters(prev => ({ ...prev, ordering, page: 1 }));
    };
    
    const handleTablePageChange = (page) => {
        setTableFilters(prev => ({ ...prev, page }));
    };
    
    const handleRowClick = (product) => {
        setSelectedProduct(product);
        setShowDetailModal(true);
    };
    
    const handleSelectRow = (id) => {
        setSelectedRows(prev => ({ ...prev, [id]: !prev[id] }));
    };
    
    const handleSelectAll = () => {
        const allSelected = tableData.results.length > 0 && tableData.results.every(p => selectedRows[p.id]);
        if (allSelected) {
            setSelectedRows({});
        } else {
            const newSelected = {};
            tableData.results.forEach(p => { newSelected[p.id] = true; });
            setSelectedRows(newSelected);
        }
    };
    
    const handleMultiDeleteTable = async () => {
        const idsToDelete = Object.keys(selectedRows).filter(id => selectedRows[id]);
        if (idsToDelete.length === 0) return;
        if (!window.confirm(`¿Eliminar ${idsToDelete.length} producto(s)?`)) return;
        setDeletingMultiple(true);
        let successCount = 0;
        const results = await Promise.allSettled(idsToDelete.map(id => axios.delete(`/inventario/products/${id}/`)));
        results.forEach(r => { if (r.status === 'fulfilled') successCount++; });
        showToast(`Eliminados: ${successCount}`, successCount > 0 ? 'success' : 'error');
        setSelectedRows({});
        fetchTableData();
        setDeletingMultiple(false);
    };

    const handleDeleteAllProducts = async () => {
        const confirm1 = window.confirm('ATENCIÓN: Esto eliminará TODOS los productos del inventario y sus historiales.\\n¿Está completamente seguro?');
        if (!confirm1) return;
        const confirm2 = window.prompt('Para confirmar, escriba "ELIMINAR TODO" en mayúsculas:');
        if (confirm2 !== 'ELIMINAR TODO') {
            showToast('Eliminación masiva cancelada.', 'info');
            return;
        }
        
        setDeletingMultiple(true);
        try {
            const res = await axios.delete('/inventario/products/delete_all/');
            showToast(res.data.message || 'Todos los productos eliminados con éxito.', 'success');
            setSelectedRows({});
            fetchTableData();
        } catch (err) {
            showToast('Error al eliminar todos los productos.', 'error');
        } finally {
            setDeletingMultiple(false);
        }
    };
    
    const fetchProducts = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/inventario/products/?page_size=10000');
            const data = res.data.results || res.data;
            setProducts(data || []);
            if (activeTab === 'quimicos') await fetchFormulas();
        } catch (err) {
            showToast('Error al cargar datos del inventario.', 'error');
        } finally {
            setLoading(false);
        }
    };
    
    const fetchProveedores = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/inventario/proveedores/');
            setProveedores(res.data);
        } catch (err) {
            showToast('Error al cargar proveedores', 'error');
        } finally {
            setLoading(false);
        }
    };
    
    const fetchFormulas = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/produccion/formulas/');
            setFormulas(res.data);
        } catch (err) {
            console.error('Error fetching formulas:', err);
        } finally {
            setLoading(false);
        }
    };
    
    const calcularProductosCriticos = () => {
        const criticos = products.filter(p => {
            const stock = Number(p.stock_actual);
            const minStock = Number(p.stock_minimo) || 0;
            return stock === 0 || (minStock > 0 && stock <= minStock);
        });
        setProductosCriticos(criticos);
    };
    
    useEffect(() => {
        if (activeTab === 'abastecimiento') calcularProductosCriticos();
    }, [products, activeTab]);
    
    useEffect(() => {
        if (activeTab === 'proveedores') {
            fetchProveedores();
        } else if (activeTab === 'formulas') {
            fetchFormulas();
        } else if (activeTab === 'abastecimiento') {
            fetchProducts();
            fetchProveedores();
        } else if (activeTab !== 'todo') {
            fetchProducts();
        }
    }, [activeTab]);
    
    useEffect(() => {
        if (activeTab !== 'proveedores') return;
        let filtered = proveedores;
        if (searchTerm.trim() !== '') {
            const term = searchTerm.toLowerCase();
            filtered = proveedores.filter(p => 
                p.nombre.toLowerCase().includes(term) ||
                (p.contacto && p.contacto.toLowerCase().includes(term)) ||
                (p.email && p.email.toLowerCase().includes(term)) ||
                (p.rubro && p.rubro.toLowerCase().includes(term))
            );
        }
        setFilteredProveedores(filtered);
    }, [searchTerm, proveedores, activeTab]);
    
    const filteredFormulas = useMemo(() => {
        if (activeTab !== 'formulas') return [];
        let filtered = formulas;
        if (searchTerm.trim() !== '') {
            const term = searchTerm.toLowerCase();
            filtered = formulas.filter(f => 
                f.nombre.toLowerCase().includes(term) ||
                (f.articulo_final_nombre && f.articulo_final_nombre.toLowerCase().includes(term)) ||
                f.componentes.some(c => c.insumo_nombre && c.insumo_nombre.toLowerCase().includes(term))
            );
        }
        return filtered;
    }, [searchTerm, formulas, activeTab]);
    
    const filteredCriticos = productosCriticos.filter(p => !criticosSearchTerm || p.nombre.toLowerCase().includes(criticosSearchTerm.toLowerCase()) || p.presentacion.toLowerCase().includes(criticosSearchTerm.toLowerCase()));
    
    useEffect(() => {
        if (showProductModal || showDeleteModal || showMultiDeleteModal || showFormulaModal || showProveedorModal || showBudgetModal || movimientosModal.open || logsModal.open || movimientosGlobal.open || movimientoModal.open || showDetailModal) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [showProductModal, showDeleteModal, showMultiDeleteModal, showFormulaModal, showProveedorModal, showBudgetModal, movimientosModal.open, logsModal.open, movimientosGlobal.open, movimientoModal.open, showDetailModal]);
    
    // ========== Proveedores (sin cambios) ==========
    const openCreateProveedor = () => {
        setEditingProveedor(null);
        const saved = localStorage.getItem(PROVEEDOR_DRAFT_KEY);
        if (saved) try { setProveedorForm(JSON.parse(saved)); } catch(e) { setProveedorForm({ nombre: '', contacto: '', telefono: '', email: '', direccion: '', rubro: '', condicion_pago: 'contado' }); }
        else setProveedorForm({ nombre: '', contacto: '', telefono: '', email: '', direccion: '', rubro: '', condicion_pago: 'contado' });
        setShowProveedorModal(true);
    };
    const openEditProveedor = (prov) => {
        setEditingProveedor(prov);
        setProveedorForm({ nombre: prov.nombre, contacto: prov.contacto || '', telefono: prov.telefono || '', email: prov.email || '', direccion: prov.direccion || '', rubro: prov.rubro || '', condicion_pago: prov.condicion_pago || 'contado' });
        setShowProveedorModal(true);
    };
    const handleProveedorSubmit = async (e) => {
        e.preventDefault();
        if (!proveedorForm.nombre.trim()) { showToast('El nombre es obligatorio', 'error'); return; }
        setSubmittingProveedor(true);
        try {
            if (editingProveedor) await axios.put(`/inventario/proveedores/${editingProveedor.id}/`, proveedorForm);
            else await axios.post('/inventario/proveedores/', proveedorForm);
            showToast(editingProveedor ? 'Actualizado' : 'Creado', 'success');
            setShowProveedorModal(false);
            localStorage.removeItem(PROVEEDOR_DRAFT_KEY);
            fetchProveedores();
        } catch { showToast('Error al guardar', 'error'); }
        finally { setSubmittingProveedor(false); }
    };
    const deleteProveedor = async (id, nombre) => {
        if (!window.confirm(`¿Eliminar proveedor "${nombre}"?`)) return;
        try { await axios.delete(`/inventario/proveedores/${id}/`); showToast('Eliminado', 'success'); fetchProveedores(); }
        catch { showToast('Error: tiene productos asociados', 'error'); }
    };
    const downloadProveedorTemplate = () => {
        const data = [['nombre', 'contacto', 'telefono', 'email', 'direccion', 'rubro', 'condicion_pago'],
            ['Proveedor Ejemplo S.A.', 'Juan Pérez', '123456789', 'juan@proveedor.com', 'Calle Falsa 123', 'Industrial', 'contado'],
            ['Otro Proveedor', 'María Gómez', '987654321', 'maria@otro.com', '', 'Logística', '30_dias']];
        const wsData = data.map(row => row.join('\t')).join('\n');
        const blob = new Blob([wsData], { type: 'text/tab-separated-values' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'plantilla_proveedores.xls';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showToast('Plantilla descargada', 'success');
    };
    const handleProveedorExcelUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) { showToast('Formato no soportado', 'error'); return; }
        setUploadingProveedores(true);
        const fd = new FormData();
        fd.append('file', file);
        try {
            const res = await axios.post('/inventario/proveedores/upload_excel/', fd);
            setProveedorExcelFeedback({ type: 'success', message: res.data.message, errores: res.data.errores || [] });
            fetchProveedores();
        } catch (err) {
            setProveedorExcelFeedback({ type: 'error', message: err.response?.data?.error || 'Error', errores: [] });
        } finally {
            setUploadingProveedores(false);
            event.target.value = '';
        }
    };
    
    // ========== Abastecimiento ==========
    const toggleSelectForBudget = (productId) => {
        setSelectedForBudget(prev => {
            if (prev[productId]) { const newState = { ...prev }; delete newState[productId]; return newState; }
            else return { ...prev, [productId]: { selected: true, cantidad: 1 } };
        });
    };
    const updateCantidadForBudget = (productId, cantidad) => {
        setSelectedForBudget(prev => ({ ...prev, [productId]: { ...prev[productId], cantidad: parseFloat(cantidad) || 0 } }));
    };
    const handleAskProviderForSelected = () => {
        const selectedIds = Object.keys(selectedForBudget);
        if (selectedIds.length === 0) { showToast('Seleccione al menos un producto', 'error'); return; }
        setPendingBudgetProducts('all-selected');
        setSelectedProviderForBudget('');
        setShowProviderSelectionModal(true);
    };
    const handleAskProviderForProduct = (product) => {
        setPendingBudgetProducts(product);
        setSelectedProviderForBudget('');
        setShowProviderSelectionModal(true);
    };
    const proceedToBudget = () => {
        if (!selectedProviderForBudget) { showToast('Debe seleccionar un proveedor', 'error'); return; }
        const proveedor = proveedores.find(p => String(p.id) === String(selectedProviderForBudget));
        if (!proveedor) return;

        let productos = [];
        if (pendingBudgetProducts === 'all-selected') {
            const selectedIds = Object.keys(selectedForBudget);
            productos = selectedIds.map(id => { const prod = products.find(p => p.id === parseInt(id)); return { ...prod, cantidad: selectedForBudget[id].cantidad }; });
        } else if (pendingBudgetProducts) {
            productos = [{ ...pendingBudgetProducts, cantidad: selectedForBudget[pendingBudgetProducts.id]?.cantidad || 1 }];
        }

        if (productos.length === 0) return;

        const texto = `Solicitud de cotización para ${proveedor.nombre}\n\n` +
            productos.map(p => `- ${p.nombre} (${p.presentacion}): ${p.cantidad} unidad(es) - Stock actual: ${p.stock_actual}, Stock mínimo: ${p.stock_minimo || 'N/A'}, Stock máximo: ${p.stock_maximo || 'N/A'}`).join('\n') +
            `\n\nPor favor, enviar presupuesto a: [tu email]`;
        setBudgetText(texto);
        setCurrentProveedor(proveedor);
        setShowProviderSelectionModal(false);
        setShowBudgetModal(true);
    };
    const handleSendDirectEmail = async () => {
        if (!currentProveedor?.email) {
            showToast('El proveedor no tiene un email configurado', 'error');
            return;
        }
        setSendingEmail(true);
        try {
            await axios.post('/correos/inbox/send_email/', {
                subject: 'Solicitud de Presupuesto',
                body: budgetText,
                recipient: currentProveedor.email,
                operacion_id: ''
            });
            showToast('Email encolado para envío correctamente', 'success');
            setShowBudgetModal(false);
        } catch (err) {
            console.error("Error al enviar email:", err);
            showToast('Error al enviar el email', 'error');
        } finally {
            setSendingEmail(false);
        }
    };
    const copyBudgetToClipboard = () => { navigator.clipboard.writeText(budgetText); showToast('Copiado', 'success'); };
    
    // ========== CRUD Productos (sin cambios) ==========
    const openCreateModal = () => {
        setEditingProduct(null);
        let defaultCategoria = activeTab === 'quimicos' ? 'quimicos' : 'otros';
        const saved = localStorage.getItem(PRODUCT_DRAFT_KEY);
        if (saved) try { const draft = JSON.parse(saved); setFormData({ ...draft, categoria: draft.categoria || defaultCategoria, stock_maximo: draft.stock_maximo || 0 }); }
        catch(e) { setFormData({ nombre: '', nombre_en: '', descripcion: '', presentacion: '', peso_kg: '', stock_actual: 0, stock_minimo: 0, stock_maximo: 0, proveedor: '', categoria: defaultCategoria, costo: 0, precio_venta: 0 }); }
        else setFormData({ nombre: '', nombre_en: '', descripcion: '', presentacion: '', peso_kg: '', stock_actual: 0, stock_minimo: 0, stock_maximo: 0, proveedor: '', categoria: defaultCategoria });
        setValidationError('');
        setShowProductModal(true);
    };
    const openEditModal = (product) => {
        setEditingProduct(product);
        setFormData({
            nombre: product.nombre,
            nombre_en: product.nombre_en || '',
            descripcion: product.descripcion || '',
            presentacion: product.presentacion,
            peso_kg: product.peso_kg !== null ? Number(product.peso_kg).toFixed(2) : '',
            stock_actual: product.stock_actual !== null ? Number(product.stock_actual).toFixed(2) : 0,
            stock_minimo: product.stock_minimo !== null ? Number(product.stock_minimo).toFixed(2) : 0,
            stock_maximo: product.stock_maximo !== null ? Number(product.stock_maximo).toFixed(2) : 0,
            proveedor: product.proveedor || '',
            categoria: product.categoria || 'otros',
            costo: product.costo !== null ? Number(product.costo).toFixed(2) : 0,
            precio_venta: product.precio_venta !== null ? Number(product.precio_venta).toFixed(2) : 0
        });
        setValidationError('');
        setShowProductModal(true);
    };
    const handleProductSubmit = async (e) => {
        e.preventDefault();
        setValidationError('');
        if (!formData.nombre.trim() || !formData.presentacion.trim()) { setValidationError('Nombre y presentación obligatorios'); return; }
        const peso = parseFloat(formData.peso_kg);
        if (isNaN(peso) || peso <= 0) { setValidationError('Peso debe ser >0'); return; }
        const stockMinimo = parseFloat(formData.stock_minimo);
        if (isNaN(stockMinimo) || stockMinimo < 0) { setValidationError('Stock mínimo no negativo'); return; }
        const stockMaximo = parseFloat(formData.stock_maximo);
        if (isNaN(stockMaximo) || stockMaximo < 0) { setValidationError('Stock máximo no negativo'); return; }
        if (stockMaximo > 0 && stockMinimo > stockMaximo) { setValidationError('Stock mínimo no puede ser mayor que stock máximo'); return; }
        setSubmitting(true);
        try {
            const payload = {
                nombre: formData.nombre.trim(),
                nombre_en: formData.nombre_en ? formData.nombre_en.trim() : '',
                descripcion: formData.descripcion || '',
                presentacion: formData.presentacion.trim(),
                categoria: formData.categoria,
                peso_kg: peso,
                stock_actual: Number(formData.stock_actual) || 0,
                stock_minimo: stockMinimo,
                stock_maximo: stockMaximo,
                proveedor: formData.proveedor || null,
                costo: parseFloat(formData.costo) || 0,
                precio_venta: parseFloat(formData.precio_venta) || 0,
            };
            if (editingProduct) await axios.put(`/inventario/products/${editingProduct.id}/`, payload);
            else await axios.post('/inventario/products/', payload);
            showToast(editingProduct ? 'Actualizado' : 'Creado', 'success');
            setShowProductModal(false);
            localStorage.removeItem(PRODUCT_DRAFT_KEY);
            if (activeTab === 'todo' || activeTab === 'productos') fetchTableData();
            else fetchProducts();
        } catch { setValidationError('Error de red o validación'); }
        finally { setSubmitting(false); }
    };
    const confirmDelete = (product) => { setProductToDelete(product); setShowDeleteModal(true); };
    const handleDelete = async () => {
        if (!productToDelete) return;
        setSubmitting(true);
        try { await axios.delete(`/inventario/products/${productToDelete.id}/`); setShowDeleteModal(false); if (activeTab === 'todo' || activeTab === 'productos') fetchTableData(); else fetchProducts(); showToast('Eliminado', 'success'); }
        catch { showToast('Error al eliminar (posibles movimientos asociados)', 'error'); }
        finally { setSubmitting(false); }
    };
    const openMultiDeleteModal = () => {
        const initialSelection = {};
        filteredProducts.forEach(p => initialSelection[p.id] = false);
        setSelectedProducts(initialSelection);
        setShowMultiDeleteModal(true);
    };
    const toggleSelectProduct = (productId) => setSelectedProducts(prev => ({ ...prev, [productId]: !prev[productId] }));
    const toggleSelectAllChem = () => {
        const allSelected = Object.values(selectedProducts).every(v => v === true);
        const newSelection = {};
        Object.keys(selectedProducts).forEach(id => newSelection[id] = !allSelected);
        setSelectedProducts(newSelection);
    };
    const handleMultiDeleteChem = async () => {
        const idsToDelete = Object.keys(selectedProducts).filter(id => selectedProducts[id]);
        if (idsToDelete.length === 0) return;
        if (!window.confirm(`¿Eliminar ${idsToDelete.length} item(s)?`)) return;
        setDeletingMultipleChem(true);
        let successCount = 0;
        const results = await Promise.allSettled(idsToDelete.map(id => axios.delete(`/inventario/products/${id}/`)));
        results.forEach(r => { if (r.status === 'fulfilled') successCount++; });
        showToast(`Eliminados: ${successCount}`, successCount > 0 ? 'success' : 'error');
        setShowMultiDeleteModal(false);
        fetchProducts();
        setDeletingMultipleChem(false);
    };
    
    // ========== Importación de Excel ==========
    const downloadStandardTemplate = () => {
        const columnas = ['nombre', 'categoria', 'cantidad', 'unidad', 'ubicacion', 'estado', 'serie_lote', 'observaciones', 'min', 'max'];
        const ejemplo = ['Cloro 100%', 'quimicos', 1000, 'L', 'Depósito Químicos', 'Bueno', 'LOTE-001', 'Producto líquido', 10, 500];
        const data = [columnas, ejemplo];
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, 'StockTemplate');
        XLSX.writeFile(wb, 'plantilla_stock_estandar.xlsx');
    };
    
    const handleExcelUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        setUploadingExcel(true);
        const fd = new FormData();
        fd.append('file', file);
        try {
            const res = await axios.post('/inventario/products/upload_excel/', fd);
            setExcelFeedback({ type: 'success', message: `${res.data.creados} creados, ${res.data.actualizados} actualizados.`, errors: res.data.errores });
            if (activeTab === 'todo' || activeTab === 'productos') fetchTableData();
            else fetchProducts();
        } catch (err) {
            setExcelFeedback({ type: 'error', message: err.response?.data?.error || 'Error en archivo excel.', errors: [] });
        } finally {
            setUploadingExcel(false);
            event.target.value = '';
        }
    };
    
    // ========== Fórmulas BOM ==========
    const openCreateFormula = () => {
        setEditingFormula(null);
        setSelectedQuimico(null);
        setFormulaName('');
        setIngredients([]);
        setShowFormulaModal(true);
    };
    
    const openEditFormula = (formula) => {
        setEditingFormula(formula);
        setSelectedQuimico({ id: formula.articulo_final_id, nombre: formula.articulo_final_nombre });
        setFormulaName(formula.nombre);
        setIngredients(formula.componentes.map(c => {
            const is_envase = c.insumo_categoria === 'Empaque';
            return {
                insumo_id: c.insumo_id,
                is_envase: is_envase,
                cantidad: is_envase ? Number(1 / parseFloat(c.cantidad_requerida)).toFixed(0) : Number(parseFloat(c.cantidad_requerida).toFixed(2)).toString(),
                obj: { id: c.insumo_id, nombre: c.insumo_nombre, presentacion: c.insumo_presentacion || '', costo: c.insumo_costo, categoria: c.insumo_categoria }
            };
        }));
        setShowFormulaModal(true);
    };

    const saveFormula = async () => {
        if (!formulaName || ingredients.length === 0) {
            showToast('Nombre e ingredientes requeridos', 'error');
            return;
        }
        if (!selectedQuimico) {
            showToast('Debe seleccionar el artículo final', 'error');
            return;
        }
        
        const invalidIng = ingredients.some(ing => !ing.insumo_id || isNaN(parseFloat(ing.cantidad)) || parseFloat(ing.cantidad) <= 0);
        if (invalidIng) {
            showToast('Todos los ingredientes deben tener cantidad válida mayor a cero', 'error');
            return;
        }



        const payload = {
            nombre: formulaName,
            articulo_final_id: selectedQuimico.id,
            activa: true,
            componentes: ingredients.map(ing => ({
                insumo_id: ing.insumo_id,
                cantidad_requerida: ing.is_envase ? (1 / parseFloat(ing.cantidad)) : parseFloat(ing.cantidad)
            }))
        };
        setSubmitting(true);
        try {
            if (editingFormula) {
                await axios.put(`/produccion/formulas/${editingFormula.id}/`, payload);
            } else {
                await axios.post('/produccion/formulas/', payload);
            }
            showToast('Fórmula guardada correctamente', 'success');
            setShowFormulaModal(false);
            fetchFormulas();
        } catch (err) {
            const errorMsg = err.response?.data?.articulo_final_id || err.response?.data?.componentes || 'Error al guardar la fórmula';
            showToast(Array.isArray(errorMsg) ? errorMsg[0] : errorMsg, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const deleteFormula = async (id) => {
        if (!window.confirm("¿Está seguro de eliminar esta fórmula?")) return;
        try {
            await axios.delete(`/produccion/formulas/${id}/`);
            showToast("Fórmula eliminada con éxito", "success");
            fetchFormulas();
        } catch {
            showToast("Error al eliminar la fórmula", "error");
        }
    };
    
    // ========== Movimientos y Logs (sin cambios) ==========
    const fetchMovimientos = async (productoId, page = 1, filters = {}) => {
        setMovimientosModal(prev => ({ ...prev, loading: true }));
        try {
            const params = new URLSearchParams({ page, page_size: 20, ...filters });
            if (productoId) params.append('articulo_id', productoId);
            const res = await axios.get(`/inventario/products/movimientos/?${params.toString()}`);
            setMovimientosModal(prev => ({
                ...prev,
                movimientos: res.data.results || [],
                totalPages: res.data.total_pages || 1,
                page: res.data.page || 1,
                loading: false,
                filters: { ...prev.filters, ...filters }
            }));
        } catch (err) { showToast('Error al cargar movimientos', 'error'); setMovimientosModal(prev => ({ ...prev, loading: false })); }
    };
    const openMovimientosModal = (producto) => {
        setMovimientosModal({ open: true, producto, movimientos: [], loading: true, filters: { tipo: '', fecha_desde: '', fecha_hasta: '' }, page: 1, totalPages: 1, exportando: false });
        fetchMovimientos(producto.id, 1, { tipo: '', fecha_desde: '', fecha_hasta: '' });
    };
    const exportMovimientos = async (productoId, format) => {
        setMovimientosModal(prev => ({ ...prev, exportando: true }));
        try {
            const params = new URLSearchParams({ export: format });
            if (productoId) params.append('articulo_id', productoId);
            const response = await axios.get(`/inventario/products/movimientos/?${params.toString()}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = `movimientos_${productoId || 'todos'}.${format === 'csv' ? 'csv' : 'xlsx'}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            showToast('Descarga iniciada', 'success');
        } catch { showToast('Error al exportar', 'error'); }
        finally { setMovimientosModal(prev => ({ ...prev, exportando: false })); }
    };
    const fetchLogs = async (productoId) => {
        setLogsModal(prev => ({ ...prev, loading: true }));
        try {
            const res = await axios.get(`/inventario/products/logs/?producto_id=${productoId}`);
            setLogsModal({ open: true, producto: products.find(p => p.id === productoId), logs: res.data, loading: false });
        } catch { showToast('Error al cargar logs', 'error'); setLogsModal(prev => ({ ...prev, loading: false })); }
    };
    const openMovimientosGlobal = async (page = 1) => {
        setMovimientosGlobal(prev => ({ ...prev, loading: true }));
        try {
            const params = new URLSearchParams({ page, page_size: 50 });
            if (movimientosGlobal.filters.tipo) params.append('tipo', movimientosGlobal.filters.tipo);
            if (movimientosGlobal.filters.fecha_desde) params.append('fecha_desde', movimientosGlobal.filters.fecha_desde);
            if (movimientosGlobal.filters.fecha_hasta) params.append('fecha_hasta', movimientosGlobal.filters.fecha_hasta);
            if (movimientosGlobal.filters.articulo_id) params.append('articulo_id', movimientosGlobal.filters.articulo_id);
            const res = await axios.get(`/inventario/products/movimientos/?${params.toString()}`);
            setMovimientosGlobal(prev => ({
                ...prev,
                movimientos: res.data.results || [],
                totalPages: res.data.total_pages || 1,
                page: res.data.page || 1,
                loading: false
            }));
        } catch { showToast('Error al cargar movimientos', 'error'); setMovimientosGlobal(prev => ({ ...prev, loading: false })); }
    };
    
    const registrarMovimiento = async () => {
        if (!movimientoModal.producto) return;
        if (movimientoModal.cantidad <= 0) {
            showToast('La cantidad debe ser mayor a cero', 'error');
            return;
        }
        if (!movimientoModal.razon.trim()) {
            showToast('Debe ingresar una razón', 'error');
            return;
        }
        setRegistrandoMovimiento(true);
        try {
            await axios.post('/inventario/products/movimiento/', {
                articulo: movimientoModal.producto.id,
                tipo: movimientoModal.tipo,
                cantidad: movimientoModal.cantidad,
                razon: movimientoModal.razon,
                operacion_id: null,
            });
            showToast('Movimiento registrado correctamente', 'success');
            setMovimientoModal({ open: false, producto: null, tipo: 'INGRESO', cantidad: 1, razon: '' });
            if (activeTab === 'todo' || activeTab === 'productos') fetchTableData();
            else fetchProducts();
        } catch (err) {
            console.error(err);
            showToast(err.response?.data?.error || 'Error al registrar movimiento', 'error');
        } finally {
            setRegistrandoMovimiento(false);
        }
    };
    
    const getCardColorClass = (product) => {
        const stock = Number(product.stock_actual);
        const minStock = Number(product.stock_minimo) || 0;
        const maxStock = Number(product.stock_maximo) || 0;
        if (stock === 0) return 'bg-red-50 dark:bg-red-900/20';
        if (minStock > 0 && stock > 0 && stock <= minStock) return 'bg-yellow-50 dark:bg-yellow-900/20';
        if (maxStock > 0 && stock >= maxStock) return 'bg-orange-50';
        return 'bg-white';
    };
    const getStockBarColor = (product) => {
        const stock = Number(product.stock_actual);
        const minStock = Number(product.stock_minimo) || 0;
        const maxStock = Number(product.stock_maximo) || 0;
        if (stock === 0) return 'bg-red-500';
        if (minStock > 0 && stock > 0 && stock <= minStock) return 'bg-amber-400';
        if (maxStock > 0 && stock >= maxStock) return 'bg-orange-400';
        return 'bg-emerald-500';
    };
    const getCardBorderColor = (product) => {
        const stock = Number(product.stock_actual);
        const minStock = Number(product.stock_minimo) || 0;
        const maxStock = Number(product.stock_maximo) || 0;
        if (stock === 0) return 'border-red-200';
        if (minStock > 0 && stock > 0 && stock <= minStock) return 'border-amber-200';
        if (maxStock > 0 && stock >= maxStock) return 'border-orange-200';
        return 'border-emerald-200';
    };
    
    const selectedCountChem = Object.values(selectedProducts).filter(v => v === true).length;
    const selectedBudgetCount = Object.keys(selectedForBudget).length;
    const selectedRowsCount = Object.values(selectedRows).filter(v => v === true).length;
    
    const condicionPagoOptions = [
        { value: 'contado', label: 'Contado' },
        { value: '30_dias', label: '30 Días' },
        { value: '60_dias', label: '60 Días' },
        { value: '90_dias', label: '90 Días' },
        { value: 'otros', label: 'Otros' },
    ];
    const categoriaOptions = [
        { value: 'otros', label: 'Insumos / Otros' },
        { value: 'quimicos', label: 'Químicos' },
        { value: 'anclas', label: 'Anclas' },
        { value: 'cadenas', label: 'Cadenas' },
        { value: 'accesorios_cadena', label: 'Accesorios de cadena' },
        { value: 'insumos', label: 'Insumos generales' },
    ];
    
    return (
        <div className="animate-fadeIn pb-12">
            {toastMessage && (
                <div className={`fixed top-20 right-4 z-50 px-4 py-3 rounded-xl shadow-lg border flex items-center gap-3 animate-fadeIn ${toastMessage.type === 'error' ? 'bg-red-50 dark:bg-red-900/20 text-red-800 border-red-200' : 'bg-green-50 dark:bg-green-900/20 text-green-800 border-green-200'}`}>
                    <i className={`bi ${toastMessage.type === 'error' ? 'bi-x-circle-fill' : 'bi-check-circle-fill'} text-lg`}></i>
                    <span className="font-bold text-sm tracking-tight">{toastMessage.message}</span>
                </div>
            )}
            
            {/* Tabs */}
            <div className="border-b border-gray-200 mb-6">
                <nav className="tour-inv-tabs -mb-px flex space-x-8 overflow-x-auto">
                    <button onClick={() => { setActiveTab('todo'); setSearchTerm(''); }} className={`py-4 px-1 text-center border-b-2 font-medium text-sm transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'todo' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                        <i className="bi bi-database-fill text-lg"></i> Todos los artículos
                    </button>
                    <button onClick={() => { setActiveTab('formulas'); setSearchTerm(''); }} className={`py-4 px-1 text-center border-b-2 font-medium text-sm transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'formulas' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                        <i className="bi bi-flask-fill text-lg"></i> Fórmulas de producción
                    </button>
                    <button onClick={() => { setActiveTab('proveedores'); setSearchTerm(''); }} className={`py-4 px-1 text-center border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${activeTab === 'proveedores' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                        <i className="bi bi-people-fill text-lg"></i> Proveedores
                    </button>
                    <button onClick={() => { setActiveTab('abastecimiento'); setSearchTerm(''); setCriticosSearchTerm(''); }} className={`py-4 px-1 text-center border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${activeTab === 'abastecimiento' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                        <i className="bi bi-truck text-lg"></i> Abastecimiento
                    </button>
                </nav>
            </div>
            
            {/* Top Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">
                        {activeTab === 'todo' && 'Inventario completo'}
                        {activeTab === 'formulas' && 'Fórmulas de producción (BOM)'}
                        {activeTab === 'proveedores' && 'Gestión de Proveedores'}
                        {activeTab === 'abastecimiento' && 'Productos para Abastecer'}
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                        {activeTab === 'todo' && 'Catálogo general de insumos, herramientas y materias primas.'}
                        {activeTab === 'formulas' && 'Gestione las recetas de fabricación para sus compuestos químicos.'}
                        {activeTab === 'proveedores' && 'Administre la información de contacto y condiciones de sus proveedores.'}
                        {activeTab === 'abastecimiento' && 'Monitoree artículos con stock crítico y genere cotizaciones.'}
                    </p>
                </div>
                <div className="tour-inv-actions flex gap-2 w-full sm:w-auto flex-wrap">
                    {activeTab === 'todo' && (
                        <>
                            <label className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-xl shadow-sm text-gray-700 bg-white dark:bg-slate-800 hover:bg-gray-50 cursor-pointer">
                                {uploadingExcel ? 'Subiendo...' : <><i className="bi bi-file-earmark-spreadsheet mr-1 text-green-600"></i> Importar Excel</>}
                                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelUpload} disabled={uploadingExcel} />
                            </label>
                            <button
                                onClick={exportStockData}
                                disabled={exportingStock}
                                className="inline-flex items-center px-4 py-2 border border-emerald-300 text-sm font-medium rounded-xl shadow-sm text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:bg-emerald-900/30 disabled:opacity-50"
                            >
                                {exportingStock ? 'Descargando...' : <><i className="bi bi-file-earmark-excel mr-1 text-emerald-600"></i> Exportar Excel</>}
                            </button>
                            <button
                                onClick={() => setShowIncompleteModal(true)}
                                className="inline-flex items-center px-4 py-2 border border-orange-300 text-sm font-medium rounded-xl shadow-sm text-orange-700 bg-orange-50 hover:bg-orange-100"
                            >
                                <i className="bi bi-exclamation-triangle mr-1 text-orange-600"></i> Faltan datos
                            </button>
                            <div className="flex rounded-xl shadow-sm" role="group">
                                <button
                                    onClick={handleMultiDeleteTable}
                                    disabled={selectedRowsCount === 0 || deletingMultiple}
                                    className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-l-xl text-red-700 bg-white dark:bg-slate-800 hover:bg-red-50 dark:bg-red-900/20 disabled:opacity-50"
                                >
                                    {deletingMultiple ? 'Borrando...' : <><i className="bi bi-trash mr-1"></i> Borrar seleccionados ({selectedRowsCount})</>}
                                </button>
                                <button
                                    onClick={handleDeleteAllProducts}
                                    disabled={deletingMultiple}
                                    className="inline-flex items-center px-3 py-2 border border-l-0 border-red-300 text-sm font-bold rounded-r-xl text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                                    title="Borrar TODOS los productos del inventario"
                                >
                                    Borrar TODO
                                </button>
                            </div>
                            <button onClick={downloadStandardTemplate} className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-lg shadow-sm text-gray-700 bg-white dark:bg-slate-800 hover:bg-gray-50">
                                <i className="bi bi-download mr-1 text-emerald-600"></i> Plantilla Excel
                            </button>
                            <button onClick={openCreateModal} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-indigo-600 hover:bg-indigo-700">
                                <i className="bi bi-plus-lg mr-1"></i> Nuevo artículo
                            </button>
                        </>
                    )}
                    {activeTab === 'formulas' && (
                        <button onClick={openCreateFormula} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-indigo-600 hover:bg-indigo-700">
                            <i className="bi bi-plus-lg mr-1"></i> Nueva fórmula
                        </button>
                    )}
                    {activeTab === 'proveedores' && (
                        <>
                            <button onClick={downloadProveedorTemplate} className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-xl shadow-sm text-gray-700 bg-white dark:bg-slate-800 hover:bg-gray-50">
                                <i className="bi bi-download mr-1 text-emerald-600"></i> Descargar plantilla
                            </button>
                            <label className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-xl shadow-sm text-gray-700 bg-white dark:bg-slate-800 hover:bg-gray-50 cursor-pointer">
                                {uploadingProveedores ? 'Subiendo...' : <><i className="bi bi-file-earmark-spreadsheet mr-1 text-green-600"></i> Cargar Excel</>}
                                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleProveedorExcelUpload} disabled={uploadingProveedores} />
                            </label>
                            <button onClick={openCreateProveedor} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-indigo-600 hover:bg-indigo-700">
                                <i className="bi bi-plus-lg mr-1"></i> Nuevo Proveedor
                            </button>
                        </>
                    )}
                </div>
            </div>
            
            {/* Feedback */}
            {proveedorExcelFeedback && (
                <div className={`mb-4 p-3 rounded-md ${proveedorExcelFeedback.type === 'success' ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                    <p className="text-sm font-medium">{proveedorExcelFeedback.message}</p>
                    {proveedorExcelFeedback.errores?.length > 0 && (
                        <ul className="mt-1 text-xs text-red-600 list-disc list-inside">
                            {proveedorExcelFeedback.errores.slice(0, 5).map((err, i) => <li key={i}>{err}</li>)}
                        </ul>
                    )}
                </div>
            )}
            {excelFeedback && (
                <div className={`mb-4 p-3 rounded-md ${excelFeedback.type === 'success' ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                    <p className="text-sm font-medium">{excelFeedback.message}</p>
                    {excelFeedback.errors?.length > 0 && (
                        <ul className="mt-1 text-xs text-red-600 list-disc list-inside">
                            {excelFeedback.errors.slice(0, 5).map((err, i) => <li key={i}>{err}</li>)}
                        </ul>
                    )}
                </div>
            )}
            
            {/* Search solo para las pestañas que lo usan */}
            {(activeTab === 'proveedores' || activeTab === 'abastecimiento' || activeTab === 'formulas') && (
                <div className="mb-6 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><i className="bi bi-search text-gray-400"></i></div>
                    <input type="text" placeholder={activeTab === 'proveedores' ? 'Buscar proveedor...' : activeTab === 'abastecimiento' ? 'Buscar producto crítico...' : 'Buscar fórmulas...'}
                        value={activeTab === 'abastecimiento' ? criticosSearchTerm : searchTerm}
                        onChange={(e) => { if (activeTab === 'abastecimiento') setCriticosSearchTerm(e.target.value); else setSearchTerm(e.target.value); }}
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-xl bg-white focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                </div>
            )}
            
            {/* ========== VISTA TABLA PARA 'todo' ========== */}
            {activeTab === 'todo' && (
                <>
                    <IncompleteProductsModal 
                        isOpen={showIncompleteModal} 
                        onClose={() => setShowIncompleteModal(false)} 
                        onEdit={(p) => { setShowIncompleteModal(false); openEditModal(p); }} 
                        onRowClick={(p) => { setShowIncompleteModal(false); handleRowClick(p); }} 
                    />
                    <div className="flex justify-end mb-2">
                        <button
                            onClick={() => setViewMode(viewMode === 'table' ? 'cards' : 'table')}
                            className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white dark:bg-slate-800 hover:bg-gray-50"
                        >
                            {viewMode === 'table' ? (
                                <><i className="bi bi-grid-3x3-gap-fill mr-1"></i> Vista tarjetas</>
                            ) : (
                                <><i className="bi bi-table mr-1"></i> Vista tabla</>
                            )}
                        </button>
                    </div>
                    {viewMode === 'table' ? (
                        <StockTableView
                            products={tableData.results}
                            loading={tableLoading}
                            error={tableError}
                            filters={tableFilters}
                            onFilterChange={handleTableFilterChange}
                            onSort={handleTableSort}
                            onPageChange={handleTablePageChange}
                            totalCount={tableData.count}
                            onEdit={openEditModal}
                            onDelete={confirmDelete}
                            onMovimiento={(product) => setMovimientoModal({ open: true, producto: product, tipo: 'INGRESO', cantidad: 1, razon: '' })}
                            onLogs={fetchLogs}
                            onRowClick={handleRowClick}
                            onSelectRow={handleSelectRow}
                            selectedRows={selectedRows}
                            onSelectAll={handleSelectAll}
                            allSelected={tableData.results.length > 0 && tableData.results.every(p => selectedRows[p.id])}
                            allCategorias={allCategorias}
                        />
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {tableData.results.map(product => (
                                <ProductCard
                                    key={product.id}
                                    product={product}
                                    onEdit={openEditModal}
                                    onDelete={confirmDelete}
                                    onMovimiento={(p) => setMovimientoModal({ open: true, producto: p, tipo: 'INGRESO', cantidad: 1, razon: '' })}
                                    onLogs={fetchLogs}
                                    onRowClick={handleRowClick}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}
            
            {/* ========== LISTADO DE FÓRMULAS ========== */}
            {activeTab === 'formulas' && (
                <>
                    {loading ? (
                        <div className="flex justify-center py-20"><LogoSpinner size="w-12 h-12" /></div>
                    ) : (
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                    <thead className="bg-gray-50 dark:bg-slate-700/50">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-slate-300 uppercase tracking-wider">Nombre de la Receta</th>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-slate-300 uppercase tracking-wider">Artículo Final (Producto)</th>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-slate-300 uppercase tracking-wider">Ingredientes (BOM)</th>
                                            <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 dark:text-slate-300 uppercase tracking-wider">Costo Prep.</th>
                                            <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 dark:text-slate-300 uppercase tracking-wider">Precio Venta</th>
                                            <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 dark:text-slate-300 uppercase tracking-wider">Ganancia</th>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-slate-300 uppercase tracking-wider">Estado</th>
                                            <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 dark:text-slate-300 uppercase tracking-wider">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                                        {filteredFormulas.map(formula => (
                                            <tr key={formula.id} className="hover:bg-gray-50 dark:bg-slate-900/50 dark:hover:bg-slate-700/30 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white">{formula.nombre}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-slate-300">
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400">
                                                        <i className="bi bi-flask-fill"></i>
                                                        {formula.articulo_final_nombre}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-600 dark:text-slate-300">
                                                    <div className="flex flex-wrap gap-1.5 max-w-md">
                                                        {formula.componentes && formula.componentes.length > 0 ? (
                                                            formula.componentes.map((c, i) => (
                                                                <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-600">
                                                                    {c.insumo_nombre}: <strong className="ml-1 text-slate-900 dark:text-white">{c.cantidad_requerida} kg</strong>
                                                                </span>
                                                            ))
                                                        ) : (
                                                            <span className="text-xs text-gray-400 italic">Sin ingredientes definidos</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-600 dark:text-slate-300 text-right font-medium">
                                                    ${parseFloat(formula.costo_preparacion || 0).toFixed(2)}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-600 dark:text-slate-300 text-right font-medium">
                                                    ${parseFloat(formula.precio_venta || 0).toFixed(2)}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className={`font-bold ${parseFloat(formula.ganancia || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                            ${parseFloat(formula.ganancia || 0).toFixed(2)}
                                                        </span>
                                                        <span className={`text-[10px] font-bold ${parseFloat(formula.ganancia || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                            {parseFloat(formula.ganancia_porcentaje || 0).toFixed(2)}%
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                    {formula.activa ? (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 border border-green-200 dark:border-green-800">
                                                            Activa
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                                                            Inactiva
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                                                    <button onClick={() => openEditFormula(formula)} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 mr-4 font-bold">
                                                        <i className="bi bi-pencil-square mr-1"></i>Editar
                                                    </button>
                                                    <button onClick={() => deleteFormula(formula.id)} className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 font-bold">
                                                        <i className="bi bi-trash mr-1"></i>Eliminar
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                    {filteredFormulas.length === 0 && !loading && (
                        <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-gray-300 dark:border-slate-700">
                            <i className="bi bi-flask text-4xl text-gray-300 dark:text-slate-600 mb-3 block"></i>
                            <p className="text-gray-500 dark:text-slate-400">No se encontraron fórmulas de producción.</p>
                        </div>
                    )}
                </>
            )}
            
            {/* ========== LISTADO DE PROVEEDORES ========== */}
            {activeTab === 'proveedores' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {filteredProveedores.map(prov => {
                        const condicionLabel = condicionPagoOptions.find(o => o.value === prov.condicion_pago)?.label || prov.condicion_pago;
                        return (
                            <div key={prov.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden hover:shadow-lg transition-shadow">
                                <div className="p-5">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{prov.nombre}</h3>
                                        <div className="flex gap-1">
                                            <button onClick={() => openEditProveedor(prov)} className="text-indigo-300 hover:text-indigo-600"><i className="bi bi-pencil-square"></i></button>
                                            <button onClick={() => deleteProveedor(prov.id, prov.nombre)} className="text-red-300 hover:text-red-600"><i className="bi bi-trash"></i></button>
                                        </div>
                                    </div>
                                    {prov.contacto && <p className="text-sm text-gray-600"><span className="font-semibold">Contacto:</span> {prov.contacto}</p>}
                                    {prov.telefono && <p className="text-sm text-gray-600"><span className="font-semibold">Teléfono:</span> {prov.telefono}</p>}
                                    {prov.email && <p className="text-sm text-gray-600"><span className="font-semibold">Email:</span> {prov.email}</p>}
                                    {prov.direccion && <p className="text-sm text-gray-600"><span className="font-semibold">Dirección:</span> {prov.direccion}</p>}
                                    {prov.rubro && <p className="text-sm text-gray-600"><span className="font-semibold">Rubro:</span> {prov.rubro}</p>}
                                    <p className="text-sm text-gray-600"><span className="font-semibold">Condición de pago:</span> {condicionLabel}</p>
                                </div>
                            </div>
                        );
                    })}
                    {filteredProveedores.length === 0 && !loading && <div className="col-span-full text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-gray-300"><p className="text-gray-500">No hay proveedores registrados.</p></div>}
                </div>
            )}
            
            {/* ========== ABASTECIMIENTO ========== */}
            {activeTab === 'abastecimiento' && (
                <>
                    {loading ? <div className="flex justify-center py-20"><LogoSpinner size="w-12 h-12" /></div> :
                        <>
                            {selectedBudgetCount > 0 && (
                                <div className="mb-4 p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex justify-between items-center border border-indigo-100">
                                    <span className="text-sm font-medium text-indigo-800">{selectedBudgetCount} producto(s) seleccionado(s)</span>
                                    <button onClick={handleAskProviderForSelected} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm">Solicitar presupuesto</button>
                                </div>
                            )}
                            <div className="grid grid-cols-1 gap-4">
                                {filteredCriticos.map(product => {
                                    const stockNum = Number(product.stock_actual);
                                    const minStockNum = Number(product.stock_minimo) || 0;
                                    const isSelected = !!selectedForBudget[product.id];
                                    const cantidad = selectedForBudget[product.id]?.cantidad || 1;
                                    return (
                                        <div key={product.id} className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border overflow-hidden transition-shadow ${isSelected ? 'border-indigo-300 dark:border-indigo-500 ring-1 ring-indigo-300' : 'border-gray-200 dark:border-slate-700'}`}>
                                            <div className="p-5">
                                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                                    <div className="flex-1">
                                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{product.nombre}</h3>
                                                        <div className="text-sm text-gray-500 mt-1"><p>Presentación: {product.presentacion}</p><p>Peso Base: {parseFloat(product.peso_kg).toFixed(2)} kg</p></div>
                                                    </div>
                                                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                                                        <div className="flex gap-4 items-center">
                                                            <div className="text-center"><span className="text-xs text-gray-500">Stock actual</span><p className={`font-bold ${stockNum === 0 ? 'text-red-600' : 'text-yellow-600'}`}>{stockNum}</p></div>
                                                            {minStockNum > 0 && <div className="text-center"><span className="text-xs text-gray-500">Stock mínimo</span><p className="font-bold text-gray-700">{minStockNum}</p></div>}
                                                        </div>
                                                        <div className="w-32"><label className="block text-xs text-gray-500">Cantidad</label><input type="number" min="0" step="1" value={cantidad} onChange={(e) => updateCantidadForBudget(product.id, e.target.value)} className="w-full px-2 py-1 border rounded text-center" /></div>
                                                        <div className="flex items-end gap-2">
                                                            <button onClick={() => toggleSelectForBudget(product.id)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isSelected ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-slate-800/50 text-gray-700 hover:bg-gray-200'}`}>{isSelected ? 'Seleccionado' : 'Seleccionar'}</button>
                                                            <button onClick={() => handleAskProviderForProduct(product)} className="px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-200"><i className="bi bi-envelope-paper me-1"></i>Presupuesto</button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            {filteredCriticos.length === 0 && !loading && <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-dashed"><p>No hay productos con stock crítico.</p></div>}
                        </>
                    }
                </>
            )}
            
            {/* ===== MODALES (sin cambios) ===== */}
            {showProveedorModal && createPortal(
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowProveedorModal(false)}>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50 dark:bg-slate-900/20"><h3 className="text-lg font-bold">{editingProveedor ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h3><button onClick={() => setShowProveedorModal(false)}><i className="bi bi-x-lg"></i></button></div>
                        <div className="p-6 max-h-[70vh] overflow-y-auto">
                            <form onSubmit={handleProveedorSubmit} className="space-y-4">
                                {[{ label: 'Razón Social *', field: 'nombre' }, { label: 'Contacto', field: 'contacto' }, { label: 'Teléfono', field: 'telefono' }, { label: 'Email', field: 'email' }, { label: 'Rubro', field: 'rubro' }].map(({ label, field }) => (
                                    <div key={field}><label className="block text-sm font-bold mb-1">{label}</label><input type="text" value={proveedorForm[field]} onChange={e => setProveedorForm({...proveedorForm, [field]: e.target.value})} className="w-full border rounded-lg px-3 py-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white" required={field === 'nombre'} /></div>
                                ))}
                                <div><label className="block text-sm font-bold mb-1">Dirección</label><textarea value={proveedorForm.direccion} onChange={e => setProveedorForm({...proveedorForm, direccion: e.target.value})} rows={2} className="w-full border rounded-lg px-3 py-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white" /></div>
                                <div><label className="block text-sm font-bold mb-1">Condición de Pago</label><select value={proveedorForm.condicion_pago} onChange={e => setProveedorForm({...proveedorForm, condicion_pago: e.target.value})} className="w-full border rounded-lg px-3 py-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white">{condicionPagoOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div>
                                <div className="flex justify-end gap-3 pt-4"><button type="button" onClick={() => setShowProveedorModal(false)} className="px-4 py-2 border rounded-lg">Cancelar</button><button type="submit" disabled={submittingProveedor} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">{submittingProveedor ? 'Guardando...' : 'Guardar'}</button></div>
                            </form>
                        </div>
                    </div>
                </div>,
                document.body
            )}
            
            {showProductModal && createPortal(
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowProductModal(false)}>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50 dark:bg-slate-900/20"><h3 className="text-lg font-bold">{editingProduct ? 'Editar registro' : 'Nuevo artículo'}</h3><button onClick={() => setShowProductModal(false)}><i className="bi bi-x-lg"></i></button></div>
                        <div className="p-6 max-h-[70vh] overflow-y-auto">
                            {validationError && <div className="mb-4 text-xs font-bold text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded">{validationError}</div>}
                            <form onSubmit={handleProductSubmit} className="space-y-4">
                                <div><label className="block text-sm font-bold mb-1">Nombre (Español) *</label><input type="text" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="w-full border rounded-lg px-3 py-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white" required /></div>
                                <div><label className="block text-sm font-bold mb-1">Nombre (Inglés)</label><input type="text" value={formData.nombre_en || ''} onChange={e => setFormData({...formData, nombre_en: e.target.value})} className="w-full border rounded-lg px-3 py-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white" placeholder="Opcional" /></div>
                                <div><label className="block text-sm font-bold mb-1">Descripción</label><input type="text" value={formData.descripcion} onChange={e => setFormData({...formData, descripcion: e.target.value})} className="w-full border rounded-lg px-3 py-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white" /></div>
                                <div><label className="block text-sm font-bold mb-1">Presentación *</label><input type="text" value={formData.presentacion} onChange={e => setFormData({...formData, presentacion: e.target.value})} className="w-full border rounded-lg px-3 py-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white" required placeholder="Ej: Tambor 200L" /></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="block text-sm font-bold mb-1">Peso Base (kg) *</label><input type="number" step="0.01" value={formData.peso_kg} onChange={e => setFormData({...formData, peso_kg: e.target.value})} className="w-full border rounded-lg px-3 py-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white" required /></div>
                                    <div><label className="block text-sm font-bold mb-1">Stock Físico</label><input type="number" step="0.01" value={formData.stock_actual} onChange={e => setFormData({...formData, stock_actual: e.target.value})} className="w-full border rounded-lg px-3 py-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white" /></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="block text-sm font-bold mb-1">Stock Mínimo</label><input type="number" step="0.01" min="0" value={formData.stock_minimo} onChange={e => setFormData({...formData, stock_minimo: e.target.value})} className="w-full border rounded-lg px-3 py-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white" placeholder="Alerta amarilla" /></div>
                                    <div><label className="block text-sm font-bold mb-1">Stock Máximo</label><input type="number" step="0.01" min="0" value={formData.stock_maximo} onChange={e => setFormData({...formData, stock_maximo: e.target.value})} className="w-full border rounded-lg px-3 py-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white" placeholder="Alerta naranja" /></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold mb-1">Costo Unitario ($)</label>
                                        <input 
                                            type="number" 
                                            step="0.01" 
                                            min="0" 
                                            value={formData.costo} 
                                            onChange={e => setFormData({...formData, costo: e.target.value})} 
                                            className="w-full border rounded-lg px-3 py-2 disabled:bg-gray-100 dark:bg-slate-800/50 dark:disabled:bg-slate-700 disabled:text-gray-500 disabled:cursor-not-allowed" 
                                            disabled={
                                                (editingProduct && user?.role !== 'OWNER' && user?.role !== 'OPERADOR') ||
                                                formulas.some(f => f.articulo_final_id === editingProduct?.id)
                                            }
                                            title={formulas.some(f => f.articulo_final_id === editingProduct?.id) ? "El costo de este producto es calculado automáticamente por su fórmula." : (editingProduct && user?.role !== 'OWNER' && user?.role !== 'OPERADOR' ? "No tiene permisos para editar el costo de un producto existente." : "")}
                                        />
                                        {formulas.some(f => f.articulo_final_id === editingProduct?.id) && <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold mt-1 block"><i className="bi bi-info-circle mr-1"></i>Calculado por fórmula</span>}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold mb-1">Precio de Venta ($)</label>
                                        <input 
                                            type="number" 
                                            step="0.01" 
                                            min="0" 
                                            value={formData.precio_venta} 
                                            onChange={e => setFormData({...formData, precio_venta: e.target.value})} 
                                            className="w-full border rounded-lg px-3 py-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white" 
                                        />
                                    </div>
                                </div>
                                <div><label className="block text-sm font-bold mb-1">Categoría</label>
                                    <input type="text" list="categorias-list" value={formData.categoria} onChange={e => setFormData({...formData, categoria: e.target.value})} className="w-full border rounded-lg px-3 py-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white" placeholder="Ej: insumos" />
                                    <datalist id="categorias-list">
                                        {allCategorias.map(cat => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
                                    </datalist>
                                </div>
                                <div><label className="block text-sm font-bold mb-1">Proveedor (opcional)</label><AutocompleteCreate endpoint="/inventario/proveedores/" value={formData.proveedor} onSelect={(item) => setFormData({...formData, proveedor: item?.id || ''})} nameField="nombre" placeholder="Seleccionar o crear proveedor..." createFields={[{ name: 'nombre', label: 'Razón Social', required: true }, { name: 'contacto', label: 'Contacto' }, { name: 'telefono', label: 'Teléfono' }, { name: 'email', label: 'Email' }, { name: 'direccion', label: 'Dirección' }, { name: 'rubro', label: 'Rubro' }, { name: 'condicion_pago', label: 'Condición de Pago', type: 'select', options: condicionPagoOptions }]} extraCreateData={{}} /></div>
                                <div className="flex justify-end gap-3 pt-4"><button type="button" onClick={() => setShowProductModal(false)} className="px-4 py-2 border rounded-lg">Cancelar</button><button type="submit" disabled={submitting} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">{submitting ? 'Guardando...' : 'Guardar'}</button></div>
                            </form>
                        </div>
                    </div>
                </div>,
                document.body
            )}
            
            {showProviderSelectionModal && createPortal(
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowProviderSelectionModal(false)}>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b flex justify-between items-center bg-indigo-50 dark:bg-slate-700">
                            <h3 className="text-lg font-bold">¿A qué proveedor querés mandárselo?</h3>
                            <button onClick={() => setShowProviderSelectionModal(false)}><i className="bi bi-x-lg"></i></button>
                        </div>
                        <div className="p-6">
                            <label className="block text-sm font-bold mb-2">Seleccione un proveedor:</label>
                            <select 
                                value={selectedProviderForBudget} 
                                onChange={(e) => setSelectedProviderForBudget(e.target.value)} 
                                className="w-full border rounded-lg px-3 py-2 dark:bg-slate-700 dark:border-slate-600"
                            >
                                <option value="">Seleccionar...</option>
                                {proveedores.map(prov => <option key={prov.id} value={prov.id}>{prov.nombre}</option>)}
                            </select>
                            <div className="flex justify-end gap-3 mt-6">
                                <button onClick={() => setShowProviderSelectionModal(false)} className="px-4 py-2 border rounded-lg">Cancelar</button>
                                <button onClick={proceedToBudget} disabled={!selectedProviderForBudget} className="px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50">Continuar</button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
            
            {showBudgetModal && createPortal(
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowBudgetModal(false)}>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b bg-indigo-50 dark:bg-indigo-900/20 flex justify-between items-center"><h3 className="text-lg font-black">Solicitar presupuesto a {currentProveedor?.nombre}</h3><button onClick={() => setShowBudgetModal(false)}><i className="bi bi-x-lg"></i></button></div>
                        <div className="p-6 flex-1 overflow-y-auto">
                            <textarea rows={12} value={budgetText} onChange={(e) => setBudgetText(e.target.value)} className="w-full border rounded-lg p-3 font-mono text-sm dark:bg-slate-700 dark:text-white dark:border-slate-600"></textarea>
                            <div className="flex justify-end gap-3 mt-4">
                                {currentProveedor?.email && (
                                    <button 
                                        onClick={handleSendDirectEmail}
                                        disabled={sendingEmail}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
                                    >
                                        {sendingEmail ? <i className="bi bi-arrow-repeat animate-spin"></i> : <i className="bi bi-envelope-fill"></i>}
                                        {sendingEmail ? 'Enviando...' : 'Enviar por Email'}
                                    </button>
                                )}
                                <button onClick={copyBudgetToClipboard} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg flex items-center gap-2 shadow-sm transition-colors">
                                    <i className="bi bi-clipboard"></i> Copiar
                                </button>
                                <button onClick={() => setShowBudgetModal(false)} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-slate-600 dark:hover:bg-slate-500 text-gray-800 dark:text-white font-bold rounded-lg shadow-sm transition-colors">
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
            
            {showDeleteModal && productToDelete && createPortal(
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDeleteModal(false)}>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm text-center p-6" onClick={e => e.stopPropagation()}>
                        <i className="bi bi-exclamation-triangle text-4xl text-red-500 mb-3 block"></i>
                        <h3 className="text-xl font-black mb-2">Eliminar Registro</h3>
                        <p className="text-sm text-gray-500 mb-6">¿Eliminar <b>{productToDelete.nombre}</b> permanentemente?</p>
                        <div className="flex justify-center gap-3"><button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 border rounded-lg">Cancelar</button><button onClick={handleDelete} disabled={submitting} className="px-4 py-2 bg-red-600 text-white rounded-lg">Sí, Eliminar</button></div>
                    </div>
                </div>,
                document.body
            )}
            
            {showMultiDeleteModal && createPortal(
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowMultiDeleteModal(false)}>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b bg-red-50 dark:bg-red-900/20"><h3 className="text-lg font-black text-red-800">Eliminación Masiva</h3></div>
                        <div className="p-4 overflow-y-auto flex-1"><table className="w-full text-sm"><thead><tr><th className="p-2"><input type="checkbox" checked={selectedCountChem > 0 && selectedCountChem === filteredProducts.length} onChange={toggleSelectAllChem} /></th><th className="p-2">Nombre</th></tr></thead><tbody>{filteredProducts.map(p => (<tr key={p.id}><td className="p-2"><input type="checkbox" checked={selectedProducts[p.id] || false} onChange={() => toggleSelectProduct(p.id)} /></td><td className="p-2 font-medium">{p.nombre}</td></tr>))}</tbody></table></div>
                        <div className="p-4 border-t flex justify-between items-center bg-gray-50 dark:bg-slate-900/50"><span className="text-xs font-bold">{selectedCountChem} elegidos</span><div className="flex gap-2"><button onClick={() => setShowMultiDeleteModal(false)} className="px-4 py-2 border rounded-lg">Cancelar</button><button onClick={handleMultiDeleteChem} disabled={selectedCountChem===0 || deletingMultipleChem} className="px-4 py-2 bg-red-600 text-white rounded-lg">Borrar</button></div></div>
                    </div>
                </div>,
                document.body
            )}
            
            {showFormulaModal && createPortal(
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowFormulaModal(false)}>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b bg-indigo-50 dark:bg-indigo-950/20 flex justify-between items-center">
                            <h3 className="text-lg font-black text-indigo-900 dark:text-indigo-400">
                                {editingFormula ? `Editar Receta: ${editingFormula.nombre}` : 'Nueva Fórmula de Producción'}
                            </h3>
                            <button onClick={() => setShowFormulaModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">
                                <i className="bi bi-x-lg text-lg"></i>
                            </button>
                        </div>
                        <div className="p-6 flex-1 overflow-y-auto space-y-4">
                            {/* Artículo Final */}
                            <div>
                                {editingFormula ? (
                                    <div>
                                        <label className="block text-xs font-bold uppercase text-gray-500 dark:text-slate-400 mb-1">Artículo Final (Químico)</label>
                                        <div className="bg-gray-100 dark:bg-slate-700 px-3 py-2 rounded-lg text-sm font-semibold text-gray-800 dark:text-slate-200 border border-gray-200 dark:border-slate-600">
                                            {selectedQuimico?.nombre}
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <label className="block text-xs font-bold uppercase text-gray-500 dark:text-slate-400 mb-1">Artículo Final (Producto Químico) *</label>
                                        {selectedQuimico ? (
                                            <div className="flex justify-between items-center bg-white dark:bg-slate-800 border rounded-lg px-3 py-2 text-sm dark:border-slate-600 dark:text-white border-slate-200">
                                                <span className="font-semibold">{selectedQuimico.nombre} ({selectedQuimico.presentacion})</span>
                                                <button 
                                                    onClick={() => {
                                                        setActiveIngredientIdx('final');
                                                        setIsChemicalBrowserOpen(true);
                                                    }}
                                                    className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline text-xs"
                                                >
                                                    Cambiar
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    setActiveIngredientIdx('final');
                                                    setIsChemicalBrowserOpen(true);
                                                }}
                                                className="w-full text-left bg-white dark:bg-slate-800 border border-dashed border-gray-300 hover:border-indigo-400 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-gray-400 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-all"
                                            >
                                                <i className="bi bi-search mr-2"></i> Seleccionar Producto Químico Final...
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Nombre de la Receta */}
                            <div>
                                <label className="block text-xs font-bold uppercase text-gray-500 dark:text-slate-400 mb-1">Nombre de la Receta *</label>
                                <input
                                    type="text"
                                    value={formulaName}
                                    onChange={e => setFormulaName(e.target.value)}
                                    placeholder="Ej: Mezcla A - Concentración Alta"
                                    className="w-full border rounded-lg px-3 py-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                />
                            </div>

                            {/* Ingredientes / Componentes */}
                            <div>
                                <div className="mb-2 flex justify-between items-center">
                                    <label className="text-xs font-bold uppercase text-gray-500 dark:text-slate-400">Ingredientes Químicos *</label>
                                    <button
                                        onClick={() => setIngredients([...ingredients, { insumo_id: '', cantidad: '', obj: null, is_envase: false }])}
                                        className="text-xs bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/40 px-3 py-1.5 rounded-lg font-bold transition-colors"
                                    >
                                        + Agregar Químico
                                    </button>
                                </div>
                                <div className="space-y-3 max-h-60 overflow-y-auto pr-1 mb-4">
                                    {ingredients.map((ing, idx) => !ing.is_envase && (
                                        <div key={idx} className="flex gap-2 items-start bg-slate-50 dark:bg-slate-700/50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                                            <div className="flex-1">
                                                <label className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 mb-1">Ingrediente Químico *</label>
                                                {ing.insumo_id ? (
                                                    <div className="flex justify-between items-center bg-white dark:bg-slate-800 border rounded-lg px-3 py-1.5 text-sm dark:border-slate-600 dark:text-white border-slate-200">
                                                        <span className="font-medium">{ing.obj?.nombre || 'Químico seleccionado'} ({ing.obj?.presentacion || ''})</span>
                                                        <button 
                                                            onClick={() => {
                                                                setActiveIngredientIdx(idx);
                                                                setIsChemicalBrowserOpen(true);
                                                            }}
                                                            className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline text-xs ml-2"
                                                        >
                                                            Cambiar
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => {
                                                            setActiveIngredientIdx(idx);
                                                            setIsChemicalBrowserOpen(true);
                                                        }}
                                                        className="w-full text-left bg-white dark:bg-slate-800 border border-dashed border-gray-300 hover:border-indigo-400 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm text-gray-400 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-all"
                                                    >
                                                        <i className="bi bi-search mr-2"></i> Seleccionar Químico...
                                                    </button>
                                                )}
                                            </div>
                                            <div className="w-28">
                                                <label className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 mb-1">Cantidad (Lts)</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={ing.cantidad}
                                                    onChange={e => {
                                                        const newIng = [...ingredients];
                                                        newIng[idx].cantidad = e.target.value;
                                                        setIngredients(newIng);
                                                    }}
                                                    placeholder="Ej: 100"
                                                    className="w-full border rounded px-2.5 py-1.5 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                                />
                                                {ing.obj?.costo !== undefined && (
                                                    <span className="block text-[10px] text-gray-500 dark:text-slate-400 mt-1 font-medium text-right">
                                                        Costo U: ${parseFloat(ing.obj.costo).toFixed(2)}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="pt-7 shrink-0">
                                                <button
                                                    onClick={() => {
                                                        const newIng = [...ingredients];
                                                        newIng.splice(idx, 1);
                                                        setIngredients(newIng);
                                                    }}
                                                    className="text-red-400 hover:text-red-600 transition-colors"
                                                >
                                                    <i className="bi bi-trash text-lg"></i>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {ingredients.filter(i => !i.is_envase).length === 0 && (
                                        <p className="text-xs text-gray-400 italic text-center py-4">No se han agregado químicos a la receta.</p>
                                    )}
                                </div>

                                <div className="mb-2 flex justify-between items-center border-t pt-4">
                                    <label className="text-xs font-bold uppercase text-gray-500 dark:text-slate-400">Envase / Empaque</label>
                                    <button
                                        onClick={() => setIngredients([...ingredients, { insumo_id: '', cantidad: '', obj: null, is_envase: true }])}
                                        className="text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/40 px-3 py-1.5 rounded-lg font-bold transition-colors"
                                    >
                                        + Agregar Envase
                                    </button>
                                </div>
                                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                                    {ingredients.map((ing, idx) => ing.is_envase && (
                                        <div key={idx} className="flex gap-2 items-start bg-slate-50 dark:bg-slate-700/50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                                            <div className="flex-1">
                                                <label className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 mb-1">Envase *</label>
                                                {ing.insumo_id ? (
                                                    <div className="flex justify-between items-center bg-white dark:bg-slate-800 border rounded-lg px-3 py-1.5 text-sm dark:border-slate-600 dark:text-white border-slate-200">
                                                        <span className="font-medium">{ing.obj?.nombre || 'Envase seleccionado'} ({ing.obj?.presentacion || ''})</span>
                                                        <button 
                                                            onClick={() => {
                                                                setActiveIngredientIdx(idx);
                                                                setIsEnvaseBrowserOpen(true);
                                                            }}
                                                            className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline text-xs ml-2"
                                                        >
                                                            Cambiar
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => {
                                                            setActiveIngredientIdx(idx);
                                                            setIsEnvaseBrowserOpen(true);
                                                        }}
                                                        className="w-full text-left bg-white dark:bg-slate-800 border border-dashed border-gray-300 hover:border-emerald-400 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm text-gray-400 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 font-medium transition-all"
                                                    >
                                                        <i className="bi bi-box mr-2"></i> Seleccionar Envase...
                                                    </button>
                                                )}
                                            </div>
                                            <div className="w-28">
                                                <label className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 mb-1">Capacidad (Lts)</label>
                                                <input
                                                    type="number"
                                                    step="1"
                                                    value={ing.cantidad}
                                                    onChange={e => {
                                                        const newIng = [...ingredients];
                                                        newIng[idx].cantidad = e.target.value;
                                                        setIngredients(newIng);
                                                    }}
                                                    placeholder="Ej: 20"
                                                    className="w-full border rounded px-2.5 py-1.5 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                                />
                                                {ing.obj?.costo !== undefined && (
                                                    <span className="block text-[10px] text-gray-500 dark:text-slate-400 mt-1 font-medium text-right">
                                                        Costo U: ${parseFloat(ing.obj.costo).toFixed(2)}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="pt-7 shrink-0">
                                                <button
                                                    onClick={() => {
                                                        const newIng = [...ingredients];
                                                        newIng.splice(idx, 1);
                                                        setIngredients(newIng);
                                                    }}
                                                    className="text-red-400 hover:text-red-600 transition-colors"
                                                >
                                                    <i className="bi bi-trash text-lg"></i>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {ingredients.filter(i => i.is_envase).length === 0 && (
                                        <p className="text-xs text-gray-400 italic text-center py-4">No se han agregado envases.</p>
                                    )}
                                </div>

                                {/* Panel Financiero */}
                                <div className="mt-4 p-4 bg-gradient-to-r from-slate-50 to-indigo-50 dark:from-slate-700/50 dark:to-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800 shadow-sm">
                                    <h4 className="text-xs font-black uppercase text-indigo-800 dark:text-indigo-300 mb-3 tracking-wider">Análisis Financiero de Preparación</h4>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                                            <span className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase">Costo Preparación</span>
                                            <span className="text-lg font-black text-slate-800 dark:text-white">${costoPreparacion.toFixed(2)}</span>
                                        </div>
                                        <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                                            <span className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase">Precio Venta (Unidad)</span>
                                            <span className="text-lg font-black text-slate-800 dark:text-white">${precioVentaFinal.toFixed(2)}</span>
                                        </div>
                                        <div className={`p-3 rounded-lg border ${gananciaReceta >= 0 ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
                                            <span className={`block text-[10px] font-bold uppercase ${gananciaReceta >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>Ganancia Estimada</span>
                                            <div className="flex items-end gap-2">
                                                <span className={`text-lg font-black ${gananciaReceta >= 0 ? 'text-green-600 dark:text-green-300' : 'text-red-600 dark:text-red-300'}`}>
                                                    ${gananciaReceta.toFixed(2)}
                                                </span>
                                                <span className={`text-sm font-bold mb-0.5 ${gananciaReceta >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                                                    ({gananciaPorcentaje.toFixed(2)}%)
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t flex justify-end gap-3 bg-gray-50 dark:bg-slate-750">
                            <button
                                onClick={() => setShowFormulaModal(false)}
                                className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:bg-slate-900/50 dark:hover:bg-slate-700 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={saveFormula}
                                disabled={submitting}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                            >
                                {submitting ? 'Guardando...' : 'Guardar Fórmula'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            <ProductSelectionModal
                isOpen={isChemicalBrowserOpen}
                onClose={() => setIsChemicalBrowserOpen(false)}
                onSelect={handleSelectChemical}
                categoria="quimicos"
                title="Seleccionar Ingrediente Químico"
            />
            <ProductSelectionModal
                isOpen={isEnvaseBrowserOpen}
                onClose={() => setIsEnvaseBrowserOpen(false)}
                onSelect={handleSelectChemical}
                categoria="Empaque"
                title="Seleccionar Envase / Empaque"
            />
            
            {movimientosModal.open && createPortal(
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-4" onClick={() => setMovimientosModal({ open: false, producto: null, movimientos: [], loading: false, filters: { tipo: '', fecha_desde: '', fecha_hasta: '' }, page: 1, totalPages: 1, exportando: false })}>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b bg-indigo-50 dark:bg-indigo-900/20 flex justify-between items-center shrink-0"><h3 className="text-xl font-black">Movimientos de {movimientosModal.producto?.nombre}</h3><button onClick={() => setMovimientosModal(prev => ({ ...prev, open: false }))}><i className="bi bi-x-lg text-xl"></i></button></div>
                        <div className="p-4 flex gap-2 flex-wrap border-b shrink-0">
                            <select className="px-3 py-1.5 border rounded-lg text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={movimientosModal.filters.tipo} onChange={e => fetchMovimientos(movimientosModal.producto?.id, 1, { ...movimientosModal.filters, tipo: e.target.value })}>
                                <option value="">Todos los tipos</option><option value="INGRESO">Ingreso</option><option value="SALIDA">Salida</option><option value="AJUSTE">Ajuste</option>
                            </select>
                            <input type="date" className="px-3 py-1.5 border rounded-lg text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={movimientosModal.filters.fecha_desde} onChange={e => fetchMovimientos(movimientosModal.producto?.id, 1, { ...movimientosModal.filters, fecha_desde: e.target.value })} />
                            <input type="date" className="px-3 py-1.5 border rounded-lg text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={movimientosModal.filters.fecha_hasta} onChange={e => fetchMovimientos(movimientosModal.producto?.id, 1, { ...movimientosModal.filters, fecha_hasta: e.target.value })} />
                            <button onClick={() => exportMovimientos(movimientosModal.producto?.id, 'excel')} disabled={movimientosModal.exportando} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm">Exportar Excel</button>
                            <button onClick={() => exportMovimientos(movimientosModal.producto?.id, 'csv')} disabled={movimientosModal.exportando} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm">Exportar CSV</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            {movimientosModal.loading ? <div className="flex justify-center py-20"><LogoSpinner size="w-10 h-10" /></div> : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50 dark:bg-slate-900/50"><tr><th className="px-4 py-3 text-left text-xs font-medium">Fecha</th><th className="px-4 py-3 text-left text-xs font-medium">Tipo</th><th className="px-4 py-3 text-left text-xs font-medium">Cantidad</th><th className="px-4 py-3 text-left text-xs font-medium">Stock resultante</th><th className="px-4 py-3 text-left text-xs font-medium">Razón</th><th className="px-4 py-3 text-left text-xs font-medium">Operación</th></tr></thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {movimientosModal.movimientos.map(m => (
                                                <tr key={m.id}>
                                                    <td className="px-4 py-2 text-sm">{new Date(m.fecha).toLocaleString()}</td>
                                                    <td className="px-4 py-2 text-sm"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${m.tipo === 'INGRESO' ? 'bg-green-100 dark:bg-green-900/30 text-green-800' : m.tipo === 'SALIDA' ? 'bg-red-100 dark:bg-red-900/30 text-red-800' : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800'}`}>{m.tipo}</span></td>
                                                    <td className="px-4 py-2 text-sm">{m.cantidad}</td>
                                                    <td className="px-4 py-2 text-sm">{m.stock_resultante}</td>
                                                    <td className="px-4 py-2 text-sm">{m.razon}</td>
                                                    <td className="px-4 py-2 text-sm">{m.operacion_id || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            {movimientosModal.movimientos.length === 0 && !movimientosModal.loading && <p className="text-center text-gray-500 py-10">No hay movimientos.</p>}
                        </div>
                        <div className="p-4 border-t flex justify-between items-center bg-gray-50 dark:bg-slate-900/50 shrink-0">
                            <button disabled={movimientosModal.page <= 1} onClick={() => fetchMovimientos(movimientosModal.producto?.id, movimientosModal.page - 1, movimientosModal.filters)} className="px-3 py-1.5 border rounded-lg disabled:opacity-50">Anterior</button>
                            <span className="text-sm">Página {movimientosModal.page} de {movimientosModal.totalPages}</span>
                            <button disabled={movimientosModal.page >= movimientosModal.totalPages} onClick={() => fetchMovimientos(movimientosModal.producto?.id, movimientosModal.page + 1, movimientosModal.filters)} className="px-3 py-1.5 border rounded-lg disabled:opacity-50">Siguiente</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
            
            {logsModal.open && createPortal(
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-4" onClick={() => setLogsModal({ open: false, producto: null, logs: [], loading: false })}>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b bg-gray-50 dark:bg-slate-900/50 flex justify-between items-center shrink-0"><h3 className="text-xl font-black">Historial de cambios - {logsModal.producto?.nombre}</h3><button onClick={() => setLogsModal(prev => ({ ...prev, open: false }))}><i className="bi bi-x-lg text-xl"></i></button></div>
                        <div className="flex-1 overflow-y-auto p-4">
                            {logsModal.loading ? <div className="flex justify-center py-20"><LogoSpinner size="w-10 h-10" /></div> : (
                                <div className="space-y-4">
                                    {logsModal.logs.map(log => (
                                        <div key={log.id} className="border rounded-lg p-4 bg-white dark:bg-slate-800">
                                            <div className="flex justify-between text-sm text-gray-500"><span>{new Date(log.fecha).toLocaleString()}</span><span>Usuario: {log.usuario_nombre || 'Sistema'}</span><span>IP: {log.ip || '-'}</span></div>
                                            <p className="font-bold mt-2 text-gray-800 dark:text-slate-200">{log.accion === 'CREATE' ? 'Creación' : log.accion === 'UPDATE' ? 'Actualización' : 'Eliminación'}</p>
                                            {log.campos_modificados && Object.keys(log.campos_modificados).length > 0 && (
                                                <details className="mt-2"><summary className="text-xs cursor-pointer text-indigo-600">Ver detalles</summary><ul className="mt-1 text-xs text-gray-600 list-disc list-inside">{Object.entries(log.campos_modificados).map(([campo, val]) => <li key={campo}><strong>{campo}:</strong> {val.old} → {val.new}</li>)}</ul></details>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {logsModal.logs.length === 0 && !logsModal.loading && <p className="text-center text-gray-500 py-10">No hay registros de cambios.</p>}
                        </div>
                        <div className="p-4 border-t flex justify-end bg-gray-50 dark:bg-slate-900/50 shrink-0"><button onClick={() => setLogsModal(prev => ({ ...prev, open: false }))} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Cerrar</button></div>
                    </div>
                </div>,
                document.body
            )}
            
            {movimientosGlobal.open && createPortal(
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-4" onClick={() => setMovimientosGlobal(prev => ({ ...prev, open: false }))}>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b bg-indigo-50 dark:bg-indigo-900/20 flex justify-between items-center shrink-0"><h3 className="text-xl font-black">Informe general de movimientos</h3><button onClick={() => setMovimientosGlobal(prev => ({ ...prev, open: false }))}><i className="bi bi-x-lg text-xl"></i></button></div>
                        <div className="p-4 flex gap-2 flex-wrap border-b shrink-0">
                            <input type="text" placeholder="ID Producto" className="px-3 py-1.5 border rounded-lg text-sm w-32 dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={movimientosGlobal.filters.articulo_id} onChange={e => setMovimientosGlobal(prev => ({ ...prev, filters: { ...prev.filters, articulo_id: e.target.value } }))} />
                            <select className="px-3 py-1.5 border rounded-lg text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={movimientosGlobal.filters.tipo} onChange={e => setMovimientosGlobal(prev => ({ ...prev, filters: { ...prev.filters, tipo: e.target.value } }))}><option value="">Todos los tipos</option><option value="INGRESO">Ingreso</option><option value="SALIDA">Salida</option><option value="AJUSTE">Ajuste</option></select>
                            <input type="date" className="px-3 py-1.5 border rounded-lg text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={movimientosGlobal.filters.fecha_desde} onChange={e => setMovimientosGlobal(prev => ({ ...prev, filters: { ...prev.filters, fecha_desde: e.target.value } }))} />
                            <input type="date" className="px-3 py-1.5 border rounded-lg text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={movimientosGlobal.filters.fecha_hasta} onChange={e => setMovimientosGlobal(prev => ({ ...prev, filters: { ...prev.filters, fecha_hasta: e.target.value } }))} />
                            <button onClick={() => openMovimientosGlobal(1)} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm">Filtrar</button>
                            <button onClick={() => exportMovimientos(null, 'excel')} disabled={movimientosGlobal.exportando} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm">Exportar Excel</button>
                            <button onClick={() => exportMovimientos(null, 'csv')} disabled={movimientosGlobal.exportando} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm">Exportar CSV</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            {movimientosGlobal.loading ? <div className="flex justify-center py-20"><LogoSpinner size="w-10 h-10" /></div> : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50 dark:bg-slate-900/50"><tr><th className="px-4 py-3 text-left text-xs font-medium">Fecha</th><th className="px-4 py-3 text-left text-xs font-medium">Producto</th><th className="px-4 py-3 text-left text-xs font-medium">Tipo</th><th className="px-4 py-3 text-left text-xs font-medium">Cantidad</th><th className="px-4 py-3 text-left text-xs font-medium">Stock resultante</th><th className="px-4 py-3 text-left text-xs font-medium">Razón</th><th className="px-4 py-3 text-left text-xs font-medium">Operación</th></tr></thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {movimientosGlobal.movimientos.map(m => (
                                                <tr key={m.id}>
                                                    <td className="px-4 py-2 text-sm">{new Date(m.fecha).toLocaleString()}</td>
                                                    <td className="px-4 py-2 text-sm">{m.articulo_nombre}</td>
                                                    <td className="px-4 py-2 text-sm"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${m.tipo === 'INGRESO' ? 'bg-green-100 dark:bg-green-900/30 text-green-800' : m.tipo === 'SALIDA' ? 'bg-red-100 dark:bg-red-900/30 text-red-800' : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800'}`}>{m.tipo}</span></td>
                                                    <td className="px-4 py-2 text-sm">{m.cantidad}</td>
                                                    <td className="px-4 py-2 text-sm">{m.stock_resultante}</td>
                                                    <td className="px-4 py-2 text-sm">{m.razon}</td>
                                                    <td className="px-4 py-2 text-sm">{m.operacion_id || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            {movimientosGlobal.movimientos.length === 0 && !movimientosGlobal.loading && <p className="text-center text-gray-500 py-10">No hay movimientos.</p>}
                        </div>
                        <div className="p-4 border-t flex justify-between items-center bg-gray-50 dark:bg-slate-900/50 shrink-0">
                            <button disabled={movimientosGlobal.page <= 1} onClick={() => openMovimientosGlobal(movimientosGlobal.page - 1)} className="px-3 py-1.5 border rounded-lg disabled:opacity-50">Anterior</button>
                            <span className="text-sm">Página {movimientosGlobal.page} de {movimientosGlobal.totalPages}</span>
                            <button disabled={movimientosGlobal.page >= movimientosGlobal.totalPages} onClick={() => openMovimientosGlobal(movimientosGlobal.page + 1)} className="px-3 py-1.5 border rounded-lg disabled:opacity-50">Siguiente</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
            
            {movimientoModal.open && createPortal(
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-4" onClick={() => setMovimientoModal(prev => ({ ...prev, open: false }))}>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b bg-emerald-50 dark:bg-emerald-900/20 flex justify-between items-center">
                            <h3 className="text-lg font-black">Registrar movimiento - {movimientoModal.producto?.nombre}</h3>
                            <button onClick={() => setMovimientoModal(prev => ({ ...prev, open: false }))} className="text-gray-500 hover:text-gray-700"><i className="bi bi-x-lg text-xl"></i></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div><label className="block text-sm font-bold mb-1">Tipo</label>
                                <select value={movimientoModal.tipo} onChange={e => setMovimientoModal(prev => ({ ...prev, tipo: e.target.value }))} className="w-full border rounded-lg px-3 py-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white">
                                    <option value="INGRESO">Ingreso</option>
                                    <option value="SALIDA">Salida</option>
                                    <option value="AJUSTE">Ajuste (setea stock)</option>
                                </select>
                                <p className="text-xs text-gray-500 mt-1">{movimientoModal.tipo === 'INGRESO' ? 'Aumenta el stock' : movimientoModal.tipo === 'SALIDA' ? 'Reduce el stock' : 'Establece el stock exacto'}</p>
                            </div>
                            <div><label className="block text-sm font-bold mb-1">Cantidad</label><input type="number" step="0.01" value={movimientoModal.cantidad} onChange={e => setMovimientoModal(prev => ({ ...prev, cantidad: parseFloat(e.target.value) || 0 }))} className="w-full border rounded-lg px-3 py-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white" /></div>
                            <div><label className="block text-sm font-bold mb-1">Razón</label><textarea value={movimientoModal.razon} onChange={e => setMovimientoModal(prev => ({ ...prev, razon: e.target.value }))} rows={2} className="w-full border rounded-lg px-3 py-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white" placeholder="Ej: Compra, Devolución, Ajuste..." /></div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button onClick={() => setMovimientoModal(prev => ({ ...prev, open: false }))} className="px-4 py-2 border rounded-lg">Cancelar</button>
                                <button onClick={registrarMovimiento} disabled={registrandoMovimiento} className="px-4 py-2 bg-emerald-600 text-white rounded-lg">{registrandoMovimiento ? 'Registrando...' : 'Registrar'}</button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
            
            {showDetailModal && selectedProduct && (
                <StockDetailModal product={selectedProduct} onClose={() => setShowDetailModal(false)} />
            )}
            
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
                .custom-scrollbar::-webkit-scrollbar { width: 8px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 20px; border: 2px solid #f8fafc; }
            ` }} />
        </div>
    );
}
