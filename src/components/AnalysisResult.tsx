import { SMCSignal } from '../types.ts';
import { 
  AlertTriangle, 
  Clock, 
  Activity, 
  ShieldAlert, 
  Zap,
  BookOpen
} from 'lucide-react';

interface AnalysisResultProps {
  signal: SMCSignal | null;
  isLoading: boolean;
}

export default function AnalysisResult({ signal, isLoading }: AnalysisResultProps) {
  if (isLoading) {
    return (
      <div className="bg-[#13111C]/80 backdrop-blur-md border border-white/5 rounded-[24px] p-8 text-center flex flex-col justify-center items-center h-[420px] gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-t-purple-500 border-r-purple-500/30 border-b-purple-500/10 border-l-purple-500/5 animate-spin" />
          <Zap className="w-6 h-6 text-purple-400 absolute inset-0 m-auto animate-pulse" />
        </div>
        <div>
          <h3 className="text-sm font-bold font-mono tracking-widest text-purple-400 uppercase">
            COMPUTING QUANT MODELS
          </h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-xs mx-auto">
            Resolving institutional order blocks, calculating liquidity sweep points, and correlating multi-timeframe fair value gaps...
          </p>
        </div>
      </div>
    );
  }

  if (!signal) {
    return (
      <div className="bg-[#13111C]/80 backdrop-blur-md border border-white/5 rounded-[24px] p-8 text-center flex flex-col justify-center items-center h-[420px] gap-4 text-zinc-500">
        <div className="w-14 h-14 rounded-full bg-white/[0.02] border border-white/5 flex items-center justify-center text-purple-400/60 shadow-[0_4px_20px_rgba(138,43,226,0.05)]">
          <BookOpen className="w-7 h-7" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-zinc-400 font-mono tracking-wider uppercase">
            TERMINAL READY
          </h3>
          <p className="text-xs text-zinc-500 max-w-sm mt-1">
            Choose an asset from the list, input any discretionary thesis criteria, and generate an elite institutional-grade SMC analysis report.
          </p>
        </div>
      </div>
    );
  }

  const isLong = signal.direction === 'LONG';
  const isExecute = signal.verdict === 'EXECUTE';
  const isHardBlock = signal.verdict === 'HARD_BLOCK';
  const isWait = signal.verdict === 'WAIT';

  return (
    <div className="bg-[#13111C]/85 backdrop-blur-md border border-white/8 rounded-[24px] p-6 shadow-[0_12px_40px_rgba(0,0,0,0.5)] flex flex-col gap-5 text-left min-h-[420px]">
      
      {/* Top Banner Asset & Verdict Status */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-4">
        <div>
          <span className="text-[10px] font-mono tracking-widest text-[#FF6B35]">SMC INTRADAY ANALYSIS</span>
          <h3 className="text-2xl font-bold font-mono text-white tracking-tight flex items-center gap-2 mt-0.5">
            {signal.asset}
            <span className={`text-xs px-2.5 py-0.5 rounded-md font-sans border ${
              isLong 
                ? 'bg-[#39ff14]/10 border-[#39ff14]/30 text-[#39ff14]' 
                : signal.direction === 'SHORT'
                ? 'bg-[#ff073a]/10 border-[#ff073a]/30 text-[#ff073a]'
                : 'bg-zinc-800 border-zinc-700 text-zinc-400'
            }`}>
              {signal.direction}
            </span>
          </h3>
        </div>

        {/* Verdict pill with neon glow */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-zinc-400">DESK ACTION:</span>
          <div className={`px-4 py-2 rounded-xl font-mono text-xs font-black tracking-widest flex items-center gap-2 border ${
            isExecute 
              ? 'bg-[#39ff14]/10 border-[#39ff14] text-[#39ff14] shadow-[0_0_15px_rgba(57,255,20,0.25)]'
              : isHardBlock
              ? 'bg-[#ff073a]/10 border-[#ff073a] text-[#ff073a] shadow-[0_0_15px_rgba(255,7,58,0.25)]'
              : 'bg-[#FFD700]/10 border-[#FFD700] text-[#FFD700] shadow-[0_0_15px_rgba(255,215,0,0.25)]'
          }`}>
            {isExecute && <Zap className="w-3.5 h-3.5 text-[#39ff14]" />}
            {isHardBlock && <ShieldAlert className="w-3.5 h-3.5 text-[#ff073a]" />}
            {isWait && <Clock className="w-3.5 h-3.5 text-[#FFD700]" />}
            {signal.verdict}
          </div>
        </div>
      </div>

      {/* Warning reasons if Blocked or Waiting */}
      {(isHardBlock || isWait) && (
        <div className={`p-4 rounded-xl border flex items-start gap-3 text-xs font-mono ${
          isHardBlock 
            ? 'bg-[#ff073a]/5 border-[#ff073a]/20 text-[#ff073a]' 
            : 'bg-[#FFD700]/5 border-[#FFD700]/20 text-[#FFD700]'
        }`}>
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold uppercase tracking-wider mb-1">
              {isHardBlock ? 'HARD BLOCK TRIGGERED' : 'WAIT CRITERIA ACTIVE'}
            </div>
            <p className="leading-relaxed opacity-90">
              {isHardBlock ? signal.hard_block_reason : signal.wait_reason}
            </p>
          </div>
        </div>
      )}

      {/* Main Structural Parameters Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#0B0A11]/60 border border-white/5 rounded-2xl p-3">
          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">CONFLUENCE</span>
          <div className="text-base font-bold text-white font-mono mt-0.5">{signal.confluence_score}%</div>
        </div>
        <div className="bg-[#0B0A11]/60 border border-white/5 rounded-2xl p-3">
          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">REGIME</span>
          <div className="text-base font-bold text-purple-300 font-mono mt-0.5 truncate uppercase">{signal.regime.replace('_', ' ')}</div>
        </div>
        <div className="bg-[#0B0A11]/60 border border-white/5 rounded-2xl p-3">
          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">WIN PROBABILITY</span>
          <div className="text-base font-bold text-[#39ff14] font-mono mt-0.5">{signal.win_probability_pct || 65}%</div>
        </div>
        <div className="bg-[#0B0A11]/60 border border-white/5 rounded-2xl p-3">
          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">EXPECTED R</span>
          <div className="text-base font-bold text-[#FF6B35] font-mono mt-0.5">{signal.expected_value_r || 2.4} R</div>
        </div>
      </div>

      {/* Multi-Timeframe Trend Bars */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#0B0A11]/40 border border-white/5 rounded-2xl p-4 font-mono text-xs">
        <div className="flex justify-between items-center py-1">
          <span className="text-zinc-400">HTF Trend (D1/H4):</span>
          <span className={`font-bold px-2 py-0.5 rounded ${
            signal.htf_trend === 'BULLISH' 
              ? 'text-[#39ff14] bg-[#39ff14]/10' 
              : signal.htf_trend === 'BEARISH'
              ? 'text-[#ff073a] bg-[#ff073a]/10'
              : 'text-zinc-400 bg-zinc-800'
          }`}>
            {signal.htf_trend}
          </span>
        </div>
        <div className="flex justify-between items-center py-1">
          <span className="text-zinc-400">ETF Trend (M15/H1):</span>
          <span className={`font-bold px-2 py-0.5 rounded ${
            signal.etf_trend === 'BULLISH' 
              ? 'text-[#39ff14] bg-[#39ff14]/10' 
              : signal.etf_trend === 'BEARISH'
              ? 'text-[#ff073a] bg-[#ff073a]/10'
              : 'text-zinc-400 bg-zinc-800'
          }`}>
            {signal.etf_trend}
          </span>
        </div>
        <div className="flex justify-between items-center py-1">
          <span className="text-zinc-400">RSI (HTF):</span>
          <span className="text-white font-bold">{signal.rsi_htf}</span>
        </div>
        <div className="flex justify-between items-center py-1">
          <span className="text-zinc-400">ATR Range:</span>
          <span className="text-white font-bold">${signal.atr.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      {/* Target Price Levels */}
      {isExecute && (
        <div className="flex flex-col gap-3 border border-[#39ff14]/10 bg-[#39ff14]/[0.02] p-4 rounded-2xl">
          <div className="text-[10px] font-mono text-[#39ff14] font-extrabold tracking-widest uppercase">
            ACTIVE LEVEL EXECUTION ZONES
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 font-mono text-[11px]">
            {/* Entry Range */}
            <div className="sm:col-span-2 bg-[#0B0A11] border border-white/5 p-3 rounded-xl">
              <span className="text-zinc-400 block text-[9px] uppercase">ENTRY ZONE RANGE</span>
              <span className="text-[#39ff14] font-bold block text-xs mt-0.5">
                ${signal.entry_low.toLocaleString(undefined, { minimumFractionDigits: 2 })} - ${signal.entry_high.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>

            {/* Target Profits */}
            <div className="bg-[#0B0A11] border border-white/5 p-3 rounded-xl flex flex-col justify-between">
              <span className="text-zinc-400 block text-[9px] uppercase">TP1 (1R)</span>
              <span className="text-white font-bold block text-xs mt-0.5">
                ${signal.tp1.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="bg-[#0B0A11] border border-white/5 p-3 rounded-xl flex flex-col justify-between">
              <span className="text-zinc-400 block text-[9px] uppercase">TP2 (2.5R)</span>
              <span className="text-[#FF6B35] font-bold block text-xs mt-0.5">
                ${signal.tp2.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>

            {/* Stop Loss */}
            <div className="bg-[#0B0A11] border border-[#ff073a]/15 p-3 rounded-xl flex flex-col justify-between">
              <span className="text-[#ff073a] block text-[9px] uppercase">STOP LOSS</span>
              <span className="text-[#ff073a] font-bold block text-xs mt-0.5">
                ${signal.sl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Model Analysis Markdown summary */}
      <div className="bg-[#0B0A11]/40 border border-white/5 rounded-2xl p-4.5 text-xs text-zinc-300 font-mono flex-1 overflow-y-auto max-h-[160px] custom-scrollbar">
        <div className="text-[10px] font-bold tracking-widest text-[#FF6B35] uppercase mb-2 border-b border-white/5 pb-1 flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5" /> Quantitative Thesis Synopsis
        </div>
        <div className="space-y-2 whitespace-pre-wrap leading-relaxed">
          {signal.notes || 'Synthesizing local Smart Money Concepts structure. Direct order book clustering maps strong resistance zone above daily point of control.'}
        </div>
      </div>

    </div>
  );
}
