import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ShieldAlert, BarChart2, TrendingUp, AlertTriangle } from 'lucide-react';

interface AnalysisResultProps {
  result: string | null;
  isLoading: boolean;
}

export function AnalysisResult({ result, isLoading }: AnalysisResultProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-slate-400 space-y-6">
        <div className="relative">
          <div className="w-16 h-16 border-2 border-slate-100 rounded-full"></div>
          <div className="w-16 h-16 border-2 border-slate-900 border-t-transparent rounded-full animate-spin absolute inset-0"></div>
        </div>
        <div className="flex flex-col items-center space-y-2 text-sm tracking-widest uppercase font-medium">
          <span className="animate-pulse">Fetching live market data from Deriv...</span>
          <span className="text-xs text-slate-300">Running structure & confluence engines</span>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-slate-400 p-8 border-2 border-dashed border-slate-100 bg-slate-50/50">
        <BarChart2 className="w-12 h-12 mb-4 text-slate-300" />
        <h2 className="text-lg font-medium text-slate-600 tracking-tight">Awaiting Parameters</h2>
        <p className="text-sm mt-2 max-w-sm text-center text-slate-400">
          Select your target asset and trading mode to generate an institutional-grade top-down analysis.
        </p>
      </div>
    );
  }

  // Pre-process markdown if we see a complete rejection
  const isRejected = result.includes('NO TRADE SETUP FOUND');

  return (
    <div className="w-full text-slate-800 pb-20">
      {isRejected && (
         <div className="mb-8 p-4 bg-red-50 border border-red-100 text-red-800 flex flex-col gap-2">
            <div className="flex items-center gap-2 font-bold tracking-widest uppercase text-sm">
                <ShieldAlert className="w-5 h-5 text-red-600" />
                <span>Trade Execution Blocked</span>
            </div>
            <p className="text-sm">Institutional confidence failed to meet the required threshold. Capital preservation protocol engaged.</p>
         </div>
      )}

      <div className="markdown-body prose prose-slate max-w-none prose-headings:font-medium prose-headings:tracking-tight prose-h1:text-2xl prose-h2:text-xl prose-h2:uppercase prose-h2:tracking-widest prose-h2:text-xs prose-h2:text-slate-400 prose-h2:mt-12 prose-h2:mb-4 prose-h2:border-b prose-h2:border-slate-100 prose-h2:pb-2 prose-a:text-blue-600 prose-strong:font-semibold prose-strong:text-slate-900 prose-ul:list-square prose-li:marker:text-slate-300">
        <Markdown remarkPlugins={[remarkGfm]}>
          {result}
        </Markdown>
      </div>
    </div>
  );
}
