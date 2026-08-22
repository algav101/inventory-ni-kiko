import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, resetAllInventoryToZero } from '../../db/database';
import { ResetAuditLogModal } from '../history/ResetAuditLogModal';
import {
  AlertTriangle,
  FileQuestion,
  Truck,
  ScanLine,
  PlusCircle,
  TrendingUp,
  History,
  PackageCheck,
  ChevronRight,
  RotateCcw,
  Box,
  Trash2,
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
  const totalPcsCount = items.reduce((acc, i) => acc + (i.current_qty * (i.pcs_per_box || 1)), 0);

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
    <div className="space-y-4">
      {/* Valuation & Quick Overview Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card-glass p-3.5 bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700/60">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span>Stock Valuation</span>
          </div>
          <div className="text-xl font-extrabold text-white mt-1">
            ₱{totalValuation.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
            <span>{items.length} SKUs</span>
            <span>•</span>
            <span className="text-emerald-400 font-bold flex items-center gap-0.5">
              <Box className="w-3 h-3" />
              {totalBoxesCount} BOXES ({totalPcsCount} pcs)
            </span>
          </div>
        </div>

        <div className="card-glass p-3.5 bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700/60">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
            <FileQuestion className="w-4 h-4 text-purple-400" />
            <span>Pending BOs</span>
          </div>
          <div className="text-xl font-extrabold text-purple-300 mt-1">
            {openBackorders.length} Orders
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {openBackorders.reduce((a, b) => a + b.qty, 0)} boxes requested
          </div>
        </div>
      </div>

      {/* Low Stock Alert Section */}
      {lowStockItems.length > 0 && (
        <div className="card-glass p-4 bg-amber-950/30 border-amber-500/40">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
              <AlertTriangle className="w-4 h-4 animate-bounce" />
              <span>Low Stock Alerts ({lowStockItems.length})</span>
            </div>
            <button
              onClick={() => setActiveTab('inventory')}
              className="text-xs font-semibold text-amber-400 hover:underline flex items-center gap-0.5"
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
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/80 hover:bg-slate-800/80 cursor-pointer border border-amber-500/20"
              >
                <div>
                  <div className="font-semibold text-xs text-slate-200">{item.name}</div>
                  <div className="text-[11px] text-slate-400">{item.category} • {item.size} • {item.pcs_per_box || 12} pcs/box</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-xs text-amber-400">{item.current_qty} {item.unit}</div>
                  <div className="text-[10px] text-slate-500">({item.current_qty * (item.pcs_per_box || 1)} total pcs)</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Action Grid */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Quick Warehouse Actions
          </h2>
          <button
            onClick={handleGlobalResetToZero}
            className="text-[11px] font-bold text-rose-400 hover:underline flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Inventory to 0</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={() => setActiveTab('ocr_intake')}
            className="btn-touch bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-lg shadow-red-900/30 flex items-center gap-2"
          >
            <ScanLine className="w-5 h-5 text-rose-200" />
            <span>OCR Invoice Scan</span>
          </button>

          <button
            onClick={onOpenReceiveModal}
            className="btn-touch bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 flex items-center gap-2"
          >
            <PackageCheck className="w-5 h-5 text-emerald-400" />
            <span>Receive Stock</span>
          </button>

          <button
            onClick={onOpenManualIntake}
            className="btn-touch bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 flex items-center gap-2"
          >
            <PlusCircle className="w-5 h-5 text-blue-400" />
            <span>Manual Intake</span>
          </button>

          <button
            onClick={() => setActiveTab('delivery')}
            className="btn-touch bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 flex items-center gap-2"
          >
            <Truck className="w-5 h-5 text-amber-400" />
            <span>Delivery Plan</span>
          </button>
        </div>
      </div>

      {/* Upcoming Scheduled Deliveries */}
      <div className="card-glass p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Truck className="w-4 h-4 text-amber-400" />
            <span>Pending Deliveries ({scheduledDeliveries.length})</span>
          </h2>
          <button
            onClick={() => setActiveTab('delivery')}
            className="text-xs font-medium text-red-400 hover:underline"
          >
            Manage
          </button>
        </div>

        {scheduledDeliveries.length === 0 ? (
          <div className="text-center py-4 text-xs text-slate-500">
            No pending delivery plans. Create one to dispatch stock.
          </div>
        ) : (
          <div className="space-y-2">
            {scheduledDeliveries.slice(0, 2).map(plan => (
              <div
                key={plan.id}
                onClick={() => setActiveTab('delivery')}
                className="p-2.5 rounded-lg bg-slate-900/60 hover:bg-slate-800/80 cursor-pointer border border-slate-700/60 flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-xs text-slate-200">{plan.client_name}</div>
                  <div className="text-[11px] text-slate-400">Date: {plan.delivery_date}</div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {plan.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity Audit Logs */}
      <div className="card-glass p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <History className="w-4 h-4 text-blue-400" />
            <span>Recent Stock Audit Log</span>
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsResetAuditModalOpen(true)}
              className="text-xs font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950/40 border border-rose-900/50"
              title="Reset & Clear Audit Trail Logs (OTP: 1201)"
            >
              <Trash2 className="w-3 h-3 text-rose-400" />
              <span>Reset Logs</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className="text-xs font-medium text-blue-400 hover:underline"
            >
              Full Trail
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
            <div key={tx.id} className="p-2 rounded bg-slate-900/40 text-xs border border-slate-800 flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-300">{tx.item_name}</div>
                <div className="text-[10px] text-slate-500">{tx.reason}</div>
              </div>
              <div className="text-right">
                <span className={`font-bold ${tx.qty_delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {tx.qty_delta >= 0 ? `+${tx.qty_delta}` : tx.qty_delta}
                </span>
                <div className="text-[9px] text-slate-500">
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
