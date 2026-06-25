import React from 'react';
import { motion } from 'motion/react';
import { Shield, Cpu, Activity, ChevronRight, Globe, Lock } from 'lucide-react';

interface LandingPageProps {
  onStart: () => void;
}

export function LandingPage({ onStart }: LandingPageProps) {
  return (
    <div className="min-h-screen text-slate-800 flex flex-col items-center justify-center p-4 sm:p-8 relative overflow-hidden bg-slate-50 font-sans">
      
      {/* Floating Ambient Glows in Warm Orange Shades */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-orange-100/40 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-amber-100/30 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="absolute top-[30%] left-[40%] w-[350px] h-[350px] bg-orange-100/10 rounded-full blur-[120px] pointer-events-none z-0" />

      {/* Decorative Upper Ribbon */}
      <div className="absolute top-6 left-6 right-6 flex items-center justify-between z-10 pointer-events-none">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
          <span className="font-mono text-[9px] text-orange-600 font-bold tracking-[0.2em] uppercase">Quantitative Market Core</span>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-[9px] font-mono text-slate-400 tracking-wider">
          <span>REAL-TIME ANALYSIS FEED</span>
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-xl w-full relative z-10 flex flex-col items-center text-center px-2"
      >
        {/* Animated Brand Emblem */}
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 120 }}
          className="relative mb-6"
        >
          {/* Subtle Orange Glow */}
          <div className="absolute inset-[-6px] bg-gradient-to-r from-orange-400 to-amber-500 rounded-2xl blur-[8px] opacity-25" />
          
          <div className="w-14 h-14 bg-white border border-orange-100 rounded-2xl flex items-center justify-center shadow-md relative z-10">
            <Activity className="w-7 h-7 text-orange-500" />
          </div>
        </motion.div>
        
        {/* Platform Titles */}
        <h1 className="text-4xl sm:text-5xl font-display font-extrabold tracking-tight mb-2 text-slate-950 relative">
          <span>Trade</span>
          <span className="text-orange-500">Lens</span>
        </h1>
        
        <p className="font-mono text-xs text-orange-600 tracking-[0.25em] uppercase font-bold mb-6">
          Smarter Signals. Stronger Trades.
        </p>
 
        <p className="text-slate-600 mb-8 text-sm sm:text-base max-w-lg leading-relaxed">
          AI-driven quantitative intelligence terminal for high-frequency market structure analysis, liquidity mapping, and real-time execution optimization.
        </p>

        {/* Central Gate Card */}
        <div className="w-full bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 flex flex-col gap-6 shadow-xl shadow-slate-100 relative overflow-hidden text-left">
          {/* Subtle Orange Line at Top */}
          <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-orange-400 to-amber-500" />

          {/* Three Key Pillar Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-b border-slate-100 pb-6">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-orange-200 transition-all">
              <div className="flex items-center gap-2 text-orange-600 mb-1">
                <Cpu className="w-4 h-4" />
                <span className="font-mono text-[9px] font-bold tracking-wider uppercase">Calculated</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-normal">Pure math models replacing retail bias.</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-orange-200 transition-all">
              <div className="flex items-center gap-2 text-orange-600 mb-1">
                <Globe className="w-4 h-4" />
                <span className="font-mono text-[9px] font-bold tracking-wider uppercase">Feeds</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-normal">Instant live price rates & consensus data.</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-orange-200 transition-all">
              <div className="flex items-center gap-2 text-orange-600 mb-1">
                <Lock className="w-4 h-4" />
                <span className="font-mono text-[9px] font-bold tracking-wider uppercase">Guardrails</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-normal">Multi-timeframe structural hard blocks.</p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <motion.button 
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={onStart}
              className="group flex items-center justify-center gap-2 w-full bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-2xl font-bold text-sm tracking-[0.05em] uppercase shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transition-all cursor-pointer border border-orange-400"
            >
              Access TradeLens Terminal
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </motion.button>
            
            <div className="flex items-center justify-between px-1 text-[10px] text-slate-400 font-mono">
              <div className="flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-bold tracking-wider">SECURE DESK ACCESS</span>
              </div>
              <span>CLIENT DESK VERIFIED</span>
            </div>
          </div>
        </div>

        {/* Human footer info */}
        <div className="mt-12 text-[10px] font-mono text-slate-400 tracking-wider uppercase select-none">
          <span>REAL-TIME ANALYSIS SYSTEM INITIALIZED</span>
        </div>
      </motion.div>
    </div>
  );
}
