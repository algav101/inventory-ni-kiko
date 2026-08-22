import React, { useState, useEffect } from 'react';
import { ShieldAlert, KeyRound, CheckCircle2, X } from 'lucide-react';
import { resetAllInventoryToZero } from '../../db/database';

interface ResetAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ResetAuthModal: React.FC<ResetAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [challengeCode, setChallengeCode] = useState<string>('');
  const [inputCode, setInputCode] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Generate a random 4-digit challenge code whenever modal opens
  useEffect(() => {
    if (isOpen) {
      const code = Math.floor(1000 + Math.random() * 9000).toString();
      setChallengeCode(code);
      setInputCode('');
      setErrorMsg('');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmed = inputCode.trim();

    // Allow either matching the 4-digit challenge code OR the default admin PIN '1234'
    if (trimmed !== challengeCode && trimmed !== '1234') {
      setErrorMsg(`Invalid authentication code. Please enter '${challengeCode}' or Admin PIN '1234'.`);
      return;
    }

    try {
      setIsSubmitting(true);
      await resetAllInventoryToZero(trimmed);
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to reset inventory. Please try again.');
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
            <ShieldAlert className="w-6 h-6 text-rose-500 animate-pulse" />
            <span>Confirm Inventory Reset</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning Banner */}
        <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-800/60 text-rose-200 text-xs space-y-1">
          <div className="font-extrabold text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
            <span>⚠️ CRITICAL ACTION</span>
          </div>
          <p className="leading-relaxed text-slate-300">
            This will set the current stock quantity of <strong>ALL ITEMS across ALL freezers and stock rooms to ZERO (0)</strong>.
          </p>
        </div>

        <form onSubmit={handleConfirmReset} className="space-y-4">
          {/* Authentication Challenge Display */}
          <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-center space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Required Security Authentication Code:
            </span>
            <div className="inline-block px-4 py-1.5 rounded-lg bg-slate-900 border border-amber-500/40 text-amber-300 font-mono font-black text-2xl tracking-widest shadow-inner">
              {challengeCode}
            </div>
            <span className="text-[10px] text-slate-500 block">
              (Type <code className="text-amber-400 font-mono font-bold">{challengeCode}</code> or Admin PIN <code className="text-emerald-400 font-mono font-bold">1234</code> to confirm)
            </span>
          </div>

          {/* User Input Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              <span>Enter Authentication Code / PIN</span>
            </label>
            <input
              type="text"
              maxLength={6}
              placeholder={`Enter ${challengeCode} or 1234`}
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
              <span>{isSubmitting ? 'Resetting...' : 'Verify & Reset Inventory'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
