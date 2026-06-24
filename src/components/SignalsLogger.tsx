import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Download, RefreshCw, Eye, Percent, TrendingUp, TrendingDown, Clock, ShieldCheck, Database, CheckSquare, ListFilter, AlertCircle } from 'lucide-react';

interface SignalRecord {
  id: number;
  asset: string;
  mode: string;
  timestamp: string;
  direction: string;
  entry_low: number | null;
  entry_high: number | null;
  tp1: number | null;
  sl: number | null;
  score: number | null;
  outcome: string;
  pnl_atr: number | null;
  exit_price: number | null;
  notes: string | null;
  regime: string | null;
  session: string | null;
  verdict: string;
  current_price_at_signal: number | null;
  win_probability_pct: number | null;
  expected_value_r: number | null;
  hard_block_reason: string | null;
  wait_reason: string | null;
}

interface SignalsLoggerProps {
  currentAsset: string;
  onRefreshTriggered?: () => void;
  lastAnalysisCompletedAt?: number;
}

export function SignalsLogger({ currentAsset, onRefreshTriggered, lastAnalysisCompletedAt }: SignalsLoggerProps) {
  const [signals, setSignals] = useState<SignalRecord[]>([]);
  const [filterAsset, setFilterAsset] = useState<'ALL' | 'SELECTED'>('ALL');
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [selectedSignal, setSelectedSignal] = useState<SignalRecord | null>(null);

  const fetchSignals = async () => {
    setIsLoading(true);
    try {
      const assetParam = filterAsset === 'SELECTED' ? currentAsset : '';
      const response = await fetch(`/api/dashboard?limit=100${assetParam ? `&asset=${assetParam}` : ''}`);
      if (response.ok) {
        const data = await response.json();
        if (data && data.signals) {
          setSignals(data.signals);
        }
      }
    } catch (error) {
      console.error('Failed to fetch signal logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSignals();
  }, [filterAsset, currentAsset, lastAnalysisCompletedAt]);

  const triggerOutcomeChecks = async () => {
    setIsVerifying(true);
    try {
      await fetch('/api/check-wait-avoid-outcomes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset: filterAsset === 'SELECTED' ? currentAsset : null, hours_lookback: 48 })
      });
      await fetch('/api/check-outcomes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset: filterAsset === 'SELECTED' ? currentAsset : null })
      });
      
      await fetchSignals();
      if (onRefreshTriggered) onRefreshTriggered();
    } catch (e) {
      console.error('Outcome verification failed:', e);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDownloadCSV = () => {
    const assetParam = filterAsset === 'SELECTED' ? currentAsset : '';
    window.open(`/api/export-signals?limit=1500${assetParam ? `&asset=${assetParam}` : ''}`, '_blank');
  };

  const formatTimestamp = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return isoStr;
    }
  };

  const getVerdictBadgeClass = (verdict: string) => {
    switch (verdict) {
      case 'EXECUTE':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'EXECUTE_WITH_CAUTION':
      case 'EXECUTE WITH CAUTION':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'WAIT':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'AVOID':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default:
        return 'bg-zinc-800 text-zinc-400 border-zinc-700';
    }
  };

  const getOutcomeBadgeClass = (outcome: string) => {
    switch (outcome) {
      case 'WIN':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'LOSS':
        return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      case 'SUPERSEDED':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'CAUTION_JUSTIFIED':
        return 'bg-teal-500/15 text-teal-400 border-teal-500/30';
      case 'MISSED_OPPORTUNITY':
        return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
      case 'WOULD_HAVE_LOST':
        return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
      case 'PENDING':
        return 'bg-blue-500/15 text-blue-400 border-blue-500/30 animate-pulse';
      case 'OPEN':
      default:
        return 'bg-zinc-800 text-zinc-400 border-zinc-700';
    }
  };

  const cleanLabel = (text: string) => text.replace(/_/g, ' ');

  return (
    <div className="w-full bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/80 rounded-2xl shadow-2xl overflow-hidden mt-6 flex flex-col relative z-10 max-w-[1600px] mx-auto mb-10">
      <div className="px-6 py-5 border-b border-zinc-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-zinc-900/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-display font-bold text-white tracking-widest uppercase">Algorithmic Ledger</h3>
            <p className="text-[10px] text-zinc-500 font-mono mt-0.5 tracking-tight">Persistent repository of computed intelligence.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800/50 text-[11px] font-bold tracking-widest uppercase">
            <button
              onClick={() => setFilterAsset('ALL')}
              className={`px-4 py-2 rounded-md transition-all ${filterAsset === 'ALL' ? 'bg-zinc-800 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              All Assets
            </button>
            <button
              onClick={() => setFilterAsset('SELECTED')}
              className={`px-4 py-2 rounded-md transition-all ${filterAsset === 'SELECTED' ? 'bg-zinc-800 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              {currentAsset} Only
            </button>
          </div>

          <button
            onClick={triggerOutcomeChecks}
            disabled={isVerifying || isLoading}
            className="flex items-center gap-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-[10px] font-bold uppercase tracking-[0.2em] px-4 py-2.5 rounded-xl transition-all disabled:opacity-50"
          >
            <CheckSquare className="w-4 h-4" />
            <span>{isVerifying ? 'Verifying...' : 'Audit Outcomes'}</span>
          </button>

          <button
            onClick={handleDownloadCSV}
            className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-[10px] font-bold uppercase tracking-[0.2em] px-4 py-2.5 rounded-xl transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={fetchSignals}
            disabled={isLoading || isVerifying}
            className="p-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto custom-scrollbar">
        {signals.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-zinc-500 min-h-[300px]">
            <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 flex items-center justify-center mb-4 border border-zinc-700/50">
              <ListFilter className="w-8 h-8 text-zinc-600" />
            </div>
            <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">No recorded signals</p>
            <p className="text-xs text-zinc-600 mt-2">Execute a scan using "Deploy Engine" to generate persistent database records.</p>
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-zinc-900/80 text-zinc-500 uppercase tracking-[0.2em] font-bold border-b border-zinc-800/80 select-none text-[9px]">
                <th className="py-4 px-6 text-center w-20">ID</th>
                <th className="py-4 px-6">Time / Asset / Mode</th>
                <th className="py-4 px-6 text-center">Verdict</th>
                <th className="py-4 px-6 text-center">Direction</th>
                <th className="py-4 px-6">Parameters</th>
                <th className="py-4 px-6 text-center">Risk Intel</th>
                <th className="py-4 px-6 text-center">Realized Outcome</th>
                <th className="py-4 px-6 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {signals.map((sig) => (
                <tr key={sig.id} className="hover:bg-zinc-800/30 transition-colors group">
                  <td className="py-4 px-6 font-mono font-bold text-zinc-600 text-center">#{sig.id}</td>
                  <td className="py-4 px-6">
                    <div className="font-bold text-zinc-200 tracking-wide text-sm">{sig.asset}</div>
                    <div className="text-[10px] text-zinc-500 uppercase font-bold font-mono tracking-widest mt-1">{sig.mode.replace('_', ' ')}</div>
                    <div className="text-[10px] text-zinc-500 mt-1.5 flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-zinc-600" />
                      <span>{formatTimestamp(sig.timestamp)}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className={`inline-block border border-transparent text-[9px] font-bold uppercase tracking-[0.15em] px-3 py-1.5 rounded-lg ${getVerdictBadgeClass(sig.verdict)}`}>
                      {cleanLabel(sig.verdict)}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    {sig.direction === 'NEUTRAL' ? (
                      <span className="text-zinc-600 font-bold uppercase tracking-wider text-[10px]">—</span>
                    ) : sig.direction === 'BUY' || sig.direction === 'LONG' || sig.direction === 'Bullish' ? (
                      <span className="inline-flex items-center gap-1 text-emerald-500 font-bold tracking-wider text-[11px] bg-emerald-500/10 px-2.5 py-1 rounded-md">
                        <TrendingUp className="w-3.5 h-3.5" /><span>LONG</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-500 font-bold tracking-wider text-[11px] bg-rose-500/10 px-2.5 py-1 rounded-md">
                        <TrendingDown className="w-3.5 h-3.5" /><span>SHORT</span>
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-6 font-mono text-zinc-400 leading-relaxed">
                    {sig.verdict.startsWith('EXECUTE') ? (
                      <div className="text-[11px] space-y-0.5">
                        <div className="flex gap-2"><span className="text-zinc-600 w-16">Entry:</span> <strong className="text-zinc-300">{sig.entry_low}</strong></div>
                        <div className="flex gap-2"><span className="text-zinc-600 w-16">Target:</span> <strong className="text-emerald-400">{sig.tp1}</strong></div>
                        <div className="flex gap-2"><span className="text-zinc-600 w-16">Inval:</span> <strong className="text-rose-400">{sig.sl}</strong></div>
                      </div>
                    ) : (
                      <div className="text-[11px] space-y-0.5">
                        <div className="flex gap-2"><span className="text-zinc-600 w-20">Scan Px:</span> <strong className="text-zinc-300">{sig.current_price_at_signal || 'N/A'}</strong></div>
                        <div className="flex gap-2"><span className="text-zinc-600 w-20">Zone:</span> <strong className="text-indigo-400">{sig.entry_low ? `${sig.entry_low} – ${sig.entry_high || sig.entry_low}` : 'None'}</strong></div>
                        {sig.tp1 && <div className="flex gap-2"><span className="text-zinc-600 w-20">Target:</span> <strong className="text-zinc-300">{sig.tp1}</strong></div>}
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-6 text-center">
                    <div className="flex flex-col items-center gap-1.5 justify-center">
                      {sig.win_probability_pct ? (
                        <span className="text-zinc-300 font-bold flex items-center font-mono text-xs" title="Historical predictive math win probability estimate for the asset regime">
                          {sig.win_probability_pct}%
                        </span>
                      ) : <span className="text-zinc-600 font-mono text-[10px]">—</span>}
                      {sig.expected_value_r ? (
                        <span className="text-[10px] text-indigo-400 font-bold tracking-widest uppercase bg-indigo-500/10 border border-indigo-500/20 rounded px-2 py-0.5 font-mono">
                          EV: {sig.expected_value_r}R
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className={`inline-block border text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg ${getOutcomeBadgeClass(sig.outcome)}`}>
                      {cleanLabel(sig.outcome)}
                    </span>
                    {sig.pnl_atr !== null && sig.pnl_atr !== 0 && (
                      <div className={`text-[11px] font-bold mt-1.5 font-mono tracking-tight ${sig.pnl_atr > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {sig.pnl_atr > 0 ? '+' : ''}{sig.pnl_atr}R
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-6 text-center">
                    <button
                      onClick={() => setSelectedSignal(selectedSignal?.id === sig.id ? null : sig)}
                      className={`p-2.5 rounded-xl border transition-all ${selectedSignal?.id === sig.id ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]' : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-zinc-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'}`}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedSignal && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-t border-white/5 p-6 bg-zinc-950 text-xs text-zinc-300 flex flex-col md:flex-row gap-8 relative shadow-[inset_0_10px_20px_rgba(0,0,0,0.2)]"
        >
          <button
            onClick={() => setSelectedSignal(null)}
            className="absolute top-5 right-5 text-zinc-500 hover:text-white transition-colors"
          >
            <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800">
               <span className="sr-only">Close Panel</span>
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </div>
          </button>

          <div className="flex-1 space-y-4 border-r border-white/5 pr-8">
            <h4 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-[0.15em]">
              <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
              <span>Technical Footprint Block</span>
              <span className="font-mono text-xs text-zinc-500 ml-2">#{selectedSignal.id}</span>
            </h4>

            <div className="grid grid-cols-2 gap-x-6 gap-y-3 font-medium bg-zinc-900/50 p-4 rounded-xl border border-white/5">
              <div><span className="text-zinc-500 block text-[10px] uppercase tracking-widest mb-1">Timestamp</span> <span className="text-zinc-200">{new Date(selectedSignal.timestamp).toUTCString()}</span></div>
              <div><span className="text-zinc-500 block text-[10px] uppercase tracking-widest mb-1">Trading Mode</span> <span className="text-zinc-200 uppercase font-mono text-[11px]">{selectedSignal.mode}</span></div>
              <div><span className="text-zinc-500 block text-[10px] uppercase tracking-widest mb-1">Asset</span> <span className="text-zinc-200">{selectedSignal.asset}</span></div>
              <div><span className="text-zinc-500 block text-[10px] uppercase tracking-widest mb-1">Regime</span> <span className="text-zinc-200 uppercase text-[11px]">{selectedSignal.regime || 'DETERMINING'}</span></div>
            </div>
            
            {selectedSignal.notes && (
              <div className="bg-indigo-500/5 border border-indigo-500/20 p-4 rounded-xl leading-relaxed text-zinc-400">
                <strong className="text-indigo-300 block mb-2 uppercase tracking-widest text-[10px]">Algorithmic Narrative</strong>
                {selectedSignal.notes}
              </div>
            )}
          </div>

          <div className="flex-1 space-y-5">
            <h4 className="text-sm font-bold text-white uppercase tracking-[0.15em] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-zinc-400" />
              Guardrails & Rejection Audit
            </h4>
            
            {selectedSignal.verdict === 'AVOID' ? (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 flex items-start gap-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <AlertCircle className="w-6 h-6 text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold text-sm text-rose-400 tracking-wide">Hard Rejection Trigger Engaged</strong>
                  <p className="text-rose-300/80 font-mono text-[11px] mt-2 leading-relaxed">
                    {selectedSignal.hard_block_reason || "Market structure misaligned. Higher risk setup profile bypassed."}
                  </p>
                </div>
              </div>
            ) : selectedSignal.verdict === 'WAIT' ? (
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-300 flex items-start gap-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <Clock className="w-6 h-6 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold text-sm text-blue-400 tracking-wide">Execution Hold (Wait Trigger Active)</strong>
                  <p className="text-blue-300/80 font-mono text-[11px] mt-2 leading-relaxed">
                    {selectedSignal.wait_reason || "Awaiting confirmation."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 flex items-start gap-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold text-sm text-emerald-400 tracking-wide">All Guardrails Cleared</strong>
                  <p className="text-emerald-300/80 text-[11px] mt-2 leading-relaxed">
                    Setup successfully navigated fundamental calendar blocks, liquidity sweeping filters, and trend alignment controls. Standard execution applied.
                  </p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
