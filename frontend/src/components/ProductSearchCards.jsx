import { useState } from 'react';

export default function ProductSearchCards({ initialProducts = [] }) {
  const [products, setProducts] = useState(initialProducts);
  const [searchEngine, setSearchEngine] = useState('google'); // 'google' | 'mercadolibre'
  const [editingId, setEditingId] = useState(null);
  
  // Handlers para agregar nuevo
  const addNewProduct = () => {
    const newId = Date.now().toString();
    setProducts([...products, { id: newId, nombre: '', cantidad: 1, unidad: 'unidades' }]);
    setEditingId(newId);
  };

  const removeProduct = (id) => {
    setProducts(products.filter(p => p.id !== id));
  };

  const updateProduct = (id, field, value) => {
    setProducts(products.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const finishEditing = () => {
    // Si quedó un producto sin nombre, eliminarlo
    setProducts(products.filter(p => p.nombre && p.nombre.trim() !== ''));
    setEditingId(null);
  };

  // Constructores de links
  const getGoogleLink = (productName) => {
    return `https://www.google.com/search?q=${encodeURIComponent(productName)}`;
  };

  const getMercadoLibreLink = (productName) => {
    // "Botas de seguridad" -> "botas-de-seguridad"
    const formatted = productName.trim().toLowerCase().replace(/\s+/g, '-');
    return `https://listado.mercadolibre.com.ar/${encodeURIComponent(formatted)}`;
  };

  if (products.length === 0 && !editingId) {
    return (
      <div className="mt-4 p-4 border border-dashed border-gray-300 dark:border-slate-600 rounded-xl text-center">
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-3">No se detectaron productos automáticamente.</p>
        <button onClick={addNewProduct} className="text-sm text-indigo-600 dark:text-indigo-400 font-bold hover:text-indigo-800 dark:hover:text-indigo-300">
          <i className="bi bi-plus-circle-fill mr-1"></i> Añadir Producto Manualmente
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 border-b border-gray-100 dark:border-slate-700 pb-4">
        <h4 className="text-sm font-black text-gray-800 dark:text-white uppercase tracking-widest flex items-center gap-2">
          <i className="bi bi-boxes text-indigo-500"></i> Productos a Cotizar ({products.length})
        </h4>
        
        <div className="flex items-center gap-4 mt-3 sm:mt-0 bg-slate-100 dark:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 shadow-inner">
          <span className="text-xs font-bold text-gray-500 dark:text-slate-400 mr-2 uppercase">Buscador:</span>
          
          <label className="flex items-center gap-1.5 cursor-pointer text-sm font-medium text-gray-700 dark:text-slate-300">
            <input type="radio" name="search_engine" value="google"
              checked={searchEngine === 'google'} onChange={() => setSearchEngine('google')}
              className="text-indigo-600 focus:ring-indigo-500"
            />
            Google
          </label>
          
          <label className="flex items-center gap-1.5 cursor-pointer text-sm font-medium text-gray-700 dark:text-slate-300">
            <input type="radio" name="search_engine" value="mercadolibre"
              checked={searchEngine === 'mercadolibre'} onChange={() => setSearchEngine('mercadolibre')}
              className="text-yellow-500 focus:ring-yellow-500"
            />
            MercadoLibre
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((p) => {
          const isEditing = editingId === p.id;

          return (
            <div key={p.id} className="bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow relative group flex flex-col justify-between">
              
              {!isEditing && (
                <button 
                  onClick={() => removeProduct(p.id)} 
                  className="absolute top-2 right-2 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1"
                  title="Eliminar ítem"
                >
                  <i className="bi bi-x-circle-fill"></i>
                </button>
              )}

              {isEditing ? (
                <div className="space-y-3 mb-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Producto</label>
                    <input 
                      type="text" value={p.nombre}
                      onChange={(e) => updateProduct(p.id, 'nombre', e.target.value)} 
                      placeholder="Ej. Botas solas"
                      className="w-full mt-1 border-gray-300 dark:border-slate-500 dark:bg-slate-600 dark:text-white rounded-md text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 transition-colors"
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-2">
                    <div className="w-1/3">
                      <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Cant.</label>
                      <input type="number" value={p.cantidad}
                        onChange={(e) => updateProduct(p.id, 'cantidad', e.target.value)} 
                        className="w-full mt-1 border-gray-300 dark:border-slate-500 dark:bg-slate-600 dark:text-white rounded-md text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 transition-colors"
                      />
                    </div>
                    <div className="w-2/3">
                      <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Unidad</label>
                      <input type="text" value={p.unidad}
                        onChange={(e) => updateProduct(p.id, 'unidad', e.target.value)} 
                        className="w-full mt-1 border-gray-300 dark:border-slate-500 dark:bg-slate-600 dark:text-white rounded-md text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 transition-colors"
                      />
                    </div>
                  </div>
                  <button onClick={finishEditing} className="w-full py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-bold text-xs rounded-lg hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 transition-colors border border-indigo-200 dark:border-indigo-700">
                    Guardar
                  </button>
                </div>
              ) : (
                <div className="mb-4 pr-6">
                  <h5 className="font-bold text-gray-900 dark:text-white leading-tight mb-1" title={p.nombre}>{p.nombre}</h5>
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-600 border border-slate-200 dark:border-slate-500 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <i className="bi bi-tag-fill text-slate-400"></i> {p.cantidad} {p.unidad}
                  </div>
                  <button onClick={() => setEditingId(p.id)} className="text-[10px] uppercase font-bold text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 ml-3 underline decoration-indigo-200 underline-offset-2">
                    Editar
                  </button>
                </div>
              )}

              {!isEditing && p.nombre && (
                <div className="mt-auto grid gap-2">
                  <a 
                    href={searchEngine === 'google' ? getGoogleLink(p.nombre) : getMercadoLibreLink(p.nombre)}
                    target="_blank" rel="noopener noreferrer"
                    className={`w-full text-center py-2 text-sm font-bold rounded-lg transition-colors border shadow-sm ${
                      searchEngine === 'google' 
                        ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-700' 
                        : 'bg-yellow-400 hover:bg-yellow-500 text-slate-900 border-yellow-500'
                    }`}
                  >
                    <i className={searchEngine === 'google' ? 'bi bi-google mr-1.5' : 'bi bi-shop mr-1.5'}></i>
                    Buscar en {searchEngine === 'google' ? 'Google' : 'MercadoLibre'}
                  </a>
                  <a 
                    href={searchEngine === 'google' ? getMercadoLibreLink(p.nombre) : getGoogleLink(p.nombre)}
                    target="_blank" rel="noopener noreferrer"
                    className="w-full text-center py-1.5 text-xs font-bold rounded-lg text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-600 border border-slate-200 dark:border-slate-500 hover:bg-slate-50 dark:bg-slate-900/20 dark:hover:bg-slate-500 transition-colors"
                  >
                    Alternativa: {searchEngine === 'google' ? 'MercadoLibre' : 'Google'}
                  </a>
                </div>
              )}
            </div>
          );
        })}

        {/* Carta para agregar nuevo manual */}
        <div 
          onClick={addNewProduct}
          className="bg-transparent border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/20 transition-all min-h-[140px] opacity-70 hover:opacity-100"
        >
          <i className="bi bi-plus-circle text-2xl text-gray-400 dark:text-slate-500 mb-2"></i>
          <span className="text-sm font-bold text-gray-500 dark:text-slate-400">Añadir Otro Producto</span>
        </div>
      </div>
    </div>
  );
}
