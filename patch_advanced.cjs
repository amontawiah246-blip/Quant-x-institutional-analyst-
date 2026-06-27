const fs = require('fs');

// --- PATCH ENGINE.PY ---
let engine = fs.readFileSync('engine.py', 'utf8');

const stooqCode = `
# ── Stooq Free Quotes (no API key required) ───────────────────────────────────
_stooq_cache: dict = {}
_stooq_cache_time: dict = {}
STOOQ_CACHE_TTL = 300  # 5 minutes

def fetch_stooq_price(symbol: str) -> dict:
    """Fetch price and daily change from stooq.com. Free, no API key."""
    now_ts = datetime.now(timezone.utc).timestamp()
    if (symbol in _stooq_cache and
            (now_ts - _stooq_cache_time.get(symbol, 0)) < STOOQ_CACHE_TTL):
        return _stooq_cache[symbol]

    result = {
        'status': 'UNAVAILABLE', 'symbol': symbol,
        'price': None, 'prev_close': None, 'change_pct': None,
        'direction': 'UNKNOWN', 'strength': 'UNKNOWN',
        'raw_fact': f'{symbol}: data unavailable',
    }
    try:
        url = f'https://stooq.com/q/d/l/?s={symbol}&i=d'
        req = Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
        with urlopen(req, timeout=10) as resp:
            text = resp.read().decode('utf-8', errors='replace')
        lines = [l.strip() for l in text.strip().splitlines() if l.strip()]
        if len(lines) < 3:
            _stooq_cache[symbol] = result
            _stooq_cache_time[symbol] = now_ts
            return result
        def parse_row(row):
            parts = row.split(',')
            return float(parts[4]) if len(parts) >= 5 else None
        current_close  = parse_row(lines[-1])
        previous_close = parse_row(lines[-2]) if len(lines) >= 3 else None
        if current_close is None:
            _stooq_cache[symbol] = result
            _stooq_cache_time[symbol] = now_ts
            return result
        change_pct = None
        direction = 'FLAT'
        strength = 'WEAK'
        if previous_close and previous_close != 0:
            change_pct = round((current_close - previous_close) / previous_close * 100, 3)
            if   change_pct >  0.5: direction = 'UP';   strength = 'STRONG'
            elif change_pct >  0.1: direction = 'UP';   strength = 'MODERATE'
            elif change_pct < -0.5: direction = 'DOWN'; strength = 'STRONG'
            elif change_pct < -0.1: direction = 'DOWN'; strength = 'MODERATE'
            else:                   direction = 'FLAT';  strength = 'WEAK'
        result.update({
            'status': 'OK', 'price': round(current_close, 4),
            'prev_close': round(previous_close, 4) if previous_close else None,
            'change_pct': change_pct, 'direction': direction, 'strength': strength,
            'raw_fact': (
                f'{symbol}: {current_close:.4f} ({change_pct:+.3f}%) [{direction}/{strength}]'
                if change_pct is not None else f'{symbol}: {current_close:.4f}'
            ),
        })
    except Exception as e:
        result['error'] = str(e)
    _stooq_cache[symbol] = result
    _stooq_cache_time[symbol] = now_ts
    return result


def fetch_dxy_live() -> dict:
    """Real DXY (US Dollar Index) from stooq. DXY UP = Gold bearish pressure."""
    data = fetch_stooq_price('^DXY')
    if data['status'] == 'OK':
        data['interpretation'] = (
            f"DXY is {data['direction']} ({data['change_pct']:+.3f}% today). "
            + ('USD strengthening — headwind for Gold and risk assets.'
               if data['direction'] == 'UP' else
               'USD weakening — tailwind for Gold, EUR, GBP.'
               if data['direction'] == 'DOWN' else
               'USD stable — neutral macro impact.')
        )
    return data


def fetch_us_yields_live() -> dict:
    """Real US10Y and US02Y Treasury yields from stooq. Rising yields = Gold headwind."""
    us10y = fetch_stooq_price('10USY.B')
    us02y = fetch_stooq_price('2USY.B')
    result = {
        'status': 'PARTIAL', 'us10y': us10y, 'us02y': us02y,
        'spread': None, 'curve': 'UNKNOWN',
        'raw_fact': 'Yield data unavailable',
        'gold_implication': 'Unknown yield impact on Gold',
    }
    if us10y['status'] == 'OK' and us02y['status'] == 'OK':
        result['status'] = 'OK'
        spread = round((us10y['price'] or 0) - (us02y['price'] or 0), 4)
        result['spread'] = spread
        result['curve']  = 'NORMAL' if spread > 0 else 'INVERTED'
        yield_direction  = us10y.get('direction', 'FLAT')
        result['gold_implication'] = (
            f"US10Y at {us10y['price']}% ({us10y['change_pct']:+.3f}% today). "
            + ('RISING yields = higher USD real return = bearish pressure on Gold.'
               if yield_direction == 'UP' else
               'FALLING yields = lower USD real return = bullish for Gold.'
               if yield_direction == 'DOWN' else
               'STABLE yields = neutral yield impact on Gold.')
            + f' Curve: {result["curve"]} (spread: {spread:+.4f}%)'
        )
        result['raw_fact'] = (
            f'US10Y: {us10y["price"]}% ({us10y["change_pct"]:+.3f}%) | '
            f'US02Y: {us02y["price"]}% ({us02y["change_pct"]:+.3f}%) | '
            f'Curve: {result["curve"]} ({spread:+.4f}%)'
        )
    elif us10y['status'] == 'OK':
        result['status'] = 'PARTIAL'
        result['raw_fact'] = f'US10Y: {us10y["price"]}% ({us10y["change_pct"]:+.3f}%)'
        result['gold_implication'] = (
            'RISING yields = bearish Gold pressure.' if us10y.get('direction') == 'UP' else
            'FALLING yields = bullish Gold support.'  if us10y.get('direction') == 'DOWN' else
            'Stable yields — neutral impact.'
        )
    return result

`;

engine = engine.replace('# Cross-asset symbol mappings on Deriv', stooqCode + '# Cross-asset symbol mappings on Deriv');

const oldCrossAsset = `CROSS_ASSET_SYMBOLS = {
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
        'RISK':  'frxAUDUSD',
        'DXY':   'frxUSDJPY',
    },
    'ETHUSD': {
        'RISK':  'frxAUDUSD',
        'DXY':   'frxUSDJPY',
    },
    'SOLUSD': {
        'RISK':  'frxAUDUSD',
        'DXY':   'frxUSDJPY',
    },
    'EURUSD': {
        'DXY':   'frxUSDJPY',
        'DXY2':  'frxUSDCHF',
    },
    'GBPUSD': {
        'DXY':   'frxUSDJPY',
        'RISK':  'frxAUDUSD',
    },
    'USDJPY': {
        'RISK':  'frxAUDUSD',       # JPY crosses follow risk sentiment
    },
}`;

const newCrossAsset = `# DXY and US yields now come from stooq.com (real data) — not Deriv proxies
# Deriv is still used for supplementary risk proxies
CROSS_ASSET_SYMBOLS = {
    'XAUUSD': {
        'RISK':  'frxAUDUSD',   # Risk-on/off proxy
        'OIL':   'frxUSOIL',    # Crude — inflation proxy (if available on Deriv)
    },
    'XAGUSD': {
        'RISK':  'frxAUDUSD',
    },
    'BTCUSD': {
        'RISK':  'frxAUDUSD',
        'DXY':   'frxUSDJPY',
    },
    'EURUSD': {
        'DXY':   'frxUSDJPY',
        'DXY2':  'frxUSDCHF',
    },
    'GBPUSD': {
        'DXY':   'frxUSDJPY',
        'RISK':  'frxAUDUSD',
    },
    'USDJPY': {
        'RISK':  'frxAUDUSD',
    },
}`;

if (!engine.includes(oldCrossAsset)) {
  console.log("oldCrossAsset could not be found EXACTLY. I will replace it using regex.");
  engine = engine.replace(/CROSS_ASSET_SYMBOLS\s*=\s*{[\s\S]*?}/, newCrossAsset);
} else {
  engine = engine.replace(oldCrossAsset, newCrossAsset);
}


let oldFetchCrossAsset = `def fetch_cross_asset_data(asset: str) -> dict:
    """Fetch correlated asset data from Deriv to build macro bias context."""
    cache_key = asset
    now_ts = datetime.now(timezone.utc).timestamp()

    if cache_key in _cross_asset_cache:
        cached_data, cached_ts = _cross_asset_cache[cache_key]
        if (now_ts - cached_ts) < CROSS_ASSET_CACHE_TTL:
            return cached_data

    result = {
        'status': 'OK',
        'asset': asset,
        'correlations': [],
        'macro_bias': 'NEUTRAL'
    }

    symbols = CROSS_ASSET_SYMBOLS.get(asset, {})
    for role, symbol in symbols.items():
        try:
            url = f'https://api.deriv.com/websockets/v3?ticks_history={symbol}&end=latest&count=20&style=candles&granularity=3600&app_id=1089'
            req = Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode())
            
            candles = data.get('candles', [])
            if len(candles) < 5:
                continue
                
            closes = [float(c['close']) for c in candles]
            current = closes[-1]
            
            # Simple 10-period avg for short-term correlation trend
            avg_10 = sum(closes[-10:]) / 10
            pct = round((current - avg_10) / avg_10 * 100, 3)
            
            direction = 'UP' if pct > 0.05 else 'DOWN' if pct < -0.05 else 'FLAT'
            strength = 'STRONG' if abs(pct) > 0.3 else 'MODERATE' if abs(pct) > 0.1 else 'WEAK'
            
            result['correlations'].append({
                'role': role,
                'symbol': symbol,
                'current': round(current, 5),
                'direction': direction,
                'pct_change': pct,
                'strength': strength
            })
            
        except Exception as e:
            result['correlations'].append({
                'role': role,
                'symbol': symbol,
                'direction': 'UNAVAILABLE',
                'error': str(e)
            })

    # Derive macro bias for major assets based on correlations
    dxy_signals  = [c for c in result['correlations'] if c['role'].startswith('DXY') and c.get('direction') not in ('UNAVAILABLE', None)]
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
    }

    if asset in ('XAUUSD', 'XAGUSD'):
        if dxy_bearish_gold and risk_off_gold_bid:
            result['macro_bias'] = 'MIXED (DXY headwind, Risk-off tailwind)'
        elif dxy_bearish_gold:
            result['macro_bias'] = 'BEARISH (DXY headwind)'
        elif usd_direction == 'DOWN' and risk_off_gold_bid:
            result['macro_bias'] = 'STRONGLY BULLISH (DXY tailwind + Risk-off bid)'
        elif usd_direction == 'DOWN':
            result['macro_bias'] = 'BULLISH (DXY tailwind)'
    elif asset in ('BTCUSD', 'ETHUSD', 'SOLUSD'):
        if risk_data:
            if risk_data['direction'] == 'UP':
                result['macro_bias'] = 'BULLISH macro (risk-on)'
            elif risk_data['direction'] == 'DOWN':
                result['macro_bias'] = 'BEARISH macro (risk-off)'
    elif asset in ('EURUSD', 'GBPUSD', 'AUDUSD', 'NZDUSD'):
        if usd_direction == 'UP':
            result['macro_bias'] = 'BEARISH (DXY strengthening)'
        elif usd_direction == 'DOWN':
            result['macro_bias'] = 'BULLISH (DXY weakening)'

    _cross_asset_cache[cache_key] = (result, now_ts)
    return result`;

const newFetchCrossAsset = `def fetch_cross_asset_data(asset: str) -> dict:
    """
    Fetch correlated asset data for macro context.
    XAUUSD: uses real DXY + US10Y/US02Y from stooq.com
    Others: uses Deriv-native correlated assets as before
    """
    cache_key = asset
    now_ts = datetime.now(timezone.utc).timestamp()
    if (cache_key in _cross_asset_cache and
            (now_ts - _cross_asset_cache_time.get(cache_key, 0)) < CROSS_ASSET_CACHE_TTL):
        return _cross_asset_cache[cache_key]

    result = {
        'status': 'OK', 'asset': asset,
        'correlations': [], 'macro_bias': 'NEUTRAL', 'live_macro': {},
    }

    if asset in ('XAUUSD', 'XAGUSD'):
        # Use REAL DXY and Treasuries from stooq
        dxy    = fetch_dxy_live()
        yields = fetch_us_yields_live()

        # Supplementary: AUDUSD risk proxy from Deriv
        try:
            url = ('https://api.deriv.com/websockets/v3?ticks_history=frxAUDUSD'
                   '&end=latest&count=20&style=candles&granularity=3600&app_id=1089')
            req = Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode())
            candles = data.get('candles', [])
            if len(candles) >= 5:
                closes = [float(c['close']) for c in candles]
                current = closes[-1]
                avg_10  = sum(closes[-10:]) / 10
                pct     = round((current - avg_10) / avg_10 * 100, 3)
                direction = 'UP' if pct > 0.05 else 'DOWN' if pct < -0.05 else 'FLAT'
                strength  = 'STRONG' if abs(pct) > 0.3 else 'MODERATE' if abs(pct) > 0.1 else 'WEAK'
                risk_data = {
                    'role': 'RISK', 'symbol': 'frxAUDUSD', 'source': 'deriv',
                    'current': round(current, 5), 'direction': direction,
                    'pct_change': pct, 'strength': strength,
                }
                result['correlations'].append(risk_data)
        except Exception:
            pass

        result['live_macro'] = {
            'dxy':    dxy,
            'us10y':  yields.get('us10y', {}),
            'us02y':  yields.get('us02y', {}),
            'yield_spread': yields.get('spread'),
            'yield_curve':  yields.get('curve'),
            'yield_gold_implication': yields.get('gold_implication', ''),
        }

        # Add DXY/yields as correlations for downstream compatibility
        if dxy['status'] == 'OK':
            result['correlations'].append({
                'role': 'DXY', 'symbol': '^DXY', 'source': 'stooq',
                'current': dxy['price'], 'direction': dxy['direction'],
                'pct_change': dxy['change_pct'], 'strength': dxy['strength'],
                'raw_fact': dxy['raw_fact'],
            })
        us10y = yields.get('us10y', {})
        if us10y.get('status') == 'OK':
            result['correlations'].append({
                'role': 'US10Y', 'symbol': '10USY.B', 'source': 'stooq',
                'current': us10y['price'], 'direction': us10y['direction'],
                'pct_change': us10y['change_pct'], 'strength': us10y['strength'],
                'raw_fact': us10y['raw_fact'],
            })

        # Compute live macro bias for Gold
        dxy_up    = dxy.get('direction')  == 'UP'
        yields_up = us10y.get('direction') == 'UP'
        risk_up   = any(
            c.get('role') == 'RISK' and c.get('direction') == 'UP'
            for c in result['correlations']
        )
        dxy_pct   = dxy.get('change_pct') or 0
        y10_pct   = us10y.get('change_pct') or 0

        if dxy_up and yields_up and not risk_up:
            result['macro_bias'] = (
                f'BEARISH for Gold — DXY {dxy_pct:+.2f}% + US10Y {y10_pct:+.2f}% both rising. '
                f'USD strength + rising real yields = classic Gold headwind.'
            )
        elif not dxy_up and not yields_up:
            result['macro_bias'] = (
                f'BULLISH for Gold — DXY {dxy_pct:+.2f}% + US10Y {y10_pct:+.2f}% both falling. '
                f'Weaker USD + falling yields = tailwind for Gold.'
            )
        elif dxy_up and not yields_up:
            result['macro_bias'] = (
                f'MIXED — DXY {dxy_pct:+.2f}% (headwind) but US10Y {y10_pct:+.2f}% (supportive). '
                f'Conflicting signals — reduce position size.'
            )
        elif not dxy_up and yields_up:
            result['macro_bias'] = (
                f'MIXED — DXY {dxy_pct:+.2f}% (supportive) but US10Y {y10_pct:+.2f}% (headwind). '
                f'Partial tailwind — cautious.'
            )
        elif risk_up and not dxy_up:
            result['macro_bias'] = (
                f'CAUTIOUSLY BULLISH — Risk-on (AUD up) + DXY {dxy_pct:+.2f}% softening.'
            )
        else:
            result['macro_bias'] = (
                f'NEUTRAL — DXY {dxy_pct:+.2f}% US10Y {y10_pct:+.2f}%. No clear direction.'
            )

    else:
        # Non-gold: existing Deriv-based correlation logic
        symbols = CROSS_ASSET_SYMBOLS.get(asset, {})
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
                closes = [float(c['close']) for c in candles]
                current = closes[-1]
                avg_10  = sum(closes[-10:]) / 10
                pct     = round((current - avg_10) / avg_10 * 100, 3)
                direction = 'UP' if pct > 0.05 else 'DOWN' if pct < -0.05 else 'FLAT'
                strength  = 'STRONG' if abs(pct) > 0.3 else 'MODERATE' if abs(pct) > 0.1 else 'WEAK'
                result['correlations'].append({
                    'role': role, 'symbol': symbol, 'current': round(current, 5),
                    'direction': direction, 'pct_change': pct, 'strength': strength,
                })
            except Exception as e:
                result['correlations'].append({
                    'role': role, 'symbol': symbol,
                    'direction': 'UNAVAILABLE', 'error': str(e),
                })

        dxy_data  = next((c for c in result['correlations'] if c['role'] == 'DXY'), None)
        risk_data = next((c for c in result['correlations'] if c['role'] == 'RISK'), None)
        if asset in ('BTCUSD', 'ETHUSD', 'SOLUSD') and risk_data:
            result['macro_bias'] = (
                'BULLISH macro (risk-on)' if risk_data['direction'] == 'UP' else
                'BEARISH macro (risk-off)' if risk_data['direction'] == 'DOWN' else
                'NEUTRAL macro'
            )
        elif dxy_data and asset in ('EURUSD', 'GBPUSD', 'AUDUSD', 'NZDUSD'):
            result['macro_bias'] = (
                f'BEARISH (DXY strengthening {dxy_data["pct_change"]:+.3f}%)'
                if dxy_data['direction'] == 'UP' else
                f'BULLISH (DXY weakening {dxy_data["pct_change"]:+.3f}%)'
            )

    _cross_asset_cache[cache_key] = result
    _cross_asset_cache_time[cache_key] = now_ts
    return result`;

if (!engine.includes(oldFetchCrossAsset)) {
  console.log("Could not find oldFetchCrossAsset. Trying to replace using regex...");
  engine = engine.replace(/def fetch_cross_asset_data\(asset: str\) -> dict:[\s\S]*?    _cross_asset_cache_time\[cache_key\] = now_ts\n    return result/, newFetchCrossAsset);
  // fallback if it fails:
  if (!engine.includes(newFetchCrossAsset.substring(0, 50))) {
    // try the original regex
     engine = engine.replace(/def fetch_cross_asset_data\(asset: str\) -> dict:[\s\S]*?    _cross_asset_cache\[cache_key\] = \(result, now_ts\)\n    return result/, newFetchCrossAsset);
  }
} else {
  engine = engine.replace(oldFetchCrossAsset, newFetchCrossAsset);
}


let oldFetchFundDataHacky = `        'XAUUSD': {
            'asset': 'XAUUSD',
            'primary_drivers': ['DXY', 'US10Y real yield', 'risk sentiment', 'CB demand', 'geopolitical'],
            'correlations': cross_asset_data.get('correlations', []),
            'macro_bias': cross_asset_data.get('macro_bias', 'NEUTRAL'),
            'note': 'Gold priced inversely to USD. Risk-off (AUDUSD down) supports Gold as safe haven.'
        },`;

let newFetchFundDataHacky = `    # ── Asset-specific macro context (uses LIVE DATA for XAUUSD) ──────────────
    live_macro = cross_asset_data.get('live_macro', {}) if cross_asset_data else {}
    dxy_live   = live_macro.get('dxy', {})
    us10y_live = live_macro.get('us10y', {})

    # NEW: populate yield_environment field
    if us10y_live.get('status') == 'OK':
        fundamental['yield_environment'] = {
            'source':             'stooq_realtime',
            'us10y_price':        us10y_live.get('price'),
            'us10y_change':       us10y_live.get('change_pct'),
            'us10y_direction':    us10y_live.get('direction'),
            'raw_fact':           us10y_live.get('raw_fact', ''),
            'gold_implication':   live_macro.get('yield_gold_implication', ''),
        }

    # Update DXY environment with live data if available
    if dxy_live.get('status') == 'OK':
        fundamental['dxy_environment'] = {
            'source':          'stooq_realtime',
            'price':           dxy_live.get('price'),
            'change_pct':      dxy_live.get('change_pct'),
            'direction':       dxy_live.get('direction'),
            'strength':        dxy_live.get('strength'),
            'raw_fact':        dxy_live.get('raw_fact', ''),
            'interpretation':  dxy_live.get('interpretation', ''),
        }

    if asset == 'XAUUSD':
        dxy_fact   = fundamental.get('dxy_environment', {}).get('raw_fact', 'DXY: unavailable')
        yield_fact = fundamental.get('yield_environment', {}).get('raw_fact', 'US10Y: unavailable')
        macro_bias = cross_asset_data.get('macro_bias', 'NEUTRAL') if cross_asset_data else 'NEUTRAL'
        fundamental['macro_context'] = {
            'asset':           'XAUUSD',
            'primary_drivers': ['DXY', 'US10Y real yield', 'risk sentiment', 'CB demand', 'geopolitical'],
            'live_dxy':        dxy_fact,
            'live_yields':     yield_fact,
            'live_macro_bias': macro_bias,
            'note': (
                f'Gold priced inversely to USD + real yields. '
                f'{dxy_fact}. {yield_fact}. Bias: {macro_bias}'
            ),
        }
    else:
        fundamental['macro_context'] = {}`;

if (engine.includes(oldFetchFundDataHacky)) {
  engine = engine.replace(oldFetchFundDataHacky, newFetchFundDataHacky);
} else {
  // Let's do it right.
  const oldMacroContextFacts = `    MACRO_CONTEXT_FACTS = {
        'XAUUSD': {
            'asset': 'XAUUSD',
            'primary_drivers': ['DXY', 'US10Y real yield', 'risk sentiment', 'CB demand', 'geopolitical'],
            'correlations': cross_asset_data.get('correlations', []),
            'macro_bias': cross_asset_data.get('macro_bias', 'NEUTRAL'),
            'note': 'Gold priced inversely to USD. Risk-off (AUDUSD down) supports Gold as safe haven.'
        },`;

  const newMacroContextFacts = `    # ── Asset-specific macro context (uses LIVE DATA for XAUUSD) ──────────────
    live_macro = cross_asset_data.get('live_macro', {}) if cross_asset_data else {}
    dxy_live   = live_macro.get('dxy', {})
    us10y_live = live_macro.get('us10y', {})

    # NEW: populate yield_environment field
    if us10y_live.get('status') == 'OK':
        fundamental['yield_environment'] = {
            'source':             'stooq_realtime',
            'us10y_price':        us10y_live.get('price'),
            'us10y_change':       us10y_live.get('change_pct'),
            'us10y_direction':    us10y_live.get('direction'),
            'raw_fact':           us10y_live.get('raw_fact', ''),
            'gold_implication':   live_macro.get('yield_gold_implication', ''),
        }

    # Update DXY environment with live data if available
    if dxy_live.get('status') == 'OK':
        fundamental['dxy_environment'] = {
            'source':          'stooq_realtime',
            'price':           dxy_live.get('price'),
            'change_pct':      dxy_live.get('change_pct'),
            'direction':       dxy_live.get('direction'),
            'strength':        dxy_live.get('strength'),
            'raw_fact':        dxy_live.get('raw_fact', ''),
            'interpretation':  dxy_live.get('interpretation', ''),
        }

    MACRO_CONTEXT_FACTS = {
        'XAUUSD_placeholder': None, # We'll replace it below
`;
    if(engine.includes(oldMacroContextFacts)) {
      engine = engine.replace(oldMacroContextFacts, newMacroContextFacts);
    } else {
       engine = engine.replace(/MACRO_CONTEXT_FACTS\s*=\s*{\s*'XAUUSD': {[\s\S]*?},/, newFetchFundDataHacky);
    }
}
fs.writeFileSync('engine.py', engine);


// --- PATCH SERVER.TS ---
let server = fs.readFileSync('server.ts', 'utf8');

const oldRssSourcesXauusd = `  XAUUSD: [
    {url:'https://www.forexlive.com/feed/news',              name:'ForexLive'},
    {url:'https://www.dailyfx.com/feeds/market-news',        name:'DailyFX'},
    {url:'https://www.fxstreet.com/rss/news',                name:'FXStreet'},
  ],`;
const newRssSourcesXauusd = `  XAUUSD: [
    {url:'https://www.forexlive.com/feed/news',              name:'ForexLive'},
    {url:'https://www.dailyfx.com/feeds/market-news',        name:'DailyFX'},
    {url:'https://www.fxstreet.com/rss/news',                name:'FXStreet'},
    {url:'https://www.kitco.com/rss/kitconews.xml',          name:'Kitco'},
    {url:'https://www.investing.com/rss/news_301.rss',       name:'Investing.com'},
  ],`;

if(server.includes(oldRssSourcesXauusd)) {
  server = server.replace(oldRssSourcesXauusd, newRssSourcesXauusd);
} else {
  console.log('Could not find strict match for XAUUSD RSS. Replacing via regex...');
  server = server.replace(/XAUUSD: \[[\s\S]*?\],/, newRssSourcesXauusd);
}

const oldSentimentScoring = `      // Pass news items to Python for sentiment scoring
      const sentimentResult = await runPythonOperation({
        operation:  'score_sentiment',
        news_items: (newsData as any).items || [],
        asset:      asset,
      });

      let sentimentIntel = sentimentResult?.error ? null : sentimentResult;
      if(engineData?._summary && sentimentIntel) {
        engineData._summary.sentiment_intel = sentimentIntel;
      }`;
      
const newSentimentScoring = `      // ── Tier 1: Python keyword sentiment (fast baseline) ──────────────────
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
              \`\${i+1}. [\${h.ageMinutes}min ago | \${h.source}] \${h.title}\`
              + (h.summary ? \`\\n   \${h.summary.slice(0, 100)}\` : '')
            ).join('\\n');

          const dxyFact   = engineData?._summary?.fundamental_intel?.dxy_environment?.raw_fact || 'DXY unavailable';
          const yieldFact = engineData?._summary?.fundamental_intel?.yield_environment?.raw_fact || 'Yields unavailable';
          const macroBias = engineData?._summary?.cross_asset?.macro_bias || 'Unknown';

          const sentimentAIPrompt = \`You are a professional macro analyst evaluating news sentiment for \${asset}.

LIVE MACRO CONTEXT:
- \${dxyFact}
- \${yieldFact}
- Macro bias: \${macroBias}

RECENT HEADLINES (newest first):
\${headlineBlock}

KEYWORD SCORE (Python baseline): \${sentimentIntel.sentiment_label} (score: \${sentimentIntel.overall_score})

For each headline, classify: GENUINE (new market-moving info), PRICED_IN (market expected this), NOISE (irrelevant), or TRAP (sounds bullish but likely distribution/retail bait).

Rules:
- "Fed stays hawkish" after months of hawkish guidance = PRICED_IN
- "CPI beats" when consensus expected a beat = PRICED_IN
- "Emergency rate decision" or "surprise GDP miss" = GENUINE
- Gold bullish news during DXY strength = possible TRAP
- Headlines describing moves that already happened = PRICED_IN

Respond ONLY with this JSON (no markdown):
{"ai_sentiment_label":"STRONGLY_BULLISH|BULLISH|NEUTRAL|BEARISH|STRONGLY_BEARISH","ai_sentiment_score":0.0,"priced_in_assessment":"one sentence","actionable_headlines":["..."],"noise_headlines":["..."],"trap_detected":false,"trap_explanation":null,"ai_sentiment_note":"2-3 sentences for the trader","confidence":"HIGH|MEDIUM|LOW"}\`;

          const aiSentResp = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: sentimentAIPrompt }] }],
            config: { temperature: 0.1, maxOutputTokens: 600 },
          });

          const rawAI = (aiSentResp.text || '').replace(/\`\`\`json|\`\`\`/g, '').trim();
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
                  ? \`DIVERGENCE: Keywords=\${sentimentIntel.sentiment_label} vs AI=\${parsed.ai_sentiment_label} — likely priced-in\`
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
      }`;
if(server.includes(oldSentimentScoring)) {
  server = server.replace(oldSentimentScoring, newSentimentScoring);
} else {
  console.log("Could not find sentiment scoring exact. Doing regex...");
  server = server.replace(/\/\/ Pass news items to Python for sentiment scoring[\s\S]*?engineData\._summary\.sentiment_intel = sentimentIntel;\n      }/, newSentimentScoring);
}


const oldFormatEngine = `  if(s.sentiment_intel?.status==='OK'){
    const si = s.sentiment_intel;
    block += \`\\nSENTIMENT INTELLIGENCE:\\n\`;
    block += \`  Overall: \${si.sentiment_label} (score:\${si.overall_score}) | Bull:\${si.bullish_count} Bear:\${si.bearish_count} Neutral:\${si.neutral_count}\\n\`;
    block += \`  Note: \${si.note}\\n\`;`;

// actually we want to replace the WHOLE if statement
const newFormatEngine = `  if(s.sentiment_intel?.status==='OK'){
    const si = s.sentiment_intel;
    block += \`\\nSENTIMENT INTELLIGENCE:\\n\`;
    if(si.ai_interpreted) {
      block += \`  AI Sentiment: \${si.ai_sentiment_label} (score:\${si.ai_sentiment_score}) [Confidence:\${si.ai_confidence}]\\n\`;
      block += \`  Keyword Baseline: \${si.keyword_sentiment_label} (score:\${si.keyword_score})\\n\`;
      if(si.sentiment_divergence !== 'ALIGNED') block += \`  ⚠️ \${si.sentiment_divergence}\\n\`;
      if(si.trap_detected) block += \`  🪤 TRAP: \${si.trap_explanation}\\n\`;
      if(si.priced_in_assessment) block += \`  Priced-In: \${si.priced_in_assessment}\\n\`;
      if(si.actionable_headlines?.length){
        block += \`  ACTIONABLE:\\n\`;
        si.actionable_headlines.slice(0,3).forEach((h:string) => block += \`    ✓ "\${h}"\\n\`);
      }
      if(si.noise_headlines?.length){
        block += \`  NOISE (priced-in):\\n\`;
        si.noise_headlines.slice(0,2).forEach((h:string) => block += \`    ~ "\${h}"\\n\`);
      }
      if(si.ai_sentiment_note) block += \`  AI Note: \${si.ai_sentiment_note}\\n\`;
    } else {
      block += \`  Overall: \${si.sentiment_label} (score:\${si.overall_score}) | Bull:\${si.bullish_count} Bear:\${si.bearish_count}\\n\`;
      block += \`  Note: \${si.note}\\n\`;
    }
    if(si.breaking_items?.length){
      block += \`  BREAKING:\\n\`;
      si.breaking_items.slice(0,3).forEach((item:any) =>
        block += \`    [\${item.age_minutes}min] "\${item.title}" → \${item.sentiment}\\n\`
      );
    }
    if(!si.ai_interpreted && si.scored_headlines?.length){
      block += \`  TOP HEADLINES:\\n\`;
      si.scored_headlines.slice(0,5).forEach((item:any) => {
        if(!item.is_breaking) block += \`    [\${item.source}] "\${item.title}" → \${item.sentiment}\\n\`;
      });
    }
  }

  // NEW: Show DXY + Yield environment in formatEngineResults
  if(s.fundamental_intel?.dxy_environment?.raw_fact) {
    const dxy_env = s.fundamental_intel.dxy_environment;
    block += \`\\nLIVE DXY: \${dxy_env.raw_fact}\\n\`;
    if(dxy_env.interpretation) block += \`  \${dxy_env.interpretation}\\n\`;
  }
  if(s.fundamental_intel?.yield_environment?.raw_fact) {
    const y_env = s.fundamental_intel.yield_environment;
    block += \`\\nLIVE YIELDS: \${y_env.raw_fact}\\n\`;
    if(y_env.gold_implication) block += \`  \${y_env.gold_implication}\\n\`;
  }`;

// we are trying to replace the whole if block for sentiment_intel in formatEngineResults.
// A simpler robust regex:
const matchStr = "if(s.sentiment_intel?.status==='OK'){";
const startIndex = server.indexOf(matchStr);
if (startIndex !== -1) {
  let depth = 1;
  let endIndex = startIndex + matchStr.length;
  for (; endIndex < server.length && depth > 0; endIndex++) {
    if (server[endIndex] === '{') depth++;
    else if (server[endIndex] === '}') depth--;
  }
  const fullIfBlock = server.substring(startIndex, endIndex);
  server = server.replace(fullIfBlock, newFormatEngine);
}


// System prompt Contradiction Detection
const newContradiction = `═══════════════════════════════════════════════════════
CONTRADICTION DETECTION — CROSS-EXAMINATION ENGINE
═══════════════════════════════════════════════════════

Before delivering a verdict, run this 3-layer cross-examination explicitly.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LAYER 1 — TECHNICAL vs MACRO (use LIVE NUMBERS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Always cite actual DXY % and US10Y % from the live macro section. Never write "DXY is strengthening" without the number.

GOLD CROSS-EXAMINATION:
- BUY + DXY UP + US10Y UP = CONTRADICTION (headwind). WAIT or reduce size.
- BUY + DXY DOWN + US10Y DOWN = ALIGNED (tailwind). Highest conviction long.
- BUY + DXY DOWN + US10Y UP = MIXED (partial headwind). Reduce size 50%.
- BUY + DXY UP + US10Y DOWN = MIXED (partial headwind). Cautious.
- SELL + DXY UP + US10Y UP = ALIGNED. Highest conviction short.
- SELL + DXY DOWN + US10Y DOWN = CONTRADICTION. Avoid shorting into macro tailwind.

STATE EXPLICITLY: "DXY is [direction] [X.XX]% today. US10Y is [direction] [X.XX]%.
This is [ALIGNED WITH / CONTRADICTING] the [BUY/SELL] technical signal."

If macro data is unavailable: "Macro data unavailable — treating as NEUTRAL. Conviction reduced."

FOR FOREX PAIRS:
- DXY UP = headwind for EUR/GBP/AUD, tailwind for USDJPY/USDCAD
- Always state: "DXY [direction] means [pair] faces [tailwind/headwind]"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LAYER 2 — SENTIMENT CROSS-EXAMINATION (Priced-In Test)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Check sentiment_intel for:
- ai_interpreted = TRUE → use ai_sentiment_label (more accurate than keyword score)
- trap_detected = TRUE → "Smart money may be distributing into positive headlines"
- sentiment_divergence != ALIGNED → "Keywords say X but AI says Y — items are priced-in"
- priced_in_assessment → quote it directly

IF ai_interpreted = FALSE (keyword scoring only), apply these manual rules:
- "Fed stays hawkish" after 3+ hawkish meetings = PRICED_IN
- "Gold surges on safe-haven demand" if geopolitical risk was ongoing = PRICED_IN
- "Emergency cut/hike" or "surprise GDP" = GENUINE
- Headlines describing past moves = PRICED_IN

STATE EXPLICITLY:
"AI sentiment: [label]. [X] headlines actionable. [Y] headlines priced-in or noise.
[TRAP DETECTED / No trap.] Net sentiment impact: [SUPPORTS/CONTRADICTS/NEUTRAL]."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LAYER 3 — CALENDAR RISK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Events within 30 minutes = HARD WAIT (no exceptions): NFP, CPI, FOMC, GDP, PCE, Fed speech
Events within 60 minutes = WAIT, reduce size: ISM PMI, Retail Sales, ADP, PPI

SURPRISE INTERPRETATION FOR GOLD:
- CPI BEAT (actual > forecast) → USD bullish → Gold bearish pressure
- CPI MISS (actual < forecast) → USD bearish → Gold bullish support
- NFP BEAT → USD bullish → Gold bearish pressure
- NFP MISS → USD bearish → Gold bullish support

STATE: "[Event] at [actual] vs [forecast] = [BEAT/MISS]. For \${asset}: [specific implication]."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CROSS-EXAMINATION VERDICT OUTPUT (MANDATORY FORMAT)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

After all three layers, output this explicit grid:

CROSS-EXAMINATION:
Technical: [BUY/SELL/NONE] → [aligned/conflict]
Macro (Live): [DXY X% + 10Y X%] → [supports/opposes]
Sentiment: [AI label, priced-in summary] → [supports/opposes/neutral]
Calendar: [CLEAR / EVENT in Xmin] → [go/wait/avoid]
CONTRADICTION LEVEL: NONE / MINOR / MODERATE / SEVERE

NONE = all layers aligned → highest conviction
MINOR = one layer mildly opposed → reduce size, proceed
MODERATE = one layer strongly OR two mildly opposed → WAIT for resolution
SEVERE = two+ layers strongly opposed → AVOID regardless of technical quality

When MODERATE or SEVERE: name the contradiction, explain which side dominates,
give the exact condition that resolves it.

Example output:
"MODERATE CONTRADICTION:
Technical: BUY — CHoCH on 15M, OB at 3285-3288, price in discount
Macro: BEARISH — DXY +0.42% today, US10Y +8bps to 4.31% (rising yields = headwind)
Sentiment: Bullish headlines but AI says PRICED_IN (rate cut hope story is 3 weeks old)
Calendar: CLEAR (next USD event in 4h)
VERDICT: WAIT — Valid technical setup but macro headwind reduces conviction.
Enter if DXY drops back below yesterday's close and US10Y pulls below 4.25%."`;


const contradictionIndex1 = server.indexOf("═══════════════════════════════════════════════════════\nCONTRADICTION DETECTION — CRITICAL");
const contradictionIndex2 = server.indexOf("═══════════════════════════════════════════════════════\nPROBABILITY RULES FOR EXECUTION PLAN", contradictionIndex1);

if (contradictionIndex1 !== -1 && contradictionIndex2 !== -1) {
  server = server.substring(0, contradictionIndex1) + newContradiction + "\n\n" + server.substring(contradictionIndex2);
} else {
  console.log("Could not find contradiction bounds.");
}

fs.writeFileSync('server.ts', server);

console.log("Patch advanced successfully processed.\n");
