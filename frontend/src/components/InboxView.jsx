import { useState, useEffect } from 'react';
import axios from '../api/axios';
import { useAuth } from '../context/AuthContext';
import DOMPurify from 'dompurify';
import ComposeEmailModal from './ComposeEmailModal';
import EmailTemplateManager from './EmailTemplateManager';
import LogoSpinner from './LogoSpinner';

const getEmailPreview = (htmlOrText) => {
    if (!htmlOrText) return '(Sin contenido)';
    // DOMPurify with ALLOWED_TAGS: [] drops all tags, including <style> and <script> contents
    const cleanHtml = DOMPurify.sanitize(htmlOrText, { ALLOWED_TAGS: [] });
    const temp = document.createElement("div");
    temp.innerHTML = cleanHtml;
    const text = (temp.textContent || temp.innerText || "").replace(/\s+/g, " ").trim();
    return text.length > 50 ? text.slice(0, 50) + '...' : text;
};

const getMediaUrl = (url) => {
    if (!url) return '';
    try {
        const parsed = new URL(url);
        return parsed.pathname;
    } catch (e) {
        if (!url.startsWith('/')) {
            if (url.startsWith('media/')) return '/' + url;
            return '/media/' + url;
        }
        return url;
    }
};

export default function InboxView({ onCreateFromEmail }) {
  const { user } = useAuth();
  const [emails, setEmails] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('inbound'); // inbound, outbound, unread
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [isManageTemplatesOpen, setIsManageTemplatesOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [operationsForLink, setOperationsForLink] = useState([]);
  const [selectedOpIdToLink, setSelectedOpIdToLink] = useState('');
  const [isLinking, setIsLinking] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const processEmails = (data) => {
    return data.map(e => ({
      ...e,
      _preview: getEmailPreview(e.body_html || e.body_text)
    }));
  };

  const fetchEmails = async () => {
    try {
      setLoading(true);
      const url = debouncedSearch ? `/correos/inbox/?search=${encodeURIComponent(debouncedSearch)}` : '/correos/inbox/';
      const res = await axios.get(url);
      const data = res.data.results ? res.data.results : res.data;
      setEmails(processEmails(data));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails();
    // Pooling cada silencioso 60 segundos por si entran nuevos
    const interval = setInterval(() => {
      const url = debouncedSearch ? `/correos/inbox/?search=${encodeURIComponent(debouncedSearch)}` : '/correos/inbox/';
      axios.get(url).then((res) => {
        const data = res.data.results ? res.data.results : res.data;
        setEmails(processEmails(data));
      }).catch(console.error);
    }, 60000);
    return () => clearInterval(interval);
  }, [debouncedSearch]);

  const handleSelectEmail = async (email) => {
    setSelectedEmail(email);
    if (!email.is_read && email.direction === 'inbound') {
      try {
        await axios.post(`/correos/inbox/${email.id}/mark_as_read/`);
        setEmails((prev) => prev.map((e) => (e.id === email.id ? { ...e, is_read: true } : e)));
      } catch (err) {
        console.error("Error marking as read", err);
      }
    }
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    setSyncMessage('');
    try {
      await axios.post('/correos/inbox/sync_now/');
      await fetchEmails();
      setSyncMessage('Actualizado');
    } catch (err) {
      console.error("Error syncing", err);
      setSyncMessage('Hubo un error');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(''), 3000);
    }
  };

  const handleReply = () => {
    if (!selectedEmail) return;
    setReplyTo(selectedEmail);
    setIsComposeOpen(true);
  };

  const handleCompose = () => {
    setReplyTo(null);
    setIsComposeOpen(true);
  };

  const fetchOperationsForLink = async () => {
    try {
      const res = await axios.get('/operaciones/operations/?page_size=50');
      const data = res.data.results ? res.data.results : res.data;
      setOperationsForLink(data);
    } catch (err) {
      console.error("Error fetching ops for link", err);
    }
  };

  const openLinkModal = () => {
    fetchOperationsForLink();
    setIsLinkModalOpen(true);
  };

  const handleLinkToOperation = async () => {
    if (!selectedOpIdToLink) return;
    setIsLinking(true);
    try {
      await axios.patch(`/correos/inbox/${selectedEmail.id}/`, { operacion: selectedOpIdToLink });
      setEmails(prev => prev.map(e => e.id === selectedEmail.id ? { ...e, operacion: selectedOpIdToLink } : e));
      setSelectedEmail(prev => ({ ...prev, operacion: selectedOpIdToLink }));
      setIsLinkModalOpen(false);
      setSelectedOpIdToLink('');
    } catch (err) {
      console.error("Error linking", err);
    } finally {
      setIsLinking(false);
    }
  };

  const filteredEmails = emails.filter((e) => {
    if (filter === 'unread') return !e.is_read && e.direction === 'inbound';
    return e.direction === filter;
  });

  return (
    <div className="h-[calc(100vh-180px)] md:h-[calc(100vh-140px)] flex bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
      
      {/* Left Sidebar - Email List */}
      <div className={`w-full md:w-1/3 flex-col border-r border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 ${selectedEmail ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={() => setFilter('inbound')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${filter === 'inbound' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100 dark:bg-slate-800/50'}`}
              >
                Recibidos
              </button>
              <button 
                onClick={() => setFilter('outbound')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${filter === 'outbound' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100 dark:bg-slate-800/50'}`}
              >
                Enviados
              </button>
              {user?.role === 'OWNER' && (
                <button 
                  onClick={() => setIsManageTemplatesOpen(true)}
                  className="px-2 py-1 text-gray-400 hover:text-indigo-600 transition-colors flex items-center gap-1 bg-gray-50 dark:bg-slate-900/50 hover:bg-gray-100 rounded-lg"
                  title="Gestionar Plantillas"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                  <span className="text-[10px] font-bold hidden xl:block">Plantillas</span>
                </button>
              )}
              <button 
                onClick={handleSyncNow} 
                disabled={isSyncing}
                className="px-2 py-1 text-gray-400 hover:text-indigo-600 transition-colors flex items-center gap-1 bg-gray-50 dark:bg-slate-900/50 hover:bg-gray-100 rounded-lg"
                title="Sincronizar ahora"
              >
                <svg className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} style={isSyncing ? { animationDirection: 'reverse' } : {}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                </svg>
                {syncMessage && <span className="text-[10px] font-bold text-indigo-600 animate-fadeIn">{syncMessage}</span>}
              </button>
            </div>
            
            <button onClick={handleCompose} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-1.5 transition-colors flex items-center gap-2 shadow-sm shrink-0" title="Redactar">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
              <span className="text-xs font-bold hidden lg:block">Redactar</span>
            </button>
          </div>

          <div className="relative w-full">
            <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
            <input 
              type="search" 
              placeholder="Buscar por asunto, email o contenido..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-100 dark:bg-slate-900 border border-transparent dark:border-slate-700 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 rounded-xl text-sm pl-9 pr-4 py-2.5 transition-all outline-none text-gray-800 dark:text-gray-200 placeholder-gray-500"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {loading && emails.length === 0 ? (
            <div className="p-8 text-center text-gray-400 dark:text-slate-500">
              <LogoSpinner size="w-8 h-8 mx-auto mb-2" />
              Cargando...
            </div>
          ) : filteredEmails.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-slate-400 text-sm">
              No hay correos en esta bandeja.
            </div>
          ) : (
            filteredEmails.map(email => (
              <div 
                key={email.id} 
                onClick={() => handleSelectEmail(email)}
                className={`p-4 border-b border-gray-100 dark:border-slate-700 cursor-pointer transition-colors ${selectedEmail?.id === email.id ? 'bg-indigo-50 dark:bg-indigo-900/30 border-l-4 border-indigo-500' : 'hover:bg-gray-100 dark:hover:bg-slate-700/50 border-l-4 border-transparent'} ${!email.is_read && email.direction === 'inbound' ? 'font-bold' : ''}`}
              >
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-sm truncate pr-2 text-gray-900 dark:text-white">
                    {email.direction === 'inbound' ? (email.sender_name || email.sender_address) : email.recipient_address}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-slate-400 shrink-0">
                    {new Date(email.date_received).toLocaleDateString([], { month: 'short', day: 'numeric'})}
                  </span>
                </div>
                <h4 className="text-sm text-gray-800 dark:text-slate-200 truncate">{email.subject || '(Sin Asunto)'}</h4>
                <p className="text-xs text-gray-500 dark:text-slate-400 truncate mt-1">
                  {email._preview}
                </p>
                {email.operacion && (
                  <span className="inline-block mt-2 px-2 py-0.5 bg-orange-100 text-orange-800 text-[10px] font-bold rounded">
                    OP-{email.operacion}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Content - Email Reader */}
      <div className={`w-full md:w-2/3 flex-col bg-white dark:bg-slate-800 ${!selectedEmail ? 'hidden md:flex' : 'flex'}`}>
        {selectedEmail ? (
          <>
            <div className="p-4 md:p-6 border-b border-gray-100 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-4">
                <button onClick={() => setSelectedEmail(null)} className="md:hidden p-2 -ml-2 text-gray-500 dark:text-slate-400 hover:text-indigo-600 rounded-lg transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                </button>
                <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white truncate flex-1">{selectedEmail.subject || '(Sin Asunto)'}</h2>
                {!selectedEmail.operacion && (
                  <>
                    <button onClick={() => {
                        if (onCreateFromEmail) {
                            onCreateFromEmail(selectedEmail);
                        }
                    }} className="px-3 md:px-4 py-1.5 bg-emerald-100 dark:bg-emerald-900/30 hover:bg-emerald-200 dark:hover:bg-emerald-800/50 text-emerald-700 dark:text-emerald-400 text-sm font-bold rounded-lg flex items-center gap-2 transition-colors shrink-0 border border-emerald-200 dark:border-emerald-800">
                      <i className="bi bi-play-fill"></i>
                      <span className="hidden sm:inline">Iniciar Operación</span>
                    </button>
                    <button onClick={openLinkModal} className="px-3 md:px-4 py-1.5 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-800/50 text-blue-700 dark:text-blue-400 text-sm font-bold rounded-lg flex items-center gap-2 transition-colors shrink-0 border border-blue-200 dark:border-blue-800">
                      <i className="bi bi-link-45deg"></i>
                      <span className="hidden sm:inline">Vincular a Operación</span>
                    </button>
                  </>
                )}
                <button onClick={handleReply} className="px-3 md:px-4 py-1.5 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-300 text-sm font-bold rounded-lg flex items-center gap-2 transition-colors shrink-0">
                  <svg className="w-4 h-4 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
                  Responder
                </button>
              </div>
              <div className="flex justify-between items-center bg-gray-50 dark:bg-slate-700/50 p-3 rounded-xl border border-gray-100 dark:border-slate-700">
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{selectedEmail.sender_name || selectedEmail.sender_address}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">Para: {selectedEmail.recipient_address}</p>
                </div>
                <div className="text-xs text-gray-400 dark:text-slate-500 font-medium">
                  {new Date(selectedEmail.date_received).toLocaleString()}
                </div>
              </div>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-white prose prose-sm max-w-none text-gray-900 border-y border-gray-100 dark:border-slate-700">
              {selectedEmail.body_html ? (
                <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedEmail.body_html) }} />
              ) : (
                <div className="whitespace-pre-wrap font-sans">{selectedEmail.body_text}</div>
              )}
            </div>
            {selectedEmail.adjuntos?.length > 0 && (
              <div className="p-4 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-700/30 flex gap-2 overflow-x-auto">
                <span className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
                  Adjuntos:
                </span>
                {selectedEmail.adjuntos.map(adj => (
                  <a key={adj.id} href={getMediaUrl(adj.file)} target="_blank" rel="noopener noreferrer" className="px-2 py-1 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded text-xs text-indigo-600 dark:text-indigo-400 font-medium whitespace-nowrap hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors flex items-center gap-1">
                    <i className="bi bi-download"></i> {adj.filename}
                  </a>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-slate-500 p-8 text-center">
            <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
            <p className="font-medium text-lg text-gray-500 dark:text-slate-400">Bandeja de Entrada</p>
            <p className="text-sm">Selecciona un correo para leerlo o redacta uno nuevo.</p>
          </div>
        )}
      </div>

      {isComposeOpen && (
        <ComposeEmailModal 
          onClose={() => setIsComposeOpen(false)} 
          onSuccess={() => {
            setIsComposeOpen(false);
            fetchEmails();
          }}
          replyTo={replyTo}
          user={user}
        />
      )}

      {isManageTemplatesOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fadeIn">
          <EmailTemplateManager 
            defaultEditMode={true}
            onCancel={() => setIsManageTemplatesOpen(false)}
          />
        </div>
      )}

      {isLinkModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-900/50">
              <h3 className="font-black text-gray-900 dark:text-white">Vincular a Operación</h3>
              <button onClick={() => setIsLinkModalOpen(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="p-6">
              <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-2">Seleccionar Operación</label>
              <select 
                value={selectedOpIdToLink} 
                onChange={(e) => setSelectedOpIdToLink(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="">-- Seleccione --</option>
                {operationsForLink.map(op => (
                  <option key={op.id} value={op.id}>OP-{op.id} - {op.client_name}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-2">Solo se muestran las últimas operaciones activas.</p>
            </div>
            <div className="p-4 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 flex justify-end gap-3">
              <button onClick={() => setIsLinkModalOpen(false)} className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition-colors">Cancelar</button>
              <button 
                onClick={handleLinkToOperation} 
                disabled={!selectedOpIdToLink || isLinking}
                className="px-4 py-2 text-sm font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isLinking ? 'Vinculando...' : 'Confirmar Vinculación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
