import React from 'react';
import DOMPurify from 'dompurify';

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

export default function ReadEmailModal({ email, onClose, onReply, openPreview }) {
  if (!email) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col overflow-hidden my-auto border border-slate-200 dark:border-slate-700">
        
        {/* Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center shrink-0">
          <h2 className="text-lg font-black text-slate-800 dark:text-white truncate pr-4">
            {email.subject || '(Sin Asunto)'}
          </h2>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => onReply(email)} 
              className="hidden sm:flex px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 text-sm font-bold rounded-lg items-center gap-2 transition-colors border border-indigo-200 dark:border-indigo-800"
            >
              <i className="bi bi-reply-fill"></i> Responder
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg p-1.5 shadow-sm transition-colors">
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
        </div>

        {/* Email Metadata */}
        <div className="px-4 py-3 sm:px-6 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 shrink-0">
          <div className="flex justify-between items-start sm:items-center flex-col sm:flex-row gap-2">
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {email.sender_address}
                <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold ${email.direction === 'inbound' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                  {email.direction === 'inbound' ? 'Recibido' : 'Enviado'}
                </span>
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Para: {email.recipient_address}</p>
            </div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600">
              {new Date(email.date_received).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Email Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-white prose prose-sm sm:prose-base max-w-none text-slate-900 custom-scrollbar border-y border-slate-200 dark:border-slate-700">
          {email.body_html ? (
            <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(email.body_html) }} />
          ) : (
            <div className="whitespace-pre-wrap font-sans">{email.body_text}</div>
          )}
        </div>

        {/* Attachments Section */}
        {email.adjuntos && email.adjuntos.length > 0 && (
          <div className="px-4 py-3 sm:px-6 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/20 shrink-0">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <i className="bi bi-paperclip text-indigo-500"></i> Archivos Adjuntos ({email.adjuntos.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {email.adjuntos.map((adj) => {
                const isImage = adj.content_type?.startsWith('image/') || adj.filename?.match(/\.(jpe?g|png|gif|bmp|webp)$/i);
                const isPdf = adj.content_type === 'application/pdf' || adj.filename?.match(/\.pdf$/i);
                const isExcel = adj.content_type?.includes('spreadsheet') || adj.content_type?.includes('excel') || adj.filename?.match(/\.xlsx?$/i);
                
                let iconClass = "bi-file-earmark-fill text-slate-400";
                if (isImage) iconClass = "bi-file-earmark-image text-indigo-500";
                else if (isPdf) iconClass = "bi-file-earmark-pdf text-red-500";
                else if (isExcel) iconClass = "bi-file-earmark-excel text-emerald-500";
                
                return (
                  <div key={adj.id} className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm hover:shadow transition-shadow max-w-[250px]">
                    <i className={`bi ${iconClass} text-base shrink-0`}></i>
                    <span className="truncate text-slate-700 dark:text-slate-300" title={adj.filename}>{adj.filename}</span>
                    <div className="flex items-center gap-2 ml-auto shrink-0">
                      {openPreview && (
                        <button
                          type="button"
                          onClick={() => openPreview(getMediaUrl(adj.file))}
                          className="text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-400 p-0.5"
                          title="Previsualizar"
                        >
                          <i className="bi bi-eye-fill"></i>
                        </button>
                      )}
                      <a 
                        href={getMediaUrl(adj.file)} 
                        download
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                        title="Descargar"
                      >
                        <i className="bi bi-download"></i>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer (Mobile Reply Button) */}
        <div className="sm:hidden p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 shrink-0">
           <button 
              onClick={() => onReply(email)} 
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              <i className="bi bi-reply-fill"></i> Responder
            </button>
        </div>

      </div>
    </div>
  );
}
