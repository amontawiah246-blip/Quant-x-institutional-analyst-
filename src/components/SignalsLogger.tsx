import { SMCSignal } from '../types.ts';
import { TrendingUp, TrendingDown, Clock, Search, RotateCw, CheckCircle2, XCircle } from 'lucide-react';
import { useState } from 'react';

interface SignalsLoggerProps {
  signals: SMCSignal[];
  onRefresh: () => void;
  isLoading: boolean;
}

export default function SignalsLogger({ signals, onRefresh, isLoading }: SignalsLoggerProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredSignals = signals.filter(signal => 
    signal.asset.toLowerCase().includes(searchTerm.toLowerCase()) ||
    signal.direction.toLowerCase().includes(searchTerm.toLowerCase()) ||
    signal.verdict.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-[#13111C]/85 backdrop-blur-md border border-white/8 rounded-[24px] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.3)] flex flex-col gap-4">
      
      {/* Search & Header bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold tracking-widest font-mono text-[#FF6B35]">SESSION SIGNALS LEDGER LOG</span>
          <span className="text-[10px] font-mono px-2 py-0.5 bg-purple-500/10 text-purple-300 border border-purple-500/20 rounded">
            DB SYNC
          </span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Search bar */}
          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search assets..."
              className="w-full bg-[#0B0A11] border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-600 outline-none focus:border-[#FF6B35] transition-all font-mono"
            />
          </div>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 hover:bg-white/5 border border-white/5 rounded-xl text-zinc-400 hover:text-white disabled:opacity-50 disabled:cursor-wait transition-colors cursor-pointer"
            title="Refresh Ledger Logs"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Signals Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse font-mono text-xs">
          <thead>
            <tr className="border-b border-white/5 text-zinc-500 text-[10px] uppercase tracking-wider">
              <th className="py-2.5 px-3">Timestamp</th>
              <th className="py-2.5 px-3">Asset</th>
              <th className="py-2.5 px-3">Type</th>
              <th className="py-2.5 px-3">Confluence</th>
              <th className="py-2.5 px-3 text-right">Entry Range</th>
              <th className="py-2.5 px-3 text-right">SL / TP2</th>
              <th className="py-2.5 px-3 text-center">Status</th>
              <th className="py-2.5 px-3 text-right">PnL (R)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredSignals.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-zinc-600">
                  {isLoading ? 'Fetching signals from SQLite...' : 'No quantitative signals recorded.'}
                </td>
              </tr>
            ) : (
              filteredSignals.map((signal) => {
                const isLong = signal.direction === 'LONG';
                const isShort = signal.direction === 'SHORT';
                const isPending = signal.outcome === 'PENDING';
                const isTP = signal.outcome?.startsWith('TP');
                const isSL = signal.outcome === 'SL_HIT';

                return (
                  <tr key={signal.id} className="hover:bg-white/[0.02] transition-colors">
                    {/* Timestamp */}
                    <td className="py-3 px-3 text-zinc-500 whitespace-nowrap">
                      {new Date(signal.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    
                    {/* Asset Name */}
                    <td className="py-3 px-3 font-bold text-white whitespace-nowrap">
                      {signal.asset}
                    </td>

                    {/* Direction / Type */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 font-bold ${
                        isLong 
                          ? 'text-[#39ff14]' 
                          : isShort
                          ? 'text-[#ff073a]'
                          : 'text-zinc-500'
                      }`}>
                        {isLong && <TrendingUp className="w-3 h-3" />}
                        {isShort && <TrendingDown className="w-3 h-3" />}
                        {signal.direction}
                      </span>
                    </td>

                    {/* Confluence */}
                    <td className="py-3 px-3 font-bold text-purple-300">
                      {signal.confluence_score}%
                    </td>

                    {/* Entry Range */}
                    <td className="py-3 px-3 text-right font-medium text-white whitespace-nowrap">
                      ${signal.entry_low.toLocaleString(undefined, { minimumFractionDigits: 2 })} - ${signal.entry_high.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>

                    {/* SL / TP2 */}
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <span className="text-[#ff073a]">${signal.sl.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      <span className="text-zinc-500 mx-1">/</span>
                      <span className="text-[#39ff14]">${signal.tp2.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </td>

                    {/* Outcome Status */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black ${
                        isTP 
                          ? 'bg-[#39ff14]/10 text-[#39ff14]' 
                          : isSL
                          ? 'bg-[#ff073a]/10 text-[#ff073a]'
                          : isPending
                          ? 'bg-purple-500/10 text-purple-300 animate-pulse'
                          : 'bg-zinc-800 text-zinc-500'
                      }`}>
                        {isTP && <CheckCircle2 className="w-3 h-3 text-[#39ff14]" />}
                        {isSL && <XCircle className="w-3 h-3 text-[#ff073a]" />}
                        {isPending && <Clock className="w-3 h-3 text-purple-400" />}
                        {signal.outcome || 'SKIPPED'}
                      </span>
                    </td>

                    {/* PnL ATR Units */}
                    <td className={`py-3 px-3 text-right font-bold whitespace-nowrap ${
                      (signal.pnl_atr ?? 0) > 0 
                        ? 'text-[#39ff14]' 
                        : (signal.pnl_atr ?? 0) < 0
                        ? 'text-[#ff073a]'
                        : 'text-zinc-500'
                    }`}>
                      {signal.pnl_atr !== null && signal.pnl_atr !== undefined ? (
                        <>
                          {signal.pnl_atr > 0 ? '+' : ''}
                          {signal.pnl_atr} R
                        </>
                      ) : (
                        '--'
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
