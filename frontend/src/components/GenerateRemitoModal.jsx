import React, { useState } from 'react';
import axios from '../api/axios';

const GenerateRemitoModal = ({ isOpen, onClose, operationId, showToast }) => {
  const [formData, setFormData] = useState({
    fecha: '',
    domicilio: '',
    cuit: '',
    rancho: '',
    oc: '',
    transporto: '',
    condicion_venta: 'contado',
    iva: 'inscripto'
  });
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post(
        `/operaciones/operations/${operationId}/generate_remito_pdf/`,
        formData,
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">Generar Remito PDF</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
        
        <form onSubmit={handleGenerate} className="p-4 space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Rellena los datos para el talonario preimpreso. Si dejas algunos en blanco, se intentará usar la información del cliente registrado en la operación.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Fecha</label>
              <input type="text" name="fecha" value={formData.fecha} onChange={handleChange} placeholder="DD/MM/YYYY" className="w-full px-3 py-2 border rounded-md dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
              <p className="text-xs text-slate-500 mt-1">Si está vacío usa la fecha de hoy.</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Domicilio</label>
              <input type="text" name="domicilio" value={formData.domicilio} onChange={handleChange} className="w-full px-3 py-2 border rounded-md dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">CUIT</label>
              <input type="text" name="cuit" value={formData.cuit} onChange={handleChange} className="w-full px-3 py-2 border rounded-md dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Rancho N° (Buque)</label>
              <input type="text" name="rancho" value={formData.rancho} onChange={handleChange} className="w-full px-3 py-2 border rounded-md dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">O.C. N°</label>
              <input type="text" name="oc" value={formData.oc} onChange={handleChange} className="w-full px-3 py-2 border rounded-md dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Transportó</label>
              <input type="text" name="transporto" value={formData.transporto} onChange={handleChange} className="w-full px-3 py-2 border rounded-md dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Condición de Venta</label>
              <select name="condicion_venta" value={formData.condicion_venta} onChange={handleChange} className="w-full px-3 py-2 border rounded-md dark:bg-slate-700 dark:border-slate-600 dark:text-white">
                <option value="contado">Contado</option>
                <option value="cuenta corriente">Cuenta Corriente</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Condición IVA</label>
              <select name="iva" value={formData.iva} onChange={handleChange} className="w-full px-3 py-2 border rounded-md dark:bg-slate-700 dark:border-slate-600 dark:text-white">
                <option value="inscripto">Resp. Inscripto</option>
                <option value="no inscripto">Resp. No Inscripto</option>
                <option value="monotributo">Resp. Monotributo</option>
                <option value="exento">Exento / Cons. Final</option>
              </select>
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-4 border-t dark:border-slate-700">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-md hover:bg-slate-50 dark:border-slate-600 dark:text-white dark:hover:bg-slate-700">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
              {loading ? <><i className="bi bi-arrow-repeat animate-spin inline-block mr-1"></i> Generando...</> : 'Descargar PDF'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GenerateRemitoModal;
