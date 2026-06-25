import { useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  ArrowLeft, 
  Zap, 
  Activity, 
  Clock, 
  AlertTriangle, 
  Cpu, 
  Coins, 
  Target, 
  Database,
  RefreshCw
} from 'lucide-react';
import { Asset, SignalVerdict, TradingSignal, SignalHistoryItem } from '../types.ts';

interface DashboardProps {
  onBackToLanding: () => void;
}

export default function Dashboard({ onBackToLanding }: DashboardProps) {
  const [selectedAsset, setSelectedAsset] = useState<Asset>('BTC/USD');
  const [customThesis, setCustomThesis] = useState<string>('');
  const [currentSignal, setCurrentSignal] = useState<TradingSignal | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [signalHistory, setSignalHistory] = useState<SignalHistoryItem[]>([
    { timestamp: '11:20:15', asset: 'BTC/USD', price: 94120.50, verdict: 'BUY', profit: 120.40 },
    { timestamp: '11:05:40', asset: 'ETH/USD', price: 3410.15, verdict: 'BUY', profit: 45.20 },
    { timestamp: '10:45:12', asset: 'SOL/USD', price: 186.20, verdict: 'SELL', profit: -12.50 },
    { timestamp: '10:15:00', asset: 'QQQ', price: 462.80, verdict: 'WAIT' }
  ]);

  // Asset price & state mapper to dynamically show initial dummy prices
  const assetMetaMap: Record<Asset, { basePrice: number; change: number; label: string }> = {
    'BTC/USD': { basePrice: 94250.75, change: 3.42, label: 'Bitcoin' },
    'ETH/USD': { basePrice: 3425.20, change: 1.85, label: 'Ethereum' },
    'SOL/USD': { basePrice: 185.45, change: -2.14, label: 'Solana' },
    'EUR/USD': { basePrice: 1.0854, change: 0.05, label: 'Euro / Dollar' },
    'GBP/USD': { basePrice: 1.2642, change: -0.12, label: 'Pound / Dollar' },
    'XAU/USD': { basePrice: 2342.80, change: 1.15, label: 'Gold Spot' },
    'SPY': { basePrice: 542.10, change: 0.65, label: 'S&P 500 ETF' },
    'QQQ': { basePrice: 462.50, change: 0.88, label: 'Nasdaq 100 ETF' }
  };

  const handleGenerateSignal = async () => {
    setIsLoading(true);
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
      if (data.success) {
        const newSignal: TradingSignal = {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: new Date().toLocaleTimeString(),
          asset: selectedAsset,
          price: data.price,
          change24h: data.change24h,
          verdict: data.verdict as SignalVerdict,
          strength: data.strength,
          timeframe: 'H1',
          logic: data.logic,
          metrics: data.metrics,
          userPromptUsed: customThesis
        };

        setCurrentSignal(newSignal);

        // Add to historical ledger log
        const newHistoryItem: SignalHistoryItem = {
          timestamp: newSignal.timestamp,
          asset: newSignal.asset,
          price: newSignal.price,
          verdict: newSignal.verdict,
          profit: newSignal.verdict === 'BUY' ? +(Math.random() * 80 + 20).toFixed(2) : 
                  newSignal.verdict === 'SELL' ? +(Math.random() * 50 + 10).toFixed(2) : undefined
        };
        setSignalHistory(prev => [newHistoryItem, ...prev]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0A11] text-[#E2E8F0] flex flex-col font-sans selection:bg-purple-900/40 relative">
      {/* Glow Effects */}
      <div className="absolute top-[5%] right-[10%] w-[500px] h-[500px] bg-[#8A2BE2]/5 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[5%] left-[5%] w-[400px] h-[400px] bg-[#FF4500]/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Top Header */}
      <header className="h-16 border-b border-white/5 bg-white/[0.02] backdrop-blur-md flex items-center justify-between px-6 z-10 shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBackToLanding}
            className="p-2 hover:bg-white/5 rounded-xl text-[#94A3B8] hover:text-white transition-colors cursor-pointer"
            title="Exit Terminal"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-wider text-white">
              TRADE<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6B35] to-[#FF8A65]">LENS</span>
            </span>
            <span className="text-[10px] font-mono bg-[#8A2BE2]/20 text-purple-300 border border-[#8A2BE2]/30 px-2 py-0.5 rounded">
              INSTITUTIONAL
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-4 text-xs font-mono text-[#94A3B8]">
            <div>FEED STATUS: <span className="text-[#39ff14] font-bold">● ONLINE</span></div>
            <div>COVARIANCE: <span className="text-purple-400 font-bold">SYNCHRONIZED</span></div>
          </div>
          <div className="text-xs font-mono bg-white/5 px-3 py-1.5 border border-white/10 rounded-full text-[#E2E8F0]">
            SESSION: {new Date().toLocaleDateString()}
          </div>
        </div>
      </header>

      {/* Main Terminal Workspace */}
      <main className="flex-1 p-6 overflow-y-auto max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 z-10">
        
        {/* Left Side: Controllers & Input Parameters (5 Cols) */}
        <section className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Asset Picker Panel */}
          <div className="bg-[rgba(30,20,50,0.55)] backdrop-blur-md border border-white/8 rounded-[24px] p-5 shadow-[0_8px_32px_rgba(110,50,200,0.2)] flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h2 className="text-sm font-bold tracking-widest font-mono text-[#FF6B35] uppercase flex items-center gap-2">
                <Coins className="w-4 h-4" /> ASSET SELECTOR
              </h2>
              <span className="text-[10px] font-mono text-zinc-500">MAPPED TARGETS</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2.5">
              {(Object.keys(assetMetaMap) as Asset[]).map((asset) => {
                const isSelected = selectedAsset === asset;
                const meta = assetMetaMap[asset];
                const isChangeUp = meta.change >= 0;

                return (
                  <button
                    key={asset}
                    onClick={() => {
                      setSelectedAsset(asset);
                      setCurrentSignal(null);
                    }}
                    className={`p-3 text-left rounded-[16px] border transition-all cursor-pointer flex flex-col gap-1 ${
                      isSelected 
                        ? 'bg-gradient-to-br from-[#1A103C] to-[#2D1B4E] border-[#FF6B35] shadow-[0_0_15px_rgba(255,107,53,0.35)]' 
                        : 'bg-white/[0.02] border-white/5 hover:bg-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className="flex justify-between items-center w-full">
                      <span className="font-mono text-xs font-bold text-white">{asset}</span>
                      <span className={`text-[9px] font-mono font-bold ${isChangeUp ? 'text-[#39ff14]' : 'text-[#ff073a]'}`}>
                        {isChangeUp ? '+' : ''}{meta.change}%
                      </span>
                    </div>
                    <span className="text-[10px] text-[#94A3B8] truncate">{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* User discretionary bias prompt parameters */}
          <div className="bg-[rgba(30,20,50,0.55)] backdrop-blur-md border border-white/8 rounded-[24px] p-5 shadow-[0_8px_32px_rgba(110,50,200,0.2)] flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h2 className="text-sm font-bold tracking-widest font-mono text-[#FF6B35] uppercase flex items-center gap-2">
                <Target className="w-4 h-4" /> DISCRETIONARY THESIS
              </h2>
              <span className="text-[10px] font-mono text-purple-400">OPTIONAL</span>
            </div>

            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Inject custom macro context, order book trends, sentiment bias, or specific technical criteria to shape the consensus generation.
            </p>

            <textarea
              value={customThesis}
              onChange={(e) => setCustomThesis(e.target.value)}
              placeholder="e.g. Expecting sweep of liquidity near session low. Fed interest rates commentary causing yield curve adjustments. Prioritize volume profile POC."
              className="w-full h-24 bg-[#0B0A11] border border-white/10 rounded-[16px] p-3 text-white text-xs placeholder-zinc-600 outline-none focus:border-[#FF6B35] transition-all font-mono shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]"
            />

            {/* Glowing Purple-to-Orange Action Trigger */}
            <button
              onClick={handleGenerateSignal}
              disabled={isLoading}
              className="w-full py-4 px-6 bg-gradient-to-r from-[#8A2BE2] to-[#FF4500] hover:from-[#9D4EDD] hover:to-[#FF6B35] text-white font-bold rounded-full tracking-wider font-space text-sm transition-all duration-300 transform active:scale-95 disabled:opacity-50 disabled:cursor-wait shadow-[0_0_25px_rgba(138,43,226,0.4)] hover:shadow-[0_0_35px_rgba(255,69,0,0.5)] flex items-center justify-center gap-3 cursor-pointer border border-[#FF6B35]/30"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  COMPUTING MODELS...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 text-[#FFD700] animate-pulse" />
                  GET REAL-TIME SIGNAL
                </>
              )}
            </button>
          </div>

          {/* Trends Graph (Re-painted based on image's Trends section) */}
          <div className="bg-[rgba(30,20,50,0.55)] backdrop-blur-md border border-white/8 rounded-[24px] p-5 shadow-[0_8px_32px_rgba(110,50,200,0.2)] flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h2 className="text-sm font-bold tracking-widest font-mono text-[#FF6B35] uppercase flex items-center gap-2">
                <Activity className="w-4 h-4" /> TRENDS GRAPH
              </h2>
              <span className="text-[10px] font-mono text-[#39ff14]">ACTIVE WAVE</span>
            </div>

            {/* Custom SVG Trend graph with glowing line underneath */}
            <div className="relative w-full h-32 bg-[#0B0A11]/60 border border-white/5 rounded-[16px] overflow-hidden p-4 flex flex-col justify-end">
              <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  {/* Glowing line filter */}
                  <filter id="neonPurpleGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                  <linearGradient id="purpleGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#8A2BE2" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#8A2BE2" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                {/* Gradient area under trend */}
                <path 
                  d="M0 80 Q 50 100 100 60 T 200 40 T 300 90 T 400 30 L 400 128 L 0 128 Z" 
                  fill="url(#purpleGradient)" 
                />
                {/* Glowing neon purple line */}
                <path 
                  d="M0 80 Q 50 100 100 60 T 200 40 T 300 90 T 400 30" 
                  fill="none" 
                  stroke="#8A2BE2" 
                  strokeWidth="3.5" 
                  filter="url(#neonPurpleGlow)" 
                  strokeLinecap="round"
                />
                <circle cx="100" cy="60" r="5" fill="#FF4500" filter="url(#neonPurpleGlow)" />
                <circle cx="300" cy="90" r="5" fill="#39ff14" filter="url(#neonPurpleGlow)" />
              </svg>

              <div className="z-10 flex justify-between text-[9px] font-mono text-[#94A3B8]">
                <span>VOLat POC: H1_SERIES</span>
                <span>LIQUIDITY CLUSTERS MAP</span>
              </div>
            </div>
          </div>
        </section>

        {/* Right Side: Verdict Output & Analytics Ledger (7 Cols) */}
        <section className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Main Verdict Result Card */}
          <div className="bg-[rgba(30,20,50,0.55)] backdrop-blur-md border border-white/8 rounded-[24px] p-6 shadow-[0_8px_32px_rgba(110,50,200,0.2)] flex flex-col gap-5 min-h-[380px] justify-between">
            {currentSignal ? (
              <div className="flex flex-col gap-5">
                {/* Verdict Top bar with asset details */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/5 pb-4">
                  <div>
                    <span className="text-xs font-mono text-[#94A3B8]">PROCESSED SIGNAL</span>
                    <h3 className="text-xl font-bold font-mono text-white flex items-center gap-2 mt-0.5">
                      {currentSignal.asset}
                    </h3>
                  </div>

                  {/* Verdict Glowing Pill */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-[#94A3B8]">DECISION VERDICT:</span>
                    <div className={`px-4 py-1.5 rounded-full font-mono text-xs font-extrabold tracking-widest flex items-center gap-2 ${
                      currentSignal.verdict === 'BUY' 
                        ? 'bg-[rgba(57,255,20,0.12)] border border-[#39ff14] text-[#39ff14] shadow-[0_0_15px_rgba(57,255,20,0.3)]'
                        : currentSignal.verdict === 'SELL'
                        ? 'bg-[rgba(255,7,58,0.12)] border border-[#ff073a] text-[#ff073a] shadow-[0_0_15px_rgba(255,7,58,0.3)]'
                        : currentSignal.verdict === 'CAUTION'
                        ? 'bg-[rgba(255,215,0,0.12)] border border-[#FFD700] text-[#FFD700] shadow-[0_0_15px_rgba(255,215,0,0.3)]'
                        : 'bg-white/5 border border-white/20 text-[#E2E8F0]'
                    }`}>
                      {currentSignal.verdict === 'BUY' && <TrendingUp className="w-3.5 h-3.5" />}
                      {currentSignal.verdict === 'SELL' && <TrendingDown className="w-3.5 h-3.5" />}
                      {currentSignal.verdict === 'CAUTION' && <AlertTriangle className="w-3.5 h-3.5" />}
                      {currentSignal.verdict === 'WAIT' && <Clock className="w-3.5 h-3.5" />}
                      {currentSignal.verdict}
                    </div>
                  </div>
                </div>

                {/* Main Stats Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-[#0B0A11] border border-white/5 rounded-[16px] p-3 text-left">
                    <span className="text-[10px] font-mono text-[#94A3B8]">PRICE TARGET</span>
                    <div className="text-sm font-bold text-white mt-0.5">${currentSignal.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  </div>
                  <div className="bg-[#0B0A11] border border-white/5 rounded-[16px] p-3 text-left">
                    <span className="text-[10px] font-mono text-[#94A3B8]">24H CHANGE</span>
                    <div className={`text-sm font-bold mt-0.5 ${currentSignal.change24h >= 0 ? 'text-[#39ff14]' : 'text-[#ff073a]'}`}>
                      {currentSignal.change24h >= 0 ? '+' : ''}{currentSignal.change24h}%
                    </div>
                  </div>
                  <div className="bg-[#0B0A11] border border-white/5 rounded-[16px] p-3 text-left">
                    <span className="text-[10px] font-mono text-[#94A3B8]">MODEL ACCURACY</span>
                    <div className="text-sm font-bold text-purple-300 mt-0.5">{currentSignal.strength}%</div>
                  </div>
                  <div className="bg-[#0B0A11] border border-white/5 rounded-[16px] p-3 text-left">
                    <span className="text-[10px] font-mono text-[#94A3B8]">RISK STATE</span>
                    <div className={`text-sm font-bold mt-0.5 ${
                      currentSignal.metrics.liveRiskStatus === 'Nominal' ? 'text-[#39ff14]' : 'text-[#ff073a]'
                    }`}>{currentSignal.metrics.liveRiskStatus}</div>
                  </div>
                </div>

                {/* Analytical Markdown reasoning summary */}
                <div className="bg-[#0B0A11]/40 border border-white/5 rounded-[20px] p-4.5 text-xs text-[#E2E8F0] text-left leading-relaxed max-h-56 overflow-y-auto custom-scrollbar font-mono">
                  <div className="flex items-center gap-1.5 font-bold tracking-wider text-[#FF6B35] mb-2 border-b border-white/5 pb-1 uppercase">
                    <Cpu className="w-3.5 h-3.5" /> Model Core Analysis Logic
                  </div>
                  <div className="space-y-2 whitespace-pre-wrap">
                    {currentSignal.logic}
                  </div>
                </div>

                {/* Submetrics grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-white/5 pt-4">
                  <div className="flex items-center justify-between px-3 py-2 bg-[#0B0A11]/80 rounded-xl border border-white/5 text-[10px]">
                    <span className="text-[#94A3B8]">Order Book Wall:</span>
                    <span className="text-white font-mono font-bold">
                      {currentSignal.metrics.orderBookImbalance > 0 ? '+' : ''}{currentSignal.metrics.orderBookImbalance}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 bg-[#0B0A11]/80 rounded-xl border border-white/5 text-[10px]">
                    <span className="text-[#94A3B8]">Consensus Core:</span>
                    <span className="text-[#FF6B35] font-mono font-bold">
                      {currentSignal.metrics.interbankConsensus}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 bg-[#0B0A11]/80 rounded-xl border border-white/5 text-[10px]">
                    <span className="text-[#94A3B8]">Covariance Alpha:</span>
                    <span className="text-purple-400 font-mono font-bold">
                      {currentSignal.metrics.covarianceAlpha}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-center items-center text-center p-8 gap-4 text-[#94A3B8]">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-purple-400 border border-white/10 shadow-[0_8px_32px_rgba(110,50,200,0.1)]">
                  <Database className="w-8 h-8 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white mb-1">TERMINAL STANDBY</h3>
                  <p className="text-xs max-w-sm">
                    Select an asset target from the left, define discretionary criteria bias, and prompt the AI to compile signals.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Institutional Indicators: Order Book Imbalance / Consensus bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            
            {/* Dynamic simulated orderbook panel */}
            <div className="bg-[rgba(30,20,50,0.55)] backdrop-blur-md border border-white/8 rounded-[24px] p-5 shadow-[0_8px_32px_rgba(110,50,200,0.2)] flex flex-col gap-3.5">
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <span className="text-xs font-mono font-bold text-[#FF6B35]">LIQUIDITY DEALS BOOK</span>
                <span className="text-[10px] font-mono text-[#39ff14]">10 SEC FEED</span>
              </div>
              <p className="text-[11px] text-[#94A3B8] text-left">
                Direct buy-to-sell cluster wall ratio mapping dynamic imbalance support.
              </p>
              {/* Progress bars */}
              <div className="space-y-2 font-mono text-[10px] text-left">
                <div>
                  <div className="flex justify-between text-zinc-400 mb-1">
                    <span>94,400 Wall (ASK)</span>
                    <span className="text-[#ff073a]">452.12 BTC</span>
                  </div>
                  <div className="h-2 w-full bg-[#1A103C] rounded-full overflow-hidden border border-white/5">
                    <div className="h-full bg-gradient-to-r from-[#8A2BE2] to-[#ff073a] shadow-[0_0_10px_rgba(138,43,226,0.6)]" style={{ width: '82%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-zinc-400 mb-1">
                    <span>94,100 Wall (BID)</span>
                    <span className="text-[#39ff14]">612.45 BTC</span>
                  </div>
                  <div className="h-2 w-full bg-[#1A103C] rounded-full overflow-hidden border border-white/5">
                    <div className="h-full bg-gradient-to-r from-[#8A2BE2] to-[#39ff14] shadow-[0_0_10px_rgba(138,43,226,0.6)]" style={{ width: '91%' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Simulated Consensus breakdown panel */}
            <div className="bg-[rgba(30,20,50,0.55)] backdrop-blur-md border border-white/8 rounded-[24px] p-5 shadow-[0_8px_32px_rgba(110,50,200,0.2)] flex flex-col gap-3.5">
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <span className="text-xs font-mono font-bold text-[#FF6B35]">INTERBANK CONSENSUS</span>
                <span className="text-[10px] font-mono text-purple-400">1H FRAME</span>
              </div>
              <p className="text-[11px] text-[#94A3B8] text-left">
                Overall institutional trading desk allocation breakdown.
              </p>
              {/* Dual bar representing bull vs bear */}
              <div className="h-5 w-full bg-[#1A103C] rounded-full border border-white/10 flex overflow-hidden font-mono text-[9px] font-bold text-white shadow-[0_4px_15px_rgba(138,43,226,0.2)]">
                <div 
                  className="bg-gradient-to-r from-[#8A2BE2] to-[#FF4500] flex items-center justify-start pl-2 relative shadow-[0_0_10px_rgba(138,43,226,0.7)]"
                  style={{ width: `65%` }}
                >
                  <span>Bullish 65%</span>
                </div>
                <div 
                  className="bg-transparent flex items-center justify-end pr-2 flex-1"
                >
                  <span>35%</span>
                </div>
              </div>
              <div className="flex justify-between font-mono text-[9px] text-[#94A3B8]">
                <span>TOTAL DESKS: 184</span>
                <span>METRICS STACKED</span>
              </div>
            </div>
          </div>

          {/* Signals Ledger Log */}
          <div className="bg-[rgba(30,20,50,0.55)] backdrop-blur-md border border-white/8 rounded-[24px] p-5 shadow-[0_8px_32px_rgba(110,50,200,0.2)] flex flex-col gap-3.5">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <span className="text-xs font-mono font-bold text-[#FF6B35]">SESSION SIGNALS LEDGER LOG</span>
              <span className="text-[10px] font-mono text-zinc-500">REALTIME COMMITS</span>
            </div>

            <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-2">
              {signalHistory.map((history, idx) => (
                <div 
                  key={idx} 
                  className="p-3 bg-[#0B0A11] border border-white/5 rounded-[16px] flex items-center justify-between text-xs font-mono hover:border-purple-500/25 transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] text-zinc-600">{history.timestamp}</span>
                    <span className="font-bold text-white">{history.asset}</span>
                    <span className="text-zinc-400">${history.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                      history.verdict === 'BUY' ? 'bg-[#39ff14]/10 text-[#39ff14]' :
                      history.verdict === 'SELL' ? 'bg-[#ff073a]/10 text-[#ff073a]' :
                      'bg-white/5 text-zinc-400'
                    }`}>
                      {history.verdict}
                    </span>
                    {history.profit !== undefined && (
                      <span className={history.profit >= 0 ? 'text-[#39ff14]' : 'text-[#ff073a]'}>
                        {history.profit >= 0 ? '+' : ''}${history.profit}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
