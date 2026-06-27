import { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Zap, 
  Activity, 
  Coins, 
  Target, 
  RefreshCw
} from 'lucide-react';
import { Asset, SMCSignal, AssetWeight, DailyPerformance, ActiveThesis } from '../types.ts';
import AnalysisResult from './AnalysisResult.tsx';
import SignalsLogger from './SignalsLogger.tsx';
import ExtraModules from './ExtraModules.tsx';

interface DashboardProps {
  onBackToLanding: () => void;
}

export default function Dashboard({ onBackToLanding }: DashboardProps) {
  const [selectedAsset, setSelectedAsset] = useState<Asset>('BTC/USD');
  const [customThesis, setCustomThesis] = useState<string>('');
  const [currentSignal, setCurrentSignal] = useState<SMCSignal | null>(null);
  
  // Database-backed states
  const [signals, setSignals] = useState<SMCSignal[]>([]);
  const [activeTheses, setActiveTheses] = useState<ActiveThesis[]>([]);
  const [weights, setWeights] = useState<AssetWeight[]>([]);
  const [performance, setPerformance] = useState<DailyPerformance[]>([]);
  
  // Loading & network states
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isDataLoading, setIsDataLoading] = useState<boolean>(false);

  // Asset price & state mapper to dynamically show initial dummy prices
  const assetMetaMap: Record<Asset, { label: string; change: number }> = {
    'BTC/USD': { label: 'Bitcoin', change: 3.42 },
    'ETH/USD': { label: 'Ethereum', change: 1.85 },
    'SOL/USD': { label: 'Solana', change: -2.14 },
    'EUR/USD': { label: 'Euro / Dollar', change: 0.05 },
    'GBP/USD': { label: 'Pound / Dollar', change: -0.12 },
    'XAU/USD': { label: 'Gold Spot', change: 1.15 },
    'SPY': { label: 'S&P 500 ETF', change: 0.65 },
    'QQQ': { label: 'Nasdaq 100 ETF', change: 0.88 }
  };

  // Fetch all databases logs on load or refresh
  const fetchAllData = async () => {
    setIsDataLoading(true);
    try {
      const [sigRes, thesisRes, weightRes, perfRes] = await Promise.all([
        fetch('/api/signals').then(res => res.json()),
        fetch('/api/active-thesis').then(res => res.json()),
        fetch('/api/asset-weights').then(res => res.json()),
        fetch('/api/daily-performance').then(res => res.json())
      ]);

      if (sigRes.success) {
        setSignals(sigRes.data);
        // Find most recent signal for selected asset to display on load
        const assetSig = sigRes.data.find((s: SMCSignal) => s.asset === selectedAsset);
        if (assetSig) {
          setCurrentSignal(assetSig);
        } else if (sigRes.data.length > 0) {
          setCurrentSignal(sigRes.data[0]);
        }
      }
      
      if (thesisRes.success) {
        setActiveTheses(thesisRes.data);
      }
      
      if (weightRes.success) {
        setWeights(weightRes.data);
      }
      
      if (perfRes.success) {
        setPerformance(perfRes.data);
      }
    } catch (e) {
      console.error("Error fetching db data:", e);
    } finally {
      setIsDataLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Update displayed signal if selected asset changes
  useEffect(() => {
    const assetSig = signals.find(s => s.asset === selectedAsset);
    if (assetSig) {
      setCurrentSignal(assetSig);
    } else {
      setCurrentSignal(null);
    }
  }, [selectedAsset, signals]);

  const handleGenerateSignal = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/generate-signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: selectedAsset,
          customContext: customThesis
        })
      });

      const data = await response.json();
      if (data.success || data.verdict) {
        // Clear thesis input on success
        setCustomThesis('');
        
        // Reload all data so weights total trades and signals update from DB
        await fetchAllData();
      }
    } catch (err) {
      console.error("Error generating signal:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Find active thesis for currently selected asset
  const currentAssetThesis = activeTheses.find(t => t.asset === selectedAsset && t.status === 'ACTIVE');

  return (
    <div className="min-h-screen bg-[#0B0A11] text-[#E2E8F0] flex flex-col font-sans selection:bg-purple-900/40 relative">
      
      {/* Dynamic Background Radial Gradients */}
      <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-gradient-to-br from-[#8A2BE2]/5 to-transparent rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-gradient-to-tr from-[#FF4500]/5 to-transparent rounded-full blur-[120px] pointer-events-none" />

      {/* Top Header Navbar */}
      <header className="h-16 border-b border-white/5 bg-[#13111C]/60 backdrop-blur-md flex items-center justify-between px-6 z-10 shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBackToLanding}
            className="p-2 hover:bg-white/5 rounded-xl text-[#94A3B8] hover:text-white transition-colors cursor-pointer"
            title="Exit Terminal"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#8A2BE2] to-[#FF4500] p-[1px]">
              <div className="w-full h-full bg-[#0B0A11] rounded-[5px] flex items-center justify-center">
                <span className="text-white font-black text-xs font-mono">T</span>
              </div>
            </div>
            <span className="text-lg font-bold tracking-wider text-white">
              TRADE<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6B35] to-[#FF8A65]">LENS</span>
            </span>
            <span className="text-[10px] font-mono bg-purple-500/10 text-purple-300 border border-purple-500/25 px-2 py-0.5 rounded">
              INSTITUTIONAL TERMINAL v4.2
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-4 text-xs font-mono text-[#94A3B8]">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#39ff14] animate-pulse"></span>
              DATA FEED: <span className="text-[#39ff14] font-bold">ONLINE</span>
            </div>
            <div className="text-purple-300">CORE COVARIANCE: SYNCHRONIZED</div>
          </div>
          
          <button
            onClick={fetchAllData}
            disabled={isDataLoading}
            className="p-2 hover:bg-white/5 border border-white/5 rounded-xl text-zinc-400 hover:text-white transition-all cursor-pointer disabled:opacity-50"
            title="Sync Database"
          >
            <RefreshCw className={`w-4 h-4 ${isDataLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Main Grid Workspace */}
      <main className="flex-1 p-6 overflow-y-auto max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 z-10">
        
        {/* Left column (Controllers & Weights): 5 columns */}
        <section className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Asset Selector */}
          <div className="bg-[#13111C]/80 backdrop-blur-md border border-white/5 rounded-[24px] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.3)] flex flex-col gap-3.5">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <h2 className="text-xs font-bold tracking-widest font-mono text-[#FF6B35] uppercase flex items-center gap-2">
                <Coins className="w-4 h-4" /> QUANT MARKET SELECTOR
              </h2>
              <span className="text-[10px] font-mono text-zinc-500">8 LIQUID TARGETS</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2">
              {(Object.keys(assetMetaMap) as Asset[]).map((asset) => {
                const isSelected = selectedAsset === asset;
                const meta = assetMetaMap[asset];
                const isChangeUp = meta.change >= 0;

                return (
                  <button
                    key={asset}
                    onClick={() => setSelectedAsset(asset)}
                    className={`p-2.5 text-left rounded-xl border transition-all cursor-pointer flex flex-col gap-0.5 ${
                      isSelected 
                        ? 'bg-gradient-to-br from-[#1E113B] to-[#13111C] border-[#FF6B35] shadow-[0_0_15px_rgba(255,107,53,0.15)]' 
                        : 'bg-white/[0.01] border-white/5 hover:bg-white/[0.04] hover:border-white/10'
                    }`}
                  >
                    <div className="flex justify-between items-center w-full">
                      <span className="font-mono text-xs font-black text-white">{asset}</span>
                      <span className={`text-[9px] font-mono font-bold ${isChangeUp ? 'text-[#39ff14]' : 'text-[#ff073a]'}`}>
                        {isChangeUp ? '+' : ''}{meta.change}%
                      </span>
                    </div>
                    <span className="text-[9px] text-[#94A3B8] font-mono truncate">{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active SMC Thesis block if existing for asset */}
          {currentAssetThesis && (
            <div className="bg-gradient-to-r from-[#1E113B] to-[#13111C] border border-[#39ff14]/25 p-4 rounded-2xl text-left flex flex-col gap-2 font-mono">
              <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
                <span className="text-[10px] font-extrabold text-[#39ff14] tracking-widest flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5 animate-pulse" /> ACTIVE SMC TARGET THESIS
                </span>
                <span className="text-[9px] text-zinc-400">Times Confirmed: {currentAssetThesis.times_confirmed}</span>
              </div>
              <div className="grid grid-cols-2 gap-y-2 text-[10px]">
                <div>
                  <span className="text-zinc-500">ANCHOR BLOCK:</span>
                  <p className="font-bold text-white uppercase">{currentAssetThesis.structural_anchor}</p>
                </div>
                <div>
                  <span className="text-zinc-500">ZONE SOURCE:</span>
                  <p className="font-bold text-purple-300 uppercase">{currentAssetThesis.zone_source} (REFINED: {currentAssetThesis.zone_refined_count})</p>
                </div>
                <div className="col-span-2">
                  <span className="text-zinc-500">INVALIDATION LEVEL:</span>
                  <p className="font-bold text-[#ff073a]">${currentAssetThesis.invalidation_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
            </div>
          )}

          {/* Discretionary Thesis Input Form */}
          <div className="bg-[#13111C]/80 backdrop-blur-md border border-white/5 rounded-[24px] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.3)] flex flex-col gap-3.5">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <h2 className="text-xs font-bold tracking-widest font-mono text-[#FF6B35] uppercase flex items-center gap-2">
                <Target className="w-4 h-4" /> CONTEXT DISCRETIONARY BIAS
              </h2>
              <span className="text-[10px] font-mono text-purple-400">OPTIONAL</span>
            </div>

            <p className="text-[11px] text-[#94A3B8] leading-relaxed text-left font-mono">
              Inject external multi-market metrics, sentiment indicators, or specific order flow alerts to bias the algorithmic consensus.
            </p>

            <textarea
              value={customThesis}
              onChange={(e) => setCustomThesis(e.target.value)}
              placeholder="e.g. Expecting sweep of liquidity near session low. Fed interest rates commentary causing yield curve adjustments. Prioritize volume profile POC."
              className="w-full h-24 bg-[#0B0A11] border border-white/10 rounded-xl p-3 text-white text-xs placeholder-zinc-600 outline-none focus:border-[#FF6B35] transition-all font-mono shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]"
            />

            <button
              onClick={handleGenerateSignal}
              disabled={isGenerating}
              className="w-full py-3 px-6 bg-gradient-to-r from-[#8A2BE2] to-[#FF4500] hover:from-[#9D4EDD] hover:to-[#FF6B35] text-white font-bold rounded-xl tracking-wider font-mono text-xs transition-all duration-300 transform active:scale-95 disabled:opacity-50 disabled:cursor-wait shadow-[0_4px_20px_rgba(138,43,226,0.3)] hover:shadow-[0_4px_25px_rgba(255,69,0,0.4)] flex items-center justify-center gap-2 cursor-pointer border border-[#FF6B35]/20 uppercase"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  COMPUTING ORDER FLOW...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 text-[#FFD700] animate-pulse" />
                  GENERATE SMC SYSTEM REPORT
                </>
              )}
            </button>
          </div>

          {/* Configuration Weights sliders & Daily Performance Panel */}
          <ExtraModules 
            selectedAsset={selectedAsset} 
            onWeightsUpdated={fetchAllData}
            weights={weights}
            performance={performance}
          />

        </section>

        {/* Right column (Results & Ledgers): 7 columns */}
        <section className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Main active Analysis Result */}
          <AnalysisResult signal={currentSignal} isLoading={isGenerating} />

          {/* Dynamic Order book Deal & Consensus Breakdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            
            {/* Liquidity Deal order book */}
            <div className="bg-[#13111C]/80 backdrop-blur-md border border-white/5 rounded-[24px] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.3)] flex flex-col gap-3">
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <span className="text-xs font-mono font-bold text-[#FF6B35]">LIQUIDITY CLUSTER MAP</span>
                <span className="text-[9px] font-mono text-[#39ff14] animate-pulse">FEED SYNCED</span>
              </div>
              <p className="text-[10px] text-zinc-400 text-left font-mono">
                Direct block bid-to-ask wall imbalances detected at key historical sweep levels.
              </p>
              
              <div className="space-y-2 font-mono text-[10px] text-left">
                <div>
                  <div className="flex justify-between text-zinc-500 mb-1">
                    <span>Upper Liquidity Pull (ASK)</span>
                    <span className="text-[#ff073a] font-bold">Block Resistance</span>
                  </div>
                  <div className="h-1.5 w-full bg-[#0B0A11] rounded-full overflow-hidden border border-white/5">
                    <div className="h-full bg-gradient-to-r from-[#8A2BE2] to-[#ff073a]" style={{ width: '74%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-zinc-500 mb-1">
                    <span>Lower Sweep Support (BID)</span>
                    <span className="text-[#39ff14] font-bold">Block Accumulation</span>
                  </div>
                  <div className="h-1.5 w-full bg-[#0B0A11] rounded-full overflow-hidden border border-white/5">
                    <div className="h-full bg-gradient-to-r from-[#8A2BE2] to-[#39ff14]" style={{ width: '88%' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Interbank Consensus Dual bar */}
            <div className="bg-[#13111C]/80 backdrop-blur-md border border-white/5 rounded-[24px] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.3)] flex flex-col gap-3">
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <span className="text-xs font-mono font-bold text-[#FF6B35]">INTERBANK COVARIANCE</span>
                <span className="text-[9px] font-mono text-purple-400">DAILY CORE</span>
              </div>
              <p className="text-[10px] text-zinc-400 text-left font-mono">
                Consensus covariance direction computed from 18 discretionary partner nodes.
              </p>
              
              <div className="h-4.5 w-full bg-[#0B0A11] rounded-lg border border-white/5 flex overflow-hidden font-mono text-[9px] font-black text-white">
                <div 
                  className="bg-gradient-to-r from-[#8A2BE2] to-[#FF4500] flex items-center justify-start pl-2"
                  style={{ width: `68%` }}
                >
                  <span>BULLISH 68%</span>
                </div>
                <div className="bg-transparent flex items-center justify-end pr-2 flex-1 text-zinc-500">
                  <span>32%</span>
                </div>
              </div>
              <div className="flex justify-between font-mono text-[8px] text-zinc-600 font-bold">
                <span>CONFLUENCE SEED: HIGH</span>
                <span>METRICS CALIBRATED</span>
              </div>
            </div>
          </div>

          {/* Database backed Signals Logger Ledger */}
          <SignalsLogger 
            signals={signals} 
            onRefresh={fetchAllData} 
            isLoading={isDataLoading} 
          />

        </section>

      </main>

    </div>
  );
}
