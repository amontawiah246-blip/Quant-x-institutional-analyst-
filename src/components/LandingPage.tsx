import React from 'react';
import { motion } from 'motion/react';
import { Shield, Cpu, Activity, ArrowUpRight, ChevronRight, Globe, Lock } from 'lucide-react';
import bgImage from '../assets/images/trading_brain_bg_1781636062594.jpg';

interface LandingPageProps {
  onStart: () => void;
}

export function LandingPage({ onStart }: LandingPageProps) {
  return (
    <div 
      className="min-h-screen text-zinc-300 flex flex-col items-center justify-center p-4 sm:p-8 relative overflow-hidden bg-[#020512] bg-center bg-cover bg-no-repeat font-sans"
      style={{ backgroundImage: bgImage ? `url(${bgImage})` : 'none' }}
    >
      {/* Visual Overlays & Gradients */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#020512]/95 via-[#040926]/90 to-[#020414]/98 backdrop-blur-md z-0" />
      
      {/* High-Tech Grid lines */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none z-0" />
      
      {/* Floating Ambient Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#3b82f6]/10 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#8b5cf6]/10 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="absolute top-[30%] left-[40%] w-[350px] h-[350px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none z-0" />

      {/* Decorative Upper Tech Ribbon */}
      <div className="absolute top-6 left-6 right-6 flex items-center justify-between z-10 pointer-events-none">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#a855f7] animate-ping" />
          <span className="font-mono text-[9px] text-[#818cf8] tracking-[0.3em] uppercase">SYSTEM LEVEL V18.1</span>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-[9px] font-mono text-zinc-500 tracking-wider">
          <span>SECURE CORE INGRESS: ACTIVE</span>
          <span>•</span>
          <span>LATENCY: 1.4ms</span>
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-xl w-full relative z-10 flex flex-col items-center text-center px-2"
      >
        {/* Animated Brand Emblem */}
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 100 }}
          className="relative mb-6"
        >
          {/* Neon Ring Glow */}
          <div className="absolute inset-[-8px] bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl blur-[12px] opacity-40 animate-pulse" />
          
          <div className="w-16 h-16 bg-[#070d2b] border border-blue-500/40 rounded-2xl flex items-center justify-center shadow-2xl relative z-10">
            <Activity className="w-8 h-8 text-transparent bg-clip-text bg-gradient-to-tr from-blue-400 via-indigo-400 to-purple-400 animate-[pulse_2s_infinite]" />
          </div>
        </motion.div>
        
        {/* Platform Titles */}
        <h1 className="text-4xl sm:text-6xl font-display font-extrabold tracking-tight mb-2 text-white relative">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-300">Trade</span>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-indigo-400 to-purple-500">Lens</span>
        </h1>
        
        <p className="font-mono text-xs sm:text-sm text-cyan-300 tracking-[0.35em] uppercase font-bold mb-6">
          Smarter Signals. Stronger Trades.
        </p>

        <p className="text-zinc-400 mb-10 text-sm sm:text-base max-w-lg leading-relaxed">
          AI-driven quantitative intelligence terminal for high-frequency market structure analysis, liquidity mapping, and real-time execution optimization.
        </p>

        {/* Central Terminal Gate Card */}
        <div className="w-full bg-[#050b24]/60 backdrop-blur-2xl border border-white/5 rounded-3xl p-6 sm:p-8 flex flex-col gap-6 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] relative overflow-hidden group">
          {/* Glowing Purple/Blue Border Line at top */}
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500 to-purple-500 opacity-60" />
          
          {/* Inner ambient glow */}
          <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/[0.02] to-purple-500/[0.02] pointer-events-none" />

          {/* Three Key Pillar Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left border-b border-white/5 pb-6">
            <div className="p-3 rounded-2xl bg-white/[0.01] border border-white/[0.02] hover:border-cyan-500/10 transition-all">
              <div className="flex items-center gap-2 text-cyan-400 mb-1">
                <Cpu className="w-4 h-4" />
                <span className="font-mono text-[10px] font-bold tracking-wider uppercase">Engine</span>
              </div>
              <p className="text-[11px] text-zinc-500">Pure math models replacing retail bias.</p>
            </div>

            <div className="p-3 rounded-2xl bg-white/[0.01] border border-white/[0.02] hover:border-indigo-500/10 transition-all">
              <div className="flex items-center gap-2 text-indigo-400 mb-1">
                <Globe className="w-4 h-4" />
                <span className="font-mono text-[10px] font-bold tracking-wider uppercase">Feeds</span>
              </div>
              <p className="text-[11px] text-zinc-500">Instant Deriv websockets & news intelligence.</p>
            </div>

            <div className="p-3 rounded-2xl bg-white/[0.01] border border-white/[0.02] hover:border-purple-500/10 transition-all">
              <div className="flex items-center gap-2 text-purple-400 mb-1">
                <Lock className="w-4 h-4" />
                <span className="font-mono text-[10px] font-bold tracking-wider uppercase">Risk Control</span>
              </div>
              <p className="text-[11px] text-zinc-500">Dual-timeframe structural hard blocks.</p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <motion.button 
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={onStart}
              className="group flex items-center justify-center gap-3 w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 text-white py-4.5 rounded-2xl font-bold text-sm tracking-[0.1em] uppercase shadow-[0_4px_30px_rgba(79,70,229,0.35)] hover:shadow-[0_4px_40px_rgba(139,92,246,0.45)] transition-all cursor-pointer border border-white/10"
            >
              Access TradeLens Terminal
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
            </motion.button>
            
            <div className="flex items-center justify-between px-2 text-[10px] text-zinc-500 font-mono">
              <div className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400/90 font-bold tracking-wider">AES-256 SYSTEM GATEWAY</span>
              </div>
              <span>CLIENT: SECURE_INGRESS_W3</span>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-12 text-[10px] font-mono text-zinc-600 tracking-widest uppercase flex items-center gap-2 select-none">
          <span>PORT: 3000 CONNECTION SECURE</span>
          <span>•</span>
          <span>REAL-TIME PIPELINES ONLINE</span>
        </div>
      </motion.div>
    </div>
  );
}
