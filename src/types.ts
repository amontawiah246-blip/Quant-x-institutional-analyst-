export type Asset = 'BTC/USD' | 'ETH/USD' | 'SOL/USD' | 'EUR/USD' | 'GBP/USD' | 'XAU/USD' | 'SPY' | 'QQQ';

export type SignalVerdict = 'BUY' | 'SELL' | 'WAIT' | 'CAUTION' | 'EXECUTE' | 'HARD_BLOCK';

export interface SMCSignal {
  id: number;
  asset: Asset;
  mode: string;
  timestamp: string;
  direction: 'LONG' | 'SHORT' | 'WAIT';
  entry_low: number;
  entry_high: number;
  tp1: number;
  tp2: number;
  tp3: number;
  sl: number;
  confluence_score: number;
  htf_trend: string;
  etf_trend: string;
  rsi_htf: number;
  atr: number;
  regime: string;
  session: string;
  outcome?: string;
  outcome_checked_at?: string;
  pnl_atr?: number;
  exit_price?: number;
  bars_to_exit?: number;
  notes?: string;
  verdict: string; // 'EXECUTE' | 'HARD_BLOCK' | 'WAIT'
  current_price_at_signal?: number;
  win_probability_pct?: number;
  expected_value_r?: number;
  hard_block_reason?: string;
  wait_reason?: string;
}

export interface AssetWeight {
  asset: Asset;
  w_structure: number;
  w_liquidity: number;
  w_choch: number;
  w_ob: number;
  w_fvg: number;
  w_sd: number;
  w_pd: number;
  w_pa: number;
  w_session: number;
  total_trades: number;
  win_rate?: number;
  last_updated?: string;
}

export interface DailyPerformance {
  id: number;
  date: string;
  asset: Asset;
  trades: number;
  wins: number;
  losses: number;
  pnl_atr: number;
  win_rate?: number;
}

export interface ActiveThesis {
  id: number;
  asset: Asset;
  mode: string;
  direction: 'LONG' | 'SHORT';
  status: string; // 'ACTIVE' | 'INVALIDATED' | 'COMPLETED'
  created_at: string;
  updated_at: string;
  confluence_score: number;
  htf_trend: string;
  etf_trend: string;
  entry_low: number;
  entry_high: number;
  sl: number;
  tp1: number;
  tp2: number;
  tp3: number;
  invalidation_price: number;
  invalidation_reason: string;
  structural_anchor: string;
  times_confirmed: number;
  invalidated_at?: string;
  invalidated_reason?: string;
  original_entry_low?: number;
  original_entry_high?: number;
  zone_source: string; // 'OB' | 'FVG' | 'S/D'
  zone_refined_count: number;
  closest_approach_price?: number;
  closest_approach_atr?: number;
  closest_approach_at?: string;
  near_miss_count: number;
  last_checked_at?: string;
  last_checked_price?: number;
  locked_win_probability?: number;
  locked_expected_value?: number;
  locked_confluence?: number;
  locked_at?: string;
}

export interface TradingSignal {
  id: string;
  timestamp: string;
  asset: Asset;
  price: number;
  change24h: number;
  verdict: SignalVerdict;
  strength: number; // 0 to 100
  timeframe: string;
  logic: string;
  metrics: {
    orderBookImbalance: number;
    interbankConsensus: string;
    covarianceAlpha: number;
    sessionPoc: number;
    liveRiskStatus: string;
  };
  userPromptUsed?: string;
}

export interface SignalHistoryItem {
  timestamp: string;
  asset: Asset;
  price: number;
  verdict: SignalVerdict;
  profit?: number;
}
