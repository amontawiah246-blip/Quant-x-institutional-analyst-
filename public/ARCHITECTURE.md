# QUANT-X PRO: Technical Design Document

## 1. System Overview
QUANT-X PRO is a robust, deterministic, institutional-grade market analysis platform. Unlike standard generative AI bots that often hallucinate levels, QUANT-X relies on rigid, math-based algorithmic processing layers (Engines 1-15) to evaluate live market data. AI (Gemini and fallback models) is strictly cordoned off entirely into Layer 16 and is only permitted to generate human-readable narratives and chart annotations based *exclusively* on the deterministic JSON outputs produced by the prior layers.

---

## 2. Modular Folder Structure
```text
/src
  /api               # Express.js REST API endpoints
  /core
    /deriv           # Deriv WebSocket / REST API client logic
    /engines         # Algorithmic engine modules
      - data.ts
      - structure.ts
      - liquidity.ts
      - fvg.ts
      - order-block.ts
      - supply-demand.ts
      - relative-zones.ts
      - trendline.ts
      - session.ts
      - regime.ts
      - correlation.ts
      - confluence.ts
      - risk.ts
    /ai              # LLM Integration Layer (Layer 16)
  /db                # Caching layer (In-memory, Redis, etc.) for candles
  /types             # Zod schemas and strict TypeScript interfaces
  /utils             # Math algorithms and financial logic
/frontend
  /components        # React presentation components
  /hooks             # Data fetching hooks
  /pages             # Main views
```

---

## 3. Data Flows
1. **Frontend Request**: The institutional user specifies Asset, Mode (Scalp/Swing), and optionally uploads a chart snapshot via the React UI.
2. **Data Ingestion (Layer 1)**: The backend pulls historical candles (OHLCV) and active ticks from the Deriv API or internal cache.
3. **Pipeline Execution (Layers 2-12)**: OHLCV arrays are processed synchronously through deterministic detectors (e.g., calculating swings, measuring overlapping bodies for FVGs, looking for equilibrium cross-overs).
4. **Scoring & Risk Analysis (Layers 13-15)**: The analytical outputs map back to the Confluence Engine, which calculates a weighted Institutional Confidence Score (0-100). The Risk Engine vets the RR ratio.
5. **Generative Synthesis (Layer 16)**: If the confidence baseline is met (>60), the compiled JSON objects are sent to the LLM restricted with strict system prompts that act as the narrative parser.
6. **Frontend Delivery**: The structured Execution Plan and Markdown Narrative are transported back to the client interface.

---

## 4. Deterministic Engines Breakdown

### Layer 1: Data Engine
- **Responsibility**: Connect to Deriv Public API via WebSockets. Fetches multiple timeframes corresponding to modes.
- **Output**: `Array<Candle>` `{ timestamp, open, high, low, close, volume }`

### Layer 2: Market Structure Engine
- **Responsibility**: Swing High/Low detection using fractal algorithms (e.g., Williams Fractals / 5-bar evaluation).
- **JSON Output**: 
  ```json
  { "trend": "BULLISH", "bos": [...], "choch": [...], "confidence": 85 }
  ```

### Layer 3: Liquidity Engine
- **Responsibility**: Detects clusters of tight price extremes (Equal Highs EQH / Equal Lows EQL).
- **JSON Output**: 
  ```json
  { "eqh": [1.12050], "eql": [1.11050], "sweeps": [] }
  ```

### Layer 4: Fair Value Gap (FVG) Engine
- **Responsibility**: Measures extreme directional 3-candle imbalance patterns.
- **JSON Output**: 
  ```json
  { "fvgs": [{ "type": "BULLISH", "top": 1.115, "bottom": 1.112, "filled": false }] }
  ```

### Layer 5: Order Block Engine
- **Responsibility**: Locates the last opposing candle prior to institutional displacement.
- **JSON Output**: 
  ```json
  { "orderBlocks": [{ "direction": "BEARISH", "level": 1.12000, "strength": "HIGH" }] }
  ```

### Layer 6-12: Ancillary Engines
These engines perform targeted checks:
- **Supply / Demand**: Maps multi-hit bases and extreme rejections.
- **Premium / Discount**: Uses a 0.5 Fibonacci retracement over the primary structure swing sequence.
- **Regime**: Cross-verifies ATR expansion and RSI baselines to assign Trend / Ranging definitions.
- **Session**: Synchronizes price extremes to Asian (00:00-08:00 UTC+2), London (08:00-16:00), and NY (13:00-21:00) boxes.
- **News**: Awaits high-impact metadata injection to decrease confluence confidence.

### Layer 13: Confluence Logic (Scoring)
```typescript
const weights = {
  marketStructure: 20, // Strict trend adherence
  liquidity: 15,       // High probability draw on liquidity
  orderBlocks: 10,     // Mitigation entries
  fvg: 10,             // Momentum measurement
  supplyDemand: 10,    // Price magnetism
  premiumDiscount: 10, // Cost basis efficiency
  priceAction: 5,      // Immediate order flow
  session: 5,          // Time-based algos
  correlation: 5,      // SMT divergence / convergence
  news: 5,             // Volatility risk
  htfBias: 5           // Macro trend backing
};
```

### Layer 14 & 15: Risk & Quality Engine
Rejects outputs scoring below 60, logging the failure reason explicitly to the UI.

### Layer 16: AI Explanation Engine
Executes natural language mappings taking the fully derived algorithmic object model, forming professional, objective analysis avoiding generic retail trading lexicons.
