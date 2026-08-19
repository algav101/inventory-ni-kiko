import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, correctStockQuantity } from '../../db/database';
import { Edit3, X } from 'lucide-react';

interface StockCorrectionModalProps {
  itemId: number;
  isOpen: boolean;
  onClose: () => void;
}

export const StockCorrectionModal: React.FC<StockCorrectionModalProps> = ({
  itemId,
  isOpen,
  onClose,
}) => {
  const item = useLiveQuery(() => db.items.get(itemId), [itemId]);
  const [newQtyInput, setNewQtyInput] = useState<string>('');
  const [reason, setReason] = useState<string>('');

  if (!isOpen || !item) return null;

  const currentQty = item.current_qty;
  const parsedNewQty = newQtyInput !== '' ? parseFloat(newQtyInput) : currentQty;
  const delta = isNaN(parsedNewQty) ? 0 : parsedNewQty - currentQty;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(parsedNewQty) || parsedNewQty < 0) return;
    if (!reason.trim()) return;

    await correctStockQuantity(itemId, parsedNewQty, reason.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="card-glass w-full max-w-md p-5 bg-slate-900 border-slate-700 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 font-bold text-base text-white">
            <Edit3 className="w-5 h-5 text-amber-400" />
            <span>Manual Stock Correction</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="text-xs text-slate-400">Target Item</div>
            <div className="font-bold text-sm text-white">{item.name} ({item.size})</div>
            <div className="text-xs text-slate-400">Current DB Stock: <strong className="text-slate-200">{currentQty} {item.unit}</strong></div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Corrected Physical Stock Count ({item.unit})
            </label>
            <input
              type="number"
              step="any"
              min="0"
              placeholder={currentQty.toString()}
              value={newQtyInput}
              onChange={e => setNewQtyInput(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-base text-white font-mono font-bold focus:outline-none focus:border-amber-500"
              required
            />
          </div>

          {/* Delta Display */}
          <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-between text-xs">
            <span className="text-slate-400">Adjustment Delta:</span>
            <span className={`font-extrabold text-sm ${delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
              {delta > 0 ? `+${delta}` : delta} {item.unit}
            </span>
          </div>

          {/* Mandatory Reason */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Reason / Remark <span className="text-rose-400">* Required</span>
            </label>
            <textarea
              placeholder="e.g. Physical recount discrepancy, damaged box, spoilage, or miscounted package"
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={2}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
              required
            />
          </div>

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
              disabled={!reason.trim()}
              className="btn-touch px-5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-amber-950/40"
            >
              Commit Correction
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
