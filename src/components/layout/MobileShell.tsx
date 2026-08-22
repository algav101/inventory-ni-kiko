import React from 'react';
import {
  LayoutDashboard,
  Boxes,
  Truck,
  FileQuestion,
  ScanLine,
  PackageCheck,
  RotateCcw,
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
  const [isResetModalOpen, setIsResetModalOpen] = React.useState(false);
  const [showToast, setShowToast] = React.useState(false);

  const lowStockCount = useLiveQuery(async () => {
    const items = await db.items.toArray();
    return items.filter((i: Item) => i.current_qty <= i.low_stock_threshold).length;
  }) ?? 0;

  const openBoCount = useLiveQuery(async () => {
    return db.backOrders.where('status').equals('OPEN').count();
  }) ?? 0;

  const handleGlobalResetToZero = () => {
    setIsResetModalOpen(true);
  };

  return (
    <div className="mobile-shell-container text-slate-100">
      {/* Status & Header Bar */}
      <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img
              src="/kiko-avatar.jpg"
              alt="Kiko Avatar"
              className="w-10 h-10 rounded-full object-cover border-2 border-amber-400 shadow-md shadow-amber-500/20"
            />
            <div>
              <h1 className="font-bold text-base tracking-tight leading-none text-white">
                Kiko palit 2x2 App
              </h1>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
                  Offline DB Ready
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleGlobalResetToZero}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-950/60 border border-rose-800/60 text-rose-300 hover:bg-rose-900 text-xs font-bold transition-all"
              title="Reset all inventory counts to 0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to 0</span>
            </button>

            <button
              onClick={onOpenReceiveModal}
              className="flex items-center gap-1 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-md active:scale-95 transition-all"
            >
              <PackageCheck className="w-4 h-4" />
              <span>Receive</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Screen Content View */}
      <main className="flex-1 overflow-y-auto pb-24 p-4">
        {children}
      </main>

      {/* Bottom Floating Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 max-w-[480px] mx-auto bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 px-2 py-2">
        <div className="grid grid-cols-5 gap-1 text-center">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-all ${
              activeTab === 'dashboard'
                ? 'bg-red-600/20 text-red-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutDashboard className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">Home</span>
          </button>

          <button
            onClick={() => setActiveTab('inventory')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-all relative ${
              activeTab === 'inventory'
                ? 'bg-red-600/20 text-red-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Boxes className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">Stock</span>
            {lowStockCount > 0 && (
              <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-amber-400"></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('ocr_intake')}
            className="flex flex-col items-center justify-center py-1 rounded-xl bg-gradient-to-tr from-red-600 to-rose-500 text-white font-bold shadow-lg shadow-red-600/30 -mt-3 active:scale-95 transition-all"
          >
            <ScanLine className="w-6 h-6" />
            <span className="text-[10px]">OCR Scan</span>
          </button>

          <button
            onClick={() => setActiveTab('delivery')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-all ${
              activeTab === 'delivery'
                ? 'bg-red-600/20 text-red-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Truck className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">Delivery</span>
          </button>

          <button
            onClick={() => setActiveTab('backorder')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-all relative ${
              activeTab === 'backorder'
                ? 'bg-red-600/20 text-red-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileQuestion className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">BOs</span>
            {openBoCount > 0 && (
              <span className="absolute top-1 right-3 min-w-4 h-4 px-1 rounded-full bg-purple-500 text-[9px] text-white font-bold flex items-center justify-center">
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
