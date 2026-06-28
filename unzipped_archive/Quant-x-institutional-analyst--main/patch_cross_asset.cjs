const fs = require('fs');
let server = fs.readFileSync('engine.py', 'utf8');

const regex = /def fetch_cross_asset_data\(asset: str\) -> dict:[\s\S]*?(?=def detect_wyckoff_phase)/;

const newFetchCrossAssetData = `def fetch_cross_asset_data(asset: str) -> dict:
    cache_key = asset
    now_ts = datetime.now(timezone.utc).timestamp()
    if (cache_key in _cross_asset_cache and
            (now_ts - _cross_asset_cache_time.get(cache_key, 0)) < CROSS_ASSET_CACHE_TTL):
        return _cross_asset_cache[cache_key]

    result = {
        'status': 'OK', 'asset': asset,
        'correlations': [], 'macro_bias': 'NEUTRAL', 'live_macro': {},
    }

    td_key = os.environ.get('TWELVEDATA_API_KEY')
    fred_key = os.environ.get('FRED_API_KEY')

    # Fetch foundational macro fields
    dxy = fetch_twelve_data_price('DXY') if td_key else fetch_stooq_price('^DXY')
    us10y = fetch_fred_data('DGS10') if fred_key else fetch_stooq_price('10USY.B')
    us02y = fetch_fred_data('DGS2') if fred_key else fetch_stooq_price('2USY.B')

    # Add DXY
    if dxy['status'] == 'OK':
        result['correlations'].append({
            'role': 'DXY', 'symbol': 'DXY', 'source': 'twelvedata' if td_key else 'stooq',
            'current': dxy['price'], 'direction': dxy['direction'],
            'pct_change': dxy['change_pct'], 'strength': dxy['strength'],
            'raw_fact': dxy['raw_fact'],
        })

    # Add US10Y
    if us10y['status'] == 'OK':
        result['correlations'].append({
            'role': 'US10Y', 'symbol': 'DGS10' if fred_key else '10USY.B', 'source': 'fred' if fred_key else 'stooq',
            'current': us10y['price'], 'direction': us10y['direction'],
            'pct_change': us10y['change_pct'], 'strength': us10y['strength'],
            'raw_fact': us10y['raw_fact'],
        })

    if us02y['status'] == 'OK':
        result['correlations'].append({
            'role': 'US02Y', 'symbol': 'DGS2' if fred_key else '2USY.B', 'source': 'fred' if fred_key else 'stooq',
            'current': us02y['price'], 'direction': us02y['direction'],
            'pct_change': us02y['change_pct'], 'strength': us02y['strength'],
            'raw_fact': us02y['raw_fact'],
        })

    # Additional Twelve Data / FRED metrics if keys available
    if td_key:
        for t_sym, role in [('VIX', 'VIX'), ('SPX', 'SP500'), ('IXIC', 'NASDAQ'), ('WTX/USD', 'OIL')]:
            t_data = fetch_twelve_data_price(t_sym)
            if t_data['status'] == 'OK':
                result['correlations'].append({
                    'role': role, 'symbol': t_sym, 'source': 'twelvedata',
                    'current': t_data['price'], 'direction': t_data['direction'],
                    'pct_change': t_data['change_pct'], 'strength': t_data['strength'],
                    'raw_fact': t_data['raw_fact']
                })
    if fred_key:
        rates = fetch_fred_data('DFF')
        if rates['status'] == 'OK':
            result['correlations'].append({
                'role': 'RATES', 'symbol': 'DFF', 'source': 'fred',
                'current': rates['price'], 'direction': rates['direction'],
                'pct_change': rates['change_pct'], 'strength': rates['strength'],
                'raw_fact': rates['raw_fact']
            })

    # Fallback to Deriv if no keys
    if not td_key:
        symbols = CROSS_ASSET_SYMBOLS.get(asset, {})
        for role, symbol in symbols.items():
            if role in ['DXY', 'US10Y', 'US02Y']: continue
            try:
                url = (f'https://api.deriv.com/websockets/v3?ticks_history={symbol}'
                       f'&end=latest&count=20&style=candles&granularity=3600&app_id=1089')
                req = Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                with urlopen(req, timeout=5) as resp:
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
                    'role': role, 'symbol': symbol, 'source': 'deriv', 'current': round(current, 5),
                    'direction': direction, 'pct_change': pct, 'strength': strength,
                })
            except Exception as e:
                pass

    # Build macro bias summary
    dxy_up    = dxy.get('direction') == 'UP'
    yields_up = us10y.get('direction') == 'UP'
    dxy_pct   = dxy.get('change_pct') or 0
    y10_pct   = us10y.get('change_pct') or 0

    risk_up = any(c.get('role') in ['SP500', 'NASDAQ', 'RISK'] and c.get('direction') == 'UP' for c in result['correlations'])

    if asset in ('XAUUSD', 'XAGUSD'):
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
            result['macro_bias'] = f'MIXED — DXY {dxy_pct:+.2f}% (headwind) but US10Y {y10_pct:+.2f}% (supportive). '
        elif not dxy_up and yields_up:
            result['macro_bias'] = f'MIXED — DXY {dxy_pct:+.2f}% (supportive) but US10Y {y10_pct:+.2f}% (headwind). '
        else:
            result['macro_bias'] = f'NEUTRAL — DXY {dxy_pct:+.2f}% US10Y {y10_pct:+.2f}%. No clear direction.'
    elif asset in ('BTCUSD', 'ETHUSD', 'SOLUSD'):
        result['macro_bias'] = (
            'BULLISH macro (risk-on)' if risk_up else
            'BEARISH macro (risk-off)' if not risk_up else
            'NEUTRAL macro'
        )
    elif asset in ('EURUSD', 'GBPUSD', 'AUDUSD', 'NZDUSD'):
        result['macro_bias'] = (
            f'BEARISH (DXY strengthening {dxy_pct:+.3f}%)' if dxy_up else
            f'BULLISH (DXY weakening {dxy_pct:+.3f}%)'
        )

    # Put live_macro for XAUUSD fallback handling
    result['live_macro'] = {
        'dxy': dxy,
        'us10y': us10y,
        'us02y': us02y
    }
    spread = None
    if us10y['status'] == 'OK' and us02y['status'] == 'OK':
        spread = round((us10y['price'] or 0) - (us02y['price'] or 0), 4)
        result['live_macro']['yield_spread'] = spread
        result['live_macro']['yield_curve'] = 'NORMAL' if spread > 0 else 'INVERTED'

    _cross_asset_cache[cache_key] = result
    _cross_asset_cache_time[cache_key] = now_ts
    return result

`;

let match = server.match(regex);
if (match) {
    server = server.replace(regex, newFetchCrossAssetData);
    fs.writeFileSync('engine.py', server);
    console.log('fetch_cross_asset_data patched.');
} else {
    console.log('Regex failed to match fetch_cross_asset_data.');
}
