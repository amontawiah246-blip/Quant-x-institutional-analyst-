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
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-[#52705b] space-y-6">
        <div className="relative">
          <div className="w-16 h-16 border-2 border-[#17301e] rounded-full"></div>
          <div className="w-16 h-16 border-2 border-[#38F17A] border-t-transparent rounded-full animate-spin absolute inset-0 shadow-[0_0_15px_rgba(56,241,122,0.4)]"></div>
        </div>
        <div className="flex flex-col items-center space-y-2 text-sm tracking-widest uppercase font-bold text-[#7e9987]">
          <span className="animate-pulse">{statusMsg || "Executing Algorithmic Scan..."}</span>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-[#52705b] p-8 border-2 border-dashed border-[#17301e] bg-[#0a180e]/40 rounded-2xl">
        <BarChart2 className="w-12 h-12 mb-4 text-[#235031]" />
        <h2 className="text-sm font-bold text-[#7e9987] uppercase tracking-widest">Awaiting Command</h2>
        <p className="text-xs mt-2 max-w-sm text-center text-[#52705b]">
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
    <div className="w-full text-slate-200 pb-20">
      {isRejected && (
        <div className="mb-8 p-4 bg-red-950/40 border border-red-900/50 rounded-xl text-red-200 flex flex-col gap-2">
          <div className="flex items-center gap-2 font-bold tracking-widest uppercase text-sm text-red-400">
            <ShieldAlert className="w-5 h-5" />
            <span>Execution Blocked</span>
          </div>
          <p className="text-xs text-red-300">Hard block condition present. Capital preservation engaged. See analysis for details.</p>
        </div>
      )}

      {isWait && !isRejected && (
        <div className="mb-8 p-4 bg-blue-950/40 border border-blue-900/50 rounded-xl text-blue-200 flex flex-col gap-2">
          <div className="flex items-center gap-2 font-bold tracking-widest uppercase text-sm text-blue-400">
            <Clock className="w-5 h-5" />
            <span>Hold Position - Wait</span>
          </div>
          <p className="text-xs text-blue-300">Setup is developing or requires confirmation. See parameters below.</p>
        </div>
      )}

      {isCaution && !isRejected && !isWait && (
        <div className="mb-8 p-4 bg-amber-950/40 border border-amber-900/50 rounded-xl text-amber-200 flex flex-col gap-2">
          <div className="flex items-center gap-2 font-bold tracking-widest uppercase text-sm text-amber-400">
            <AlertTriangle className="w-5 h-5" />
            <span>Execute With Caution — 50% Size</span>
          </div>
          <p className="text-xs text-amber-300">Valid setup with conflicting evidence. Reduce position size. Monitor exits.</p>
        </div>
      )}

      {isExecute && !isRejected && !isCaution && !isWait && (
        <div className="mb-8 p-4 bg-[#0d2a16] border border-[#1e5c30] rounded-xl text-[#a4fbc1] flex flex-col gap-2 shadow-[0_0_20px_rgba(56,241,122,0.1)]">
          <div className="flex items-center gap-2 font-bold tracking-widest uppercase text-sm text-[#38F17A]">
            <TrendingUp className="w-5 h-5 shadow-sm" />
            <span>Execute — Full Position</span>
          </div>
          <p className="text-xs text-[#7ad99c]">Evidence aligned. Standard sizing applies as per risk configuration.</p>
        </div>
      )}

      <div className="markdown-body prose prose-invert max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-h1:text-2xl prose-h1:text-white prose-h2:text-lg prose-h2:uppercase prose-h2:tracking-widest prose-h2:text-[#38F17A] prose-h2:mt-10 prose-h2:mb-4 prose-h2:border-b prose-h2:border-[#17301e] prose-h2:pb-2 prose-a:text-[#38F17A] prose-strong:font-bold prose-strong:text-white prose-ul:list-square prose-li:marker:text-[#38F17A] prose-p:text-[#acbfaa] prose-li:text-[#acbfaa] prose-code:text-[#38F17A] prose-code:bg-[#112718] prose-code:px-1 prose-code:rounded">
        <Markdown remarkPlugins={[remarkGfm]}>
          {result}
        </Markdown>
      </div>
    </div>
  );
}
