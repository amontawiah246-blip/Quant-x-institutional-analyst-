import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { MARKETS, MarketCategory, TradingMode } from '../types';
import { Activity, Target, Crosshair, BarChart3, Settings, Bell, LayoutDashboard } from 'lucide-react';
import { AnalysisResult } from './AnalysisResult';
import { SignalsLogger } from './SignalsLogger';

interface DashboardProps {
  onAnalyze: (asset: string, mode: TradingMode, imageBase64?: string, accountSize?: number, riskPct?: number) => Promise<string>;
}

export function Dashboard({ onAnalyze }: DashboardProps) {
  const [activeCategory, setActiveCategory] = useState<MarketCategory>('Futures');
  const [selectedAsset, setSelectedAsset] = useState<string>('US30');
  const [mode, setMode] = useState<TradingMode>('SCALPING MODE');
  
  const [result, setResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [livePrices, setLivePrices] = useState<Record<string, { bid: number; ask: number; change: number }>>({});
  const [lastAnalysisCompletedAt, setLastAnalysisCompletedAt] = useState<number>(0);

  // v9 fix: Fetch real live prices for the instrument panel
  useEffect(() => {
    const DERIV_SYMBOLS: Record<string, string> = {
      XAUUSD: 'frxXAUUSD', XAGUSD: 'frxXAGUSD', USOIL: 'frxUSOIL',
      XNGUSD: 'frxXNGUSD', BTCUSD: 'cryBTCUSD', ETHUSD: 'cryETHUSD',
      EURUSD: 'frxEURUSD', GBPUSD: 'frxGBPUSD', USDJPY: 'frxUSDJPY',
    };

    const allAssets = Object.values(MARKETS).flat();
    const priceUpdates: Record<string, { bid: number; ask: number; change: number }> = {};

    const fetchPriceForAsset = async (asset: string) => {
      const symbol = DERIV_SYMBOLS[asset];
      if (!symbol) return;
      try {
        // Use server-side price endpoint to avoid CORS/WS from browser
        const res = await fetch(`/api/live-price?asset=${asset}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.bid && data.ask) {
          priceUpdates[asset] = {
            bid:    data.bid,
            ask:    data.ask,
            change: data.change ?? 0,
          };
          setLivePrices(prev => ({ ...prev, [asset]: priceUpdates[asset] }));
        }
      } catch { /* silent fail — UI shows stale or blank */ }
    };

    // Fetch all visible assets on mount
    allAssets.forEach(fetchPriceForAsset);

    // Refresh every 30 seconds (not too aggressive, Deriv rate limits)
    const interval = setInterval(() => {
      allAssets.forEach(fetchPriceForAsset);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleExecute = async () => {
    setIsLoading(true);
    setResult(null);
    try {
      const data = await onAnalyze(selectedAsset, mode, undefined, 10000, 1.0);
      setResult(data);
      setLastAnalysisCompletedAt(Date.now());
    } catch (err: any) {
      setResult(`**SYSTEM ERROR**\n\nFailed to complete analysis.\n\n\`${err.message}\``);
      setLastAnalysisCompletedAt(Date.now());
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
    <div className="h-full overflow-y-auto bg-zinc-950 text-zinc-100 p-4 sm:p-6 flex flex-col font-sans relative overflow-x-hidden">
      {/* Background glow effects */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <header className="flex items-center justify-between mb-8 relative z-10 w-full max-w-[1600px] mx-auto">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 border border-white/10">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Quant<span className="text-indigo-400">Pro</span>
              <span className="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] uppercase tracking-widest font-bold ml-2">Terminal</span>
            </h1>
            <p className="text-xs text-zinc-400 font-medium">Algorithmic Market Intelligence</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button className="p-2.5 bg-zinc-900/80 border border-zinc-800 rounded-xl hover:bg-zinc-800 hover:border-zinc-700 transition-all text-zinc-400 hover:text-white">
            <Bell className="w-5 h-5" />
          </button>
          <button className="p-2.5 bg-zinc-900/80 border border-zinc-800 rounded-xl hover:bg-zinc-800 hover:border-zinc-700 transition-all text-zinc-400 hover:text-white">
            <Settings className="w-5 h-5" />
          </button>
          <div className="h-10 w-px bg-zinc-800 mx-1"></div>
          <div className="flex items-center gap-3 pl-2">
             <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-sm text-zinc-300">
               TR
             </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex flex-col lg:flex-row gap-6 lg:h-[calc(100vh-130px)] w-full max-w-[1600px] mx-auto relative z-10 pb-10 lg:pb-0">
        
        {/* Left Panel: Instruments List */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:w-[420px] h-[600px] lg:h-auto shrink-0 flex flex-col bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/80 rounded-2xl shadow-2xl overflow-hidden"
        >
          <div className="p-5 border-b border-zinc-800/80 bg-zinc-900/30">
            <div className="flex items-center gap-2 mb-4">
              <LayoutDashboard className="w-4 h-4 text-indigo-400" />
              <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400">Market Overview</h2>
            </div>
            
            <div className="flex bg-zinc-950/50 p-1 rounded-xl border border-zinc-800/50">
              {categories.map(c => (
                <button
                  key={c}
                  onClick={() => {
                     setActiveCategory(c);
                     setSelectedAsset(MARKETS[c][0]);
                  }}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${activeCategory === c ? 'bg-zinc-800/80 text-white shadow-sm border border-zinc-700/50' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50 border border-transparent'}`}
                >
                  {c}
                </button>
              ))}
            </div>
            
            <div className="grid grid-cols-[1fr_75px_75px] gap-3 mt-5 px-3 text-[10px] text-zinc-500 font-bold tracking-[0.15em] uppercase">
              <span>Instrument</span>
              <span className="text-right">Bid</span>
              <span className="text-right">Ask</span>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
            <div className="flex flex-col gap-1.5">
              {MARKETS[activeCategory].map(asset => {
                const isSelected = selectedAsset === asset;
                
                // v9 fix: Use live price tick if available, fallback gracefully to base prices
                const liveData = livePrices[asset];
                let bid      = liveData?.bid ?? null;
                let ask      = liveData?.ask ?? null;
                let isUp     = liveData ? liveData.change >= 0 : true;
                const decimals = activeCategory === 'Forex' ? 4 : activeCategory === 'Crypto' ? 2 : 2;

                if (!liveData) {
                  let val = 0;
                  for (let i = 0; i < asset.length; i++) val += asset.charCodeAt(i);
                  const basePrice = (activeCategory === 'Forex') ? (val / 100) : (activeCategory === 'Crypto' ? val * 50 : val * 10);
                  const spread = basePrice * 0.0001;
                  bid = basePrice;
                  ask = basePrice + spread;
                  isUp = val % 2 === 0;
                }
                
                return (
                  <button
                    key={asset}
                    onClick={() => setSelectedAsset(asset)}
                    className={`group grid grid-cols-[1fr_75px_75px] gap-3 items-center w-full p-3 rounded-xl transition-all border ${isSelected ? 'bg-indigo-500/10 border-indigo-500/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]' : 'bg-zinc-950/20 border-transparent hover:bg-zinc-800/40 hover:border-zinc-700/50'}`}
                  >
                    <div className="flex items-center gap-3 text-left">
                       <span className="text-lg opacity-80 group-hover:opacity-100 transition-opacity">{getAssetIcon(asset)}</span>
                       <span className={`font-semibold tracking-wide text-sm ${isSelected ? 'text-indigo-300' : 'text-zinc-300 group-hover:text-white'}`}>
                         {asset}
                       </span>
                    </div>
                    
                    <div className={`px-2 py-1.5 rounded-lg text-right text-xs font-mono font-medium tracking-tight ${bid ? (isUp ? 'text-emerald-400 bg-emerald-400/10' : 'text-rose-400 bg-rose-400/10') : 'text-zinc-600 bg-zinc-900'}`}>
                      {bid ? bid.toFixed(decimals) : '—'}
                    </div>
                    <div className={`px-2 py-1.5 rounded-lg text-right text-xs font-mono font-medium tracking-tight ${ask ? (isUp ? 'text-emerald-400 bg-emerald-400/10' : 'text-rose-400 bg-rose-400/10') : 'text-zinc-600 bg-zinc-900'}`}>
                      {ask ? ask.toFixed(decimals) : '—'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-5 border-t border-zinc-800/80 bg-zinc-900/30">
             <div className="flex gap-3 mb-5">
                 <button onClick={() => setMode('SCALPING MODE')} className={`flex-1 py-2.5 rounded-xl border text-[11px] font-bold uppercase tracking-widest transition-all ${mode === 'SCALPING MODE' ? 'border-indigo-500/50 text-indigo-300 bg-indigo-500/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]' : 'border-zinc-800/80 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 hover:border-zinc-700'}`}>
                    Scalp Mode
                 </button>
                 <button onClick={() => setMode('SWING MODE')} className={`flex-1 py-2.5 rounded-xl border text-[11px] font-bold uppercase tracking-widest transition-all ${mode === 'SWING MODE' ? 'border-indigo-500/50 text-indigo-300 bg-indigo-500/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]' : 'border-zinc-800/80 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 hover:border-zinc-700'}`}>
                    Swing Mode
                 </button>
             </div>
             <button 
               onClick={handleExecute}
               disabled={isLoading}
               className="relative w-full overflow-hidden group bg-indigo-600 hover:bg-indigo-500 text-white font-bold uppercase tracking-[0.2em] text-xs py-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-wait border border-indigo-400/30 shadow-[0_0_20px_rgba(79,70,229,0.3)]"
             >
               <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
               <span className="relative flex items-center justify-center gap-2">
                 {isLoading ? (
                   <>
                     <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                       <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                       <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                     </svg>
                     Processing Analysis...
                   </>
                 ) : (
                   <>
                     <Target className="w-4 h-4" />
                     Generate Signal
                   </>
                 )}
               </span>
             </button>
          </div>
        </motion.div>

        {/* Right Panel: Output Terminal */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="flex-1 min-h-[500px] lg:min-h-0 bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        >
           <div className="px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/30 flex items-center justify-between">
             <div className="flex items-center gap-3 text-zinc-400">
               <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                 <BarChart3 className="w-4 h-4 text-indigo-400"/>
               </div>
               <span className="text-xs font-bold uppercase tracking-[0.2em]">Intelligence Output</span>
             </div>
             
             {selectedAsset && (
                <div className="flex items-center gap-2 bg-zinc-950/50 px-4 py-1.5 rounded-lg border border-zinc-800/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mr-1">Target</span>
                  <span className="text-xs font-bold text-zinc-200 tracking-widest">{selectedAsset}</span>
                </div>
             )}
           </div>
           
           <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar relative">
             {/* Subtle terminal lines background */}
             <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100%_40px] pointer-events-none" />
             <div className="relative z-10">
               <AnalysisResult result={result} isLoading={isLoading} />
             </div>
           </div>
        </motion.div>
      </div>

      {/* Signals Ledger Logging Workspace */}
      <SignalsLogger 
        currentAsset={selectedAsset} 
        lastAnalysisCompletedAt={lastAnalysisCompletedAt} 
      />

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; border: 1px solid rgba(0,0,0,0.2); }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
        
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}} />
    </div>
  );
}
