import React, { useState } from 'react';
import { motion } from 'motion/react';
import { MARKETS, MarketCategory, TradingMode } from '../types';
import { Activity, Target, Crosshair, BarChart3, Settings } from 'lucide-react';
import { AnalysisResult } from './AnalysisResult';

interface DashboardProps {
  onAnalyze: (asset: string, mode: TradingMode, imageBase64?: string, accountSize?: number, riskPct?: number) => Promise<string>;
}

export function Dashboard({ onAnalyze }: DashboardProps) {
  const [activeCategory, setActiveCategory] = useState<MarketCategory>('Futures');
  const [selectedAsset, setSelectedAsset] = useState<string>('US30');
  const [mode, setMode] = useState<TradingMode>('SCALPING MODE');
  
  const [result, setResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleExecute = async () => {
    setIsLoading(true);
    setResult(null);
    try {
      const data = await onAnalyze(selectedAsset, mode, undefined, 10000, 1.0);
      setResult(data);
    } catch (err: any) {
      setResult(`**SYSTEM ERROR**\n\nFailed to complete analysis.\n\n\`${err.message}\``);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper flags/icons for assets
  const getAssetIcon = (asset: string) => {
    if (asset.includes('USD') && asset.length === 6) return '🇺🇸';
    if (asset.includes('EUR')) return '🇪🇺';
    if (asset.includes('GBP')) return '🇬🇧';
    if (asset.includes('JPY')) return '🇯🇵';
    if (asset.includes('AUD')) return '🇦🇺';
    if (asset.includes('CHF')) return '🇨🇭';
    if (asset.includes('CAD')) return '🇨🇦';
    if (asset.includes('XAU') || asset.includes('XAG')) return '🪙';
    if (asset.includes('BTC')) return '₿';
    if (asset.includes('ETH')) return 'Ξ';
    if (asset.includes('US30') || asset.includes('NAS')) return '📈';
    return '📊';
  };

  const categories: MarketCategory[] = ['Futures', 'Crypto', 'Metals', 'Forex'];

  return (
    <div className="min-h-[100dvh] bg-[#0f1714] text-white p-4 sm:p-6 flex flex-col font-sans relative overflow-x-hidden">
      {/* Background glow effects */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#27ff5c] rounded-full blur-[150px] opacity-[0.03] pointer-events-none" />

      {/* Header */}
      <header className="flex items-center justify-between mb-6 relative z-10 w-full max-w-[1600px] mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#14231a] rounded-lg flex items-center justify-center text-[#38F17A]">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">QUANT-X Dashboard</h1>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
            <Settings className="w-5 h-5 text-[#869b8e]" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex flex-col lg:flex-row gap-6 lg:h-[calc(100vh-100px)] w-full max-w-[1600px] mx-auto relative z-10 pb-10 lg:pb-0">
        
        {/* Left Panel: Instruments List */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:w-[400px] h-[500px] lg:h-auto shrink-0 flex flex-col bg-[#16201a] border border-white/5 rounded-2xl shadow-xl overflow-hidden"
        >
          <div className="p-4 border-b border-white/5">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-[#869b8e] mb-3">Instruments</h2>
            <div className="flex bg-[#0f1714] rounded-lg p-1">
              {categories.map(c => (
                <button
                  key={c}
                  onClick={() => {
                     setActiveCategory(c);
                     setSelectedAsset(MARKETS[c][0]);
                  }}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${activeCategory === c ? 'bg-[#212f27] text-white shadow-sm' : 'text-[#869b8e] hover:text-white'}`}
                >
                  {c}
                </button>
              ))}
            </div>
            
            <div className="grid grid-cols-[1fr_70px_70px] gap-2 mt-4 px-2 text-[10px] text-[#869b8e] font-semibold tracking-wide uppercase">
              <span>Symbol</span>
              <span className="text-center">Bid</span>
              <span className="text-center">Ask</span>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
            <div className="flex flex-col gap-1">
              {MARKETS[activeCategory].map(asset => {
                const isSelected = selectedAsset === asset;
                let val = 0;
                for (let i = 0; i < asset.length; i++) val += asset.charCodeAt(i);
                
                // Generating some dummy price numbers for visual simulation based on asset
                const basePrice = (activeCategory === 'Forex') ? (val / 100) : (activeCategory === 'Crypto' ? val * 50 : val * 10);
                const spread = basePrice * 0.0001;
                const isUp = val % 2 === 0;
                
                return (
                  <button
                    key={asset}
                    onClick={() => setSelectedAsset(asset)}
                    className={`grid grid-cols-[1fr_70px_70px] gap-2 items-center w-full p-2 rounded-lg transition-all border ${isSelected ? 'bg-[#202e26] border-white/10 shadow-sm' : 'bg-transparent border-transparent hover:bg-white/5'}`}
                  >
                    <div className="flex items-center gap-3 text-left">
                       <span className="text-base">{getAssetIcon(asset)}</span>
                       <span className={`font-semibold tracking-wide text-sm ${isSelected ? 'text-white' : 'text-[#acbfaa]'}`}>
                         {asset}
                       </span>
                    </div>
                    
                    <div className={`px-1 py-1.5 rounded-[4px] text-center text-xs font-mono font-medium tracking-tight ${isUp ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                      {basePrice.toFixed(activeCategory === 'Forex' ? 4 : 2)}
                    </div>
                    <div className={`px-1 py-1.5 rounded-[4px] text-center text-xs font-mono font-medium tracking-tight ${isUp ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                      {(basePrice + spread).toFixed(activeCategory === 'Forex' ? 4 : 2)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-4 border-t border-white/5 bg-[#121b16]">
             <div className="flex gap-2 mb-4">
                 <button onClick={() => setMode('SCALPING MODE')} className={`flex-1 py-2 rounded-lg border text-xs font-bold uppercase transition-all ${mode === 'SCALPING MODE' ? 'border-[#38F17A] text-[#38F17A] bg-[#1a3823]' : 'border-white/10 text-[#869b8e] hover:text-white hover:bg-white/5'}`}>
                    Scalp
                 </button>
                 <button onClick={() => setMode('SWING MODE')} className={`flex-1 py-2 rounded-lg border text-xs font-bold uppercase transition-all ${mode === 'SWING MODE' ? 'border-[#38F17A] text-[#38F17A] bg-[#1a3823]' : 'border-white/10 text-[#869b8e] hover:text-white hover:bg-white/5'}`}>
                    Swing
                 </button>
             </div>
             <button 
               onClick={handleExecute}
               disabled={isLoading}
               className="w-full bg-[#38F17A] hover:bg-[#4aff8a] text-black font-bold uppercase tracking-widest text-sm py-4 rounded-xl shadow-[0_0_20px_rgba(56,241,122,0.2)] transition-all disabled:opacity-50 disabled:cursor-wait"
             >
               {isLoading ? 'Processing...' : 'Get Signal'}
             </button>
          </div>
        </motion.div>

        {/* Right Panel: Output Terminal */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="flex-1 min-h-[500px] lg:min-h-0 bg-[#16201a] border border-white/5 rounded-2xl shadow-xl flex flex-col overflow-hidden"
        >
           <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
             <div className="flex items-center gap-2 text-[#869b8e]">
               <BarChart3 className="w-4 h-4"/>
               <span className="text-xs font-bold uppercase tracking-widest">Signal Output</span>
             </div>
             
             {selectedAsset && (
                <div className="flex items-center gap-2 bg-[#0f1714] px-3 py-1 rounded-md border border-white/5">
                  <span className="text-xs text-[#869b8e]">Target:</span>
                  <span className="text-xs font-bold text-white tracking-widest">{selectedAsset}</span>
                </div>
             )}
           </div>
           
           <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
             <AnalysisResult result={result} isLoading={isLoading} />
           </div>
        </motion.div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}} />
    </div>
  );
}
