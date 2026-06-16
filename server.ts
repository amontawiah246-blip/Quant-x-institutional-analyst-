import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import WebSocket from 'ws';
import { spawn } from 'child_process';

// ─── Deriv Symbol Map ─────────────────────────────────────────────────────────
const DERIV_SYMBOLS: Record<string, string> = {
  EURUSD:'frxEURUSD', GBPUSD:'frxGBPUSD', USDJPY:'frxUSDJPY',
  USDCHF:'frxUSDCHF', AUDUSD:'frxAUDUSD', USDCAD:'frxUSDCAD', NZDUSD:'frxNZDUSD',
  XAUUSD:'frxXAUUSD', XAGUSD:'frxXAGUSD', USOIL:'frxUSOIL', XNGUSD:'frxXNGUSD',
  BTCUSD:'cryBTCUSD', ETHUSD:'cryETHUSD', SOLUSD:'crySOLUSD', BNBUSD:'cryBNBUSD',
  BOOM1000:'BOOM1000', CRASH1000:'CRASH1000', VOL75:'R_75', VOL100:'R_100',
  US30:'OTC_US30', NAS100:'OTC_US_TECH', STOXX50:'OTC_STOXX50'
};

// In-memory candle cache — prevents re-fetching same candles within 2 minutes
const candleCache = new Map<string, { candles: Candle[], timestamp: number }>();
const CACHE_TTL_MS = 120_000;

async function fetchCachedCandles(symbol: string, granularity: number, count: number): Promise<Candle[]> {
  const key    = `${symbol}_${granularity}`;
  const cached = candleCache.get(key);
  if(cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log(`Cache hit: ${key}`);
    return cached.candles;
  }
  const candles = await fetchDerivCandles(symbol, granularity, count);
  if(candles.length > 0) candleCache.set(key, { candles, timestamp: Date.now() });
  return candles;
}

const SYNTHETICS = new Set(['BOOM1000','CRASH1000','VOL75','VOL100','R_75','R_100']);

const TIMEFRAMES: Record<string, { granularity: number; label: string }[]> = {
  'SCALPING MODE': [
    {granularity:604800,label:'W1'},
    {granularity:14400, label:'4H'},
    {granularity:3600,  label:'1H'},
    {granularity:900,   label:'15M'},
    {granularity:300,   label:'5M'},
  ],
  'SWING MODE': [
    {granularity:604800,label:'W1'},
    {granularity:86400, label:'D1'},
    {granularity:14400, label:'4H'},
    {granularity:3600,  label:'1H'},
    {granularity:900,   label:'15M'},
  ],
  'SYNTHETIC SCALP': [
    {granularity:14400, label:'4H'},
    {granularity:3600,  label:'1H'},
    {granularity:900,   label:'15M'},
    {granularity:300,   label:'5M'},
  ],
  'SYNTHETIC SWING': [
    {granularity:14400, label:'4H'},
    {granularity:3600,  label:'1H'},
    {granularity:900,   label:'15M'},
  ],
};

interface Candle { epoch:number; open:number; high:number; low:number; close:number; date?:string; }

// ─── Deriv WebSocket fetcher ──────────────────────────────────────────────────
function fetchDerivCandles(symbol:string, granularity:number, count=500): Promise<Candle[]> {
  return new Promise((resolve,reject) => {
    const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
    let buffer = '';
    const timeout = setTimeout(()=>{ ws.terminate(); reject(new Error(`Timeout ${symbol}@${granularity}s`)); }, 15000);
    ws.on('open', ()=>{ ws.send(JSON.stringify({ticks_history:symbol,granularity,count,end:'latest',style:'candles',adjust_start_time:1})); });
    ws.on('message', (raw:Buffer|string) => {
      buffer += raw.toString();
      try {
        const data = JSON.parse(buffer); clearTimeout(timeout); ws.close();
        if(data.error) return reject(new Error(data.error.message));
        resolve((data.candles||[]).map((c:any)=>({
          epoch:c.epoch, open:parseFloat(c.open), high:parseFloat(c.high),
          low:parseFloat(c.low), close:parseFloat(c.close),
          date:new Date(c.epoch*1000).toISOString().slice(0,16),
        })));
      } catch { /* wait for chunks */ }
    });
    ws.on('error', (err)=>{ clearTimeout(timeout); reject(err); });
  });
}

// ─── Python engine caller ─────────────────────────────────────────────────────
function runPythonOperation(payload: Record<string,any>): Promise<any> {
  return new Promise((resolve) => {
    const enginePath = path.join(process.cwd(), 'engine.py');
    const pythonCmd  = process.platform === 'win32' ? 'python' : 'python3';
    const proc = spawn(pythonCmd, [enginePath], {timeout:15000});
    let stdout='', stderr='';
    proc.stdout.on('data',(d:Buffer)=>{ stdout+=d.toString(); });
    proc.stderr.on('data',(d:Buffer)=>{ stderr+=d.toString(); });
    proc.on('close',(code:number)=>{
      if(code!==0||!stdout.trim()){ console.log('Python:',stderr||'no output'); return resolve({error:stderr||'no output'}); }
      try { resolve(JSON.parse(stdout)); } catch { resolve({error:'JSON parse failed'}); }
    });
    proc.on('error',(err:Error)=>{ console.log('Python unavailable:',err.message); resolve({error:err.message}); });
    proc.stdin.on('error',(err:any)=>{ resolve({error:err.message}); });
    try { proc.stdin.write(JSON.stringify(payload)); proc.stdin.end(); }
    catch(e:any){ resolve({error:e.message}); }
  });
}

function runPythonEngine(candlesByTF:Record<string,Candle[]>, asset:string, accountSize=10000, riskPct=1.0): Promise<any> {
  return runPythonOperation({operation:'analyze', candles:candlesByTF, asset, account_size:accountSize, risk_pct:riskPct});
}

// ─── RSS NEWS FETCHER ─────────────────────────────────────────────────────────
const RSS_SOURCES: Record<string, {url:string; name:string}[]> = {
    XAUUSD: [
    {url:'https://www.forexlive.com/feed/news',              name:'ForexLive'},
    {url:'https://www.dailyfx.com/feeds/market-news',        name:'DailyFX'},
    {url:'https://www.fxstreet.com/rss/news',                name:'FXStreet'},
    {url:'https://www.kitco.com/rss/kitconews.xml',          name:'Kitco'},
    {url:'https://www.investing.com/rss/news_301.rss',       name:'Investing.com'},
  ],
  XAGUSD: [
    {url:'https://www.forexlive.com/feed/news',         name:'ForexLive'},
    {url:'https://www.fxstreet.com/rss/news',           name:'FXStreet'},
  ],
  BTCUSD: [
    {url:'https://cointelegraph.com/rss',               name:'CoinTelegraph'},
    {url:'https://coindesk.com/arc/outboundfeeds/rss/', name:'CoinDesk'},
    {url:'https://decrypt.co/feed',                     name:'Decrypt'},
  ],
  ETHUSD: [
    {url:'https://cointelegraph.com/rss/tag/ethereum',  name:'CoinTelegraph ETH'},
    {url:'https://coindesk.com/arc/outboundfeeds/rss/', name:'CoinDesk'},
  ],
  SOLUSD: [
    {url:'https://cointelegraph.com/rss',               name:'CoinTelegraph'},
    {url:'https://coindesk.com/arc/outboundfeeds/rss/', name:'CoinDesk'},
  ],
  DEFAULT: [
    {url:'https://www.forexlive.com/feed/news',         name:'ForexLive'},
    {url:'https://www.dailyfx.com/feeds/market-news',   name:'DailyFX'},
    {url:'https://www.fxstreet.com/rss/news',           name:'FXStreet'},
  ],
};

interface NewsItem {
  title:string; summary:string; pubDate:string;
  ageMinutes:number; source:string; isBreaking:boolean;
}

async function fetchRSSNews(asset:string): Promise<{
  items:NewsItem[]; hasHighImpact:boolean; highImpactEvents:string[];
  freshCount:number; staleCount:number;
}> {
  const sources = RSS_SOURCES[asset] || RSS_SOURCES['DEFAULT'];
  const HIGH_IMPACT = ['CPI','NFP','nonfarm payroll','FOMC','rate decision','rate hike','rate cut',
    'Powell','Fed meeting','ECB','Bank of Japan','GDP','inflation data','interest rate'];
  const allItems:NewsItem[] = [];
  const now = Date.now();

  await Promise.allSettled(sources.map(async (source) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(()=>controller.abort(), 8000);
      const resp = await fetch(source.url, {
        signal:controller.signal,
        headers:{'User-Agent':'Mozilla/5.0','Accept':'application/rss+xml,application/xml,text/xml,*/*'},
      });
      clearTimeout(timeout);
      if(!resp.ok) return;
      const xml = await resp.text();
      const itemMatches = xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi);
      for(const match of itemMatches) {
        const content = match[1];
        const title   = content.match(/<title[^>]*><!\[CDATA\[(.*?)\]\]>/i)?.[1] ||
                        content.match(/<title[^>]*>(.*?)<\/title>/i)?.[1] || '';
        const desc    = content.match(/<description[^>]*><!\[CDATA\[(.*?)\]\]>/i)?.[1] ||
                        content.match(/<description[^>]*>(.*?)<\/description>/i)?.[1] || '';
        const pubDate = content.match(/<pubDate[^>]*>(.*?)<\/pubDate>/i)?.[1] || '';
        if(!title.trim()) continue;
        let ageMinutes = 9999;
        if(pubDate) {
          try {
            const t = new Date(pubDate).getTime();
            if(!isNaN(t)) ageMinutes = Math.floor((now - t) / 60000);
          } catch { /* skip */ }
        }
        const cleanDesc = desc.replace(/<[^>]+>/g,' ')
          .replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s{2,}/g,' ').trim().slice(0,200);
        allItems.push({
          title:title.trim().slice(0,150), summary:cleanDesc,
          pubDate:pubDate.trim(), ageMinutes,
          source:source.name, isBreaking:ageMinutes<=30,
        });
      }
    } catch { /* skip */ }
  }));

  allItems.sort((a,b)=>a.ageMinutes-b.ageMinutes);
  const freshItems = allItems.filter(i=>i.ageMinutes<=240);
  const staleItems = allItems.filter(i=>i.ageMinutes>240);
  const highImpactEvents:string[] = [];
  for(const item of freshItems.slice(0,10)) {
    const text = (item.title+' '+item.summary).toLowerCase();
    for(const event of HIGH_IMPACT) {
      if(text.includes(event.toLowerCase())&&!highImpactEvents.includes(event)) highImpactEvents.push(event);
    }
  }
  return {
    items:[...freshItems.slice(0,8),...staleItems.slice(0,3)],
    hasHighImpact:highImpactEvents.length>0, highImpactEvents,
    freshCount:freshItems.length, staleCount:staleItems.length,
  };
}

function formatNewsBlock(newsData:Awaited<ReturnType<typeof fetchRSSNews>>, asset:string): string {
  const {items,hasHighImpact,highImpactEvents,freshCount,staleCount} = newsData;
  if(items.length===0) return '\n# NEWS: No RSS feeds reachable. Analysis based on price data only.\n';
  let block = `\n# LIVE RSS NEWS — ${asset}\nFetched:${new Date().toISOString()} | Fresh(<4h):${freshCount} | Older:${staleCount}\n`;
  block += `RULE: Only cite FRESH or BREAKING items as current drivers. Never cite STALE news as if it is happening now.\n`;
  if(hasHighImpact) block += `\n⚠️ HIGH-IMPACT EVENT IN FRESH NEWS: ${highImpactEvents.join(', ')}\nTRADE PAUSE RECOMMENDED.\n`;
  const breaking = items.filter(i=>i.isBreaking);
  if(breaking.length>0) {
    block += `\n## 🔴 BREAKING (≤30min old)\n`;
    breaking.forEach(i=>{ block+=`[${i.ageMinutes}min ago | ${i.source}] ${i.title}\n`; if(i.summary) block+=`  → ${i.summary}\n`; });
  }
  const recent = items.filter(i=>!i.isBreaking&&i.ageMinutes<=240);
  if(recent.length>0) {
    block += `\n## 📰 RECENT (30min–4hr)\n`;
    recent.forEach(i=>{
      const age = i.ageMinutes>=60?`${Math.floor(i.ageMinutes/60)}h${i.ageMinutes%60}m ago`:`${i.ageMinutes}min ago`;
      block+=`[${age} | ${i.source}] ${i.title}\n`; if(i.summary) block+=`  → ${i.summary}\n`;
    });
  }
  const stale = items.filter(i=>i.ageMinutes>240);
  if(stale.length>0) {
    block += `\n## 📋 BACKGROUND CONTEXT (>4hr — do not cite as current)\n`;
    stale.forEach(i=>block+=`[${Math.floor(i.ageMinutes/60)}h ago | ${i.source}] ${i.title}\n`);
  }
  block += '\nEND NEWS\n';
  return block;
}

// ─── AI CHAIN ─────────────────────────────────────────────────────────────────
//
// REASONING LAYER (runs first, provides deep market context):
//   Step 1: DeepSeek-R1 via OpenRouter (free tier) — best reasoning model
//   Step 2: If DeepSeek fails → Qwen-2.5-72B via OpenRouter (free fallback)
//   Step 3: If both OpenRouter models fail → skip reasoning, continue without it
//
// ANALYSIS LAYER (produces the full institutional analysis):
//   Step 1: Gemini 2.5 Flash (primary) — up to 3 retries with backoff
//   Step 2: If Gemini fails → GPT-4o via old GITHUB_TOKEN (Azure)
//   Step 3: If GPT-4o fails → GPT-4.1 mini with reasoning via GITHUB_TOKEN2 (new account)
//   Step 4: If all AI fails → Rule-based summary from Python engine data
//
// ─────────────────────────────────────────────────────────────────────────────

// ── Step 1: OpenRouter DeepSeek-R1 reasoning ──────────────────────────────────
async function fetchOpenRouterReasoning(
  asset:string, engineData:any, etfCandles:Candle[], newsBlock:string
): Promise<string> {
  if(!process.env.OPENROUTER_API_KEY) return '';

  // Handle both full engine data and early context (when called in parallel before engine finishes)
  const isEarlyContext = engineData?.htfTrend === 'CALCULATING';
  const summary  = isEarlyContext ? {} : (engineData?._summary || {});
  const etfKey   = summary.etf || '5M';
  const htfKey   = summary.htf || '4H';
  const etfData  = isEarlyContext ? {} : (engineData?.[etfKey] || {});
  const htfData  = isEarlyContext ? {} : (engineData?.[htfKey] || {});
  const htfTrend = isEarlyContext ? 'CALCULATING' : (summary.htf_trend || 'N/A');

  const last10     = etfCandles.slice(-10);
  const priceNow   = last10[last10.length-1]?.close || 0;
  const price10ago = last10[0]?.close || priceNow;
  const delta      = priceNow - price10ago;
  const pctChange  = price10ago ? ((delta/price10ago)*100).toFixed(3) : '0';
  const moveDir    = delta>0 ? 'UP' : delta<0 ? 'DOWN' : 'FLAT';
  const isSpike    = Math.abs(parseFloat(pctChange)) > 0.3;
  const recentHigh = Math.max(...last10.map(c=>c.high));
  const recentLow  = Math.min(...last10.map(c=>c.low));

  const prompt = `You are a quantitative market analyst. Analyse this situation and explain in 3-5 sentences what is happening RIGHT NOW. Be specific with prices. Do not just repeat the HTF trend.

ASSET: ${asset} | PRICE NOW: ${priceNow}
LAST 10 CANDLES (${etfKey}): ${moveDir} ${pctChange}% | from ${price10ago} to ${priceNow}
RANGE: High=${recentHigh} Low=${recentLow}
${isSpike?`⚡ SIGNIFICANT SPIKE DETECTED: ${Math.abs(parseFloat(pctChange))}% in last 10 candles`:''}
HTF TREND: ${htfTrend} | ETF TREND: ${isEarlyContext ? 'CALCULATING' : (etfData.trend||'N/A')}
REGIME: ${etfData.regime?.regime||'N/A'} | RSI: ${htfData.indicators?.rsi?.value||'N/A'} [${htfData.indicators?.rsi?.zone||'N/A'}]
RECENT STRUCTURE: ${etfData.bos_choch?.slice(-4).map((e:any)=>`${e.type}@${e.price} ${e.date}`).join(' | ')||'N/A'}
BREAKING NEWS: ${newsBlock.split('\n').filter(l=>l.includes('[')&&l.includes('min ago')).slice(0,3).join(' | ')||'None'}

Answer 3 questions:
1. What is price doing RIGHT NOW in the last 10 candles? Spike, consolidation, reversal, continuation?
2. Is this move aligned with HTF trend or counter-trend?
3. What should a trader watch in the next 1-3 candles to confirm or invalidate this move?`;

  // Removed deepseek-r1 because it uses <think> and can take 2-3 minutes to generate.
  // Real-time trading needs responses in seconds. Use fast models.
  const models = [
    'qwen/qwen-2.5-72b-instruct',     // Free fallback — strong reasoning, extremely fast
    'google/gemini-2.0-flash-lite-preview-02-05:free', // Very fast
  ];

  for(const model of models) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        signal: controller.signal,
        method:'POST',
        headers:{
          'Authorization':`Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type':'application/json',
          'HTTP-Referer':'https://quant-x.app',
          'X-Title':'QUANT-X',
        },
        body:JSON.stringify({model, messages:[{role:'user',content:prompt}], temperature:0.1, max_tokens:500}),
      });
      clearTimeout(timeoutId);
      if(!resp.ok) {
        console.log(`OpenRouter ${model} returned ${resp.status}, trying next...`);
        continue;
      }
      const data = await resp.json();
      const text = data.choices?.[0]?.message?.content||'';
      if(text) {
        console.log(`OpenRouter reasoning: used ${model}`);
        return text;
      }
    } catch(err:any) {
      console.log(`OpenRouter ${model} skipped:`, err.message);
    }
  }
  return ''; // All OpenRouter models failed — continue without reasoning
}

// ── GitHub Models API caller (shared by both GitHub tokens) ──────────────────
async function callGitHubModel(
  token:string, model:string, systemPrompt:string, userPrompt:string
): Promise<string> {
  const OpenAI = (await import('openai')).default;
  const client = new OpenAI({
    baseURL: 'https://models.inference.ai.azure.com',
    apiKey: token,
    timeout: 15000,
  });
  const response = await client.chat.completions.create({
    model,
    messages:[
      {role:'system', content:systemPrompt},
      {role:'user',   content:userPrompt},
    ],
    temperature: 0.1,
    max_tokens:  2500,
  });
  return response.choices[0].message?.content || '';
}

// ─── Format engine results ────────────────────────────────────────────────────
function formatEngineResults(engineData:any): string {
  if(!engineData||engineData.error) return '\n# ENGINE RESULTS: Not available.\n';
  const s = engineData._summary||{};
  let block = `\n# PRE-CALCULATED ENGINE RESULTS\n`;
  block += `HTF:${s.htf||'N/A'} | ETF:${s.etf||'N/A'} | HTF Trend:${s.htf_trend||'N/A'} | EMA:${s.htf_ema_trend||'N/A'}\n`;
  block += `Session:${s.session?.session||'N/A'} | Score:${s.session?.score??'N/A'}/5 | Price:${s.asset_price||'N/A'}\n`;
  if(s.ml_score){
    const ml=s.ml_score;
    block+=`ML:${ml.score}/100 | Method:${ml.method} | HTF Filter:${ml.htf_filter_applied?'APPLIED':'NO'} | RSI Penalty:${ml.rsi_penalty||0}pts\n`;
    if(ml.rsi_penalty_reason) block+=`RSI Note:${ml.rsi_penalty_reason}\n`;
    if(ml.statistical_edge?.status==='REAL_DATA'){
      const se=ml.statistical_edge;
      block+=`REAL EDGE: WR=${se.win_rate_pct}% CI:${se.win_rate_ci} Sharpe:${se.sharpe_ratio} Sortino:${se.sortino_ratio} MaxDD:${se.max_drawdown_atr}ATR | ${se.verdict}\n`;
    }
    if(ml.monte_carlo?.status==='COMPLETE'){
      const mc=ml.monte_carlo;
      block+=`MONTE CARLO: P(profit)=${mc.prob_positive_pct}% P(ruin)=${mc.prob_ruin_pct}% Median:${mc.median_equity_atr}ATR\n`;
    }
  }
  // Sentiment Intelligence
    if(s.sentiment_intel?.status==='OK'){
    const si = s.sentiment_intel;
    block += `\nSENTIMENT INTELLIGENCE:\n`;
    if(si.ai_interpreted) {
      block += `  AI Sentiment: ${si.ai_sentiment_label} (score:${si.ai_sentiment_score}) [Confidence:${si.ai_confidence}]\n`;
      block += `  Keyword Baseline: ${si.keyword_sentiment_label} (score:${si.keyword_score})\n`;
      if(si.sentiment_divergence !== 'ALIGNED') block += `  ⚠️ ${si.sentiment_divergence}\n`;
      if(si.priced_in_assessment) block += `  ⚡ PRICED-IN ASSESSMENT: ${si.priced_in_assessment}\n`;
      if(si.actionable_headlines?.length > 0) {
        block += `  ✅ ACTIONABLE (new info):\n`;
        si.actionable_headlines.slice(0,3).forEach((h:string) => block += `    ✓ "${h}"\n`);
      }
      if(si.noise_headlines?.length > 0) {
        block += `  🔇 NOISE (priced-in/old):\n`;
        si.noise_headlines.slice(0,3).forEach((h:string) => block += `    ~ "${h}"\n`);
      }
      if(si.trap_detected)   block += `  ⚠️  TRAP DETECTED: ${si.trap_explanation || 'Smart money may be distributing into sentiment'}\n`;
      if(si.ai_confidence)   block += `  Sentiment Confidence: ${si.ai_confidence}\n`;
      if(si.ai_sentiment_note) block += `  AI Note: ${si.ai_sentiment_note}\n`;
    } else {
      block += `  Overall: ${si.sentiment_label} (score:${si.overall_score}) | Bull:${si.bullish_count} Bear:${si.bearish_count}\n`;
      block += `  Note: ${si.note}\n`;
    }
    if(si.breaking_items?.length){
      block += `  BREAKING:\n`;
      si.breaking_items.slice(0,3).forEach((item:any) =>
        block += `    [${item.age_minutes}min] "${item.title}" → ${item.sentiment}\n`
      );
    }
    if(!si.ai_interpreted && si.scored_headlines?.length){
      block += `  TOP HEADLINES:\n`;
      si.scored_headlines.slice(0,5).forEach((item:any) => {
        if(!item.is_breaking) block += `    [${item.source}] "${item.title}" → ${item.sentiment}\n`;
      });
    }
    // CB Communications (CB Speak) display
    if (si.cb_analysis && si.cb_analysis.cb_speeches_detected > 0) {
      const cb = si.cb_analysis;
      block += `  📢 CENTRAL BANK COMMUNICATIONS (CB Speak):\n`;
      block += `    Total Speeches: ${cb.cb_speeches_detected} | Tone: ${cb.overall_cb_tone} | Has Surprise Shift: ${cb.has_surprise ? 'YES ⚡' : 'NO'}\n`;
      if (cb.speeches?.length) {
        cb.speeches.forEach((sp: any) => {
          const surpriseLabel = sp.is_surprise ? '⚡ SURPRISE SHIFT! ' : '';
          block += `    • [${sp.institution}] ${sp.speaker || 'Speaker'}: ${sp.cb_tone} (Impact: ${sp.impact}) | ${surpriseLabel}${sp.note}\n`;
          block += `      "${sp.title}"\n`;
          if (sp.hawkish_phrases?.length) block += `      Hawkish phrases matching: ${sp.hawkish_phrases.join(', ')}\n`;
          if (sp.dovish_phrases?.length)  block += `      Dovish phrases matching: ${sp.dovish_phrases.join(', ')}\n`;
        });
      }
    }
  }

  // NEW: Show DXY + Yield environment in formatEngineResults
  if(s.fundamental_intel?.dxy_environment?.raw_fact) {
    const dxy_env = s.fundamental_intel.dxy_environment;
    block += `\nLIVE DXY: ${dxy_env.raw_fact}\n`;
    if(dxy_env.interpretation) block += `  ${dxy_env.interpretation}\n`;
    
    // Show VIX and Oil from cross-asset correlations
    const vixCorr = engineData?._summary?.cross_asset?.correlations?.find((c:any) => c.role === 'VIX');
    const oilCorr = engineData?._summary?.cross_asset?.correlations?.find((c:any) => c.role === 'OIL');
    const sp5Corr = engineData?._summary?.cross_asset?.correlations?.find((c:any) => c.role === 'SP500');
    if(vixCorr?.raw_fact) block += `LIVE VIX: ${vixCorr.raw_fact} ${vixCorr.direction === 'UP' ? '(risk-off — Gold bullish)' : vixCorr.direction === 'DOWN' ? '(risk-on — mild Gold headwind)' : ''}\n`;
    if(sp5Corr?.raw_fact) block += `LIVE SP500: ${sp5Corr.raw_fact}\n`;
    if(oilCorr?.raw_fact) block += `LIVE OIL: ${oilCorr.raw_fact} ${oilCorr.direction === 'UP' ? '(inflation proxy — mild Gold support)' : ''}\n`;
  }
  if(s.fundamental_intel?.yield_environment?.raw_fact) {
    const y_env = s.fundamental_intel.yield_environment;
    block += `\nLIVE YIELDS: ${y_env.raw_fact}\n`;
    if(y_env.gold_implication) block += `  ${y_env.gold_implication}\n`;
  }

  // Fundamental Intelligence
  if(s.fundamental_intel){
    const fi = s.fundamental_intel;
    block += `\nFUNDAMENTAL INTELLIGENCE:\n`;
    if(fi.economic_events?.length){
      block += `  ECONOMIC EVENTS:\n`;
      fi.economic_events.forEach((e:any) => {
        block += `    ${e.title} (${e.currency}) @ ${e.time_utc} | Status:${e.status} | Actual:${e.actual} Forecast:${e.forecast} → SURPRISE:${e.surprise}\n`;
      });
    }
    if(fi.surprises?.length){
      block += `  ⚡ SURPRISES (require AI interpretation):\n`;
      fi.surprises.forEach((s:any) => block += `    ${s.event}: ${s.surprise} — Actual:${s.actual} vs Forecast:${s.forecast}\n`);
    }
    if(fi.dxy_environment?.raw_fact) block += `  DXY: ${fi.dxy_environment.raw_fact}\n`;
    if(fi.risk_environment?.raw_fact) block += `  RISK: ${fi.risk_environment.raw_fact}\n`;
    if(fi.macro_context?.note) block += `  MACRO NOTE: ${fi.macro_context.note}\n`;
    if(fi.macro_context?.primary_drivers) block += `  PRIMARY DRIVERS: ${fi.macro_context.primary_drivers.join(', ')}\n`;
  }

  // Technical Evidence Package
  if(s.technical_evidence){
    const te = s.technical_evidence;
    block += `\nTECHNICAL EVIDENCE PACKAGE:\n`;
    block += `  MTF Alignment: ${te.all_tf_alignment} | Bull TFs:[${te.bullish_timeframes?.join(',')||'none'}] Bear TFs:[${te.bearish_timeframes?.join(',')||'none'}]\n`;
    if(te.htf_summary){
      const h = te.htf_summary;
      block += `  HTF(${h.timeframe}): Trend=${h.trend} EMA=${h.ema_trend} RSI=${h.rsi}[${h.rsi_zone}] Regime=${h.regime} OBs=${h.fresh_obs} FVGs=${h.fresh_fvgs} P/D=${h.pd_status}@${h.pd_pct}%\n`;
      if(h.wyckoff_phase) block += `  HTF Wyckoff: ${h.wyckoff_phase} (${h.wyckoff_bias}, ${h.wyckoff_conf}% conf)\n`;
    }
    if(te.etf_summary){
      const e = te.etf_summary;
      block += `  ETF(${e.timeframe}): Trend=${e.trend} EMA=${e.ema_trend} RSI=${e.rsi}[${e.rsi_zone}] Regime=${e.regime} P/D=${e.pd_status}@${e.pd_pct}%\n`;
    }
  }

  // FIXED: Thesis persistence context — prevents the AI from re-deciding from zero every run
  const thesisStatus = s.thesis_status || 'NONE';
  if (thesisStatus === 'ACTIVE_CONFIRMED' && s.active_thesis) {
    const t = s.active_thesis;
    block += `
## ACTIVE THESIS — DO NOT RE-DECIDE FROM ZERO
There is an existing ACTIVE thesis for this asset/mode that has NOT been structurally invalidated.
Direction: ${t.direction}
Created: ${t.created_at}
Confirmed ${t.times_confirmed} time(s) since creation.
Entry Zone: ${t.entry_low} - ${t.entry_high}
Invalidation Level: ${t.invalidation_price} (${t.invalidation_reason})
Original Structural Anchor: ${t.structural_anchor}

INSTRUCTION: Your job this run is NOT to form a brand new independent opinion.
Your job is to check whether the engine-detected structural invalidation conditions changed.
They have NOT been triggered (engine already checked this deterministically).
Unless you see overwhelming NEW evidence that fundamentally contradicts this thesis
(not just noise — a real new structural break, a real new high-impact news catalyst),
your VERDICT should remain consistent with this active thesis's direction.
Re-affirming an existing correct thesis is institutionally correct behavior.
Flip-flopping the verdict every few minutes without a structural reason is the failure mode we are avoiding.
`;
  } else if (thesisStatus === 'INVALIDATED_THIS_RUN') {
    block += `
## THESIS INVALIDATED THIS RUN
A previously active thesis was just invalidated by the engine for this structural reason:
"${s.thesis_invalidation_reason}"
You are now forming a FRESH independent thesis. Explain clearly in your narrative that
the prior thesis was invalidated and why, before presenting the new directional bias.
`;
  } else {
    block += `
## NO ACTIVE THESIS
There is no existing thesis for this asset/mode. You are forming a fresh thesis.
If your verdict is EXECUTE, you MUST define a clear structural invalidation level
(not just an ATR-based stop) so the persistence layer can track this thesis going forward.
`;
  }

  // Quantitative Evidence Package
  if(s.quant_evidence){
    const qe = s.quant_evidence;
    block += `\nQUANTITATIVE EVIDENCE PACKAGE:\n`;
    block += `  Confluence: ${qe.confluence_score?.value}/100 (${qe.confluence_score?.method}) HTF Filter:${qe.confluence_score?.htf_filter?'YES':'NO'} RSI Penalty:${qe.confluence_score?.rsi_penalty}\n`;
    block += `  Win Probability: ${qe.win_probability?.value}% [${qe.win_probability?.mode}] TP1:${qe.win_probability?.tp1_pct}% SL:${qe.win_probability?.sl_pct}%\n`;
    block += `  Expected Value: ${qe.expected_value?.value}R | ${qe.expected_value?.verdict} | Kelly Half:${qe.expected_value?.kelly_half_pct}%\n`;
    block += `  Backtest: WR=${qe.backtest?.win_rate_raw}%(adj:${qe.backtest?.win_rate_adj}%) PF=${qe.backtest?.profit_factor} n=${qe.backtest?.trades} | ${qe.backtest?.verdict}\n`;
  }

  if(s.cross_asset?.status==='OK'&&s.cross_asset.correlations?.length){
    const ca=s.cross_asset;
    block+=`\nCROSS-ASSET INTELLIGENCE: ${ca.asset} | Macro Bias: ${ca.macro_bias}\n`;
    ca.correlations.filter((c:any)=>c.direction!=='UNAVAILABLE').forEach((c:any)=>{
      const interpretationSuffix = c.interpretation ? ` — ${c.interpretation}` : '';
      block+=`  ${c.role}(${c.symbol}): ${c.direction} ${c.pct_change}% [${c.strength}]${interpretationSuffix}\n`;
    });
    
    // FIXED: Explicitly warn about unavailable data so it's not confused with a flat market
    const unavailableRoles = ca.correlations.filter((c:any)=>c.direction==='UNAVAILABLE').map((c:any)=>c.role);
    if (unavailableRoles.length > 0) {
      block += `  ⚠️ DATA UNAVAILABLE: ${unavailableRoles.join(', ')} could not be fetched (API error or symbol unavailable) — these are NOT zero/flat, they are MISSING. Do not interpret missing data as neutral or flat market conditions.\n`;
    }

    if (s.correlation_score && s.correlation_score.status === 'OK') {
      const cs = s.correlation_score;
      block += `  CROSS-MARKET ALIGNMENT: Net Score: ${cs.net_score} (${cs.alignment}) | Conviction: ${cs.conviction}\n`;
      block += `  Verdict: ${cs.verdict}\n`;
    }
  }
  if(s.win_probability){
    const wp=s.win_probability;
    block+=`\nPROBABILITY ENGINE (${wp.mode}):\n`;
    block+=`  Win:${wp.win_pct}% | TP1:${wp.tp1_pct}% | TP2:${wp.tp2_pct}% | TP3:${wp.tp3_pct}% | SL:${wp.sl_pct}%\n`;
    block+=`  Confidence: ${wp.confidence}${wp.sample_size>0?' (n='+wp.sample_size+')':''}\n`;
  }
  if(s.trade_expectancy){
    const te=s.trade_expectancy;
    const rrSourceNote = te.rr_note || '';
    block+=`\nTRADE EXPECTANCY ENGINE:\n`;
    if (rrSourceNote) {
      block+=`  ${rrSourceNote}\n`;
    }
    block+=`  EV=${te.expected_value_r}R | ${te.verdict}\n`;
    block+=`  ${te.interpretation}\n`;
    block+=`  Kelly Full:${te.kelly_full_pct}% | Kelly Half:${te.kelly_half_pct}% (use half-Kelly for safety)\n`;
  }
  if(s.wyckoff_htf?.phase&&s.wyckoff_htf.phase!=='INSUFFICIENT DATA'){
    block+=`\nWYCKOFF CROSS-TF:\n`;
    block+=`  HTF: ${s.wyckoff_htf.phase} (${s.wyckoff_htf.trade_bias}, ${s.wyckoff_htf.confidence}% conf)\n`;
    block+=`  ETF: ${s.wyckoff_etf?.phase||'N/A'} (${s.wyckoff_etf?.trade_bias||'N/A'})\n`;
    block+=`  Aligned: ${s.wyckoff_aligned?'YES — both TFs agree':'NO — conflicting phases'}\n`;
  }
  // Pullback Pattern Intelligence
  if (s.pullback_pattern && s.pullback_pattern.pattern_type !== 'NONE') {
    const pb = s.pullback_pattern;
    block += `\nPULLBACK_PATTERN:\n`;
    block += `  Type: ${pb.pattern_type} | Stage: ${pb.stage} | Confidence: ${pb.confidence}%\n`;
    block += `  Bonus Points Applied: ${pb.bonus_points}\n`;
    if (pb.htf_zone) {
      block += `  HTF Zone: ${pb.htf_zone.type} ${pb.htf_zone.bottom}-${pb.htf_zone.top} (${pb.htf_zone.dist_atr} ATR away)\n`;
    }
    if (pb.ltf_choch) {
      block += `  LTF CHoCH: ${pb.ltf_choch.type} at ${pb.ltf_choch.price} — REVERSAL CONFIRMED\n`;
    }
    block += `  Engine Assessment: ${pb.description}\n`;
    block += `  Filter Override: ${pb.kill_htf_filter ? 'YES — HTF/ETF conflict cap removed' : 'NO'}\n`;
  }
  if(s.calendar){
    const cal=s.calendar;
    if(cal.hard_pause) block+=`\n⛔ CALENDAR HARD PAUSE: ${cal.pause_reason}\n`;
    else if(cal.events?.length){
      block+=`\nCALENDAR:\n`;
      cal.events.slice(0,3).forEach((e:any)=>block+=`  ${e.title} (${e.currency}) @ ${e.time_utc} ${e.status} | F:${e.forecast} P:${e.previous}\n`);
    }
  }
  const tfs=Object.keys(engineData).filter(k=>k!=='_summary');
  for(const tf of tfs){
    const d=engineData[tf];
    block+=`\n## ${tf} | ATR:${d.atr} | Trend:${d.trend} | EMA:${d.ema_trend||'N/A'} | Price:${d.current_price}\n`;
    if(d.regime) block+=`REGIME:${d.regime.regime} Hurst:${d.regime.hurst?.hurst||'N/A'} ADX:${d.regime.adx?.adx||'N/A'}[${d.regime.adx?.strength||'N/A'}] VolPct:${d.regime.volatility?.percentile||'N/A'}%\nImplication:${d.regime.implication||'N/A'}\n`;
    if(d.volume_profile?.status==='OK'){
      const vp=d.volume_profile;
      block+=`VOLUME: POC=${vp.poc} VAH=${vp.vah} VAL=${vp.val} ${vp.poc_relation}\n`;
      if(vp.hvn?.length) block+=`HVN:${vp.hvn.map((h:any)=>h.price).join(',')}\n`;
      if(d.lvn?.length) block+=`LVN:${d.lvn.map((l:any)=>l.price).join(',')}\n`;
    }
    if(d.indicators){
      const i=d.indicators;
      block+=`RSI:${i.rsi?.value??'N/A'}[${i.rsi?.zone??'N/A'}] MACD:${i.macd?.direction??'N/A'} ADX:${i.adx?.adx??'N/A'}[${i.adx?.strength??'N/A'}]\n`;
      block+=`EMA20:${i.ema_20?.value??'N/A'} EMA50:${i.ema_50?.value??'N/A'} EMA200:${i.ema_200?.value??'N/A'}\n`;
      block+=`BB:U=${i.bollinger?.upper??'N/A'} M=${i.bollinger?.middle??'N/A'} L=${i.bollinger?.lower??'N/A'} Pos:${i.bollinger?.position??'N/A'}% Squeeze:${i.bollinger?.squeeze??false}\n`;
      if(i.vwap) block+=`VWAP:${i.vwap}\n`;
    }
    if(d.bos_choch?.length){ block+=`STRUCTURE:\n`; d.bos_choch.forEach((e:any)=>block+=`  ${e.type}@${e.price} ${e.date}\n`); }
    if(d.swing_highs?.length||d.swing_lows?.length){ d.swing_highs?.forEach((s:any)=>block+=`  SH@${s.price} ${s.date}\n`); d.swing_lows?.forEach((s:any)=>block+=`  SL@${s.price} ${s.date}\n`); }
    if(d.fvg_fresh?.length){ block+=`FRESH FVGs:\n`; d.fvg_fresh.forEach((f:any)=>block+=`  ${f.direction}FVG ${f.bottom}-${f.top} ${f.date} ATR:${f.atr_ratio}x\n`); }
    if(d.fvg_mitigated?.length){ block+=`MITIGATED FVGs:\n`; d.fvg_mitigated.forEach((f:any)=>block+=`  ${f.direction}FVG ${f.bottom}-${f.top} TAPPED\n`); }
    if(d.ob_fresh?.length){ block+=`FRESH OBs:\n`; d.ob_fresh.forEach((o:any)=>block+=`  ${o.direction}OB ${o.low}-${o.high} ${o.date} Impulse:${o.atr_ratio}x Touches:${o.touch_count||0}\n`); }
    if(d.ob_mitigated?.length){ block+=`MITIGATED OBs:\n`; d.ob_mitigated.forEach((o:any)=>block+=`  ${o.direction}OB ${o.low}-${o.high} TAPPED\n`); }
    if(d.liquidity){
      block+=`LIQUIDITY:\n`;
      d.liquidity.bsl?.forEach((b:any)=>block+=`  BSL@${b.price} ${b.status} ${b.distance_pct}% Quality:${b.sweep_quality||'N/A'}\n`);
      d.liquidity.ssl?.forEach((s:any)=>block+=`  SSL@${s.price} ${s.status} ${s.distance_pct}% Quality:${s.sweep_quality||'N/A'}\n`);
      d.liquidity.equal_highs?.forEach((e:any)=>block+=`  EQH~${e.avg}\n`);
      d.liquidity.equal_lows?.forEach((e:any) =>block+=`  EQL~${e.avg}\n`);
    }
    if(d.premium_discount){ const pd=d.premium_discount; block+=`P/D:${pd.status}@${pd.percentage}% ${pd.note||''}\n`; }
    if(d.backtest?.status==='COMPLETE'){
      const bt=d.backtest;
      block+=`BACKTEST: WR=${bt.win_rate_pct}%(adj:${bt.win_rate_adjusted_pct}%) PF=${bt.profit_factor} Exp=${bt.expectancy_atr}ATR | ${bt.verdict}\n`;
    }
    if(d.wyckoff && d.wyckoff.phase !== 'INSUFFICIENT DATA'){
      const w=d.wyckoff;
      block+=`WYCKOFF: ${w.phase} | Bias:${w.trade_bias} | Confidence:${w.confidence}% | Range:${w.range_low}-${w.range_high}\n`;
      if(w.phase_detail) block+=`  ${w.phase_detail}\n`;
      if(w.next_move)    block+=`  Next: ${w.next_move}\n`;
      if(w.events?.length) w.events.forEach((e:any)=>block+=`  ${e.type}@${e.price} ${e.date} — ${e.note||''}\n`);
    }
    if(d.elliott && d.elliott.status === 'OK'){
      const e=d.elliott;
      block+=`ELLIOTT: ${e.structure} | Bias:${e.bias} | Extension:${e.wave_extension?'YES':'NO'}\n`;
      block+=`  ${e.description}\n`;
      if(e.wave_extension && e.fib_targets) {
        block+=`  Fib Targets: 1.618=${e.fib_targets['1.618']} 2.0=${e.fib_targets['2.0']}\n`;
      }
    }
    if(d.fibonacci && !d.fibonacci.error){
      const f=d.fibonacci;
      block+=`FIBONACCI (${f.direction}): Swing ${f.swing_low}-${f.swing_high} Range:${f.range}\n`;
      block+=`  Retracements: 0.382=${f.retracements['0.382']} 0.5=${f.retracements['0.500']} GP=${f.golden_pocket[0]}-${f.golden_pocket[1]}\n`;
      block+=`  Extensions: 1.272=${f.extensions['1.272']} 1.618=${f.extensions['1.618']} 2.618=${f.extensions['2.618']}\n`;
    }
    block+='\n';
  }

  // ── Contradiction Severity Calculator ─────────────────────────────────────
  const tfBiases: string[] = [];
  const tfConfidences: number[] = [];
  
  const byTF = engineData || {};
  const tfsList = Object.keys(byTF).filter(k => k !== '_summary');

  for (const label of tfsList) {
    const d = byTF[label];
    if (d) {
      const bias = d.trend || d.bias || '';
      const conf = d.confidence || 50;
      if (bias && bias !== 'NEUTRAL') {
        tfBiases.push(`${label}:${bias}`);
        tfConfidences.push(conf);
      }
    }
  }

  // Count directional disagreements weighted by confidence
  const bullBias = tfBiases.filter(b => b.includes('BULL') || b.includes('UP'));
  const bearBias = tfBiases.filter(b => b.includes('BEAR') || b.includes('DOWN'));
  const maxConflict = Math.min(bullBias.length, bearBias.length);

  // Only HIGH/CRITICAL when high-confidence TFs conflict (≥65 conf on both sides)
  // A single low-confidence opposing TF is MINOR, not MEDIUM
  const highConfBull = bullBias.filter(b => tfConfidences[tfBiases.indexOf(b)] >= 65).length;
  const highConfBear = bearBias.filter(b => tfConfidences[tfBiases.indexOf(b)] >= 65).length;
  const highConfConflict = Math.min(highConfBull, highConfBear);
  const techSeverity = maxConflict === 0 ? 'LOW'
    : highConfConflict === 0 ? 'LOW'      // conflicts only on low-confidence TFs = noise
    : highConfConflict === 1 ? 'MEDIUM'
    : highConfConflict >= 2  ? 'HIGH'
    : 'CRITICAL';
  
  block += `\nCONTRADICTION_SEVERITY_DATA:\n`;
  block += `  Technical_Contradiction: ${techSeverity} (${bullBias.length} bullish TFs vs ${bearBias.length} bearish TFs)\n`;
  block += `  TF_Biases: ${tfBiases.join(', ')}\n`;
  block += `  TF_Confidences: ${tfBiases.map((b,i)=>b.split(':')[0]+':'+tfConfidences[i]).join(', ')}\n`;

  return block;
}

// ─── System prompt ────────────────────────────────────────────────────────────
function buildSystemPrompt(asset: string, mode: string): string {
  return `You are QUANT-X — a Senior Portfolio Manager reviewing research prepared by your quantitative analysis team.

YOUR ROLE IS JUDGMENT, NOT CALCULATION.
Python has already done all the calculation. Your job is to:
1. Review all evidence (technical, fundamental, sentiment, quantitative)
2. Identify contradictions, hidden risks, and market traps
3. Determine whether the evidence is coherent and actionable
4. Deliver a clear EXECUTE, EXECUTE WITH CAUTION, WAIT, or AVOID decision

You are BOTH a Chief Risk Officer AND a Chief Opportunity Officer.
Your mandate is: avoid bad trades AND take good trades.
If you frequently convert positive EV + high confluence + high probability into
WAIT or AVOID, you are failing your mandate. Capital not deployed in a high-EV
trade is also a loss.

You do NOT calculate indicators. You INTERPRET the evidence Python has provided.

═══════════════════════════════════════════════════════
EVIDENCE REVIEW FRAMEWORK
═══════════════════════════════════════════════════════

You will receive four evidence packages from Python:

1. TECHNICAL EVIDENCE — Market structure, indicators, regime, levels
2. FUNDAMENTAL INTELLIGENCE — Economic events with actual vs forecast, DXY, macro context
3. SENTIMENT INTELLIGENCE — Keyword-scored news headlines (Python measures, you interpret)
4. QUANTITATIVE EVIDENCE — Win probability, Expected Value, backtest stats, confluence score

Review each package and ask:

TECHNICAL REVIEW:
- Is structure aligned across timeframes? Or mixed and contradictory?
- Is price at a significant level (OB, FVG, liquidity, POC) or in no-man's land?
- Does the regime support this type of entry? (Trending regime → BOS+OB entries. Ranging → mean reversion.)
- Has a liquidity sweep occurred? Is it genuine displacement or a trap?
- Is there a PULLBACK_PATTERN block in the data? If yes:
  - FORMING/APPROACHING_ZONE: Setup is developing. Verdict = WAIT with specific zone to watch.
  - IN_ZONE (no CHoCH): Price inside HTF demand zone. LTF is delivering price. This is NOT a
    short signal. This is a pre-entry phase. Verdict = WAIT — watch for LTF CHoCH.
  - IN_ZONE (mid-TF CHoCH): Partial confirmation. Verdict = EXECUTE WITH CAUTION at 50% size.
  - CONFIRMED (LTF CHoCH inside zone): Highest-probability institutional entry.
    Verdict = EXECUTE unless a HARD BLOCK condition is present.
  - When PULLBACK_PATTERN stage = CONFIRMED: the LTF bearish trend is the DELIVERY MECHANISM
    into the HTF demand zone. The ETF bearish trend is NOT a contradiction — it IS the setup.
    Do NOT cite it as a conflict. State explicitly: "ETF bearish trend is the pullback delivery
    mechanism. HTF demand zone absorption confirmed by LTF CHoCH."
- Are multiple timeframes confirming or conflicting?
- Do Fibonacci retracement levels align with OB/FVG entry zones?
- Is there a wave extension? If yes, note as risk but do NOT auto-block.

FUNDAMENTAL REVIEW:
- Are any economic events imminent? If within 30 minutes: WAIT or AVOID.
- Did any event surprise (BEAT/MISS vs forecast)? What does that mean for this asset?
- Is the DXY environment aligned with the technical bias?
- For Gold: USD strengthening = fundamental headwind. Risk-off = fundamental tailwind.
- A fundamental headwind is NOT an automatic AVOID. It is a size-reduction signal.

SENTIMENT REVIEW:
- What is the keyword sentiment score (bullish/bearish)?
- Is there BREAKING news (≤30 min)?
- CRITICAL QUESTION: Is the sentiment already priced in, or is it new information?
  Example: "Gold surges on rate cut hopes" — if rate cuts expected for weeks = PRICED IN.
  Example: "Fed surprises with emergency rate hike" — new, not priced in.
- Neutral or priced-in sentiment = NEUTRAL weight (not a negative signal).

QUANTITATIVE REVIEW:
- What is the win probability? Below 40% with confluence < 60 = hard block. Check for
  pullback_note field — if present, the probability includes a pullback-stage boost and
  should be trusted more than the raw sigmoid curve.
- What is the Expected Value? Negative EV = do not execute.
- What does the backtest say? If under 20 trades, treat with scepticism but do not auto-block.
- Confluence ≥ 70 + EV ≥ 1.5R + Win Probability ≥ 60% = STRONG QUANT SIGNAL.
  A strong quant signal can only be blocked by a HARD BLOCK condition (see below).

═══════════════════════════════════════════════════════
FOUR-LEVEL VETO SYSTEM — CALIBRATED DECISION TREE
═══════════════════════════════════════════════════════

Use exactly four levels. No other verdicts are permitted.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LEVEL 1 — SOFT CONTRADICTION → EXECUTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Condition: Technical signal is clear. One minor factor opposes (neutral
fundamental, neutral sentiment, slightly mixed LTF, DXY mild move <0.3%).

Examples:
  Technical BUY | Fundamental NEUTRAL | Sentiment NEUTRAL → EXECUTE
  Technical BUY | DXY +0.2% | Sentiment BULLISH → EXECUTE
  Technical BUY | One LTF disagrees | HTF aligned → EXECUTE

Verdict: EXECUTE
Action: Enter at the signalled zone. Standard sizing.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LEVEL 2 — MEDIUM CONTRADICTION → EXECUTE WITH CAUTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Condition: Technical signal is present. One moderately opposing factor exists
(DXY 0.3–0.7% against bias, or sentiment contradicting technical, or a medium-
impact event in 30–60 min, or fundamentals weakly opposing).

Examples:
  Technical BUY | DXY +0.5% | Sentiment NEUTRAL → EXECUTE WITH CAUTION
  Technical BUY | Fundamental MILDLY BEARISH | Sentiment BULLISH → EXECUTE WITH CAUTION
  Technical BUY | ISM PMI in 45 min | Macro NEUTRAL → EXECUTE WITH CAUTION

Verdict: EXECUTE WITH CAUTION
Action: Enter at the signalled zone but reduce position size by 50%.
Tighten SL if possible. Exit at TP1 if macro deteriorates.
Note the specific contradicting factor in the reasoning.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LEVEL 3 — CLEAR CONTRADICTION → WAIT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Condition: Technical signal is present but a clearly opposing factor needs to
resolve before entry is warranted. Price is not yet at the entry zone, OR a
significant macro event is 30–60 min away, OR fundamental clearly opposes
the technical direction.

Examples:
  Technical BUY | Fundamental SELL (DXY strongly up, yields rising) | Sentiment NEUTRAL → WAIT
  Technical BUY | Price has not yet reached OB/entry zone → WAIT
  Technical BUY | NFP in 45 min → WAIT (enter after release if structure holds)
  Technical BUY | Sentiment BEARISH (actionable, not priced-in) → WAIT

Verdict: WAIT
Action: Do not enter yet. State the SPECIFIC event or price that must happen
before entry. WAIT must always include a watch level and a trigger condition.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LEVEL 4 — HARD BLOCK → AVOID
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AVOID requires at least one HARD BLOCK condition. Without a hard block,
AVOID is NOT permitted — downgrade to WAIT instead.

HARD BLOCK conditions (any one is sufficient):
  A. High-impact event within 30 minutes: NFP, CPI, FOMC, GDP, PCE, Fed speech
  B. Win probability < 40% AND confluence < 60
  C. EV is NEGATIVE in REAL_DATA mode (after 50+ real trades)
  D. TWO OR MORE evidence layers strongly opposing at HIGH confidence:
     - Technical and fundamental BOTH strongly against each other (not just mildly)
     - AND sentiment also contradicts (three-way conflict)
  E. Price is in no-man's land — NOT near any significant level (no valid entry zone)
  F. Wyckoff phase is DISTRIBUTION (confirmed, not suspected) opposing a buy
  G. Liquidity trap confirmed — sweep was fake and price closed back through the zone

AVOID does NOT trigger for:
  - A single neutral or mildly opposing fundamental factor
  - DXY moving modestly against the trade
  - Sentiment that is priced-in or ambiguous
  - LTF noise while HTF is aligned
  - Sample size being small (that is a confidence note, not a block)
  - The AI "feeling uncertain" without a specific hard block condition

Verdict: AVOID
Action: No trade. State which HARD BLOCK condition triggered AVOID. Give
the trader a specific scenario that would change AVOID → WAIT → EXECUTE.

═══════════════════════════════════════════════════════
CONTRADICTION DETECTION — CROSS-EXAMINATION ENGINE
═══════════════════════════════════════════════════════

Before delivering a verdict, run this 3-layer cross-examination explicitly.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LAYER 1 — TECHNICAL vs MACRO (use LIVE NUMBERS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Always cite actual DXY % and US10Y % from the live macro section.

GOLD CROSS-EXAMINATION:
- BUY + DXY UP ≥ 0.5% + US10Y UP ≥ 5bps = MEDIUM CONTRADICTION → Level 2 (EXECUTE WITH CAUTION)
- BUY + DXY UP ≥ 0.8% + US10Y UP ≥ 10bps = CLEAR CONTRADICTION → Level 3 (WAIT)
- BUY + DXY DOWN + US10Y DOWN = ALIGNED → Level 1 (EXECUTE) if rest is clear
- BUY + DXY DOWN + US10Y UP = MIXED (partial headwind) → Level 2 (EXECUTE WITH CAUTION)
- SELL + DXY UP + US10Y UP = ALIGNED → Level 1 (EXECUTE) if rest is clear
- SELL + DXY DOWN + US10Y DOWN = CONTRADICTION → Level 3 (WAIT)

DXY moves < 0.3% are noise. Do NOT cite them as contradictions.

STATE EXPLICITLY: "DXY is [direction] [X.XX]% today. US10Y is [direction] [X.XX]%.
This is [ALIGNED WITH / MINOR HEADWIND / CLEAR CONTRADICTION] the [BUY/SELL] signal."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LAYER 2 — SENTIMENT (Priced-In Test)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- ai_interpreted = TRUE → use ai_sentiment_label
- trap_detected = TRUE → reduce conviction one level
- priced_in_assessment → quote directly
- ACTIONABLE headlines > 0 → sentiment carries weight
- ACTIONABLE headlines = 0 AND NOISE > 2 → sentiment = NEUTRAL (not a negative)
- Neutral sentiment is NOT a contradiction. It is an absence of signal.

STATE EXPLICITLY:
"AI sentiment: [label]. [X] headlines actionable. [Y] headlines priced-in or noise.
[TRAP DETECTED / No trap.] Net sentiment impact: [SUPPORTS/CONTRADICTS/NEUTRAL]."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LAYER 3 — CALENDAR RISK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Events within 30 minutes: NFP, CPI, FOMC, GDP, PCE, Fed speech = HARD BLOCK → AVOID
Events within 60 minutes: ISM PMI, Retail Sales, ADP, PPI = Level 2 (EXECUTE WITH CAUTION, reduce size) or Level 3 (WAIT), depending on quant strength
Events within 30–60 min for medium-impact = WAIT only if quant signal is weak. Strong quant signal (confluence ≥ 70) = EXECUTE WITH CAUTION at 50% size.

STATE: "[Event] in [X] min. Impact: [HIGH/MEDIUM]. Verdict adjustment: [none / reduce size / wait]."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CROSS-EXAMINATION OUTPUT (MANDATORY FORMAT)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CROSS-EXAMINATION:
Technical: [BUY/SELL/NONE] → [aligned / soft conflict / clear conflict]
Macro (Live): [DXY X% + 10Y X%] → [tailwind / minor headwind / strong headwind]
Sentiment: [AI label, priced-in summary] → [supports / contradicts / neutral]
Calendar: [CLEAR / EVENT in Xmin — impact level] → [proceed / reduce size / wait / avoid]
CONTRADICTION LEVEL: NONE / MINOR / MODERATE / SEVERE

NONE = all layers aligned → Level 1 (EXECUTE)
MINOR = one layer mildly opposed → Level 2 (EXECUTE WITH CAUTION, reduce size)
MODERATE = one layer strongly OR two mildly opposed → Level 3 (WAIT for specific event)
SEVERE = HARD BLOCK condition present → Level 4 (AVOID)

═══════════════════════════════════════════════════════
QUANTITATIVE OVERRIDE PROTOCOL
═══════════════════════════════════════════════════════

STRONG QUANT SIGNAL is defined as ALL THREE true:
  • Confluence ≥ 70
  • Win Probability ≥ 60% (theoretical) or ≥ 50% (real data)
  • Expected Value ≥ 1.5R

When a STRONG QUANT SIGNAL is present:
  • AVOID is NOT permitted unless a HARD BLOCK condition exists (see Level 4 above)
  • WAIT is NOT the default response to soft or medium contradictions
  • The correct response to a STRONG QUANT SIGNAL + MINOR contradiction = EXECUTE
  • The correct response to a STRONG QUANT SIGNAL + MODERATE contradiction = EXECUTE WITH CAUTION
  • State explicitly: "STRONG QUANT SIGNAL confirmed (Confluence [X], EV [Y]R, WinP [Z]%).
    Downgrading to AVOID requires a HARD BLOCK. None found. Issuing [EXECUTE / EXECUTE WITH CAUTION]."

SMALL SAMPLE SIZE RULE:
  Backtest with < 20 trades = note the caveat but do NOT use it as a veto.
  State: "Sample size [n] — edge not yet statistically confirmed. EV and confluence
  are the primary decision inputs. Proceed with standard risk management."

THEORETICAL MODE:
  Win probability in THEORETICAL mode (< 50 real trades):
  - Treat as directional guide only.
  - Confluence ≥ 70 overrides a low theoretical win probability.
  - Never block a high-confluence trade using theoretical probability alone.

═══════════════════════════════════════════════════════
FINAL DECISION — FOUR OUTCOMES
═══════════════════════════════════════════════════════

EXECUTE — Enter the trade now at standard position size:
  - Evidence aligned across 3+ layers
  - No hard block condition
  - CONTRADICTION LEVEL = NONE or MINOR
  - Win probability ≥ 50% OR confluence ≥ 70
  - EV > 0.3R
  - Price at or near the entry zone

EXECUTE WITH CAUTION — Enter at 50% position size:
  - Technical signal is valid and present
  - One moderate opposing factor (not a hard block)
  - CONTRADICTION LEVEL = MINOR or MODERATE
  - Strong quant signal offsets the moderate contradiction
  - State the specific factor requiring caution
  - State the exit trigger (e.g., "exit at TP1 if DXY accelerates upward")

WAIT — Setup is valid but a specific condition must resolve first:
  - Correct directional bias confirmed
  - Price not yet at entry zone, OR
  - One clear (not just moderate) opposing layer needs to resolve, OR
  - CONTRADICTION LEVEL = MODERATE with weak quant signal
  - ALWAYS state the specific price/event that triggers entry

AVOID — No trade:
  - A HARD BLOCK condition is present (list which one)
  - Win probability < 40% AND confluence < 60
  - Negative EV in REAL_DATA mode
  - Three-way conflict (technical, fundamental, AND sentiment all opposed at high confidence)
  - No valid entry zone exists

═══════════════════════════════════════════════════════
OUTPUT FORMAT — MANDATORY
═══════════════════════════════════════════════════════

## EVIDENCE REVIEW

### Technical Evidence
[Review the technical package. State what the structure, regime, and indicators show as facts.
Interpret whether they are coherent together. Note if HTF and LTF disagree and which dominates.]

### Fundamental Evidence
[Review economic events with their surprises. State DXY and macro direction with actual numbers.
Classify as: TAILWIND / MINOR HEADWIND / CLEAR CONTRADICTION. Do not write "DXY is moving"
without the percentage. A minor headwind is not a contradiction — say so explicitly.]

### Sentiment Evidence
[State the keyword score. Assess whether priced-in or actionable. Neutral/priced-in sentiment
is reported as NEUTRAL, not as a negative signal. Only actionable contradicting sentiment
reduces conviction.]

### Quantitative Evidence
[State win probability, EV, confluence score, and backtest n. State whether this is a
STRONG QUANT SIGNAL. If strong: state explicitly that AVOID requires a hard block.]

### Contradiction Analysis
[List contradictions using the four-level system. Assign a CONTRADICTION LEVEL.
If NONE: "No significant contradictions detected. All layers coherent."
If MINOR: "Minor [factor]. Does not block execution. Reduce size."
If MODERATE: "Moderate [factor]. WAIT for [specific condition]."
If SEVERE: "HARD BLOCK: [specific condition]. AVOID."]

## MARKET NARRATIVE
[4–6 sentences integrating ALL four evidence packages. Write as a senior trader.
Lead with the strength of the setup, then qualify with contradictions.
Do NOT lead with risk warnings on a high-quality setup.]

## DECISION

**VERDICT: [EXECUTE / EXECUTE WITH CAUTION / WAIT / AVOID]**

**Reasoning:**
1. [First reason — quant signal strength]
2. [Second reason — cross-examination result]
3. [Third reason — specific verdict level justification]
[Continue as needed]

**Risk to decision:** [What specific event or price level would invalidate this verdict?]

**Position Size Adjustment:** [100% standard / 50% caution / Not applicable — WAIT / Not applicable — AVOID]
[If EXECUTE WITH CAUTION: state exactly why 50% and what exit trigger applies]

## EXECUTION PLAN
[ALWAYS show this section — for ALL four verdicts]

- **Action:** [BUY / SELL / NONE] (MUST explicitly say BUY or SELL if executing)
- **Verdict:** [EXECUTE NOW / EXECUTE WITH CAUTION — 50% SIZE / WAIT FOR CONFIRMATION / AVOID — WATCH ONLY]
- **Directional Bias:** [Bullish / Bearish / No bias]

**ENTRY TRIGGER:**
[EXECUTE]: "Action: [BUY/SELL]. Price is at [level]. Enter on next [candle type] confirmation."
[EXECUTE WITH CAUTION]: "Price is at [level]. Enter at 50% standard size. Exit at TP1 if [specific deterioration condition]."
[WAIT]: "Wait for [specific price/event] at [exact level]. Do not enter before this happens."
[AVOID]: "No setup. If conditions improve: watch for [specific event] at [price range]. Re-run when price reaches [level]."

- **Entry Zone:** [Exact price range]
- **Invalidation:** [Exact price — setup cancelled if hit]
- **Target 1 (TP1):** [Price] — R:R [ratio] — Prob [tp1_pct]%
- **Target 2 (TP2):** [Price] — R:R [ratio]
- **Target 3 (TP3):** [Price] — R:R [ratio]
- **Position Size:** [lot_size] lots — risks $[risk_amount] ([risk_pct]% of account)
  [If EXECUTE WITH CAUTION: show 50% of standard lot size]
- **Break-Even:** Move SL to entry after TP1 hit
- **Win Probability:** [win_pct]% | Expected Value: [ev]R
- **Wyckoff Context:** [phase — one sentence]
- **Calendar Warning:** [CLEAR / UPCOMING EVENT — time and impact / HARD BLOCK]

**WHAT CHANGES THIS VERDICT:**
[2–3 specific conditions that escalate or de-escalate the verdict.
Example: "If DXY reverses below [level], upgrade EXECUTE WITH CAUTION → EXECUTE at full size."
Example: "If price sweeps SSL at [price] and closes back above, re-run for long entry."
Always give specific scenarios, not vague advice.]

## STRUCTURED SIGNAL

SIGNAL_JSON_START
{"direction":"DIRECTION_HERE","entry_low":ENTRY_LOW_HERE,"entry_high":ENTRY_HIGH_HERE,"sl":SL_HERE,"tp1":TP1_HERE,"tp2":TP2_HERE,"tp3":TP3_HERE,"score":SCORE_HERE,"win_probability":WIN_PCT_HERE,"expected_value":EV_HERE,"verdict":"EXECUTE|EXECUTE_WITH_CAUTION|WAIT|AVOID","position_size_pct":100}
SIGNAL_JSON_END

For EXECUTE WITH CAUTION: set "position_size_pct": 50
For WAIT or AVOID with no setup: set entry/sl/tp fields to null, "position_size_pct": 0

INTEGRITY:
- Every price from Python engine data. Never invented.
- Every fundamental statement from economic calendar or cross-asset data.
- Every sentiment statement from scored headlines with priced-in assessment.
- Never use AVOID without naming the specific HARD BLOCK condition.
- Never use WAIT when EXECUTE or EXECUTE WITH CAUTION is the correct level.`.trim();
}

// ─── Rule-based fallback ──────────────────────────────────────────────────────
function generateRuleBasedSummary(asset:string, mode:string, engineData:any): string {
  if(!engineData||engineData.error) return `## ⚠️ ALL AI MODELS UNAVAILABLE\n\nPython engine data below.\nTry again in 2-3 minutes.\n`;
  const s=engineData._summary||{}; const cal=s.calendar||{};
  const etf=engineData[s.etf]||{}; const htf=engineData[s.htf]||{};
  const pd=etf.premium_discount||{}; const bt=htf.backtest||{};
  const regime=etf.regime||{}; const vp=etf.volume_profile||{}; const ml=s.ml_score||{};
  let lvls='';
  etf.ob_fresh?.forEach((o:any)=>{ lvls+=`- ${o.direction}OB: ${o.low}–${o.high} (${o.date}) Touches:${o.touch_count||0}\n`; });
  etf.fvg_fresh?.forEach((f:any)=>{ lvls+=`- ${f.direction}FVG: ${f.bottom}–${f.top} (${f.date})\n`; });
  return `## MARKET SUMMARY (RULE-BASED — ALL AI UNAVAILABLE)
- **Asset:** ${asset} | **Price:** ${s.asset_price||'N/A'} | **Session:** ${s.session?.session||'N/A'}
- **HTF:** ${s.htf_trend||'N/A'} | **EMA:** ${s.htf_ema_trend||'N/A'}
- **Regime:** ${regime.regime||'N/A'} — ${regime.implication||'N/A'}
- **P/D:** ${pd.status||'N/A'} @${pd.percentage||'N/A'}% | ${pd.note||''}
- **Volume Profile:** POC=${vp.poc||'N/A'} VAH=${vp.vah||'N/A'} VAL=${vp.val||'N/A'}
- **ML Score:** ${ml.score||'N/A'}/100
${cal.hard_pause?`\n⛔ CALENDAR HARD PAUSE: ${cal.pause_reason}\n`:''}
## CALCULATED LEVELS
${lvls||'No fresh levels on ETF\n'}
BSL: ${etf.liquidity?.bsl?.slice(0,3).map((b:any)=>`${b.price}(${b.distance_pct}%)`).join(' | ')||'N/A'}
SSL: ${etf.liquidity?.ssl?.slice(0,3).map((s:any)=>`${s.price}(${s.distance_pct}%)`).join(' | ')||'N/A'}
${bt.status==='COMPLETE'?`Backtest: WR=${bt.win_rate_pct}% adj=${bt.win_rate_adjusted_pct}% | ${bt.verdict}`:''}
**Try again in 2-3 minutes.**`;
}

// ─── Main Express server ──────────────────────────────────────────────────────
async function startServer() {
  const app = express(); const PORT = 3000;
  app.use(express.json({limit:'50mb'}));
  app.use(express.urlencoded({extended:true,limit:'50mb'}));

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status:   'OK',
      version:  'QUANT-X v9',
      uptime:   Math.floor(process.uptime()),
      memory:   process.memoryUsage().heapUsed,
      cache:    candleCache.size,
      gemini:   !!process.env.GEMINI_API_KEY,
      openrouter: !!process.env.OPENROUTER_API_KEY,
    });
  });

  // Signal performance summary endpoint
  app.get('/api/performance', async(req,res) => {
    try {
      const asset  = req.query.asset as string | undefined;
      const limit  = parseInt(req.query.limit as string || '100');
      const result = await runPythonOperation({
        operation: 'get_dashboard',
        asset:     asset || null,
        limit,
      });
      res.json(result);
    } catch(e:any){ res.status(500).json({error:e.message}); }
  });

  app.post('/api/check-outcomes', async(req,res)=>{
    try { res.json(await runPythonOperation({operation:'check_outcomes',asset:req.body.asset||null})); }
    catch(e:any){ res.status(500).json({error:e.message}); }
  });

  app.get('/api/dashboard', async(req,res)=>{
    try { res.json(await runPythonOperation({operation:'get_dashboard',asset:req.query.asset||null,limit:parseInt(req.query.limit as string||'50')})); }
    catch(e:any){ res.status(500).json({error:e.message}); }
  });

  app.post('/api/save-signal', async(req,res)=>{
    try { res.json(await runPythonOperation({operation:'save_signal',signal:req.body})); }
    catch(e:any){ res.status(500).json({error:e.message}); }
  });

  let analysisInProgress = false;

  app.post('/api/analyze', async(req,res)=>{
    if(analysisInProgress) {
      return res.status(429).json({
        error: 'Analysis already in progress. Please wait for it to complete.',
        retry_after: 30,
      });
    }
    analysisInProgress = true;
    try {
      const {asset, mode, image, accountSize, riskPct} = req.body;
      const userAccountSize = parseFloat(accountSize) || 10000;
      const userRiskPct     = parseFloat(riskPct) || 1.0;
      if(!process.env.GEMINI_API_KEY) return res.status(500).json({error:'GEMINI_API_KEY not configured.'});
      const derivSymbol = DERIV_SYMBOLS[asset];
      if(!derivSymbol) return res.status(400).json({error:`No Deriv symbol: ${asset}`});
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY as string,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      // 1. Fetch candles
      const isSynthetic = SYNTHETICS.has(derivSymbol);
      const modeKey = isSynthetic
        ? (mode === 'SWING MODE' ? 'SYNTHETIC SWING' : 'SYNTHETIC SCALP')
        : mode;
      const timeframes = TIMEFRAMES[modeKey] || TIMEFRAMES['SCALPING MODE'];
      const candlesByTF: Record<string,Candle[]> = {};
      let rawBlock = `# LIVE OHLCV — ${asset}\nFetched:${new Date().toISOString()}\n`;
      const candleResults = await Promise.allSettled(timeframes.map(tf=>fetchCachedCandles(derivSymbol,tf.granularity,500)));
      for(let i=0;i<timeframes.length;i++){
        const tf=timeframes[i]; const r=candleResults[i];
        if(r.status==='fulfilled'&&r.value.length>0){
          candlesByTF[tf.label]=r.value;
          const last=r.value[r.value.length-1]; const oldest=r.value[0];
          rawBlock+=`\n${tf.label}: ${r.value.length} candles | ${oldest.date} to ${last.date} | Close:${last.close}\n`;
          rawBlock+=`time,open,high,low,close\n${r.value.slice(-200).map(c=>`${c.date},${c.open},${c.high},${c.low},${c.close}`).join('\n')}\n`;
        } else { rawBlock+=`\n${tf.label}: FETCH FAILED\n`; }
      }

      // 2, 3, 4 — Engine + News + OpenRouter ALL run in parallel
      // OpenRouter only needs candles (already available), not the engine output
      // This saves 3-5 seconds by not waiting for engine before starting reasoning
      const etfLabel      = timeframes[timeframes.length-1]?.label;
      const etfCandles    = candlesByTF[etfLabel] || [];

      // Build a minimal early context for OpenRouter — candles only, no engine needed
      const earlyContext = {
        asset,
        etfCandles,
        htfTrend: 'CALCULATING', // engine not done yet — OpenRouter works from candles directly
      };

      // Engine and news run in parallel — independent of each other
      const [engineResult, newsResult] = await Promise.allSettled([
        runPythonEngine(candlesByTF, asset, userAccountSize, userRiskPct),
        fetchRSSNews(asset),
      ]);
      const engineData = engineResult.status === 'fulfilled' ? engineResult.value : {error:'Engine failed'};
      const newsData   = newsResult.status  === 'fulfilled' ? newsResult.value  : {items:[], hasHighImpact:false, highImpactEvents:[], freshCount:0, staleCount:0};

      // OpenRouter runs AFTER engine — gets full calculated context for better reasoning
      const engineBlock          = formatEngineResults(engineData);
      const newsBlock            = formatNewsBlock(newsData as any, asset);
      const openRouterReasoning  = await fetchOpenRouterReasoning(asset, engineData, etfCandles, newsBlock);

            // ── Tier 1: Python keyword sentiment (fast baseline) ──────────────────
      const sentimentResult = await runPythonOperation({
        operation:  'score_sentiment',
        news_items: (newsData as any).items || [],
        asset:      asset,
      });
      let sentimentIntel = sentimentResult?.error ? null : sentimentResult;

      // ── Tier 2: AI Sentiment Interpretation (priced-in detection) ─────────
      const headlines = (newsData as any).items || [];
      if (headlines.length > 0 && process.env.GEMINI_API_KEY && sentimentIntel) {
        try {
          const headlineBlock = headlines
            .slice(0, 10)
            .map((h: any, i: number) =>
              `${i+1}. [${h.ageMinutes}min ago | ${h.source}] ${h.title}`
              + (h.summary ? `\n   ${h.summary.slice(0, 100)}` : '')
            ).join('\n');

          const dxyFact   = engineData?._summary?.fundamental_intel?.dxy_environment?.raw_fact || 'DXY unavailable';
          const yieldFact = engineData?._summary?.fundamental_intel?.yield_environment?.raw_fact || 'Yields unavailable';
          const macroBias = engineData?._summary?.cross_asset?.macro_bias || 'Unknown';

          const sentimentAIPrompt = `You are a professional macro analyst evaluating news sentiment for ${asset}.

LIVE MACRO CONTEXT:
- ${dxyFact}
- ${yieldFact}
- Macro bias: ${macroBias}

RECENT HEADLINES (newest first):
${headlineBlock}

KEYWORD SCORE (Python baseline): ${sentimentIntel.sentiment_label} (score: ${sentimentIntel.overall_score})

For each headline, classify: GENUINE (new market-moving info), PRICED_IN (market expected this), NOISE (irrelevant), or TRAP (sounds bullish but likely distribution/retail bait).

Rules:
- "Fed stays hawkish" after months of hawkish guidance = PRICED_IN
- "CPI beats" when consensus expected a beat = PRICED_IN
- "Emergency rate decision" or "surprise GDP miss" = GENUINE
- Gold bullish news during DXY strength = possible TRAP
- Headlines describing moves that already happened = PRICED_IN

Respond ONLY with this JSON (no markdown):
{"ai_sentiment_label":"STRONGLY_BULLISH|BULLISH|NEUTRAL|BEARISH|STRONGLY_BEARISH","ai_sentiment_score":0.0,"priced_in_assessment":"one sentence","actionable_headlines":["..."],"noise_headlines":["..."],"trap_detected":false,"trap_explanation":null,"ai_sentiment_note":"2-3 sentences for the trader","confidence":"HIGH|MEDIUM|LOW"}`;

          let aiSentResp: any;
          let attempt = 0;
          let currentModel = 'gemini-3.5-flash';
          const backoff = [1500, 3000];
          while (attempt < 3) {
            try {
              aiSentResp = await ai.models.generateContent({
                model: currentModel,
                contents: [{ role: 'user', parts: [{ text: sentimentAIPrompt }] }],
                config: { temperature: 0.1, maxOutputTokens: 600 },
              });
              break;
            } catch (err: any) {
              const m = err.message || '';
              const isQuotaExceeded = m.includes('429') || m.includes('quota') || m.includes('RESOURCE_EXHAUSTED');
              const isUnavailable = m.includes('503') || m.includes('UNAVAILABLE') || m.includes('overloaded');
              if ((isQuotaExceeded || isUnavailable) && currentModel === 'gemini-3.5-flash') {
                console.log(`Gemini ${currentModel} quota exceeded or unavailable. Falling back to gemini-3.1-flash-lite...`);
                currentModel = 'gemini-3.1-flash-lite';
                continue;
              }
              attempt++;
              if (attempt >= 3) {
                console.log(`Gemini AI sentiment generation failed completely for all models: ${m}`);
                throw err;
              }
              await new Promise(r => setTimeout(r, backoff[attempt - 1]));
            }
          }

          const rawAI = (aiSentResp.text || '').replace(/```json|```/g, '').trim();
          try {
            const parsed = JSON.parse(rawAI);
            sentimentIntel = {
              ...sentimentIntel,
              ai_interpreted:          true,
              ai_sentiment_label:      parsed.ai_sentiment_label      || sentimentIntel.sentiment_label,
              ai_sentiment_score:      parsed.ai_sentiment_score      ?? sentimentIntel.overall_score,
              priced_in_assessment:    parsed.priced_in_assessment    || '',
              actionable_headlines:    parsed.actionable_headlines    || [],
              noise_headlines:         parsed.noise_headlines         || [],
              trap_detected:           parsed.trap_detected           ?? false,
              trap_explanation:        parsed.trap_explanation        || null,
              ai_sentiment_note:       parsed.ai_sentiment_note       || '',
              ai_confidence:           parsed.confidence              || 'LOW',
              keyword_sentiment_label: sentimentIntel.sentiment_label,
              keyword_score:           sentimentIntel.overall_score,
              sentiment_divergence: (
                sentimentIntel.sentiment_label !== parsed.ai_sentiment_label
                  ? `DIVERGENCE: Keywords=${sentimentIntel.sentiment_label} vs AI=${parsed.ai_sentiment_label} — likely priced-in`
                  : 'ALIGNED'
              ),
            };
          } catch { sentimentIntel.ai_interpreted = false; }
        } catch (err: any) {
          console.log('AI sentiment failed:', err.message);
          if (sentimentIntel) sentimentIntel.ai_interpreted = false;
        }
      }

      // Merge sentiment intelligence into engine summary
      if(engineData?._summary && sentimentIntel) {
        engineData._summary.sentiment_intel = sentimentIntel;
      }

      const hasHighImpact  = (newsData as any).hasHighImpact || false;
      const reasoningBlock = openRouterReasoning
        ? `\n# QUANT REASONING CONTEXT (Qwen-2.5)\n${openRouterReasoning}\n`
        : '';

      // 5. Calendar (from engine result)
      const calHardPause   = engineData?._summary?.calendar?.hard_pause || false;
      const calPauseReason = engineData?._summary?.calendar?.pause_reason || '';

      // 6. Build prompt
      const calWarning = calHardPause
        ? `\n⛔ CALENDAR HARD PAUSE: ${calPauseReason}\nShow PRE-EVENT SETUP BRIEF only.\n` : '';

      const userPrompt = [
        rawBlock, engineBlock, newsBlock, reasoningBlock, calWarning,
        `Perform complete institutional analysis for ${asset} in ${mode}.`,
        `BIDIRECTIONAL: Analyse both bull and bear scenarios. Do not only look for one direction.`,
        `NEWS: Only cite FRESH or BREAKING items. Never stale news as current driver.`,
        `SPIKES: If last 10 candles show >0.3% move, address it explicitly in narrative.`,
        `LEVELS: Use engine results for all prices. Never "wait for tap" on MITIGATED level.`,
        calHardPause ? 'CALENDAR HARD PAUSE ACTIVE. PRE-EVENT SETUP BRIEF only.'
          : hasHighImpact ? '⚠️ HIGH-IMPACT EVENT. Add trade pause warning.'
          : 'No high-impact events.',
      ].join('\n\n');

      const promptParts:any[] = [{text:userPrompt}];
      if(image){
        const mimeMatch  = image.match(/^data:(image\/[a-z]+);base64,/);
        const mimeType   = (mimeMatch?.[1] || 'image/jpeg') as 'image/jpeg'|'image/png'|'image/gif'|'image/webp';
        const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, '');
        promptParts.push({inlineData:{data:base64Data, mimeType}});
        promptParts.push({text:'Chart provided. If you see a spike or reversal candle, describe it and incorporate into analysis.'});
      }

      let responseText = ''; let aiUsed = 'none';

      // ── ANALYSIS LAYER ────────────────────────────────────────────────────
      // Step 1: Gemini 2.5 Flash (3 retries with exponential backoff)

      try {
        let response:any; let attempt=0;
        let currentAnalysisModel = 'gemini-3.5-flash';
        const backoff=[2000, 4000];
        while(attempt<3){
           try {
             response=await ai.models.generateContent({
               model: currentAnalysisModel, contents:promptParts,
               config:{
                 systemInstruction: buildSystemPrompt(asset,mode),
                 temperature: 0.1,
               }
             });
             break;
           } catch(e1:any){
             const m=e1.message||'';
             const isRateLimit = m.includes('429') || m.includes('quota') || m.includes('RESOURCE_EXHAUSTED');
             const retry = m.includes('503') || m.includes('UNAVAILABLE') || m.includes('overloaded');
             
             if((isRateLimit || retry) && currentAnalysisModel === 'gemini-3.5-flash') {
               console.log(`Gemini ${currentAnalysisModel} quota/rate limit reached or unavailable. Switching to gemini-3.1-flash-lite model...`);
               currentAnalysisModel = 'gemini-3.1-flash-lite';
               continue;
             }
             
             attempt++;
             
             if(isRateLimit) {
               console.log('Gemini quota/rate limit reached. Skipping retries.');
               throw e1;
             } else if(retry && attempt < 3) {
               console.log(`Gemini response unavailable. Retrying in ${backoff[attempt-1]/1000}s...`);
               await new Promise(r=>setTimeout(r,backoff[attempt-1]));
             }
             else throw e1;
           }
        }
        responseText=response.text||''; aiUsed='gemini';

      } catch(geminiErr:any){
        console.log('Gemini skipped:', geminiErr.message);

        // Compact prompt for fallback models (no raw CSV, just engine+news+reasoning)
        const compactPrompt = buildCompactPrompt(asset, mode, timeframes, candlesByTF, engineBlock, newsBlock, reasoningBlock, calWarning, hasHighImpact, calHardPause);

        // Step 2: GPT-4o via old GITHUB_TOKEN
        let step2Success = false;
        if(process.env.GITHUB_TOKEN){
          try {
            console.log('Trying GPT-4o (GITHUB_TOKEN)...');
            responseText = await callGitHubModel(process.env.GITHUB_TOKEN, 'gpt-4o', buildSystemPrompt(asset,mode), compactPrompt);
            if(responseText){ aiUsed='gpt-4o'; step2Success=true; responseText=`> ⚡ **GPT-4o** (Gemini unavailable)\n\n${responseText}`; }
          } catch(e2:any){ console.log('GPT-4o skipped:',e2.message); }
        }

        // Step 3: GPT-4.1 mini with reasoning via GITHUB_TOKEN2 (new account)
        if(!step2Success){
          if(process.env.GITHUB_TOKEN2){
            try {
              console.log('Trying GPT-4.1-mini-reasoning (GITHUB_TOKEN2)...');
              responseText = await callGitHubModel(process.env.GITHUB_TOKEN2, 'gpt-4.1-mini', buildSystemPrompt(asset,mode), compactPrompt);
              if(responseText){ aiUsed='gpt-4.1-mini'; responseText=`> ⚡ **GPT-4.1 Mini** (Gemini + GPT-4o unavailable)\n\n${responseText}`; }
            } catch(e3:any){ console.log('GPT-4.1-mini skipped:',e3.message); }
          }
        }

        // Step 4: Rule-based fallback (last resort)
        if(!responseText){
          console.log('All AI models skipped. Using rule-based fallback.');
          responseText = generateRuleBasedSummary(asset, mode, engineData);
          aiUsed = 'rule-based';
        }
      }

      // 7. Auto-save signal — uses structured JSON block from Gemini (reliable)
      // Falls back to regex if JSON block is missing
      try {
        const summary    = engineData?._summary || {};
        const etfData    = engineData?.[summary.etf] || {};
        const htfData    = engineData?.[summary.htf] || {};

        let signalData: any = null;

        // Primary: parse structured JSON block appended by Gemini
        const jsonBlockMatch = responseText.match(/SIGNAL_JSON_START\s*(\{[\s\S]*?\})\s*SIGNAL_JSON_END/);
        if(jsonBlockMatch) {
          try {
            const parsed = JSON.parse(jsonBlockMatch[1]);
            if(parsed.direction && parsed.direction !== 'NEUTRAL' &&
               parsed.entry_low && parsed.sl && parsed.tp1) {
              signalData = parsed;
            }
          } catch { /* fall through to regex */ }
        }

        // Fallback: regex parsing (handles cases where AI skips the JSON block)
        if(!signalData) {
          const dirMatch   = responseText.match(/\*\*Direction:\*\*\s*(Bullish|Bearish|NEUTRAL)/i);
          const direction  = dirMatch?.[1] || 'NEUTRAL';
          const entryMatch = responseText.match(/\*\*Entry Zone:\*\*\s*[\$]?([\d,]+\.?\d*)\s*[-–]\s*[\$]?([\d,]+\.?\d*)/i);
          const entryLow   = entryMatch ? parseFloat(entryMatch[1].replace(/,/g,'')) : null;
          const entryHigh  = entryMatch ? parseFloat(entryMatch[2].replace(/,/g,'')) : null;
          const slMatch    = responseText.match(/\*\*Invalidation:\*\*[^\d]*([\d,]+\.?\d*)/i);
          const sl         = slMatch ? parseFloat(slMatch[1].replace(/,/g,'')) : null;
          const tp1Match   = responseText.match(/\*\*Target 1[^:]*:\*\*[^\d]*([\d,]+\.?\d*)/i);
          const tp1        = tp1Match ? parseFloat(tp1Match[1].replace(/,/g,'')) : null;
          const tp2Match   = responseText.match(/\*\*Target 2[^:]*:\*\*[^\d]*([\d,]+\.?\d*)/i);
          const tp2        = tp2Match ? parseFloat(tp2Match[1].replace(/,/g,'')) : null;
          const tp3Match   = responseText.match(/\*\*Target 3[^:]*:\*\*[^\d]*([\d,]+\.?\d*)/i);
          const tp3        = tp3Match ? parseFloat(tp3Match[1].replace(/,/g,'')) : null;
          if(direction !== 'NEUTRAL' && entryLow && sl && tp1) {
            signalData = {direction, entry_low:entryLow, entry_high:entryHigh||entryLow,
                          sl, tp1, tp2:tp2||null, tp3:tp3||null,
                          score: summary.ml_score?.score || null};
          }
        }

        if(signalData) {
          // FIXED: Position size MUST be recalculated from Gemini's ACTUAL entry/SL,
          // never trusted as text Gemini wrote itself.
          const recalc = await runPythonOperation({
            operation: 'recalc_position_size',
            position: {
              asset,
              entry_low: signalData.entry_low,
              entry_high: signalData.entry_high,
              sl: signalData.sl,
              account_size: parseFloat(accountSize) || 10000,
              risk_pct: parseFloat(riskPct) || 1.0,
            }
          });

          if (recalc && !recalc.error) {
            // Overwrite whatever lot size / risk text Gemini wrote with the verified number
            const correctedLine = `- **Position Size:** ${recalc.lot_size} lots — risks $${recalc.risk_amount_usd} (${recalc.risk_pct_actual}% of account)`;
            responseText = responseText.replace(
              /- \*\*Position Size:\*\*[^\n]*/i,
              correctedLine
            );
            if (recalc.mismatch_warning) {
              responseText = responseText.replace(
                correctedLine,
                `${correctedLine}\n  ⚠️ *${recalc.mismatch_warning}*`
              );
            }
            // Store the verified figures for the signal save
            signalData.lot_size = recalc.lot_size;
            signalData.risk_amount_usd = recalc.risk_amount_usd;
          } else {
            // If recalculation fails, do not silently trust Gemini's number — flag it
            responseText = responseText.replace(
              /- \*\*Position Size:\*\*[^\n]*/i,
              `- **Position Size:** ⚠️ Could not verify — recalculate manually before trading. Risk = ${riskPct || 1}% of $${accountSize || 10000} account, SL distance = |entry − invalidation|.`
            );
          }

          const sr = await runPythonOperation({operation:'save_signal', signal:{
            ...signalData,
            asset, mode,
            htf_trend:  summary.htf_trend || '',
            etf_trend:  etfData.trend || '',
            rsi_htf:    htfData.indicators?.rsi?.value || null,
            atr:        etfData.atr || null,
            regime:     etfData.regime?.regime || '',
            session:    summary.session?.session || '',
          }});
          if(sr?.signal_id) {
            // Remove the JSON block from the displayed response
            responseText = responseText.replace(/SIGNAL_JSON_START[\s\S]*?SIGNAL_JSON_END/g, '').trim();
            responseText += `\n\n---\n> 📊 **Signal #${sr.signal_id} recorded** — outcome tracked automatically.`;
          }
        } else {
          // Clean up JSON block even if not saved
          responseText = responseText.replace(/SIGNAL_JSON_START[\s\S]*?SIGNAL_JSON_END/g, '').trim();
        }

        // FIXED: When AI commits to EXECUTE, persist the thesis so future runs don't jitter
        const isExecuteVerdict = responseText.includes('VERDICT: EXECUTE') || responseText.includes('**EXECUTE**');
        if (isExecuteVerdict && signalData && signalData.direction) {
          // Try to extract a structural invalidation reason from the narrative
          const structuralAnchorMatch = responseText.match(/Structural Anchor:\s*([^\n]+)/i);
          const invalidationReasonMatch = responseText.match(/Invalidation(?:\s+Reason)?:\s*([^\n]+)/i);

          await runPythonOperation({
            operation: 'create_thesis',
            thesis: {
              asset, mode,
              direction: signalData.direction === 'Bullish' || signalData.direction === 'BULLISH' ? 'BULLISH' : 'BEARISH',
              confluence_score: summary.ml_score?.score || null,
              htf_trend: summary.htf_trend || '',
              etf_trend: summary.etf_trend || '',
              entry_low: signalData.entry_low, entry_high: signalData.entry_high,
              sl: signalData.sl, tp1: signalData.tp1, tp2: signalData.tp2, tp3: signalData.tp3,
              invalidation_price: signalData.sl,  // SL doubles as the hard invalidation level
              invalidation_reason: invalidationReasonMatch?.[1] || 'Stop loss breach',
              structural_anchor: structuralAnchorMatch?.[1] || 'See execution plan entry zone',
            }
          }).catch((e:any) => console.log('Thesis save failed (non-fatal):', e.message));
        }
      } catch(saveErr:any){ console.log('Signal save:',saveErr.message); }

      const aiFooter = [
        `Analysis: ${aiUsed}`,
        openRouterReasoning ? `Reasoning: Qwen-2.5` : `Reasoning: SKIPPED`,
        `News: ${(newsData as any).freshCount || 0} fresh / ${(newsData as any).staleCount || 0} older`,
      ].join(' │ ');
      responseText += `\n\n---\n*${aiFooter}*`;

      console.log(`Done. AI:${aiUsed} | News:${newsData.freshCount}fresh/${newsData.staleCount}stale | Reasoning:${openRouterReasoning?'YES':'NO'}`);
      res.json({result:responseText});

    } catch(err:any){ console.log('Error:',err); res.status(500).json({error:err.message}); } finally { analysisInProgress = false; }
  });

  if(process.env.NODE_ENV!=='production'){
    const vite=await createViteServer({server:{middlewareMode:true},appType:'spa'});
    app.use(vite.middlewares);
  } else {
    const distPath=path.join(process.cwd(),'dist');
    app.use(express.static(distPath));
    app.get('*all',(req,res)=>res.sendFile(path.join(distPath,'index.html')));
  }

  app.listen(PORT,'0.0.0.0',()=>{
    console.log(`QUANT-X on http://localhost:${PORT}`);
    console.log('');
    console.log('=== API KEY STATUS ===');
    console.log(`Gemini:       ${process.env.GEMINI_API_KEY     ? '✅ configured' : '❌ MISSING'}`);
    console.log(`GPT-4o:       ${process.env.GITHUB_TOKEN       ? '✅ configured' : '⚠️  not set'}`);
    console.log(`GPT-4.1-mini: ${process.env.GITHUB_TOKEN2      ? '✅ configured' : '⚠️  not set'}`);
    console.log(`OpenRouter:   ${process.env.OPENROUTER_API_KEY ? '✅ configured' : '⚠️  not set — reasoning disabled'}`);
    console.log('======================');
    console.log('');
    console.log(`AI Chain: Gemini 2.5 Flash → GPT-4o (GITHUB_TOKEN) → GPT-4.1-mini (GITHUB_TOKEN2) → Rule-based`);
    console.log(`Reasoning: Qwen-72B (OpenRouter free tier - optimized for speed)`);
    console.log(`OpenRouter: ${process.env.OPENROUTER_API_KEY?'✅ CONFIGURED':'❌ NOT SET'}`);
    console.log(`GPT-4o token: ${process.env.GITHUB_TOKEN?'✅ CONFIGURED':'❌ NOT SET'}`);
    console.log(`GPT-4.1-mini token: ${process.env.GITHUB_TOKEN2?'✅ CONFIGURED':'❌ NOT SET'}`);
    const runOutcomeCheck=async()=>{
      try {
        const r=await runPythonOperation({operation:'check_outcomes',asset:null});
        if(r.updated>0){ console.log(`[Outcomes] ${r.checked} checked, ${r.updated} updated.`); r.details?.filter((d:any)=>d.outcome&&d.outcome!=='STILL OPEN').forEach((d:any)=>console.log(`  #${d.id} ${d.asset}: ${d.outcome} PnL:${d.pnl_atr}ATR`)); }
      } catch(e:any){ console.log('Outcome check:',e.message); }
    };
    setTimeout(runOutcomeCheck,5*60*1000);
    setInterval(runOutcomeCheck,30*60*1000);
  });
}

// ─── Compact prompt builder for fallback models ───────────────────────────────
function buildCompactPrompt(
  asset:string, mode:string,
  timeframes:{granularity:number;label:string}[],
  candlesByTF:Record<string,Candle[]>,
  engineBlock:string, newsBlock:string, reasoningBlock:string,
  calWarning:string, hasHighImpact:boolean, calHardPause:boolean
): string {
  // Price summary only — no raw CSV — keeps tokens low for fallback models
  let priceSummary = `# PRICE SUMMARY — ${asset}\nFetched:${new Date().toISOString()}\n`;
  for(const tf of timeframes){
    const c=candlesByTF[tf.label];
    if(c?.length>0){
      const last=c[c.length-1]; const first=c[0];
      const high=Math.max(...c.slice(-20).map((x:Candle)=>x.high));
      const low =Math.min(...c.slice(-20).map((x:Candle)=>x.low));
      priceSummary+=`${tf.label}: Current=${last.close} 20-candle-range=${low}-${high} From=${first.date} To=${last.date}\n`;
    }
  }
  return [
    priceSummary, engineBlock, newsBlock, reasoningBlock, calWarning,
    `Perform complete institutional analysis for ${asset} in ${mode}.`,
    `BIDIRECTIONAL: Analyse both bull and bear scenarios.`,
    `NEWS: Only cite FRESH or BREAKING items.`,
    `LEVELS: Use engine results for all prices. Never "wait for tap" on MITIGATED level.`,
    calHardPause ? 'CALENDAR HARD PAUSE. PRE-EVENT SETUP BRIEF only.'
      : hasHighImpact ? '⚠️ HIGH-IMPACT EVENT. Trade pause warning required.'
      : 'No high-impact events.',
  ].join('\n\n');
}

startServer();
