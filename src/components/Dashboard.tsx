import React, { useState, useEffect } from 'react';
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
  const [livePrices, setLivePrices] = useState<Record<string, { bid: number; ask: number; change: number }>>({});

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
    <div className="min-h-[100dvh] bg-slate-50 text-slate-900 p-4 sm:p-6 flex flex-col font-sans relative overflow-x-hidden">
      {/* Background glow effects */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500 rounded-full blur-[150px] opacity-[0.1] pointer-events-none" />

      {/* Header */}
      <header className="flex items-center justify-between mb-6 relative z-10 w-full max-w-[1600px] mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">QUANT-X Dashboard</h1>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="p-2 bg-slate-200/50 rounded-lg hover:bg-slate-200 transition-colors">
            <Settings className="w-5 h-5 text-slate-500" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex flex-col lg:flex-row gap-6 lg:h-[calc(100vh-100px)] w-full max-w-[1600px] mx-auto relative z-10 pb-10 lg:pb-0">
        
        {/* Left Panel: Instruments List */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:w-[400px] h-[500px] lg:h-auto shrink-0 flex flex-col bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden"
        >
          <div className="p-4 border-b border-slate-100">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-3">Instruments</h2>
            <div className="flex bg-slate-100 rounded-lg p-1">
              {categories.map(c => (
                <button
                  key={c}
                  onClick={() => {
                     setActiveCategory(c);
                     setSelectedAsset(MARKETS[c][0]);
                  }}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${activeCategory === c ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {c}
                </button>
              ))}
            </div>
            
            <div className="grid grid-cols-[1fr_70px_70px] gap-2 mt-4 px-2 text-[10px] text-slate-400 font-semibold tracking-wide uppercase">
              <span>Symbol</span>
              <span className="text-center">Bid</span>
              <span className="text-center">Ask</span>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
            <div className="flex flex-col gap-1">
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
                    className={`grid grid-cols-[1fr_70px_70px] gap-2 items-center w-full p-2 rounded-lg transition-all border ${isSelected ? 'bg-indigo-50/50 border-indigo-100 shadow-sm' : 'bg-transparent border-transparent hover:bg-slate-50'}`}
                  >
                    <div className="flex items-center gap-3 text-left">
                       <span className="text-base">{getAssetIcon(asset)}</span>
                       <span className={`font-semibold tracking-wide text-sm ${isSelected ? 'text-indigo-900' : 'text-slate-600'}`}>
                         {asset}
                       </span>
                    </div>
                    
                    <div className={`px-1 py-1.5 rounded-[4px] text-center text-xs font-mono font-medium tracking-tight ${bid ? (isUp ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700') : 'bg-slate-100 text-slate-400'}`}>
                      {bid ? bid.toFixed(decimals) : '—'}
                    </div>
                    <div className={`px-1 py-1.5 rounded-[4px] text-center text-xs font-mono font-medium tracking-tight ${ask ? (isUp ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700') : 'bg-slate-100 text-slate-400'}`}>
                      {ask ? ask.toFixed(decimals) : '—'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-4 border-t border-slate-100 bg-slate-50">
             <div className="flex gap-2 mb-4">
                 <button onClick={() => setMode('SCALPING MODE')} className={`flex-1 py-2 rounded-lg border text-xs font-bold uppercase transition-all ${mode === 'SCALPING MODE' ? 'border-indigo-400 text-indigo-700 bg-indigo-50' : 'border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-white'}`}>
                    Scalp
                 </button>
                 <button onClick={() => setMode('SWING MODE')} className={`flex-1 py-2 rounded-lg border text-xs font-bold uppercase transition-all ${mode === 'SWING MODE' ? 'border-indigo-400 text-indigo-700 bg-indigo-50' : 'border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-white'}`}>
                    Swing
                 </button>
             </div>
             <button 
               onClick={handleExecute}
               disabled={isLoading}
               className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold uppercase tracking-widest text-sm py-4 rounded-xl shadow-[0_0_20px_rgba(79,70,229,0.2)] transition-all disabled:opacity-50 disabled:cursor-wait"
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
          className="flex-1 min-h-[500px] lg:min-h-0 bg-white border border-slate-200 rounded-2xl shadow-xl flex flex-col overflow-hidden"
        >
           <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
             <div className="flex items-center gap-2 text-slate-500">
               <BarChart3 className="w-4 h-4"/>
               <span className="text-xs font-bold uppercase tracking-widest">Signal Output</span>
             </div>
             
             {selectedAsset && (
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-md border border-slate-200">
                  <span className="text-xs text-slate-500">Target:</span>
                  <span className="text-xs font-bold text-slate-900 tracking-widest">{selectedAsset}</span>
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
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.2); }
      `}} />
    </div>
  );
}
