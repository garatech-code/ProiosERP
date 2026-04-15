import { useState, useEffect } from 'react';
import axios from '../api/axios';
import AutocompleteCreate from './AutocompleteCreate';

export default function InventoryManagement() {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('productos'); // 'productos' o 'quimicos'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Modal de creación/edición
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    presentacion: '',
    peso_kg: '',
    stock_actual: 0,
  });
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');
  
  // Eliminación individual
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);
  
  // Eliminación múltiple
  const [showMultiDeleteModal, setShowMultiDeleteModal] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState({});
  const [deletingMultiple, setDeletingMultiple] = useState(false);
  
  const [uploadingExcel, setUploadingExcel] = useState(false);
  const [excelFeedback, setExcelFeedback] = useState(null);

  const [toastMessage, setToastMessage] = useState(null);

  // Fórmulas BOM (solo para químicos)
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
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Error al cargar datos del inventario.');
    } finally {
      setLoading(false);
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

  useEffect(() => {
    fetchProducts();
  }, [activeTab]); // Refetch formulas if tab changed to quimicos

  useEffect(() => {
    let filtered = products.filter(p => p.categoria === (activeTab === 'quimicos' ? 'quimicos' : 'otros'));
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        p.nombre.toLowerCase().includes(term) ||
        p.presentacion.toLowerCase().includes(term)
      );
    }
    setFilteredProducts(filtered);
    setSelectedProducts({});
  }, [searchTerm, activeTab, products]);


  // ================= ACCIONES DE PRODUCTO =================
  const openCreateModal = () => {
    setEditingProduct(null);
    setFormData({ nombre: '', descripcion: '', presentacion: '', peso_kg: '', stock_actual: 0 });
    setValidationError('');
    setShowProductModal(true);
  };

  const openEditModal = (product) => {
    setEditingProduct(product);
    setFormData({
      nombre: product.nombre, descripcion: product.descripcion || '',
      presentacion: product.presentacion, peso_kg: product.peso_kg, stock_actual: product.stock_actual,
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

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        nombre: formData.nombre.trim(),
        presentacion: formData.presentacion.trim(),
        categoria: activeTab === 'quimicos' ? 'quimicos' : 'otros', // Se fuerza la categoría según el tab actual
        peso_kg: peso,
        stock_actual: Number(formData.stock_actual) || 0,
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
    } catch (err) {
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


  // ================= LÓGICA DE FÓRMULAS BOM (Solo Químicos) =================
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


  // ================= INTERFAZ =================

  const selectedCount = Object.values(selectedProducts).filter(v => v === true).length;

  return (
    <div className="animate-fadeIn pb-12">
      {/* Sistema de Notificaciones Toasts */}
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
                onClick={() => setActiveTab('productos')}
                className={`py-4 px-1 text-center border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                    activeTab === 'productos' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
                <i className="bi bi-box-seam text-lg"></i> Insumos y Productos
            </button>
            <button
                onClick={() => setActiveTab('quimicos')}
                className={`py-4 px-1 text-center border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                    activeTab === 'quimicos' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
                <i className="bi bi-flask-fill text-lg"></i> Químicos y Fórmulas
            </button>
        </nav>
      </div>

      {/* Top Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
            <h2 className="text-2xl font-bold text-gray-900 leading-tight">
                {activeTab === 'productos' ? 'Materia Prima e Insumos' : 'Catálogo de Químicos (BOM)'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
                {activeTab === 'productos' ? 'Gestión de elementos individuales y cajas de stock.' : 'Químicos fabricables con sus respectivas recetas de descuento de stock.'}
            </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
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

      {/* Search */}
      <div className="mb-6 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <i className="bi bi-search text-gray-400"></i>
          </div>
          <input
            type="text"
            placeholder={`Buscar en ${activeTab === 'quimicos' ? 'Químicos' : 'Productos'}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-xl bg-white focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProducts.map(product => {
             const formula = activeTab === 'quimicos' ? getFormulaFor(product.id) : null;
             
             return (
              <div key={product.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow flex flex-col group">
                <div className="p-5 flex-1 relative">
                  <div className={`absolute top-0 left-0 w-1.5 h-full ${activeTab === 'quimicos' ? 'bg-emerald-500' : 'bg-indigo-500'}`}></div>
                  <div className="pl-2">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-lg font-bold text-gray-900 leading-tight group-hover:text-indigo-600 transition-colors" title={product.nombre}>{product.nombre}</h3>
                        <div className="flex gap-1 shrink-0">
                            <button onClick={() => openEditModal(product)} className="text-indigo-300 hover:text-indigo-600"><i className="bi bi-pencil-square"></i></button>
                            <button onClick={() => confirmDelete(product)} className="text-red-300 hover:text-red-600"><i className="bi bi-trash"></i></button>
                        </div>
                    </div>
                    
                    <div className="text-xs sm:text-sm text-gray-600 space-y-1 mb-3">
                        <p><span className="font-semibold text-gray-400">Presentación:</span> {product.presentacion}</p>
                        <p><span className="font-semibold text-gray-400">Peso Base:</span> {parseFloat(product.peso_kg).toFixed(2)} kg</p>
                        <p>
                            <span className="font-semibold text-gray-400">Stock Actual:</span> 
                            <span className={`ml-1 font-bold ${product.stock_actual <= 0 ? 'text-red-500' : 'text-green-600'}`}>{parseFloat(product.stock_actual).toFixed(2)}</span>
                        </p>
                    </div>

                    {/* SECCIÓN ESPECIAL PARA QUÍMICOS */}
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
                                {formula ? 'Modificar Fórumla' : 'Crear Fórmula'}
                            </button>
                        </div>
                    )}
                  </div>
                </div>
              </div>
          )})}
        </div>
      )}
      {filteredProducts.length === 0 && !loading && (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-300">
           <p className="text-gray-500">No se encontraron registros en esta pestaña.</p>
        </div>
      )}

      {/* ===== MODAL DE CREAR / EDITAR PRODUCTO O QUÍMICO ===== */}
      {showProductModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-slate-50 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-900">{editingProduct ? 'Editar registro' : `Nuevo ${activeTab === 'quimicos' ? 'Químico' : 'Producto'}`}</h3>
                </div>
                <div className="p-6">
                    {validationError && <div className="mb-4 text-xs font-bold text-red-600 bg-red-50 p-2 rounded">{validationError}</div>}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Nombre</label>
                            <input type="text" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="w-full border-gray-300 rounded-lg px-3 py-2 border focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Descripción</label>
                            <input type="text" value={formData.descripcion} onChange={e => setFormData({...formData, descripcion: e.target.value})} className="w-full border-gray-300 rounded-lg px-3 py-2 border focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Presentación</label>
                            <input type="text" value={formData.presentacion} onChange={e => setFormData({...formData, presentacion: e.target.value})} className="w-full border-gray-300 rounded-lg px-3 py-2 border focus:ring-2 focus:ring-indigo-500" placeholder="Ej: Tambor 200L" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Peso Base (Kg/L)</label>
                                <input type="number" step="0.01" value={formData.peso_kg} onChange={e => setFormData({...formData, peso_kg: e.target.value})} className="w-full border-gray-300 rounded-lg px-3 py-2 border focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Stock Físico</label>
                                <input type="number" step="0.01" value={formData.stock_actual} onChange={e => setFormData({...formData, stock_actual: e.target.value})} className="w-full border-gray-300 rounded-lg px-3 py-2 border focus:ring-2 focus:ring-indigo-500" />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="px-6 py-4 bg-slate-50 border-t border-gray-100 flex justify-end gap-3">
                    <button onClick={() => setShowProductModal(false)} className="px-4 py-2 font-bold text-sm text-gray-600 hover:bg-gray-200 rounded-lg">Cancelar</button>
                    <button onClick={handleProductSubmit} disabled={submitting} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-lg disabled:opacity-50">Guardar</button>
                </div>
            </div>
        </div>
      )}

      {/* ===== MODALES DE ELIMINACIÓN ===== */}
      {showDeleteModal && productToDelete && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden text-center p-6">
                <i className="bi bi-exclamation-triangle text-4xl text-red-500 mb-3 block"></i>
                <h3 className="text-xl font-black mb-2">Eliminar Registro</h3>
                <p className="text-sm text-gray-500 mb-6">¿Estás seguro de borrar <b>{productToDelete.nombre}</b> permanentemente?</p>
                <div className="flex justify-center gap-3">
                    <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 font-bold text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                    <button onClick={handleDelete} disabled={submitting} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-lg">Sí, Eliminar</button>
                </div>
            </div>
          </div>
      )}

      {showMultiDeleteModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-center items-center p-4">
             <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[85vh]">
                 <div className="p-6 border-b border-gray-100 bg-red-50 rounded-t-2xl">
                    <h3 className="text-lg font-black text-red-800">Eliminación Masiva ({activeTab})</h3>
                 </div>
                 <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-gray-200 text-gray-500">
                                <th className="p-2"><input type="checkbox" checked={selectedCount > 0 && selectedCount === filteredProducts.length} onChange={toggleSelectAll} className="rounded" /></th>
                                <th className="p-2">Nombre</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredProducts.map(p => (
                                <tr key={p.id}>
                                    <td className="p-2"><input type="checkbox" checked={selectedProducts[p.id] || false} onChange={() => toggleSelectProduct(p.id)} className="rounded" /></td>
                                    <td className="p-2 font-medium text-gray-800">{p.nombre}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 </div>
                 <div className="p-4 border-t border-gray-100 flex justify-between items-center bg-slate-50 rounded-b-2xl">
                    <span className="text-xs font-bold text-gray-500">{selectedCount} elegidos</span>
                    <div className="flex gap-2">
                        <button onClick={() => setShowMultiDeleteModal(false)} className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-lg">Cancelar</button>
                        <button onClick={handleMultiDelete} disabled={selectedCount===0 || deletingMultiple} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg disabled:opacity-50">Borrar</button>
                    </div>
                 </div>
             </div>
          </div>
      )}

      {/* ===== MODAL DE CONFIGURACIÓN BOM (Químico) ===== */}
      {showFormulaModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-center items-center p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                  <div className="px-6 py-4 border-b border-gray-100 bg-indigo-50/50 flex justify-between items-center rounded-t-2xl">
                      <h3 className="text-lg font-black text-indigo-900">BOM: {selectedQuimico?.nombre}</h3>
                  </div>
                  <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                      <div className="mb-4">
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Nombre de la Receta</label>
                          <input type="text" value={formulaName} onChange={e => setFormulaName(e.target.value)} className="w-full border-gray-300 border px-3 py-2 rounded-lg font-medium outline-none focus:border-indigo-500" placeholder="Ej. Lote Estándar" />
                      </div>
                      
                      <div className="mb-4 flex justify-between items-end">
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Ingredientes</label>
                          <button onClick={() => setIngredients([...ingredients, {insumo_id:'', cantidad:''}])} className="text-xs font-bold bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-100">
                             + Agregar 
                          </button>
                      </div>

                      <div className="space-y-3">
                          {ingredients.map((ing, idx) => (
                              <div key={idx} className="flex gap-2 items-start bg-slate-50 p-2 rounded-xl border border-slate-200">
                                  <div className="flex-1">
                                      <AutocompleteCreate
                                          label="Insumo *" endpoint="/inventario/products/?categoria=otros"
                                          value={ing.insumo_id} nameField="nombre"
                                          onSelect={(item) => {
                                              const newIng = [...ingredients];
                                              newIng[idx].insumo_id = item.id;
                                              setIngredients(newIng);
                                          }}
                                          createFields={[]} extraCreateData={{ categoria: 'otros' }}
                                      />
                                  </div>
                                  <div className="w-24 shrink-0">
                                      <label className="block text-[10px] font-bold text-gray-500 mb-1">Cant.</label>
                                      <input type="number" step="0.01" value={ing.cantidad} onChange={e => {
                                            const newIng = [...ingredients]; newIng[idx].cantidad = e.target.value; setIngredients(newIng);
                                      }} className="w-full border-gray-300 border text-sm rounded px-2 py-1.5" />
                                  </div>
                                  <div className="pt-5 shrink-0">
                                      <button onClick={() => { const newIng=[...ingredients]; newIng.splice(idx,1); setIngredients(newIng); }} className="text-red-400 p-1.5 hover:bg-red-50 rounded"><i className="bi bi-trash"></i></button>
                                  </div>
                              </div>
                          ))}
                          {ingredients.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Sin ingredientes.</p>}
                      </div>
                  </div>
                  <div className="px-6 py-4 bg-slate-50 border-t border-gray-100 flex justify-end gap-3 rounded-b-2xl">
                      <button onClick={() => setShowFormulaModal(false)} className="px-4 py-2 font-bold text-sm text-gray-600 hover:bg-gray-200 rounded-lg">Cancelar</button>
                      <button onClick={saveFormula} disabled={submitting} className="px-4 py-2 bg-indigo-600 border border-transparent hover:bg-indigo-700 text-white font-bold text-sm rounded-lg disabled:opacity-50">Guardar</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}