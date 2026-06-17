import React from 'react';
import { motion } from 'motion/react';
import { Activity, ShieldCheck, Zap } from 'lucide-react';
import bgImage from '../assets/images/trading_brain_bg_1781636062594.jpg';

interface LandingPageProps {
  onStart: () => void;
}

export function LandingPage({ onStart }: LandingPageProps) {
  return (
    <div 
      className="min-h-screen text-slate-900 flex flex-col items-center justify-center p-6 relative overflow-hidden bg-center bg-cover bg-no-repeat"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      {/* Background glow effects with overlay to ensure text is readable */}
      <div className="absolute inset-0 bg-white/90 backdrop-blur-md" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-300 rounded-full blur-[120px] opacity-40 pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-sky-200 rounded-full blur-[120px] opacity-40 pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="max-w-md w-full relative z-10 flex flex-col items-center text-center"
      >
        <div className="w-20 h-20 bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 rounded-3xl flex items-center justify-center shadow-[0_0_40px_rgba(99,102,241,0.15)] mb-8">
          <Activity className="w-10 h-10 text-indigo-600" />
        </div>
        
        <h1 className="text-4xl font-bold tracking-tight mb-3 text-slate-900">
          Quant<span className="text-indigo-600">Pro</span> Engine
        </h1>
        <p className="text-slate-500 mb-12 text-sm max-w-sm">
          Institutional-grade algorithmic market analysis. Real-time data parsing, multi-timeframe synthesis, and advanced ML scoring protocols.
        </p>

        <div className="w-full bg-white/80 backdrop-blur-xl border border-slate-200 rounded-3xl p-6 sm:p-8 flex flex-col gap-6 shadow-2xl">
          <div className="flex flex-col gap-4 text-left">
             <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                 <Zap className="w-5 h-5 text-indigo-600" />
               </div>
               <div>
                  <h3 className="text-sm font-semibold text-slate-900">High-Speed Execution</h3>
                  <p className="text-xs text-slate-500">Instantaneous derivation of complex patterns.</p>
               </div>
             </div>
             
             <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                 <ShieldCheck className="w-5 h-5 text-indigo-600" />
               </div>
               <div>
                  <h3 className="text-sm font-semibold text-slate-900">Bank-Grade Precision</h3>
                  <p className="text-xs text-slate-500">Avoids subjective retail biases with strict math.</p>
               </div>
             </div>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            <button 
              onClick={onStart}
              className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-sm tracking-wide shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] hover:bg-indigo-500 transition-all"
            >
              Initialize Dashboard / Sign In
            </button>
            <p className="text-[10px] text-slate-400 tracking-widest uppercase text-center mt-2">
              Secure Environment
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
