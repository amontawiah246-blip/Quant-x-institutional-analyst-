import { Asset, AssetWeight, DailyPerformance } from '../types.ts';
import { useState, useEffect } from 'react';
import { Settings2, BarChart3, Save, Check, RefreshCw, Layers } from 'lucide-react';

interface ExtraModulesProps {
  selectedAsset: Asset;
  onWeightsUpdated: () => void;
  weights: AssetWeight[];
  performance: DailyPerformance[];
}

export default function ExtraModules({ 
  selectedAsset, 
  onWeightsUpdated, 
  weights, 
  performance
}: ExtraModulesProps) {
  const [activeTab, setActiveTab] = useState<'weights' | 'performance'>('weights');
  
  // Weights state for editing
  const [currentWeights, setCurrentWeights] = useState<Partial<AssetWeight>>({
    w_structure: 20,
    w_liquidity: 15,
    w_choch: 15,
    w_ob: 10,
    w_fvg: 10,
    w_sd: 10,
    w_pd: 10,
    w_pa: 5,
    w_session: 5,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync selected asset weights when props change
  useEffect(() => {
    const assetWeight = weights.find(w => w.asset === selectedAsset);
    if (assetWeight) {
      setCurrentWeights(assetWeight);
    }
  }, [weights, selectedAsset]);

  const handleWeightChange = (key: keyof AssetWeight, value: number) => {
    setCurrentWeights(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSaveWeights = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const response = await fetch('/api/asset-weights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: selectedAsset,
          ...currentWeights
        })
      });

      const data = await response.json();
      if (data.success) {
        setSaveSuccess(true);
        onWeightsUpdated();
        setTimeout(() => setSaveSuccess(false), 2500);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  // Filter daily performance for selected asset
  const assetPerformance = performance
    .filter(p => p.asset === selectedAsset)
    .slice(0, 5) // Last 5 days
    .reverse();

  // Calculate sum of weights for validation visualizer
  const weightSum = 
    (currentWeights.w_structure || 0) +
    (currentWeights.w_liquidity || 0) +
    (currentWeights.w_choch || 0) +
    (currentWeights.w_ob || 0) +
    (currentWeights.w_fvg || 0) +
    (currentWeights.w_sd || 0) +
    (currentWeights.w_pd || 0) +
    (currentWeights.w_pa || 0) +
    (currentWeights.w_session || 0);

  return (
    <div className="bg-[#13111C]/85 backdrop-blur-md border border-white/8 rounded-[24px] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.3)] flex flex-col gap-4">
      
      {/* Top Tabs Bar */}
      <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
        <div className="flex gap-1.5 bg-[#0B0A11] p-1 rounded-xl border border-white/5">
          <button
            onClick={() => setActiveTab('weights')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
              activeTab === 'weights'
                ? 'bg-gradient-to-r from-[#8A2BE2] to-[#FF4500] text-white shadow-md shadow-purple-900/10'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            CONFLUENCE WEIGHTS
          </button>
          <button
            onClick={() => setActiveTab('performance')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
              activeTab === 'performance'
                ? 'bg-gradient-to-r from-[#8A2BE2] to-[#FF4500] text-white shadow-md shadow-purple-900/10'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            DAILY PERFORMANCE
          </button>
        </div>

        <span className="text-[10px] font-mono text-[#FF6B35] font-bold uppercase">
          {selectedAsset} CONFIG
        </span>
      </div>

      {/* Tab 1: Confluence Weights Config */}
      {activeTab === 'weights' && (
        <div className="flex flex-col gap-4 text-left">
          <p className="text-[11px] text-zinc-400 leading-relaxed font-mono">
            Directly configure the percentage weights for Smart Money Concepts (SMC) triggers used in the decision core algorithm.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Left sliders */}
            <div className="space-y-3 font-mono text-[10px]">
              <div>
                <div className="flex justify-between text-zinc-400 mb-1">
                  <span>Market Structure ({currentWeights.w_structure || 0}%)</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="40"
                  value={currentWeights.w_structure || 0}
                  onChange={(e) => handleWeightChange('w_structure', parseInt(e.target.value))}
                  className="w-full accent-purple-500 bg-[#0B0A11] h-1.5 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-zinc-400 mb-1">
                  <span>Liquidity Sweep ({currentWeights.w_liquidity || 0}%)</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="40"
                  value={currentWeights.w_liquidity || 0}
                  onChange={(e) => handleWeightChange('w_liquidity', parseInt(e.target.value))}
                  className="w-full accent-purple-500 bg-[#0B0A11] h-1.5 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-zinc-400 mb-1">
                  <span>CHoCH (Change of Char) ({currentWeights.w_choch || 0}%)</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="40"
                  value={currentWeights.w_choch || 0}
                  onChange={(e) => handleWeightChange('w_choch', parseInt(e.target.value))}
                  className="w-full accent-purple-500 bg-[#0B0A11] h-1.5 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-zinc-400 mb-1">
                  <span>Order Blocks ({currentWeights.w_ob || 0}%)</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="40"
                  value={currentWeights.w_ob || 0}
                  onChange={(e) => handleWeightChange('w_ob', parseInt(e.target.value))}
                  className="w-full accent-purple-500 bg-[#0B0A11] h-1.5 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-zinc-400 mb-1">
                  <span>Fair Value Gaps (FVG) ({currentWeights.w_fvg || 0}%)</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="40"
                  value={currentWeights.w_fvg || 0}
                  onChange={(e) => handleWeightChange('w_fvg', parseInt(e.target.value))}
                  className="w-full accent-purple-500 bg-[#0B0A11] h-1.5 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            {/* Right sliders */}
            <div className="space-y-3 font-mono text-[10px]">
              <div>
                <div className="flex justify-between text-zinc-400 mb-1">
                  <span>Supply & Demand ({currentWeights.w_sd || 0}%)</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="40"
                  value={currentWeights.w_sd || 0}
                  onChange={(e) => handleWeightChange('w_sd', parseInt(e.target.value))}
                  className="w-full accent-orange-500 bg-[#0B0A11] h-1.5 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-zinc-400 mb-1">
                  <span>Premium / Discount ({currentWeights.w_pd || 0}%)</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="40"
                  value={currentWeights.w_pd || 0}
                  onChange={(e) => handleWeightChange('w_pd', parseInt(e.target.value))}
                  className="w-full accent-orange-500 bg-[#0B0A11] h-1.5 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-zinc-400 mb-1">
                  <span>Price Action / Candlesticks ({currentWeights.w_pa || 0}%)</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={currentWeights.w_pa || 0}
                  onChange={(e) => handleWeightChange('w_pa', parseInt(e.target.value))}
                  className="w-full accent-orange-500 bg-[#0B0A11] h-1.5 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-zinc-400 mb-1">
                  <span>Session Open Spikes ({currentWeights.w_session || 0}%)</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={currentWeights.w_session || 0}
                  onChange={(e) => handleWeightChange('w_session', parseInt(e.target.value))}
                  className="w-full accent-orange-500 bg-[#0B0A11] h-1.5 rounded-lg cursor-pointer"
                />
              </div>

              {/* Total weight sum indicators */}
              <div className="p-3 bg-[#0B0A11] rounded-xl border border-white/5 flex items-center justify-between text-[10px]">
                <span className="text-zinc-500 uppercase flex items-center gap-1">
                  <Layers className="w-3 h-3 text-purple-400" /> Total allocation sum:
                </span>
                <span className={`font-bold ${weightSum === 100 ? 'text-[#39ff14]' : 'text-[#ff073a]'}`}>
                  {weightSum}% {weightSum === 100 ? '(OPTIMIZED)' : '(MUST EQUAL 100%)'}
                </span>
              </div>
            </div>

          </div>

          {/* Save Button */}
          <button
            onClick={handleSaveWeights}
            disabled={isSaving || weightSum !== 100}
            className="w-full py-3 px-4 bg-[#0B0A11] border border-white/10 hover:border-[#FF6B35]/30 rounded-xl text-xs font-bold font-mono tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#13111C]"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-[#FF6B35]" />
                SAVING TO SQLite...
              </>
            ) : saveSuccess ? (
              <>
                <Check className="w-4 h-4 text-[#39ff14] animate-bounce" />
                <span className="text-[#39ff14]">CONFIG SAVED SUCCESSFULLY</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4 text-[#FF6B35]" />
                COMMIT WEIGHT CONFIG
              </>
            )}
          </button>

        </div>
      )}

      {/* Tab 2: Daily Performance Analytics Log */}
      {activeTab === 'performance' && (
        <div className="flex flex-col gap-4 text-left font-mono text-xs">
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            Historical day-by-day record of simulated institutional desk profits and losses mapped using ATR units.
          </p>

          {assetPerformance.length === 0 ? (
            <div className="py-8 text-center text-zinc-600">
              No historical daily performance records in database.
            </div>
          ) : (
            <div className="space-y-3.5">
              {/* Custom responsive SVG Bar chart */}
              <div className="relative w-full h-24 bg-[#0B0A11]/60 border border-white/5 rounded-2xl p-4 flex items-end justify-around gap-2">
                {assetPerformance.map((item) => {
                  const maxVal = Math.max(...assetPerformance.map(p => Math.abs(p.pnl_atr)), 1);
                  const barHeight = Math.min(Math.max((Math.abs(item.pnl_atr) / maxVal) * 50, 8), 50);
                  const isPositive = item.pnl_atr >= 0;

                  return (
                    <div key={item.id} className="flex flex-col items-center gap-1.5 flex-1 max-w-[50px]">
                      <div className="text-[8px] font-bold text-white">${item.pnl_atr}R</div>
                      <div 
                        className={`w-4.5 rounded-t-sm transition-all shadow-[0_0_10px_rgba(138,43,226,0.1)] ${
                          isPositive 
                            ? 'bg-gradient-to-t from-[#8A2BE2] to-[#39ff14]' 
                            : 'bg-gradient-to-t from-[#8A2BE2] to-[#ff073a]'
                        }`}
                        style={{ height: `${barHeight}px` }}
                      />
                      <div className="text-[7px] text-zinc-600 font-bold whitespace-nowrap">
                        {item.date.slice(5)}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Text list of performance history */}
              <div className="space-y-1.5 font-mono text-[10px]">
                {assetPerformance.map((item) => (
                  <div key={item.id} className="p-2 bg-[#0B0A11] border border-white/5 rounded-xl flex items-center justify-between">
                    <span className="text-zinc-500 font-bold">{item.date}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-zinc-400">TRADES: <strong className="text-white">{item.trades}</strong></span>
                      <span className="text-zinc-400">WIN RATE: <strong className="text-[#39ff14]">{(item.win_rate ? item.win_rate * 100 : (item.wins / item.trades) * 100).toFixed(0)}%</strong></span>
                      <span className={`font-extrabold ${item.pnl_atr >= 0 ? 'text-[#39ff14]' : 'text-[#ff073a]'}`}>
                        {item.pnl_atr >= 0 ? '+' : ''}{item.pnl_atr} R
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
