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

  useEffect(() => {
    fetchOptions();
  }, [endpoint]);

  useEffect(() => {
    // Cuando el `value` cambia desde afuera (e.g. edición de operación), pre-seleccionamos
    if (value && options.length > 0) {
      const match = options.find((opt) => String(opt.id) === String(value));
      if (match) {
        setSelectedItem(match);
        setSearchTerm(match[nameField] || match.nombre || match.name || match.contact_person || match.flag || match.country || match.imo || match.presentation || `Ref: ${match.id}`);
      }
    } else if (!value) {
      setSelectedItem(null);
      setSearchTerm('');
    }
  }, [value, options]);

  const fetchOptions = async () => {
    setLoading(true);
    try {
      const res = await axios.get(endpoint);
      // Django REST framework suele devolver { count, next, previous, results: [] } o simplemente un array []
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
    
    // Filtrar opciones (buscando por varios campos posibles para ser flexible)
    const filtered = options.filter(opt => {
      const displayVal = (opt[nameField] || opt.nombre || opt.name || opt.contact_person || opt.flag || opt.country || opt.imo || opt.presentation || String(opt.id)).toLowerCase();
      return displayVal.includes(text.toLowerCase());
    });
    setFilteredOptions(filtered);

    // Si el usuario borra, quitamos la selección
    if (text === '') {
      setSelectedItem(null);
      onSelect(null);
    } else {
      // Si hay match exacto, lo marcamos
      const exactMatch = options.find(opt => {
        const displayVal = (opt[nameField] || opt.nombre || opt.name || opt.contact_person || opt.country || opt.imo || String(opt.id)).toLowerCase();
        return displayVal === text.toLowerCase();
      });
      if (exactMatch) {
        setSelectedItem(exactMatch);
        onSelect(exactMatch);
      } else {
        setSelectedItem(null);
        // Si no, emitimos el string instantáneamente
        onSelect({ id: text, [nameField]: text });
      }
    }
  };

  const handleOptionClick = (opt) => {
    setSelectedItem(opt);
    setSearchTerm(opt[nameField] || opt.nombre || opt.name || opt.contact_person || opt.flag || opt.country || opt.imo || opt.presentation || String(opt.id));
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
      
      // Actualizamos listado
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

  // Cerrar el dropdown al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        // Si no se seleccionó nada válido y había escrito algo suelto, no tocamos onSelect porque ya se emitió on change
        if (selectedItem) {
            setSearchTerm(selectedItem[nameField] || selectedItem.nombre || selectedItem.name || selectedItem.contact_person || selectedItem.flag || selectedItem.country || selectedItem.imo || selectedItem.presentation || String(selectedItem.id));
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [wrapperRef, selectedItem, searchTerm]);

  return (
    <div className="relative" ref={wrapperRef}>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <input
        type="text"
        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        value={searchTerm}
        onChange={handleSearchChange}
        onClick={() => setIsOpen(true)}
        placeholder={placeholder}
      />
      
      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
          {loading && <div className="px-4 py-2 text-gray-500">Cargando...</div>}
          
          {!loading && filteredOptions.length === 0 && (
            <div className="px-4 py-2 text-gray-500">No se encontraron resultados.</div>
          )}

          {!loading && filteredOptions.map((opt) => (
            <div
              key={opt.id}
              className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-indigo-600 hover:text-white text-gray-900"
              onClick={() => handleOptionClick(opt)}
            >
              <span className="block truncate">
                {opt[nameField] || opt.nombre || opt.name || opt.contact_person || opt.flag || opt.country || opt.imo || opt.presentation || `Ref: ${opt.id}`}
              </span>
            </div>
          ))}

          {/* Botón para crear uno nuevo */}
          <div 
            className="cursor-pointer select-none relative py-2 pl-3 pr-9 border-t border-gray-200 bg-gray-50 hover:bg-gray-100 text-indigo-600 font-medium"
            onClick={handleOpenCreate}
          >
            + Crear nuevo {searchTerm ? `"${searchTerm}"` : ''}
          </div>
        </div>
      )}

      {/* Modal para crear nueva entidad */}
      {isCreating && createPortal(
        <div className="fixed inset-0 z-[110] overflow-y-auto w-full">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={() => setIsCreating(false)}>
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Crear {label.replace(' *', '')}
                    </h3>
                    <div className="mt-4 space-y-4">
                      {/* Campo default Name/Texto principal, sólo si la lista de campos no lo incluye explícitamente */}
                      {!createFields.some(f => f.name === nameField) && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Nombre / Identificador</label>
                          <input
                            type="text"
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            value={createData[nameField] || ''}
                            onChange={(e) => setCreateData({ ...createData, [nameField]: e.target.value })}
                            required
                          />
                        </div>
                      )}
                      
                      {createFields.map((field) => (
                        <div key={field.name}>
                          <label className="block text-sm font-medium text-gray-700">{field.label}</label>
                          <input
                            type={field.type || 'text'}
                            step={field.type === 'number' ? 'any' : undefined}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
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
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
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
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
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
