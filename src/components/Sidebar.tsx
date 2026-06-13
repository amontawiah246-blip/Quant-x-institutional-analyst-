import React, { useRef, useState } from 'react';
import { UploadCloud, X, Target, Crosshair } from 'lucide-react';
import { MARKETS, MarketCategory, TradingMode } from '../types';
import { cn } from '../lib/utils';

interface SidebarProps {
  onAnalyze: (asset: string, mode: TradingMode, imageBase64?: string, accountSize?: number, riskPct?: number) => void;
  isLoading: boolean;
}

export function Sidebar({ onAnalyze, isLoading }: SidebarProps) {
  const [category, setCategory] = useState<MarketCategory>('Forex');
  const [asset, setAsset] = useState<string>(MARKETS['Forex'][0]);
  const [mode, setMode] = useState<TradingMode>('SCALPING MODE');
  const [preview, setPreview] = useState<string | null>(null);
  const [accountSize, setAccountSize] = useState<string>('10000');
  const [riskPct, setRiskPct] = useState<string>('1');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClearImage = () => {
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAnalyze(asset, mode, preview || undefined, parseFloat(accountSize) || 10000, parseFloat(riskPct) || 1.0);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      
      {/* Target Market */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold tracking-widest text-slate-400 uppercase">Target Market</h3>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(MARKETS) as MarketCategory[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setCategory(c);
                setAsset(MARKETS[c][0]);
              }}
              className={cn(
                "px-3 py-2 text-sm font-medium border rounded transition-colors focus:outline-none",
                category === c 
                  ? "bg-slate-900 border-slate-900 text-white" 
                  : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              )}
            >
              {c}
            </button>
          ))}
        </div>
        
        <select
          value={asset}
          onChange={(e) => setAsset(e.target.value)}
          className="w-full px-3 py-2.5 text-base bg-white border border-slate-200 rounded text-slate-900 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition-all font-mono"
        >
          {MARKETS[category].map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      {/* Trading Mode */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold tracking-widest text-slate-400 uppercase">Trading Mode</h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode('SCALPING MODE')}
            className={cn(
              "flex flex-col items-center justify-center p-4 border rounded transition-colors focus:outline-none",
              mode === 'SCALPING MODE'
                ? "bg-slate-900 border-slate-900 text-white"
                : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            )}
          >
            <Crosshair className="w-5 h-5 mb-2" />
            <span className="text-xs font-bold tracking-wider">SCALP</span>
          </button>
          
          <button
            type="button"
            onClick={() => setMode('SWING MODE')}
            className={cn(
              "flex flex-col items-center justify-center p-4 border rounded transition-colors focus:outline-none",
              mode === 'SWING MODE'
                ? "bg-slate-900 border-slate-900 text-white"
                : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            )}
          >
            <Target className="w-5 h-5 mb-2" />
            <span className="text-xs font-bold tracking-wider">SWING</span>
          </button>
        </div>
      </div>

      {/* Risk Settings */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold tracking-widest text-slate-400 uppercase">Risk Settings</h3>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Account Size ($)</label>
            <input
              type="number"
              value={accountSize}
              onChange={(e) => setAccountSize(e.target.value)}
              min="100"
              max="10000000"
              step="100"
              className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded text-white focus:outline-none focus:border-slate-500"
              placeholder="10000"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Risk Per Trade (%)</label>
            <input
              type="number"
              value={riskPct}
              onChange={(e) => setRiskPct(e.target.value)}
              min="0.1"
              max="5"
              step="0.1"
              className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded text-white focus:outline-none focus:border-slate-500"
              placeholder="1.0"
            />
          </div>
        </div>
        <p className="text-xs text-slate-600">
          Max risk: ${isNaN(parseFloat(accountSize)) ? '100' : (parseFloat(accountSize) * parseFloat(riskPct) / 100).toFixed(2)} per trade
        </p>
      </div>

      {/* Chart Image Upload */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold tracking-widest text-slate-400 uppercase">Chart Input (Optional)</h3>
        {!preview ? (
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-200 border-dashed rounded-lg bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition-colors text-slate-500 hover:border-slate-300">
            <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
              <UploadCloud className="w-6 h-6 mb-2 text-slate-400" />
              <p className="text-sm"><span className="font-semibold">Upload screenshot</span></p>
              <p className="text-xs text-slate-400 mt-1">PNG, JPG to provide chart context</p>
            </div>
            <input 
              ref={fileInputRef}
              type="file" 
              className="hidden" 
              accept="image/*"
              onChange={handleImageUpload}
            />
          </label>
        ) : (
          <div className="relative w-full aspect-video border border-slate-200 rounded-lg bg-slate-50 overflow-hidden group">
            <img src={preview} alt="Chart preview" className="object-cover w-full h-full opacity-90 transition-opacity group-hover:opacity-50" />
            <button
              type="button"
              onClick={handleClearImage}
              className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <div className="bg-white/90 p-2 rounded-full text-slate-900 hover:scale-105 transition-transform shadow-sm">
                <X className="w-5 h-5" />
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="pt-4 mt-auto">
        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex items-center justify-center py-4 bg-slate-900 hover:bg-black text-white rounded-lg font-semibold tracking-widest disabled:opacity-50 disabled:cursor-not-allowed transition-all uppercase text-sm shadow-sm"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
               <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
               Processing...
            </span>
          ) : (
            'Generate Execution Plan'
          )}
        </button>
      </div>

    </form>
  );
}
