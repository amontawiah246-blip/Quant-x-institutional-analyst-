import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import WebSocket from 'ws';
import { spawn } from 'child_process';

// ─── Deriv Symbol Map ─────────────────────────────────────────────────────────
const DERIV_SYMBOLS: Record<string, string> = {
  EURUSD: 'frxEURUSD', GBPUSD: 'frxGBPUSD', USDJPY: 'frxUSDJPY',
  USDCHF: 'frxUSDCHF', AUDUSD: 'frxAUDUSD', USDCAD: 'frxUSDCAD',
  NZDUSD: 'frxNZDUSD',
  XAUUSD: 'frxXAUUSD', XAGUSD: 'frxXAGUSD',
  BTCUSD: 'cryBTCUSD', ETHUSD: 'cryETHUSD', SOLUSD: 'crySOLUSD',
  BOOM1000: 'BOOM1000', CRASH1000: 'CRASH1000',
  VOL75: 'R_75', VOL100: 'R_100',
};

const TIMEFRAMES: Record<string, { granularity: number; label: string }[]> = {
  'SCALPING MODE': [
    { granularity: 14400, label: '4H' },
    { granularity: 3600,  label: '1H' },
    { granularity: 900,   label: '15M' },
    { granularity: 300,   label: '5M' },
  ],
  'SWING MODE': [
    { granularity: 86400, label: 'D1' },
    { granularity: 14400, label: '4H' },
    { granularity: 3600,  label: '1H' },
    { granularity: 900,   label: '15M' },
  ],
};

interface Candle {
  epoch: number;
  open: number;
  high: number;
  low: number;
  close: number;
  date?: string;
}

// ─── Deriv WebSocket fetcher ──────────────────────────────────────────────────
function fetchDerivCandles(symbol: string, granularity: number, count = 500): Promise<Candle[]> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
    let buffer = '';
    const timeout = setTimeout(() => { ws.terminate(); reject(new Error(`Timeout ${symbol}@${granularity}s`)); }, 15000);
    ws.on('open', () => {
      ws.send(JSON.stringify({ ticks_history: symbol, granularity, count, end: 'latest', style: 'candles', adjust_start_time: 1 }));
    });
    ws.on('message', (raw: Buffer | string) => {
      buffer += raw.toString();
      try {
        const data = JSON.parse(buffer);
        clearTimeout(timeout);
        ws.close();
        if (data.error) return reject(new Error(data.error.message));
        resolve((data.candles || []).map((c: any) => ({
          epoch: c.epoch, open: parseFloat(c.open), high: parseFloat(c.high),
          low: parseFloat(c.low), close: parseFloat(c.close),
          date: new Date(c.epoch * 1000).toISOString().slice(0, 16),
        })));
      } catch { /* wait for more chunks */ }
    });
    ws.on('error', (err) => { clearTimeout(timeout); reject(err); });
  });
}

// ─── Python engine caller ─────────────────────────────────────────────────────
function runPythonEngine(candlesByTF: Record<string, Candle[]>): Promise<any> {
  return new Promise((resolve) => {
    const payload    = JSON.stringify({ candles: candlesByTF });
    const enginePath = path.join(process.cwd(), 'engine.py');
    const pythonCmd  = process.platform === 'win32' ? 'python' : 'python3';
    const proc       = spawn(pythonCmd, [enginePath], { timeout: 30000 });
    let stdout = '', stderr = '';
    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    proc.on('close', (code: number) => {
      if (code !== 0 || !stdout.trim()) { console.log('Python engine:', stderr || 'no output'); return resolve(null); }
      try { resolve(JSON.parse(stdout)); } catch { console.log('Python JSON parse error'); resolve(null); }
    });
    proc.on('error', (err: Error) => { console.log('Python unavailable:', err.message); resolve(null); });
    proc.stdin.on('error', (err) => { console.log('Python stdin error:', err.message); resolve(null); });
    try { proc.stdin.write(payload); proc.stdin.end(); }
    catch (e: any) { console.log('Python stdin write error:', e.message); resolve(null); }
  });
}

// ─── Format engine results ────────────────────────────────────────────────────
function formatEngineResults(engineData: any): string {
  if (!engineData || engineData.error) return '\n# ENGINE RESULTS: Not available — AI will work from raw OHLCV only.\n';
  const summary = engineData._summary || {};
  let block = `\n# PRE-CALCULATED ENGINE RESULTS\n`;
  block += `HTF: ${summary.htf||'N/A'} | ETF: ${summary.etf||'N/A'} | HTF Trend: ${summary.htf_trend||'N/A'} | HTF EMA Trend: ${summary.htf_ema_trend||'N/A'}\n`;
  block += `Session: ${summary.session?.session||'N/A'} | Session Score: ${summary.session?.score??'N/A'}/5\n`;
  block += `Current Price: ${summary.asset_price||'N/A'}\n`;
  if (summary.ml_score) {
    block += `ML Score: ${summary.ml_score.score}/100 | Method: ${summary.ml_score.method} | HTF Filter: ${summary.ml_score.htf_filter_applied ? 'APPLIED' : 'NOT APPLIED'}\n`;
  }
  const tfs = Object.keys(engineData).filter(k => k !== '_summary');
  for (const tf of tfs) {
    const d = engineData[tf];
    block += `\n## ${tf} ENGINE OUTPUT\n`;
    block += `ATR(14): ${d.atr} | Trend: ${d.trend} | EMA Trend: ${d.ema_trend||'N/A'} | Price: ${d.current_price}\n`;
    if (d.indicators) {
      const ind = d.indicators;
      block += `RSI(14): ${ind.rsi?.value??'N/A'} [${ind.rsi?.zone??'N/A'}] | MACD Direction: ${ind.macd?.direction??'N/A'}\n`;
      block += `EMA20: ${ind.ema_20?.value??'N/A'} | EMA50: ${ind.ema_50?.value??'N/A'} | EMA200: ${ind.ema_200?.value??'N/A'}\n`;
      block += `Bollinger: Upper=${ind.bollinger?.upper??'N/A'} Mid=${ind.bollinger?.middle??'N/A'} Lower=${ind.bollinger?.lower??'N/A'} | Position: ${ind.bollinger?.position??'N/A'}% | Squeeze: ${ind.bollinger?.squeeze??false}\n`;
      if (ind.vwap) block += `VWAP: ${ind.vwap}\n`;
    }
    if (d.bos_choch?.length) {
      block += `\nSTRUCTURE EVENTS:\n`;
      d.bos_choch.slice(-5).forEach((e: any) => block += `  ${e.type} @ ${e.price} on ${e.date}\n`);
    }
    if (d.swing_highs?.length || d.swing_lows?.length) {
      block += `\nSWING POINTS:\n`;
      d.swing_highs?.slice(-5).forEach((s: any) => block += `  SH @ ${s.price} on ${s.date}\n`);
      d.swing_lows?.slice(-5).forEach((s: any)  => block += `  SL @ ${s.price} on ${s.date}\n`);
    }
    if (d.fvg_fresh?.length) {
      block += `\nFRESH FVGs:\n`;
      d.fvg_fresh.slice(-10).forEach((f: any) => block += `  ${f.direction}FVG ${f.bottom}-${f.top} formed ${f.date} | ATR ratio: ${f.atr_ratio}x\n`);
    }
    if (d.fvg_mitigated?.length) {
      block += `\nMITIGATED FVGs (already tapped):\n`;
      d.fvg_mitigated.slice(-10).forEach((f: any) => block += `  ${f.direction}FVG ${f.bottom}-${f.top} formed ${f.date} — ALREADY TAPPED AND FILLED\n`);
    }
    if (d.ob_fresh?.length) {
      block += `\nFRESH ORDER BLOCKS:\n`;
      d.ob_fresh.slice(-10).forEach((o: any) => block += `  ${o.direction}OB ${o.low}-${o.high} formed ${o.date} | Impulse: ${o.atr_ratio}x ATR\n`);
    }
    if (d.ob_mitigated?.length) {
      block += `\nMITIGATED ORDER BLOCKS (already tested):\n`;
      d.ob_mitigated.slice(-10).forEach((o: any) => block += `  ${o.direction}OB ${o.low}-${o.high} formed ${o.date} — PRICE ALREADY TAPPED THIS OB\n`);
    }
    if (d.liquidity) {
      block += `\nLIQUIDITY:\n`;
      d.liquidity.bsl?.forEach((b: any) => block += `  BSL @ ${b.price} — ${b.status} (${b.distance_pct}% away)\n`);
      d.liquidity.ssl?.forEach((s: any) => block += `  SSL @ ${s.price} — ${s.status} (${s.distance_pct}% away)\n`);
      d.liquidity.equal_highs?.forEach((e: any) => block += `  EQH ~ ${e.avg}\n`);
      d.liquidity.equal_lows?.forEach((e: any)  => block += `  EQL ~ ${e.avg}\n`);
    }
    if (d.premium_discount) {
      const pd = d.premium_discount;
      block += `\nPREMIUM/DISCOUNT: ${pd.status} @ ${pd.percentage}% | Range ${pd.range_low}-${pd.range_high} | EQ: ${pd.equilibrium}\n`;
    }
    if (d.backtest) {
      const bt = d.backtest;
      if (bt.status === 'COMPLETE') {
        block += `\nBACKTEST (${bt.trades} trades): Win Rate=${bt.win_rate_pct}% | Profit Factor=${bt.profit_factor} | Expectancy=${bt.expectancy_atr} ATR | Verdict: ${bt.verdict}\n`;
      }
    }
    block += '\n';
  }
  return block;
}

// ─── News scraper ─────────────────────────────────────────────────────────────
const HIGH_IMPACT_EVENTS = [
  'CPI', 'NFP', 'nonfarm payroll', 'FOMC', 'interest rate decision',
  'GDP', 'PPI', 'retail sales', 'unemployment', 'Fed meeting',
  'ECB decision', 'Bank of Japan', 'inflation data', 'Fed speakers',
  'Powell', 'rate hike', 'rate cut',
];

const ASSET_KEYWORDS: Record<string, string[]> = {
  XAUUSD: ['gold', 'XAU', 'bullion', 'precious metal'],
  XAGUSD: ['silver', 'XAG'],
  EURUSD: ['euro', 'EUR', 'ECB', 'eurozone'],
  GBPUSD: ['pound', 'GBP', 'Bank of England', 'sterling'],
  USDJPY: ['yen', 'JPY', 'Bank of Japan', 'BOJ'],
  USDCHF: ['franc', 'CHF', 'Swiss'],
  AUDUSD: ['aussie', 'AUD', 'RBA'],
  USDCAD: ['loonie', 'CAD', 'oil', 'Canada'],
  NZDUSD: ['kiwi', 'NZD', 'RBNZ'],
  BTCUSD: ['bitcoin', 'BTC', 'crypto'],
  ETHUSD: ['ethereum', 'ETH', 'crypto'],
  SOLUSD: ['solana', 'SOL', 'crypto'],
  BOOM1000: ['boom', 'volatility', 'synthetic'],
  CRASH1000: ['crash', 'volatility', 'synthetic'],
  VOL75: ['volatility', 'vol75', 'synthetic'],
  VOL100: ['volatility', 'vol100', 'synthetic'],
};

function getNewsSources(asset: string): { url: string; name: string }[] {
  const isCrypto = ['BTCUSD', 'ETHUSD', 'SOLUSD'].includes(asset);
  const isGold   = ['XAUUSD', 'XAGUSD'].includes(asset);
  const base = [
    { url: 'https://www.financemagnates.com/trending/', name: 'Finance Magnates' },
    { url: 'https://www.forexlive.com/',                name: 'ForexLive' },
    { url: 'https://www.dailyfx.com/news',              name: 'DailyFX' },
  ];
  if (isGold) {
    base.push({ url: 'https://tradingeconomics.com/commodity/gold',     name: 'Trading Economics' });
    base.push({ url: 'https://www.investing.com/news/commodities-news', name: 'Investing.com' });
  } else if (isCrypto) {
    base.push({ url: 'https://coindesk.com/markets/',  name: 'CoinDesk' });
    base.push({ url: 'https://cointelegraph.com/',     name: 'CoinTelegraph' });
  } else {
    base.push({ url: 'https://www.investing.com/news/forex-news',  name: 'Investing.com Forex' });
    base.push({ url: 'https://tradingeconomics.com/calendar',      name: 'Economic Calendar' });
  }
  return base;
}

interface NewsResult { source: string; headlines: string[]; hasHighImpactEvent: boolean; eventWarnings: string[]; }

async function scrapeNews(asset: string): Promise<NewsResult[]> {
  const keywords = ASSET_KEYWORDS[asset] || [asset.toLowerCase()];
  const sources  = getNewsSources(asset);
  const results: NewsResult[] = [];
  await Promise.allSettled(sources.map(async (source) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(source.url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; research-bot/1.0)', 'Accept': 'text/html' },
      });
      clearTimeout(timeout);
      if (!response.ok) return;
      const html = await response.text();
      const text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/\s{2,}/g, ' ').trim();
      const sentences = text.split(/[.\n]/).map(s => s.trim()).filter(s => s.length > 40 && s.length < 300);
      const relevant  = sentences.filter(s => keywords.some(kw => s.toLowerCase().includes(kw.toLowerCase()))).slice(0, 8);
      if (relevant.length === 0) return;
      const eventWarnings: string[] = [];
      const allText = relevant.join(' ').toLowerCase();
      for (const event of HIGH_IMPACT_EVENTS) {
        if (allText.includes(event.toLowerCase())) eventWarnings.push(event);
      }
      results.push({ source: source.name, headlines: relevant, hasHighImpactEvent: eventWarnings.length > 0, eventWarnings });
    } catch { /* silently skip */ }
  }));
  return results;
}

function formatNewsBlock(newsResults: NewsResult[], asset: string): string {
  if (newsResults.length === 0) return '\n# MACRO NEWS: No sources reachable. Analysis based on price data only.\n';
  const allWarnings   = [...new Set(newsResults.flatMap(r => r.eventWarnings))];
  const hasHighImpact = newsResults.some(r => r.hasHighImpactEvent);
  let block = `\n# MACRO & FUNDAMENTAL NEWS FOR ${asset}\nScraped: ${new Date().toISOString()}\n`;
  if (hasHighImpact) {
    block += `\n⚠️ HIGH-IMPACT EVENT DETECTED: ${allWarnings.join(', ')}\n`;
    block += `TRADE PAUSE RECOMMENDATION: Do not enter new positions until event resolves.\n`;
  }
  for (const r of newsResults) {
    block += `\n## ${r.source}\n`;
    r.headlines.forEach((h, i) => { block += `${i + 1}. ${h}\n`; });
  }
  block += '\nEND OF NEWS BLOCK\n';
  return block;
}

// ─── System prompt ────────────────────────────────────────────────────────────
function buildSystemPrompt(asset: string, mode: string): string {
  return `
You are QUANT-X, an institutional market analysis engine. You receive:
1. Raw OHLCV candle data from Deriv live WebSocket feed
2. Pre-calculated engine results: BOS, CHoCH, FVG, OB, Liquidity, P/D, RSI, EMA, MACD, Bollinger, Backtest
3. Live macro news from financial websites

YOUR ROLE:
- Use the pre-calculated engine results for all price levels. Do not invent levels.
- Use the news to explain WHY price is moving.
- Apply confluence scoring and produce the execution plan.
- Most importantly: ASSESS LEVEL STATUS before telling the user to wait for price to tap a level.

═══════════════════════════════════════════════════════
LEVEL TAP DETECTION — CRITICAL RULES
═══════════════════════════════════════════════════════

Before suggesting any "wait for price to tap X level" in the Execution Plan, you MUST first check:

STEP 1 — HAS PRICE ALREADY REACHED THE LEVEL?
Check if current price is inside or has recently closed inside the level range (FVG, OB, S/D zone).
- If current price IS inside the level range: the level has been TAPPED. Do not say "wait for tap".
- If current price has already passed through the level: the level is MITIGATED. Do not reference it.
- Only say "wait for price to tap X" if price has NOT yet reached the level.

STEP 2 — AFTER A LEVEL IS TAPPED, ASSESS THE REACTION:
A level being tapped does NOT always mean price will immediately continue. You must assess:

SINGLE TAP + STRONG REACTION (most reliable):
- Price enters the level and immediately closes back out with a strong candle
- Volume proxy: the reaction candle has a body > 0.5x ATR
- This is the highest-probability setup
- Action: Entry is valid. State the confirmation candle details.

SINGLE TAP + WEAK REACTION (caution):
- Price enters the level and closes weakly (small body, long wick inside the zone)
- Action: Wait for a follow-through candle. State "Level tapped, awaiting confirmation candle."

MULTIPLE TAPS ON SAME LEVEL (OB specific — very important):
- Order Blocks can be tested 2-3 times before price continues. This is NORMAL institutional behaviour.
- First tap: price enters OB and reacts — valid entry zone
- Second tap: price returns to OB — still valid if OB not fully mitigated (price has not closed beyond 50% of OB body)
- Third tap: OB is weakening — reduce position size, tighter SL
- Fourth tap or price closes fully through OB body: OB is BROKEN, do not use it

FVG BEHAVIOUR:
- FVGs are typically filled once and then act as support/resistance
- After a FVG is filled (price closes inside it): the FVG is MITIGATED
- A mitigated FVG can still act as a level but with reduced probability
- The engine marks FVGs as FRESH or MITIGATED — use this status

LEVEL HIERARCHY (when multiple levels overlap):
- OB + FVG overlap = highest probability (both provide confluence)
- OB alone = second priority  
- FVG alone = third priority
- S/D zone alone = fourth priority

WHAT TO SAY IN EXECUTION PLAN:
- If level is NOT yet tapped: "Wait for price to tap [level] at [price range]"
- If level IS tapped with strong reaction: "Level tapped. Entry valid on confirmation. [describe the candle]"
- If level IS tapped but weak reaction: "Level tapped at [price]. Awaiting confirmation candle. Do not enter yet."
- If level was tapped and price reversed away: "Level was tapped and rejected. Monitor for re-test or next level."
- If level was tapped multiple times: "OB at [price] has been tested [n] times. [Still valid / Weakening / Broken] based on mitigation status."
- NEVER repeat the same "wait for tap" instruction if the engine shows the level is already MITIGATED.

═══════════════════════════════════════════════════════
TA INDICATOR INTERPRETATION
═══════════════════════════════════════════════════════

RSI Rules:
- RSI > 70 = OVERBOUGHT — do not enter longs, high probability of reversal
- RSI < 30 = OVERSOLD — do not enter shorts, high probability of reversal
- RSI divergence: if price makes new high but RSI makes lower high = bearish divergence (weakness)
- RSI divergence: if price makes new low but RSI makes higher low = bullish divergence (strength)
- Always note RSI zone when scoring confluence

EMA Stack Rules:
- EMA20 > EMA50 > EMA200 = STRONG BULLISH trend — only take long setups
- EMA20 < EMA50 < EMA200 = STRONG BEARISH trend — only take short setups
- Mixed EMA stack = ranging/transitioning — reduce position size

Bollinger Band Rules:
- Squeeze (width < 2%) = consolidation before breakout — wait for direction
- Price at upper band = overextended, potential reversal
- Price at lower band = overextended, potential reversal
- Expansion (width > 5%) = strong trend in progress

MACD Rules:
- MACD histogram increasing above zero = bullish momentum building
- MACD histogram decreasing below zero = bearish momentum building
- MACD crossover above signal = potential bullish entry
- MACD crossover below signal = potential bearish entry

Backtest Verdict:
- EDGE CONFIRMED (win rate >= 45%, expectancy > 0.2 ATR) = historical edge exists on this asset
- MARGINAL EDGE = use reduced position size
- NO EDGE DETECTED = increase confluence requirements before entering

═══════════════════════════════════════════════════════
CONFLUENCE SCORING — SHOW WORKING EXACTLY LIKE THIS
═══════════════════════════════════════════════════════

  Structure alignment (HTF BOS direction = trade direction): [0 or 20]
  Liquidity target present and logical: [0 or 15]
  HTF trend confirmed on ETF via CHoCH: [0 or 15]
  Fresh Order Block at entry zone: [0 or 10]
  Fresh FVG at entry zone: [0 or 10]
  S/D zone overlaps with OB: [0 or 10]
  Price in Premium/Discount alignment: [0 or 10]
  Price action confirmation candle: [0 or 5]
  Session score (from engine): [0 or 5]
  SUBTOTAL: [sum]
  HTF Hard Filter: If HTF trend != trade direction -> cap at 40. Applied: [YES/NO]
  FINAL SCORE: [n]/100

Each component is binary. Full points or zero. No halves.
Grade: A+ = 90-100 | A = 80-89 | B = 70-79 | C = 60-69 | REJECT = below 60

SESSION RULES:
London 07:00-11:00 UTC = 5pts | London/NY overlap 12:00-15:00 UTC = 5pts
New York 15:00-20:00 UTC = 5pts | Asian 00:00-06:00 UTC = 0pts (forex)
Crypto and synthetics = 5pts always

NEWS RULES:
- Must explain WHY price is moving using the news.
- If HIGH-IMPACT EVENT detected: Execution Plan MUST include trade pause warning.

═══════════════════════════════════════════════════════
OUTPUT FORMAT — MANDATORY
═══════════════════════════════════════════════════════

## MARKET SUMMARY
- **Asset:** ${asset}
- **Mode:** ${mode}
- **Timestamp:** [from engine]
- **Current Price:** [from engine]
- **HTF Bias:** [Strong Bullish / Bullish / Neutral / Bearish / Strong Bearish]
- **EMA Trend:** [from engine ema_trend]
- **Market Regime:** [Trending / Ranging / Expansion / Accumulation / Distribution]
- **P/D Position:** [from engine] — [exact %]
- **RSI:** [value] [zone]
- **Backtest Edge:** [EDGE CONFIRMED / MARGINAL / NO EDGE / N/A]
- **Confluence Score:** [n]/100
- **Trade Grade:** [A+ / A / B / C / REJECTED]

## MACRO CONTEXT
[2-3 sentences. What macro events are driving price. High-impact event warning if applicable.]

## STRUCTURE ANALYSIS
[Every BOS and CHoCH from engine across all timeframes. HTF first, then ETF. Minimum 3 events.]

## LIQUIDITY MAP
[BSL and SSL levels from engine. Resting vs swept. Distance from price.]

## KEY LEVELS — STATUS ASSESSMENT
[For each fresh OB, FVG, and S/D zone from engine, state:]
- Level type, price range, formation date
- STATUS: FRESH / TAPPED — awaiting confirmation / TAPPED — reacted (n touches) / MITIGATED
- Notes on multiple test behaviour if applicable

## CONFLUENCE SCORECARD
[Full breakdown as specified above]

## MARKET NARRATIVE
[3-5 sentences: price structure + indicator alignment + macro reason combined]

## EXECUTION PLAN
- **Direction:** [Bullish / Bearish / NEUTRAL — NO TRADE]
- **Level Status:** [FRESH — waiting for tap / TAPPED — reacting / TAPPED — multiple tests, n touches]
- **Wait Condition:** [ONLY if level not yet tapped: "Wait for price to reach [level]"] OR [If tapped: "Level reached. Wait for [confirmation candle type] to close."] OR [If reacted: "Entry valid now. Confirmation candle seen at [price]."]
- **Entry Zone:** [Exact prices from engine]
- **Invalidation:** [Exact price from engine]
- **Target 1 (TP1):** [Next SSL or BSL]
- **Target 2 (TP2):** [Next structural level]
- **Target 3 (TP3):** [HTF target]
- **Estimated R:R:** [ratio]
- **News Warning:** [TRADE PAUSE — event pending / CLEAR]
- **Backtest Note:** [From backtest results if available]

If score below 60 or HTF hard filter triggered:
# ⛔ NO TRADE SETUP FOUND
**Score:** [n]/100
**Reason:**
1. [Structural reason]
2. [Level status reason]
3. [Macro/news reason]
4. [Session or indicator reason]
5. [What must change for a valid setup]

INTEGRITY RULES:
- Every price from engine results or OHLCV data. Never invented.
- Never say "wait for tap" on a level the engine has already marked MITIGATED.
- Every macro statement from news block only.
- If engine returned null: write INSUFFICIENT DATA.
- Temperature 0.1. Deterministic. Precise.
`.trim();
}

// ─── Rule-based fallback (when both Gemini AND GPT fail) ──────────────────────
function generateRuleBasedSummary(asset: string, mode: string, engineData: any): string {
  // FIX: was using undefined `data` variable — now correctly uses engineData parameter
  if (!engineData || engineData.error) {
    return `## ⚠️ FULL FALLBACK — NO ENGINE DATA\n\nBoth AI models are unavailable and the Python engine returned no data.\n\nPlease try again in a few minutes.`;
  }

  const summary  = engineData._summary || {};
  const mlScore  = summary.ml_score?.score ?? 'N/A';
  const method   = summary.ml_score?.method ?? 'N/A';
  const htfTrend = summary.htf_trend ?? 'N/A';
  const price    = summary.asset_price ?? 'N/A';
  const session  = summary.session?.session ?? 'N/A';
  const verdict  = typeof mlScore === 'number'
    ? (mlScore >= 60 ? '🟢 POTENTIAL SETUP — review levels manually' : mlScore >= 40 ? '🟡 MARGINAL — low confidence' : '🔴 REJECTED — insufficient confluence')
    : 'N/A';

  const htfData = engineData[summary.htf] || {};
  const etfData = engineData[summary.etf] || {};
  const pd      = etfData.premium_discount || {};
  const bt      = htfData.backtest || {};

  let levelSummary = '';
  if (etfData.ob_fresh?.length) {
    etfData.ob_fresh.forEach((o: any) => {
      levelSummary += `- Fresh ${o.direction}OB: ${o.low}–${o.high} (${o.date})\n`;
    });
  }
  if (etfData.fvg_fresh?.length) {
    etfData.fvg_fresh.forEach((f: any) => {
      levelSummary += `- Fresh ${f.direction}FVG: ${f.bottom}–${f.top} (${f.date})\n`;
    });
  }

  return `## MARKET SUMMARY (RULE-BASED ENGINE — AI MODELS UNAVAILABLE)
- **Asset:** ${asset}
- **Mode:** ${mode}
- **Timestamp:** ${new Date().toISOString()}
- **Current Price:** ${price}
- **HTF Bias:** ${htfTrend}
- **EMA Trend:** ${summary.htf_ema_trend ?? 'N/A'}
- **P/D Position:** ${pd.status ?? 'N/A'} @ ${pd.percentage ?? 'N/A'}%
- **Session:** ${session}
- **ML Score:** ${mlScore}/100 (${method})
- **Verdict:** ${verdict}

---

## ⚠️ SYSTEM NOTIFICATION
Both Gemini and the GPT-4o fallback are currently unavailable (rate limit or quota exceeded).
The deterministic Python engine has run successfully and calculated all levels below.
To restore full AI analysis, wait a few minutes and try again, or check your API keys.

---

## CALCULATED LEVELS (from Python engine)

### Structure
- HTF Trend: ${htfTrend}
- ETF Trend: ${etfData.trend ?? 'N/A'}

### Fresh Levels
${levelSummary || '- No fresh levels found on ETF\n'}

### Liquidity
${etfData.liquidity?.bsl?.slice(0,3).map((b: any) => `- BSL @ ${b.price} (${b.distance_pct}% away)`).join('\n') || '- No BSL data'}
${etfData.liquidity?.ssl?.slice(0,3).map((s: any) => `- SSL @ ${s.price} (${s.distance_pct}% away)`).join('\n') || '- No SSL data'}

### Backtest
${bt.status === 'COMPLETE' ? `- Win Rate: ${bt.win_rate_pct}% | Profit Factor: ${bt.profit_factor} | Verdict: ${bt.verdict}` : '- No backtest data'}

---

**To get the full AI narrative and execution plan, please try again in 2-3 minutes.**`;
}

// ─── Express server ───────────────────────────────────────────────────────────
async function startServer() {
  const app  = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  app.post('/api/analyze', async (req, res) => {
    try {
      const { asset, mode, image } = req.body;

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not configured.' });
      }

      const derivSymbol = DERIV_SYMBOLS[asset];
      if (!derivSymbol) {
        return res.status(400).json({ error: `No Deriv symbol mapping for: ${asset}` });
      }

      // ── 1. Fetch live candles ─────────────────────────────────────────────
      const timeframes = TIMEFRAMES[mode] || TIMEFRAMES['SCALPING MODE'];
      const candlesByTF: Record<string, Candle[]> = {};
      let rawCandleBlock = `# LIVE OHLCV DATA — ${asset}\nFetched: ${new Date().toISOString()}\n`;

      const candleResults = await Promise.allSettled(
        timeframes.map(tf => fetchDerivCandles(derivSymbol, tf.granularity, 500))
      );

      for (let i = 0; i < timeframes.length; i++) {
        const tf = timeframes[i];
        const result = candleResults[i];
        if (result.status === 'fulfilled' && result.value.length > 0) {
          candlesByTF[tf.label] = result.value;
          const last   = result.value[result.value.length - 1];
          const oldest = result.value[0];
          rawCandleBlock += `\n${tf.label}: ${result.value.length} candles | ${oldest.date} to ${last.date} | Last close: ${last.close}\n`;
          const rows = result.value.slice(-200).map(c => `${c.date},${c.open},${c.high},${c.low},${c.close}`);
          rawCandleBlock += `time,open,high,low,close\n${rows.join('\n')}\n`;
        } else {
          rawCandleBlock += `\n${tf.label}: FETCH FAILED\n`;
        }
      }

      // ── 2. Run Python engine ──────────────────────────────────────────────
      const engineData  = await runPythonEngine(candlesByTF);
      const engineBlock = formatEngineResults(engineData);

      // ── 3. Scrape news ────────────────────────────────────────────────────
      const newsResults        = await scrapeNews(asset);
      const newsBlock          = formatNewsBlock(newsResults, asset);
      const hasHighImpactEvent = newsResults.some(r => r.hasHighImpactEvent);

      // ── 4. Build prompt ───────────────────────────────────────────────────
      const userPrompt = [
        rawCandleBlock,
        engineBlock,
        newsBlock,
        `Perform a complete institutional analysis for ${asset} in ${mode}.`,
        `IMPORTANT: Before writing any "wait for price to tap" instruction, check if the level is already marked MITIGATED in the engine results above. If it is mitigated, do NOT tell the user to wait for it — find the next fresh level instead.`,
        `Use the news to explain WHY price is moving.`,
        hasHighImpactEvent
          ? `⚠️ HIGH-IMPACT EVENT IN NEWS. Execution Plan MUST include trade pause warning.`
          : `No high-impact events detected.`,
      ].join('\n\n');

      const promptParts: any[] = [{ text: userPrompt }];
      if (image) {
        promptParts.push({
          inlineData: {
            data: image.split(',')[1] || image.replace(/^data:image\/\w+;base64,/, ''),
            mimeType: 'image/jpeg',
          }
        });
        promptParts.push({ text: 'Chart image provided. Cross-reference visual structure with engine results. If you can see price has already tapped a level on the chart, note that in the Level Status field.' });
      }

      // ── 5. Call Gemini with retry ─────────────────────────────────────────
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      let responseText = '';
      let aiUsed = 'none';

      try {
        let response;
        try {
          response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: promptParts,
            config: { systemInstruction: buildSystemPrompt(asset, mode), temperature: 0.1 }
          });
        } catch (initialErr: any) {
          const msg = initialErr.message || '';
          if (msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('429') || msg.includes('overloaded')) {
            console.log('Gemini overloaded, retrying in 4s...');
            await new Promise(r => setTimeout(r, 4000));
            response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: promptParts,
              config: { systemInstruction: buildSystemPrompt(asset, mode), temperature: 0.1 }
            });
          } else {
            throw initialErr;
          }
        }
        responseText = response.text || '';
        aiUsed = 'gemini';

      } catch (geminiError: any) {
        console.log('Gemini failed:', geminiError.message);

        // ── 6. GPT-4o fallback ────────────────────────────────────────────
        if (process.env.GITHUB_TOKEN) {
          console.log('Attempting GPT-4o fallback via GitHub token...');
          try {
            const OpenAI = (await import('openai')).default;
            const client = new OpenAI({
              baseURL: 'https://models.inference.ai.azure.com',
              apiKey: process.env.GITHUB_TOKEN,
            });

            // GPT-4o gets same full prompt — same system prompt, same data, same instructions
            // Trim OHLCV to last 10 candles per TF to fit GPT context window
            let gptCandleBlock = `# LIVE OHLCV DATA — ${asset}\nFetched: ${new Date().toISOString()}\n`;
            for (const tf of timeframes) {
              const candles = candlesByTF[tf.label];
              if (candles?.length > 0) {
                const last = candles[candles.length - 1];
                gptCandleBlock += `\n${tf.label}: Last close: ${last.close}\n`;
                const rows = candles.slice(-10).map(c => `${c.date},${c.open},${c.high},${c.low},${c.close}`);
                gptCandleBlock += `time,open,high,low,close\n${rows.join('\n')}\n`;
              }
            }

            const gptPrompt = [
              gptCandleBlock,
              engineBlock,       // full engine results — GPT uses same calculated levels
              newsBlock,         // full news — GPT uses same macro context
              `Perform a complete institutional analysis for ${asset} in ${mode}.`,
              `IMPORTANT: Before writing any "wait for price to tap" instruction, check if the level is already marked MITIGATED in the engine results above. If it is mitigated, do NOT tell the user to wait for it.`,
              `Use the news to explain WHY price is moving.`,
              hasHighImpactEvent
                ? `⚠️ HIGH-IMPACT EVENT IN NEWS. Execution Plan MUST include trade pause warning.`
                : `No high-impact events detected.`,
            ].join('\n\n');

            const fallback = await client.chat.completions.create({
              model: 'gpt-4o',
              messages: [
                { role: 'system', content: buildSystemPrompt(asset, mode) },
                { role: 'user',   content: gptPrompt },
              ],
              temperature: 0.1,
            });

            responseText = fallback.choices[0].message?.content || '';
            aiUsed = 'gpt-4o';

            // Prepend a small notice so user knows which AI was used
            responseText = `> ⚡ **Analysis provided by GPT-4o** (Gemini unavailable)\n\n${responseText}`;

          } catch (gptError: any) {
            console.log('GPT-4o fallback also failed:', gptError.message);
            // ── 7. Rule-based fallback (last resort) ─────────────────────
            responseText = generateRuleBasedSummary(asset, mode, engineData);
            aiUsed = 'rule-based';
          }
        } else {
          console.log('No GITHUB_TOKEN configured. Using rule-based fallback.');
          responseText = generateRuleBasedSummary(asset, mode, engineData);
          aiUsed = 'rule-based';
        }
      }

      console.log(`Analysis complete. AI used: ${aiUsed}`);
      res.json({ result: responseText });

    } catch (error: any) {
      console.log('Analysis error:', error);
      res.status(500).json({ error: error.message || 'Analysis failed.' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`QUANT-X server running on http://localhost:${PORT}`);
    console.log(`Python engine: ${path.join(process.cwd(), 'engine.py')}`);
  });
}

startServer();
