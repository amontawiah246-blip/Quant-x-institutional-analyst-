const fs = require('fs');
let server = fs.readFileSync('engine.py', 'utf8');

server = server.replace(
    /url = f'https:\/\/api.twelvedata.com\/quote\?symbol=\{symbol\}&apikey=\{api_key\}'/g,
    "from urllib.parse import quote\n        url = f'https://api.twelvedata.com/quote?symbol={quote(symbol)}&apikey={api_key}'"
);

fs.writeFileSync('engine.py', server);
console.log('patched URL encoding');
