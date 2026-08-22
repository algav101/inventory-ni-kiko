import React, { useState, useEffect } from 'react';
import { Trash2, KeyRound, CheckCircle2, X, ShieldAlert } from 'lucide-react';
import { db } from '../../db/database';

interface ResetAuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ResetAuditLogModal: React.FC<ResetAuditLogModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [inputCode, setInputCode] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const REQUIRED_OTP = '1201';

  useEffect(() => {
    if (isOpen) {
      setInputCode('');
      setErrorMsg('');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirmClear = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmed = inputCode.trim();

    // Check one-time password entry "1201"
    if (trimmed !== REQUIRED_OTP) {
      setErrorMsg(`Invalid Password. Please enter the authorized one-time password code '${REQUIRED_OTP}'.`);
      return;
    }

    try {
      setIsSubmitting(true);
      await db.transactions.clear();
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to clear audit trail logs. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="card-glass w-full max-w-md p-5 bg-slate-900 border-rose-900/60 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-rose-900/40 pb-3">
          <div className="flex items-center gap-2 font-extrabold text-base text-rose-400">
            <Trash2 className="w-5 h-5 text-rose-500 animate-pulse" />
            <span>Reset & Clear Audit Trail Logs</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning Banner */}
        <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-800/60 text-rose-200 text-xs space-y-1">
          <div className="font-extrabold text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <span>CONFIRM LOG WIPE</span>
          </div>
          <p className="leading-relaxed text-slate-300">
            This action will permanently delete and wipe all records from the stock audit trail log database.
          </p>
        </div>

        <form onSubmit={handleConfirmClear} className="space-y-4">
          {/* Required OTP Banner */}
          <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-center space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              One-Time Password (OTP) Code:
            </span>
            <div className="inline-block px-5 py-1 rounded-lg bg-slate-900 border border-emerald-500/40 text-emerald-400 font-mono font-black text-2xl tracking-widest shadow-inner">
              {REQUIRED_OTP}
            </div>
            <span className="text-[10px] text-slate-500 block">
              Enter password <code className="text-emerald-400 font-mono font-bold">{REQUIRED_OTP}</code> to confirm clearing audit trail logs.
            </span>
          </div>

          {/* User Input Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              <span>Enter Password (1201)</span>
            </label>
            <input
              type="text"
              maxLength={6}
              placeholder="Enter 1201"
              value={inputCode}
              onChange={e => {
                setInputCode(e.target.value);
                if (errorMsg) setErrorMsg('');
              }}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-center text-lg font-mono font-bold text-white tracking-widest focus:outline-none focus:border-rose-500 placeholder:text-slate-600 placeholder:text-sm placeholder:tracking-normal"
              autoFocus
              required
            />
          </div>

          {/* Error Alert */}
          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-rose-950 text-rose-300 border border-rose-800 text-xs text-center font-semibold">
              {errorMsg}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !inputCode.trim()}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-extrabold text-xs shadow-lg shadow-rose-950/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Clearing...' : 'Clear Audit Logs'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
