import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { AnalysisResult } from './components/AnalysisResult';
import { TradingMode } from './types';
import { Activity, BookOpen, BarChart3 } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function App() {
  const [activeTab, setActiveTab] = useState<'analysis' | 'architecture'>('analysis');
  const [result, setResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [archDoc, setArchDoc] = useState<string>('');

  useEffect(() => {
    fetch('/ARCHITECTURE.md')
      .then(res => res.text())
      .then(text => setArchDoc(text))
      .catch(err => console.error('Failed to load architecture doc', err));
  }, []);

  const handleAnalyze = async (asset: string, mode: TradingMode, imageBase64?: string) => {
    setIsLoading(true);
    setResult(null);
    setActiveTab('analysis');

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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center bg-slate-900 text-white rounded">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-widest uppercase">QUANT-X PRO</h1>
              <p className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-[0.1em] sm:tracking-[0.2em] font-medium">Institutional Market Analyst</p>
            </div>
          </div>
          
          <div className="flex items-center p-1 bg-slate-100 rounded-lg">
            <button 
              onClick={() => setActiveTab('analysis')}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-md transition-colors ${activeTab === 'analysis' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Analysis</span>
            </button>
            <button 
              onClick={() => setActiveTab('architecture')}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-md transition-colors ${activeTab === 'architecture' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Architecture</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-8">
        {activeTab === 'analysis' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-start">
            <aside className="lg:col-span-4 lg:sticky lg:top-24 bg-white p-5 sm:p-6 md:p-8 rounded-xl border border-slate-100 shadow-sm">
              <Sidebar onAnalyze={handleAnalyze} isLoading={isLoading} />
            </aside>

            <section className="lg:col-span-8 bg-white p-5 sm:p-6 md:p-12 rounded-xl border border-slate-100 shadow-sm min-h-[400px] lg:min-h-[600px] mt-4 lg:mt-0">
              <AnalysisResult result={result} isLoading={isLoading} />
            </section>
          </div>
        ) : (
          <div className="bg-white p-6 md:p-12 rounded-xl border border-slate-100 shadow-sm min-h-[600px]">
            <article className="markdown-body prose prose-slate max-w-none prose-headings:font-medium prose-headings:tracking-tight prose-h1:text-3xl prose-h2:text-xl prose-h2:uppercase prose-h2:tracking-widest prose-h2:text-xs prose-h2:text-slate-400 prose-h2:mt-12 prose-h2:mb-4 prose-h2:border-b prose-h2:border-slate-100 prose-h2:pb-2 prose-a:text-blue-600 prose-strong:font-semibold prose-strong:text-slate-900">
               {archDoc ? (
                 <Markdown remarkPlugins={[remarkGfm]}>{archDoc}</Markdown>
               ) : (
                 <div className="text-slate-400 text-sm">Loading Architecture Specs...</div>
               )}
            </article>
          </div>
        )}
      </main>
    </div>
  );
}
