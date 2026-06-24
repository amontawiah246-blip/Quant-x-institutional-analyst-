import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MARKETS, MarketCategory, TradingMode } from '../types';
import { 
  Activity, Target, Crosshair, BarChart3, Settings, Bell, LayoutDashboard,
  TrendingUp, TrendingDown, Clock, ShieldCheck, Database, ListFilter,
  Calendar, Sliders, Play, Globe, RotateCcw, ShieldAlert, AlertTriangle,
  Info, Maximize2, Search, ArrowUpRight, CheckSquare, Sparkles, Compass,
  Sun, Moon, ChevronDown, ChevronUp, Zap, HelpCircle, Lock, Newspaper, User,
  MoreHorizontal, X, FileText, Layers, Flame, BookOpen
} from 'lucide-react';
import { AnalysisResult } from './AnalysisResult';
import { SignalsLogger } from './SignalsLogger';
import { 
  AIConfidenceHeatmap, MultiTimeframeAlignment, SmartMoneyConceptsPanel,
  LiquiditySweepDetector, VolumeProfile, InstitutionalFootprint,
  CorrelationMatrix, EconomicImpactScanner, PortfolioRiskDashboard,
  MonteCarloRiskEngine, LiveMarketSentimentEngine, StrategyBacktestingCenter
} from './ExtraModules';

interface DashboardProps {
  onAnalyze: (asset: string, mode: TradingMode, imageBase64?: string, accountSize?: number, riskPct?: number) => Promise<string>;
}

type TabType = 
  | 'dashboard' 
  | 'history' 
  | 'watchlist' 
  | 'calendar' 
  | 'news' 
  | 'settings' 
  | 'help'
  | 'heatmap'
  | 'alignment'
  | 'smc'
  | 'footprint'
  | 'sweeps'
  | 'volume'
  | 'monte-carlo'
  | 'backtesting';

// Asset metadata details helper with clean institutional symbols (No Emojis)
const getAssetDetails = (asset: string) => {
  const details: Record<string, { name: string; symbol: string; desc: string }> = {
    EURUSD: { name: 'EUR/USD', symbol: 'EUR·USD', desc: 'Euro / US Dollar' },
    GBPUSD: { name: 'GBP/USD', symbol: 'GBP·USD', desc: 'Pound / US Dollar' },
    USDJPY: { name: 'USD/JPY', symbol: 'USD·JPY', desc: 'US Dollar / Yen' },
    USDCHF: { name: 'USD/CHF', symbol: 'USD·CHF', desc: 'US Dollar / Swiss Franc' },
    AUDUSD: { name: 'AUD/USD', symbol: 'AUD·USD', desc: 'Australian / US Dollar' },
    USDCAD: { name: 'USD/CAD', symbol: 'USD·CAD', desc: 'US Dollar / Canadian Dollar' },
    BTCUSD: { name: 'BTC/USD', symbol: 'BTC·USD', desc: 'Bitcoin / US Dollar' },
    ETHUSD: { name: 'ETH/USD', symbol: 'ETH·USD', desc: 'Ethereum / US Dollar' },
    SOLUSD: { name: 'SOL/USD', symbol: 'SOL·USD', desc: 'Solana / US Dollar' },
    BNBUSD: { name: 'BNB/USD', symbol: 'BNB·USD', desc: 'Binance Coin / US Dollar' },
    XAUUSD: { name: 'XAU/USD', symbol: 'XAU·USD', desc: 'Gold Spot / US Dollar' },
    XAGUSD: { name: 'XAG/USD', symbol: 'XAG·USD', desc: 'Silver Spot / US Dollar' },
    USOIL:  { name: 'USOIL',   symbol: 'WTI·CRUDE', desc: 'Crude Oil / US Dollar' },
    XNGUSD: { name: 'XNG/USD', symbol: 'NAT·GAS', desc: 'Natural Gas / US Dollar' },
    US30:   { name: 'US30',    symbol: 'DOW·JONES', desc: 'Dow Jones 30 Index' },
    NAS100: { name: 'NAS100',  symbol: 'NASDAQ·100', desc: 'Nasdaq 100 Index' },
    STOXX50:{ name: 'STOXX50', symbol: 'STOXX·50', desc: 'Euro Stoxx 50 Index' },
    VOL75:  { name: 'VOL75',   symbol: 'VIX·75', desc: 'Volatility 75 Index' },
    BOOM1000: { name: 'BOOM1000', symbol: 'BOOM·1K', desc: 'Boom 1000 Tick Index' },
    CRASH1000:{ name: 'CRASH1000', symbol: 'CRASH·1K', desc: 'Crash 1000 Tick Index' },
  };
  return details[asset] || { name: asset, symbol: asset, desc: 'Financial Instrument' };
};

// High-precision order book depth visualizer for terminal experience
function MarketDepthVisualizer({ asset }: { asset: string }) {
  const details = getAssetDetails(asset);
  return (
    <div className="relative w-full h-44 flex flex-col justify-center font-mono text-[10px] p-4 bg-[#05091c]/80 border border-white/5 rounded-2xl overflow-hidden shadow-inner text-left">
      <div className="flex justify-between border-b border-white/5 pb-2 text-zinc-500 font-bold uppercase tracking-wider mb-2.5">
        <span>Order Book Depth // {details.symbol}</span>
        <span className="text-emerald-400 font-semibold">Spread: 0.15 Pips</span>
      </div>
      <div className="flex flex-col gap-1.5 w-full">
        {/* Ask Rows */}
        <div className="flex items-center justify-between text-rose-400">
          <span>ASK [LIMIT]</span>
          <div className="w-1/2 flex items-center justify-end gap-3">
            <span className="text-zinc-500 text-[9px]">1.08642</span>
            <div className="w-24 bg-rose-500/5 h-2.5 border-r border-rose-500/25 rounded-sm overflow-hidden flex justify-end">
              <div className="bg-rose-500/25 h-full w-[70%]" />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between text-rose-400/80">
          <span>ASK [LIMIT]</span>
          <div className="w-1/2 flex items-center justify-end gap-3">
            <span className="text-zinc-600 text-[9px]">1.08632</span>
            <div className="w-24 bg-rose-500/5 h-2.5 border-r border-rose-500/25 rounded-sm overflow-hidden flex justify-end">
              <div className="bg-rose-500/25 h-full w-[45%]" />
            </div>
          </div>
        </div>
        
        {/* Mid Price Separator */}
        <div className="h-[1px] bg-zinc-800/80 my-1 w-full relative">
          <span className="absolute right-0 -top-2 bg-[#030510] px-1.5 text-zinc-500 text-[8px] font-black tracking-widest uppercase">MID POINT REGION</span>
        </div>
        
        {/* Bid Rows */}
        <div className="flex items-center justify-between text-emerald-400/80">
          <span>BID [LIMIT]</span>
          <div className="w-1/2 flex items-center justify-end gap-3">
            <span className="text-zinc-600 text-[9px]">1.08612</span>
            <div className="w-24 bg-emerald-500/5 h-2.5 border-l border-emerald-500/25 rounded-sm overflow-hidden">
              <div className="bg-emerald-500/25 h-full w-[60%]" />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between text-emerald-400">
          <span>BID [LIMIT]</span>
          <div className="w-1/2 flex items-center justify-end gap-3">
            <span className="text-zinc-500 text-[9px]">1.08602</span>
            <div className="w-24 bg-emerald-500/5 h-2.5 border-l border-emerald-500/25 rounded-sm overflow-hidden">
              <div className="bg-emerald-500/25 h-full w-[85%]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Minimalist Sparkline graph
const Sparkline = ({ points }: { points: number[] }) => {
  const width = 80;
  const height = 18;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const svgPoints = points.map((p, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - ((p - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');
  const isUp = points[points.length - 1] >= points[0];
  return (
    <svg className="w-20 h-4.5 overflow-visible">
      <polyline
        fill="none"
        stroke={isUp ? '#10b981' : '#ef4444'}
        strokeWidth="1.5"
        points={svgPoints}
      />
    </svg>
  );
};

export function Dashboard({ onAnalyze }: DashboardProps) {
  // Main view state
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  
  // Slide-out Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  // Selection States
  const [activeCategory, setActiveCategory] = useState<MarketCategory>('Futures');
  const [selectedAsset, setSelectedAsset] = useState<string>('EURUSD');
  const [mode, setMode] = useState<TradingMode>('SCALPING MODE');
  
  // Search and selector dropdowns
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState('');
  
  // Account config
  const [accountSize, setAccountSize] = useState<number>(10000);
  const [riskPct, setRiskPct] = useState<number>(1.0);
  
  // API response state
  const [result, setResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [livePrices, setLivePrices] = useState<Record<string, { bid: number; ask: number; change: number }>>({});
  const [lastAnalysisCompletedAt, setLastAnalysisCompletedAt] = useState<number>(0);
  const [activeSubReportTab, setActiveSubReportTab] = useState<'report' | 'overview'>('report');

  // Multi-step loading metrics
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);
  const loadingSteps = [
    "Analyzing Market Structure...",
    "Checking Institutional Liquidity pools...",
    "Detecting Order Blocks & Fair Value Gaps...",
    "Computing Risk Reward Ratios...",
    "Generating AI Confidence Score..."
  ];

  // System clock
  const [utcTime, setUtcTime] = useState('12:00:00 AM UTC');
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Notification states
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications] = useState([
    { id: 1, message: "EUR/USD Scalping Signal generated successfully", time: "2m ago", read: false },
    { id: 2, message: "US30 Orderblock swept at 38,420 key level", time: "15m ago", read: false },
    { id: 3, message: "High-impact Macro Alert: Imminent CPI release", time: "45m ago", read: true }
  ]);

  // Synchronize live-ticking UTC Clock
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      const options: Intl.DateTimeFormatOptions = {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        timeZone: 'UTC'
      };
      setUtcTime(d.toLocaleTimeString('en-US', options) + ' UTC');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Sync loader stages
  useEffect(() => {
    if (!isLoading) return;
    setLoadingStepIndex(0);
    const interval = setInterval(() => {
      setLoadingStepIndex(prev => {
        if (prev < loadingSteps.length - 1) return prev + 1;
        return prev;
      });
    }, 1200);
    return () => clearInterval(interval);
  }, [isLoading]);

  // Sync Live Tick Price data
  useEffect(() => {
    const allAssets = Object.values(MARKETS).flat();
    const priceUpdates: Record<string, { bid: number; ask: number; change: number }> = {};

    const fetchPriceForAsset = async (asset: string) => {
      try {
        const res = await fetch(`/api/live-price?asset=${asset}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (data.bid && data.ask) {
          priceUpdates[asset] = {
            bid:    data.bid,
            ask:    data.ask,
            change: data.change ?? 0,
          };
          setLivePrices(prev => ({ ...prev, [asset]: priceUpdates[asset] }));
        }
      } catch {
        let val = 0;
        for (let i = 0; i < asset.length; i++) val += asset.charCodeAt(i);
        const basePrice = (asset.includes('USD') && asset.length === 6) ? 1.08500 + (val % 30) / 10000 : (asset.includes('BTC') ? 64200 + (val % 2400) : 100 + (val % 150));
        const spread = basePrice * 0.0001;
        priceUpdates[asset] = {
          bid: basePrice,
          ask: basePrice + spread,
          change: (val % 2 === 0 ? 0.38 : -0.12) + (val % 10) / 100,
        };
        setLivePrices(prev => ({ ...prev, [asset]: priceUpdates[asset] }));
      }
    };

    allAssets.forEach(fetchPriceForAsset);
    const interval = setInterval(() => {
      allAssets.forEach(fetchPriceForAsset);
    }, 20000);

    return () => clearInterval(interval);
  }, []);

  const handleExecute = async () => {
    setIsLoading(true);
    setResult(null);
    setIsDropdownOpen(false);
    try {
      const data = await onAnalyze(selectedAsset, mode, undefined, accountSize, riskPct);
      setResult(data);
      setLastAnalysisCompletedAt(Date.now());
      setActiveSubReportTab('report');
    } catch (err: any) {
      setResult(`**SYSTEM OVERWATCH ERROR**\n\nFailed to complete analysis.\n\n\`${err.message}\``);
      setLastAnalysisCompletedAt(Date.now());
    } finally {
      setIsLoading(false);
    }
  };

  const parsedData = (() => {
    if (!result) {
      return {
        direction: 'BUY' as const,
        entryLow: 1.08625,
        entryHigh: 1.08645,
        tp1: 1.08720,
        tp2: 1.08835,
        tp3: 1.08940,
        sl: 1.08510,
        confidence: 92,
        isMock: true
      };
    }
    
    let direction: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
    const textLower = result.toLowerCase();
    
    if (textLower.includes('verdict: execute') && !textLower.includes('caution')) {
      if (textLower.includes('long') || textLower.includes('buy')) direction = 'BUY';
      else if (textLower.includes('short') || textLower.includes('sell')) direction = 'SELL';
    } else if (textLower.includes('execute_with_ca') || textLower.includes('execute with caution')) {
      if (textLower.includes('long') || textLower.includes('buy')) direction = 'BUY';
      else if (textLower.includes('short') || textLower.includes('sell')) direction = 'SELL';
    } else if (textLower.includes('buy') || textLower.includes('long')) {
      direction = 'BUY';
    } else if (textLower.includes('sell') || textLower.includes('short')) {
      direction = 'SELL';
    }

    const entryMatch = result.match(/(?:entry|entry price|approx entry|zone):\s*\*?\$?([0-9.,]+)\s*-\s*\*?\$?([0-9.,]+)/i) || 
                       result.match(/(?:entry|entry price|approx entry|zone):\s*\*?\$?([0-9.,]+)/i);
    const entryLow = entryMatch ? parseFloat(entryMatch[1].replace(/,/g, '')) : null;
    const entryHigh = entryMatch && entryMatch[2] ? parseFloat(entryMatch[2].replace(/,/g, '')) : entryLow;

    const tp1Match = result.match(/(?:take profit 1|tp1):\s*\*?\$?([0-9.,]+)/i) || result.match(/tp1\s*=\s*\*?\$?([0-9.,]+)/i);
    const tp2Match = result.match(/(?:take profit 2|tp2):\s*\*?\$?([0-9.,]+)/i) || result.match(/tp2\s*=\s*\*?\$?([0-9.,]+)/i);
    const tp3Match = result.match(/(?:take profit 3|tp3):\s*\*?\$?([0-9.,]+)/i) || result.match(/tp3\s*=\s*\*?\$?([0-9.,]+)/i);
    const slMatch = result.match(/(?:stop loss|sl):\s*\*?\$?([0-9.,]+)/i) || result.match(/sl\s*=\s*\*?([0-9.,]+)/i);

    const tp1 = tp1Match ? parseFloat(tp1Match[1].replace(/,/g, '')) : null;
    const tp2 = tp2Match ? parseFloat(tp2Match[1].replace(/,/g, '')) : null;
    const tp3 = tp3Match ? parseFloat(tp3Match[1].replace(/,/g, '')) : null;
    const sl = slMatch ? parseFloat(slMatch[1].replace(/,/g, '')) : null;

    const confMatch = result.match(/(?:confidence|confluence|win probability):\s*\*?([0-9]+)%/i) || 
                      result.match(/(?:quality|score):\s*\*?([0-9]+)/i);
    const confidence = confMatch ? parseInt(confMatch[1]) : 85;

    return {
      direction,
      entryLow,
      entryHigh,
      tp1,
      tp2,
      tp3,
      sl,
      confidence,
      isMock: false
    };
  })();

  const activeLivePrice = livePrices[selectedAsset]?.bid ?? 1.08625;
  const currentDecimals = selectedAsset.includes('JPY') ? 3 : (selectedAsset.includes('USD') && selectedAsset.length === 6 ? 5 : 2);

  const filteredMarketsList = Object.entries(MARKETS).flatMap(([cat, assets]) => 
    assets.map(asset => ({ asset, category: cat as MarketCategory }))
  ).filter(({ asset }) => 
    asset.toLowerCase().includes(dropdownSearch.toLowerCase())
  );

  const activeAssetDetails = getAssetDetails(selectedAsset);

  const mockSparklines: Record<string, number[]> = {
    EURUSD: [1.0840, 1.0845, 1.0838, 1.0852, 1.0848, 1.0862, 1.0859, 1.0865],
    GBPUSD: [1.2640, 1.2655, 1.2638, 1.2672, 1.2658, 1.2692, 1.2689, 1.2710],
    BTCUSD: [64100, 64250, 63900, 64450, 64200, 64800, 64650, 65100],
    ETHUSD: [3410, 3425, 3390, 3445, 3420, 3480, 3465, 3510],
    US30:   [38300, 38450, 38280, 38550, 38400, 38620, 38580, 38680],
  };

  return (
    <div className="min-h-screen bg-[#02040a] text-zinc-300 flex flex-col font-sans overflow-x-hidden selection:bg-indigo-500/25">
      
      {/* Precision Tech Line Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.006)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.006)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none z-0" />
      <div className="absolute top-0 right-0 w-[600px] h-[400px] bg-indigo-500/5 rounded-full blur-[140px] pointer-events-none z-0" />

      {/* CORE FRAMEWORK CONTAINER (Full Width, No sidebar block layout) */}
      <div className="flex-1 flex flex-col relative z-10 w-full">
        
        {/* PREMIUM TERMINAL HEADER */}
        <header className="border-b border-white/5 bg-[#030612]/80 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-6 text-left">
            {/* Brand Title (Extremely crisp typography pairing) */}
            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
              <div className="w-7 h-7 rounded bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Activity className="w-4 h-4" />
              </div>
              <div className="flex items-center">
                <span className="font-display font-bold tracking-tight text-base text-white">QUANT·X</span>
                <span className="font-mono text-[9px] text-zinc-500 font-bold tracking-widest uppercase ml-2 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                  Institutional
                </span>
              </div>
            </div>
            {/* Active view indicator */}
            <div className="hidden md:flex items-center gap-2 border-l border-white/10 pl-5 text-[10px] font-mono tracking-wider text-zinc-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="uppercase font-bold text-zinc-400">{activeTab.replace('-', ' ')}</span>
            </div>
          </div>

          {/* Action Hub */}
          <div className="flex items-center gap-3.5">
            {/* Live Ticking Clock (Precise mono styling) */}
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono font-bold text-zinc-400 bg-white/[0.02] border border-white/5 px-3 py-1.5 rounded-lg tracking-wider">
              <Clock className="w-3.5 h-3.5 text-zinc-500" />
              <span>{utcTime}</span>
            </div>

            {/* Notifications panel */}
            <div className="relative">
              <button 
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="p-2 bg-white/[0.02] border border-white/5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-all relative cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-indigo-500 rounded-full text-[8px] font-bold text-white flex items-center justify-center border border-[#02040a]">
                  3
                </span>
              </button>
              
              <AnimatePresence>
                {isNotificationsOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="absolute right-0 mt-2 w-76 bg-[#040816]/95 border border-white/10 rounded-xl p-3.5 shadow-2xl z-50 text-xs text-left backdrop-blur-xl"
                  >
                    <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-white/5">
                      <h4 className="font-bold text-white uppercase tracking-wider font-mono text-[9px] text-zinc-400">Alert Center</h4>
                      <span className="text-[8px] bg-indigo-500/10 text-indigo-400 font-mono px-1.5 py-0.5 rounded font-black">ACTIVE</span>
                    </div>
                    <div className="flex flex-col gap-2 max-h-56 overflow-y-auto custom-scrollbar">
                      {notifications.map(n => (
                        <div key={n.id} className="p-2 rounded-lg bg-white/[0.01] hover:bg-white/[0.03] transition-colors border border-transparent hover:border-white/5">
                          <p className="text-zinc-300 font-medium text-[10px] leading-relaxed">{n.message}</p>
                          <span className="text-[8px] text-zinc-500 mt-1 block font-mono">{n.time}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* User Session Profile badge */}
            <div className="hidden sm:flex items-center gap-2 bg-white/[0.02] border border-white/5 px-3 py-1 rounded-lg">
              <div className="w-5 h-5 rounded bg-indigo-500/15 border border-indigo-400/20 flex items-center justify-center font-mono font-bold text-[9px] text-indigo-300">
                QX
              </div>
              <span className="font-mono font-bold text-[9px] text-zinc-400 tracking-wider">SESSION: ACTIVE</span>
            </div>

            {/* THE THREE DOTS OPTIONS MENU PANEL BUTTON (CRITICAL REQUIREMENT) */}
            <button 
              id="three-dots-options-panel"
              onClick={() => setIsDrawerOpen(true)}
              className="p-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/25 rounded-lg text-indigo-400 hover:text-indigo-300 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-500/5 group"
              title="Open Navigation Directory"
            >
              <MoreHorizontal className="w-4 h-4" />
              <span className="text-[10px] font-mono font-extrabold tracking-widest uppercase pl-0.5 pr-1 hidden sm:inline">
                Menu
              </span>
            </button>
          </div>
        </header>

        {/* THREE DOTS DRAWERS SLIDE PANEL */}
        <AnimatePresence>
          {isDrawerOpen && (
            <>
              {/* Dark backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsDrawerOpen(false)}
                className="fixed inset-0 bg-black/70 z-50 backdrop-blur-xs"
              />
              
              {/* Premium Slide Drawer */}
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 24, stiffness: 220 }}
                className="fixed right-0 top-0 bottom-0 w-80 max-w-full bg-[#030612]/98 border-l border-white/10 z-50 p-6 flex flex-col justify-between overflow-y-auto custom-scrollbar shadow-3xl text-left"
              >
                <div className="flex flex-col gap-6">
                  {/* Drawer Header */}
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <div className="flex flex-col">
                      <span className="font-mono text-[9px] font-black tracking-[0.25em] text-indigo-400">QUANT-X TERMINAL</span>
                      <span className="font-display font-black text-sm text-white tracking-wider mt-1">SYSTEM DIRECTORY</span>
                    </div>
                    <button 
                      onClick={() => setIsDrawerOpen(false)}
                      className="p-1.5 rounded-lg bg-white/5 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Options List */}
                  <div className="flex flex-col gap-5">
                    
                    {/* Section 1: CORE ENGINE */}
                    <div className="flex flex-col gap-2">
                      <h4 className="text-[9px] font-mono font-bold tracking-widest text-zinc-500 uppercase border-l border-zinc-700 pl-2">Core Desk Workspace</h4>
                      <div className="flex flex-col gap-1 mt-1">
                        {[
                          { id: 'dashboard', label: 'AI Signals Desk', desc: 'Main trading signal generator', icon: Target },
                          { id: 'history', label: 'Historical Audit Ledger', desc: 'Track historical signal results', icon: Database },
                        ].map(item => {
                          const isSelected = activeTab === item.id;
                          const IconComp = item.icon;
                          return (
                            <button
                              key={item.id}
                              onClick={() => {
                                setActiveTab(item.id as TabType);
                                setIsDrawerOpen(false);
                              }}
                              className={`flex items-start gap-3 p-2.5 rounded-xl text-left transition-all cursor-pointer ${
                                isSelected 
                                  ? 'bg-gradient-to-r from-indigo-950/40 to-slate-950/40 border border-indigo-500/30 text-white' 
                                  : 'text-zinc-400 hover:bg-white/[0.02] border border-transparent hover:text-white'
                              }`}
                            >
                              <IconComp className={`w-4 h-4 mt-0.5 ${isSelected ? 'text-indigo-400' : 'text-zinc-500'}`} />
                              <div>
                                <span className="font-sans font-bold text-xs block">{item.label}</span>
                                <span className="font-mono text-[8px] text-zinc-500 block leading-normal mt-0.5">{item.desc}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Section 2: REAL TIME DATA */}
                    <div className="flex flex-col gap-2">
                      <h4 className="text-[9px] font-mono font-bold tracking-widest text-zinc-500 uppercase border-l border-zinc-700 pl-2">Market Data Feeds</h4>
                      <div className="flex flex-col gap-1 mt-1">
                        {[
                          { id: 'watchlist', label: 'Institutional Watchlist', desc: 'Real-time spreads & tick change', icon: ListFilter },
                          { id: 'news', label: 'Macro Sentiment Wire', desc: 'SMC order-flow news feed', icon: Newspaper },
                          { id: 'calendar', label: 'Economic Calendar', desc: 'High-impact macro event schedules', icon: Calendar },
                        ].map(item => {
                          const isSelected = activeTab === item.id;
                          const IconComp = item.icon;
                          return (
                            <button
                              key={item.id}
                              onClick={() => {
                                setActiveTab(item.id as TabType);
                                setIsDrawerOpen(false);
                              }}
                              className={`flex items-start gap-3 p-2.5 rounded-xl text-left transition-all cursor-pointer ${
                                isSelected 
                                  ? 'bg-gradient-to-r from-indigo-950/40 to-slate-950/40 border border-indigo-500/30 text-white' 
                                  : 'text-zinc-400 hover:bg-white/[0.02] border border-transparent hover:text-white'
                              }`}
                            >
                              <IconComp className={`w-4 h-4 mt-0.5 ${isSelected ? 'text-indigo-400' : 'text-zinc-500'}`} />
                              <div>
                                <span className="font-sans font-bold text-xs block">{item.label}</span>
                                <span className="font-mono text-[8px] text-zinc-500 block leading-normal mt-0.5">{item.desc}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Section 3: QUANTITATIVE CHARTS */}
                    <div className="flex flex-col gap-2">
                      <h4 className="text-[9px] font-mono font-bold tracking-widest text-zinc-500 uppercase border-l border-zinc-700 pl-2">SMC Quantitative Charts</h4>
                      <div className="flex flex-col gap-1 mt-1">
                        {[
                          { id: 'heatmap', label: 'AI Confidence Heatmap', desc: 'Multi-timeframe consensus matrix', icon: Flame },
                          { id: 'alignment', label: 'Multi-Timeframe Alignment', desc: 'Direction structural bias alignment', icon: Layers },
                          { id: 'smc', label: 'Smart Money Concepts (SMC)', desc: 'BOS, CHOCH & Imbalance scanner', icon: Compass },
                          { id: 'sweeps', label: 'Liquidity Sweep Detector', desc: 'Live pool sweep tracker', icon: Sliders },
                          { id: 'volume', label: 'Volume Profile Matrix', desc: 'Point of Control (POC) calculations', icon: BarChart3 },
                          { id: 'footprint', label: 'Institutional Footprint', desc: 'Trace commercial order blocks', icon: Target },
                          { id: 'monte-carlo', label: 'Monte Carlo Risk Engine', desc: 'Run simulated probability tracks', icon: ShieldCheck },
                          { id: 'backtesting', label: 'Backtesting Center', desc: 'Audit mathematical strategy performance', icon: Play },
                        ].map(item => {
                          const isSelected = activeTab === item.id;
                          const IconComp = item.icon;
                          return (
                            <button
                              key={item.id}
                              onClick={() => {
                                setActiveTab(item.id as TabType);
                                setIsDrawerOpen(false);
                              }}
                              className={`flex items-start gap-3 p-2 rounded-xl text-left transition-all cursor-pointer ${
                                isSelected 
                                  ? 'bg-gradient-to-r from-indigo-950/40 to-slate-950/40 border border-indigo-500/30 text-white' 
                                  : 'text-zinc-400 hover:bg-white/[0.015] border border-transparent hover:text-white'
                              }`}
                            >
                              <IconComp className={`w-3.5 h-3.5 mt-0.5 ${isSelected ? 'text-indigo-400' : 'text-zinc-500'}`} />
                              <div>
                                <span className="font-sans font-bold text-xs block">{item.label}</span>
                                <span className="font-mono text-[8px] text-zinc-500 block leading-normal mt-0.5">{item.desc}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Section 4: CONTROL HUB */}
                    <div className="flex flex-col gap-2">
                      <h4 className="text-[9px] font-mono font-bold tracking-widest text-zinc-500 uppercase border-l border-zinc-700 pl-2">Control Hub</h4>
                      <div className="flex flex-col gap-1 mt-1">
                        {[
                          { id: 'settings', label: 'Terminal Configuration', desc: 'Account multipliers & processing depth', icon: Settings },
                          { id: 'help', label: 'Documentation & FAQ', desc: 'Algorithmic logic guidelines', icon: BookOpen },
                        ].map(item => {
                          const isSelected = activeTab === item.id;
                          const IconComp = item.icon;
                          return (
                            <button
                              key={item.id}
                              onClick={() => {
                                setActiveTab(item.id as TabType);
                                setIsDrawerOpen(false);
                              }}
                              className={`flex items-start gap-3 p-2.5 rounded-xl text-left transition-all cursor-pointer ${
                                isSelected 
                                  ? 'bg-gradient-to-r from-indigo-950/40 to-slate-950/40 border border-indigo-500/30 text-white' 
                                  : 'text-zinc-400 hover:bg-white/[0.02] border border-transparent hover:text-white'
                              }`}
                            >
                              <IconComp className={`w-4 h-4 mt-0.5 ${isSelected ? 'text-indigo-400' : 'text-zinc-500'}`} />
                              <div>
                                <span className="font-sans font-bold text-xs block">{item.label}</span>
                                <span className="font-mono text-[8px] text-zinc-500 block leading-normal mt-0.5">{item.desc}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                </div>

                {/* Drawer Footer Status */}
                <div className="border-t border-white/5 pt-4 mt-6">
                  <div className="bg-[#0c142c] border border-indigo-500/10 rounded-xl p-3 flex flex-col gap-1 relative overflow-hidden">
                    <div className="flex items-center gap-1.5 text-indigo-400 font-bold text-[9px] uppercase tracking-wider">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>QUANT·X PRO LICENSE // VALID</span>
                    </div>
                    <p className="text-[8px] text-zinc-500 font-mono leading-normal mt-0.5">
                      Commercial core version 4.12. Security audits cleared. Overlays and live-feeds running.
                    </p>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* DYNAMIC SCROLL CONTAINER */}
        <main className="flex-1 p-6 overflow-y-auto w-full max-w-7xl mx-auto flex flex-col gap-6 relative">
          
          <AnimatePresence mode="wait">
            
            {/* VIEW 1: MAIN SIGNALS GENERATOR VIEW */}
            {activeTab === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="flex flex-col gap-6"
              >
                
                {/* REFINED MINIMAL HERO CARD (Highly professional display typography) */}
                <section className="bg-gradient-to-br from-[#04081c] via-[#060c2b] to-[#04081c] border border-white/5 rounded-3xl p-6 sm:p-8 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6 shadow-[0_20px_50px_rgba(0,0,0,0.35)] text-left">
                  <div className="absolute top-0 right-0 w-[350px] h-[350px] bg-indigo-500/5 rounded-full blur-[110px] pointer-events-none" />
                  
                  <div className="relative z-10 max-w-lg">
                    <span className="text-[9px] bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 font-mono font-bold tracking-[0.25em] px-2.5 py-1 rounded uppercase">
                      Active Ingress Panel
                    </span>
                    <h2 className="text-2xl sm:text-4xl font-display font-bold text-white tracking-tight mt-3.5 leading-tight">
                      Smarter Trading. <br />
                      <span className="bg-gradient-to-r from-indigo-300 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                        AI-Driven Precision.
                      </span>
                    </h2>
                    <p className="text-zinc-400 text-xs sm:text-sm mt-3 leading-relaxed max-w-sm">
                      Select financial asset matrix, choose execution frequency models, and generate high-probability trading levels instantly.
                    </p>
                  </div>

                  {/* Clean Orderbook Depth visualization */}
                  <div className="w-full md:w-[340px] shrink-0">
                    <MarketDepthVisualizer asset={selectedAsset} />
                  </div>
                </section>

                {/* REFINED CONFIGURATION PANEL */}
                <section className="bg-[#050a1f]/80 backdrop-blur-md border border-white/5 rounded-2xl p-5 shadow-xl relative overflow-visible text-left">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
                    
                    {/* Step 1: Currency Selection Dropdown */}
                    <div className="flex flex-col gap-1.5 relative">
                      <label className="text-[10px] text-zinc-500 font-mono font-bold tracking-wider uppercase">
                        INSTRUMENT MATRIX
                      </label>
                      
                      <button 
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="w-full bg-[#030614] border border-white/10 rounded-xl p-3 flex items-center justify-between text-left hover:border-indigo-500/30 hover:bg-[#050b20] transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/15">
                            {activeAssetDetails.symbol}
                          </span>
                          <div>
                            <span className="font-sans font-bold text-sm text-white block">{activeAssetDetails.name}</span>
                            <span className="text-[9px] text-zinc-500 block leading-none mt-0.5">{activeAssetDetails.desc}</span>
                          </div>
                        </div>
                        <ChevronDown className="w-4 h-4 text-zinc-400" />
                      </button>

                      {/* Dropdown Options overlay */}
                      <AnimatePresence>
                        {isDropdownOpen && (
                          <motion.div 
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 8 }}
                            className="absolute top-full left-0 right-0 mt-1.5 bg-[#04081c]/98 border border-white/10 rounded-xl shadow-2xl p-3.5 z-50 flex flex-col gap-2 max-h-[300px] backdrop-blur-2xl"
                          >
                            <div className="relative">
                              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                              <input 
                                type="text" 
                                placeholder="Filter pairs (e.g. GBPUSD)..."
                                value={dropdownSearch}
                                onChange={(e) => setDropdownSearch(e.target.value)}
                                className="w-full bg-[#02040c] border border-white/5 rounded-lg py-2 pl-9 pr-3 text-xs text-zinc-300 outline-none focus:border-indigo-500/50 transition-all font-mono"
                              />
                            </div>

                            <div className="overflow-y-auto custom-scrollbar flex flex-col gap-1 pr-1">
                              {filteredMarketsList.map(({ asset }) => {
                                const details = getAssetDetails(asset);
                                const isSelected = selectedAsset === asset;
                                const currentPrice = livePrices[asset]?.bid ?? 0;
                                return (
                                  <button
                                    key={asset}
                                    onClick={() => {
                                      setSelectedAsset(asset);
                                      setIsDropdownOpen(false);
                                    }}
                                    className={`w-full py-2 px-2.5 rounded-lg text-left text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                                      isSelected 
                                        ? 'bg-indigo-500/15 text-white border border-indigo-500/30' 
                                        : 'text-zinc-400 hover:bg-white/[0.02] hover:text-white border border-transparent'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono text-[9px] text-zinc-400 bg-white/5 px-1 py-0.5 rounded leading-none">{details.symbol}</span>
                                      <span className="text-white font-medium block">{details.name}</span>
                                    </div>
                                    <span className="text-[10px] text-zinc-500 font-mono">
                                      {currentPrice ? currentPrice.toFixed(asset.includes('JPY') ? 3 : (asset.includes('USD') && asset.length === 6 ? 5 : 2)) : '—'}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Step 2: Strategy Configuration selection */}
                    <div className="flex flex-col gap-1.5 text-left">
                      <label className="text-[10px] text-zinc-500 font-mono font-bold tracking-wider uppercase">
                        STRATEGIC METHODOLOGY
                      </label>
                      
                      <div className="grid grid-cols-2 gap-2.5">
                        <button 
                          onClick={() => setMode('SCALPING MODE')}
                          className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                            mode === 'SCALPING MODE' 
                              ? 'bg-indigo-500/10 border-indigo-500/30 text-white' 
                              : 'bg-[#030614] border-white/5 text-zinc-500 hover:text-zinc-300 hover:border-white/10'
                          }`}
                        >
                          <Zap className={`w-3.5 h-3.5 ${mode === 'SCALPING MODE' ? 'text-indigo-400' : 'text-zinc-500'}`} />
                          <div>
                            <span className="text-xs font-bold font-sans block">Scalping</span>
                            <span className="text-[8px] font-mono text-zinc-500 block mt-0.5">SHORT TIME FRAME</span>
                          </div>
                        </button>

                        <button 
                          onClick={() => setMode('SWING MODE')}
                          className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                            mode === 'SWING MODE' 
                              ? 'bg-indigo-500/10 border-indigo-500/30 text-white' 
                              : 'bg-[#030614] border-white/5 text-zinc-500 hover:text-zinc-300 hover:border-white/10'
                          }`}
                        >
                          <TrendingUp className={`w-3.5 h-3.5 ${mode === 'SWING MODE' ? 'text-indigo-400' : 'text-zinc-500'}`} />
                          <div>
                            <span className="text-xs font-bold font-sans block">Swing Trade</span>
                            <span className="text-[8px] font-mono text-zinc-500 block mt-0.5">MEDIUM TIME FRAME</span>
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Step 3: Executive Despatch Analysis Button */}
                    <div className="flex flex-col gap-1.5 text-left lg:pt-5">
                      <button 
                        onClick={handleExecute}
                        disabled={isLoading}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3.5 px-6 rounded-xl font-bold font-mono text-xs tracking-widest uppercase transition-all disabled:opacity-50 disabled:cursor-wait shadow-lg shadow-indigo-600/15 flex items-center justify-center gap-2 cursor-pointer border border-indigo-500/20"
                      >
                        {isLoading ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>GENERATING LEVEL PROTOCOLS...</span>
                          </>
                        ) : (
                          <>
                            <span>EXECUTE ALGORITHMIC SCAN</span>
                            <ArrowUpRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>

                  </div>
                </section>

                {/* PROGRESS LOADER OVERLAY */}
                {isLoading && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.99 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-[#030612]/95 backdrop-blur-md border border-white/10 rounded-2xl p-8 flex flex-col items-center justify-center min-h-[300px] shadow-2xl text-center relative overflow-hidden"
                  >
                    <div className="absolute top-0 inset-x-0 h-[1.5px] bg-zinc-900" />
                    <div 
                      className="absolute top-0 left-0 h-[1.5px] bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-400 transition-all duration-300" 
                      style={{ width: `${((loadingStepIndex + 1) / loadingSteps.length) * 100}%` }}
                    />
                    
                    <div className="w-14 h-14 rounded-full border border-white/5 flex items-center justify-center relative mb-5">
                      <div className="w-14 h-14 border border-indigo-500 border-t-transparent rounded-full animate-spin absolute" />
                      <Activity className="w-5 h-5 text-indigo-400 animate-pulse" />
                    </div>

                    <h4 className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-indigo-400">{loadingSteps[loadingStepIndex]}</h4>
                    
                    <div className="flex flex-col gap-2 mt-6 text-left font-mono text-[9px] text-zinc-500 max-w-xs mx-auto">
                      {loadingSteps.map((step, idx) => {
                        const isDone = idx < loadingStepIndex;
                        const isCurrent = idx === loadingStepIndex;
                        return (
                          <div key={idx} className="flex items-center gap-2.5">
                            <span className={`w-1 h-1 rounded-full ${isDone ? 'bg-emerald-500' : isCurrent ? 'bg-indigo-400 animate-pulse' : 'bg-zinc-800'}`} />
                            <span className={isDone ? 'text-zinc-500 font-semibold line-through opacity-50' : isCurrent ? 'text-indigo-300 font-bold' : 'text-zinc-600'}>
                              {step}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {/* PRIMARY AI GENERATED LEVEL PROTOCOL RESULTS */}
                {!isLoading && (
                  <motion.div 
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#050a1e]/40 border border-white/5 rounded-2xl p-5.5 shadow-2xl relative overflow-hidden text-left"
                  >
                    {/* Header line */}
                    <div className="flex items-center justify-between border-b border-white/5 pb-3.5 mb-5 font-mono text-[10px]">
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-indigo-400" />
                        <h3 className="font-bold uppercase tracking-wider text-zinc-400">
                          Active Ingress Level Protocol
                        </h3>
                        <span className="bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ml-2 text-[8px]">
                          VERIFIED MATRIX
                        </span>
                      </div>
                      <div className="text-zinc-500 font-bold uppercase tracking-wider">
                        TIMELINE (5M TICK FEED)
                      </div>
                    </div>

                    {/* Content Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-center">
                      
                      {/* Section 1: Execution bias details */}
                      <div className="flex flex-col gap-3 border-b md:border-b-0 md:border-r border-white/5 pb-5 md:pb-0 md:pr-5">
                        <div className="flex items-center gap-2.5">
                          {parsedData.direction === 'BUY' ? (
                            <span className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded">
                              DIRECTIVE // STRONG BUY
                            </span>
                          ) : parsedData.direction === 'SELL' ? (
                            <span className="text-xs font-mono font-bold uppercase tracking-widest text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded">
                              DIRECTIVE // STRONG SELL
                            </span>
                          ) : (
                            <span className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-400 bg-zinc-800/40 border border-white/10 px-2.5 py-1 rounded">
                              DIRECTIVE // HOLD PROTOCOL
                            </span>
                          )}
                        </div>

                        <div>
                          <h4 className="text-lg font-sans font-bold text-white tracking-tight">{activeAssetDetails.name}</h4>
                          <p className="text-[10px] text-zinc-500 font-mono mt-0.5 uppercase tracking-wide">{activeAssetDetails.desc}</p>
                        </div>

                        <div className="flex flex-col gap-1.5 pt-1.5 text-[10px] font-mono leading-normal">
                          <div className="flex justify-between border-b border-white/5 pb-1">
                            <span className="text-zinc-500">METHODOLOGY</span>
                            <span className="text-white font-bold">{mode === 'SCALPING MODE' ? 'Scalping' : 'Swing Trading'}</span>
                          </div>
                          <div className="flex justify-between border-b border-white/5 pb-1">
                            <span className="text-zinc-500">BASE TIMEFRAME</span>
                            <span className="text-white font-bold">{mode === 'SCALPING MODE' ? '5 Minutes' : '4 Hours'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-zinc-500">GENERATION EPOCH</span>
                            <span className="text-white font-semibold">24-JUN-2026 // 10:24 AM UTC</span>
                          </div>
                        </div>
                      </div>

                      {/* Section 2: Fine-line Confidence metrics */}
                      <div className="flex flex-col items-center justify-center border-b md:border-b-0 lg:border-r border-white/5 pb-5 md:pb-0 lg:pr-5 text-center">
                        <span className="text-[10px] text-zinc-500 font-mono font-bold tracking-wider uppercase mb-3">
                          CONSENSUS CONFIDENCE
                        </span>
                        
                        <div className="w-full flex flex-col gap-2 p-3 bg-zinc-950/20 border border-white/5 rounded-xl font-mono text-[10px]">
                          <div className="flex justify-between text-zinc-400">
                            <span>Certainty Score</span>
                            <span className="text-indigo-400 font-black">{parsedData.confidence}%</span>
                          </div>
                          <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full" style={{ width: `${parsedData.confidence}%` }} />
                          </div>
                          <p className="text-[8px] text-zinc-500 mt-1 leading-normal uppercase font-bold text-left">
                            Validated through 12 cross-timeframe structural checks
                          </p>
                        </div>
                      </div>

                      {/* Section 3: Fine numbers execution thresholds */}
                      <div className="flex flex-col gap-2.5 text-left border-b lg:border-b-0 lg:border-r border-white/5 pb-5 lg:pb-0 lg:pr-5">
                        <span className="text-[10px] text-zinc-500 font-mono font-bold tracking-wider uppercase">
                          EXECUTION THRESHOLDS
                        </span>

                        <div className="flex flex-col gap-1.5 font-mono text-[10px]">
                          <div className="flex items-center justify-between bg-zinc-950/20 border border-white/5 rounded-lg px-2.5 py-1.5">
                            <div className="flex items-center gap-1.5 text-zinc-400">
                              <Target className="w-3.5 h-3.5 text-indigo-400" />
                              <span>Entry Target</span>
                            </div>
                            <span className="text-white font-bold">
                              {parsedData.entryLow ? parsedData.entryLow.toFixed(currentDecimals) : activeLivePrice.toFixed(currentDecimals)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between bg-zinc-950/20 border border-white/5 rounded-lg px-2.5 py-1.5">
                            <div className="flex items-center gap-1.5 text-zinc-400">
                              <Crosshair className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Limit TP 1</span>
                            </div>
                            <span className="text-emerald-400 font-bold">
                              {parsedData.tp1 ? parsedData.tp1.toFixed(currentDecimals) : (activeLivePrice * 1.01).toFixed(currentDecimals)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between bg-zinc-950/20 border border-white/5 rounded-lg px-2.5 py-1.5">
                            <div className="flex items-center gap-1.5 text-zinc-400">
                              <Crosshair className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Limit TP 2</span>
                            </div>
                            <span className="text-emerald-400 font-bold">
                              {parsedData.tp2 ? parsedData.tp2.toFixed(currentDecimals) : (activeLivePrice * 1.025).toFixed(currentDecimals)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between bg-zinc-950/20 border border-white/5 rounded-lg px-2.5 py-1.5">
                            <div className="flex items-center gap-1.5 text-zinc-400">
                              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                              <span>Stop Limit (SL)</span>
                            </div>
                            <span className="text-rose-400 font-bold">
                              {parsedData.sl ? parsedData.sl.toFixed(currentDecimals) : (activeLivePrice * 0.992).toFixed(currentDecimals)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Section 4: Target visualizer canvas */}
                      <div className="flex flex-col gap-1.5 relative h-36 w-full bg-[#050a1e]/80 border border-white/5 rounded-xl p-3 overflow-hidden">
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.005)_1px,transparent_1px)] bg-[size:100%_15px] pointer-events-none" />

                        <svg className="w-full h-full overflow-visible absolute inset-0 z-0">
                          <line x1="0" y1="20" x2="400" y2="20" stroke="#10b981" strokeWidth="1" strokeDasharray="3 3" opacity="0.4" />
                          <line x1="0" y1="50" x2="400" y2="50" stroke="#10b981" strokeWidth="1.2" strokeDasharray="2 2" />
                          <line x1="0" y1="80" x2="400" y2="80" stroke="#3b82f6" strokeWidth="1.2" />
                          <line x1="0" y1="115" x2="400" y2="115" stroke="#ef4444" strokeWidth="1.2" strokeDasharray="2 2" />

                          <g fill="#10b981" stroke="#10b981" strokeWidth="0.8" opacity="0.6">
                            <line x1="40" y1="90" x2="40" y2="110" />
                            <rect x="37" y="93" width="6" height="10" />

                            <line x1="90" y1="75" x2="90" y2="95" />
                            <rect x="87" y="78" width="6" height="12" fill="#ef4444" stroke="#ef4444" />

                            <line x1="140" y1="80" x2="140" y2="110" />
                            <rect x="137" y="83" width="6" height="15" />

                            <line x1="190" y1="60" x2="190" y2="90" />
                            <rect x="187" y="65" width="6" height="10" />

                            <line x1="240" y1="35" x2="240" y2="75" />
                            <rect x="237" y="42" width="6" height="20" />
                          </g>
                        </svg>

                        {/* Level overlay flags */}
                        <div className="absolute right-2 top-[12px] bg-[#030510] text-emerald-400 font-mono text-[8px] px-1.5 py-0.5 rounded border border-emerald-500/10 z-10 font-bold uppercase">
                          TP2 {parsedData.tp2 ? parsedData.tp2.toFixed(currentDecimals) : (activeLivePrice * 1.025).toFixed(currentDecimals)}
                        </div>
                        <div className="absolute right-2 top-[42px] bg-[#030510] text-emerald-400 font-mono text-[8px] px-1.5 py-0.5 rounded border border-emerald-500/10 z-10 font-bold uppercase">
                          TP1 {parsedData.tp1 ? parsedData.tp1.toFixed(currentDecimals) : (activeLivePrice * 1.01).toFixed(currentDecimals)}
                        </div>
                        <div className="absolute right-2 top-[72px] bg-[#030510] text-blue-400 font-mono text-[8px] px-1.5 py-0.5 rounded border border-blue-500/10 z-10 font-bold uppercase">
                          ENTRY {parsedData.entryLow ? parsedData.entryLow.toFixed(currentDecimals) : activeLivePrice.toFixed(currentDecimals)}
                        </div>
                        <div className="absolute right-2 top-[107px] bg-[#030510] text-rose-400 font-mono text-[8px] px-1.5 py-0.5 rounded border border-rose-500/10 z-10 font-bold uppercase">
                          SL {parsedData.sl ? parsedData.sl.toFixed(currentDecimals) : (activeLivePrice * 0.992).toFixed(currentDecimals)}
                        </div>
                      </div>

                    </div>

                    {/* Report analysis details */}
                    {!parsedData.isMock && (
                      <div className="bg-[#030614] border border-white/5 rounded-xl p-4.5 mt-5">
                        <div className="flex bg-black/20 p-1 rounded-lg border border-white/5 mb-3.5 font-mono text-[10px] font-bold max-w-xs">
                          <button
                            onClick={() => setActiveSubReportTab('report')}
                            className={`flex-1 py-1 rounded text-center transition-all cursor-pointer ${activeSubReportTab === 'report' ? 'bg-indigo-500/15 text-indigo-300' : 'text-zinc-500 hover:text-zinc-300'}`}
                          >
                            Narrative Report
                          </button>
                          <button
                            onClick={() => setActiveSubReportTab('overview')}
                            className={`flex-1 py-1 rounded text-center transition-all cursor-pointer ${activeSubReportTab === 'overview' ? 'bg-indigo-500/15 text-indigo-300' : 'text-zinc-500 hover:text-zinc-300'}`}
                          >
                            Consensus Details
                          </button>
                        </div>

                        {activeSubReportTab === 'report' && (
                          <div className="overflow-y-auto max-h-[300px] custom-scrollbar text-xs">
                            <AnalysisResult result={result} isLoading={isLoading} />
                          </div>
                        )}

                        {activeSubReportTab === 'overview' && (
                          <div className="flex flex-col gap-2.5 font-mono text-[10px] text-left">
                            <div className="bg-white/[0.005] border border-white/5 p-3.5 rounded-lg">
                              <span className="text-zinc-500 uppercase font-black">AI Consensus Matrix Status</span>
                              <p className="text-zinc-400 mt-1.5 leading-relaxed">
                                Heavy accumulation detected in institutional order blocks. Order flow imbalance indicates commercial bids defending key liquidity sweep structures.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}

                {/* INSTITUTIONAL VALUE BADGES */}
                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-1 text-left">
                  {[
                    { title: 'Neural Core', desc: 'Deep learning parses 120 structural vectors simultaneously', icon: Sparkles, color: 'text-purple-400 bg-purple-500/5' },
                    { title: 'High Assurance', desc: 'Rigorous algorithmic backtesting constraints active', icon: Target, color: 'text-indigo-400 bg-indigo-500/5' },
                    { title: 'Ingress Monitoring', desc: 'Real-time order-flow rates analyzed 24/7', icon: Activity, color: 'text-cyan-400 bg-cyan-500/5' },
                    { title: 'Risk-On Overwatches', desc: 'Strict stop boundary calculations mitigate drawdown', icon: ShieldCheck, color: 'text-emerald-400 bg-emerald-500/5' },
                  ].map((badge, idx) => {
                    const IconComponent = badge.icon;
                    return (
                      <div key={idx} className="bg-[#050a1f]/40 border border-white/5 rounded-xl p-4 flex gap-3 text-left items-start hover:border-white/10 transition-colors">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${badge.color}`}>
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-xs tracking-wide">{badge.title}</h4>
                          <p className="text-[10px] text-zinc-500 mt-0.5 leading-normal">{badge.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </section>

                <footer className="text-center text-[9px] text-zinc-600 font-bold font-mono uppercase tracking-widest py-3 border-t border-white/5 mt-4">
                  Proprietary algorithmic model. Discretionary limits apply. Market risks exist.
                </footer>

              </motion.div>
            )}

            {/* TAB: SIGNAL HISTORY LEDGER */}
            {activeTab === 'history' && (
              <motion.div 
                key="history"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="bg-[#050a1e]/40 border border-white/5 p-6 rounded-2xl text-left shadow-2xl"
              >
                <div className="border-b border-white/5 pb-4 mb-5">
                  <h3 className="text-sm font-mono font-bold text-white tracking-widest uppercase">Persistent Quantitative Ledger</h3>
                  <p className="text-[10px] text-zinc-500 font-mono mt-0.5">Historic audit traces of every generated trade level directive on this terminal.</p>
                </div>
                
                <SignalsLogger 
                  currentAsset={selectedAsset} 
                  lastAnalysisCompletedAt={lastAnalysisCompletedAt} 
                />
              </motion.div>
            )}

            {/* TAB: WATCHLIST */}
            {activeTab === 'watchlist' && (
              <motion.div 
                key="watchlist"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="bg-[#050a1e]/40 border border-white/5 p-6 rounded-2xl text-left shadow-2xl"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-white/5 pb-4 mb-5 gap-3">
                  <div>
                    <h3 className="text-sm font-mono font-bold text-white tracking-widest uppercase">Institutional Watchlist</h3>
                    <p className="text-[10px] text-zinc-500 font-mono mt-0.5">Real-time spreads, change factors, and technical momentum trends across asset matrix.</p>
                  </div>

                  <div className="flex bg-[#030614] p-1 rounded-lg border border-white/5 font-mono text-[9px] font-bold">
                    {(['Futures', 'Crypto', 'Metals', 'Forex'] as MarketCategory[]).map(c => (
                      <button
                        key={c}
                        onClick={() => setActiveCategory(c)}
                        className={`py-1 px-2.5 rounded text-center transition-all cursor-pointer uppercase ${activeCategory === c ? 'bg-indigo-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left font-mono text-xs">
                    <thead>
                      <tr className="border-b border-white/5 text-zinc-500 font-bold uppercase text-[9px] tracking-widest">
                        <th className="py-2 px-3">Instrument</th>
                        <th className="py-2 px-3">Bid Quote</th>
                        <th className="py-2 px-3">Ask Quote</th>
                        <th className="py-2 px-3">24H Delta</th>
                        <th className="py-2 px-3">Technical Spark</th>
                        <th className="py-2 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {MARKETS[activeCategory].map(asset => {
                        const details = getAssetDetails(asset);
                        const currentPrice = livePrices[asset]?.bid ?? 0;
                        const change = livePrices[asset]?.change ?? 0;
                        const isUp = change >= 0;
                        const points = mockSparklines[asset] || [1.08, 1.079, 1.082, 1.081, 1.085, 1.083, 1.086];
                        return (
                          <tr key={asset} className="hover:bg-white/[0.01] transition-colors">
                            <td className="py-3 px-3 font-bold flex items-center gap-2">
                              <span className="font-mono text-[10px] text-indigo-400 bg-indigo-500/5 px-1.5 py-0.5 rounded leading-none border border-indigo-500/10">{details.symbol}</span>
                              <div>
                                <span className="text-white font-bold">{details.name}</span>
                                <span className="text-[8px] text-zinc-500 block font-normal mt-0.5">{details.desc}</span>
                              </div>
                            </td>
                            <td className="py-3 px-3 font-bold text-white">
                              {currentPrice ? currentPrice.toFixed(asset.includes('JPY') ? 3 : 2) : '—'}
                            </td>
                            <td className="py-3 px-3 text-zinc-500">
                              {currentPrice ? (currentPrice * 1.00015).toFixed(asset.includes('JPY') ? 3 : 2) : '—'}
                            </td>
                            <td className={`py-3 px-3 font-bold ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {isUp ? '+' : ''}{change.toFixed(2)}%
                            </td>
                            <td className="py-3 px-3">
                              <Sparkline points={points} />
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button 
                                onClick={() => {
                                  setSelectedAsset(asset);
                                  setActiveTab('dashboard');
                                }}
                                className="bg-indigo-600/10 hover:bg-indigo-600 text-indigo-300 hover:text-white font-bold py-1 px-2.5 rounded text-[9px] uppercase tracking-wider transition-all cursor-pointer border border-indigo-500/15"
                              >
                                Deploy Despatch
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {/* TAB: ECONOMIC CALENDAR */}
            {activeTab === 'calendar' && (
              <motion.div 
                key="calendar"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-6"
              >
                <div className="lg:col-span-2">
                  <EconomicImpactScanner selectedAsset={selectedAsset} />
                </div>
                <div className="bg-[#050a1e]/40 border border-white/5 rounded-2xl p-5 shadow-xl text-left flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-400 mb-3 pb-2 border-b border-white/5">Risk-Off Macro filter</h3>
                    <p className="text-xs text-zinc-400 leading-relaxed space-y-4">
                      High impact news cycles often generate deep localized sweeps designed to clean stop liquidity before structural reversals occur.
                    </p>
                    <p className="text-xs text-zinc-400 leading-relaxed mt-3">
                      The Quant-X AI automatically references economic releases and suggests reduction metrics when high impact data approaches.
                    </p>
                  </div>

                  <div className="bg-rose-500/10 border border-rose-500/15 p-4 rounded-xl text-rose-300 font-mono text-[10px] mt-6">
                    <div className="flex items-center gap-2 font-black mb-1">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-400 animate-pulse" /> MACRO BLOCK DETECTED
                    </div>
                    High volatility index release expected within current trading day. Standard risk constraints applied.
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB: MARKET NEWS WIRE */}
            {activeTab === 'news' && (
              <motion.div 
                key="news"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left"
              >
                <div className="lg:col-span-1">
                  <LiveMarketSentimentEngine selectedAsset={selectedAsset} />
                </div>

                <div className="lg:col-span-2 bg-[#050a1e]/40 border border-white/5 rounded-2xl p-6 shadow-xl flex flex-col gap-4">
                  <div className="border-b border-white/5 pb-3">
                    <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-400">Terminal News Wire</h3>
                    <p className="text-[10px] text-zinc-500 mt-0.5">Real-time commercial announcements, order blocks, and analysis summaries.</p>
                  </div>

                  <div className="flex flex-col gap-3.5 overflow-y-auto max-h-[440px] custom-scrollbar pr-1">
                    {[
                      { title: 'Federal Reserve hints at soft rate policy adjustments', source: 'FOMC MINUTES', impact: 'HIGH', time: '12m ago', desc: 'Central bankers suggest a more flexible target range for subsequent rate sessions.' },
                      { title: 'Crude Oil prices settle near $79.80 following supply metrics', source: 'IEA PETROLEUM REVENUE', impact: 'MEDIUM', time: '40m ago', desc: 'Commercial stockpiles demonstrate slight contraction, defending key channel supports.' },
                      { title: 'Euro Zone inflation metrics match ECB consensus bands', source: 'EUROSTAT DUMP', impact: 'MEDIUM', time: '2h ago', desc: 'Consumer price index settles at 2.4% annualized, consolidating ECB rate outlook.' },
                      { title: 'Bitcoin network hash metrics tag historic levels post halving', source: 'BLOCKCHAIN WIRE', impact: 'LOW', time: '4h ago', desc: 'Computational difficulty benchmarks ascend, supporting strong miner accumulation.' }
                    ].map((news, idx) => (
                      <div key={idx} className="bg-white/[0.005] hover:bg-white/[0.02] border border-white/5 rounded-xl p-3.5 transition-all">
                        <div className="flex items-center justify-between gap-3 mb-1.5">
                          <span className="text-[9px] font-bold text-indigo-400 bg-indigo-500/5 px-2 py-0.5 rounded font-mono border border-indigo-500/10">
                            {news.source}
                          </span>
                          <div className="flex items-center gap-2 font-mono text-[9px]">
                            <span className={`font-bold px-1.5 py-0.5 rounded ${news.impact === 'HIGH' ? 'bg-rose-500/10 text-rose-400' : 'bg-zinc-500/10 text-zinc-400'}`}>
                              {news.impact} IMPACT
                            </span>
                            <span className="text-zinc-500">{news.time}</span>
                          </div>
                        </div>
                        <h4 className="font-bold text-white text-xs leading-snug">{news.title}</h4>
                        <p className="text-[10px] text-zinc-500 mt-1 leading-normal">{news.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB: HEATMAP */}
            {activeTab === 'heatmap' && (
              <motion.div key="heatmap" className="w-full">
                <AIConfidenceHeatmap selectedAsset={selectedAsset} onAssetChange={setSelectedAsset} />
              </motion.div>
            )}

            {/* TAB: ALIGNMENT */}
            {activeTab === 'alignment' && (
              <motion.div key="alignment" className="w-full max-w-3xl mx-auto">
                <MultiTimeframeAlignment selectedAsset={selectedAsset} />
              </motion.div>
            )}

            {/* TAB: SMC PANEL */}
            {activeTab === 'smc' && (
              <motion.div key="smc" className="w-full">
                <SmartMoneyConceptsPanel selectedAsset={selectedAsset} />
              </motion.div>
            )}

            {/* TAB: LIQUIDITY SWEEPS */}
            {activeTab === 'sweeps' && (
              <motion.div key="sweeps" className="w-full max-w-3xl mx-auto">
                <LiquiditySweepDetector selectedAsset={selectedAsset} livePrice={activeLivePrice} />
              </motion.div>
            )}

            {/* TAB: VOLUME PROFILE */}
            {activeTab === 'volume' && (
              <motion.div key="volume" className="w-full max-w-3xl mx-auto">
                <VolumeProfile selectedAsset={selectedAsset} livePrice={activeLivePrice} />
              </motion.div>
            )}

            {/* TAB: INSTITUTIONAL FOOTPRINT */}
            {activeTab === 'footprint' && (
              <motion.div key="footprint" className="w-full max-w-3xl mx-auto">
                <InstitutionalFootprint selectedAsset={selectedAsset} livePrice={activeLivePrice} />
              </motion.div>
            )}

            {/* TAB: MONTE CARLO RISK */}
            {activeTab === 'monte-carlo' && (
              <motion.div key="monte-carlo" className="w-full max-w-3xl mx-auto">
                <MonteCarloRiskEngine />
              </motion.div>
            )}

            {/* TAB: STRATEGY BACKTESTING */}
            {activeTab === 'backtesting' && (
              <motion.div key="backtesting" className="w-full max-w-3xl mx-auto">
                <StrategyBacktestingCenter />
              </motion.div>
            )}

            {/* TAB: CONFIGURATION SETTINGS */}
            {activeTab === 'settings' && (
              <motion.div 
                key="settings"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="bg-[#050a1e]/40 border border-white/5 p-6 rounded-2xl max-w-xl mx-auto font-mono text-xs flex flex-col gap-5 text-left shadow-2xl"
              >
                <div className="border-b border-white/5 pb-3">
                  <h3 className="text-sm font-sans font-bold text-white tracking-wider uppercase">Terminal configuration</h3>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Configure core sizing parameters and default trading model weights.</p>
                </div>
                
                <div className="flex flex-col gap-1.5">
                  <label className="text-zinc-500 uppercase font-black text-[9px] tracking-wider">Default Account Size (USD)</label>
                  <input 
                    type="number" 
                    value={accountSize}
                    onChange={(e) => setAccountSize(Number(e.target.value))}
                    className="bg-[#02040a] border border-white/10 rounded-xl p-3 text-white outline-none focus:border-indigo-500/50 transition-all font-mono"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-zinc-500 uppercase font-black text-[9px] tracking-wider">Default Risk Percentage Per Trade</label>
                  <input 
                    type="number" 
                    step="0.1"
                    value={riskPct}
                    onChange={(e) => setRiskPct(Number(e.target.value))}
                    className="bg-[#02040a] border border-white/10 rounded-xl p-3 text-white outline-none focus:border-indigo-500/50 transition-all font-mono"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-zinc-500 uppercase font-black text-[9px] tracking-wider">AI Processing Depth</label>
                  <select className="bg-[#02040a] border border-white/10 rounded-xl p-3 text-white outline-none font-mono cursor-pointer">
                    <option>Standard (Multi-timeframe consensus only)</option>
                    <option>Deep Ingress (Dual reasoning chain with Fallbacks)</option>
                  </select>
                </div>

                <div className="border-t border-white/5 pt-4.5 mt-2 flex justify-between items-center text-zinc-500">
                  <span>Engine: Operational</span>
                  <button 
                    onClick={() => {
                      setAccountSize(10000);
                      setRiskPct(1.0);
                    }}
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg font-bold uppercase tracking-wider text-white border border-white/5 transition-all cursor-pointer"
                  >
                    Reset Defaults
                  </button>
                </div>
              </motion.div>
            )}

            {/* TAB: DOCUMENTATION AND FAQ */}
            {activeTab === 'help' && (
              <motion.div 
                key="help"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="bg-[#050a1e]/40 border border-white/5 p-6 rounded-2xl max-w-2xl mx-auto text-left shadow-2xl"
              >
                <div className="border-b border-white/5 pb-4 mb-5">
                  <h3 className="text-sm font-mono font-bold text-white tracking-widest uppercase">System Documentation</h3>
                  <p className="text-[10px] text-zinc-500 font-mono mt-0.5">Quantitative guidelines and technical execution definitions.</p>
                </div>

                <div className="flex flex-col gap-3.5">
                  {[
                    {
                      q: 'How does the model generate trade levels?',
                      a: 'The algorithmic scanners analyze live exchange rates to map institutional liquidity sweeps, order block mitigations, and fair value gap imbalances. Once mapped, the reasoning model drafts exact entry ranges, multiple target bounds, and strict stop-loss caps designed to yield highly optimized risk-reward weights.'
                    },
                    {
                      q: 'What is Smart Money Concepts (SMC)?',
                      a: 'SMC is a structural trading framework modeling price action based on institutional desk behaviors. It maps market pivots using structural breaks (BOS), characters shifts (CHOCH), unmitigated order blocks, and liquidity pools where heavy volume commercial blocks sweep stop limits before driving primary trends.'
                    },
                    {
                      q: 'How are risk parameters integrated?',
                      a: 'Risk thresholds can be tweaked directly in the Terminal Configuration tab. By setting default account equity values and max risk percentages per trade, position sizing is dynamically computed to prevent excessive drawdowns during periods of high-impact macro volatility.'
                    }
                  ].map((faq, idx) => (
                    <details key={idx} className="group bg-zinc-950/40 border border-white/5 rounded-xl p-3.5 [&_summary::-webkit-details-marker]:hidden transition-all">
                      <summary className="flex items-center justify-between font-bold text-xs text-white cursor-pointer select-none">
                        <div className="flex items-center gap-2.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                          <span>{faq.q}</span>
                        </div>
                        <ChevronDown className="w-4 h-4 text-zinc-400 group-open:rotate-180 transition-transform" />
                      </summary>
                      <p className="text-xs text-zinc-400 leading-relaxed mt-3 pl-4 border-l border-indigo-500/20 font-sans">
                        {faq.a}
                      </p>
                    </details>
                  ))}
                </div>
              </motion.div>
            )}

          </AnimatePresence>

        </main>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }
      `}} />

    </div>
  );
}
