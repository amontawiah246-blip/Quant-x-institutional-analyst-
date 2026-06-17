import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ShieldAlert, BarChart2, TrendingUp, AlertTriangle, Clock } from 'lucide-react';

interface AnalysisResultProps {
  result: string | null;
  isLoading: boolean;
  statusMsg?: string;
}

export function AnalysisResult({ result, isLoading, statusMsg }: AnalysisResultProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-slate-500 space-y-6">
        <div className="relative">
          <div className="w-16 h-16 border-2 border-slate-200 rounded-full"></div>
          <div className="w-16 h-16 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin absolute inset-0 shadow-[0_0_15px_rgba(79,70,229,0.2)]"></div>
        </div>
        <div className="flex flex-col items-center space-y-2 text-sm tracking-widest uppercase font-bold text-slate-600">
          <span className="animate-pulse">{statusMsg || "Executing Algorithmic Scan..."}</span>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-slate-500 p-8 border-2 border-dashed border-slate-200 bg-slate-50 rounded-2xl">
        <BarChart2 className="w-12 h-12 mb-4 text-slate-400" />
        <h2 className="text-sm font-bold text-slate-600 uppercase tracking-widest">Awaiting Command</h2>
        <p className="text-xs mt-2 max-w-sm text-center text-slate-500">
          Select asset and parameters, then hit "Get Signal".
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
    <div className="w-full text-slate-700 pb-20">
      {isRejected && (
        <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 flex flex-col gap-2">
          <div className="flex items-center gap-2 font-bold tracking-widest uppercase text-sm text-red-700">
            <ShieldAlert className="w-5 h-5" />
            <span>Execution Blocked</span>
          </div>
          <p className="text-xs text-red-600">Hard block condition present. Capital preservation engaged. See analysis for details.</p>
        </div>
      )}

      {isWait && !isRejected && (
        <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 flex flex-col gap-2">
          <div className="flex items-center gap-2 font-bold tracking-widest uppercase text-sm text-blue-700">
            <Clock className="w-5 h-5" />
            <span>Hold Position - Wait</span>
          </div>
          <p className="text-xs text-blue-600">Setup is developing or requires confirmation. See parameters below.</p>
        </div>
      )}

      {isCaution && !isRejected && !isWait && (
        <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 flex flex-col gap-2">
          <div className="flex items-center gap-2 font-bold tracking-widest uppercase text-sm text-amber-700">
            <AlertTriangle className="w-5 h-5" />
            <span>Execute With Caution — 50% Size</span>
          </div>
          <p className="text-xs text-amber-600">Valid setup with conflicting evidence. Reduce position size. Monitor exits.</p>
        </div>
      )}

      {isExecute && !isRejected && !isCaution && !isWait && (
        <div className="mb-8 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex flex-col gap-2 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
          <div className="flex items-center gap-2 font-bold tracking-widest uppercase text-sm text-emerald-700">
            <TrendingUp className="w-5 h-5 shadow-sm" />
            <span>Execute — Full Position</span>
          </div>
          <p className="text-xs text-emerald-600">Evidence aligned. Standard sizing applies as per risk configuration.</p>
        </div>
      )}

      <div className="markdown-body prose max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-h1:text-2xl prose-h1:text-slate-900 prose-h2:text-lg prose-h2:uppercase prose-h2:tracking-widest prose-h2:text-indigo-600 prose-h2:mt-10 prose-h2:mb-4 prose-h2:border-b prose-h2:border-slate-200 prose-h2:pb-2 prose-a:text-indigo-600 prose-strong:font-bold prose-strong:text-slate-900 prose-ul:list-square prose-li:marker:text-indigo-600 prose-p:text-slate-600 prose-li:text-slate-600 prose-code:text-indigo-600 prose-code:bg-slate-100 prose-code:px-1 prose-code:rounded">
        <Markdown remarkPlugins={[remarkGfm]}>
          {result}
        </Markdown>
      </div>
    </div>
  );
}
