const fs = require('fs');
let server = fs.readFileSync('engine.py', 'utf8');

const newFunctions = `
def fetch_twelve_data_price(symbol: str) -> dict:
    api_key = os.environ.get('TWELVEDATA_API_KEY')
    if not api_key:
        return fetch_stooq_price('^DXY' if symbol == 'DXY' else symbol)

    cache_key = 'twelve_' + symbol
    now_ts = datetime.now(timezone.utc).timestamp()
    if (cache_key in _stooq_cache and
            (now_ts - _stooq_cache_time.get(cache_key, 0)) < STOOQ_CACHE_TTL):
        return _stooq_cache[cache_key]

    result = {
        'status': 'UNAVAILABLE', 'symbol': symbol,
        'price': None, 'prev_close': None, 'change_pct': None,
        'direction': 'UNKNOWN', 'strength': 'UNKNOWN',
        'raw_fact': f'{symbol}: data unavailable',
    }
    try:
        url = f'https://api.twelvedata.com/quote?symbol={symbol}&apikey={api_key}'
        req = Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())

        if 'code' in data and data['code'] != 200:
            raise Exception(data.get('message', 'Twelve Data Error'))
        if 'close' not in data:
            raise Exception('Invalid Twelve Data response')

        current_close = float(data['close'])
        previous_close = float(data.get('previous_close', current_close))
        change_pct = float(data.get('percent_change', 0))

        direction = 'FLAT'
        strength = 'WEAK'
        if change_pct > 0.5: direction = 'UP'; strength = 'STRONG'
        elif change_pct > 0.1: direction = 'UP'; strength = 'MODERATE'
        elif change_pct < -0.5: direction = 'DOWN'; strength = 'STRONG'
        elif change_pct < -0.1: direction = 'DOWN'; strength = 'MODERATE'

        result.update({
            'status': 'OK', 'price': round(current_close, 4),
            'prev_close': round(previous_close, 4),
            'change_pct': round(change_pct, 3), 'direction': direction, 'strength': strength,
            'raw_fact': f'{symbol}: {current_close:.4f} ({change_pct:+.3f}%) [{direction}/{strength}]'
        })
    except Exception as e:
        result['error'] = str(e)

    _stooq_cache[cache_key] = result
    _stooq_cache_time[cache_key] = now_ts
    return result


def fetch_fred_data(series_id: str) -> dict:
    api_key = os.environ.get('FRED_API_KEY')
    if not api_key:
        v = '10USY.B' if series_id == 'DGS10' else '2USY.B'
        return fetch_stooq_price(v)

    cache_key = 'fred_' + series_id
    now_ts = datetime.now(timezone.utc).timestamp()
    if (cache_key in _stooq_cache and
            (now_ts - _stooq_cache_time.get(cache_key, 0)) < STOOQ_CACHE_TTL):
        return _stooq_cache[cache_key]

    result = {
        'status': 'UNAVAILABLE', 'symbol': series_id,
        'price': None, 'prev_close': None, 'change_pct': None,
        'direction': 'UNKNOWN', 'strength': 'UNKNOWN',
        'raw_fact': f'{series_id}: data unavailable',
    }

    try:
        url = f'https://api.stlouisfed.org/fred/series/observations?series_id={series_id}&api_key={api_key}&file_type=json&sort_order=desc&limit=2'
        req = Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())

        obs = data.get('observations', [])
        if not obs or len(obs) == 0:
            raise Exception('No observations array')

        # Find first valid observation
        valid_obs = [o for o in obs if o['value'] != '.']
        if len(valid_obs) == 0:
            raise Exception('No valid data points found in FRED response')

        current_val = float(valid_obs[0]['value'])
        prev_val = float(valid_obs[1]['value']) if len(valid_obs) > 1 else current_val

        change_pct = 0
        if prev_val and prev_val != 0:
            change_pct = (current_val - prev_val) / prev_val * 100

        direction = 'FLAT'
        strength = 'WEAK'
        if change_pct > 0.5: direction = 'UP'; strength = 'STRONG'
        elif change_pct > 0.1: direction = 'UP'; strength = 'MODERATE'
        elif change_pct < -0.5: direction = 'DOWN'; strength = 'STRONG'
        elif change_pct < -0.1: direction = 'DOWN'; strength = 'MODERATE'

        result.update({
            'status': 'OK', 'price': round(current_val, 4),
            'prev_close': round(prev_val, 4),
            'change_pct': round(change_pct, 3), 'direction': direction, 'strength': strength,
            'raw_fact': f'{series_id}: {current_val:.4f} ({change_pct:+.3f}%) [{direction}/{strength}]'
        })
    except Exception as e:
        result['error'] = str(e)

    _stooq_cache[cache_key] = result
    _stooq_cache_time[cache_key] = now_ts
    return result

def fetch_dxy_live() -> dict:
`;

server = server.replace('def fetch_dxy_live() -> dict:', newFunctions);

server = server.replace("data = fetch_stooq_price('^DXY')", "data = fetch_twelve_data_price('DXY')");
server = server.replace("us10y = fetch_stooq_price('10USY.B')", "us10y = fetch_fred_data('DGS10')");
server = server.replace("us02y = fetch_stooq_price('2USY.B')", "us02y = fetch_fred_data('DGS2')");

fs.writeFileSync('engine.py', server);
console.log('Patch complete.');
