import React, { useState, useEffect, useRef } from 'react';
import axios from '../api/axios';
import * as XLSX from 'xlsx';

const ToolsModal = ({ isOpen, onClose, operation, onSave, onPreview }) => {
  const [tools, setTools] = useState([]);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen && operation) {
      if (operation.herramientas_solicitud_particular) {
        try {
          const parsed = JSON.parse(operation.herramientas_solicitud_particular);
          if (Array.isArray(parsed)) {
            setTools(parsed);
          } else {
            // Migración desde texto plano a JSON si existiera algo
            const lines = operation.herramientas_solicitud_particular.split('\n').filter(l => l.trim() !== '');
            setTools(lines.map(l => ({ descripcion: l, cantidad: 1, serie: '' })));
          }
        } catch (e) {
          // Si no es JSON válido, asume texto plano
          const lines = operation.herramientas_solicitud_particular.split('\n').filter(l => l.trim() !== '');
          setTools(lines.map(l => ({ descripcion: l, cantidad: 1, serie: '' })));
        }
      } else {
        setTools([]);
      }
    }
  }, [isOpen, operation]);

  if (!isOpen) return null;

  const handleAddRow = () => {
    setTools([...tools, { descripcion: '', cantidad: 1, serie: '' }]);
  };

  const handleRemoveRow = (index) => {
    const newTools = [...tools];
    newTools.splice(index, 1);
    setTools(newTools);
  };

  const handleChange = (index, field, value) => {
    const newTools = [...tools];
    newTools[index][field] = value;
    setTools(newTools);
  };

  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        
        // Asumimos que la fila 0 tiene los headers (Descripción, Cantidad, Serie)
        // Ignoramos la fila 0 y procesamos el resto
        const newTools = [];
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (row.length > 0 && row[0]) {
            newTools.push({
              descripcion: String(row[0] || ''),
              cantidad: Number(row[1]) || 1,
              serie: String(row[2] || '')
            });
          }
        }
        
        if (newTools.length > 0) {
          setTools([...tools, ...newTools]);
        } else {
          alert('No se encontraron datos válidos en el Excel. Asegúrese de que la columna 1 tenga la descripción.');
        }
      } catch (error) {
        console.error("Error leyendo Excel", error);
        alert('Error al leer el archivo Excel.');
      }
      e.target.value = ''; // reset input
    };
    reader.readAsBinaryString(file);
  };

  const handleSave = async (andPreview = false, isDownload = false) => {
    setSaving(true);
    try {
      const payloadData = JSON.stringify(tools);
      // Enviamos el campo como JSON application
      await axios.patch(`/operaciones/operations/${operation.id}/`, {
        herramientas_solicitud_particular: payloadData
      });
      
      if (onSave) onSave();
      
      if (andPreview) {
        onPreview(isDownload);
      } else {
        alert('Herramientas guardadas exitosamente.');
        onClose();
      }
    } catch (error) {
      console.error("Error guardando herramientas:", error);
      alert('Hubo un error al guardar las herramientas.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700">
        
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
          <div>
            <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
              <i className="bi bi-tools text-amber-500"></i> Gestor de Herramientas PNA
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Arme la tabla de herramientas para la Solicitud Particular</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          <div className="flex justify-between items-center mb-4">
            <div className="flex gap-2">
              <button 
                onClick={handleAddRow}
                className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 border border-indigo-200"
              >
                <i className="bi bi-plus-circle-fill"></i> Añadir Fila
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 border border-emerald-200"
              >
                <i className="bi bi-file-earmark-excel-fill"></i> Importar Excel
              </button>
              <input type="file" accept=".xlsx, .xls" ref={fileInputRef} className="hidden" onChange={handleExcelUpload} />
            </div>
            
            <span className="text-xs font-bold text-slate-500">{tools.length} ítems</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-700">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-12">Nº</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Descripción del Equipo</th>
                  <th scope="col" className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider w-24">Cantidad</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-48">Nº Serie (Opcional)</th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider w-16">Acción</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                {tools.map((tool, index) => (
                  <tr key={index} className="hover:bg-slate-50 dark:bg-slate-900/20 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-4 py-2 whitespace-nowrap text-sm font-bold text-slate-500">{index + 1}</td>
                    <td className="px-4 py-2">
                      <input 
                        type="text" 
                        value={tool.descripcion} 
                        onChange={(e) => handleChange(index, 'descripcion', e.target.value)}
                        className="w-full text-sm py-1.5 px-2 rounded bg-transparent border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:text-white transition-colors"
                        placeholder="Ej: Máquina de Soldar"
                      />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <input 
                        type="number" 
                        min="1"
                        value={tool.cantidad} 
                        onChange={(e) => handleChange(index, 'cantidad', e.target.value)}
                        className="w-full text-center text-sm py-1.5 px-2 rounded bg-transparent border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:text-white transition-colors"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input 
                        type="text" 
                        value={tool.serie} 
                        onChange={(e) => handleChange(index, 'serie', e.target.value)}
                        className="w-full text-sm py-1.5 px-2 rounded bg-transparent border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:text-white transition-colors"
                        placeholder="SN-1234..."
                      />
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-right">
                      <button 
                        onClick={() => handleRemoveRow(index)}
                        className="text-red-400 hover:text-red-600 p-1 rounded-md hover:bg-red-50 dark:bg-red-900/20 dark:hover:bg-red-900/30 transition-colors"
                        title="Eliminar fila"
                      >
                        <i className="bi bi-trash-fill"></i>
                      </button>
                    </td>
                  </tr>
                ))}
                {tools.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-4 py-8 text-center text-slate-500 text-sm">
                      No hay herramientas registradas. Añada filas manualmente o importe un Excel.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-slate-400 mt-2"><i className="bi bi-info-circle"></i> Para importar, el Excel debe tener la 1ra columna "Descripción", la 2da "Cantidad" y la 3ra "Nº Serie" (sin encabezados en los datos, la fila 1 se asume como encabezado y se ignora).</p>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex justify-between items-center">
          <div className="flex gap-2">
            <button 
              onClick={() => handleSave(true, false)}
              disabled={saving || tools.length === 0}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <i className="bi bi-eye-fill"></i> Previsualizar PDF
            </button>
            <button 
              onClick={() => handleSave(true, true)}
              disabled={saving || tools.length === 0}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <i className="bi bi-download"></i> Descargar PDF
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-sm font-bold transition-colors">
              Cancelar
            </button>
            <button 
              onClick={() => handleSave(false, false)}
              disabled={saving}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow flex items-center gap-2 disabled:opacity-50 transition-colors"
            >
              {saving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <i className="bi bi-check-circle-fill"></i>}
              Guardar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ToolsModal;
