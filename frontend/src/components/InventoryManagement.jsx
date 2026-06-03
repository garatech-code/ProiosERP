import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from '../api/axios';
import AutocompleteCreate from './AutocompleteCreate';
import LogoSpinner from './LogoSpinner';
import * as XLSX from 'xlsx';

export default function InventoryManagement() {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('todo');
  const [loading, setLoading] = useState(true);
  
  const PRODUCT_DRAFT_KEY = 'draft_inventory_producto';
  const PROVEEDOR_DRAFT_KEY = 'draft_inventory_proveedor';

  // Proveedores
  const [proveedores, setProveedores] = useState([]);
  const [filteredProveedores, setFilteredProveedores] = useState([]);
  const [showProveedorModal, setShowProveedorModal] = useState(false);
  const [editingProveedor, setEditingProveedor] = useState(null);
  const [proveedorForm, setProveedorForm] = useState(() => {
    const saved = localStorage.getItem(PROVEEDOR_DRAFT_KEY);
    if (saved) { try { return JSON.parse(saved); } catch (e) { } }
    return { nombre: '', contacto: '', telefono: '', email: '', direccion: '', rubro: '', condicion_pago: 'contado' };
  });
  const [submittingProveedor, setSubmittingProveedor] = useState(false);
  
  const [uploadingProveedores, setUploadingProveedores] = useState(false);
  const [proveedorExcelFeedback, setProveedorExcelFeedback] = useState(null);
  
  // Abastecimiento
  const [productosCriticos, setProductosCriticos] = useState([]);
  const [selectedForBudget, setSelectedForBudget] = useState({});
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetText, setBudgetText] = useState('');
  const [currentProveedor, setCurrentProveedor] = useState(null);
  
  // Productos
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem(PRODUCT_DRAFT_KEY);
    if (saved) { try { return JSON.parse(saved); } catch (e) { } }
    return { nombre: '', descripcion: '', presentacion: '', peso_kg: '', stock_actual: 0, stock_minimo: 0, stock_maximo: 0, proveedor: '', categoria: 'otros' };
  });
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');
  
  // Eliminaciones
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);
  const [showMultiDeleteModal, setShowMultiDeleteModal] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState({});
  const [deletingMultiple, setDeletingMultiple] = useState(false);
  
  // Excel productos
  const [uploadingExcel, setUploadingExcel] = useState(false);
  const [excelFeedback, setExcelFeedback] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  
  // Fórmulas BOM
  const [formulas, setFormulas] = useState([]);
  const [showFormulaModal, setShowFormulaModal] = useState(false);
  const [selectedQuimico, setSelectedQuimico] = useState(null);
  const [formulaName, setFormulaName] = useState('');
  const [ingredients, setIngredients] = useState([]);
  
  // MOVIMIENTOS Y LOGS
  const [movimientosModal, setMovimientosModal] = useState({ open: false, producto: null, movimientos: [], loading: false, filters: { tipo: '', fecha_desde: '', fecha_hasta: '' }, page: 1, totalPages: 1, exportando: false });
  const [logsModal, setLogsModal] = useState({ open: false, producto: null, logs: [], loading: false });
  const [movimientosGlobal, setMovimientosGlobal] = useState({ open: false, movimientos: [], loading: false, filters: { tipo: '', fecha_desde: '', fecha_hasta: '', articulo_id: '' }, page: 1, totalPages: 1, exportando: false });
  
  const [movimientoModal, setMovimientoModal] = useState({ open: false, producto: null, tipo: 'INGRESO', cantidad: 1, razon: '' });
  const [registrandoMovimiento, setRegistrandoMovimiento] = useState(false);

  const showToast = (message, type = 'info') => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Autosave
  useEffect(() => {
    if (!editingProduct) localStorage.setItem(PRODUCT_DRAFT_KEY, JSON.stringify(formData));
  }, [formData, editingProduct]);
  useEffect(() => {
    if (!editingProveedor) localStorage.setItem(PROVEEDOR_DRAFT_KEY, JSON.stringify(proveedorForm));
  }, [proveedorForm, editingProveedor]);
  
  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/inventario/products/');
      setProducts(res.data);
      if (activeTab === 'quimicos') await fetchFormulas();
    } catch (err) {
      showToast('Error al cargar datos del inventario.', 'error');
    } finally {
      setLoading(false);
    }
  };
  
  const fetchProveedores = async () => {
    try {
      const res = await axios.get('/inventario/proveedores/');
      setProveedores(res.data);
    } catch (err) {
      showToast('Error al cargar proveedores', 'error');
    }
  };
  
  const fetchFormulas = async () => {
    try {
      const res = await axios.get('/produccion/formulas/');
      setFormulas(res.data);
    } catch (err) {}
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
    } else if (activeTab !== 'abastecimiento') {
      fetchProducts();
    } else {
      fetchProducts();
    }
  }, [activeTab]);
  
  // Filtrado de productos normales
  useEffect(() => {
    if (activeTab !== 'productos' && activeTab !== 'todo' && activeTab !== 'quimicos') return;
    let filtered = [];
    if (activeTab === 'todo') filtered = [...products];
    else if (activeTab === 'quimicos') filtered = products.filter(p => p.categoria === 'quimicos');
    else if (activeTab === 'productos') filtered = products.filter(p => p.categoria === 'otros');
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        p.nombre.toLowerCase().includes(term) ||
        p.presentacion.toLowerCase().includes(term) ||
        (p.proveedor_nombre && p.proveedor_nombre.toLowerCase().includes(term))
      );
    }
    setFilteredProducts(filtered);
    setSelectedProducts({});
  }, [searchTerm, activeTab, products]);
  
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

  const [criticosSearchTerm, setCriticosSearchTerm] = useState('');
  const filteredCriticos = productosCriticos.filter(p => !criticosSearchTerm || p.nombre.toLowerCase().includes(criticosSearchTerm.toLowerCase()) || p.presentacion.toLowerCase().includes(criticosSearchTerm.toLowerCase()));
  
  useEffect(() => {
    if (showProductModal || showDeleteModal || showMultiDeleteModal || showFormulaModal || showProveedorModal || showBudgetModal || movimientosModal.open || logsModal.open || movimientosGlobal.open || movimientoModal.open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showProductModal, showDeleteModal, showMultiDeleteModal, showFormulaModal, showProveedorModal, showBudgetModal, movimientosModal.open, logsModal.open, movimientosGlobal.open, movimientoModal.open]);
  
  // ---------- Proveedores ----------
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
  
  // ---------- Abastecimiento ----------
  const toggleSelectForBudget = (productId, proveedorId = '') => {
    setSelectedForBudget(prev => {
      if (prev[productId]) { const newState = { ...prev }; delete newState[productId]; return newState; }
      else return { ...prev, [productId]: { selected: true, cantidad: 1, proveedorId } };
    });
  };
  const updateCantidadForBudget = (productId, cantidad) => {
    setSelectedForBudget(prev => ({ ...prev, [productId]: { ...prev[productId], cantidad: parseFloat(cantidad) || 0 } }));
  };
  const updateProveedorForBudget = (productId, proveedorId) => {
    setSelectedForBudget(prev => ({ ...prev, [productId]: { ...prev[productId], proveedorId } }));
  };
  const openBudgetModalForSelected = () => {
    const selectedIds = Object.keys(selectedForBudget);
    if (selectedIds.length === 0) { showToast('Seleccione al menos un producto', 'error'); return; }
    const missingProveedor = selectedIds.some(id => !selectedForBudget[id].proveedorId);
    if (missingProveedor) { showToast('Todos deben tener proveedor', 'error'); return; }
    const proveedorIds = [...new Set(selectedIds.map(id => selectedForBudget[id].proveedorId))];
    if (proveedorIds.length > 1) { showToast('Seleccione productos del mismo proveedor', 'error'); return; }
    const proveedor = proveedores.find(p => p.id === proveedorIds[0]);
    if (!proveedor) { showToast('Proveedor no encontrado', 'error'); return; }
    const productos = selectedIds.map(id => { const prod = products.find(p => p.id === parseInt(id)); return { ...prod, cantidad: selectedForBudget[id].cantidad }; });
    const texto = `Solicitud de cotización para ${proveedor.nombre}\n\n` +
      productos.map(p => `- ${p.nombre} (${p.presentacion}): ${p.cantidad} unidad(es) - Stock actual: ${p.stock_actual}, Stock mínimo: ${p.stock_minimo || 'N/A'}, Stock máximo: ${p.stock_maximo || 'N/A'}`).join('\n') +
      `\n\nPor favor, enviar presupuesto a: [tu email]`;
    setBudgetText(texto);
    setCurrentProveedor(proveedor);
    setShowBudgetModal(true);
  };
  const openIndividualBudget = (product, proveedorId) => {
    if (!proveedorId) { showToast('Seleccione un proveedor', 'error'); return; }
    const proveedor = proveedores.find(p => p.id === proveedorId);
    if (!proveedor) return;
    const texto = `Solicitud de cotización para ${proveedor.nombre}\n\n` +
      `- ${product.nombre} (${product.presentacion}): 1 unidad - Stock actual: ${product.stock_actual}, Stock mínimo: ${product.stock_minimo || 'N/A'}, Stock máximo: ${product.stock_maximo || 'N/A'}` +
      `\n\nPor favor, enviar presupuesto a: [tu email]`;
    setBudgetText(texto);
    setCurrentProveedor(proveedor);
    setShowBudgetModal(true);
  };
  const copyBudgetToClipboard = () => { navigator.clipboard.writeText(budgetText); showToast('Copiado', 'success'); };
  
  // ---------- CRUD Productos ----------
  const openCreateModal = () => {
    setEditingProduct(null);
    let defaultCategoria = activeTab === 'quimicos' ? 'quimicos' : 'otros';
    const saved = localStorage.getItem(PRODUCT_DRAFT_KEY);
    if (saved) try { const draft = JSON.parse(saved); setFormData({ ...draft, categoria: draft.categoria || defaultCategoria, stock_maximo: draft.stock_maximo || 0 }); }
    catch(e) { setFormData({ nombre: '', descripcion: '', presentacion: '', peso_kg: '', stock_actual: 0, stock_minimo: 0, stock_maximo: 0, proveedor: '', categoria: defaultCategoria }); }
    else setFormData({ nombre: '', descripcion: '', presentacion: '', peso_kg: '', stock_actual: 0, stock_minimo: 0, stock_maximo: 0, proveedor: '', categoria: defaultCategoria });
    setValidationError('');
    setShowProductModal(true);
  };
  const openEditModal = (product) => {
    setEditingProduct(product);
    setFormData({
      nombre: product.nombre,
      descripcion: product.descripcion || '',
      presentacion: product.presentacion,
      peso_kg: product.peso_kg,
      stock_actual: product.stock_actual,
      stock_minimo: product.stock_minimo || 0,
      stock_maximo: product.stock_maximo || 0,
      proveedor: product.proveedor || '',
      categoria: product.categoria || 'otros',
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
        descripcion: formData.descripcion || '',
        presentacion: formData.presentacion.trim(),
        categoria: formData.categoria,
        peso_kg: peso,
        stock_actual: Number(formData.stock_actual) || 0,
        stock_minimo: stockMinimo,
        stock_maximo: stockMaximo,
        proveedor: formData.proveedor || null,
      };
      if (editingProduct) await axios.put(`/inventario/products/${editingProduct.id}/`, payload);
      else await axios.post('/inventario/products/', payload);
      showToast(editingProduct ? 'Actualizado' : 'Creado', 'success');
      setShowProductModal(false);
      localStorage.removeItem(PRODUCT_DRAFT_KEY);
      fetchProducts();
    } catch { setValidationError('Error de red o validación'); }
    finally { setSubmitting(false); }
  };
  const confirmDelete = (product) => { setProductToDelete(product); setShowDeleteModal(true); };
  const handleDelete = async () => {
    if (!productToDelete) return;
    setSubmitting(true);
    try { await axios.delete(`/inventario/products/${productToDelete.id}/`); setShowDeleteModal(false); fetchProducts(); showToast('Eliminado', 'success'); }
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
  const toggleSelectAll = () => {
    const allSelected = Object.values(selectedProducts).every(v => v === true);
    const newSelection = {};
    Object.keys(selectedProducts).forEach(id => newSelection[id] = !allSelected);
    setSelectedProducts(newSelection);
  };
  const handleMultiDelete = async () => {
    const idsToDelete = Object.keys(selectedProducts).filter(id => selectedProducts[id]);
    if (idsToDelete.length === 0) return;
    if (!window.confirm(`¿Eliminar ${idsToDelete.length} item(s)?`)) return;
    setDeletingMultiple(true);
    let successCount = 0;
    const results = await Promise.allSettled(idsToDelete.map(id => axios.delete(`/inventario/products/${id}/`)));
    results.forEach(r => { if (r.status === 'fulfilled') successCount++; });
    showToast(`Eliminados: ${successCount}`, successCount > 0 ? 'success' : 'error');
    setShowMultiDeleteModal(false);
    fetchProducts();
    setDeletingMultiple(false);
  };
  
  // ---------- Importación de Excel estándar (ahora usa /products/upload_excel) ----------
  const downloadStandardTemplate = () => {
    const columnas = [
      'nombre', 'categoria', 'cantidad', 'unidad',
      'ubicacion', 'estado', 'serie_lote', 'observaciones'
    ];
    const ejemplo = [
      'Cloro 100%', 'quimicos', 1000, 'L',
      'Depósito Químicos', 'Bueno', 'LOTE-001', 'Producto líquido'
    ];
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
      fetchProducts();
    } catch (err) {
      setExcelFeedback({ type: 'error', message: err.response?.data?.error || 'Error en archivo excel.', errors: [] });
    } finally {
      setUploadingExcel(false);
      event.target.value = '';
    }
  };
  
  // ---------- Fórmulas BOM ----------
  const getFormulaFor = (quimicoId) => formulas.find(f => f.articulo_final_id === quimicoId);
  const openFormulaConfig = (quimico) => {
    const existing = getFormulaFor(quimico.id);
    setSelectedQuimico(quimico);
    if (existing) {
      setFormulaName(existing.nombre);
      setIngredients(existing.componentes.map(c => ({ insumo_id: c.insumo_id, cantidad: c.cantidad_requerida.toString(), obj: { id: c.insumo_id, nombre: c.insumo_nombre } })));
    } else {
      setFormulaName(`Fórmula de ${quimico.nombre}`);
      setIngredients([]);
    }
    setShowFormulaModal(true);
  };
  const saveFormula = async () => {
    if (!formulaName || ingredients.length === 0) { showToast('Nombre e ingredientes requeridos', 'error'); return; }
    const payload = { nombre: formulaName, articulo_final_id: selectedQuimico.id, activa: true, componentes: ingredients.map(ing => ({ insumo_id: ing.insumo_id, cantidad_requerida: parseFloat(ing.cantidad) })) };
    setSubmitting(true);
    try {
      const existing = getFormulaFor(selectedQuimico.id);
      if (existing) await axios.put(`/produccion/formulas/${existing.id}/`, payload);
      else await axios.post('/produccion/formulas/', payload);
      showToast('Fórmula guardada', 'success');
      setShowFormulaModal(false);
      fetchFormulas();
    } catch { showToast('Error al guardar', 'error'); }
    finally { setSubmitting(false); }
  };
  const deleteFormula = async (id) => {
    if (!window.confirm("¿Eliminar fórmula?")) return;
    try { await axios.delete(`/produccion/formulas/${id}/`); showToast("Eliminada", "success"); fetchFormulas(); }
    catch { showToast("Error", "error"); }
  };
  
  // ---------- MOVIMIENTOS Y LOGS ----------
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
      fetchProducts();
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.error || 'Error al registrar movimiento', 'error');
    } finally {
      setRegistrandoMovimiento(false);
    }
  };
  
  // ---------- Utilidades visuales ----------
  const getCardColorClass = (product) => {
    const stock = Number(product.stock_actual);
    const minStock = Number(product.stock_minimo) || 0;
    const maxStock = Number(product.stock_maximo) || 0;
    if (stock === 0) return 'bg-red-50';
    if (minStock > 0 && stock > 0 && stock <= minStock) return 'bg-yellow-50';
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
  
  const selectedCount = Object.values(selectedProducts).filter(v => v === true).length;
  const selectedBudgetCount = Object.keys(selectedForBudget).length;
  
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
        <div className={`fixed top-20 right-4 z-50 px-4 py-3 rounded-xl shadow-lg border flex items-center gap-3 animate-fadeIn ${toastMessage.type === 'error' ? 'bg-red-50 text-red-800 border-red-200' : 'bg-green-50 text-green-800 border-green-200'}`}>
          <i className={`bi ${toastMessage.type === 'error' ? 'bi-x-circle-fill' : 'bi-check-circle-fill'} text-lg`}></i>
          <span className="font-bold text-sm tracking-tight">{toastMessage.message}</span>
        </div>
      )}
      
      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          <button onClick={() => { setActiveTab('todo'); setSearchTerm(''); }} className={`py-4 px-1 text-center border-b-2 font-medium text-sm transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'todo' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
            <i className="bi bi-database-fill text-lg"></i> Todos los artículos
          </button>
          <button onClick={() => { setActiveTab('productos'); setSearchTerm(''); }} className={`py-4 px-1 text-center border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${activeTab === 'productos' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
            <i className="bi bi-box-seam text-lg"></i> Insumos y Productos
          </button>
          <button onClick={() => { setActiveTab('quimicos'); setSearchTerm(''); }} className={`py-4 px-1 text-center border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${activeTab === 'quimicos' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
            <i className="bi bi-flask-fill text-lg"></i> Químicos y Fórmulas
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
          <h2 className="text-2xl font-bold text-gray-900 leading-tight">
            {activeTab === 'todo' && 'Inventario completo'}
            {activeTab === 'productos' && 'Materia Prima e Insumos'}
            {activeTab === 'quimicos' && 'Catálogo de Químicos (BOM)'}
            {activeTab === 'proveedores' && 'Gestión de Proveedores'}
            {activeTab === 'abastecimiento' && 'Productos para Abastecer'}
          </h2>
          <p className="text-sm text-gray-500 mt-1">...</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto flex-wrap">
          {activeTab !== 'proveedores' && activeTab !== 'abastecimiento' && (
            <>
              <label className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-xl shadow-sm text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
                {uploadingExcel ? 'Subiendo...' : <><i className="bi bi-file-earmark-spreadsheet mr-1 text-green-600"></i> Importar Excel</>}
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelUpload} disabled={uploadingExcel} />
              </label>
              <button onClick={openMultiDeleteModal} className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-xl shadow-sm text-red-700 bg-white hover:bg-red-50">
                <i className="bi bi-trash mr-1"></i> Multi-Borrado
              </button>
              <button onClick={downloadStandardTemplate} className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-lg shadow-sm text-gray-700 bg-white hover:bg-gray-50">
                <i className="bi bi-download mr-1 text-emerald-600"></i> Plantilla Excel
              </button>
              <button onClick={openCreateModal} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-indigo-600 hover:bg-indigo-700">
                <i className="bi bi-plus-lg mr-1"></i> Nuevo artículo
              </button>
            </>
          )}
          {activeTab === 'proveedores' && (
            <>
              <button onClick={downloadProveedorTemplate} className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-xl shadow-sm text-gray-700 bg-white hover:bg-gray-50">
                <i className="bi bi-download mr-1 text-emerald-600"></i> Descargar plantilla
              </button>
              <label className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-xl shadow-sm text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
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
        <div className={`mb-4 p-3 rounded-md ${proveedorExcelFeedback.type === 'success' ? 'bg-green-50' : 'bg-red-50'}`}>
          <p className="text-sm font-medium">{proveedorExcelFeedback.message}</p>
          {proveedorExcelFeedback.errores?.length > 0 && (
            <ul className="mt-1 text-xs text-red-600 list-disc list-inside">
              {proveedorExcelFeedback.errores.slice(0, 5).map((err, i) => <li key={i}>{err}</li>)}
            </ul>
          )}
        </div>
      )}
      {excelFeedback && (
        <div className={`mb-4 p-3 rounded-md ${excelFeedback.type === 'success' ? 'bg-green-50' : 'bg-red-50'}`}>
          <p className="text-sm font-medium">{excelFeedback.message}</p>
          {excelFeedback.errors?.length > 0 && (
            <ul className="mt-1 text-xs text-red-600 list-disc list-inside">
              {excelFeedback.errors.slice(0, 5).map((err, i) => <li key={i}>{err}</li>)}
            </ul>
          )}
        </div>
      )}
      
      {/* Search */}
      <div className="mb-6 relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><i className="bi bi-search text-gray-400"></i></div>
        <input type="text" placeholder={activeTab === 'proveedores' ? 'Buscar proveedor...' : activeTab === 'abastecimiento' ? 'Buscar producto crítico...' : `Buscar en ${activeTab === 'quimicos' ? 'Químicos' : activeTab === 'todo' ? 'todo el inventario' : 'Productos'}...`}
          value={activeTab === 'abastecimiento' ? criticosSearchTerm : searchTerm}
          onChange={(e) => { if (activeTab === 'abastecimiento') setCriticosSearchTerm(e.target.value); else setSearchTerm(e.target.value); }}
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-xl bg-white focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
      </div>
      
      {/* Listados de artículos (todo, quimicos, productos) */}
      {(activeTab === 'todo' || activeTab === 'quimicos' || activeTab === 'productos') && (
        <>
          {loading ? <div className="flex justify-center py-20"><LogoSpinner size="w-12 h-12" /></div> :
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredProducts.map(product => {
                const formula = activeTab === 'quimicos' ? getFormulaFor(product.id) : null;
                const cardBg = getCardColorClass(product);
                const barColor = getStockBarColor(product);
                const borderColor = getCardBorderColor(product);
                const stockNum = Number(product.stock_actual);
                const minStockNum = Number(product.stock_minimo) || 0;
                const maxStockNum = Number(product.stock_maximo) || 0;
                return (
                  <div key={product.id} className={`rounded-xl shadow-sm border overflow-hidden hover:shadow-lg transition-shadow flex flex-col group ${cardBg} dark:bg-slate-800 ${borderColor} dark:border-slate-700`}>
                    <div className="p-5 flex-1 relative">
                      <div className={`absolute top-0 left-0 w-1.5 h-full ${barColor}`}></div>
                      <div className="pl-2">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-tight group-hover:text-indigo-600 transition-colors">{product.nombre}</h3>
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => openEditModal(product)} className="text-indigo-300 hover:text-indigo-600" title="Editar"><i className="bi bi-pencil-square"></i></button>
                            <button onClick={() => confirmDelete(product)} className="text-red-300 hover:text-red-600" title="Eliminar"><i className="bi bi-trash"></i></button>
                            <button onClick={() => openMovimientosModal(product)} className="text-blue-300 hover:text-blue-600 ml-1" title="Ver movimientos"><i className="bi bi-clock-history"></i></button>
                            <button onClick={() => fetchLogs(product.id)} className="text-gray-400 hover:text-gray-600 ml-1" title="Ver historial de cambios"><i className="bi bi-file-text"></i></button>
                            <button onClick={() => setMovimientoModal({ open: true, producto: product, tipo: 'INGRESO', cantidad: 1, razon: '' })} className="text-emerald-500 hover:text-emerald-700 ml-1" title="Registrar movimiento"><i className="bi bi-plus-circle"></i></button>
                          </div>
                        </div>
                        <div className="text-xs sm:text-sm text-gray-600 dark:text-slate-300 space-y-1 mb-3">
                          <p><span className="font-semibold text-gray-400">Presentación:</span> {product.presentacion}</p>
                          <p><span className="font-semibold text-gray-400">Peso Base:</span> {parseFloat(product.peso_kg).toFixed(2)} kg</p>
                          {product.categoria && <p><span className="font-semibold text-gray-400">Categoría:</span> {product.categoria}</p>}
                          {product.proveedor_nombre && <p><span className="font-semibold text-gray-400">Proveedor:</span> {product.proveedor_nombre}</p>}
                          <p><span className="font-semibold text-gray-400">Stock Actual:</span> 
                            <span className={`ml-1 font-bold ${stockNum === 0 ? 'text-red-600' : (minStockNum > 0 && stockNum <= minStockNum ? 'text-yellow-700' : (maxStockNum > 0 && stockNum >= maxStockNum ? 'text-orange-600' : 'text-green-600'))}`}>
                              {stockNum.toFixed(2)}
                            </span>
                          </p>
                          {minStockNum > 0 && <p className="text-xs text-gray-500"><span className="font-semibold text-gray-400">Stock Mínimo:</span> {minStockNum.toFixed(2)}</p>}
                          {maxStockNum > 0 && <p className="text-xs text-gray-500"><span className="font-semibold text-gray-400">Stock Máximo:</span> {maxStockNum.toFixed(2)}</p>}
                        </div>
                        {activeTab === 'quimicos' && (
                          <div className="mt-4 pt-4 border-t border-gray-100">
                            {formula ? (
                              <div><div className="flex items-center justify-between mb-2"><span className="text-[10px] bg-green-100 text-green-800 font-extrabold uppercase px-2 py-0.5 rounded-md">BOM Activo</span><button onClick={() => deleteFormula(formula.id)} className="text-[10px] text-red-500 hover:underline">Revocar</button></div>
                              <ul className="text-xs text-gray-500 space-y-0.5 max-h-16 overflow-hidden">{formula.componentes.slice(0, 2).map((c, i) => <li key={i} className="truncate">• {c.insumo_nombre}</li>)}</ul></div>
                            ) : <span className="text-[10px] bg-amber-100 text-amber-800 font-extrabold uppercase px-2 py-0.5 rounded-md inline-block mb-2">Sin Receta</span>}
                            <button onClick={() => openFormulaConfig(product)} className="w-full mt-2 py-1.5 bg-slate-50 hover:bg-slate-100 text-indigo-600 text-xs font-bold rounded-lg transition-colors border border-slate-200">{formula ? 'Modificar Fórmula' : 'Crear Fórmula'}</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          }
          {filteredProducts.length === 0 && !loading && <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-gray-300"><p className="text-gray-500">No se encontraron registros.</p></div>}
        </>
      )}
      
      {/* Listado de Proveedores */}
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
      
      {/* Abastecimiento */}
      {activeTab === 'abastecimiento' && (
        <>
          {loading ? <div className="flex justify-center py-20"><LogoSpinner size="w-12 h-12" /></div> :
            <>
              {selectedBudgetCount > 0 && (
                <div className="mb-4 p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex justify-between items-center border border-indigo-100">
                  <span className="text-sm font-medium text-indigo-800">{selectedBudgetCount} producto(s) seleccionado(s)</span>
                  <button onClick={openBudgetModalForSelected} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm">Solicitar presupuesto</button>
                </div>
              )}
              <div className="grid grid-cols-1 gap-4">
                {filteredCriticos.map(product => {
                  const stockNum = Number(product.stock_actual);
                  const minStockNum = Number(product.stock_minimo) || 0;
                  const isSelected = !!selectedForBudget[product.id];
                  const selectedProveedorId = selectedForBudget[product.id]?.proveedorId || '';
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
                            <div className="w-48"><label className="block text-xs text-gray-500">Proveedor</label><select value={selectedProveedorId} onChange={(e) => updateProveedorForBudget(product.id, e.target.value)} className="w-full px-2 py-1 border rounded"><option value="">Seleccionar</option>{proveedores.map(prov => <option key={prov.id} value={prov.id}>{prov.nombre}</option>)}</select></div>
                            <div className="flex gap-2">
                              <button onClick={() => toggleSelectForBudget(product.id, selectedProveedorId)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isSelected ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{isSelected ? 'Seleccionado' : 'Seleccionar'}</button>
                              <button onClick={() => openIndividualBudget(product, selectedProveedorId)} disabled={!selectedProveedorId} className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-200 disabled:opacity-50"><i className="bi bi-envelope-paper me-1"></i>Presupuesto</button>
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
      
      {/* ===== MODALES (sin cambios, se mantienen) ===== */}
      
      {/* Modal Proveedor */}
      {showProveedorModal && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowProveedorModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50"><h3 className="text-lg font-bold">{editingProveedor ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h3><button onClick={() => setShowProveedorModal(false)}><i className="bi bi-x-lg"></i></button></div>
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              <form onSubmit={handleProveedorSubmit} className="space-y-4">
                {[{ label: 'Razón Social *', field: 'nombre' }, { label: 'Contacto', field: 'contacto' }, { label: 'Teléfono', field: 'telefono' }, { label: 'Email', field: 'email' }, { label: 'Rubro', field: 'rubro' }].map(({ label, field }) => (
                  <div key={field}><label className="block text-sm font-bold mb-1">{label}</label><input type="text" value={proveedorForm[field]} onChange={e => setProveedorForm({...proveedorForm, [field]: e.target.value})} className="w-full border rounded-lg px-3 py-2" required={field === 'nombre'} /></div>
                ))}
                <div><label className="block text-sm font-bold mb-1">Dirección</label><textarea value={proveedorForm.direccion} onChange={e => setProveedorForm({...proveedorForm, direccion: e.target.value})} rows={2} className="w-full border rounded-lg px-3 py-2" /></div>
                <div><label className="block text-sm font-bold mb-1">Condición de Pago</label><select value={proveedorForm.condicion_pago} onChange={e => setProveedorForm({...proveedorForm, condicion_pago: e.target.value})} className="w-full border rounded-lg px-3 py-2">{condicionPagoOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div>
                <div className="flex justify-end gap-3 pt-4"><button type="button" onClick={() => setShowProveedorModal(false)} className="px-4 py-2 border rounded-lg">Cancelar</button><button type="submit" disabled={submittingProveedor} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">{submittingProveedor ? 'Guardando...' : 'Guardar'}</button></div>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}
      
      {/* Modal Producto */}
      {showProductModal && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowProductModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50"><h3 className="text-lg font-bold">{editingProduct ? 'Editar registro' : 'Nuevo artículo'}</h3><button onClick={() => setShowProductModal(false)}><i className="bi bi-x-lg"></i></button></div>
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {validationError && <div className="mb-4 text-xs font-bold text-red-600 bg-red-50 p-2 rounded">{validationError}</div>}
              <form onSubmit={handleProductSubmit} className="space-y-4">
                <div><label className="block text-sm font-bold mb-1">Nombre *</label><input type="text" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="w-full border rounded-lg px-3 py-2" required /></div>
                <div><label className="block text-sm font-bold mb-1">Descripción</label><input type="text" value={formData.descripcion} onChange={e => setFormData({...formData, descripcion: e.target.value})} className="w-full border rounded-lg px-3 py-2" /></div>
                <div><label className="block text-sm font-bold mb-1">Presentación *</label><input type="text" value={formData.presentacion} onChange={e => setFormData({...formData, presentacion: e.target.value})} className="w-full border rounded-lg px-3 py-2" required placeholder="Ej: Tambor 200L" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-bold mb-1">Peso Base (kg) *</label><input type="number" step="0.01" value={formData.peso_kg} onChange={e => setFormData({...formData, peso_kg: e.target.value})} className="w-full border rounded-lg px-3 py-2" required /></div>
                  <div><label className="block text-sm font-bold mb-1">Stock Físico</label><input type="number" step="0.01" value={formData.stock_actual} onChange={e => setFormData({...formData, stock_actual: e.target.value})} className="w-full border rounded-lg px-3 py-2" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-bold mb-1">Stock Mínimo</label><input type="number" step="0.01" min="0" value={formData.stock_minimo} onChange={e => setFormData({...formData, stock_minimo: e.target.value})} className="w-full border rounded-lg px-3 py-2" placeholder="Alerta amarilla" /></div>
                  <div><label className="block text-sm font-bold mb-1">Stock Máximo</label><input type="number" step="0.01" min="0" value={formData.stock_maximo} onChange={e => setFormData({...formData, stock_maximo: e.target.value})} className="w-full border rounded-lg px-3 py-2" placeholder="Alerta naranja" /></div>
                </div>
                <div><label className="block text-sm font-bold mb-1">Categoría</label><select value={formData.categoria} onChange={e => setFormData({...formData, categoria: e.target.value})} className="w-full border rounded-lg px-3 py-2">{categoriaOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div>
                <div><label className="block text-sm font-bold mb-1">Proveedor (opcional)</label><AutocompleteCreate endpoint="/inventario/proveedores/" value={formData.proveedor} onSelect={(item) => setFormData({...formData, proveedor: item?.id || ''})} nameField="nombre" placeholder="Seleccionar o crear proveedor..." createFields={[{ name: 'nombre', label: 'Razón Social', required: true }, { name: 'contacto', label: 'Contacto' }, { name: 'telefono', label: 'Teléfono' }, { name: 'email', label: 'Email' }, { name: 'direccion', label: 'Dirección' }, { name: 'rubro', label: 'Rubro' }, { name: 'condicion_pago', label: 'Condición de Pago', type: 'select', options: condicionPagoOptions }]} extraCreateData={{}} /></div>
                <div className="flex justify-end gap-3 pt-4"><button type="button" onClick={() => setShowProductModal(false)} className="px-4 py-2 border rounded-lg">Cancelar</button><button type="submit" disabled={submitting} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">{submitting ? 'Guardando...' : 'Guardar'}</button></div>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}
      
      {/* Modal Presupuesto */}
      {showBudgetModal && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowBudgetModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b bg-indigo-50 flex justify-between items-center"><h3 className="text-lg font-black">Solicitar presupuesto a {currentProveedor?.nombre}</h3><button onClick={() => setShowBudgetModal(false)}><i className="bi bi-x-lg"></i></button></div>
            <div className="p-6 flex-1 overflow-y-auto"><textarea rows={12} value={budgetText} onChange={(e) => setBudgetText(e.target.value)} className="w-full border rounded-lg p-3 font-mono text-sm"></textarea><div className="flex justify-end gap-3 mt-4"><button onClick={copyBudgetToClipboard} className="px-4 py-2 bg-emerald-600 text-white rounded-lg">Copiar</button><button onClick={() => setShowBudgetModal(false)} className="px-4 py-2 bg-gray-200 rounded-lg">Cerrar</button></div></div>
          </div>
        </div>,
        document.body
      )}
      
      {/* Modal Eliminación Individual */}
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
      
      {/* Modal Eliminación Múltiple */}
      {showMultiDeleteModal && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowMultiDeleteModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b bg-red-50"><h3 className="text-lg font-black text-red-800">Eliminación Masiva</h3></div>
            <div className="p-4 overflow-y-auto flex-1"><table className="w-full text-sm"><thead><tr><th className="p-2"><input type="checkbox" checked={selectedCount > 0 && selectedCount === filteredProducts.length} onChange={toggleSelectAll} /></th><th className="p-2">Nombre</th></tr></thead><tbody>{filteredProducts.map(p => (<tr key={p.id}><td className="p-2"><input type="checkbox" checked={selectedProducts[p.id] || false} onChange={() => toggleSelectProduct(p.id)} /></td><td className="p-2 font-medium">{p.nombre}</td></tr>))}</tbody></table></div>
            <div className="p-4 border-t flex justify-between items-center bg-gray-50"><span className="text-xs font-bold">{selectedCount} elegidos</span><div className="flex gap-2"><button onClick={() => setShowMultiDeleteModal(false)} className="px-4 py-2 border rounded-lg">Cancelar</button><button onClick={handleMultiDelete} disabled={selectedCount===0 || deletingMultiple} className="px-4 py-2 bg-red-600 text-white rounded-lg">Borrar</button></div></div>
          </div>
        </div>,
        document.body
      )}
      
      {/* Modal BOM */}
      {showFormulaModal && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowFormulaModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b bg-indigo-50 flex justify-between items-center"><h3 className="text-lg font-black">BOM: {selectedQuimico?.nombre}</h3><button onClick={() => setShowFormulaModal(false)}><i className="bi bi-x-lg"></i></button></div>
            <div className="p-6 flex-1 overflow-y-auto">
              <div className="mb-4"><label className="block text-xs font-bold uppercase">Nombre de la Receta</label><input type="text" value={formulaName} onChange={e => setFormulaName(e.target.value)} className="w-full border rounded-lg px-3 py-2" /></div>
              <div className="mb-4 flex justify-between items-end"><label className="text-xs font-bold uppercase">Ingredientes</label><button onClick={() => setIngredients([...ingredients, { insumo_id: '', cantidad: '' }])} className="text-xs bg-indigo-50 px-3 py-1.5 rounded-lg">+ Agregar</button></div>
              <div className="space-y-3">{ingredients.map((ing, idx) => (
                <div key={idx} className="flex gap-2 items-start bg-slate-50 p-2 rounded-xl">
                  <div className="flex-1"><AutocompleteCreate label="Insumo" endpoint="/inventario/products/?categoria=otros" value={ing.insumo_id} nameField="nombre" onSelect={(item) => { const newIng = [...ingredients]; newIng[idx].insumo_id = item.id; setIngredients(newIng); }} createFields={[]} extraCreateData={{ categoria: 'otros' }} /></div>
                  <div className="w-24"><label className="block text-[10px] font-bold">Cant.</label><input type="number" step="0.01" value={ing.cantidad} onChange={e => { const newIng = [...ingredients]; newIng[idx].cantidad = e.target.value; setIngredients(newIng); }} className="w-full border rounded px-2 py-1" /></div>
                  <div className="pt-5"><button onClick={() => { const newIng = [...ingredients]; newIng.splice(idx, 1); setIngredients(newIng); }} className="text-red-400"><i className="bi bi-trash"></i></button></div>
                </div>
              ))}</div>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3 bg-gray-50"><button onClick={() => setShowFormulaModal(false)} className="px-4 py-2 border rounded-lg">Cancelar</button><button onClick={saveFormula} disabled={submitting} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Guardar</button></div>
          </div>
        </div>,
        document.body
      )}
      
      {/* Modal Movimientos por producto */}
      {movimientosModal.open && createPortal(
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-4" onClick={() => setMovimientosModal({ open: false, producto: null, movimientos: [], loading: false, filters: { tipo: '', fecha_desde: '', fecha_hasta: '' }, page: 1, totalPages: 1, exportando: false })}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b bg-indigo-50 flex justify-between items-center shrink-0"><h3 className="text-xl font-black">Movimientos de {movimientosModal.producto?.nombre}</h3><button onClick={() => setMovimientosModal(prev => ({ ...prev, open: false }))}><i className="bi bi-x-lg text-xl"></i></button></div>
            <div className="p-4 flex gap-2 flex-wrap border-b shrink-0">
              <select className="px-3 py-1.5 border rounded-lg text-sm" value={movimientosModal.filters.tipo} onChange={e => fetchMovimientos(movimientosModal.producto?.id, 1, { ...movimientosModal.filters, tipo: e.target.value })}>
                <option value="">Todos los tipos</option><option value="INGRESO">Ingreso</option><option value="SALIDA">Salida</option><option value="AJUSTE">Ajuste</option>
              </select>
              <input type="date" className="px-3 py-1.5 border rounded-lg text-sm" value={movimientosModal.filters.fecha_desde} onChange={e => fetchMovimientos(movimientosModal.producto?.id, 1, { ...movimientosModal.filters, fecha_desde: e.target.value })} />
              <input type="date" className="px-3 py-1.5 border rounded-lg text-sm" value={movimientosModal.filters.fecha_hasta} onChange={e => fetchMovimientos(movimientosModal.producto?.id, 1, { ...movimientosModal.filters, fecha_hasta: e.target.value })} />
              <button onClick={() => exportMovimientos(movimientosModal.producto?.id, 'excel')} disabled={movimientosModal.exportando} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm">Exportar Excel</button>
              <button onClick={() => exportMovimientos(movimientosModal.producto?.id, 'csv')} disabled={movimientosModal.exportando} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm">Exportar CSV</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {movimientosModal.loading ? <div className="flex justify-center py-20"><LogoSpinner size="w-10 h-10" /></div> : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50"><tr><th className="px-4 py-3 text-left text-xs font-medium">Fecha</th><th className="px-4 py-3 text-left text-xs font-medium">Tipo</th><th className="px-4 py-3 text-left text-xs font-medium">Cantidad</th><th className="px-4 py-3 text-left text-xs font-medium">Stock resultante</th><th className="px-4 py-3 text-left text-xs font-medium">Razón</th><th className="px-4 py-3 text-left text-xs font-medium">Operación</th></tr></thead>
                    <tbody className="divide-y divide-gray-200">
                      {movimientosModal.movimientos.map(m => (
                        <tr key={m.id}>
                          <td className="px-4 py-2 text-sm">{new Date(m.fecha).toLocaleString()}</td>
                          <td className="px-4 py-2 text-sm"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${m.tipo === 'INGRESO' ? 'bg-green-100 text-green-800' : m.tipo === 'SALIDA' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>{m.tipo}</span></td>
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
            <div className="p-4 border-t flex justify-between items-center bg-gray-50 shrink-0">
              <button disabled={movimientosModal.page <= 1} onClick={() => fetchMovimientos(movimientosModal.producto?.id, movimientosModal.page - 1, movimientosModal.filters)} className="px-3 py-1.5 border rounded-lg disabled:opacity-50">Anterior</button>
              <span className="text-sm">Página {movimientosModal.page} de {movimientosModal.totalPages}</span>
              <button disabled={movimientosModal.page >= movimientosModal.totalPages} onClick={() => fetchMovimientos(movimientosModal.producto?.id, movimientosModal.page + 1, movimientosModal.filters)} className="px-3 py-1.5 border rounded-lg disabled:opacity-50">Siguiente</button>
            </div>
          </div>
        </div>,
        document.body
      )}
      
      {/* Modal Logs */}
      {logsModal.open && createPortal(
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-4" onClick={() => setLogsModal({ open: false, producto: null, logs: [], loading: false })}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center shrink-0"><h3 className="text-xl font-black">Historial de cambios - {logsModal.producto?.nombre}</h3><button onClick={() => setLogsModal(prev => ({ ...prev, open: false }))}><i className="bi bi-x-lg text-xl"></i></button></div>
            <div className="flex-1 overflow-y-auto p-4">
              {logsModal.loading ? <div className="flex justify-center py-20"><LogoSpinner size="w-10 h-10" /></div> : (
                <div className="space-y-4">
                  {logsModal.logs.map(log => (
                    <div key={log.id} className="border rounded-lg p-4 bg-white">
                      <div className="flex justify-between text-sm text-gray-500"><span>{new Date(log.fecha).toLocaleString()}</span><span>Usuario: {log.usuario_nombre || 'Sistema'}</span><span>IP: {log.ip || '-'}</span></div>
                      <p className="font-bold mt-2 text-gray-800">{log.accion === 'CREATE' ? 'Creación' : log.accion === 'UPDATE' ? 'Actualización' : 'Eliminación'}</p>
                      {log.campos_modificados && Object.keys(log.campos_modificados).length > 0 && (
                        <details className="mt-2"><summary className="text-xs cursor-pointer text-indigo-600">Ver detalles</summary><ul className="mt-1 text-xs text-gray-600 list-disc list-inside">{Object.entries(log.campos_modificados).map(([campo, val]) => <li key={campo}><strong>{campo}:</strong> {val.old} → {val.new}</li>)}</ul></details>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {logsModal.logs.length === 0 && !logsModal.loading && <p className="text-center text-gray-500 py-10">No hay registros de cambios.</p>}
            </div>
            <div className="p-4 border-t flex justify-end bg-gray-50 shrink-0"><button onClick={() => setLogsModal(prev => ({ ...prev, open: false }))} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Cerrar</button></div>
          </div>
        </div>,
        document.body
      )}
      
      {/* Modal Movimientos Globales */}
      {movimientosGlobal.open && createPortal(
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-4" onClick={() => setMovimientosGlobal(prev => ({ ...prev, open: false }))}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b bg-indigo-50 flex justify-between items-center shrink-0"><h3 className="text-xl font-black">Informe general de movimientos</h3><button onClick={() => setMovimientosGlobal(prev => ({ ...prev, open: false }))}><i className="bi bi-x-lg text-xl"></i></button></div>
            <div className="p-4 flex gap-2 flex-wrap border-b shrink-0">
              <input type="text" placeholder="ID Producto" className="px-3 py-1.5 border rounded-lg text-sm w-32" value={movimientosGlobal.filters.articulo_id} onChange={e => setMovimientosGlobal(prev => ({ ...prev, filters: { ...prev.filters, articulo_id: e.target.value } }))} />
              <select className="px-3 py-1.5 border rounded-lg text-sm" value={movimientosGlobal.filters.tipo} onChange={e => setMovimientosGlobal(prev => ({ ...prev, filters: { ...prev.filters, tipo: e.target.value } }))}><option value="">Todos los tipos</option><option value="INGRESO">Ingreso</option><option value="SALIDA">Salida</option><option value="AJUSTE">Ajuste</option></select>
              <input type="date" className="px-3 py-1.5 border rounded-lg text-sm" value={movimientosGlobal.filters.fecha_desde} onChange={e => setMovimientosGlobal(prev => ({ ...prev, filters: { ...prev.filters, fecha_desde: e.target.value } }))} />
              <input type="date" className="px-3 py-1.5 border rounded-lg text-sm" value={movimientosGlobal.filters.fecha_hasta} onChange={e => setMovimientosGlobal(prev => ({ ...prev, filters: { ...prev.filters, fecha_hasta: e.target.value } }))} />
              <button onClick={() => openMovimientosGlobal(1)} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm">Filtrar</button>
              <button onClick={() => exportMovimientos(null, 'excel')} disabled={movimientosGlobal.exportando} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm">Exportar Excel</button>
              <button onClick={() => exportMovimientos(null, 'csv')} disabled={movimientosGlobal.exportando} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm">Exportar CSV</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {movimientosGlobal.loading ? <div className="flex justify-center py-20"><LogoSpinner size="w-10 h-10" /></div> : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50"><tr><th className="px-4 py-3 text-left text-xs font-medium">Fecha</th><th className="px-4 py-3 text-left text-xs font-medium">Producto</th><th className="px-4 py-3 text-left text-xs font-medium">Tipo</th><th className="px-4 py-3 text-left text-xs font-medium">Cantidad</th><th className="px-4 py-3 text-left text-xs font-medium">Stock resultante</th><th className="px-4 py-3 text-left text-xs font-medium">Razón</th><th className="px-4 py-3 text-left text-xs font-medium">Operación</th></tr></thead>
                    <tbody className="divide-y divide-gray-200">
                      {movimientosGlobal.movimientos.map(m => (
                        <tr key={m.id}>
                          <td className="px-4 py-2 text-sm">{new Date(m.fecha).toLocaleString()}</td>
                          <td className="px-4 py-2 text-sm">{m.articulo_nombre}</td>
                          <td className="px-4 py-2 text-sm"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${m.tipo === 'INGRESO' ? 'bg-green-100 text-green-800' : m.tipo === 'SALIDA' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>{m.tipo}</span></td>
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
            <div className="p-4 border-t flex justify-between items-center bg-gray-50 shrink-0">
              <button disabled={movimientosGlobal.page <= 1} onClick={() => openMovimientosGlobal(movimientosGlobal.page - 1)} className="px-3 py-1.5 border rounded-lg disabled:opacity-50">Anterior</button>
              <span className="text-sm">Página {movimientosGlobal.page} de {movimientosGlobal.totalPages}</span>
              <button disabled={movimientosGlobal.page >= movimientosGlobal.totalPages} onClick={() => openMovimientosGlobal(movimientosGlobal.page + 1)} className="px-3 py-1.5 border rounded-lg disabled:opacity-50">Siguiente</button>
            </div>
          </div>
        </div>,
        document.body
      )}
      
      {/* Modal Registrar Movimiento Rápido */}
      {movimientoModal.open && createPortal(
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-4" onClick={() => setMovimientoModal(prev => ({ ...prev, open: false }))}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b bg-emerald-50 flex justify-between items-center">
              <h3 className="text-lg font-black">Registrar movimiento - {movimientoModal.producto?.nombre}</h3>
              <button onClick={() => setMovimientoModal(prev => ({ ...prev, open: false }))} className="text-gray-500 hover:text-gray-700"><i className="bi bi-x-lg text-xl"></i></button>
            </div>
            <div className="p-6 space-y-4">
              <div><label className="block text-sm font-bold mb-1">Tipo</label>
                <select value={movimientoModal.tipo} onChange={e => setMovimientoModal(prev => ({ ...prev, tipo: e.target.value }))} className="w-full border rounded-lg px-3 py-2">
                  <option value="INGRESO">Ingreso</option>
                  <option value="SALIDA">Salida</option>
                  <option value="AJUSTE">Ajuste (setea stock)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">{movimientoModal.tipo === 'INGRESO' ? 'Aumenta el stock' : movimientoModal.tipo === 'SALIDA' ? 'Reduce el stock' : 'Establece el stock exacto'}</p>
              </div>
              <div><label className="block text-sm font-bold mb-1">Cantidad</label><input type="number" step="0.01" value={movimientoModal.cantidad} onChange={e => setMovimientoModal(prev => ({ ...prev, cantidad: parseFloat(e.target.value) || 0 }))} className="w-full border rounded-lg px-3 py-2" /></div>
              <div><label className="block text-sm font-bold mb-1">Razón</label><textarea value={movimientoModal.razon} onChange={e => setMovimientoModal(prev => ({ ...prev, razon: e.target.value }))} rows={2} className="w-full border rounded-lg px-3 py-2" placeholder="Ej: Compra, Devolución, Ajuste..." /></div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setMovimientoModal(prev => ({ ...prev, open: false }))} className="px-4 py-2 border rounded-lg">Cancelar</button>
                <button onClick={registrarMovimiento} disabled={registrandoMovimiento} className="px-4 py-2 bg-emerald-600 text-white rounded-lg">{registrandoMovimiento ? 'Registrando...' : 'Registrar'}</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
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