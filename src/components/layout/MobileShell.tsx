import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Boxes,
  Truck,
  FileQuestion,
  ScanLine,
  Menu,
  Globe,
  Network,
  MapPin,
  X,
  RotateCcw,
  PackageCheck,
  History,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import type { Item } from '../../types';
import { ResetAuthModal } from '../inventory/ResetAuthModal';

interface MobileShellProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenReceiveModal: () => void;
}

export const MobileShell: React.FC<MobileShellProps> = ({
  children,
  activeTab,
  setActiveTab,
  onOpenReceiveModal,
}) => {
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>('');

  // Live ISO Timestamp formatted like 2021-10-05T08:45:46 in reference picture
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const isoStr = now.toISOString().split('.')[0]; // YYYY-MM-DDTHH:mm:ss
      setCurrentTime(isoStr);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const lowStockCount = useLiveQuery(async () => {
    const items = await db.items.toArray();
    return items.filter((i: Item) => i.current_qty <= i.low_stock_threshold).length;
  }) ?? 0;

  const openBoCount = useLiveQuery(async () => {
    return db.backOrders.where('status').equals('OPEN').count();
  }) ?? 0;

  const handleGlobalResetToZero = () => {
    setIsResetModalOpen(true);
    setIsDrawerOpen(false);
  };

  return (
    <div className="mobile-shell-container text-slate-800">
      {/* Dark Navy Reference Header */}
      <header className="sticky top-0 z-30 bg-[#0b2b3c] text-white shadow-lg border-b border-[#133e54]">
        {/* Top Control Bar: Hamburger, Timestamp, Sync Globe */}
        <div className="flex items-center justify-between px-3.5 pt-2.5 pb-1 text-slate-200">
          <button
            onClick={() => setIsDrawerOpen(!isDrawerOpen)}
            className="p-1 rounded-md hover:bg-white/10 active:scale-95 transition-all text-white"
            title="Open Menu"
          >
            <Menu className="w-5 h-5 stroke-[2.5]" />
          </button>

          {/* Timestamp string matching reference: 2021-10-05T08:45:46 */}
          <div className="font-mono text-xs sm:text-sm font-semibold tracking-wider text-slate-100">
            {currentTime || '2026-08-22T15:48:00'}
          </div>

          <div className="flex items-center gap-1.5 text-blue-300">
            <Globe className="w-4 h-4 text-sky-400" />
            <span className="text-[10px] font-bold tracking-tight uppercase text-sky-300">SYNC</span>
          </div>
        </div>

        {/* User Greeting Bar */}
        <div className="px-4 pt-1.5 pb-1">
          <h1 className="text-sm sm:text-base font-black tracking-wide uppercase text-white flex items-center gap-1.5">
            WELCOME BACK, <span className="text-[#ff6b00]">ADMIN</span>
          </h1>
        </div>

        {/* Sub-info Row: Terminal Tag & Storage Location */}
        <div className="flex items-center justify-between px-4 pb-3 pt-0.5 text-[11px] font-bold tracking-wide">
          <div className="flex items-center gap-1 text-slate-300 underline decoration-slate-400">
            <Network className="w-3.5 h-3.5 text-blue-400" />
            <span>T10.9</span>
          </div>

          <div className="flex items-center gap-1 text-[#ff6b00] underline decoration-[#ff6b00] cursor-pointer">
            <MapPin className="w-3.5 h-3.5 text-[#ff6b00]" />
            <span>031HCM COLDSTORAGE</span>
          </div>
        </div>
      </header>

      {/* Slide-out Drawer Navigation */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setIsDrawerOpen(false)}
          />
          <div className="relative z-10 w-72 max-w-[80%] bg-[#0b2b3c] text-white p-5 flex flex-col justify-between shadow-2xl">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-700/60 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-[#ff6b00] text-white flex items-center justify-center font-black text-sm">
                    K
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">Kiko Inventory</h3>
                    <p className="text-[11px] text-slate-300">Admin Terminal • Coldstorage</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1 rounded-lg hover:bg-white/10 text-slate-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-1.5 text-sm font-semibold">
                <button
                  onClick={() => {
                    setActiveTab('dashboard');
                    setIsDrawerOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                    activeTab === 'dashboard' ? 'bg-[#ff6b00] text-white font-bold' : 'hover:bg-white/10 text-slate-200'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Dashboard Home</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('inventory');
                    setIsDrawerOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                    activeTab === 'inventory' ? 'bg-[#ff6b00] text-white font-bold' : 'hover:bg-white/10 text-slate-200'
                  }`}
                >
                  <Boxes className="w-4 h-4" />
                  <span>Stock List</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('ocr_intake');
                    setIsDrawerOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                    activeTab === 'ocr_intake' ? 'bg-[#ff6b00] text-white font-bold' : 'hover:bg-white/10 text-slate-200'
                  }`}
                >
                  <ScanLine className="w-4 h-4" />
                  <span>GRN / OCR Scan</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('delivery');
                    setIsDrawerOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                    activeTab === 'delivery' ? 'bg-[#ff6b00] text-white font-bold' : 'hover:bg-white/10 text-slate-200'
                  }`}
                >
                  <Truck className="w-4 h-4" />
                  <span>Delivery Orders</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('backorder');
                    setIsDrawerOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                    activeTab === 'backorder' ? 'bg-[#ff6b00] text-white font-bold' : 'hover:bg-white/10 text-slate-200'
                  }`}
                >
                  <FileQuestion className="w-4 h-4" />
                  <span>Back Orders</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('history');
                    setIsDrawerOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                    activeTab === 'history' ? 'bg-[#ff6b00] text-white font-bold' : 'hover:bg-white/10 text-slate-200'
                  }`}
                >
                  <History className="w-4 h-4" />
                  <span>Audit Trail Log</span>
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-700/60 space-y-2">
              <button
                onClick={onOpenReceiveModal}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-md"
              >
                <PackageCheck className="w-4 h-4" />
                <span>Receive Stock</span>
              </button>

              <button
                onClick={handleGlobalResetToZero}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 hover:bg-rose-900 font-bold text-xs transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset All to 0</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Screen Content View */}
      <main className="flex-1 overflow-y-auto pb-24 p-4 bg-[#f1f5f9]">
        {children}
      </main>

      {/* Bottom Floating Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 max-w-[480px] mx-auto bg-[#0b2b3c] backdrop-blur-lg border-t border-[#133e54] px-2 py-2 shadow-2xl">
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
            <span className="text-[10px]">GRN Scan</span>
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
            <span className="text-[10px]">BOs</span>
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

