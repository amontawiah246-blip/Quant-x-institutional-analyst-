import { useState } from 'react';
import LandingPage from './components/LandingPage.tsx';
import Dashboard from './components/Dashboard.tsx';

function App() {
  const [view, setView] = useState<'landing' | 'dashboard'>('landing');

  return (
    <div className="h-full bg-[#0B0A11] text-[#E2E8F0] selection:bg-purple-900/50">
      {view === 'landing' ? (
        <LandingPage onEnter={() => setView('dashboard')} />
      ) : (
        <Dashboard onBackToLanding={() => setView('landing')} />
      )}
    </div>
  );
}

export default App;
