import { useState } from 'react';

export default function OperarioActionPanel({ products }) {
  const [preparedQuantities, setPreparedQuantities] = useState(
    products?.reduce((acc, p, idx) => ({ ...acc, [idx]: p.quantity }), {}) || {}
  );
  const [completed, setCompleted] = useState({});

  const handlePrepare = (idx) => {
    setCompleted(prev => ({ ...prev, [idx]: true }));
    // Mockup logic: En el futuro esto llamará al módulo de producción para descontar materia prima
    alert(`Preparación de ${products[idx].product_name} confirmada. Registrando en producción (Mock)...`);
  };

  if (!products || products.length === 0) return null;

  return (
    <div className="bg-white shadow sm:rounded-lg mt-6 border-2 border-indigo-200 overflow-hidden">
      <div className="bg-indigo-50 px-4 py-3 border-b border-indigo-100 flex items-center gap-2">
         <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
         <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-wider">Panel de Preparación de Pedido (Operario)</h3>
      </div>
      <div className="p-4 sm:p-6">
        <div className="space-y-4">
          {products.map((prod, idx) => (
            <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200 gap-4 transition-all hover:bg-white hover:shadow-sm">
              <div className="flex-1">
                <p className="font-bold text-gray-900 text-lg uppercase tracking-tight">{prod.product_name}</p>
                <p className="text-sm text-gray-500 font-medium">Cantidad Solicitada: <span className="text-indigo-600 font-bold">{prod.quantity} unidades</span></p>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex flex-col">
                  <label className="text-[10px] font-black text-gray-400 uppercase mb-1">Cant. Preparada</label>
                  <input 
                    type="number" 
                    className="w-24 p-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 outline-none font-bold text-center text-lg"
                    value={preparedQuantities[idx]}
                    onChange={(e) => setPreparedQuantities(prev => ({ ...prev, [idx]: e.target.value }))}
                    disabled={completed[idx]}
                  />
                </div>
                <button
                  onClick={() => handlePrepare(idx)}
                  disabled={completed[idx]}
                  className={`mt-4 sm:mt-0 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg transition-all transform active:scale-95 ${completed[idx] ? 'bg-green-500 text-white cursor-default' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'}`}
                >
                  {completed[idx] ? <><i className="bi bi-check-lg mr-1"></i> Listo</> : 'Confirmar'}
                </button>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-8 pt-6 border-t border-dashed border-gray-200">
           <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3 text-amber-800">
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              <p className="text-xs font-medium italic">
                 Nota: Al confirmar la preparación, el sistema descontará automáticamente los químicos del inventario según las fórmulas configuradas. (Módulo en desarrollo).
              </p>
           </div>
        </div>
      </div>
    </div>
  );
}
