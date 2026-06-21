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
      // 1. Check wait/avoid outcomes with fresh candles passed from server
      await fetch('/api/check-wait-avoid-outcomes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset: filterAsset === 'SELECTED' ? currentAsset : null, hours_lookback: 48 })
      });
      // 2. Check standard trades outcomes
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

  // Badges color map
  const getVerdictBadgeClass = (verdict: string) => {
    switch (verdict) {
      case 'EXECUTE':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'EXECUTE_WITH_CAUTION':
      case 'EXECUTE WITH CAUTION':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'WAIT':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'AVOID':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getOutcomeBadgeClass = (outcome: string) => {
    switch (outcome) {
      case 'WIN':
        return 'bg-emerald-500/15 text-emerald-700 border-emerald-300';
      case 'LOSS':
        return 'bg-red-500/15 text-red-700 border-red-300';
      case 'SUPERSEDED':
        return 'bg-amber-500/15 text-amber-700 border-amber-305';
      case 'CAUTION_JUSTIFIED':
        return 'bg-teal-500/15 text-teal-700 border-teal-300';
      case 'MISSED_OPPORTUNITY':
        return 'bg-indigo-500/15 text-indigo-700 border-indigo-300';
      case 'WOULD_HAVE_LOST':
        return 'bg-orange-500/15 text-orange-700 border-orange-300';
      case 'PENDING':
        return 'bg-blue-500/15 text-blue-700 border-blue-305 animate-pulse';
      case 'OPEN':
      default:
        return 'bg-slate-500/15 text-slate-700 border-slate-300';
    }
  };

  const cleanLabel = (text: string) => {
    return text.replace(/_/g, ' ');
  };

  return (
    <div className="w-full bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden mt-6 flex flex-col relative z-10 max-w-[1600px] mx-auto">
      {/* Logger Header & Controls */}
      <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">Algorithmic Signal Intelligence Ledger</h3>
            <p className="text-[11px] text-slate-500">Persistent database repository tracking scanning decisions, cautious holds, and outcomes</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Asset Filtering Switch */}
          <div className="flex bg-slate-200/60 p-1 rounded-lg mr-2 text-[11px] font-semibold">
            <button
              onClick={() => setFilterAsset('ALL')}
              className={`px-3 py-1.5 rounded-md transition-all ${filterAsset === 'ALL' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              All Assets
            </button>
            <button
              onClick={() => setFilterAsset('SELECTED')}
              className={`px-3 py-1.5 rounded-md transition-all ${filterAsset === 'SELECTED' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              title={`Show only ${currentAsset}`}
            >
              {currentAsset} Log
            </button>
          </div>

          {/* Trigger Outcome check */}
          <button
            onClick={triggerOutcomeChecks}
            disabled={isVerifying || isLoading}
            className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-700 text-[11px] font-bold uppercase tracking-wider px-3.5 py-2 rounded-lg transition-all disabled:opacity-50"
            title="Fetches recent price candles from Deriv and updates outcome fields for all legacy transactions, including WAIT/AVOID structures."
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>{isVerifying ? 'Verifying...' : 'Audit Outcomes'}</span>
          </button>

          {/* Download CSV button */}
          <button
            onClick={handleDownloadCSV}
            className="flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[11px] font-bold uppercase tracking-wider px-3.5 py-2 rounded-lg transition-all shadow-sm"
            title="Download full database CSV file"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          {/* Manual refresh */}
          <button
            onClick={fetchSignals}
            disabled={isLoading || isVerifying}
            className="p-2 bg-white hover:bg-slate-50 border border-slate-205 rounded-lg text-slate-500 shadow-sm transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Table View */}
      <div className="flex-1 overflow-x-auto custom-scrollbar">
        {signals.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400 min-h-[220px]">
            <ListFilter className="w-8 h-8 mb-3 text-slate-300" />
            <p className="text-xs font-semibold">No recorded signals found for this layout.</p>
            <p className="text-[10px] text-slate-400 mt-1">Execute a scan using "Get Signal" to generate persistent database records.</p>
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-400 uppercase tracking-widest font-semibold border-b border-slate-100 select-none text-[9px]">
                <th className="py-3 px-4 text-center">ID</th>
                <th className="py-4 px-4">Time / Asset / Mode</th>
                <th className="py-4 px-4 text-center">Verdict</th>
                <th className="py-4 px-4 text-center">Direction</th>
                <th className="py-4 px-4">Parameters</th>
                <th className="py-4 px-4 text-center">Risk Intel</th>
                <th className="py-4 px-4 text-center">Realized Outcome</th>
                <th className="py-4 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {signals.map((sig) => (
                <tr key={sig.id} className="hover:bg-slate-50/70 transition-colors group">
                  {/* ID */}
                  <td className="py-3 px-4 font-mono font-medium text-slate-400 text-center">
                    #{sig.id}
                  </td>

                  {/* Asset & Mode & Time */}
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-800 tracking-wide">{sig.asset}</div>
                    <div className="text-[10px] text-slate-400 uppercase font-semibold font-mono tracking-tight mt-0.5">{sig.mode.replace('_', ' ')}</div>
                    <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-300" />
                      <span>{formatTimestamp(sig.timestamp)}</span>
                    </div>
                    {sig.notes && (
                      <div className="text-[10pt] text-slate-500 italic mt-1.5 max-w-[220px] truncate" title={sig.notes}>
                        {sig.notes}
                      </div>
                    )}
                  </td>

                  {/* Verdict Badge */}
                  <td className="py-3.5 px-4 text-center">
                    <span className={`inline-block border text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${getVerdictBadgeClass(sig.verdict)}`}>
                      {cleanLabel(sig.verdict)}
                    </span>
                  </td>

                  {/* Direction */}
                  <td className="py-3.5 px-4 text-center">
                    {sig.direction === 'NEUTRAL' ? (
                      <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">—</span>
                    ) : sig.direction === 'BUY' || sig.direction === 'LONG' || sig.direction === 'Bullish' ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 font-bold tracking-wider text-[11px]">
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>LONG</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-600 font-bold tracking-wider text-[11px]">
                        <TrendingDown className="w-3.5 h-3.5" />
                        <span>SHORT</span>
                      </span>
                    )}
                  </td>

                  {/* Execution Parameters */}
                  <td className="py-3.5 px-4 font-mono text-slate-500 leading-relaxed">
                    {sig.verdict.startsWith('EXECUTE') ? (
                      <div className="text-[11px]">
                        <div><span className="text-slate-400">Entry:</span> <strong className="text-slate-700">{sig.entry_low}</strong></div>
                        <div><span className="text-slate-400">Target:</span> <strong className="text-emerald-700">{sig.tp1}</strong></div>
                        <div><span className="text-slate-400">Invalidation:</span> <strong className="text-red-700">{sig.sl}</strong></div>
                      </div>
                    ) : (
                      <div className="text-[11px]">
                        <div><span className="text-slate-400">Scan Price:</span> <strong className="text-slate-700">{sig.current_price_at_signal || 'N/A'}</strong></div>
                        <div><span className="text-slate-400">Stated Zone:</span> <strong className="text-indigo-600">{sig.entry_low ? `${sig.entry_low} – ${sig.entry_high || sig.entry_low}` : 'None'}</strong></div>
                        {sig.tp1 && <div><span className="text-slate-400">Target:</span> <strong className="text-slate-700">{sig.tp1}</strong></div>}
                      </div>
                    )}
                  </td>

                  {/* Prob / Expectancy */}
                  <td className="py-3.5 px-4 text-center">
                    <div className="flex flex-col items-center gap-1 justify-center">
                      {sig.win_probability_pct ? (
                        <span className="text-slate-700 font-bold flex items-center font-mono text-[11px]" title="Historical predictive math win probability estimate for the asset regime">
                          {sig.win_probability_pct}%
                        </span>
                      ) : (
                        <span className="text-slate-350 font-mono text-[10px]">—</span>
                      )}
                      {sig.expected_value_r ? (
                        <span className="text-[10px] text-indigo-600 font-semibold uppercase bg-indigo-50 border border-indigo-100 rounded px-1.5 font-mono" title="Trade Expectancy Score in R-multiples">
                          EV: {sig.expected_value_r}R
                        </span>
                      ) : null}
                    </div>
                  </td>

                  {/* Outcome */}
                  <td className="py-3.5 px-4 text-center">
                    <span className={`inline-block border text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-[6px] ${getOutcomeBadgeClass(sig.outcome)}`}>
                      {cleanLabel(sig.outcome)}
                    </span>
                    {sig.pnl_atr !== null && sig.pnl_atr !== 0 && (
                      <div className={`text-[10px] font-bold mt-1 font-mono ${sig.pnl_atr > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {sig.pnl_atr > 0 ? '+' : ''}{sig.pnl_atr}R
                      </div>
                    )}
                  </td>

                  {/* Actions (View reasons) */}
                  <td className="py-3.5 px-4 text-center">
                    <button
                      onClick={() => setSelectedSignal(selectedSignal?.id === sig.id ? null : sig)}
                      className={`p-2 rounded-lg border transition-all ${selectedSignal?.id === sig.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-500 shadow-sm'}`}
                      title="Inspect full signal block details"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail Drawer (Toggles on button click) */}
      {selectedSignal && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-t border-slate-100 p-5 bg-indigo-50/45 text-xs text-slate-700 flex flex-col md:flex-row gap-6 relative"
        >
          {/* Close button */}
          <button
            onClick={() => setSelectedSignal(null)}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold"
          >
            × Close Detail Panel
          </button>

          <div className="flex-1 space-y-3.5 border-r border-slate-200/55 pr-6">
            <h4 className="text-sm font-bold text-indigo-900 flex items-center gap-1.5 uppercase tracking-wide">
              <span>Technical Footprint Block</span>
              <span className="font-mono text-xs text-indigo-600">#{selectedSignal.id}</span>
            </h4>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 font-medium">
              <div><span className="text-slate-400">Timestamp:</span> <span className="text-slate-800">{new Date(selectedSignal.timestamp).toUTCString()}</span></div>
              <div><span className="text-slate-400">Trading Mode:</span> <span className="text-slate-800 uppercase font-mono text-[10px]">{selectedSignal.mode}</span></div>
              <div><span className="text-slate-400">Asset Trigger:</span> <span className="text-slate-800">{selectedSignal.asset}</span></div>
              <div><span className="text-slate-400">Primary Regime:</span> <span className="text-slate-800 uppercase text-[10px]">{selectedSignal.regime || 'DETERMINING'}</span></div>
              <div><span className="text-slate-400">Session Anchor:</span> <span className="text-slate-800 uppercase text-[10px]">{selectedSignal.session || 'N/A'}</span></div>
              <div><span className="text-slate-400">Confluence Score:</span> <span className="text-slate-800">{selectedSignal.score ? `${selectedSignal.score}/100` : 'None'}</span></div>
            </div>
            
            {selectedSignal.notes && (
              <div className="bg-white/80 border border-slate-200/50 p-3 rounded-lg leading-relaxed text-slate-600">
                <strong className="text-slate-700 block mb-1">Algorithmic Narrative:</strong>
                {selectedSignal.notes}
              </div>
            )}
          </div>

          <div className="flex-1 space-y-4">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Guardrails & Rejection Audit</h4>
            
            {selectedSignal.verdict === 'AVOID' ? (
              <div className="p-3 bg-red-500/10 border border-red-200 rounded-lg text-red-800 flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-red-650 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold">Hard Rejection Trigger Engaged</strong>
                  <p className="text-red-700 font-mono text-[11px] mt-1 leading-relaxed">
                    {selectedSignal.hard_block_reason || "Market structure is severely misaligned. Scanner identified higher risk setup profile and bypassed execution."}
                  </p>
                </div>
              </div>
            ) : selectedSignal.verdict === 'WAIT' ? (
              <div className="p-3 bg-blue-500/10 border border-blue-200 rounded-lg text-blue-800 flex items-start gap-2.5">
                <Clock className="w-5 h-5 text-blue-650 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold">Execution Hold (Wait Trigger Active)</strong>
                  <p className="text-blue-700 font-mono text-[11px] mt-1 leading-relaxed">
                    {selectedSignal.wait_reason || "Awaiting structural sweep, displacement boundary confirmation, or fair-value zone alignment."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-emerald-500/10 border border-emerald-250 rounded-lg text-emerald-800 flex items-start gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-650 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold">All Guardrails Cleared</strong>
                  <p className="text-emerald-700 text-[11px] mt-1">
                    This setup successfully navigated fundamental calendar blocks, liquidity sweeping filters, and trend alignment controls. Standard execution applied.
                  </p>
                </div>
              </div>
            )}

            <div className="text-[10px] text-slate-400 font-medium">
              * Database-saved records are read-only and audited automatically. Audits run on 48h rolling schedules based on live candle streams.
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
