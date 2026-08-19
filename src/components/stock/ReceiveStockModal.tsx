import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, receiveStock } from '../../db/database';
import { PackageCheck, X, AlertCircle } from 'lucide-react';

interface ReceiveStockModalProps {
  itemId?: number;
  isOpen: boolean;
  onClose: () => void;
}

export const ReceiveStockModal: React.FC<ReceiveStockModalProps> = ({
  itemId: initialItemId,
  isOpen,
  onClose,
}) => {
  const items = useLiveQuery(() => db.items.toArray()) ?? [];
  const [selectedItemId, setSelectedItemId] = useState<number>(initialItemId || (items[0]?.id ?? 0));
  const [mode, setMode] = useState<'ADD' | 'RESET'>('ADD');
  const [qtyInput, setQtyInput] = useState<string>('10');
  const [unitCostInput, setUnitCostInput] = useState<string>('');
  const [reason, setReason] = useState<string>('');

  if (!isOpen) return null;

  const currentItem = items.find(i => i.id === (selectedItemId || initialItemId));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const itemIdToUse = selectedItemId || initialItemId;
    if (!itemIdToUse) return;

    const numQty = parseFloat(qtyInput);
    if (isNaN(numQty) || numQty < 0) return;

    const costVal = unitCostInput ? parseFloat(unitCostInput) : null;

    await receiveStock(
      itemIdToUse,
      numQty,
      mode,
      costVal,
      reason.trim() || (mode === 'ADD' ? 'Supplier Restock' : 'Physical Recount Reset')
    );

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="card-glass w-full max-w-md p-5 bg-slate-900 border-slate-700 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 font-bold text-base text-white">
            <PackageCheck className="w-5 h-5 text-emerald-400" />
            <span>Receive / Adjust Incoming Stock</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Select Item */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Select Item SKU</label>
            <select
              value={selectedItemId || initialItemId}
              onChange={e => setSelectedItemId(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              required
            >
              {items.map(item => (
                <option key={item.id} value={item.id}>
                  {item.sku_code} - {item.name} ({item.size}) - Qty: {item.current_qty} {item.unit}
                </option>
              ))}
            </select>
          </div>

          {/* Mode Selector (ADD vs RESET) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Action Mode (Select explicitly)
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setMode('ADD')}
                className={`py-2 rounded-lg font-bold text-xs transition-all ${
                  mode === 'ADD'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                + ADD Stock
              </button>
              <button
                type="button"
                onClick={() => setMode('RESET')}
                className={`py-2 rounded-lg font-bold text-xs transition-all ${
                  mode === 'RESET'
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ⚙ RESET / Overwrite
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />
              {mode === 'ADD'
                ? 'Adds quantity to current stock (e.g. supplier delivery arrival).'
                : 'Overwrites stock directly to new count (for physical stock count reset).'}
            </p>
          </div>

          {/* Quantity & Unit Cost */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {mode === 'ADD' ? 'Quantity to Add' : 'New Stock Quantity'} ({currentItem?.unit || 'Units'})
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={qtyInput}
                onChange={e => setQtyInput(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Unit Cost ₱ (Optional)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder={currentItem?.latest_unit_cost?.toString() || '0.00'}
                value={unitCostInput}
                onChange={e => setUnitCostInput(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Reason / Remarks */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Audit Reason / Remarks</label>
            <input
              type="text"
              placeholder={mode === 'ADD' ? 'Supplier PO #1092 restock' : 'Recount adjustment after inventory audit'}
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`btn-touch px-5 rounded-xl text-xs font-bold text-white shadow-lg ${
                mode === 'ADD' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-amber-600 hover:bg-amber-500'
              }`}
            >
              Confirm Stock Update
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
