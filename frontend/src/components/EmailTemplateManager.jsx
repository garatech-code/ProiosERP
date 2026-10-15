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
  const [showSaveAsNewModal, setShowSaveAsNewModal] = useState(false);
  const [newTemplateTitle, setNewTemplateTitle] = useState('');
  const [savingNew, setSavingNew] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const normalizeText = (text) =>
    (text || '')
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const getMatchSnippet = (content, term) => {
    if (!content || !term) return null;
    const cleanContent = content.replace(/[\r\n]+/g, ' ');
    const normContent = normalizeText(cleanContent);
    const normTerm = normalizeText(term);
    const idx = normContent.indexOf(normTerm);
    if (idx === -1) return null;
    const start = Math.max(0, idx - 30);
    const end = Math.min(cleanContent.length, idx + term.length + 40);
    let snippet = cleanContent.substring(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < cleanContent.length) snippet = snippet + '...';
    return snippet;
  };

  const filteredManagementTemplates = templates.filter((t) => {
    if (!searchTerm.trim()) return true;
    const term = normalizeText(searchTerm.trim());
    const matchTitle = normalizeText(t.titulo).includes(term);
    const matchCuerpo = normalizeText(t.cuerpo).includes(term);
    const matchAsunto = normalizeText(t.asunto).includes(term);
    return matchTitle || matchCuerpo || matchAsunto;
  });

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
  const handleSaveOverwrite = async (e) => {
    if (e) e.preventDefault();
    try {
      if (editingTemplate.id) {
        await axios.put(`/correos/templates/${editingTemplate.id}/`, editingTemplate);
      } else {
        await axios.post('/correos/templates/', editingTemplate);
      }
      setEditingTemplate(null);
      fetchTemplates();
    } catch (err) {
      console.error(err);
      alert("Error al sobreescribir la plantilla.");
    }
  };

  const handleOpenSaveAsNew = (e) => {
    if (e) e.preventDefault();
    setNewTemplateTitle(`${editingTemplate?.titulo || ''} (Copia)`);
    setShowSaveAsNewModal(true);
  };

  const handleConfirmSaveAsNew = async (e) => {
    if (e) e.preventDefault();
    if (!newTemplateTitle.trim()) return;

    try {
      setSavingNew(true);
      await axios.post('/correos/templates/', {
        titulo: newTemplateTitle.trim(),
        idioma: editingTemplate.idioma,
        asunto: editingTemplate.asunto,
        cuerpo: editingTemplate.cuerpo
      });
      setShowSaveAsNewModal(false);
      setEditingTemplate(null);
      fetchTemplates();
    } catch (err) {
      console.error(err);
      alert("Error al crear la nueva plantilla.");
    } finally {
      setSavingNew(false);
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
      <div className="w-full max-w-4xl h-[650px] max-h-[90vh] mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center shrink-0">
          <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
            <i className="bi bi-gear-fill text-indigo-500"></i>
            Gestión de Plantillas (Owner)
          </h2>
          <button onClick={() => { if (defaultEditMode && onCancel) onCancel(); else setEditMode(false); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
        
        <div className="p-6 flex flex-col gap-5 overflow-y-auto flex-1 min-h-0">
          {!editingTemplate ? (
            <>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {/* Buscador de plantillas por nombre o contenido */}
                <div className="relative flex-1 max-w-md">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <i className="bi bi-search text-xs"></i>
                  </div>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar plantilla por nombre o contenido..."
                    className="block w-full pl-9 pr-8 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700/60 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors shadow-sm"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                      title="Limpiar búsqueda"
                    >
                      <i className="bi bi-x-circle-fill text-xs"></i>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 justify-end">
                  <button 
                    onClick={() => setEditingTemplate({ titulo: '', asunto: '', cuerpo: '', idioma: 'ES' })}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 shadow-sm flex items-center gap-1.5 transition"
                  >
                    <i className="bi bi-plus-lg"></i> Nueva Plantilla
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        setLoading(true);
                        await axios.post('/correos/templates/seed-defaults/');
                        await fetchTemplates();
                      } catch (err) {
                        console.error(err);
                        alert('Error al cargar las plantillas estándar.');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition flex items-center gap-1.5 border border-slate-300 dark:border-slate-600 shadow-sm"
                    title="Carga las plantillas estándar de Techship si falta alguna"
                  >
                    <i className="bi bi-arrow-clockwise"></i> Cargar Plantillas Estándar
                  </button>
                </div>
              </div>

              {searchTerm.trim() && (
                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Mostrando <span className="font-bold text-indigo-600 dark:text-indigo-400">{filteredManagementTemplates.length}</span> de {templates.length} plantillas encontradas
                </div>
              )}
              
              <div className="overflow-x-auto overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 flex-1 min-h-0 bg-white dark:bg-slate-800">
                <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
                  <thead className="text-xs text-slate-700 dark:text-slate-200 uppercase bg-slate-100 dark:bg-slate-700/80 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-4 py-3">Idioma</th>
                      <th className="px-4 py-3">Título</th>
                      <th className="px-4 py-3">Asunto</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {filteredManagementTemplates.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="px-4 py-16 text-center text-slate-500 dark:text-slate-400">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <i className="bi bi-search text-3xl text-slate-400 dark:text-slate-500"></i>
                            <p className="font-semibold text-sm">
                              {searchTerm.trim()
                                ? `No se encontraron plantillas que coincidan con "${searchTerm}"`
                                : 'No hay plantillas registradas.'}
                            </p>
                            {searchTerm.trim() && (
                              <button
                                type="button"
                                onClick={() => setSearchTerm('')}
                                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-bold mt-1"
                              >
                                Limpiar búsqueda
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredManagementTemplates.map(t => {
                        const term = searchTerm.trim();
                        const hasContentMatch = term && normalizeText(t.cuerpo).includes(normalizeText(term));
                        const hasTitleMatch = term && normalizeText(t.titulo).includes(normalizeText(term));
                        const snippet = hasContentMatch ? getMatchSnippet(t.cuerpo, term) : null;

                        return (
                          <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-750 transition">
                            <td className="px-4 py-3 align-top">
                              <span className={`px-2 py-0.5 rounded text-[11px] font-black ${t.idioma === 'ES' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'}`}>
                                {t.idioma}
                              </span>
                            </td>
                            <td className="px-4 py-3 align-top">
                              <div className="text-slate-900 dark:text-white font-semibold">{t.titulo}</div>
                              {snippet && !hasTitleMatch && (
                                <div className="mt-1.5 text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block mb-0.5">
                                    <i className="bi bi-file-text mr-1"></i>Coincidencia en contenido:
                                  </span>
                                  <span className="font-mono text-[11px] leading-relaxed break-words">{snippet}</span>
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 align-top text-slate-500 dark:text-slate-400 text-xs">
                              <div className="truncate max-w-xs">{t.asunto}</div>
                            </td>
                            <td className="px-4 py-3 align-top text-right whitespace-nowrap">
                              <button onClick={() => setEditingTemplate(t)} className="text-blue-600 dark:text-blue-400 hover:underline mr-3" title="Editar"><i className="bi bi-pencil"></i></button>
                              <button onClick={() => deleteTemplate(t.id)} className="text-red-600 dark:text-red-400 hover:underline" title="Eliminar"><i className="bi bi-trash"></i></button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

            </>
          ) : (
            <form onSubmit={handleSaveOverwrite} className="flex flex-col gap-4 flex-1 min-h-0">
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
              <div className="flex-1 flex flex-col min-h-0">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Cuerpo</label>
                <textarea 
                  required
                  value={editingTemplate.cuerpo}
                  onChange={(e) => setEditingTemplate({...editingTemplate, cuerpo: e.target.value})}
                  className="block w-full flex-1 min-h-[160px] py-2 px-3 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg resize-none" 
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 mt-auto pt-3 border-t border-slate-200 dark:border-slate-700 shrink-0">
                <button 
                  type="button" 
                  onClick={() => setEditingTemplate(null)} 
                  className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                >
                  Cancelar
                </button>
                
                <div className="flex flex-wrap items-center gap-3">
                  {editingTemplate.id ? (
                    <>
                      <button 
                        type="button" 
                        onClick={handleOpenSaveAsNew} 
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold shadow-sm transition flex items-center gap-1.5"
                        title="Crea una plantilla separada con estos cambios y le asigna un nombre nuevo"
                      >
                        <i className="bi bi-copy"></i> Guardar como Nueva
                      </button>
                      <button 
                        type="submit" 
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-sm transition flex items-center gap-1.5"
                        title="Sobreescribe esta misma plantilla"
                      >
                        <i className="bi bi-check2-circle"></i> Guardar y Sobreescribir
                      </button>
                    </>
                  ) : (
                    <button 
                      type="submit" 
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-sm transition flex items-center gap-1.5"
                    >
                      <i className="bi bi-plus-lg"></i> Crear Plantilla
                    </button>
                  )}
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Modal Elegante: Guardar como Nueva Plantilla */}
        {showSaveAsNewModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-slideUp">
              {/* Modal Header */}
              <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-base">
                    <i className="bi bi-copy"></i>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      Guardar como Nueva Plantilla
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Asignale un nombre distintivo a la copia
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSaveAsNewModal(false)}
                  className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition"
                >
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleConfirmSaveAsNew} className="p-6 flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Título / Nombre de la Plantilla
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="Ej: Seguimiento de Cotización (Urgente)"
                    value={newTemplateTitle}
                    onChange={(e) => setNewTemplateTitle(e.target.value)}
                    className="w-full text-sm px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 text-slate-800 dark:text-slate-100 font-medium transition"
                  />
                  <p className="mt-1.5 text-[11px] text-slate-400">
                    Se creará una copia independiente manteniendo el asunto y contenido actual.
                  </p>
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowSaveAsNewModal(false)}
                    className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingNew || !newTemplateTitle.trim()}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {savingNew ? (
                      <>
                        <i className="bi bi-arrow-repeat animate-spin"></i> Guardando...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-lg"></i> Confirmar y Guardar
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- Main Selector UI ---
  return (
    <div className="w-full max-w-4xl h-[650px] max-h-[90vh] mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center shrink-0">
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

      <div className="p-6 flex flex-col gap-6 overflow-y-auto flex-1 min-h-0">
        {loading ? (
          <div className="py-8 text-center text-slate-500"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div></div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 shrink-0">
              
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

            {!selectedTemplateId ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-center text-slate-400 dark:text-slate-500">
                <i className="bi bi-file-earmark-text text-4xl mb-2 text-slate-300 dark:text-slate-600"></i>
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Seleccione una plantilla de la lista</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Podrá visualizar y editar el asunto y el cuerpo antes de aplicarla.</p>
              </div>
            ) : (
              <div className="border-t border-slate-200 dark:border-slate-700 pt-6 flex flex-col gap-4 animate-fadeIn flex-1 min-h-0">
                
                {/* Editor - Asunto */}
                <div className="shrink-0">
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
                <div className="flex-1 flex flex-col min-h-0">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Vista Previa: Mensaje
                  </label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={8}
                    className="block w-full flex-1 py-3 px-4 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm resize-none custom-scrollbar transition-colors leading-relaxed"
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
