import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from '../api/axios';
import { useAuth } from '../context/AuthContext';
import OperarioActionPanel from './OperarioActionPanel';
import OperationTracker from './OperationTracker';
import ProductSearchCards from './ProductSearchCards';
import OperationEmails from './OperationEmails';
import LogoSpinner from './LogoSpinner';
import OperationDocuments from './OperationDocuments';
import AutocompleteCreate from './AutocompleteCreate';
import * as XLSX from 'xlsx';

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
  const isOperador = user?.role === 'OPERADOR';

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
      setEmails(res.data);
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

  const openPreview = (url) => {
    if (!url) return;
    if (url.match(/\.xlsx?$/i)) {
      previewExcelFile(url);
      return;
    }
    let type = 'pdf';
    if (url.match(/\.(jpe?g|png|gif|bmp|webp)$/i)) type = 'image';
    else if (url.match(/\.pdf$/i)) type = 'pdf';
    else type = 'unknown';
    setPreviewFile({ url, type });
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
      solicitada: 'bg-yellow-100 text-yellow-800',
      armado_packing: 'bg-blue-100 text-blue-800',
      en_aduana: 'bg-orange-100 text-orange-800',
      lista_para_envio: 'bg-green-100 text-green-800',
      remitada: 'bg-indigo-100 text-indigo-800',
      entregada: 'bg-gray-100 text-gray-800',
      cancelada: 'bg-red-100 text-red-800',
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
      <span className={`px-3 py-1.5 inline-flex text-xs leading-5 font-black uppercase tracking-wider rounded-lg ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
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

  if (loading) return <div className="flex justify-center mt-20"><LogoSpinner size="w-16 h-16" /></div>;
  if (error) return <div className="text-center text-red-600 mt-10 font-bold bg-red-50 p-4 rounded-xl max-w-lg mx-auto">{error}</div>;
  if (!operation) return <div className="text-center mt-10">No se encontró la operación</div>;

  const shipFlag = operation.ship_flag || (operation.ship ? operation.ship.flag : '');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
      <nav className="bg-white dark:bg-slate-800 shadow-sm sticky top-0 z-40 border-b border-transparent dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/')} className="text-slate-400 hover:text-indigo-600 transition-colors p-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30">
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
                    <button onClick={() => setEditingName(true)} className="text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      <i className="bi bi-pencil-square"></i>
                    </button>
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
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-400 hidden sm:block">Hola, {user?.username}</span>
              <button onClick={logout} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors" title="Cerrar sesión">
                <i className="bi bi-box-arrow-right text-lg"></i>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="py-8">
        {toastMessage && (
          <div className={`fixed top-20 right-4 z-50 px-4 py-3 rounded-xl shadow-lg border flex items-center gap-3 animate-fadeIn ${toastMessage.type === 'error' ? 'bg-red-50 text-red-800 border-red-200' :
            toastMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
              'bg-blue-50 text-blue-800 border-blue-200'
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
                  <div className="mt-2 p-2 bg-white/60 rounded text-amber-900 text-xs shadow-sm italic">
                    "{operation.mensaje_revision}"
                  </div>
                )}
              </div>
            </div>
          )}

          {operation.estado_revision === 'rejected' && isOperador && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl shadow-sm flex items-start gap-3">
              <i className="bi bi-exclamation-octagon-fill text-red-500 text-xl mt-0.5"></i>
              <div>
                <h4 className="text-red-800 font-bold">Se requieren correcciones</h4>
                <p className="text-red-700 text-sm">El administrador ha rechazado tu solicitud previa.</p>
                {operation.mensaje_revision && (
                  <div className="mt-2 p-2 bg-white/60 rounded text-red-900 text-xs shadow-sm italic">
                    "{operation.mensaje_revision}"
                  </div>
                )}
              </div>
            </div>
          )}

          {operation.estado_revision === 'approved' && isOperador && (
            <div className="mb-6 bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-r-xl shadow-sm flex items-start gap-3">
              <i className="bi bi-shield-check text-emerald-500 text-xl mt-0.5"></i>
              <div>
                <h4 className="text-emerald-800 font-bold">Revisión Aprobada</h4>
                <p className="text-emerald-700 text-sm">El administrador dio el OK. Ahora puedes continuar la operación al siguiente nivel.</p>
                {operation.mensaje_revision && (
                  <div className="mt-2 p-2 bg-white/60 rounded text-emerald-900 text-xs shadow-sm italic">
                    "{operation.mensaje_revision}"
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

            <div className="lg:col-span-2 space-y-6">

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
                    <div className="bg-slate-800 px-4 py-4 sm:px-6 text-white">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest flex items-center gap-2">
                        <i className="bi bi-people-fill"></i> Personal de Misión Asignado
                      </p>
                      <div className="flex gap-4 text-xs">
                        <span className="bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-600 font-bold">
                          Operadores (Oficina): {operation.operadores_id?.length || 0}
                        </span>
                        <span className="bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-600 font-bold">
                          Operarios (Planta): {operation.operarios_id?.length || 0}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 shadow-sm sm:rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                {!isOperario ? (
                  <>
                    <div className="px-4 py-5 sm:px-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg leading-6 font-black text-slate-900 dark:text-white flex items-center gap-2">
                          <i className="bi bi-box-seam text-indigo-500"></i> Detalle de Carga
                        </h3>
                        {(operation.status === 'pending' || operation.estado === 'solicitada' || operation.estado === 'armado_packing') && (
                          <button onClick={checkStock} disabled={checkingStock} className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 border border-indigo-100 bg-white">
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
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black bg-emerald-50 text-emerald-600 border border-emerald-200 uppercase">
                                      <i className="bi bi-check-circle-fill"></i> OK {prod.controlar_stock !== false ? `(${prod.stock_actual?.toFixed(0)})` : '(BAJO PEDIDO)'}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black bg-red-50 text-red-600 border border-red-200 uppercase">
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
                      <div className="m-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                        <i className="bi bi-exclamation-triangle-fill text-red-500 text-lg mt-0.5"></i>
                        <div>
                          <h4 className="text-sm font-bold text-red-800">No se puede avanzar: Stock insuficiente</h4>
                          <ul className="mt-2 text-xs font-medium text-red-700 space-y-1">
                            {stockVerification.errores?.map((err, idx) => (
                              <li key={idx}>• {err.nombre}: Piden {err.necesario}, pero hay {err.disponible}.</li>
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
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-black bg-emerald-50 text-emerald-600 border border-emerald-200 uppercase">
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

              <div className="bg-white dark:bg-slate-800 shadow-sm sm:rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
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

              <div className="bg-white dark:bg-slate-800 shadow-sm sm:rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="px-4 py-5 sm:px-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
                  <h3 className="text-lg leading-6 font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <i className="bi bi-folder-fill text-indigo-500"></i> Documentación
                  </h3>
                </div>
                <div className="p-4 sm:p-6 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-700/50 shadow-sm hover:shadow-md transition-shadow gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-white">Packing List</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Listado detallado de mercadería para aduana y remito.</p>
                      {operation.packing_list_file && (
                        <button
                          onClick={() => openPreview(operation.packing_list_file)}
                          className="inline-flex mt-2 text-indigo-600 hover:text-indigo-800 text-xs font-bold items-center gap-1 bg-indigo-50 px-2 py-1 rounded"
                        >
                          <i className="bi bi-eye-fill"></i> Ver Documento
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap sm:flex-nowrap gap-2 shrink-0 w-full sm:w-auto">
                      <button
                        onClick={handleOpenPackingModal}
                        className="flex-1 sm:flex-none justify-center px-3 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
                      >
                        <i className="bi bi-pencil-square"></i> Ver/Editar (HTML)
                      </button>
                      <button
                        onClick={previewPackingListExcel}
                        className="flex-1 sm:flex-none justify-center px-3 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
                      >
                        <i className="bi bi-eye-fill"></i> Vista Previa
                      </button>
                      <button
                        onClick={downloadPackingListExcel}
                        className="flex-1 sm:flex-none justify-center px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
                      >
                        <i className="bi bi-file-earmark-spreadsheet"></i> Exportar
                      </button>
                      <label className={`flex-1 sm:flex-none justify-center cursor-pointer px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-indigo-600 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 shadow-sm ${uploading || (isOperador && operation.estado_revision === 'rejected') ? 'opacity-50 pointer-events-none' : ''}`}>
                        <i className="bi bi-cloud-arrow-up-fill"></i> Subir
                        <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'upload_packing', '¿Subir packing list?')} disabled={uploading || (isOperador && operation.estado_revision === 'rejected')} />
                      </label>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-700/50 shadow-sm hover:shadow-md transition-shadow gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-white">Remito Firmado</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Constancia de entrega sellada por la tripulación.</p>
                      {operation.remito_file && (
                        <button
                          onClick={() => openPreview(operation.remito_file)}
                          className="inline-flex mt-2 text-indigo-600 hover:text-indigo-800 text-xs font-bold items-center gap-1 bg-indigo-50 px-2 py-1 rounded"
                        >
                          <i className="bi bi-eye-fill"></i> Ver Documento
                        </button>
                      )}
                    </div>
                    <label className={`w-full sm:w-auto justify-center cursor-pointer px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-indigo-600 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 shadow-sm shrink-0 ${uploading || (isOperador && operation.estado_revision === 'rejected') ? 'opacity-50 pointer-events-none' : ''}`}>
                      <i className="bi bi-cloud-arrow-up-fill"></i> Subir Remito
                      <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'upload_remito', '¿Subir remito firmado?')} disabled={uploading || (isOperador && operation.estado_revision === 'rejected')} />
                    </label>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-700/50 shadow-sm hover:shadow-md transition-shadow gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-white">Rancho / Permiso Aduanero</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Autorización oficial de embarque de provisiones.</p>
                      {operation.rancho_file && (
                        <button
                          onClick={() => openPreview(operation.rancho_file)}
                          className="inline-flex mt-2 text-indigo-600 hover:text-indigo-800 text-xs font-bold items-center gap-1 bg-indigo-50 px-2 py-1 rounded"
                        >
                          <i className="bi bi-eye-fill"></i> Ver Documento
                        </button>
                      )}
                    </div>
                    <label className={`w-full sm:w-auto justify-center cursor-pointer px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-indigo-600 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 shadow-sm shrink-0 ${uploading || (isOperador && operation.estado_revision === 'rejected') ? 'opacity-50 pointer-events-none' : ''}`}>
                      <i className="bi bi-cloud-arrow-up-fill"></i> Subir Rancho
                      <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'upload_rancho', '¿Subir documentación aduanera (rancho)?')} disabled={uploading || (isOperador && operation.estado_revision === 'rejected')} />
                    </label>
                  </div>
                </div>
              </div>

              {/* DOCUMENTOS ADICIONALES (NUEVO) */}
              <OperationDocuments
                operacionId={operation.id}
                documentos={documentos}
                onDocumentChange={refreshDocuments}
                openPreview={openPreview}
                selectedDocs={selectedDocs}
                toggleSelectDoc={toggleSelectDoc}
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
                        <div key={adj.id} className="flex flex-col justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm gap-3">
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
                              onClick={() => openPreview(adj.file)}
                              className="flex-1 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 border border-indigo-100 dark:border-indigo-800 transition-colors"
                            >
                              <i className="bi bi-eye-fill"></i> Ver
                            </button>
                            <a
                              href={adj.file}
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

              <div className="bg-slate-800 shadow-lg sm:rounded-2xl overflow-hidden p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
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
                  {isOwner && (
                    <button onClick={() => navigate(`/operations/${id}/edit`)} className="w-full sm:w-auto px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                      <i className="bi bi-pencil-fill"></i> Editar Info
                    </button>
                  )}

                  {isOperador && operation.estado_revision !== 'approved' && operation.estado_revision !== 'pending' && operation.estado !== 'entregada' && operation.estado !== 'cancelada' && (
                    <div className="w-full bg-slate-700/50 p-4 rounded-xl border border-slate-600 mt-2 sm:mt-0 sm:max-w-sm sm:ml-auto">
                      <h5 className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-2"><i className="bi bi-shield-check"></i> Solicitar Revisión</h5>
                      <textarea
                        value={mensajeRevision}
                        onChange={(e) => setMensajeRevision(e.target.value)}
                        placeholder="Nota o reporte para el administrador..."
                        className="w-full text-sm bg-slate-800 text-white border-slate-600 rounded-lg p-2 focus:ring-indigo-500 focus:border-indigo-500 mb-2"
                        rows="2"
                      />
                      <button
                        onClick={handleRequestReview}
                        disabled={revisionActionLoading}
                        className="w-full px-5 py-2.5 text-sm font-black rounded-lg shadow-lg bg-indigo-500 text-white hover:bg-indigo-400 transition-all font-bold"
                      >
                        {revisionActionLoading ? 'Enviando...' : 'Enviar a Revisión'}
                      </button>
                    </div>
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

                  {(!isOperador || operation.estado_revision !== 'rejected') && operation.can_confirm && !isOperario && (
                    <button
                      onClick={() => handleAction('confirm_operation', '¿Confirmar etapa de Preparación y pasar al estado de Suministros (Armado de Packing List)?')}
                      disabled={actionLoading}
                      className="w-full sm:w-auto px-5 py-2.5 bg-emerald-500 text-white hover:bg-emerald-400 font-black rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                      {actionLoading ? 'Procesando...' : <><i className="bi bi-box-seam"></i> Armar Packing List</>}
                    </button>
                  )}
                  {(!isOperador || operation.estado_revision !== 'rejected') && operation.can_send_to_customs && !isOperario && (
                    <button
                      onClick={() => handleAction('start_coordination', '¿Enviar Packing List a Aduanas? Esto consumirá el stock del inventario.')}
                      disabled={actionLoading || (stockVerification && !stockVerification.todo_suficiente)}
                      className={`w-full sm:w-auto px-5 py-2.5 text-sm font-black rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 ${(stockVerification && !stockVerification.todo_suficiente)
                        ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                        : 'bg-indigo-500 text-white hover:bg-indigo-400 hover:shadow-indigo-500/30'
                        }`}
                    >
                      {actionLoading ? 'Procesando...' : <><i className="bi bi-building-check"></i> Enviar a Aduanas</>}
                    </button>
                  )}
                  {(!isOperador || operation.estado_revision !== 'rejected') && operation.can_coordinate && !isOperario && (
                    <button
                      onClick={() => handleAction('finalize_production', '¿Aduanas aprobó el despacho (Rancho)? Pasar a lista para envío.')}
                      disabled={actionLoading}
                      className="w-full sm:w-auto px-5 py-2.5 bg-amber-500 text-white hover:bg-amber-400 font-black rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                      {actionLoading ? 'Procesando...' : <><i className="bi bi-truck"></i> Despacho de Aduana Listo</>}
                    </button>
                  )}
                  {(!isOperador || operation.estado_revision !== 'rejected') && operation.can_deliver && !isOperario && (
                    <button
                      onClick={() => handleAction('mark_delivered', '¿Marcar como remitada? Se asume que la logística ya fue gestionada.')}
                      disabled={actionLoading}
                      className="w-full sm:w-auto px-5 py-2.5 bg-purple-500 text-white hover:bg-purple-400 font-black rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                      {actionLoading ? 'Procesando...' : <><i className="bi bi-clipboard-check"></i> Emitir Remito</>}
                    </button>
                  )}
                  {(!isOperador || operation.estado_revision !== 'rejected') && operation.estado === 'remitada' && !isOperario && (
                    <button onClick={() => handleAction('close_operation', '¿Finalizar la orden por completo?')} disabled={actionLoading} className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-black rounded-xl shadow-lg transition-all text-center">
                      {actionLoading ? 'Procesando...' : 'Cerrar Operación'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-1 sticky top-24 self-start">
              <OperationTracker currentState={operation.status || operation.estado} />
            </div>
          </div>
        </div>
      </div>

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
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
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
                              className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
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
                  <button type="button" className="mt-3 sm:mt-0 w-full sm:w-auto px-6 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm border border-slate-300 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm" onClick={() => setIsEditingPacking(false)}>
                    Cancelar
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="w-full sm:w-auto px-6 py-2 bg-indigo-600 text-white font-bold text-sm rounded-xl hover:bg-indigo-700 transition-colors shadow-sm flex justify-center items-center gap-2" onClick={() => window.print()}>
                    <i className="bi bi-printer-fill"></i> Imprimir Documento
                  </button>
                  {!isOperario && (operation.status === 'pending' || operation.estado === 'solicitada' || operation.estado === 'armado_packing') && (
                    <button type="button" className="mt-3 sm:mt-0 w-full sm:w-auto px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm rounded-xl transition-colors shadow-sm flex justify-center items-center gap-2" onClick={handleStartEditPacking}>
                      <i className="bi bi-pencil-fill"></i> Editar Packing List
                    </button>
                  )}
                  <button type="button" className="mt-3 sm:mt-0 w-full sm:w-auto px-6 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm border border-slate-300 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm flex justify-center items-center" onClick={() => setShowPackingModal(false)}>
                    Cerrar
                  </button>
                </>
              )}
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

      {/* Modal para vista previa de PDF / Imagen / Otros */}
      {previewFile && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 overflow-y-auto flex justify-center items-start sm:items-center p-2 sm:p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[88vh] sm:max-h-[95vh] flex flex-col overflow-hidden my-auto border border-slate-200 dark:border-slate-700 animate-slideUp">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 shrink-0">
              <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <i className="bi bi-file-earmark-text-fill text-indigo-500"></i>
                Vista previa del documento
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
              {previewFile.type === 'excel' && (
                <div className="text-center p-8 bg-white dark:bg-slate-850 rounded-xl shadow-md">
                  <i className="bi bi-file-earmark-spreadsheet text-5xl text-emerald-500 mb-3 block"></i>
                  <p className="text-slate-600 dark:text-slate-300">Para ver el contenido del Excel, usa el botón "Vista Previa" específico.</p>
                  <a href={previewFile.url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold">
                    <i className="bi bi-download me-1"></i> Descargar archivo
                  </a>
                </div>
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
              <a href={previewFile.url} download className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 font-medium text-sm">
                <i className="bi bi-download me-1"></i> Descargar
              </a>
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
              className="px-4 py-2 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
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
    </div>
  );
}