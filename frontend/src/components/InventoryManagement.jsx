import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from '../api/axios';
import AutocompleteCreate from './AutocompleteCreate';
import LogoSpinner from './LogoSpinner';

export default function InventoryManagement() {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('productos'); // 'productos', 'quimicos', 'proveedores', 'abastecimiento'
  const [loading, setLoading] = useState(true);
  
  // ================= ESTADOS PARA PROVEEDORES =================
  const [proveedores, setProveedores] = useState([]);
  const [filteredProveedores, setFilteredProveedores] = useState([]);
  const [showProveedorModal, setShowProveedorModal] = useState(false);
  const [editingProveedor, setEditingProveedor] = useState(null);
  const [proveedorForm, setProveedorForm] = useState({
    nombre: '',
    contacto: '',
    telefono: '',
    email: '',
    direccion: '',
    rubro: '',
    condicion_pago: 'contado',
  });
  const [submittingProveedor, setSubmittingProveedor] = useState(false);
  
  // Estados para abastecimiento
  const [productosCriticos, setProductosCriticos] = useState([]);
  const [selectedForBudget, setSelectedForBudget] = useState({}); // { productId: { selected: true, cantidad: number, proveedorId: string } }
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetText, setBudgetText] = useState('');
  const [currentProveedor, setCurrentProveedor] = useState(null);

  // Modal de creación/edición de producto
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    presentacion: '',
    peso_kg: '',
    stock_actual: 0,
    stock_minimo: 0,
    proveedor: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');
  
  // Eliminación individual producto
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);
  
  // Eliminación múltiple producto
  const [showMultiDeleteModal, setShowMultiDeleteModal] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState({});
  const [deletingMultiple, setDeletingMultiple] = useState(false);
  
  const [uploadingExcel, setUploadingExcel] = useState(false);
  const [excelFeedback, setExcelFeedback] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Fórmulas BOM
  const [formulas, setFormulas] = useState([]);
  const [showFormulaModal, setShowFormulaModal] = useState(false);
  const [selectedQuimico, setSelectedQuimico] = useState(null);
  const [formulaName, setFormulaName] = useState('');
  const [ingredients, setIngredients] = useState([]); 

  const showToast = (message, type = 'info') => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/inventario/products/');
      setProducts(res.data);
      if (activeTab === 'quimicos') {
         await fetchFormulas();
      }
    } catch (err) {
      console.error(err);
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
      console.error(err);
      showToast('Error al cargar proveedores', 'error');
    }
  };

  const fetchFormulas = async () => {
    try {
        const res = await axios.get('/produccion/formulas/');
        setFormulas(res.data);
    } catch (err) {
        console.error(err);
    }
  };

  // Calcular productos críticos (stock bajo o cero) para la pestaña Abastecimiento
  const calcularProductosCriticos = () => {
    const criticos = products.filter(p => {
      const stock = Number(p.stock_actual);
      const minStock = Number(p.stock_minimo) || 0;
      return stock === 0 || (minStock > 0 && stock <= minStock);
    });
    setProductosCriticos(criticos);
  };

  useEffect(() => {
    if (activeTab === 'abastecimiento') {
      calcularProductosCriticos();
    }
  }, [products, activeTab]);

  useEffect(() => {
    if (activeTab === 'proveedores') {
      fetchProveedores();
    } else if (activeTab !== 'abastecimiento') {
      fetchProducts();
    } else {
      // Si es abastecimiento, igual cargamos productos (necesario para calcular críticos)
      fetchProducts();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'proveedores') return;
    if (activeTab === 'abastecimiento') return; // el filtro de abastecimiento es aparte
    let filtered = products.filter(p => p.categoria === (activeTab === 'quimicos' ? 'quimicos' : 'otros'));
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

  // Filtro para abastecimiento (por búsqueda)
  const [criticosSearchTerm, setCriticosSearchTerm] = useState('');
  const filteredCriticos = productosCriticos.filter(p => {
    if (!criticosSearchTerm) return true;
    const term = criticosSearchTerm.toLowerCase();
    return p.nombre.toLowerCase().includes(term) || p.presentacion.toLowerCase().includes(term);
  });

  useEffect(() => {
    if (showProductModal || showDeleteModal || showMultiDeleteModal || showFormulaModal || showProveedorModal || showBudgetModal) {
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = '0px';
    } else {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    };
  }, [showProductModal, showDeleteModal, showMultiDeleteModal, showFormulaModal, showProveedorModal, showBudgetModal]);

  // ================= CRUD PROVEEDORES =================
  const openCreateProveedor = () => {
    setEditingProveedor(null);
    setProveedorForm({ 
      nombre: '', contacto: '', telefono: '', email: '', direccion: '', 
      rubro: '', condicion_pago: 'contado' 
    });
    setShowProveedorModal(true);
  };

  const openEditProveedor = (prov) => {
    setEditingProveedor(prov);
    setProveedorForm({
      nombre: prov.nombre,
      contacto: prov.contacto || '',
      telefono: prov.telefono || '',
      email: prov.email || '',
      direccion: prov.direccion || '',
      rubro: prov.rubro || '',
      condicion_pago: prov.condicion_pago || 'contado',
    });
    setShowProveedorModal(true);
  };

  const handleProveedorSubmit = async (e) => {
    e.preventDefault();
    if (!proveedorForm.nombre.trim()) {
      showToast('El nombre es obligatorio', 'error');
      return;
    }
    setSubmittingProveedor(true);
    try {
      if (editingProveedor) {
        await axios.put(`/inventario/proveedores/${editingProveedor.id}/`, proveedorForm);
        showToast('Proveedor actualizado', 'success');
      } else {
        await axios.post('/inventario/proveedores/', proveedorForm);
        showToast('Proveedor creado', 'success');
      }
      setShowProveedorModal(false);
      fetchProveedores();
    } catch (err) {
      console.error(err);
      showToast('Error al guardar proveedor', 'error');
    } finally {
      setSubmittingProveedor(false);
    }
  };

  const deleteProveedor = async (id, nombre) => {
    if (!window.confirm(`¿Eliminar proveedor "${nombre}"?`)) return;
    try {
      await axios.delete(`/inventario/proveedores/${id}/`);
      showToast('Proveedor eliminado', 'success');
      fetchProveedores();
    } catch {
      showToast('Error: tiene productos asociados', 'error');
    }
  };

  // ================= FUNCIONES PARA SOLICITAR PRESUPUESTO (Abastecimiento) =================
  const toggleSelectForBudget = (productId, proveedorId = '') => {
    setSelectedForBudget(prev => {
      const wasSelected = !!prev[productId];
      if (wasSelected) {
        const newState = { ...prev };
        delete newState[productId];
        return newState;
      } else {
        return {
          ...prev,
          [productId]: { selected: true, cantidad: 1, proveedorId: proveedorId }
        };
      }
    });
  };

  const updateCantidadForBudget = (productId, cantidad) => {
    setSelectedForBudget(prev => ({
      ...prev,
      [productId]: { ...prev[productId], cantidad: parseFloat(cantidad) || 0 }
    }));
  };

  const updateProveedorForBudget = (productId, proveedorId) => {
    setSelectedForBudget(prev => ({
      ...prev,
      [productId]: { ...prev[productId], proveedorId }
    }));
  };

  const openBudgetModalForSelected = () => {
    const selectedIds = Object.keys(selectedForBudget);
    if (selectedIds.length === 0) {
      showToast('Seleccione al menos un producto', 'error');
      return;
    }
    // Verificar que todos los productos seleccionados tengan proveedor asignado
    const missingProveedor = selectedIds.some(id => !selectedForBudget[id].proveedorId);
    if (missingProveedor) {
      showToast('Todos los productos deben tener un proveedor seleccionado', 'error');
      return;
    }
    // Agrupar por proveedor (para mostrar un presupuesto por proveedor, o múltiples? Aquí asumimos que se enviará al primer proveedor? En realidad debería ser uno por proveedor. Simplifico: si todos tienen el mismo proveedor, bien; si no, muestro mensaje)
    const proveedorIds = [...new Set(selectedIds.map(id => selectedForBudget[id].proveedorId))];
    if (proveedorIds.length > 1) {
      showToast('No se puede generar un presupuesto con múltiples proveedores. Seleccione productos del mismo proveedor.', 'error');
      return;
    }
    const proveedor = proveedores.find(p => p.id === proveedorIds[0]);
    if (!proveedor) {
      showToast('Proveedor no encontrado', 'error');
      return;
    }
    const productos = selectedIds.map(id => {
      const prod = products.find(p => p.id === parseInt(id));
      return { ...prod, cantidad: selectedForBudget[id].cantidad };
    });
    const texto = `Solicitud de cotización para ${proveedor.nombre}\n\n` +
      productos.map(p => 
        `- ${p.nombre} (${p.presentacion}): ${p.cantidad} unidad(es) - Stock actual: ${p.stock_actual}, Stock mínimo: ${p.stock_minimo || 'N/A'}`
      ).join('\n') +
      `\n\nPor favor, enviar presupuesto a: [tu email]`;
    setBudgetText(texto);
    setCurrentProveedor(proveedor);
    setShowBudgetModal(true);
  };

  const openIndividualBudget = (product, proveedorId) => {
    if (!proveedorId) {
      showToast('Seleccione un proveedor para este producto', 'error');
      return;
    }
    const proveedor = proveedores.find(p => p.id === proveedorId);
    if (!proveedor) return;
    const texto = `Solicitud de cotización para ${proveedor.nombre}\n\n` +
      `- ${product.nombre} (${product.presentacion}): 1 unidad - Stock actual: ${product.stock_actual}, Stock mínimo: ${product.stock_minimo || 'N/A'}` +
      `\n\nPor favor, enviar presupuesto a: [tu email]`;
    setBudgetText(texto);
    setCurrentProveedor(proveedor);
    setShowBudgetModal(true);
  };

  const copyBudgetToClipboard = () => {
    navigator.clipboard.writeText(budgetText);
    showToast('Presupuesto copiado al portapapeles', 'success');
  };

  // ================= CRUD PRODUCTOS =================
  const openCreateModal = () => {
    setEditingProduct(null);
    setFormData({ 
      nombre: '', descripcion: '', presentacion: '', 
      peso_kg: '', stock_actual: 0, stock_minimo: 0, proveedor: '' 
    });
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
      proveedor: product.proveedor || '',
    });
    setValidationError('');
    setShowProductModal(true);
  };

  const handleProductSubmit = async (e) => {
    e.preventDefault();
    setValidationError('');
    if (!formData.nombre.trim() || !formData.presentacion.trim()) {
      setValidationError('Nombre y presentación son obligatorios'); return;
    }
    const peso = parseFloat(formData.peso_kg);
    if (isNaN(peso) || peso <= 0) {
      setValidationError('El peso debe ser mayor a 0'); return;
    }
    const stockMinimo = parseFloat(formData.stock_minimo);
    if (isNaN(stockMinimo) || stockMinimo < 0) {
      setValidationError('El stock mínimo no puede ser negativo'); return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        nombre: formData.nombre.trim(),
        presentacion: formData.presentacion.trim(),
        categoria: activeTab === 'quimicos' ? 'quimicos' : 'otros',
        peso_kg: peso,
        stock_actual: Number(formData.stock_actual) || 0,
        stock_minimo: stockMinimo,
        proveedor: formData.proveedor || null,
      };

      if (editingProduct) {
        await axios.put(`/inventario/products/${editingProduct.id}/`, payload);
        showToast('Actualizado con éxito', 'success');
      } else {
        await axios.post('/inventario/products/', payload);
        showToast('Creado con éxito', 'success');
      }
      setShowProductModal(false);
      fetchProducts();
    } catch {
      setValidationError('Error de red o de validación del servidor.');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = (product) => { setProductToDelete(product); setShowDeleteModal(true); };

  const handleDelete = async () => {
    if (!productToDelete) return;
    setSubmitting(true);
    try {
      await axios.delete(`/inventario/products/${productToDelete.id}/`);
      setShowDeleteModal(false);
      setProductToDelete(null);
      fetchProducts();
      showToast('Eliminado', 'success');
    } catch (err) {
      showToast('Error al eliminar. Posibles movimientos asociados.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const openMultiDeleteModal = () => {
    const initialSelection = {};
    filteredProducts.forEach(p => initialSelection[p.id] = false);
    setSelectedProducts(initialSelection);
    setShowMultiDeleteModal(true);
  };

  const toggleSelectProduct = (productId) => {
    setSelectedProducts(prev => ({ ...prev, [productId]: !prev[productId] }));
  };

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
    const deletePromises = idsToDelete.map(id => axios.delete(`/inventario/products/${id}/`).catch(err => ({ error: true })));
    const results = await Promise.allSettled(deletePromises);
    results.forEach(result => { if (result.status === 'fulfilled' && !result.value?.error) successCount++; });
    
    showToast(`Eliminados: ${successCount}`, successCount > 0 ? 'success' : 'error');
    setShowMultiDeleteModal(false);
    fetchProducts();
    setDeletingMultiple(false);
  };

  const handleExcelUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setUploadingExcel(true);
    setExcelFeedback(null);
    const fd = new FormData(); fd.append('file', file);
    try {
      const res = await axios.post('/inventario/products/upload_excel/', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setExcelFeedback({ type: 'success', message: `${res.data.creados} creados, ${res.data.actualizados} actualizados.`, errors: res.data.errores });
      fetchProducts();
    } catch (err) {
      setExcelFeedback({ type: 'error', message: 'Error en archivo excel.', errors: [] });
    } finally {
      setUploadingExcel(false); event.target.value = '';
    }
  };

  // ================= LÓGICA DE FÓRMULAS BOM =================
  const getFormulaFor = (quimicoId) => formulas.find(f => f.articulo_final_id === quimicoId);

  const openFormulaConfig = (quimico) => {
      const existing = getFormulaFor(quimico.id);
      setSelectedQuimico(quimico);
      if (existing) {
          setFormulaName(existing.nombre);
          setIngredients(existing.componentes.map(c => ({
              insumo_id: c.insumo_id, cantidad: c.cantidad_requerida.toString(),
              obj: { id: c.insumo_id, nombre: c.insumo_nombre, presentacion: c.insumo_presentacion }
          })));
      } else {
          setFormulaName(`Fórmula de ${quimico.nombre}`);
          setIngredients([]);
      }
      setShowFormulaModal(true);
  };

  const saveFormula = async () => {
      if (!formulaName || ingredients.length === 0) { showToast('Nombre e ingredientes requeridos', 'error'); return; }
      const payload = {
          nombre: formulaName, articulo_final_id: selectedQuimico.id, activa: true,
          componentes: ingredients.map(ing => ({ insumo_id: ing.insumo_id, cantidad_requerida: parseFloat(ing.cantidad) }))
      };
      setSubmitting(true);
      try {
          const existing = getFormulaFor(selectedQuimico.id);
          if (existing) await axios.put(`/produccion/formulas/${existing.id}/`, payload);
          else await axios.post('/produccion/formulas/', payload);
          showToast('Fórmula guardada', 'success');
          setShowFormulaModal(false);
          fetchFormulas();
      } catch (err) {
          showToast('Error al guardar', 'error');
      } finally {
          setSubmitting(false);
      }
  };

  const deleteFormula = async (id) => {
      if (!window.confirm("¿Eliminar fórmula?")) return;
      try {
          await axios.delete(`/produccion/formulas/${id}/`);
          showToast("Eliminada", "success");
          fetchFormulas();
      } catch (error) { showToast("Error", "error"); }
  };

  // ================= UTILIDADES VISUALES =================
  const getCardColorClass = (product) => {
    const stock = Number(product.stock_actual);
    const minStock = Number(product.stock_minimo) || 0;
    if (stock === 0) return 'bg-red-50';
    if (minStock > 0 && stock > 0 && stock <= minStock) return 'bg-yellow-50';
    return 'bg-white';
  };

  const getStockBarColor = (product) => {
    const stock = Number(product.stock_actual);
    const minStock = Number(product.stock_minimo) || 0;
    if (stock === 0) return 'bg-red-500';
    if (minStock > 0 && stock > 0 && stock <= minStock) return 'bg-amber-400';
    return 'bg-emerald-500';
  };

  const getCardBorderColor = (product) => {
    const stock = Number(product.stock_actual);
    const minStock = Number(product.stock_minimo) || 0;
    if (stock === 0) return 'border-red-200';
    if (minStock > 0 && stock > 0 && stock <= minStock) return 'border-amber-200';
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

  return (
    <div className="animate-fadeIn pb-12">
      {toastMessage && (
        <div className={`fixed top-20 right-4 z-50 px-4 py-3 rounded-xl shadow-lg border border-opacity-50 flex items-center gap-3 animate-fadeIn ${
          toastMessage.type === 'error' ? 'bg-red-50 text-red-800 border-red-200' : 'bg-green-50 text-green-800 border-green-200'
        }`}>
          <i className={`bi ${toastMessage.type === 'error' ? 'bi-x-circle-fill' : 'bi-check-circle-fill'} text-lg`}></i>
          <span className="font-bold text-sm tracking-tight">{toastMessage.message}</span>
        </div>
      )}

      {/* Tabs Internas */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
            <button
                onClick={() => { setActiveTab('productos'); setSearchTerm(''); }}
                className={`py-4 px-1 text-center border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                    activeTab === 'productos' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
                <i className="bi bi-box-seam text-lg"></i> Insumos y Productos
            </button>
            <button
                onClick={() => { setActiveTab('quimicos'); setSearchTerm(''); }}
                className={`py-4 px-1 text-center border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                    activeTab === 'quimicos' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
                <i className="bi bi-flask-fill text-lg"></i> Químicos y Fórmulas
            </button>
            <button
                onClick={() => { setActiveTab('proveedores'); setSearchTerm(''); }}
                className={`py-4 px-1 text-center border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                    activeTab === 'proveedores' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
                <i className="bi bi-people-fill text-lg"></i> Proveedores
            </button>
            <button
                onClick={() => { setActiveTab('abastecimiento'); setSearchTerm(''); setCriticosSearchTerm(''); }}
                className={`py-4 px-1 text-center border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                    activeTab === 'abastecimiento' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
                <i className="bi bi-truck text-lg"></i> Abastecimiento
            </button>
        </nav>
      </div>

      {/* Top Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
            <h2 className="text-2xl font-bold text-gray-900 leading-tight">
                {activeTab === 'productos' && 'Materia Prima e Insumos'}
                {activeTab === 'quimicos' && 'Catálogo de Químicos (BOM)'}
                {activeTab === 'proveedores' && 'Gestión de Proveedores'}
                {activeTab === 'abastecimiento' && 'Productos para Abastecer'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
                {activeTab === 'productos' && 'Gestión de elementos individuales y cajas de stock.'}
                {activeTab === 'quimicos' && 'Químicos fabricables con sus respectivas recetas de descuento de stock.'}
                {activeTab === 'proveedores' && 'Administrar proveedores de productos y químicos.'}
                {activeTab === 'abastecimiento' && 'Productos con stock bajo o agotado. Seleccione proveedor y solicite presupuesto.'}
            </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          {activeTab !== 'proveedores' && activeTab !== 'abastecimiento' && (
            <>
              <label className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-xl shadow-sm text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
                {uploadingExcel ? 'Subiendo...' : <><i className="bi bi-file-earmark-spreadsheet mr-1 text-green-600"></i> Importar Excel</>}
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelUpload} disabled={uploadingExcel} />
              </label>
              <button onClick={openMultiDeleteModal} className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-xl shadow-sm text-red-700 bg-white hover:bg-red-50">
                <i className="bi bi-trash mr-1"></i> Multi-Borrado
              </button>
              <button onClick={openCreateModal} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-indigo-600 hover:bg-indigo-700">
                <i className="bi bi-plus-lg mr-1"></i> Nuevo {activeTab === 'quimicos' ? 'Químico' : 'Producto'}
              </button>
            </>
          )}
          {activeTab === 'proveedores' && (
            <button onClick={openCreateProveedor} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-indigo-600 hover:bg-indigo-700">
              <i className="bi bi-plus-lg mr-1"></i> Nuevo Proveedor
            </button>
          )}
        </div>
      </div>

      {/* Feedback de Excel */}
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

      {/* Search - dinámico según pestaña */}
      <div className="mb-6 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <i className="bi bi-search text-gray-400"></i>
          </div>
          <input
            type="text"
            placeholder={
              activeTab === 'proveedores' ? 'Buscar proveedor...' : 
              activeTab === 'abastecimiento' ? 'Buscar producto crítico...' :
              `Buscar en ${activeTab === 'quimicos' ? 'Químicos' : 'Productos'}...`
            }
            value={activeTab === 'abastecimiento' ? criticosSearchTerm : searchTerm}
            onChange={(e) => {
              if (activeTab === 'abastecimiento') setCriticosSearchTerm(e.target.value);
              else setSearchTerm(e.target.value);
            }}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400 rounded-xl bg-white focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
          />
      </div>

      {/* ================= LISTADO DE PRODUCTOS (Insumos y Químicos) ================= */}
      {activeTab !== 'proveedores' && activeTab !== 'abastecimiento' && (
        <>
          {loading ? (
            <div className="flex justify-center py-20"><LogoSpinner size="w-12 h-12" /></div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredProducts.map(product => {
                const formula = activeTab === 'quimicos' ? getFormulaFor(product.id) : null;
                const cardBg = getCardColorClass(product);
                const barColor = getStockBarColor(product);
                const borderColor = getCardBorderColor(product);
                const stockNum = Number(product.stock_actual);
                const minStockNum = Number(product.stock_minimo) || 0;
                
                return (
                  <div key={product.id} className={`rounded-xl shadow-sm border overflow-hidden hover:shadow-lg transition-shadow flex flex-col group ${cardBg} dark:bg-slate-800 ${borderColor} dark:border-slate-700`}>
                    <div className="p-5 flex-1 relative">
                      <div className={`absolute top-0 left-0 w-1.5 h-full ${barColor}`}></div>
                      <div className="pl-2">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-tight group-hover:text-indigo-600 transition-colors" title={product.nombre}>{product.nombre}</h3>
                            <div className="flex gap-1 shrink-0">
                                <button onClick={() => openEditModal(product)} className="text-indigo-300 hover:text-indigo-600"><i className="bi bi-pencil-square"></i></button>
                                <button onClick={() => confirmDelete(product)} className="text-red-300 hover:text-red-600"><i className="bi bi-trash"></i></button>
                            </div>
                        </div>
                        
                        <div className="text-xs sm:text-sm text-gray-600 dark:text-slate-300 space-y-1 mb-3">
                            <p><span className="font-semibold text-gray-400">Presentación:</span> {product.presentacion}</p>
                            <p><span className="font-semibold text-gray-400">Peso Base:</span> {parseFloat(product.peso_kg).toFixed(2)} kg</p>
                            {product.proveedor_nombre && (
                              <p><span className="font-semibold text-gray-400">Proveedor:</span> {product.proveedor_nombre}</p>
                            )}
                            <p>
                                <span className="font-semibold text-gray-400">Stock Actual:</span> 
                                <span className={`ml-1 font-bold ${
                                    stockNum === 0 ? 'text-red-600' : 
                                    (minStockNum > 0 && stockNum <= minStockNum ? 'text-yellow-700' : 'text-green-600')
                                }`}>
                                    {stockNum.toFixed(2)}
                                </span>
                            </p>
                            {minStockNum > 0 && (
                              <p className="text-xs text-gray-500">
                                <span className="font-semibold text-gray-400">Stock Mínimo:</span> {minStockNum.toFixed(2)}
                              </p>
                            )}
                        </div>

                        {activeTab === 'quimicos' && (
                            <div className="mt-4 pt-4 border-t border-gray-100">
                                {formula ? (
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] bg-green-100 text-green-800 font-extrabold uppercase px-2 py-0.5 rounded-md">BOM Activo</span>
                                            <button onClick={() => deleteFormula(formula.id)} className="text-[10px] text-red-500 hover:underline">Revocar</button>
                                        </div>
                                        <ul className="text-xs text-gray-500 space-y-0.5 max-h-16 overflow-hidden">
                                            {formula.componentes.slice(0, 2).map((c, i) => <li key={i} className="truncate">• {c.insumo_nombre}</li>)}
                                            {formula.componentes.length > 2 && <li className="text-indigo-400 italic">+{formula.componentes.length - 2} más</li>}
                                        </ul>
                                    </div>
                                ) : (
                                    <span className="text-[10px] bg-amber-100 text-amber-800 font-extrabold uppercase px-2 py-0.5 rounded-md inline-block mb-2">Sin Receta</span>
                                )}
                                <button onClick={() => openFormulaConfig(product)} className="w-full mt-2 py-1.5 bg-slate-50 hover:bg-slate-100 text-indigo-600 text-xs font-bold rounded-lg transition-colors border border-slate-200">
                                    {formula ? 'Modificar Fórmula' : 'Crear Fórmula'}
                                </button>
                            </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {filteredProducts.length === 0 && !loading && (
            <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-gray-300 dark:border-slate-600">
              <p className="text-gray-500 dark:text-slate-400">No se encontraron registros en esta pestaña.</p>
            </div>
          )}
        </>
      )}

      {/* ================= LISTADO DE PROVEEDORES ================= */}
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
          {filteredProveedores.length === 0 && !loading && (
            <div className="col-span-full text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-gray-300 dark:border-slate-600">
              <p className="text-gray-500 dark:text-slate-400">No hay proveedores registrados.</p>
            </div>
          )}
        </div>
      )}

      {/* ================= LISTADO DE ABASTECIMIENTO (Productos críticos) ================= */}
      {activeTab === 'abastecimiento' && (
        <>
          {loading ? (
            <div className="flex justify-center py-20"><LogoSpinner size="w-12 h-12" /></div>
          ) : (
            <>
              {selectedBudgetCount > 0 && (
                <div className="mb-4 p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex justify-between items-center border border-indigo-100 dark:border-indigo-800">
                  <span className="text-sm font-medium text-indigo-800 dark:text-indigo-300">{selectedBudgetCount} producto(s) seleccionado(s)</span>
                  <button onClick={openBudgetModalForSelected} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-colors">
                    <i className="bi bi-envelope-plus"></i> Solicitar presupuesto para seleccionados
                  </button>
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
                    <div key={product.id} className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border overflow-hidden transition-shadow ${isSelected ? 'border-indigo-300 dark:border-indigo-500 ring-1 ring-indigo-300 dark:ring-indigo-500' : 'border-gray-200 dark:border-slate-700'}`}>
                      <div className="p-5">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{product.nombre}</h3>
                            <div className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                              <p>Presentación: {product.presentacion}</p>
                              <p>Peso Base: {parseFloat(product.peso_kg).toFixed(2)} kg</p>
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                            <div className="flex gap-4 items-center">
                              <div className="text-center">
                                <span className="text-xs text-gray-500 dark:text-slate-400">Stock actual</span>
                                <p className={`font-bold ${stockNum === 0 ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'}`}>{stockNum}</p>
                              </div>
                              {minStockNum > 0 && (
                                <div className="text-center">
                                  <span className="text-xs text-gray-500 dark:text-slate-400">Stock mínimo</span>
                                  <p className="font-bold text-gray-700 dark:text-slate-300">{minStockNum}</p>
                                </div>
                              )}
                            </div>
                            <div className="w-32">
                              <label className="block text-xs text-gray-500 dark:text-slate-400">Cantidad a cotizar</label>
                              <input type="number" min="0" step="1" value={cantidad} onChange={(e) => updateCantidadForBudget(product.id, e.target.value)} className="w-full px-2 py-1 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded text-center transition-colors" />
                            </div>
                            <div className="w-48">
                              <label className="block text-xs text-gray-500 dark:text-slate-400">Proveedor</label>
                              <select value={selectedProveedorId} onChange={(e) => updateProveedorForBudget(product.id, e.target.value)} className="w-full px-2 py-1 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded transition-colors">
                                <option value="">Seleccionar</option>
                                {proveedores.map(prov => (
                                  <option key={prov.id} value={prov.id}>{prov.nombre}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => toggleSelectForBudget(product.id, selectedProveedorId)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isSelected ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'}`}>
                                {isSelected ? 'Seleccionado' : 'Seleccionar'}
                              </button>
                              <button onClick={() => openIndividualBudget(product, selectedProveedorId)} disabled={!selectedProveedorId} className="px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-200 dark:hover:bg-emerald-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-emerald-200 dark:border-emerald-800">
                                <i className="bi bi-envelope-paper me-1"></i>Presupuesto
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {filteredCriticos.length === 0 && !loading && (
                <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-gray-300 dark:border-slate-600">
                  <p className="text-gray-500 dark:text-slate-400">No hay productos con stock crítico (bajo o cero).</p>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ===== MODALES ===== */}
      {/* Modal Proveedor */}
      {showProveedorModal && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-center items-center p-4" onClick={() => setShowProveedorModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md mx-auto overflow-hidden border border-gray-200 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingProveedor ? 'Editar Proveedor' : 'Nuevo Proveedor'}
              </h3>
              <button onClick={() => setShowProveedorModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 transition-colors">
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              <form onSubmit={handleProveedorSubmit} className="space-y-4">
                {[{label:'Razón Social *',field:'nombre',type:'text',required:true},{label:'Contacto',field:'contacto',type:'text'},{label:'Teléfono',field:'telefono',type:'text'},{label:'Email',field:'email',type:'email'},{label:'Rubro',field:'rubro',type:'text',placeholder:'Ej: Alimenticio...'}].map(({label,field,type,required,placeholder}) => (
                  <div key={field}>
                    <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">{label}</label>
                    <input type={type} value={proveedorForm[field]} onChange={e => setProveedorForm({...proveedorForm, [field]: e.target.value})}
                      className="w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 transition-colors"
                      required={required} placeholder={placeholder}
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">Dirección</label>
                  <textarea value={proveedorForm.direccion} onChange={e => setProveedorForm({...proveedorForm, direccion: e.target.value})}
                    className="w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 transition-colors" rows={2}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">Condición de Pago</label>
                  <select value={proveedorForm.condicion_pago} onChange={e => setProveedorForm({...proveedorForm, condicion_pago: e.target.value})}
                    className="w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 transition-colors"
                  >
                    {condicionPagoOptions.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                  </select>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => setShowProveedorModal(false)} className="px-4 py-2 font-bold text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors">Cancelar</button>
                  <button type="submit" disabled={submittingProveedor} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-lg disabled:opacity-50">
                    {submittingProveedor ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Producto */}
      {showProductModal && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-center items-center p-4" onClick={() => setShowProductModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md mx-auto overflow-hidden border border-gray-200 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingProduct ? 'Editar registro' : `Nuevo ${activeTab === 'quimicos' ? 'Químico' : 'Producto'}`}
              </h3>
              <button onClick={() => setShowProductModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 transition-colors">
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {validationError && (
                <div className="mb-4 text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                  {validationError}
                </div>
              )}
              <form onSubmit={handleProductSubmit} className="space-y-4">
                {[{label:'Nombre *',field:'nombre',type:'text',required:true},{label:'Descripción',field:'descripcion',type:'text'},{label:'Presentación *',field:'presentacion',type:'text',required:true,placeholder:'Ej: Tambor 200L'}].map(({label,field,type,required,placeholder}) => (
                  <div key={field}>
                    <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">{label}</label>
                    <input type={type} value={formData[field]} onChange={e => setFormData({...formData, [field]: e.target.value})}
                      className="w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 transition-colors"
                      required={required} placeholder={placeholder}
                    />
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-4">
                  {[{label:'Peso Base (Kg/L) *',field:'peso_kg',required:true},{label:'Stock Físico',field:'stock_actual'}].map(({label,field,required}) => (
                    <div key={field}>
                      <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">{label}</label>
                      <input type="number" step="0.01" value={formData[field]} onChange={e => setFormData({...formData, [field]: e.target.value})}
                        className="w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 transition-colors"
                        required={required}
                      />
                    </div>
                  ))}
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">Stock Mínimo (Alerta)</label>
                  <input type="number" step="0.01" min="0" value={formData.stock_minimo} onChange={e => setFormData({...formData, stock_minimo: e.target.value})}
                    className="w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 transition-colors" placeholder="Ej: 10"
                  />
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Cuando el stock baje a este valor, la tarjeta se pondrá amarilla.</p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">Proveedor (opcional)</label>
                  <AutocompleteCreate endpoint="/inventario/proveedores/" value={formData.proveedor}
                    onSelect={(item) => setFormData({...formData, proveedor: item?.id || ''})} nameField="nombre"
                    placeholder="Seleccionar o crear proveedor..."
                    createFields={[{name:'nombre',label:'Razón Social',required:true},{name:'contacto',label:'Contacto'},{name:'telefono',label:'Teléfono'},{name:'email',label:'Email'},{name:'direccion',label:'Dirección'},{name:'rubro',label:'Rubro'},{name:'condicion_pago',label:'Condición de Pago',type:'select',options:condicionPagoOptions}]}
                    extraCreateData={{}}
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => setShowProductModal(false)} className="px-4 py-2 font-bold text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors">Cancelar</button>
                  <button type="submit" disabled={submitting} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-lg disabled:opacity-50">
                    {submitting ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Presupuesto */}
      {showBudgetModal && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-center items-center p-4" onClick={() => setShowBudgetModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-gray-200 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 bg-indigo-50 dark:bg-indigo-900/30 flex justify-between items-center rounded-t-2xl">
              <h3 className="text-lg font-black text-indigo-900 dark:text-indigo-300">Solicitar presupuesto a {currentProveedor?.nombre}</h3>
              <button onClick={() => setShowBudgetModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200">
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="p-6 flex-1 overflow-y-auto">
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-2">Texto para enviar al proveedor</label>
                <textarea rows={12} value={budgetText} onChange={(e) => setBudgetText(e.target.value)}
                  className="w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg p-3 font-mono text-sm transition-colors"
                ></textarea>
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={copyBudgetToClipboard} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2">
                  <i className="bi bi-clipboard-check"></i> Copiar al portapapeles
                </button>
                <button onClick={() => setShowBudgetModal(false)} className="px-4 py-2 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors">Cerrar</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Eliminación Individual */}
      {showDeleteModal && productToDelete && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-center items-center p-4" onClick={() => setShowDeleteModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden text-center p-6 border border-gray-200 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
            <i className="bi bi-exclamation-triangle text-4xl text-red-500 mb-3 block"></i>
            <h3 className="text-xl font-black mb-2 dark:text-white">Eliminar Registro</h3>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">¿Estás seguro de borrar <b className="dark:text-white">{productToDelete.nombre}</b> permanentemente?</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 font-bold text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors">Cancelar</button>
              <button onClick={handleDelete} disabled={submitting} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-lg">Sí, Eliminar</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Eliminación Múltiple */}
      {showMultiDeleteModal && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-center items-center p-4" onClick={() => setShowMultiDeleteModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[85vh] border border-gray-200 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-slate-700 bg-red-50 dark:bg-red-900/20 rounded-t-2xl">
              <h3 className="text-lg font-black text-red-800 dark:text-red-300">Eliminación Masiva ({activeTab})</h3>
            </div>
            <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400">
                    <th className="p-2"><input type="checkbox" checked={selectedCount > 0 && selectedCount === filteredProducts.length} onChange={toggleSelectAll} className="rounded" /></th>
                    <th className="p-2">Nombre</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                  {filteredProducts.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="p-2"><input type="checkbox" checked={selectedProducts[p.id] || false} onChange={() => toggleSelectProduct(p.id)} className="rounded" /></td>
                      <td className="p-2 font-medium text-gray-800 dark:text-slate-200">{p.nombre}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-gray-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-700/50 rounded-b-2xl">
              <span className="text-xs font-bold text-gray-500 dark:text-slate-400">{selectedCount} elegidos</span>
              <div className="flex gap-2">
                <button onClick={() => setShowMultiDeleteModal(false)} className="px-4 py-2 text-sm font-bold text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg transition-colors">Cancelar</button>
                <button onClick={handleMultiDelete} disabled={selectedCount===0 || deletingMultiple} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg disabled:opacity-50">Borrar</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal BOM */}
      {showFormulaModal && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-center items-center p-4" onClick={() => setShowFormulaModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-gray-200 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 bg-indigo-50/50 dark:bg-indigo-900/20 flex justify-between items-center rounded-t-2xl">
              <h3 className="text-lg font-black text-indigo-900 dark:text-indigo-300">BOM: {selectedQuimico?.nombre}</h3>
              <button onClick={() => setShowFormulaModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 transition-colors">
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">Nombre de la Receta</label>
                <input type="text" value={formulaName} onChange={e => setFormulaName(e.target.value)}
                  className="w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white px-3 py-2 rounded-lg font-medium outline-none focus:border-indigo-500 transition-colors" placeholder="Ej. Lote Estándar"
                />
              </div>
              <div className="mb-4 flex justify-between items-end">
                <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Ingredientes</label>
                <button onClick={() => setIngredients([...ingredients, {insumo_id:'', cantidad:''}])} className="text-xs font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors">+ Agregar</button>
              </div>
              <div className="space-y-3">
                {ingredients.map((ing, idx) => (
                  <div key={idx} className="flex gap-2 items-start bg-slate-50 dark:bg-slate-700 p-2 rounded-xl border border-slate-200 dark:border-slate-600">
                    <div className="flex-1">
                      <AutocompleteCreate label="Insumo *" endpoint="/inventario/products/?categoria=otros"
                        value={ing.insumo_id} nameField="nombre"
                        onSelect={(item) => { const newIng = [...ingredients]; newIng[idx].insumo_id = item.id; setIngredients(newIng); }}
                        createFields={[]} extraCreateData={{ categoria: 'otros' }}
                      />
                    </div>
                    <div className="w-24 shrink-0">
                      <label className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 mb-1">Cant.</label>
                      <input type="number" step="0.01" value={ing.cantidad} onChange={e => { const newIng = [...ingredients]; newIng[idx].cantidad = e.target.value; setIngredients(newIng); }}
                        className="w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm rounded px-2 py-1.5 transition-colors"
                      />
                    </div>
                    <div className="pt-5 shrink-0">
                      <button onClick={() => { const newIng=[...ingredients]; newIng.splice(idx,1); setIngredients(newIng); }} className="text-red-400 p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"><i className="bi bi-trash"></i></button>
                    </div>
                  </div>
                ))}
                {ingredients.length === 0 && <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-4">Sin ingredientes.</p>}
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-700/50 border-t border-gray-100 dark:border-slate-700 flex justify-end gap-3 rounded-b-2xl">
              <button onClick={() => setShowFormulaModal(false)} className="px-4 py-2 font-bold text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg transition-colors">Cancelar</button>
              <button onClick={saveFormula} disabled={submitting} className="px-4 py-2 bg-indigo-600 border border-transparent hover:bg-indigo-700 text-white font-bold text-sm rounded-lg disabled:opacity-50">Guardar</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}