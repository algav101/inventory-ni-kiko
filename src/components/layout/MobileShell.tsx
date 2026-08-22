import React, { useState } from 'react';
import {
  LayoutDashboard,
  Boxes,
  Truck,
  FileQuestion,
  ScanLine,
  Glasses,
  Eye,
} from 'lucide-react';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import type { Item } from '../../types';
import { ResetAuthModal } from '../inventory/ResetAuthModal';

interface MobileShellProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenReceiveModal?: () => void;
  onReturnToLanding?: () => void;
}

export const MobileShell: React.FC<MobileShellProps> = ({
  children,
  activeTab,
  setActiveTab,
  onReturnToLanding,
}) => {
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  const lowStockCount = useLiveQuery(async () => {
    const items = await db.items.toArray();
    return items.filter((i: Item) => i.current_qty <= i.low_stock_threshold).length;
  }) ?? 0;

  const openBoCount = useLiveQuery(async () => {
    return db.backOrders.where('status').equals('OPEN').count();
  }) ?? 0;

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  return (
    <div className={`mobile-shell-container ${isDarkMode ? 'dark-mode' : ''}`}>
      {/* Streamlined Header Bar with Top-Left Theme Toggle and Domain Master AL Branding */}
      <header className={`sticky top-0 z-30 ${isDarkMode ? 'bg-[#06121c] text-white' : 'bg-[#0b2b3c] text-white'} shadow-xl border-b ${isDarkMode ? 'border-[#0f2434]' : 'border-[#133e54]'} transition-colors duration-400`}>
        <div className="flex items-center justify-between px-3.5 py-3">
          {/* Top Left Interface: Black Sunglasses (Dark) vs 2 Naked Eyes (Light) Theme Toggle */}
          <button
            onClick={toggleTheme}
            className={`eye-shade-toggle flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${
              isDarkMode
                ? 'bg-slate-900/90 border-slate-700 text-slate-100 hover:border-slate-500'
                : 'bg-amber-500/20 border-amber-300/80 text-amber-100 hover:bg-amber-500/30'
            } shadow-md transition-all text-xs font-bold`}
            title={isDarkMode ? 'Dark Mode (Black Sunglasses) - Click for Light Mode (Naked Eyes)' : 'Light Mode (2 Naked Eyes) - Click for Dark Mode (Black Sunglasses)'}
          >
            {isDarkMode ? (
              <>
                <Glasses className="w-4 h-4 text-slate-100 fill-slate-900" />
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-200">DARK</span>
              </>
            ) : (
              <>
                <div className="flex items-center -space-x-1">
                  <Eye className="w-3.5 h-3.5 text-amber-300 stroke-[2.5]" />
                  <Eye className="w-3.5 h-3.5 text-amber-300 stroke-[2.5]" />
                </div>
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-amber-200">LIGHT</span>
              </>
            )}
          </button>


          {/* App Title with Domain Master AL Logo & Cursive Subtitle */}
          <div
            onClick={onReturnToLanding}
            className="flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity"
            title="Return to Welcome Landing Screen"
          >
            {/* Uploaded Domain Master AL Emblem Logo */}
            <img
              src="/domain-master-al-logo.jpg"
              alt="Domain Master AL Logo"
              className="w-9 h-9 rounded-full object-cover border-2 border-amber-500/60 shadow-lg shadow-amber-500/20"
            />

            <div className="text-left">
              <div className="flex items-baseline gap-1.5 leading-none">
                <span className="font-black text-sm sm:text-base text-white tracking-tight">
                  Kiko Machine
                </span>
                <span className="font-serif italic font-normal text-[11px] sm:text-xs text-[#ff6b00] tracking-wide opacity-95">
                  by Domain Master AL
                </span>
              </div>
            </div>
          </div>


          {/* Clean Top Right Accent */}
          <div className="w-6"></div>
        </div>
      </header>

      {/* Main Screen Content View */}
      <main className="flex-1 overflow-y-auto pb-24 p-4">
        {children}
      </main>

      {/* Bottom Floating Navigation Bar */}
      <nav className={`fixed bottom-0 left-0 right-0 z-30 max-w-[480px] mx-auto ${isDarkMode ? 'bg-[#06121c]' : 'bg-[#0b2b3c]'} backdrop-blur-lg border-t ${isDarkMode ? 'border-[#0f2434]' : 'border-[#133e54]'} px-2 py-2 shadow-2xl transition-colors duration-400`}>
        <div className="grid grid-cols-5 gap-1 text-center">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-all ${
              activeTab === 'dashboard'
                ? 'bg-[#ff6b00] text-white font-bold shadow-md'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">Home</span>
          </button>

          <button
            onClick={() => setActiveTab('inventory')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-all relative ${
              activeTab === 'inventory'
                ? 'bg-[#ff6b00] text-white font-bold shadow-md'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Boxes className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">Stock</span>
            {lowStockCount > 0 && (
              <span className="absolute top-1 right-2 w-2.5 h-2.5 rounded-full bg-[#ff6b00] ring-2 ring-[#0b2b3c]"></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('ocr_intake')}
            className="flex flex-col items-center justify-center py-1 rounded-xl bg-gradient-to-tr from-[#ff6b00] to-amber-500 text-white font-bold shadow-lg shadow-amber-600/30 -mt-3 active:scale-95 transition-all"
          >
            <ScanLine className="w-6 h-6" />
            <span className="text-[10px]">Auto Add</span>
          </button>

          <button
            onClick={() => setActiveTab('delivery')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-all ${
              activeTab === 'delivery'
                ? 'bg-[#ff6b00] text-white font-bold shadow-md'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Truck className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">Delivery</span>
          </button>

          <button
            onClick={() => setActiveTab('backorder')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-all relative ${
              activeTab === 'backorder'
                ? 'bg-[#ff6b00] text-white font-bold shadow-md'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <FileQuestion className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">Returned</span>
            {openBoCount > 0 && (
              <span className="absolute top-1 right-2.5 min-w-4 h-4 px-1 rounded-full bg-purple-500 text-[9px] text-white font-bold flex items-center justify-center">
                {openBoCount}
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* Reset Auth Confirmation Modal */}
      <ResetAuthModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onSuccess={() => {
          setShowToast(true);
          setTimeout(() => setShowToast(false), 4000);
        }}
      />

      {/* Success Toast */}
      {showToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-xl border border-emerald-400 animate-in fade-in slide-in-from-bottom-5">
          ✓ All inventory counts have been reset to 0 across all freezers.
        </div>
      )}
    </div>
  );
};


