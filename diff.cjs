const fs = require('fs');
const files = [
  'src/index.css',
  'src/components/LandingPage.tsx',
  'src/components/Dashboard.tsx',
  'src/components/ExtraModules.tsx',
  'src/components/AnalysisResult.tsx',
  'src/components/SignalsLogger.tsx'
];

let out = '';
for (const f of files) {
  if (!fs.existsSync(f)) continue;
  const oldLines = fs.readFileSync(f, 'utf8').split('\n');
  const newLines = fs.readFileSync(f+'.new', 'utf8').split('\n');
  
  let diffOut = `\n--- ${f}\n+++ ${f} (Proposed)\n`;
  let hasDiff = false;
  let matches = 0;
  for(let i=0; i<oldLines.length; i++) {
     if(oldLines[i] !== newLines[i]) {
        hasDiff = true;
        matches++;
        if (matches < 5) {
            diffOut += `- ${oldLines[i].trim()}\n+ ${newLines[i].trim()}\n`;
        }
     }
  }
  if (matches >= 5) diffOut += `... (and ${matches - 4} more similar class replacements in this file)\n`;
  if (hasDiff) out += diffOut;
}
console.log(out);
