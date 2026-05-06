import { useState, useEffect, useCallback } from 'react';
import axios from '../api/axios';
import { useAuth } from '../context/AuthContext';
import ComposeEmailModal from './ComposeEmailModal'; // Importamos tu modal
import ReadEmailModal from './ReadEmailModal'; // Nuevo modal de lectura

const getEmailPreview = (htmlOrText) => {
    if (!htmlOrText) return '(Sin contenido)';
    const temp = document.createElement("div");
    temp.innerHTML = htmlOrText;
    const text = (temp.textContent || temp.innerText || "").replace(/\s+/g, " ").trim();
    return text.length > 120 ? text.slice(0, 120) + '...' : text;
};

export default function OperationEmails({ operacionId, defaultRecipient }) {
    const { user } = useAuth(); // Obtenemos el usuario para el modal
    const [emails, setEmails] = useState([]);
    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const [replyTo, setReplyTo] = useState(null);
    const [readEmail, setReadEmail] = useState(null); // Estado para el modal de lectura

    const fetchEmails = useCallback(() => {
        axios.get(`/correos/inbox/?operacion_id=${operacionId}`)
            .then(res => setEmails(res.data))
            .catch(console.error);
    }, [operacionId]);

    useEffect(() => {
        fetchEmails();
    }, [fetchEmails]);

    // Manejadores para abrir el modal
    const handleReply = (email, e) => {
        if (e) e.stopPropagation(); // Evitar que se abra el modal de lectura al hacer clic en responder
        setReplyTo(email);
        setReadEmail(null); // Cerramos el de lectura si está abierto
        setIsComposeOpen(true);
    };

    const handleNewEmail = () => {
        setReplyTo(null);
        setReadEmail(null);
        setIsComposeOpen(true);
    };

    const handleReadEmail = (email) => {
        setReadEmail(email);
    };

    return (
        <div className="mt-6 bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 dark:bg-slate-800">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-md font-bold text-gray-900 dark:text-white">Historial de Comunicación</h3>
                {/* Botón para enviar un correo nuevo desde la operación */}
                <button
                    onClick={handleNewEmail}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                >
                    <i className="bi bi-pencil-square"></i>
                    Nuevo Mensaje
                </button>
            </div>

            {emails.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-slate-400 p-4 text-center border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-lg">
                    No hay correos vinculados a esta operación.
                </p>
            ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                    {emails.map(email => (
                        <div 
                            key={email.id} 
                            onClick={() => handleReadEmail(email)}
                            className="p-4 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-800 rounded-xl cursor-pointer transition-colors shadow-sm group"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded mr-2 uppercase tracking-wider ${email.direction === 'inbound' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                                        {email.direction === 'inbound' ? 'Recibido' : 'Enviado'}
                                    </span>
                                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                                        {email.direction === 'inbound' ? email.sender_address : email.recipient_address}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">
                                        {new Date(email.date_received).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                    </span>

                                    {/* Botón de responder específico para este correo */}
                                    <button
                                        onClick={(e) => handleReply(email, e)}
                                        className="text-slate-400 hover:text-indigo-600 bg-white dark:bg-slate-800 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                                        title="Responder"
                                    >
                                        <i className="bi bi-reply-fill text-sm"></i>
                                    </button>
                                </div>
                            </div>
                            <p className="text-sm font-black text-slate-800 dark:text-slate-200 mb-1">{email.subject}</p>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 line-clamp-2">
                                {getEmailPreview(email.body_html || email.body_text)}
                            </p>
                        </div>
                    ))}
                </div>
            )}

            {/* Renderizado de Modales */}
            {readEmail && (
                <ReadEmailModal
                    email={readEmail}
                    onClose={() => setReadEmail(null)}
                    onReply={(email) => handleReply(email)}
                />
            )}

            {isComposeOpen && (
                <ComposeEmailModal
                    onClose={() => setIsComposeOpen(false)}
                    onSuccess={() => {
                        setIsComposeOpen(false);
                        fetchEmails(); // Recargamos el historial al enviar
                    }}
                    replyTo={replyTo}
                    user={user}
                    defaultOperacionId={operacionId} // Pasamos el ID actual
                    defaultRecipient={defaultRecipient} // Pasamos el destinatario sugerido
                />
            )}
        </div>
    );
}