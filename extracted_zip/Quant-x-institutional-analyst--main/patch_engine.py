import re
import os

with open('engine.py', 'r') as f:
    text = f.read()

# FIX #6 — Robust init_db()
init_db_replacement = """def init_db():
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
        print(f'ERROR: Could not initialize database: {e}', file=sys.stderr)"""

text = re.sub(r'def init_db\(\):[\s\S]*?conn\.close\(\)', init_db_replacement, text, count=1)

# FIX #1 — quant_evidence variable ordering
# Delete the old quant_evidence
text = re.sub(r'[ \t]*quant_evidence = build_quant_evidence\(\s*win_prob\s*=\s*win_probability if \'win_probability\' in dir\(\) else \{\},\s*trade_exp\s*=\s*trade_expectancy if \'trade_expectancy\' in dir\(\) else \{\},\s*ml_score\s*=\s*ml_score,\s*backtest\s*=\s*htf_backtest,\s*\)\n', '', text)

# Add quant_evidence after technical_evidence is calculated
# But we need to make sure htf_backtest is defined, actually wait, `quant_evidence = build_quant_evidence` does it.
quant_evidence_add = """    technical_evidence = build_technical_evidence(result, htf, etf)

    htf_backtest = result.get(htf, {}).get('backtest', {}) or {}
    quant_evidence = build_quant_evidence(
        win_prob  = win_probability,
        trade_exp = trade_expectancy,
        ml_score  = ml_score,
        backtest  = htf_backtest,
    )"""
# We will just find where `technical_evidence = build_technical_evidence` is right now, delete it, and put the new block at the end, right before result['_summary']
text = re.sub(r'[ \t]*technical_evidence = build_technical_evidence\(result, htf, etf\)\n', '', text)
text = text.replace("result['_summary'] = {", quant_evidence_add + "\n\n    result['_summary'] = {")


# FIX #15 — Add W1 to tf_order
text = text.replace("tf_order  = ['D1', '4H', '1H', '15M', '5M']", "tf_order  = ['W1', 'D1', '4H', '1H', '15M', '5M']")
text = text.replace("tf_order = ['D1', '4H', '1H', '15M', '5M']", "tf_order = ['W1', 'D1', '4H', '1H', '15M', '5M']")


# FIX #16 — Wyckoff on 1H, fix aligned check
text = text.replace("htf_timeframes = {'D1', '4H'}\n        if tf in htf_timeframes:", "WYCKOFF_TFS = {'W1', 'D1', '4H', '1H'}\n        if tf in WYCKOFF_TFS:")

old_wyckoff_check = """    htf_wyckoff = result.get(htf, {}).get('wyckoff', {}) or {}
    etf_wyckoff = result.get(etf, {}).get('wyckoff', {}) or {}
    wyckoff_aligned = (
        htf_wyckoff.get('trade_bias') == etf_wyckoff.get('trade_bias')
        and htf_wyckoff.get('trade_bias') not in (None, 'NEUTRAL', 'INSUFFICIENT DATA')
    )"""

new_wyckoff_check = """    avail_set = set(avail)
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
    )"""
text = text.replace(old_wyckoff_check, new_wyckoff_check)


# FIX #14 — ML threshold back to 50
old_ml_threshold = """            if len(real_outcomes) >= 20:
                # Train on REAL outcomes from database"""
new_ml_threshold = """            win_count_check  = sum(1 for o in real_outcomes if o[1] == 'WIN')
            loss_count_check = len(real_outcomes) - win_count_check
            if len(real_outcomes) >= 50 and win_count_check >= 10 and loss_count_check >= 10:
                # Train on REAL outcomes from database (50+ required for reliable ML)"""
text = text.replace(old_ml_threshold, new_ml_threshold)


# FIX #4 — Add hawkish/dovish keywords
old_bullish = """    BULLISH_KEYWORDS = [
        'surge', 'rally', 'jump', 'rise', 'gain', 'high', 'record', 'bull',
        'positive', 'strong', 'growth', 'recovery', 'demand', 'buy', 'upside',
        'breakout', 'support', 'accumulation', 'optimism', 'beat', 'better',
        'hawkish' if False else None,  # context-dependent — let AI judge
    ]
    BEARISH_KEYWORDS = [
        'fall', 'drop', 'decline', 'crash', 'loss', 'low', 'bear', 'sell',
        'negative', 'weak', 'contraction', 'recession', 'outflow', 'dump',
        'breakdown', 'resistance', 'distribution', 'pessimism', 'miss', 'worse',
        'selloff', 'plunge', 'tumble', 'collapse', 'fear',
    ]
    BULLISH_KEYWORDS = [k for k in BULLISH_KEYWORDS if k]"""

new_bullish = """    BULLISH_KEYWORDS = [
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
    ]"""
text = text.replace(old_bullish, new_bullish)

text = text.replace("'note':             'Raw keyword scoring only. AI must interpret context and whether sentiment is already priced in.',", "'note': 'Raw keyword scoring. AI must interpret hawkish/dovish context and whether sentiment is priced in.',\n        'monetary_terms_detected': [kw for kw in MONETARY_KEYWORDS if kw.lower() in ' '.join(i.get('title','') for i in news_items).lower()],")


# FIX #9 — Skip W1/D1 for synthetic assets
old_slice = """        candles = candles[-300:] if tf in ('1H', '15M') else candles[-500:]"""
new_slice = """        SYNTHETIC_ASSETS = {'BOOM1000', 'CRASH1000', 'VOL75', 'VOL100'}
        if asset in SYNTHETIC_ASSETS and tf in ('W1', 'D1'):
            continue
        candles = candles[-300:] if tf in ('1H', '15M') else candles[-500:]"""
text = text.replace(old_slice, new_slice)

with open('engine.py', 'w') as f:
    f.write(text)
print("engine.py patched successfully.")
