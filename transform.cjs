const fs = require('fs');

function transformFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  let text = fs.readFileSync(filePath, 'utf8');

  // Backgrounds
  text = text.replace(/bg-slate-50(\/50|\/60)?/g, 'bg-[#0B0A11]');
  text = text.replace(/bg-white/g, 'bg-[#1E1432]/60 backdrop-blur-md');
  text = text.replace(/bg-slate-100/g, 'bg-[#1E1432]/40 backdrop-blur-md');
  text = text.replace(/bg-slate-800/g, 'bg-[#2D1B4E]');
  text = text.replace(/bg-slate-900(\/40|\/30)?/g, 'bg-[#0B0A11]/80 backdrop-blur-md');
  text = text.replace(/bg-orange-50(\/60|\/40|\/50|\/20)?/g, 'bg-[#8A2BE2]/20 backdrop-blur-md');
  text = text.replace(/bg-orange-100/g, 'bg-[#8A2BE2]/40');
  text = text.replace(/bg-orange-500/g, 'bg-gradient-to-r from-[#8A2BE2] to-[#FF4500]');
  
  // Text Colors
  text = text.replace(/text-slate-800/g, 'text-[#E2E8F0]');
  text = text.replace(/text-slate-900/g, 'text-white');
  text = text.replace(/text-slate-950/g, 'text-white');
  text = text.replace(/text-slate-500/g, 'text-[#A0AEC0]');
  text = text.replace(/text-slate-400/g, 'text-[#718096]');
  text = text.replace(/text-slate-450/g, 'text-[#A0AEC0]');
  text = text.replace(/text-slate-550/g, 'text-[#A0AEC0]');
  text = text.replace(/text-slate-600/g, 'text-[#A0AEC0]');
  text = text.replace(/text-black/g, 'text-white');
  text = text.replace(/text-orange-500/g, 'text-[#FF8A65]');
  text = text.replace(/text-orange-600/g, 'text-[#FF8A65]');
  text = text.replace(/text-orange-900/g, 'text-white');
  text = text.replace(/text-orange-950/g, 'text-white');

  // Borders
  text = text.replace(/border-slate-200(\/80|\/50)?/g, 'border-white/10');
  text = text.replace(/border-slate-150/g, 'border-white/10');
  text = text.replace(/border-slate-100(\/50)?/g, 'border-white/10');
  text = text.replace(/border-orange-100/g, 'border-white/10');
  text = text.replace(/border-orange-200(\/80)?/g, 'border-[#8A2BE2] shadow-[0_0_15px_rgba(138,43,226,0.5)]');
  text = text.replace(/hover:border-orange-200/g, 'hover:border-[#8A2BE2] hover:shadow-[0_0_15px_rgba(138,43,226,0.5)]');
  text = text.replace(/border-orange-400/g, 'border-transparent');

  // Shadows
  text = text.replace(/shadow-sm/g, 'shadow-[0_8px_32px_rgba(110,50,200,0.2)]');
  text = text.replace(/shadow-md/g, 'shadow-[0_8px_32px_rgba(110,50,200,0.2)]');
  text = text.replace(/shadow-lg/g, 'shadow-[0_8px_32px_rgba(110,50,200,0.3)]');
  text = text.replace(/shadow-xl/g, 'shadow-[0_8px_32px_rgba(110,50,200,0.3)]');
  text = text.replace(/shadow-2xl/g, 'shadow-[0_8px_32px_rgba(110,50,200,0.4)]');
  text = text.replace(/shadow-orange-500\/20/g, 'shadow-[0_0_15px_rgba(138,43,226,0.5)]');
  text = text.replace(/shadow-slate-100/g, 'shadow-[0_8px_32px_rgba(110,50,200,0.2)]');
  text = text.replace(/shadow-inner/g, ''); // Often looks bad on dark mode glass

  // Neon text & backgrounds for profits/losses
  text = text.replace(/text-emerald-600(\/80)?/g, 'text-[#00FF00]');
  text = text.replace(/text-emerald-500/g, 'text-[#00FF00]');
  text = text.replace(/text-rose-600(\/80)?/g, 'text-[#FF0033]');
  text = text.replace(/text-rose-500/g, 'text-[#FF0033]');
  text = text.replace(/bg-emerald-50(\/50)?/g, 'bg-[#00FF00]/10');
  text = text.replace(/border-emerald-100/g, 'border-[#00FF00]/20');
  text = text.replace(/bg-emerald-500(\/15|\/20)?/g, 'bg-[#00FF00]');
  text = text.replace(/bg-rose-50(\/50)?/g, 'bg-[#FF0033]/10');
  text = text.replace(/border-rose-100/g, 'border-[#FF0033]/20');
  text = text.replace(/bg-rose-500(\/15|\/20)?/g, 'bg-[#FF0033]');

  // Border Radius updates
  text = text.replace(/rounded-xl/g, 'rounded-[20px]');
  text = text.replace(/rounded-2xl/g, 'rounded-[24px]');
  text = text.replace(/rounded-3xl/g, 'rounded-[24px]');

  // Gradients and specific fixes
  text = text.replace(/from-orange-400 to-amber-500/g, 'from-[#8A2BE2] to-[#FF4500]');
  
  // Custom Verdict Glowing Pills (AnalysisResult.tsx usually has this)
  text = text.replace(/bg-emerald-100/g, 'bg-[#00FF00]/20 shadow-[0_0_15px_rgba(0,255,0,0.3)]');
  text = text.replace(/bg-rose-100/g, 'bg-[#FF0033]/20 shadow-[0_0_15px_rgba(255,0,51,0.3)]');
  text = text.replace(/text-emerald-800/g, 'text-[#00FF00]');
  text = text.replace(/text-rose-800/g, 'text-[#FF0033]');

  fs.writeFileSync(filePath + '.new', text);
}

const filesToTransform = [
  'src/components/LandingPage.tsx',
  'src/components/Dashboard.tsx',
  'src/components/ExtraModules.tsx',
  'src/components/AnalysisResult.tsx',
  'src/components/SignalsLogger.tsx'
];

filesToTransform.forEach(transformFile);

// Also transform index.css
let css = fs.readFileSync('src/index.css', 'utf8');
css = css.replace(/@apply bg-slate-50 text-slate-800;/g, '@apply bg-[#0B0A11] text-[#E2E8F0];');
fs.writeFileSync('src/index.css.new', css);

console.log("Transformed files saved as .new");
