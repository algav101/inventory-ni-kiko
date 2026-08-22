import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { ResetAuditLogModal } from '../history/ResetAuditLogModal';
import {
  AlertTriangle,
  FileQuestion,
  Truck,
  ScanLine,
  TrendingUp,
  History,
  ChevronRight,
  Box,
  Trash2,
  ArrowUpFromLine,
  ArrowDownToLine,
  SearchCode,
  Layers,
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
  const items = useLiveQuery(() => db.items.toArray()) ?? [];
  const openBackorders = useLiveQuery(() => db.backOrders.where('status').equals('OPEN').toArray()) ?? [];
  const deliveryPlans = useLiveQuery(() => db.deliveryPlans.toArray()) ?? [];
  const recentTransactions = useLiveQuery(() => db.transactions.orderBy('id').reverse().limit(5).toArray()) ?? [];

  const lowStockItems = items.filter(i => i.current_qty <= i.low_stock_threshold);
  const totalValuation = items.reduce((acc, i) => acc + (i.current_qty * (i.latest_unit_cost || 0)), 0);
  const totalBoxesCount = items.reduce((acc, i) => acc + i.current_qty, 0);

  const scheduledDeliveries = deliveryPlans.filter(p => p.status === 'SCHEDULED' || p.status === 'DRAFT');


  return (
    <div className="space-y-4 text-slate-800">
      {/* 6-Card Action Menu Grid (Exact Match to Reference Screenshot) */}
      <div className="grid grid-cols-2 gap-3.5 pt-1">
        {/* Card 1: GRN */}
        <button
          onClick={() => setActiveTab('ocr_intake')}
          className="card-action-grid py-6 px-3 flex flex-col items-center justify-center border-b-4 border-b-[#ff6b00] group"
        >
          <div className="icon-ring-blue flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <ScanLine className="w-8 h-8 text-[#0b2b3c] stroke-[2.2]" />
          </div>
          <span className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight">
            GRN
          </span>
          <span className="text-[10px] text-slate-500 font-semibold mt-0.5">OCR Invoice Scan</span>
        </button>

        {/* Card 2: Delivery Order */}
        <button
          onClick={() => setActiveTab('delivery')}
          className="card-action-grid py-6 px-3 flex flex-col items-center justify-center border-b-4 border-b-blue-600 group"
        >
          <div className="icon-ring-blue flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <Truck className="w-8 h-8 text-blue-600 stroke-[2.2]" />
          </div>
          <span className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight">
            Delivery Order
          </span>
          <span className="text-[10px] text-slate-500 font-semibold mt-0.5">Dispatches & Plans</span>
        </button>

        {/* Card 3: Stock Transfer */}
        <button
          onClick={onOpenReceiveModal}
          className="card-action-grid py-6 px-3 flex flex-col items-center justify-center border-b-4 border-b-cyan-500 group"
        >
          <div className="icon-ring-blue flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <Layers className="w-8 h-8 text-cyan-600 stroke-[2.2]" />
          </div>
          <span className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight">
            Stock Transfer
          </span>
          <span className="text-[10px] text-slate-500 font-semibold mt-0.5">Receive & Freezers</span>
        </button>

        {/* Card 4: Stock Take */}
        <button
          onClick={() => setActiveTab('inventory')}
          className="card-action-grid py-6 px-3 flex flex-col items-center justify-center border-b-4 border-b-sky-500 group"
        >
          <div className="icon-ring-blue flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <ArrowUpFromLine className="w-8 h-8 text-sky-600 stroke-[2.2]" />
          </div>
          <span className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight">
            Stock Take
          </span>
          <span className="text-[10px] text-slate-500 font-semibold mt-0.5">Catalog & Corrections</span>
        </button>

        {/* Card 5: PO */}
        <button
          onClick={onOpenManualIntake}
          className="card-action-grid py-6 px-3 flex flex-col items-center justify-center border-b-4 border-b-purple-500 group"
        >
          <div className="icon-ring-blue flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <ArrowDownToLine className="w-8 h-8 text-purple-600 stroke-[2.2]" />
          </div>
          <span className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight">
            PO
          </span>
          <span className="text-[10px] text-slate-500 font-semibold mt-0.5">Manual Stock Intake</span>
        </button>

        {/* Card 6: Gap Check */}
        <button
          onClick={() => setActiveTab('history')}
          className="card-action-grid py-6 px-3 flex flex-col items-center justify-center border-b-4 border-b-indigo-500 group"
        >
          <div className="icon-ring-blue flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <SearchCode className="w-8 h-8 text-indigo-600 stroke-[2.2]" />
          </div>
          <span className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight">
            Gap Check
          </span>
          <span className="text-[10px] text-slate-500 font-semibold mt-0.5">Audit Log & Check</span>
        </button>
      </div>

      {/* Valuation & Overview Banner */}
      <div className="grid grid-cols-2 gap-3 mt-2">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <span>Stock Valuation</span>
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

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold">
            <FileQuestion className="w-4 h-4 text-purple-600" />
            <span>Pending BOs</span>
          </div>
          <div className="text-lg font-black text-purple-700 mt-1">
            {openBackorders.length} Orders
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {openBackorders.reduce((a, b) => a + b.qty, 0)} total boxes requested
          </div>
        </div>
      </div>

      {/* Low Stock Alert Section */}
      {lowStockItems.length > 0 && (
        <div className="bg-amber-50 p-4 rounded-2xl border border-amber-300 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-600 animate-bounce" />
              <span>Low Stock Alerts ({lowStockItems.length})</span>
            </div>
            <button
              onClick={() => setActiveTab('inventory')}
              className="text-xs font-bold text-amber-800 hover:underline flex items-center gap-0.5"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2">
            {lowStockItems.slice(0, 3).map(item => (
              <div
                key={item.id}
                onClick={() => item.id && onSelectItem(item.id)}
                className="flex items-center justify-between p-2.5 rounded-xl bg-white hover:bg-slate-50 cursor-pointer border border-amber-200 shadow-2xs"
              >
                <div>
                  <div className="font-bold text-xs text-slate-900">{item.name}</div>
                  <div className="text-[11px] text-slate-500">{item.category} • {item.size}</div>
                </div>
                <div className="text-right">
                  <div className="font-extrabold text-xs text-amber-700">{item.current_qty} {item.unit}</div>
                  <div className="text-[10px] text-slate-400">({item.current_qty * (item.pcs_per_box || 1)} pcs)</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Scheduled Deliveries */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2.5">
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
          <div className="text-center py-3 text-xs text-slate-400 font-medium">
            No pending delivery orders found.
          </div>
        ) : (
          <div className="space-y-2">
            {scheduledDeliveries.slice(0, 2).map(plan => (
              <div
                key={plan.id}
                onClick={() => setActiveTab('delivery')}
                className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 cursor-pointer border border-slate-200 flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-xs text-slate-900">{plan.client_name}</div>
                  <div className="text-[11px] text-slate-500">Date: {plan.delivery_date}</div>
                </div>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  {plan.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity Audit Logs */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <History className="w-4 h-4 text-blue-600" />
            <span>Recent Audit Logs</span>
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsResetAuditModalOpen(true)}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-50 border border-rose-200"
              title="Reset & Clear Audit Logs (OTP: 1201)"
            >
              <Trash2 className="w-3 h-3 text-rose-600" />
              <span>Clear</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className="text-xs font-bold text-blue-600 hover:underline"
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

        <div className="space-y-2">
          {recentTransactions.map(tx => (
            <div key={tx.id} className="p-2 rounded-xl bg-slate-50 text-xs border border-slate-200 flex items-center justify-between">
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
  );
};

