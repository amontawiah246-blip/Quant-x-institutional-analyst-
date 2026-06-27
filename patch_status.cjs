const fs = require('fs');

// Patch App.tsx to pass statusMsg
let textApp = fs.readFileSync('src/App.tsx', 'utf8');
textApp = textApp.replace(/<AnalysisResult result=\{result\} isLoading=\{isLoading\} \/>/, '<AnalysisResult result={result} isLoading={isLoading} statusMsg={statusMsg} />');
fs.writeFileSync('src/App.tsx', textApp);

// Patch AnalysisResult.tsx snippet
let textAR = fs.readFileSync('src/components/AnalysisResult.tsx', 'utf8');
if (!textAR.includes('statusMsg?: string')) {
  textAR = textAR.replace('  isLoading: boolean;', '  isLoading: boolean;\n  statusMsg?: string;');
  textAR = textAR.replace('export function AnalysisResult({ result, isLoading }: AnalysisResultProps) {', 'export function AnalysisResult({ result, isLoading, statusMsg }: AnalysisResultProps) {');
}

textAR = textAR.replace(/<span className="animate-pulse">Fetching live market data from Deriv\.\.\.<\/span>/g, '<span className="animate-pulse">{statusMsg || "Fetching live market data from Deriv..."}</span>');
textAR = textAR.replace(/<span className="text-xs text-slate-300">Running structure & confluence engines<\/span>/g, '');

fs.writeFileSync('src/components/AnalysisResult.tsx', textAR);
console.log('Passed statusMsg to AnalysisResult and updated loading UI.');
