const fs = require('fs');

let text = fs.readFileSync('src/App.tsx', 'utf8');

// App.tsx
// Add AbortController inside handleAnalyze around `fetch`
// Add useEffect for STATUS_MESSAGES

if (!text.includes('STATUS_MESSAGES')) {
  // Add statusMsg state
  const stateUpdate = `  const [statusMsg, setStatusMsg] = useState('');`;
  text = text.replace('  const [isLoading, setIsLoading] = useState(false);', '  const [isLoading, setIsLoading] = useState(false);\n' + stateUpdate);
  
  // Add useEffect
  const effectUpdate = `
  const STATUS_MESSAGES = [
    'Fetching live market data from Deriv...',
    'Running structure & confluence engines...',
    'Scoring regime and probability...',
    'Generating institutional analysis...',
    'Formatting execution plan...',
  ];

  useEffect(() => {
    if (!isLoading) { setStatusMsg(''); return; }
    let i = 0;
    setStatusMsg(STATUS_MESSAGES[0]);
    const interval = setInterval(() => {
      i = Math.min(i + 1, STATUS_MESSAGES.length - 1);
      setStatusMsg(STATUS_MESSAGES[i]);
    }, 15000);
    return () => clearInterval(interval);
  }, [isLoading]);
  `;
  text = text.replace('  const handleAnalyze = async () => {', effectUpdate + '\n  const handleAnalyze = async () => {');
}

// Modify fetch call
if (!text.includes('new AbortController()')) {
  text = text.replace(/      const response = await fetch\('\/api\/analyze', {/g, `      const controller = new AbortController();
      const timeoutId  = setTimeout(() => controller.abort(), 120000);
      const response = await fetch('/api/analyze', {
        signal: controller.signal,`);
        
  text = text.replace(/      const data = await response\.json\(\);/g, `      clearTimeout(timeoutId);\n      const data = await response.json();`);
  
  text = text.replace(/        setResult\('Error communicating with the analysis engine\.'\);/g, `        if(err.name === 'AbortError' || err.name === 'AbortError') {
          setResult('**Request timed out** — Analysis took over 2 minutes. Please try again.');
        } else {
          setResult('Error communicating with the analysis engine.');
        }`);
}

// Ensure the loading message displays `statusMsg`
text = text.replace(/>Analyzing Market...<\/span>/g, '>{statusMsg || "Analyzing Market..."}</span>');

fs.writeFileSync('src/App.tsx', text);
console.log('App.tsx patched successfully.');
