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
  XAUUSD:'frxXAUUSD', XAGUSD:'frxXAGUSD',
  BTCUSD:'cryBTCUSD', ETHUSD:'cryETHUSD', SOLUSD:'crySOLUSD',
  BOOM1000:'BOOM1000', CRASH1000:'CRASH1000', VOL75:'R_75', VOL100:'R_100',
};

const TIMEFRAMES: Record<string, { granularity: number; label: string }[]> = {
  'SCALPING MODE': [
    {granularity:604800,label:'W1'},   // Weekly — major institutional levels
    {granularity:14400, label:'4H'},
    {granularity:3600,  label:'1H'},
    {granularity:900,   label:'15M'},
    {granularity:300,   label:'5M'},
  ],
  'SWING MODE': [
    {granularity:604800,label:'W1'},   // Weekly — major institutional levels
    {granularity:86400, label:'D1'},
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
    const proc = spawn(pythonCmd, [enginePath], {timeout:45000});
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
    {url:'https://feeds.kitco.com/MarketNuggets', name:'Kitco Gold'},
    {url:'https://www.mining.com/feed/', name:'Mining.com'},
    {url:'https://feeds.reuters.com/reuters/businessNews', name:'Reuters Business'},
  ],
  XAGUSD: [
    {url:'https://feeds.kitco.com/MarketNuggets', name:'Kitco Silver'},
    {url:'https://feeds.reuters.com/reuters/businessNews', name:'Reuters Business'},
  ],
  BTCUSD: [
    {url:'https://cointelegraph.com/rss', name:'CoinTelegraph'},
    {url:'https://coindesk.com/arc/outboundfeeds/rss/', name:'CoinDesk'},
  ],
  ETHUSD: [
    {url:'https://cointelegraph.com/rss/tag/ethereum', name:'CoinTelegraph ETH'},
    {url:'https://coindesk.com/arc/outboundfeeds/rss/', name:'CoinDesk'},
  ],
  DEFAULT: [
    {url:'https://feeds.reuters.com/reuters/businessNews', name:'Reuters Business'},
    {url:'https://www.forexlive.com/feed/news', name:'ForexLive'},
    {url:'https://www.dailyfx.com/feeds/all', name:'DailyFX'},
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
      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method:'POST',
        headers:{
          'Authorization':`Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type':'application/json',
          'HTTP-Referer':'https://quant-x.app',
          'X-Title':'QUANT-X',
        },
        body:JSON.stringify({model, messages:[{role:'user',content:prompt}], temperature:0.1, max_tokens:500}),
      });
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
    block += `  Overall: ${si.sentiment_label} (score:${si.overall_score}) | Bull:${si.bullish_count} Bear:${si.bearish_count} Neutral:${si.neutral_count}\n`;
    block += `  Note: ${si.note}\n`;
    if(si.breaking_items?.length){
      block += `  BREAKING:\n`;
      si.breaking_items.slice(0,3).forEach((item:any) => {
        block += `    [${item.age_minutes}min | ${item.source}] "${item.title}" → ${item.sentiment} (${item.score})\n`;
      });
    }
    if(si.scored_headlines?.length){
      block += `  TOP HEADLINES:\n`;
      si.scored_headlines.slice(0,5).forEach((item:any) => {
        if(!item.is_breaking) block += `    [${item.source}] "${item.title}" → ${item.sentiment}\n`;
      });
    }
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
      block+=`  ${c.role}(${c.symbol}): ${c.direction} ${c.pct_change}% [${c.strength}]\n`;
    });
  }
  if(s.win_probability){
    const wp=s.win_probability;
    block+=`\nPROBABILITY ENGINE (${wp.mode}):\n`;
    block+=`  Win:${wp.win_pct}% | TP1:${wp.tp1_pct}% | TP2:${wp.tp2_pct}% | TP3:${wp.tp3_pct}% | SL:${wp.sl_pct}%\n`;
    block+=`  Confidence: ${wp.confidence}${wp.sample_size>0?' (n='+wp.sample_size+')':''}\n`;
  }
  if(s.trade_expectancy){
    const te=s.trade_expectancy;
    block+=`\nTRADE EXPECTANCY ENGINE:\n`;
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
      block+=`  ${w.phase_detail}\n`;
      block+=`  Next: ${w.next_move}\n`;
      if(w.events?.length) w.events.forEach((e:any)=>block+=`  ${e.type}@${e.price} ${e.date} — ${e.note||''}\n`);
    }
    block+='\n';
  }
  return block;
}

// ─── System prompt ────────────────────────────────────────────────────────────
function buildSystemPrompt(asset: string, mode: string): string {
  return `
You are QUANT-X — a Senior Portfolio Manager reviewing research prepared by your quantitative analysis team.

YOUR ROLE IS JUDGMENT, NOT CALCULATION.
Python has already done all the calculation. Your job is to:
1. Review all evidence (technical, fundamental, sentiment, quantitative)
2. Identify contradictions, hidden risks, and market traps
3. Determine whether the evidence is coherent and actionable
4. Deliver a clear EXECUTE, WAIT, or AVOID decision with reasoning

You do NOT calculate indicators. You do NOT identify chart patterns. You INTERPRET the evidence Python has provided.

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
- Are multiple timeframes confirming or conflicting?

FUNDAMENTAL REVIEW:
- Are any economic events imminent? If within 30 minutes: WAIT or AVOID.
- Did any event surprise (BEAT/MISS vs forecast)? What does that mean for this asset?
- Is the DXY environment aligned with the technical bias?
- For Gold: USD strengthening = fundamental headwind. Risk-off = fundamental tailwind.
- Does the fundamental environment support or contradict the technical setup?

SENTIMENT REVIEW:
- What is the keyword sentiment score (bullish/bearish)?
- Is there BREAKING news (≤30 min)? What does it say?
- CRITICAL QUESTION: Is the sentiment already priced in, or is it new information?
  Example: "Gold surges on rate cut hopes" — if rate cuts have been expected for weeks, this is not new.
  Example: "Fed surprises with emergency rate hike" — this is new and not priced in.
- Does sentiment align with or contradict price action?

QUANTITATIVE REVIEW:
- What is the win probability? Below 45% = do not execute regardless of other factors.
- What is the Expected Value? Negative EV = do not execute.
- What does the backtest say? If under 20 trades, treat with scepticism.
- Does the confluence score (from rule-based engine) agree with your qualitative assessment?

═══════════════════════════════════════════════════════
CONTRADICTION DETECTION — CRITICAL
═══════════════════════════════════════════════════════

Before deciding, explicitly check for these contradictions:

TECHNICAL vs FUNDAMENTAL:
- Technical says BUY + DXY strengthening for Gold = contradiction (fundamental headwind)
- Technical says SELL + major CPI beat (dollar positive) = aligned
- Technical says BUY + NFP in 10 minutes = WAIT (event risk overrides technical)

TECHNICAL vs SENTIMENT:
- Strong bearish structure + strongly bullish news sentiment = possible trap
  (Smart money distributes into positive news, not against it)
- Strong bullish structure + strongly bearish news = possible spring setup
  (Smart money accumulates while retail panics from bad news)

MOMENTUM vs STRUCTURE:
- HTF TRENDING_STRONG bearish + ETF showing bullish CHoCH = LTF retracement
  (NOT a reversal — this is where retail longs get trapped)
- RSI oversold + downtrend = exhaustion warning, NOT a buy signal
  (In strong trends, RSI can stay oversold for extended periods)

WYCKOFF vs PRICE ACTION:
- Wyckoff says DISTRIBUTION + price making new highs = Upthrust forming
  (High-probability short setup if confirmed)
- Wyckoff says ACCUMULATION + price making new lows = Spring forming
  (High-probability long setup if confirmed)

═══════════════════════════════════════════════════════
FINAL DECISION — THREE OUTCOMES ONLY
═══════════════════════════════════════════════════════

EXECUTE:
- Evidence is aligned across technical, fundamental, sentiment
- No imminent high-impact events
- Win probability ≥ 50%
- Expected Value > 0.3R
- Confluence score ≥ 70

WAIT:
- Setup exists but confirmation incomplete
- Imminent economic event (within 2 hours)
- Mixed signals across evidence packages
- Win probability 40-50%
- Valid setup likely to improve with more evidence

AVOID:
- Significant contradictions between evidence packages
- Win probability < 40%
- Negative Expected Value
- High-impact event JUST released (volatility settling)
- Setup is against strong HTF trend with no confluence
- Price at no significant level

═══════════════════════════════════════════════════════
OUTPUT FORMAT — MANDATORY
═══════════════════════════════════════════════════════

## EVIDENCE REVIEW

### Technical Evidence
[Review the technical package. State what the structure, regime, and indicators show as facts. Do not just list them — interpret whether they are coherent together.]

### Fundamental Evidence
[Review economic events with their surprises. State how DXY and macro environment affects this asset right now. Be specific: "CPI came in at 3.8% vs 3.5% forecast — this BEATS expectations — for Gold this means USD is likely to strengthen on rate hike expectations, which is a fundamental headwind."]

### Sentiment Evidence
[Review the scored headlines. State the keyword score. Then — critically — assess whether this sentiment is already priced in or represents new information. State which headlines are actionable and which are background noise.]

### Quantitative Evidence
[State win probability, EV, confluence score, and backtest results. State whether the numbers support execution or argue for caution.]

### Contradiction Analysis
[Explicitly list any contradictions found between the four evidence packages. If none: state "No significant contradictions detected." If any: explain the implication for the trade decision.]

## MARKET NARRATIVE
[4-6 sentences integrating ALL four evidence packages. Write as a senior trader reviewing research — not as a system listing outputs. Connect the dots between technical setup, macro environment, sentiment, and probability.]

## DECISION

**VERDICT: [EXECUTE / WAIT / AVOID]**

**Reasoning:**
1. [First reason]
2. [Second reason]
3. [Third reason]
[Continue as needed]

**Risk to decision:** [What specific event or price level would invalidate or change this verdict?]

## EXECUTION PLAN
[Only show if EXECUTE or WAIT. Skip entirely if AVOID.]
[If WAIT — show what the plan WILL be once conditions are met.]

- **Direction:** [Bullish / Bearish]
- **Entry Zone:** [Exact prices from engine — never invented]
- **Invalidation:** [Exact price from engine]
- **Target 1 (TP1):** [Price] — R:R [ratio] — Probability [tp1_pct]%
- **Target 2 (TP2):** [Price] — R:R [ratio]
- **Target 3 (TP3):** [Price] — R:R [ratio]
- **Position Size:** [lot_size] lots — risks $[risk_amount] ([risk_pct]% of account)
- **Break-Even:** Move SL to entry after TP1 hit at [price]
- **Win Probability:** [win_pct]% | Expected Value: [ev]R | [verdict]
- **Wyckoff Context:** [phase and what it means for this trade]
- **Calendar Warning:** [CLEAR / UPCOMING event at time / HARD PAUSE]

## STRUCTURED SIGNAL
[Append this exact block — values from your analysis:]

SIGNAL_JSON_START
{"direction":"Bearish","entry_low":0,"entry_high":0,"sl":0,"tp1":0,"tp2":0,"tp3":0,"score":0,"win_probability":0,"expected_value":0}
SIGNAL_JSON_END

INTEGRITY:
- Every price from Python engine data. Never invented.
- Every fundamental statement from economic calendar or cross-asset data.
- Every sentiment statement from scored headlines — with assessment of whether it is already priced in.
- EXECUTE only when technical + fundamental + sentiment are coherent.
- Temperature 0.1. Precise. Deterministic.
`.trim();
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

  app.post('/api/analyze', async(req,res)=>{
    try {
      const {asset, mode, image, accountSize, riskPct} = req.body;
      const userAccountSize = parseFloat(accountSize) || 10000;
      const userRiskPct     = parseFloat(riskPct) || 1.0;
      if(!process.env.GEMINI_API_KEY) return res.status(500).json({error:'GEMINI_API_KEY not configured.'});
      const derivSymbol = DERIV_SYMBOLS[asset];
      if(!derivSymbol) return res.status(400).json({error:`No Deriv symbol: ${asset}`});

      // 1. Fetch candles
      const timeframes = TIMEFRAMES[mode]||TIMEFRAMES['SCALPING MODE'];
      const candlesByTF: Record<string,Candle[]> = {};
      let rawBlock = `# LIVE OHLCV — ${asset}\nFetched:${new Date().toISOString()}\n`;
      const candleResults = await Promise.allSettled(timeframes.map(tf=>fetchDerivCandles(derivSymbol,tf.granularity,500)));
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

      const [engineResult, newsResult, reasoningResult] = await Promise.allSettled([
        runPythonEngine(candlesByTF, asset, userAccountSize, userRiskPct),
        fetchRSSNews(asset),
        fetchOpenRouterReasoning(asset, earlyContext, etfCandles, ''),
      ]);

      const engineData = engineResult.status === 'fulfilled' ? engineResult.value : {error:'Engine failed'};
      const newsData   = newsResult.status  === 'fulfilled' ? newsResult.value  : {items:[], hasHighImpact:false, highImpactEvents:[], freshCount:0, staleCount:0};
      const openRouterReasoning = reasoningResult.status === 'fulfilled' ? reasoningResult.value : '';

      // Pass news items to Python for sentiment scoring
      // Python scores keywords, AI interprets meaning and context
      const sentimentResult = await runPythonOperation({
        operation:  'score_sentiment',
        news_items: (newsData as any).items || [],
        asset,
      });
      const sentimentIntel = sentimentResult?.error ? null : sentimentResult;

      // Merge sentiment intelligence into engine summary
      if(engineData?._summary && sentimentIntel) {
        engineData._summary.sentiment_intel = sentimentIntel;
      }

      const engineBlock    = formatEngineResults(engineData);
      const newsBlock      = formatNewsBlock(newsData as any, asset);
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
        promptParts.push({inlineData:{data:image.split(',')[1]||image.replace(/^data:image\/\w+;base64,/,''),mimeType:'image/jpeg'}});
        promptParts.push({text:'Chart provided. If you see a spike or reversal candle, describe it and incorporate into analysis.'});
      }

      let responseText = ''; let aiUsed = 'none';

      // ── ANALYSIS LAYER ────────────────────────────────────────────────────
      // Step 1: Gemini 2.5 Flash (3 retries with exponential backoff)
      const ai = new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY});
      try {
        let response:any; let attempt=0;
        const backoff=[3000,8000,15000];
        while(attempt<3){
          try {
            response=await ai.models.generateContent({
              model:'gemini-2.5-flash', contents:promptParts,
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
      } catch(saveErr:any){ console.log('Signal save:',saveErr.message); }

      console.log(`Done. AI:${aiUsed} | News:${newsData.freshCount}fresh/${newsData.staleCount}stale | Reasoning:${openRouterReasoning?'YES':'NO'}`);
      res.json({result:responseText});

    } catch(err:any){ console.log('Error:',err); res.status(500).json({error:err.message}); }
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
