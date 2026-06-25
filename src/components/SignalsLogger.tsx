import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Download, RefreshCw, Eye, TrendingUp, TrendingDown, Clock, ShieldCheck, Database, CheckSquare, ListFilter, AlertCircle } from 'lucide-react';

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
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'EXECUTE_WITH_CAUTION':
      case 'EXECUTE WITH CAUTION':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'WAIT':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'AVOID':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getOutcomeBadgeClass = (outcome: string) => {
    switch (outcome) {
      case 'WIN':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'LOSS':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'SUPERSEDED':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'CAUTION_JUSTIFIED':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'MISSED_OPPORTUNITY':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'WOULD_HAVE_LOST':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'PENDING':
        return 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse';
      case 'OPEN':
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const cleanLabel = (text: string) => text.replace(/_/g, ' ');

  return (
    <div className="w-full bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mt-6 flex flex-col relative z-10 max-w-[1600px] mx-auto mb-10 text-slate-700">
      
      {/* Header Panel */}
      <div className="px-6 py-5 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-50 border border-orange-100 rounded-xl flex items-center justify-center text-orange-600 shadow-sm">
            <Database className="w-5 h-5" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-sans font-bold text-slate-900 tracking-wider uppercase">Persistent Ledger</h3>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5 tracking-tight">Historic record of all computed system signals.</p>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200/60 text-[10px] font-bold uppercase">
            <button
              onClick={() => setFilterAsset('ALL')}
              className={`px-3.5 py-1.5 rounded-md transition-all cursor-pointer ${filterAsset === 'ALL' ? 'bg-white text-slate-900 shadow-sm font-black' : 'text-slate-500 hover:text-slate-800'}`}
            >
              All Assets
            </button>
            <button
              onClick={() => setFilterAsset('SELECTED')}
              className={`px-3.5 py-1.5 rounded-md transition-all cursor-pointer ${filterAsset === 'SELECTED' ? 'bg-white text-slate-900 shadow-sm font-black' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {currentAsset} Only
            </button>
          </div>

          <button
            onClick={triggerOutcomeChecks}
            disabled={isVerifying || isLoading}
            className="flex items-center gap-1.5 bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-700 text-[10px] font-bold uppercase tracking-wider px-3.5 py-2 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>{isVerifying ? 'Auditing...' : 'Audit Outcomes'}</span>
          </button>

          <button
            onClick={handleDownloadCSV}
            className="flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[10px] font-bold uppercase tracking-wider px-3.5 py-2 rounded-xl transition-all shadow-sm cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={fetchSignals}
            disabled={isLoading || isVerifying}
            className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-500 shadow-sm transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-orange-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Table Data Container */}
      <div className="flex-1 overflow-x-auto custom-scrollbar">
        {signals.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-slate-400 min-h-[250px]">
            <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-3 border border-slate-200">
              <ListFilter className="w-6 h-6 text-slate-300" />
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">No signals found</p>
            <p className="text-xs text-slate-400 mt-1">Execute a scan in the Generator tab to generate logs in the database.</p>
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200 select-none text-[9px]">
                <th className="py-3 px-5 text-center w-16">ID</th>
                <th className="py-3 px-5">Time / Instrument</th>
                <th className="py-3 px-5 text-center">Verdict</th>
                <th className="py-3 px-5 text-center">Direction</th>
                <th className="py-3 px-5">Targets / Levels</th>
                <th className="py-3 px-5 text-center">Confidence</th>
                <th className="py-3 px-5 text-center">Outcome</th>
                <th className="py-3 px-5 text-center">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {signals.map((sig) => (
                <tr key={sig.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="py-3.5 px-5 font-mono font-bold text-slate-400 text-center">#{sig.id}</td>
                  <td className="py-3.5 px-5">
                    <div className="font-bold text-slate-900 text-sm">{sig.asset}</div>
                    <div className="text-[9px] text-slate-500 uppercase font-mono mt-0.5">{sig.mode.replace('_', ' ')}</div>
                    <div className="text-[9px] text-slate-400 mt-1 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5 text-slate-400" />
                      <span>{formatTimestamp(sig.timestamp)}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-5 text-center">
                    <span className={`inline-block border text-[9px] font-bold uppercase px-2 py-1 rounded-md ${getVerdictBadgeClass(sig.verdict)}`}>
                      {cleanLabel(sig.verdict)}
                    </span>
                  </td>
                  <td className="py-3.5 px-5 text-center">
                    {sig.direction === 'NEUTRAL' ? (
                      <span className="text-slate-400 font-bold uppercase text-[9px]">—</span>
                    ) : sig.direction === 'BUY' || sig.direction === 'LONG' || sig.direction === 'Bullish' ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-[10px] bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded">
                        <TrendingUp className="w-3 h-3" /><span>LONG</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-700 font-bold text-[10px] bg-rose-50 border border-rose-100 px-2 py-0.5 rounded">
                        <TrendingDown className="w-3 h-3" /><span>SHORT</span>
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-5 font-mono text-slate-600 leading-relaxed">
                    {sig.verdict.startsWith('EXECUTE') ? (
                      <div className="text-[10px] space-y-0.5">
                        <div className="flex gap-2"><span className="text-slate-400 w-12">Entry:</span> <strong className="text-slate-700">{sig.entry_low}</strong></div>
                        <div className="flex gap-2"><span className="text-slate-400 w-12">Target:</span> <strong className="text-emerald-600">{sig.tp1}</strong></div>
                        <div className="flex gap-2"><span className="text-slate-400 w-12">Stop:</span> <strong className="text-rose-600">{sig.sl}</strong></div>
                      </div>
                    ) : (
                      <div className="text-[10px] space-y-0.5">
                        <div className="flex gap-2"><span className="text-slate-400 w-14">Price at:</span> <strong className="text-slate-700">{sig.current_price_at_signal || 'N/A'}</strong></div>
                        <div className="flex gap-2"><span className="text-slate-400 w-14">Zone:</span> <strong className="text-orange-600">{sig.entry_low ? `${sig.entry_low} – ${sig.entry_high || sig.entry_low}` : 'None'}</strong></div>
                      </div>
                    )}
                  </td>
                  <td className="py-3.5 px-5 text-center">
                    <div className="flex flex-col items-center gap-1 justify-center">
                      {sig.win_probability_pct ? (
                        <span className="text-slate-800 font-bold font-mono text-xs">
                          {sig.win_probability_pct}%
                        </span>
                      ) : <span className="text-slate-400 font-mono text-[9px]">—</span>}
                      {sig.expected_value_r ? (
                        <span className="text-[8px] text-orange-700 font-bold bg-orange-50 border border-orange-100 rounded px-1.5 py-0.5 font-mono leading-none">
                          EV: {sig.expected_value_r}R
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="py-3.5 px-5 text-center">
                    <span className={`inline-block border text-[9px] font-bold uppercase px-2 py-1 rounded-md ${getOutcomeBadgeClass(sig.outcome)}`}>
                      {cleanLabel(sig.outcome)}
                    </span>
                    {sig.pnl_atr !== null && sig.pnl_atr !== 0 && (
                      <div className={`text-[10px] font-bold mt-1 font-mono tracking-tight ${sig.pnl_atr > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {sig.pnl_atr > 0 ? '+' : ''}{sig.pnl_atr}R
                      </div>
                    )}
                  </td>
                  <td className="py-3.5 px-5 text-center">
                    <button
                      onClick={() => setSelectedSignal(selectedSignal?.id === sig.id ? null : sig)}
                      className={`p-2 rounded-xl border transition-all cursor-pointer ${selectedSignal?.id === sig.id ? 'bg-orange-50 border-orange-200 text-orange-600 shadow-sm' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-400 shadow-sm'}`}
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

      {/* Selected Row Drawer Panel */}
      {selectedSignal && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-t border-slate-250 p-6 bg-slate-50 text-xs text-slate-600 flex flex-col md:flex-row gap-6 relative shadow-inner text-left"
        >
          <button
            onClick={() => setSelectedSignal(null)}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <div className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 shadow-sm">
               <span className="sr-only">Close Panel</span>
               <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </div>
          </button>

          <div className="flex-1 space-y-4 md:border-r md:border-slate-200 md:pr-6">
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
              <div className="w-2 h-2 rounded-full bg-orange-500"></div>
              <span>Setup Audit Block</span>
              <span className="font-mono text-[10px] text-slate-400 ml-1">#{selectedSignal.id}</span>
            </h4>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 font-medium bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-sm">
              <div><span className="text-slate-400 block text-[9px] uppercase tracking-wider">Timestamp</span> <span className="text-slate-700">{new Date(selectedSignal.timestamp).toUTCString()}</span></div>
              <div><span className="text-slate-400 block text-[9px] uppercase tracking-wider">Trading Mode</span> <span className="text-slate-700 uppercase font-mono text-[10px]">{selectedSignal.mode}</span></div>
              <div><span className="text-slate-400 block text-[9px] uppercase tracking-wider">Instrument</span> <span className="text-slate-700">{selectedSignal.asset}</span></div>
              <div><span className="text-slate-400 block text-[9px] uppercase tracking-wider">Regime</span> <span className="text-slate-700 uppercase text-[10px]">{selectedSignal.regime || 'STABLE'}</span></div>
            </div>
            
            {selectedSignal.notes && (
              <div className="bg-orange-500/[0.03] border border-orange-100 p-3.5 rounded-xl leading-relaxed text-slate-600 shadow-sm">
                <strong className="text-orange-700 block mb-1 uppercase tracking-wider text-[9px]">Decision Engine Notes</strong>
                {selectedSignal.notes}
              </div>
            )}
          </div>

          <div className="flex-1 space-y-4">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-slate-500" />
              Guardrails & Safety Check
            </h4>
            
            {selectedSignal.verdict === 'AVOID' ? (
              <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-800 flex items-start gap-3 text-left shadow-sm">
                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold text-xs text-rose-700">Hard Avoid Protocol Activated</strong>
                  <p className="text-rose-600 font-mono text-[10px] mt-1.5 leading-relaxed">
                    {selectedSignal.hard_block_reason || "Market structure configuration indicates high-risk parameters. Execution rejected."}
                  </p>
                </div>
              </div>
            ) : selectedSignal.verdict === 'WAIT' ? (
              <div className="p-3.5 bg-blue-50 border border-blue-100 rounded-xl text-blue-800 flex items-start gap-3 text-left shadow-sm">
                <Clock className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold text-xs text-blue-700">Execution Blocked (Hold Phase)</strong>
                  <p className="text-blue-600 font-mono text-[10px] mt-1.5 leading-relaxed">
                    {selectedSignal.wait_reason || "System currently tracking secondary timeframe structure before confirming execution."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 flex items-start gap-3 text-left shadow-sm">
                <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold text-xs text-emerald-700">All Core Audits Cleared</strong>
                  <p className="text-emerald-600 text-[10px] mt-1.5 leading-relaxed">
                    Target setup cleared economic release calendars, liquidity sweeps, and trend alignment metrics. Sizing models authorized.
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
