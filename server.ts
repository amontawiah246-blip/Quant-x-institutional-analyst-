import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Route to generate a high-fidelity quantitative analysis from Gemini
app.post('/api/generate-signal', async (req, res) => {
  const { asset, customContext } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    // Graceful fallback with warnings and premium mock data if API key is not supplied
    console.warn("GEMINI_API_KEY is not defined. Using high-fidelity local institutional fallback.");
    res.json({
      success: true,
      mode: 'fallback',
      message: 'GEMINI_API_KEY environment variable is required to enable real-time AI generation. Set it in Settings > Secrets.',
      verdict: 'BUY',
      strength: 84,
      price: asset.includes('BTC') ? 94250.75 : asset.includes('ETH') ? 3425.20 : asset.includes('SOL') ? 185.45 : asset.includes('EUR') ? 1.0854 : 154.20,
      change24h: 3.42,
      logic: `### Fallback Setup: AI Model Offline
**WARNING:** Running in sandbox offline mode. Real-time Gemini models cannot be initialized without a valid API key.

**Quantitative Outlook:**
*   **Order Book Sizing:** Heavy cluster detected around support range (-0.45%).
*   **Structural Alignment:** Multi-timeframe trend is structurally intact. Volume profile POC shows high consensus at support.
*   **Action Plan:** Maintain standard long scaling strategy, setting hard risk stop at -1.5% from current level.`,
      metrics: {
        orderBookImbalance: 24.5,
        interbankConsensus: 'Bullish 78%',
        covarianceAlpha: 0.88,
        sessionPoc: asset.includes('BTC') ? 93800 : asset.includes('ETH') ? 3390 : 150,
        liveRiskStatus: 'Nominal'
      }
    });
    return;
  }

  try {
    // Lazy initialize standard Gemini client with recommended aistudio-build header
    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });

    const prompt = `You are an elite institutional quantitative discretionary trading model running on TradeLens Terminal.
Analyze the asset: ${asset}.
Custom user context: ${customContext || 'No additional context provided.'}.

Provide a highly realistic institutional trading analysis. Return your analysis in the following STRICT JSON format so we can parse it programmatically. Do NOT include any markdown block characters or formatting outside of the valid JSON structure.

JSON SCHEMA:
{
  "verdict": "BUY" | "SELL" | "WAIT" | "CAUTION",
  "strength": <number between 10 and 100 representing confidence>,
  "price": <estimated logical current price for the asset>,
  "change24h": <estimated realistic 24h percentage change, positive or negative>,
  "logic": "<A professional and concise markdown string explaining: 1) Executive Summary 2) Order Flow Analysis 3) Multi-timeframe Structure 4) Actionable Guidance. Keep it dense, jargon-rich, and formatted beautifully in markdown with headers and bullet points.>",
  "metrics": {
    "orderBookImbalance": <number representing buy-wall/sell-wall ratio from -100 to +100>,
    "interbankConsensus": "<string like 'Bullish 62%' or 'Neutral' or 'Bearish 55%'>",
    "covarianceAlpha": <number between -1.00 and 1.00 indicating statistical asset correlation value>,
    "sessionPoc": <estimated volume point-of-control price level>,
    "liveRiskStatus": "Nominal" | "Elevated" | "Extreme"
  }
}

Ensure the analysis is realistic and conforms to modern institutional trading methodologies (such as order blocks, volume profile, liquidation sweeps, and macro covariance). Return ONLY the raw JSON string starting with '{' and ending with '}'.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const responseText = response.text || '{}';
    const parsedData = JSON.parse(responseText.trim());

    res.json({
      success: true,
      mode: 'live',
      ...parsedData
    });
  } catch (err: any) {
    console.error("Gemini API call failed:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Unknown error occurred while invoking Gemini model."
    });
  }
});

// Production static files or Development Vite middleware
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'spa'
  });
  app.use(vite.middlewares);
}

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`TradeLens Institutional Terminal online at port ${PORT}`);
});
