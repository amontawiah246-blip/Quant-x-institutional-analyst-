export type MarketCategory = 'Futures' | 'Crypto' | 'Metals' | 'Forex';

export const MARKETS: Record<MarketCategory, string[]> = {
  Futures: ['US30', 'NAS100', 'STOXX50', 'BOOM1000', 'CRASH1000', 'VOL75'],
  Crypto:  ['BTCUSD', 'ETHUSD', 'SOLUSD', 'BNBUSD'],
  Metals:  ['XAUUSD', 'XAGUSD', 'USOIL', 'XNGUSD'],
  Forex:   ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD'],
};

export const DERIV_SYMBOLS: Record<string, string> = {
  EURUSD: 'frxEURUSD', GBPUSD: 'frxGBPUSD', USDJPY: 'frxUSDJPY',
  USDCHF: 'frxUSDCHF', AUDUSD: 'frxAUDUSD', USDCAD: 'frxUSDCAD',
  XAUUSD: 'frxXAUUSD', XAGUSD: 'frxXAGUSD', USOIL: 'frxUSOIL', XNGUSD: 'frxXNGUSD',
  BTCUSD: 'cryBTCUSD', ETHUSD: 'cryETHUSD', SOLUSD: 'crySOLUSD', BNBUSD: 'cryBNBUSD',
  BOOM1000: 'BOOM1000', CRASH1000: 'CRASH1000', VOL75: 'R_75',
  US30: 'US30', NAS100: 'NAS100', STOXX50: 'STOXX50'
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
