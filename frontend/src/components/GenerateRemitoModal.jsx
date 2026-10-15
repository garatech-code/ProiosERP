import React, { useState, useEffect } from 'react';
import axios from '../api/axios';

const getTodayFormatted = () => {
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const yyyy = today.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const GenerateRemitoModal = ({ isOpen, onClose, operationId, operation, showToast }) => {
  const defaultFecha = getTodayFormatted();
  const defaultCliente = operation?.ship_name || operation?.ship?.name || '';
  const defaultDomicilio = operation?.port_name || operation?.port?.name || '';

  const [formData, setFormData] = useState({
    fecha: defaultFecha,
    cliente: defaultCliente,
    domicilio: defaultDomicilio
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        fecha: defaultFecha,
        cliente: operation?.ship_name || operation?.ship?.name || '',
        domicilio: operation?.port_name || operation?.port?.name || ''
      });
    }
  }, [isOpen, operation]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        fecha: formData.fecha?.trim() || defaultFecha,
        cliente: formData.cliente?.trim() || defaultCliente,
        domicilio: formData.domicilio?.trim() || defaultDomicilio
      };

      const response = await axios.post(
        `/operaciones/operations/${operationId}/generate_remito_pdf/`,
        payload,
        { responseType: 'blob' }
      );
      
      const fileUrl = window.URL.createObjectURL(new Blob([response.data]));
      const fileLink = document.createElement('a');
      fileLink.href = fileUrl;
      fileLink.setAttribute('download', `Remito_OP${operationId}.pdf`);
      document.body.appendChild(fileLink);
      fileLink.click();
      document.body.removeChild(fileLink);
      
      if (showToast) showToast('Remito generado correctamente', 'success');
      onClose();
    } catch (error) {
      console.error("Error al generar remito:", error);
      if (showToast) showToast('Error al generar el remito', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700 overflow-hidden animate-slideUp">
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
            <i className="bi bi-file-earmark-pdf-fill text-indigo-500"></i>
            Generar Remito (PDF)
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors p-1 rounded-lg">
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
        
        <form onSubmit={handleGenerate} className="p-6 space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Ingresa o confirma los datos del remito. Si dejas algún campo vacío, se completará automáticamente con los valores predeterminados de la operación.
          </p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">Fecha</label>
              <input 
                type="text" 
                name="fecha" 
                value={formData.fecha} 
                onChange={handleChange} 
                placeholder={defaultFecha} 
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 dark:border-slate-600 rounded-xl dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors shadow-sm" 
              />
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Por defecto: día de hoy ({defaultFecha}).</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">Cliente</label>
              <input 
                type="text" 
                name="cliente" 
                value={formData.cliente} 
                onChange={handleChange} 
                placeholder={defaultCliente || "Nombre del Buque"}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 dark:border-slate-600 rounded-xl dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors shadow-sm" 
              />
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Por defecto: nombre del buque ({defaultCliente || 'No asignado'}).</p>
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">Domicilio</label>
              <input 
                type="text" 
                name="domicilio" 
                value={formData.domicilio} 
                onChange={handleChange} 
                placeholder={defaultDomicilio || "Puerto"}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 dark:border-slate-600 rounded-xl dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors shadow-sm" 
              />
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Por defecto: puerto de la operación ({defaultDomicilio || 'No asignado'}).</p>
            </div>
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-5 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={loading} 
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <><i className="bi bi-arrow-repeat animate-spin"></i> Generando...</> : <><i className="bi bi-file-earmark-pdf-fill"></i> Descargar PDF</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GenerateRemitoModal;
