import React from 'react';

interface LandingPageProps {
  onStart: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#070f17] via-[#0c1a27] to-[#03070d] text-white flex flex-col justify-between items-center p-6 relative overflow-hidden">
      {/* Background Geometric Glow Overlay matching reference screenshot */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.06)_0%,transparent_70%)] pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      
      {/* Abstract background vector lines */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <line x1="0" y1="20%" x2="100%" y2="80%" stroke="white" strokeWidth="1" strokeDasharray="6 6" />
          <line x1="100%" y1="10%" x2="0" y2="90%" stroke="white" strokeWidth="1" strokeDasharray="6 6" />
          <polygon points="50,100 200,300 100,500" fill="none" stroke="white" strokeWidth="1" />
          <polygon points="300,50 450,200 350,400" fill="none" stroke="white" strokeWidth="1" />
        </svg>
      </div>

      {/* Main Content Box */}
      <div className="w-full max-w-sm mx-auto flex flex-col items-center text-center mt-12 z-10 space-y-6">
        {/* Top Metallic Domain Master AL Emblem Logo */}
        <div className="relative group cursor-pointer">
          <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-[#ff6b00] to-amber-300 opacity-60 blur-md group-hover:opacity-100 transition-opacity" />
          <img
            src="/domain-master-al-logo.jpg"
            alt="Domain Master AL Logo"
            className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-full object-cover border-4 border-amber-400/80 shadow-2xl shadow-amber-500/30"
          />
        </div>

        {/* Title & Cursive Subtitle matching reference picture */}
        <div className="space-y-1 pt-2">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight">
            Welcome to<br />Kiko Machine
          </h1>
          <p className="font-serif italic font-normal text-xl sm:text-2xl text-[#ff6b00] tracking-wide pt-1">
            by Domain Master AL
          </p>
          <div className="w-16 h-0.5 bg-gradient-to-r from-transparent via-[#ff6b00] to-transparent mx-auto mt-4 opacity-80" />
        </div>
      </div>

      {/* Bottom Outlined / Ghost Button Section */}
      <div className="w-full max-w-sm mx-auto flex flex-col items-center text-center mb-10 z-10 space-y-6">
        <button
          onClick={onStart}
          className="w-full max-w-xs py-4 px-6 rounded-full border-2 border-slate-300/70 bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold text-sm sm:text-base tracking-wide shadow-[0_0_30px_rgba(255,255,255,0.18)] transition-all duration-300 flex items-center justify-center gap-2 group backdrop-blur-md"
        >
          <span>Tara na,simulan na Magnegosyo</span>
          <span className="text-amber-400 group-hover:translate-x-1 transition-transform">→</span>
        </button>

        {/* Subtle Bottom Attribution */}
        <div className="text-[11px] text-slate-400 tracking-wider font-semibold">
          Kiko Machine • Enterprise Inventory Solution
        </div>
      </div>
    </div>
  );
};
