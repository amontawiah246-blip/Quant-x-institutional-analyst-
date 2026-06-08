export type MarketCategory = 'Forex' | 'Metals' | 'Crypto' | 'Indices';

export const MARKETS: Record<MarketCategory, string[]> = {
  Forex: ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD'],
  Metals: ['XAUUSD', 'XAGUSD'],
  Crypto: ['BTCUSD', 'ETHUSD', 'SOLUSD'],
  Indices: ['US30', 'NAS100', 'SPX500']
};

export type TradingMode = 'SCALPING MODE' | 'SWING MODE';

export interface AnalysisRequest {
  asset: string;
  mode: TradingMode;
  image?: string; // base64 string
}
