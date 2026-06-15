const fs = require('fs');
let server = fs.readFileSync('server.ts', 'utf8');

server = server.replace(/timeout:45000/g, 'timeout:15000');

fs.writeFileSync('server.ts', server);
console.log('Python timeout reduced.');
