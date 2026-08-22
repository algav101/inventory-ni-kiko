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
  Trash2,
  ArrowDownToLine,
  Layers,
  RotateCcw,
  SlidersHorizontal,
  CheckCircle2,
  Clock,
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
  const [isValuationOpen, setIsValuationOpen] = useState(true);
  const [isDeliveryProgressOpen, setIsDeliveryProgressOpen] = useState(true);
  const [isLowStockOpen, setIsLowStockOpen] = useState(true);
  const [isManageInventoryOpen, setIsManageInventoryOpen] = useState(true);
  const [isBadOrdersMenuOpen, setIsBadOrdersMenuOpen] = useState(false);

  const items = useLiveQuery(() => db.items.toArray()) ?? [];
  const openBackorders = useLiveQuery(() => db.backOrders.where('status').equals('OPEN').toArray()) ?? [];
  const deliveryPlans = useLiveQuery(() => db.deliveryPlans.toArray()) ?? [];
  const deliveryLineItems = useLiveQuery(() => db.deliveryLineItems.toArray()) ?? [];
  const recentTransactions = useLiveQuery(() => db.transactions.orderBy('id').reverse().limit(5).toArray()) ?? [];

  // Low & Zero stock items
  const lowOrZeroStockItems = items.filter(i => i.current_qty <= i.low_stock_threshold);
  const totalValuation = items.reduce((acc, i) => acc + (i.current_qty * (i.latest_unit_cost || 0)), 0);
  const totalBoxesCount = items.reduce((acc, i) => acc + i.current_qty, 0);

  const scheduledDeliveries = deliveryPlans.filter(p => p.status === 'SCHEDULED' || p.status === 'DRAFT');

  // Delivered vs Undelivered items for scheduled delivery plans
  const deliveredLineItems = deliveryLineItems.filter(item => item.qty_delivered > 0);
  const undeliveredLineItems = deliveryLineItems.filter(item => item.qty_delivered === 0 || item.qty_delivered < item.qty_planned);

  // Category Valuation Summary
  const categorySummary = items.reduce((acc, item) => {
    const cat = item.category || 'Other';
    const val = item.current_qty * (item.latest_unit_cost || 0);
    if (!acc[cat]) {
      acc[cat] = { count: 0, boxes: 0, value: 0 };
    }
    acc[cat].count += 1;
    acc[cat].boxes += item.current_qty;
    acc[cat].value += val;
    return acc;
  }, {} as Record<string, { count: number; boxes: number; value: number }>);

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
      {/* 1. Current Inventory Value Toggle Button & Detailed Section */}
      <div className="bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden transition-all">
        <button
          onClick={() => setIsValuationOpen(!isValuationOpen)}
          className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-emerald-900 to-[#0b2b3c] text-white font-bold hover:brightness-110 transition-all"
        >
          <div className="flex items-center gap-2.5">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <div className="text-left">
              <div className="text-xs text-emerald-200 uppercase tracking-wider font-extrabold">
                Current Inventory Value
              </div>
              <div className="text-lg font-black text-white">
                ₱{totalValuation.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-emerald-200 font-bold">
            <span className="hidden sm:inline">{items.length} SKUs • {totalBoxesCount} Boxes</span>
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 text-white border border-white/20">
              <span>{isValuationOpen ? 'Hide' : 'Show Summary'}</span>
              {isValuationOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>
        </button>

        {isValuationOpen && (
          <div className="p-3.5 space-y-3 bg-slate-50 border-t border-slate-200">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {Object.entries(categorySummary).map(([catName, stats]) => (
                <div key={catName} className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
                  <div className="text-xs font-bold text-slate-900 truncate">{catName}</div>
                  <div className="text-sm font-extrabold text-emerald-600 mt-0.5">
                    ₱{stats.value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {stats.count} SKUs • {stats.boxes} Boxes
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>


      {/* 2. Scheduled Delivery Day Progress: Delivered vs Undelivered Toggle Button */}

      <div className="bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden">
        <button
          onClick={() => setIsDeliveryProgressOpen(!isDeliveryProgressOpen)}
          className="w-full flex items-center justify-between p-3.5 bg-blue-900 text-white-force font-bold hover:bg-blue-950 transition-all"
        >
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-blue-300" />
            <div className="text-left">
              <span className="text-xs text-blue-200 font-extrabold uppercase tracking-wider block">
                Scheduled Delivery Day Performance
              </span>
              <span className="text-sm font-black text-white-force">
                Delivered ({deliveredLineItems.length}) vs Undelivered ({undeliveredLineItems.length})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 text-xs text-blue-200 font-bold px-2 py-1 rounded-lg bg-white/10 border border-white/20">
            <span className="text-white-force">{isDeliveryProgressOpen ? 'Hide' : 'View Details'}</span>
            {isDeliveryProgressOpen ? <ChevronUp className="w-4 h-4 text-white-force" /> : <ChevronDown className="w-4 h-4 text-white-force" />}
          </div>
        </button>

        {isDeliveryProgressOpen && (
          <div className="p-3.5 space-y-3 bg-slate-50 border-t border-slate-200">
            <div className="grid grid-cols-2 gap-3">
              {/* Delivered Items Summary */}
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="flex items-center gap-1.5 text-emerald-800 font-extrabold text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Delivered Items ({deliveredLineItems.length})</span>
                </div>
                {deliveredLineItems.length === 0 ? (
                  <div className="text-[11px] text-slate-500 mt-2 italic">No delivered items logged yet today.</div>
                ) : (
                  <div className="mt-2 space-y-1 max-h-36 overflow-y-auto">
                    {deliveredLineItems.map(item => (
                      <div key={item.id} className="text-[11px] text-slate-800 flex justify-between bg-white p-1.5 rounded border border-emerald-100">
                        <span className="truncate font-semibold">{item.item_name}</span>
                        <strong className="text-emerald-700">{item.qty_delivered} / {item.qty_planned} {item.unit}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Undelivered Items Summary */}
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                <div className="flex items-center gap-1.5 text-amber-900 font-extrabold text-xs">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>Undelivered Items ({undeliveredLineItems.length})</span>
                </div>
                {undeliveredLineItems.length === 0 ? (
                  <div className="text-[11px] text-slate-500 mt-2 italic">All scheduled items delivered!</div>
                ) : (
                  <div className="mt-2 space-y-1 max-h-36 overflow-y-auto">
                    {undeliveredLineItems.map(item => (
                      <div key={item.id} className="text-[11px] text-slate-800 flex justify-between bg-white p-1.5 rounded border border-amber-100">
                        <span className="truncate font-semibold">{item.item_name}</span>
                        <strong className="text-amber-700">{item.qty_planned - item.qty_delivered} pending</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Low Stocks Dropdown Section */}
      <div className="rounded-2xl border border-amber-400 shadow-sm overflow-hidden">
        <button
          onClick={() => setIsLowStockOpen(!isLowStockOpen)}
          className="w-full flex items-center justify-between p-3.5 bg-amber-500 text-slate-950 font-black text-sm hover:bg-amber-400 transition-all shadow-xs"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-slate-950" />
            <span className="font-extrabold">Low Stocks ({lowOrZeroStockItems.length})</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-950 font-bold px-2 py-1 rounded bg-black/10">
            <span>{isLowStockOpen ? 'Hide' : 'Show Details'}</span>
            {isLowStockOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {isLowStockOpen && (
          <div className="p-3.5 space-y-2 bg-amber-50/50 border-t border-amber-200">
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

      {/* 4. Manage Inventory Dropdown Menu Section */}
      <div className="bg-white rounded-2xl border border-slate-300 shadow-md overflow-hidden">
        <button
          onClick={() => setIsManageInventoryOpen(!isManageInventoryOpen)}
          className="w-full flex items-center justify-between p-4 bg-[#0b2b3c] text-white-force font-black text-sm tracking-wide uppercase hover:bg-[#0f374c] transition-all"
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-[#ff6b00]" />
            <span className="text-white-force font-black">MANAGE INVENTORY</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-blue-200 font-bold">
            <span>{isManageInventoryOpen ? 'Collapse Menu' : 'Expand Menu'}</span>
            {isManageInventoryOpen ? <ChevronUp className="w-4 h-4 text-white-force" /> : <ChevronDown className="w-4 h-4 text-white-force" />}
          </div>
        </button>

        {isManageInventoryOpen && (
          <div className="p-4 space-y-4 bg-slate-50 border-t border-slate-200">
            {/* Bad Items Returned Toggle Button inside Manage Inventory Menu */}
            <div className="bg-purple-900 text-white-force rounded-xl border border-purple-800 overflow-hidden shadow-xs">
              <button
                onClick={() => setIsBadOrdersMenuOpen(!isBadOrdersMenuOpen)}
                className="w-full flex items-center justify-between p-3.5 hover:bg-purple-950 transition-all"
              >
                <div className="flex items-center gap-2">
                  <FileQuestion className="w-5 h-5 text-purple-300" />
                  <div className="text-left">
                    <span className="text-xs text-purple-200 font-extrabold uppercase tracking-wider block">
                      Bad Items Returned (Bad Orders)
                    </span>
                    <span className="text-sm font-black text-white-force">
                      {openBackorders.length} Bad Orders ({openBackorders.reduce((a, b) => a + b.qty, 0)} boxes to replace)
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-xs text-purple-200 font-bold px-2 py-1 rounded bg-white/10 border border-white/20">
                  <span className="text-white-force">{isBadOrdersMenuOpen ? 'Hide' : 'Show Details'}</span>
                  {isBadOrdersMenuOpen ? <ChevronUp className="w-4 h-4 text-white-force" /> : <ChevronDown className="w-4 h-4 text-white-force" />}
                </div>
              </button>

              {isBadOrdersMenuOpen && (


                <div className="p-3 bg-purple-950/90 space-y-2 border-t border-purple-800 text-xs">
                  {openBackorders.length === 0 ? (
                    <div className="text-purple-200 text-center py-2">No pending bad order returned items.</div>
                  ) : (
                    openBackorders.map(bo => (
                      <div key={bo.id} className="p-2 rounded bg-purple-900/60 border border-purple-700/60 flex items-center justify-between text-purple-100">
                        <div>
                          <strong className="text-white block">{bo.item_name}</strong>
                          <span className="text-[10px] text-purple-300">{bo.client_name} • {bo.remarks}</span>
                        </div>
                        <strong className="text-amber-300 font-extrabold">{bo.qty} BOXES</strong>
                      </div>
                    ))
                  )}

                  <button
                    onClick={() => setActiveTab('backorder')}
                    className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-center shadow transition-all mt-2"
                  >
                    Open Returned Items Manager →
                  </button>
                </div>
              )}
            </div>

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
                <span className="font-extrabold text-xs tracking-tight text-center">
                  Inventory Reset
                </span>
                <span className="text-[9px] font-bold mt-0.5 opacity-80">Reset All to 0</span>
              </button>

              {/* Auto Add Stocks */}
              <button
                onClick={() => setActiveTab('ocr_intake')}
                className="card-action-grid py-4 px-3 flex flex-col items-center justify-center border-b-4 border-b-[#ff6b00] group"
              >
                <div className="icon-ring-blue flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                  <ScanLine className="w-6 h-6 text-[#0b2b3c] stroke-[2.2]" />
                </div>
                <span className="font-extrabold text-xs tracking-tight text-center">
                  Auto Add Stocks
                </span>
                <span className="text-[9px] font-semibold mt-0.5 opacity-80">OCR Invoice Scan</span>
              </button>

              {/* Update Stocks */}
              <button
                onClick={onOpenReceiveModal}
                className="card-action-grid py-4 px-3 flex flex-col items-center justify-center border-b-4 border-b-cyan-500 group"
              >
                <div className="icon-ring-blue flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                  <Layers className="w-6 h-6 text-cyan-600 stroke-[2.2]" />
                </div>
                <span className="font-extrabold text-xs tracking-tight text-center">
                  Update Stocks
                </span>
                <span className="text-[9px] font-semibold mt-0.5 opacity-80">Receive & Freezers</span>
              </button>

              {/* Manual Add Stocks */}
              <button
                onClick={onOpenManualIntake}
                className="card-action-grid py-4 px-3 flex flex-col items-center justify-center border-b-4 border-b-purple-500 group"
              >
                <div className="icon-ring-blue flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                  <ArrowDownToLine className="w-6 h-6 text-purple-600 stroke-[2.2]" />
                </div>
                <span className="font-extrabold text-xs tracking-tight text-center">
                  Manual Add Stocks
                </span>
                <span className="text-[9px] font-semibold mt-0.5 opacity-80">Manual Entry</span>
              </button>

              {/* Set up Delivery Schedule */}
              <button
                onClick={() => setActiveTab('delivery')}
                className="card-action-grid py-4 px-3 flex flex-col items-center justify-center border-b-4 border-b-blue-600 group col-span-2"
              >
                <div className="icon-ring-blue flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                  <Truck className="w-6 h-6 text-blue-600 stroke-[2.2]" />
                </div>
                <span className="font-extrabold text-xs tracking-tight text-center">
                  Set up Delivery Schedule
                </span>
                <span className="text-[9px] font-semibold mt-0.5 opacity-80">Delivery Orders & Plans</span>
              </button>
            </div>

            {/* Upcoming Scheduled Deliveries inside Manage Inventory Menu */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-blue-600" />
                  <span>Pending Deliveries ({scheduledDeliveries.length})</span>
                </h2>
                <button
                  onClick={() => setActiveTab('delivery')}
                  className="text-xs font-bold text-blue-600 hover:underline"
                >
                  Manage
                </button>
              </div>

              {scheduledDeliveries.length === 0 ? (
                <div className="text-center py-2 text-xs text-slate-500 font-medium">
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
                <h2 className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-4 h-4 text-blue-600" />
                  <span>Recent Stock Audit Log</span>
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsResetAuditModalOpen(true)}
                    className="text-[11px] font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 border border-rose-200"
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

              {recentTransactions.length === 0 ? (
                <div className="text-center py-2 text-xs text-slate-400 font-medium">
                  No inventory transactions logged yet.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {recentTransactions.slice(0, 3).map(tx => (
                    <div key={tx.id} className="text-[11px] flex items-center justify-between p-1.5 rounded bg-slate-50 border border-slate-100">
                      <div className="truncate pr-2">
                        <span className="font-bold text-slate-900">{tx.item_name}</span>
                        <span className="text-[10px] text-slate-500 block truncate">{tx.type} • {tx.reason || 'Routine log'}</span>
                      </div>
                      <span className={`font-bold shrink-0 ${tx.qty_delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {tx.qty_delta >= 0 ? `+${tx.qty_delta}` : tx.qty_delta}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Reset Audit Trail Auth Modal */}
      <ResetAuditLogModal
        isOpen={isResetAuditModalOpen}
        onClose={() => setIsResetAuditModalOpen(false)}
        onSuccess={() => {
          alert('Audit trail logs have been reset & cleared.');
        }}
      />
    </div>
  );
};




