import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { ShieldAlert, BarChart2, TrendingUp, AlertTriangle, Clock } from 'lucide-react';

interface AnalysisResultProps {
  result: string | null;
  isLoading: boolean;
  statusMsg?: string;
}

export function AnalysisResult({ result, isLoading, statusMsg }: AnalysisResultProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-zinc-500 space-y-6">
        <div className="relative">
          <div className="w-16 h-16 border border-zinc-800 rounded-full"></div>
          <div className="w-16 h-16 border border-indigo-500 border-t-transparent rounded-full animate-spin absolute inset-0 shadow-[0_0_20px_rgba(79,70,229,0.3)]"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(129,140,248,0.8)]"></div>
          </div>
        </div>
        <div className="flex flex-col items-center space-y-2 text-[10px] tracking-[0.25em] uppercase font-bold text-zinc-400">
          <span className="animate-pulse">{statusMsg || "Executing Algorithmic Scan"}</span>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-zinc-500 p-8 border-2 border-dashed border-zinc-800/80 bg-zinc-900/20 rounded-2xl">
        <BarChart2 className="w-12 h-12 mb-4 text-zinc-700" />
        <h2 className="text-[11px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Awaiting Command</h2>
        <p className="text-xs mt-3 max-w-sm text-center text-zinc-600 font-medium">
          Select asset and parameters, then initiate analysis.
        </p>
      </div>
    );
  }

  // Pre-process markdown if we see a complete rejection
  const isRejected = result.includes('VERDICT: AVOID') ||
                     result.includes('**AVOID**') ||
                     result.includes('NO TRADE SETUP FOUND') ||
                     result.includes('VERDICT: BLOCK');

  const isCaution = result.includes('VERDICT: EXECUTE WITH CAUTION') ||
                    result.includes('**EXECUTE WITH CAUTION**') ||
                    result.includes('EXECUTE_WITH_CAUTION');

  // isExecute must NOT match EXECUTE WITH CAUTION
  const isExecute = !isCaution && (
                    result.includes('VERDICT: EXECUTE') ||
                    result.includes('**EXECUTE**'));

  const isWait = result.includes('VERDICT: WAIT') ||
                 result.includes('**WAIT**');

  return (
    <div className="w-full text-zinc-300 pb-20">
      {isRejected && (
        <div className="mb-8 p-5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 flex flex-col gap-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <div className="flex items-center gap-3 font-bold tracking-[0.15em] uppercase text-sm text-rose-400">
            <ShieldAlert className="w-5 h-5" />
            <span>Execution Blocked</span>
          </div>
          <p className="text-xs text-rose-300/80 font-medium leading-relaxed">Hard block condition present. Capital preservation engaged. See intelligence below for details.</p>
        </div>
      )}

      {isWait && !isRejected && (
        <div className="mb-8 p-5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-300 flex flex-col gap-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <div className="flex items-center gap-3 font-bold tracking-[0.15em] uppercase text-sm text-blue-400">
            <Clock className="w-5 h-5" />
            <span>Hold Position - Wait</span>
          </div>
          <p className="text-xs text-blue-300/80 font-medium leading-relaxed">Setup is developing or requires confirmation. See parameters below.</p>
        </div>
      )}

      {isCaution && !isRejected && !isWait && (
        <div className="mb-8 p-5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 flex flex-col gap-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <div className="flex items-center gap-3 font-bold tracking-[0.15em] uppercase text-sm text-amber-400">
            <AlertTriangle className="w-5 h-5" />
            <span>Execute With Caution — 50% Size</span>
          </div>
          <p className="text-xs text-amber-300/80 font-medium leading-relaxed">Valid setup with conflicting evidence. Reduce position size. Monitor exits.</p>
        </div>
      )}

      {isExecute && !isRejected && !isCaution && !isWait && (
        <div className="mb-8 p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 flex flex-col gap-3 shadow-[0_0_20px_rgba(16,185,129,0.1),inset_0_1px_0_rgba(255,255,255,0.05)]">
          <div className="flex items-center gap-3 font-bold tracking-[0.15em] uppercase text-sm text-emerald-400">
            <TrendingUp className="w-5 h-5 shadow-[0_0_10px_rgba(16,185,129,0.5)] rounded-full" />
            <span>Execute — Full Position</span>
          </div>
          <p className="text-xs text-emerald-300/80 font-medium leading-relaxed">Evidence aligned. Standard sizing applies as per risk configuration.</p>
        </div>
      )}

      <div className="mb-4 rounded-xl border border-zinc-800/80 bg-zinc-950/30 overflow-hidden [&_table]:w-full [&_table]:text-sm [&_table]:font-mono [&_th]:hidden [&_td]:px-4 [&_td]:py-3 [&_tr:nth-child(odd)]:bg-zinc-900/30 [&_tr:nth-child(even)]:bg-transparent [&_h2]:text-[11px] [&_h2]:font-bold [&_h2]:tracking-[0.2em] [&_h2]:px-4 [&_h2]:py-3 [&_h2]:bg-zinc-900/80 [&_h2]:text-zinc-400 [&_h2]:border-b [&_h2]:border-zinc-800">
        <div className="markdown-body prose prose-invert max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-h1:text-2xl prose-h1:text-white prose-h2:text-sm prose-h2:uppercase prose-h2:tracking-[0.15em] prose-h2:text-indigo-400 prose-h2:mt-10 prose-h2:mb-4 prose-h2:border-b prose-h2:border-zinc-800/80 prose-h2:pb-3 prose-a:text-indigo-400 hover:prose-a:text-indigo-300 prose-strong:font-bold prose-strong:text-white prose-ul:list-square prose-li:marker:text-indigo-500 prose-p:text-zinc-400 prose-li:text-zinc-400 prose-code:text-indigo-300 prose-code:bg-indigo-500/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:font-medium prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-800">
          <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
            {result}
          </Markdown>
        </div>
      </div>
    </div>
  );
}
