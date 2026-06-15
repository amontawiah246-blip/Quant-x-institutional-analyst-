const fs = require('fs');
let server = fs.readFileSync('server.ts', 'utf8');

// Add AbortSignal to OpenRouter fetch
server = server.replace(
  `const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method:'POST',`,
  `const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        signal: controller.signal,
        method:'POST',`
);
server = server.replace(
  `if(!resp.ok) {`,
  `clearTimeout(timeoutId);
      if(!resp.ok) {`
);

// We should also patch callGitHubModel
server = server.replace(
  `const client = new OpenAI({
    baseURL: 'https://models.inference.ai.azure.com',
    apiKey: token,
  });
  const response = await client.chat.completions.create({`,
  `const client = new OpenAI({
    baseURL: 'https://models.inference.ai.azure.com',
    apiKey: token,
    timeout: 15000,
  });
  const response = await client.chat.completions.create({`
);

fs.writeFileSync('server.ts', server);
console.log('Timeouts added.');
