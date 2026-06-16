import React, { useState } from 'react';
import { TradingMode } from './types';
import { LandingPage } from './components/LandingPage';
import { Dashboard } from './components/Dashboard';

export default function App() {
  const [hasStarted, setHasStarted] = useState(false);

  const handleAnalyze = async (asset: string, mode: TradingMode, imageBase64?: string, accountSize?: number, riskPct?: number) => {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 120000);
    const response = await fetch('/api/analyze', {
      signal: controller.signal,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ asset, mode, image: imageBase64, accountSize, riskPct }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to analyze');
    }

    clearTimeout(timeoutId);
    const data = await response.json();
    return data.result;
  };

  if (!hasStarted) {
    return <LandingPage onStart={() => setHasStarted(true)} />;
  }

  return <Dashboard onAnalyze={handleAnalyze} />;
}

