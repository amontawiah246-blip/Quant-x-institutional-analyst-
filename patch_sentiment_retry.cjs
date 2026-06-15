const fs = require('fs');
let server = fs.readFileSync('server.ts', 'utf8');

const oldSentimentAI = `          const aiSentResp = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: sentimentAIPrompt }] }],
            config: { temperature: 0.1, maxOutputTokens: 600 },
          });

          const rawAI = (aiSentResp.text || '').replace(/\`\`\`json|\`\`\`/g, '').trim();`;

const newSentimentAI = `          let aiSentResp: any;
          let attempt = 0;
          const backoff = [2000, 5000, 10000];
          while (attempt < 3) {
            try {
              aiSentResp = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [{ role: 'user', parts: [{ text: sentimentAIPrompt }] }],
                config: { temperature: 0.1, maxOutputTokens: 600 },
              });
              break;
            } catch (err: any) {
              attempt++;
              if (attempt >= 3) throw err;
              await new Promise(r => setTimeout(r, backoff[attempt - 1]));
            }
          }

          const rawAI = (aiSentResp.text || '').replace(/\`\`\`json|\`\`\`/g, '').trim();`;

server = server.replace(oldSentimentAI, newSentimentAI);
fs.writeFileSync('server.ts', server);
console.log('AI sentiment retry wrapper added.');
