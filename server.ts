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

// ─── Timeframes per mode ──────────────────────────────────────────────────────
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

// ─── Candle interface ─────────────────────────────────────────────────────────
interface Candle {
  epoch: number;
  open: number;
  high: number;
  low: number;
  close: number;
  date?: string;
}

// ─── Deriv WebSocket fetcher with buffer fix ──────────────────────────────────
function fetchDerivCandles(symbol: string, granularity: number, count = 500): Promise<Candle[]> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
    let buffer = '';

    const timeout = setTimeout(() => {
      ws.terminate();
      reject(new Error(`Timeout fetching ${symbol} @ ${granularity}s`));
    }, 15000);

    ws.on('open', () => {
      ws.send(JSON.stringify({
        ticks_history: symbol,
        granularity,
        count,
        end: 'latest',
        style: 'candles',
        adjust_start_time: 1,
      }));
    });

    ws.on('message', (raw: Buffer | string) => {
      buffer += raw.toString();
      try {
        const data = JSON.parse(buffer);
        clearTimeout(timeout);
        ws.close();
        if (data.error) return reject(new Error(data.error.message));
        const candles: Candle[] = (data.candles || []).map((c: any) => ({
          epoch: c.epoch,
          open:  parseFloat(c.open),
          high:  parseFloat(c.high),
          low:   parseFloat(c.low),
          close: parseFloat(c.close),
          date:  new Date(c.epoch * 1000).toISOString().slice(0, 16),
        }));
        resolve(candles);
      } catch {
        // incomplete chunk, wait for more
      }
    });

    ws.on('error', (err) => { clearTimeout(timeout); reject(err); });
  });
}

// ─── Python engine caller ─────────────────────────────────────────────────────
function runPythonEngine(candlesByTF: Record<string, Candle[]>): Promise<any> {
  return new Promise((resolve) => {
    const payload = JSON.stringify({ candles: candlesByTF });
    const enginePath = path.join(process.cwd(), 'engine.py');

    // Try python3 first, fall back to python
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const proc = spawn(pythonCmd, [enginePath], { timeout: 30000 });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

    proc.on('close', (code: number) => {
      if (code !== 0 || !stdout.trim()) {
        console.warn('Python engine warning:', stderr || 'no output');
        resolve(null); // graceful fallback — analysis continues without engine
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        console.warn('Python engine JSON parse error');
        resolve(null);
      }
    });

    proc.on('error', (err: Error) => {
      console.warn('Python not available:', err.message);
      resolve(null); // graceful fallback
    });

    proc.stdin.on('error', (err) => {
      console.warn('Python stdin error:', err.message);
      resolve(null);
    });

    try {
      proc.stdin.write(payload);
      proc.stdin.end();
    } catch (e: any) {
      console.warn('Python stdin write error:', e.message);
      resolve(null);
    }
  });
}

// ─── Format engine results into prompt block ──────────────────────────────────
function formatEngineResults(engineData: any): string {
  if (!engineData || engineData.error) {
    return '\n# ENGINE RESULTS: Not available — Gemini will calculate from raw data.\n';
  }

  const summary = engineData._summary || {};
  let block = `\n# PRE-CALCULATED ENGINE RESULTS\n`;
  block += `HTF: ${summary.htf || 'N/A'} | ETF: ${summary.etf || 'N/A'} | HTF Trend: ${summary.htf_trend || 'N/A'}\n`;
  block += `Session: ${summary.session?.session || 'N/A'} | Session Score: ${summary.session?.score ?? 'N/A'}/5\n`;
  block += `Current Price: ${summary.asset_price || 'N/A'}\n\n`;

  const tfs = Object.keys(engineData).filter(k => k !== '_summary');

  for (const tf of tfs) {
    const d = engineData[tf];
    block += `## ${tf} ENGINE OUTPUT\n`;
    block += `ATR(14): ${d.atr} | Trend: ${d.trend} | Price: ${d.current_price}\n`;

    if (d.bos_choch?.length) {
      block += `\nSTRUCTURE EVENTS:\n`;
      d.bos_choch.forEach((e: any) => {
        block += `  ${e.type} @ ${e.price} on ${e.date}\n`;
      });
    }

    if (d.swing_highs?.length || d.swing_lows?.length) {
      block += `\nSWING POINTS:\n`;
      d.swing_highs?.forEach((s: any) => block += `  SH @ ${s.price} on ${s.date}\n`);
      d.swing_lows?.forEach((s: any)  => block += `  SL @ ${s.price} on ${s.date}\n`);
    }

    if (d.fvg_fresh?.length) {
      block += `\nFRESH FVGs:\n`;
      d.fvg_fresh.forEach((f: any) => {
        block += `  ${f.direction}FVG ${f.bottom}-${f.top} formed ${f.date} | ATR ratio: ${f.atr_ratio}x\n`;
      });
    }

    if (d.ob_fresh?.length) {
      block += `\nFRESH ORDER BLOCKS:\n`;
      d.ob_fresh.forEach((o: any) => {
        block += `  ${o.direction}OB ${o.low}-${o.high} formed ${o.date} | Impulse: ${o.atr_ratio}x ATR\n`;
      });
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
    base.push({ url: 'https://tradingeconomics.com/commodity/gold',      name: 'Trading Economics' });
    base.push({ url: 'https://www.investing.com/news/commodities-news',  name: 'Investing.com' });
  } else if (isCrypto) {
    base.push({ url: 'https://coindesk.com/markets/',    name: 'CoinDesk' });
    base.push({ url: 'https://cointelegraph.com/',       name: 'CoinTelegraph' });
  } else {
    base.push({ url: 'https://www.investing.com/news/forex-news',        name: 'Investing.com Forex' });
    base.push({ url: 'https://tradingeconomics.com/calendar',            name: 'Economic Calendar' });
  }
  return base;
}

interface NewsResult {
  source: string;
  headlines: string[];
  hasHighImpactEvent: boolean;
  eventWarnings: string[];
}

async function scrapeNews(asset: string): Promise<NewsResult[]> {
  const keywords = ASSET_KEYWORDS[asset] || [asset.toLowerCase()];
  const sources  = getNewsSources(asset);
  const results: NewsResult[] = [];

  await Promise.allSettled(
    sources.map(async (source) => {
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
    })
  );
  return results;
}

function formatNewsBlock(newsResults: NewsResult[], asset: string): string {
  if (newsResults.length === 0) return '\n# MACRO NEWS: No sources reachable. Analysis based on price data only.\n';
  const allWarnings  = [...new Set(newsResults.flatMap(r => r.eventWarnings))];
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
You are QUANT-X, an institutional market analysis engine. You receive three data sources:
1. Raw OHLCV candle data from Deriv live feed
2. Pre-calculated engine results from a Python SMC engine (BOS, CHoCH, FVG, OB, Liquidity, Premium/Discount — all mathematically precise)
3. Live macro news scraped from financial websites

YOUR ROLE:
- The Python engine has already done all the math. You do NOT need to recalculate levels from scratch.
- Your job is to INTERPRET the engine results, cross-reference with the news, apply confluence scoring, and produce the execution plan.
- If engine results are available, use those exact prices. Do not invent your own levels.
- If engine results say INSUFFICIENT DATA for a field, note it but continue with available data.

CONFLUENCE SCORING — SHOW YOUR WORKING EXACTLY LIKE THIS:
  Structure alignment (HTF BOS matches trade direction): [0 or 20]
  Liquidity target present and logical: [0 or 15]
  HTF trend confirmed on ETF via CHoCH: [0 or 15]
  Fresh Order Block at entry zone: [0 or 10]
  Fresh FVG at entry zone: [0 or 10]
  S/D zone overlaps with OB: [0 or 10]
  Price in Premium/Discount alignment: [0 or 10]
  Price action confirmation candle: [0 or 5]
  Session score (from engine): [0 or 5]
  SUBTOTAL: [sum all above]
  HTF Hard Filter: If HTF trend ≠ trade direction → cap at 40. Applied: [YES/NO]
  FINAL SCORE: [n]/100

Each component is binary. Full points or zero. No halves. No quarters.
Trade Grade: A+ = 90-100 | A = 80-89 | B = 70-79 | C = 60-69 | REJECT = below 60

SESSION RULES:
London session         = 07:00–11:00 UTC → 5 pts
London/NY overlap      = 12:00–15:00 UTC → 5 pts
New York session       = 15:00–20:00 UTC → 5 pts
Asian session          = 00:00–06:00 UTC → 0 pts for forex
Crypto and synthetics  = 5 pts always

NEWS AND MACRO RULES:
- You MUST explain WHY price is moving using the news provided. Not optional.
- If news says rate hike fears, your bias must reflect that.
- If HIGH-IMPACT EVENT detected, Execution Plan must include trade pause warning regardless of score.
- If no news available, state that clearly.

OUTPUT FORMAT — MANDATORY:

## MARKET SUMMARY
- **Asset:** ${asset}
- **Mode:** ${mode}
- **Timestamp:** [from engine data]
- **Current Price:** [from engine data]
- **HTF Bias:** [Strong Bullish / Bullish / Neutral / Bearish / Strong Bearish]
- **Market Regime:** [Trending / Ranging / Expansion / Accumulation / Distribution]
- **P/D Position:** [from engine] — [exact %]
- **Confluence Score:** [n]/100
- **Trade Grade:** [A+ / A / B / C / REJECTED]

## MACRO CONTEXT
[2-3 sentences from news. What is driving price. Any upcoming events.]

## STRUCTURE ANALYSIS
[List every BOS and CHoCH from engine results across all timeframes. HTF first then down to ETF.]

## LIQUIDITY MAP
[BSL and SSL levels from engine. Which are resting, which swept. Distance from current price.]

## KEY LEVELS
[Fresh OBs, fresh FVGs, S/D zones from engine. Exact prices only.]

## CONFLUENCE SCORECARD
[Show the full scoring breakdown as specified above]

## MARKET NARRATIVE
[3-5 sentences combining structure from engine + macro from news. Why is smart money doing what it is doing.]

## EXECUTION PLAN
- **Direction:** [Bullish / Bearish / NEUTRAL — NO TRADE]
- **Wait Condition:** [Specific event required before entry]
- **Entry Zone:** [Exact prices from engine]
- **Invalidation:** [Exact price from engine]
- **Target 1 (TP1):** [Next SSL or BSL from engine]
- **Target 2 (TP2):** [Next structural level]
- **Target 3 (TP3):** [HTF target]
- **Estimated R:R:** [ratio]
- **News Warning:** [TRADE PAUSE — event / CLEAR]

If score below 60 or HTF hard filter triggered:
# ⛔ NO TRADE SETUP FOUND
**Score:** [n]/100
**Reason:**
1. [From engine data]
2. [From engine data]
3. [From news if applicable]
4. [Session]
5. [What must change]

INTEGRITY RULES:
- Every price comes from the engine results or OHLCV data. Never invented.
- Every macro statement comes from the news block.
- If engine returned null for a field, write INSUFFICIENT DATA.
- Temperature 0.1. Deterministic. Precise.
`.trim();
}

function generateRuleBasedSummary(asset: string, mode: string, engineData: any): string {
  const summary = engineData._summary || {};
  const mlScore = summary.ml_score?.score ?? 0;
  
  const scoreVerdict = mlScore > 60 ? 'HIGH PROBABILITY' : mlScore > 40 ? 'MARGINAL' : 'REJECTED';
  
  return `## MARKET SUMMARY (RULE-BASED FALLBACK)
- **Asset:** ${asset}  
- **Mode:** ${mode}  
- **Timestamp:** ${new Date().toISOString()}  
- **Current Price:** ${summary.asset_price || 'N/A'}  
- **HTF Bias:** ${summary.htf_trend || 'N/A'}  
- **Confluence Score:** ${mlScore}/100  
- **Trade Grade:** ${scoreVerdict}

---

## 🚦 AI UNAVAILABLE — SYSTEM NOTIFICATION
The advanced Gemini AI model is currently experiencing high demand (HTTP 503) or quota limitations. 
The system has automatically fallen back to the deterministic **Rule-Based Engine** to ensure continuous operation.
To restore full AI qualitative reasoning, please configure a \`GITHUB_TOKEN\` in the AI Studio Settings to enable the ChatGPT fallback.

---

## STRUCTURE ANALYSIS
### HTF (${summary.htf || 'N/A'}):
- Trend: **${summary.htf_trend || 'N/A'}**
- EMA Alignment: ${summary.htf_ema_trend || 'N/A'}

### ML SIGNAL SCORING
- **Score:** ${mlScore} / 100
- **Method:** ${summary.ml_score?.method || 'N/A'}
- **HTF Filter Applied:** ${summary.ml_score?.htf_filter_applied ? 'YES' : 'NO'}

## EXECUTION PLAN
**Verdict:** ${scoreVerdict}
*This is a deterministic output generated because the AI model is temporarily unavailable.*
`;
}

// ─── Express server ───────────────────────────────────────────────────────────
async function startServer() {
  const app = express();
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

      // ── 1. Fetch live candles from Deriv ─────────────────────────────────
      const timeframes = TIMEFRAMES[mode] || TIMEFRAMES['SCALPING MODE'];
      const candlesByTF: Record<string, Candle[]> = {};
      let rawCandleBlock = `# LIVE OHLCV DATA — ${asset}\nFetched: ${new Date().toISOString()}\n`;

      const candleResults = await Promise.allSettled(
        timeframes.map(tf => fetchDerivCandles(derivSymbol, tf.granularity, 500))
      );

      for (let i = 0; i < timeframes.length; i++) {
        const tf     = timeframes[i];
        const result = candleResults[i];
        if (result.status === 'fulfilled' && result.value.length > 0) {
          candlesByTF[tf.label] = result.value;
          const last   = result.value[result.value.length - 1];
          const oldest = result.value[0];
          rawCandleBlock += `\n${tf.label}: ${result.value.length} candles | From ${oldest.date} to ${last.date} | Last close: ${last.close}\n`;
          // Send last 200 candles as CSV
          const rows = result.value.slice(-200).map(c =>
            `${c.date},${c.open},${c.high},${c.low},${c.close}`
          );
          rawCandleBlock += `time,open,high,low,close\n${rows.join('\n')}\n`;
        } else {
          rawCandleBlock += `\n${tf.label}: FETCH FAILED\n`;
        }
      }

      // ── 2. Run Python engine ─────────────────────────────────────────────
      const engineData   = await runPythonEngine(candlesByTF);
      const engineBlock  = formatEngineResults(engineData);

      // ── 3. Scrape news ───────────────────────────────────────────────────
      const newsResults       = await scrapeNews(asset);
      const newsBlock         = formatNewsBlock(newsResults, asset);
      const hasHighImpactEvent = newsResults.some(r => r.hasHighImpactEvent);

      // ── 4. Build prompt ──────────────────────────────────────────────────
      const userPrompt = [
        rawCandleBlock,
        engineBlock,
        newsBlock,
        `Perform a complete institutional analysis for ${asset} in ${mode}.`,
        `The Python engine has pre-calculated all levels. Use those exact values.`,
        `Use the news to explain WHY price is moving.`,
        hasHighImpactEvent
          ? `⚠️ HIGH-IMPACT EVENT IN NEWS. Execution Plan MUST include a trade pause warning.`
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
        promptParts.push({ text: 'Chart image provided. Cross-reference visual structure with engine results. Note any discrepancies.' });
      }

      // ── 5. Call Gemini ───────────────────────────────────────────────────
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      let responseText = '';

      try {
        let response;
        try {
          response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: promptParts,
            config: {
              systemInstruction: buildSystemPrompt(asset, mode),
              temperature: 0.1,
            }
          });
        } catch (initialErr: any) {
          const msg = initialErr.message || '';
          if (msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('high demand') || msg.includes('429')) {
            console.log('Gemini high demand (503/429), retrying once in 3s...');
            await new Promise(r => setTimeout(r, 3000));
            response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: promptParts,
              config: {
                systemInstruction: buildSystemPrompt(asset, mode),
                temperature: 0.1,
              }
            });
          } else {
            throw initialErr;
          }
        }
        responseText = response.text || '';
      } catch (geminiError: any) {
        console.warn('Gemini failed:', geminiError.message);
        if (process.env.GITHUB_TOKEN) {
          console.log('Attempting ChatGPT fallback... (GITHUB_TOKEN present)');
          const OpenAI = (await import('openai')).default;
          const client = new OpenAI({
            baseURL: 'https://models.inference.ai.azure.com',
            apiKey: process.env.GITHUB_TOKEN,
          });
          
          let fallbackCandleBlock = `# LIVE OHLCV DATA — ${asset}\nFetched: ${new Date().toISOString()}\n`;
          for (const tf of timeframes) {
              const candles = candlesByTF[tf.label];
              if (candles && candles.length > 0) {
                  const last = candles[candles.length - 1];
                  const oldest = candles[0];
                  fallbackCandleBlock += `\n${tf.label}: ${candles.length} candles | From ${oldest.date} to ${last.date} | Last close: ${last.close}\n`;
                  const rows = candles.slice(-50).map((c: any) => `${c.date},${c.open},${c.high},${c.low},${c.close}`);
                  fallbackCandleBlock += `time,open,high,low,close\n${rows.join('\n')}\n`;
              }
          }

          const fallbackUserPrompt = [
            fallbackCandleBlock,
            engineBlock,
            newsBlock,
            `Perform a complete institutional analysis for ${asset} in ${mode}.`,
            hasHighImpactEvent ? `⚠️ HIGH-IMPACT EVENT IN NEWS.` : ``
          ].join('\n\n');

          try {
            const fallback = await client.chat.completions.create({
              model: 'gpt-4o',
              messages: [
                { role: 'system', content: buildSystemPrompt(asset, mode) },
                { role: 'user',   content: fallbackUserPrompt },
              ],
              temperature: 0.1,
            });
            responseText = fallback.choices[0].message?.content || '';
          } catch (fbErr: any) {
            console.warn('Fallback failed:', fbErr.message);
            responseText = generateRuleBasedSummary(asset, mode, data);
          }
        } else {
          console.warn('No GITHUB_TOKEN and Gemini failed. Falling back to rule-based summary.');
          responseText = generateRuleBasedSummary(asset, mode, data);
        }
      }

      res.json({ result: responseText });
    } catch (error: any) {
      console.error('Analysis error:', error);
      res.status(500).json({ error: error.message || 'Analysis failed.' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`QUANT-X server running on http://localhost:${PORT}`);
    console.log(`Python engine: ${path.join(process.cwd(), 'engine.py')}`);
  });
}

startServer();
