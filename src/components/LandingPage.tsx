import { Cpu, Activity, Shield, ArrowRight } from 'lucide-react';

interface LandingPageProps {
  onEnter: () => void;
}

export default function LandingPage({ onEnter }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1E113B] via-[#0D081D] to-[#05030A] flex flex-col justify-between items-center px-4 py-8 relative overflow-hidden font-space">
      {/* Decorative Neon Blurs */}
      <div className="absolute top-[-10%] left-[-20%] w-[60%] h-[60%] bg-[#8A2BE2]/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-20%] w-[60%] h-[60%] bg-[#FF4500]/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Top Navbar */}
      <header className="w-full max-w-6xl flex justify-between items-center z-10 py-4">
        <div className="flex items-center gap-3">
          {/* Transparent Neon Glowing Logo Icon */}
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#8A2BE2] to-[#FF4500] p-[1.5px] shadow-[0_0_15px_rgba(138,43,226,0.5)]">
            <div className="w-full h-full bg-[#0B0A11] rounded-[10px] flex items-center justify-center">
              <span className="text-white font-bold text-lg font-space tracking-tight">T</span>
            </div>
          </div>
          <span className="text-2xl font-bold tracking-wider text-white">
            TRADE<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6B35] to-[#FF8A65]">LENS</span>
          </span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-[#E2E8F0] font-mono">
          <span className="w-2 h-2 rounded-full bg-[#39ff14] animate-pulse"></span>
          SYS ACTIVE // DECISION NODE v4.2
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-4xl flex flex-col justify-center items-center text-center z-10 my-12">
        {/* Floating Glowing Orb */}
        <div className="relative mb-8">
          <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-[#8A2BE2] via-[#B5179E] to-[#FF4500] opacity-80 animate-orb-float shadow-[0_0_50px_rgba(138,43,226,0.6)] flex items-center justify-center p-0.5">
            <div className="w-full h-full bg-[#0B0A11]/90 rounded-full flex items-center justify-center backdrop-blur-md">
              <Activity className="w-12 h-12 text-[#FF6B35] animate-pulse" />
            </div>
          </div>
          <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-[#8A2BE2] to-[#FF4500] blur-md opacity-30 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-tilt"></div>
        </div>

        {/* Headings */}
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white leading-tight">
          TRADE<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6B35] to-[#FF8A65]">LENS</span> TERMINAL
        </h1>
        <p className="mt-3 text-sm md:text-base font-semibold font-mono tracking-widest text-[#FF6B35] uppercase neon-text-orange">
          Smarter Signals // Institutional Consensus Models
        </p>

        <p className="mt-6 text-sm md:text-md text-[#E2E8F0] max-w-xl leading-relaxed">
          Access high-fidelity market data feeds, order flow liquidity maps, and AI-driven predictive insights synthesized in real-time.
        </p>

        {/* Action Button */}
        <div className="mt-10">
          <button
            onClick={onEnter}
            className="group px-8 py-4 bg-gradient-to-r from-[#8A2BE2] to-[#FF4500] hover:from-[#9D4EDD] hover:to-[#FF6B35] text-white rounded-full font-bold text-base tracking-wide flex items-center gap-3 transition-all duration-300 transform hover:scale-105 shadow-[0_0_30px_rgba(138,43,226,0.5)] cursor-pointer"
          >
            Access TradeLens Terminal
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Three Glassmorphic Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mt-16">
          {/* Card 1 */}
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-[24px] p-6 text-left hover:border-[#FF6B35]/30 transition-all duration-300 hover:shadow-[0_8px_32px_rgba(255,107,53,0.15)] flex flex-col gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#8A2BE2]/20 to-[#FF4500]/20 border border-white/10 flex items-center justify-center">
              <Cpu className="w-6 h-6 text-[#FF6B35]" />
            </div>
            <div>
              <h3 className="text-xs font-bold font-mono text-[#FF6B35] tracking-widest uppercase mb-1">
                CALCULATED
              </h3>
              <p className="text-[#E2E8F0] text-xs leading-relaxed font-sans">
                Algorithmic consensus scoring calculated across 12 proprietary liquidity data block models.
              </p>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-[24px] p-6 text-left hover:border-[#FF6B35]/30 transition-all duration-300 hover:shadow-[0_8px_32px_rgba(255,107,53,0.15)] flex flex-col gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#8A2BE2]/20 to-[#FF4500]/20 border border-white/10 flex items-center justify-center">
              <Activity className="w-6 h-6 text-[#FF6B35]" />
            </div>
            <div>
              <h3 className="text-xs font-bold font-mono text-[#FF6B35] tracking-widest uppercase mb-1">
                FEEDS
              </h3>
              <p className="text-[#E2E8F0] text-xs leading-relaxed font-sans">
                Real-time interbank order flow imbalance trackers, covariance analysis, and delta cluster reports.
              </p>
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-[24px] p-6 text-left hover:border-[#FF6B35]/30 transition-all duration-300 hover:shadow-[0_8px_32px_rgba(255,107,53,0.15)] flex flex-col gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#8A2BE2]/20 to-[#FF4500]/20 border border-white/10 flex items-center justify-center">
              <Shield className="w-6 h-6 text-[#FF6B35]" />
            </div>
            <div>
              <h3 className="text-xs font-bold font-mono text-[#FF6B35] tracking-widest uppercase mb-1">
                GUARDRAILS
              </h3>
              <p className="text-[#E2E8F0] text-xs leading-relaxed font-sans">
                Preservation strategies built directly into decision algorithms to strictly regulate risk vectors.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-6xl text-center z-10 pt-8 border-t border-white/5 mt-8 flex flex-col sm:flex-row sm:justify-between items-center gap-3">
        <span className="text-[10px] font-mono text-zinc-600 tracking-wider">
          SECURE DESK ACCESS // AES-256 ENCRYPTED CONTEXT ONLY
        </span>
        <span className="text-[10px] font-mono text-zinc-600 tracking-wider">
          &copy; {new Date().getFullYear()} TradeLens Inc. Institutional Grade. All Rights Reserved.
        </span>
      </footer>
    </div>
  );
}
