import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MARKETS, MarketCategory, TradingMode } from '../types';
import { 
  Activity, Target, Crosshair, BarChart3, Settings, Bell, LayoutDashboard,
  TrendingUp, TrendingDown, Clock, ShieldCheck, Database, ListFilter,
  Calendar, Sliders, Play, Globe, RotateCcw, ShieldAlert, AlertTriangle,
  Info, Search, ChevronDown, ChevronUp, Zap, HelpCircle, Lock, Newspaper, User,
  MoreHorizontal, X, FileText, Layers, Flame, BookOpen, Menu, Compass
} from 'lucide-react';
import { AnalysisResult } from './AnalysisResult';
import { SignalsLogger } from './SignalsLogger';
import { 
  AIConfidenceHeatmap, MultiTimeframeAlignment, SmartMoneyConceptsPanel,
  LiquiditySweepDetector, VolumeProfile, InstitutionalFootprint,
  CorrelationMatrix, EconomicImpactScanner, PortfolioRiskDashboard,
  MonteCarloRiskEngine, LiveMarketSentimentEngine, StrategyBacktestingCenter, activeDecimals
} from './ExtraModules';

interface DashboardProps {
  onAnalyze: (asset: string, mode: TradingMode, imageBase64?: string, accountSize?: number, riskPct?: number) => Promise<{ result: string; signalData?: any }>;
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

// High-precision order book depth visualizer styled in crisp light theme
function MarketDepthVisualizer({ asset, livePrice = 0 }: { asset: string, livePrice?: number }) {
  const details = getAssetDetails(asset);
  return (
    <div className="relative w-full h-40 flex flex-col justify-center font-sans text-[10px] p-4 bg-[rgba(30,20,50,0.6)] backdrop-blur-[8px] border border-[rgba(255,255,255,0.1)] rounded-[24px] overflow-hidden shadow-[0_8px_32px_rgba(110,50,200,0.2)] text-left">
      <div className="flex justify-between border-b border-[rgba(255,255,255,0.1)] pb-2 mb-2 text-[14px] font-sans text-[#E2E8F0] font-medium">
        <span>Order Book Depth // {details.symbol}</span>
        <span className="text-emerald-400 font-semibold">Spread: 0.15 Pips</span>
      </div>
      <div className="flex flex-col gap-1 w-full">
        {/* Ask Rows */}
        <div className="flex items-center justify-between text-rose-400">
          <span>Ask [Limit]</span>
          <div className="w-1/2 flex items-center justify-end gap-3">
            {livePrice > 0 ? <span className="text-[#E2E8F0]/50 text-[9px]">{(livePrice * 1.0003).toFixed(5)}</span> : <span className="text-[#E2E8F0]/50 text-[9px]">—</span>}
            <div className="w-20 bg-[#120E1B] h-2.5 border border-[rgba(255,255,255,0.1)] rounded overflow-hidden flex justify-end">
              <div className="bg-rose-500/40 h-full w-[70%]" />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between text-rose-400/80">
          <span>Ask [Limit]</span>
          <div className="w-1/2 flex items-center justify-end gap-3">
            {livePrice > 0 ? <span className="text-[#E2E8F0]/50 text-[9px]">{(livePrice * 1.0002).toFixed(5)}</span> : <span className="text-[#E2E8F0]/50 text-[9px]">—</span>}
            <div className="w-20 bg-[#120E1B] h-2.5 border border-[rgba(255,255,255,0.1)] rounded overflow-hidden flex justify-end">
              <div className="bg-rose-500/30 h-full w-[45%]" />
            </div>
          </div>
        </div>
        
        {/* Mid Price Separator */}
        <div className="h-[1px] bg-[rgba(255,255,255,0.1)] my-1 w-full relative">
          <span className="absolute right-0 -top-2 bg-[#120E1B] px-1 text-[14px] font-sans text-[#E2E8F0] font-medium">Mid Point Region</span>
        </div>
        
        {/* Bid Rows */}
        <div className="flex items-center justify-between text-emerald-600/80">
          <span>Bid [Limit]</span>
          <div className="w-1/2 flex items-center justify-end gap-3">
            {livePrice > 0 ? <span className="text-slate-400 text-[9px]">{(livePrice * 0.9998).toFixed(5)}</span> : <span className="text-slate-400 text-[9px]">—</span>}
            <div className="w-20 bg-emerald-50 h-2.5 border border-emerald-100 rounded overflow-hidden">
              <div className="bg-emerald-500/15 h-full w-[60%]" />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between text-emerald-600">
          <span>Bid [Limit]</span>
          <div className="w-1/2 flex items-center justify-end gap-3">
            {livePrice > 0 ? <span className="text-slate-400 text-[9px]">{(livePrice * 0.9997).toFixed(5)}</span> : <span className="text-slate-400 text-[9px]">—</span>}
            <div className="w-20 bg-emerald-50 h-2.5 border border-emerald-100 rounded overflow-hidden">
              <div className="bg-emerald-500/20 h-full w-[85%]" />
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

interface AssetItem {
  id: string;
  name: string;
  ticker: string;
  iconBg: string;
  type: string;
}

const ASSET_LIST: AssetItem[] = [
  { id: 'XAUUSD', name: 'Gold', ticker: 'XAU/Au', iconBg: 'bg-orange-50', type: 'asset' },
  { id: 'XAGUSD', name: 'Silver', ticker: 'XAG/Ag', iconBg: 'bg-slate-100', type: 'asset' },
  { id: 'STOXX50', name: 'Platinum', ticker: 'XPT/Pt', iconBg: 'bg-slate-100', type: 'asset' },
  { id: 'XNGUSD', name: 'Palladium', ticker: 'XPD/Pd', iconBg: 'bg-slate-100', type: 'asset' },
  { id: 'BTCUSD', name: 'Bitcoin', ticker: 'BTC', iconBg: 'bg-orange-50', type: 'asset' },
  { id: 'ETHUSD', name: 'Ethereum', ticker: 'ETH', iconBg: 'bg-slate-100', type: 'asset' },
  { id: 'SOLUSD', name: 'Solana', ticker: 'SOL', iconBg: 'bg-slate-100', type: 'asset' },
  { id: 'VOL75', name: 'Ripple', ticker: 'XRP', iconBg: 'bg-slate-100', type: 'asset' },
  { id: 'BNBUSD', name: 'Binance Coin', ticker: 'BNB', iconBg: 'bg-slate-100', type: 'asset' },
];

interface ForexItem {
  id: string;
  name: string;
  flag: string;
  type: string;
}

const FOREX_LIST: ForexItem[] = [
  { id: 'EURUSD', name: 'EUR/USD', flag: '🇪🇺', type: 'forex' },
  { id: 'GBPUSD', name: 'GBP/USD', flag: '🇬🇧', type: 'forex' },
  { id: 'USDJPY', name: 'USD/JPY', flag: '🇯🇵', type: 'forex' },
  { id: 'AUDUSD', name: 'AUD/USD', flag: '🇦🇺', type: 'forex' },
  { id: 'USDCAD', name: 'USD/CAD', flag: '🇨🇦', type: 'forex' },
  { id: 'USDCHF', name: 'USD/CHF', flag: '🇨🇭', type: 'forex' },
];


export function Dashboard({ onAnalyze }: DashboardProps) {
  // Main view state
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState('XAUUSD');
  const [mode, setMode] = useState<TradingMode>('SCALPING MODE');
  const [result, setResult] = useState<string | null>(null);
  const [signalData, setSignalData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loaderStage, setLoaderStage] = useState(0);

  // Mobile layout state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Form Configurations
  const [accountSize, setAccountSize] = useState<number>(10000);
  const [riskPct, setRiskPct] = useState<number>(1.0);

  // Live prices mock database
  const [livePrices, setLivePrices] = useState<Record<string, { bid: number; ask: number; change: number; history: number[] }>>({});
  const [lastAnalysisCompletedAt, setLastAnalysisCompletedAt] = useState<number | undefined>(undefined);

  // Sub reports (Main View tab vs live data visuals)
  const [activeSubReportTab, setActiveSubReportTab] = useState<'report' | 'flow'>('report');
  
  //経済カレンダーカテゴリ
  const [activeCategory, setActiveCategory] = useState<MarketCategory>('Futures');

  // Watchlist Search
  const [dropdownSearch, setDropdownSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Notifications
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'Macro High Impact Sweep imminent', time: '1m ago', unread: true },
    { id: 2, title: 'Quant-X Neural consensus matches XAUUSD setup', time: '12m ago', unread: true },
    { id: 3, title: 'EURUSD Daily alignment BOS confirmed', time: '1h ago', unread: false }
  ]);

  // Real-time Clock
  const [time, setTime] = useState(new Date().toUTCString());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toUTCString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Set up loading simulation stages
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      setLoaderStage(0);
      interval = setInterval(() => {
        setLoaderStage(prev => {
          if (prev < 3) return prev + 1;
          return prev;
        });
      }, 1400);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  // Periodically update live prices
 // Periodically update live prices via Deriv WebSocket
  useEffect(() => {
    const derivSymbolMap: Record<string, string> = {
      EURUSD: 'frxEURUSD', GBPUSD: 'frxGBPUSD', USDJPY: 'frxUSDJPY',
      USDCHF: 'frxUSDCHF', AUDUSD: 'frxAUDUSD', USDCAD: 'frxUSDCAD',
      BTCUSD: 'cryBTCUSD', ETHUSD: 'cryETHUSD', SOLUSD: 'crySOLUSD', BNBUSD: 'cryBNBUSD',
      XAUUSD: 'frxXAUUSD', XAGUSD: 'frxXAGUSD',
      USOIL: 'frxUSOIL', XNGUSD: 'frxXPDUSD', STOXX50: 'OTC_STOXX50E', VOL75: 'R_75'
    };

    const reverseSymbolMap: Record<string, string> = {};
    for (const [key, value] of Object.entries(derivSymbolMap)) {
      reverseSymbolMap[value] = key;
    }

    const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
    const openingPrices: Record<string, number> = {};

    ws.onopen = () => {
      ws.send(JSON.stringify({
        ticks: Object.values(derivSymbolMap),
        subscribe: 1
      }));
    };

    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.tick) {
        const derivSymbol = data.tick.symbol;
        const appSymbol = reverseSymbolMap[derivSymbol];
        if (appSymbol) {
          const ask = data.tick.ask;
          const bid = data.tick.bid;
          const quote = data.tick.quote;

          if (!openingPrices[appSymbol]) {
            openingPrices[appSymbol] = quote;
          }

          const openPrice = openingPrices[appSymbol];
          const change = openPrice ? ((quote - openPrice) / openPrice) * 100 : 0;

          setLivePrices(prev => {
            const previousData = prev[appSymbol];
            const history = previousData?.history || [];
            const newHistory = [...history, quote].slice(-30); // keep last 30 ticks for sparkline

            return {
              ...prev,
              [appSymbol]: {
                bid: bid || quote,
                ask: ask || quote,
                change: change,
                history: newHistory
              }
            };
          });
        }
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  const handleSelectAsset = (asset: string) => {
    setSelectedAsset(asset);
    setResult(null);
    setIsMobileSidebarOpen(false);
  };

  const handleExecute = async () => {
    setIsLoading(true);
    setResult(null);
    setSignalData(null);
    setIsDropdownOpen(false);
    try {
      const data = await onAnalyze(selectedAsset, mode, undefined, accountSize, riskPct);
      setResult(data.result);
      setSignalData(data.signalData || null);
      setLastAnalysisCompletedAt(Date.now());
      setActiveSubReportTab('report');
    } catch (err: any) {
      setResult(`**SYSTEM OVERWATCH ERROR**\n\nFailed to complete analysis.\n\n\`${err.message}\``);
      setSignalData(null);
      setLastAnalysisCompletedAt(Date.now());
    } finally {
      setIsLoading(false);
    }
  };

  const parsedData = (() => {
    if (signalData) {
      let direction: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
      const dirStr = String(signalData.direction || '').toUpperCase();
      if (dirStr === 'BUY' || dirStr === 'BULLISH' || dirStr === 'LONG') {
        direction = 'BUY';
      } else if (dirStr === 'SELL' || dirStr === 'BEARISH' || dirStr === 'SHORT') {
        direction = 'SELL';
      }

      return {
        direction,
        entryLow: typeof signalData.entry_low === 'number' ? signalData.entry_low : null,
        entryHigh: typeof signalData.entry_high === 'number' ? signalData.entry_high : null,
        tp1: typeof signalData.tp1 === 'number' ? signalData.tp1 : null,
        tp2: typeof signalData.tp2 === 'number' ? signalData.tp2 : null,
        tp3: typeof signalData.tp3 === 'number' ? signalData.tp3 : null,
        sl: typeof signalData.sl === 'number' ? signalData.sl : null,
        confidence: typeof signalData.win_probability_pct === 'number' ? signalData.win_probability_pct : (typeof signalData.score === 'number' ? signalData.score : 85),
        isMock: false
      };
    }

    if (!result) {
      return null;
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

  const activeLivePrice = livePrices[selectedAsset]?.bid ?? 0;
  const currentDecimals = selectedAsset.includes('JPY') ? 3 : (selectedAsset.includes('USD') && selectedAsset.length === 6 ? 5 : 2);

  const activeAssetDetails = getAssetDetails(selectedAsset);

  
  const loaderStagesText = [
    'Aggregating Liquidity Pools...',
    'Analyzing Macro Risk Gates...',
    'Resolving Multi-timeframe Biases...',
    'Formulating AI Execution Targets...'
  ];

  return (
    <div className="min-h-screen bg-[#0B0A11] text-[#E2E8F0] flex font-sans overflow-hidden selection:bg-purple-500/30 relative w-full h-screen">
      
      {/* 1. COLLAPSIBLE MOBILE BACKDROP OVERLAY */}
      <AnimatePresence>
        {isMobileSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* 2. LEFT SIDEBAR (Permanent on Desktop, Slide-out drawer on Mobile) */}
      <aside className={`w-72 bg-[#120E1B]/95 border-r border-[rgba(255,255,255,0.08)] flex flex-col h-full shrink-0 fixed md:static z-50 transition-transform duration-300 md:translate-x-0 ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} backdrop-blur-md`}>
        {/* Logo Header */}
        <div className="h-16 border-b border-[rgba(255,255,255,0.08)] px-6 flex items-center justify-between shrink-0 bg-[#120E1B]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-r from-[#8A2BE2] to-[#FF4500] flex items-center justify-center text-white shadow-md shadow-purple-500/20">
              <Activity className="w-4 h-4" />
            </div>
            <span className="text-white font-bold text-lg font-display">
              TradeLens
            </span>
          </div>
          {/* Close button for Mobile */}
          <button 
            onClick={() => setIsMobileSidebarOpen(false)}
            className="p-1.5 hover:bg-white/5 rounded-lg text-slate-450 hover:text-white md:hidden cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sidebar Lists of Assets & Forex arranged Vertically */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4.5 space-y-6 bg-transparent text-left">
          
          {/* DIGITAL ASSETS & COMMODITIES */}
          <div>
            <h4 className="mb-3 px-1.5 flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-purple-300 font-bold">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              <span>Digital Assets & Metals</span>
            </h4>
            <div className="space-y-0.5">
              {ASSET_LIST.map(item => {
                const isSelected = selectedAsset === item.id;
                const liveData = livePrices[item.id];
                const priceStr = liveData ? liveData.bid.toFixed(item.id.includes('BTC') ? 1 : 2) : '—';
                const changeStr = liveData ? `${liveData.change >= 0 ? '+' : ''}${liveData.change.toFixed(2)}%` : '';
                const isChangeUp = liveData ? liveData.change >= 0 : true;

                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectAsset(item.id)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-gradient-to-r from-[rgba(255,107,53,0.15)] to-[rgba(255,138,101,0.15)] border border-[rgba(255,107,53,0.4)] text-white shadow-[0_0_15px_rgba(255,107,53,0.2)] font-semibold' 
                        : 'border border-transparent hover:bg-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-[9px] text-orange-400 bg-orange-950/40 px-1.5 py-0.5 rounded leading-none border border-orange-900/40 font-bold">{item.id}</span>
                      <div>
                        <span className="text-xs font-semibold block leading-tight text-slate-200">{item.name}</span>
                        <span className="text-[9px] text-slate-400 block mt-0.5">{item.ticker}</span>
                      </div>
                    </div>
                    <div className="text-right font-sans text-[10px]">
                      <span className="text-[13px] font-sans font-bold block text-white">{priceStr}</span>
                      <span className={`text-[11px] font-sans font-medium ${isChangeUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {changeStr}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* TRADITIONAL FOREX PAIRS */}
          <div>
            <h4 className="mb-3 px-1.5 flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-purple-300 font-bold">
              <Globe className="w-3.5 h-3.5 text-orange-400" />
              <span>Currency Pairings</span>
            </h4>
            <div className="space-y-0.5">
              {FOREX_LIST.map(item => {
                const isSelected = selectedAsset === item.id;
                const liveData = livePrices[item.id];
                const priceStr = liveData ? liveData.bid.toFixed(item.id.includes('JPY') ? 3 : 5) : '—';
                const changeStr = liveData ? `${liveData.change >= 0 ? '+' : ''}${liveData.change.toFixed(2)}%` : '';
                const isChangeUp = liveData ? liveData.change >= 0 : true;

                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectAsset(item.id)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-gradient-to-r from-[rgba(255,107,53,0.15)] to-[rgba(255,138,101,0.15)] border border-[rgba(255,107,53,0.4)] text-white shadow-[0_0_15px_rgba(255,107,53,0.2)] font-semibold' 
                        : 'border border-transparent hover:bg-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg leading-none">{item.flag}</span>
                      <div>
                        <span className="text-xs font-semibold block leading-tight text-slate-200">{item.id}</span>
                        <span className="text-[9px] text-slate-400 block mt-0.5">{item.name}</span>
                      </div>
                    </div>
                    <div className="text-right font-sans text-[10px]">
                      <span className="text-[13px] font-sans font-bold block text-white">{priceStr}</span>
                      <span className={`text-[11px] font-sans font-medium ${isChangeUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {changeStr}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* Drawer License info */}
        <div className="p-4 border-t border-[rgba(255,255,255,0.08)] bg-[#120E1B] flex flex-col gap-1.5 text-left text-[10px] text-slate-400 font-sans">
          <div className="flex items-center gap-1.5 text-purple-400 text-[10px] font-mono uppercase tracking-wider font-bold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Desk License Valid</span>
          </div>
          <p className="text-[9px] text-slate-450 leading-normal">
            TradeLens Terminal v5.24. Live math consensus engines active.
          </p>
        </div>
      </aside>

      {/* 3. MAIN WORKSPACE CONTAINER */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        
        {/* STICKY HEADER */}
        <header className="h-16 border-b border-[rgba(255,255,255,0.08)] bg-[#120E1B]/95 flex items-center justify-between px-4 sm:px-6 shrink-0 relative z-10 text-[#E2E8F0] backdrop-blur-md">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger to slide out assets menu */}
            <button 
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-2 -ml-1 rounded-lg text-slate-450 hover:text-white hover:bg-white/5 md:hidden cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
              <span className="text-[11px] font-mono text-purple-300 font-bold uppercase tracking-wider">Algorithmic Desk</span>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {/* Real-time Clock */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-[#120E1B] border border-[rgba(255,255,255,0.08)] rounded-lg text-[10px] font-mono text-slate-300 font-bold tracking-tight shadow-sm">
              <Clock className="w-3.5 h-3.5 text-orange-400" />
              <span>{time}</span>
            </div>

            {/* Notifications Button */}
            <div className="relative">
              <button 
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="p-2 bg-[#120E1B] hover:bg-white/5 border border-[rgba(255,255,255,0.1)] text-slate-300 hover:text-white rounded-xl shadow-[0_4px_20px_rgba(110,50,200,0.1)] transition-colors relative cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {notifications.some(n => n.unread) && (
                  <span className="absolute top-1 right-1.5 w-1.5 h-1.5 bg-orange-400 rounded-full" />
                )}
              </button>

              <AnimatePresence>
                {isNotificationsOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setIsNotificationsOpen(false)} />
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-0 mt-2.5 w-72 bg-[#1A103C] border border-[rgba(255,255,255,0.1)] rounded-2xl shadow-2xl shadow-purple-950/40 p-4 z-40 text-left"
                    >
                      <h4 className="border-b border-white/5 pb-2 mb-2 flex items-center justify-between text-xs font-mono uppercase tracking-wider text-purple-300 font-bold">
                        <span>Notifications</span>
                        <span className="text-[9px] bg-orange-950/40 text-orange-400 px-1.5 py-0.5 rounded leading-none border border-orange-900/40 font-bold">Live</span>
                      </h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {notifications.map(n => (
                          <div key={n.id} className={`p-2 rounded-lg text-[10.5px] leading-snug ${n.unread ? 'bg-orange-950/20 border border-orange-900/30' : 'bg-[#120E1B]/50 border border-white/5'}`}>
                            <p className="font-semibold text-slate-200">{n.title}</p>
                            <span className="text-[9px] text-slate-400 block mt-1 font-sans">{n.time}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Menu button to open Slide-out Navigation Drawer */}
            <button 
              onClick={() => setIsDrawerOpen(true)}
              className="flex items-center gap-1.5 bg-gradient-to-r from-purple-600 to-orange-500 hover:opacity-95 text-white font-mono text-xs px-4 py-2 rounded-xl shadow-lg shadow-purple-500/20 transition-all cursor-pointer border border-white/10"
            >
              <Sliders className="w-3.5 h-3.5 text-orange-300" />
              <span>Menu</span>
            </button>
          </div>
        </header>

        {/* PERSISTENT TOP LIVE TICKER FOR THE CURRENT SELECTED ASSET */}
        <div className="bg-[#1A103C]/30 border-b border-[rgba(255,255,255,0.08)] py-3 px-4 sm:px-6 flex flex-wrap items-center justify-between gap-3 text-left shadow-inner">
          <div className="flex items-center gap-3">
            <span className="bg-orange-950/40 text-orange-400 border border-orange-900/40 px-2.5 py-1 rounded-lg shadow-sm font-mono text-xs font-bold">
              {activeAssetDetails.symbol}
            </span>
            <div>
              <h2 className="text-sm font-sans font-bold text-white tracking-tight leading-none">{activeAssetDetails.name}</h2>
              <p className="text-[10px] text-[#E2E8F0]/70 block font-sans mt-0.5">{activeAssetDetails.desc}</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="font-sans text-right">
              <span className="text-[14px] text-slate-450 font-sans font-medium block">Live Feed Quote</span>
              <span className="text-[20px] font-sans font-bold text-white block mt-1">
                {activeLivePrice > 0 ? activeLivePrice.toFixed(currentDecimals) : '—'}
              </span>
            </div>
            <div className="font-sans text-right">
              <span className="text-[14px] text-slate-450 font-sans font-medium block">24H Volatility</span>
              <span className={`text-xs font-black block mt-1.5 ${livePrices[selectedAsset]?.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {livePrices[selectedAsset]?.change >= 0 ? '+' : ''}{livePrices[selectedAsset]?.change?.toFixed(2) ?? '—'}%
              </span>
            </div>
          </div>
        </div>

        {/* SLIDE-OUT NAVIGATION DRAWER (TABS CONTROLLER) */}
        <AnimatePresence>
          {isDrawerOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsDrawerOpen(false)}
                className="fixed inset-0 bg-[#0B0A11]/60 backdrop-blur-sm z-50"
              />
              <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 24, stiffness: 220 }}
                className="fixed right-0 top-0 bottom-0 w-80 max-w-full bg-[#120E1B] border-l border-[rgba(255,255,255,0.08)] p-6 z-50 flex flex-col justify-between shadow-2xl shadow-black/80 overflow-y-auto text-[#E2E8F0]"
              >
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <h3 className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-purple-300 font-bold">
                      <LayoutDashboard className="w-4 h-4 text-orange-400" />
                      <span>Console Navigation</span>
                    </h3>
                    <button 
                      onClick={() => setIsDrawerOpen(false)}
                      className="p-1 hover:bg-white/5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Section 1: ALGORITHMIC GENERATOR */}
                  <div className="flex flex-col gap-2 text-left">
                    <h4 className="border-l-2 border-orange-500 pl-2 text-[11px] font-mono uppercase tracking-wider text-purple-300 font-bold">Quantitative Terminal</h4>
                    <div className="flex flex-col gap-1 mt-1">
                      {[
                        { id: 'dashboard', label: 'Signal Forge Generator', desc: 'Synthesize buy, sell, or wait bands', icon: Zap },
                        { id: 'history', label: 'Quantitative Historical Ledger', desc: 'Audit computed setup parameters', icon: Database },
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
                            className={`flex items-start gap-3 p-2.5 rounded-xl text-left transition-all cursor-pointer border ${
                              isSelected 
                                ? 'bg-orange-950/20 border-orange-500/40 text-orange-400 font-semibold shadow-[0_0_15px_rgba(255,107,53,0.1)]' 
                                : 'border-transparent text-slate-400 hover:bg-white/5 hover:text-white'
                            }`}
                          >
                            <IconComp className={`w-4 h-4 mt-0.5 ${isSelected ? 'text-orange-400' : 'text-slate-400'}`} />
                            <div>
                              <span className="font-sans font-bold text-xs block text-white">{item.label}</span>
                              <span className="font-sans text-[8px] text-slate-400 block leading-normal mt-0.5">{item.desc}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Section 2: REAL TIME DATA */}
                  <div className="flex flex-col gap-2 text-left">
                    <h4 className="border-l-2 border-orange-500 pl-2 text-[11px] font-mono uppercase tracking-wider text-purple-300 font-bold">Market Data Feeds</h4>
                    <div className="flex flex-col gap-1 mt-1">
                      {[
                        { id: 'watchlist', label: 'Institutional Watchlist', desc: 'Real-time spreads & ticks', icon: ListFilter },
                        { id: 'news', label: 'Consensus Sentiment Wire', desc: 'Imbalance flow feeds', icon: Newspaper },
                        { id: 'calendar', label: 'Economic Calendar', desc: 'High-impact macro timetables', icon: Calendar },
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
                            className={`flex items-start gap-3 p-2.5 rounded-xl text-left transition-all cursor-pointer border ${
                              isSelected 
                                ? 'bg-orange-950/20 border-orange-500/40 text-orange-400 font-semibold shadow-[0_0_15px_rgba(255,107,53,0.1)]' 
                                : 'border-transparent text-slate-400 hover:bg-white/5 hover:text-white'
                            }`}
                          >
                            <IconComp className={`w-4 h-4 mt-0.5 ${isSelected ? 'text-orange-400' : 'text-slate-400'}`} />
                            <div>
                              <span className="font-sans font-bold text-xs block text-white">{item.label}</span>
                              <span className="font-sans text-[8px] text-slate-400 block leading-normal mt-0.5">{item.desc}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Section 4: TERMINAL CORE */}
                  <div className="flex flex-col gap-2 text-left">
                    <h4 className="border-l-2 border-orange-500 pl-2 text-[11px] font-mono uppercase tracking-wider text-purple-300 font-bold">Configuration</h4>
                    <div className="flex flex-col gap-1 mt-1 font-sans">
                      {[
                        { id: 'settings', label: 'Desk Configuration', desc: 'Account sizes & risk variables', icon: Settings },
                        { id: 'help', label: 'FAQ Guidelines', desc: 'System documentation & algorithms', icon: BookOpen },
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
                            className={`flex items-start gap-3 p-2.5 rounded-xl text-left transition-all cursor-pointer border ${
                              isSelected 
                                ? 'bg-orange-950/20 border-orange-500/40 text-orange-400 font-semibold shadow-[0_0_15px_rgba(255,107,53,0.1)]' 
                                : 'border-transparent text-slate-400 hover:bg-white/5 hover:text-white'
                            }`}
                          >
                            <IconComp className={`w-4 h-4 mt-0.5 ${isSelected ? 'text-orange-400' : 'text-slate-400'}`} />
                            <div>
                              <span className="font-sans font-bold text-xs block text-white">{item.label}</span>
                              <span className="font-sans text-[8px] text-slate-400 block leading-normal mt-0.5">{item.desc}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                </div>

                {/* Drawer Footer Status */}
                <div className="border-t border-white/5 pt-4 mt-6">
                  <div className="bg-[#120E1B] border border-[rgba(255,255,255,0.08)] rounded-xl p-3 flex flex-col gap-1 text-left">
                    <div className="flex items-center gap-1 text-purple-400 text-[10px] font-mono uppercase tracking-wider font-bold">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>SECURE TERMINAL GATEWAY</span>
                    </div>
                    <p className="text-[8px] text-slate-450 font-sans leading-normal mt-0.5">
                      Audits cleared. Feeds running.
                    </p>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* DYNAMIC SCROLL WORKSPACE */}
        <main className="flex-1 overflow-y-auto w-full mx-auto flex flex-col gap-6 relative p-4 sm:p-6 max-w-7xl">
          
          <AnimatePresence mode="wait">
            
            {/* VIEW 1: MAIN SIGNALS FORGE GENERATOR VIEW */}
            {activeTab === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="max-w-3xl mx-auto w-full flex flex-col gap-6 text-left"
              >
                  
                  {/* CENTRAL SCAN DOCK CARD */}
                  <div className="bg-[rgba(30,20,50,0.45)] backdrop-blur-[12px] border border-[rgba(255,255,255,0.08)] rounded-[24px] p-5 shadow-[0_8px_32px_rgba(110,50,200,0.25)] relative overflow-hidden">
                    <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-purple-500 to-orange-500" />
                    
                    <div className="flex flex-wrap items-center justify-between border-b border-white/5 pb-3.5 mb-4 gap-3">
                      <div>
                        <h3 className="text-base font-sans font-bold text-white">Signal Forge Generator</h3>
                        <p className="text-xs text-[#E2E8F0]/70 font-sans mt-0.5">Request pure mathematical consensus models for direct structural execution parameters.</p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-sans text-slate-400 font-medium px-2">Mode</span>
                        <div className="flex items-center bg-[#120E1B] p-1 rounded-lg border border-[rgba(255,255,255,0.08)]">
                          <button
                            onClick={() => setMode('SCALPING MODE')}
                            className={`px-3 py-1.5 text-xs font-sans font-bold rounded-md transition-all cursor-pointer ${
                              mode === 'SCALPING MODE' 
                                ? 'bg-purple-600 text-white shadow-sm' 
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            Scalping
                          </button>
                          <button
                            onClick={() => setMode('SWING MODE')}
                            className={`px-3 py-1.5 text-xs font-sans font-bold rounded-md transition-all cursor-pointer ${
                              mode === 'SWING MODE' 
                                ? 'bg-purple-600 text-white shadow-sm' 
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            Swing
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* CORE TRIGGER INTERFACE */}
                    <div className="flex flex-col gap-4">
                      
                      {/* Live Ticker info */}
                      <div className="bg-[#120E1B]/55 border border-[rgba(255,255,255,0.08)] rounded-xl p-4 flex items-center justify-between font-sans shadow-sm">
                        <div className="text-left">
                          <span className="text-slate-400 block text-[14px] font-sans font-medium">Instrument Selected</span>
                          <strong className="text-white text-[20px] font-sans font-bold block mt-1">{activeAssetDetails.symbol}</strong>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-400 block text-[14px] font-sans font-medium">Ask Quote Rate</span>
                          <strong className="text-white text-[20px] font-sans font-bold block mt-1">
                            {(activeLivePrice > 0 ? (activeLivePrice * 1.00015).toFixed(currentDecimals) : '—')}
                          </strong>
                        </div>
                      </div>

                      {/* MAIN REQUEST TRIGGER BUTTON */}
                      <button
                        onClick={handleExecute}
                        disabled={isLoading}
                        className="w-full bg-gradient-to-r from-purple-600 to-orange-500 hover:opacity-95 active:scale-[0.99] text-white py-4 px-8 rounded-2xl font-sans text-sm font-bold transition-all duration-300 disabled:opacity-50 disabled:cursor-wait shadow-lg shadow-purple-500/20 hover:shadow-purple-500/35 flex items-center justify-center gap-2.5 cursor-pointer border border-white/10"
                      >
                        <Zap className={`w-4 h-4 text-orange-200 ${isLoading ? 'animate-bounce' : ''}`} />
                        <span>{isLoading ? 'Computing Consensus Models...' : 'Get Real-Time Signal'}</span>
                      </button>

                    </div>
                  </div>

                  {/* LOADING SIMULATOR SPINNER */}
                  {isLoading && (
                    <div className="bg-[rgba(30,20,50,0.45)] backdrop-blur-[12px] border border-[rgba(255,255,255,0.08)] rounded-[24px] p-8 flex flex-col items-center justify-center min-h-[300px] text-slate-400 space-y-5 shadow-[0_8px_32px_rgba(110,50,200,0.25)]">
                      <div className="relative">
                        <div className="w-16 h-16 border border-white/5 rounded-full" />
                        <div className="w-16 h-16 border-2 border-purple-500 border-t-transparent rounded-full animate-spin absolute inset-0 shadow-md shadow-purple-500/20" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-2.5 h-2.5 bg-purple-500 rounded-full animate-ping" />
                        </div>
                      </div>
                      
                      <div className="text-center space-y-2">
                        <span className="text-sm font-sans font-bold text-purple-400 block animate-pulse">
                          {loaderStagesText[loaderStage]}
                        </span>
                        <p className="text-xs text-slate-400 font-sans">
                          Running predictive consensus models on multi-timeframe exchange data.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* STATIC / PARSED RESULT DISPLAY CARD */}
                  {!isLoading && result && (
                    <div className="bg-[rgba(30,20,50,0.45)] backdrop-blur-[12px] border border-[rgba(255,255,255,0.08)] rounded-[24px] shadow-[0_8px_32px_rgba(110,50,200,0.25)] p-5 relative overflow-hidden flex flex-col gap-5">
                      <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-purple-500 to-orange-500" />
                      
                      {/* Signal Action Panel */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-white/5 pb-4 gap-3">
                        <div className="flex items-center gap-3">
                          {parsedData.direction === 'BUY' ? (
                            <div className="w-12 h-12 bg-emerald-950/40 border border-emerald-900/40 rounded-xl flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                              <TrendingUp className="w-6 h-6" />
                            </div>
                          ) : parsedData.direction === 'SELL' ? (
                            <div className="w-12 h-12 bg-rose-950/40 border border-rose-900/40 rounded-xl flex items-center justify-center text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.15)]">
                              <TrendingDown className="w-6 h-6" />
                            </div>
                          ) : (
                            <div className="w-12 h-12 bg-blue-950/40 border border-blue-900/40 rounded-xl flex items-center justify-center text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
                              <Clock className="w-6 h-6" />
                            </div>
                          )}

                          <div>
                            <span className="text-[14px] text-slate-400 block font-sans font-medium">Trading Verdict</span>
                            <span className={`text-[20px] font-sans font-bold block mt-1 ${
                              parsedData.direction === 'BUY' ? 'text-emerald-400' : parsedData.direction === 'SELL' ? 'text-rose-400' : 'text-blue-400'
                            }`}>
                              {parsedData.direction === 'BUY' ? 'Execute Long (Buy)' : parsedData.direction === 'SELL' ? 'Execute Short (Sell)' : 'Hold Status (Wait)'}
                            </span>
                          </div>
                        </div>

                        {/* Confidence Ring */}
                        <div className="flex items-center gap-3 bg-[#120E1B] border border-[rgba(255,255,255,0.08)] px-4 py-2.5 rounded-xl shadow-sm">
                          <div className="text-right">
                            <span className="text-[14px] text-slate-400 block font-sans font-medium">Certainty Rating</span>
                            <span className="text-[20px] font-sans font-bold text-white block mt-1">{parsedData.confidence}%</span>
                          </div>
                          <div className="px-3 py-1.5 bg-orange-950/40 border border-orange-900/40 rounded-lg text-orange-400 text-xs font-bold font-sans">
                            {parsedData.confidence >= 80 ? 'High' : 'Medium'}
                          </div>
                        </div>
                      </div>

                      {/* PARAMETERS TARGET MATRIX - Entry low, Entry high, TP, SL */}
                      {parsedData.direction !== 'NEUTRAL' && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                          {/* ENTRY RANGE */}
                          <div className="bg-[#120E1B]/80 border border-[rgba(255,255,255,0.08)] rounded-xl p-4 text-center shadow-sm">
                            <span className="text-[14px] font-sans font-medium text-slate-450 block">Target Entry Zone</span>
                            <strong className="text-[20px] font-sans font-bold text-white mt-1 block">
                              {parsedData.entryLow ? parsedData.entryLow.toFixed(currentDecimals) : 'Market Rate'} 
                              {parsedData.entryHigh && parsedData.entryHigh !== parsedData.entryLow ? ` – ${parsedData.entryHigh.toFixed(currentDecimals)}` : ''}
                            </strong>
                            <span className="text-xs text-orange-400 font-medium font-sans mt-1 block">Optimal Ingress Range</span>
                          </div>

                          {/* STOP LOSS */}
                          <div className="bg-rose-950/20 border border-rose-900/30 rounded-xl p-4 text-center shadow-sm">
                            <span className="text-[14px] font-sans font-medium text-slate-450 block">Invalidation Stop Loss</span>
                            <strong className="text-[20px] font-sans font-bold text-rose-400 mt-1 block">
                              {parsedData.sl ? parsedData.sl.toFixed(currentDecimals) : 'None'}
                            </strong>
                            <span className="text-xs text-rose-400 font-medium font-sans mt-1 block">Tight Risk Hard Cut</span>
                          </div>

                          {/* TAKE PROFIT TARGETS */}
                          <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-xl p-4 text-center shadow-sm relative">
                            <span className="text-[14px] font-sans font-medium text-slate-450 block">Target Take Profit</span>
                            <strong className="text-[20px] font-sans font-bold text-emerald-400 mt-1 block">
                              {parsedData.tp1 ? parsedData.tp1.toFixed(currentDecimals) : 'N/A'}
                            </strong>
                            {parsedData.tp2 && (
                              <span className="text-xs text-emerald-400 font-medium font-sans mt-1 block">
                                Take Profit 2: {parsedData.tp2.toFixed(currentDecimals)}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* AI CORE REASONING ARGUMENTS */}
                      <div className="w-full">
                        <AnalysisResult result={result} isLoading={isLoading} />
                      </div>

                    </div>
                  )}

                  {/* INITIAL BLANK STATE */}
                  {!result && !isLoading && (
                    <div className="bg-[rgba(30,20,50,0.45)] backdrop-blur-[12px] border border-[rgba(255,255,255,0.08)] rounded-[24px] p-10 flex flex-col items-center justify-center min-h-[350px] text-slate-400 shadow-[0_8px_32px_rgba(110,50,200,0.25)]">
                      <div className="w-14 h-14 bg-orange-950/40 border border-orange-900/40 text-orange-400 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                        <Crosshair className="w-7 h-7" />
                      </div>
                      <h3 className="font-sans font-bold text-white text-sm">Terminal System Ready</h3>
                      <p className="text-xs text-[#E2E8F0]/70 mt-2 max-w-sm text-center font-sans leading-relaxed">
                        Select your preferred digital asset or currency pair, toggle between trading strategies, and click "Get Real-time Signal" to formulate deep algorithmic execution directives.
                      </p>
                    </div>
                  )}

              </motion.div>
            )}

            {/* TAB: HISTORICAL LEDGER TRACES */}
            {activeTab === 'history' && (
              <motion.div 
                key="history"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="w-full"
              >
                <div className="bg-[rgba(30,20,50,0.45)] backdrop-blur-[12px] border border-[rgba(255,255,255,0.08)] p-5 rounded-[24px] shadow-[0_8px_32px_rgba(110,50,200,0.25)] text-left mb-6">
                  <h3 className="text-[14px] font-sans text-white font-bold">Persistent Signal History</h3>
                  <p className="text-[10px] text-slate-400 font-sans mt-0.5 leading-normal">Trace historical records of computed setups from the database repository.</p>
                </div>
                
                <SignalsLogger 
                  currentAsset={selectedAsset} 
                  lastAnalysisCompletedAt={lastAnalysisCompletedAt} 
                />
              </motion.div>
            )}

            {/* TAB: INST WATCHLIST TABLE */}
            {activeTab === 'watchlist' && (
              <motion.div 
                key="watchlist"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="bg-[rgba(30,20,50,0.45)] backdrop-blur-[12px] border border-[rgba(255,255,255,0.08)] p-5 rounded-[24px] shadow-[0_8px_32px_rgba(110,50,200,0.25)] text-left"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-white/5 pb-4 mb-4 gap-3">
                  <div>
                    <h3 className="text-[14px] font-sans text-white font-bold">Institutional Watchlist</h3>
                    <p className="text-[10px] text-slate-400 font-sans mt-0.5">Real-time quotes, pip change ratios, and micro spark charts across indices.</p>
                  </div>

                  <div className="flex bg-[#120E1B] p-0.5 rounded-lg border border-[rgba(255,255,255,0.08)] font-sans text-[9px] font-bold">
                    {(['Futures', 'Crypto', 'Metals', 'Forex'] as MarketCategory[]).map(c => (
                      <button
                        key={c}
                        onClick={() => setActiveCategory(c)}
                        className={`py-1 px-3 rounded text-center transition-all cursor-pointer  ${activeCategory === c ? 'bg-purple-600 text-white shadow-sm font-black' : 'text-slate-400 hover:text-white'}`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left font-sans text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 bg-[#120E1B]/50 select-none text-[14px] font-sans text-slate-300 font-medium">
                        <th className="py-2 px-3">Instrument</th>
                        <th className="py-2 px-3">Bid Rate</th>
                        <th className="py-2 px-3">Ask Rate</th>
                        <th className="py-2 px-3">24H Delta</th>
                        <th className="py-2 px-3">Spark chart</th>
                        <th className="py-2 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {MARKETS[activeCategory].map(asset => {
                        const details = getAssetDetails(asset);
                        const currentPrice = livePrices[asset]?.bid ?? 0;
                        const change = livePrices[asset]?.change ?? 0;
                        const isUp = change >= 0;
                        const points = livePrices[asset]?.history?.length > 1 ? livePrices[asset].history : [currentPrice, currentPrice];
                        return (
                          <tr key={asset} className="hover:bg-white/5 transition-colors">
                            <td className="py-3 px-3 font-bold flex items-center gap-2">
                              <span className="font-sans text-[9px] text-orange-400 bg-orange-950/40 px-1.5 py-0.5 rounded leading-none border border-orange-900/40 font-bold">{details.symbol}</span>
                              <div>
                                <span className="text-slate-200 font-bold text-xs block leading-none">{details.name}</span>
                                <span className="text-[9px] text-slate-400 font-normal block mt-1">{details.desc}</span>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-[13px] font-sans font-bold text-white">
                              {currentPrice.toFixed(asset.includes('JPY') ? 3 : (asset.includes('USD') && asset.length === 6 ? 5 : 2))}
                            </td>
                            <td className="py-3 px-3 text-[13px] font-sans font-medium text-slate-400">
                              {(currentPrice * 1.00015).toFixed(asset.includes('JPY') ? 3 : (asset.includes('USD') && asset.length === 6 ? 5 : 2))}
                            </td>
                            <td className={`py-3 px-3 font-sans font-bold text-[13px] ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
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
                                className="bg-purple-950/40 hover:bg-purple-900/40 text-purple-300 border border-purple-500/20 text-xs font-mono uppercase tracking-wider font-bold py-1 px-2.5 rounded transition-all cursor-pointer"
                              >
                                Deploy scan
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

            {/* TAB: ECONOMIC IMPACT GATES */}
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
                <div className="bg-[rgba(30,20,50,0.45)] backdrop-blur-[12px] border border-[rgba(255,255,255,0.08)] rounded-[24px] p-5 shadow-[0_8px_32px_rgba(110,50,200,0.25)] text-left flex flex-col justify-between h-full text-[#E2E8F0]">
                  <div>
                    <h3 className="mb-3 pb-2 border-b border-white/5 text-xs font-mono uppercase tracking-wider text-purple-300 font-bold">Risk-off parameters</h3>
                    <p className="text-xs text-slate-300 leading-relaxed font-sans space-y-4">
                      High-impact macro announcements trigger sudden spikes that clean limit stops before structural directions take over.
                    </p>
                    <p className="text-xs text-slate-300 leading-relaxed mt-3 font-sans">
                      TradeLens filters out scans automatically during volatile macro cycles to keep your risk variables secure.
                    </p>
                  </div>

                  <div className="bg-rose-950/20 border border-rose-900/30 p-4 rounded-xl text-rose-300 font-sans text-[9px] font-bold mt-6">
                    <div className="flex items-center gap-1.5 font-black mb-1 text-rose-400 font-mono">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-400 animate-pulse" /> VOLATILE CYCLES DETECTED
                    </div>
                    High volatility indexes scheduled within the active trading day. Standard risk constraints apply.
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB: MARKET SENTIMENT WIRE */}
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

                <div className="lg:col-span-2 bg-[rgba(30,20,50,0.45)] backdrop-blur-[12px] border border-[rgba(255,255,255,0.08)] rounded-[24px] p-5 shadow-[0_8px_32px_rgba(110,50,200,0.25)] flex flex-col gap-4 text-[#E2E8F0]">
                  <div className="border-b border-white/5 pb-3">
                    <h3 className="text-[14px] font-sans text-white font-bold">Consensus News Wire</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Real-time interbank order sweeps, structural disclosures, and flow indexes.</p>
                  </div>

                  <div className="flex flex-col gap-3 overflow-y-auto max-h-[380px] custom-scrollbar pr-1">
                    {[
                      { title: 'Federal Reserve hints at adaptive discount rates policy', source: 'FOMC Minutes', impact: 'High', time: '12m ago', desc: 'Central bankers suggest flexible target range adjustments based on upcoming labor indexes.' },
                      { title: 'Crude Oil settles near $79.80 after institutional drawdown', source: 'IEA Stock Audit', impact: 'Medium', time: '40m ago', desc: 'Commercial inventories indicate contraction, supporting key structural order block levels.' },
                      { title: 'Euro Zone consumer price index matches target bands', source: 'Eurostat Data', impact: 'Medium', time: '2h ago', desc: 'Consumer inflation settles at 2.4% annualized, consolidating subsequent interest rate adjustments.' },
                      { title: 'Bitcoin computational benchmarks tag new historic ranges', source: 'BLOCKCHAIN WIRE', impact: 'LOW', time: '4h ago', desc: 'Hash rates and difficulty benchmarks ascend, suggesting stable commercial backing.' }
                    ].map((news, idx) => (
                      <div key={idx} className="bg-[#120E1B]/50 border border-[rgba(255,255,255,0.05)] rounded-xl p-3.5 transition-all hover:bg-white/5 shadow-sm">
                        <div className="flex items-center justify-between gap-3 mb-1.5">
                          <span className="text-[8px] font-mono font-bold text-orange-400 bg-orange-950/40 px-2 py-0.5 rounded border border-orange-900/40">
                            {news.source}
                          </span>
                          <div className="flex items-center gap-1.5 font-sans text-[9px] font-bold">
                            <span className={`px-1.5 py-0.5 rounded border ${news.impact === 'High' ? 'bg-red-950/30 text-red-400 border-red-900/30' : 'bg-amber-950/30 text-amber-400 border-amber-900/30'}`}>
                              {news.impact}
                            </span>
                            <span className="text-slate-400">{news.time}</span>
                          </div>
                        </div>
                        <h4 className="font-bold text-white text-xs leading-snug">{news.title}</h4>
                        <p className="text-[10px] text-slate-300 mt-1 leading-relaxed">{news.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB: heatmaps */}
            {activeTab === 'heatmap' && (
              <motion.div key="heatmap" className="w-full">
                <AIConfidenceHeatmap selectedAsset={selectedAsset} onAssetChange={setSelectedAsset} />
              </motion.div>
            )}

            {/* TAB: alignment */}
            {activeTab === 'alignment' && (
              <motion.div key="alignment" className="w-full max-w-3xl mx-auto">
                <MultiTimeframeAlignment selectedAsset={selectedAsset} />
              </motion.div>
            )}

            {/* TAB: SMC PANEL */}
            {activeTab === 'smc' && (
              <motion.div key="smc" className="w-full">
                <SmartMoneyConceptsPanel selectedAsset={selectedAsset} livePrice={activeLivePrice} />
              </motion.div>
            )}

            {/* TAB: sweeps */}
            {activeTab === 'sweeps' && (
              <motion.div key="sweeps" className="w-full max-w-3xl mx-auto">
                <LiquiditySweepDetector selectedAsset={selectedAsset} livePrice={activeLivePrice} />
              </motion.div>
            )}

            {/* TAB: volume */}
            {activeTab === 'volume' && (
              <motion.div key="volume" className="w-full max-w-3xl mx-auto">
                <VolumeProfile selectedAsset={selectedAsset} />
              </motion.div>
            )}

            {/* TAB: footprint */}
            {activeTab === 'footprint' && (
              <motion.div key="footprint" className="w-full max-w-3xl mx-auto">
                <InstitutionalFootprint selectedAsset={selectedAsset} livePrice={activeLivePrice} />
              </motion.div>
            )}

            {/* TAB: monte-carlo */}
            {activeTab === 'monte-carlo' && (
              <motion.div key="monte-carlo" className="w-full max-w-3xl mx-auto">
                <MonteCarloRiskEngine />
              </motion.div>
            )}

            {/* TAB: backtesting */}
            {activeTab === 'backtesting' && (
              <motion.div key="backtesting" className="w-full max-w-3xl mx-auto">
                <StrategyBacktestingCenter />
              </motion.div>
            )}

            {/* TAB: SETTINGS CONFIGURATION */}
            {activeTab === 'settings' && (
              <motion.div 
                key="settings"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="bg-[rgba(30,20,50,0.45)] backdrop-blur-[12px] border border-[rgba(255,255,255,0.08)] p-6 rounded-[24px] max-w-xl mx-auto font-sans text-xs flex flex-col gap-4 text-left shadow-[0_8px_32px_rgba(110,50,200,0.25)] text-[#E2E8F0]"
              >
                <div className="border-b border-white/5 pb-3">
                  <h3 className="text-[14px] font-sans text-white font-bold">Desk Configuration</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-sans leading-tight">Configure account equity levels and default trade exposure multipliers.</p>
                </div>
                
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-mono text-purple-300 font-bold uppercase tracking-wider">Account Size (USD)</label>
                  <input 
                    type="number" 
                    value={accountSize}
                    onChange={(e) => setAccountSize(Number(e.target.value))}
                    className="bg-[#120E1B] border border-[rgba(255,255,255,0.1)] rounded-xl p-3 text-white outline-none focus:border-orange-500/50 transition-all font-sans font-bold shadow-inner"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-mono text-purple-300 font-bold uppercase tracking-wider">Default Risk Percentage Per Trade</label>
                  <input 
                    type="number" 
                    step="0.1"
                    value={riskPct}
                    onChange={(e) => setRiskPct(Number(e.target.value))}
                    className="bg-[#120E1B] border border-[rgba(255,255,255,0.1)] rounded-xl p-3 text-white outline-none focus:border-orange-500/50 transition-all font-sans font-bold shadow-inner"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-mono text-purple-300 font-bold uppercase tracking-wider">AI Analysis Depth</label>
                  <select className="bg-[#120E1B] border border-[rgba(255,255,255,0.1)] rounded-xl p-3 text-slate-300 outline-none font-sans cursor-pointer font-bold shadow-sm">
                    <option className="bg-[#120E1B] text-white">Standard (Multi-timeframe consensus only)</option>
                    <option className="bg-[#120E1B] text-white">Deep Ingress (Dual reasoning chain with Fallbacks)</option>
                  </select>
                </div>

                <div className="border-t border-white/5 pt-4 mt-2 flex justify-between items-center text-slate-400">
                  <span className="font-mono text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Engine status: Ready</span>
                  <button 
                    onClick={() => {
                      setAccountSize(10000);
                      setRiskPct(1.0);
                    }}
                    className="px-3.5 py-1.5 bg-purple-950/40 hover:bg-purple-900/40 text-purple-300 rounded-lg border border-purple-500/20 transition-all cursor-pointer shadow-sm text-xs font-mono font-bold uppercase tracking-wider"
                  >
                    Reset Defaults
                  </button>
                </div>
              </motion.div>
            )}

            {/* TAB: faq help guidelines */}
            {activeTab === 'help' && (
              <motion.div 
                key="help"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="bg-[rgba(30,20,50,0.45)] backdrop-blur-[12px] border border-[rgba(255,255,255,0.08)] p-6 rounded-[24px] max-w-2xl mx-auto text-left shadow-[0_8px_32px_rgba(110,50,200,0.25)] text-[#E2E8F0]"
              >
                <div className="border-b border-white/5 pb-3 mb-4">
                  <h3 className="text-[14px] font-sans text-white font-bold">System Documentation</h3>
                  <p className="text-[10px] text-slate-400 font-sans mt-0.5">Quantitative guidelines and technical execution definitions.</p>
                </div>

                <div className="flex flex-col gap-3">
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
                      a: 'Risk thresholds can be tweaked directly in the Desk Configuration tab. By setting default account equity values and max risk percentages per trade, position sizing is dynamically computed to prevent excessive drawdowns during periods of high-impact macro volatility.'
                    }
                  ].map((faq, idx) => (
                    <details key={idx} className="group bg-[#120E1B]/50 border border-[rgba(255,255,255,0.05)] rounded-xl p-3.5 [&_summary::-webkit-details-marker]:hidden transition-all shadow-sm">
                      <summary className="flex items-center justify-between font-bold text-xs text-white cursor-pointer select-none">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                          <span>{faq.q}</span>
                        </div>
                        <span className="text-slate-400 group-open:rotate-180 transition-transform leading-none font-bold">↓</span>
                      </summary>
                      <p className="text-xs text-slate-300 leading-relaxed mt-3 pl-3.5 border-l-2 border-orange-500 font-sans">
                        {faq.a}
                      </p>
                    </details>
                  ))}
                </div>
              </motion.div>
            )}

          </AnimatePresence>

          {/* Humbler Footer */}
          <footer className="text-center py-4 mt-8 border-t border-white/5 text-[11px] font-mono text-purple-300/60 uppercase tracking-widest font-bold">
            Proprietary quantitative core model. High-risk indicators active. Discretion is advised.
          </footer>

        </main>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.01); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.22); }
      `}} />

    </div>
  );
}
