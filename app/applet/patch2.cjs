const fs = require('fs');

// --- PATCH ENGINE.PY ---
let engine = fs.readFileSync('engine.py', 'utf8');

// Fix #2
const oldHtfTradesLoop = `        idx=event['index']; direction='LONG' if 'BULL' in event['type'] else 'SHORT'
        entry=candles[idx]['close']; atr_at=calc_atr(candles[:idx+1]) if idx>=14 else atr
        if atr_at==0: continue`;

const properHtfTradesLoop = `        idx       = event['index']
        direction = 'LONG' if 'BULL' in event['type'] else 'SHORT'
        atr_at    = calc_atr(candles[:idx+1]) if idx >= 14 else atr
        if atr_at == 0:
            continue

        # Use nearest fresh OB or FVG as entry (real SMC methodology)
        entry       = None
        entry_type  = 'BOS_CLOSE_FALLBACK'

        for ob in reversed(obs):
            dir_match = ('BULL' if direction == 'LONG' else 'BEAR')
            if ob['direction'] == dir_match and ob['index'] < idx and ob['status'] == 'FRESH':
                entry      = (ob['high'] + ob['low']) / 2
                entry_type = f"OB@{ob['low']}-{ob['high']}"
                break

        if entry is None:
            for fvg in reversed(fvgs):
                dir_match = ('BULL' if direction == 'LONG' else 'BEAR')
                if fvg['direction'] == dir_match and fvg['index'] < idx and fvg['status'] == 'FRESH':
                    entry      = (fvg['top'] + fvg['bottom']) / 2
                    entry_type = f"FVG@{fvg['bottom']}-{fvg['top']}"
                    break

        if entry is None:
            entry      = candles[idx]['close']
            entry_type = 'BOS_CLOSE_FALLBACK'`;
            
engine = engine.replace(oldHtfTradesLoop, properHtfTradesLoop);

const oldTradesAppend = `        trades.append({'direction':direction,'entry':round(entry,6),'exit':round(exit_price,6),'outcome':outcome,'pnl_atr':round(pnl/atr_at,3),'bars':bars,'date':candles[idx].get('date',str(candles[idx]['epoch']))})`;

const newTradesAppend = `        trades.append({
            'direction':  direction,
            'entry':      round(entry, 6),
            'exit':       round(exit_price, 6),
            'outcome':    outcome,
            'pnl_atr':    round(pnl/atr_at, 3),
            'bars':       bars,
            'entry_type': entry_type,
            'date':       candles[idx].get('date', str(candles[idx]['epoch'])),
        })`;

engine = engine.replace(oldTradesAppend, newTradesAppend);

let oldReturnTrades = `    return {
        'status':'COMPLETE','trades':len(trades),'wins':len(wins),'losses':len(losses),`;

let newReturnTrades = `    ob_entries  = sum(1 for t in trades if 'OB@'       in t.get('entry_type',''))
    fvg_entries = sum(1 for t in trades if 'FVG@'      in t.get('entry_type',''))
    bos_entries = sum(1 for t in trades if 'BOS_CLOSE' in t.get('entry_type',''))
    return {
        'status':          'COMPLETE',
        'trades':          len(trades),
        'wins':            len(wins),
        'losses':          len(losses),
        'entry_breakdown': {'ob': ob_entries, 'fvg': fvg_entries, 'bos_fallback': bos_entries},`;

engine = engine.replace(oldReturnTrades, newReturnTrades);


// Fix #5 
const oldWeights = `        def component_boost(field_idx, default_weight, boost_max=5):
            """Boost weight if this component correlates with wins."""
            win_vals  = [r[field_idx] for r in wins   if len(r) > field_idx and r[field_idx] is not None]
            loss_vals = [r[field_idx] for r in losses if len(r) > field_idx and r[field_idx] is not None]
            if not win_vals or not loss_vals:
                return default_weight
            avg_win_val  = sum(win_vals)  / len(win_vals)
            avg_loss_val = sum(loss_vals) / len(loss_vals)
            diff = avg_win_val - avg_loss_val
            boost = min(boost_max, max(-3, round(diff * 2)))
            return max(2, default_weight + boost)

        new_weights = {
            'w_structure': min(28, component_boost(0, 20)),
            'w_liquidity': min(20, component_boost(0, 15, boost_max=4)),
            'w_choch':     min(20, component_boost(0, 15, boost_max=4)),
            'w_ob':        min(15, component_boost(0, 10, boost_max=4)),
            'w_fvg':       min(15, component_boost(0, 10, boost_max=4)),
            'w_sd':        min(15, component_boost(0, 10, boost_max=3)),
            'w_pd':        min(15, component_boost(0, 10, boost_max=3)),
            'w_pa':        5,
            'w_session':   session_weight,
        }`;

const newWeights = `# Structure boost: aligned-trend trades win more than misaligned
        aligned_trades   = [r for r in rows if len(r) > 5 and r[4] == r[5] and r[4] not in ('NEUTRAL', None)]
        unaligned_trades = [r for r in rows if len(r) > 5 and r[4] != r[5]]
        aligned_wr   = len([r for r in aligned_trades   if r[1]=='WIN']) / len(aligned_trades)   if aligned_trades   else 0.5
        unaligned_wr = len([r for r in unaligned_trades if r[1]=='WIN']) / len(unaligned_trades) if unaligned_trades else 0.5
        structure_boost = min(6, max(0, round((aligned_wr - unaligned_wr) * 20)))

        # Confidence-sensitive boost: does higher score actually predict wins?
        win_scores  = [r[0] for r in wins   if r[0] is not None]
        loss_scores = [r[0] for r in losses if r[0] is not None]
        score_diff  = (sum(win_scores)/len(win_scores) - sum(loss_scores)/len(loss_scores)) if win_scores and loss_scores else 0
        conf_boost  = min(4, max(-2, round(score_diff / 5)))

        # Session weight: reward sessions with higher win rates
        session_weight_final = 8 if best_session_wr > 0.65 else 3 if best_session_wr < 0.45 else 5

        new_weights = {
            'w_structure': min(28, 20 + structure_boost),
            'w_liquidity': min(20, 15 + conf_boost),
            'w_choch':     min(20, 15 + conf_boost),
            'w_ob':        min(15, 10 + max(0, conf_boost)),
            'w_fvg':       min(15, 10 + max(0, conf_boost)),
            'w_sd':        min(14, 10),
            'w_pd':        min(14, 10),
            'w_pa':        5,
            'w_session':   session_weight_final,
        }

        # Normalise weights to sum to 100
        total_w = sum(new_weights.values())
        if total_w > 0 and abs(total_w - 100) > 3:
            scale       = 100.0 / total_w
            new_weights = {k: round(v * scale, 1) for k, v in new_weights.items()}`;
            
engine = engine.replace(oldWeights, newWeights);

// Fix #10
const oldMacro = `        dxy_data  = next((c for c in result['correlations'] if c['role'] == 'DXY'), None)
        risk_data = next((c for c in result['correlations'] if c['role'] == 'RISK'), None)

        dxy_bearish_gold  = dxy_data  and dxy_data['direction']  == 'UP'
        risk_off_gold_bid = risk_data and risk_data['direction'] == 'DOWN'`;

const newMacro = `        dxy_signals  = [c for c in result['correlations'] if c['role'].startswith('DXY') and c.get('direction') not in ('UNAVAILABLE', None)]
        risk_data    = next((c for c in result['correlations'] if c['role'] == 'RISK'), None)

        usd_up_count   = sum(1 for c in dxy_signals if c['direction'] == 'UP')
        usd_down_count = sum(1 for c in dxy_signals if c['direction'] == 'DOWN')
        usd_direction  = 'UP' if usd_up_count > usd_down_count else 'DOWN' if usd_down_count > usd_up_count else 'FLAT'
        usd_confidence = 'HIGH' if len(dxy_signals) >= 2 and (usd_up_count == len(dxy_signals) or usd_down_count == len(dxy_signals)) else 'LOW'
        usd_conflicting = len(dxy_signals) >= 2 and usd_up_count > 0 and usd_down_count > 0

        dxy_bearish_gold  = usd_direction == 'UP'
        risk_off_gold_bid = risk_data and risk_data.get('direction') == 'DOWN'

        result['usd_signal'] = {
            'direction':   usd_direction,
            'confidence':  usd_confidence,
            'conflicting': usd_conflicting,
            'note': ('CONFLICTING USD SIGNALS — likely JPY-specific move (BoJ), not pure DXY' if usd_conflicting
                     else f'USD {usd_direction} ({usd_confidence} confidence)'),
        }`;
        
engine = engine.replace(oldMacro, newMacro);

fs.writeFileSync('engine.py', engine);


// --- PATCH SERVER.TS ---
let server = fs.readFileSync('server.ts', 'utf8');

// Fix #11
const oldParallel = `      const [engineResult, newsResult, reasoningResult] = await Promise.allSettled([
        runPythonEngine(candlesByTF, asset, userAccountSize, userRiskPct),
        fetchRSSNews(asset),
        fetchOpenRouterReasoning(asset, earlyContext, etfCandles, ''),
      ]);

      const engineData = engineResult.status === 'fulfilled' ? engineResult.value : {error:'Engine failed'};
      const newsData   = newsResult.status  === 'fulfilled' ? newsResult.value  : {items:[], hasHighImpact:false, highImpactEvents:[], freshCount:0, staleCount:0};
      const openRouterReasoning = reasoningResult.status === 'fulfilled' ? reasoningResult.value : '';`;

const newParallel = `      // Engine and news run in parallel — independent of each other
      const [engineResult, newsResult] = await Promise.allSettled([
        runPythonEngine(candlesByTF, asset, userAccountSize, userRiskPct),
        fetchRSSNews(asset),
      ]);
      const engineData = engineResult.status === 'fulfilled' ? engineResult.value : {error:'Engine failed'};
      const newsData   = newsResult.status  === 'fulfilled' ? newsResult.value  : {items:[], hasHighImpact:false, highImpactEvents:[], freshCount:0, staleCount:0};

      // OpenRouter runs AFTER engine — gets full calculated context for better reasoning
      const engineBlock          = formatEngineResults(engineData);
      const newsBlock            = formatNewsBlock(newsData as any, asset);
      const openRouterReasoning  = await fetchOpenRouterReasoning(asset, engineData, etfCandles, newsBlock);`;
      
server = server.replace(oldParallel, newParallel);

const oldFormatBlocks = `
      const engineBlock    = formatEngineResults(engineData);
      const newsBlock      = formatNewsBlock(newsData as any, asset);`;

server = server.replace(oldFormatBlocks, "");


// Fix #12
const cacheCode = `// In-memory candle cache — prevents re-fetching same candles within 2 minutes
const candleCache = new Map<string, { candles: Candle[], timestamp: number }>();
const CACHE_TTL_MS = 120_000;

async function fetchCachedCandles(symbol: string, granularity: number, count: number): Promise<Candle[]> {
  const key    = \`\${symbol}_\${granularity}\`;
  const cached = candleCache.get(key);
  if(cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log(\`Cache hit: \${key}\`);
    return cached.candles;
  }
  const candles = await fetchDerivCandles(symbol, granularity, count);
  if(candles.length > 0) candleCache.set(key, { candles, timestamp: Date.now() });
  return candles;
}

const SYNTHETICS`;

server = server.replace('const SYNTHETICS', cacheCode);

server = server.replace(/timeframes\.map\(tf=>fetchDerivCandles\(derivSymbol,tf\.granularity,500\)\)/g, `timeframes.map(tf=>fetchCachedCandles(derivSymbol,tf.granularity,500))`);

// Fix #13
const oldSignalJSON = `SIGNAL_JSON_START
{"direction":"Bearish","entry_low":0,"entry_high":0,"sl":0,"tp1":0,"tp2":0,"tp3":0,"score":0,"win_probability":0,"expected_value":0}
SIGNAL_JSON_END`;

const newSignalJSON = `SIGNAL_JSON_START
{"direction":"DIRECTION_HERE","entry_low":ENTRY_LOW_HERE,"entry_high":ENTRY_HIGH_HERE,"sl":SL_HERE,"tp1":TP1_HERE,"tp2":TP2_HERE,"tp3":TP3_HERE,"score":SCORE_HERE,"win_probability":WIN_PCT_HERE,"expected_value":EV_HERE}
SIGNAL_JSON_END

Replace all placeholder words with actual numbers from your analysis.
For AVOID with no setup: set entry/sl/tp fields to null (not 0).

Example for a real bearish trade:
SIGNAL_JSON_START
{"direction":"Bearish","entry_low":4228.22,"entry_high":4232.57,"sl":4237.12,"tp1":4205.58,"tp2":4177.61,"tp3":4170.41,"score":82,"win_probability":61.4,"expected_value":1.16}
SIGNAL_JSON_END

Example for AVOID:
SIGNAL_JSON_START
{"direction":"NEUTRAL","entry_low":null,"entry_high":null,"sl":null,"tp1":null,"tp2":null,"tp3":null,"score":27,"win_probability":35.0,"expected_value":-0.51}
SIGNAL_JSON_END`;

server = server.replace(oldSignalJSON, newSignalJSON);

// Fix #18
server = server.replace(`  app.post('/api/analyze', async(req,res)=>{
    try {
      const {asset, mode, image, accountSize, riskPct} = req.body;`, `  let analysisInProgress = false;

  app.post('/api/analyze', async(req,res)=>{
    if(analysisInProgress) {
      return res.status(429).json({
        error: 'Analysis already in progress. Please wait for it to complete.',
        retry_after: 30,
      });
    }
    analysisInProgress = true;
    try {
      const {asset, mode, image, accountSize, riskPct} = req.body;`);

const oldCatchRoute = `    } catch(err:any){ console.error('Error:',err); res.status(500).json({error:err.message}); }`;
const newCatchRoute = `    } catch(err:any){
      console.error('Error:', err);
      res.status(500).json({error: err.message});
    } finally {
      analysisInProgress = false;
    }`;
server = server.replace(oldCatchRoute, newCatchRoute);

// Fix #23
const oldLogStartup = `    console.log(\`QUANT-X on http://localhost:\${PORT}\`);`;
const newLogStartup = `    console.log(\`QUANT-X on http://localhost:\${PORT}\`);
    console.log('');
    console.log('=== API KEY STATUS ===');
    console.log(\`Gemini:       \${process.env.GEMINI_API_KEY     ? '✅ configured' : '❌ MISSING'}\`);
    console.log(\`GPT-4o:       \${process.env.GITHUB_TOKEN       ? '✅ configured' : '⚠️  not set'}\`);
    console.log(\`GPT-4.1-mini: \${process.env.GITHUB_TOKEN2      ? '✅ configured' : '⚠️  not set'}\`);
    console.log(\`OpenRouter:   \${process.env.OPENROUTER_API_KEY ? '✅ configured' : '⚠️  not set — reasoning disabled'}\`);
    console.log('======================');
    console.log('');`;
server = server.replace(oldLogStartup, newLogStartup);

// Fix #27
const oldImage = `      if(image){
        promptParts.push({inlineData:{data:image.split(',')[1]||image.replace(/^data:image\\/\\w+;base64,/,''),mimeType:'image/jpeg'}});`;
const newImage = `      if(image){
        const mimeMatch  = image.match(/^data:(image\\/[a-z]+);base64,/);
        const mimeType   = (mimeMatch?.[1] || 'image/jpeg') as 'image/jpeg'|'image/png'|'image/gif'|'image/webp';
        const base64Data = image.replace(/^data:image\\/[a-z]+;base64,/, '');
        promptParts.push({inlineData:{data:base64Data, mimeType}});`;
server = server.replace(oldImage, newImage);

// Fix #30
const oldLogAI = "      console.log(`Done. AI:${aiUsed}";
const newLogAI = `      const aiFooter = [
        \`Analysis: \${aiUsed}\`,
        openRouterReasoning ? \`Reasoning: Qwen-2.5\` : \`Reasoning: SKIPPED\`,
        \`News: \${(newsData as any).freshCount || 0} fresh / \${(newsData as any).staleCount || 0} older\`,
      ].join(' │ ');
      responseText += \`\\n\\n---\\n*\${aiFooter}*\`;

      console.log(\`Done. AI:\${aiUsed}`;
server = server.replace(oldLogAI, newLogAI);

fs.writeFileSync('server.ts', server);
console.log('Patch 2 applied successfully');
