import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, resetAllInventoryToZero } from '../../db/database';
import { ResetAuditLogModal } from '../history/ResetAuditLogModal';
import {
  AlertTriangle,
  FileQuestion,
  Truck,
  ScanLine,
  TrendingUp,
  History,
  ChevronDown,
  ChevronUp,
  Box,
  Trash2,
  ArrowDownToLine,
  Layers,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';


interface DashboardProps {
  setActiveTab: (tab: string) => void;
  onOpenReceiveModal: () => void;
  onOpenManualIntake: () => void;
  onSelectItem: (itemId: number) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  setActiveTab,
  onOpenReceiveModal,
  onOpenManualIntake,
  onSelectItem,
}) => {
  const [isResetAuditModalOpen, setIsResetAuditModalOpen] = useState(false);
  const [isLowStockOpen, setIsLowStockOpen] = useState(true);
  const [isManageInventoryOpen, setIsManageInventoryOpen] = useState(true);

  const items = useLiveQuery(() => db.items.toArray()) ?? [];
  const openBackorders = useLiveQuery(() => db.backOrders.where('status').equals('OPEN').toArray()) ?? [];
  const deliveryPlans = useLiveQuery(() => db.deliveryPlans.toArray()) ?? [];
  const recentTransactions = useLiveQuery(() => db.transactions.orderBy('id').reverse().limit(5).toArray()) ?? [];

  // Low & Zero stock items
  const lowOrZeroStockItems = items.filter(i => i.current_qty <= i.low_stock_threshold);
  const totalValuation = items.reduce((acc, i) => acc + (i.current_qty * (i.latest_unit_cost || 0)), 0);
  const totalBoxesCount = items.reduce((acc, i) => acc + i.current_qty, 0);

  const scheduledDeliveries = deliveryPlans.filter(p => p.status === 'SCHEDULED' || p.status === 'DRAFT');

  const handleGlobalResetToZero = async () => {
    const confirmReset = window.confirm(
      'RESET ALL INVENTORY TO 0?\n\nAre you sure you want to set the current stock of ALL items to 0? This will record an audit trail entry.'
    );
    if (confirmReset) {
      await resetAllInventoryToZero();
      alert('All item stock quantities have been reset to 0.');
    }
  };

  return (
    <div className="space-y-4 text-slate-800">
      {/* Current Inventory Value & Returned Items Banner */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <span>Current Inventory Value</span>
          </div>
          <div className="text-lg font-black text-slate-900 mt-1">
            ₱{totalValuation.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
            <span>{items.length} SKUs</span>
            <span>•</span>
            <span className="text-emerald-600 font-bold flex items-center gap-0.5">
              <Box className="w-3 h-3" />
              {totalBoxesCount} Boxes
            </span>
          </div>
        </div>

        <div
          onClick={() => setActiveTab('backorder')}
          className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm cursor-pointer hover:border-purple-300 transition-all"
        >
          <div className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold">
            <FileQuestion className="w-4 h-4 text-purple-600" />
            <span>Returned Items</span>
          </div>
          <div className="text-lg font-black text-purple-700 mt-1">
            {openBackorders.length} Bad Orders
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {openBackorders.reduce((a, b) => a + b.qty, 0)} boxes to replace
          </div>
        </div>
      </div>

      {/* Low Stocks Dropdown Section */}
      <div className="bg-amber-50 rounded-2xl border border-amber-300 shadow-sm overflow-hidden">
        <button
          onClick={() => setIsLowStockOpen(!isLowStockOpen)}
          className="w-full flex items-center justify-between p-3.5 bg-amber-100/60 text-amber-900 font-bold text-sm hover:bg-amber-100 transition-all"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Low Stocks ({lowOrZeroStockItems.length})</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-amber-800 font-bold">
            <span>{isLowStockOpen ? 'Hide' : 'Show Details'}</span>
            {isLowStockOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {isLowStockOpen && (
          <div className="p-3.5 space-y-2 border-t border-amber-200/60">
            {lowOrZeroStockItems.length === 0 ? (
              <div className="text-center py-2 text-xs text-amber-800 font-medium">
                All inventory items are currently well-stocked.
              </div>
            ) : (
              lowOrZeroStockItems.map(item => (
                <div
                  key={item.id}
                  onClick={() => item.id && onSelectItem(item.id)}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-white hover:bg-slate-50 cursor-pointer border border-amber-200 shadow-2xs"
                >
                  <div>
                    <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                      <span>{item.name}</span>
                      {item.current_qty === 0 && (
                        <span className="px-1.5 py-0.2 text-[9px] font-extrabold bg-rose-100 text-rose-700 border border-rose-300 rounded">
                          0 STOCK
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500">{item.category} • {item.size}</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-extrabold text-xs ${item.current_qty === 0 ? 'text-rose-600' : 'text-amber-700'}`}>
                      {item.current_qty} {item.unit}
                    </div>
                    <div className="text-[10px] text-slate-400">({item.current_qty * (item.pcs_per_box || 1)} pcs)</div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Manage Inventory Dropdown Menu Section */}
      <div className="bg-white rounded-2xl border border-slate-300 shadow-md overflow-hidden">
        <button
          onClick={() => setIsManageInventoryOpen(!isManageInventoryOpen)}
          className="w-full flex items-center justify-between p-4 bg-[#0b2b3c] text-white font-black text-sm tracking-wide uppercase hover:bg-[#0f374c] transition-all"
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-[#ff6b00]" />
            <span>MANAGE INVENTORY</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-blue-200 font-bold">
            <span>{isManageInventoryOpen ? 'Collapse Menu' : 'Expand Menu'}</span>
            {isManageInventoryOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {isManageInventoryOpen && (
          <div className="p-4 space-y-4 bg-slate-50 border-t border-slate-200">
            {/* Quick Action Grid inside Manage Inventory Menu */}
            <div className="grid grid-cols-2 gap-3">
              {/* Inventory Reset Button */}
              <button
                onClick={handleGlobalResetToZero}
                className="card-action-grid py-4 px-3 flex flex-col items-center justify-center border-b-4 border-b-rose-600 group hover:bg-rose-50/50"
              >
                <div className="w-12 h-12 rounded-full border-2 border-rose-200 bg-rose-50 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform text-rose-600">
                  <RotateCcw className="w-6 h-6 stroke-[2.2]" />
                </div>
                <span className="font-extrabold text-xs text-slate-900 tracking-tight text-center">
                  Inventory Reset
                </span>
                <span className="text-[9px] text-rose-600 font-bold mt-0.5">Reset All to 0</span>
              </button>

              {/* Auto Add Stocks */}
              <button
                onClick={() => setActiveTab('ocr_intake')}
                className="card-action-grid py-4 px-3 flex flex-col items-center justify-center border-b-4 border-b-[#ff6b00] group"
              >
                <div className="icon-ring-blue flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                  <ScanLine className="w-6 h-6 text-[#0b2b3c] stroke-[2.2]" />
                </div>
                <span className="font-extrabold text-xs text-slate-900 tracking-tight text-center">
                  Auto Add Stocks
                </span>
                <span className="text-[9px] text-slate-500 font-semibold mt-0.5">OCR Invoice Scan</span>
              </button>

              {/* Update Stocks */}
              <button
                onClick={onOpenReceiveModal}
                className="card-action-grid py-4 px-3 flex flex-col items-center justify-center border-b-4 border-b-cyan-500 group"
              >
                <div className="icon-ring-blue flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                  <Layers className="w-6 h-6 text-cyan-600 stroke-[2.2]" />
                </div>
                <span className="font-extrabold text-xs text-slate-900 tracking-tight text-center">
                  Update Stocks
                </span>
                <span className="text-[9px] text-slate-500 font-semibold mt-0.5">Receive & Freezers</span>
              </button>

              {/* Manual Add Stocks */}
              <button
                onClick={onOpenManualIntake}
                className="card-action-grid py-4 px-3 flex flex-col items-center justify-center border-b-4 border-b-purple-500 group"
              >
                <div className="icon-ring-blue flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                  <ArrowDownToLine className="w-6 h-6 text-purple-600 stroke-[2.2]" />
                </div>
                <span className="font-extrabold text-xs text-slate-900 tracking-tight text-center">
                  Manual Add Stocks
                </span>
                <span className="text-[9px] text-slate-500 font-semibold mt-0.5">Manual Entry</span>
              </button>

              {/* Set up Delivery Schedule */}
              <button
                onClick={() => setActiveTab('delivery')}
                className="card-action-grid py-4 px-3 flex flex-col items-center justify-center border-b-4 border-b-blue-600 group col-span-2"
              >
                <div className="icon-ring-blue flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                  <Truck className="w-6 h-6 text-blue-600 stroke-[2.2]" />
                </div>
                <span className="font-extrabold text-xs text-slate-900 tracking-tight text-center">
                  Set up Delivery Schedule
                </span>
                <span className="text-[9px] text-slate-500 font-semibold mt-0.5">Delivery Orders & Plans</span>
              </button>
            </div>

            {/* Upcoming Scheduled Deliveries inside Manage Inventory Menu */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-[#ff6b00]" />
                  <span>Pending Deliveries ({scheduledDeliveries.length})</span>
                </h2>
                <button
                  onClick={() => setActiveTab('delivery')}
                  className="text-xs font-bold text-[#ff6b00] hover:underline"
                >
                  Manage
                </button>
              </div>

              {scheduledDeliveries.length === 0 ? (
                <div className="text-center py-2 text-xs text-slate-400 font-medium">
                  No pending delivery orders found.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {scheduledDeliveries.slice(0, 2).map(plan => (
                    <div
                      key={plan.id}
                      onClick={() => setActiveTab('delivery')}
                      className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 cursor-pointer border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-900">{plan.client_name}</div>
                        <div className="text-[10px] text-slate-500">Date: {plan.delivery_date}</div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        {plan.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Activity Audit Logs inside Manage Inventory Menu */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-4 h-4 text-blue-600" />
                  <span>Recent Stock Audit Log</span>
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsResetAuditModalOpen(true)}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 border border-rose-200"
                    title="Reset & Clear Audit Logs (OTP: 1201)"
                  >
                    <Trash2 className="w-3 h-3 text-rose-600" />
                    <span>Clear</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('history')}
                    className="text-[11px] font-bold text-blue-600 hover:underline"
                  >
                    View All
                  </button>
                </div>
              </div>

              <ResetAuditLogModal
                isOpen={isResetAuditModalOpen}
                onClose={() => setIsResetAuditModalOpen(false)}
                onSuccess={() => {
                  alert('Audit trail logs have been reset & cleared.');
                }}
              />

              <div className="space-y-1.5">
                {recentTransactions.map(tx => (
                  <div key={tx.id} className="p-2 rounded-lg bg-slate-50 text-xs border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-800">{tx.item_name}</div>
                      <div className="text-[10px] text-slate-500">{tx.reason}</div>
                    </div>
                    <div className="text-right">
                      <span className={`font-black ${tx.qty_delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {tx.qty_delta >= 0 ? `+${tx.qty_delta}` : tx.qty_delta}
                      </span>
                      <div className="text-[9px] text-slate-400">
                        {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


