import { useState, useEffect } from 'react';
import axios from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function OperationDocuments({ operacionId, documentos, onDocumentChange }) {
    const { user } = useAuth();
    const [uploading, setUploading] = useState(false);
    const [tipoSeleccionado, setTipoSeleccionado] = useState('delivery_note');
    const [nombrePersonalizado, setNombrePersonalizado] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [archivo, setArchivo] = useState(null);

    const tipos = [
        { value: 'delivery_note', label: 'Delivery Note' },
        { value: 'factura_proveedor', label: 'Factura a proveedor' },
        { value: 'habilitacion_aduanera', label: 'Habilitación aduanera' },
        { value: 'otros', label: 'Otros' },
    ];

    const handleFileChange = (e) => {
        setArchivo(e.target.files[0]);
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!archivo) {
            alert('Seleccione un archivo');
            return;
        }
        setUploading(true);
        const formData = new FormData();
        formData.append('tipo', tipoSeleccionado);
        formData.append('archivo', archivo);
        if (tipoSeleccionado === 'otros') formData.append('nombre_personalizado', nombrePersonalizado);
        if (descripcion) formData.append('descripcion', descripcion);

        try {
            await axios.post(`/operaciones/operations/${operacionId}/documentos/`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setArchivo(null);
            setNombrePersonalizado('');
            setDescripcion('');
            onDocumentChange(); // refrescar lista
            alert('Documento subido correctamente');
        } catch (err) {
            console.error(err);
            alert('Error al subir documento');
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (docId) => {
        if (!window.confirm('¿Eliminar este documento?')) return;
        try {
            await axios.delete(`/operaciones/operations/${operacionId}/documentos/${docId}/`);
            onDocumentChange();
        } catch (err) {
            alert('Error al eliminar');
        }
    };

    const getTipoLabel = (tipo, nombrePersonalizado) => {
        if (tipo === 'otros') return nombrePersonalizado || 'Otros';
        return tipos.find(t => t.value === tipo)?.label || tipo;
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-5 mt-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Documentos adicionales</h3>

            <form onSubmit={handleUpload} className="mb-6 p-4 bg-gray-50 dark:bg-slate-700 rounded-lg">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Tipo de documento *</label>
                        <select
                            value={tipoSeleccionado}
                            onChange={(e) => setTipoSeleccionado(e.target.value)}
                            className="w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-800 rounded px-3 py-2"
                        >
                            {tipos.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                    </div>
                    {tipoSeleccionado === 'otros' && (
                        <div>
                            <label className="block text-sm font-medium mb-1">Nombre personalizado *</label>
                            <input
                                type="text"
                                value={nombrePersonalizado}
                                onChange={(e) => setNombrePersonalizado(e.target.value)}
                                required
                                className="w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-800 rounded px-3 py-2"
                                placeholder="Ej: Certificado de origen"
                            />
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium mb-1">Archivo *</label>
                        <input
                            type="file"
                            onChange={handleFileChange}
                            required
                            className="w-full text-sm"
                        />
                    </div>
                    <div className="sm:col-span-2">
                        <label className="block text-sm font-medium mb-1">Descripción (opcional)</label>
                        <textarea
                            value={descripcion}
                            onChange={(e) => setDescripcion(e.target.value)}
                            rows={2}
                            className="w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-800 rounded px-3 py-2"
                        />
                    </div>
                </div>
                <button
                    type="submit"
                    disabled={uploading}
                    className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                    {uploading ? 'Subiendo...' : 'Subir documento'}
                </button>
            </form>

            {documentos.length === 0 ? (
                <p className="text-gray-500 dark:text-slate-400 text-sm">No hay documentos adicionales.</p>
            ) : (
                <div className="space-y-2">
                    {documentos.map(doc => (
                        <div key={doc.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-700 rounded-lg">
                            <div>
                                <p className="font-medium text-gray-800 dark:text-white">{getTipoLabel(doc.tipo, doc.nombre_personalizado)}</p>
                                {doc.descripcion && <p className="text-sm text-gray-500">{doc.descripcion}</p>}
                                <p className="text-xs text-gray-400">Subido: {new Date(doc.fecha_subida).toLocaleString()}</p>
                                <a href={doc.archivo} target="_blank" rel="noopener noreferrer" className="text-indigo-600 text-sm hover:underline">Ver archivo</a>
                            </div>
                            <button onClick={() => handleDelete(doc.id)} className="text-red-500 hover:text-red-700">
                                <i className="bi bi-trash"></i>
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}