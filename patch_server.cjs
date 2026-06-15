const fs = require('fs');

let text = fs.readFileSync('server.ts', 'utf8');

// FIX 3
const old_rss = `const RSS_SOURCES: Record<string, {url:string; name:string}[]> = {
  XAUUSD: [
    {url:'https://www.forexlive.com/feed/news',         name:'ForexLive'},
    {url:'https://www.dailyfx.com/feeds/market-news',   name:'DailyFX'},
    {url:'https://www.fxstreet.com/rss/news',           name:'FXStreet'},
  ],
  XAGUSD: [
    {url:'https://www.forexlive.com/feed/news',         name:'ForexLive'},
    {url:'https://www.fxstreet.com/rss/news',           name:'FXStreet'},
  ],
  BTCUSD: [
    {url:'https://cointelegraph.com/rss',               name:'CoinTelegraph'},
    {url:'https://coindesk.com/arc/outboundfeeds/rss/', name:'CoinDesk'},
  ],
  ETHUSD: [
    {url:'https://cointelegraph.com/rss/tag/ethereum',  name:'CoinTelegraph ETH'},
    {url:'https://coindesk.com/arc/outboundfeeds/rss/', name:'CoinDesk'},
  ],
  DEFAULT: [
    {url:'https://www.forexlive.com/feed/news',         name:'ForexLive'},
    {url:'https://www.dailyfx.com/feeds/market-news',   name:'DailyFX'},
    {url:'https://www.fxstreet.com/rss/news',           name:'FXStreet'},
  ],
};`;
const idx_rss = text.indexOf('const RSS_SOURCES: Record');
const end_rss = text.indexOf('};', idx_rss) + 2;
const new_rss = `const RSS_SOURCES: Record<string, {url:string; name:string}[]> = {
  XAUUSD: [
    {url:'https://www.forexlive.com/feed/news',         name:'ForexLive'},
    {url:'https://www.dailyfx.com/feeds/market-news',   name:'DailyFX'},
    {url:'https://www.fxstreet.com/rss/news',           name:'FXStreet'},
  ],
  XAGUSD: [
    {url:'https://www.forexlive.com/feed/news',         name:'ForexLive'},
    {url:'https://www.fxstreet.com/rss/news',           name:'FXStreet'},
  ],
  BTCUSD: [
    {url:'https://cointelegraph.com/rss',               name:'CoinTelegraph'},
    {url:'https://coindesk.com/arc/outboundfeeds/rss/', name:'CoinDesk'},
    {url:'https://decrypt.co/feed',                     name:'Decrypt'},
  ],
  ETHUSD: [
    {url:'https://cointelegraph.com/rss/tag/ethereum',  name:'CoinTelegraph ETH'},
    {url:'https://coindesk.com/arc/outboundfeeds/rss/', name:'CoinDesk'},
  ],
  SOLUSD: [
    {url:'https://cointelegraph.com/rss',               name:'CoinTelegraph'},
    {url:'https://coindesk.com/arc/outboundfeeds/rss/', name:'CoinDesk'},
  ],
  DEFAULT: [
    {url:'https://www.forexlive.com/feed/news',         name:'ForexLive'},
    {url:'https://www.dailyfx.com/feeds/market-news',   name:'DailyFX'},
    {url:'https://www.fxstreet.com/rss/news',           name:'FXStreet'},
  ],
};`;
text = text.substring(0, idx_rss) + new_rss + text.substring(end_rss);

// FIX 9
const old_tf_start = text.indexOf("const TIMEFRAMES: Record");
const old_tf_end = text.indexOf("};", old_tf_start) + 2;
const new_tf = `const SYNTHETICS = new Set(['BOOM1000','CRASH1000','VOL75','VOL100','R_75','R_100']);

const TIMEFRAMES: Record<string, { granularity: number; label: string }[]> = {
  'SCALPING MODE': [
    {granularity:604800,label:'W1'},
    {granularity:14400, label:'4H'},
    {granularity:3600,  label:'1H'},
    {granularity:900,   label:'15M'},
    {granularity:300,   label:'5M'},
  ],
  'SWING MODE': [
    {granularity:604800,label:'W1'},
    {granularity:86400, label:'D1'},
    {granularity:14400, label:'4H'},
    {granularity:3600,  label:'1H'},
    {granularity:900,   label:'15M'},
  ],
  'SYNTHETIC SCALP': [
    {granularity:14400, label:'4H'},
    {granularity:3600,  label:'1H'},
    {granularity:900,   label:'15M'},
    {granularity:300,   label:'5M'},
  ],
  'SYNTHETIC SWING': [
    {granularity:14400, label:'4H'},
    {granularity:3600,  label:'1H'},
    {granularity:900,   label:'15M'},
  ],
};`;
text = text.substring(0, old_tf_start) + new_tf + text.substring(old_tf_end);

const tf_replace = `      const isSynthetic = SYNTHETICS.has(derivSymbol);
      const modeKey = isSynthetic
        ? (mode === 'SWING MODE' ? 'SYNTHETIC SWING' : 'SYNTHETIC SCALP')
        : mode;
      const timeframes = TIMEFRAMES[modeKey] || TIMEFRAMES['SCALPING MODE'];`;
text = text.replace(/      const timeframes = TIMEFRAMES\[mode\]\|\|TIMEFRAMES\['SCALPING MODE'\];/g, tf_replace);

// FIX 7
text = text.replace(/NO TRADE SETUP FOUND/g, '⛔ VERDICT: AVOID');

fs.writeFileSync('server.ts', text);
console.log('server.ts patched successfully.');
