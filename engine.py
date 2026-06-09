#!/usr/bin/env python3
"""
QUANT-X Engine v2 — Institutional SMC/ICT + TA-Lib + ML Signal Scoring + Backtesting
Called by server.ts as a child process.
Reads JSON from stdin, writes JSON to stdout.

LIBRARY STRATEGY (AI Studio compatible):
- Tries to import TA-Lib, numpy, pandas, sklearn for full power
- If any library is missing, falls back to pure Python implementations
- App NEVER crashes due to missing libraries
- Every feature degrades gracefully
"""

import sys
import json
import math
from datetime import datetime, timezone

# ─── Library imports with graceful fallback ───────────────────────────────────
HAS_NUMPY   = False
HAS_TALIB   = False
HAS_PANDAS  = False
HAS_SKLEARN = False

try:
    import numpy as np
    HAS_NUMPY = True
except ImportError:
    pass

try:
    import talib
    HAS_TALIB = True
except ImportError:
    pass

try:
    import pandas as pd
    HAS_PANDAS = True
except ImportError:
    pass

try:
    from sklearn.preprocessing import StandardScaler
    from sklearn.linear_model import LogisticRegression
    HAS_SKLEARN = True
except ImportError:
    pass


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 1 — TECHNICAL INDICATORS
# TA-Lib used when available, pure Python fallback otherwise
# ═══════════════════════════════════════════════════════════════════════════════

def calc_atr(candles, period=14):
    """Wilder ATR — TA-Lib if available, correct pure Python otherwise."""
    if len(candles) < period + 1:
        return 0.0

    if HAS_TALIB and HAS_NUMPY:
        try:
            highs  = np.array([c['high']  for c in candles], dtype=float)
            lows   = np.array([c['low']   for c in candles], dtype=float)
            closes = np.array([c['close'] for c in candles], dtype=float)
            result = talib.ATR(highs, lows, closes, timeperiod=period)
            valid  = result[~np.isnan(result)]
            return round(float(valid[-1]), 6) if len(valid) > 0 else 0.0
        except Exception:
            pass

    # Pure Python Wilder ATR fallback
    slice_c = candles[-(period * 3):]
    trs = []
    for i in range(1, len(slice_c)):
        curr, prev = slice_c[i], slice_c[i - 1]
        trs.append(max(
            curr['high'] - curr['low'],
            abs(curr['high'] - prev['close']),
            abs(curr['low']  - prev['close'])
        ))
    if len(trs) < period:
        return round(sum(trs) / len(trs), 6) if trs else 0.0
    atr = sum(trs[:period]) / period
    for i in range(period, len(trs)):
        atr = (atr * (period - 1) + trs[i]) / period
    return round(atr, 6)


def calc_ema(candles, period=20):
    """EMA — TA-Lib if available, pure Python otherwise."""
    if len(candles) < period:
        return {'value': None, 'values': []}

    if HAS_TALIB and HAS_NUMPY:
        try:
            closes = np.array([c['close'] for c in candles], dtype=float)
            result = talib.EMA(closes, timeperiod=period)
            valid  = result[~np.isnan(result)]
            vals   = [round(float(v), 6) for v in valid[-10:]]
            return {'value': vals[-1] if vals else None, 'values': vals}
        except Exception:
            pass

    # Pure Python EMA fallback
    closes = [c['close'] for c in candles]
    k = 2 / (period + 1)
    ema = sum(closes[:period]) / period
    vals = [round(ema, 6)]
    for price in closes[period:]:
        ema = price * k + ema * (1 - k)
        vals.append(round(ema, 6))
    return {'value': vals[-1] if vals else None, 'values': vals[-10:]}


def calc_rsi(candles, period=14):
    """RSI — TA-Lib if available, pure Python otherwise."""
    if len(candles) < period + 1:
        return {'value': None, 'zone': 'INSUFFICIENT DATA'}

    if HAS_TALIB and HAS_NUMPY:
        try:
            closes = np.array([c['close'] for c in candles], dtype=float)
            result = talib.RSI(closes, timeperiod=period)
            valid  = result[~np.isnan(result)]
            if len(valid) > 0:
                val = round(float(valid[-1]), 2)
                return {'value': val, 'zone': _rsi_zone(val)}
        except Exception:
            pass

    # Pure Python RSI fallback
    closes = [c['close'] for c in candles]
    deltas = [closes[i] - closes[i-1] for i in range(1, len(closes))]
    gains  = [max(d, 0) for d in deltas]
    losses = [abs(min(d, 0)) for d in deltas]
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period
    for i in range(period, len(gains)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
    if avg_loss == 0:
        val = 100.0
    else:
        rs  = avg_gain / avg_loss
        val = round(100 - (100 / (1 + rs)), 2)
    return {'value': val, 'zone': _rsi_zone(val)}


def _rsi_zone(val):
    if val >= 70:   return 'OVERBOUGHT'
    if val >= 60:   return 'BULLISH'
    if val >= 50:   return 'NEUTRAL_BULL'
    if val >= 40:   return 'NEUTRAL_BEAR'
    if val >= 30:   return 'BEARISH'
    return 'OVERSOLD'


def calc_bollinger(candles, period=20, std_dev=2):
    """Bollinger Bands — TA-Lib if available, pure Python otherwise."""
    if len(candles) < period:
        return {'upper': None, 'middle': None, 'lower': None, 'width': None, 'position': None}

    if HAS_TALIB and HAS_NUMPY:
        try:
            closes = np.array([c['close'] for c in candles], dtype=float)
            upper, middle, lower = talib.BBANDS(closes, timeperiod=period, nbdevup=std_dev, nbdevdn=std_dev)
            last_close = float(closes[-1])
            u = round(float(upper[~np.isnan(upper)][-1]), 6)
            m = round(float(middle[~np.isnan(middle)][-1]), 6)
            l = round(float(lower[~np.isnan(lower)][-1]), 6)
            width = round((u - l) / m * 100, 3) if m else 0
            pos   = round((last_close - l) / (u - l) * 100, 2) if (u - l) else 50
            return {'upper': u, 'middle': m, 'lower': l, 'width': width, 'position': pos,
                    'squeeze': width < 2.0, 'expansion': width > 5.0}
        except Exception:
            pass

    # Pure Python Bollinger fallback
    closes = [c['close'] for c in candles[-period:]]
    mean   = sum(closes) / period
    var    = sum((x - mean) ** 2 for x in closes) / period
    std    = math.sqrt(var)
    u = round(mean + std_dev * std, 6)
    m = round(mean, 6)
    l = round(mean - std_dev * std, 6)
    last_close = candles[-1]['close']
    width = round((u - l) / m * 100, 3) if m else 0
    pos   = round((last_close - l) / (u - l) * 100, 2) if (u - l) else 50
    return {'upper': u, 'middle': m, 'lower': l, 'width': width, 'position': pos,
            'squeeze': width < 2.0, 'expansion': width > 5.0}


def calc_macd(candles, fast=12, slow=26, signal=9):
    """MACD — TA-Lib if available, pure Python otherwise."""
    if len(candles) < slow + signal:
        return {'macd': None, 'signal': None, 'histogram': None, 'direction': 'INSUFFICIENT DATA'}

    if HAS_TALIB and HAS_NUMPY:
        try:
            closes = np.array([c['close'] for c in candles], dtype=float)
            macd, sig, hist = talib.MACD(closes, fastperiod=fast, slowperiod=slow, signalperiod=signal)
            valid_hist = hist[~np.isnan(hist)]
            valid_macd = macd[~np.isnan(macd)]
            valid_sig  = sig[~np.isnan(sig)]
            if len(valid_hist) >= 2:
                m = round(float(valid_macd[-1]), 6)
                s = round(float(valid_sig[-1]),  6)
                h = round(float(valid_hist[-1]), 6)
                direction = 'BULLISH' if h > 0 and h > valid_hist[-2] else \
                            'BEARISH' if h < 0 and h < valid_hist[-2] else 'NEUTRAL'
                return {'macd': m, 'signal': s, 'histogram': h, 'direction': direction}
        except Exception:
            pass

    # Pure Python MACD fallback
    closes = [c['close'] for c in candles]
    def ema_series(data, p):
        k = 2 / (p + 1)
        e = sum(data[:p]) / p
        res = [e]
        for v in data[p:]:
            e = v * k + e * (1 - k)
            res.append(e)
        return res
    ema_fast = ema_series(closes, fast)
    ema_slow = ema_series(closes, slow)
    min_len  = min(len(ema_fast), len(ema_slow))
    macd_line = [ema_fast[-(min_len - i)] - ema_slow[-(min_len - i)] for i in range(min_len)]
    sig_line  = ema_series(macd_line, signal)
    hist_line = [macd_line[i + (len(macd_line) - len(sig_line))] - sig_line[i] for i in range(len(sig_line))]
    if len(hist_line) >= 2:
        h = round(hist_line[-1], 6)
        direction = 'BULLISH' if h > 0 and h > hist_line[-2] else \
                    'BEARISH' if h < 0 and h < hist_line[-2] else 'NEUTRAL'
        return {'macd': round(macd_line[-1], 6), 'signal': round(sig_line[-1], 6),
                'histogram': h, 'direction': direction}
    return {'macd': None, 'signal': None, 'histogram': None, 'direction': 'INSUFFICIENT DATA'}


def calc_vwap(candles):
    """VWAP — intraday volume-weighted average price."""
    # Deriv doesn't provide volume so we use typical price as proxy
    if len(candles) < 2:
        return None
    typical_prices = [(c['high'] + c['low'] + c['close']) / 3 for c in candles]
    # Use price range as volume proxy (wider range = higher activity)
    proxy_vols = [c['high'] - c['low'] for c in candles]
    total_vol  = sum(proxy_vols)
    if total_vol == 0:
        return round(sum(typical_prices) / len(typical_prices), 6)
    vwap = sum(tp * pv for tp, pv in zip(typical_prices, proxy_vols)) / total_vol
    return round(vwap, 6)


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 2 — SMC/ICT STRUCTURE ENGINES (unchanged from v1, proven correct)
# ═══════════════════════════════════════════════════════════════════════════════

def detect_swings(candles, left=5, right=5):
    swing_highs, swing_lows = [], []
    for i in range(left, len(candles) - right):
        w_h = [candles[j]['high'] for j in range(i - left, i + right + 1)]
        w_l = [candles[j]['low']  for j in range(i - left, i + right + 1)]
        if candles[i]['high'] == max(w_h):
            swing_highs.append({'index': i, 'price': candles[i]['high'],
                                 'epoch': candles[i]['epoch'],
                                 'date':  candles[i].get('date', str(candles[i]['epoch']))})
        if candles[i]['low'] == min(w_l):
            swing_lows.append({'index': i, 'price': candles[i]['low'],
                                'epoch': candles[i]['epoch'],
                                'date':  candles[i].get('date', str(candles[i]['epoch']))})
    return swing_highs, swing_lows


def detect_bos_choch(candles, swing_highs, swing_lows):
    events, trend = [], 'NEUTRAL'
    all_swings = sorted(
        [('SH', sh) for sh in swing_highs] + [('SL', sl) for sl in swing_lows],
        key=lambda x: x[1]['index']
    )
    confirmed_sh, confirmed_sl = [], []
    for i, c in enumerate(candles):
        for stype, swing in all_swings:
            if swing['index'] == i:
                (confirmed_sh if stype == 'SH' else confirmed_sl).append(swing)
        if confirmed_sh:
            latest_sh = confirmed_sh[-1]
            if c['close'] > latest_sh['price'] and latest_sh['index'] < i:
                etype = 'CHoCH' if trend == 'BEARISH' else 'BOS'
                events.append({'type': f'{etype} BULL', 'price': latest_sh['price'],
                                'candle_price': c['close'], 'epoch': c['epoch'],
                                'date': c.get('date', str(c['epoch'])), 'index': i})
                trend, confirmed_sh = 'BULLISH', []
        if confirmed_sl:
            latest_sl = confirmed_sl[-1]
            if c['close'] < latest_sl['price'] and latest_sl['index'] < i:
                etype = 'CHoCH' if trend == 'BULLISH' else 'BOS'
                events.append({'type': f'{etype} BEAR', 'price': latest_sl['price'],
                                'candle_price': c['close'], 'epoch': c['epoch'],
                                'date': c.get('date', str(c['epoch'])), 'index': i})
                trend, confirmed_sl = 'BEARISH', []
    return events, trend


def detect_fvg(candles, atr):
    fvgs, min_size = [], atr * 0.15 if atr > 0 else 0
    for i in range(1, len(candles) - 1):
        prev, curr, nxt = candles[i-1], candles[i], candles[i+1]
        if prev['high'] < nxt['low']:
            gs = nxt['low'] - prev['high']
            if gs >= min_size:
                mit = any(candles[j]['close'] <= nxt['low'] and candles[j]['close'] >= prev['high']
                          for j in range(i + 2, len(candles)))
                fvgs.append({'direction': 'BULL', 'top': round(nxt['low'], 6),
                             'bottom': round(prev['high'], 6), 'size': round(gs, 6),
                             'atr_ratio': round(gs / atr, 3) if atr else 0,
                             'epoch': curr['epoch'], 'date': curr.get('date', str(curr['epoch'])),
                             'status': 'MITIGATED' if mit else 'FRESH', 'index': i})
        if prev['low'] > nxt['high']:
            gs = prev['low'] - nxt['high']
            if gs >= min_size:
                mit = any(candles[j]['close'] >= nxt['high'] and candles[j]['close'] <= prev['low']
                          for j in range(i + 2, len(candles)))
                fvgs.append({'direction': 'BEAR', 'top': round(prev['low'], 6),
                             'bottom': round(nxt['high'], 6), 'size': round(gs, 6),
                             'atr_ratio': round(gs / atr, 3) if atr else 0,
                             'epoch': curr['epoch'], 'date': curr.get('date', str(curr['epoch'])),
                             'status': 'MITIGATED' if mit else 'FRESH', 'index': i})
    return fvgs


def detect_order_blocks(candles, bos_events, atr):
    obs, min_impulse = [], atr * 1.5 if atr > 0 else 0
    for event in bos_events:
        if 'BOS' not in event['type']:
            continue
        bos_idx   = event['index']
        direction = 'BULL' if 'BULL' in event['type'] else 'BEAR'
        imp_c     = candles[max(0, bos_idx - 10):bos_idx + 1]
        if not imp_c:
            continue
        imp_size = max(c['high'] for c in imp_c) - min(c['low'] for c in imp_c)
        if imp_size < min_impulse:
            continue
        ob_candle, ob_idx = None, -1
        for j in range(bos_idx - 1, max(0, bos_idx - 15), -1):
            c = candles[j]
            if (direction == 'BULL' and c['close'] < c['open']) or \
               (direction == 'BEAR' and c['close'] > c['open']):
                ob_candle, ob_idx = c, j
                break
        if ob_candle is None:
            continue
        mid = (ob_candle['open'] + ob_candle['close']) / 2
        mit = any((direction == 'BULL' and candles[j]['low'] <= mid) or
                  (direction == 'BEAR' and candles[j]['high'] >= mid)
                  for j in range(bos_idx + 1, len(candles)))
        obs.append({'direction': direction,
                    'high': round(max(ob_candle['open'], ob_candle['close']), 6),
                    'low':  round(min(ob_candle['open'], ob_candle['close']), 6),
                    'full_high': round(ob_candle['high'], 6),
                    'full_low':  round(ob_candle['low'],  6),
                    'impulse_size': round(imp_size, 6),
                    'atr_ratio': round(imp_size / atr, 2) if atr else 0,
                    'epoch': ob_candle['epoch'],
                    'date':  ob_candle.get('date', str(ob_candle['epoch'])),
                    'status': 'MITIGATED' if mit else 'FRESH',
                    'index': ob_idx})
    return obs


def detect_liquidity(candles, swing_highs, swing_lows, atr):
    tol, last_close = atr * 0.05 if atr > 0 else 0, candles[-1]['close'] if candles else 0

    def sweep_status(swings, is_high):
        result = []
        for sw in swings:
            swept = False
            for j in range(sw['index'] + 1, len(candles)):
                c = candles[j]
                if is_high and c['high'] > sw['price']:
                    swept = c['close'] < sw['price']
                    break
                elif not is_high and c['low'] < sw['price']:
                    swept = c['close'] > sw['price']
                    break
            result.append({'price': sw['price'], 'epoch': sw['epoch'],
                           'date':  sw.get('date', str(sw['epoch'])),
                           'status': 'SWEPT' if swept else 'RESTING',
                           'distance_pct': round(abs(sw['price'] - last_close) / last_close * 100, 3) if last_close else 0})
        return result

    bsl = sweep_status(swing_highs, True)
    ssl = sweep_status(swing_lows, False)
    eqh = [{'price_1': swing_highs[i]['price'], 'price_2': swing_highs[j]['price'],
             'avg': round((swing_highs[i]['price'] + swing_highs[j]['price']) / 2, 6)}
           for i in range(len(swing_highs)) for j in range(i+1, len(swing_highs))
           if abs(swing_highs[i]['price'] - swing_highs[j]['price']) <= tol]
    eql = [{'price_1': swing_lows[i]['price'], 'price_2': swing_lows[j]['price'],
             'avg': round((swing_lows[i]['price'] + swing_lows[j]['price']) / 2, 6)}
           for i in range(len(swing_lows)) for j in range(i+1, len(swing_lows))
           if abs(swing_lows[i]['price'] - swing_lows[j]['price']) <= tol]
    return {
        'bsl': sorted([x for x in bsl if x['status'] == 'RESTING'], key=lambda x: x['distance_pct'])[:5],
        'ssl': sorted([x for x in ssl if x['status'] == 'RESTING'], key=lambda x: x['distance_pct'])[:5],
        'equal_highs': eqh[:3], 'equal_lows': eql[:3]
    }


def calc_premium_discount(candles, swing_highs, swing_lows):
    if not swing_highs or not swing_lows:
        return {'status': 'INSUFFICIENT DATA', 'percentage': None}
    last_close = candles[-1]['close']
    rh = max(swing_highs, key=lambda x: x['index'])['price']
    rl = max(swing_lows,  key=lambda x: x['index'])['price']
    rng = rh - rl
    if rng <= 0:
        return {'status': 'INSUFFICIENT DATA', 'percentage': None}
    pct = round((last_close - rl) / rng * 100, 2)
    status = 'DEEP PREMIUM' if pct >= 75 else 'PREMIUM' if pct >= 50 else \
             'DISCOUNT' if pct >= 25 else 'DEEP DISCOUNT'
    return {'status': status, 'percentage': pct,
            'range_high': round(rh, 6), 'range_low': round(rl, 6),
            'equilibrium': round(rl + rng * 0.5, 6), 'current': round(last_close, 6)}


def calc_session(latest_epoch):
    dt   = datetime.fromtimestamp(latest_epoch, tz=timezone.utc)
    hour = dt.hour
    if 7  <= hour < 11: return {'session': 'LONDON',           'score': 5}
    if 12 <= hour < 15: return {'session': 'LONDON_NY_OVERLAP','score': 5}
    if 15 <= hour < 20: return {'session': 'NEW_YORK',         'score': 5}
    if 0  <= hour < 6:  return {'session': 'ASIAN',            'score': 0}
    return {'session': 'OFF_HOURS', 'score': 2}


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 3 — ML SIGNAL SCORING
# Uses sklearn LogisticRegression when available, rule-based scoring as fallback
# ═══════════════════════════════════════════════════════════════════════════════

def build_feature_vector(tf_data, indicators):
    """
    Build a normalised feature vector for ML scoring.
    Features represent the current market state numerically.
    """
    features = []

    # 1. Trend encoding: BULLISH=1, BEARISH=-1, NEUTRAL=0
    trend_enc = {'BULLISH': 1, 'BEARISH': -1, 'NEUTRAL': 0}
    features.append(trend_enc.get(tf_data.get('trend', 'NEUTRAL'), 0))

    # 2. Premium/Discount percentage (0-100 normalised to -1 to 1)
    pd = tf_data.get('premium_discount', {})
    pct = pd.get('percentage')
    features.append((pct / 50.0 - 1.0) if pct is not None else 0.0)

    # 3. Fresh OBs count (normalised)
    features.append(min(len(tf_data.get('ob_fresh', [])), 5) / 5.0)

    # 4. Fresh FVGs count (normalised)
    features.append(min(len(tf_data.get('fvg_fresh', [])), 5) / 5.0)

    # 5. Resting BSL count
    liq = tf_data.get('liquidity', {})
    features.append(min(len(liq.get('bsl', [])), 5) / 5.0)

    # 6. Resting SSL count
    features.append(min(len(liq.get('ssl', [])), 5) / 5.0)

    # 7. RSI normalised (0-100 → -1 to 1)
    rsi_val = indicators.get('rsi', {}).get('value')
    features.append((rsi_val / 50.0 - 1.0) if rsi_val is not None else 0.0)

    # 8. MACD direction: BULLISH=1, BEARISH=-1, NEUTRAL=0
    macd_dir = indicators.get('macd', {}).get('direction', 'NEUTRAL')
    features.append(trend_enc.get(macd_dir, 0))

    # 9. Bollinger position (0-100 → -1 to 1)
    bb_pos = indicators.get('bollinger', {}).get('position')
    features.append((bb_pos / 50.0 - 1.0) if bb_pos is not None else 0.0)

    # 10. Structure events count in last 8 events
    bos_count = sum(1 for e in tf_data.get('bos_choch', []) if 'BOS' in e['type'])
    features.append(min(bos_count, 5) / 5.0)

    return features


def ml_signal_score(htf_data, etf_data, indicators_by_tf, session_score):
    """
    ML-based confluence score.
    When sklearn is available: uses LogisticRegression trained on synthetic
    institutional patterns (correct confluence = positive class).
    When sklearn unavailable: uses weighted rule-based scoring.
    Returns score 0-100.
    """
    if HAS_SKLEARN and HAS_NUMPY:
        try:
            htf_features = build_feature_vector(htf_data, indicators_by_tf.get('htf', {}))
            etf_features = build_feature_vector(etf_data, indicators_by_tf.get('etf', {}))
            combined     = htf_features + etf_features + [session_score / 5.0]

            # Synthetic training data representing high-confluence vs low-confluence setups
            # Format: [htf_trend, htf_pd, htf_obs, htf_fvg, htf_bsl, htf_ssl, htf_rsi, htf_macd, htf_bb, htf_bos,
            #          etf_trend, etf_pd, etf_obs, etf_fvg, etf_bsl, etf_ssl, etf_rsi, etf_macd, etf_bb, etf_bos, session]
            X_train = [
                # HIGH confluence long setups (label=1)
                [-1,-0.5,0.8,0.6,0.2,0.8,-0.3,-1,0.8,0.8,  -1,-0.5,0.6,0.8,0.2,0.8,-0.4,-1,0.7,0.6, 1.0],
                [-1,-0.6,0.6,0.8,0.0,1.0,-0.5,-1,0.9,0.6,  -1,-0.4,0.8,0.6,0.0,0.8,-0.5,-1,0.8,0.8, 0.6],
                [1, -0.4,0.8,0.4,0.4,0.4,-0.2,1,-0.5,0.6,   1,-0.5,0.6,0.6,0.2,0.4,-0.3,1,-0.6,0.6, 1.0],
                # HIGH confluence short setups (label=1)
                [1, 0.5,0.8,0.6,0.8,0.2,0.3,1,-0.8,0.8,    1,0.4,0.6,0.8,0.8,0.2,0.4,1,-0.7,0.6, 1.0],
                [1, 0.6,0.6,0.8,0.6,0.0,0.5,1,-0.9,0.6,    1,0.5,0.8,0.6,0.8,0.0,0.5,1,-0.8,0.8, 0.6],
                # LOW confluence setups (label=0)
                [1, 0.2,0.2,0.2,0.2,0.2,0.1,1,0.0,0.2,     -1,-0.2,0.4,0.2,0.2,0.4,-0.1,-1,0.1,0.2,0.0],
                [-1,0.3,0.4,0.2,0.4,0.2,-0.1,-1,0.3,0.4,   1, 0.2,0.2,0.4,0.2,0.2, 0.1, 1,-0.1,0.2,0.0],
                [0, 0.0,0.2,0.2,0.2,0.2,0.0, 0,0.0,0.2,    0, 0.0,0.2,0.2,0.2,0.2, 0.0, 0,0.0,0.2,0.4],
                [1,-0.2,0.4,0.4,0.4,0.6,0.0, 1,0.2,0.4,    -1,0.3,0.2,0.4,0.4,0.2, 0.0,-1,0.3,0.4,0.0],
            ]
            y_train = [1, 1, 1, 1, 1, 0, 0, 0, 0]

            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(X_train)
            x_input  = scaler.transform([combined])

            clf = LogisticRegression(max_iter=500, random_state=42)
            clf.fit(X_scaled, y_train)

            prob = clf.predict_proba(x_input)[0][1]  # probability of high-confluence
            raw_score = round(prob * 100, 1)

            # Apply HTF hard filter
            htf_trend = htf_data.get('trend', 'NEUTRAL')
            etf_trend = etf_data.get('trend', 'NEUTRAL')
            htf_filter_applied = False
            if htf_trend != 'NEUTRAL' and etf_trend != 'NEUTRAL' and htf_trend != etf_trend:
                raw_score = min(raw_score, 40)
                htf_filter_applied = True

            return {
                'score':              raw_score,
                'method':             'ML_LOGISTIC_REGRESSION',
                'htf_filter_applied': htf_filter_applied,
                'features_htf':       htf_features,
                'features_etf':       etf_features,
            }
        except Exception as e:
            pass  # fall through to rule-based

    # Rule-based fallback scoring
    return rule_based_score(htf_data, etf_data, session_score)


def rule_based_score(htf_data, etf_data, session_score):
    """Deterministic rule-based confluence scoring when ML unavailable."""
    score = 0
    breakdown = {}

    htf_trend = htf_data.get('trend', 'NEUTRAL')
    etf_trend = etf_data.get('trend', 'NEUTRAL')

    # Structure alignment
    if htf_trend != 'NEUTRAL' and htf_trend == etf_trend:
        score += 20; breakdown['structure'] = 20
    else:
        breakdown['structure'] = 0

    # Liquidity target
    liq = etf_data.get('liquidity', {})
    if (liq.get('bsl') and etf_trend == 'BULLISH') or (liq.get('ssl') and etf_trend == 'BEARISH'):
        score += 15; breakdown['liquidity'] = 15
    else:
        breakdown['liquidity'] = 0

    # CHoCH on ETF confirming HTF
    choch_events = [e for e in etf_data.get('bos_choch', []) if 'CHoCH' in e['type']]
    if choch_events:
        last_choch = choch_events[-1]
        if ('BULL' in last_choch['type'] and htf_trend == 'BULLISH') or \
           ('BEAR' in last_choch['type'] and htf_trend == 'BEARISH'):
            score += 15; breakdown['choch_confirmation'] = 15
        else:
            breakdown['choch_confirmation'] = 0
    else:
        breakdown['choch_confirmation'] = 0

    # Fresh OB
    if etf_data.get('ob_fresh'):
        score += 10; breakdown['order_block'] = 10
    else:
        breakdown['order_block'] = 0

    # Fresh FVG
    if etf_data.get('fvg_fresh'):
        score += 10; breakdown['fvg'] = 10
    else:
        breakdown['fvg'] = 0

    # S/D overlap (check if OB price range overlaps with FVG)
    obs = etf_data.get('ob_fresh', [])
    fvgs = etf_data.get('fvg_fresh', [])
    overlap = False
    for ob in obs:
        for fvg in fvgs:
            if ob['low'] <= fvg['top'] and ob['high'] >= fvg['bottom']:
                overlap = True
                break
    if overlap:
        score += 10; breakdown['sd_overlap'] = 10
    else:
        breakdown['sd_overlap'] = 0

    # Premium/Discount alignment
    pd = etf_data.get('premium_discount', {})
    pd_status = pd.get('status', '')
    if (etf_trend == 'BULLISH' and 'DISCOUNT' in pd_status) or \
       (etf_trend == 'BEARISH' and 'PREMIUM' in pd_status):
        score += 10; breakdown['pd_alignment'] = 10
    else:
        breakdown['pd_alignment'] = 0

    # Price action (approximate via recent candle structure)
    breakdown['pa_confirmation'] = 0  # requires live candle — noted for Gemini
    breakdown['session'] = session_score

    score += session_score

    htf_filter_applied = False
    if htf_trend != 'NEUTRAL' and etf_trend != 'NEUTRAL' and htf_trend != etf_trend:
        score = min(score, 40)
        htf_filter_applied = True

    return {
        'score':              round(score, 1),
        'method':             'RULE_BASED',
        'breakdown':          breakdown,
        'htf_filter_applied': htf_filter_applied,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 4 — BACKTESTING ENGINE
# Runs historical confluence scoring over all candles
# Returns win rate, expectancy, and best timeframe/session combos
# ═══════════════════════════════════════════════════════════════════════════════

def run_backtest(candles, atr, swing_highs, swing_lows, bos_events, fvgs, obs):
    """
    Lightweight vectorised backtest over historical candles.
    For each BOS event, checks if a trade in that direction would have hit
    TP (1.5x ATR) before SL (1x ATR). Records outcome.
    Returns win rate, expectancy, and trade log.
    """
    if len(candles) < 50:
        return {'status': 'INSUFFICIENT DATA', 'trades': 0}

    trades   = []
    tp_ratio = 1.5  # TP = 1.5x ATR
    sl_ratio = 1.0  # SL = 1.0x ATR

    bos_only = [e for e in bos_events if 'BOS' in e['type']]

    for event in bos_only:
        idx       = event['index']
        direction = 'LONG' if 'BULL' in event['type'] else 'SHORT'
        entry     = candles[idx]['close']
        atr_at    = calc_atr(candles[:idx + 1]) if idx >= 14 else atr

        if atr_at == 0:
            continue

        tp_price = entry + atr_at * tp_ratio if direction == 'LONG' else entry - atr_at * tp_ratio
        sl_price = entry - atr_at * sl_ratio if direction == 'LONG' else entry + atr_at * sl_ratio

        outcome    = 'OPEN'
        exit_price = None
        bars_held  = 0

        for j in range(idx + 1, min(idx + 50, len(candles))):
            c = candles[j]
            bars_held += 1
            if direction == 'LONG':
                if c['low'] <= sl_price:
                    outcome = 'LOSS'; exit_price = sl_price; break
                if c['high'] >= tp_price:
                    outcome = 'WIN';  exit_price = tp_price; break
            else:
                if c['high'] >= sl_price:
                    outcome = 'LOSS'; exit_price = sl_price; break
                if c['low'] <= tp_price:
                    outcome = 'WIN';  exit_price = tp_price; break

        if outcome != 'OPEN':
            pnl = (exit_price - entry) if direction == 'LONG' else (entry - exit_price)
            trades.append({
                'direction': direction,
                'entry':     round(entry, 6),
                'exit':      round(exit_price, 6),
                'outcome':   outcome,
                'pnl_atr':   round(pnl / atr_at, 3),
                'bars':      bars_held,
                'date':      candles[idx].get('date', str(candles[idx]['epoch']))
            })

    if not trades:
        return {'status': 'NO TRADES FOUND', 'trades': 0}

    wins       = [t for t in trades if t['outcome'] == 'WIN']
    losses     = [t for t in trades if t['outcome'] == 'LOSS']
    win_rate   = round(len(wins) / len(trades) * 100, 1)
    avg_win    = round(sum(t['pnl_atr'] for t in wins)   / len(wins),   3) if wins   else 0
    avg_loss   = round(sum(t['pnl_atr'] for t in losses) / len(losses), 3) if losses else 0
    expectancy = round((win_rate / 100 * avg_win) + ((1 - win_rate / 100) * avg_loss), 3)
    profit_factor = round(abs(sum(t['pnl_atr'] for t in wins)) /
                          abs(sum(t['pnl_atr'] for t in losses)), 3) if losses and wins else 0

    return {
        'status':         'COMPLETE',
        'trades':         len(trades),
        'wins':           len(wins),
        'losses':         len(losses),
        'win_rate_pct':   win_rate,
        'avg_win_atr':    avg_win,
        'avg_loss_atr':   avg_loss,
        'expectancy_atr': expectancy,
        'profit_factor':  profit_factor,
        'recent_trades':  trades[-5:],
        'verdict':        'EDGE CONFIRMED' if expectancy > 0.2 and win_rate >= 45 else
                          'MARGINAL EDGE'  if expectancy > 0   else 'NO EDGE DETECTED',
    }


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 5 — MAIN ENGINE ORCHESTRATOR
# ═══════════════════════════════════════════════════════════════════════════════

def run_engine(candles_by_tf):
    result   = {}
    tf_order = ['D1', '4H', '1H', '15M', '5M']
    avail_tfs = [tf for tf in tf_order if tf in candles_by_tf and len(candles_by_tf[tf]) > 20]

    if not avail_tfs:
        return {'error': 'No valid timeframes provided'}

    htf = avail_tfs[0]
    etf = avail_tfs[-1]
    indicators_by_tf = {'htf': {}, 'etf': {}}

    for tf in avail_tfs:
        candles = candles_by_tf[tf]

        # Core SMC calculations
        atr              = calc_atr(candles)
        swing_highs, swing_lows = detect_swings(candles)
        bos_events, trend       = detect_bos_choch(candles, swing_highs, swing_lows)
        fvgs             = detect_fvg(candles, atr)
        obs              = detect_order_blocks(candles, bos_events, atr)
        liquidity        = detect_liquidity(candles, swing_highs, swing_lows, atr)
        pd_analysis      = calc_premium_discount(candles, swing_highs, swing_lows)

        # TA indicators
        ema_20  = calc_ema(candles, 20)
        ema_50  = calc_ema(candles, 50)
        ema_200 = calc_ema(candles, 200)
        rsi     = calc_rsi(candles)
        bb      = calc_bollinger(candles)
        macd    = calc_macd(candles)
        vwap    = calc_vwap(candles)

        indicators = {
            'ema_20':     ema_20,
            'ema_50':     ema_50,
            'ema_200':    ema_200,
            'rsi':        rsi,
            'bollinger':  bb,
            'macd':       macd,
            'vwap':       vwap,
        }

        # EMA trend alignment
        ema_trend = 'NEUTRAL'
        if ema_20['value'] and ema_50['value'] and ema_200['value']:
            if ema_20['value'] > ema_50['value'] > ema_200['value']:
                ema_trend = 'STRONG_BULLISH'
            elif ema_20['value'] < ema_50['value'] < ema_200['value']:
                ema_trend = 'STRONG_BEARISH'
            elif ema_20['value'] > ema_50['value']:
                ema_trend = 'BULLISH'
            elif ema_20['value'] < ema_50['value']:
                ema_trend = 'BEARISH'

        # Backtest (only on HTF to avoid performance hit)
        backtest = None
        if tf == htf:
            backtest = run_backtest(candles, atr, swing_highs, swing_lows, bos_events, fvgs, obs)

        # Store indicators for ML use
        if tf == htf: indicators_by_tf['htf'] = {**indicators, 'rsi': rsi, 'macd': macd, 'bollinger': bb}
        if tf == etf: indicators_by_tf['etf'] = {**indicators, 'rsi': rsi, 'macd': macd, 'bollinger': bb}

        result[tf] = {
            'atr':            atr,
            'trend':          trend,
            'ema_trend':      ema_trend,
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
            'indicators':     indicators,
            'backtest':       backtest,
        }

    # Session
    etf_candles = candles_by_tf[etf]
    session = calc_session(etf_candles[-1]['epoch']) if etf_candles else {'session': 'UNKNOWN', 'score': 0}

    # ML confluence score
    htf_data = result.get(htf, {})
    etf_data = result.get(etf, {})
    ml_score = ml_signal_score(htf_data, etf_data, indicators_by_tf, session.get('score', 0))

    # Library status report
    libs_available = {
        'numpy':   HAS_NUMPY,
        'talib':   HAS_TALIB,
        'pandas':  HAS_PANDAS,
        'sklearn': HAS_SKLEARN,
    }

    result['_summary'] = {
        'htf':              htf,
        'etf':              etf,
        'htf_trend':        htf_data.get('trend', 'NEUTRAL'),
        'htf_ema_trend':    htf_data.get('ema_trend', 'NEUTRAL'),
        'session':          session,
        'asset_price':      etf_candles[-1]['close'] if etf_candles else 0,
        'ml_score':         ml_score,
        'libs_available':   libs_available,
    }

    return result


def main():
    try:
        raw  = sys.stdin.read()
        data = json.loads(raw)
        result = run_engine(data.get('candles', {}))
        print(json.dumps(result))
        sys.exit(0)
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)


if __name__ == '__main__':
    main()
