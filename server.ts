import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import WebSocket from 'ws';
import { spawn } from 'child_process';

const DERIV_SYMBOLS: Record<string, string> = {
  EURUSD:'frxEURUSD',GBPUSD:'frxGBPUSD',USDJPY:'frxUSDJPY',
  USDCHF:'frxUSDCHF',AUDUSD:'frxAUDUSD',USDCAD:'frxUSDCAD',NZDUSD:'frxNZDUSD',
  XAUUSD:'frxXAUUSD',XAGUSD:'frxXAGUSD',
  BTCUSD:'cryBTCUSD',ETHUSD:'cryETHUSD',SOLUSD:'crySOLUSD',
  BOOM1000:'BOOM1000',CRASH1000:'CRASH1000',VOL75:'R_75',VOL100:'R_100',
};

const TIMEFRAMES: Record<string, { granularity: number; label: string }[]> = {
  'SCALPING MODE': [
    {granularity:14400,label:'4H'},{granularity:3600,label:'1H'},
    {granularity:900,label:'15M'},{granularity:300,label:'5M'},
  ],
  'SWING MODE': [
    {granularity:86400,label:'D1'},{granularity:14400,label:'4H'},
    {granularity:3600,label:'1H'},{granularity:900,label:'15M'},
  ],
};

interface Candle { epoch:number; open:number; high:number; low:number; close:number; date?:string; }

function fetchDerivCandles(symbol:string, granularity:number, count=500): Promise<Candle[]> {
  return new Promise((resolve,reject) => {
    const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
    let buffer='';
    const timeout = setTimeout(()=>{ ws.terminate(); reject(new Error(`Timeout ${symbol}@${granularity}s`)); },15000);
    ws.on('open',()=>{ ws.send(JSON.stringify({ticks_history:symbol,granularity,count,end:'latest',style:'candles',adjust_start_time:1})); });
    ws.on('message',(raw:Buffer|string)=>{
      buffer+=raw.toString();
      try {
        const data=JSON.parse(buffer); clearTimeout(timeout); ws.close();
        if(data.error) return reject(new Error(data.error.message));
        resolve((data.candles||[]).map((c:any)=>({epoch:c.epoch,open:parseFloat(c.open),high:parseFloat(c.high),low:parseFloat(c.low),close:parseFloat(c.close),date:new Date(c.epoch*1000).toISOString().slice(0,16)})));
      } catch { /* wait for more chunks */ }
    });
    ws.on('error',(err)=>{ clearTimeout(timeout); reject(err); });
  });
}

function runPythonOperation(payload: Record<string, any>): Promise<any> {
  return new Promise((resolve) => {
    const enginePath = path.join(process.cwd(), 'engine.py');
    const pythonCmd  = process.platform === 'win32' ? 'python' : 'python3';
    const proc = spawn(pythonCmd, [enginePath], { timeout: 45000 });
    let stdout = '', stderr = '';
    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    proc.on('close', (code: number) => {
      if (code !== 0 || !stdout.trim()) {
        console.warn('Python operation failed:', stderr || 'no output');
        return resolve({ error: stderr || 'Python engine returned no output' });
      }
      try { resolve(JSON.parse(stdout)); }
      catch { resolve({ error: 'Python JSON parse failed', raw: stdout.slice(0, 200) }); }
    });
    proc.on('error', (err: Error) => {
      console.warn('Python unavailable:', err.message);
      resolve({ error: err.message });
    });
    proc.stdin.on('error', (err: any) => { resolve({ error: err.message }); });
    try {
      proc.stdin.write(JSON.stringify(payload));
      proc.stdin.end();
    } catch (e: any) {
      resolve({ error: e.message });
    }
  });
}

function runPythonEngine(candlesByTF: Record<string,Candle[]>, asset:string): Promise<any> {
  return new Promise((resolve)=>{
    const payload = JSON.stringify({candles:candlesByTF, asset});
    const enginePath = path.join(process.cwd(),'engine.py');
    const pythonCmd  = process.platform==='win32'?'python':'python3';
    const proc = spawn(pythonCmd,[enginePath],{timeout:45000});
    let stdout='',stderr='';
    proc.stdout.on('data',(d:Buffer)=>{ stdout+=d.toString(); });
    proc.stderr.on('data',(d:Buffer)=>{ stderr+=d.toString(); });
    proc.on('close',(code:number)=>{
      if(code!==0||!stdout.trim()){ console.warn('Python engine:',stderr||'no output'); return resolve(null); }
      try { resolve(JSON.parse(stdout)); } catch { console.warn('Python JSON parse error'); resolve(null); }
    });
    proc.on('error',(err:Error)=>{ console.warn('Python unavailable:',err.message); resolve(null); });
    proc.stdin.on('error',(err:any)=>{ console.warn('Python stdin error:',err.message); resolve(null); });
    try { proc.stdin.write(payload); proc.stdin.end(); } catch(e:any){ console.warn('stdin write:',e.message); resolve(null); }
  });
}

function formatEngineResults(engineData:any): string {
  if(!engineData||engineData.error) return '\n# ENGINE RESULTS: Not available — AI works from raw OHLCV only.\n';
  const s=engineData._summary||{};
  let block=`\n# PRE-CALCULATED ENGINE RESULTS\n`;
  block+=`HTF:${s.htf||'N/A'} | ETF:${s.etf||'N/A'} | HTF Trend:${s.htf_trend||'N/A'} | HTF EMA:${s.htf_ema_trend||'N/A'}\n`;
  block+=`Session:${s.session?.session||'N/A'} | Score:${s.session?.score??'N/A'}/5 | Price:${s.asset_price||'N/A'}\n`;
  if(s.ml_score){
    const ml=s.ml_score;
    block+=`ML Score:${ml.score}/100 | Method:${ml.method} | Training:${ml.training_source||'N/A'}\n`;
    block+=`HTF Filter:${ml.htf_filter_applied?'APPLIED':'NOT APPLIED'} | RSI Penalty:${ml.rsi_penalty||0}pts${ml.rsi_penalty_reason?' ('+ml.rsi_penalty_reason+')':''}\n`;
    if(ml.statistical_edge?.status==='REAL_DATA'){
      const se=ml.statistical_edge;
      block+=`REAL EDGE: WR=${se.win_rate_pct}% CI:${se.win_rate_ci} | Sharpe:${se.sharpe_ratio} | Sortino:${se.sortino_ratio} | MaxDD:${se.max_drawdown_atr}ATR | ${se.verdict}\n`;
    }
    if(ml.monte_carlo?.status==='COMPLETE'){
      const mc=ml.monte_carlo;
      block+=`MONTE CARLO (${mc.simulations} sims): P(profit)=${mc.prob_positive_pct}% | P(ruin)=${mc.prob_ruin_pct}% | Median equity:${mc.median_equity_atr}ATR\n`;
      block+=`Interpretation: ${mc.interpretation}\n`;
    }
  }
  if(s.calendar){
    const cal=s.calendar;
    if(cal.hard_pause) block+=`\n⛔ CALENDAR HARD PAUSE: ${cal.pause_reason}\n`;
    else if(cal.events?.length){
      block+=`\nECONOMIC CALENDAR (next high-impact events):\n`;
      cal.events.slice(0,3).forEach((e:any)=>{ block+=`  ${e.title} (${e.currency}) @ ${e.time_utc} — ${e.status} | Forecast:${e.forecast} Prev:${e.previous}\n`; });
    }
  }
  const tfs=Object.keys(engineData).filter(k=>k!=='_summary');
  for(const tf of tfs){
    const d=engineData[tf];
    block+=`\n## ${tf}\n`;
    block+=`ATR:${d.atr} | Trend:${d.trend} | EMA:${d.ema_trend||'N/A'} | Price:${d.current_price}\n`;
    if(d.regime){
      const r=d.regime;
      block+=`REGIME: ${r.regime} | Hurst:${r.hurst?.hurst||'N/A'} | ADX:${r.adx?.adx||'N/A'} [${r.adx?.strength||'N/A'}] | VolPct:${r.volatility?.percentile||'N/A'}%\n`;
      block+=`Implication: ${r.implication||'N/A'}\n`;
    }
    if(d.volume_profile?.status==='OK'){
      const vp=d.volume_profile;
      block+=`VOLUME PROFILE: POC=${vp.poc} | VAH=${vp.vah} | VAL=${vp.val} | Price is ${vp.poc_relation}\n`;
      if(vp.hvn?.length) block+=`HVN: ${vp.hvn.map((h:any)=>h.price).join(', ')}\n`;
      if(vp.lvn?.length) block+=`LVN: ${vp.lvn.map((l:any)=>l.price).join(', ')}\n`;
    }
    if(d.indicators){
      const i=d.indicators;
      block+=`RSI:${i.rsi?.value??'N/A'} [${i.rsi?.zone??'N/A'}] | MACD:${i.macd?.direction??'N/A'} | ADX:${i.adx?.adx??'N/A'} [${i.adx?.strength??'N/A'}]\n`;
      block+=`EMA20:${i.ema_20?.value??'N/A'} EMA50:${i.ema_50?.value??'N/A'} EMA200:${i.ema_200?.value??'N/A'}\n`;
      block+=`BB: U=${i.bollinger?.upper??'N/A'} M=${i.bollinger?.middle??'N/A'} L=${i.bollinger?.lower??'N/A'} Pos:${i.bollinger?.position??'N/A'}% Squeeze:${i.bollinger?.squeeze??false}\n`;
      if(i.vwap) block+=`VWAP:${i.vwap}\n`;
    }
    if(d.bos_choch?.length){ block+=`STRUCTURE:\n`; d.bos_choch.forEach((e:any)=>block+=`  ${e.type} @ ${e.price} on ${e.date}\n`); }
    if(d.swing_highs?.length||d.swing_lows?.length){ block+=`SWINGS:\n`; d.swing_highs?.forEach((s:any)=>block+=`  SH@${s.price} ${s.date}\n`); d.swing_lows?.forEach((s:any)=>block+=`  SL@${s.price} ${s.date}\n`); }
    if(d.fvg_fresh?.length){ block+=`FRESH FVGs:\n`; d.fvg_fresh.forEach((f:any)=>block+=`  ${f.direction}FVG ${f.bottom}-${f.top} ${f.date} ATR:${f.atr_ratio}x\n`); }
    if(d.fvg_mitigated?.length){ block+=`MITIGATED FVGs:\n`; d.fvg_mitigated.forEach((f:any)=>block+=`  ${f.direction}FVG ${f.bottom}-${f.top} ${f.date} — TAPPED\n`); }
    if(d.ob_fresh?.length){ block+=`FRESH OBs:\n`; d.ob_fresh.forEach((o:any)=>block+=`  ${o.direction}OB ${o.low}-${o.high} ${o.date} Impulse:${o.atr_ratio}x Touches:${o.touch_count||0}\n`); }
    if(d.ob_mitigated?.length){ block+=`MITIGATED OBs:\n`; d.ob_mitigated.forEach((o:any)=>block+=`  ${o.direction}OB ${o.low}-${o.high} ${o.date} — TAPPED\n`); }
    if(d.liquidity){
      block+=`LIQUIDITY:\n`;
      d.liquidity.bsl?.forEach((b:any)=>block+=`  BSL@${b.price} ${b.status} ${b.distance_pct}% away | Sweep Quality:${b.sweep_quality||'N/A'} Strength:${b.sweep_strength_atr||0}ATR\n`);
      d.liquidity.ssl?.forEach((s:any)=>block+=`  SSL@${s.price} ${s.status} ${s.distance_pct}% away | Sweep Quality:${s.sweep_quality||'N/A'} Strength:${s.sweep_strength_atr||0}ATR\n`);
      d.liquidity.equal_highs?.forEach((e:any)=>block+=`  EQH~${e.avg}\n`);
      d.liquidity.equal_lows?.forEach((e:any) =>block+=`  EQL~${e.avg}\n`);
    }
    if(d.premium_discount){ const pd=d.premium_discount; block+=`P/D: ${pd.status} @${pd.percentage}% Range:${pd.range_low}-${pd.range_high} EQ:${pd.equilibrium} | ${pd.note||''}\n`; }
    if(d.backtest?.status==='COMPLETE'){
      const bt=d.backtest;
      block+=`BACKTEST: ${bt.trades} trades WR=${bt.win_rate_pct}% (adj:${bt.win_rate_adjusted_pct}%) PF=${bt.profit_factor} Exp=${bt.expectancy_atr}ATR | ${bt.verdict}\n`;
    }
    block+='\n';
  }
  return block;
}

function buildSystemPrompt(asset:string, mode:string): string {
  return `
You are QUANT-X, an institutional-grade market analysis engine.
You receive: (1) raw OHLCV candle data, (2) pre-calculated Python engine results including regime classification, volume profile, sweep quality, economic calendar, ML score with real statistical edge, Monte Carlo simulation, (3) live macro news.

YOUR ROLE: Interpret engine results. Use pre-calculated levels. Explain macro reasons. Score confluence. Produce execution plan. Never invent prices.

═══════════════════════════════════════════════════════
MARKET REGIME INTERPRETATION
═══════════════════════════════════════════════════════
The engine classifies regime using Hurst Exponent + ADX + Volatility Percentile.
Use the regime implication in your Market Narrative:
- TRENDING_STRONG: follow trend, use BOS+OB entries, wide targets
- TRENDING_MODERATE: follow trend, tighter stops
- MEAN_REVERTING: fade extremes, enter at premium/discount, tight targets
- VOLATILITY_EXPANSION: breakout mode, wait for direction then follow
- VOLATILITY_COMPRESSION: breakout imminent, avoid ranging entries
- TRANSITIONING: reduce size, wait for clear regime

VOLUME PROFILE INTERPRETATION:
- POC (Point of Control) = highest activity price — acts as magnet
- VAH/VAL = Value Area High/Low — 70% of activity sits here
- Price above VAH = in premium of value area (potential short)
- Price below VAL = in discount of value area (potential long)
- LVN (Low Volume Node) = price gaps through quickly — use as target
- HVN (High Volume Node) = price consolidates here — use as S/R

LIQUIDITY SWEEP QUALITY:
- HIGH quality sweep (strength>1.5ATR, displacement>1ATR) = institutional confirmation
- MEDIUM quality = retail sweep, moderate probability
- LOW quality = weak sweep, may not have cleared all stops
- Only use HIGH quality sweeps as confirmation signals

ECONOMIC CALENDAR:
- If HARD PAUSE flag is set: do NOT produce an execution plan — output calendar warning instead
- If event is UPCOMING within 2 hours: add trade pause warning to execution plan
- If event JUST_RELEASED: note elevated volatility, widen stops

═══════════════════════════════════════════════════════
LEVEL TAP DETECTION — CRITICAL RULES
═══════════════════════════════════════════════════════
Before writing any "wait for price to tap" instruction, check:
1. Is current price already inside the level range? → level TAPPED
2. Has price already passed through? → level MITIGATED — do not reference
3. NEVER repeat "wait for tap" on a MITIGATED level

OB MULTIPLE TESTS:
- Touch 1: valid entry
- Touch 2: still valid if <50% body penetrated
- Touch 3: weakening — reduce size
- Touch 4 or full body close through: BROKEN

FVG: mitigated once price closes inside. Can still act as S/R but lower probability.

Level hierarchy: OB+FVG overlap > OB alone > FVG alone > S/D alone

═══════════════════════════════════════════════════════
CONFLUENCE SCORING
═══════════════════════════════════════════════════════
Show scoring exactly like this:

  Structure alignment (HTF BOS = trade direction): [0 or 20]
  Liquidity target present and logical: [0 or 15]
  HTF confirmed on ETF via CHoCH: [0 or 15]
  Fresh OB at entry zone: [0 or 10]
  Fresh FVG at entry zone: [0 or 10]
  S/D zone overlaps OB: [0 or 10]
  Price in Premium/Discount alignment: [0 or 10]
  PA confirmation candle: [0 or 5]
  Session score (from engine): [0 or 5]
  SUBTOTAL: [sum]
  HTF Hard Filter (HTF≠trade direction → cap 40): Applied [YES/NO]
  RSI Contradiction Penalty (RSI<30 shorting or RSI>70 buying → -10): [0 or -10] [reason]
  Post-penalty total: [subtotal - penalty, capped if filter applied]
  FINAL SCORE: [n]/100

Each component binary. No halves.
Grade: A+=90-100 | A=80-89 | B=70-79 | C=60-69 | REJECT<60

═══════════════════════════════════════════════════════
OUTPUT FORMAT — MANDATORY
═══════════════════════════════════════════════════════

## MARKET SUMMARY
- **Asset:** ${asset}
- **Mode:** ${mode}
- **Timestamp:** [from engine]
- **Current Price:** [from engine]
- **HTF Bias:** [Strong Bullish/Bullish/Neutral/Bearish/Strong Bearish]
- **EMA Trend:** [from engine]
- **Market Regime:** [from engine regime field]
- **Regime Implication:** [from engine implication field]
- **P/D Position:** [from engine] — [%] — [note if outside range]
- **Volume Profile:** POC=[poc] | VAH=[vah] | VAL=[val] | [poc_relation]
- **RSI:** [value] [zone]
- **Backtest Edge:** [verdict] WR=[win_rate_pct]% (adj=[win_rate_adjusted_pct]%)
- **Statistical Edge:** [from real_data if available, or ACCUMULATING]
- **Monte Carlo:** [prob_positive_pct]% chance profit | P(ruin)=[prob_ruin_pct]% [or ACCUMULATING]
- **Confluence Score:** [n]/100
- **Trade Grade:** [A+/A/B/C/REJECTED]

## CALENDAR WARNING
[If hard_pause: show the event, time, and reason why trading is paused. Do not produce execution plan.]
[If upcoming event: show it here with time remaining.]
[If clear: "No high-impact events in next 4 hours."]

## MACRO CONTEXT
[2-3 sentences from news. WHY price is moving. Macro drivers. Rate expectations.]

## REGIME ANALYSIS
[Explain what the Hurst+ADX+Volatility regime means for this specific setup. What type of entries are favoured.]

## STRUCTURE ANALYSIS
[BOS and CHoCH events from engine. HTF first then ETF. Minimum 3 events.]

## VOLUME PROFILE ANALYSIS
[Explain POC, VAH, VAL significance. Where is current price relative to value area. HVN/LVN targets.]

## LIQUIDITY MAP
[BSL and SSL from engine. Include sweep quality ratings. Only reference HIGH quality sweeps for confirmation.]

## KEY LEVELS — STATUS ASSESSMENT
[Each fresh OB/FVG/SD with: price range, date, STATUS, touch count if OB]

## CONFLUENCE SCORECARD
[Full breakdown as specified above]

## MARKET NARRATIVE
[4-6 sentences combining: regime + structure + volume profile + sweep quality + macro. Professional-grade reasoning.]

## EXECUTION PLAN
[If calendar hard_pause is active: replace execution plan with calendar warning only.]
- **Direction:** [Bullish/Bearish/NEUTRAL — NO TRADE]
- **Regime Compatibility:** [Is this entry type compatible with current regime?]
- **Level Status:** [FRESH/TAPPED-reacting/TAPPED-multiple tests n touches/MITIGATED]
- **Wait Condition:** [Precise condition. Never "wait for tap" on mitigated level.]
- **Entry Zone:** [Exact prices from engine]
- **Invalidation:** [Exact price from engine]
- **Target 1 (TP1):** [Nearest SSL or BSL — never N/A]
- **Target 2 (TP2):** [Second liquidity level or entry ± 2x ATR — never N/A]
- **Target 3 (TP3):** [Third level or macro target or entry ± 3x ATR — never N/A]
- **Estimated R:R:** [ratio]
- **Calendar Warning:** [HARD PAUSE — event / CAUTION — event in Xmin / CLEAR]
- **Backtest Note:** [win_rate_pct]% raw / [win_rate_adjusted_pct]% adjusted. [verdict]. [backtest_note]
- **Statistical Confidence:** [From real edge if available. Or: Accumulating — X real outcomes recorded so far.]

If score<60 or hard filter triggered:
# ⛔ NO TRADE SETUP FOUND
**Score:** [n]/100
**Reason:**
1. [Structural reason]
2. [Level/mitigation reason]
3. [Regime incompatibility if applicable]
4. [Macro/calendar reason]
5. [What must change]

INTEGRITY RULES:
- Every price from engine or OHLCV data. Never invented.
- Never reference MITIGATED levels as entry targets.
- Every macro statement from news block only.
- If calendar hard_pause: NO execution plan. Show calendar warning only.
- INSUFFICIENT DATA for any missing field.
- Temperature 0.1. Precise. Deterministic.
`.trim();
}

function generateRuleBasedSummary(asset:string, mode:string, engineData:any): string {
  if(!engineData||engineData.error) return `## ⚠️ FULL FALLBACK\n\nBoth AI models unavailable and Python engine returned no data.\n\nPlease try again in a few minutes.`;
  const s=engineData._summary||{}; const ml=s.ml_score||{}; const cal=s.calendar||{};
  const htf=engineData[s.htf]||{}; const etf=engineData[s.etf]||{};
  const pd=etf.premium_discount||{}; const bt=htf.backtest||{};
  const regime=etf.regime||{}; const vp=etf.volume_profile||{};

  let lvls='';
  etf.ob_fresh?.forEach((o:any)=>{ lvls+=`- Fresh ${o.direction}OB: ${o.low}–${o.high} (${o.date}) Touches:${o.touch_count||0}\n`; });
  etf.fvg_fresh?.forEach((f:any)=>{ lvls+=`- Fresh ${f.direction}FVG: ${f.bottom}–${f.top} (${f.date})\n`; });

  return `## MARKET SUMMARY (RULE-BASED — AI MODELS UNAVAILABLE)
- **Asset:** ${asset} | **Mode:** ${mode}
- **Price:** ${s.asset_price||'N/A'} | **Session:** ${s.session?.session||'N/A'}
- **HTF Bias:** ${s.htf_trend||'N/A'} | **EMA Trend:** ${s.htf_ema_trend||'N/A'}
- **Regime:** ${regime.regime||'N/A'} — ${regime.implication||'N/A'}
- **P/D:** ${pd.status||'N/A'} @${pd.percentage||'N/A'}% | ${pd.note||''}
- **Volume Profile:** POC=${vp.poc||'N/A'} | VAH=${vp.vah||'N/A'} | VAL=${vp.val||'N/A'}
- **ML Score:** ${ml.score||'N/A'}/100 (${ml.method||'N/A'})
${ml.statistical_edge?.status==='REAL_DATA'?`- **Real Edge:** WR=${ml.statistical_edge.win_rate_pct}% CI:${ml.statistical_edge.win_rate_ci} Sharpe:${ml.statistical_edge.sharpe_ratio}`:'- **Real Edge:** Accumulating real trade outcomes...'}
${ml.monte_carlo?.status==='COMPLETE'?`- **Monte Carlo:** P(profit)=${ml.monte_carlo.prob_positive_pct}% P(ruin)=${ml.monte_carlo.prob_ruin_pct}%`:''}

---
## ⚠️ SYSTEM NOTIFICATION
Both Gemini and GPT-4o are unavailable. Python engine ran successfully.
${cal.hard_pause?`\n⛔ CALENDAR HARD PAUSE: ${cal.pause_reason}\n`:''}

## CALCULATED LEVELS
${lvls||'- No fresh levels on ETF\n'}
BSL: ${etf.liquidity?.bsl?.slice(0,3).map((b:any)=>`${b.price}(${b.distance_pct}%,${b.sweep_quality})`).join(' | ')||'N/A'}
SSL: ${etf.liquidity?.ssl?.slice(0,3).map((s:any)=>`${s.price}(${s.distance_pct}%,${s.sweep_quality})`).join(' | ')||'N/A'}
${bt.status==='COMPLETE'?`Backtest: WR=${bt.win_rate_pct}% adj=${bt.win_rate_adjusted_pct}% PF=${bt.profit_factor} | ${bt.verdict}`:''}

**Try again in 2-3 minutes for full AI analysis.**`;
}

async function startServer() {
  const app=express(); const PORT=3000;
  app.use(express.json({limit:'50mb'}));
  app.use(express.urlencoded({extended:true,limit:'50mb'}));

  // ── Outcome checker endpoint ──────────────────────────────────────────────
  // Called by frontend every 30 minutes or manually
  // Checks all open signals against current Deriv prices and marks WIN/LOSS
  app.post('/api/check-outcomes', async (req, res) => {
    try {
      const { asset } = req.body;
      console.log(`Checking outcomes${asset ? ' for ' + asset : ' for all assets'}...`);
      const result = await runPythonOperation({
        operation: 'check_outcomes',
        asset: asset || null,
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Signal dashboard endpoint ─────────────────────────────────────────────
  // Returns signal history with outcomes, win rates, streaks
  app.get('/api/dashboard', async (req, res) => {
    try {
      const asset = req.query.asset as string | undefined;
      const limit = parseInt(req.query.limit as string || '50');
      const result = await runPythonOperation({
        operation: 'get_dashboard',
        asset: asset || null,
        limit,
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Manual signal save endpoint ───────────────────────────────────────────
  // Called after each analysis to save the signal for outcome tracking
  app.post('/api/save-signal', async (req, res) => {
    try {
      const signal = req.body;
      const result = await runPythonOperation({
        operation: 'save_signal',
        signal,
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/analyze', async(req,res)=>{
    try {
      const {asset,mode,image}=req.body;
      if(!process.env.GEMINI_API_KEY) return res.status(500).json({error:'GEMINI_API_KEY not configured.'});
      const derivSymbol=DERIV_SYMBOLS[asset];
      if(!derivSymbol) return res.status(400).json({error:`No Deriv symbol for: ${asset}`});

      // 1. Fetch candles
      const timeframes=TIMEFRAMES[mode]||TIMEFRAMES['SCALPING MODE'];
      const candlesByTF:Record<string,Candle[]>={};
      let rawBlock=`# LIVE OHLCV — ${asset}\nFetched:${new Date().toISOString()}\n`;
      const results=await Promise.allSettled(timeframes.map(tf=>fetchDerivCandles(derivSymbol,tf.granularity,500)));
      for(let i=0;i<timeframes.length;i++){
        const tf=timeframes[i]; const r=results[i];
        if(r.status==='fulfilled'&&r.value.length>0){
          candlesByTF[tf.label]=r.value;
          const last=r.value[r.value.length-1]; const oldest=r.value[0];
          rawBlock+=`\n${tf.label}: ${r.value.length} candles | ${oldest.date} to ${last.date} | Close:${last.close}\n`;
          const rows=r.value.slice(-200).map(c=>`${c.date},${c.open},${c.high},${c.low},${c.close}`);
          rawBlock+=`time,open,high,low,close\n${rows.join('\n')}\n`;
        } else { rawBlock+=`\n${tf.label}: FETCH FAILED\n`; }
      }

      // 2. Python engine (passes asset for calendar + DB)
      const engineData=await runPythonEngine(candlesByTF,asset);
      const engineBlock=formatEngineResults(engineData);

      // 3. Check calendar hard pause
      const calHardPause=engineData?._summary?.calendar?.hard_pause||false;
      const calPauseReason=engineData?._summary?.calendar?.pause_reason||'';

      // 4. News scraper (kept as backup context)
      const newsResults=await scrapeNews(asset);
      const newsBlock=formatNewsBlock(newsResults,asset);
      const hasHighImpact=newsResults.some(r=>r.hasHighImpactEvent);

      // 5. Build prompt
      const calWarning=calHardPause
        ?`\n⛔ CALENDAR HARD PAUSE ACTIVE: ${calPauseReason}\nDo NOT produce an execution plan. Show the calendar warning only and explain why trading is paused.\n`
        :'';
      const userPrompt=[
        rawBlock, engineBlock, newsBlock, calWarning,
        `Perform complete institutional analysis for ${asset} in ${mode}.`,
        `Use engine results for all price levels. Use news for macro context.`,
        `Before any "wait for tap" instruction: verify the level is not MITIGATED in engine results above.`,
        calHardPause?`CALENDAR HARD PAUSE IS ACTIVE. Do not produce entry signals.`
          :hasHighImpact?`⚠️ HIGH-IMPACT EVENT in news. Add trade pause warning to execution plan.`
          :`No high-impact events detected.`,
      ].join('\n\n');

      const promptParts:any[]=[{text:userPrompt}];
      if(image){
        promptParts.push({inlineData:{data:image.split(',')[1]||image.replace(/^data:image\/\w+;base64,/,''),mimeType:'image/jpeg'}});
        promptParts.push({text:'Chart image provided. Cross-reference with engine results. Note if price has already tapped any level visible on chart.'});
      }

      // 6. Gemini with retry
      const ai=new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY});
      let responseText=''; let aiUsed='none';

      try {
        let response:any;
        try {
          response=await ai.models.generateContent({model:'gemini-2.5-flash',contents:promptParts,config:{systemInstruction:buildSystemPrompt(asset,mode),temperature:0.1}});
        } catch(e1:any){
          const m=e1.message||'';
          if(m.includes('503')||m.includes('UNAVAILABLE')||m.includes('429')||m.includes('overloaded')){
            console.log('Gemini overloaded, retrying in 4s...');
            await new Promise(r=>setTimeout(r,4000));
            response=await ai.models.generateContent({model:'gemini-2.5-flash',contents:promptParts,config:{systemInstruction:buildSystemPrompt(asset,mode),temperature:0.1}});
          } else { throw e1; }
        }
        responseText=response.text||''; aiUsed='gemini';

      } catch(geminiErr:any){
        console.warn('Gemini failed:',geminiErr.message);

        // 7. GPT-4o fallback
        if(process.env.GITHUB_TOKEN){
          try {
            console.log('Attempting GPT-4o fallback...');
            const OpenAI=(await import('openai')).default;
            const client=new OpenAI({baseURL:'https://models.inference.ai.azure.com',apiKey:process.env.GITHUB_TOKEN});
            let gptRaw=`# LIVE OHLCV — ${asset}\nFetched:${new Date().toISOString()}\n`;
            for(const tf of timeframes){ const c=candlesByTF[tf.label]; if(c?.length>0){ const last=c[c.length-1]; gptRaw+=`\n${tf.label}: Close:${last.close}\n`; const rows=c.slice(-50).map(x=>`${x.date},${x.open},${x.high},${x.low},${x.close}`); gptRaw+=`time,open,high,low,close\n${rows.join('\n')}\n`; } }
            const gptPrompt=[gptRaw,engineBlock,newsBlock,calWarning,
              `Perform complete institutional analysis for ${asset} in ${mode}.`,
              `Use engine results for all price levels. Use news for macro context.`,
              `Before any "wait for tap" instruction: verify the level is not MITIGATED in engine results above.`,
              calHardPause?'CALENDAR HARD PAUSE IS ACTIVE. Do not produce entry signals.'
                :hasHighImpact?'⚠️ HIGH-IMPACT EVENT in news. Add trade pause warning.'
                :'No high-impact events detected.',
            ].join('\n\n');
            const fallback=await client.chat.completions.create({
              model:'gpt-4o',
              messages:[{role:'system',content:buildSystemPrompt(asset,mode)},{role:'user',content:gptPrompt}],
              temperature:0.1,
            });
            responseText=fallback.choices[0].message?.content||'';
            aiUsed='gpt-4o';
            responseText=`> ⚡ **Analysis by GPT-4o** (Gemini unavailable)\n\n${responseText}`;
          } catch(gptErr:any){
            console.warn('GPT-4o failed:',gptErr.message);
            responseText=generateRuleBasedSummary(asset,mode,engineData);
            aiUsed='rule-based';
          }
        } else {
          responseText=generateRuleBasedSummary(asset,mode,engineData);
          aiUsed='rule-based';
        }
      }

      // Auto-save signal to database for outcome tracking
      // Parse direction and key levels from engine data to save
      try {
        const summary    = engineData?._summary || {};
        const etfKey     = summary.etf || '';
        const etfData    = engineData?.[etfKey] || {};
        const htfKey     = summary.htf || '';
        const htfData    = engineData?.[htfKey] || {};
        const mlScore    = summary.ml_score?.score;
        const htfTrend   = summary.htf_trend || '';
        const etfTrend   = etfData.trend || '';
        const rsiHtf     = htfData.indicators?.rsi?.value || null;
        const atr        = etfData.atr || null;
        const regime     = etfData.regime?.regime || '';
        const session    = summary.session?.session || '';

        // Extract direction from response text
        const dirMatch   = responseText.match(/\*\*Direction:\*\*\s*(Bullish|Bearish|NEUTRAL)/i);
        const direction  = dirMatch ? dirMatch[1] : 'NEUTRAL';

        // Extract entry zone
        const entryMatch = responseText.match(/\*\*Entry Zone:\*\*\s*([\d.]+)\s*[-–]\s*([\d.]+)/i);
        const entryLow   = entryMatch ? parseFloat(entryMatch[1]) : null;
        const entryHigh  = entryMatch ? parseFloat(entryMatch[2]) : null;

        // Extract SL
        const slMatch    = responseText.match(/\*\*Invalidation:\*\*\s*[A-Za-z ]*?([\d.]+)/i);
        const sl         = slMatch ? parseFloat(slMatch[1]) : null;

        // Extract TP1
        const tp1Match   = responseText.match(/\*\*Target 1[^:]*:\*\*[^$\d]*([\d.]+)/i);
        const tp1        = tp1Match ? parseFloat(tp1Match[1]) : null;

        // Extract TP2
        const tp2Match   = responseText.match(/\*\*Target 2[^:]*:\*\*[^$\d]*([\d.]+)/i);
        const tp2        = tp2Match ? parseFloat(tp2Match[1]) : null;

        // Extract TP3
        const tp3Match   = responseText.match(/\*\*Target 3[^:]*:\*\*[^$\d]*([\d.]+)/i);
        const tp3        = tp3Match ? parseFloat(tp3Match[1]) : null;

        // Only save if we have a real directional signal (not NEUTRAL)
        if (direction !== 'NEUTRAL' && entryLow && sl && tp1) {
          const saveResult = await runPythonOperation({
            operation:  'save_signal',
            signal: {
              asset, mode, direction,
              entry_low:  entryLow,
              entry_high: entryHigh || entryLow,
              tp1, tp2: tp2 || null, tp3: tp3 || null, sl,
              score:      mlScore || null,
              htf_trend:  htfTrend,
              etf_trend:  etfTrend,
              rsi_htf:    rsiHtf,
              atr, regime, session,
            },
          });
          if (saveResult?.signal_id) {
            console.log(`Signal saved to DB: ID=${saveResult.signal_id} ${asset} ${direction} Score:${mlScore}`);
            responseText += `\n\n---\n> 📊 **Signal ID #${saveResult.signal_id} recorded** — outcome will be tracked automatically.`;
          }
        }
      } catch (saveErr: any) {
        console.warn('Signal save failed (non-critical):', saveErr.message);
      }

      console.log(`Analysis complete. AI:${aiUsed}`);
      res.json({result:responseText});

    } catch(err:any){
      console.error('Analysis error:',err);
      res.status(500).json({error:err.message||'Analysis failed.'});
    }
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
    console.log(`QUANT-X running on http://localhost:${PORT}`);
    console.log(`Engine: ${path.join(process.cwd(),'engine.py')}`);
    console.log(`Database: quant_signals.db (auto-created on first analysis)`);

    // ── Auto outcome checker — runs every 30 minutes ──────────────────────
    // Checks all open signals against live Deriv prices
    // Marks WIN, LOSS, or EXPIRED automatically
    // This is what makes the statistical edge REAL
    const OUTCOME_CHECK_INTERVAL = 30 * 60 * 1000; // 30 minutes

    const runOutcomeCheck = async () => {
      try {
        console.log(`[${new Date().toISOString()}] Running automatic outcome check...`);
        const result = await runPythonOperation({ operation: 'check_outcomes', asset: null });
        if (result.updated > 0) {
          console.log(`Outcome check: ${result.checked} checked, ${result.updated} updated.`);
          result.details
            ?.filter((d: any) => d.outcome && d.outcome !== 'STILL OPEN')
            .forEach((d: any) => {
              console.log(`  Signal #${d.id} ${d.asset} ${d.direction}: ${d.outcome} | PnL: ${d.pnl_atr} ATR`);
            });
        } else {
          console.log(`Outcome check: ${result.checked} checked, none resolved yet.`);
        }
      } catch (err: any) {
        console.warn('Auto outcome check failed:', err.message);
      }
    };

    // Run once after 5 minutes of startup, then every 30 minutes
    setTimeout(runOutcomeCheck, 5 * 60 * 1000);
    setInterval(runOutcomeCheck, OUTCOME_CHECK_INTERVAL);

    console.log(`Outcome checker: runs every 30 minutes automatically.`);
    console.log(`Manual check: POST /api/check-outcomes`);
    console.log(`Dashboard: GET /api/dashboard?asset=XAUUSD`);
  });
}

// ─── News scraper (kept for backup macro context) ─────────────────────────────
const HIGH_IMPACT_EVENTS=['CPI','NFP','nonfarm payroll','FOMC','interest rate decision','GDP','PPI','retail sales','unemployment','Fed meeting','ECB decision','Bank of Japan','inflation data','Fed speakers','Powell','rate hike','rate cut'];
const ASSET_KEYWORDS:Record<string,string[]>={XAUUSD:['gold','XAU','bullion'],XAGUSD:['silver','XAG'],EURUSD:['euro','EUR','ECB'],GBPUSD:['pound','GBP','sterling'],USDJPY:['yen','JPY','BOJ'],USDCHF:['franc','CHF'],AUDUSD:['aussie','AUD'],USDCAD:['loonie','CAD'],NZDUSD:['kiwi','NZD'],BTCUSD:['bitcoin','BTC'],ETHUSD:['ethereum','ETH'],SOLUSD:['solana','SOL'],BOOM1000:['boom','synthetic'],CRASH1000:['crash','synthetic'],VOL75:['volatility','synthetic'],VOL100:['volatility','synthetic']};
function getNewsSources(asset:string):{url:string;name:string}[]{
  const isCrypto=['BTCUSD','ETHUSD','SOLUSD'].includes(asset); const isGold=['XAUUSD','XAGUSD'].includes(asset);
  const base=[{url:'https://www.financemagnates.com/trending/',name:'Finance Magnates'},{url:'https://www.forexlive.com/',name:'ForexLive'},{url:'https://www.dailyfx.com/news',name:'DailyFX'}];
  if(isGold){base.push({url:'https://tradingeconomics.com/commodity/gold',name:'Trading Economics'});base.push({url:'https://www.investing.com/news/commodities-news',name:'Investing.com'});}
  else if(isCrypto){base.push({url:'https://coindesk.com/markets/',name:'CoinDesk'});base.push({url:'https://cointelegraph.com/',name:'CoinTelegraph'});}
  else{base.push({url:'https://www.investing.com/news/forex-news',name:'Investing.com'});base.push({url:'https://tradingeconomics.com/calendar',name:'Econ Calendar'});}
  return base;
}
interface NewsResult{source:string;headlines:string[];hasHighImpactEvent:boolean;eventWarnings:string[];}
async function scrapeNews(asset:string):Promise<NewsResult[]>{
  const keywords=ASSET_KEYWORDS[asset]||[asset.toLowerCase()]; const sources=getNewsSources(asset); const results:NewsResult[]=[];
  await Promise.allSettled(sources.map(async(source)=>{
    try{
      const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),8000);
      const response=await fetch(source.url,{signal:controller.signal,headers:{'User-Agent':'Mozilla/5.0','Accept':'text/html'}});
      clearTimeout(timeout); if(!response.ok) return;
      const html=await response.text();
      const text=html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s{2,}/g,' ').trim();
      const sentences=text.split(/[.\n]/).map(s=>s.trim()).filter(s=>s.length>40&&s.length<300);
      const relevant=sentences.filter(s=>keywords.some(kw=>s.toLowerCase().includes(kw.toLowerCase()))).slice(0,8);
      if(relevant.length===0) return;
      const eventWarnings:string[]=[]; const allText=relevant.join(' ').toLowerCase();
      for(const event of HIGH_IMPACT_EVENTS){if(allText.includes(event.toLowerCase())) eventWarnings.push(event);}
      results.push({source:source.name,headlines:relevant,hasHighImpactEvent:eventWarnings.length>0,eventWarnings});
    } catch{ /* skip */ }
  }));
  return results;
}
function formatNewsBlock(newsResults:NewsResult[],asset:string):string{
  if(newsResults.length===0) return '\n# NEWS: No sources reachable.\n';
  const allW=[...new Set(newsResults.flatMap(r=>r.eventWarnings))]; const hi=newsResults.some(r=>r.hasHighImpactEvent);
  let block=`\n# MACRO NEWS — ${asset}\nScraped:${new Date().toISOString()}\n`;
  if(hi){block+=`\n⚠️ HIGH-IMPACT EVENT: ${allW.join(', ')}\nTRADE PAUSE RECOMMENDED.\n`;}
  for(const r of newsResults){block+=`\n## ${r.source}\n`;r.headlines.forEach((h,i)=>{block+=`${i+1}. ${h}\n`;});}
  block+='\nEND NEWS\n'; return block;
}

startServer();
