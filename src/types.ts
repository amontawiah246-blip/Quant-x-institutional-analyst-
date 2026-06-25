export type Asset = 'BTC/USD' | 'ETH/USD' | 'SOL/USD' | 'EUR/USD' | 'GBP/USD' | 'XAU/USD' | 'SPY' | 'QQQ';

export type SignalVerdict = 'BUY' | 'SELL' | 'WAIT' | 'CAUTION';

export interface ConsensusBreakdown {
  orderBookImbalance: number; // e.g., +24%
  interbankConsensus: string; // "Bullish 62%"
  covarianceAlpha: number; // e.g., 0.85
  sessionPoc: number; // volume-at-price point
  liveRiskStatus: string; // "Nominal" | "Elevated" | "Extreme"
}

export interface TradingSignal {
  id: string;
  timestamp: string;
  asset: Asset;
  price: number;
  change24h: number;
  verdict: SignalVerdict;
  strength: number; // 0 to 100
  timeframe: string; // "M5" | "M15" | "H1" | "H4" | "D1"
  logic: string; // Markdown summary of AI reasoning
  metrics: ConsensusBreakdown;
  userPromptUsed?: string;
}

export interface SignalHistoryItem {
  timestamp: string;
  asset: Asset;
  price: number;
  verdict: SignalVerdict;
  profit?: number; // calculated simulated profit
}
