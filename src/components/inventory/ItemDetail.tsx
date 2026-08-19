import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import {
  ArrowLeft,
  PackageCheck,
  Edit3,
  History,
  Plus,
  AlertTriangle,
  Barcode,
  Building2,
} from 'lucide-react';

interface ItemDetailProps {
  itemId: number;
  onBack: () => void;
  onOpenReceiveModal: (itemId: number) => void;
  onOpenCorrectionModal: (itemId: number) => void;
}

export const ItemDetail: React.FC<ItemDetailProps> = ({
  itemId,
  onBack,
  onOpenReceiveModal,
  onOpenCorrectionModal,
}) => {
  const [showAddAlias, setShowAddAlias] = useState(false);
  const [supplierName, setSupplierName] = useState('');
  const [supplierCode, setSupplierCode] = useState('');

  const item = useLiveQuery(() => db.items.get(itemId), [itemId]);
  const supplierCodes = useLiveQuery(() => db.supplierItemCodes.where('item_id').equals(itemId).toArray(), [itemId]) ?? [];
  const transactions = useLiveQuery(() => db.transactions.where('item_id').equals(itemId).reverse().toArray(), [itemId]) ?? [];

  if (!item) {
    return (
      <div className="card-glass p-8 text-center text-slate-400">
        Item not found or deleted.
        <button onClick={onBack} className="block mx-auto mt-4 text-xs font-bold text-red-400">
          Go Back
        </button>
      </div>
    );
  }

  const isLowStock = item.current_qty <= item.low_stock_threshold;
  const valuation = item.current_qty * (item.latest_unit_cost || 0);

  const handleAddAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName.trim() || !supplierCode.trim()) return;

    await db.supplierItemCodes.add({
      item_id: itemId,
      supplier_name: supplierName.trim(),
      supplier_code: supplierCode.trim().toUpperCase(),
      created_at: new Date().toISOString(),
    });

    setSupplierName('');
    setSupplierCode('');
    setShowAddAlias(false);
  };

  return (
    <div className="space-y-4">
      {/* Top Header Navigation */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Inventory List</span>
      </button>

      {/* Main Item Card Header */}
      <div className={`card-glass p-4 border ${isLowStock ? 'border-amber-500/40 bg-slate-900/90' : 'border-slate-800'}`}>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {item.sku_code}
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-rose-950/60 text-rose-300 border border-rose-800/40">
                {item.category}
              </span>
            </div>

            <h2 className="text-lg font-extrabold text-white tracking-tight leading-snug">
              {item.name}
            </h2>
            <div className="text-xs text-slate-400">Size / Package: <strong className="text-slate-200">{item.size}</strong></div>
          </div>

          <div className="text-right">
            <div className="text-2xl font-black text-white">
              {item.current_qty} <span className="text-xs font-bold text-slate-400">{item.unit}</span>
            </div>
            {isLowStock && (
              <span className="text-[10px] font-bold text-amber-400 flex items-center justify-end gap-1 mt-0.5">
                <AlertTriangle className="w-3 h-3" />
                Low Stock Alert
              </span>
            )}
          </div>
        </div>

        {/* Pricing & Valuation Bar */}
        <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-800 text-xs">
          <div>
            <span className="text-slate-400">Latest Unit Cost:</span>
            <div className="text-sm font-bold text-slate-200">
              ₱{item.latest_unit_cost?.toFixed(2) || '0.00'} / {item.unit}
            </div>
          </div>
          <div>
            <span className="text-slate-400">Total Stock Valuation:</span>
            <div className="text-sm font-bold text-emerald-400">
              ₱{valuation.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {/* Primary Action Buttons for Stock Management */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={() => onOpenReceiveModal(itemId)}
          className="btn-touch bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2"
        >
          <PackageCheck className="w-5 h-5 text-emerald-100" />
          <span>Receive Stock</span>
        </button>

        <button
          onClick={() => onOpenCorrectionModal(itemId)}
          className="btn-touch bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center gap-2"
        >
          <Edit3 className="w-5 h-5 text-amber-400" />
          <span>Correct Qty</span>
        </button>
      </div>

      {/* Supplier Item Codes / Aliases Section */}
      <div className="card-glass p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Barcode className="w-4 h-4 text-blue-400" />
            <span>Supplier Code Aliases ({supplierCodes.length})</span>
          </h3>

          <button
            onClick={() => setShowAddAlias(!showAddAlias)}
            className="text-xs font-bold text-blue-400 hover:underline flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Alias</span>
          </button>
        </div>

        {showAddAlias && (
          <form onSubmit={handleAddAlias} className="p-3 bg-slate-900/90 rounded-xl border border-slate-700 space-y-2">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="block text-[10px] text-slate-400 font-medium mb-1">Supplier Name</label>
                <input
                  type="text"
                  placeholder="e.g. CDO Foodsphere"
                  value={supplierName}
                  onChange={e => setSupplierName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 font-medium mb-1">Supplier Item Code</label>
                <input
                  type="text"
                  placeholder="e.g. CDO-HD-1K"
                  value={supplierCode}
                  onChange={e => setSupplierCode(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                  required
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddAlias(false)}
                className="px-2.5 py-1 text-xs text-slate-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg shadow"
              >
                Save Alias
              </button>
            </div>
          </form>
        )}

        {supplierCodes.length === 0 ? (
          <div className="text-xs text-slate-500 py-1">
            No supplier aliases mapped yet. OCR will use description fuzzy matching until learned.
          </div>
        ) : (
          <div className="space-y-1.5">
            {supplierCodes.map(alias => (
              <div key={alias.id} className="flex items-center justify-between p-2 rounded bg-slate-900/60 text-xs border border-slate-800">
                <div className="flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-300 font-medium">{alias.supplier_name}</span>
                </div>
                <span className="font-mono font-bold text-blue-400 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-800/40">
                  {alias.supplier_code}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transaction History Log for this Item */}
      <div className="card-glass p-3.5 space-y-2.5">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <History className="w-4 h-4 text-emerald-400" />
          <span>Stock Audit Trail</span>
        </h3>

        {transactions.length === 0 ? (
          <div className="text-xs text-slate-500 py-2">No transaction history recorded yet.</div>
        ) : (
          <div className="space-y-2">
            {transactions.map(tx => (
              <div key={tx.id} className="p-2.5 rounded bg-slate-900/80 border border-slate-800 text-xs flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-200">{tx.type}</div>
                  <div className="text-[11px] text-slate-400">{tx.reason}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {new Date(tx.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-extrabold text-sm ${tx.qty_delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {tx.qty_delta >= 0 ? `+${tx.qty_delta}` : tx.qty_delta} {item.unit}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Result: <strong className="text-slate-200">{tx.resulting_qty}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
