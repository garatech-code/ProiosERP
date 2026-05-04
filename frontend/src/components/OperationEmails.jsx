import { useState, useEffect, useCallback } from 'react';
import axios from '../api/axios';
import { useAuth } from '../context/AuthContext';
import ComposeEmailModal from './ComposeEmailModal'; // Importamos tu modal

export default function OperationEmails({ operacionId }) {
    const { user } = useAuth(); // Obtenemos el usuario para el modal
    const [emails, setEmails] = useState([]);
    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const [replyTo, setReplyTo] = useState(null);

    const fetchEmails = useCallback(() => {
        axios.get(`/correos/inbox/?operacion_id=${operacionId}`)
            .then(res => setEmails(res.data))
            .catch(console.error);
    }, [operacionId]);

    useEffect(() => {
        fetchEmails();
    }, [fetchEmails]);

    // Manejadores para abrir el modal
    const handleReply = (email) => {
        setReplyTo(email);
        setIsComposeOpen(true);
    };

    const handleNewEmail = () => {
        setReplyTo(null);
        setIsComposeOpen(true);
    };

    return (
        <div className="mt-6 bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 dark:bg-slate-800">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-md font-bold text-gray-900 dark:text-white">Historial de Comunicación</h3>
                {/* Botón para enviar un correo nuevo desde la operación */}
                <button
                    onClick={handleNewEmail}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg flex items-center gap-2 transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                    Nuevo Mensaje
                </button>
            </div>

            {emails.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-slate-400 p-4 text-center border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-lg">
                    No hay correos vinculados a esta operación.
                </p>
            ) : (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                    {emails.map(email => (
                        <div key={email.id} className="p-4 border border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 rounded-lg">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded mr-2 ${email.direction === 'inbound' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                                        {email.direction === 'inbound' ? 'Recibido' : 'Enviado'}
                                    </span>
                                    <span className="font-bold text-sm text-gray-900 dark:text-white">
                                        {email.direction === 'inbound' ? email.sender_address : email.recipient_address}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-gray-500">{new Date(email.date_received).toLocaleString()}</span>

                                    {/* Botón de responder específico para este correo */}
                                    {email.direction === 'inbound' && (
                                        <button
                                            onClick={() => handleReply(email)}
                                            className="text-gray-400 hover:text-indigo-600 transition-colors"
                                            title="Responder"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
                                        </button>
                                    )}
                                </div>
                            </div>
                            <p className="text-sm font-semibold text-gray-800 dark:text-slate-200 mb-1">{email.subject}</p>
                            <p className="text-xs text-gray-600 dark:text-slate-400 line-clamp-2">
                                {email.body_text || 'Contenido HTML...'}
                            </p>
                        </div>
                    ))}
                </div>
            )}

            {/* Renderizado del Modal */}
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
                />
            )}
        </div>
    );
}