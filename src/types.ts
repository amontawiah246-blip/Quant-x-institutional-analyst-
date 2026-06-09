export type MarketCategory = 'Forex' | 'Metals' | 'Crypto' | 'Indices';

export const MARKETS: Record<MarketCategory, string[]> = {
  Forex:   ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD'],
  Metals:  ['XAUUSD', 'XAGUSD'],
  Crypto:  ['BTCUSD', 'ETHUSD', 'SOLUSD'],
  Indices: ['BOOM1000', 'CRASH1000', 'VOL75', 'VOL100'],
};

// Deriv WebSocket symbol map — used server-side
// Kept here for reference and future client-side use
export const DERIV_SYMBOLS: Record<string, string> = {
  EURUSD: 'frxEURUSD', GBPUSD: 'frxGBPUSD', USDJPY: 'frxUSDJPY',
  USDCHF: 'frxUSDCHF', AUDUSD: 'frxAUDUSD', USDCAD: 'frxUSDCAD',
  NZDUSD: 'frxNZDUSD',
  XAUUSD: 'frxXAUUSD', XAGUSD: 'frxXAGUSD',
  BTCUSD: 'cryBTCUSD', ETHUSD: 'cryETHUSD', SOLUSD: 'crySOLUSD',
  BOOM1000: 'BOOM1000', CRASH1000: 'CRASH1000', VOL75: 'R_75', VOL100: 'R_100',
};

export type TradingMode = 'SCALPING MODE' | 'SWING MODE';

export interface AnalysisRequest {
  asset: string;
  mode:  TradingMode;
  image?: string;
}

export interface CandleData {
  epoch: number;
  open:  number;
  high:  number;
  low:   number;
  close: number;
}
