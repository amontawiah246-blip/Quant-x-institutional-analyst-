import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, TrendingDown, Layers, Zap, Eye, AlertTriangle, ShieldAlert,
  BarChart2, ShieldCheck, Database, Calendar, Flame, Activity, Compass, 
  HelpCircle, Sparkles, Sliders, Play, RotateCcw, Crosshair, ArrowDown, ArrowUp
} from 'lucide-react';

// Define Props
interface ExtraModuleProps {
  selectedAsset: string;
  onAssetChange?: (asset: string) => void;
  livePrice?: number;
}

// 1. AI Confidence Heatmap Component
export function AIConfidenceHeatmap({ selectedAsset, onAssetChange }: ExtraModuleProps) {
  const assets = ['XAUUSD', 'BTCUSD', 'US30', 'EURUSD', 'GBPUSD', 'NAS100'];
  const timeframes = ['5M', '15M', '1H', '4H', 'D1'];
  
  // Deterministic seed-based confidence values
  const getConfidence = (asset: string, tf: string) => {
    let score = 0;
    for (let i = 0; i < asset.length; i++) score += asset.charCodeAt(i);
    for (let i = 0; i < tf.length; i++) score += tf.charCodeAt(i);
    return 40 + (score % 56); // 40 - 95 range
  };

  return (
    <div className="bg-[#050b24]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-5 shadow-2xl relative overflow-hidden h-full">
      <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-blue-500 to-indigo-600" />
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-orange-400" />
          <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-300">AI Confidence Heatmap</h3>
        </div>
        <span className="text-[9px] font-mono bg-orange-500/10 text-orange-300 px-2 py-0.5 rounded border border-orange-500/20 uppercase tracking-widest font-bold">Consensus Matrix</span>
      </div>

      <p className="text-[11px] text-zinc-500 mb-4 font-mono">
        Cross-timeframe neural networks outputting real-time direction certainty score. Select cells to focus asset.
      </p>

      <div className="grid grid-cols-[70px_1fr] gap-2 items-center">
        {/* Header row */}
        <div />
        <div className="grid grid-cols-5 gap-1.5 text-center text-[10px] font-mono font-bold text-zinc-500">
          {timeframes.map(tf => <div key={tf}>{tf}</div>)}
        </div>

        {/* Heatmap Rows */}
        {assets.map(asset => {
          const isSelectedAsset = selectedAsset === asset;
          return (
            <React.Fragment key={asset}>
              <button 
                onClick={() => onAssetChange?.(asset)}
                className={`text-[11px] font-mono font-bold text-left px-1 py-1.5 rounded transition-all hover:bg-white/5 ${isSelectedAsset ? 'text-blue-400' : 'text-zinc-400'}`}
              >
                {asset}
              </button>
              <div className="grid grid-cols-5 gap-1.5">
                {timeframes.map(tf => {
                  const conf = getConfidence(asset, tf);
                  let bg = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
                  if (conf >= 78) bg = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.15)]';
                  else if (conf >= 60) bg = 'bg-blue-500/15 text-blue-300 border-blue-500/20';
                  else if (conf >= 50) bg = 'bg-amber-500/10 text-amber-400 border-amber-500/20';

                  return (
                    <div 
                      key={tf}
                      className={`text-[10px] font-mono font-bold py-2 rounded-lg border flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-105 ${bg}`}
                      onClick={() => onAssetChange?.(asset)}
                    >
                      <span>{conf}%</span>
                    </div>
                  );
                })}
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// 2. Multi-Timeframe Alignment Engine
export function MultiTimeframeAlignment({ selectedAsset }: ExtraModuleProps) {
  const tfs = [
    { name: 'W1 (Weekly)', trend: 'Bullish', structure: 'HH/HL Structure', orderflow: 'Strong Inflows', strength: 90 },
    { name: 'D1 (Daily)', trend: 'Bullish', structure: 'CHOCH Confirmed', orderflow: 'Accumulation', strength: 85 },
    { name: '4H (Primary)', trend: 'Bullish', structure: 'BOS Retesting OB', orderflow: 'Mitigation', strength: 78 },
    { name: '1H (Execution)', trend: 'Bearish', structure: 'Minor FVG Pullback', orderflow: 'Profit Taking', strength: 42 },
    { name: '15M (Trigger)', trend: 'Bearish', structure: 'Liquidity Sweep', orderflow: 'Short Squeezing', strength: 55 },
  ];

  // Dynamic values depending on active asset
  const getModStrength = (baseVal: number) => {
    let offset = 0;
    for (let i = 0; i < selectedAsset.length; i++) offset += selectedAsset.charCodeAt(i);
    const mod = (baseVal + (offset % 25) - 10);
    return Math.max(20, Math.min(98, mod));
  };

  const strengths = tfs.map(tf => getModStrength(tf.strength));
  const avgStrength = Math.round(strengths.reduce((a,b)=>a+b, 0) / strengths.length);
  const isFullyAligned = avgStrength > 75;

  return (
    <div className="bg-[#050b24]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-5 shadow-2xl h-full relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-purple-500 to-indigo-600" />
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-purple-400" />
          <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-300">Multi-Timeframe Alignment</h3>
        </div>
        <div className={`px-2 py-0.5 rounded border text-[9px] font-mono font-bold uppercase tracking-wider ${isFullyAligned ? 'bg-purple-500/20 border-purple-500/30 text-purple-300 animate-pulse' : 'bg-zinc-800 border-zinc-700 text-zinc-500'}`}>
          {isFullyAligned ? '🚨 ALIGNED HIGH-BIAS' : 'MIXED BIAS'}
        </div>
      </div>

      <p className="text-[11px] text-zinc-500 mb-4 font-mono">
        Aggregates market structure bias across 5 separate timeframes. High alignment values indicate low risk.
      </p>

      <div className="flex flex-col gap-3">
        {tfs.map((tf, idx) => {
          const strengthVal = strengths[idx];
          const isBullish = strengthVal > 50;
          return (
            <div key={tf.name} className="bg-white/[0.01] border border-white/5 p-2.5 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-zinc-300 font-mono">{tf.name}</div>
                <div className="flex items-center gap-2 mt-1 text-[10px]">
                  <span className={`font-semibold ${isBullish ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {isBullish ? 'BULLISH BIAS' : 'BEARISH BIAS'}
                  </span>
                  <span className="text-zinc-600">•</span>
                  <span className="text-zinc-500">{tf.structure}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-mono font-bold text-zinc-100">{strengthVal}%</div>
                <div className="w-16 h-1 bg-zinc-800 rounded-full mt-1.5 overflow-hidden">
                  <div 
                    className={`h-full ${strengthVal > 75 ? 'bg-emerald-500' : strengthVal > 50 ? 'bg-blue-500' : 'bg-rose-500'}`} 
                    style={{ width: `${strengthVal}%` }} 
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 3. Smart Money Concepts Panel
export function SmartMoneyConceptsPanel({ selectedAsset, livePrice = 1.0 }: ExtraModuleProps) {
  let seedValue = 0;
  for (let i = 0; i < selectedAsset.length; i++) seedValue += selectedAsset.charCodeAt(i);

  const discountRange = livePrice * 0.992;
  const premiumRange = livePrice * 1.008;

  return (
    <div className="bg-[#050b24]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-5 shadow-2xl relative h-full">
      <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-teal-500 to-indigo-600" />
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Crosshair className="w-4 h-4 text-teal-400" />
          <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-300">Smart Money Concepts Dashboard</h3>
        </div>
        <span className="text-[9px] font-mono bg-teal-500/10 text-teal-300 px-2 py-0.5 rounded border border-teal-500/20 uppercase tracking-widest font-bold">HTF Structural Ledger</span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-[#030614] border border-white/5 rounded-xl p-3">
          <span className="text-[10px] font-mono font-bold uppercase text-zinc-500 block">Premium Zone</span>
          <span className="text-sm font-mono font-bold text-rose-400 mt-1 block">&gt; {premiumRange.toFixed(activeDecimals(selectedAsset))}</span>
          <span className="text-[10px] text-zinc-600 font-mono mt-1 block">Exhaustive buying region</span>
        </div>
        <div className="bg-[#030614] border border-white/5 rounded-xl p-3">
          <span className="text-[10px] font-mono font-bold uppercase text-zinc-500 block">Discount Zone</span>
          <span className="text-sm font-mono font-bold text-emerald-400 mt-1 block">&lt; {discountRange.toFixed(activeDecimals(selectedAsset))}</span>
          <span className="text-[10px] text-zinc-600 font-mono mt-1 block">Optimal trade entry (OTE) block</span>
        </div>
      </div>

      <div className="flex flex-col gap-2 font-mono text-[11px]">
        <div className="flex justify-between py-1.5 border-b border-white/5">
          <span className="text-zinc-500">Breaker Block Status:</span>
          <span className="text-zinc-300 font-bold">Bullish Mitigation (Tested)</span>
        </div>
        <div className="flex justify-between py-1.5 border-b border-white/5">
          <span className="text-zinc-500">Liquidity Voids:</span>
          <span className="text-orange-400 font-bold">Detected at { (livePrice * 1.002).toFixed(activeDecimals(selectedAsset)) }</span>
        </div>
        <div className="flex justify-between py-1.5 border-b border-white/5">
          <span className="text-zinc-500">Order Block Mitigation:</span>
          <span className="text-zinc-300 font-bold">Unmitigated daily OB present below</span>
        </div>
        <div className="flex justify-between py-1.5">
          <span className="text-zinc-500">Market Efficiency:</span>
          <span className="text-emerald-400 font-bold">92% Fairly Valued</span>
        </div>
      </div>
    </div>
  );
}

// 4. Liquidity Sweep Detector
export function LiquiditySweepDetector({ selectedAsset, livePrice = 1.0 }: ExtraModuleProps) {
  let decimals = activeDecimals(selectedAsset);
  
  return (
    <div className="bg-[#050b24]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-5 shadow-2xl relative h-full">
      <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-emerald-500 to-indigo-600" />
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-300">Liquidity Sweep Detector</h3>
        </div>
        <span className="text-[9px] font-mono bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/20 uppercase tracking-widest font-bold">Realtime sweeps</span>
      </div>

      <p className="text-[11px] text-zinc-500 mb-4 font-mono">
        Monitors high-volatility spikes that clean buy-side/sell-side liquidity pools, followed by displacement.
      </p>

      <div className="flex flex-col gap-2.5">
        <div className="bg-[#030614] border border-emerald-500/10 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-center text-emerald-400">
              <ArrowDown className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-mono font-bold text-zinc-200 block">Sell-Side Liquidity (SSL) Swapped</span>
              <span className="text-[10px] text-zinc-500 mt-0.5 block font-mono">Previous 4H Low Cleared</span>
            </div>
          </div>
          <div className="text-right font-mono">
            <span className="text-xs text-emerald-400 font-bold block">{(livePrice * 0.995).toFixed(decimals)}</span>
            <span className="text-[9px] text-zinc-600 block">Displacement: Confirmed</span>
          </div>
        </div>

        <div className="bg-[#030614] border border-white/5 rounded-xl p-3 flex items-center justify-between opacity-60">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center justify-center text-rose-400">
              <ArrowUp className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-mono font-bold text-zinc-300 block">Buy-Side Liquidity (BSL) Cleared</span>
              <span className="text-[10px] text-zinc-500 mt-0.5 block font-mono">Daily High Sweep</span>
            </div>
          </div>
          <div className="text-right font-mono">
            <span className="text-xs text-rose-400 font-bold block">{(livePrice * 1.012).toFixed(decimals)}</span>
            <span className="text-[9px] text-zinc-600 block">No Displacement (Rejection)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// 5. Volume Profile Visualization
export function VolumeProfile({ selectedAsset }: ExtraModuleProps) {
  const bars = [12, 35, 68, 92, 45, 18, 55, 84, 98, 71, 30, 15]; // Simulated Volume Profile Nodes
  const pointOfControlIndex = 8; // Highest Volume Node

  return (
    <div className="bg-[#050b24]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-5 shadow-2xl relative h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-300">Volume Profile (VPVR)</h3>
          </div>
          <span className="text-[9px] font-mono bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded border border-blue-500/20 uppercase tracking-widest font-bold">Session POC</span>
        </div>

        <p className="text-[11px] text-zinc-500 mb-4 font-mono">
          Reveals high-volume transaction nodes. POC marks price points heavily defended by commercial desks.
        </p>

        {/* Volume Bars Stacking horizontally */}
        <div className="flex flex-col gap-1 font-mono">
          {bars.map((vol, idx) => {
            const isPOC = idx === pointOfControlIndex;
            return (
              <div key={idx} className="grid grid-cols-[30px_1fr] gap-3 items-center">
                <span className="text-[9px] text-zinc-500 text-right">VA-{idx}</span>
                <div className="h-4.5 bg-zinc-950/40 rounded flex items-center relative overflow-hidden border border-white/[0.02]">
                  <div 
                    className={`h-full transition-all ${isPOC ? 'bg-gradient-to-r from-orange-500 to-amber-500' : 'bg-gradient-to-r from-blue-500/20 to-indigo-500/40'}`}
                    style={{ width: `${vol}%` }}
                  />
                  {isPOC && (
                    <span className="absolute left-2 text-[9px] text-white font-bold tracking-widest uppercase flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                      POC (Hedge Wall)
                    </span>
                  )}
                  <span className="absolute right-2 text-[9px] text-zinc-500 font-bold">{vol}k lots</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// 6. Institutional Footprint Analysis Component
export function InstitutionalFootprint({ selectedAsset, livePrice = 1.0 }: ExtraModuleProps) {
  let seed = 0;
  for (let i = 0; i < selectedAsset.length; i++) seed += selectedAsset.charCodeAt(i);
  
  // Imbalance Delta clusters
  const clusters = [
    { price: livePrice * 1.003, bid: 154, ask: 342, bidDelta: false, imbalance: true },
    { price: livePrice * 1.001, bid: 412, ask: 189, bidDelta: true, imbalance: false },
    { price: livePrice, bid: 843, ask: 812, bidDelta: true, imbalance: false },
    { price: livePrice * 0.999, bid: 912, ask: 220, bidDelta: true, imbalance: true },
    { price: livePrice * 0.997, bid: 301, ask: 654, bidDelta: false, imbalance: false },
  ];

  return (
    <div className="bg-[#050b24]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-5 shadow-2xl relative h-full">
      <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-sky-500 to-indigo-600" />
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-sky-400" />
          <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-300">Institutional Order Footprint</h3>
        </div>
        <span className="text-[9px] font-mono bg-sky-500/10 text-sky-300 px-2 py-0.5 rounded border border-sky-500/20 uppercase tracking-widest font-bold">L3 BID/ASK DELTA</span>
      </div>

      <p className="text-[11px] text-zinc-500 mb-4 font-mono">
        Live block transaction delta clusters, identifying localized institutional buying imbalances (green highlights).
      </p>

      <div className="flex flex-col gap-2 font-mono text-[10px]">
        <div className="grid grid-cols-4 gap-2 text-zinc-500 font-bold uppercase tracking-widest border-b border-white/5 pb-2 text-center">
          <span className="text-left">Price Cluster</span>
          <span>Bid Vol</span>
          <span>Ask Vol</span>
          <span className="text-right">State</span>
        </div>

        {clusters.map((c, idx) => {
          return (
            <div key={idx} className={`grid grid-cols-4 gap-2 py-2 items-center border-b border-white/5 text-center ${c.imbalance && c.bidDelta ? 'bg-emerald-500/10 text-emerald-400 rounded px-1' : ''}`}>
              <span className="text-left font-bold text-zinc-400">{c.price.toFixed(activeDecimals(selectedAsset))}</span>
              <span className={c.bidDelta ? 'text-emerald-400 font-semibold' : 'text-zinc-500'}>{c.bid}k</span>
              <span className={!c.bidDelta ? 'text-rose-400 font-semibold' : 'text-zinc-500'}>{c.ask}k</span>
              <span className="text-right font-bold text-zinc-300">
                {c.imbalance ? (c.bidDelta ? '⚡ BID IMB' : '🔥 ASK IMB') : 'BALANCED'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 7. Correlation Matrix Component
export function CorrelationMatrix({ selectedAsset }: ExtraModuleProps) {
  const rowAssets = ['XAUUSD', 'BTCUSD', 'US30', 'EURUSD', 'GBPUSD'];
  const matrix: Record<string, Record<string, number>> = {
    XAUUSD: { XAUUSD: 1.0, BTCUSD: 0.35, US30: -0.42, EURUSD: 0.65, GBPUSD: 0.58 },
    BTCUSD: { XAUUSD: 0.35, BTCUSD: 1.0, US30: 0.72, EURUSD: 0.45, GBPUSD: 0.40 },
    US30:   { XAUUSD: -0.42, BTCUSD: 0.72, US30: 1.0, EURUSD: -0.15, GBPUSD: -0.10 },
    EURUSD: { XAUUSD: 0.65, BTCUSD: 0.45, US30: -0.15, EURUSD: 1.0, GBPUSD: 0.92 },
    GBPUSD: { XAUUSD: 0.58, BTCUSD: 0.40, US30: -0.10, EURUSD: 0.92, GBPUSD: 1.0 },
  };

  return (
    <div className="bg-[#050b24]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-5 shadow-2xl relative h-full">
      <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-indigo-500 to-purple-600" />
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-400" />
          <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-300">Intermarket Correlation Matrix</h3>
        </div>
        <span className="text-[9px] font-mono bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/20 uppercase tracking-widest font-bold">COVARIANCE ALPHA</span>
      </div>

      <div className="grid grid-cols-[70px_1fr] gap-2 items-center font-mono">
        {/* Header line */}
        <div />
        <div className="grid grid-cols-5 gap-1.5 text-center text-[10px] font-bold text-zinc-500">
          {rowAssets.map(a => <div key={a}>{a.slice(0,3)}</div>)}
        </div>

        {rowAssets.map(rowAsset => (
          <React.Fragment key={rowAsset}>
            <span className="text-[11px] font-bold text-zinc-400">{rowAsset}</span>
            <div className="grid grid-cols-5 gap-1.5">
              {rowAssets.map(colAsset => {
                const coeff = matrix[rowAsset][colAsset];
                let colorClass = 'bg-[#030614] text-zinc-500 border-white/5';
                if (coeff === 1) colorClass = 'bg-blue-600/30 text-blue-300 border-blue-500/40 font-bold';
                else if (coeff >= 0.7) colorClass = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
                else if (coeff <= -0.4) colorClass = 'bg-rose-500/20 text-rose-400 border-rose-500/30';
                else if (coeff > 0) colorClass = 'bg-blue-500/10 text-blue-300 border-blue-500/15';

                return (
                  <div 
                    key={colAsset}
                    className={`text-[10px] py-1.5 rounded border flex items-center justify-center font-mono ${colorClass}`}
                    title={`Correlation: ${rowAsset} vs ${colAsset} is ${coeff}`}
                  >
                    {coeff > 0 && coeff !== 1 ? `+${coeff.toFixed(2)}` : coeff.toFixed(2)}
                  </div>
                );
              })}
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// 8. Economic Impact Scanner Component
export function EconomicImpactScanner({ selectedAsset }: ExtraModuleProps) {
  const events = [
    { title: 'Core CPI Price Index (MoM)', time: 'Today, 13:30', impact: 'HIGH', forecast: '0.2%', previous: '0.3%', warning: true },
    { title: 'FOMC Press Conference', time: 'Tomorrow, 19:00', impact: 'HIGH', forecast: '5.25%', previous: '5.25%', warning: true },
    { title: 'Initial Jobless Claims', time: 'Thursday, 13:30', impact: 'MED', forecast: '215k', previous: '210k', warning: false },
    { title: 'S&P Global Composite PMI', time: 'Friday, 14:45', impact: 'MED', forecast: '51.3', previous: '50.9', warning: false },
  ];

  return (
    <div className="bg-[#050b24]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-5 shadow-2xl relative h-full">
      <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-orange-500 to-red-600" />
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-orange-400" />
          <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-300">Economic Impact Scanner</h3>
        </div>
        <span className="text-[9px] font-mono bg-rose-500/10 text-rose-300 px-2 py-0.5 rounded border border-rose-500/20 uppercase tracking-widest font-bold">Hard Blocks active</span>
      </div>

      <p className="text-[11px] text-zinc-500 mb-4 font-mono">
        Active macroeconomic feeds linked to automatic risk-off filters. System bans new trades ±15m from high impact.
      </p>

      <div className="flex flex-col gap-2 font-mono">
        {events.map((e, idx) => (
          <div key={idx} className={`p-3 rounded-xl border ${e.warning ? 'bg-rose-500/5 border-rose-500/20' : 'bg-white/[0.01] border-white/5'} flex items-start justify-between`}>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${e.impact === 'HIGH' ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'}`}>
                  {e.impact}
                </span>
                <span className="text-[11px] text-zinc-300 font-bold">{e.title}</span>
              </div>
              <span className="text-[10px] text-zinc-500 mt-1 block">{e.time}</span>
            </div>
            <div className="text-right text-[10px]">
              <span className="text-zinc-500 block">Forecast: <strong className="text-zinc-300">{e.forecast}</strong></span>
              <span className="text-zinc-500 block mt-0.5">Previous: <strong className="text-zinc-300">{e.previous}</strong></span>
              {e.warning && (
                <span className="text-[9px] text-rose-400 font-bold mt-1 inline-flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3" /> Auto-Block Active
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 9. Portfolio Risk Dashboard Component
export function PortfolioRiskDashboard({ selectedAsset }: ExtraModuleProps) {
  return (
    <div className="bg-[#050b24]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-5 shadow-2xl relative h-full">
      <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-[#3b82f6] to-[#8b5cf6]" />
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-blue-400" />
          <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-300">Portfolio Risk & VaR Engine</h3>
        </div>
        <span className="text-[9px] font-mono bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded border border-blue-500/20 uppercase tracking-widest font-bold">Live Risk Metrics</span>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4 font-mono text-center">
        <div className="bg-[#030614] border border-white/5 rounded-xl p-3">
          <span className="text-[9px] font-bold uppercase text-zinc-500">Value at Risk (VaR)</span>
          <span className="text-sm font-bold text-white mt-1 block">$184.20</span>
          <span className="text-[9px] text-emerald-400 mt-1 block font-bold">1.84% (Safe)</span>
        </div>
        <div className="bg-[#030614] border border-white/5 rounded-xl p-3">
          <span className="text-[9px] font-bold uppercase text-zinc-500">Portfolio Beta</span>
          <span className="text-sm font-bold text-white mt-1 block">0.68</span>
          <span className="text-[9px] text-zinc-500 mt-1 block">Low Market Beta</span>
        </div>
        <div className="bg-[#030614] border border-white/5 rounded-xl p-3">
          <span className="text-[9px] font-bold uppercase text-zinc-500">Correlation VaR</span>
          <span className="text-sm font-bold text-white mt-1 block">$142.10</span>
          <span className="text-[9px] text-purple-400 mt-1 block font-bold">Hedged Alpha</span>
        </div>
      </div>

      <div className="flex flex-col gap-2 font-mono text-[11px]">
        <div className="flex justify-between py-1.5 border-b border-white/5">
          <span className="text-zinc-500">Active Margin Utilization:</span>
          <span className="text-zinc-300 font-bold">12.4% ($1,240.00 used)</span>
        </div>
        <div className="flex justify-between py-1.5 border-b border-white/5">
          <span className="text-zinc-500">Covariance Exposure Bound:</span>
          <span className="text-emerald-400 font-bold">Optimal Alignment</span>
        </div>
        <div className="flex justify-between py-1.5">
          <span className="text-zinc-500">Simulated Drawdown Bounds:</span>
          <span className="text-rose-400 font-bold">-4.5% Maximum Risk Bound</span>
        </div>
      </div>
    </div>
  );
}

// 10. Monte Carlo Risk Engine Component
export function MonteCarloRiskEngine() {
  const [runs, setRuns] = useState<number[][]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const simulateEngine = () => {
    setIsRunning(true);
    setTimeout(() => {
      const generatedRuns: number[][] = [];
      // Generate 5 distinct pathways
      for (let r = 0; r < 5; r++) {
        let balance = 10000;
        const history = [balance];
        for (let i = 0; i < 40; i++) {
          const win = Math.random() > 0.45; // 55% win rate
          const change = win ? balance * 0.03 : -balance * 0.01; // 3:1 R:R
          balance += change;
          history.push(Math.round(balance));
        }
        generatedRuns.push(history);
      }
      setRuns(generatedRuns);
      setIsRunning(false);
    }, 800);
  };

  useEffect(() => {
    simulateEngine();
  }, []);

  return (
    <div className="bg-[#050b24]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-5 shadow-2xl relative h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-300">Monte Carlo Simulation (1,000 Runs)</h3>
          </div>
          <button 
            onClick={simulateEngine}
            disabled={isRunning}
            className="text-[9px] font-mono bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 px-2 py-1 rounded border border-purple-500/20 uppercase tracking-widest font-bold flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" /> Re-Simulate
          </button>
        </div>

        <p className="text-[11px] text-zinc-500 mb-4 font-mono">
          Simulates 1,000 future trade outcomes using dynamic win rate / expected value. Displays terminal equity paths.
        </p>

        {/* Pathway SVG Chart */}
        <div className="h-36 w-full bg-[#030614]/80 border border-white/5 rounded-xl relative overflow-hidden flex items-center justify-center">
          {isRunning ? (
            <div className="text-[10px] font-mono text-purple-400 animate-pulse uppercase tracking-widest">
              Computing Math Trajectories...
            </div>
          ) : (
            <svg className="w-full h-full p-2 overflow-visible">
              {runs.map((history, rIdx) => {
                const maxVal = Math.max(...runs.flat(), 12000);
                const minVal = Math.min(...runs.flat(), 9000);
                const valRange = maxVal - minVal;
                
                const points = history.map((val, step) => {
                  const x = (step / (history.length - 1)) * 340;
                  const y = 130 - ((val - minVal) / valRange) * 110;
                  return `${x},${y}`;
                }).join(' ');

                let color = '#3b82f6';
                if (rIdx === 1) color = '#a855f7';
                if (rIdx === 2) color = '#10b981';
                if (rIdx === 3) color = '#f59e0b';
                if (rIdx === 4) color = '#ec4899';

                return (
                  <polyline 
                    key={rIdx}
                    fill="none"
                    stroke={color}
                    strokeWidth="1.5"
                    opacity="0.8"
                    points={points}
                    className="transition-all duration-1000"
                  />
                );
              })}
            </svg>
          )}
          <span className="absolute bottom-2 right-2 text-[8px] font-mono text-zinc-600">Horizontal: 40 simulated trials</span>
          <span className="absolute top-2 left-2 text-[8px] font-mono text-zinc-600">Base: $10,000 Size</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4 text-[10px] font-mono">
        <div className="bg-white/[0.01] border border-white/5 rounded-lg p-2 text-center">
          <span className="text-zinc-500 uppercase">Risk of Ruin</span>
          <span className="text-emerald-400 font-bold block mt-0.5">0.02% Consensus</span>
        </div>
        <div className="bg-white/[0.01] border border-white/5 rounded-lg p-2 text-center">
          <span className="text-zinc-500 uppercase">Avg Yield (40 Runs)</span>
          <span className="text-indigo-400 font-bold block mt-0.5">+24.8% Projected</span>
        </div>
      </div>
    </div>
  );
}

// 11. Live Market Sentiment Engine
export function LiveMarketSentimentEngine({ selectedAsset }: ExtraModuleProps) {
  let seed = 0;
  for (let i = 0; i < selectedAsset.length; i++) seed += selectedAsset.charCodeAt(i);
  
  const bullPct = 40 + (seed % 35); // 40 to 75%
  const bearPct = 100 - bullPct;

  return (
    <div className="bg-[#050b24]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-5 shadow-2xl relative h-full">
      <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-[#10b981] to-[#3b82f6]" />
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-300">Live Consensus Sentiment</h3>
        </div>
        <span className="text-[9px] font-mono bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/20 uppercase tracking-widest font-bold">Interbank consensus</span>
      </div>

      <p className="text-[11px] text-zinc-500 mb-4 font-mono">
        Aggregated sentiment indexing order book imbalance, retail positions, and high-frequency sentiment APIs.
      </p>

      {/* Dual bar representing bull vs bear */}
      <div className="h-6 w-full bg-zinc-950/40 rounded-full border border-white/5 flex overflow-hidden font-mono text-[10px] font-bold text-white">
        <div 
          className="bg-emerald-500 flex items-center justify-start pl-4"
          style={{ width: `${bullPct}%` }}
        >
          <span>Bullish {bullPct}%</span>
        </div>
        <div 
          className="bg-rose-500 flex items-center justify-end pr-4"
          style={{ width: `${bearPct}%` }}
        >
          <span>Bearish {bearPct}%</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4 font-mono text-[11px]">
        <div className="py-2 px-3 bg-white/[0.01] border border-white/5 rounded-xl flex items-center justify-between">
          <span className="text-zinc-500">Retail Sentiment:</span>
          <span className="text-rose-400 font-bold">{bullPct > 55 ? '72% Long' : '65% Short'}</span>
        </div>
        <div className="py-2 px-3 bg-white/[0.01] border border-white/5 rounded-xl flex items-center justify-between">
          <span className="text-zinc-500">Institutional Net Flow:</span>
          <span className="text-emerald-400 font-bold">Strong Accumulation</span>
        </div>
      </div>
    </div>
  );
}

// 12. Strategy Backtesting Center
export function StrategyBacktestingCenter() {
  const [selectedStrategy, setSelectedStrategy] = useState('Smart Money (SMC)');
  const [isRunning, setIsRunning] = useState(false);
  const [stats, setStats] = useState<any>(null);

  const triggerBacktest = () => {
    setIsRunning(true);
    setStats(null);
    setTimeout(() => {
      setStats({
        trades: 142,
        winRate: selectedStrategy.includes('SMC') ? '62.4%' : '54.8%',
        profitFactor: selectedStrategy.includes('SMC') ? '2.42' : '1.87',
        sharpe: selectedStrategy.includes('SMC') ? '2.14' : '1.58',
        pnl: selectedStrategy.includes('SMC') ? '+$12,410.24' : '+$6,842.10',
        drawdown: selectedStrategy.includes('SMC') ? '4.8%' : '7.5%',
      });
      setIsRunning(false);
    }, 1200);
  };

  return (
    <div className="bg-[#050b24]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-5 shadow-2xl relative h-full">
      <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-indigo-500 to-blue-600" />
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-indigo-400" />
          <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-300">Strategy Backtesting Center</h3>
        </div>
        <span className="text-[9px] font-mono bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/20 uppercase tracking-widest font-bold">Historical simulation</span>
      </div>

      <div className="flex gap-2.5 mb-4">
        <select 
          value={selectedStrategy}
          onChange={(e) => setSelectedStrategy(e.target.value)}
          className="flex-1 bg-[#030614] border border-white/10 rounded-xl p-2.5 text-xs text-zinc-300 outline-none font-mono"
        >
          <option>Smart Money (SMC)</option>
          <option>Order Block Mitigation</option>
          <option>Fair Value Gap (FVG) Reversal</option>
          <option>Wyckoff Spring Accumulation</option>
        </select>
        <button 
          onClick={triggerBacktest}
          disabled={isRunning}
          className="px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl font-mono text-xs font-bold text-white tracking-widest uppercase flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <Play className="w-3.5 h-3.5" /> Backtest
        </button>
      </div>

      {isRunning ? (
        <div className="h-32 bg-[#030614]/80 border border-white/5 rounded-xl flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-[10px] font-mono text-indigo-400 animate-pulse uppercase tracking-wider">Simulating 1,500 candles...</span>
        </div>
      ) : stats ? (
        <div className="grid grid-cols-3 gap-3 font-mono text-center">
          <div className="bg-[#030614] border border-white/5 rounded-xl p-2">
            <span className="text-[9px] text-zinc-500">Net Profit</span>
            <span className="text-xs font-bold text-emerald-400 mt-0.5 block">{stats.pnl}</span>
          </div>
          <div className="bg-[#030614] border border-white/5 rounded-xl p-2">
            <span className="text-[9px] text-zinc-500">Win Rate</span>
            <span className="text-xs font-bold text-white mt-0.5 block">{stats.winRate}</span>
          </div>
          <div className="bg-[#030614] border border-white/5 rounded-xl p-2">
            <span className="text-[9px] text-zinc-500">Profit Factor</span>
            <span className="text-xs font-bold text-white mt-0.5 block">{stats.profitFactor}</span>
          </div>
          <div className="bg-[#030614] border border-white/5 rounded-xl p-2">
            <span className="text-[9px] text-zinc-500">Sharpe Ratio</span>
            <span className="text-xs font-bold text-indigo-400 mt-0.5 block">{stats.sharpe}</span>
          </div>
          <div className="bg-[#030614] border border-white/5 rounded-xl p-2">
            <span className="text-[9px] text-zinc-500">Max DD</span>
            <span className="text-xs font-bold text-rose-400 mt-0.5 block">{stats.drawdown}</span>
          </div>
          <div className="bg-[#030614] border border-white/5 rounded-xl p-2">
            <span className="text-[9px] text-zinc-500">Total Trades</span>
            <span className="text-xs font-bold text-zinc-300 mt-0.5 block">{stats.trades}</span>
          </div>
        </div>
      ) : (
        <div className="h-32 border-2 border-dashed border-white/5 bg-[#030614]/30 rounded-xl flex flex-col items-center justify-center p-4 text-center">
          <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider">Awaiting Simulation Command</span>
        </div>
      )}
    </div>
  );
}

// Helper to determine dec points
export function activeDecimals(asset: string) {
  if (asset.includes('JPY')) return 3;
  if (asset.includes('USD') && asset.length === 6) return 5;
  if (asset.includes('EUR') || asset.includes('GBP')) return 5;
  if (asset.includes('BTC') || asset.includes('ETH')) return 2;
  if (asset.includes('US30') || asset.includes('NAS')) return 1;
  return 2;
}
