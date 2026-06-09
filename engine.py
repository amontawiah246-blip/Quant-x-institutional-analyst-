#!/usr/bin/env python3
"""
QUANT-X Engine — Deterministic SMC/ICT calculation engine.
Called by server.ts as a child process.
Reads JSON from stdin, writes JSON to stdout.
No Flask. No server. Just pure calculation.
"""

import sys
import json
import math

def calc_atr(candles, period=14):
    """Wilder's ATR — correct implementation."""
    if len(candles) < period + 1:
        return 0.0
    
    # Use last 3x period candles for accuracy
    slice_candles = candles[-(period * 3):]
    
    # Calculate all True Ranges
    trs = []
    for i in range(1, len(slice_candles)):
        curr = slice_candles[i]
        prev = slice_candles[i - 1]
        tr = max(
            curr['high'] - curr['low'],
            abs(curr['high'] - prev['close']),
            abs(curr['low']  - prev['close'])
        )
        trs.append(tr)
    
    if len(trs) < period:
        return sum(trs) / len(trs) if trs else 0.0
    
    # Seed with simple average of first period TRs
    atr = sum(trs[:period]) / period
    
    # Wilder smoothing
    for i in range(period, len(trs)):
        atr = (atr * (period - 1) + trs[i]) / period
    
    return round(atr, 6)


def detect_swings(candles, left=5, right=5):
    """
    Detect swing highs and lows.
    Swing High: candle[i].high is highest among left and right neighbours.
    Swing Low:  candle[i].low  is lowest  among left and right neighbours.
    """
    swing_highs = []
    swing_lows  = []
    
    for i in range(left, len(candles) - right):
        window_highs = [candles[j]['high'] for j in range(i - left, i + right + 1)]
        window_lows  = [candles[j]['low']  for j in range(i - left, i + right + 1)]
        
        if candles[i]['high'] == max(window_highs):
            swing_highs.append({
                'index': i,
                'price': candles[i]['high'],
                'epoch': candles[i]['epoch'],
                'date':  candles[i].get('date', str(candles[i]['epoch']))
            })
        
        if candles[i]['low'] == min(window_lows):
            swing_lows.append({
                'index': i,
                'price': candles[i]['low'],
                'epoch': candles[i]['epoch'],
                'date':  candles[i].get('date', str(candles[i]['epoch']))
            })
    
    return swing_highs, swing_lows


def detect_bos_choch(candles, swing_highs, swing_lows):
    """
    Detect BOS and CHoCH events.
    BOS Bull  = close breaks above most recent swing high
    BOS Bear  = close breaks below most recent swing low
    CHoCH Bull = in bearish trend, close breaks above most recent LH
    CHoCH Bear = in bullish trend, close breaks below most recent HL
    """
    events = []
    
    # Track trend state
    trend = 'NEUTRAL'  # BULLISH, BEARISH, NEUTRAL
    last_sh_index = -1
    last_sl_index = -1
    
    sh_map = {sh['index']: sh for sh in swing_highs}
    sl_map = {sl['index']: sl for sl in swing_lows}
    
    # Build ordered list of swing events
    all_swings = []
    for sh in swing_highs:
        all_swings.append(('SH', sh))
    for sl in swing_lows:
        all_swings.append(('SL', sl))
    all_swings.sort(key=lambda x: x[1]['index'])
    
    confirmed_sh = []  # confirmed swing highs not yet broken
    confirmed_sl = []  # confirmed swing lows not yet broken
    
    for i in range(len(candles)):
        c = candles[i]
        
        # Add any swings that were confirmed at this candle
        for stype, swing in all_swings:
            if swing['index'] == i:
                if stype == 'SH':
                    confirmed_sh.append(swing)
                else:
                    confirmed_sl.append(swing)
        
        # Check BOS Bull — close breaks above most recent confirmed swing high
        if confirmed_sh:
            latest_sh = confirmed_sh[-1]
            if c['close'] > latest_sh['price'] and latest_sh['index'] < i:
                event_type = 'CHoCH' if trend == 'BEARISH' else 'BOS'
                direction  = 'BULL'
                events.append({
                    'type':      f'{event_type} {direction}',
                    'price':     latest_sh['price'],
                    'candle_price': c['close'],
                    'epoch':     c['epoch'],
                    'date':      c.get('date', str(c['epoch'])),
                    'index':     i
                })
                trend = 'BULLISH'
                confirmed_sh = []  # reset after break
        
        # Check BOS Bear — close breaks below most recent confirmed swing low
        if confirmed_sl:
            latest_sl = confirmed_sl[-1]
            if c['close'] < latest_sl['price'] and latest_sl['index'] < i:
                event_type = 'CHoCH' if trend == 'BULLISH' else 'BOS'
                direction  = 'BEAR'
                events.append({
                    'type':      f'{event_type} {direction}',
                    'price':     latest_sl['price'],
                    'candle_price': c['close'],
                    'epoch':     c['epoch'],
                    'date':      c.get('date', str(c['epoch'])),
                    'index':     i
                })
                trend = 'BEARISH'
                confirmed_sl = []  # reset after break
    
    return events, trend


def detect_fvg(candles, atr):
    """
    Detect Fair Value Gaps.
    Bullish FVG: candle[i-1].high < candle[i+1].low
    Bearish FVG: candle[i-1].low  > candle[i+1].high
    Minimum size: gap > ATR * 0.15
    """
    fvgs = []
    min_size = atr * 0.15 if atr > 0 else 0
    
    for i in range(1, len(candles) - 1):
        prev = candles[i - 1]
        curr = candles[i]
        nxt  = candles[i + 1]
        
        # Bullish FVG
        if prev['high'] < nxt['low']:
            gap_size = nxt['low'] - prev['high']
            if gap_size >= min_size:
                # Check mitigation in subsequent candles
                mitigated = False
                for j in range(i + 2, len(candles)):
                    if candles[j]['close'] <= nxt['low'] and candles[j]['close'] >= prev['high']:
                        mitigated = True
                        break
                fvgs.append({
                    'direction': 'BULL',
                    'top':       round(nxt['low'], 6),
                    'bottom':    round(prev['high'], 6),
                    'size':      round(gap_size, 6),
                    'atr_ratio': round(gap_size / atr, 3) if atr > 0 else 0,
                    'epoch':     curr['epoch'],
                    'date':      curr.get('date', str(curr['epoch'])),
                    'status':    'MITIGATED' if mitigated else 'FRESH',
                    'index':     i
                })
        
        # Bearish FVG
        if prev['low'] > nxt['high']:
            gap_size = prev['low'] - nxt['high']
            if gap_size >= min_size:
                mitigated = False
                for j in range(i + 2, len(candles)):
                    if candles[j]['close'] >= nxt['high'] and candles[j]['close'] <= prev['low']:
                        mitigated = True
                        break
                fvgs.append({
                    'direction': 'BEAR',
                    'top':       round(prev['low'], 6),
                    'bottom':    round(nxt['high'], 6),
                    'size':      round(gap_size, 6),
                    'atr_ratio': round(gap_size / atr, 3) if atr > 0 else 0,
                    'epoch':     curr['epoch'],
                    'date':      curr.get('date', str(curr['epoch'])),
                    'status':    'MITIGATED' if mitigated else 'FRESH',
                    'index':     i
                })
    
    return fvgs


def detect_order_blocks(candles, bos_events, atr):
    """
    Detect Order Blocks.
    Bullish OB = last bearish candle BEFORE a bullish BOS impulse >= ATR * 1.5
    Bearish OB = last bullish candle BEFORE a bearish BOS impulse >= ATR * 1.5
    """
    obs = []
    min_impulse = atr * 1.5 if atr > 0 else 0
    
    for event in bos_events:
        if 'BOS' not in event['type']:
            continue
        
        bos_index = event['index']
        direction = 'BULL' if 'BULL' in event['type'] else 'BEAR'
        
        # Measure impulse size — candles from OB to BOS
        impulse_start = max(0, bos_index - 10)
        impulse_candles = candles[impulse_start:bos_index + 1]
        
        if not impulse_candles:
            continue
        
        impulse_high = max(c['high'] for c in impulse_candles)
        impulse_low  = min(c['low']  for c in impulse_candles)
        impulse_size = impulse_high - impulse_low
        
        if impulse_size < min_impulse:
            continue
        
        # Find the last opposite-direction candle before the BOS
        ob_candle = None
        ob_index  = -1
        
        for j in range(bos_index - 1, max(0, bos_index - 15), -1):
            c = candles[j]
            if direction == 'BULL' and c['close'] < c['open']:  # bearish candle
                ob_candle = c
                ob_index  = j
                break
            elif direction == 'BEAR' and c['close'] > c['open']:  # bullish candle
                ob_candle = c
                ob_index  = j
                break
        
        if ob_candle is None:
            continue
        
        # Check mitigation — has price returned to 50% of OB body?
        ob_body_mid = (ob_candle['open'] + ob_candle['close']) / 2
        mitigated   = False
        
        for j in range(bos_index + 1, len(candles)):
            if direction == 'BULL' and candles[j]['low'] <= ob_body_mid:
                mitigated = True
                break
            elif direction == 'BEAR' and candles[j]['high'] >= ob_body_mid:
                mitigated = True
                break
        
        obs.append({
            'direction':     direction,
            'high':          round(max(ob_candle['open'], ob_candle['close']), 6),
            'low':           round(min(ob_candle['open'], ob_candle['close']), 6),
            'full_high':     round(ob_candle['high'], 6),
            'full_low':      round(ob_candle['low'],  6),
            'impulse_size':  round(impulse_size, 6),
            'atr_ratio':     round(impulse_size / atr, 2) if atr > 0 else 0,
            'epoch':         ob_candle['epoch'],
            'date':          ob_candle.get('date', str(ob_candle['epoch'])),
            'status':        'MITIGATED' if mitigated else 'FRESH',
            'index':         ob_index
        })
    
    return obs


def detect_liquidity(candles, swing_highs, swing_lows, atr):
    """
    Detect liquidity levels.
    BSL = swing highs not yet swept
    SSL = swing lows not yet swept
    EQH = swing highs within ATR * 0.05 of each other
    EQL = swing lows  within ATR * 0.05 of each other
    Sweep = wick beyond level but close inside
    """
    tolerance = atr * 0.05 if atr > 0 else 0
    last_close = candles[-1]['close'] if candles else 0
    
    # Check each swing for sweep status
    bsl = []
    for sh in swing_highs:
        swept = False
        sweep_epoch = None
        for j in range(sh['index'] + 1, len(candles)):
            c = candles[j]
            if c['high'] > sh['price']:  # wick above
                if c['close'] < sh['price']:  # close below = sweep
                    swept = True
                    sweep_epoch = c['epoch']
                    break
                else:
                    swept = False  # full break, not a sweep
                    break
        bsl.append({
            'price':        sh['price'],
            'epoch':        sh['epoch'],
            'date':         sh.get('date', str(sh['epoch'])),
            'status':       'SWEPT' if swept else 'RESTING',
            'distance_pct': round(abs(sh['price'] - last_close) / last_close * 100, 3) if last_close else 0
        })
    
    ssl = []
    for sl in swing_lows:
        swept = False
        for j in range(sl['index'] + 1, len(candles)):
            c = candles[j]
            if c['low'] < sl['price']:
                if c['close'] > sl['price']:
                    swept = True
                    break
                else:
                    swept = False
                    break
        ssl.append({
            'price':        sl['price'],
            'epoch':        sl['epoch'],
            'date':         sl.get('date', str(sl['epoch'])),
            'status':       'SWEPT' if swept else 'RESTING',
            'distance_pct': round(abs(sl['price'] - last_close) / last_close * 100, 3) if last_close else 0
        })
    
    # Detect equal highs/lows
    eqh = []
    for i in range(len(swing_highs)):
        for j in range(i + 1, len(swing_highs)):
            if abs(swing_highs[i]['price'] - swing_highs[j]['price']) <= tolerance:
                eqh.append({
                    'price_1': swing_highs[i]['price'],
                    'price_2': swing_highs[j]['price'],
                    'avg':     round((swing_highs[i]['price'] + swing_highs[j]['price']) / 2, 6)
                })
    
    eql = []
    for i in range(len(swing_lows)):
        for j in range(i + 1, len(swing_lows)):
            if abs(swing_lows[i]['price'] - swing_lows[j]['price']) <= tolerance:
                eql.append({
                    'price_1': swing_lows[i]['price'],
                    'price_2': swing_lows[j]['price'],
                    'avg':     round((swing_lows[i]['price'] + swing_lows[j]['price']) / 2, 6)
                })
    
    # Return top 5 resting BSL and SSL sorted by distance from price
    resting_bsl = sorted([x for x in bsl if x['status'] == 'RESTING'], key=lambda x: x['distance_pct'])[:5]
    resting_ssl = sorted([x for x in ssl if x['status'] == 'RESTING'], key=lambda x: x['distance_pct'])[:5]
    
    return {
        'bsl':          resting_bsl,
        'ssl':          resting_ssl,
        'equal_highs':  eqh[:3],
        'equal_lows':   eql[:3]
    }


def calc_premium_discount(candles, swing_highs, swing_lows):
    """
    Calculate premium/discount position.
    Uses most recent confirmed swing range.
    """
    if not swing_highs or not swing_lows:
        return {'status': 'INSUFFICIENT DATA', 'percentage': None}
    
    last_close = candles[-1]['close']
    
    # Find most recent swing high and low
    recent_sh = max(swing_highs, key=lambda x: x['index'])
    recent_sl = max(swing_lows,  key=lambda x: x['index'])
    
    range_high = recent_sh['price']
    range_low  = recent_sl['price']
    range_size = range_high - range_low
    
    if range_size <= 0:
        return {'status': 'INSUFFICIENT DATA', 'percentage': None}
    
    pct = (last_close - range_low) / range_size * 100
    pct = round(pct, 2)
    
    if pct >= 75:
        status = 'DEEP PREMIUM'
    elif pct >= 50:
        status = 'PREMIUM'
    elif pct >= 25:
        status = 'DISCOUNT'
    else:
        status = 'DEEP DISCOUNT'
    
    equilibrium = round(range_low + range_size * 0.5, 6)
    
    return {
        'status':      status,
        'percentage':  pct,
        'range_high':  round(range_high, 6),
        'range_low':   round(range_low, 6),
        'equilibrium': equilibrium,
        'current':     round(last_close, 6)
    }


def calc_session(latest_epoch):
    """Determine current trading session from epoch timestamp."""
    from datetime import datetime, timezone
    dt = datetime.fromtimestamp(latest_epoch, tz=timezone.utc)
    hour = dt.hour
    
    if 7 <= hour < 11:
        return {'session': 'LONDON', 'score': 5}
    elif 12 <= hour < 15:
        return {'session': 'LONDON_NY_OVERLAP', 'score': 5}
    elif 15 <= hour < 20:
        return {'session': 'NEW_YORK', 'score': 5}
    elif 0 <= hour < 6:
        return {'session': 'ASIAN', 'score': 0}
    else:
        return {'session': 'OFF_HOURS', 'score': 2}


def run_engine(candles_by_tf):
    """
    Main engine. Receives candles per timeframe, returns full analysis.
    candles_by_tf = { '4H': [...], '1H': [...], '15M': [...], '5M': [...] }
    """
    result = {}
    
    tf_order = ['D1', '4H', '1H', '15M', '5M']
    available_tfs = [tf for tf in tf_order if tf in candles_by_tf and len(candles_by_tf[tf]) > 20]
    
    if not available_tfs:
        return {'error': 'No valid timeframes provided'}
    
    htf = available_tfs[0]   # highest timeframe
    etf = available_tfs[-1]  # entry timeframe
    
    for tf in available_tfs:
        candles = candles_by_tf[tf]
        
        atr                     = calc_atr(candles)
        swing_highs, swing_lows = detect_swings(candles)
        bos_events, trend       = detect_bos_choch(candles, swing_highs, swing_lows)
        fvgs                    = detect_fvg(candles, atr)
        obs                     = detect_order_blocks(candles, bos_events, atr)
        liquidity               = detect_liquidity(candles, swing_highs, swing_lows, atr)
        pd_analysis             = calc_premium_discount(candles, swing_highs, swing_lows)
        
        # Keep only last 5 of each to avoid token bloat
        result[tf] = {
            'atr':            atr,
            'trend':          trend,
            'current_price':  candles[-1]['close'],
            'swing_highs':    swing_highs[-5:],
            'swing_lows':     swing_lows[-5:],
            'bos_choch':      bos_events[-8:],
            'fvg_fresh':      [f for f in fvgs if f['status'] == 'FRESH'][-5:],
            'fvg_mitigated':  [f for f in fvgs if f['status'] == 'MITIGATED'][-3:],
            'ob_fresh':       [o for o in obs if o['status'] == 'FRESH'][-5:],
            'ob_mitigated':   [o for o in obs if o['status'] == 'MITIGATED'][-3:],
            'liquidity':      liquidity,
            'premium_discount': pd_analysis,
        }
    
    # Session analysis from entry TF
    etf_candles = candles_by_tf[etf]
    session = calc_session(etf_candles[-1]['epoch']) if etf_candles else {'session': 'UNKNOWN', 'score': 0}
    
    # HTF trend summary
    htf_data  = result.get(htf, {})
    htf_trend = htf_data.get('trend', 'NEUTRAL')
    
    result['_summary'] = {
        'htf':         htf,
        'etf':         etf,
        'htf_trend':   htf_trend,
        'session':     session,
        'asset_price': candles_by_tf[etf][-1]['close'] if candles_by_tf.get(etf) else 0
    }
    
    return result


def main():
    """Read JSON from stdin, run engine, write JSON to stdout."""
    try:
        raw = sys.stdin.read()
        data = json.loads(raw)
        candles_by_tf = data.get('candles', {})
        result = run_engine(candles_by_tf)
        print(json.dumps(result))
        sys.exit(0)
    except Exception as e:
        error = {'error': str(e)}
        print(json.dumps(error))
        sys.exit(1)


if __name__ == '__main__':
    main()
