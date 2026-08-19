import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, logTransaction } from '../../db/database';
import type { DeliveryPlan } from '../../types';
import {
  Truck,
  Plus,
  CheckCircle,
  Calendar,
  X,
} from 'lucide-react';

export const DeliveryPlans: React.FC = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [clientInput, setClientInput] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(
    new Date(Date.now() + 86400000).toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<{ itemId: number; qty: number }[]>([]);

  const plans = useLiveQuery(() => db.deliveryPlans.toArray()) ?? [];
  const clients = useLiveQuery(() => db.clients.toArray()) ?? [];
  const allItems = useLiveQuery(() => db.items.toArray()) ?? [];

  const handleAddLineItem = () => {
    if (allItems.length === 0) return;
    setLineItems(prev => [...prev, { itemId: allItems[0].id!, qty: 1 }]);
  };

  const handleRemoveLineItem = (idx: number) => {
    setLineItems(prev => prev.filter((_, i) => i !== idx));
  };

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
      created_at: now,
    });

    for (const line of lineItems) {
      const itemObj = allItems.find(i => i.id === line.itemId);
      await db.deliveryLineItems.add({
        delivery_plan_id: planId,
        item_id: line.itemId,
        item_name: itemObj ? `${itemObj.name} (${itemObj.size})` : `Item #${line.itemId}`,
        unit: itemObj?.unit || 'BOX',
        pcs_per_box: itemObj?.pcs_per_box || 12,
        qty_planned: line.qty,
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
      if (item && item.current_qty < line.qty_planned) {
        deficits.push(`${item.name}: Stock is ${item.current_qty} ${item.unit}, delivery needs ${line.qty_planned}`);
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
          const newQty = item.current_qty - line.qty_planned;
          const totalPcsDeducted = line.qty_planned * (line.pcs_per_box || item.pcs_per_box || 1);

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
            -line.qty_planned,
            newQty,
            item.latest_unit_cost,
            `Delivered ${line.qty_planned} ${item.unit} (${totalPcsDeducted} pcs) to ${plan.client_name} (Plan #${plan.id})`,
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
          className="btn-touch bg-amber-600 hover:bg-amber-500 text-white rounded-xl px-3 text-xs font-bold shrink-0 flex items-center gap-1 shadow-lg shadow-amber-950/40"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="card-glass w-full max-w-md p-5 bg-slate-900 border-slate-700 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="font-bold text-base text-white flex items-center gap-2">
                <Truck className="w-5 h-5 text-amber-400" />
                <span>Create Delivery Plan</span>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePlan} className="space-y-3 text-xs">
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
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-300">Items to Deliver (Boxes & Pcs)</span>
                  <button
                    type="button"
                    onClick={handleAddLineItem}
                    className="text-amber-400 font-bold hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item Line</span>
                  </button>
                </div>

                {lineItems.length === 0 ? (
                  <div className="text-slate-500 py-2 text-center">No item lines added. Click "Add Item Line".</div>
                ) : (
                  lineItems.map((line, idx) => {
                    const itemObj = allItems.find(i => i.id === line.itemId);
                    const pcsPerBox = itemObj?.pcs_per_box || 12;
                    const totalPcs = line.qty * pcsPerBox;

                    return (
                      <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/80 border border-slate-700">
                        <select
                          value={line.itemId}
                          onChange={e => {
                            const val = Number(e.target.value);
                            setLineItems(prev => prev.map((l, i) => (i === idx ? { ...l, itemId: val } : l)));
                          }}
                          className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                        >
                          {allItems.map(item => (
                            <option key={item.id} value={item.id}>
                              {item.name} ({item.size}) - Stock: {item.current_qty} BOXES ({item.pcs_per_box || 12} pcs/box)
                            </option>
                          ))}
                        </select>

                        <div className="text-right">
                          <input
                            type="number"
                            min="1"
                            value={line.qty}
                            onChange={e => {
                              const val = parseInt(e.target.value) || 1;
                              setLineItems(prev => prev.map((l, i) => (i === idx ? { ...l, qty: val } : l)));
                            }}
                            className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center font-mono font-bold text-emerald-400"
                          />
                          <div className="text-[9px] text-amber-300 font-bold mt-0.5">={totalPcs} pcs</div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveLineItem(idx)}
                          className="text-rose-400 hover:text-rose-300 p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })
                )}
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
                  disabled={lineItems.length === 0}
                  className="btn-touch px-4 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl shadow"
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
          <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
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
            className="btn-touch bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl font-bold text-xs shadow-md shadow-emerald-950/40 flex items-center gap-1"
          >
            <CheckCircle className="w-4 h-4" />
            <span>Mark Delivered & Deduct</span>
          </button>
        )}
      </div>

      {/* Item Lines with Boxes & Total Pcs */}
      <div className="mt-3 pt-2 border-t border-slate-800/80 space-y-1">
        {lineItems.map(line => {
          const totalPcs = line.qty_planned * (line.pcs_per_box || 12);
          return (
            <div key={line.id} className="flex items-center justify-between text-xs text-slate-300">
              <span>• {line.item_name}</span>
              <span className="font-mono font-bold text-slate-200">
                {line.qty_planned} {line.unit} <span className="text-amber-400">({totalPcs} pcs)</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
