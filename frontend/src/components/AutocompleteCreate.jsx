import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import axios from '../api/axios';

export default function AutocompleteCreate({
  label,
  endpoint,
  value,
  onSelect,
  createFields = [],
  extraCreateData = {},
  placeholder = 'Buscar o seleccionar...',
  nameField = 'name',
}) {
  const [options, setOptions] = useState([]);
  const [filteredOptions, setFilteredOptions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  // Modal states for creation
  const [isCreating, setIsCreating] = useState(false);
  const [createData, setCreateData] = useState({});
  const [creatingLoading, setCreatingLoading] = useState(false);

  const wrapperRef = useRef(null);

  const getDisplayName = (opt) => {
    if (!opt) return '';
    return opt[nameField] || opt.nombre || opt.name || opt.contact_person || opt.flag || opt.country || opt.imo || opt.presentation || `Ref: ${opt.id}`;
  };

  useEffect(() => {
    fetchOptions();
  }, [endpoint]);

  useEffect(() => {
    if (!value) {
      setSelectedItem(null);
      setSearchTerm('');
      return;
    }

    const match = options.find((opt) => String(opt.id) === String(value));

    if (match) {
      setSelectedItem(match);
      setSearchTerm(getDisplayName(match));
    } else if (options.length > 0 && !loading) {
      // CORRECCIÓN 1: Escudo protector. Solo buscamos si el value parece un ID numérico real.
      const isNumericId = !isNaN(value) && !isNaN(parseFloat(value));

      if (isNumericId && String(selectedItem?.id) !== String(value)) {
        const fetchSingleItem = async () => {
          try {
            const separator = endpoint.endsWith('/') ? '' : '/';
            const res = await axios.get(`${endpoint}${separator}${value}/`);
            const item = res.data;
            setSelectedItem(item);
            setSearchTerm(getDisplayName(item));
            setOptions(prev => [...prev, item]);
          } catch (error) {
            console.error(`Item ${value} no encontrado individualmente`, error);
            setSearchTerm(`Ref: ${value}`);
          }
        };
        fetchSingleItem();
      }
    }
  }, [value, options, loading, endpoint, nameField]);

  const fetchOptions = async () => {
    setLoading(true);
    try {
      let url = endpoint;
      if (!url.includes('page_size=')) {
        const separator = url.includes('?') ? '&' : '?';
        url = `${url}${separator}page_size=10000`;
      }
      const res = await axios.get(url);
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      setOptions(data);
      setFilteredOptions(data);
    } catch (err) {
      console.error(`Error fetching options from ${endpoint}`, err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e) => {
    const text = e.target.value;
    setSearchTerm(text);
    if (!isOpen) setIsOpen(true);

    const filtered = options.filter(opt => {
      const displayVal = String(getDisplayName(opt)).toLowerCase();
      return displayVal.includes(text.toLowerCase());
    });
    setFilteredOptions(filtered);

    if (text === '') {
      setSelectedItem(null);
      onSelect(null);
    } else {
      const exactMatch = options.find(opt => {
        const displayVal = String(getDisplayName(opt)).toLowerCase();
        return displayVal === text.toLowerCase();
      });
      if (exactMatch) {
        setSelectedItem(exactMatch);
        onSelect(exactMatch);
      } else {
        setSelectedItem(null);
        // CORRECCIÓN 2: Mientras el usuario escribe libremente, NO le decimos al padre que es un ID. 
        // Solo mandamos null hasta que seleccione una opción real o cree una nueva.
        onSelect(null);
      }
    }
  };

  const handleOptionClick = (opt) => {
    setSelectedItem(opt);
    setSearchTerm(getDisplayName(opt));
    setIsOpen(false);
    onSelect(opt);
  };

  const handleOpenCreate = () => {
    setIsOpen(false);
    setCreateData({ [nameField]: searchTerm, ...extraCreateData });
    setIsCreating(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setCreatingLoading(true);
    try {
      const res = await axios.post(endpoint, createData);
      const newItem = res.data;

      const newOptions = [...options, newItem];
      setOptions(newOptions);
      setFilteredOptions(newOptions);

      handleOptionClick(newItem);
      setIsCreating(false);
    } catch (err) {
      console.error(`Error creating item at ${endpoint}`, err);
      alert('Error al crear elemento. Revisa los datos.');
    } finally {
      setCreatingLoading(false);
    }
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        if (selectedItem) {
          setSearchTerm(getDisplayName(selectedItem));
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef, selectedItem]);

  return (
    <div className="relative" ref={wrapperRef}>
      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">{label}</label>
      <input
        type="text"
        autoComplete="off"
        className="mt-1 block w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
        value={searchTerm}
        onChange={handleSearchChange}
        onClick={() => setIsOpen(true)}
        placeholder={placeholder}
      />

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-700 shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 dark:ring-slate-600 overflow-auto focus:outline-none sm:text-sm">
          {loading && <div className="px-4 py-2 text-gray-500 dark:text-slate-400">Cargando...</div>}

          {!loading && filteredOptions.length === 0 && (
            <div className="px-4 py-2 text-gray-500 dark:text-slate-400">No se encontraron resultados.</div>
          )}

          {!loading && filteredOptions.map((opt) => (
            <div
              key={opt.id}
              className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-indigo-600 hover:text-white text-gray-900 dark:text-slate-200 transition-colors"
              onClick={() => handleOptionClick(opt)}
            >
              <span className="block truncate">
                {getDisplayName(opt)}
              </span>
            </div>
          ))}

          <div
            className="cursor-pointer select-none relative py-2 pl-3 pr-9 border-t border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-600 hover:bg-indigo-50 dark:hover:bg-slate-500 text-indigo-600 dark:text-indigo-400 font-medium transition-colors"
            onClick={handleOpenCreate}
          >
            + Crear nuevo {searchTerm ? `"${searchTerm}"` : ''}
          </div>
        </div>
      )}

      {isCreating && createPortal(
        <div className="fixed inset-0 z-[110] overflow-y-auto w-full">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={() => setIsCreating(false)}>
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white dark:bg-slate-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-gray-200 dark:border-slate-700">
              <div className="bg-white dark:bg-slate-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                      Crear {label.replace(' *', '')}
                    </h3>
                    <div className="mt-4 space-y-4">
                      {!createFields.some(f => f.name === nameField) && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Nombre / Identificador</label>
                          <input
                            type="text"
                            className="mt-1 block w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
                            value={createData[nameField] || ''}
                            onChange={(e) => setCreateData({ ...createData, [nameField]: e.target.value })}
                            required
                          />
                        </div>
                      )}

                      {createFields.map((field) => (
                        <div key={field.name}>
                          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">{field.label}</label>
                          <input
                            type={field.type || 'text'}
                            step={field.type === 'number' ? 'any' : undefined}
                            className="mt-1 block w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
                            value={createData[field.name] || ''}
                            onChange={(e) => setCreateData({ ...createData, [field.name]: field.type === 'number' ? Number(e.target.value) : e.target.value })}
                            required={field.required}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-slate-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t border-gray-200 dark:border-slate-600">
                <button
                  type="button"
                  onClick={handleCreateSubmit}
                  disabled={creatingLoading}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  {creatingLoading ? 'Guardando...' : 'Guardar'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-slate-600 shadow-sm px-4 py-2 bg-white dark:bg-slate-700 text-base font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}