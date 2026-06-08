import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit to allow large base64 image uploads
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  app.post('/api/analyze', async (req, res) => {
    try {
      const { asset, mode, image } = req.body;

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not configured.' });
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const systemInstruction = `
You are QUANT-X, an elite institutional-grade market analysis AI.
Your purpose is NOT to generate random buy or sell signals.
Your purpose is to replicate the workflow of a professional discretionary trader who combines Smart Money Concepts (SMC), ICT concepts, market structure, liquidity analysis, supply and demand, price action, multi-timeframe analysis, session analysis, and risk management.

Use the following framework to analyze:
- TOP-DOWN ANALYSIS (Higher timeframe bias: Strong Bullish, Bullish, Neutral, Bearish, Strong Bearish)
- MARKET STRUCTURE ENGINE (Identify BOS, CHOCH, MSS, structure confidence)
- LIQUIDITY ENGINE (BSL, SSL, EQH/EQL, Swift targets, liquidity sweeps)
- SMART MONEY CONCEPTS ENGINE (OBs, Mitigation Blocks, Breakers, Repricing)
- FAIR VALUE GAP ENGINE (Bullish/Bearish/Inverse FVGs, Size, Nearest)
- SUPPLY DEMAND ENGINE (Fresh vs Mitigated Zones)
- PREMIUM DISCOUNT ENGINE (Deep Discount/Discount/Equilibrium/Premium/Deep Premium)
- MARKET REGIME ENGINE (Trending/Ranging/Expansion/Accumulation/Distribution)
- SESSION ENGINE (Asian, London, New York context)
- CONFLUENCE ENGINE (Structure=20, Liquidity=15, OB=10, FVG=10, S/D=10, P/D=10, PA=5, Session=5, Meta=5. Total Conf 0-100)
- TRADE QUALITY ENGINE (A+: 90-100, A: 80-89, B: 70-79, C: 60-69, Below 60: REJECT)

FINAL OUTPUT FORMAT MUST STRICTLY BE MARKDOWN AND FOLLOW THIS STRUCTURE EXACTLY:

## MARKET SUMMARY
- **Asset:** ${asset}
- **Trading Mode:** ${mode}
- **Higher Timeframe Bias:** [Value]
- **Current Market Regime:** [Value]
- **Institutional Confidence:** [Score]
- **Trade Grade:** [Grade or REJECTED]

## MARKET NARRATIVE
[Explain what smart money appears to be doing, liquidity locations, higher timeframe structure, institutional objectives, and why price should move to target. Professional vocabulary.]

## EXECUTION PLAN
- **Direction:** [Bullish / Bearish / NEUTRAL]
- **Wait Condition:** [Specific confirmation required]
- **Entry Zone:** [Specific price area]
- **Invalidation:** [Specific price area]
- **Target 1:** [Value]
- **Target 2:** [Value]
- **Target 3:** [Value]
- **Risk Reward:** [Value]

If confidence is below 60:
Return NO TRADE SETUP FOUND as a large heading, then explain:
1. Missing confluence
2. Conflicting structure
3. Liquidity uncertainty
4. News risk
5. Poor risk reward

When analyzing a chart image (if provided):
Act as the IMAGE ANALYSIS MODE. 
Identify and textually explain where you see BOS, CHOCH, MSS, FVGs, Order Blocks, Liquidity Pools, etc. 
Provide a clear written explanation of the annotated points since you cannot output images directly.
`;

      const promptParts: any = [
        `Please perform an institutional market analysis for ${asset} using the ${mode} methodology.`
      ];

      if (image) {
        promptParts.push({
          inlineData: {
            data: image.split(',')[1] || image.replace(/^data:image\/\w+;base64,/, ''),
            mimeType: 'image/jpeg',
          }
        });
      }

      let responseText = '';
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: promptParts,
          config: {
            systemInstruction: systemInstruction,
            temperature: 0.2,
          }
        });
        responseText = response.text || '';
      } catch (geminiError: any) {
        console.warn('Gemini API failed or quota exceeded:', geminiError.message);
        console.log('Attempting ChatGPT fallback via GitHub Models API...');
        
        if (process.env.GITHUB_TOKEN) {
          const OpenAI = (await import('openai')).default;
          const client = new OpenAI({
            baseURL: "https://models.inference.ai.azure.com",
            apiKey: process.env.GITHUB_TOKEN,
          });

          const messages: any[] = [
            { role: "system", content: systemInstruction },
          ];

          let userContent: any[] = [
            { type: "text", text: `Please perform an institutional market analysis for ${asset} using the ${mode} methodology.` }
          ];

          if (image) {
             const base64Data = image.split(',')[1] || image.replace(/^data:image\/\w+;base64,/, '');
             // Ensure it has the data:image prefix, default to jpeg
             let mimeMatch = image.match(/^data:(image\/\w+);base64,/);
             let mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
             
             userContent.push({
                type: "image_url",
                image_url: {
                   url: `data:${mimeType};base64,${base64Data}`
                }
             });
          }

          messages.push({ role: "user", content: userContent });

          const fallbackResponse = await client.chat.completions.create({
            model: "gpt-4o", // using GPT-4o as fallback since the prompt asked for ChatGPT
            messages: messages,
            temperature: 0.2,
          });

          responseText = fallbackResponse.choices[0].message?.content || '';
        } else {
          console.error('No GITHUB_TOKEN provided for fallback.');
          throw geminiError; // re-throw original error if no fallback is available
        }
      }
      
      res.json({ result: responseText });
    } catch (error: any) {
      console.error('Analysis error:', error);
      res.status(500).json({ error: error.message || 'Error occurred during analysis.' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
