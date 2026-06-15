const fs = require('fs');
let server = fs.readFileSync('server.ts', 'utf8');

server = server.replace(/const backoff = \[2000, 5000, 10000\];/g, 'const backoff = [1500, 3000];');
server = server.replace(/const backoff=\[3000,8000,15000\];/g, 'const backoff=[2000, 4000];');

fs.writeFileSync('server.ts', server);
console.log('Backoffs reduced.');
