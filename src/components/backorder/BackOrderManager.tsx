import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, logTransaction } from '../../db/database';
import type { BackOrder, BackOrderStatus } from '../../types';
import { FileQuestion, Plus, X, AlertCircle, Box, Trash2, RefreshCw, CheckCircle2 } from 'lucide-react';

export const BackOrderManager: React.FC = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | BackOrderStatus>('OPEN');

  const [itemId, setItemId] = useState<number>(0);
  const [clientName, setClientName] = useState('');
  const [qty, setQty] = useState('1');
  const [unitPriceInput, setUnitPriceInput] = useState('');
  const [remarks, setRemarks] = useState('');

  const backorders = useLiveQuery(() => db.backOrders.toArray()) ?? [];
  const allItems = useLiveQuery(() => db.items.toArray()) ?? [];
  const clients = useLiveQuery(() => db.clients.toArray()) ?? [];

  const filteredOrders = backorders.filter(bo => {
    if (statusFilter === 'ALL') return true;
    return bo.status === statusFilter;
  });

  const handleSelectSKU = (selectedId: number) => {
    setItemId(selectedId);
    const itemObj = allItems.find(i => i.id === selectedId);
    if (itemObj) {
      setUnitPriceInput(itemObj.latest_unit_cost?.toString() || '0');
    }
  };

  const handleCreateBO = async (e: React.FormEvent) => {
    e.preventDefault();
    const itemToUse = itemId || (allItems[0]?.id ?? 0);
    if (!itemToUse || !clientName.trim()) return;

    const numQty = parseFloat(qty);
    if (isNaN(numQty) || numQty <= 0) return;

    const numPrice = parseFloat(unitPriceInput);

    let clientObj = clients.find(c => c.name.toLowerCase() === clientName.trim().toLowerCase());
    let clientId: number;

    if (clientObj) {
      clientId = clientObj.id!;
    } else {
      clientId = await db.clients.add({
        name: clientName.trim(),
        created_at: new Date().toISOString(),
      });
    }

    const itemObj = allItems.find(i => i.id === itemToUse);

    await db.backOrders.add({
      item_id: itemToUse,
      item_name: itemObj ? `${itemObj.name} (${itemObj.size})` : `Item #${itemToUse}`,
      client_id: clientId,
      client_name: clientName.trim(),
      qty: numQty,
      pcs_per_box: itemObj?.pcs_per_box || 12,
      unit_price: !isNaN(numPrice) && numPrice >= 0 ? numPrice : (itemObj?.latest_unit_cost || 0),
      remarks: remarks.trim() || 'Outright replacement pending stock arrival',
      status: 'OPEN',
      created_at: new Date().toISOString(),
    });

    setShowCreateModal(false);
    setRemarks('');
  };

  const handleDeleteBO = async (id?: number) => {
    if (!id) return;
    const confirmDelete = window.confirm('Delete this returned item / bad order record?');
    if (confirmDelete) {
      await db.backOrders.delete(id);
    }
  };

  const handleOutrightReplace = async (bo: BackOrder) => {
    const itemObj = await db.items.get(bo.item_id);
    if (!itemObj) {
      alert('Selected item no longer exists in inventory!');
      return;
    }

    if (itemObj.current_qty < bo.qty) {
      alert(
        `OUTRIGHT REPLACEMENT BLOCKED:\n\nStock for ${itemObj.name} is currently LACKING!\nAvailable Stock: ${itemObj.current_qty} BOXES\nRequired for Replacement: ${bo.qty} BOXES\n\nPlease receive or add new stock before replacing.`
      );
      return;
    }

    const confirmReplace = window.confirm(
      `CONFIRM OUTRIGHT REPLACEMENT?\n\nItem: ${itemObj.name}\nQuantity: ${bo.qty} BOXES\nReturned Price: ₱${(bo.unit_price || itemObj.latest_unit_cost || 0).toFixed(2)} / Box\n\nThis will IMMEDIATELY deduct ${bo.qty} BOXES from your active stock.`
    );
    if (!confirmReplace) return;

    const newQty = itemObj.current_qty - bo.qty;
    const now = new Date().toISOString();

    await db.transaction('rw', [db.items, db.backOrders, db.transactions], async () => {
      await db.items.update(bo.item_id, {
        current_qty: newQty,
        updated_at: now,
      });

      await db.backOrders.update(bo.id!, {
        status: 'FULFILLED',
        fulfilled_at: now,
      });

      await logTransaction(
        bo.item_id,
        'BO_FULFILLMENT',
        -bo.qty,
        newQty,
        bo.unit_price || itemObj.latest_unit_cost,
        `Outright bad order replacement for ${bo.client_name} (Bad Order #${bo.id})`,
        `BO-${bo.id}`
      );
    });

    alert(`✓ Bad Order #${bo.id} replaced outright! ${bo.qty} BOXES deducted from inventory.`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-base text-[#0b2b3c] dark:text-white">
          <FileQuestion className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <span>Returned Items (Bad Orders)</span>
        </div>

        <button
          onClick={() => {
            setShowCreateModal(true);
            if (allItems.length > 0) {
              handleSelectSKU(allItems[0].id!);
            }
          }}
          className="btn-touch bg-purple-600 hover:bg-purple-500 text-white rounded-xl px-3 text-xs font-bold shrink-0 flex items-center gap-1 shadow-md"
        >
          <Plus className="w-4 h-4" />
          <span>Log Returned Item</span>
        </button>
      </div>

      <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 text-xs text-purple-900 dark:text-purple-200 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-purple-600 dark:text-purple-400" />
        <div>
          <strong>Outright Replacement System:</strong> Bad orders are replaced outright directly from current inventory without scheduled delivery plans. If stock is lacking, the action button allows replacing once stock arrives.
        </div>
      </div>

      <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold shadow-xs">
        {(['OPEN', 'FULFILLED', 'ALL'] as const).map(st => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`flex-1 py-1.5 rounded-lg transition-all ${
              statusFilter === st
                ? 'bg-purple-600 text-white shadow'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            {st === 'OPEN' ? 'PENDING REPLACEMENT' : st}
          </button>
        ))}
      </div>

      <div className="space-y-2.5">
        {filteredOrders.length === 0 ? (
          <div className="bg-white dark:bg-[#0f2434] p-8 text-center text-slate-500 dark:text-slate-400 text-sm rounded-2xl border border-slate-200 dark:border-slate-800">
            No returned items found matching filter "{statusFilter}".
          </div>
        ) : (
          filteredOrders.map(bo => {
            const totalPcs = bo.qty * (bo.pcs_per_box || 12);
            const matchingItem = allItems.find(i => i.id === bo.item_id);
            const isStockLacking = bo.status === 'OPEN' && matchingItem && matchingItem.current_qty < bo.qty;

            return (
              <div
                key={bo.id}
                className={`p-4 rounded-2xl border bg-white dark:bg-[#0f2434] shadow-xs ${
                  bo.status === 'OPEN'
                    ? 'border-purple-300 dark:border-purple-800'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">{bo.item_name}</h3>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                          bo.status === 'OPEN'
                            ? 'bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200 border border-purple-300 dark:border-purple-700'
                            : 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700'
                        }`}
                      >
                        {bo.status === 'OPEN' ? 'PENDING REPLACEMENT' : 'REPLACED OUTRIGHT'}
                      </span>
                    </div>

                    <div className="text-xs text-slate-700 dark:text-slate-300 mt-1">
                      Client / Store: <strong className="text-slate-900 dark:text-white font-bold">{bo.client_name}</strong>
                    </div>

                    <div className="text-xs text-slate-700 dark:text-slate-300 mt-0.5">
                      Returned Unit Price: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">₱{(bo.unit_price || matchingItem?.latest_unit_cost || 0).toFixed(2)} / box</strong>
                    </div>

                    {bo.remarks && <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Reason / Note: {bo.remarks}</div>}
                  </div>

                  <div className="text-right flex flex-col items-end">
                    <div className="text-lg font-extrabold text-purple-700 dark:text-purple-300">
                      {bo.qty} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">BOXES</span>
                    </div>
                    <div className="text-[10px] text-amber-700 dark:text-amber-300 font-bold flex items-center justify-end gap-1 mt-0.5">
                      <Box className="w-3 h-3" />
                      {totalPcs} total pcs
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {new Date(bo.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {isStockLacking && (
                  <div className="mt-2 p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200 flex items-center justify-between">
                    <span>⚠️ Lacking Stock: Available stock is {matchingItem.current_qty} BOXES ({bo.qty - matchingItem.current_qty} needed).</span>
                  </div>
                )}

                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <button
                    onClick={() => handleDeleteBO(bo.id)}
                    className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 hover:bg-rose-100 text-xs font-bold flex items-center gap-1 transition-all"
                    title="Delete Returned Item Record"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>

                  {bo.status === 'OPEN' && (
                    <button
                      onClick={() => handleOutrightReplace(bo)}
                      className={`btn-touch text-white font-bold text-xs px-3.5 py-1.5 rounded-xl shadow flex items-center gap-1.5 ${
                        isStockLacking
                          ? 'bg-amber-600 hover:bg-amber-500'
                          : 'bg-emerald-600 hover:bg-emerald-500'
                      }`}
                    >
                      {isStockLacking ? <RefreshCw className="w-3.5 h-3.5 animate-spin-slow" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      <span>{isStockLacking ? 'Replace Outright Now (Check Stock)' : 'Replace Outright Now'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#0f2434] text-slate-900 dark:text-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700 mb-4">
              <div className="flex items-center gap-2 font-extrabold text-base">
                <FileQuestion className="w-5 h-5 text-purple-600" />
                <span>Log New Returned Item (Bad Order)</span>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBO} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Meat Product SKU</label>
                <select
                  value={itemId || (allItems[0]?.id ?? 0)}
                  onChange={e => handleSelectSKU(Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-bold"
                  required
                >
                  {allItems.map(i => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.size}) - Stock: {i.current_qty} BOXES (₱{i.latest_unit_cost?.toFixed(2) || '0.00'}/box)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Client / Store Name</label>
                  <input
                    type="text"
                    list="bo-clients"
                    placeholder="e.g. Aling Nena"
                    value={clientName}
                    onChange={e => setClientName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-bold"
                    required
                  />
                  <datalist id="bo-clients">
                    {clients.map(c => (
                      <option key={c.id} value={c.name} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Returned BOXES</label>
                  <input
                    type="number"
                    min="1"
                    value={qty}
                    onChange={e => setQty(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono font-bold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Returned Unit Price (₱/BOX) <span className="text-purple-600 font-normal">(Editable per item)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 1950.00"
                  value={unitPriceInput}
                  onChange={e => setUnitPriceInput(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-purple-300 dark:border-purple-700 rounded-xl px-3 py-2 text-purple-700 dark:text-purple-300 font-mono font-extrabold"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Remarks / Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Damaged packaging upon receipt"
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 text-slate-500 hover:text-slate-900 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-touch px-4 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl shadow"
                >
                  Log Returned Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
