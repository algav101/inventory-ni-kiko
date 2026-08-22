import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, DEFAULT_STOCK_LOCATIONS } from '../../db/database';
import type { MeatCategory } from '../../types';
import { Search, AlertTriangle, Plus, Box, Snowflake } from 'lucide-react';

interface InventoryListProps {
  onSelectItem: (itemId: number) => void;
  onOpenManualIntake: () => void;
  onOpenReceiveModal?: (itemId?: number) => void;
}

const CATEGORIES: ('All' | MeatCategory)[] = [
  'All',
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

export const InventoryList: React.FC<InventoryListProps> = ({
  onSelectItem,
  onOpenManualIntake,
  onOpenReceiveModal: _onOpenReceiveModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'All' | MeatCategory>('All');
  const [selectedLocation, setSelectedLocation] = useState<string>('ALL');
  const [filterLowStockOnly, setFilterLowStockOnly] = useState(false);

  const items = useLiveQuery(() => db.items.toArray()) ?? [];

  // Compute dynamic list of all unique categories present in items + standard categories
  const dynamicCategories = Array.from(
    new Set([
      ...CATEGORIES,
      ...items.map(item => item.category)
    ])
  ).filter(Boolean) as ('All' | MeatCategory)[];

  // Compute dynamic list of all unique stock rooms / freezers (default + any newly created custom locations)
  const dynamicLocations = Array.from(
    new Set([
      ...DEFAULT_STOCK_LOCATIONS,
      ...items.flatMap(item => item.stock_locations?.map(l => l.location_name) || [])
    ])
  ).filter(Boolean);

  const filteredItems = items.filter(item => {
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.size.toLowerCase().includes(searchTerm.toLowerCase());

    const itemQty = selectedLocation === 'ALL'
      ? item.current_qty
      : (item.stock_locations?.find(l => l.location_name === selectedLocation)?.qty ?? 0);

    const matchesLowStock = filterLowStockOnly ? itemQty <= item.low_stock_threshold : true;
    const matchesLocation = selectedLocation === 'ALL' || (item.stock_locations && item.stock_locations.some(l => l.location_name === selectedLocation));

    return matchesCategory && matchesSearch && matchesLowStock && matchesLocation;
  });

  return (
    <div className="space-y-3">
      {/* Search Header & Category Filters */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by code, name, size..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800/90 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-red-500"
            />
          </div>

          <button
            onClick={onOpenManualIntake}
            className="btn-touch bg-red-600 hover:bg-red-500 text-white rounded-xl px-3 text-xs font-bold shrink-0 flex items-center gap-1 shadow-md shadow-red-900/30"
          >
            <Plus className="w-4 h-4" />
            <span>New SKU</span>
          </button>
        </div>

        {/* Stock Room / Freezer Location Filter Pills */}
        <div className="p-1.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 flex items-center gap-1">
            <Snowflake className="w-3 h-3 text-cyan-400" />
            <span>Freezer & Storage Location ({dynamicLocations.length})</span>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
            <button
              onClick={() => setSelectedLocation('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition-all ${
                selectedLocation === 'ALL'
                  ? 'bg-cyan-500 text-slate-950 font-extrabold shadow'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
              }`}
            >
              All Storage
            </button>
            {dynamicLocations.map(loc => (
              <button
                key={loc}
                onClick={() => setSelectedLocation(loc)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition-all ${
                  selectedLocation === loc
                    ? 'bg-cyan-600 text-white font-bold shadow'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/50'
                }`}
              >
                {loc === 'Day Delivery Temp Store' ? '🚚 Day Delivery' : loc.replace(' (Main)', '').replace(' (Backup)', '')}
              </button>
            ))}
          </div>
        </div>

        {/* Category Pills & Low Stock Toggle */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setFilterLowStockOnly(!filterLowStockOnly)}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 flex items-center gap-1 border transition-all ${
              filterLowStockOnly
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Low Stock</span>
          </button>

          {dynamicCategories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold shrink-0 transition-all ${
                selectedCategory === cat
                  ? 'bg-slate-200 text-slate-900 font-bold shadow'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/60'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Item List Cards */}
      <div className="space-y-2">
        {filteredItems.length === 0 ? (
          <div className="card-glass p-8 text-center text-slate-400 text-sm">
            No processed meat items matched your filter criteria.
          </div>
        ) : (
          filteredItems.map(item => {
            const displayQty = selectedLocation === 'ALL'
              ? item.current_qty
              : (item.stock_locations?.find(l => l.location_name === selectedLocation)?.qty ?? 0);

            const isLowStock = displayQty <= item.low_stock_threshold;
            const totalPcs = displayQty * (item.pcs_per_box || 1);

            return (
              <div
                key={item.id}
                onClick={() => item.id && onSelectItem(item.id)}
                className={`card-glass p-3.5 cursor-pointer hover:border-slate-600 transition-all border ${
                  isLowStock ? 'border-amber-500/40 bg-slate-900/90' : 'border-slate-800 bg-slate-900/60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-800/50">
                        #{item.sku_code}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-950/60 text-rose-300 border border-rose-800/40">
                        {item.category}
                      </span>
                    </div>

                    <h3 className="font-bold text-sm text-white tracking-tight leading-snug">
                      {item.name}
                    </h3>

                    <div className="text-xs text-slate-400 flex items-center gap-3">
                      <span>Size: <strong className="text-slate-200">{item.size}</strong></span>
                      <span>Pcs/Box: <strong className="text-amber-300">{item.pcs_per_box || 12}</strong></span>
                      <span>Price: <strong className="text-slate-200">₱{item.latest_unit_cost?.toFixed(2) || '0.00'}</strong></span>
                    </div>

                    {/* Per-Freezer Stock Breakdown Tags */}
                    {item.stock_locations && item.stock_locations.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 mt-1.5 pt-1.5 border-t border-slate-800/80">
                        {item.stock_locations.map(loc => loc.qty > 0 && (
                          <span
                            key={loc.location_name}
                            className={`text-[9px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-1 ${
                              loc.location_name === 'Day Delivery Temp Store'
                                ? 'bg-amber-950/80 text-amber-300 border border-amber-800/60'
                                : 'bg-slate-800/90 text-cyan-300 border border-slate-700'
                            }`}
                          >
                            <span>{loc.location_name === 'Day Delivery Temp Store' ? '🚚 Day Deliv:' : `${loc.location_name.split(' ')[0]}:`}</span>
                            <strong className="font-mono text-white">{loc.qty}</strong>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Quantity Badge & Box/Pcs calculation */}
                  <div className="text-right flex flex-col items-end justify-between shrink-0">
                    <div
                      className={`px-3 py-1 rounded-xl text-center shadow-inner ${
                        isLowStock
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                          : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      <div className="font-extrabold text-base leading-none">
                        {displayQty}
                      </div>
                      <div className="text-[9px] font-bold uppercase tracking-wider mt-0.5">
                        {item.unit}
                      </div>
                    </div>

                    <div className="text-[10px] font-bold text-amber-400 mt-1 flex items-center gap-0.5">
                      <Box className="w-3 h-3" />
                      <span>{totalPcs} total pcs</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
