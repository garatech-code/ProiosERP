import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { Ship, Clock, User, PackageSearch, AlertCircle, CheckCircle2 } from 'lucide-react';

// Constantes
const API_URL = `http://${window.location.hostname}:8000/api/operaciones/tv-dashboard/`;
const ITEMS_PER_PAGE = 5;
const SLIDE_INTERVAL = 15000; // 15s
const FETCH_INTERVAL = 30000; // 30s

function App() {
  const [operations, setOperations] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(new Date());

  // Configurar Hard Refresh cada día a las 03:00 AM
  useEffect(() => {
    const checkRefreshTime = () => {
      const now = new Date();
      if (now.getHours() === 3 && now.getMinutes() === 0 && now.getSeconds() < 10) {
        window.location.reload();
      }
    };
    const interval = setInterval(checkRefreshTime, 10000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get(API_URL);
        // Simulando que viene envuelto en un objeto
        const ops = response.data.operaciones || [];
        setOperations(ops);
        setError(null);
        setLastFetch(new Date());
      } catch (err) {
        console.error("Error fetching data:", err);
        setError('Error de conexión. Reintentando...');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const fetchInterval = setInterval(fetchData, FETCH_INTERVAL);
    return () => clearInterval(fetchInterval);
  }, []);

  // Pagination / Carousel
  useEffect(() => {
    if (operations.length <= ITEMS_PER_PAGE) return;
    
    const slideInterval = setInterval(() => {
      setCurrentPage((prev) => {
        const totalPages = Math.ceil(operations.length / ITEMS_PER_PAGE);
        return (prev + 1) % totalPages;
      });
    }, SLIDE_INTERVAL);

    return () => clearInterval(slideInterval);
  }, [operations.length]);

  const totalPages = Math.ceil(operations.length / ITEMS_PER_PAGE);
  const currentOperations = operations.slice(
    currentPage * ITEMS_PER_PAGE,
    (currentPage + 1) * ITEMS_PER_PAGE
  );

  const getStatusColor = (estado) => {
    switch (estado) {
      case 'solicitada': return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      case 'armando': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'aduanas': return 'bg-purple-500/20 text-purple-400 border-purple-500/50';
      case 'lista_entrega': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50';
      default: return 'bg-slate-700/50 text-slate-300 border-slate-600';
    }
  };

  const getStatusIcon = (estado) => {
    switch (estado) {
      case 'solicitada': return <AlertCircle className="w-5 h-5 mr-2" />;
      case 'armando': return <PackageSearch className="w-5 h-5 mr-2" />;
      case 'aduanas': return <Ship className="w-5 h-5 mr-2" />;
      case 'lista_entrega': return <CheckCircle2 className="w-5 h-5 mr-2" />;
      default: return <AlertCircle className="w-5 h-5 mr-2" />;
    }
  };

  if (loading && operations.length === 0) {
    return (
      <div className="flex h-screen bg-slate-950 items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-indigo-400 text-2xl font-semibold tracking-wider">INICIANDO PROIOS DASHBOARD...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans p-6">
      {/* Header */}
      <header className="flex justify-between items-end mb-8 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400 uppercase tracking-widest">
            Proios Operations
          </h1>
          <p className="text-slate-400 mt-2 text-xl font-medium tracking-wide">
            Vista en Tiempo Real
          </p>
        </div>
        
        <div className="flex flex-col items-end">
          <div className="text-4xl font-bold text-slate-200">
            {format(new Date(), 'HH:mm')}
          </div>
          <div className="text-slate-500 text-lg uppercase font-semibold tracking-wider flex items-center mt-1">
            <Clock className="w-4 h-4 mr-2" />
            Actualizado {formatDistanceToNow(lastFetch, { locale: es, addSuffix: true })}
          </div>
        </div>
      </header>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-lg mb-6 flex items-center justify-center text-red-400 text-xl">
          <AlertCircle className="mr-3" /> {error}
        </div>
      )}

      {/* Main Content */}
      <main className="flex-grow flex flex-col justify-center">
        {operations.length === 0 && !error ? (
          <div className="flex items-center justify-center h-full text-3xl text-slate-600 font-semibold uppercase tracking-widest">
            No hay operaciones en curso
          </div>
        ) : (
          <div className="relative w-full h-full flex flex-col justify-center gap-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentPage}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                className="grid gap-6"
              >
                {currentOperations.map((op) => (
                  <div key={op.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex justify-between items-center transform transition-all duration-500 hover:scale-[1.01] hover:border-indigo-500/30">
                    
                    {/* Left: Info */}
                    <div className="flex-1">
                      <div className="flex items-center space-x-4 mb-3">
                        <span className="text-cyan-400 text-2xl font-bold font-mono tracking-wider">{op.nombre}</span>
                        <span className="bg-slate-800 text-slate-300 px-3 py-1 rounded-full text-sm font-semibold uppercase tracking-wider border border-slate-700">
                          {op.tipo_operacion}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-6 text-xl">
                        <div className="flex items-center text-slate-200 font-medium">
                          <Ship className="text-indigo-400 mr-3 w-6 h-6" />
                          {op.buque}
                        </div>
                        <div className="text-slate-500">|</div>
                        <div className="text-slate-400 font-medium truncate max-w-sm">
                          {op.cliente}
                        </div>
                      </div>
                    </div>

                    {/* Middle: Operators */}
                    <div className="flex-1 flex justify-center">
                      <div className="flex flex-col space-y-2">
                        {op.operadores.map((user, idx) => (
                          <div key={idx} className="flex items-center text-slate-400 text-lg">
                            <User className="w-5 h-5 mr-2 text-slate-500" />
                            {user}
                          </div>
                        ))}
                        {op.operadores.length === 0 && (
                          <span className="text-slate-600 text-lg italic">Sin asignar</span>
                        )}
                      </div>
                    </div>

                    {/* Right: Status & ETA */}
                    <div className="flex-1 flex flex-col items-end">
                      <div className={`px-6 py-3 rounded-xl border flex items-center font-bold text-xl uppercase tracking-widest ${getStatusColor(op.estado_raw)}`}>
                        {getStatusIcon(op.estado_raw)}
                        {op.estado}
                      </div>
                      <div className="mt-4 flex items-center text-lg text-slate-400 font-medium">
                        <span className="text-slate-500 mr-2 uppercase text-sm tracking-widest font-bold">ETA</span>
                        {op.eta ? format(parseISO(op.eta), "dd MMM yyyy - HH:mm", { locale: es }) : 'Por confirmar'}
                      </div>
                    </div>
                  </div>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Footer / Pagination Indicator */}
      {totalPages > 1 && (
        <footer className="mt-8 flex justify-center space-x-3">
          {Array.from({ length: totalPages }).map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-500 ${
                i === currentPage ? 'w-12 bg-indigo-500' : 'w-4 bg-slate-800'
              }`}
            />
          ))}
        </footer>
      )}
    </div>
  );
}

export default App;
