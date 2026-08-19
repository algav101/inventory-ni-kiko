import React, { useState } from 'react';
import { db, logTransaction } from '../../db/database';
import type { MeatCategory } from '../../types';
import { PlusCircle, ArrowLeft, CheckCircle } from 'lucide-react';

interface ManualIntakeProps {
  onBack: () => void;
  onFinished: () => void;
}

const CATEGORIES: MeatCategory[] = [
  'Hotdog',
  'Tocino',
  'Longganisa',
  'Ham',
  'Bacon',
  'Sausage',
  'Siomai',
  'Burger',
  'Other',
];

export const ManualIntake: React.FC<ManualIntakeProps> = ({ onBack, onFinished }) => {
  const [skuCode, setSkuCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<MeatCategory>('Hotdog');
  const [unit, setUnit] = useState('BOX');
  const [size, setSize] = useState('1KG');
  const [pcsPerBox, setPcsPerBox] = useState('12');
  const [unitCost, setUnitCost] = useState('');
  const [initialQty, setInitialQty] = useState('0'); // Default to 0
  const [threshold, setThreshold] = useState('5');
  const [errorMsg, setErrorMsg] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg('Item name is required');
      return;
    }

    let finalSku = skuCode.trim().toUpperCase();
    if (!finalSku) {
      const prefix = category.slice(0, 3).toUpperCase();
      finalSku = `MEAT-${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const existing = await db.items.where('sku_code').equals(finalSku).first();
    if (existing) {
      setErrorMsg(`SKU / Supplier Code "${finalSku}" already exists.`);
      return;
    }

    const qty = parseFloat(initialQty) || 0;
    const cost = unitCost ? parseFloat(unitCost) : null;
    const lowThresh = parseFloat(threshold) || 5;
    const pcsBoxNum = parseInt(pcsPerBox) || 12;
    const now = new Date().toISOString();

    const itemId = await db.items.add({
      sku_code: finalSku,
      name: name.trim(),
      category,
      unit: unit.toUpperCase(),
      size: size.toUpperCase(),
      pcs_per_box: pcsBoxNum,
      latest_unit_cost: cost,
      current_qty: qty,
      low_stock_threshold: lowThresh,
      created_at: now,
      updated_at: now,
    });

    if (qty > 0) {
      await logTransaction(
        itemId,
        'MANUAL_INTAKE',
        qty,
        qty,
        cost,
        `Manual SKU creation (+${qty} ${unit} = ${qty * pcsBoxNum} pcs)`
      );
    }

    onFinished();
  };

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Inventory</span>
      </button>

      <div className="card-glass p-5 border-slate-700 space-y-4">
        <div className="flex items-center gap-2 font-bold text-base text-white border-b border-slate-800 pb-3">
          <PlusCircle className="w-5 h-5 text-blue-400" />
          <span>Manual Meat SKU Intake Form</span>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-xs text-rose-300">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Code / SKU #</label>
              <input
                type="text"
                placeholder="e.g. 4460, 5105"
                value={skuCode}
                onChange={e => setSkuCode(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono uppercase font-bold"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as MeatCategory)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Product Description *</label>
            <input
              type="text"
              placeholder="e.g. IDOL Cdog Reg. x 24"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-bold"
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Package Size</label>
              <input
                type="text"
                placeholder="250G, 1KG"
                value={size}
                onChange={e => setSize(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white uppercase"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Unit</label>
              <input
                type="text"
                placeholder="BOX"
                value={unit}
                onChange={e => setUnit(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white uppercase"
              />
            </div>
            <div>
              <label className="block font-semibold text-amber-300 mb-1">Pcs per Box</label>
              <input
                type="number"
                min="1"
                placeholder="24"
                value={pcsPerBox}
                onChange={e => setPcsPerBox(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-amber-300 font-mono font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Initial Qty (Boxes)</label>
              <input
                type="number"
                min="0"
                value={initialQty}
                onChange={e => setInitialQty(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Unit Price ₱</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="1,212.00"
                value={unitCost}
                onChange={e => setUnitCost(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Low Alert Qty</label>
              <input
                type="number"
                min="1"
                value={threshold}
                onChange={e => setThreshold(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-touch px-5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-950/40 flex items-center gap-1.5"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Save Meat Product SKU</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
