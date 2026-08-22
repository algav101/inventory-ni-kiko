import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  db,
  DEFAULT_STOCK_LOCATIONS,
  addFreezerLocation,
  renameFreezerLocation,
  deleteFreezerLocation,
} from '../../db/database';
import { Snowflake, Edit3, Trash2, Plus, Check, X, Box } from 'lucide-react';

interface FreezerManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FreezerManagerModal: React.FC<FreezerManagerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const items = useLiveQuery(() => db.items.toArray()) ?? [];
  const dbFreezers = useLiveQuery(() => db.freezerLocations.toArray()) ?? [];

  // Editing state
  const [editingLocName, setEditingLocName] = useState<string | null>(null);
  const [newLocNameInput, setNewLocNameInput] = useState<string>('');

  // Add new freezer state
  const [addFreezerInput, setAddFreezerInput] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  if (!isOpen) return null;

  // Compute all unique freezers
  const allFreezerNames = Array.from(
    new Set([
      ...DEFAULT_STOCK_LOCATIONS,
      ...dbFreezers.map(f => f.name),
      ...items.flatMap(item => item.stock_locations?.map(l => l.location_name) || []),
    ])
  ).filter(Boolean);

  // Start editing a freezer name
  const startEditing = (locName: string) => {
    setEditingLocName(locName);
    setNewLocNameInput(locName);
    setErrorMsg('');
  };

  // Save renamed freezer
  const handleSaveRename = async (oldName: string) => {
    setErrorMsg('');
    const cleanNew = newLocNameInput.trim();

    if (!cleanNew) {
      setErrorMsg('Freezer name cannot be empty.');
      return;
    }

    if (cleanNew !== oldName && allFreezerNames.includes(cleanNew)) {
      setErrorMsg(`A freezer named "${cleanNew}" already exists.`);
      return;
    }

    try {
      await renameFreezerLocation(oldName, cleanNew);
      setEditingLocName(null);
      setNewLocNameInput('');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || 'Failed to rename freezer location.');
    }
  };

  // Add new freezer location
  const handleAddFreezer = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const cleanName = addFreezerInput.trim();

    if (!cleanName) return;

    if (allFreezerNames.some(f => f.toLowerCase() === cleanName.toLowerCase())) {
      setErrorMsg(`Freezer "${cleanName}" already exists.`);
      return;
    }

    try {
      await addFreezerLocation(cleanName);
      setAddFreezerInput('');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || 'Failed to add freezer.');
    }
  };

  // Delete a freezer location
  const handleDeleteFreezer = async (locName: string) => {
    const storedItemsCount = items.filter(item =>
      item.stock_locations?.some(l => l.location_name === locName && l.qty > 0)
    ).length;

    const confirmMsg = storedItemsCount > 0
      ? `DELETE FREEZER "${locName}"?\n\nWarning: ${storedItemsCount} item(s) currently have stock recorded in this freezer. Deleting this location will remove this location tag from those items. Proceed?`
      : `Delete freezer location "${locName}"?`;

    if (window.confirm(confirmMsg)) {
      await deleteFreezerLocation(locName);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="card-glass w-full max-w-lg p-5 bg-slate-900 border-cyan-900/60 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 font-extrabold text-base text-cyan-300">
            <Snowflake className="w-5 h-5 text-cyan-400" />
            <span>Freezer & Storage Location Manager</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        {/* Add New Freezer Form */}
        <form onSubmit={handleAddFreezer} className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
          <label className="block text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-cyan-400" />
            <span>Add New Freezer / Storage Location</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. Freezer 3, Walk-in Chiller B"
              value={addFreezerInput}
              onChange={e => setAddFreezerInput(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              disabled={!addFreezerInput.trim()}
              className="btn-touch px-4 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow shrink-0 flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              <span>Add</span>
            </button>
          </div>
        </form>

        {/* List of Registered Freezers */}
        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
            Active Freezers & Stock Rooms ({allFreezerNames.length})
          </div>

          {allFreezerNames.map(locName => {
            const isEditing = editingLocName === locName;
            const itemsInFreezer = items.filter(item =>
              item.stock_locations?.some(l => l.location_name === locName)
            );
            const totalBoxesInFreezer = items.reduce((acc, item) => {
              const locQty = item.stock_locations?.find(l => l.location_name === locName)?.qty || 0;
              return acc + locQty;
            }, 0);

            return (
              <div
                key={locName}
                className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 flex items-center justify-between gap-2"
              >
                {isEditing ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      value={newLocNameInput}
                      onChange={e => setNewLocNameInput(e.target.value)}
                      className="flex-1 bg-slate-800 border border-cyan-500 rounded-lg px-2.5 py-1 text-xs text-white font-bold focus:outline-none"
                      autoFocus
                    />
                    <button
                      onClick={() => handleSaveRename(locName)}
                      className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white"
                      title="Save Name"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditingLocName(null)}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-0.5">
                      <div className="font-extrabold text-sm text-slate-100 flex items-center gap-2">
                        <span>{locName}</span>
                        {DEFAULT_STOCK_LOCATIONS.includes(locName) && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/60">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2">
                        <span>{itemsInFreezer.length} SKUs assigned</span>
                        <span>•</span>
                        <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                          <Box className="w-3 h-3" />
                          {totalBoxesInFreezer} boxes total
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => startEditing(locName)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1"
                        title="Rename Freezer"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Rename</span>
                      </button>

                      <button
                        onClick={() => handleDeleteFreezer(locName)}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950 text-slate-500 hover:text-rose-400 border border-slate-800"
                        title="Delete Freezer Location"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
          >
            Close Manager
          </button>
        </div>
      </div>
    </div>
  );
};
