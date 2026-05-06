import React from 'react';
import DOMPurify from 'dompurify';

export default function ReadEmailModal({ email, onClose, onReply }) {
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
              className="hidden sm:flex px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 text-sm font-bold rounded-lg items-center gap-2 transition-colors border border-indigo-200 dark:border-indigo-800"
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
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-white dark:bg-slate-800 prose dark:prose-invert prose-sm sm:prose-base max-w-none text-slate-800 dark:text-slate-200 custom-scrollbar">
          {email.body_html ? (
            <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(email.body_html) }} />
          ) : (
            <div className="whitespace-pre-wrap font-sans">{email.body_text}</div>
          )}
        </div>

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
