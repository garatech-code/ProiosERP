import { useState, useEffect } from 'react';
import axios from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function OperationDocuments({ operacionId, documentos, onDocumentChange, openPreview, selectedDocs = [], toggleSelectDoc, canEdit = true }) {
    const { user } = useAuth();
    const [uploading, setUploading] = useState(false);
    const [tipoSeleccionado, setTipoSeleccionado] = useState('delivery_note');
    const [nombrePersonalizado, setNombrePersonalizado] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [archivo, setArchivo] = useState(null);

    const tipos = [
        { value: 'delivery_note', label: 'Preparación' },
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

            {canEdit && (
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
            )}

            {documentos.length === 0 ? (
                <p className="text-gray-500 dark:text-slate-400 text-sm">No hay documentos adicionales.</p>
            ) : (
                <div className="space-y-3">
                    {documentos.map(doc => {
                        const isImage = doc.archivo?.match(/\.(jpe?g|png|gif|bmp|webp)$/i);
                        const isPdf = doc.archivo?.match(/\.pdf$/i);
                        const isExcel = doc.archivo?.match(/\.xlsx?$/i);
                        
                        let iconClass = "bi-file-earmark-fill text-slate-400";
                        if (isImage) iconClass = "bi-file-earmark-image text-indigo-500";
                        else if (isPdf) iconClass = "bi-file-earmark-pdf text-red-500";
                        else if (isExcel) iconClass = "bi-file-earmark-excel text-emerald-500";
                        
                        const isSelected = selectedDocs.includes(doc.id);
                        
                        return (
                            <div key={doc.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm gap-3">
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    {toggleSelectDoc && (
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggleSelectDoc(doc.id)}
                                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                                        />
                                    )}
                                    <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 shrink-0">
                                        <i className={`bi ${iconClass} text-xl`}></i>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-bold text-slate-800 dark:text-white truncate">
                                            {getTipoLabel(doc.tipo, doc.nombre_personalizado)}
                                        </p>
                                        {doc.descripcion && <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">{doc.descripcion}</p>}
                                        <p className="text-[10px] text-slate-400 mt-0.5">
                                            Subido: {new Date(doc.fecha_subida).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 dark:border-slate-700/50">
                                    {openPreview && (
                                        <button
                                            type="button"
                                            onClick={() => openPreview(doc.archivo)}
                                            className="flex-1 sm:flex-none px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 border border-indigo-100 dark:border-indigo-800 transition-colors"
                                        >
                                            <i className="bi bi-eye-fill"></i> Ver
                                        </button>
                                    )}
                                    <a
                                        href={doc.archivo}
                                        download
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-1 sm:flex-none px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-600 transition-colors"
                                    >
                                        <i className="bi bi-download"></i> Descargar
                                    </a>
                                    {canEdit && (
                                        <button 
                                            onClick={() => handleDelete(doc.id)} 
                                            className="p-1.5 text-red-500 hover:text-red-700 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                                        >
                                            <i className="bi bi-trash text-base"></i>
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}