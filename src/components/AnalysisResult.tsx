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
      <div className="flex flex-col items-center justify-center h-full min-h-[350px] text-slate-400 space-y-6">
        <div className="relative">
          <div className="w-14 h-14 border border-slate-200 rounded-full"></div>
          <div className="w-14 h-14 border-2 border-orange-500 border-t-transparent rounded-full animate-spin absolute inset-0 shadow-md shadow-orange-500/10"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2.5 h-2.5 bg-orange-500 rounded-full animate-pulse"></div>
          </div>
        </div>
        <div className="flex flex-col items-center space-y-2 text-[10px] tracking-[0.2em] uppercase font-bold text-slate-500">
          <span className="animate-pulse">{statusMsg || "Executing Algorithmic Scan"}</span>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[350px] text-slate-400 p-8 border-2 border-dashed border-slate-200 bg-slate-50 rounded-2xl">
        <BarChart2 className="w-10 h-10 mb-3 text-slate-300" />
        <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">Awaiting Instruction</h2>
        <p className="text-xs mt-2 max-w-sm text-center text-slate-500">
          Select an asset, adjust timeframe specifications, and request immediate consensus models.
        </p>
      </div>
    );
  }

  // Pre-process markdown to check verdicts
  const isRejected = result.includes('VERDICT: AVOID') ||
                     result.includes('**AVOID**') ||
                     result.includes('NO TRADE SETUP FOUND') ||
                     result.includes('VERDICT: BLOCK');

  const isCaution = result.includes('VERDICT: EXECUTE WITH CAUTION') ||
                    result.includes('**EXECUTE WITH CAUTION**') ||
                    result.includes('EXECUTE_WITH_CAUTION');

  const isExecute = !isCaution && (
                    result.includes('VERDICT: EXECUTE') ||
                    result.includes('**EXECUTE**'));

  const isWait = result.includes('VERDICT: WAIT') ||
                 result.includes('**WAIT**');

  return (
    <div className="w-full text-[#E2E8F0] pb-12">
      {isRejected && (
        <div className="mb-6 p-4.5 bg-rose-900/20 border border-rose-900/30 rounded-[24px] text-rose-300 flex flex-col gap-2 text-left shadow-[0_8px_32px_rgba(110,50,200,0.2)]">
          <div className="flex items-center gap-2.5 font-bold tracking-wider uppercase text-xs text-rose-400">
            <ShieldAlert className="w-4 h-4 text-rose-500" />
            <span>Execution Blocked</span>
          </div>
          <p className="text-xs text-rose-300/90 font-medium leading-relaxed">Hard block condition present. Capital preservation engaged. See intelligence report below for details.</p>
        </div>
      )}

      {isWait && !isRejected && (
        <div className="mb-6 p-4.5 bg-blue-900/20 border border-blue-900/30 rounded-[24px] text-blue-300 flex flex-col gap-2 text-left shadow-[0_8px_32px_rgba(110,50,200,0.2)]">
          <div className="flex items-center gap-2.5 font-bold tracking-wider uppercase text-xs text-blue-400">
            <Clock className="w-4 h-4 text-blue-500" />
            <span>Hold Position - Awaiting Confirmation</span>
          </div>
          <p className="text-xs text-blue-300/90 font-medium leading-relaxed">Setup is currently developing or requires confirmation. See parameters below.</p>
        </div>
      )}

      {isCaution && !isRejected && !isWait && (
        <div className="mb-6 p-4.5 bg-amber-900/20 border border-amber-900/30 rounded-[24px] text-amber-300 flex flex-col gap-2 text-left shadow-[0_8px_32px_rgba(110,50,200,0.2)]">
          <div className="flex items-center gap-2.5 font-bold tracking-wider uppercase text-xs text-amber-400">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span>Execute With Caution — 50% Sizing</span>
          </div>
          <p className="text-xs text-amber-300/90 font-medium leading-relaxed">Valid setup with conflicting indicators. Reduce exposure and monitor key level exits.</p>
        </div>
      )}

      {isExecute && !isRejected && !isCaution && !isWait && (
        <div className="mb-6 p-4.5 bg-emerald-900/20 border border-emerald-900/30 rounded-[24px] text-emerald-300 flex flex-col gap-2 text-left shadow-[0_8px_32px_rgba(110,50,200,0.2)]">
          <div className="flex items-center gap-2.5 font-bold tracking-wider uppercase text-xs text-emerald-400">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <span>Execute — Standard Position Sizing</span>
          </div>
          <p className="text-xs text-emerald-300/90 font-medium leading-relaxed">Evidence aligned. Standard positioning model parameters apply.</p>
        </div>
      )}

      <div className="mb-4 rounded-[24px] border border-[rgba(255,255,255,0.1)] bg-[rgba(30,20,50,0.6)] backdrop-blur-[8px] shadow-[0_8px_32px_rgba(110,50,200,0.2)] overflow-hidden text-left">
        <div className="p-6 md:p-8 markdown-body prose max-w-none break-words prose-invert prose-headings:font-bold prose-headings:tracking-tight prose-h1:text-xl prose-h1:text-white prose-h2:text-xs prose-h2:uppercase prose-h2:tracking-[0.1em] prose-h2:text-purple-400 prose-h2:mt-8 prose-h2:mb-3 prose-h2:border-b prose-h2:border-[rgba(255,255,255,0.1)] prose-h2:pb-2 prose-strong:font-bold prose-strong:text-white prose-ul:list-square prose-li:marker:text-purple-500 prose-p:text-[#E2E8F0]/70 prose-li:text-[#E2E8F0]/70 prose-code:text-purple-300 prose-code:bg-purple-900/20 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:font-medium prose-pre:bg-[#120E1B] prose-pre:border prose-pre:border-[rgba(255,255,255,0.1)] prose-pre:text-[#E2E8F0] prose-table:w-full prose-table:text-xs prose-tr:border-b prose-tr:border-[rgba(255,255,255,0.1)] overflow-x-hidden">
          <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
            {result}
          </Markdown>
        </div>
      </div>
    </div>
  );
}
