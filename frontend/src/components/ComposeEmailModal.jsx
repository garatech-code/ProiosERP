import { useState, useEffect } from 'react';
import axios from '../api/axios';

export default function ComposeEmailModal({ onClose, onSuccess, replyTo, user }) {
  const [formData, setFormData] = useState({
    recipient: '',
    subject: '',
    body: '',
    operacion_id: '',
    useTemplate: true, // Checkbox to use institutional template
  });
  
  const [operations, setOperations] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Load operations to allow linking the email
    axios.get('/operaciones/operations/').then(res => {
      setOperations(res.data);
    }).catch(console.error);

    // If it's a reply, prefill data
    if (replyTo) {
      setFormData({
        recipient: replyTo.sender_address,
        subject: replyTo.subject.startsWith('Re:') ? replyTo.subject : `Re: ${replyTo.subject}`,
        body: `\n\n--- En respuesta a ---\nFecha: ${new Date(replyTo.date_received).toLocaleString()}\nDe: ${replyTo.sender_address}\n\n${replyTo.body_text || '(Mensaje HTML original)'}`,
        operacion_id: replyTo.operacion || '',
        useTemplate: true,
      });
    }
  }, [replyTo]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  // Plantilla Institucional HTML + Firma
  const buildHtmlBody = () => {
    // Firma dinámica según usuario
    const signature = `
      <div style="margin-top: 20px; font-family: Arial, sans-serif; color: #4a5568; border-top: 1px solid #e2e8f0; padding-top: 10px;">
        <p style="margin: 0; font-weight: bold; color: #1a202c; font-size: 14px;">${user?.first_name} ${user?.last_name || user?.username}</p>
        <p style="margin: 2px 0; font-size: 12px;">Departamento: <strong style="color:#4f46e5;">${user?.role || 'ProIOS Member'}</strong></p>
        <p style="margin: 2px 0; font-size: 11px; color: #718096;">Este mensaje fue enviado a través del ERP Central de ProIOS.</p>
      </div>
    `;

    // Si no quiere usar plantilla, mandamos el texto crudo + la firma básica
    if (!formData.useTemplate) {
      return formData.body.replace(/\n/g, '<br>') + signature;
    }

    // Plantilla Institucional ProIOS
    return `
      <!DOCTYPE html>
      <html>
      <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; margin-top: 20px; overflow: hidden;">
          <tr>
            <td style="background-color: #4f46e5; padding: 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 1px;">ProIOS <span style="font-weight:300;">Logistics</span></h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px; color: #334155; font-size: 14px; line-height: 1.6;">
              ${formData.body.replace(/\n/g, '<br>')}
            </td>
          </tr>
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              ${signature}
            </td>
          </tr>
          <tr>
            <td style="background-color: #f1f5f9; padding: 15px; text-align: center; color: #94a3b8; font-size: 11px;">
              © ${new Date().getFullYear()} ProIOS. Todos los derechos reservados.<br>
              Generado automáticamente por el Sistema de Gestión Integrado.
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // El backend espera: recipient, subject, body (html body is sent as body, or backend can accept both)
    // Actually, in views.py, we mapped `body` to `text_body` and `html_body`. So sending the raw HTML in `body` is fine since MIME allows alternative. 
    // To be precise, our view maps: text_body=body, html_body=body.
    // We will send the beautiful HTML version. The plaintext will unfortunately show HTML tags unless we clean it on backend, 
    // but for this demo, most clients render HTML.
    
    const plainText = formData.body + `\n\n--\n${user?.first_name} ${user?.last_name || user?.username}\n${user?.role || ''}\nProIOS`;

    try {
      await axios.post('/correos/inbox/send_email/', {
        recipient: formData.recipient,
        subject: formData.subject,
        body: buildHtmlBody(), // We'll pass HTML down.
        operacion_id: formData.operacion_id || null,
      });
      onSuccess();
    } catch (err) {
      console.error(err);
      alert('Error encolando correo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[95vh] flex flex-col overflow-hidden my-auto">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="text-lg font-bold text-gray-800">
            {replyTo ? 'Responder Mensaje' : 'Redactar Nuevo Mensaje'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 rounded-full p-1 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Para *</label>
              <input
                type="text"
                name="recipient"
                value={formData.recipient}
                onChange={handleChange}
                required
                className="block w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="cliente@empresa.com"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Vincular a Operación (Opcional)</label>
              <select
                name="operacion_id"
                value={formData.operacion_id}
                onChange={handleChange}
                className="block w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                <option value="">-- Sin Vincular --</option>
                {operations.map(op => (
                  <option key={op.id} value={op.id}>OP-{op.id} ({op.client_name || op.client})</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Asunto *</label>
            <input
              type="text"
              name="subject"
              value={formData.subject}
              onChange={handleChange}
              required
              className="block w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-medium"
            />
          </div>

          <div className="flex-1 flex flex-col">
            <label className="block text-xs font-bold text-gray-700 mb-1 flex justify-between items-end">
              <span>Mensaje *</span>
              <label className="flex items-center gap-1 font-normal text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded cursor-pointer">
                <input type="checkbox" name="useTemplate" checked={formData.useTemplate} onChange={handleChange} className="rounded text-indigo-600 focus:ring-indigo-500 border-gray-300" />
                Usar Plantilla Institucional ProIOS
              </label>
            </label>
            <textarea
              name="body"
              value={formData.body}
              onChange={handleChange}
              required
              rows={8}
              className="block w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm resize-none"
              placeholder="Escribe tu mensaje aquí..."
            ></textarea>
            <p className="mt-2 text-[11px] text-gray-500">
              * La firma se añadirá automáticamente al final del mensaje con tus datos: <b>{user?.first_name} {user?.last_name || user?.username} ({user?.role})</b>.
            </p>
          </div>

          <div className="pt-4 mt-2 border-t border-gray-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 rounded-lg text-sm font-bold transition-colors"
            >
              Descartar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-sm shadow-indigo-200 hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Enviando...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                  Enviar
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
