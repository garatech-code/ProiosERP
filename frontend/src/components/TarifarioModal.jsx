import React, { useState, useEffect } from 'react';
import axios from '../api/axios';

const TarifarioModal = ({ isOpen, onClose, onSelectTarifa = null }) => {
  const [tarifas, setTarifas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form para crear nueva tarifa
  const [showNewRow, setShowNewRow] = useState(false);
  const [newTarifa, setNewTarifa] = useState({
    categoria_es: '',
    categoria_en: '',
    rol_es: '',
    rol_en: '',
    precio_usd: '',
    orden: 0
  });

  // Estado para editar tarifa existente
  const [editingTarifa, setEditingTarifa] = useState(null);
  const [editingLoading, setEditingLoading] = useState(false);

  const fetchTarifas = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const res = await axios.get('/operaciones/tarifas-hora-hombre/');
      const data = res.data.results || res.data;
      setTarifas(data);
    } catch (err) {
      console.error('Error fetching tarifas:', err);
      setErrorMsg('No se pudieron cargar las tarifas de hora hombre.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTarifas();
      setErrorMsg('');
      setSuccessMsg('');
      setEditingTarifa(null);
    }
  }, [isOpen]);

  const handlePriceChange = (id, newPrice) => {
    setTarifas(prev =>
      prev.map(t => (t.id === id ? { ...t, precio_usd: newPrice, _dirty: true } : t))
    );
  };

  const handleSavePrice = async (item) => {
    try {
      setSavingId(item.id);
      setErrorMsg('');
      await axios.patch(`/operaciones/tarifas-hora-hombre/${item.id}/`, {
        precio_usd: parseFloat(item.precio_usd) || 0
      });
      setTarifas(prev =>
        prev.map(t => (t.id === item.id ? { ...t, _dirty: false } : t))
      );
      setSuccessMsg(`Precio de "${item.rol_es || item.rol}" guardado exitosamente.`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error('Error updating tarifa:', err);
      setErrorMsg('Error al guardar el precio. Verifique el valor ingresado.');
    } finally {
      setSavingId(null);
    }
  };

  const handleResetDefaults = async () => {
    if (!window.confirm('¿Desea restaurar/recargar el listado estándar oficial de Techship / Proios S.A.?')) return;
    try {
      setLoading(true);
      setErrorMsg('');
      await axios.post('/operaciones/tarifas-hora-hombre/seed-defaults/');
      await fetchTarifas();
      setSuccessMsg('Tarifario oficial restaurado correctamente con categorías y nombres en Español e Inglés.');
      setTimeout(() => setSuccessMsg(''), 3500);
    } catch (err) {
      console.error('Error seeding tarifas:', err);
      setErrorMsg('Error al recargar las tarifas estándar.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTarifa = async (e) => {
    e.preventDefault();
    const catEs = (newTarifa.categoria_es || '').trim().toUpperCase();
    const catEn = (newTarifa.categoria_en || '').trim().toUpperCase();
    const rolEs = (newTarifa.rol_es || '').trim().toUpperCase();
    const rolEn = (newTarifa.rol_en || '').trim().toUpperCase();

    if (!catEs && !catEn) {
      setErrorMsg('Debe ingresar la categoría en español o inglés.');
      return;
    }
    if (!rolEs && !rolEn) {
      setErrorMsg('Debe ingresar el nombre/rol en español o inglés.');
      return;
    }

    const finalCat = catEn || catEs;
    const finalRol = rolEn || rolEs;

    try {
      setLoading(true);
      setErrorMsg('');
      await axios.post('/operaciones/tarifas-hora-hombre/', {
        categoria: finalCat,
        categoria_es: catEs || finalCat,
        categoria_en: catEn || finalCat,
        rol: finalRol,
        rol_es: rolEs || finalRol,
        rol_en: rolEn || finalRol,
        precio_usd: parseFloat(newTarifa.precio_usd) || 0,
        orden: parseInt(newTarifa.orden, 10) || 0
      });
      setNewTarifa({
        categoria_es: '',
        categoria_en: '',
        rol_es: '',
        rol_en: '',
        precio_usd: '',
        orden: 0
      });
      setShowNewRow(false);
      await fetchTarifas();
      setSuccessMsg('Nueva tarifa agregada correctamente con categorías y nombres bilingües.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error('Error creating tarifa:', err);
      setErrorMsg('No se pudo registrar la nueva tarifa.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (item) => {
    setEditingTarifa({
      id: item.id,
      categoria_es: item.categoria_es || item.categoria || '',
      categoria_en: item.categoria_en || item.categoria || '',
      rol_es: item.rol_es || item.rol || '',
      rol_en: item.rol_en || item.rol || '',
      precio_usd: item.precio_usd
    });
  };

  const handleCancelEdit = () => {
    setEditingTarifa(null);
  };

  const handleSaveEdit = async () => {
    if (!editingTarifa) return;
    const catEs = (editingTarifa.categoria_es || '').trim().toUpperCase();
    const catEn = (editingTarifa.categoria_en || '').trim().toUpperCase();
    const rolEs = (editingTarifa.rol_es || '').trim().toUpperCase();
    const rolEn = (editingTarifa.rol_en || '').trim().toUpperCase();

    if (!catEs && !catEn) {
      setErrorMsg('Debe ingresar la categoría en español o inglés.');
      return;
    }
    if (!rolEs && !rolEn) {
      setErrorMsg('Debe ingresar el nombre/rol en español o inglés.');
      return;
    }

    const finalCat = catEn || catEs;
    const finalRol = rolEn || rolEs;

    try {
      setEditingLoading(true);
      setErrorMsg('');
      const res = await axios.patch(`/operaciones/tarifas-hora-hombre/${editingTarifa.id}/`, {
        categoria: finalCat,
        categoria_es: catEs || finalCat,
        categoria_en: catEn || finalCat,
        rol: finalRol,
        rol_es: rolEs || finalRol,
        rol_en: rolEn || finalRol,
        precio_usd: parseFloat(editingTarifa.precio_usd) || 0
      });
      setTarifas(prev => prev.map(t => (t.id === editingTarifa.id ? res.data : t)));
      setEditingTarifa(null);
      setSuccessMsg('Tarifa actualizada correctamente.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error('Error updating tarifa:', err);
      setErrorMsg('Error al guardar los cambios de la tarifa.');
    } finally {
      setEditingLoading(false);
    }
  };

  const handleDeleteTarifa = async (item) => {
    const nombre = item.rol_es || item.rol;
    if (!window.confirm(`¿Seguro que desea eliminar "${nombre}" del tarifario?`)) return;
    try {
      setLoading(true);
      await axios.delete(`/operaciones/tarifas-hora-hombre/${item.id}/`);
      setTarifas(prev => prev.filter(t => t.id !== item.id));
      setSuccessMsg(`"${nombre}" fue eliminada.`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error('Error deleting tarifa:', err);
      setErrorMsg('No se pudo eliminar la tarifa seleccionada.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const categories = Array.from(new Set(tarifas.map(t => t.categoria_es || t.categoria).filter(Boolean)));

  const filteredTarifas = tarifas.filter(t => {
    const matchesCat = filterCategory 
      ? (t.categoria === filterCategory || t.categoria_es === filterCategory || t.categoria_en === filterCategory) 
      : true;
    const q = (search || '').toLowerCase();
    const matchesSearch = q
      ? (t.rol || '').toLowerCase().includes(q) ||
        (t.rol_es || '').toLowerCase().includes(q) ||
        (t.rol_en || '').toLowerCase().includes(q) ||
        (t.categoria || '').toLowerCase().includes(q) ||
        (t.categoria_es || '').toLowerCase().includes(q) ||
        (t.categoria_en || '').toLowerCase().includes(q)
      : true;
    return matchesCat && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 w-full max-w-5xl max-h-[92vh] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-xl shadow-inner">
              <i className="bi bi-clock-history"></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  Tarifario Oficial - Horas Hombre
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                  Techship Maritime
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Administre categorías y roles en Español e Inglés. Se aplicará el idioma respectivo al generar la cotización.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetDefaults}
              disabled={loading}
              title="Restaurar las 15 tarifas estándar de Techship con categorías y nombres bilingües"
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <i className="bi bi-arrow-counterclockwise"></i>
              <span>Restaurar Estándar</span>
            </button>
            <button
              type="button"
              onClick={() => setShowNewRow(!showNewRow)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
            >
              <i className={`bi ${showNewRow ? 'bi-dash-lg' : 'bi-plus-lg'}`}></i>
              <span>{showNewRow ? 'Cancelar' : 'Nueva Categoría'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition ml-2"
            >
              <i className="bi bi-x-lg text-lg"></i>
            </button>
          </div>
        </div>

        {/* Notificaciones */}
        {errorMsg && (
          <div className="mx-6 mt-3 px-4 py-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs rounded-xl flex items-center justify-between">
            <span><i className="bi bi-exclamation-triangle-fill mr-1.5"></i>{errorMsg}</span>
            <button onClick={() => setErrorMsg('')}><i className="bi bi-x"></i></button>
          </div>
        )}
        {successMsg && (
          <div className="mx-6 mt-3 px-4 py-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs rounded-xl flex items-center justify-between">
            <span><i className="bi bi-check-circle-fill mr-1.5"></i>{successMsg}</span>
            <button onClick={() => setSuccessMsg('')}><i className="bi bi-x"></i></button>
          </div>
        )}

        {/* Panel para agregar nueva tarifa */}
        {showNewRow && (
          <form onSubmit={handleCreateTarifa} className="mx-6 mt-4 p-4 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-xl border border-indigo-200 dark:border-indigo-800/60 animate-fadeIn">
            <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-200 uppercase tracking-wider mb-3 flex items-center gap-2">
              <i className="bi bi-plus-circle-fill text-indigo-600 dark:text-indigo-400"></i>
              Registrar Nueva Categoría / Rango
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">ES</span>
                  Categoría / Familia (Español) *
                </label>
                <input
                  type="text"
                  required
                  list="categoriesListEs"
                  placeholder="Ej: SERVICIOS MECÁNICOS"
                  value={newTarifa.categoria_es}
                  onChange={(e) => setNewTarifa({ ...newTarifa, categoria_es: e.target.value.toUpperCase() })}
                  className="w-full text-xs font-semibold px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
                <datalist id="categoriesListEs">
                  <option value="SERVICIOS MECÁNICOS" />
                  <option value="SERVICIOS DE REFRIGERACIÓN Y AIRE ACONDICIONADO" />
                  <option value="SERVICIOS DE SOLDADURA" />
                  <option value="SERVICIOS ELÉCTRICOS" />
                  <option value="SERVICIOS DE ELECTRÓNICA / RADIO / RADAR" />
                </datalist>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300">EN</span>
                  Categoría / Familia (Inglés) *
                </label>
                <input
                  type="text"
                  required
                  list="categoriesListEn"
                  placeholder="Ej: MECHANICAL SERVICES"
                  value={newTarifa.categoria_en}
                  onChange={(e) => setNewTarifa({ ...newTarifa, categoria_en: e.target.value.toUpperCase() })}
                  className="w-full text-xs font-semibold px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
                <datalist id="categoriesListEn">
                  <option value="MECHANICAL SERVICES" />
                  <option value="REEFER / AIR CONDT. SERVICE" />
                  <option value="WELDING SERVICES" />
                  <option value="ELECTRICAL SERVICES" />
                  <option value="ELECTRONICS / RADIO / RADAR SERVICES" />
                </datalist>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-4">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">ES</span>
                  Nombre / Rol (Español) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: SUPERVISOR DE ING. MECÁNICA"
                  value={newTarifa.rol_es}
                  onChange={(e) => setNewTarifa({ ...newTarifa, rol_es: e.target.value.toUpperCase() })}
                  className="w-full text-xs font-semibold px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="md:col-span-4">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300">EN</span>
                  Nombre / Rol (Inglés) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: MECHANICAL ENG. SUPERVISOR"
                  value={newTarifa.rol_en}
                  onChange={(e) => setNewTarifa({ ...newTarifa, rol_en: e.target.value.toUpperCase() })}
                  className="w-full text-xs font-semibold px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="md:col-span-4">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Precio USD (x Hora x Hombre)
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400 font-bold text-xs">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="0.00"
                      value={newTarifa.precio_usd}
                      onChange={(e) => setNewTarifa({ ...newTarifa, precio_usd: e.target.value })}
                      className="w-full text-xs font-bold pl-6 pr-2 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-sm whitespace-nowrap"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}

        {/* Toolbar de Filtros */}
        <div className="px-6 py-3 flex flex-col sm:flex-row gap-3 items-center justify-between border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <i className="bi bi-search absolute left-3 top-2.5 text-slate-400 text-xs"></i>
              <input
                type="text"
                placeholder="Buscar servicio, rol o categoría..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
              />
            </div>

            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="text-xs bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Todas las Familias</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="text-xs text-slate-400 font-medium self-end sm:self-auto">
            Total categorías: <strong className="text-slate-700 dark:text-slate-200">{filteredTarifas.length}</strong>
          </div>
        </div>

        {/* Tabla de Tarifas */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && tarifas.length === 0 ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
              <i className="bi bi-arrow-repeat animate-spin text-2xl text-indigo-500"></i>
              <span className="text-xs">Cargando tarifario...</span>
            </div>
          ) : filteredTarifas.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <p className="text-sm font-semibold">No se encontraron tarifas con ese criterio de búsqueda.</p>
            </div>
          ) : (
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 dark:bg-slate-800/80 text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                    <th className="py-3 px-4 w-1/3">Categoría / Familia</th>
                    <th className="py-3 px-4 w-1/3">Rol / Rango Técnico (X Hour X Man)</th>
                    <th className="py-3 px-4 text-right w-36">Tarifa USD</th>
                    <th className="py-3 px-4 text-center w-36">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {filteredTarifas.map((item) => {
                    const isEditing = editingTarifa && editingTarifa.id === item.id;
                    return (
                      <tr
                        key={item.id}
                        className={`transition group ${
                          isEditing
                            ? 'bg-amber-50/80 dark:bg-amber-950/40 ring-1 ring-amber-300 dark:ring-amber-700'
                            : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        {/* Celda Categoría */}
                        <td className="py-3 px-4">
                          {isEditing ? (
                            <div className="flex flex-col gap-1.5">
                              <div className="relative">
                                <span className="absolute left-2 top-1.5 px-1 rounded text-[8px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">ES</span>
                                <input
                                  type="text"
                                  className="w-full text-xs font-semibold pl-8 pr-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500"
                                  value={editingTarifa.categoria_es}
                                  onChange={(e) => setEditingTarifa({ ...editingTarifa, categoria_es: e.target.value.toUpperCase() })}
                                  placeholder="Categoría en Español"
                                />
                              </div>
                              <div className="relative">
                                <span className="absolute left-2 top-1.5 px-1 rounded text-[8px] font-bold bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300">EN</span>
                                <input
                                  type="text"
                                  className="w-full text-xs font-semibold pl-8 pr-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500"
                                  value={editingTarifa.categoria_en}
                                  onChange={(e) => setEditingTarifa({ ...editingTarifa, categoria_en: e.target.value.toUpperCase() })}
                                  placeholder="Categoría en Inglés"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5 font-bold text-indigo-700 dark:text-indigo-400">
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">ES</span>
                                <span>{item.categoria_es || item.categoria}</span>
                              </div>
                              {(item.categoria_en || item.categoria) !== (item.categoria_es || item.categoria) && (
                                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300">EN</span>
                                  <span>{item.categoria_en || item.categoria}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Celda Rol */}
                        <td className="py-3 px-4">
                          {isEditing ? (
                            <div className="flex flex-col gap-1.5">
                              <div className="relative">
                                <span className="absolute left-2 top-1.5 px-1 rounded text-[8px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">ES</span>
                                <input
                                  type="text"
                                  className="w-full text-xs font-semibold pl-8 pr-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500"
                                  value={editingTarifa.rol_es}
                                  onChange={(e) => setEditingTarifa({ ...editingTarifa, rol_es: e.target.value.toUpperCase() })}
                                  placeholder="Rol / Nombre en Español"
                                />
                              </div>
                              <div className="relative">
                                <span className="absolute left-2 top-1.5 px-1 rounded text-[8px] font-bold bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300">EN</span>
                                <input
                                  type="text"
                                  className="w-full text-xs font-semibold pl-8 pr-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500"
                                  value={editingTarifa.rol_en}
                                  onChange={(e) => setEditingTarifa({ ...editingTarifa, rol_en: e.target.value.toUpperCase() })}
                                  placeholder="Rol / Nombre en Inglés"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100">
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">ES</span>
                                <span>{item.rol_es || item.rol}</span>
                              </div>
                              {(item.rol_en || item.rol) !== (item.rol_es || item.rol) && (
                                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300">EN</span>
                                  <span>{item.rol_en || item.rol}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Celda Tarifa USD */}
                        <td className="py-3 px-4 text-right">
                          {isEditing ? (
                            <div className="inline-flex items-center gap-1.5 justify-end">
                              <span className="text-xs font-bold text-slate-400">USD</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={editingTarifa.precio_usd}
                                onChange={(e) => setEditingTarifa({ ...editingTarifa, precio_usd: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveEdit();
                                }}
                                className="w-24 text-right font-mono font-bold text-sm px-2.5 py-1 rounded-lg border border-amber-400 bg-white dark:bg-slate-800 text-amber-900 dark:text-amber-200 ring-2 ring-amber-300"
                              />
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5 justify-end">
                              <span className="text-xs font-bold text-slate-400">USD</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.precio_usd}
                                onChange={(e) => handlePriceChange(item.id, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSavePrice(item);
                                }}
                                className={`w-24 text-right font-mono font-bold text-sm px-2.5 py-1 rounded-lg border transition ${
                                  item._dirty
                                    ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 ring-2 ring-amber-300'
                                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100'
                                }`}
                              />
                              {item._dirty && (
                                <button
                                  type="button"
                                  onClick={() => handleSavePrice(item)}
                                  disabled={savingId === item.id}
                                  title="Guardar nuevo precio"
                                  className="p-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm font-bold transition flex items-center justify-center animate-pulse"
                                >
                                  {savingId === item.id ? (
                                    <i className="bi bi-arrow-repeat animate-spin"></i>
                                  ) : (
                                    <i className="bi bi-check-lg"></i>
                                  )}
                                </button>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Celda Acciones */}
                        <td className="py-3 px-4 text-center">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={handleSaveEdit}
                                disabled={editingLoading}
                                title="Guardar cambios"
                                className="px-2.5 py-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition shadow-sm flex items-center gap-1"
                              >
                                {editingLoading ? (
                                  <i className="bi bi-arrow-repeat animate-spin"></i>
                                ) : (
                                  <i className="bi bi-check-lg"></i>
                                )}
                                <span>Listo</span>
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelEdit}
                                title="Cancelar edición"
                                className="p-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                              >
                                <i className="bi bi-x-lg"></i>
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1.5">
                              {onSelectTarifa && (
                                <button
                                  type="button"
                                  onClick={() => onSelectTarifa(item)}
                                  title="Usar este ítem en la cotización"
                                  className="px-2.5 py-1 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800 rounded-lg transition"
                                >
                                  <i className="bi bi-plus-circle mr-1"></i> Usar
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleStartEdit(item)}
                                title="Editar categoría y roles (Español / Inglés)"
                                className="p-1.5 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition"
                              >
                                <i className="bi bi-pencil-square text-sm"></i>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteTarifa(item)}
                                title="Eliminar del catálogo"
                                className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition opacity-60 group-hover:opacity-100"
                              >
                                <i className="bi bi-trash text-sm"></i>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <i className="bi bi-info-circle text-indigo-500"></i>
            <span>Tip: Podés editar cualquier categoría o nombre haciendo clic en el lápiz <i className="bi bi-pencil-square mx-0.5 text-indigo-600 dark:text-indigo-400"></i> o cambiar el precio directamente.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white font-bold rounded-xl transition"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};

export default TarifarioModal;
