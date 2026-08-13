import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { formatUserName } from '../utils/formatters';
import ComposeEmailModal from './ComposeEmailModal';
import OperarioActionPanel from './OperarioActionPanel';
import OperationTracker from './OperationTracker';
import ProductSearchCards from './ProductSearchCards';
import OperationEmails from './OperationEmails';
import LogoSpinner from './LogoSpinner';
import OperationDocuments from './OperationDocuments';
import AutocompleteCreate from './AutocompleteCreate';
import ToolsModal from './ToolsModal';
import * as XLSX from 'xlsx';

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

export default function OperationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [operation, setOperation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showPackingModal, setShowPackingModal] = useState(false);
  const [isToolsModalOpen, setIsToolsModalOpen] = useState(false);
  const [stockVerification, setStockVerification] = useState(null);
  const [checkingStock, setCheckingStock] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [excelPreviewHtml, setExcelPreviewHtml] = useState(null);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [documentos, setDocumentos] = useState([]);
  const [packingData, setPackingData] = useState({
    operation_id: '', client: '', ship: '', port: '', eta: '', products: [], total_weight: 0, total_price: 0
  });
  const [isEditingPacking, setIsEditingPacking] = useState(false);
  const [editPackingProducts, setEditPackingProducts] = useState([]);

  const editTotalWeight = useMemo(() => {
    return editPackingProducts.reduce((sum, p) => sum + ((p.quantity || 0) * (p.unit_weight || 0)), 0);
  }, [editPackingProducts]);

  const editTotalPrice = useMemo(() => {
    return editPackingProducts.reduce((sum, p) => sum + ((p.quantity || 0) * (p.unit_price || 0)), 0);
  }, [editPackingProducts]);

  // Estados del workflow de revisión Operador <-> Owner
  const [mensajeRevision, setMensajeRevision] = useState('');
  const [revisionActionLoading, setRevisionActionLoading] = useState(false);
  const isOperador = user?.role === 'OPERADOR' || user?.role === 'OPERADOR_JR';

  const [proveedor, setProveedor] = useState('PROIOS SA');
  const [paisDestino, setPaisDestino] = useState('argentina');

  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState('');

  const [emails, setEmails] = useState([]);
  const [productionOrders, setProductionOrders] = useState([]);
  const [generatingProduction, setGeneratingProduction] = useState(false);
  const [completingProduction, setCompletingProduction] = useState({});

  // Estados de selección múltiple de adjuntos
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [selectedEmailAtts, setSelectedEmailAtts] = useState([]);
  const [downloadingZip, setDownloadingZip] = useState(false);

  // Estados para el flujo de Enviar a Aduanas / Permisos
  const [showAduanasEmailModal, setShowAduanasEmailModal] = useState(false);
  const [aduanasEmailAttachment, setAduanasEmailAttachment] = useState(null);
  const [fetchingAduanasFile, setFetchingAduanasFile] = useState(false);

  // Flujo específico para Servicios
  const [showPnaModal, setShowPnaModal] = useState(false);
  const [pnaType, setPnaType] = useState('frio');
  const [leaveMaterials, setLeaveMaterials] = useState(false);

  const [showCotizacionEmailModal, setShowCotizacionEmailModal] = useState(false);
  const [cotizacionEmailAttachment, setCotizacionEmailAttachment] = useState(null);

  const [showRechazoModal, setShowRechazoModal] = useState(false);
  const [rechazoMotivo, setRechazoMotivo] = useState('');

  const [pnaText, setPnaText] = useState('');

  // Parametros para generar Word
  const [offerValidityIsManual, setOfferValidityIsManual] = useState(false);
  const [offerValidity, setOfferValidity] = useState('15 days');
  const [paymentTermsIsManual, setPaymentTermsIsManual] = useState(false);
  const [paymentTerms, setPaymentTerms] = useState('30 days from invoice date');
  const [includeVat, setIncludeVat] = useState(false);
  const [vatPercentage, setVatPercentage] = useState('21');
  const [showCotizacionWordModal, setShowCotizacionWordModal] = useState(false);
  const [deliveryTime, setDeliveryTime] = useState('5');
  const [cotizacionAttn, setCotizacionAttn] = useState('Operations / Technical Department');
  const [scopeIncludes, setScopeIncludes] = useState('[detail what the supply / service comprises]');
  const [scopeExcludes, setScopeExcludes] = useState('[freight, customs clearance, additional labour, parts not listed, etc.]');
  
  const defaultNotesSrvEn = `- This lump sum covers only the designated works listed in this quotation. Any additional steel, works or damage found after crop-out will be re-quoted and charged separately.\n- Repairs are subject to Classification Society approval and attendance.\n- Scaffolding and staging, mobilisation/demobilisation, painting, NDT, docking and port charges are NOT included in this lump sum and will be charged separately.`;
  const defaultNotesSrvEs = `- Esta suma global cubre únicamente los trabajos designados enumerados en esta cotización. Cualquier acero, trabajo o daño adicional encontrado después del corte será recotizado y cobrado por separado.\n- Las reparaciones están sujetas a la aprobación y asistencia de la Sociedad de Clasificación.\n- Los andamios, la movilización/desmovilización, la pintura, las pruebas no destructivas (NDT), y los cargos de dique y puerto NO están incluidos en esta suma global y serán cobrados por separado.`;
  const defaultNotesProdEn = `[Other relevant note]`;
  const defaultNotesProdEs = `[Otra nota relevante]`;
  
  const [cotizacionNotes, setCotizacionNotes] = useState('[Other relevant note]');
  const [cotizacionTemplate, setCotizacionTemplate] = useState('eva');
  const [cotizacionLang, setCotizacionLang] = useState('en');

  useEffect(() => {
    if (showCotizacionWordModal) {
      const isSrv = operation?.tipo_operacion === 'servicios';
      const isEs = cotizacionLang === 'es';
      const defEn = isSrv ? defaultNotesSrvEn : defaultNotesProdEn;
      const defEs = isSrv ? defaultNotesSrvEs : defaultNotesProdEs;
      
      if (
        cotizacionNotes === defaultNotesSrvEn || 
        cotizacionNotes === defaultNotesSrvEs ||
        cotizacionNotes === defaultNotesProdEn ||
        cotizacionNotes === defaultNotesProdEs ||
        cotizacionNotes === '[Other relevant note]' ||
        cotizacionNotes === '[Otra nota relevante]' ||
        cotizacionNotes === `- This lump sum covers only the designated works listed in this quotation. Any additional steel, works or damage found after crop-out will be re-quoted and charged separately.
- Repairs are subject to Classification Society approval and attendance.
- Scaffolding and staging, mobilisation/demobilisation, painting, NDT, docking and port charges are NOT included in this lump sum and will be charged separately.`
      ) {
        setCotizacionNotes(isEs ? defEs : defEn);
      }
      
      setDamageLocationTitle(isEs ? 'Ubicación y daños' : 'Location and damage');
      setDamageFramesTitle(isEs ? 'Cuaderna(s)' : 'Frame(s)');
      setDamageAreaTitle(isEs ? 'Área L x H (mm)' : 'Area L x H (mm)');
    }
  }, [showCotizacionWordModal, operation, cotizacionLang]);

  // Service specific arbitrary fields
  const [damageLocation, setDamageLocation] = useState('');
  const [damageFrames, setDamageFrames] = useState('');
  const [damageArea, setDamageArea] = useState('');
  const [damageSubject, setDamageSubject] = useState('DAMAGE DESCRIPTION');
  const [damageLocationTitle, setDamageLocationTitle] = useState('Location and damage');
  const [damageFramesTitle, setDamageFramesTitle] = useState('Frame(s)');
  const [damageAreaTitle, setDamageAreaTitle] = useState('Area L x H (mm)');
  const [customItems, setCustomItems] = useState([]);

  const emailAttachments = useMemo(() => {
    const list = [];
    emails.forEach(email => {
      if (email.adjuntos && email.adjuntos.length > 0) {
        email.adjuntos.forEach(adj => {
          list.push({
            ...adj,
            emailSubject: email.subject,
            emailSender: email.sender_address,
            emailDate: email.date_received
          });
        });
      }
    });
    return list;
  }, [emails]);

  const fetchEmails = async () => {
    try {
      const res = await axios.get(`/correos/inbox/?operacion_id=${id}`);
      setEmails(res.data.results || res.data || []);
    } catch (err) {
      console.error("Error fetching emails:", err);
    }
  };

  const fetchProductionOrders = async () => {
    try {
      const res = await axios.get(`/operaciones/operations/${id}/ordenes_produccion/`);
      setProductionOrders(res.data);
    } catch (err) {
      console.error("Error fetching production orders:", err);
    }
  };

  const handleGenerateProductionOrders = async () => {
    setGeneratingProduction(true);
    try {
      const res = await axios.post(`/operaciones/operations/${id}/generar_ordenes_produccion/`);
      showToast(`Órdenes de producción generadas: ${res.data.created_count}`, 'success');
      fetchProductionOrders();
      checkStock();
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.error || 'Error al generar órdenes de producción';
      showToast(errMsg, 'error');
    } finally {
      setGeneratingProduction(false);
    }
  };

  const handleCompleteProductionOrder = async (orderId) => {
    setCompletingProduction(prev => ({ ...prev, [orderId]: true }));
    try {
      const res = await axios.post(`/produccion/ordenes/${orderId}/completar/`);
      showToast(res.data.message || 'Orden de producción completada con éxito', 'success');
      fetchProductionOrders();
      fetchOperation();
      checkStock();
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.error || 'Error al completar producción';
      showToast(errMsg, 'error');
    } finally {
      setCompletingProduction(prev => ({ ...prev, [orderId]: false }));
    }
  };

  useEffect(() => {
    if (operation) {
      setTempName(operation.nombre || '');
    }
  }, [operation]);


  const handleSaveName = async () => {
    try {
      await axios.patch(`/operaciones/operations/${id}/`, { nombre: tempName });
      showToast('Nombre actualizado correctamente', 'success');
      setEditingName(false);
      fetchOperation();
    } catch (err) {
      console.error(err);
      showToast('Error al actualizar nombre', 'error');
    }
  };

  const showToast = (message, type = 'info') => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Parser con Regex para auto-detectar productos en texto libre
  const detectedProducts = useMemo(() => {
    if (!operation?.texto_pedido) return [];

    const lines = operation.texto_pedido.split('\n');
    let parsedProducts = [];
    let idCounter = 1;

    const patterns = [
      {
        regex: /(.+?)[–\-:]\s*(?:Cant(?:idad|\.)?)\s*(?::)?\s*(\d+)\s*(.*)/i,
        extract: (m) => ({ nombre: m[1], cantidad: m[2], unidad: m[3] })
      },
      {
        regex: /^(\d+)\s+([a-zA-Z]+)?\s*(?:de|del)?\s+(.+)$/i,
        extract: (m) => ({ nombre: m[3], cantidad: m[1], unidad: m[2] })
      },
      {
        regex: /(.+?)\s+x\s*(\d+)\s*(.*)/i,
        extract: (m) => ({ nombre: m[1], cantidad: m[2], unidad: m[3] })
      },
      {
        regex: /(.+?)\s*\((\d+)\s*([a-zA-Z]+)?\)/i,
        extract: (m) => ({ nombre: m[1], cantidad: m[2], unidad: m[3] })
      },
      {
        regex: /(?:Qty|Cantidad)(?::)?\s*(\d+)\s*([a-zA-Z]+)?\s*[\-\|]\s*(.+)/i,
        extract: (m) => ({ nombre: m[3], cantidad: m[1], unidad: m[2] })
      }
    ];

    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.length < 3) return;

      let matched = false;

      for (const pattern of patterns) {
        const match = trimmedLine.match(pattern.regex);
        if (match) {
          const { nombre, cantidad, unidad } = pattern.extract(match);
          const safeName = nombre ? nombre.trim().replace(/^[\-\:]|[\-\:]$/g, '').trim() : '';

          if (safeName && safeName.length > 2 && safeName.length < 80) {
            parsedProducts.push({
              id: `auto_${idCounter++}`,
              nombre: safeName,
              cantidad: parseInt(cantidad, 10) || 1,
              unidad: unidad ? unidad.trim() : 'unidades'
            });
            matched = true;
            break;
          }
        }
      }
    });

    return parsedProducts;
  }, [operation?.texto_pedido]);

  useEffect(() => {
    fetchOperation();
    fetchEmails();
  }, [id]);

  useEffect(() => {
    if (operation) {
      fetchProductionOrders();
      if (operation.status === 'pending' || operation.estado === 'solicitada' || operation.estado === 'armado_packing') {
        checkStock();
      }
    }
  }, [operation]);

  const fetchOperation = async () => {
    try {
      const res = await axios.get(`/operaciones/operations/${id}/`);
      setOperation(res.data);
      setDocumentos(res.data.documentos_adjuntos || []);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Error al cargar la operación');
    } finally {
      setLoading(false);
    }
  };

  const checkStock = async () => {
    setCheckingStock(true);
    try {
      const res = await axios.get(`/operaciones/operations/${id}/verificar_stock/`);
      setStockVerification(res.data);
    } catch (err) {
      console.error('Error verificando stock:', err);
    } finally {
      setCheckingStock(false);
    }
  };

  const handleAction = async (action, confirmMessage) => {
    if (action === 'start_coordination') {
      if (operation?.tipo_operacion === 'productos' && stockVerification && !stockVerification.todo_suficiente) {
        showToast('No se puede confirmar: Hay productos sin stock suficiente.', 'error');
        return;
      }
      if (confirmMessage && !window.confirm(confirmMessage)) return;
    } else {
      if (confirmMessage && !window.confirm(confirmMessage)) return;
    }

    setActionLoading(true);
    try {
      await axios.post(`/operaciones/operations/${id}/${action}/`);
      if (action === 'confirm_operation') {
        showToast('Operación confirmada y stock consumido correctamente', 'success');
      }
      fetchOperation();
    } catch (err) {
      console.error(err);
      const errorMsg = err.response?.data?.error || err.response?.data?.message || 'Error al ejecutar la acción';
      showToast(errorMsg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleGeneratePdf = async (pdfEndpoint, params = {}) => {
    setActionLoading(true);
    try {
      let url = `/operaciones/operations/${id}/${pdfEndpoint}/`;
      const queryParams = new URLSearchParams(params);
      if (queryParams.toString()) {
        url += `?${queryParams.toString()}`;
      }
      const response = await axios.get(url, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', `${pdfEndpoint}_OP${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
      showToast('Documento generado con éxito.', 'success');
    } catch (err) {
      console.error(err);
      showToast('Error al generar el documento PDF.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const openPnaModal = () => {
    setPnaType('frio');
    setPnaText(operation?.texto_permiso_pna || '');
    setShowPnaModal(true);
  };

  const handleGeneratePnaPdf = async () => {
    try {
      if (pnaText !== operation?.texto_permiso_pna) {
        await axios.patch(`/operaciones/operations/${id}/`, { texto_permiso_pna: pnaText });
        fetchOperation();
      }
      handleGeneratePdf('generate_permiso_pna', { tipo: pnaType });
      setShowPnaModal(false);
    } catch (err) {
      console.error(err);
      showToast('Error al guardar el texto del Permiso PNA', 'error');
    }
  };

  const handleDownloadCotizacionWord = async () => {
    try {
      setActionLoading(true);

      const payload = {
        offer_validity: offerValidity,
        payment_terms: paymentTerms,
        delivery_time: deliveryTime,
        include_vat: includeVat,
        vat_percentage: vatPercentage,
        scope_includes: scopeIncludes,
        scope_excludes: scopeExcludes,
        notes: cotizacionNotes,
        attn: cotizacionAttn,
        template_type: cotizacionTemplate,
        lang: cotizacionLang
      };
      
      if (operation?.tipo_operacion === 'servicios') {
        payload.damage_location = damageLocation;
        payload.damage_frames = damageFrames;
        payload.damage_area = damageArea;
        payload.damage_subject = damageSubject;
        payload.damage_location_title = damageLocationTitle;
        payload.damage_frames_title = damageFramesTitle;
        payload.damage_area_title = damageAreaTitle;
        payload.custom_items = JSON.stringify(customItems.filter(i => i.nombre.trim() !== ''));
      }

      const response = await axios.post(`/operaciones/operations/${id}/generate_cotizacion_pdf/`, payload, {
        responseType: 'blob',
      });
      const fileUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = fileUrl;
      link.setAttribute('download', `Cotizacion_OP${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(fileUrl);
    } catch (error) {
      console.error("Error descargando cotización PDF:", error);
      showToast('Error al descargar la cotización en PDF', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendCotizacionEmail = async () => {
    try {
      setActionLoading(true);

      const payload = {
        offer_validity: offerValidity,
        payment_terms: paymentTerms,
        delivery_time: deliveryTime,
        include_vat: includeVat,
        vat_percentage: vatPercentage,
        scope_includes: scopeIncludes,
        scope_excludes: scopeExcludes,
        notes: cotizacionNotes,
        attn: cotizacionAttn,
        template_type: cotizacionTemplate,
        lang: cotizacionLang
      };
      
      if (operation?.tipo_operacion === 'servicios') {
        payload.damage_location = damageLocation;
        payload.damage_frames = damageFrames;
        payload.damage_area = damageArea;
        payload.damage_subject = damageSubject;
        payload.damage_location_title = damageLocationTitle;
        payload.damage_frames_title = damageFramesTitle;
        payload.damage_area_title = damageAreaTitle;
        payload.custom_items = JSON.stringify(customItems.filter(i => i.nombre.trim() !== ''));
      }

      // Descargamos el PDF generado temporalmente
      const response = await axios.post(`/operaciones/operations/${id}/generate_cotizacion_pdf/`, payload, {
        responseType: 'blob',
      });
      
      const file = new File([response.data], `Cotizacion_OP${id}.pdf`, { type: 'application/pdf' });
      setCotizacionEmailAttachment(file);
      
      // Ocultar modal de edición y mostrar modal de envío
      setShowCotizacionWordModal(false);
      setShowCotizacionEmailModal(true);
      
    } catch (error) {
      console.error("Error generando cotización para email:", error);
      showToast('Error al preparar la cotización para envío', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRechazarCotizacion = async (motivo) => {
    try {
      setActionLoading(true);
      await axios.post(`/operaciones/operations/${id}/rechazar_cotizacion/`, { motivo_rechazo: motivo });
      showToast('Operación pausada (rechazada)', 'success');
      fetchOperation();
    } catch (error) {
      console.error("Error rechazando cotización:", error);
      showToast('Error al pausar la operación', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReanudarOperacion = async () => {
    try {
      setActionLoading(true);
      await axios.post(`/operaciones/operations/${id}/reanudar_operacion/`);
      showToast('Operación reanudada', 'success');
      fetchOperation();
    } catch (error) {
      console.error("Error reanudando operación:", error);
      showToast('Error al reanudar la operación', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleGenerateRemito = async () => {
    try {
      const response = await axios.get(`/operaciones/operations/${id}/generate_remito_pdf/`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Remito_OP${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Error generando remito:", error);
      showToast('Error al generar el remito. Verifique que exista la plantilla.', 'error');
    }
  };

  const handleRequestReview = async () => {
    setRevisionActionLoading(true);
    try {
      await axios.post(`/operaciones/operations/${id}/request_review/`, {
        mensaje_revision: mensajeRevision
      });
      showToast('Revisión solicitada exitosamente', 'success');
      setMensajeRevision('');
      fetchOperation();
    } catch (err) {
      console.error(err);
      showToast('Error al solicitar revisión', 'error');
    } finally {
      setRevisionActionLoading(false);
    }
  };

  const handleResolveReview = async (actionStr) => {
    if (!window.confirm(`¿Desea ${actionStr === 'approve' ? 'APROBAR' : 'RECHAZAR'} esta etapa?`)) return;
    setRevisionActionLoading(true);
    try {
      await axios.post(`/operaciones/operations/${id}/resolve_review/`, {
        action: actionStr,
        mensaje_revision: mensajeRevision
      });
      showToast(`Revisión ${actionStr === 'approve' ? 'Aprobada' : 'Rechazada'}`, 'success');
      setMensajeRevision('');
      fetchOperation();
    } catch (err) {
      console.error(err);
      showToast('Error al resolver revisión', 'error');
    } finally {
      setRevisionActionLoading(false);
    }
  };

  const handleFileUpload = async (event, type, confirmMessage) => {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    const file = event.target.files[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      await axios.post(`/operaciones/operations/${id}/${type}/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      fetchOperation();
    } catch (err) {
      console.error(err);
      showToast('Error al subir archivo', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleUploadCotizacionCustom = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (!window.confirm('¿Subir una cotización personalizada?')) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('archivo', file);
    formData.append('tipo', 'cotizacion_servicio');
    try {
      await axios.post(`/operaciones/operations/${id}/documentos/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      showToast('Cotización personalizada subida exitosamente.', 'success');
      fetchOperation();
    } catch (err) {
      console.error(err);
      showToast('Error al subir la cotización', 'error');
    } finally {
      setUploading(false);
      event.target.value = null;
    }
  };

  const previewExcelFile = async (url) => {
    try {
      const response = await axios.get(url, {
        responseType: 'blob',
      });
      const data = await response.data.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const html = XLSX.utils.sheet_to_html(firstSheet, { editable: false });
      setExcelPreviewHtml(html);
      setShowExcelModal(true);
    } catch (error) {
      console.error("Error previsualizando Excel:", error);
      showToast('Error al previsualizar el archivo Excel', 'error');
    }
  };

  const previewTextFile = async (url, filename) => {
    try {
      const response = await axios.get(url, { responseType: 'text' });
      setPreviewFile({
        url: null,
        type: 'text',
        content: response.data,
        filename: filename,
      });
    } catch (error) {
      console.error("Error al cargar el archivo de texto:", error);
      showToast('No se pudo cargar el contenido del archivo de texto', 'error');
    }
  };

  const openPreview = (url, filename = 'documento') => {
    if (!url) return;
    const friendlyName = filename || url.split('/').pop();
    const ext = (friendlyName.includes('.') ? friendlyName : url).split('.').pop().toLowerCase();

    if (ext === 'xlsx' || ext === 'xls') {
      previewExcelFile(url);
      return;
    }
    if (ext === 'pdf') {
      setPreviewFile({ url, type: 'pdf', filename: friendlyName });
      return;
    }
    if (ext === 'txt') {
      previewTextFile(url, friendlyName);
      return;
    }
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) {
      setPreviewFile({ url, type: 'image', filename: friendlyName });
      return;
    }
    setPreviewFile({ url, type: 'unknown', filename: friendlyName });
  };



  const toggleSelectDoc = (docId) => {
    setSelectedDocs(prev =>
      prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]
    );
  };

  const toggleSelectEmailAtt = (attId) => {
    setSelectedEmailAtts(prev =>
      prev.includes(attId) ? prev.filter(id => id !== attId) : [...prev, attId]
    );
  };

  const handleDownloadZip = async () => {
    if (selectedDocs.length === 0 && selectedEmailAtts.length === 0) return;
    setDownloadingZip(true);
    try {
      const response = await axios.post(`/operaciones/operations/${id}/descargar_zip/`, {
        documento_ids: selectedDocs,
        adjunto_ids: selectedEmailAtts
      }, {
        responseType: 'blob'
      });

      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', `operacion_${id}_archivos.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
      showToast('Descarga ZIP completada exitosamente', 'success');

      setSelectedDocs([]);
      setSelectedEmailAtts([]);
    } catch (err) {
      console.error("Error descargando ZIP:", err);
      showToast('Error al descargar los archivos agrupados en ZIP', 'error');
    } finally {
      setSelectedDocs([]);
      setSelectedEmailAtts([]);
      setDownloadingZip(false);
    }
  };

  const handleCotizacionExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        
        const newItems = [];
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (row.length === 0 || !row[0]) continue;
          
          newItems.push({
            nombre: String(row[0] || ''),
            cantidad: row[1] !== undefined && row[1] !== null ? Number(row[1]) : 1,
            precio_unitario: row[2] !== undefined && row[2] !== null ? Number(row[2]) : ''
          });
        }
        
        if (newItems.length > 0) {
          setCustomItems(prev => [...prev, ...newItems]);
          showToast(`Se agregaron ${newItems.length} ítems masivamente`, 'success');
        } else {
          showToast('El Excel no contenía datos válidos en las primeras 3 columnas', 'error');
        }
      } catch (err) {
        console.error("Error al parsear Excel", err);
        showToast('Error al leer el archivo Excel', 'error');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = null;
  };

  const downloadPackingListExcel = async () => {
    try {
      let url = `/operaciones/operations/${id}/packing_list_excel/`;
      const params = new URLSearchParams();
      params.append('proveedor', proveedor);
      params.append('pais_destino', paisDestino);
      url += `?${params.toString()}`;

      const response = await axios.get(url, {
        responseType: 'blob',
      });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', `packing_list_${id}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
      showToast('Descargando Packing List...', 'success');
    } catch (error) {
      console.error(error);
      showToast('Error al descargar el archivo', 'error');
    }
  };

  const previewPackingListExcel = async () => {
    try {
      let url = `/operaciones/operations/${id}/packing_list_excel/`;
      const params = new URLSearchParams();
      params.append('proveedor', proveedor);
      params.append('pais_destino', paisDestino);
      url += `?${params.toString()}`;

      const response = await axios.get(url, {
        responseType: 'blob',
      });
      const data = await response.data.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const html = XLSX.utils.sheet_to_html(firstSheet, { editable: false });
      setExcelPreviewHtml(html);
      setShowExcelModal(true);
    } catch (error) {
      console.error(error);
      showToast('Error al previsualizar el archivo', 'error');
    }
  };

  const handlePreviewToolsPDF = async (isDownload = false) => {
    try {
      const response = await axios.get(`/operaciones/operations/${id}/generate_solicitud_particular_pdf/`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));

      if (isDownload) {
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `solicitud_particular_${id}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        showToast('Descargando Solicitud Particular...', 'success');
      } else {
        openPreview(url, 'Generador de Solicitud Particular.pdf');
      }
    } catch (error) {
      console.error('Error generando PDF:', error);
      showToast('No se pudo generar la solicitud particular', 'error');
    }
  };

  const handleEnviarAduanasClick = async () => {
    setFetchingAduanasFile(true);
    try {
      let url = `/operaciones/operations/${id}/packing_list_excel/`;
      const params = new URLSearchParams();
      params.append('proveedor', proveedor);
      params.append('pais_destino', paisDestino);
      url += `?${params.toString()}`;

      const response = await axios.get(url, {
        responseType: 'blob',
      });
      const file = new File([response.data], `packing_list_${id}.xlsx`, {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      setAduanasEmailAttachment(file);
      setShowAduanasEmailModal(true);
    } catch (error) {
      console.error(error);
      showToast('Error al preparar el packing list para adjuntar', 'error');
    } finally {
      setFetchingAduanasFile(false);
    }
  };

  const handleAduanasEmailSuccess = async () => {
    setShowAduanasEmailModal(false);
    showToast('Correo de Aduanas encolado. Transicionando operación...', 'success');

    setActionLoading(true);
    try {
      await axios.post(`/operaciones/operations/${id}/start_coordination/`, {
        proveedor,
        pais_destino: paisDestino
      });
      showToast('Operación enviada a Aduanas correctamente.', 'success');
      fetchOperation();
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.error || 'Error al transicionar la operación a aduana';
      showToast(errMsg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCotizacionEmailSuccess = async () => {
    setShowCotizacionEmailModal(false);
    showToast('Correo de Cotización encolado. Transicionando operación...', 'success');

    setActionLoading(true);
    try {
      const formData = new FormData();
      if (cotizacionEmailAttachment) {
        formData.append('file', cotizacionEmailAttachment);
      }

      if (operation?.tipo_operacion === 'servicios') {
        await axios.post(`/operaciones/operations/${id}/cotizar_servicio/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        await axios.post(`/operaciones/operations/${id}/cotizar_producto/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      showToast('Operación marcada como Cotizada (Cotización Enviada).', 'success');
      fetchOperation();
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.error || 'Error al transicionar la operación';
      showToast(errMsg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerCotizacion = () => {
    const cotizaciones = operation.documentos_adjuntos?.filter(d => d.tipo === 'cotizacion') || [];
    if (cotizaciones.length > 0) {
      const ultimaCotizacion = cotizaciones[cotizaciones.length - 1];
      window.open(ultimaCotizacion.archivo, '_blank');
    } else {
      showToast('No se encontró el archivo de la cotización. Revise la pestaña Documentación.', 'warning');
    }
  };

  const handleOpenPackingModal = () => {
    if (!operation) return;

    const productsMapped = (operation.products || []).map(p => ({
      product: p.product,
      name: p.product_name,
      quantity: p.quantity,
      presentation: p.presentation || '',
      unit_weight: p.weight_kg || 0,
      total_weight: (p.quantity || 0) * (p.weight_kg || 0),
      unit_price: p.unit_price || 0,
      subtotal: (p.quantity || 0) * (p.unit_price || 0)
    }));

    const totalWeight = productsMapped.reduce((sum, p) => sum + p.total_weight, 0);
    const totalPrice = productsMapped.reduce((sum, p) => sum + p.subtotal, 0);

    setPackingData({
      operation_id: operation.id,
      client: operation.client_name,
      ship: operation.ship_name,
      port: operation.port_name,
      eta: operation.eta,
      products: productsMapped,
      total_weight: totalWeight,
      total_price: totalPrice
    });

    setIsEditingPacking(false);
    setShowPackingModal(true);
  };

  const handleStartEditPacking = () => {
    setEditPackingProducts([...packingData.products]);
    setIsEditingPacking(true);
  };

  const handleUpdateEditRow = (idx, field, val) => {
    setEditPackingProducts(prev => {
      const copy = [...prev];
      const row = { ...copy[idx] };

      if (field === 'quantity') {
        row.quantity = parseInt(val) || 0;
        row.total_weight = row.quantity * row.unit_weight;
        row.subtotal = row.quantity * row.unit_price;
      } else if (field === 'unit_price') {
        row.unit_price = parseFloat(val) || 0;
        row.subtotal = row.quantity * row.unit_price;
      }

      copy[idx] = row;
      return copy;
    });
  };

  const handleRemoveEditRow = (idx) => {
    setEditPackingProducts(prev => prev.filter((_, i) => i !== idx));
  };

  const handleAddProductToPacking = (item) => {
    if (!item) return;
    if (editPackingProducts.some(p => String(p.product) === String(item.id))) {
      showToast('El producto ya está en la lista', 'error');
      return;
    }

    const unitWeight = parseFloat(item.peso_kg || item.weight_kg) || 0;
    const newProduct = {
      product: item.id,
      name: item.nombre || item.name,
      quantity: 1,
      presentation: item.presentacion || item.presentation || '',
      unit_weight: unitWeight,
      total_weight: unitWeight,
      unit_price: 0,
      subtotal: 0
    };

    setEditPackingProducts(prev => [...prev, newProduct]);
  };

  const handleSavePacking = async () => {
    if (editPackingProducts.length === 0) {
      alert('Debe haber al menos un producto en el packing list.');
      return;
    }
    for (const p of editPackingProducts) {
      if (p.quantity <= 0) {
        alert(`La cantidad para ${p.name} debe ser mayor a 0.`);
        return;
      }
    }

    setActionLoading(true);
    try {
      const payload = {
        products: editPackingProducts.map(p => ({
          product: p.product,
          quantity: p.quantity,
          unit_price: p.unit_price
        }))
      };

      const res = await axios.patch(`/operaciones/operations/${id}/`, payload);
      showToast('Packing list guardado y actualizado con éxito', 'success');

      setOperation(res.data);

      const productsMapped = (res.data.products || []).map(p => ({
        product: p.product,
        name: p.product_name,
        quantity: p.quantity,
        presentation: p.presentation || '',
        unit_weight: p.weight_kg || 0,
        total_weight: (p.quantity || 0) * (p.weight_kg || 0),
        unit_price: p.unit_price || 0,
        subtotal: (p.quantity || 0) * (p.unit_price || 0)
      }));

      const totalWeight = productsMapped.reduce((sum, p) => sum + p.total_weight, 0);
      const totalPrice = productsMapped.reduce((sum, p) => sum + p.subtotal, 0);

      setPackingData({
        operation_id: res.data.id,
        client: res.data.client_name,
        ship: res.data.ship_name,
        port: res.data.port_name,
        eta: res.data.eta,
        products: productsMapped,
        total_weight: totalWeight,
        total_price: totalPrice
      });

      setIsEditingPacking(false);
      checkStock();
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.error || 'Error al guardar el packing list';
      alert(errMsg);
    } finally {
      setActionLoading(false);
    }
  };

  const refreshDocuments = () => {
    fetchOperation();
  };

  const statusBadge = (status) => {
    const colors = {
      solicitada: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800',
      armado_packing: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800',
      en_aduana: 'bg-orange-100 text-orange-800',
      lista_para_envio: 'bg-green-100 dark:bg-green-900/30 text-green-800',
      remitada: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800',
      entregada: 'bg-gray-100 text-gray-800',
      cancelada: 'bg-red-100 dark:bg-red-900/30 text-red-800',
    };
    const labels = {
      solicitada: 'Preparación',
      armado_packing: 'Suministros',
      en_aduana: 'Aduanas',
      lista_para_envio: 'Logística',
      remitada: 'Remito Enviado',
      entregada: 'Entregada',
      cancelada: 'Cancelada',
    };
    return (
      <span className={`px-3 py-1.5 inline-flex text-xs leading-5 font-black uppercase tracking-wider rounded-lg ${colors[status] || 'bg-gray-100 dark:bg-slate-800/50 text-gray-800 dark:text-slate-200'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString();
  };

  const calculateTotal = () => {
    if (!operation?.products) return 0;
    return operation.products.reduce((sum, p) => sum + (p.quantity * p.unit_price), 0);
  };

  const isOperario = user?.role === 'OPERARIO';
  const isOwner = user?.role === 'OWNER';
  const canEdit = isOwner || (isOperador && (
    operation?.creado_por === user?.id || 
    (operation?.operadores_id && operation.operadores_id.includes(user?.id))
  ));

  if (loading) return <div className="flex justify-center mt-20"><LogoSpinner size="w-16 h-16" /></div>;
  if (error) return <div className="text-center text-red-600 mt-10 font-bold bg-red-50 dark:bg-red-900/20 p-4 rounded-xl max-w-lg mx-auto">{error}</div>;
  if (!operation) return <div className="text-center mt-10">No se encontró la operación</div>;

  const shipFlag = operation.ship_flag || (operation.ship ? operation.ship.flag : '');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
      <nav className="bg-white dark:bg-slate-800 shadow-sm sticky top-0 z-40 border-b border-transparent dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/')} className="text-slate-400 hover:text-indigo-600 transition-colors p-2 rounded-lg hover:bg-indigo-50 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/30">
                <i className="bi bi-arrow-left text-xl"></i>
              </button>

              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                    className="px-2 py-1 text-sm bg-white dark:bg-slate-700 border border-indigo-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-white w-64"
                    autoFocus
                  />
                  <button onClick={handleSaveName} className="text-emerald-600 hover:text-emerald-700 p-1"><i className="bi bi-check-lg"></i></button>
                  <button onClick={() => { setEditingName(false); setTempName(operation.nombre || ''); }} className="text-red-500 hover:text-red-600 p-1"><i className="bi bi-x-lg"></i></button>
                </div>
              ) : (
                <div className="flex flex-col justify-center group relative">
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                      {operation.nombre || `OP-${String(operation.id).padStart(4, '0')}`}
                    </h1>
                    {canEdit && (
                      <button onClick={() => setEditingName(true)} className="text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        <i className="bi bi-pencil-square"></i>
                      </button>
                    )}
                  </div>
                  {operation.nombre && (
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold tracking-widest uppercase mt-[-2px]">
                      OP-{String(operation.id).padStart(4, '0')}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center space-x-4">

              <span className="text-sm font-semibold text-slate-600 dark:text-slate-400 hidden sm:block">Hola, {formatUserName(user)}</span>
              <button onClick={logout} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:bg-red-900/20 dark:hover:bg-red-900/30 rounded-full transition-colors" title="Cerrar sesión">
                <i className="bi bi-box-arrow-right text-lg"></i>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {operation.estado === 'pausada' && (
          <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 p-4 rounded-r-xl mb-6 shadow-sm">
            <div className="flex">
              <div className="flex-shrink-0">
                <i className="bi bi-exclamation-octagon-fill text-red-500 text-xl"></i>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-bold text-red-800 dark:text-red-300 uppercase tracking-wider">
                  Operación Pausada (Rechazada)
                </h3>
                <div className="mt-2 text-sm text-red-700 dark:text-red-200">
                  <p>
                    <strong>Motivo del rechazo: </strong>
                    {operation.motivo_rechazo || 'No se especificó un motivo.'}
                  </p>
                </div>
                {isOwner && (
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={handleReanudarOperacion}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded shadow transition-colors inline-flex flex-row items-center gap-2"
                    >
                      <i className="bi bi-arrow-repeat"></i> Reanudar Operación
                    </button>
                    <button
                      onClick={() => handleAction('recotizar_operacion', '¿Solicitar una recotización? La operación volverá al estado Recibida.')}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded shadow transition-colors inline-flex flex-row items-center gap-2"
                    >
                      <i className="bi bi-arrow-counterclockwise"></i> Solicitar Recotización
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {toastMessage && (
          <div className={`fixed top-20 right-4 z-50 px-4 py-3 rounded-xl shadow-lg border flex items-center gap-3 animate-fadeIn ${toastMessage.type === 'error' ? 'bg-red-50 dark:bg-red-900/20 text-red-800 border-red-200' :
            toastMessage.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 border-emerald-200' :
              'bg-blue-50 dark:bg-blue-900/20 text-blue-800 border-blue-200'
            }`}>
            <i className={`bi text-lg ${toastMessage.type === 'error' ? 'bi-x-circle-fill text-red-500' : toastMessage.type === 'success' ? 'bi-check-circle-fill text-emerald-500' : 'bi-info-circle-fill text-blue-500'}`}></i>
            <span className="font-bold text-sm tracking-tight">{toastMessage.message}</span>
          </div>
        )}

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* BANNER DE REVISIÓN */}
          {operation.estado_revision === 'pending' && (
            <div className="mb-6 bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl shadow-sm flex items-start gap-3">
              <i className="bi bi-info-circle-fill text-amber-500 text-xl mt-0.5"></i>
              <div>
                <h4 className="text-amber-800 font-bold">Notificación a Gerencia</h4>
                <p className="text-amber-700 text-sm">{isOwner ? 'Un operador ha generado actividad reciente en esta operación.' : 'El administrador ha sido notificado del progreso de esta operación.'}</p>
                {operation.mensaje_revision && (
                  <div className="mt-2 p-2 bg-white dark:bg-slate-800/60 rounded text-amber-900 text-xs shadow-sm italic">
                    "{operation.mensaje_revision}"
                  </div>
                )}
              </div>
            </div>
          )}

          {operation.estado_revision === 'rejected' && isOperador && (
            <div className="mb-6 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-r-xl shadow-sm flex items-start gap-3">
              <i className="bi bi-exclamation-octagon-fill text-red-500 text-xl mt-0.5"></i>
              <div>
                <h4 className="text-red-800 font-bold">Se requieren correcciones</h4>
                <p className="text-red-700 text-sm">El administrador ha rechazado tu solicitud previa.</p>
                {operation.mensaje_revision && (
                  <div className="mt-2 p-2 bg-white dark:bg-slate-800/60 rounded text-red-900 text-xs shadow-sm italic">
                    "{operation.mensaje_revision}"
                  </div>
                )}
              </div>
            </div>
          )}

          {operation.estado_revision === 'approved' && isOperador && (
            <div className="mb-6 bg-emerald-50 dark:bg-emerald-900/20 border-l-4 border-emerald-500 p-4 rounded-r-xl shadow-sm flex items-start gap-3">
              <i className="bi bi-shield-check text-emerald-500 text-xl mt-0.5"></i>
              <div>
                <h4 className="text-emerald-800 font-bold">Revisión Aprobada</h4>
                <p className="text-emerald-700 text-sm">El administrador dio el OK. Ahora puedes continuar la operación al siguiente nivel.</p>
                {operation.mensaje_revision && (
                  <div className="mt-2 p-2 bg-white dark:bg-slate-800/60 rounded text-emerald-900 text-xs shadow-sm italic">
                    "{operation.mensaje_revision}"
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

            <div className="lg:col-span-2 space-y-6">

              {/* Generate Cotizacion (PDF) Box - Unified for Products and Services */}
              {canEdit && (!isOperador || operation.estado_revision !== 'rejected') && !isOperario && (
                <div className="bg-white dark:bg-slate-800 shadow-sm overflow-hidden sm:rounded-2xl border border-slate-200 dark:border-slate-700 p-6 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-lg leading-6 font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <i className="bi bi-file-earmark-pdf-fill text-red-500"></i> Generar Cotización (PDF)
                    </h3>
                    <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                      Configura las condiciones comerciales y descarga la cotización en PDF.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowCotizacionWordModal(true)}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 w-full sm:w-auto"
                    title="Configurar y generar cotización en Word"
                  >
                    Generar Cotización
                  </button>
                </div>
              )}

              {/* Generar Remito Box */}
              {canEdit && (!isOperador || operation.estado_revision !== 'rejected') && !isOperario && operation?.tipo_operacion !== 'servicios' && (
                <div className="bg-white dark:bg-slate-800 shadow-sm overflow-hidden sm:rounded-2xl border border-slate-200 dark:border-slate-700 p-6 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-lg leading-6 font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <i className="bi bi-file-earmark-pdf-fill text-indigo-500"></i> Generar Remito (PDF)
                    </h3>
                    <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                      Descarga el remito autogenerado con los datos de esta operación.
                    </p>
                  </div>
                  <button
                    onClick={handleGenerateRemito}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 w-full sm:w-auto"
                    title="Descargar Remito"
                  >
                    <i className="bi bi-download"></i> Generar Remito
                  </button>
                </div>
              )}


              <div className="bg-white dark:bg-slate-800 shadow-sm overflow-hidden sm:rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="px-4 py-5 sm:px-6 flex justify-between items-center border-b border-slate-100 dark:border-slate-700">
                  <div>
                    <h3 className="text-lg leading-6 font-black text-slate-900 dark:text-white">Resumen Operativo</h3>
                    <p className="mt-1 max-w-2xl text-sm font-medium text-slate-500 dark:text-slate-400">Información logística y de tiempos</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {checkingStock && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>}
                    {statusBadge(operation.status || operation.estado)}
                  </div>
                </div>

                <div>
                  <dl className="grid grid-cols-1 sm:grid-cols-2">
                    <div className="px-4 py-4 sm:px-6 border-b sm:border-r border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
                      <dt className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Cliente</dt>
                      <dd className="text-sm font-semibold text-slate-900 dark:text-white">{operation.client_name}</dd>
                    </div>
                    <div className="px-4 py-4 sm:px-6 border-b border-slate-100 dark:border-slate-700">
                      <dt className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Buque</dt>
                      <dd className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <i className="bi bi-geo-alt-fill text-indigo-400"></i> {operation.ship_name}
                      </dd>
                    </div>
                    <div className="px-4 py-4 sm:px-6 border-b sm:border-r border-slate-100 dark:border-slate-700">
                      <dt className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Puerto</dt>
                      <dd className="text-sm font-semibold text-slate-900 dark:text-white">{operation.port_name}</dd>
                    </div>
                    <div className="px-4 py-4 sm:px-6 border-b border-slate-100 dark:border-slate-700 bg-indigo-50/30 dark:bg-indigo-900/20">
                      <dt className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">ETA (Arribo)</dt>
                      <dd className="text-sm font-black text-indigo-700 dark:text-indigo-400">{formatDate(operation.eta)}</dd>
                    </div>
                    <div className="px-4 py-4 sm:px-6 border-b sm:border-r border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
                      <dt className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Agencia / Entrega</dt>
                      <dd className="text-sm font-semibold text-slate-900 dark:text-white">
                        {operation.agency_name || 'Sin agencia'} • <span className="capitalize">{operation.delivery_method}</span>
                      </dd>
                    </div>
                    <div className="px-4 py-4 sm:px-6 border-b border-slate-100 dark:border-slate-700">
                      <dt className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Notas</dt>
                      <dd className="text-sm font-medium text-slate-600 dark:text-slate-300 line-clamp-2">{operation.notes || 'Sin anotaciones'}</dd>
                    </div>
                  </dl>

                  {isOwner && (
                    <>
                      <div className="bg-slate-800 px-4 py-4 sm:px-6 text-white">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest flex items-center gap-2">
                          <i className="bi bi-people-fill"></i> Personal de Misión Asignado
                        </p>
                        <div className="flex flex-wrap gap-4 text-xs">
                          <span className="bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-600 font-bold">
                            Operadores (Oficina): {operation.operadores_id?.length || 0}
                          </span>
                          <span className="bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-600 font-bold">
                            Operarios (Planta - PersonalPlantel): {operation.operarios_id?.length || 0}
                          </span>
                          <span className="bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-600 font-bold">
                            Operarios Usuarios App: {operation.operarios_usuarios_id?.length || 0}
                          </span>
                        </div>
                        {operation.operarios_usuarios_nombres?.length > 0 && (
                          <div className="mt-2 text-xs text-slate-300">
                            <span className="font-bold">Nombres:</span> {operation.operarios_usuarios_nombres.join(', ')}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
              {(operation.tipo_operacion !== 'servicios' || leaveMaterials) && (
                <div className="bg-white dark:bg-slate-800 shadow-sm sm:rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden mb-6">
                  {!isOperario ? (
                    <>
                      <div className="px-4 py-5 sm:px-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
                        <div className="flex justify-between items-center">
                          <h3 className="text-lg leading-6 font-black text-slate-900 dark:text-white flex items-center gap-2">
                            <i className="bi bi-box-seam text-indigo-500"></i> Detalle de Carga
                          </h3>
                          {(operation.status === 'pending' || operation.estado === 'solicitada' || operation.estado === 'armado_packing') && (
                            <button onClick={checkStock} disabled={checkingStock} className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 border border-indigo-100 bg-white dark:bg-slate-800">
                              {checkingStock ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-indigo-600"></div> : <i className="bi bi-arrow-repeat"></i>}
                              Verificar Stock
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                          <thead>
                            <tr className="bg-white dark:bg-slate-700 uppercase tracking-wider text-[10px] font-black text-slate-400 dark:text-slate-400">
                              <th className="px-6 py-4 text-left">Producto</th>
                              <th className="px-6 py-4 text-center">Cant.</th>
                              <th className="px-6 py-4 text-center">Disponibilidad</th>
                              <th className="px-6 py-4 text-right text-indigo-400">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700">
                            {operation.products?.map((prod, idx) => {
                              const isSuficiente = prod.suficiente !== undefined ? prod.suficiente : true;
                              return (
                                <tr key={idx} className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${!isSuficiente ? 'bg-red-50/50 dark:bg-red-900/20' : ''}`}>
                                  <td className="px-6 py-4">
                                    <p className="text-sm font-bold text-slate-800 dark:text-white">{prod.product_name}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">${prod.unit_price} / unidad</p>
                                  </td>
                                  <td className="px-6 py-4 text-center text-sm text-slate-700 dark:text-slate-300 font-black">{prod.quantity}</td>
                                  <td className="px-6 py-4 text-center">
                                    {isSuficiente ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border border-emerald-200 uppercase">
                                        <i className="bi bi-check-circle-fill"></i> OK {prod.controlar_stock !== false ? `(${prod.stock_actual?.toFixed(0)})` : '(BAJO PEDIDO)'}
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black bg-red-50 dark:bg-red-900/20 text-red-600 border border-red-200 uppercase">
                                        <i className="bi bi-x-circle-fill"></i> Faltan ({prod.stock_actual?.toFixed(0) || '0'})
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 text-right text-sm font-black text-indigo-700">
                                    ${(prod.quantity * prod.unit_price).toFixed(2)}
                                  </td>
                                </tr>
                              );
                            })}
                            <tr className="bg-indigo-50/30 dark:bg-indigo-900/20">
                              <td colSpan="3" className="px-6 py-4 text-right text-xs font-black text-indigo-400 uppercase tracking-widest">Total Operación</td>
                              <td className="px-6 py-4 text-right text-xl font-black text-indigo-600 dark:text-indigo-400 tracking-tighter">${calculateTotal().toFixed(2)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {stockVerification && !stockVerification.todo_suficiente && (operation.status === 'pending' || operation.estado === 'solicitada' || operation.estado === 'armado_packing') && (
                        <div className="m-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-xl flex items-start gap-3">
                          <i className="bi bi-exclamation-triangle-fill text-red-500 text-lg mt-0.5"></i>
                          <div>
                            <h4 className="text-sm font-bold text-red-800">No se puede avanzar: Stock insuficiente</h4>
                            <ul className="mt-2 text-xs font-medium text-red-700 space-y-2">
                              {stockVerification.errores?.map((err, idx) => (
                                <li key={idx} className="border-b border-red-100 dark:border-slate-700/50 pb-2 last:pb-0 last:border-0">
                                  <div>
                                    • <span className="font-bold">{err.nombre}</span>: Piden <span className="font-black">{parseFloat(err.necesario).toFixed(2)} {err.unidad || 'L'}</span>, pero hay <span className="font-black">{parseFloat(err.disponible).toFixed(2)} {err.unidad || 'L'}</span>.
                                  </div>
                                  {err.formula_shortage && err.formula_shortage.length > 0 && (
                                    <div className="ml-4 mt-2 bg-red-100/50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-red-200/50 dark:border-slate-700/50">
                                      <span className="font-bold text-[10px] text-red-900 dark:text-red-400 uppercase tracking-wider block mb-1">
                                        <i className="bi bi-funnel mr-1"></i>Ingredientes faltantes para fabricar este compuesto:
                                      </span>
                                      <ul className="list-disc list-inside space-y-1 pl-1 text-[11px] text-red-800 dark:text-slate-300">
                                        {err.formula_shortage.map((fS, fIdx) => (
                                          <li key={fIdx}>
                                            <span className="font-semibold">{fS.nombre}</span> ({fS.presentacion}): Falta <span className="font-bold text-red-600 dark:text-red-400">{parseFloat(fS.falta).toFixed(2)} {fS.unidad}</span> (Necesario: {parseFloat(fS.necesario).toFixed(2)}, Disponible: {parseFloat(fS.disponible).toFixed(2)})
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <OperarioActionPanel products={operation.products} />
                  )}
                </div>
              )}

              {(!isOperario && (operation.status === 'pending' || operation.estado === 'solicitada' || operation.estado === 'armado_packing' || productionOrders.length > 0)) && (
                <div className="bg-white dark:bg-slate-800 shadow-sm sm:rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden mb-6">
                  <div className="px-4 py-5 sm:px-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30 flex justify-between items-center">
                    <h3 className="text-lg leading-6 font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <i className="bi bi-gear-fill text-indigo-500"></i> Órdenes de Fabricación (BOM)
                    </h3>
                    {(operation.estado === 'solicitada' || operation.estado === 'armado_packing') && stockVerification && !stockVerification.todo_suficiente && (
                      <button
                        onClick={handleGenerateProductionOrders}
                        disabled={generatingProduction}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
                      >
                        {generatingProduction ? (
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                        ) : (
                          <i className="bi bi-plus-circle-fill"></i>
                        )}
                        Generar Órdenes de Producción
                      </button>
                    )}
                  </div>
                  <div className="p-4 sm:p-6 space-y-4">
                    {productionOrders.length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                        No hay órdenes de fabricación generadas para esta operación.
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-700">
                        {productionOrders.map((order) => (
                          <div key={order.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-slate-800 dark:text-white truncate">
                                {order.articulo_final_nombre}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                Fórmula: {order.formula_nombre} • Cantidad: <span className="font-bold text-slate-700 dark:text-slate-300">{parseFloat(order.cantidad_a_producir).toFixed(2)}</span>
                              </p>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                Solicitado: {new Date(order.fecha_solicitud).toLocaleString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              {order.completada ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-black bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border border-emerald-200 uppercase">
                                  <i className="bi bi-check-circle-fill"></i> Completada
                                </span>
                              ) : (
                                <>
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-black bg-amber-50 text-amber-600 border border-amber-200 uppercase">
                                    <i className="bi bi-hourglass-split"></i> Pendiente
                                  </span>
                                  <button
                                    onClick={() => handleCompleteProductionOrder(order.id)}
                                    disabled={completingProduction[order.id]}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50 animate-pulse"
                                  >
                                    {completingProduction[order.id] ? (
                                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                    ) : (
                                      <i className="bi bi-play-fill text-sm"></i>
                                    )}
                                    Completar Producción
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {operation.texto_pedido && (
                <div className="bg-white dark:bg-slate-800 shadow-sm sm:rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden mb-6">
                  <div className="px-4 py-5 sm:px-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
                    <h3 className="text-lg leading-6 font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <i className="bi bi-chat-left-text-fill text-indigo-500"></i> Pedido Original (Preparación)
                    </h3>
                  </div>
                  <div className="p-4 sm:p-6 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-mono bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 overflow-x-auto">
                    {operation.texto_pedido}
                  </div>

                  {(!isOperario) && (
                    <div className="px-4 py-4 sm:px-6 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                      <ProductSearchCards initialProducts={detectedProducts} />
                    </div>
                  )}
                </div>
              )}

              {operation.tipo_operacion === 'servicios' && (
                <div className="bg-indigo-50/50 dark:bg-indigo-900/10 shadow-sm sm:rounded-2xl border border-indigo-100 dark:border-indigo-800/30 overflow-hidden mb-6 p-4 sm:p-6 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-indigo-900 dark:text-indigo-300">Materiales a bordo (Consumibles / Repuestos)</h4>
                    <p className="text-xs text-indigo-700/70 dark:text-indigo-400/70 mt-1">
                      Activa esta opción si se dejarán materiales en el buque. Esto habilitará la generación de Packing List y Rancho Aduanero.
                    </p>
                  </div>
                  <button
                    onClick={() => setLeaveMaterials(!leaveMaterials)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${leaveMaterials ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                    role="switch"
                    aria-checked={leaveMaterials}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white dark:bg-slate-800 shadow ring-0 transition duration-200 ease-in-out ${leaveMaterials ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              )}

              {(operation.tipo_operacion !== 'servicios' || leaveMaterials) && (
                <>
                  <div className="bg-white dark:bg-slate-800 shadow-sm sm:rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden mb-6">
                    <div className="px-4 py-5 sm:px-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg leading-6 font-black text-slate-900 dark:text-white flex items-center gap-2">
                          <i className="bi bi-file-earmark-spreadsheet-fill text-emerald-600"></i> Opciones del Packing List
                        </h3>
                      </div>
                    </div>
                    <div className="p-4 sm:p-6 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-2">PROVEEDOR</label>
                          <select
                            value={proveedor}
                            onChange={(e) => setProveedor(e.target.value)}
                            className="block w-full py-2 px-3 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
                          >
                            <option value="PROIOS SA">PROIOS SA (CUIT: 30-63661723-3)</option>
                            <option value="PROIOS SALVAGE SA">PROIOS SALVAGE SA (CUIT: 33-71087653-9)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-2">PAÍS DE DESTINO DE LA FACTURA</label>
                          <select
                            value={paisDestino}
                            onChange={(e) => setPaisDestino(e.target.value)}
                            className="block w-full py-2 px-3 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
                          >
                            <option value="argentina">Argentina (empresa argentina)</option>
                            <option value="bandera">Bandera del buque (cliente extranjero)</option>
                          </select>
                          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                            {paisDestino === 'argentina' ? 'Se usará Argentina' : (shipFlag ? `Se usará la bandera: ${shipFlag}` : 'Bandera no especificada en el buque')}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-800 shadow-sm sm:rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden mb-6">
                    <div className="px-4 py-5 sm:px-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
                      <h3 className="text-lg leading-6 font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <i className="bi bi-folder-fill text-indigo-500"></i> Documentación {operation.tipo_operacion === 'servicios' && '(Por Materiales a Bordo)'}
                      </h3>
                    </div>
                    <div className="p-4 sm:p-6 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-700/50 shadow-sm hover:shadow-md transition-shadow gap-4">
                        <div>
                          <h4 className="text-sm font-bold text-slate-800 dark:text-white">Packing List</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Listado detallado de mercadería para aduana y remito.</p>
                          {operation.packing_list_file && (
                            <button
                              onClick={() => openPreview(operation.packing_list_file, 'Packing List')}
                              className="inline-flex mt-2 text-indigo-600 hover:text-indigo-800 text-xs font-bold items-center gap-1 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded"
                            >
                              <i className="bi bi-eye-fill"></i> Ver Documento
                            </button>
                          )}
                        </div>
                        <div className="flex flex-wrap sm:flex-nowrap gap-2 shrink-0 w-full sm:w-auto">
                          <button
                            onClick={handleOpenPackingModal}
                            className="flex-1 sm:flex-none justify-center px-3 py-2 bg-indigo-100 dark:bg-indigo-900/30 hover:bg-indigo-200 text-indigo-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
                          >
                            <i className={`bi ${canEdit ? 'bi-pencil-square' : 'bi-eye-fill'}`}></i> {canEdit ? 'Editar' : 'Ver'}
                          </button>
                          <button
                            onClick={previewPackingListExcel}
                            className="flex-1 sm:flex-none justify-center px-3 py-2 bg-emerald-100 dark:bg-emerald-900/30 hover:bg-emerald-200 text-emerald-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
                          >
                            <i className="bi bi-eye-fill"></i> Vista Previa
                          </button>
                          <button
                            onClick={downloadPackingListExcel}
                            className="flex-1 sm:flex-none justify-center px-3 py-2 bg-slate-100 dark:bg-slate-900/30 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
                          >
                            <i className="bi bi-file-earmark-spreadsheet"></i> Exportar
                          </button>
                          <label className={`flex-1 sm:flex-none justify-center cursor-pointer px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-slate-900/20 hover:text-indigo-600 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 shadow-sm ${uploading || !canEdit || (isOperador && operation.estado_revision === 'rejected') ? 'opacity-50 pointer-events-none' : ''}`}>
                            <i className="bi bi-cloud-arrow-up-fill"></i> Subir
                            <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'upload_packing', '¿Subir packing list?')} disabled={uploading || !canEdit || (isOperador && operation.estado_revision === 'rejected')} />
                          </label>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-700/50 shadow-sm hover:shadow-md transition-shadow gap-4">
                        <div>
                          <h4 className="text-sm font-bold text-slate-800 dark:text-white">Remito Firmado</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Constancia de entrega sellada por la tripulación.</p>
                          {operation.remito_file && (
                            <button
                              onClick={() => openPreview(operation.remito_file, 'Remito Firmado')}
                              className="inline-flex mt-2 text-indigo-600 hover:text-indigo-800 text-xs font-bold items-center gap-1 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded"
                            >
                              <i className="bi bi-eye-fill"></i> Ver Documento
                            </button>
                          )}
                        </div>
                        <label className={`w-full sm:w-auto justify-center cursor-pointer px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-slate-900/20 hover:text-indigo-600 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 shadow-sm shrink-0 ${uploading || !canEdit || (isOperador && operation.estado_revision === 'rejected') ? 'opacity-50 pointer-events-none' : ''}`}>
                          <i className="bi bi-cloud-arrow-up-fill"></i> Subir Remito
                          <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'upload_remito', '¿Subir remito firmado?')} disabled={uploading || !canEdit || (isOperador && operation.estado_revision === 'rejected')} />
                        </label>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-700/50 shadow-sm hover:shadow-md transition-shadow gap-4">
                        <div>
                          <h4 className="text-sm font-bold text-slate-800 dark:text-white">Rancho / Permiso Aduanero</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Autorización oficial de embarque de provisiones.</p>
                          {operation.rancho_file && (
                            <button
                              onClick={() => openPreview(operation.rancho_file)}
                              className="inline-flex mt-2 text-indigo-600 hover:text-indigo-800 text-xs font-bold items-center gap-1 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded"
                            >
                              <i className="bi bi-eye-fill"></i> Ver Documento
                            </button>
                          )}
                        </div>
                        <label className={`w-full sm:w-auto justify-center cursor-pointer px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-slate-900/20 hover:text-indigo-600 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 shadow-sm shrink-0 ${uploading || !canEdit || (isOperador && operation.estado_revision === 'rejected') ? 'opacity-50 pointer-events-none' : ''}`}>
                          <i className="bi bi-cloud-arrow-up-fill"></i> Subir Rancho
                          <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'upload_rancho', '¿Subir documentación aduanera (rancho)?')} disabled={uploading || !canEdit || (isOperador && operation.estado_revision === 'rejected')} />
                        </label>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {operation.tipo_operacion === 'servicios' && (
                <div className="bg-white dark:bg-slate-800 shadow-sm sm:rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden mb-6">
                  <div className="px-4 py-5 sm:px-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
                    <h3 className="text-lg leading-6 font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <i className="bi bi-tools text-amber-500"></i> Solicitud Particular PNA (Herramientas a Bordo)
                    </h3>
                  </div>
                  <div className="p-4 sm:p-6 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-700/50 shadow-sm hover:shadow-md transition-shadow gap-4">
                      <div>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-white">Documento Solicitud Particular</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Puedes crear el listado desde aquí o subir uno externo firmado.</p>
                        {operation.solicitud_particular_file && (
                          <button
                            onClick={() => openPreview(operation.solicitud_particular_file, 'Solicitud Particular Externa')}
                            className="inline-flex mt-2 text-indigo-600 hover:text-indigo-800 text-xs font-bold items-center gap-1 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded"
                          >
                            <i className="bi bi-eye-fill"></i> Ver Documento Subido
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap sm:flex-nowrap gap-2 shrink-0 w-full sm:w-auto">
                        {canEdit && (
                          <button
                            onClick={() => setIsToolsModalOpen(true)}
                            className="flex-1 sm:flex-none justify-center px-3 py-2 bg-indigo-100 dark:bg-indigo-900/30 hover:bg-indigo-200 text-indigo-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
                          >
                            <i className="bi bi-card-list"></i> Gestionar Herramientas
                          </button>
                        )}
                        <label className={`flex-1 sm:flex-none justify-center cursor-pointer px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-slate-900/20 hover:text-indigo-600 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 shadow-sm ${uploading || !canEdit || (isOperador && operation.estado_revision === 'rejected') ? 'opacity-50 pointer-events-none' : ''}`}>
                          <i className="bi bi-cloud-arrow-up-fill"></i> Subir PDF Externo
                          <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'upload_solicitud_particular', '¿Subir documento externo para Solicitud Particular?')} disabled={uploading || !canEdit || (isOperador && operation.estado_revision === 'rejected')} />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* DOCUMENTOS ADICIONALES (NUEVO) */}
              <OperationDocuments
                operacionId={operation.id}
                documentos={documentos}
                onDocumentChange={refreshDocuments}
                openPreview={openPreview}
                selectedDocs={selectedDocs}
                toggleSelectDoc={toggleSelectDoc}
                canEdit={canEdit}
              />

              {/* ADJUNTOS DE LA CADENA DE CORREOS */}
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-5 mt-6">
                <div className="flex justify-between items-center mb-4 border-b border-slate-100 dark:border-slate-700 pb-3">
                  <h3 className="text-lg leading-6 font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <i className="bi bi-paperclip text-indigo-500"></i> Adjuntos de la Cadena de Correos
                  </h3>
                  <span className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs px-2.5 py-1 rounded-full font-bold">
                    {emailAttachments.length} {emailAttachments.length === 1 ? 'archivo' : 'archivos'}
                  </span>
                </div>
                {emailAttachments.length === 0 ? (
                  <p className="text-gray-500 dark:text-slate-400 text-sm">No hay archivos adjuntos en la cadena de correos de esta operación.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {emailAttachments.map((adj) => {
                      const isImage = adj.content_type?.startsWith('image/') || adj.filename?.match(/\.(jpe?g|png|gif|bmp|webp)$/i);
                      const isPdf = adj.content_type === 'application/pdf' || adj.filename?.match(/\.pdf$/i);
                      const isExcel = adj.content_type?.includes('spreadsheet') || adj.content_type?.includes('excel') || adj.filename?.match(/\.xlsx?$/i);

                      let iconClass = "bi-file-earmark-fill text-slate-400";
                      if (isImage) iconClass = "bi-file-earmark-image text-indigo-500";
                      else if (isPdf) iconClass = "bi-file-earmark-pdf text-red-500";
                      else if (isExcel) iconClass = "bi-file-earmark-excel text-emerald-500";

                      return (
                        <div key={adj.id} className="flex flex-col justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30 hover:bg-slate-50 dark:bg-slate-900/20 dark:hover:bg-slate-700 transition-colors shadow-sm gap-3">
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={selectedEmailAtts.includes(adj.id)}
                              onChange={() => toggleSelectEmailAtt(adj.id)}
                              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0 mt-2.5"
                            />
                            <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 shrink-0">
                              <i className={`bi ${iconClass} text-xl`}></i>
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="text-sm font-bold text-slate-800 dark:text-white truncate animate-pulse" title={adj.filename}>
                                {adj.filename}
                              </h4>
                              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                                <span className="font-bold text-slate-600 dark:text-slate-300">De:</span> {adj.emailSender} <br />
                                <span className="font-bold text-slate-600 dark:text-slate-300">Asunto:</span> "{adj.emailSubject}"
                              </p>
                              <p className="text-[10px] text-slate-400 mt-1">
                                {new Date(adj.emailDate).toLocaleString()}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 border-t border-slate-100 dark:border-slate-700/50 pt-2 mt-auto">
                            <button
                              onClick={() => openPreview(getMediaUrl(adj.file), adj.filename)}
                              className="flex-1 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 border border-indigo-100 dark:border-indigo-800 transition-colors"
                            >
                              <i className="bi bi-eye-fill"></i> Ver
                            </button>
                            <a
                              href={getMediaUrl(adj.file)}
                              download
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-600 transition-colors"
                            >
                              <i className="bi bi-download"></i> Descargar
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mt-8 mb-8">
                <OperationEmails operacionId={id} openPreview={openPreview} />
              </div>

              <div className="bg-slate-800 shadow-lg sm:rounded-2xl overflow-hidden p-4 sm:p-6 flex flex-col gap-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 w-full">
                  <div className="text-white w-full sm:w-auto text-center sm:text-left">
                    <h4 className="font-black text-lg">Controles Operativos</h4>
                    <p className="text-xs text-slate-400 font-medium">Avanza la operación a la siguiente fase.</p>
                  </div>

                  <div className="flex flex-col sm:flex-row flex-wrap gap-3 w-full sm:w-auto sm:justify-end">
                    {isOwner && operation.status !== 'closed' && operation.estado !== 'entregada' && operation.status !== 'cancelled' && operation.estado !== 'cancelada' && (
                      <button
                        onClick={() => handleAction('cancel_operation', '¿Cancelar esta operación? Se marcará como cancelada y el stock consumido se devolverá automáticamente al inventario.')}
                        disabled={actionLoading}
                        className="w-full sm:w-auto px-4 py-2 border-2 border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                      >
                        <i className="bi bi-x-octagon-fill"></i> Anular
                      </button>
                    )}
                    {isOwner && operation.estado === 'pausada' && (
                      <div className="flex gap-2">
                        <button
                          onClick={handleReanudarOperacion}
                          disabled={actionLoading}
                          className="w-full sm:w-auto px-4 py-2 border-2 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500 hover:text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                          <i className="bi bi-play-fill"></i> Reanudar Operación
                        </button>
                        <button
                          onClick={() => handleAction('recotizar_operacion', '¿Solicitar una recotización? La operación volverá al estado Recibida.')}
                          disabled={actionLoading}
                          className="w-full sm:w-auto px-4 py-2 border-2 border-amber-500/30 text-amber-400 hover:bg-amber-500 hover:text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                          <i className="bi bi-arrow-counterclockwise"></i> Solicitar Recotización
                        </button>
                      </div>
                    )}
                    
                    {/* Botones Especiales de Seguimiento de Cotización */}
                    {(operation.estado === 'cotizacion_enviada' || operation.estado === 'cotizado') ? (
                      <>
                        <button
                          onClick={() => {
                            // Abrir modal de correo para seguimiento (sin adjunto forzado, usa plantilla)
                            setCotizacionEmailAttachment(null);
                            setShowCotizacionEmailModal(true);
                          }}
                          className="w-full sm:w-auto px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                        >
                          <i className="bi bi-send-check-fill"></i> Seguimiento
                        </button>
                        <button
                          onClick={() => {
                            if (operation.tipo_operacion === 'servicios') {
                              handleAction('tramitar_permisos_pna', '¿El cliente ha confirmado la cotización? La operación pasará a gestión de PNA.');
                            } else {
                              handleAction('cliente_confirma_producto', '¿El cliente ha confirmado la cotización? La operación pasará a preparación.');
                            }
                          }}
                          disabled={actionLoading}
                          className="w-full sm:w-auto px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                        >
                          <i className="bi bi-check-circle-fill"></i> Confirmada
                        </button>
                        <button
                          onClick={() => setShowRechazoModal(true)}
                          className="w-full sm:w-auto px-4 py-2 bg-red-500 hover:bg-red-400 text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-red-500/20"
                        >
                          <i className="bi bi-x-circle-fill"></i> Rechazada
                        </button>
                      </>
                    ) : (
                      canEdit && operation.estado !== 'pausada' && (
                        <button onClick={() => navigate(`/operations/${id}/edit`)} className="w-full sm:w-auto px-4 py-2 bg-white dark:bg-slate-800/10 hover:bg-white dark:bg-slate-800/20 text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                          <i className="bi bi-pencil-fill"></i> Editar Info
                        </button>
                      )
                    )}

                    {isOwner && operation.estado_revision === 'pending' && (
                      <button
                        onClick={() => handleResolveReview('approve')}
                        disabled={revisionActionLoading}
                        className="w-full sm:w-auto px-5 py-2.5 bg-amber-500 text-amber-950 hover:bg-amber-400 font-black rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
                      >
                        {revisionActionLoading ? 'Procesando...' : <><i className="bi bi-check-all text-lg leading-none"></i> Marcar como Visto</>}
                      </button>
                    )}

                    {operation.tipo_operacion !== 'servicios' ? (
                      <>
                        {canEdit && (!isOperador || operation.estado_revision !== 'rejected') && operation.can_confirm && !isOperario && (
                          <button
                            onClick={() => handleAction('confirm_operation', '¿Confirmar etapa de Preparación y pasar al estado de Suministros (Armado de Packing List)?')}
                            disabled={actionLoading}
                            className="w-full sm:w-auto px-5 py-2.5 bg-emerald-500 text-white hover:bg-emerald-400 font-black rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                          >
                            {actionLoading ? 'Procesando...' : <><i className="bi bi-box-seam"></i> Armar Packing List</>}
                          </button>
                        )}
                        {canEdit && (!isOperador || operation.estado_revision !== 'rejected') && operation.can_send_to_customs && !isOperario && (
                          <button
                            onClick={handleEnviarAduanasClick}
                            disabled={actionLoading || fetchingAduanasFile || (stockVerification && !stockVerification.todo_suficiente)}
                            className={`w-full sm:w-auto px-5 py-2.5 text-sm font-black rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 ${(stockVerification && !stockVerification.todo_suficiente)
                              ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                              : 'bg-indigo-500 text-white hover:bg-indigo-400 hover:shadow-indigo-500/30'
                              }`}
                          >
                            {actionLoading || fetchingAduanasFile ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                Procesando...
                              </>
                            ) : (
                              <><i className="bi bi-building-check"></i> Enviar a Aduanas</>
                            )}
                          </button>
                        )}
                        {canEdit && (!isOperador || operation.estado_revision !== 'rejected') && operation.can_coordinate && !isOperario && (
                          <button
                            onClick={() => handleAction('finalize_production', '¿Aduanas aprobó el despacho (Rancho)? Pasar a lista para envío.')}
                            disabled={actionLoading}
                            className="w-full sm:w-auto px-5 py-2.5 bg-amber-500 text-white hover:bg-amber-400 font-black rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                          >
                            {actionLoading ? 'Procesando...' : <><i className="bi bi-truck"></i> Despacho de Aduana Listo</>}
                          </button>
                        )}
                        {canEdit && (!isOperador || operation.estado_revision !== 'rejected') && operation.can_deliver && !isOperario && (
                          <button
                            onClick={() => handleAction('mark_delivered', '¿Marcar como remitada? Se asume que la logística ya fue gestionada.')}
                            disabled={actionLoading}
                            className="w-full sm:w-auto px-5 py-2.5 bg-purple-500 text-white hover:bg-purple-400 font-black rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                          >
                            {actionLoading ? 'Procesando...' : <><i className="bi bi-clipboard-check"></i> Emitir Remito</>}
                          </button>
                        )}
                        {canEdit && (!isOperador || operation.estado_revision !== 'rejected') && operation.estado === 'remitada' && !isOperario && isOwner && (
                          <button onClick={() => handleAction('close_operation', '¿Finalizar la orden por completo?')} disabled={actionLoading} className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-black rounded-xl shadow-lg transition-all text-center">
                            {actionLoading ? 'Procesando...' : 'Cerrar Operación'}
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        {canEdit && (!isOperador || operation.estado_revision !== 'rejected') && !isOperario && (operation.estado === 'recibida' || operation.estado === 'solicitada' || operation.estado === 'solicitud_servicio') && (
                          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                            <label className={`w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer ${uploading ? 'opacity-50' : ''}`}>
                              <i className="bi bi-cloud-arrow-up-fill"></i> Subir Custom
                              <input type="file" className="hidden" onChange={handleUploadCotizacionCustom} disabled={uploading} />
                            </label>
                            <button
                              onClick={() => setShowCotizacionWordModal(true)}
                              disabled={actionLoading}
                              className="w-full sm:w-auto px-5 py-2.5 bg-emerald-500 text-white hover:bg-emerald-400 font-black rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                            >
                              {actionLoading ? 'Procesando...' : <><i className="bi bi-envelope-paper"></i> Enviar Cotización</>}
                            </button>
                          </div>
                        )}
                        {canEdit && (!isOperador || operation.estado_revision !== 'rejected') && !isOperario && operation.estado === 'cotizacion_enviada' && (
                          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                            <button
                              onClick={handleVerCotizacion}
                              className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 font-black rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                            >
                              <i className="bi bi-file-earmark-pdf"></i> Ver Cotización
                            </button>
                            <button
                              onClick={() => handleAction('cliente_confirma_producto', '¿El cliente ha confirmado la cotización?')}
                              disabled={actionLoading}
                              className="w-full sm:w-auto px-5 py-2.5 bg-emerald-500 text-white hover:bg-emerald-400 font-black rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                            >
                              {actionLoading ? 'Procesando...' : <><i className="bi bi-check-circle"></i> Cliente Confirma</>}
                            </button>
                          </div>
                        )}
                        {canEdit && (!isOperador || operation.estado_revision !== 'rejected') && !isOperario && operation.estado === 'cotizado' && (
                          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                            <button
                              onClick={handleVerCotizacion}
                              className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 font-black rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                            >
                              <i className="bi bi-file-earmark-pdf"></i> Ver Cotización
                            </button>
                            <button
                              onClick={openPnaModal}
                              disabled={actionLoading}
                              className="w-full sm:w-auto px-4 py-2 border border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                            >
                              <i className="bi bi-file-earmark-pdf"></i> Generar Permiso PNA
                            </button>
                            <button
                              onClick={() => handleAction('tramitar_permisos_pna', '¿Marcar permisos PNA como gestionados?')}
                              disabled={actionLoading}
                              className="w-full sm:w-auto px-5 py-2.5 bg-blue-500 text-white hover:bg-blue-400 font-black rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                            >
                              {actionLoading ? 'Procesando...' : <><i className="bi bi-shield-check"></i> Permisos Tramitados</>}
                            </button>
                          </div>
                        )}
                        {canEdit && (!isOperador || operation.estado_revision !== 'rejected') && !isOperario && operation.estado === 'permisos_pna' && (
                          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                            <button
                              onClick={() => handleAction('iniciar_ejecucion_servicio', '¿Iniciar la ejecución del servicio a bordo?')}
                              disabled={actionLoading}
                              className="w-full sm:w-auto px-5 py-2.5 bg-indigo-500 text-white hover:bg-indigo-400 font-black rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                            >
                              {actionLoading ? 'Procesando...' : <><i className="bi bi-tools"></i> Iniciar Ejecución</>}
                            </button>
                          </div>
                        )}
                        {canEdit && (!isOperador || operation.estado_revision !== 'rejected') && !isOperario && operation.estado === 'en_ejecucion' && (
                          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                            <button
                              onClick={() => handleGeneratePdf('generate_reporte_servicio')}
                              disabled={actionLoading}
                              className="w-full sm:w-auto px-4 py-2 border border-purple-500 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                            >
                              <i className="bi bi-file-earmark-pdf"></i> Reporte de Servicio (Base)
                            </button>
                            <button
                              onClick={() => handleAction('finalizar_servicio_reporte', '¿Finalizar el servicio? Asegúrate de subir luego el reporte firmado por el cliente en Documentación.')}
                              disabled={actionLoading}
                              className="w-full sm:w-auto px-5 py-2.5 bg-purple-500 text-white hover:bg-purple-400 font-black rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                            >
                              {actionLoading ? 'Procesando...' : <><i className="bi bi-check-all"></i> Servicio Finalizado</>}
                            </button>
                          </div>
                        )}
                        {canEdit && (!isOperador || operation.estado_revision !== 'rejected') && operation.estado === 'reporte_firmado' && !isOperario && isOwner && (
                          <button onClick={() => handleAction('close_servicio', '¿Finalizar la operación de servicio por completo?')} disabled={actionLoading} className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-black rounded-xl shadow-lg transition-all text-center">
                            {actionLoading ? 'Procesando...' : 'Cerrar Operación'}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {isOperador && operation.estado_revision !== 'approved' && operation.estado_revision !== 'pending' && operation.estado !== 'entregada' && operation.estado !== 'cancelada' && (
                  <div className="border-t border-slate-700/60 pt-6">
                    <div className="bg-slate-700/20 p-4 sm:p-5 rounded-xl border border-slate-700/60 max-w-xl">
                      <h5 className="text-sm font-bold text-slate-200 mb-1 flex items-center gap-2">
                        <i className="bi bi-shield-check text-indigo-400 text-base"></i> Solicitar Revisión de la Operación
                      </h5>
                      <p className="text-xs text-slate-400 mb-4">
                        Si has completado tus tareas o necesitas que un administrador apruebe los cambios, envía una solicitud con un mensaje o reporte opcional.
                      </p>
                      <textarea
                        value={mensajeRevision}
                        onChange={(e) => setMensajeRevision(e.target.value)}
                        placeholder="Escribe un mensaje o reporte para el administrador (ej: packing list cargado)..."
                        className="w-full text-sm bg-slate-900 text-white border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg p-2.5 mb-3 placeholder-slate-500"
                        rows="3"
                      />
                      <button
                        onClick={handleRequestReview}
                        disabled={revisionActionLoading}
                        className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-md hover:shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
                      >
                        {revisionActionLoading ? (
                          <>
                            <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                            Enviando...
                          </>
                        ) : (
                          <><i className="bi bi-send-fill"></i> Enviar a Revisión</>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>

            <div className="lg:col-span-1 sticky top-24 self-start">
              <OperationTracker currentState={operation.status || operation.estado} operationType={operation.tipo_operacion} />
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Enviar a Aduanas */}
      {showAduanasEmailModal && (
        <ComposeEmailModal
          onClose={() => setShowAduanasEmailModal(false)}
          onSuccess={handleAduanasEmailSuccess}
          replyTo={emails.find(e => e.message_id && !e.message_id.startsWith('OUT-')) || null}
          user={user}
          defaultOperacionId={id}
          defaultRecipient={operation.agency_email || operation.client_email || ''}
          initialSubject={`Packing List - Buque: ${operation.ship_name} - Cliente: ${operation.client_name}`}
          initialBody={`Estimados,\n\nAdjuntamos el Packing List correspondiente a la operación en curso:\n\n• Cliente: ${operation.client_name}\n• Buque: ${operation.ship_name}\n• Puerto: ${operation.port_name}\n\nQuedamos a la espera de su confirmación para proceder.\n\nSaludos cordiales.`}
          initialAttachments={[aduanasEmailAttachment]}
        />
      )}

      {/* Modal de Enviar Cotización */}
      {showCotizacionEmailModal && (
        <ComposeEmailModal
          onClose={() => setShowCotizacionEmailModal(false)}
          onSuccess={handleCotizacionEmailSuccess}
          replyTo={emails.find(e => e.message_id && !e.message_id.startsWith('OUT-')) || null}
          user={user}
          defaultOperacionId={id}
          defaultRecipient={operation.client_email || operation.agency_email || ''}
          initialSubject={`[OP-${id}] Seguimiento y Cotizaciones - Buque: ${operation.ship_name}`}
          initialBody={cotizacionEmailAttachment 
            ? `Estimados,\n\nAdjuntamos la cotización correspondiente a lo solicitado para el buque ${operation.ship_name}.\n\n• Cliente: ${operation.client_name}\n• Buque: ${operation.ship_name}\n• Puerto: ${operation.port_name}\n\nQuedamos a su disposición por cualquier consulta y a la espera de su confirmación.\n\nSaludos cordiales.`
            : `Estimados,\n\nLes escribimos para consultar si han tenido oportunidad de revisar la cotización enviada anteriormente para el buque ${operation.ship_name}.\n\nQuedamos a su disposición para aclarar cualquier duda que pueda surgir o ajustar nuestra propuesta según lo requieran.\n\nAguardamos sus comentarios.\n\nSaludos cordiales.`
          }
          initialAttachments={cotizacionEmailAttachment ? [cotizacionEmailAttachment] : []}
        />
      )}

      {/* Modal de Packing List (vista previa HTML y Edición) */}
      {showPackingModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 overflow-y-auto flex justify-center items-start sm:items-center p-2 sm:p-4 animate-fadeIn" role="dialog" aria-modal="true">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[88vh] sm:max-h-[95vh] flex flex-col overflow-hidden my-auto border border-slate-200 dark:border-slate-700 animate-slideUp">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 shrink-0">
              <h3 className="text-lg leading-6 font-black text-slate-800 dark:text-white flex items-center gap-2">
                <i className="bi bi-file-earmark-text-fill text-indigo-500"></i> Packing List - #{packingData.operation_id} {isEditingPacking && '(Modo Edición)'}
              </h3>
              <button onClick={() => { setShowPackingModal(false); setIsEditingPacking(false); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 shadow-sm">
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto w-full custom-scrollbar bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100">
              <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Cliente</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{packingData.client}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Buque</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{packingData.ship}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Puerto</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{packingData.port}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">ETA</p>
                  <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">{new Date(packingData.eta).toLocaleString()}</p>
                </div>
              </div>
              <div className="overflow-hidden border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                  <thead className="bg-slate-50 dark:bg-slate-900/50">
                    <tr className="uppercase tracking-wider text-[10px] font-black text-slate-500 dark:text-slate-400">
                      <th className="px-4 py-3 text-left">Producto</th>
                      <th className="px-4 py-3 text-center">Cant.</th>
                      <th className="px-4 py-3 text-left">Pres.</th>
                      <th className="px-4 py-3 text-right">Peso Unit.</th>
                      <th className="px-4 py-3 text-right">Peso Total</th>
                      <th className="px-4 py-3 text-right">Precio Unit.</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      {isEditingPacking && <th className="px-4 py-3 text-center">Acción</th>}
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700">
                    {(isEditingPacking ? editPackingProducts : packingData.products).map((prod, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:bg-slate-900/20 dark:hover:bg-slate-700/50">
                        <td className="px-4 py-3 text-sm font-bold text-slate-800 dark:text-white whitespace-nowrap">{prod.name}</td>
                        <td className="px-4 py-3 text-sm text-center font-bold text-slate-600 dark:text-slate-300">
                          {isEditingPacking ? (
                            <input
                              type="number"
                              min="1"
                              value={prod.quantity}
                              onChange={(e) => handleUpdateEditRow(idx, 'quantity', e.target.value)}
                              className="w-20 text-center border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-800 dark:text-white px-1 py-0.5"
                            />
                          ) : (
                            prod.quantity
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">{prod.presentation}</td>
                        <td className="px-4 py-3 text-sm text-right text-slate-600 dark:text-slate-300 whitespace-nowrap">{prod.unit_weight} kg</td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-slate-800 dark:text-white whitespace-nowrap">{prod.total_weight?.toFixed(2) || '0.00'} kg</td>
                        <td className="px-4 py-3 text-sm text-right text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {isEditingPacking ? (
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={prod.unit_price}
                              onChange={(e) => handleUpdateEditRow(idx, 'unit_price', e.target.value)}
                              className="w-28 text-right border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-800 dark:text-white px-1 py-0.5"
                            />
                          ) : (
                            `$${prod.unit_price}`
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-black text-indigo-700 dark:text-indigo-400 whitespace-nowrap">${prod.subtotal?.toFixed(2) || '0.00'}</td>
                        {isEditingPacking && (
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveEditRow(idx)}
                              className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 dark:bg-red-900/20 dark:hover:bg-red-900/30 transition-colors"
                              title="Eliminar fila"
                            >
                              <i className="bi bi-trash-fill"></i>
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {isEditingPacking && (
                      <tr>
                        <td colSpan="8" className="px-4 py-4 bg-slate-50/50 dark:bg-slate-900/20">
                          <div className="max-w-md">
                            <AutocompleteCreate
                              label="Agregar Producto al Packing List"
                              endpoint="/inventario/products/?categoria=otros,insumos"
                              value=""
                              onSelect={handleAddProductToPacking}
                              createFields={[
                                { name: 'presentacion', label: 'Presentación', required: true },
                                { name: 'peso_kg', label: 'Peso unitario (kg)', type: 'number', required: true },
                              ]}
                              extraCreateData={{ categoria: 'otros' }}
                              nameField="nombre"
                              placeholder="Buscar producto para agregar..."
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                    <tr className="bg-indigo-50/50 dark:bg-indigo-950/40">
                      <td colSpan="4" className="px-4 py-4 text-right text-xs font-black text-indigo-400 dark:text-indigo-300 uppercase tracking-widest">Totales de Carga</td>
                      <td className="px-4 py-4 text-right text-sm font-black text-indigo-800 dark:text-indigo-200 whitespace-nowrap">
                        {(isEditingPacking ? editTotalWeight : packingData.total_weight)?.toFixed(2)} kg
                      </td>
                      <td></td>
                      <td className="px-4 py-4 text-right text-lg font-black text-indigo-700 dark:text-indigo-400 whitespace-nowrap">
                        ${(isEditingPacking ? editTotalPrice : packingData.total_price)?.toFixed(2)}
                      </td>
                      {isEditingPacking && <td></td>}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/50 px-4 py-4 border-t border-slate-200 dark:border-slate-700 sm:px-6 sm:flex sm:flex-row-reverse shrink-0 gap-2">
              {isEditingPacking ? (
                <>
                  <button type="button" className="w-full sm:w-auto px-6 py-2 bg-emerald-600 text-white font-bold text-sm rounded-xl hover:bg-emerald-700 transition-colors shadow-sm flex justify-center items-center gap-2" onClick={handleSavePacking} disabled={actionLoading}>
                    {actionLoading ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div> : <i className="bi bi-check-circle-fill"></i>}
                    Guardar Cambios
                  </button>
                  <button type="button" className="mt-3 sm:mt-0 w-full sm:w-auto px-6 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm border border-slate-300 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:bg-slate-900/20 dark:hover:bg-slate-700 transition-colors shadow-sm" onClick={() => setIsEditingPacking(false)}>
                    Cancelar
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="w-full sm:w-auto px-6 py-2 bg-indigo-600 text-white font-bold text-sm rounded-xl hover:bg-indigo-700 transition-colors shadow-sm flex justify-center items-center gap-2" onClick={() => window.print()}>
                    <i className="bi bi-printer-fill"></i> Imprimir Documento
                  </button>
                  {canEdit && (operation.status === 'pending' || operation.estado === 'solicitada' || operation.estado === 'armado_packing') && (
                    <button type="button" className="mt-3 sm:mt-0 w-full sm:w-auto px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm rounded-xl transition-colors shadow-sm flex justify-center items-center gap-2" onClick={handleStartEditPacking}>
                      <i className="bi bi-pencil-fill"></i> Editar Packing List
                    </button>
                  )}
                  <button type="button" className="mt-3 sm:mt-0 w-full sm:w-auto px-6 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm border border-slate-300 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:bg-slate-900/20 dark:hover:bg-slate-700 transition-colors shadow-sm flex justify-center items-center" onClick={() => setShowPackingModal(false)}>
                    Cerrar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal para generar Permiso PNA */}
      {showPnaModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 overflow-y-auto flex justify-center items-start sm:items-center p-2 sm:p-4 animate-fadeIn" role="dialog" aria-modal="true">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[88vh] sm:max-h-[95vh] flex flex-col overflow-hidden my-auto border border-slate-200 dark:border-slate-700 animate-slideUp">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 shrink-0">
              <h3 className="text-lg leading-6 font-black text-slate-800 dark:text-white flex items-center gap-2">
                <i className="bi bi-shield-check text-blue-500"></i> Generar Permiso PNA
              </h3>
              <button onClick={() => setShowPnaModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 shadow-sm">
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="p-4 sm:p-6 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100">
              <p className="text-sm mb-4 text-slate-600 dark:text-slate-300">
                Seleccione el tipo de permiso que desea generar para la Prefectura Naval Argentina.
              </p>

              <div className="space-y-4">
                <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${pnaType === 'frio' ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:bg-slate-900/20 dark:hover:bg-slate-700/50'}`}>
                  <input type="radio" name="pnaType" value="frio" checked={pnaType === 'frio'} onChange={() => setPnaType('frio')} className="mt-1" />
                  <div>
                    <h4 className="font-bold text-sm text-slate-800 dark:text-white">Trabajo en Frío</h4>
                    <p className="text-xs text-slate-500 mt-1">Tareas generales que no implican chispas, soldaduras o fuentes de calor.</p>
                  </div>
                </label>

                <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${pnaType === 'caliente' ? 'border-red-500 bg-red-50/50 dark:bg-red-900/20' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:bg-slate-900/20 dark:hover:bg-slate-700/50'}`}>
                  <input type="radio" name="pnaType" value="caliente" checked={pnaType === 'caliente'} onChange={() => setPnaType('caliente')} className="mt-1" />
                  <div>
                    <h4 className="font-bold text-sm text-slate-800 dark:text-white">Trabajo en Caliente</h4>
                    <p className="text-xs text-slate-500 mt-1">Tareas que implican fuego, soldaduras, corte de metales u otras fuentes de ignición.</p>
                  </div>
                </label>
              </div>

              <div className="mt-6">
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Texto del Permiso PNA (Opcional)</label>
                <textarea
                  value={pnaText}
                  onChange={(e) => setPnaText(e.target.value)}
                  placeholder="Escriba aquí si desea sobreescribir el texto predeterminado del permiso..."
                  rows="4"
                  className="w-full text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg p-3 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">Si deja esto en blanco, se usará el texto predeterminado.</p>
              </div>
            </div>
            <div className="px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 shrink-0">
              <button
                type="button"
                className="w-full inline-flex justify-center rounded-xl border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm transition-colors"
                onClick={handleGeneratePnaPdf}
              >
                Generar Documento
              </button>
              <button type="button" className="mt-3 sm:mt-0 w-full sm:w-auto px-6 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm border border-slate-300 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:bg-slate-900/20 dark:hover:bg-slate-700 transition-colors shadow-sm flex justify-center items-center" onClick={() => setShowPnaModal(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Modal para vista previa de Excel */}
      {showExcelModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 overflow-y-auto flex justify-center items-start sm:items-center p-2 sm:p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[88vh] sm:max-h-[95vh] flex flex-col overflow-hidden my-auto border border-slate-200 dark:border-slate-700 animate-slideUp">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 shrink-0">
              <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <i className="bi bi-file-earmark-spreadsheet-fill text-emerald-600"></i>
                Vista previa del Packing List (Excel)
              </h3>
              <button onClick={() => setShowExcelModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 shadow-sm">
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-white dark:bg-slate-900 p-4">
              <div dangerouslySetInnerHTML={{ __html: excelPreviewHtml }} className="excel-preview text-slate-800 dark:text-slate-100" />
            </div>
            <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3 shrink-0">
              <button onClick={() => setShowExcelModal(false)} className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium text-sm">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para vista previa de PDF / Imagen / Texto / Otros */}
      {previewFile && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 overflow-y-auto flex justify-center items-start sm:items-center p-2 sm:p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[88vh] sm:max-h-[95vh] flex flex-col overflow-hidden my-auto border border-slate-200 dark:border-slate-700 animate-slideUp">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 shrink-0">
              <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <i className="bi bi-file-earmark-text-fill text-indigo-500"></i>
                Vista previa: {previewFile.filename || 'Documento'}
              </h3>
              <button onClick={() => setPreviewFile(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 shadow-sm">
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-900 p-2 flex justify-center items-center">
              {previewFile.type === 'pdf' && (
                <iframe src={previewFile.url} className="w-full h-full min-h-[80vh] border-0 rounded-lg" title="Vista previa PDF" />
              )}
              {previewFile.type === 'image' && (
                <img src={previewFile.url} alt="Vista previa" className="max-w-full max-h-[85vh] object-contain shadow-lg rounded-lg" />
              )}
              {previewFile.type === 'text' && (
                <pre className="w-full p-4 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg overflow-auto text-sm font-mono whitespace-pre-wrap">
                  {previewFile.content}
                </pre>
              )}
              {previewFile.type === 'unknown' && (
                <div className="text-center p-8 bg-white dark:bg-slate-850 rounded-xl shadow-md">
                  <i className="bi bi-file-earmark-excel text-5xl text-amber-500 mb-3 block"></i>
                  <p className="text-slate-600 dark:text-slate-300">No se puede previsualizar este tipo de archivo.</p>
                  <a href={previewFile.url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold">
                    <i className="bi bi-download me-1"></i> Descargar archivo
                  </a>
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3 shrink-0">
              {previewFile.url && previewFile.type !== 'text' && (
                <a href={previewFile.url} download target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-100 dark:bg-slate-900/30 dark:hover:bg-slate-700 font-medium text-sm">
                  <i className="bi bi-download me-1"></i> Descargar
                </a>
              )}
              <button onClick={() => setPreviewFile(null)} className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium text-sm">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Barra flotante para descarga en ZIP (Glassmorphism premium) */}
      {(selectedDocs.length > 0 || selectedEmailAtts.length > 0) && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md shadow-2xl border border-slate-200/80 dark:border-slate-700 px-6 py-4 rounded-2xl flex items-center justify-between gap-6 w-full max-w-2xl animate-slideUpZip">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400">
              <i className="bi bi-file-zip text-2xl"></i>
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-800 dark:text-white">Selección Múltiple</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {selectedDocs.length + selectedEmailAtts.length} archivos seleccionados
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setSelectedDocs([]);
                setSelectedEmailAtts([]);
              }}
              className="px-4 py-2 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-50 dark:bg-slate-900/20 dark:hover:bg-slate-700/50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleDownloadZip}
              disabled={downloadingZip}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2"
            >
              {downloadingZip ? (
                <>
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                  Descargando...
                </>
              ) : (
                <>
                  <i className="bi bi-cloud-arrow-down-fill"></i>
                  Descargar (.zip)
                </>
              )}
            </button>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes slideUpZip {
          from { opacity: 0; transform: translate(-50%, 20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        .animate-slideUpZip { animation: slideUpZip 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 10px; }
        .excel-preview table { border-collapse: collapse; width: 100%; }
        .excel-preview th, .excel-preview td { border: 1px solid #ccc; padding: 8px; text-align: left; }
        .excel-preview th { background-color: #f2f2f2; font-weight: bold; }
        
        /* Dark Mode overrides for Excel previews */
        .dark .excel-preview th {
          background: #1e293b !important;
          background-color: #1e293b !important;
          color: #f1f5f9 !important;
          border-color: #334155 !important;
        }
        .dark .excel-preview td {
          background: #0f172a !important;
          background-color: #0f172a !important;
          color: #e2e8f0 !important;
          border-color: #334155 !important;
        }
        .dark .excel-preview tr {
          background: #0f172a !important;
          background-color: #0f172a !important;
          color: #e2e8f0 !important;
        }
        .dark .excel-preview table {
          background: #0f172a !important;
          background-color: #0f172a !important;
          color: #e2e8f0 !important;
          border-color: #334155 !important;
        }
        /* Override specifically generated inner cell elements */
        .dark .excel-preview td * {
          background: transparent !important;
          background-color: transparent !important;
          color: #e2e8f0 !important;
        }
        .dark .excel-preview th * {
          background: transparent !important;
          background-color: transparent !important;
          color: #f1f5f9 !important;
        }
        `,
      }} />
      <ToolsModal
        isOpen={isToolsModalOpen}
        onClose={() => setIsToolsModalOpen(false)}
        operation={operation}
        onSave={fetchOperation}
        onPreview={handlePreviewToolsPDF}
      />

      {/* Modal para Generar Cotización (Productos) */}
      {showCotizacionWordModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 overflow-y-auto flex justify-center items-start sm:items-center p-2 sm:p-4 animate-fadeIn" role="dialog" aria-modal="true">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[95vh] overflow-hidden border border-slate-200 dark:border-slate-700 transform transition-all">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800">
              <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <i className="bi bi-file-earmark-pdf-fill text-red-500"></i> Generar Cotización (PDF)
              </h3>
              <button onClick={() => setShowCotizacionWordModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors bg-white dark:bg-slate-700 shadow-sm p-1.5 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:bg-slate-900/20">
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            
            <div className="p-6 bg-slate-50 dark:bg-slate-900/40 space-y-6 overflow-y-auto flex-1">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Personaliza las condiciones comerciales que se incluirán en el documento.
              </p>
              
              {operation?.tipo_operacion === 'servicios' && (
                <div className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm mb-6 space-y-4">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 pb-2">Campos Arbitrarios de Servicio</h4>
                  
                  <div className="mb-2">
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Título de la sección (Tema)</label>
                      <input type="text" className="w-full text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500" value={damageSubject} onChange={(e) => setDamageSubject(e.target.value)} />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <div className="w-full text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">{damageLocationTitle}</div>
                      <input type="text" className="w-full text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500" value={damageLocation} onChange={(e) => setDamageLocation(e.target.value)} placeholder="Ej: Port Side..." />
                    </div>
                    <div>
                      <div className="w-full text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">{damageFramesTitle}</div>
                      <input type="text" className="w-full text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500" value={damageFrames} onChange={(e) => setDamageFrames(e.target.value)} placeholder="Ej: 45-50" />
                    </div>
                    <div>
                      <div className="w-full text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">{damageAreaTitle}</div>
                      <input type="text" className="w-full text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500" value={damageArea} onChange={(e) => setDamageArea(e.target.value)} placeholder="Ej: 2000 x 1500" />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-2">Ítems Arbitrarios (Aparecen en la tabla principal)</label>
                    {customItems.map((item, index) => (
                      <div key={index} className="flex gap-2 mb-2 items-center">
                        <input 
                          type="text" 
                          placeholder="Descripción" 
                          className="flex-1 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500"
                          value={item.nombre}
                          onChange={(e) => {
                            const newItems = [...customItems];
                            newItems[index].nombre = e.target.value;
                            setCustomItems(newItems);
                          }}
                        />
                        <input 
                          type="number" 
                          placeholder="Cant." 
                          className="w-20 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500"
                          value={item.cantidad}
                          onChange={(e) => {
                            const newItems = [...customItems];
                            newItems[index].cantidad = e.target.value;
                            setCustomItems(newItems);
                          }}
                        />
                        <input 
                          type="number" 
                          placeholder="USD Unit." 
                          className="w-24 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500"
                          value={item.precio_unitario}
                          onChange={(e) => {
                            const newItems = [...customItems];
                            newItems[index].precio_unitario = e.target.value;
                            setCustomItems(newItems);
                          }}
                        />
                        <button 
                          onClick={() => {
                            const newItems = customItems.filter((_, i) => i !== index);
                            setCustomItems(newItems);
                          }}
                          className="text-red-500 hover:text-red-700 p-2 shrink-0"
                          title="Eliminar ítem"
                        >
                          <i className="bi bi-trash-fill"></i>
                        </button>
                      </div>
                    ))}
                    <div className="flex items-center gap-4 mt-2">
                      <button 
                        onClick={() => setCustomItems([...customItems, { nombre: '', cantidad: 1, precio_unitario: '' }])}
                        className="text-sm text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                      >
                        <i className="bi bi-plus-circle-fill"></i> Agregar ítem manual
                      </button>
                      <label className="text-sm text-emerald-600 hover:text-emerald-800 font-semibold flex items-center gap-1 cursor-pointer">
                        <i className="bi bi-file-earmark-excel-fill"></i> Carga Masiva (.xlsx)
                        <input 
                          type="file" 
                          accept=".xlsx, .xls" 
                          className="hidden" 
                          onChange={handleCotizacionExcelUpload} 
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Language Selector */}
              <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm mb-6">
                <label className="block text-xs font-black text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">Idioma del Documento / Document Language</label>
                <div className="flex gap-4">
                  <label className={`relative flex items-center p-3 rounded-lg border-2 cursor-pointer transition-all flex-1 ${cotizacionLang === 'en' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:bg-slate-900/20 dark:hover:bg-slate-700/50'}`}>
                    <input type="radio" name="cotizacionLang" value="en" checked={cotizacionLang === 'en'} onChange={(e) => setCotizacionLang(e.target.value)} className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500 mr-3" />
                    <div>
                      <span className={`block text-sm font-bold ${cotizacionLang === 'en' ? 'text-blue-900 dark:text-blue-100' : 'text-slate-700 dark:text-slate-300'}`}>Inglés (English)</span>
                    </div>
                  </label>
                  <label className={`relative flex items-center p-3 rounded-lg border-2 cursor-pointer transition-all flex-1 ${cotizacionLang === 'es' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:bg-slate-900/20 dark:hover:bg-slate-700/50'}`}>
                    <input type="radio" name="cotizacionLang" value="es" checked={cotizacionLang === 'es'} onChange={(e) => setCotizacionLang(e.target.value)} className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500 mr-3" />
                    <div>
                      <span className={`block text-sm font-bold ${cotizacionLang === 'es' ? 'text-blue-900 dark:text-blue-100' : 'text-slate-700 dark:text-slate-300'}`}>Español (Spanish)</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Template Selector */}
              <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm mb-6">
                <label className="block text-xs font-black text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">Diseño de Plantilla</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className={`relative flex items-center p-3 rounded-lg border-2 cursor-pointer transition-all ${cotizacionTemplate === 'eva' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:bg-slate-900/20 dark:hover:bg-slate-700/50'}`}>
                    <input type="radio" name="cotizacionTemplate" value="eva" checked={cotizacionTemplate === 'eva'} onChange={(e) => setCotizacionTemplate(e.target.value)} className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500 mr-3" />
                    <div>
                      <span className={`block text-sm font-bold ${cotizacionTemplate === 'eva' ? 'text-indigo-900 dark:text-indigo-100' : 'text-slate-700 dark:text-slate-300'}`}>Diseño normal</span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">Diseño minimalista con tabla agrupada y líneas finas.</span>
                    </div>
                  </label>
                  <label className={`relative flex items-center p-3 rounded-lg border-2 cursor-pointer transition-all ${cotizacionTemplate === 'proios' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:bg-slate-900/20 dark:hover:bg-slate-700/50'}`}>
                    <input type="radio" name="cotizacionTemplate" value="proios" checked={cotizacionTemplate === 'proios'} onChange={(e) => setCotizacionTemplate(e.target.value)} className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500 mr-3" />
                    <div>
                      <span className={`block text-sm font-bold ${cotizacionTemplate === 'proios' ? 'text-blue-900 dark:text-blue-100' : 'text-slate-700 dark:text-slate-300'}`}>Próximamente (pruebas)</span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">Diseño Premium B2B (Clásica).</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Columna Izquierda: Términos Comerciales */}
                <div className="lg:col-span-4">
                  <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm h-full flex flex-col">
                    <h4 className="text-xs font-black text-slate-900 dark:text-white mb-5 uppercase tracking-wider flex items-center gap-2">
                      <i className="bi bi-card-checklist text-blue-500 text-base"></i> Términos Comerciales
                    </h4>
                    
                    <div className="space-y-5 flex-1">
                      {/* Offer Validity */}
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">Offer Validity</label>
                        {!offerValidityIsManual ? (
                          <select
                            className="w-full rounded-lg border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2.5 border transition-colors"
                            value={offerValidity}
                            onChange={(e) => {
                              if (e.target.value === 'manual') {
                                setOfferValidityIsManual(true);
                                setOfferValidity('');
                              } else {
                                setOfferValidity(e.target.value);
                              }
                            }}
                          >
                            <option value="15 days">15 days</option>
                            <option value="30 days">30 days</option>
                            <option value="manual">Otro (Manual)...</option>
                          </select>
                        ) : (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              className={`w-full rounded-lg border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2.5 border transition-colors ${offerValidity.length > 35 ? 'border-orange-500' : ''}`}
                              value={offerValidity}
                              onChange={(e) => setOfferValidity(e.target.value)}
                              placeholder="Escriba..."
                              autoFocus
                            />
                            <button onClick={() => { setOfferValidityIsManual(false); setOfferValidity('15 days'); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors p-2" title="Volver a seleccionar"><i className="bi bi-x-circle-fill"></i></button>
                          </div>
                        )}
                        {offerValidityIsManual && offerValidity.length > 35 && <p className="text-xs text-orange-500 mt-1 font-semibold"><i className="bi bi-exclamation-triangle-fill"></i> Texto largo.</p>}
                      </div>

                      {/* Payment Terms */}
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">Payment Terms</label>
                        {!paymentTermsIsManual ? (
                          <select
                            className="w-full rounded-lg border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2.5 border transition-colors"
                            value={paymentTerms}
                            onChange={(e) => {
                              if (e.target.value === 'manual') {
                                setPaymentTermsIsManual(true);
                                setPaymentTerms('');
                              } else {
                                setPaymentTerms(e.target.value);
                              }
                            }}
                          >
                            <option value="30 days from invoice date">30 days from invoice date</option>
                            <option value="In advance">In advance</option>
                            <option value="On delivery">On delivery</option>
                            <option value="manual">Otro (Manual)...</option>
                          </select>
                        ) : (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              className={`w-full rounded-lg border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2.5 border transition-colors ${paymentTerms.length > 35 ? 'border-orange-500' : ''}`}
                              value={paymentTerms}
                              onChange={(e) => setPaymentTerms(e.target.value)}
                              placeholder="Escriba..."
                              autoFocus
                            />
                            <button onClick={() => { setPaymentTermsIsManual(false); setPaymentTerms('30 days from invoice date'); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors p-2" title="Volver a seleccionar"><i className="bi bi-x-circle-fill"></i></button>
                          </div>
                        )}
                      </div>

                      {/* Delivery Time */}
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">Delivery Time</label>
                        <div className="flex gap-2 items-center bg-slate-50 dark:bg-slate-700/50 p-1 rounded-lg border border-slate-200 dark:border-slate-600 focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all">
                          <input
                            type="number"
                            min="1"
                            className="w-full bg-transparent border-none text-slate-900 dark:text-white focus:ring-0 text-sm p-1.5"
                            value={deliveryTime}
                            onChange={(e) => setDeliveryTime(e.target.value)}
                            placeholder="5"
                          />
                          <span className="text-sm font-semibold text-slate-400 dark:text-slate-500 pr-3">business days</span>
                        </div>
                      </div>

                      {/* VAT Toggle */}
                      <div className="pt-2 mt-auto">
                        <div className="flex flex-col gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Taxes (VAT)</p>
                              <p className="text-xs text-slate-500">Aplicar impuestos</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setIncludeVat(!includeVat)}
                              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${includeVat ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                            >
                              <span aria-hidden="true" className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white dark:bg-slate-800 shadow ring-0 transition duration-200 ease-in-out ${includeVat ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                          </div>
                          {includeVat && (
                            <div className="flex items-center justify-between mt-1 pt-2 border-t border-slate-200 dark:border-slate-700">
                              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Porcentaje VAT:</span>
                              <div className="flex items-center relative w-24">
                                <input
                                  type="number"
                                  className="w-full text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md py-1 px-2 pr-6 focus:ring-blue-500 focus:border-blue-500 text-right"
                                  value={vatPercentage}
                                  onChange={(e) => setVatPercentage(e.target.value)}
                                />
                                <span className="absolute right-2 text-slate-400 text-sm">%</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  </div>
                </div>

                {/* Columna Derecha: Contenido del Documento */}
                <div className="lg:col-span-8">
                  <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm h-full flex flex-col">
                    <h4 className="text-xs font-black text-slate-900 dark:text-white mb-5 uppercase tracking-wider flex items-center gap-2">
                      <i className="bi bi-text-paragraph text-purple-500 text-base"></i> Contenido del Documento
                    </h4>
                    
                    <div className="space-y-5 flex-1">
                      {/* Attention To */}
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">Attention To (Attn:)</label>
                        <input
                          type="text"
                          className="w-full rounded-lg border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white shadow-sm focus:border-purple-500 focus:ring-purple-500 text-sm p-2.5 border transition-colors"
                          value={cotizacionAttn}
                          onChange={(e) => setCotizacionAttn(e.target.value)}
                          placeholder="e.g. Operations / Technical Department"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Scope Includes */}
                        <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">Scope Includes</label>
                          <textarea
                            rows={3}
                            className="w-full rounded-lg border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white shadow-sm focus:border-purple-500 focus:ring-purple-500 text-sm p-2.5 border transition-colors resize-none"
                            value={scopeIncludes}
                            onChange={(e) => setScopeIncludes(e.target.value)}
                            placeholder="[detail what the supply / service comprises]"
                          />
                        </div>

                        {/* Scope Excludes */}
                        <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">Scope Excludes</label>
                          <textarea
                            rows={3}
                            className="w-full rounded-lg border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white shadow-sm focus:border-purple-500 focus:ring-purple-500 text-sm p-2.5 border transition-colors resize-none"
                            value={scopeExcludes}
                            onChange={(e) => setScopeExcludes(e.target.value)}
                            placeholder="[freight, customs clearance, additional labour, parts not listed, etc.]"
                          />
                        </div>
                      </div>

                      {/* Notes */}
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">Notes <span className="normal-case font-normal">(Optional)</span></label>
                        <textarea
                          rows={2}
                          className="w-full rounded-lg border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white shadow-sm focus:border-purple-500 focus:ring-purple-500 text-sm p-2.5 border transition-colors resize-none"
                          value={cotizacionNotes}
                          onChange={(e) => setCotizacionNotes(e.target.value)}
                          placeholder="[Other relevant note]"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
              </div>
            </div>
            
            <div className="px-6 py-4 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3 rounded-b-2xl">
              <button
                onClick={() => setShowCotizacionWordModal(false)}
                className="px-5 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:bg-slate-900/20 dark:hover:bg-slate-600 transition-colors shadow-sm"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  handleDownloadCotizacionWord();
                  setShowCotizacionWordModal(false);
                }}
                disabled={actionLoading}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 transform active:scale-95"
              >
                {actionLoading ? (
                  <><i className="bi bi-arrow-repeat animate-spin"></i> Generando...</>
                ) : (
                  <><i className="bi bi-file-earmark-pdf-fill"></i> Descargar PDF</>
                )}
              </button>
              <button
                onClick={() => {
                  handleSendCotizacionEmail();
                  setShowCotizacionWordModal(false);
                }}
                disabled={actionLoading}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 transform active:scale-95"
              >
                {actionLoading ? (
                  <><i className="bi bi-arrow-repeat animate-spin"></i> Enviando...</>
                ) : (
                  <><i className="bi bi-envelope-check-fill"></i> Enviar por Correo</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Rechazo Cotización */}
      {showRechazoModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
            <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-sm transition-opacity" onClick={() => setShowRechazoModal(false)}></div>

            <div className="relative transform overflow-hidden rounded-2xl bg-white dark:bg-slate-800 text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-lg border border-slate-200 dark:border-slate-700">
              <div className="bg-red-500 px-6 py-4 flex items-center justify-between">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <i className="bi bi-x-circle-fill"></i> Rechazar Cotización
                </h3>
                <button onClick={() => setShowRechazoModal(false)} className="text-white hover:text-red-200 transition-colors">
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>

              <div className="px-6 py-6 bg-white dark:bg-slate-800 space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Por favor ingresa el motivo por el cual la cotización fue rechazada. La operación pasará al estado de Pausada para que el Owner pueda revisarla.
                </p>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Motivo del rechazo</label>
                  <textarea
                    rows={4}
                    value={rechazoMotivo}
                    onChange={(e) => setRechazoMotivo(e.target.value)}
                    className="w-full text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg p-3 focus:ring-red-500 focus:border-red-500 dark:text-white"
                    placeholder="Ej: El cliente consideró que el precio es muy alto..."
                  ></textarea>
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3 rounded-b-2xl">
                <button
                  onClick={() => setShowRechazoModal(false)}
                  className="px-5 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:bg-slate-900/20 dark:hover:bg-slate-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    if (!rechazoMotivo.trim()) {
                      showToast('Debes ingresar un motivo', 'error');
                      return;
                    }
                    handleRechazarCotizacion(rechazoMotivo);
                    setShowRechazoModal(false);
                  }}
                  disabled={actionLoading}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg shadow transition-colors flex items-center gap-2"
                >
                  {actionLoading ? 'Procesando...' : <><i className="bi bi-exclamation-triangle-fill"></i> Confirmar Rechazo</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}