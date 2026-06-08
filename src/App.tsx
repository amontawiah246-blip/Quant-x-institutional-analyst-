import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { AnalysisResult } from './components/AnalysisResult';
import { TradingMode } from './types';
import { Activity } from 'lucide-react';

export default function App() {
  const [result, setResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleAnalyze = async (asset: string, mode: TradingMode, imageBase64?: string) => {
    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ asset, mode, image: imageBase64 }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze');
      }

      const data = await response.json();
      setResult(data.result);
    } catch (error: any) {
      console.error(error);
      setResult(`**SYSTEM ERROR**\n\nFailed to complete analysis. \n\n\`${error.message}\`\n\nPlease ensure your configuration and API limits are intact.`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-slate-200">
      <header className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-4 flex items-center gap-3">
          <div className="w-8 h-8 flex items-center justify-center bg-slate-900 text-white rounded">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-widest uppercase">QUANT-X</h1>
            <p className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-[0.1em] sm:tracking-[0.2em] font-medium">Institutional Market Analyst</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-start">
          
          <aside className="lg:col-span-4 lg:sticky lg:top-24 bg-white p-5 sm:p-6 md:p-8 rounded-xl border border-slate-100 shadow-sm">
            <Sidebar onAnalyze={handleAnalyze} isLoading={isLoading} />
          </aside>

          <section className="lg:col-span-8 bg-white p-5 sm:p-6 md:p-12 rounded-xl border border-slate-100 shadow-sm min-h-[400px] lg:min-h-[600px] mt-4 lg:mt-0">
            <AnalysisResult result={result} isLoading={isLoading} />
          </section>

        </div>
      </main>
    </div>
  );
}
