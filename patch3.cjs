const fs = require('fs');

let engine = fs.readFileSync('engine.py', 'utf8');

// FIX #17 - Elliott Wave detection + #20 - Fibonacci detection
const elliottCode = `
# ═══════════════════════════════════════════════════════════════════════════════
# FIBONACCI ENGINE
# Calculates retracement and extension levels from swing points
# ═══════════════════════════════════════════════════════════════════════════════

def calc_fibonacci_levels(swing_high: float, swing_low: float, direction: str = 'BEARISH') -> dict:
    """
    Calculate Fibonacci retracement and extension levels.

    Retracements: 0.236, 0.382, 0.5, 0.618, 0.786 (golden pocket = 0.618-0.65)
    Extensions:   1.0, 1.272, 1.414, 1.618, 2.0, 2.618

    For BEARISH moves: measure from swing high down to swing low
    For BULLISH moves: measure from swing low up to swing high
    """
    if swing_high <= swing_low:
        return {'error': 'Invalid swing — high must be above low'}

    rng = swing_high - swing_low

    if direction == 'BEARISH':
        # Retracements from high (potential short entry zones)
        retracements = {
            '0.236': round(swing_high - rng * 0.236, 6),
            '0.382': round(swing_high - rng * 0.382, 6),
            '0.500': round(swing_high - rng * 0.500, 6),
            '0.618': round(swing_high - rng * 0.618, 6),
            '0.650': round(swing_high - rng * 0.650, 6),
            '0.786': round(swing_high - rng * 0.786, 6),
        }
        # Extensions below swing low (downside targets)
        extensions = {
            '1.000': round(swing_low - rng * 0.000, 6),
            '1.272': round(swing_low - rng * 0.272, 6),
            '1.414': round(swing_low - rng * 0.414, 6),
            '1.618': round(swing_low - rng * 0.618, 6),
            '2.000': round(swing_low - rng * 1.000, 6),
            '2.618': round(swing_low - rng * 1.618, 6),
        }
        golden_pocket = (retracements['0.618'], retracements['0.650'])
    else:
        # BULLISH — retracements from low (potential long entry zones)
        retracements = {
            '0.236': round(swing_low + rng * 0.236, 6),
            '0.382': round(swing_low + rng * 0.382, 6),
            '0.500': round(swing_low + rng * 0.500, 6),
            '0.618': round(swing_low + rng * 0.618, 6),
            '0.650': round(swing_low + rng * 0.650, 6),
            '0.786': round(swing_low + rng * 0.786, 6),
        }
        extensions = {
            '1.000': round(swing_high + rng * 0.000, 6),
            '1.272': round(swing_high + rng * 0.272, 6),
            '1.414': round(swing_high + rng * 0.414, 6),
            '1.618': round(swing_high + rng * 0.618, 6),
            '2.000': round(swing_high + rng * 1.000, 6),
            '2.618': round(swing_high + rng * 1.618, 6),
        }
        golden_pocket = (retracements['0.618'], retracements['0.650'])

    return {
        'direction':     direction,
        'swing_high':    round(swing_high, 6),
        'swing_low':     round(swing_low, 6),
        'range':         round(rng, 6),
        'retracements':  retracements,
        'extensions':    extensions,
        'golden_pocket': golden_pocket,
        'note':          'Golden pocket (0.618-0.65) is highest probability retracement entry zone.',
    }

# ═══════════════════════════════════════════════════════════════════════════════
# ELLIOTT WAVE ENGINE (simplified — impulse/corrective structure detection)
# Does NOT attempt full wave counts — that is subjective and unreliable
# Instead detects: impulse structure, corrective structure, wave extension
# ═══════════════════════════════════════════════════════════════════════════════

def detect_elliott_structure(candles, swing_highs, swing_lows, atr):
    """
    Simplified Elliott Wave structure detection.
    Identifies whether price is in an IMPULSE or CORRECTIVE phase.

    Rules (simplified):
    IMPULSE (trending): 3 clear swing highs making HH or 3 swing lows making LL
    CORRECTIVE (ABC): alternating swings, no new extremes
    EXTENSION: impulse wave that is >1.618x the average of other waves

    Returns structured evidence for AI interpretation.
    Python detects structure — AI interprets wave context.
    """
    if len(swing_highs) < 3 or len(swing_lows) < 3:
        return {'status': 'INSUFFICIENT_DATA', 'structure': 'UNKNOWN'}

    recent_sh = sorted(swing_highs[-5:], key=lambda x: x['index'])
    recent_sl = sorted(swing_lows[-5:],  key=lambda x: x['index'])

    # Check for Higher Highs (bullish impulse)
    hh_count = sum(1 for i in range(1, len(recent_sh))
                   if recent_sh[i]['price'] > recent_sh[i-1]['price'])
    ll_count = sum(1 for i in range(1, len(recent_sl))
                   if recent_sl[i]['price'] < recent_sl[i-1]['price'])

    # Check for Lower Highs (bearish impulse)
    lh_count = sum(1 for i in range(1, len(recent_sh))
                   if recent_sh[i]['price'] < recent_sh[i-1]['price'])
    hl_count = sum(1 for i in range(1, len(recent_sl))
                   if recent_sl[i]['price'] > recent_sl[i-1]['price'])

    # Measure wave sizes
    wave_sizes = []
    all_swings = sorted(
        [(s['price'], s['index'], 'H') for s in recent_sh] +
        [(s['price'], s['index'], 'L') for s in recent_sl],
        key=lambda x: x[1]
    )
    for i in range(1, len(all_swings)):
        wave_sizes.append(abs(all_swings[i][0] - all_swings[i-1][0]))

    avg_wave  = sum(wave_sizes) / len(wave_sizes) if wave_sizes else 0
    max_wave  = max(wave_sizes) if wave_sizes else 0
    extension = max_wave > avg_wave * 1.618 if avg_wave > 0 else False

    # Classify structure
    if hh_count >= 2 and hl_count >= 2:
        structure   = 'BULLISH_IMPULSE'
        description = f'Price making Higher Highs ({hh_count}) and Higher Lows ({hl_count}) — bullish impulse wave in progress.'
        bias        = 'BULLISH'
    elif lh_count >= 2 and ll_count >= 2:
        structure   = 'BEARISH_IMPULSE'
        description = f'Price making Lower Highs ({lh_count}) and Lower Lows ({ll_count}) — bearish impulse wave in progress.'
        bias        = 'BEARISH'
    elif hh_count >= 1 and lh_count >= 1:
        structure   = 'CORRECTIVE_RANGE'
        description = 'Mixed swing structure — price in corrective ABC or ranging phase. No clear impulse direction.'
        bias        = 'NEUTRAL'
    else:
        structure   = 'TRANSITIONAL'
        description = 'Insufficient swing data for Elliott classification. Market may be transitioning.'
        bias        = 'NEUTRAL'

    # Fibonacci extension targets
    fib_targets = {}
    if wave_sizes and len(wave_sizes) >= 2:
        first_wave  = wave_sizes[0]
        last_price  = candles[-1]['close']
        fib_targets = {
            '1.0':   round(last_price + first_wave * 1.0,   6),
            '1.272': round(last_price + first_wave * 1.272, 6),
            '1.618': round(last_price + first_wave * 1.618, 6),
            '2.0':   round(last_price + first_wave * 2.0,   6),
        }

    return {
        'status':          'OK',
        'structure':       structure,
        'bias':            bias,
        'description':     description,
        'hh_count':        hh_count,
        'hl_count':        hl_count,
        'lh_count':        lh_count,
        'll_count':        ll_count,
        'wave_extension':  extension,
        'avg_wave_size':   round(avg_wave, 6),
        'max_wave_size':   round(max_wave, 6),
        'fib_targets':     fib_targets,
        'note':            'Simplified Elliott structure only. AI must apply full wave context and validation.',
    }

# ═══════════════════════════════════════════════════════════════════════════════
# WYCKOFF ENGINE`;

engine = engine.replace('# ═══════════════════════════════════════════════════════════════════════════════\n# WYCKOFF ENGINE', elliottCode);

const runEngineWyckoff = `        wyckoff = None
        WYCKOFF_TFS = {'W1', 'D1', '4H', '1H'}
        if tf in WYCKOFF_TFS:
            wyckoff = detect_wyckoff_phase(candles, sh, sl, atr, vol_profile)`;

const runEngineWyckoffWithElliott = `        wyckoff = None
        WYCKOFF_TFS = {'W1', 'D1', '4H', '1H'}
        if tf in WYCKOFF_TFS:
            wyckoff = detect_wyckoff_phase(candles, sh, sl, atr, vol_profile)

        # Elliott Wave structure (only on HTF — 4H and above)
        elliott = None
        ELLIOTT_TFS = {'W1', 'D1', '4H'}
        if tf in ELLIOTT_TFS:
            elliott = detect_elliott_structure(candles, sh, sl, atr)`;

engine = engine.replace(runEngineWyckoff, runEngineWyckoffWithElliott);

const resultTfWyckoff = `            'wyckoff':wyckoff,`;
const resultTfWyckoffWithExtra = `            'wyckoff':wyckoff,
            'elliott':elliott,
            'fibonacci': calc_fibonacci_levels(
                swing_high = max((s['price'] for s in sh[-3:]), default=0) if sh else 0,
                swing_low  = min((s['price'] for s in sl[-3:]), default=0) if sl else 0,
                direction  = 'BEARISH' if trend == 'BEARISH' else 'BULLISH',
            ) if sh and sl else None,`;

engine = engine.replace(resultTfWyckoff, resultTfWyckoffWithExtra);


// FIX #33 - Daily performance tracking
const checkUpdateOutcomesOld = `        for retrain_asset in assets_to_retrain:
            update_adaptive_weights(retrain_asset)`;
const checkUpdateOutcomesNew = `        for retrain_asset in assets_to_retrain:
            update_adaptive_weights(retrain_asset)

        # Update daily performance table
        if assets_to_retrain:
            try:
                today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
                conn_dp = sqlite3.connect(DB_PATH)
                c_dp    = conn_dp.cursor()
                for dp_asset in assets_to_retrain:
                    c_dp.execute('''SELECT COUNT(*), SUM(CASE WHEN outcome="WIN" THEN 1 ELSE 0 END),
                                    SUM(CASE WHEN outcome="LOSS" THEN 1 ELSE 0 END), SUM(pnl_atr)
                                    FROM signals WHERE asset=? AND date(outcome_checked_at)=?''',
                                 (dp_asset, today))
                    row = c_dp.fetchone()
                    if row and row[0] > 0:
                        total, wins, losses, pnl = row
                        wr = round(wins/total*100, 1) if total else None
                        c_dp.execute('''INSERT INTO daily_performance
                            (date, asset, trades, wins, losses, pnl_atr, win_rate)
                            VALUES (?,?,?,?,?,?,?)
                            ON CONFLICT DO NOTHING''',
                            (today, dp_asset, total, wins or 0, losses or 0, pnl or 0, wr))
                conn_dp.commit()
                conn_dp.close()
            except Exception:
                pass`;

engine = engine.replace(checkUpdateOutcomesOld, checkUpdateOutcomesNew);


// FIX #34
const dashboardReturnOld = `        return {
            'signals':      signals,
            'total_closed': total_closed,
            'total_wins':   total_wins,
            'total_losses': total_losses,
            'win_rate_pct': win_rate,
            'avg_pnl_atr':  avg_pnl,
            'total_pnl_atr': total_pnl,
            'pending_count': sum(1 for s in signals if s['outcome'] == 'OPEN'),
        }`;

const dashboardReturnNew = `        # Fetch daily performance
        try:
            conn_dp = sqlite3.connect(DB_PATH)
            c_dp    = conn_dp.cursor()
            if asset:
                c_dp.execute('''SELECT date, trades, wins, losses, pnl_atr, win_rate
                                FROM daily_performance WHERE asset=?
                                ORDER BY date DESC LIMIT 30''', (asset,))
            else:
                c_dp.execute('''SELECT date, SUM(trades), SUM(wins), SUM(losses), SUM(pnl_atr), NULL
                                FROM daily_performance GROUP BY date ORDER BY date DESC LIMIT 30''')
            daily_rows = c_dp.fetchall()
            conn_dp.close()
            daily_perf = [{'date':r[0],'trades':r[1],'wins':r[2],'losses':r[3],'pnl_atr':r[4],'win_rate':r[5]} for r in daily_rows]
        except Exception:
            daily_perf = []

        # Streak calculation
        streak       = 0
        streak_type  = 'NONE'
        for sig in signals:
            if sig['outcome'] == 'WIN':
                if streak_type == 'WIN': streak += 1
                else: streak = 1; streak_type = 'WIN'
                break
            elif sig['outcome'] == 'LOSS':
                if streak_type == 'LOSS': streak += 1
                else: streak = 1; streak_type = 'LOSS'
                break

        return {
            'signals':       signals,
            'total_closed':  total_closed,
            'total_wins':    total_wins,
            'total_losses':  total_losses,
            'win_rate_pct':  win_rate,
            'avg_pnl_atr':   avg_pnl,
            'total_pnl_atr': total_pnl,
            'pending_count': sum(1 for s in signals if s['outcome'] == 'OPEN'),
            'current_streak':streak,
            'streak_type':   streak_type,
            'daily_performance': daily_perf,
        }`;
engine = engine.replace(dashboardReturnOld, dashboardReturnNew);

// FIX #36
const tfSummaryOld = `            'wyckoff_phase':   wyc.get('phase') if wyc else None,
            'wyckoff_bias':    wyc.get('trade_bias') if wyc else None,
            'wyckoff_conf':    wyc.get('confidence') if wyc else None,
        }`;
const tfSummaryNew = `            'wyckoff_phase':   wyc.get('phase')       if wyc else None,
            'wyckoff_bias':    wyc.get('trade_bias')  if wyc else None,
            'wyckoff_conf':    wyc.get('confidence')  if wyc else None,
            'elliott_structure': data.get('elliott', {}).get('structure')  if data.get('elliott') else None,
            'elliott_bias':      data.get('elliott', {}).get('bias')       if data.get('elliott') else None,
            'fib_golden_pocket': data.get('fibonacci', {}).get('golden_pocket') if data.get('fibonacci') else None,
        }`;

engine = engine.replace(tfSummaryOld, tfSummaryNew);

fs.writeFileSync('engine.py', engine);


// --- PATCH SERVER.TS ---
let server = fs.readFileSync('server.ts', 'utf8');

// FIX #24
const formatWyckoffOld = `    if(d.wyckoff && d.wyckoff.phase !== 'INSUFFICIENT DATA'){
      const w=d.wyckoff;
      block+=\`WYCKOFF: \${w.phase} | Bias:\${w.trade_bias} | Confidence:\${w.confidence}% | Range:\${w.range_low}-\${w.range_high}\\n\`;
      block+=\`  \${w.phase_detail}\\n\`;
      block+=\`  Next: \${w.next_move}\\n\`;
      if(w.events?.length) w.events.forEach((e:any)=>block+=\`  \${e.type}@\${e.price} \${e.date} — \${e.note||''}\\n\`);
    }
    block+='\\n';`;

const formatWyckoffNew = `    if(d.wyckoff && d.wyckoff.phase !== 'INSUFFICIENT DATA'){
      const w=d.wyckoff;
      block+=\`WYCKOFF: \${w.phase} | Bias:\${w.trade_bias} | Confidence:\${w.confidence}% | Range:\${w.range_low}-\${w.range_high}\\n\`;
      if(w.phase_detail) block+=\`  \${w.phase_detail}\\n\`;
      if(w.next_move)    block+=\`  Next: \${w.next_move}\\n\`;
      if(w.events?.length) w.events.forEach((e:any)=>block+=\`  \${e.type}@\${e.price} \${e.date} — \${e.note||''}\\n\`);
    }
    if(d.elliott && d.elliott.status === 'OK'){
      const e=d.elliott;
      block+=\`ELLIOTT: \${e.structure} | Bias:\${e.bias} | Extension:\${e.wave_extension?'YES':'NO'}\\n\`;
      block+=\`  \${e.description}\\n\`;
      if(e.wave_extension && e.fib_targets) {
        block+=\`  Fib Targets: 1.618=\${e.fib_targets['1.618']} 2.0=\${e.fib_targets['2.0']}\\n\`;
      }
    }
    if(d.fibonacci && !d.fibonacci.error){
      const f=d.fibonacci;
      block+=\`FIBONACCI (\${f.direction}): Swing \${f.swing_low}-\${f.swing_high} Range:\${f.range}\\n\`;
      block+=\`  Retracements: 0.382=\${f.retracements['0.382']} 0.5=\${f.retracements['0.500']} GP=\${f.golden_pocket[0]}-\${f.golden_pocket[1]}\\n\`;
      block+=\`  Extensions: 1.272=\${f.extensions['1.272']} 1.618=\${f.extensions['1.618']} 2.618=\${f.extensions['2.618']}\\n\`;
    }
    block+='\\n';`;

server = server.replace(formatWyckoffOld, formatWyckoffNew);

// FIX #28
const systemPromptVolProfOld = `VOLUME PROFILE: POC=magnet. VAH/VAL=value area boundaries. LVN=price moves fast (target). HVN=consolidation (S/R).`;
const systemPromptVolProfNew = `VOLUME PROFILE: POC=magnet. VAH/VAL=value area boundaries. LVN=price moves fast (target). HVN=consolidation (S/R).

FIBONACCI LEVELS:
The engine calculates Fibonacci retracements and extensions from recent swing points.
- Golden Pocket (0.618-0.65 retracement) = highest probability pullback entry zone
- 0.382 = shallow retracement (strong trend)
- 0.5 = equilibrium retracement
- 0.786 = deep retracement (weak trend or potential reversal)
- Extensions 1.272/1.414/1.618 = typical wave targets
- Extensions 2.0/2.618 = extreme targets in strong trends
Use Fibonacci levels to validate entry zones: OB/FVG overlapping with Golden Pocket = strongest entry.
Always mention if a key SMC level (OB, FVG, liquidity) coincides with a Fibonacci level.

ELLIOTT WAVE STRUCTURE:
The engine detects simplified Elliott structure (not full wave counts).
- BULLISH_IMPULSE: HH+HL pattern confirmed — favor longs on pullbacks
- BEARISH_IMPULSE: LH+LL pattern confirmed — favor shorts on bounces
- CORRECTIVE_RANGE: ABC correction — mean reversion entries, tight targets
- Wave Extension: when max wave > 1.618x average — trend is extended, caution on entries
Note: Python detects structure. You interpret which wave number price is likely in and what comes next.`;

server = server.replace(systemPromptVolProfOld, systemPromptVolProfNew);

// FIX #29
const systemPromptRevOld = `- Are multiple timeframes confirming or conflicting?`;
const systemPromptRevNew = `- Are multiple timeframes confirming or conflicting?
- Do Fibonacci retracement levels (especially golden pocket 0.618-0.65) align with OB/FVG entry zones?
- Does the Elliott wave structure confirm the entry type? (Impulse → trend entries. Corrective → fade extremes.)
- Is there a wave extension? If yes, the trend is stretched and entries carry higher reversal risk.`;
server = server.replace(systemPromptRevOld, systemPromptRevNew);

// FIX #31
const checkOutcomesRouteOld = `  app.post('/api/check-outcomes', async(req,res)=>{`;
const checkOutcomesRouteNew = `  // Health check endpoint
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

  app.post('/api/check-outcomes', async(req,res)=>{`;
server = server.replace(checkOutcomesRouteOld, checkOutcomesRouteNew);

// FIX #32
const startupCheckOld = `    const runOutcomeCheck = async() => {`;
const startupCheckNew = `    // Run outcome check immediately on startup to catch any overnight results
    console.log('Running startup outcome check...');
    runPythonOperation({operation:'check_outcomes', asset:null})
      .then(r => {
        if(r?.updated > 0) console.log(\`Startup outcome check: \${r.updated} signals updated.\`);
        else console.log('Startup outcome check: no pending signals to resolve.');
      })
      .catch(() => {});

    const runOutcomeCheck = async() => {`;
server = server.replace(startupCheckOld, startupCheckNew);


// FIX #35 (HTF formatting change)

const oldHtfFormat = `      if(te.htf_summary){
        const h = te.htf_summary;
        block += \`  HTF(\${h.timeframe}): Trend=\${h.trend} EMA=\${h.ema_trend} RSI=\${h.rsi}[\${h.rsi_zone}] Regime=\${h.regime} OBs=\${h.fresh_obs} FVGs=\${h.fresh_fvgs} P/D=\${h.pd_status}@\${h.pd_pct}%\\n\`;
        if(h.wyckoff_phase) block += \`  HTF Wyckoff: \${h.wyckoff_phase} (\${h.wyckoff_bias}, \${h.wyckoff_conf}% conf)\\n\`;
      }`;
const newHtfFormat = `      if(te.htf_summary){
        const h = te.htf_summary;
        block += \`  HTF(\${h.timeframe}): Trend=\${h.trend} EMA=\${h.ema_trend} RSI=\${h.rsi}[\${h.rsi_zone}] Regime=\${h.regime} OBs=\${h.fresh_obs} FVGs=\${h.fresh_fvgs} P/D=\${h.pd_status}@\${h.pd_pct}%\\n\`;
        if(h.wyckoff_phase)  block += \`  HTF Wyckoff: \${h.wyckoff_phase} (\${h.wyckoff_bias}, \${h.wyckoff_conf}% conf)\\n\`;
      }`;
server = server.replace(oldHtfFormat, newHtfFormat);

fs.writeFileSync('server.ts', server);
console.log('Applied Week 3 patches successfully.');
