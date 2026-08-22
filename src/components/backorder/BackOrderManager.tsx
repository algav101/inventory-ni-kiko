import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import type { BackOrder, BackOrderStatus } from '../../types';
import { FileQuestion, Plus, X, Truck, AlertCircle, Box, Trash2 } from 'lucide-react';


export const BackOrderManager: React.FC = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | BackOrderStatus>('OPEN');

  const [itemId, setItemId] = useState<number>(0);
  const [clientName, setClientName] = useState('');
  const [qty, setQty] = useState('1');
  const [remarks, setRemarks] = useState('');

  const backorders = useLiveQuery(() => db.backOrders.toArray()) ?? [];
  const allItems = useLiveQuery(() => db.items.toArray()) ?? [];
  const clients = useLiveQuery(() => db.clients.toArray()) ?? [];

  const filteredOrders = backorders.filter(bo => {
    if (statusFilter === 'ALL') return true;
    return bo.status === statusFilter;
  });

  const handleCreateBO = async (e: React.FormEvent) => {
    e.preventDefault();
    const itemToUse = itemId || (allItems[0]?.id ?? 0);
    if (!itemToUse || !clientName.trim()) return;

    const numQty = parseFloat(qty);
    if (isNaN(numQty) || numQty <= 0) return;

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
      remarks: remarks.trim() || 'Awaiting supplier stock arrival',
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

  const handleFulfillBO = async (bo: BackOrder) => {
    const deliveryDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    const planId = await db.deliveryPlans.add({
      client_id: bo.client_id,
      client_name: bo.client_name,
      delivery_date: deliveryDate,
      status: 'SCHEDULED',
      notes: `Fulfilled from Returned Item #${bo.id}: ${bo.remarks}`,
      created_at: new Date().toISOString(),
    });

    const itemObj = await db.items.get(bo.item_id);

    const pcsPerBox = bo.pcs_per_box || itemObj?.pcs_per_box || 12;
    const unitPrice = itemObj?.latest_unit_cost || 0;
    await db.deliveryLineItems.add({
      delivery_plan_id: planId,
      item_id: bo.item_id,
      item_name: bo.item_name,
      unit: itemObj?.unit || 'BOX',
      pcs_per_box: pcsPerBox,
      qty_planned: bo.qty,
      qty_type: 'BOX',
      unit_price: unitPrice,
      price_type: 'PER_BOX',
      total_price: bo.qty * unitPrice,
      qty_delivered: 0,
    });

    await db.backOrders.update(bo.id!, {
      status: 'FULFILLED',
      fulfilled_at: new Date().toISOString(),
      linked_delivery_id: planId,
    });

    alert(`Returned Item #${bo.id} replacement linked to Delivery Plan #${planId} scheduled for ${deliveryDate}!`);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-base text-[#0b2b3c]">
          <FileQuestion className="w-5 h-5 text-purple-600" />
          <span>Returned Items (Bad Orders)</span>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-touch bg-purple-600 hover:bg-purple-500 text-white rounded-xl px-3 text-xs font-bold shrink-0 flex items-center gap-1 shadow-md"
        >
          <Plus className="w-4 h-4" />
          <span>Log Returned Item</span>
        </button>
      </div>

      {/* Demand explanation banner */}
      <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-xs text-purple-900 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-purple-600" />
        <div>
          <strong>Bad Order Replacements:</strong> Returned items represent bad orders required to be replaced for fresh stock. Replacements deduct from current inventory when fulfilled and scheduled for delivery.
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs font-bold shadow-xs">
        {(['OPEN', 'FULFILLED', 'ALL'] as const).map(st => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`flex-1 py-1.5 rounded-lg transition-all ${
              statusFilter === st
                ? 'bg-purple-600 text-white shadow'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {st === 'OPEN' ? 'PENDING' : st}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-2.5">
        {filteredOrders.length === 0 ? (
          <div className="bg-white p-8 text-center text-slate-400 text-sm rounded-2xl border border-slate-200">
            No returned items found matching filter "{statusFilter}".
          </div>
        ) : (
          filteredOrders.map(bo => {
            const totalPcs = bo.qty * (bo.pcs_per_box || 12);
            return (
              <div
                key={bo.id}
                className={`p-4 rounded-2xl border bg-white shadow-xs ${
                  bo.status === 'OPEN'
                    ? 'border-purple-300'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-slate-900">{bo.item_name}</h3>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                          bo.status === 'OPEN'
                            ? 'bg-purple-100 text-purple-800 border border-purple-300'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        }`}
                      >
                        {bo.status === 'OPEN' ? 'PENDING REPLACEMENT' : bo.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 mt-1">
                      Client / Store: <strong className="text-slate-900">{bo.client_name}</strong>
                    </div>
                    {bo.remarks && <div className="text-[11px] text-slate-500 mt-0.5">Reason / Note: {bo.remarks}</div>}
                  </div>

                  <div className="text-right flex flex-col items-end">
                    <div className="text-lg font-extrabold text-purple-700">
                      {bo.qty} <span className="text-xs font-normal text-slate-500">BOXES</span>
                    </div>
                    <div className="text-[10px] text-amber-700 font-bold flex items-center justify-end gap-1 mt-0.5">
                      <Box className="w-3 h-3" />
                      {totalPcs} total pcs
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {new Date(bo.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => handleDeleteBO(bo.id)}
                    className="p-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 text-xs font-bold flex items-center gap-1 transition-all"
                    title="Delete Returned Item Record"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>

                  {bo.status === 'OPEN' && (
                    <button
                      onClick={() => handleFulfillBO(bo)}
                      className="btn-touch bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-1 rounded-xl shadow flex items-center gap-1"
                    >
                      <Truck className="w-3.5 h-3.5" />
                      <span>Replace & Schedule Delivery</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* CREATE BO MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="card-glass w-full max-w-md p-5 bg-slate-900 border-slate-700 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="font-bold text-base text-white flex items-center gap-2">
                <FileQuestion className="w-5 h-5 text-purple-400" />
                <span>Log New Back Order</span>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBO} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Meat Product SKU</label>
                <select
                  value={itemId || (allItems[0]?.id ?? 0)}
                  onChange={e => setItemId(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold"
                  required
                >
                  {allItems.map(i => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.size}) - Stock: {i.current_qty} BOXES ({i.pcs_per_box || 12} pcs/box)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Client Name</label>
                  <input
                    type="text"
                    list="bo-clients"
                    placeholder="e.g. Aling Nena"
                    value={clientName}
                    onChange={e => setClientName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                    required
                  />
                  <datalist id="bo-clients">
                    {clients.map(c => (
                      <option key={c.id} value={c.name} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Requested BOXES</label>
                  <input
                    type="number"
                    min="1"
                    value={qty}
                    onChange={e => setQty(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Remarks / Note</label>
                <input
                  type="text"
                  placeholder="e.g. Reserved pending arrival of CDO shipment"
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-touch px-4 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl shadow"
                >
                  Log Back Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
