import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, logTransaction } from '../../db/database';
import type { DeliveryPlan, Item } from '../../types';
import {
  Truck,
  Plus,
  CheckCircle,
  Calendar,
  X,
} from 'lucide-react';

interface LineItemFormState {
  itemId: number;
  qty: number;
  qtyType: 'BOX' | 'PCS';
  unitPrice: number;
  priceType: 'PER_BOX' | 'PER_PC';
}

export const DeliveryPlans: React.FC = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [clientInput, setClientInput] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(
    new Date(Date.now() + 86400000).toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItemFormState[]>([]);

  const plans = useLiveQuery(() => db.deliveryPlans.toArray()) ?? [];
  const clients = useLiveQuery(() => db.clients.toArray()) ?? [];
  const allItems = useLiveQuery(() => db.items.toArray()) ?? [];

  const handleAddLineItem = () => {
    if (allItems.length === 0) return;
    const firstItem = allItems[0];
    setLineItems(prev => [
      ...prev,
      {
        itemId: firstItem.id!,
        qty: 1,
        qtyType: 'BOX',
        unitPrice: firstItem.latest_unit_cost || 0,
        priceType: 'PER_BOX',
      },
    ]);
  };

  const handleRemoveLineItem = (idx: number) => {
    setLineItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx: number, newItemId: number) => {
    const itemObj = allItems.find(i => i.id === newItemId);
    setLineItems(prev =>
      prev.map((l, i) =>
        i === idx
          ? {
              ...l,
              itemId: newItemId,
              unitPrice: itemObj?.latest_unit_cost ?? l.unitPrice,
            }
          : l
      )
    );
  };

  const getLineStats = (line: LineItemFormState, itemObj?: Item) => {
    const pcsPerBox = itemObj?.pcs_per_box || 1;
    const qty = line.qty > 0 ? line.qty : 0;
    let boxesCount = 0;
    let pcsCount = 0;

    if (line.qtyType === 'BOX') {
      boxesCount = qty;
      pcsCount = qty * pcsPerBox;
    } else {
      pcsCount = qty;
      boxesCount = pcsPerBox > 0 ? qty / pcsPerBox : qty;
    }

    let lineTotal = 0;
    if (line.priceType === 'PER_BOX') {
      lineTotal = boxesCount * (line.unitPrice || 0);
    } else {
      lineTotal = pcsCount * (line.unitPrice || 0);
    }

    return { boxesCount, pcsCount, lineTotal, pcsPerBox };
  };

  const grandTotal = lineItems.reduce((acc, line) => {
    const itemObj = allItems.find(i => i.id === line.itemId);
    const { lineTotal } = getLineStats(line, itemObj);
    return acc + lineTotal;
  }, 0);

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientInput.trim() || lineItems.length === 0) return;

    let clientObj = clients.find(c => c.name.toLowerCase() === clientInput.trim().toLowerCase());
    let clientId: number;

    if (clientObj) {
      clientId = clientObj.id!;
    } else {
      clientId = await db.clients.add({
        name: clientInput.trim(),
        created_at: new Date().toISOString(),
      });
    }

    const now = new Date().toISOString();

    const planId = await db.deliveryPlans.add({
      client_id: clientId,
      client_name: clientInput.trim(),
      delivery_date: deliveryDate,
      status: 'SCHEDULED',
      notes: notes.trim(),
      total_amount: grandTotal,
      created_at: now,
    });

    for (const line of lineItems) {
      const itemObj = allItems.find(i => i.id === line.itemId);
      const { lineTotal, pcsPerBox } = getLineStats(line, itemObj);

      await db.deliveryLineItems.add({
        delivery_plan_id: planId,
        item_id: line.itemId,
        item_name: itemObj ? `${itemObj.name} (${itemObj.size})` : `Item #${line.itemId}`,
        unit: itemObj?.unit || 'BOX',
        pcs_per_box: pcsPerBox,
        qty_planned: line.qty,
        qty_type: line.qtyType,
        unit_price: line.unitPrice,
        price_type: line.priceType,
        total_price: lineTotal,
        qty_delivered: 0,
      });
    }

    setShowCreateModal(false);
    setClientInput('');
    setLineItems([]);
    setNotes('');
  };

  const handleConfirmDelivery = async (plan: DeliveryPlan) => {
    const planLines = await db.deliveryLineItems.where('delivery_plan_id').equals(plan.id!).toArray();

    const deficits: string[] = [];
    for (const line of planLines) {
      const item = await db.items.get(line.item_id);
      if (item) {
        const pcsPerBox = line.pcs_per_box || item.pcs_per_box || 1;
        const boxesNeeded = line.qty_type === 'PCS' ? line.qty_planned / pcsPerBox : line.qty_planned;
        if (item.current_qty < boxesNeeded) {
          deficits.push(
            `${item.name}: Stock is ${item.current_qty} ${item.unit}, delivery needs ${boxesNeeded.toFixed(2)} BOXES (${
              line.qty_type === 'PCS' ? `${line.qty_planned} pcs` : `${line.qty_planned * pcsPerBox} pcs`
            })`
          );
        }
      }
    }

    if (deficits.length > 0) {
      const confirmProceed = window.confirm(
        `STOCK DEFICIT WARNING:\n${deficits.join('\n')}\n\nDo you still want to confirm delivery? Stock will go negative or backordered.`
      );
      if (!confirmProceed) return;
    }

    await db.transaction('rw', [db.items, db.deliveryPlans, db.deliveryLineItems, db.transactions], async () => {
      const now = new Date().toISOString();

      await db.deliveryPlans.update(plan.id!, {
        status: 'DELIVERED',
        confirmed_at: now,
      });

      for (const line of planLines) {
        const item = await db.items.get(line.item_id);
        if (item) {
          const pcsPerBox = line.pcs_per_box || item.pcs_per_box || 1;
          const boxesNeeded = line.qty_type === 'PCS' ? line.qty_planned / pcsPerBox : line.qty_planned;
          const totalPcsDeducted = line.qty_type === 'PCS' ? line.qty_planned : line.qty_planned * pcsPerBox;

          const newQty = item.current_qty - boxesNeeded;

          await db.items.update(line.item_id, {
            current_qty: newQty,
            updated_at: now,
          });

          await db.deliveryLineItems.update(line.id!, {
            qty_delivered: line.qty_planned,
          });

          await logTransaction(
            line.item_id,
            'DELIVERY_DEDUCTION',
            -boxesNeeded,
            newQty,
            line.unit_price ?? item.latest_unit_cost,
            `Delivered ${line.qty_planned} ${line.qty_type || 'BOX'} (${totalPcsDeducted} pcs) to ${plan.client_name} (Plan #${plan.id})`,
            `DELIVERY-${plan.id}`
          );
        }
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Title & Action Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-base text-white">
          <Truck className="w-5 h-5 text-amber-400" />
          <span>Delivery Plans & Fulfillment</span>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-touch bg-amber-600 hover:bg-amber-500 text-white rounded-xl px-3 py-2 text-xs font-bold shrink-0 flex items-center gap-1 shadow-lg shadow-amber-950/40"
        >
          <Plus className="w-4 h-4" />
          <span>New Delivery</span>
        </button>
      </div>

      {/* Plans List */}
      <div className="space-y-3">
        {plans.length === 0 ? (
          <div className="card-glass p-8 text-center text-slate-400 text-sm">
            No delivery plans created yet. Click "New Delivery" to schedule stock dispatch.
          </div>
        ) : (
          plans.map(plan => (
            <DeliveryPlanCard
              key={plan.id}
              plan={plan}
              onConfirm={() => handleConfirmDelivery(plan)}
            />
          ))
        )}
      </div>

      {/* CREATE NEW DELIVERY PLAN MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="card-glass w-full max-w-lg p-5 bg-slate-900 border-slate-700 shadow-2xl space-y-4 my-auto max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
              <div className="font-bold text-base text-white flex items-center gap-2">
                <Truck className="w-5 h-5 text-amber-400" />
                <span>Create Delivery Plan</span>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePlan} className="space-y-4 text-xs overflow-y-auto flex-1 pr-1">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Client / Store Name</label>
                <input
                  type="text"
                  list="client-suggestions"
                  placeholder="e.g. Kiko Meat Retail Shop"
                  value={clientInput}
                  onChange={e => setClientInput(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold"
                  required
                />
                <datalist id="client-suggestions">
                  {clients.map(c => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Delivery Date</label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={e => setDeliveryDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Notes / Remarks</label>
                  <input
                    type="text"
                    placeholder="e.g. Deliver before 10 AM"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              {/* Line Items Builder */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-300">Items to Deliver (Boxes, Pcs & Custom Prices)</span>
                  <button
                    type="button"
                    onClick={handleAddLineItem}
                    className="text-amber-400 font-bold hover:underline flex items-center gap-1 text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item Line</span>
                  </button>
                </div>

                {lineItems.length === 0 ? (
                  <div className="text-slate-500 py-3 text-center bg-slate-950/40 rounded-xl border border-slate-800/80">
                    No item lines added. Click "+ Add Item Line".
                  </div>
                ) : (
                  lineItems.map((line, idx) => {
                    const itemObj = allItems.find(i => i.id === line.itemId);
                    const { boxesCount, pcsCount, lineTotal } = getLineStats(line, itemObj);

                    return (
                      <div key={idx} className="p-3 rounded-xl bg-slate-800/90 border border-slate-700/80 space-y-2 relative">
                        {/* Header: Item Select & Remove */}
                        <div className="flex items-center gap-2">
                          <select
                            value={line.itemId}
                            onChange={e => handleItemChange(idx, Number(e.target.value))}
                            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-semibold truncate"
                          >
                            {allItems.map(item => (
                              <option key={item.id} value={item.id}>
                                {item.name} ({item.size}) - Stock: {item.current_qty} BOXES ({item.pcs_per_box || 12} pcs/box)
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            onClick={() => handleRemoveLineItem(idx)}
                            className="text-rose-400 hover:text-rose-300 p-1 shrink-0"
                            title="Remove Line"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Controls Grid: Quantity/Unit & Price/Pricing Unit */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {/* Quantity & Unit Mode */}
                          <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-700/50 space-y-1">
                            <label className="block text-[10px] text-slate-400 font-semibold uppercase">Quantity & Unit</label>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                step="any"
                                min="0.01"
                                value={line.qty}
                                onChange={e => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setLineItems(prev => prev.map((l, i) => (i === idx ? { ...l, qty: val } : l)));
                                }}
                                className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center font-mono font-bold text-emerald-400"
                              />
                              <select
                                value={line.qtyType}
                                onChange={e => {
                                  const val = e.target.value as 'BOX' | 'PCS';
                                  setLineItems(prev => prev.map((l, i) => (i === idx ? { ...l, qtyType: val } : l)));
                                }}
                                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-amber-300 font-bold text-xs"
                              >
                                <option value="BOX">BOX(ES)</option>
                                <option value="PCS">ITEM / PCS</option>
                              </select>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {line.qtyType === 'BOX' ? (
                                <span className="text-amber-300 font-bold">={pcsCount} pcs</span>
                              ) : (
                                <span className="text-amber-300 font-bold">={boxesCount.toFixed(2)} BOX ({pcsCount} pcs)</span>
                              )}
                            </div>
                          </div>

                          {/* Manual Item Price & Pricing Basis */}
                          <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-700/50 space-y-1">
                            <label className="block text-[10px] text-slate-400 font-semibold uppercase">Item Price & Basis</label>
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-400 font-bold">₱</span>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                placeholder="0.00"
                                value={line.unitPrice}
                                onChange={e => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setLineItems(prev => prev.map((l, i) => (i === idx ? { ...l, unitPrice: val } : l)));
                                }}
                                className="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-right font-mono font-bold text-amber-300"
                              />
                              <select
                                value={line.priceType}
                                onChange={e => {
                                  const val = e.target.value as 'PER_BOX' | 'PER_PC';
                                  setLineItems(prev => prev.map((l, i) => (i === idx ? { ...l, priceType: val } : l)));
                                }}
                                className="bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-slate-300 text-xs font-semibold"
                              >
                                <option value="PER_BOX">/ Box</option>
                                <option value="PER_PC">/ Item (Pc)</option>
                              </select>
                            </div>
                            <div className="text-[10px] text-right text-emerald-400 font-mono font-bold">
                              Subtotal: ₱{lineTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Grand Total Summary */}
              {lineItems.length > 0 && (
                <div className="p-3 bg-slate-950/60 border border-amber-500/30 rounded-xl flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-semibold">Total Delivery Value:</span>
                  <span className="text-base font-extrabold text-amber-400 font-mono">
                    ₱{grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={lineItems.length === 0}
                  className="btn-touch px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl shadow"
                >
                  Schedule Delivery
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const DeliveryPlanCard: React.FC<{ plan: DeliveryPlan; onConfirm: () => void }> = ({ plan, onConfirm }) => {
  const lineItems = useLiveQuery(() => db.deliveryLineItems.where('delivery_plan_id').equals(plan.id!).toArray(), [plan.id]) ?? [];
  const isDelivered = plan.status === 'DELIVERED';

  const planTotal = lineItems.reduce((acc, l) => {
    if (l.total_price != null) return acc + l.total_price;
    const pcsPerBox = l.pcs_per_box || 1;
    const boxes = l.qty_type === 'PCS' ? l.qty_planned / pcsPerBox : l.qty_planned;
    return acc + boxes * (l.unit_price || 0);
  }, plan.total_amount || 0);

  return (
    <div className={`card-glass p-4 border ${isDelivered ? 'border-emerald-500/30 bg-slate-900/40' : 'border-amber-500/40 bg-slate-900/90'}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-white">{plan.client_name}</h3>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                isDelivered
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              }`}
            >
              {plan.status}
            </span>
          </div>
          <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              {plan.delivery_date}
            </span>
            {plan.notes && <span>• {plan.notes}</span>}
          </div>
        </div>

        {!isDelivered && (
          <button
            onClick={onConfirm}
            className="btn-touch bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl font-bold text-xs shadow-md shadow-emerald-950/40 flex items-center gap-1 shrink-0"
          >
            <CheckCircle className="w-4 h-4" />
            <span>Mark Delivered & Deduct</span>
          </button>
        )}
      </div>

      {/* Item Lines with Boxes, Pcs & Prices */}
      <div className="mt-3 pt-2 border-t border-slate-800/80 space-y-1.5">
        {lineItems.map(line => {
          const pcsPerBox = line.pcs_per_box || 12;
          const isPcsMode = line.qty_type === 'PCS';
          const totalPcs = isPcsMode ? line.qty_planned : line.qty_planned * pcsPerBox;
          const totalBoxes = isPcsMode ? (line.qty_planned / pcsPerBox).toFixed(2) : line.qty_planned;

          const unitPriceVal = line.unit_price != null ? line.unit_price : 0;
          const lineSubtotal = line.total_price != null ? line.total_price : (isPcsMode && line.price_type === 'PER_PC' ? line.qty_planned * unitPriceVal : Number(totalBoxes) * unitPriceVal);

          return (
            <div key={line.id} className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-300 py-0.5 gap-1">
              <div className="font-medium">
                • {line.item_name}
              </div>
              <div className="flex items-center gap-3 font-mono text-[11px] justify-between sm:justify-end">
                <span className="text-slate-200 font-bold">
                  {line.qty_planned} {line.qty_type || line.unit || 'BOX'}
                  <span className="text-amber-400 font-normal ml-1">
                    ({isPcsMode ? `${totalBoxes} BOX` : `${totalPcs} pcs`})
                  </span>
                </span>
                {unitPriceVal > 0 && (
                  <span className="text-slate-400">
                    @ ₱{unitPriceVal.toLocaleString('en-US', { minimumFractionDigits: 2 })} {line.price_type === 'PER_PC' ? '/pc' : '/box'}
                  </span>
                )}
                {lineSubtotal > 0 && (
                  <span className="text-emerald-400 font-bold">
                    ₱{lineSubtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Card Footer: Grand Total */}
      {planTotal > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-xs font-semibold">
          <span className="text-slate-400">Scheduled Total:</span>
          <span className="text-amber-400 font-mono font-bold text-sm">
            ₱{planTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      )}
    </div>
  );
};
