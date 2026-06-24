import React from 'react';
import { motion } from 'motion/react';
import { Activity, ShieldCheck, Zap, ChevronRight } from 'lucide-react';
import bgImage from '../assets/images/trading_brain_bg_1781636062594.jpg';

interface LandingPageProps {
  onStart: () => void;
}

export function LandingPage({ onStart }: LandingPageProps) {
  return (
    <div 
      className="min-h-screen text-zinc-300 flex flex-col items-center justify-center p-6 relative overflow-hidden bg-center bg-cover bg-no-repeat"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      {/* Background glow effects with overlay to ensure text is readable */}
      <div className="absolute inset-0 bg-[#030712]/80 backdrop-blur-md" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#030712] pointer-events-none" />
      
      <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-indigo-600 rounded-full blur-[160px] opacity-20 pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-sky-500 rounded-full blur-[160px] opacity-10 pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="max-w-md w-full relative z-10 flex flex-col items-center text-center"
      >
        <div className="w-20 h-20 bg-zinc-900 border border-zinc-800 rounded-3xl flex items-center justify-center shadow-[0_0_40px_rgba(99,102,241,0.15)] mb-8">
          <Activity className="w-10 h-10 text-indigo-400" />
        </div>
        
        <h1 className="text-4xl sm:text-5xl font-display font-bold tracking-tight mb-4 text-white">
          Quant<span className="text-indigo-500">Pro</span> Engine
        </h1>
        <p className="text-zinc-400 mb-12 text-sm max-w-sm leading-relaxed">
          Institutional-grade algorithmic market analysis. Real-time data parsing, multi-timeframe synthesis, and advanced ML scoring protocols.
        </p>

        <div className="w-full bg-white/[0.02] backdrop-blur-2xl border border-white/10 rounded-3xl p-6 sm:p-8 flex flex-col gap-8 shadow-2xl relative overflow-hidden">
          {/* Subtle gradient border effect top */}
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

          <div className="flex flex-col gap-6 text-left">
             <div className="flex items-start gap-4">
               <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                 <Zap className="w-5 h-5 text-indigo-400" />
               </div>
               <div>
                  <h3 className="text-sm font-semibold text-white">High-Speed Execution</h3>
                  <p className="text-xs text-zinc-500 mt-1">Instantaneous derivation of complex patterns across timeframes.</p>
               </div>
             </div>
             
             <div className="flex items-start gap-4">
               <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                 <ShieldCheck className="w-5 h-5 text-indigo-400" />
               </div>
               <div>
                  <h3 className="text-sm font-semibold text-white">Bank-Grade Precision</h3>
                  <p className="text-xs text-zinc-500 mt-1">Eliminates subjective retail biases using strict mathematical models.</p>
               </div>
             </div>
          </div>

          <div className="flex flex-col gap-4 mt-2">
            <button 
              onClick={onStart}
              className="group flex items-center justify-center gap-2 w-full bg-white text-zinc-950 py-4 rounded-xl font-bold text-sm tracking-wide shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:bg-zinc-100 transition-all"
            >
              Initialize Dashboard
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <p className="text-[10px] text-zinc-600 tracking-widest uppercase text-center flex items-center justify-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shadow-[0_0_5px_rgba(16,185,129,0.5)]"></span>
              Secure Environment
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
