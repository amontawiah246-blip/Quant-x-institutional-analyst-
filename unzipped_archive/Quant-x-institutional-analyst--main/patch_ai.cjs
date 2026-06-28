const fs = require('fs');
let server = fs.readFileSync('server.ts', 'utf8');

const oldDecl = `      const derivSymbol = DERIV_SYMBOLS[asset];
      if(!derivSymbol) return res.status(400).json({error:\`No Deriv symbol: \${asset}\`});`;
const newDecl = `      const derivSymbol = DERIV_SYMBOLS[asset];
      if(!derivSymbol) return res.status(400).json({error:\`No Deriv symbol: \${asset}\`});
      const ai = new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY as string});`;

server = server.replace(oldDecl, newDecl);

const oldInit = `      const ai = new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY});`;
server = server.replace(oldInit, '');

fs.writeFileSync('server.ts', server);
console.log('AI declaration lifted.');
