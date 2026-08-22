import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import type { TransactionType } from '../../types';
import { History, Search, Trash2 } from 'lucide-react';
import { ResetAuditLogModal } from './ResetAuditLogModal';

const TRANSACTION_TYPES: ('ALL' | TransactionType)[] = [
  'ALL',
  'OCR_INTAKE',
  'MANUAL_INTAKE',
  'DELIVERY_DEDUCTION',
  'STOCK_ADD',
  'STOCK_RESET',
  'MANUAL_CORRECTION',
];

export const AuditTrailView: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<'ALL' | TransactionType>('ALL');
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  const transactions = useLiveQuery(() => db.transactions.orderBy('id').reverse().toArray()) ?? [];

  const filteredTransactions = transactions.filter(tx => {
    const matchesType = selectedType === 'ALL' || tx.type === selectedType;
    const matchesSearch =
      (tx.item_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      tx.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tx.source_reference?.toLowerCase() || '').includes(searchTerm.toLowerCase());

    return matchesType && matchesSearch;
  });

  return (
    <div className="space-y-3">
      {/* Title & Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-base text-white">
          <History className="w-5 h-5 text-blue-400" />
          <span>Global Audit Trail</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">{filteredTransactions.length} records</span>
          <button
            onClick={() => setIsResetModalOpen(true)}
            className="btn-touch px-2.5 py-1 bg-rose-600/90 hover:bg-rose-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow"
            title="Reset & Clear Audit Trail Logs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Reset Logs</span>
          </button>
        </div>
      </div>

      <ResetAuditLogModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onSuccess={() => {
          alert('Audit trail logs have been reset & cleared.');
        }}
      />

      <div className="space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search log by item name or reason..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {TRANSACTION_TYPES.map(type => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold shrink-0 transition-all ${
                selectedType === type
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction List */}
      <div className="space-y-2">
        {filteredTransactions.length === 0 ? (
          <div className="card-glass p-8 text-center text-slate-400 text-sm">
            No audit records match the current filter.
          </div>
        ) : (
          filteredTransactions.map(tx => (
            <div
              key={tx.id}
              className="card-glass p-3 border-slate-800 bg-slate-900/80 text-xs flex items-center justify-between"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-slate-200">{tx.item_name}</span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                    {tx.type}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">{tx.reason}</div>
                <div className="text-[10px] text-slate-500 flex items-center gap-2">
                  <span>{new Date(tx.created_at).toLocaleString()}</span>
                  {tx.unit_cost_at_transaction && (
                    <span>• Cost: ₱{tx.unit_cost_at_transaction.toFixed(2)}</span>
                  )}
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className={`font-extrabold text-sm ${tx.qty_delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {tx.qty_delta >= 0 ? `+${tx.qty_delta}` : tx.qty_delta}
                </div>
                <div className="text-[10px] text-slate-400">
                  Result: <strong className="text-slate-200">{tx.resulting_qty}</strong>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
