import React, { useState, useEffect } from 'react';
import axios from '../api/axios';
import { useAuth } from '../context/AuthContext';

const MOCK_AUTOCOMPLETE_DATA = {
  cliente_nombre: "Naviera Sur",
  buque_nombre: "Estrella del Mar"
};

export default function EmailTemplateManager({ onSelect, onCancel, defaultEditMode = false, hideManageButton = false, contextData = {} }) {
  const { user } = useAuth();
  const isOwner = user?.role === 'OWNER';

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  // Selector state
  const [language, setLanguage] = useState('ES');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  // Edit mode state
  const [editMode, setEditMode] = useState(defaultEditMode);
  const [editingTemplate, setEditingTemplate] = useState(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/correos/templates/');
      setTemplates(res.data);
    } catch (err) {
      console.error("Error al cargar plantillas:", err);
    } finally {
      setLoading(false);
    }
  };

  // Filter templates by selected language
  const filteredTemplates = templates.filter(t => t.idioma === language);

  const extractDynamicData = () => {
    let cliente = "[CLIENTE]";
    let buque = "[BUQUE]";

    // 1. Intentar desde la operación vinculada si existe
    if (contextData.operationId && contextData.operations) {
      const op = contextData.operations.find(o => String(o.id) === String(contextData.operationId));
      if (op) {
        if (op.client_name || op.client) cliente = op.client_name || op.client;
        if (op.vessel_name || op.buque) buque = op.vessel_name || op.buque;
      }
    }

    // 2. Si es una respuesta y todavía hay placeholders, intentar extraer de la cadena (asunto o cuerpo)
    if (contextData.isReply) {
      // Extraer buque del asunto
      if (buque === "[BUQUE]" && contextData.subject) {
        const subjVessel = contextData.subject.match(/(?:m\/v|mv|vessel|buque)[\s]*:?[\s]*([a-zA-Z0-9\s]+)/i);
        if (subjVessel) buque = subjVessel[1].trim();
      }
      // Extraer datos del cuerpo del mensaje original
      if (contextData.replyText) {
        if (cliente === "[CLIENTE]") {
          const clientMatch = contextData.replyText.match(/(?:cliente|client|to|para)[\s]*:[\s]*([^\n\r<]+)/i);
          if (clientMatch) {
            cliente = clientMatch[1].trim();
          } else if (contextData.senderName) {
            cliente = contextData.senderName;
          }
        }
        if (buque === "[BUQUE]") {
          const vesselMatch = contextData.replyText.match(/(?:buque|vessel|m\/v|mv)[\s]*:[\s]*([^\n\r<]+)/i);
          if (vesselMatch) buque = vesselMatch[1].trim();
        }
      }
    }

    return { cliente, buque };
  };

  const processTemplate = (text) => {
    if (!text) return '';
    const { cliente, buque } = extractDynamicData();

    return text.replace(/\{\{cliente_nombre\}\}/gi, cliente)
               .replace(/\{\{nombre_cliente\}\}/gi, cliente)
               .replace(/\{\{cliente\}\}/gi, cliente)
               .replace(/\{\{buque_nombre\}\}/gi, buque)
               .replace(/\{\{nombre_buque\}\}/gi, buque)
               .replace(/\{\{buque\}\}/gi, buque);
  };

  useEffect(() => {
    // Reset selected template when language changes
    setSelectedTemplateId('');
    setSubject('');
    setBody('');
  }, [language]);

  const handleTemplateChange = (e) => {
    const templateId = e.target.value;
    setSelectedTemplateId(templateId);

    if (templateId) {
      const template = templates.find(t => t.id === parseInt(templateId, 10));
      if (template) {
        setSubject(processTemplate(template.asunto));
        setBody(processTemplate(template.cuerpo));
      }
    } else {
      setSubject('');
      setBody('');
    }
  };

  const handleUse = () => {
    if (onSelect) {
      onSelect({ subject, body, language });
    }
  };

  // --- CRUD Functions for Owner ---
  const saveTemplate = async (e) => {
    e.preventDefault();
    try {
      if (editingTemplate.id) {
        await axios.put(`/correos/templates/${editingTemplate.id}/`, editingTemplate);
      } else {
        await axios.post('/correos/templates/', editingTemplate);
      }
      setEditingTemplate(null);
      setEditMode(false);
      fetchTemplates();
    } catch (err) {
      console.error(err);
      alert("Error al guardar la plantilla.");
    }
  };

  const deleteTemplate = async (id) => {
    if (!window.confirm("¿Estás seguro de eliminar esta plantilla?")) return;
    try {
      await axios.delete(`/correos/templates/${id}/`);
      fetchTemplates();
    } catch (err) {
      console.error(err);
      alert("Error al eliminar la plantilla.");
    }
  };

  if (editMode) {
    return (
      <div className="w-full max-w-4xl mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
          <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
            <i className="bi bi-gear-fill text-indigo-500"></i>
            Gestión de Plantillas (Owner)
          </h2>
          <button onClick={() => { if (defaultEditMode && onCancel) onCancel(); else setEditMode(false); }} className="text-slate-400 hover:text-slate-600 transition-colors">
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
        
        <div className="p-6 flex flex-col gap-6">
          {!editingTemplate ? (
            <>
              <button 
                onClick={() => setEditingTemplate({ titulo: '', asunto: '', cuerpo: '', idioma: 'ES' })}
                className="self-start px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 shadow-sm"
              >
                + Nueva Plantilla
              </button>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
                  <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-300">
                    <tr>
                      <th className="px-4 py-3">Idioma</th>
                      <th className="px-4 py-3">Título</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {templates.map(t => (
                      <tr key={t.id} className="border-b dark:border-slate-700">
                        <td className="px-4 py-3 font-bold">{t.idioma}</td>
                        <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">{t.titulo}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => setEditingTemplate(t)} className="text-blue-600 hover:underline mr-3"><i className="bi bi-pencil"></i></button>
                          <button onClick={() => deleteTemplate(t.id)} className="text-red-600 hover:underline"><i className="bi bi-trash"></i></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <form onSubmit={saveTemplate} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Idioma</label>
                  <select 
                    value={editingTemplate.idioma}
                    onChange={(e) => setEditingTemplate({...editingTemplate, idioma: e.target.value})}
                    className="block w-full py-2 px-3 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg"
                  >
                    <option value="ES">Español</option>
                    <option value="EN">Inglés</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Título (Uso Interno)</label>
                  <input 
                    required
                    value={editingTemplate.titulo}
                    onChange={(e) => setEditingTemplate({...editingTemplate, titulo: e.target.value})}
                    className="block w-full py-2 px-3 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg" 
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Asunto</label>
                <input 
                  required
                  value={editingTemplate.asunto}
                  onChange={(e) => setEditingTemplate({...editingTemplate, asunto: e.target.value})}
                  className="block w-full py-2 px-3 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Cuerpo</label>
                <textarea 
                  required rows={6}
                  value={editingTemplate.cuerpo}
                  onChange={(e) => setEditingTemplate({...editingTemplate, cuerpo: e.target.value})}
                  className="block w-full py-2 px-3 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg" 
                />
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setEditingTemplate(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-bold">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold">Guardar</button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  // --- Main Selector UI ---
  return (
    <div className="w-full max-w-4xl mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
        <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
          <i className="bi bi-envelope-paper text-indigo-500" aria-label="Icono de plantillas de correo" title="Plantillas de Correo"></i>
          Seleccionar Plantilla
        </h2>
        {isOwner && !hideManageButton && (
          <button 
            onClick={() => setEditMode(true)}
            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
          >
            <i className="bi bi-gear"></i> Gestionar Plantillas
          </button>
        )}
      </div>

      <div className="p-6 flex flex-col gap-6">
        {loading ? (
          <div className="py-8 text-center text-slate-500"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div></div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Language Selector */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <i className="bi bi-globe" aria-label="Icono de idioma" title="Seleccionar Idioma"></i>
                  Idioma / Language
                </label>
                <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setLanguage('ES')}
                    className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${
                      language === 'ES' 
                        ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' 
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    Español
                  </button>
                  <button
                    type="button"
                    onClick={() => setLanguage('EN')}
                    className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${
                      language === 'EN' 
                        ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' 
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    English
                  </button>
                </div>
              </div>

              {/* Template Selector */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5" htmlFor="templateSelect">
                  <i className="bi bi-file-earmark-text" aria-label="Icono de documento" title="Seleccionar Plantilla"></i>
                  Seleccionar Plantilla
                </label>
                <select
                  id="templateSelect"
                  value={selectedTemplateId}
                  onChange={handleTemplateChange}
                  className="block w-full py-2.5 px-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors cursor-pointer"
                >
                  <option value="">-- Seleccione una plantilla --</option>
                  {filteredTemplates.map(template => (
                    <option key={template.id} value={template.id}>
                      {template.titulo}
                    </option>
                  ))}
                </select>
              </div>

            </div>

            {selectedTemplateId && (
              <div className="border-t border-slate-200 dark:border-slate-700 pt-6 flex flex-col gap-4 animate-fadeIn">
                
                {/* Editor - Asunto */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Vista Previa: Asunto
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="block w-full py-2 px-3 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-medium transition-colors"
                  />
                </div>

                {/* Editor - Cuerpo */}
                <div className="flex-1 flex flex-col">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Vista Previa: Mensaje
                  </label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={8}
                    className="block w-full py-3 px-4 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm resize-y custom-scrollbar transition-colors leading-relaxed"
                  ></textarea>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer Actions */}
      <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex flex-col-reverse sm:flex-row justify-end gap-3 shrink-0">
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:bg-slate-900/20 dark:hover:bg-slate-700 rounded-lg text-sm font-bold transition-all shadow-sm focus:ring-2 focus:ring-slate-200"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleUse}
          disabled={!subject || !body}
          className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-sm shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
        >
          <i className="bi bi-check2-circle"></i> Utilizar Plantilla
        </button>
      </div>
    </div>
  );
}
