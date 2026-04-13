import { useState, useEffect } from 'react';
import axios from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function InventoryManagement() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('todos');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Modal de creación/edición
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    presentacion: '',
    categoria: 'otros',
    peso_kg: '',
    stock_actual: 0,
  });
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');
  
  // Modal de eliminación individual
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);
  
  // NUEVO: Modal de eliminación múltiple
  const [showMultiDeleteModal, setShowMultiDeleteModal] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState({}); // objeto { id: true/false }
  const [deletingMultiple, setDeletingMultiple] = useState(false);
  
  // Carga Excel
  const [uploadingExcel, setUploadingExcel] = useState(false);
  const [excelFeedback, setExcelFeedback] = useState(null);

  // Obtener categorías únicas
  const categoriasUnicas = ['todos', ...new Set(products.map(p => p.categoria || 'otros'))];

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    let filtered = products;
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        p.nombre.toLowerCase().includes(term) ||
        p.presentacion.toLowerCase().includes(term)
      );
    }
    if (selectedCategory !== 'todos') {
      filtered = filtered.filter(p => (p.categoria || 'otros') === selectedCategory);
    }
    setFilteredProducts(filtered);
    // Resetear selección múltiple cuando cambia la lista filtrada
    setSelectedProducts({});
  }, [searchTerm, selectedCategory, products]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/inventario/products/');
      setProducts(res.data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Error al cargar el inventario');
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingProduct(null);
    setFormData({
      nombre: '',
      descripcion: '',
      presentacion: '',
      categoria: 'otros',
      peso_kg: '',
      stock_actual: 0,
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
      categoria: product.categoria || 'otros',
      peso_kg: product.peso_kg,
      stock_actual: product.stock_actual,
    });
    setValidationError('');
    setShowProductModal(true);
  };

  const handleProductSubmit = async (e) => {
    e.preventDefault();
    setValidationError('');

    if (!formData.nombre.trim()) {
      setValidationError('El nombre es obligatorio');
      return;
    }
    if (!formData.presentacion.trim()) {
      setValidationError('La presentación es obligatoria');
      return;
    }
    const peso = parseFloat(formData.peso_kg);
    if (isNaN(peso) || peso <= 0) {
      setValidationError('El peso debe ser un número mayor a 0');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        nombre: formData.nombre.trim(),
        descripcion: formData.descripcion || '',
        presentacion: formData.presentacion.trim(),
        categoria: formData.categoria,
        peso_kg: peso,
        stock_actual: Number(formData.stock_actual) || 0,
      };

      if (editingProduct) {
        await axios.put(`/inventario/products/${editingProduct.id}/`, payload);
      } else {
        await axios.post('/inventario/products/', payload);
      }
      setShowProductModal(false);
      fetchProducts();
    } catch (err) {
      console.error(err);
      let errorMsg = editingProduct ? 'Error al actualizar' : 'Error al crear';
      if (err.response?.data) {
        if (typeof err.response.data === 'object') {
          errorMsg = Object.entries(err.response.data)
            .map(([key, value]) => `${key}: ${value.join ? value.join(', ') : value}`)
            .join('\n');
        } else {
          errorMsg = err.response.data;
        }
      } else if (err.message) {
        errorMsg = err.message;
      }
      setValidationError(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = (product) => {
    setProductToDelete(product);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!productToDelete) return;
    setSubmitting(true);
    try {
      await axios.delete(`/inventario/products/${productToDelete.id}/`);
      setShowDeleteModal(false);
      setProductToDelete(null);
      fetchProducts();
    } catch (err) {
      console.error(err);
      alert('Error al eliminar el producto. Es posible que tenga movimientos asociados.');
    } finally {
      setSubmitting(false);
    }
  };

  // ========== NUEVA FUNCIONALIDAD: ELIMINACIÓN MÚLTIPLE ==========
  const openMultiDeleteModal = () => {
    // Inicializar selección con todos los productos actualmente filtrados (opcional: solo los mostrados)
    const initialSelection = {};
    filteredProducts.forEach(p => {
      initialSelection[p.id] = false; // ninguno seleccionado por defecto
    });
    setSelectedProducts(initialSelection);
    setShowMultiDeleteModal(true);
  };

  const toggleSelectProduct = (productId) => {
    setSelectedProducts(prev => ({
      ...prev,
      [productId]: !prev[productId]
    }));
  };

  const toggleSelectAll = () => {
    const allSelected = Object.values(selectedProducts).every(v => v === true);
    const newSelection = {};
    Object.keys(selectedProducts).forEach(id => {
      newSelection[id] = !allSelected;
    });
    setSelectedProducts(newSelection);
  };

  const handleMultiDelete = async () => {
    const idsToDelete = Object.keys(selectedProducts).filter(id => selectedProducts[id]);
    if (idsToDelete.length === 0) {
      alert('No has seleccionado ningún producto.');
      return;
    }
    if (!window.confirm(`¿Eliminar permanentemente ${idsToDelete.length} producto(s)? Esta acción no se puede deshacer.`)) return;
    
    setDeletingMultiple(true);
    let successCount = 0;
    let errorCount = 0;
    
    // Eliminar en paralelo con Promise.allSettled para no detenerse por errores
    const deletePromises = idsToDelete.map(id => 
      axios.delete(`/inventario/products/${id}/`).catch(err => ({ error: true, id, err }))
    );
    const results = await Promise.allSettled(deletePromises);
    
    results.forEach(result => {
      if (result.status === 'fulfilled' && !result.value?.error) successCount++;
      else errorCount++;
    });
    
    alert(`Eliminación completada: ${successCount} eliminados, ${errorCount} fallaron.`);
    setShowMultiDeleteModal(false);
    setSelectedProducts({});
    fetchProducts();
    setDeletingMultiple(false);
  };

  // ========== FIN NUEVA FUNCIONALIDAD ==========

  const handleExcelUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      alert('Por favor seleccione un archivo .xlsx o .xls');
      return;
    }
    setUploadingExcel(true);
    setExcelFeedback(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axios.post('/inventario/products/upload_excel/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setExcelFeedback({
        type: 'success',
        message: `✅ Procesado: ${res.data.creados} creados, ${res.data.actualizados} actualizados.`,
        errors: res.data.errores
      });
      fetchProducts();
    } catch (err) {
      console.error(err);
      setExcelFeedback({
        type: 'error',
        message: 'Error al subir el archivo: ' + (err.response?.data?.error || err.message),
        errors: []
      });
    } finally {
      setUploadingExcel(false);
      event.target.value = '';
    }
  };

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>
  );

  // Contador de seleccionados para el botón de eliminación múltiple
  const selectedCount = Object.values(selectedProducts).filter(v => v === true).length;

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">ProIOS - Gestión de Inventario</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button onClick={() => navigate('/')} className="px-4 py-2 text-sm text-indigo-600 hover:text-indigo-900">
                ← Volver al Dashboard
              </button>
              <span className="text-sm text-gray-600">Hola, {user?.username}</span>
              <button onClick={logout} className="px-4 py-2 text-sm text-white bg-red-600 rounded-md hover:bg-red-700">
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header y acciones */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Productos en Stock</h2>
            <div className="flex gap-2 w-full sm:w-auto">
              <label className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
                {uploadingExcel ? 'Subiendo...' : '📂 Cargar desde Excel'}
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelUpload} disabled={uploadingExcel} />
              </label>
              {/* Botón de eliminación múltiple */}
              <button
                onClick={openMultiDeleteModal}
                className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md shadow-sm text-red-700 bg-white hover:bg-red-50"
              >
                🗑️ Eliminar múltiples
              </button>
              <button onClick={openCreateModal} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700">
                + Nuevo Producto
              </button>
            </div>
          </div>

          {/* Feedback de carga Excel */}
          {excelFeedback && (
            <div className={`mb-4 p-3 rounded-md ${excelFeedback.type === 'success' ? 'bg-green-50 border-l-4 border-green-500' : 'bg-red-50 border-l-4 border-red-500'}`}>
              <p className="text-sm font-medium">{excelFeedback.message}</p>
              {excelFeedback.errors && excelFeedback.errors.length > 0 && (
                <details className="mt-2">
                  <summary className="text-xs cursor-pointer text-gray-600">Ver errores ({excelFeedback.errors.length})</summary>
                  <ul className="mt-1 text-xs text-red-600 list-disc list-inside">
                    {excelFeedback.errors.slice(0, 10).map((err, i) => <li key={i}>{err}</li>)}
                    {excelFeedback.errors.length > 10 && <li>... y {excelFeedback.errors.length - 10} más</li>}
                  </ul>
                </details>
              )}
            </div>
          )}

          {/* Buscador y filtro */}
          <div className="mb-6 flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Buscar por nombre o presentación..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
            <div className="sm:w-64">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              >
                {categoriasUnicas.map(cat => (
                  <option key={cat} value={cat}>
                    {cat === 'todos' ? '📋 Todas las categorías' : cat === 'quimicos' ? '🧪 Químicos' : cat === 'otros' ? '📦 Otros' : cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {/* Grid de tarjetas */}
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No hay productos</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm || selectedCategory !== 'todos' ? 'No se encontraron productos con esos filtros.' : 'Comienza creando un nuevo producto o cargando desde Excel.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredProducts.map((product) => (
                <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow border border-gray-200 flex flex-col">
                  <div className="p-5 flex-1">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900 truncate" title={product.nombre}>
                          {product.nombre}
                        </h3>
                        <span className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                          product.categoria === 'quimicos' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {product.categoria === 'quimicos' ? '🧪 Químico' : product.categoria || 'Otros'}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => openEditModal(product)} className="text-blue-400 hover:text-blue-600 transition-colors p-1" title="Editar">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button onClick={() => confirmDelete(product)} className="text-red-400 hover:text-red-600 transition-colors p-1" title="Eliminar">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    
                    <div className="mt-3 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Presentación:</span>
                        <span className="font-medium text-gray-900">{product.presentacion}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Peso unitario:</span>
                        <span className="font-medium text-gray-900">{parseFloat(product.peso_kg).toFixed(2)} kg</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Stock actual:</span>
                        <span className={`font-bold ${parseFloat(product.stock_actual) <= 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {parseFloat(product.stock_actual).toFixed(2)} {product.presentacion.includes('Litro') ? 'L' : product.presentacion.includes('Kg') ? 'kg' : 'u'}
                        </span>
                      </div>
                      {product.descripcion && (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          <p className="text-xs text-gray-400 line-clamp-2">{product.descripcion}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Creación/Edición (sin cambios) */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowProductModal(false)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleProductSubmit}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                    {editingProduct ? 'Editar producto' : 'Crear nuevo producto'}
                  </h3>
                  {validationError && (
                    <div className="mb-4 p-2 bg-red-100 text-red-700 text-sm rounded whitespace-pre-wrap">
                      {validationError}
                    </div>
                  )}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Nombre *</label>
                      <input
                        type="text"
                        required
                        value={formData.nombre}
                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Descripción</label>
                      <textarea
                        rows={3}
                        value={formData.descripcion}
                        onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Presentación *</label>
                      <input
                        type="text"
                        required
                        value={formData.presentacion}
                        onChange={(e) => setFormData({ ...formData, presentacion: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="Ej: Tambor 200L"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Categoría</label>
                      <select
                        value={formData.categoria}
                        onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      >
                        <option value="quimicos">🧪 Químicos</option>
                        <option value="otros">📦 Otros</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Peso (kg) *</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={formData.peso_kg}
                        onChange={(e) => setFormData({ ...formData, peso_kg: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Stock actual</label>
                      <input
                        type="number"
                        step="0.0001"
                        value={formData.stock_actual}
                        onChange={(e) => setFormData({ ...formData, stock_actual: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                  >
                    {submitting ? (editingProduct ? 'Actualizando...' : 'Creando...') : (editingProduct ? 'Actualizar' : 'Crear')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowProductModal(false)}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal de eliminación individual */}
      {showDeleteModal && productToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowDeleteModal(false)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Eliminar producto</h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        ¿Estás seguro de que deseas eliminar <strong>{productToDelete.nombre}</strong>? Esta acción no se puede deshacer.
                      </p>
                      <p className="text-xs text-red-500 mt-2">Advertencia: Si el producto tiene movimientos de stock asociados, la eliminación podría fallar.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={submitting}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  {submitting ? 'Eliminando...' : 'Eliminar'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NUEVO MODAL: ELIMINACIÓN MÚLTIPLE */}
      {showMultiDeleteModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowMultiDeleteModal(false)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                      Eliminar múltiples productos
                    </h3>
                    <div className="mt-4">
                      <p className="text-sm text-gray-500 mb-4">
                        Selecciona los productos que deseas eliminar. Esta acción es irreversible.
                      </p>
                      <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-md">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-4 py-3 text-left">
                                <input
                                  type="checkbox"
                                  checked={Object.values(selectedProducts).length > 0 && Object.values(selectedProducts).every(v => v === true)}
                                  onChange={toggleSelectAll}
                                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                />
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Presentación</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {filteredProducts.map((product) => (
                              <tr key={product.id} className="hover:bg-gray-50">
                                <td className="px-4 py-2">
                                  <input
                                    type="checkbox"
                                    checked={selectedProducts[product.id] || false}
                                    onChange={() => toggleSelectProduct(product.id)}
                                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                  />
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-900">{product.nombre}</td>
                                <td className="px-4 py-2 text-sm text-gray-500">{product.presentacion}</td>
                                <td className="px-4 py-2 text-sm text-gray-500">{parseFloat(product.stock_actual).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="mt-4 text-sm text-gray-600">
                        {selectedCount} producto(s) seleccionado(s)
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleMultiDelete}
                  disabled={deletingMultiple || selectedCount === 0}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  {deletingMultiple ? 'Eliminando...' : `Eliminar (${selectedCount})`}
                </button>
                <button
                  type="button"
                  onClick={() => setShowMultiDeleteModal(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}