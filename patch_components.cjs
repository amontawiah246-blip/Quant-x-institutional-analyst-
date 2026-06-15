const fs = require('fs');

let text = fs.readFileSync('src/components/AnalysisResult.tsx', 'utf8');

// FIX 7+25
const old_rej = `  const isRejected = result.includes('NO TRADE SETUP FOUND');`;
const new_rej = `  const isRejected = result.includes('VERDICT: AVOID') ||
                     result.includes('**AVOID**') ||
                     result.includes('NO TRADE SETUP FOUND');

  const isExecute = result.includes('VERDICT: EXECUTE') ||
                    result.includes('**EXECUTE**');

  const isWait = result.includes('VERDICT: WAIT') ||
                 result.includes('**WAIT**');`;

text = text.replace(old_rej, new_rej);

fs.writeFileSync('src/components/AnalysisResult.tsx', text);
console.log('AnalysisResult.tsx patched successfully.');
