import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import WebSocket from 'ws';

const DERIV_SYMBOLS: Record<string, string> = {
  EURUSD: 'frxEURUSD', GBPUSD: 'frxGBPUSD', USDJPY: 'frxUSDJPY',
  USDCHF: 'frxUSDCHF', AUDUSD: 'frxAUDUSD', USDCAD: 'frxUSDCAD',
  NZDUSD: 'frxNZDUSD',
  XAUUSD: 'frxXAUUSD', XAGUSD: 'frxXAGUSD',
  BTCUSD: 'cryBTCUSD', ETHUSD: 'cryETHUSD', SOLUSD: 'crySOLUSD',
  US30: 'WLDAUD', NAS100: 'frxXAUUSD', SPX500: 'frxXAUUSD',
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
}

function fetchDerivCandles(symbol: string, granularity: number, count = 500): Promise<Candle[]> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
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

    ws.on('message', (raw: string) => {
      clearTimeout(timeout);
      ws.close();
      try {
        const data = JSON.parse(raw.toString());
        if (data.error) return reject(new Error(data.error.message));
        const candles: Candle[] = (data.candles || []).map((c: any) => ({
          epoch: c.epoch,
          open:  parseFloat(c.open),
          high:  parseFloat(c.high),
          low:   parseFloat(c.low),
          close: parseFloat(c.close),
        }));
        resolve(candles);
      } catch (e) {
        reject(e);
      }
    });

    ws.on('error', (err) => { clearTimeout(timeout); reject(err); });
  });
}

function formatCandles(candles: Candle[], label: string): string {
  if (!candles.length) return `${label}: NO DATA\n`;
  const rows = candles.slice(-100).map(c =>
    `${new Date(c.epoch * 1000).toISOString().slice(0, 16)},${c.open},${c.high},${c.low},${c.close}`
  );
  const last = candles[candles.length - 1];
  return `\n### ${label} (last 100 of ${candles.length} candles — most recent last)\ntime,open,high,low,close\n${rows.join('\n')}\nCURRENT PRICE: ${last.close}\n`;
}

function calcATR(candles: Candle[], period = 14): number {
  if (candles.length < period + 1) return 0;
  const trs = candles.slice(-period - 1).map((c, i, arr) => {
    if (i === 0) return c.high - c.low;
    const prev = arr[i - 1];
    return Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close));
  });
  return trs.slice(1).reduce((a, b) => a + b, 0) / period;
}

const NEWS_SOURCES: { url: string; name: string }[] = [
  { url: 'https://www.financemagnates.com/trending/',        name: 'Finance Magnates' },
  { url: 'https://www.forexlive.com/',                       name: 'ForexLive' },
  { url: 'https://www.dailyfx.com/news',                     name: 'DailyFX' },
  { url: 'https://tradingeconomics.com/commodity/gold',      name: 'Trading Economics' },
  { url: 'https://www.investing.com/news/commodities-news',  name: 'Investing.com' },
];

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
  US30:   ['dow', 'US30', 'wall street', 'DJIA'],
  NAS100: ['nasdaq', 'NAS100', 'tech stocks', 'NDX'],
  SPX500: ['S&P', 'SPX', 'SPX500', 'S&P 500'],
};

interface NewsResult {
  source: string;
  headlines: string[];
  hasHighImpactEvent: boolean;
  eventWarnings: string[];
}

async function scrapeNews(asset: string): Promise<NewsResult[]> {
  const keywords = ASSET_KEYWORDS[asset] || [asset.toLowerCase()];
  const results: NewsResult[] = [];

  await Promise.allSettled(
    NEWS_SOURCES.map(async (source) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(source.url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; research-bot/1.0)',
            'Accept': 'text/html',
          },
        });
        clearTimeout(timeout);

        if (!response.ok) return;

        const html = await response.text();

        const text = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/\s{2,}/g, ' ')
          .trim();

        const sentences = text
          .split(/[.\n]/)
          .map(s => s.trim())
          .filter(s => s.length > 40 && s.length < 300);

        const relevant = sentences.filter(s =>
          keywords.some(kw => s.toLowerCase().includes(kw.toLowerCase()))
        ).slice(0, 8);

        if (relevant.length === 0) return;

        const eventWarnings: string[] = [];
        const allText = relevant.join(' ').toLowerCase();
        for (const event of HIGH_IMPACT_EVENTS) {
          if (allText.includes(event.toLowerCase())) {
            eventWarnings.push(event);
          }
        }

        results.push({
          source: source.name,
          headlines: relevant,
          hasHighImpactEvent: eventWarnings.length > 0,
          eventWarnings,
        });
      } catch {
        // silently skip failed sources
      }
    })
  );

  return results;
}

function formatNewsBlock(newsResults: NewsResult[], asset: string): string {
  if (newsResults.length === 0) {
    return '\n# MACRO NEWS: No news sources reachable. Proceed with price data only.\n';
  }

  const allEventWarnings = [...new Set(newsResults.flatMap(r => r.eventWarnings))];
  const hasHighImpact = newsResults.some(r => r.hasHighImpactEvent);

  let block = `\n# MACRO & FUNDAMENTAL NEWS FOR ${asset}\nScraped: ${new Date().toISOString()}\n`;

  if (hasHighImpact) {
    block += `\n⚠️ HIGH-IMPACT EVENT DETECTED: ${allEventWarnings.join(', ')}\n`;
    block += `TRADE PAUSE RECOMMENDATION: Do not enter new positions until this event resolves.\n`;
  }

  for (const result of newsResults) {
    block += `\n## ${result.source}\n`;
    result.headlines.forEach((h, i) => {
      block += `${i + 1}. ${h}\n`;
    });
  }

  block += `\nEND OF NEWS BLOCK\n`;
  return block;
}

function buildSystemPrompt(asset: string, mode: string): string {
  return `
You are QUANT-X, a deterministic quantitative market analysis engine. You are NOT a chatbot. You are not allowed to speculate, hallucinate prices, or invent levels. Every price level you state must come directly from the OHLCV data provided. Every macro reason you state must come from the news data provided. If data is insufficient to calculate a value, write INSUFFICIENT DATA.

ENGINE DEFINITIONS — APPLY THESE EXACT RULES

SWING DETECTION:
Swing High = candle[i].high is the highest among 5 candles left and 5 candles right
Swing Low  = candle[i].low  is the lowest  among 5 candles left and 5 candles right
Label every swing high and swing low in each timeframe.

BOS (Break of Structure):
Bullish BOS = candle CLOSES above the most recent confirmed Swing High
Bearish BOS = candle CLOSES below the most recent confirmed Swing Low
The candle must CLOSE beyond the swing — a wick does not count.
Output: "BOS BULL @ [price] on [date]" or "BOS BEAR @ [price] on [date]"

CHOCH (Change of Character):
Bullish trend = series of HH and HL confirmed by BOS
CHoCH bearish signal = price CLOSES below the most recent HL in a bullish trend
Bearish trend = series of LH and LL confirmed by BOS
CHoCH bullish signal = price CLOSES above the most recent LH in a bearish trend
Output: "CHoCH @ [price] on [date] — [bullish/bearish] trend broken"

FAIR VALUE GAP:
Bullish FVG  = candle[i-1].high < candle[i+1].low
Bearish FVG  = candle[i-1].low  > candle[i+1].high
Minimum size: gap must be > ATR(14) x 0.15 — discard smaller gaps
Mitigated when price CLOSES inside the gap
Output: "BFVG [top]-[bottom] formed [date] — [fresh/mitigated]"

ORDER BLOCK:
Bullish OB = last bearish candle BEFORE a bullish BOS impulse of at least ATR(14) x 1.5
Bearish OB = last bullish candle BEFORE a bearish BOS impulse of at least ATR(14) x 1.5
Fresh = price has NOT returned to the OB range after formation
Mitigated = price has traded through 50% of the OB body
Output: "BOB [high]-[low] formed [date] — [fresh/mitigated]"

LIQUIDITY:
BSL = confirmed Swing Highs not yet taken
SSL = confirmed Swing Lows not yet taken
EQH = two or more swing highs within ATR(14) x 0.05 of each other
EQL = two or more swing lows  within ATR(14) x 0.05 of each other
Sweep = price wicks beyond a level but CLOSES back inside
List the 3 most significant BSL and SSL levels with exact prices.

SUPPLY AND DEMAND ZONES:
Demand Zone = from the lowest low of the base to the highest open before price left up
Supply Zone = from the highest high of the base to the lowest open before price left down
Fresh = price has not returned since formation
Mitigated = price has traded into the zone at least once

PREMIUM / DISCOUNT:
Use the most recent swing range on the HTF.
Equilibrium  = 50% of range
Discount     = below 50%
Premium      = above 50%
Deep Discount = below 25%
Deep Premium  = above 75%
Output exact percentage of where current price sits.

CONFLUENCE SCORING:
Market Structure alignment HTF matches LTF direction: 20 pts
Liquidity target present and logical: 15 pts
HTF bias confirmed on LTF CHoCH: 15 pts
Order Block in discount or premium zone: 10 pts
Fair Value Gap present and fresh: 10 pts
Supply/Demand zone overlap with OB: 10 pts
Premium/Discount alignment: 10 pts
Price action confirmation: 5 pts
Session context alignment: 5 pts
TOTAL: 0-100
HTF HARD FILTER: If HTF BOS direction does not match trade direction, cap score at 40. No exceptions.
Grade: A+ = 90-100 | A = 80-89 | B = 70-79 | C = 60-69 | REJECT = below 60

NEWS AND MACRO RULES:
- You will receive live macro news scraped from financial news sites.
- You MUST use this news to explain WHY price is moving in the Market Narrative section.
- If the news says gold is falling due to rate hike fears, your bias must reflect that. You cannot produce a bullish bias if the macro context from the news is bearish.
- If a HIGH-IMPACT EVENT WARNING appears in the data (CPI, NFP, FOMC, rate decision, Fed speakers, Powell), your Execution Plan MUST include a trade pause warning regardless of confluence score.
- If no news is available, state "No macro context available — analysis based on price data only."

OUTPUT FORMAT — MANDATORY — USE THIS EXACT STRUCTURE:

## MARKET SUMMARY
- **Asset:** ${asset}
- **Mode:** ${mode}
- **Timestamp:** [ISO timestamp of most recent candle]
- **Current Price:** [exact value from data]
- **HTF Bias:** [Strong Bullish / Bullish / Neutral / Bearish / Strong Bearish]
- **Market Regime:** [Trending / Ranging / Expansion / Accumulation / Distribution]
- **P/D Position:** [Deep Discount / Discount / Equilibrium / Premium / Deep Premium] — [exact %]
- **Confluence Score:** [n]/100
- **Trade Grade:** [A+ / A / B / C / REJECTED]

## MACRO CONTEXT
[2-3 sentences explaining the fundamental reason price is moving, sourced from the news provided. If CPI/NFP/FOMC is upcoming, state it here with a trade pause warning.]

## STRUCTURE ANALYSIS
[Every BOS and CHoCH found across all timeframes with prices and dates. Start HTF then LTF. Minimum 3 events.]

## LIQUIDITY MAP
[3 most significant BSL levels and 3 SSL levels with exact prices. Note which are swept and which are resting.]

## KEY LEVELS
[2 most relevant fresh OBs, 2 fresh FVGs, 2 fresh S/D zones with exact price ranges.]

## MARKET NARRATIVE
[3-5 sentences combining price structure AND macro reason. Reference actual structural events and news drivers together.]

## EXECUTION PLAN
- **Direction:** [Bullish / Bearish / NEUTRAL — NO TRADE]
- **Wait Condition:** [Specific price event required before entry]
- **Entry Zone:** [Specific price range from data]
- **Invalidation:** [Specific price from data]
- **Target 1 (TP1):** [Price]
- **Target 2 (TP2):** [Price]
- **Target 3 (TP3):** [Price]
- **Estimated R:R:** [ratio]
- **News Warning:** [TRADE PAUSE — event name pending / CLEAR — no high-impact events]

If confluence score is below 60 or HTF hard filter is triggered, output this instead:

# NO TRADE SETUP FOUND
**Score:** [n]/100
**Reason:**
1. [Structural reason from data]
2. [Liquidity reason from data]
3. [Macro/news reason if applicable]
4. [Session or timing issue]
5. [What must change for a valid setup]

INTEGRITY RULES:
- Every price you mention must exist in the provided OHLCV data.
- Every macro statement must come from the provided news block.
- Never use approximately, around, or roughly for prices. Use exact values.
- Never invent news events or macro drivers not in the data.
- If data is insufficient write INSUFFICIENT DATA.
- Temperature is 0.1. Be deterministic. Be precise.
`.trim();
}

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

      const timeframes = TIMEFRAMES[mode] || TIMEFRAMES['SCALPING MODE'];
      let marketDataBlock = `# LIVE MARKET DATA — ${asset} (${derivSymbol})\nFetched: ${new Date().toISOString()}\n`;

      const candleResults = await Promise.allSettled(
        timeframes.map(tf => fetchDerivCandles(derivSymbol, tf.granularity, 500))
      );

      for (let i = 0; i < timeframes.length; i++) {
        const tf = timeframes[i];
        const result = candleResults[i];
        if (result.status === 'fulfilled' && result.value.length > 0) {
          marketDataBlock += formatCandles(result.value, tf.label);
          const atr = calcATR(result.value);
          marketDataBlock += `ATR(14) on ${tf.label}: ${atr.toFixed(5)}\n`;
        } else {
          marketDataBlock += `\n### ${tf.label}: FETCH FAILED\n`;
        }
      }

      const newsResults = await scrapeNews(asset);
      const newsBlock = formatNewsBlock(newsResults, asset);
      const hasHighImpactEvent = newsResults.some(r => r.hasHighImpactEvent);

      const userPrompt = [
        marketDataBlock,
        newsBlock,
        `Perform a complete institutional analysis for ${asset} in ${mode}.`,
        `Base ALL price levels strictly on the OHLCV data above.`,
        `Use the news block to explain WHY price is moving — macro drivers, Fed expectations, geopolitical context.`,
        hasHighImpactEvent
          ? `WARNING: HIGH-IMPACT EVENT IN NEWS. Your Execution Plan MUST include a trade pause warning.`
          : `No high-impact events detected in news.`,
      ].join('\n\n');

      const promptParts: any[] = [{ text: userPrompt }];

      if (image) {
        promptParts.push({
          inlineData: {
            data: image.split(',')[1] || image.replace(/^data:image\/\w+;base64,/, ''),
            mimeType: 'image/jpeg',
          }
        });
        promptParts.push({
          text: 'A chart image has been provided. Cross-reference your OHLCV data analysis with the visual structure in the image. Note any discrepancies.'
        });
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      let responseText = '';

      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: promptParts,
          config: {
            systemInstruction: buildSystemPrompt(asset, mode),
            temperature: 0.1,
          }
        });
        responseText = response.text || '';
      } catch (geminiError: any) {
        console.warn('Gemini failed:', geminiError.message);

        if (process.env.GITHUB_TOKEN) {
          const OpenAI = (await import('openai')).default;
          const client = new OpenAI({
            baseURL: 'https://models.inference.ai.azure.com',
            apiKey: process.env.GITHUB_TOKEN,
          });
          const fallback = await client.chat.completions.create({
            model: 'gpt-4o',
            messages: [
              { role: 'system', content: buildSystemPrompt(asset, mode) },
              { role: 'user',   content: userPrompt },
            ],
            temperature: 0.1,
          });
          responseText = fallback.choices[0].message?.content || '';
        } else {
          throw geminiError;
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
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`QUANT-X server running on http://localhost:${PORT}`);
  });
}

startServer();
