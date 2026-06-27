import http from 'http';

const data = JSON.stringify({
  asset: 'EURUSD',
  mode: 'SCALPING MODE',
  accountSize: 10000,
  riskPct: 1,
});

const req = http.request('http://localhost:3000/api/analyze', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    if (res.statusCode !== 200) {
      console.log('BODY:', body.substring(0, 1000));
    } else {
      console.log('BODY:', body.substring(0, 200) + '...');
    }
  });
});

req.on('error', e => console.error(e));
req.write(data);
req.end();
