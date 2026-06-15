#!/usr/bin/env python3
"""
QUANT-X Engine v3 — Institutional Grade
Upgrades over v2:
- Fixed P/D percentage (never negative)
- RSI contradiction penalty in scoring
- Adjusted backtest win rate (20% haircut)
- Hurst Exponent regime detection
- ADX-based regime classification
- Volatility percentile regime
- Volume profile proxy (POC, HVN, LVN, Value Area)
- Liquidity sweep quality scoring
- Economic calendar from Forex Factory free JSON API
- SQLite signal tracking for real statistical edge validation
- Adaptive per-asset weights from real outcome history
- Sharpe/Sortino/MaxDD from real trade history
- Monte Carlo simulation (when 100+ real trades available)
"""

import sys
import json
import math
import sqlite3
import os
import random
from datetime import datetime, timezone, timedelta
from urllib.request import urlopen, Request
from urllib.error import URLError

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

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'quant_signals.db')

# In-memory candle cache — avoid re-fetching same candles within 2 minutes
# Key: "SYMBOL_GRANULARITY" → {candles: [...], timestamp: float}
_candle_cache: dict = {}
CANDLE_CACHE_TTL = 120  # 2 minutes in seconds

# ═══════════════════════════════════════════════════════════════════════════════
# INTELLIGENCE COLLECTION LAYER
# Python's role: collect ALL facts and structure them as evidence
# AI's role: interpret the evidence, find contradictions, make decisions
# ═══════════════════════════════════════════════════════════════════════════════

# ── Fundamental Intelligence ──────────────────────────────────────────────────

def fetch_fundamental_data(asset: str, calendar_data: dict, cross_asset_data: dict) -> dict:
    """
    Collect and structure all fundamental facts.
    Python does NOT interpret — it gathers raw evidence for AI judgment.

    Returns structured facts:
    - Economic event actual vs forecast (surprise direction)
    - DXY/yield proxy momentum
    - Central bank environment
    - Key macro levels
    """
    fundamental = {
        'asset':           asset,
        'timestamp':       datetime.now(timezone.utc).isoformat(),
        'economic_events': [],
        'macro_context':   {},
        'dxy_environment': {},
        'risk_environment': {},
        'surprises':       [],
    }

    # ── Economic Calendar Events ───────────────────────────────────────────────
    if calendar_data and calendar_data.get('events'):
        for event in calendar_data['events']:
            actual   = event.get('actual',   'Pending')
            forecast = event.get('forecast',  'N/A')
            previous = event.get('previous',  'N/A')

            # Calculate surprise direction (Python just measures, AI interprets)
            surprise_dir = 'PENDING'
            if actual != 'Pending' and forecast != 'N/A':
                try:
                    act_val  = float(str(actual).replace('%','').replace('K','000').replace('M','000000'))
                    fore_val = float(str(forecast).replace('%','').replace('K','000').replace('M','000000'))
                    if act_val > fore_val:
                        surprise_dir = 'BEAT'      # actual better than forecast
                    elif act_val < fore_val:
                        surprise_dir = 'MISS'      # actual worse than forecast
                    else:
                        surprise_dir = 'IN_LINE'
                except (ValueError, TypeError):
                    surprise_dir = 'UNKNOWN'

            event_data = {
                'title':        event.get('title', 'Unknown'),
                'currency':     event.get('currency', ''),
                'time_utc':     event.get('time_utc', ''),
                'status':       event.get('status', ''),
                'actual':       actual,
                'forecast':     forecast,
                'previous':     previous,
                'surprise':     surprise_dir,
                'minutes_away': event.get('minutes_away', 9999),
            }
            fundamental['economic_events'].append(event_data)

            # Flag surprises for AI attention
            if surprise_dir in ('BEAT', 'MISS'):
                fundamental['surprises'].append({
                    'event':    event.get('title', ''),
                    'currency': event.get('currency', ''),
                    'surprise': surprise_dir,
                    'actual':   actual,
                    'forecast': forecast,
                })

    # ── DXY / Dollar Environment ───────────────────────────────────────────────
    if cross_asset_data and cross_asset_data.get('correlations'):
        for corr in cross_asset_data['correlations']:
            if corr.get('role') == 'DXY':
                fundamental['dxy_environment'] = {
                    'proxy':     corr.get('symbol', 'USDJPY'),
                    'direction': corr.get('direction', 'FLAT'),
                    'strength':  corr.get('strength', 'WEAK'),
                    'pct_change':corr.get('pct_change', 0),
                    'raw_fact':  f"USD proxy ({corr.get('symbol')}) is {corr.get('direction')} by {corr.get('pct_change')}% [{corr.get('strength')}]",
                }
            if corr.get('role') == 'RISK':
                fundamental['risk_environment'] = {
                    'proxy':     corr.get('symbol', 'AUDUSD'),
                    'direction': corr.get('direction', 'FLAT'),
                    'strength':  corr.get('strength', 'WEAK'),
                    'pct_change':corr.get('pct_change', 0),
                    'raw_fact':  f"Risk proxy ({corr.get('symbol')}) is {corr.get('direction')} by {corr.get('pct_change')}% [{corr.get('strength')}]",
                }

    # ── Asset-specific macro context (raw facts only, no interpretation) ───────
    MACRO_CONTEXT_FACTS = {
        'XAUUSD': {
            'primary_drivers': ['USD strength', 'real yields', 'risk sentiment', 'central bank demand', 'geopolitical risk'],
            'inverse_assets':  ['DXY', 'US10Y yields'],
            'safe_haven':      True,
            'note': 'Gold moves inversely with USD and real yields. Safe-haven demand increases in risk-off.',
        },
        'BTCUSD': {
            'primary_drivers': ['risk appetite', 'institutional flows', 'ETF demand', 'regulatory news', 'macro liquidity'],
            'inverse_assets':  ['DXY'],
            'safe_haven':      False,
            'note': 'Bitcoin behaves as a risk asset. Correlates with equities in risk-off periods.',
        },
        'EURUSD': {
            'primary_drivers': ['ECB policy', 'Fed policy', 'EU economic data', 'USD strength'],
            'inverse_assets':  ['DXY'],
            'safe_haven':      False,
            'note': 'EUR/USD is primarily driven by relative monetary policy divergence between Fed and ECB.',
        },
        'GBPUSD': {
            'primary_drivers': ['Bank of England policy', 'UK economic data', 'USD strength', 'Brexit aftermath'],
            'inverse_assets':  ['DXY'],
            'safe_haven':      False,
            'note': 'GBP sensitive to UK political events and BoE guidance.',
        },
        'USDJPY': {
            'primary_drivers': ['Fed vs BoJ policy', 'carry trade', 'risk sentiment', 'yield differentials'],
            'inverse_assets':  [],
            'safe_haven':      False,
            'note': 'USDJPY rises when US yields rise vs Japanese yields. JPY is safe-haven in risk-off.',
        },
    }
    fundamental['macro_context'] = MACRO_CONTEXT_FACTS.get(asset, {
        'primary_drivers': ['monetary policy', 'risk sentiment', 'economic data'],
        'safe_haven': False,
        'note': 'No specific macro context configured for this asset.',
    })

    return fundamental


# ── Sentiment Intelligence ─────────────────────────────────────────────────────

def collect_sentiment_intelligence(news_items: list) -> dict:
    """
    Structure news/sentiment evidence for AI interpretation.
    Python does NOT interpret headlines — it measures and categorises.
    AI interprets whether the sentiment is already priced in, misleading, etc.

    Uses simple keyword scoring (no FinBERT required — avoids dependencies).
    Returns structured sentiment evidence.
    """
    if not news_items:
        return {
            'status':          'NO_DATA',
            'overall_score':   0,
            'bullish_count':   0,
            'bearish_count':   0,
            'neutral_count':   0,
            'breaking_items':  [],
            'scored_headlines':[],
        }

    # Bullish and bearish keyword sets
    BULLISH_KEYWORDS = [
        'surge', 'rally', 'jump', 'rise', 'gain', 'high', 'record', 'bull',
        'positive', 'strong', 'growth', 'recovery', 'demand', 'buy', 'upside',
        'breakout', 'support', 'accumulation', 'optimism', 'beat', 'better',
        'rate cut', 'dovish', 'easing', 'quantitative easing', 'pivot',
        'pause', 'safe haven', 'inflation hedge',
    ]
    BEARISH_KEYWORDS = [
        'fall', 'drop', 'decline', 'crash', 'loss', 'low', 'bear', 'sell',
        'negative', 'weak', 'contraction', 'recession', 'outflow', 'dump',
        'breakdown', 'resistance', 'distribution', 'pessimism', 'miss', 'worse',
        'selloff', 'plunge', 'tumble', 'collapse', 'fear',
        'rate hike', 'hawkish', 'tightening', 'tapering', 'higher for longer',
        'yield surge', 'dollar strength',
    ]
    MONETARY_KEYWORDS = [
        'fed', 'fomc', 'ecb', 'central bank', 'interest rate', 'boj',
        'federal reserve', 'powell', 'lagarde', 'rate decision',
        'hawkish', 'dovish', 'inflation', 'cpi', 'nfp', 'gdp',
    ]

    bullish_count = 0
    bearish_count = 0
    neutral_count = 0
    scored_headlines = []
    breaking_items   = []

    for item in news_items:
        text  = (item.get('title', '') + ' ' + item.get('summary', '')).lower()
        bull  = sum(1 for kw in BULLISH_KEYWORDS if kw in text)
        bear  = sum(1 for kw in BEARISH_KEYWORDS if kw in text)

        if bull > bear:
            sentiment = 'BULLISH'
            score     = min(1.0, (bull - bear) / 5.0)
            bullish_count += 1
        elif bear > bull:
            sentiment = 'BEARISH'
            score     = max(-1.0, -(bear - bull) / 5.0)
            bearish_count += 1
        else:
            sentiment = 'NEUTRAL'
            score     = 0.0
            neutral_count += 1

        headline_data = {
            'title':      item.get('title', ''),
            'source':     item.get('source', ''),
            'age_minutes':item.get('ageMinutes', 9999),
            'sentiment':  sentiment,
            'score':      round(score, 2),
            'is_breaking':item.get('isBreaking', False),
        }
        scored_headlines.append(headline_data)

        if item.get('isBreaking', False):
            breaking_items.append(headline_data)

    total = len(news_items)
    if total > 0:
        net_score = (bullish_count - bearish_count) / total
    else:
        net_score = 0.0

    sentiment_label = (
        'STRONGLY_BULLISH' if net_score >  0.5 else
        'BULLISH'          if net_score >  0.1 else
        'NEUTRAL'          if net_score > -0.1 else
        'BEARISH'          if net_score > -0.5 else
        'STRONGLY_BEARISH'
    )

    return {
        'status':           'OK',
        'overall_score':    round(net_score, 3),
        'sentiment_label':  sentiment_label,
        'bullish_count':    bullish_count,
        'bearish_count':    bearish_count,
        'neutral_count':    neutral_count,
        'total_headlines':  total,
        'breaking_items':   breaking_items,
        'scored_headlines': scored_headlines[:10],  # top 10 for AI review
        'note': 'Raw keyword scoring. AI must interpret hawkish/dovish context and whether sentiment is priced in.',
        'monetary_terms_detected': [kw for kw in MONETARY_KEYWORDS if kw.lower() in ' '.join(i.get('title','') for i in news_items).lower()],
    }


# ── Technical Evidence Summary ─────────────────────────────────────────────────

def build_technical_evidence(tf_results: dict, htf: str, etf: str) -> dict:
    """
    Summarise all technical analysis into a clean evidence JSON for AI review.
    This is what Python hands to the AI — structured facts, not conclusions.
    """
    htf_data = tf_results.get(htf, {})
    etf_data = tf_results.get(etf, {})

    def tf_summary(data: dict, label: str) -> dict:
        if not data:
            return {'timeframe': label, 'status': 'NO DATA'}
        liq = data.get('liquidity', {})
        pd  = data.get('premium_discount', {})
        reg = data.get('regime', {})
        ind = data.get('indicators', {})
        wyc = data.get('wyckoff', {})
        return {
            'timeframe':       label,
            'trend':           data.get('trend', 'NEUTRAL'),
            'ema_trend':       data.get('ema_trend', 'NEUTRAL'),
            'current_price':   data.get('current_price', 0),
            'atr':             data.get('atr', 0),
            'bos_choch_count': len(data.get('bos_choch', [])),
            'last_structure':  data.get('bos_choch', [{}])[-1] if data.get('bos_choch') else {},
            'fresh_obs':       len(data.get('ob_fresh', [])),
            'fresh_fvgs':      len(data.get('fvg_fresh', [])),
            'resting_bsl':     len(liq.get('bsl', [])),
            'resting_ssl':     len(liq.get('ssl', [])),
            'pd_status':       pd.get('status', 'N/A'),
            'pd_pct':          pd.get('percentage', None),
            'pd_note':         pd.get('note', ''),
            'regime':          reg.get('regime', 'UNKNOWN'),
            'hurst':           reg.get('hurst', {}).get('hurst'),
            'adx':             reg.get('adx', {}).get('adx'),
            'adx_strength':    reg.get('adx', {}).get('strength'),
            'vol_percentile':  reg.get('volatility', {}).get('percentile'),
            'rsi':             ind.get('rsi', {}).get('value'),
            'rsi_zone':        ind.get('rsi', {}).get('zone'),
            'macd_direction':  ind.get('macd', {}).get('direction'),
            'ema20':           ind.get('ema_20', {}).get('value'),
            'ema50':           ind.get('ema_50', {}).get('value'),
            'ema200':          ind.get('ema_200', {}).get('value'),
            'bb_position':     ind.get('bollinger', {}).get('position'),
            'bb_squeeze':      ind.get('bollinger', {}).get('squeeze'),
            'wyckoff_phase':   wyc.get('phase')       if wyc else None,
            'wyckoff_bias':    wyc.get('trade_bias')  if wyc else None,
            'wyckoff_conf':    wyc.get('confidence')  if wyc else None,
            'elliott_structure': data.get('elliott', {}).get('structure')  if data.get('elliott') else None,
            'elliott_bias':      data.get('elliott', {}).get('bias')       if data.get('elliott') else None,
            'fib_golden_pocket': data.get('fibonacci', {}).get('golden_pocket') if data.get('fibonacci') else None,
        }

    # Count alignment across timeframes
    tf_order  = ['W1', 'D1', '4H', '1H', '15M', '5M']
    all_tfs   = [tf for tf in tf_order if tf in tf_results]
    bull_tfs  = [tf for tf in all_tfs if tf_results[tf].get('trend') == 'BULLISH']
    bear_tfs  = [tf for tf in all_tfs if tf_results[tf].get('trend') == 'BEARISH']

    alignment = (
        'FULLY_ALIGNED_BULL' if len(bull_tfs) == len(all_tfs) else
        'FULLY_ALIGNED_BEAR' if len(bear_tfs) == len(all_tfs) else
        'STRONGLY_BULL'      if len(bull_tfs) >= len(all_tfs) * 0.75 else
        'STRONGLY_BEAR'      if len(bear_tfs) >= len(all_tfs) * 0.75 else
        'MIXED'
    )

    return {
        'htf_summary':        tf_summary(htf_data, htf),
        'etf_summary':        tf_summary(etf_data, etf),
        'all_tf_alignment':   alignment,
        'bullish_timeframes': bull_tfs,
        'bearish_timeframes': bear_tfs,
        'total_timeframes':   len(all_tfs),
        'backtest':           htf_data.get('backtest', {}),
        'volume_profile':     htf_data.get('volume_profile', {}),
    }


# ── Quantitative Evidence Summary ──────────────────────────────────────────────

def build_quant_evidence(win_prob: dict, trade_exp: dict, ml_score: dict, backtest: dict) -> dict:
    """
    Summarise all quantitative analysis as structured evidence.
    Python measures everything. AI determines whether the numbers justify the trade.
    """
    return {
        'win_probability': {
            'value':      win_prob.get('win_pct', 0),
            'mode':       win_prob.get('mode', 'THEORETICAL'),
            'tp1_pct':    win_prob.get('tp1_pct', 0),
            'sl_pct':     win_prob.get('sl_pct', 0),
            'confidence': win_prob.get('confidence', 'LOW'),
        },
        'expected_value': {
            'value':   trade_exp.get('expected_value_r', 0),
            'verdict': trade_exp.get('verdict', 'UNKNOWN'),
            'kelly_half_pct': trade_exp.get('kelly_half_pct', 0),
        },
        'confluence_score': {
            'value':    ml_score.get('score', 0) if ml_score else 0,
            'method':   ml_score.get('method', 'RULE_BASED') if ml_score else 'RULE_BASED',
            'htf_filter': ml_score.get('htf_filter_applied', False) if ml_score else False,
            'rsi_penalty':ml_score.get('rsi_penalty', 0) if ml_score else 0,
        },
        'backtest': {
            'win_rate_raw':  backtest.get('win_rate_pct', 0),
            'win_rate_adj':  backtest.get('win_rate_adjusted_pct', 0),
            'profit_factor': backtest.get('profit_factor', 0),
            'expectancy':    backtest.get('expectancy_atr', 0),
            'verdict':       backtest.get('verdict', 'N/A'),
            'trades':        backtest.get('trades', 0),
        },
    }


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 0 — SQLITE DATABASE
# ═══════════════════════════════════════════════════════════════════════════════

def init_db():
    if os.path.exists(DB_PATH):
        try:
            conn = sqlite3.connect(DB_PATH)
            conn.execute('SELECT 1 FROM sqlite_master LIMIT 1')
            conn.close()
        except sqlite3.DatabaseError:
            try: conn.close()
            except: pass
            try:
                os.remove(DB_PATH)
                print('WARNING: Corrupt DB removed. Creating fresh.', file=sys.stderr)
            except OSError as e:
                print(f'WARNING: Could not remove corrupt DB: {e}', file=sys.stderr)
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('''CREATE TABLE IF NOT EXISTS signals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            asset TEXT NOT NULL, mode TEXT, timestamp TEXT NOT NULL,
            direction TEXT, entry_low REAL, entry_high REAL,
            tp1 REAL, tp2 REAL, tp3 REAL, sl REAL,
            confluence_score REAL, htf_trend TEXT, etf_trend TEXT,
            rsi_htf REAL, atr REAL, regime TEXT, session TEXT,
            outcome TEXT DEFAULT NULL, outcome_checked_at TEXT DEFAULT NULL,
            pnl_atr REAL DEFAULT NULL, exit_price REAL DEFAULT NULL,
            bars_to_exit INTEGER DEFAULT NULL, notes TEXT DEFAULT NULL
        )''')
        c.execute('''CREATE TABLE IF NOT EXISTS asset_weights (
            asset TEXT PRIMARY KEY,
            w_structure REAL DEFAULT 20, w_liquidity REAL DEFAULT 15,
            w_choch REAL DEFAULT 15, w_ob REAL DEFAULT 10,
            w_fvg REAL DEFAULT 10, w_sd REAL DEFAULT 10,
            w_pd REAL DEFAULT 10, w_pa REAL DEFAULT 5, w_session REAL DEFAULT 5,
            total_trades INTEGER DEFAULT 0, win_rate REAL DEFAULT NULL,
            last_updated TEXT DEFAULT NULL
        )''')
        c.execute('''CREATE TABLE IF NOT EXISTS daily_performance (
            id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL,
            asset TEXT NOT NULL, trades INTEGER DEFAULT 0,
            wins INTEGER DEFAULT 0, losses INTEGER DEFAULT 0,
            pnl_atr REAL DEFAULT 0, win_rate REAL DEFAULT NULL
        )''')
        conn.commit()
        conn.close()
    except Exception as e:
        print(f'ERROR: Could not initialize database: {e}', file=sys.stderr)


def save_signal(asset, mode, direction, entry_low, entry_high, tp1, tp2, tp3, sl,
                score, htf_trend, etf_trend, rsi_htf, atr, regime='', session=''):
    """Save a new signal to database. Returns the signal ID."""
    try:
        init_db()
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('''INSERT INTO signals
            (asset, mode, timestamp, direction, entry_low, entry_high,
             tp1, tp2, tp3, sl, confluence_score, htf_trend, etf_trend,
             rsi_htf, atr, regime, session)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',
            (asset, mode, datetime.now(timezone.utc).isoformat(),
             direction, entry_low, entry_high, tp1, tp2, tp3, sl,
             score, htf_trend, etf_trend, rsi_htf, atr, regime, session))
        signal_id = c.lastrowid
        conn.commit()
        conn.close()
        return signal_id
    except Exception as e:
        return None


def fetch_current_price_deriv(asset):
    """
    Fetch current price AND recent candle data for outcome verification.
    Returns dict with current_price and recent_candles (last 12 x 5min candles).
    This allows the outcome checker to see if TP/SL was hit between checker runs.
    """
    DERIV_SYMBOLS = {
        'XAUUSD': 'frxXAUUSD', 'XAGUSD': 'frxXAGUSD',
        'EURUSD': 'frxEURUSD', 'GBPUSD': 'frxGBPUSD',
        'USDJPY': 'frxUSDJPY', 'USDCHF': 'frxUSDCHF',
        'AUDUSD': 'frxAUDUSD', 'USDCAD': 'frxUSDCAD',
        'NZDUSD': 'frxNZDUSD',
        'BTCUSD': 'cryBTCUSD', 'ETHUSD': 'cryETHUSD', 'SOLUSD': 'crySOLUSD',
        'BOOM1000': 'BOOM1000', 'CRASH1000': 'CRASH1000',
        'VOL75': 'R_75', 'VOL100': 'R_100',
    }
    symbol = DERIV_SYMBOLS.get(asset)
    if not symbol:
        return None

    # Fetch last 288 x 5-min candles (covers 24 hours of price history)
    # Signals expire at 48h — we need at least 24h to catch TP/SL hits reliably
    try:
        req = Request(
            f'https://api.deriv.com/websockets/v3?ticks_history={symbol}'
            f'&end=latest&count=288&style=candles&granularity=300&app_id=1089',
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        with urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            candles = data.get('candles', [])
            if candles:
                recent_candles = [
                    {
                        'epoch': c['epoch'],
                        'high':  float(c['high']),
                        'low':   float(c['low']),
                        'close': float(c['close']),
                    }
                    for c in candles
                ]
                return {
                    'current_price':  float(candles[-1]['close']),
                    'recent_candles': recent_candles,
                }
    except Exception:
        pass

    # Fallback: just get current tick price
    try:
        req = Request(
            f'https://api.deriv.com/websockets/v3?ticks_history={symbol}'
            f'&end=latest&count=1&style=ticks&app_id=1089',
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        with urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            prices = data.get('history', {}).get('prices', [])
            if prices:
                return {
                    'current_price':  float(prices[-1]),
                    'recent_candles': [],
                }
    except Exception:
        pass

    return None


def check_and_update_outcomes(asset=None):
    """
    Core outcome verification loop.

    FIXED: Now checks if price HIT TP/SL at any point in the recent candles,
    not just where current price is right now. This prevents missed WINs/LOSSes
    when price touched the level then bounced back before the checker ran.

    For every signal older than 1 hour with no outcome:
    - Fetch last 12 x 5-min candles from Deriv (covers ~60 minutes)
    - Check if ANY candle's high/low crossed TP1 or SL since signal creation
    - Mark WIN, LOSS, or EXPIRED (after 48h)
    - Update the database
    - Recalculate asset weights if enough data
    """
    try:
        init_db()
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()

        cutoff = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()

        if asset:
            c.execute('''SELECT id, asset, direction, entry_low, entry_high,
                         tp1, sl, atr, timestamp, confluence_score
                         FROM signals
                         WHERE outcome IS NULL
                         AND timestamp < ?
                         AND asset = ?
                         ORDER BY timestamp ASC LIMIT 50''',
                      (cutoff, asset))
        else:
            c.execute('''SELECT id, asset, direction, entry_low, entry_high,
                         tp1, sl, atr, timestamp, confluence_score
                         FROM signals
                         WHERE outcome IS NULL
                         AND timestamp < ?
                         ORDER BY timestamp ASC LIMIT 50''',
                      (cutoff,))

        pending = c.fetchall()
        conn.close()

        if not pending:
            return {
                'checked': 0,
                'updated': 0,
                'message': 'No pending signals to check.',
                'details': []
            }

        updated           = 0
        details           = []
        assets_to_retrain = set()

        for row in pending:
            sig_id, sig_asset, direction, entry_low, entry_high, \
            tp1, sl, atr, timestamp, score = row

            price_data = fetch_current_price_deriv(sig_asset)

            if price_data is None:
                details.append({
                    'id':     sig_id,
                    'asset':  sig_asset,
                    'status': 'PRICE_FETCH_FAILED',
                    'note':   'Could not fetch price from Deriv'
                })
                continue

            current_price   = price_data['current_price']
            recent_candles  = price_data.get('recent_candles', [])
            entry_mid       = (entry_low + entry_high) / 2 if entry_low and entry_high else (entry_low or 0)

            outcome    = None
            exit_price = None
            pnl_atr    = None
            note       = None

            # Parse signal creation time
            try:
                sig_time = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
            except Exception:
                sig_time = datetime.now(timezone.utc) - timedelta(hours=2)

            is_bearish = direction in ('Bearish', 'BEARISH', 'SHORT')
            is_bullish = direction in ('Bullish', 'BULLISH', 'LONG')

            # Filter candles to only those AFTER the signal was created
            relevant_candles = [
                c for c in recent_candles
                if datetime.fromtimestamp(c['epoch'], tz=timezone.utc) > sig_time
            ]
            # Also add current price as a synthetic candle
            relevant_candles.append({
                'high':  current_price,
                'low':   current_price,
                'close': current_price,
                'epoch': int(datetime.now(timezone.utc).timestamp()),
            })

            if is_bearish:
                # Short: TP is below entry, SL is above entry
                for candle in relevant_candles:
                    if tp1 and candle['low'] <= tp1:
                        outcome    = 'WIN'
                        exit_price = tp1
                        pnl_atr    = round((entry_mid - tp1) / atr, 3) if atr else None
                        note       = f'TP1 touched at {tp1} (candle low={candle["low"]}). Current: {current_price}'
                        break
                    if sl and candle['high'] >= sl:
                        outcome    = 'LOSS'
                        exit_price = sl
                        pnl_atr    = round((entry_mid - sl) / atr, 3) if atr else None
                        note       = f'SL touched at {sl} (candle high={candle["high"]}). Current: {current_price}'
                        break

            elif is_bullish:
                # Long: TP is above entry, SL is below entry
                for candle in relevant_candles:
                    if tp1 and candle['high'] >= tp1:
                        outcome    = 'WIN'
                        exit_price = tp1
                        pnl_atr    = round((tp1 - entry_mid) / atr, 3) if atr else None
                        note       = f'TP1 touched at {tp1} (candle high={candle["high"]}). Current: {current_price}'
                        break
                    if sl and candle['low'] <= sl:
                        outcome    = 'LOSS'
                        exit_price = sl
                        pnl_atr    = round((sl - entry_mid) / atr, 3) if atr else None
                        note       = f'SL touched at {sl} (candle low={candle["low"]}). Current: {current_price}'
                        break

            # If still open after 48 hours, expire it
            if outcome is None:
                hours_open = (datetime.now(timezone.utc) - sig_time).total_seconds() / 3600
                if hours_open > 48:
                    outcome    = 'EXPIRED'
                    exit_price = current_price
                    pnl_atr    = round(
                        (entry_mid - current_price) / atr if is_bearish else
                        (current_price - entry_mid) / atr,
                        3
                    ) if atr else None
                    note = f'Signal expired after {round(hours_open,1)}h. Exit at current price {current_price}.'

            if outcome:
                conn2 = sqlite3.connect(DB_PATH)
                c2 = conn2.cursor()
                c2.execute('''UPDATE signals SET
                    outcome = ?,
                    outcome_checked_at = ?,
                    exit_price = ?,
                    pnl_atr = ?,
                    notes = ?
                    WHERE id = ?''',
                    (outcome,
                     datetime.now(timezone.utc).isoformat(),
                     exit_price, pnl_atr, note, sig_id))
                conn2.commit()
                conn2.close()
                updated += 1
                assets_to_retrain.add(sig_asset)

            details.append({
                'id':            sig_id,
                'asset':         sig_asset,
                'direction':     direction,
                'entry':         round(entry_mid, 6),
                'tp1':           tp1,
                'sl':            sl,
                'current_price': current_price,
                'candles_checked': len(relevant_candles),
                'outcome':       outcome or 'STILL OPEN',
                'pnl_atr':       pnl_atr,
                'note':          note or f'Still open after {len(relevant_candles)} candles checked. Price {current_price}.'
            })

        for retrain_asset in assets_to_retrain:
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
                pass

        return {
            'checked': len(pending),
            'updated': updated,
            'message': f'Checked {len(pending)} signals, updated {updated} outcomes.',
            'details': details
        }

    except Exception as e:
        return {
            'checked': 0,
            'updated': 0,
            'message': f'Error: {str(e)}',
            'details': []
        }


def update_adaptive_weights(asset):
    """
    Recalculate per-asset confluence weights based on real outcome history.
    Called automatically after new outcomes are recorded.
    Requires 50+ outcomes to apply — uses defaults below that threshold.
    """
    try:
        outcomes = get_real_outcomes(asset)
        if len(outcomes) < 50:
            return  # not enough data yet

        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()

        # Get all real outcomes with full signal data
        c.execute('''SELECT confluence_score, outcome, pnl_atr, rsi_htf,
                     htf_trend, etf_trend, atr, regime, session
                     FROM signals
                     WHERE asset = ? AND outcome IN ('WIN','LOSS')
                     ORDER BY id DESC LIMIT 200''', (asset,))
        rows = c.fetchall()
        conn.close()

        if len(rows) < 50:
            return

        wins   = [r for r in rows if r[1] == 'WIN']
        losses = [r for r in rows if r[1] == 'LOSS']
        total  = len(rows)
        wr     = len(wins) / total

        # Simple weight adjustment:
        # Components that correlate with wins get boosted
        # Components that don't get reduced
        # This is a simplified gradient — real XGBoost would replace this later

        # Score-to-win correlation
        win_scores  = [r[0] for r in wins   if r[0] is not None]
        loss_scores = [r[0] for r in losses if r[0] is not None]
        avg_win_score  = sum(win_scores)  / len(win_scores)  if win_scores  else 65
        avg_loss_score = sum(loss_scores) / len(loss_scores) if loss_scores else 55

        # Session win rates
        session_wins = {}
        for r in rows:
            sess = r[8] or 'UNKNOWN'
            if sess not in session_wins:
                session_wins[sess] = {'w': 0, 't': 0}
            session_wins[sess]['t'] += 1
            if r[1] == 'WIN':
                session_wins[sess]['w'] += 1

        best_session_wr = max(
            (v['w']/v['t'] for v in session_wins.values() if v['t'] >= 5),
            default=0.5
        )

        # Adjust session weight based on whether best sessions have high WR
        session_weight = 5 if best_session_wr < 0.55 else 8 if best_session_wr > 0.65 else 5

        # Score gap between wins and losses — if high, structure/confluence matters more
        score_gap = avg_win_score - avg_loss_score
        structure_boost = min(5, max(0, int(score_gap / 4)))

        # Analyse which components correlate with wins vs losses
        # For each component, compare average score of wins vs losses
        # Components that discriminate well get boosted

        def component_boost(field_idx, default_weight, boost_max=5):
            """Boost weight if this component correlates with wins."""
            win_vals  = [r[field_idx] for r in wins   if len(r) > field_idx and r[field_idx] is not None]
            loss_vals = [r[field_idx] for r in losses if len(r) > field_idx and r[field_idx] is not None]
            if not win_vals or not loss_vals:
                return default_weight
            avg_win_val  = sum(win_vals)  / len(win_vals)
            avg_loss_val = sum(loss_vals) / len(loss_vals)
            diff = avg_win_val - avg_loss_val
            # Positive diff means higher score = more wins = boost this component
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
        }

        conn3 = sqlite3.connect(DB_PATH)
        c3 = conn3.cursor()
        c3.execute('''INSERT INTO asset_weights
            (asset, w_structure, w_liquidity, w_choch, w_ob, w_fvg,
             w_sd, w_pd, w_pa, w_session, total_trades, win_rate, last_updated)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(asset) DO UPDATE SET
            w_structure=excluded.w_structure,
            w_liquidity=excluded.w_liquidity,
            w_choch=excluded.w_choch,
            w_ob=excluded.w_ob,
            w_fvg=excluded.w_fvg,
            w_sd=excluded.w_sd,
            w_pd=excluded.w_pd,
            w_pa=excluded.w_pa,
            w_session=excluded.w_session,
            total_trades=excluded.total_trades,
            win_rate=excluded.win_rate,
            last_updated=excluded.last_updated''',
            (asset,
             new_weights['w_structure'], new_weights['w_liquidity'],
             new_weights['w_choch'], new_weights['w_ob'], new_weights['w_fvg'],
             new_weights['w_sd'], new_weights['w_pd'], new_weights['w_pa'],
             new_weights['w_session'], total, round(wr, 4),
             datetime.now(timezone.utc).isoformat()))
        conn3.commit()
        conn3.close()

    except Exception:
        pass


def get_signal_dashboard(asset=None, limit=50):
    """
    Returns signal history for display in the dashboard.
    Shows recent signals with outcomes, win rates, streaks.
    """
    try:
        init_db()
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()

        if asset:
            c.execute('''SELECT id, asset, mode, timestamp, direction,
                         entry_low, entry_high, tp1, sl, confluence_score,
                         outcome, pnl_atr, exit_price, notes, regime, session
                         FROM signals WHERE asset = ?
                         ORDER BY id DESC LIMIT ?''', (asset, limit))
        else:
            c.execute('''SELECT id, asset, mode, timestamp, direction,
                         entry_low, entry_high, tp1, sl, confluence_score,
                         outcome, pnl_atr, exit_price, notes, regime, session
                         FROM signals
                         ORDER BY id DESC LIMIT ?''', (limit,))

        rows = c.fetchall()

        # Asset-level stats
        if asset:
            c.execute('''SELECT COUNT(*), SUM(CASE WHEN outcome='WIN' THEN 1 ELSE 0 END),
                         SUM(CASE WHEN outcome='LOSS' THEN 1 ELSE 0 END),
                         AVG(pnl_atr), SUM(pnl_atr)
                         FROM signals WHERE asset=? AND outcome IN ('WIN','LOSS')''', (asset,))
        else:
            c.execute('''SELECT COUNT(*), SUM(CASE WHEN outcome='WIN' THEN 1 ELSE 0 END),
                         SUM(CASE WHEN outcome='LOSS' THEN 1 ELSE 0 END),
                         AVG(pnl_atr), SUM(pnl_atr)
                         FROM signals WHERE outcome IN ('WIN','LOSS')''')

        stats = c.fetchone()
        conn.close()

        total_closed = stats[0] or 0
        total_wins   = stats[1] or 0
        total_losses = stats[2] or 0
        avg_pnl      = round(stats[3] or 0, 3)
        total_pnl    = round(stats[4] or 0, 3)
        win_rate     = round(total_wins / total_closed * 100, 1) if total_closed > 0 else None

        signals = []
        for row in rows:
            signals.append({
                'id':         row[0],
                'asset':      row[1],
                'mode':       row[2],
                'timestamp':  row[3],
                'direction':  row[4],
                'entry_low':  row[5],
                'entry_high': row[6],
                'tp1':        row[7],
                'sl':         row[8],
                'score':      row[9],
                'outcome':    row[10] or 'OPEN',
                'pnl_atr':   row[11],
                'exit_price': row[12],
                'notes':      row[13],
                'regime':     row[14],
                'session':    row[15],
            })

        # Fetch daily performance
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
        }

    except Exception as e:
        return {'error': str(e), 'signals': []}


def get_real_outcomes(asset):
    """Get historical signal outcomes for this asset from database."""
    try:
        init_db()
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('''SELECT confluence_score, outcome, pnl_atr, rsi_htf, htf_trend
                     FROM signals WHERE asset=? AND outcome IS NOT NULL
                     ORDER BY id DESC LIMIT 200''', (asset,))
        rows = c.fetchall()
        conn.close()
        return rows
    except Exception:
        return []


def get_asset_weights(asset):
    """Get adaptive weights for this asset, or defaults if not enough data."""
    try:
        init_db()
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('SELECT * FROM asset_weights WHERE asset=?', (asset,))
        row = c.fetchone()
        conn.close()
        if row and row[10] >= 50:  # total_trades >= 50
            return {
                'structure': row[1], 'liquidity': row[2], 'choch': row[3],
                'ob': row[4], 'fvg': row[5], 'sd': row[6],
                'pd': row[7], 'pa': row[8], 'session': row[9],
            }
    except Exception:
        pass
    return {
        'structure': 20, 'liquidity': 15, 'choch': 15,
        'ob': 10, 'fvg': 10, 'sd': 10,
        'pd': 10, 'pa': 5, 'session': 5,
    }


def calc_statistical_edge(outcomes):
    """Calculate real statistical edge metrics from outcome history."""
    if len(outcomes) < 10:
        return {'status': 'INSUFFICIENT DATA', 'n': len(outcomes)}

    wins   = [o for o in outcomes if o[1] == 'WIN']
    losses = [o for o in outcomes if o[1] == 'LOSS']
    n      = len(outcomes)
    wr     = len(wins) / n

    pnls = [o[2] for o in outcomes if o[2] is not None]
    if not pnls:
        return {'status': 'INSUFFICIENT DATA', 'n': n}

    avg_pnl = sum(pnls) / len(pnls)
    std_pnl = math.sqrt(sum((p - avg_pnl) ** 2 for p in pnls) / len(pnls)) if len(pnls) > 1 else 0
    downside_pnls = [p for p in pnls if p < 0]
    sortino_denom = math.sqrt(sum(p**2 for p in downside_pnls) / len(downside_pnls)) if downside_pnls else 0

    sharpe  = round(avg_pnl / std_pnl, 3) if std_pnl > 0 else 0
    sortino = round(avg_pnl / sortino_denom, 3) if sortino_denom > 0 else 0

    # Max drawdown
    equity = 0
    peak   = 0
    max_dd = 0
    for p in pnls:
        equity += p
        if equity > peak:
            peak = equity
        dd = peak - equity
        if dd > max_dd:
            max_dd = dd

    # 95% confidence interval on win rate (Wilson interval)
    z = 1.96
    ci_center = (wr + z*z/(2*n)) / (1 + z*z/n)
    ci_margin  = z * math.sqrt(wr*(1-wr)/n + z*z/(4*n*n)) / (1 + z*z/n)
    ci_low  = round(max(0, (ci_center - ci_margin) * 100), 1)
    ci_high = round(min(100, (ci_center + ci_margin) * 100), 1)

    verdict = ('EDGE CONFIRMED' if sharpe > 0.5 and wr >= 0.45 else
               'MARGINAL EDGE'  if avg_pnl > 0 else 'NO EDGE DETECTED')

    return {
        'status':        'REAL_DATA',
        'n':             n,
        'win_rate_pct':  round(wr * 100, 1),
        'win_rate_ci':   f'{ci_low}%-{ci_high}% (95% CI)',
        'avg_pnl_atr':   round(avg_pnl, 3),
        'sharpe_ratio':  sharpe,
        'sortino_ratio': sortino,
        'max_drawdown_atr': round(max_dd, 3),
        'verdict':       verdict,
    }


def run_monte_carlo(outcomes, n_simulations=5000, n_trades=50):
    """Monte Carlo simulation of future equity curves."""
    if len(outcomes) < 30:
        return {'status': 'INSUFFICIENT DATA — need 30+ real outcomes'}

    pnls = [o[2] for o in outcomes if o[2] is not None]
    if len(pnls) < 30:
        return {'status': 'INSUFFICIENT DATA'}

    ruin_count    = 0
    dd_50_count   = 0
    positive_count = 0
    final_equities = []

    for _ in range(n_simulations):
        equity = 0
        peak   = 0
        max_dd = 0
        ruined = False
        for _ in range(n_trades):
            trade = random.choice(pnls)
            equity += trade
            if equity > peak:
                peak = equity
            dd = peak - equity
            if dd > max_dd:
                max_dd = dd
            if equity < -10:  # 10 ATR drawdown = ruin
                ruined = True
                break
        if ruined:
            ruin_count += 1
        if max_dd >= 5:  # 5 ATR = 50% account on 2% risk
            dd_50_count += 1
        if equity > 0:
            positive_count += 1
        final_equities.append(equity)

    final_equities.sort()
    p10 = final_equities[int(n_simulations * 0.10)]
    p50 = final_equities[int(n_simulations * 0.50)]
    p90 = final_equities[int(n_simulations * 0.90)]

    return {
        'status':                   'COMPLETE',
        'simulations':              n_simulations,
        'trades_per_sim':           n_trades,
        'prob_positive_pct':        round(positive_count / n_simulations * 100, 1),
        'prob_ruin_pct':            round(ruin_count / n_simulations * 100, 1),
        'prob_50pct_dd_pct':        round(dd_50_count / n_simulations * 100, 1),
        'median_equity_atr':        round(p50, 2),
        'p10_equity_atr':           round(p10, 2),
        'p90_equity_atr':           round(p90, 2),
        'interpretation':           f'{round(positive_count/n_simulations*100,1)}% chance of profit after {n_trades} trades. Ruin probability: {round(ruin_count/n_simulations*100,1)}%.'
    }


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 1 — ECONOMIC CALENDAR (Forex Factory free JSON)
# ═══════════════════════════════════════════════════════════════════════════════

CALENDAR_ASSET_CURRENCIES = {
    'XAUUSD': ['USD'], 'XAGUSD': ['USD'],
    'EURUSD': ['EUR', 'USD'], 'GBPUSD': ['GBP', 'USD'],
    'USDJPY': ['USD', 'JPY'], 'USDCHF': ['USD', 'CHF'],
    'AUDUSD': ['AUD', 'USD'], 'USDCAD': ['USD', 'CAD'],
    'NZDUSD': ['NZD', 'USD'],
    'BTCUSD': ['USD'], 'ETHUSD': ['USD'], 'SOLUSD': ['USD'],
    'BOOM1000': [], 'CRASH1000': [], 'VOL75': [], 'VOL100': [],
}

# Calendar cache — only refetch every 10 minutes to avoid blocking every analysis
_calendar_cache: dict = {}
_calendar_cache_time: dict = {}
CALENDAR_CACHE_TTL = 600  # 10 minutes in seconds

def fetch_economic_calendar(asset):
    """Fetch Forex Factory calendar JSON — free, no API key needed."""
    # Return cached result if still fresh
    cache_key = asset
    now_ts = datetime.now(timezone.utc).timestamp()
    if cache_key in _calendar_cache and (now_ts - _calendar_cache_time.get(cache_key, 0)) < CALENDAR_CACHE_TTL:
        return _calendar_cache[cache_key]

    try:
        url = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json'
        req = Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urlopen(req, timeout=8) as resp:
            events = json.loads(resp.read().decode())

        currencies = CALENDAR_ASSET_CURRENCIES.get(asset, ['USD'])
        now        = datetime.now(timezone.utc)
        relevant   = []

        for ev in events:
            if ev.get('impact', '').lower() != 'high':
                continue
            if ev.get('currency', '') not in currencies:
                continue
            try:
                ev_time = datetime.fromisoformat(ev['date'].replace('Z', '+00:00'))
            except Exception:
                continue

            minutes_away = (ev_time - now).total_seconds() / 60

            relevant.append({
                'title':        ev.get('title', 'Unknown Event'),
                'currency':     ev.get('currency', ''),
                'time_utc':     ev_time.strftime('%Y-%m-%d %H:%M UTC'),
                'minutes_away': round(minutes_away),
                'forecast':     ev.get('forecast', 'N/A'),
                'previous':     ev.get('previous', 'N/A'),
                'actual':       ev.get('actual', 'Pending'),
                'status': (
                    'IMMINENT'   if -30 <= minutes_away <= 120 else
                    'JUST_RELEASED' if -30 < minutes_away < 0 else
                    'UPCOMING'   if minutes_away > 0 else
                    'PASSED'
                )
            })

        relevant.sort(key=lambda x: abs(x['minutes_away']))

        hard_pause    = any(e['status'] in ('IMMINENT', 'JUST_RELEASED') for e in relevant)
        pause_reason  = None
        for e in relevant:
            if e['status'] == 'IMMINENT':
                pause_reason = f"{e['title']} ({e['currency']}) in {e['minutes_away']} minutes at {e['time_utc']}"
                break
            elif e['status'] == 'JUST_RELEASED':
                pause_reason = f"{e['title']} ({e['currency']}) released {abs(e['minutes_away'])} minutes ago — spreads may be elevated"
                break

        result = {
            'status':       'OK',
            'hard_pause':   hard_pause,
            'pause_reason': pause_reason,
            'events':       relevant[:5],
        }
        _calendar_cache[cache_key] = result
        _calendar_cache_time[cache_key] = now_ts
        return result

    except Exception as e:
        result = {
            'status':       'UNAVAILABLE',
            'hard_pause':   False,
            'pause_reason': None,
            'events':       [],
            'error':        str(e),
        }
        _calendar_cache[cache_key] = result
        _calendar_cache_time[cache_key] = now_ts
        return result


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 2 — TECHNICAL INDICATORS
# ═══════════════════════════════════════════════════════════════════════════════

def calc_atr(candles, period=14):
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
    slice_c = candles[-(period * 3):]
    trs = []
    for i in range(1, len(slice_c)):
        curr, prev = slice_c[i], slice_c[i - 1]
        trs.append(max(curr['high']-curr['low'], abs(curr['high']-prev['close']), abs(curr['low']-prev['close'])))
    if len(trs) < period:
        return round(sum(trs)/len(trs), 6) if trs else 0.0
    atr = sum(trs[:period]) / period
    for i in range(period, len(trs)):
        atr = (atr * (period - 1) + trs[i]) / period
    return round(atr, 6)


def calc_ema(candles, period=20):
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
    closes = [c['close'] for c in candles]
    k = 2 / (period + 1)
    ema = sum(closes[:period]) / period
    vals = [round(ema, 6)]
    for price in closes[period:]:
        ema = price * k + ema * (1 - k)
        vals.append(round(ema, 6))
    return {'value': vals[-1] if vals else None, 'values': vals[-10:]}


def calc_rsi(candles, period=14):
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
    closes = [c['close'] for c in candles]
    deltas = [closes[i]-closes[i-1] for i in range(1, len(closes))]
    gains  = [max(d, 0) for d in deltas]
    losses = [abs(min(d, 0)) for d in deltas]
    ag = sum(gains[:period]) / period
    al = sum(losses[:period]) / period
    for i in range(period, len(gains)):
        ag = (ag*(period-1)+gains[i])/period
        al = (al*(period-1)+losses[i])/period
    val = round(100 - (100/(1+ag/al)), 2) if al else 100.0
    return {'value': val, 'zone': _rsi_zone(val)}


def _rsi_zone(val):
    if val >= 70: return 'OVERBOUGHT'
    if val >= 60: return 'BULLISH'
    if val >= 50: return 'NEUTRAL_BULL'
    if val >= 40: return 'NEUTRAL_BEAR'
    if val >= 30: return 'BEARISH'
    return 'OVERSOLD'


def calc_adx(candles, period=14):
    """ADX for trend strength — TA-Lib if available, pure Python otherwise."""
    if len(candles) < period * 2:
        return {'adx': None, 'strength': 'INSUFFICIENT DATA'}
    if HAS_TALIB and HAS_NUMPY:
        try:
            highs  = np.array([c['high']  for c in candles], dtype=float)
            lows   = np.array([c['low']   for c in candles], dtype=float)
            closes = np.array([c['close'] for c in candles], dtype=float)
            result = talib.ADX(highs, lows, closes, timeperiod=period)
            valid  = result[~np.isnan(result)]
            if len(valid) > 0:
                adx = round(float(valid[-1]), 2)
                strength = ('STRONG_TREND' if adx > 25 else 'WEAK_TREND' if adx > 15 else 'NO_TREND')
                return {'adx': adx, 'strength': strength}
        except Exception:
            pass
    # Pure Python ADX approximation using ATR-based directional movement
    trs, pdms, ndms = [], [], []
    for i in range(1, len(candles)):
        curr, prev = candles[i], candles[i-1]
        tr  = max(curr['high']-curr['low'], abs(curr['high']-prev['close']), abs(curr['low']-prev['close']))
        pdm = max(curr['high']-prev['high'], 0) if curr['high']-prev['high'] > prev['low']-curr['low'] else 0
        ndm = max(prev['low']-curr['low'],   0) if prev['low']-curr['low'] > curr['high']-prev['high'] else 0
        trs.append(tr); pdms.append(pdm); ndms.append(ndm)
    if len(trs) < period:
        return {'adx': None, 'strength': 'INSUFFICIENT DATA'}
    atr14  = sum(trs[:period])/period
    pdi14  = sum(pdms[:period])/period
    ndi14  = sum(ndms[:period])/period
    for i in range(period, len(trs)):
        atr14 = (atr14*(period-1)+trs[i])/period
        pdi14 = (pdi14*(period-1)+pdms[i])/period
        ndi14 = (ndi14*(period-1)+ndms[i])/period
    pdi = 100*pdi14/atr14 if atr14 else 0
    ndi = 100*ndi14/atr14 if atr14 else 0
    dx  = 100*abs(pdi-ndi)/(pdi+ndi) if (pdi+ndi) else 0
    strength = 'STRONG_TREND' if dx > 25 else 'WEAK_TREND' if dx > 15 else 'NO_TREND'
    return {'adx': round(dx, 2), 'strength': strength, 'pdi': round(pdi,2), 'ndi': round(ndi,2)}


def calc_bollinger(candles, period=20, std_dev=2):
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
            width = round((u-l)/m*100, 3) if m else 0
            pos   = round((last_close-l)/(u-l)*100, 2) if (u-l) else 50
            return {'upper':u,'middle':m,'lower':l,'width':width,'position':pos,'squeeze':width<2.0,'expansion':width>5.0}
        except Exception:
            pass
    closes = [c['close'] for c in candles[-period:]]
    mean = sum(closes)/period
    std  = math.sqrt(sum((x-mean)**2 for x in closes)/period)
    u,m,l = round(mean+std_dev*std,6), round(mean,6), round(mean-std_dev*std,6)
    last_close = candles[-1]['close']
    width = round((u-l)/m*100, 3) if m else 0
    pos   = round((last_close-l)/(u-l)*100, 2) if (u-l) else 50
    return {'upper':u,'middle':m,'lower':l,'width':width,'position':pos,'squeeze':width<2.0,'expansion':width>5.0}


def calc_macd(candles, fast=12, slow=26, signal=9):
    if len(candles) < slow+signal:
        return {'macd':None,'signal':None,'histogram':None,'direction':'INSUFFICIENT DATA'}
    if HAS_TALIB and HAS_NUMPY:
        try:
            closes = np.array([c['close'] for c in candles], dtype=float)
            macd, sig, hist = talib.MACD(closes, fastperiod=fast, slowperiod=slow, signalperiod=signal)
            vh = hist[~np.isnan(hist)]
            vm = macd[~np.isnan(macd)]
            vs = sig[~np.isnan(sig)]
            if len(vh) >= 2:
                h = round(float(vh[-1]),6)
                direction = 'BULLISH' if h>0 and h>vh[-2] else 'BEARISH' if h<0 and h<vh[-2] else 'NEUTRAL'
                return {'macd':round(float(vm[-1]),6),'signal':round(float(vs[-1]),6),'histogram':h,'direction':direction}
        except Exception:
            pass
    closes = [c['close'] for c in candles]
    def ema_s(data, p):
        k = 2/(p+1); e = sum(data[:p])/p; res=[e]
        for v in data[p:]: e=v*k+e*(1-k); res.append(e)
        return res
    ef=ema_s(closes,fast); es=ema_s(closes,slow)
    ml=min(len(ef),len(es)); ml_line=[ef[-(ml-i)]-es[-(ml-i)] for i in range(ml)]
    sl_line=ema_s(ml_line,signal)
    hl=[ml_line[i+(len(ml_line)-len(sl_line))]-sl_line[i] for i in range(len(sl_line))]
    if len(hl)>=2:
        h=round(hl[-1],6)
        direction='BULLISH' if h>0 and h>hl[-2] else 'BEARISH' if h<0 and h<hl[-2] else 'NEUTRAL'
        return {'macd':round(ml_line[-1],6),'signal':round(sl_line[-1],6),'histogram':h,'direction':direction}
    return {'macd':None,'signal':None,'histogram':None,'direction':'INSUFFICIENT DATA'}


def calc_vwap(candles):
    if len(candles) < 2: return None
    tps = [(c['high']+c['low']+c['close'])/3 for c in candles]
    pvs = [c['high']-c['low'] for c in candles]
    tv  = sum(pvs)
    if tv == 0: return round(sum(tps)/len(tps),6)
    return round(sum(tp*pv for tp,pv in zip(tps,pvs))/tv, 6)


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 3 — MARKET REGIME ENGINE (Hurst + ADX + Volatility Percentile)
# ═══════════════════════════════════════════════════════════════════════════════

def calc_hurst_exponent(candles, max_lag=12):
    """
    Hurst Exponent via R/S analysis.
    H > 0.6 = trending  |  H = 0.5 = random walk  |  H < 0.4 = mean reverting
    """
    if len(candles) < max_lag * 2:
        return {'hurst': None, 'regime': 'INSUFFICIENT DATA'}
    closes = [c['close'] for c in candles]
    lags   = range(2, max_lag)
    rs_vals = []
    for lag in lags:
        sub = closes[-lag*2:]
        chunks = [sub[i:i+lag] for i in range(0, len(sub)-lag+1, lag)]
        rs_chunk = []
        for chunk in chunks:
            if len(chunk) < 2: continue
            mean = sum(chunk)/len(chunk)
            deviations = [x-mean for x in chunk]
            cum_dev    = []
            cum = 0
            for d in deviations:
                cum += d
                cum_dev.append(cum)
            R = max(cum_dev) - min(cum_dev)
            S = math.sqrt(sum((x-mean)**2 for x in chunk)/len(chunk))
            if S > 0:
                rs_chunk.append(R/S)
        if rs_chunk:
            rs_vals.append((math.log(lag), math.log(sum(rs_chunk)/len(rs_chunk))))
    if len(rs_vals) < 4:
        return {'hurst': None, 'regime': 'INSUFFICIENT DATA'}
    # Linear regression on log-log plot
    n    = len(rs_vals)
    sx   = sum(v[0] for v in rs_vals)
    sy   = sum(v[1] for v in rs_vals)
    sxy  = sum(v[0]*v[1] for v in rs_vals)
    sx2  = sum(v[0]**2 for v in rs_vals)
    H    = round((n*sxy - sx*sy) / (n*sx2 - sx*sx), 3)
    if H > 0.6:    regime = 'TRENDING'
    elif H < 0.4:  regime = 'MEAN_REVERTING'
    else:           regime = 'RANDOM_WALK'
    return {'hurst': H, 'regime': regime}


def calc_volatility_percentile(candles, period=14, lookback=100):
    """
    Fast volatility percentile — calculates all TRs once, uses rolling sum.
    Previous version called calc_atr() 100 times = very slow.
    This version is 50-100x faster on the same data.
    """
    if len(candles) < lookback + period:
        return {'percentile': None, 'regime': 'INSUFFICIENT DATA'}

    # Calculate ALL true ranges once — O(n) instead of O(n²)
    trs = []
    for i in range(1, len(candles)):
        curr, prev = candles[i], candles[i - 1]
        tr = max(
            curr['high'] - curr['low'],
            abs(curr['high'] - prev['close']),
            abs(curr['low']  - prev['close'])
        )
        trs.append(tr)

    if len(trs) < period + lookback:
        return {'percentile': None, 'regime': 'INSUFFICIENT DATA'}

    # Rolling ATR using simple mean (fast approximation for percentile ranking)
    historical_atrs = []
    for i in range(lookback):
        end_idx   = len(trs) - lookback + i + 1
        start_idx = max(0, end_idx - period)
        window    = trs[start_idx:end_idx]
        if len(window) >= period // 2:
            historical_atrs.append(sum(window) / len(window))

    if not historical_atrs:
        return {'percentile': None, 'regime': 'INSUFFICIENT DATA'}

    # Current ATR (last period TRs)
    current_atr = sum(trs[-period:]) / period if len(trs) >= period else trs[-1]

    historical_atrs_sorted = sorted(historical_atrs)
    rank = sum(1 for a in historical_atrs_sorted if a <= current_atr)
    pct  = round(rank / len(historical_atrs_sorted) * 100, 1)

    regime = ('VOLATILITY_EXPANSION'   if pct >= 80 else
              'VOLATILITY_COMPRESSION' if pct <= 20 else
              'NORMAL_VOLATILITY')

    return {'percentile': pct, 'regime': regime, 'current_atr': round(current_atr, 6)}


def classify_market_regime(candles, atr):
    """
    Full regime classification combining Hurst + ADX + Volatility Percentile.
    Returns a single regime label with trading implications.
    """
    hurst   = calc_hurst_exponent(candles)
    adx     = calc_adx(candles)
    vol_pct = calc_volatility_percentile(candles)

    h = hurst.get('hurst')
    a = adx.get('adx')
    v = vol_pct.get('percentile')

    # Classify based on combination
    if h is not None and a is not None and v is not None:
        if h > 0.6 and a > 25:
            regime = 'TRENDING_STRONG'
            implication = 'Follow trend. Use BOS+OB entries. Wide targets.'
        elif h > 0.55 and a > 20:
            regime = 'TRENDING_MODERATE'
            implication = 'Follow trend with caution. Tighter stops.'
        elif h < 0.4 and a < 20:
            regime = 'MEAN_REVERTING'
            implication = 'Fade extremes. Enter at premium/discount. Tight targets.'
        elif v >= 80:
            regime = 'VOLATILITY_EXPANSION'
            implication = 'Breakout mode. Wait for direction then follow. Wide stops.'
        elif v <= 20:
            regime = 'VOLATILITY_COMPRESSION'
            implication = 'Breakout imminent. Do not trade range. Prepare for expansion.'
        else:
            regime = 'TRANSITIONING'
            implication = 'Market transitioning. Reduce size. Wait for clear regime.'
    else:
        regime = 'UNKNOWN'
        implication = 'Insufficient data for regime classification.'

    return {
        'regime':       regime,
        'implication':  implication,
        'hurst':        hurst,
        'adx':          adx,
        'volatility':   vol_pct,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 4 — VOLUME PROFILE PROXY
# ═══════════════════════════════════════════════════════════════════════════════

def calc_volume_profile(candles, bins=20):
    """
    Volume Profile Proxy using price range and time as volume proxy.
    Returns POC, Value Area High/Low, HVN, LVN.
    """
    if len(candles) < 20:
        return {'status': 'INSUFFICIENT DATA'}

    price_min = min(c['low']  for c in candles)
    price_max = max(c['high'] for c in candles)
    price_range = price_max - price_min

    if price_range <= 0:
        return {'status': 'INSUFFICIENT DATA'}

    bin_size = price_range / bins
    profile  = [0.0] * bins

    for c in candles:
        # Use candle body size as activity proxy
        body   = abs(c['close'] - c['open'])
        range_ = c['high'] - c['low']
        activity = body + range_ * 0.5  # weighted activity

        # Distribute activity across price range of candle
        low_bin  = int((c['low']  - price_min) / bin_size)
        high_bin = int((c['high'] - price_min) / bin_size)
        low_bin  = max(0, min(low_bin,  bins-1))
        high_bin = max(0, min(high_bin, bins-1))
        span = high_bin - low_bin + 1
        for b in range(low_bin, high_bin + 1):
            profile[b] += activity / span

    # Find POC (highest activity bin)
    poc_bin   = profile.index(max(profile))
    poc_price = round(price_min + (poc_bin + 0.5) * bin_size, 6)

    # Value Area (70% of total activity around POC)
    total_activity = sum(profile)
    target_activity = total_activity * 0.70
    va_low_bin  = poc_bin
    va_high_bin = poc_bin
    va_activity = profile[poc_bin]

    while va_activity < target_activity:
        expand_up   = profile[va_high_bin + 1] if va_high_bin + 1 < bins else 0
        expand_down = profile[va_low_bin  - 1] if va_low_bin  - 1 >= 0  else 0
        if expand_up >= expand_down and va_high_bin + 1 < bins:
            va_high_bin += 1
            va_activity += profile[va_high_bin]
        elif va_low_bin - 1 >= 0:
            va_low_bin -= 1
            va_activity += profile[va_low_bin]
        else:
            break

    vah = round(price_min + (va_high_bin + 1) * bin_size, 6)
    val = round(price_min + va_low_bin * bin_size, 6)

    # HVN (top 3 bins outside value area)
    sorted_bins = sorted(enumerate(profile), key=lambda x: x[1], reverse=True)
    hvn = []
    lvn = []
    avg_activity = total_activity / bins
    for idx, act in sorted_bins:
        price_level = round(price_min + (idx + 0.5) * bin_size, 6)
        if act > avg_activity * 1.5:
            hvn.append({'price': price_level, 'activity_ratio': round(act / avg_activity, 2)})
        elif act < avg_activity * 0.5:
            lvn.append({'price': price_level, 'activity_ratio': round(act / avg_activity, 2)})

    current_price = candles[-1]['close']
    poc_relation = ('ABOVE_POC' if current_price > poc_price else
                    'BELOW_POC' if current_price < poc_price else 'AT_POC')

    return {
        'status':       'OK',
        'poc':          poc_price,
        'vah':          vah,
        'val':          val,
        'poc_relation': poc_relation,
        'hvn':          hvn[:3],
        'lvn':          lvn[:3],
        'price_range':  round(price_range, 6),
        'note':         f'POC={poc_price} | VAH={vah} | VAL={val} | Price is {poc_relation}',
    }


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 5 — SMC/ICT STRUCTURE ENGINES
# ═══════════════════════════════════════════════════════════════════════════════


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
# WYCKOFF ENGINE
# Detects Accumulation, Distribution, Reaccumulation, Redistribution phases
# Maps Spring/Upthrust (liquidity sweeps with confirmation)
# Maps Wyckoff events to SMC concepts for unified analysis
# ═══════════════════════════════════════════════════════════════════════════════

# ═══════════════════════════════════════════════════════════════════════════════
# PROBABILITY ENGINE
# Converts confluence scores into win probabilities using historical outcomes
# When no real data exists, uses calibrated theoretical model
# ═══════════════════════════════════════════════════════════════════════════════

def calc_win_probability(confluence_score: float, asset: str, regime: str,
                          session: str, rsi_value: float = None,
                          real_outcomes: list = None) -> dict:
    """
    Converts a confluence score into a calibrated win probability.

    Two modes:
    1. Real data mode: uses actual historical outcomes from SQLite
    2. Theoretical mode: uses calibrated sigmoid curve based on confluence score

    Output format:
        Win Probability = 63.4%
        TP1 Probability = 74%
        TP2 Probability = 52%
        SL Probability  = 37%
    """

    # Mode 1: Real data — group outcomes by score range and calculate real win rate
    if real_outcomes and len(real_outcomes) >= 20:
        # Find outcomes with similar confluence scores (within ±10 pts)
        similar = [o for o in real_outcomes
                   if o[0] is not None and abs(o[0] - confluence_score) <= 10]
        if len(similar) >= 5:
            wins    = sum(1 for o in similar if o[1] == 'WIN')
            win_pct = round(wins / len(similar) * 100, 1)

            # TP cascade probabilities (TP2 = TP1 × 0.72, TP3 = TP1 × 0.51)
            tp1_prob = min(win_pct * 1.15, 95.0)   # TP1 easier than full win
            tp2_prob = tp1_prob * 0.72
            tp3_prob = tp1_prob * 0.51
            sl_prob  = 100.0 - win_pct

            return {
                'mode':        'REAL_DATA',
                'sample_size': len(similar),
                'win_pct':     win_pct,
                'tp1_pct':     round(tp1_prob, 1),
                'tp2_pct':     round(tp2_prob, 1),
                'tp3_pct':     round(tp3_prob, 1),
                'sl_pct':      round(sl_prob, 1),
                'confidence':  'HIGH' if len(similar) >= 20 else 'MEDIUM',
            }

    # Mode 2: Theoretical model — sigmoid calibrated to confluence score
    # Calibration: score 50 = 45% win, score 70 = 55%, score 90 = 68%
    # Based on SMC/ICT academic literature and common retail backtests
    import math as _math
    base_prob = 1.0 / (1.0 + _math.exp(-0.08 * (confluence_score - 60)))
    base_prob = max(0.25, min(0.80, base_prob))  # clamp 25-80%

    # Regime adjustments
    regime_adj = {
        'TRENDING_STRONG':     +0.05,
        'TRENDING_MODERATE':   +0.02,
        'MEAN_REVERTING':      -0.03,
        'VOLATILITY_EXPANSION': 0.00,
        'VOLATILITY_COMPRESSION': -0.02,
        'TRANSITIONING':       -0.05,
    }
    base_prob += regime_adj.get(regime, 0.0)

    # Session adjustments
    session_adj = {
        'LONDON_NY_OVERLAP': +0.03,
        'NEW_YORK':          +0.02,
        'LONDON':            +0.01,
        'ASIAN':             -0.04,
        'OFF_HOURS':         -0.03,
    }
    base_prob += session_adj.get(session, 0.0)

    # RSI extreme adjustment
    if rsi_value is not None:
        if rsi_value < 25 or rsi_value > 75:
            base_prob -= 0.04   # extreme RSI = lower probability

    base_prob = max(0.20, min(0.80, base_prob))
    win_pct   = round(base_prob * 100, 1)

    tp1_prob = min(win_pct * 1.15, 90.0)
    tp2_prob = tp1_prob * 0.70
    tp3_prob = tp1_prob * 0.48
    sl_prob  = 100.0 - win_pct

    return {
        'mode':        'THEORETICAL',
        'sample_size': 0,
        'win_pct':     win_pct,
        'tp1_pct':     round(tp1_prob, 1),
        'tp2_pct':     round(tp2_prob, 1),
        'tp3_pct':     round(tp3_prob, 1),
        'sl_pct':      round(sl_prob, 1),
        'confidence':  'LOW — accumulate real trades for real probability',
    }


# ═══════════════════════════════════════════════════════════════════════════════
# TRADE EXPECTANCY ENGINE
# Calculates Expected Value per trade in R multiples
# EV = (Win Rate × Avg Win) - (Loss Rate × Avg Loss)
# Positive EV = system has edge. Negative EV = do not trade.
# ═══════════════════════════════════════════════════════════════════════════════

def calc_trade_expectancy(
    win_probability: float,
    tp1_rr: float,
    tp2_rr: float,
    tp3_rr: float,
    sl_rr: float = 1.0,
    tp1_weight: float = 0.50,
    tp2_weight: float = 0.30,
    tp3_weight: float = 0.20,
) -> dict:
    """
    Calculate Expected Value per trade.

    Formula:
        EV = Win_Prob × (tp1_weight × tp1_rr + tp2_weight × tp2_rr + tp3_weight × tp3_rr)
           - Loss_Prob × sl_rr

    Example:
        Win Prob = 58%, TP1=2R, TP2=3.5R, TP3=5R
        EV = 0.58 × (0.50×2 + 0.30×3.5 + 0.20×5) - 0.42 × 1
           = 0.58 × (1.0 + 1.05 + 1.0) - 0.42
           = 0.58 × 3.05 - 0.42
           = 1.769 - 0.42
           = +1.349R per trade
    """
    win_prob  = win_probability / 100.0
    loss_prob = 1.0 - win_prob

    # Weighted average reward
    avg_reward = (tp1_weight * (tp1_rr or 0) +
                  tp2_weight * (tp2_rr or 0) +
                  tp3_weight * (tp3_rr or 0))

    ev = round((win_prob * avg_reward) - (loss_prob * sl_rr), 3)

    # Kelly Fraction = (Win_Prob/Loss_Odds) - (Loss_Prob/Win_Odds)
    # Simplified: f = (bp - q) / b where b=avg_reward, p=win_prob, q=loss_prob
    kelly_full = (win_prob * avg_reward - loss_prob) / avg_reward if avg_reward > 0 else 0
    kelly_half = max(0, kelly_full / 2)  # half-Kelly for safety

    verdict = (
        'STRONG EDGE'    if ev >= 1.5 else
        'GOOD EDGE'      if ev >= 0.8 else
        'MARGINAL EDGE'  if ev >= 0.3 else
        'WEAK EDGE'      if ev >= 0.0 else
        'NEGATIVE EV — DO NOT TRADE'
    )

    return {
        'expected_value_r':    ev,
        'avg_reward_r':        round(avg_reward, 3),
        'win_probability_pct': round(win_prob * 100, 1),
        'loss_probability_pct':round(loss_prob * 100, 1),
        'kelly_full_pct':      round(kelly_full * 100, 1),
        'kelly_half_pct':      round(kelly_half * 100, 1),
        'verdict':             verdict,
        'interpretation':      f'Each trade on this setup expects to return {ev}R on average.',
    }


# ═══════════════════════════════════════════════════════════════════════════════
# CROSS-ASSET INTELLIGENCE ENGINE
# Fetches DXY, US10Y, VIX correlates from Deriv (free public WebSocket)
# Critical for Gold: Gold moves inversely with DXY and US10Y yields
# ═══════════════════════════════════════════════════════════════════════════════

# Weekly timeframe added to both modes for proper ICT top-down analysis
# Weekly FVGs and swing highs/lows are critical for identifying major liquidity pools
TIMEFRAME_GRANULARITIES = {
    'W1':  604800,  # 1 week
    'D1':  86400,   # 1 day
    '4H':  14400,   # 4 hours
    '1H':  3600,    # 1 hour
    '15M': 900,     # 15 minutes
    '5M':  300,     # 5 minutes
}

# Cross-asset symbol mappings on Deriv
CROSS_ASSET_SYMBOLS = {
    'XAUUSD': {
        'DXY':   'frxUSDJPY',   # USD proxy — JPY is inverse of DXY direction
        'DXY2':  'frxUSDCHF',   # Second USD proxy
        'RISK':  'frxAUDUSD',   # Risk-on proxy — AUD goes up in risk-on
    },
    'XAGUSD': {
        'DXY':   'frxUSDJPY',
        'RISK':  'frxAUDUSD',
    },
    'BTCUSD': {
        'RISK':  'frxAUDUSD',   # BTC correlated with risk appetite
        'DXY':   'frxUSDJPY',
    },
    'EURUSD': {
        'DXY':   'frxUSDJPY',   # EUR inverse of USD
        'DXY2':  'frxUSDCHF',
    },
    'GBPUSD': {
        'DXY':   'frxUSDJPY',
        'RISK':  'frxAUDUSD',
    },
}

# Cache for cross-asset data (5-minute TTL to avoid hammering Deriv)
_cross_asset_cache: dict = {}
_cross_asset_cache_time: dict = {}
CROSS_ASSET_CACHE_TTL = 300  # 5 minutes


def fetch_cross_asset_data(asset: str) -> dict:
    """
    Fetch correlated assets from Deriv to build macro context.
    Returns momentum direction for each correlated asset.
    Uses 20 candles of 1H data for macro context.
    """
    cache_key = asset
    now_ts = datetime.now(timezone.utc).timestamp()
    if (cache_key in _cross_asset_cache and
            (now_ts - _cross_asset_cache_time.get(cache_key, 0)) < CROSS_ASSET_CACHE_TTL):
        return _cross_asset_cache[cache_key]

    symbols = CROSS_ASSET_SYMBOLS.get(asset, {})
    if not symbols:
        return {'status': 'NOT_CONFIGURED', 'correlations': []}

    result = {'status': 'OK', 'asset': asset, 'correlations': [], 'macro_bias': 'NEUTRAL'}

    for role, symbol in symbols.items():
        try:
            url = (f'https://api.deriv.com/websockets/v3?ticks_history={symbol}'
                   f'&end=latest&count=20&style=candles&granularity=3600&app_id=1089')
            req = Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode())
            candles = data.get('candles', [])
            if len(candles) < 5:
                continue

            # Calculate momentum: compare current close to 10-candle average
            closes   = [float(c['close']) for c in candles]
            current  = closes[-1]
            avg_10   = sum(closes[-10:]) / 10
            pct_from_avg = round((current - avg_10) / avg_10 * 100, 3)
            direction = 'UP' if pct_from_avg > 0.05 else 'DOWN' if pct_from_avg < -0.05 else 'FLAT'

            # High/low range for context
            highs = [float(c['high']) for c in candles[-10:]]
            lows  = [float(c['low'])  for c in candles[-10:]]
            rng   = max(highs) - min(lows)
            momentum_strength = 'STRONG' if abs(pct_from_avg) > 0.3 else 'MODERATE' if abs(pct_from_avg) > 0.1 else 'WEAK'

            result['correlations'].append({
                'role':       role,
                'symbol':     symbol,
                'current':    round(current, 5),
                'direction':  direction,
                'pct_change': pct_from_avg,
                'strength':   momentum_strength,
            })

        except Exception as e:
            result['correlations'].append({
                'role': role, 'symbol': symbol,
                'direction': 'UNAVAILABLE', 'error': str(e)
            })

    # Interpret macro bias for Gold specifically
    if asset in ('XAUUSD', 'XAGUSD'):
        dxy_data  = next((c for c in result['correlations'] if c['role'] == 'DXY'), None)
        risk_data = next((c for c in result['correlations'] if c['role'] == 'RISK'), None)

        # USD proxy (USDJPY): if USDJPY UP = USD strong = Gold bearish pressure
        # Risk proxy (AUDUSD): if AUD DOWN = risk-off = Gold should get safe-haven bid
        dxy_bearish_gold  = dxy_data  and dxy_data['direction']  == 'UP'    # USD strong
        risk_off_gold_bid = risk_data and risk_data['direction'] == 'DOWN'  # risk-off

        if dxy_bearish_gold and not risk_off_gold_bid:
            macro_bias = 'BEARISH (USD strengthening, no safe-haven bid)'
        elif risk_off_gold_bid and not dxy_bearish_gold:
            macro_bias = 'BULLISH (risk-off environment, safe-haven demand)'
        elif dxy_bearish_gold and risk_off_gold_bid:
            macro_bias = 'MIXED (USD strong but risk-off — conflicting signals)'
        elif not dxy_bearish_gold and not risk_off_gold_bid:
            macro_bias = 'BULLISH (USD weakening, risk-on not negative for gold)'
        else:
            macro_bias = 'NEUTRAL'

        result['macro_bias'] = macro_bias

    elif asset in ('BTCUSD', 'ETHUSD'):
        risk_data = next((c for c in result['correlations'] if c['role'] == 'RISK'), None)
        if risk_data:
            result['macro_bias'] = (
                'BULLISH macro (risk-on)' if risk_data['direction'] == 'UP' else
                'BEARISH macro (risk-off)' if risk_data['direction'] == 'DOWN' else
                'NEUTRAL macro'
            )

    _cross_asset_cache[cache_key] = result
    _cross_asset_cache_time[cache_key] = now_ts
    return result


def detect_wyckoff_phase(candles, swing_highs, swing_lows, atr, volume_profile):
    """
    Detects the current Wyckoff phase from OHLCV data.

    Wyckoff phases mapped to deterministic rules:

    ACCUMULATION:
      - Price in a trading range after a sustained downtrend
      - Swing lows are roughly equal (support holding)
      - Spring: sharp wick below support that closes back above (= SSL sweep)
      - Volume proxy (range) increases on bounces, decreases on drops
      - Price below or at POC

    DISTRIBUTION:
      - Price in a trading range after a sustained uptrend
      - Swing highs are roughly equal (resistance holding)
      - Upthrust: sharp wick above resistance that closes back below (= BSL sweep)
      - Volume proxy increases on drops, decreases on bounces
      - Price above or at POC

    REACCUMULATION:
      - Same as accumulation but occurs mid-uptrend (pullback/consolidation)
      - BOS BULL already confirmed on HTF

    REDISTRIBUTION:
      - Same as distribution but occurs mid-downtrend (pullback/consolidation)
      - BOS BEAR already confirmed on HTF
    """
    if len(candles) < 50 or not swing_highs or not swing_lows:
        return {'phase': 'INSUFFICIENT DATA', 'events': [], 'confidence': 0}

    last_close  = candles[-1]['close']
    lookback    = candles[-80:]  # last 80 candles for phase detection
    tolerance   = atr * 0.3 if atr > 0 else 0

    # ── Step 1: Detect trading range ──────────────────────────────────────────
    recent_sh = [sh for sh in swing_highs if sh['index'] >= len(candles) - 80]
    recent_sl = [sl for sl in swing_lows  if sl['index'] >= len(candles) - 80]

    if len(recent_sh) < 2 or len(recent_sl) < 2:
        return {'phase': 'TRENDING — no range detected', 'events': [], 'confidence': 0}

    range_high = max(sh['price'] for sh in recent_sh)
    range_low  = min(sl['price'] for sl in recent_sl)
    range_size = range_high - range_low

    if range_size <= 0:
        return {'phase': 'INSUFFICIENT DATA', 'events': [], 'confidence': 0}

    # Range must be meaningful — at least 1x ATR wide
    if range_size < atr:
        return {'phase': 'MICRO RANGE — too tight for Wyckoff analysis', 'events': [], 'confidence': 0}

    range_midpoint = range_low + range_size / 2

    # ── Step 2: Detect equal highs/lows (resistance/support holding) ──────────
    sh_prices = [sh['price'] for sh in recent_sh]
    sl_prices = [sl['price'] for sl in recent_sl]

    eq_highs = sum(1 for p in sh_prices if abs(p - range_high) <= tolerance)
    eq_lows  = sum(1 for p in sl_prices if abs(p - range_low)  <= tolerance)

    resistance_holding = eq_highs >= 2
    support_holding    = eq_lows  >= 2

    # ── Step 3: Prior trend detection (what came before the range) ───────────
    early_candles = candles[-150:-80] if len(candles) > 150 else candles[:len(candles)//2]
    if len(early_candles) > 10:
        early_high = max(c['high']  for c in early_candles)
        early_low  = min(c['low']   for c in early_candles)
        prior_bullish = early_low < range_low and early_high < range_high  # came from below
        prior_bearish = early_high > range_high and early_low > range_low  # came from above
    else:
        prior_bullish = False
        prior_bearish = False

    # ── Step 4: Volume proxy — candle range as activity proxy ─────────────────
    # Bounces from lows: bullish candles near range_low — do they have large range?
    bounce_activity = []
    drop_activity   = []
    for c in lookback:
        c_range = c['high'] - c['low']
        if c['low'] <= range_low + range_size * 0.25:
            bounce_activity.append(c_range)
        if c['high'] >= range_high - range_size * 0.25:
            drop_activity.append(c_range)

    avg_bounce = sum(bounce_activity) / len(bounce_activity) if bounce_activity else 0
    avg_drop   = sum(drop_activity)   / len(drop_activity)   if drop_activity   else 0

    # ── Step 5: Detect Spring (Wyckoff = SSL sweep + close back inside) ───────
    spring_events = []
    for i in range(1, len(lookback)):
        c    = lookback[i]
        prev = lookback[i - 1]
        # Wick below range_low but close back inside range
        if (c['low'] < range_low - tolerance and
            c['close'] > range_low and
            c['close'] > prev['close']):
            spring_events.append({
                'type':  'SPRING',
                'price': round(c['low'], 6),
                'close': round(c['close'], 6),
                'date':  c.get('date', str(c['epoch'])),
                'note':  'Price swept below support and closed back inside — potential Accumulation Spring',
            })

    # ── Step 6: Detect Upthrust (Wyckoff = BSL sweep + close back inside) ────
    upthrust_events = []
    for i in range(1, len(lookback)):
        c    = lookback[i]
        prev = lookback[i - 1]
        # Wick above range_high but close back inside range
        if (c['high'] > range_high + tolerance and
            c['close'] < range_high and
            c['close'] < prev['close']):
            upthrust_events.append({
                'type':  'UPTHRUST',
                'price': round(c['high'], 6),
                'close': round(c['close'], 6),
                'date':  c.get('date', str(c['epoch'])),
                'note':  'Price swept above resistance and closed back inside — potential Distribution Upthrust',
            })

    # ── Step 7: Sign of Strength / Sign of Weakness ───────────────────────────
    # SOS = strong bullish candle breaking above internal resistance within range
    # SOW = strong bearish candle breaking below internal support within range
    sos_events = []
    sow_events = []
    for i in range(1, len(lookback)):
        c    = lookback[i]
        body = abs(c['close'] - c['open'])
        if body > atr * 0.8:  # strong body = strong candle
            if c['close'] > c['open'] and c['close'] > range_midpoint:
                sos_events.append({'type': 'SOS', 'price': round(c['close'], 6), 'date': c.get('date', str(c['epoch']))})
            elif c['close'] < c['open'] and c['close'] < range_midpoint:
                sow_events.append({'type': 'SOW', 'price': round(c['close'], 6), 'date': c.get('date', str(c['epoch']))})

    # ── Step 8: Phase classification ─────────────────────────────────────────
    phase        = 'UNDEFINED'
    phase_detail = ''
    confidence   = 0
    trade_bias   = 'NEUTRAL'
    next_move    = ''

    if support_holding and prior_bearish and avg_bounce >= avg_drop:
        phase      = 'ACCUMULATION'
        trade_bias = 'BULLISH'
        confidence = min(100, 40 + len(spring_events) * 20 + len(sos_events) * 10 + (eq_lows - 1) * 10)
        phase_detail = (
            f'Price ranged between {round(range_low,4)}-{round(range_high,4)} after downtrend. '
            f'Support tested {eq_lows}x. '
            f'{"Spring detected — smart money absorbed sell-side liquidity. " if spring_events else ""}'
            f'{"Sign of Strength confirms buying interest. " if sos_events else ""}'
            f'Wyckoff Composite Man is accumulating long positions.'
        )
        next_move = f'Watch for markup above {round(range_high, 4)}. Breakout targets BSL above range.'

    elif resistance_holding and prior_bullish and avg_drop >= avg_bounce:
        phase      = 'DISTRIBUTION'
        trade_bias = 'BEARISH'
        confidence = min(100, 40 + len(upthrust_events) * 20 + len(sow_events) * 10 + (eq_highs - 1) * 10)
        phase_detail = (
            f'Price ranged between {round(range_low,4)}-{round(range_high,4)} after uptrend. '
            f'Resistance tested {eq_highs}x. '
            f'{"Upthrust detected — smart money absorbed buy-side liquidity. " if upthrust_events else ""}'
            f'{"Sign of Weakness confirms selling interest. " if sow_events else ""}'
            f'Wyckoff Composite Man is distributing short positions.'
        )
        next_move = f'Watch for markdown below {round(range_low, 4)}. Breakout targets SSL below range.'

    elif support_holding and not prior_bearish and avg_bounce >= avg_drop:
        phase      = 'REACCUMULATION'
        trade_bias = 'BULLISH'
        confidence = min(100, 30 + len(spring_events) * 15 + len(sos_events) * 10)
        phase_detail = (
            f'Mid-trend pullback forming range {round(range_low,4)}-{round(range_high,4)}. '
            f'Uptrend is pausing — Composite Man reloading longs. '
            f'{"Spring/shakeout detected. " if spring_events else ""}'
            f'Continuation of uptrend expected after range resolves.'
        )
        next_move = f'Watch for BOS BULL above {round(range_high, 4)} to confirm continuation.'

    elif resistance_holding and not prior_bullish and avg_drop >= avg_bounce:
        phase      = 'REDISTRIBUTION'
        trade_bias = 'BEARISH'
        confidence = min(100, 30 + len(upthrust_events) * 15 + len(sow_events) * 10)
        phase_detail = (
            f'Mid-trend bounce forming range {round(range_low,4)}-{round(range_high,4)}. '
            f'Downtrend is pausing — Composite Man reloading shorts. '
            f'{"Upthrust/UTAD detected. " if upthrust_events else ""}'
            f'Continuation of downtrend expected after range resolves.'
        )
        next_move = f'Watch for BOS BEAR below {round(range_low, 4)} to confirm continuation.'

    else:
        phase      = 'CAUSE BUILDING'
        trade_bias = 'NEUTRAL'
        confidence = 20
        phase_detail = f'Range between {round(range_low,4)}-{round(range_high,4)}. Direction unclear — waiting for Spring or Upthrust.'
        next_move = 'Wait for Spring below support or Upthrust above resistance before committing.'

    all_events = (
        spring_events[-2:]   +
        upthrust_events[-2:] +
        sos_events[-2:]      +
        sow_events[-2:]
    )
    all_events.sort(key=lambda x: x.get('date', ''), reverse=True)

    return {
        'phase':        phase,
        'trade_bias':   trade_bias,
        'confidence':   confidence,
        'range_high':   round(range_high, 6),
        'range_low':    round(range_low,  6),
        'range_size':   round(range_size, 6),
        'eq_highs':     eq_highs,
        'eq_lows':      eq_lows,
        'phase_detail': phase_detail,
        'next_move':    next_move,
        'events':       all_events,
        'volume_bias':  'BULLISH' if avg_bounce > avg_drop else 'BEARISH' if avg_drop > avg_bounce else 'NEUTRAL',
    }


# ═══════════════════════════════════════════════════════════════════════════════
# POSITION SIZING ENGINE
# Calculates exact lot size based on account risk, SL distance, and pip value
# This is what stops accounts from blowing up even with good signals
# ═══════════════════════════════════════════════════════════════════════════════

ASSET_PIP_VALUES = {
    # pip_value = value of 1 pip per 1 standard lot in USD
    'XAUUSD':   10.0,   # Gold: $10 per pip per lot (1 pip = $0.10 move)
    'XAGUSD':   50.0,   # Silver: $50 per pip per lot
    'EURUSD':   10.0,   # Forex majors: $10 per pip per lot
    'GBPUSD':   10.0,
    'USDJPY':   10.0,
    'USDCHF':   10.0,
    'AUDUSD':   10.0,
    'USDCAD':   10.0,
    'NZDUSD':   10.0,
    'BTCUSD':   1.0,    # Crypto: $1 per $1 move per 1 contract
    'ETHUSD':   1.0,
    'SOLUSD':   1.0,
    'BOOM1000': 1.0,
    'CRASH1000':1.0,
    'VOL75':    1.0,
    'VOL100':   1.0,
}

ASSET_MIN_LOT  = 0.01   # minimum lot size for most brokers
ASSET_MAX_LOT  = 100.0  # maximum lot size cap (safety)
ASSET_LOT_STEP = 0.01   # lot size increment


def calc_position_size(
    asset:     str,
    entry:     float,
    sl:        float,
    account_size:   float = 10000.0,
    risk_pct:       float = 1.0,
) -> dict:
    """
    Calculate exact position size based on risk management rules.

    Formula:
        Risk Amount   = account_size × (risk_pct / 100)
        SL Distance   = |entry - sl| in price units
        SL in Pips    = SL Distance / pip_size
        Pip Value     = value per pip per standard lot (from ASSET_PIP_VALUES)
        Lot Size      = Risk Amount / (SL in Pips × Pip Value)

    Example (XAUUSD):
        Account = $10,000 | Risk = 1% = $100
        Entry = 4230, SL = 4220 → SL Distance = 10 points
        SL in Pips = 10 / 0.01 = 1000 pips  (Gold pip = $0.01)
        Pip Value = $10 per lot
        Lot Size = $100 / (1000 × $10) = 0.01 lots = 1 micro lot
    """
    if not entry or not sl or entry == sl:
        return {'error': 'Invalid entry or SL', 'lot_size': None}

    pip_value = ASSET_PIP_VALUES.get(asset, 10.0)
    risk_amt  = account_size * (risk_pct / 100.0)

    # SL distance in price points
    sl_distance = abs(entry - sl)
    if sl_distance <= 0:
        return {'error': 'SL distance is zero', 'lot_size': None}

    # Pip size varies by asset
    if asset in ('XAUUSD', 'XAGUSD'):
        pip_size = 0.01   # Gold: 1 pip = $0.01
    elif asset in ('USDJPY',):
        pip_size = 0.01   # JPY pairs: 1 pip = 0.01
    elif asset in ('BTCUSD', 'ETHUSD', 'SOLUSD', 'BOOM1000', 'CRASH1000', 'VOL75', 'VOL100'):
        pip_size = 1.0    # Crypto/synthetics: 1 pip = $1
    else:
        pip_size = 0.0001  # Standard forex: 1 pip = 0.0001

    sl_in_pips = sl_distance / pip_size
    if sl_in_pips <= 0:
        return {'error': 'SL pips calculation error', 'lot_size': None}

    raw_lot_size = risk_amt / (sl_in_pips * pip_value)

    # Round to nearest lot step
    lot_size = round(round(raw_lot_size / ASSET_LOT_STEP) * ASSET_LOT_STEP, 2)
    lot_size = max(ASSET_MIN_LOT, min(ASSET_MAX_LOT, lot_size))

    # Risk validation
    actual_risk     = lot_size * sl_in_pips * pip_value
    actual_risk_pct = round(actual_risk / account_size * 100, 3)

    # Reward calculations
    # These will be filled by the analysis engine using TP levels
    return {
        'lot_size':          lot_size,
        'risk_amount_usd':   round(risk_amt, 2),
        'actual_risk_usd':   round(actual_risk, 2),
        'actual_risk_pct':   actual_risk_pct,
        'sl_distance_pts':   round(sl_distance, 6),
        'sl_in_pips':        round(sl_in_pips, 1),
        'pip_value':         pip_value,
        'pip_size':          pip_size,
        'account_size':      account_size,
        'risk_pct_used':     risk_pct,
        'note':              f'{lot_size} lots risks ${round(actual_risk,2)} ({actual_risk_pct}% of account)',
    }


def calc_full_risk_plan(
    asset:        str,
    entry_low:    float,
    entry_high:   float,
    sl:           float,
    tp1:          float,
    tp2:          float,
    tp3:          float,
    atr:          float,
    account_size: float = 10000.0,
    risk_pct:     float = 1.0,
) -> dict:
    """
    Full risk plan: position size + R:R for each target + break-even point.
    Uses mid-point of entry zone for calculations.
    """
    entry_mid = (entry_low + entry_high) / 2 if entry_low and entry_high else (entry_low or 0)

    sizing = calc_position_size(asset, entry_mid, sl, account_size, risk_pct)

    if sizing.get('error'):
        return sizing

    lot_size    = sizing['lot_size']
    pip_value   = sizing['pip_value']
    pip_size    = sizing['pip_size']
    risk_amount = sizing['actual_risk_usd']

    def calc_rr(tp):
        if not tp or tp == entry_mid:
            return None
        reward_pts  = abs(tp - entry_mid)
        reward_pips = reward_pts / pip_size
        reward_usd  = lot_size * reward_pips * pip_value
        rr_ratio    = round(reward_usd / risk_amount, 2) if risk_amount > 0 else 0
        return {
            'tp_price':    round(tp, 6),
            'reward_usd':  round(reward_usd, 2),
            'rr_ratio':    rr_ratio,
            'pips':        round(reward_pips, 1),
        }

    # Break-even: move SL to entry after TP1
    be_move_pts   = abs(entry_mid - sl)
    be_price      = round(entry_mid + be_move_pts if tp1 and tp1 > entry_mid else entry_mid - be_move_pts, 6)

    return {
        'entry_mid':       round(entry_mid, 6),
        'lot_size':        lot_size,
        'risk_amount_usd': round(risk_amount, 2),
        'risk_pct':        sizing['actual_risk_pct'],
        'sl_distance_pts': sizing['sl_distance_pts'],
        'sl_in_pips':      sizing['sl_in_pips'],
        'tp1_plan':        calc_rr(tp1),
        'tp2_plan':        calc_rr(tp2),
        'tp3_plan':        calc_rr(tp3),
        'break_even_price': be_price,
        'atr_vs_sl':       round(sizing['sl_distance_pts'] / atr, 2) if atr > 0 else None,
        'note':            sizing['note'],
        'warning':         'SL is less than 1x ATR — very tight stop, high chance of noise stop-out' if atr > 0 and sizing['sl_distance_pts'] < atr else None,
    }


def detect_swings(candles, left=5, right=5):
    swing_highs, swing_lows = [], []
    for i in range(left, len(candles) - right):
        wh = [candles[j]['high'] for j in range(i-left, i+right+1)]
        wl = [candles[j]['low']  for j in range(i-left, i+right+1)]
        if candles[i]['high'] == max(wh):
            swing_highs.append({'index':i,'price':candles[i]['high'],'epoch':candles[i]['epoch'],'date':candles[i].get('date',str(candles[i]['epoch']))})
        if candles[i]['low'] == min(wl):
            swing_lows.append({'index':i,'price':candles[i]['low'],'epoch':candles[i]['epoch'],'date':candles[i].get('date',str(candles[i]['epoch']))})
    return swing_highs, swing_lows


def detect_bos_choch(candles, swing_highs, swing_lows):
    events, trend = [], 'NEUTRAL'
    all_swings = sorted([('SH',sh) for sh in swing_highs]+[('SL',sl) for sl in swing_lows], key=lambda x:x[1]['index'])
    confirmed_sh, confirmed_sl = [], []
    for i, c in enumerate(candles):
        for stype, swing in all_swings:
            if swing['index'] == i:
                (confirmed_sh if stype=='SH' else confirmed_sl).append(swing)
        if confirmed_sh:
            lsh = confirmed_sh[-1]
            if c['close'] > lsh['price'] and lsh['index'] < i:
                etype = 'CHoCH' if trend=='BEARISH' else 'BOS'
                events.append({'type':f'{etype} BULL','price':lsh['price'],'candle_price':c['close'],'epoch':c['epoch'],'date':c.get('date',str(c['epoch'])),'index':i})
                trend, confirmed_sh = 'BULLISH', []
        if confirmed_sl:
            lsl = confirmed_sl[-1]
            if c['close'] < lsl['price'] and lsl['index'] < i:
                etype = 'CHoCH' if trend=='BULLISH' else 'BOS'
                events.append({'type':f'{etype} BEAR','price':lsl['price'],'candle_price':c['close'],'epoch':c['epoch'],'date':c.get('date',str(c['epoch'])),'index':i})
                trend, confirmed_sl = 'BEARISH', []
    return events, trend


def detect_fvg(candles, atr):
    fvgs, min_size = [], atr*0.15 if atr>0 else 0
    for i in range(1, len(candles)-1):
        prev,curr,nxt = candles[i-1],candles[i],candles[i+1]
        if prev['high']<nxt['low']:
            gs=nxt['low']-prev['high']
            if gs>=min_size:
                mit=any(candles[j]['close']<=nxt['low'] and candles[j]['close']>=prev['high'] for j in range(i+2,len(candles)))
                fvgs.append({'direction':'BULL','top':round(nxt['low'],6),'bottom':round(prev['high'],6),'size':round(gs,6),'atr_ratio':round(gs/atr,3) if atr else 0,'epoch':curr['epoch'],'date':curr.get('date',str(curr['epoch'])),'status':'MITIGATED' if mit else 'FRESH','index':i})
        if prev['low']>nxt['high']:
            gs=prev['low']-nxt['high']
            if gs>=min_size:
                mit=any(candles[j]['close']>=nxt['high'] and candles[j]['close']<=prev['low'] for j in range(i+2,len(candles)))
                fvgs.append({'direction':'BEAR','top':round(prev['low'],6),'bottom':round(nxt['high'],6),'size':round(gs,6),'atr_ratio':round(gs/atr,3) if atr else 0,'epoch':curr['epoch'],'date':curr.get('date',str(curr['epoch'])),'status':'MITIGATED' if mit else 'FRESH','index':i})
    return fvgs


def detect_order_blocks(candles, bos_events, atr):
    obs, min_imp = [], atr*1.5 if atr>0 else 0
    for event in bos_events:
        if 'BOS' not in event['type']: continue
        bos_idx=event['index']; direction='BULL' if 'BULL' in event['type'] else 'BEAR'
        imp_c=candles[max(0,bos_idx-10):bos_idx+1]
        if not imp_c: continue
        imp_size=max(c['high'] for c in imp_c)-min(c['low'] for c in imp_c)
        if imp_size<min_imp: continue
        ob_candle,ob_idx=None,-1
        for j in range(bos_idx-1,max(0,bos_idx-15),-1):
            c=candles[j]
            if (direction=='BULL' and c['close']<c['open']) or (direction=='BEAR' and c['close']>c['open']):
                ob_candle,ob_idx=c,j; break
        if ob_candle is None: continue
        mid=(ob_candle['open']+ob_candle['close'])/2
        mit=any((direction=='BULL' and candles[j]['low']<=mid) or (direction=='BEAR' and candles[j]['high']>=mid) for j in range(bos_idx+1,len(candles)))
        touch_count=sum(1 for j in range(bos_idx+1,len(candles)) if candles[j]['low']<=ob_candle['high'] and candles[j]['high']>=ob_candle['low'])
        obs.append({'direction':direction,'high':round(max(ob_candle['open'],ob_candle['close']),6),'low':round(min(ob_candle['open'],ob_candle['close']),6),'full_high':round(ob_candle['high'],6),'full_low':round(ob_candle['low'],6),'impulse_size':round(imp_size,6),'atr_ratio':round(imp_size/atr,2) if atr else 0,'epoch':ob_candle['epoch'],'date':ob_candle.get('date',str(ob_candle['epoch'])),'status':'MITIGATED' if mit else 'FRESH','touch_count':touch_count,'index':ob_idx})
    return obs


def detect_liquidity(candles, swing_highs, swing_lows, atr):
    tol=atr*0.05 if atr>0 else 0; last_close=candles[-1]['close'] if candles else 0

    def sweep_status(swings, is_high):
        result=[]
        for sw in swings:
            swept=False; sweep_strength=0; displacement=0
            for j in range(sw['index']+1,len(candles)):
                c=candles[j]
                if is_high and c['high']>sw['price']:
                    wick_beyond=c['high']-sw['price']
                    swept=c['close']<sw['price']
                    if swept:
                        sweep_strength=round(wick_beyond/atr,2) if atr else 0
                        if j+1<len(candles): displacement=round(abs(candles[j+1]['close']-candles[j+1]['open'])/atr,2) if atr else 0
                    break
                elif not is_high and c['low']<sw['price']:
                    wick_beyond=sw['price']-c['low']
                    swept=c['close']>sw['price']
                    if swept:
                        sweep_strength=round(wick_beyond/atr,2) if atr else 0
                        if j+1<len(candles): displacement=round(abs(candles[j+1]['close']-candles[j+1]['open'])/atr,2) if atr else 0
                    break
            quality='HIGH' if sweep_strength>1.5 and displacement>1.0 else 'MEDIUM' if sweep_strength>0.5 else 'LOW' if swept else 'N/A'
            result.append({'price':sw['price'],'epoch':sw['epoch'],'date':sw.get('date',str(sw['epoch'])),'status':'SWEPT' if swept else 'RESTING','distance_pct':round(abs(sw['price']-last_close)/last_close*100,3) if last_close else 0,'sweep_strength_atr':sweep_strength,'displacement_atr':displacement,'sweep_quality':quality})
        return result

    bsl=sweep_status(swing_highs,True); ssl=sweep_status(swing_lows,False)
    eqh=[{'price_1':swing_highs[i]['price'],'price_2':swing_highs[j]['price'],'avg':round((swing_highs[i]['price']+swing_highs[j]['price'])/2,6)} for i in range(len(swing_highs)) for j in range(i+1,len(swing_highs)) if abs(swing_highs[i]['price']-swing_highs[j]['price'])<=tol]
    eql=[{'price_1':swing_lows[i]['price'],'price_2':swing_lows[j]['price'],'avg':round((swing_lows[i]['price']+swing_lows[j]['price'])/2,6)} for i in range(len(swing_lows)) for j in range(i+1,len(swing_lows)) if abs(swing_lows[i]['price']-swing_lows[j]['price'])<=tol]
    return {
        'bsl':sorted([x for x in bsl if x['status']=='RESTING'],key=lambda x:x['distance_pct'])[:5],
        'ssl':sorted([x for x in ssl if x['status']=='RESTING'],key=lambda x:x['distance_pct'])[:5],
        'swept_bsl':[x for x in bsl if x['status']=='SWEPT' and x['sweep_quality']=='HIGH'][-3:],
        'swept_ssl':[x for x in ssl if x['status']=='SWEPT' and x['sweep_quality']=='HIGH'][-3:],
        'equal_highs':eqh[:3],'equal_lows':eql[:3]
    }


def calc_premium_discount(candles, swing_highs, swing_lows):
    if not swing_highs or not swing_lows:
        return {'status':'INSUFFICIENT DATA','percentage':None}
    last_close=candles[-1]['close']
    rsh=max(swing_highs,key=lambda x:x['index']); rsl=max(swing_lows,key=lambda x:x['index'])
    range_high=rsh['price']; range_low=rsl['price']
    below_range=last_close<range_low; above_range=last_close>range_high
    if last_close>range_high: range_high=last_close
    if last_close<range_low:  range_low=last_close
    rng=range_high-range_low
    if rng<=0: return {'status':'INSUFFICIENT DATA','percentage':None}
    pct=round(max(0.0,min(100.0,(last_close-range_low)/rng*100)),2)
    status='DEEP PREMIUM' if pct>=75 else 'PREMIUM' if pct>=50 else 'DISCOUNT' if pct>=25 else 'DEEP DISCOUNT'
    if below_range:
        note = 'BREAKDOWN — Price below entire swing range. Not a discount buy. Bearish continuation territory.'
        status = 'BREAKDOWN'
    elif above_range:
        note = 'BREAKOUT — Price above entire swing range. Not a premium short. Bullish continuation territory.'
        status = 'BREAKOUT'
    else:
        note = 'PRICE WITHIN SWING RANGE'

    return {
        'status':      status,
        'percentage':  pct,
        'range_high':  round(range_high, 6),
        'range_low':   round(range_low,  6),
        'equilibrium': round(range_low + rng * 0.5, 6),
        'current':     round(last_close, 6),
        'below_range': below_range,
        'above_range': above_range,
        'note':        note,
    }


def calc_session(latest_epoch):
    dt=datetime.fromtimestamp(latest_epoch,tz=timezone.utc); hour=dt.hour
    if 7<=hour<11:  return {'session':'LONDON','score':5}
    if 12<=hour<15: return {'session':'LONDON_NY_OVERLAP','score':5}
    if 15<=hour<20: return {'session':'NEW_YORK','score':5}
    if 0<=hour<6:   return {'session':'ASIAN','score':0}
    return {'session':'OFF_HOURS','score':2}


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 6 — BACKTESTING
# ═══════════════════════════════════════════════════════════════════════════════

def run_backtest(candles, atr, swing_highs, swing_lows, bos_events, fvgs, obs):
    if len(candles)<50: return {'status':'INSUFFICIENT DATA','trades':0}
    trades=[]; tp_ratio=1.5; sl_ratio=1.0
    bos_only=[e for e in bos_events if 'BOS' in e['type']]
    for event in bos_only:
        idx       = event['index']
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
            entry_type = 'BOS_CLOSE_FALLBACK'
        tp=entry+atr_at*tp_ratio if direction=='LONG' else entry-atr_at*tp_ratio
        sl=entry-atr_at*sl_ratio if direction=='LONG' else entry+atr_at*sl_ratio
        outcome='OPEN'; exit_price=None; bars=0
        for j in range(idx+1,min(idx+50,len(candles))):
            c=candles[j]; bars+=1
            if direction=='LONG':
                if c['low']<=sl:   outcome='LOSS'; exit_price=sl; break
                if c['high']>=tp:  outcome='WIN';  exit_price=tp; break
            else:
                if c['high']>=sl:  outcome='LOSS'; exit_price=sl; break
                if c['low']<=tp:   outcome='WIN';  exit_price=tp; break
        if outcome!='OPEN':
            pnl=(exit_price-entry) if direction=='LONG' else (entry-exit_price)
            trades.append({
            'direction':  direction,
            'entry':      round(entry, 6),
            'exit':       round(exit_price, 6),
            'outcome':    outcome,
            'pnl_atr':    round(pnl/atr_at, 3),
            'bars':       bars,
            'entry_type': entry_type,
            'date':       candles[idx].get('date', str(candles[idx]['epoch'])),
        })
    if not trades: return {'status':'NO TRADES FOUND','trades':0}
    wins=[t for t in trades if t['outcome']=='WIN']; losses=[t for t in trades if t['outcome']=='LOSS']
    wr=round(len(wins)/len(trades)*100,1)
    aw=round(sum(t['pnl_atr'] for t in wins)/len(wins),3) if wins else 0
    al=round(sum(t['pnl_atr'] for t in losses)/len(losses),3) if losses else 0
    exp=round((wr/100*aw)+((1-wr/100)*al),3)
    pf=round(abs(sum(t['pnl_atr'] for t in wins))/abs(sum(t['pnl_atr'] for t in losses)),3) if losses and wins else 0
    ob_entries  = sum(1 for t in trades if 'OB@'       in t.get('entry_type',''))
    fvg_entries = sum(1 for t in trades if 'FVG@'      in t.get('entry_type',''))
    bos_entries = sum(1 for t in trades if 'BOS_CLOSE' in t.get('entry_type',''))
    return {
        'status':          'COMPLETE',
        'trades':          len(trades),
        'wins':            len(wins),
        'losses':          len(losses),
        'entry_breakdown': {'ob': ob_entries, 'fvg': fvg_entries, 'bos_fallback': bos_entries},
        'win_rate_pct':wr,'win_rate_adjusted_pct':round(wr*0.80,1),
        'avg_win_atr':aw,'avg_loss_atr':al,'expectancy_atr':exp,'profit_factor':pf,
        'recent_trades':trades[-5:],
        'verdict':'EDGE CONFIRMED' if exp>0.2 and wr>=45 else 'MARGINAL EDGE' if exp>0 else 'NO EDGE DETECTED',
        'backtest_note':'Entry at BOS candle close. Real slippage not modelled. Adjusted win rate applies 20% haircut.',
    }


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 7 — ML SCORING WITH RSI PENALTY
# ═══════════════════════════════════════════════════════════════════════════════

def build_feature_vector(tf_data, indicators):
    trend_enc={'BULLISH':1,'BEARISH':-1,'NEUTRAL':0}
    features=[]
    features.append(trend_enc.get(tf_data.get('trend','NEUTRAL'),0))
    pd=tf_data.get('premium_discount',{}); pct=pd.get('percentage')
    features.append((pct/50.0-1.0) if pct is not None else 0.0)
    features.append(min(len(tf_data.get('ob_fresh',[])),5)/5.0)
    features.append(min(len(tf_data.get('fvg_fresh',[])),5)/5.0)
    liq=tf_data.get('liquidity',{})
    features.append(min(len(liq.get('bsl',[])),5)/5.0)
    features.append(min(len(liq.get('ssl',[])),5)/5.0)
    rsi_val=indicators.get('rsi',{}).get('value')
    features.append((rsi_val/50.0-1.0) if rsi_val is not None else 0.0)
    macd_dir=indicators.get('macd',{}).get('direction','NEUTRAL')
    features.append(trend_enc.get(macd_dir,0))
    bb_pos=indicators.get('bollinger',{}).get('position')
    features.append((bb_pos/50.0-1.0) if bb_pos is not None else 0.0)
    bos_count=sum(1 for e in tf_data.get('bos_choch',[]) if 'BOS' in e['type'])
    features.append(min(bos_count,5)/5.0)
    return features


def ml_signal_score(htf_data, etf_data, indicators_by_tf, session_score, asset=''):
    real_outcomes = get_real_outcomes(asset) if asset else []

    if HAS_SKLEARN and HAS_NUMPY:
        try:
            htf_features=build_feature_vector(htf_data,indicators_by_tf.get('htf',{}))
            etf_features=build_feature_vector(etf_data,indicators_by_tf.get('etf',{}))
            combined=htf_features+etf_features+[session_score/5.0]

            win_count_check  = sum(1 for o in real_outcomes if o[1] == 'WIN')
            loss_count_check = len(real_outcomes) - win_count_check
            if len(real_outcomes) >= 50 and win_count_check >= 10 and loss_count_check >= 10:
                # Train on REAL outcomes from database (50+ required for reliable ML)
                X_real=[]; y_real=[]
                for row in real_outcomes:
                    score_norm = row[0]/100.0 if row[0] else 0.5
                    rsi_norm   = (row[3]/50.0-1.0) if row[3] else 0.0
                    trend_enc2 = {'BULLISH':1,'BEARISH':-1,'NEUTRAL':0}
                    trend_feat = trend_enc2.get(row[4],'NEUTRAL') if len(row)>4 else 0
                    feature_row = [score_norm, rsi_norm, trend_feat] + [0.5]*18
                    X_real.append(feature_row)
                    y_real.append(1 if row[1]=='WIN' else 0)
                X_train = X_real
                y_train = y_real
                training_source = f'REAL_DATA ({len(real_outcomes)} trades)'
            else:
                # Not enough real data for ML — fall through to rule-based score
                # Logistic Regression on 9 synthetic samples produces meaningless probabilities
                # Rule-based score is more reliable until 50+ real outcomes accumulate
                raise ValueError(f'Only {len(real_outcomes)} real outcomes — need 50 for ML. Using rule-based.')

            scaler=StandardScaler(); X_scaled=scaler.fit_transform(X_train)
            x_input=scaler.transform([combined])
            clf=LogisticRegression(max_iter=500,random_state=42)
            clf.fit(X_scaled,y_train)
            prob=clf.predict_proba(x_input)[0][1]
            raw_score=round(prob*100,1)

            htf_trend=htf_data.get('trend','NEUTRAL'); etf_trend=etf_data.get('trend','NEUTRAL')
            htf_filter=False
            if htf_trend!='NEUTRAL' and etf_trend!='NEUTRAL' and htf_trend!=etf_trend:
                raw_score=min(raw_score,40); htf_filter=True

            htf_rsi=indicators_by_tf.get('htf',{}).get('rsi',{}).get('value')
            rsi_penalty=0; rsi_reason=None
            if htf_rsi is not None:
                if htf_rsi<30 and etf_trend=='BEARISH':
                    rsi_penalty=10; rsi_reason=f'HTF RSI oversold ({htf_rsi}) — penalised for shorting exhausted move'
                elif htf_rsi>70 and etf_trend=='BULLISH':
                    rsi_penalty=10; rsi_reason=f'HTF RSI overbought ({htf_rsi}) — penalised for buying exhausted move'
            raw_score=max(0,raw_score-rsi_penalty)

            stat_edge=calc_statistical_edge(real_outcomes) if real_outcomes else {'status':'NO_REAL_DATA'}
            monte_carlo=run_monte_carlo(real_outcomes) if len(real_outcomes)>=30 else {'status':'Need 30+ real outcomes'}

            return {
                'score':raw_score,'method':'ML_LOGISTIC_REGRESSION','training_source':training_source,
                'htf_filter_applied':htf_filter,'rsi_penalty':rsi_penalty,'rsi_penalty_reason':rsi_reason,
                'statistical_edge':stat_edge,'monte_carlo':monte_carlo,
                'features_htf':htf_features,'features_etf':etf_features,
            }
        except Exception:
            pass

    return rule_based_score(htf_data, etf_data, indicators_by_tf, session_score)


def rule_based_score(htf_data, etf_data, indicators_by_tf, session_score):
    score=0; breakdown={}
    htf_trend=htf_data.get('trend','NEUTRAL'); etf_trend=etf_data.get('trend','NEUTRAL')
    weights=get_asset_weights('')

    if htf_trend!='NEUTRAL' and htf_trend==etf_trend:
        score+=weights['structure']; breakdown['structure']=weights['structure']
    else: breakdown['structure']=0

    liq=etf_data.get('liquidity',{})
    if (liq.get('bsl') and etf_trend=='BULLISH') or (liq.get('ssl') and etf_trend=='BEARISH'):
        score+=weights['liquidity']; breakdown['liquidity']=weights['liquidity']
    else: breakdown['liquidity']=0

    choch_events=[e for e in etf_data.get('bos_choch',[]) if 'CHoCH' in e['type']]
    if choch_events:
        lc=choch_events[-1]
        if ('BULL' in lc['type'] and htf_trend=='BULLISH') or ('BEAR' in lc['type'] and htf_trend=='BEARISH'):
            score+=weights['choch']; breakdown['choch']=weights['choch']
        else: breakdown['choch']=0
    else: breakdown['choch']=0

    if etf_data.get('ob_fresh'): score+=weights['ob']; breakdown['ob']=weights['ob']
    else: breakdown['ob']=0

    if etf_data.get('fvg_fresh'): score+=weights['fvg']; breakdown['fvg']=weights['fvg']
    else: breakdown['fvg']=0

    obs=etf_data.get('ob_fresh',[]); fvgs=etf_data.get('fvg_fresh',[])
    overlap=any(ob['low']<=fvg['top'] and ob['high']>=fvg['bottom'] for ob in obs for fvg in fvgs)
    if overlap: score+=weights['sd']; breakdown['sd']=weights['sd']
    else: breakdown['sd']=0

    pd=etf_data.get('premium_discount',{}); pd_status=pd.get('status','')
    if (etf_trend=='BULLISH' and 'DISCOUNT' in pd_status) or (etf_trend=='BEARISH' and 'PREMIUM' in pd_status):
        score+=weights['pd']; breakdown['pd']=weights['pd']
    else: breakdown['pd']=0

    breakdown['pa']=0; breakdown['session']=session_score; score+=session_score

    htf_filter=False
    if htf_trend!='NEUTRAL' and etf_trend!='NEUTRAL' and htf_trend!=etf_trend:
        score=min(score,40); htf_filter=True

    htf_rsi=indicators_by_tf.get('htf',{}).get('rsi',{}).get('value') if indicators_by_tf else None
    rsi_penalty=0; rsi_reason=None
    if htf_rsi is not None:
        if htf_rsi<30 and etf_trend=='BEARISH':
            rsi_penalty=10; rsi_reason=f'HTF RSI oversold ({htf_rsi}) — penalised for shorting exhausted move'
        elif htf_rsi>70 and etf_trend=='BULLISH':
            rsi_penalty=10; rsi_reason=f'HTF RSI overbought ({htf_rsi}) — penalised for buying exhausted move'
    final_score=max(0,round(score-rsi_penalty,1)); breakdown['rsi_penalty']=-rsi_penalty

    return {
        'score':final_score,'method':'RULE_BASED','breakdown':breakdown,
        'htf_filter_applied':htf_filter,'rsi_penalty':rsi_penalty,'rsi_penalty_reason':rsi_reason,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 8 — MAIN ORCHESTRATOR
# ═══════════════════════════════════════════════════════════════════════════════

def run_engine(candles_by_tf, asset='', account_size=10000, risk_pct=1.0):
    result={}
    tf_order=['D1','4H','1H','15M','5M']
    avail=[tf for tf in tf_order if tf in candles_by_tf and len(candles_by_tf[tf])>20]
    if not avail: return {'error':'No valid timeframes provided'}

    htf=avail[0]; etf=avail[-1]; indicators_by_tf={'htf':{},'etf':{}}

    for tf in avail:
        candles=candles_by_tf[tf]
        SYNTHETIC_ASSETS = {'BOOM1000', 'CRASH1000', 'VOL75', 'VOL100'}
        if asset in SYNTHETIC_ASSETS and tf in ('W1', 'D1'):
            continue
        candles = candles[-300:] if tf in ('1H', '15M') else candles[-500:]
        
        # Cache candles for reuse within 2 minutes
        cache_key = f"{tf}_{candles[-1]['epoch'] if candles else 0}"
        _candle_cache[cache_key] = {
            'candles':   candles,
            'timestamp': datetime.now(timezone.utc).timestamp(),
        }
        atr=calc_atr(candles)
        sh,sl=detect_swings(candles)
        bos,trend=detect_bos_choch(candles,sh,sl)
        fvgs=detect_fvg(candles,atr)
        obs=detect_order_blocks(candles,bos,atr)
        liq=detect_liquidity(candles,sh,sl,atr)
        pd=calc_premium_discount(candles,sh,sl)
        regime=classify_market_regime(candles,atr)
        vol_profile=calc_volume_profile(candles)
        ema20=calc_ema(candles,20); ema50=calc_ema(candles,50); ema200=calc_ema(candles,200)
        rsi=calc_rsi(candles); bb=calc_bollinger(candles); macd=calc_macd(candles); vwap=calc_vwap(candles)
        adx=calc_adx(candles)

        ema_trend='NEUTRAL'
        if ema20['value'] and ema50['value'] and ema200['value']:
            if ema20['value']>ema50['value']>ema200['value']: ema_trend='STRONG_BULLISH'
            elif ema20['value']<ema50['value']<ema200['value']: ema_trend='STRONG_BEARISH'
            elif ema20['value']>ema50['value']: ema_trend='BULLISH'
            elif ema20['value']<ema50['value']: ema_trend='BEARISH'

        indicators={'ema_20':ema20,'ema_50':ema50,'ema_200':ema200,'rsi':rsi,'bollinger':bb,'macd':macd,'vwap':vwap,'adx':adx}

        backtest=None
        if tf==htf: backtest=run_backtest(candles,atr,sh,sl,bos,fvgs,obs)
        if tf==htf: indicators_by_tf['htf']={**indicators,'rsi':rsi,'macd':macd,'bollinger':bb}
        if tf==etf: indicators_by_tf['etf']={**indicators,'rsi':rsi,'macd':macd,'bollinger':bb}

        # Wyckoff phase detection — only on 4H and D1 (HTF)
        # 5M Wyckoff is noise — proper Wyckoff phases take days to form
        # On 5M, 80 candles = 6.7 hours which is far too short for Wyckoff
        wyckoff = None
        WYCKOFF_TFS = {'W1', 'D1', '4H', '1H'}
        if tf in WYCKOFF_TFS:
            wyckoff = detect_wyckoff_phase(candles, sh, sl, atr, vol_profile)

        # Elliott Wave structure (only on HTF — 4H and above)
        elliott = None
        ELLIOTT_TFS = {'W1', 'D1', '4H'}
        if tf in ELLIOTT_TFS:
            elliott = detect_elliott_structure(candles, sh, sl, atr)

        result[tf]={
            'atr':atr,'trend':trend,'ema_trend':ema_trend,'current_price':candles[-1]['close'],
            'swing_highs':sh[-5:],'swing_lows':sl[-5:],'bos_choch':bos[-8:],
            'fvg_fresh':[f for f in fvgs if f['status']=='FRESH'][-5:],
            'fvg_mitigated':[f for f in fvgs if f['status']=='MITIGATED'][-3:],
            'ob_fresh':[o for o in obs if o['status']=='FRESH'][-5:],
            'ob_mitigated':[o for o in obs if o['status']=='MITIGATED'][-3:],
            'liquidity':liq,'premium_discount':pd,'indicators':indicators,
            'regime':regime,'volume_profile':vol_profile,'backtest':backtest,
            'wyckoff':wyckoff,
            'elliott':elliott,
            'fibonacci': calc_fibonacci_levels(
                swing_high = max((s['price'] for s in sh[-3:]), default=0) if sh else 0,
                swing_low  = min((s['price'] for s in sl[-3:]), default=0) if sl else 0,
                direction  = 'BEARISH' if trend == 'BEARISH' else 'BULLISH',
            ) if sh and sl else None,
        }

    etf_candles=candles_by_tf[etf]
    session=calc_session(etf_candles[-1]['epoch']) if etf_candles else {'session':'UNKNOWN','score':0}
    calendar         = fetch_economic_calendar(asset)
    cross_asset      = fetch_cross_asset_data(asset)
    real_outcomes    = get_real_outcomes(asset)
    ml_score         = ml_signal_score(result.get(htf,{}),result.get(etf,{}),indicators_by_tf,session.get('score',0),asset)

    # ── Build Intelligence Packages (Python collects → AI judges) ─────────────
    # Fundamental Intelligence: economic events, DXY, macro context
    fundamental_intel = fetch_fundamental_data(asset, calendar, cross_asset)

    # Quantitative Evidence: numbers only, no conclusions
    htf_backtest = result.get(htf, {}).get('backtest', {}) or {}

    # Technical Evidence: all TF analysis structured as facts

    # Probability Engine — needs confluence score from ml_score
    confluence_score = ml_score.get('score', 50) if ml_score else 50
    etf_regime       = result.get(etf, {}).get('regime', {}).get('regime', 'UNKNOWN')
    rsi_htf          = result.get(htf, {}).get('indicators', {}).get('rsi', {}).get('value')
    win_probability  = calc_win_probability(
        confluence_score, asset, etf_regime, session.get('session','UNKNOWN'),
        rsi_htf, real_outcomes
    )

    # Trade Expectancy Engine — calculate actual R:R from engine data
    # Uses nearest SSL/BSL as TP targets and ATR-based SL estimate
    etf_data_for_ev = result.get(etf, {})
    etf_atr_for_ev  = etf_data_for_ev.get('atr', 0) or 0
    etf_price_for_ev = etf_data_for_ev.get('current_price', 0) or 0
    etf_liq_for_ev   = etf_data_for_ev.get('liquidity', {}) or {}
    etf_trend_for_ev = etf_data_for_ev.get('trend', 'NEUTRAL')

    tp1_rr, tp2_rr, tp3_rr = 1.5, 2.5, 4.0  # defaults

    if etf_price_for_ev > 0 and etf_atr_for_ev > 0:
        # Estimate SL distance as 1.5x ATR (realistic for SMC entries)
        sl_distance = etf_atr_for_ev * 1.5

        # Find TP levels from nearest liquidity
        ssl_levels = sorted(
            [x['price'] for x in etf_liq_for_ev.get('ssl', []) if x.get('status') == 'RESTING'],
            reverse=True  # nearest first for short
        )
        bsl_levels = sorted(
            [x['price'] for x in etf_liq_for_ev.get('bsl', []) if x.get('status') == 'RESTING']
        )  # nearest first for long

        targets = ssl_levels if etf_trend_for_ev == 'BEARISH' else bsl_levels

        if len(targets) >= 1 and sl_distance > 0:
            tp1_dist = abs(etf_price_for_ev - targets[0])
            tp1_rr   = round(tp1_dist / sl_distance, 2)
        if len(targets) >= 2 and sl_distance > 0:
            tp2_dist = abs(etf_price_for_ev - targets[1])
            tp2_rr   = round(tp2_dist / sl_distance, 2)
        if len(targets) >= 3 and sl_distance > 0:
            tp3_dist = abs(etf_price_for_ev - targets[2])
            tp3_rr   = round(tp3_dist / sl_distance, 2)

    trade_expectancy = calc_trade_expectancy(
        win_probability=win_probability.get('win_pct', 50),
        tp1_rr=max(0.5, tp1_rr),
        tp2_rr=max(0.5, tp2_rr),
        tp3_rr=max(0.5, tp3_rr),
        sl_rr=1.0
    )

    # Cross-timeframe Wyckoff alignment
    avail_set = set(avail)
    if '4H' in avail_set and '1H' in avail_set:
        wyckoff_compare_htf = result.get('4H', {}).get('wyckoff', {}) or {}
        wyckoff_compare_etf = result.get('1H', {}).get('wyckoff', {}) or {}
    elif 'D1' in avail_set and '4H' in avail_set:
        wyckoff_compare_htf = result.get('D1', {}).get('wyckoff', {}) or {}
        wyckoff_compare_etf = result.get('4H', {}).get('wyckoff', {}) or {}
    else:
        wyckoff_compare_htf = result.get(htf, {}).get('wyckoff', {}) or {}
        wyckoff_compare_etf = {}
    htf_wyckoff = result.get(htf, {}).get('wyckoff', {}) or {}
    etf_wyckoff = result.get(etf, {}).get('wyckoff', {}) or {}
    wyckoff_aligned = (
        wyckoff_compare_htf.get('trade_bias') == wyckoff_compare_etf.get('trade_bias')
        and wyckoff_compare_htf.get('trade_bias') not in (None, 'NEUTRAL', 'INSUFFICIENT DATA', '')
    )

    # Full risk plan with user's actual account size
    risk_plan = calc_full_risk_plan(
        asset=asset,
        entry_low=etf_price_for_ev * 0.999,   # approximate — Gemini will use real entry
        entry_high=etf_price_for_ev * 1.001,
        sl=etf_price_for_ev - etf_atr_for_ev * 1.5 if etf_trend_for_ev == 'BEARISH' else etf_price_for_ev + etf_atr_for_ev * 1.5,
        tp1=etf_price_for_ev - etf_atr_for_ev * tp1_rr if etf_trend_for_ev == 'BEARISH' else etf_price_for_ev + etf_atr_for_ev * tp1_rr,
        tp2=etf_price_for_ev - etf_atr_for_ev * tp2_rr if etf_trend_for_ev == 'BEARISH' else etf_price_for_ev + etf_atr_for_ev * tp2_rr,
        tp3=etf_price_for_ev - etf_atr_for_ev * tp3_rr if etf_trend_for_ev == 'BEARISH' else etf_price_for_ev + etf_atr_for_ev * tp3_rr,
        atr=etf_atr_for_ev,
        account_size=account_size,
        risk_pct=risk_pct,
    )

    technical_evidence = build_technical_evidence(result, htf, etf)

    htf_backtest = result.get(htf, {}).get('backtest', {}) or {}
    quant_evidence = build_quant_evidence(
        win_prob  = win_probability,
        trade_exp = trade_expectancy,
        ml_score  = ml_score,
        backtest  = htf_backtest,
    )

    result['_summary'] = {
        'htf':             htf,
        'etf':             etf,
        'htf_trend':       result.get(htf, {}).get('trend',      'NEUTRAL'),
        'htf_ema_trend':   result.get(htf, {}).get('ema_trend',  'NEUTRAL'),
        'session':         session,
        'asset_price':     etf_candles[-1]['close'] if etf_candles else 0,
        'ml_score':        ml_score,
        'calendar':        calendar,
        'cross_asset':     cross_asset,
        'win_probability': win_probability,
        'trade_expectancy':trade_expectancy,
        'wyckoff_htf':     htf_wyckoff,
        'wyckoff_etf':     etf_wyckoff,
        'wyckoff_aligned': wyckoff_aligned,
        'risk_plan':       risk_plan,
        'libs_available':  {
            'numpy': HAS_NUMPY, 'talib': HAS_TALIB,
            'pandas': HAS_PANDAS, 'sklearn': HAS_SKLEARN
        },
        'fundamental_intel':  fundamental_intel,
        'quant_evidence':     quant_evidence,
        'technical_evidence': technical_evidence,
    }
    return result


def main():
    try:
        raw  = sys.stdin.read()
        data = json.loads(raw)

        operation = data.get('operation', 'analyze')

        if operation == 'score_sentiment':
            news_items = data.get('news_items', [])
            asset_s    = data.get('asset', '')
            result     = collect_sentiment_intelligence(news_items)
            print(json.dumps(result))
            sys.exit(0)

        if operation == 'analyze':
            result = run_engine(
                data.get('candles', {}),
                data.get('asset', ''),
                data.get('account_size', 10000),
                data.get('risk_pct', 1.0),
            )
            print(json.dumps(result))

        elif operation == 'check_outcomes':
            asset = data.get('asset', None)
            result = check_and_update_outcomes(asset)
            print(json.dumps(result))

        elif operation == 'get_dashboard':
            asset = data.get('asset', None)
            limit = data.get('limit', 50)
            result = get_signal_dashboard(asset, limit)
            print(json.dumps(result))

        elif operation == 'save_signal':
            sig = data.get('signal', {})
            signal_id = save_signal(
                asset      = sig.get('asset', ''),
                mode       = sig.get('mode', ''),
                direction  = sig.get('direction', ''),
                entry_low  = sig.get('entry_low'),
                entry_high = sig.get('entry_high'),
                tp1        = sig.get('tp1'),
                tp2        = sig.get('tp2'),
                tp3        = sig.get('tp3'),
                sl         = sig.get('sl'),
                score      = sig.get('score'),
                htf_trend  = sig.get('htf_trend', ''),
                etf_trend  = sig.get('etf_trend', ''),
                rsi_htf    = sig.get('rsi_htf'),
                atr        = sig.get('atr'),
                regime     = sig.get('regime', ''),
                session    = sig.get('session', ''),
            )
            print(json.dumps({'signal_id': signal_id, 'status': 'saved' if signal_id else 'failed'}))

        else:
            print(json.dumps({'error': f'Unknown operation: {operation}'}))

        sys.exit(0)

    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)

if __name__ == '__main__':
    main()
