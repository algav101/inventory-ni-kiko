import Dexie, { type Table } from 'dexie';
import type {
  Item,
  SupplierItemCode,
  InventoryTransaction,
  Client,
  DeliveryPlan,
  DeliveryLineItem,
  BackOrder,
  TransactionType,
} from '../types';

export class MeatInventoryDatabase extends Dexie {
  items!: Table<Item, number>;
  supplierItemCodes!: Table<SupplierItemCode, number>;
  transactions!: Table<InventoryTransaction, number>;
  clients!: Table<Client, number>;
  deliveryPlans!: Table<DeliveryPlan, number>;
  deliveryLineItems!: Table<DeliveryLineItem, number>;
  backOrders!: Table<BackOrder, number>;

  constructor() {
    super('ProcessedMeatInventoryDB');

    this.version(2).stores({
      items: '++id, sku_code, name, category, current_qty',
      supplierItemCodes: '++id, item_id, supplier_code, [supplier_name+supplier_code]',
      transactions: '++id, item_id, type, created_at',
      clients: '++id, name',
      deliveryPlans: '++id, client_id, delivery_date, status',
      deliveryLineItems: '++id, delivery_plan_id, item_id',
      backOrders: '++id, item_id, client_id, status',
    });
  }
}

export const db = new MeatInventoryDatabase();

// Atomic transaction logging helper
export async function logTransaction(
  itemId: number,
  type: TransactionType,
  qtyDelta: number,
  resultingQty: number,
  unitCostAtTransaction: number | null,
  reason: string,
  sourceReference: string | null = null,
  createdBy: string = 'User'
) {
  const item = await db.items.get(itemId);
  return db.transactions.add({
    item_id: itemId,
    item_name: item ? `${item.name} (${item.size})` : `Item #${itemId}`,
    type,
    qty_delta: qtyDelta,
    resulting_qty: resultingQty,
    unit_cost_at_transaction: unitCostAtTransaction,
    reason,
    source_reference: sourceReference,
    created_by: createdBy,
    created_at: new Date().toISOString(),
  });
}

export const DEFAULT_STOCK_LOCATIONS = [
  'Freezer 1 (Main)',
  'Freezer 2 (Backup)',
  'Day Delivery Temp Store',
  'Display Freezer',
];

// Helper to sum total current_qty across stock locations
export function computeTotalQtyFromLocations(locations?: { location_name: string; qty: number }[]): number {
  if (!locations || locations.length === 0) return 0;
  return locations.reduce((sum, loc) => sum + (loc.qty || 0), 0);
}

// Reset ALL inventory to ZERO (User requested feature with security auth)
export async function resetAllInventoryToZero(authCode: string = '1234') {
  return db.transaction('rw', [db.items, db.transactions], async () => {
    const allItems = await db.items.toArray();
    const now = new Date().toISOString();

    for (const item of allItems) {
      if (item.id && item.current_qty !== 0) {
        const oldQty = item.current_qty;
        await db.items.update(item.id, {
          current_qty: 0,
          stock_locations: [
            { location_name: 'Freezer 1 (Main)', qty: 0 },
            { location_name: 'Day Delivery Temp Store', qty: 0 },
          ],
          updated_at: now,
        });

        await logTransaction(
          item.id,
          'STOCK_RESET',
          -oldQty,
          0,
          item.latest_unit_cost,
          `Global Inventory Reset (Auth Code verified: ${authCode}): cleared stock from ${oldQty} to 0`
        );
      }
    }
  });
}

// Atomic Stock Correction
export async function correctStockQuantity(
  itemId: number,
  newQuantity: number,
  reason: string,
  locationName: string = 'Freezer 1 (Main)'
) {
  return db.transaction('rw', [db.items, db.transactions], async () => {
    const item = await db.items.get(itemId);
    if (!item) throw new Error('Item not found');

    const qtyDelta = newQuantity - item.current_qty;
    const now = new Date().toISOString();

    let locs = item.stock_locations ? [...item.stock_locations] : [];
    const locIdx = locs.findIndex(l => l.location_name === locationName);
    if (locIdx >= 0) {
      locs[locIdx].qty = newQuantity;
    } else {
      locs.push({ location_name: locationName, qty: newQuantity });
    }

    const computedTotal = computeTotalQtyFromLocations(locs);

    await db.items.update(itemId, {
      current_qty: computedTotal,
      stock_locations: locs,
      updated_at: now,
    });

    await logTransaction(
      itemId,
      'MANUAL_CORRECTION',
      qtyDelta,
      computedTotal,
      item.latest_unit_cost,
      `Location [${locationName}] corrected: ${reason}`
    );
  });
}

// Receive Stock (Add vs Reset/Overwrite) per Location
export async function receiveStock(
  itemId: number,
  qtyValue: number,
  mode: 'ADD' | 'RESET',
  unitCost: number | null,
  reason: string = 'Stock intake',
  locationName: string = 'Freezer 1 (Main)'
) {
  return db.transaction('rw', [db.items, db.transactions], async () => {
    const item = await db.items.get(itemId);
    if (!item) throw new Error('Item not found');

    const oldTotalQty = item.current_qty;
    let locs = item.stock_locations && item.stock_locations.length > 0
      ? [...item.stock_locations]
      : [{ location_name: 'Freezer 1 (Main)', qty: oldTotalQty }];

    const targetLocIdx = locs.findIndex(l => l.location_name === locationName);
    let oldLocQty = targetLocIdx >= 0 ? locs[targetLocIdx].qty : 0;
    let newLocQty = mode === 'ADD' ? oldLocQty + qtyValue : qtyValue;

    if (targetLocIdx >= 0) {
      locs[targetLocIdx] = { location_name: locationName, qty: Math.max(0, newLocQty) };
    } else {
      locs.push({ location_name: locationName, qty: Math.max(0, newLocQty) });
    }

    const newTotalQty = computeTotalQtyFromLocations(locs);
    const delta = newTotalQty - oldTotalQty;
    const now = new Date().toISOString();
    const type: TransactionType = mode === 'ADD' ? 'STOCK_ADD' : 'STOCK_RESET';

    await db.items.update(itemId, {
      current_qty: newTotalQty,
      stock_locations: locs,
      latest_unit_cost: unitCost !== null && unitCost > 0 ? unitCost : item.latest_unit_cost,
      updated_at: now,
    });

    await logTransaction(
      itemId,
      type,
      delta,
      newTotalQty,
      unitCost ?? item.latest_unit_cost,
      mode === 'ADD'
        ? `[${locationName}] Received +${qtyValue} ${item.unit}: ${reason}`
        : `[${locationName}] Reset stock to ${newLocQty} ${item.unit}: ${reason}`
    );
  });
}

// Transfer Stock between Freezers / Stockrooms
export async function transferStockBetweenLocations(
  itemId: number,
  fromLocation: string,
  toLocation: string,
  transferQty: number,
  reason: string = 'Stock transfer'
) {
  return db.transaction('rw', [db.items, db.transactions], async () => {
    const item = await db.items.get(itemId);
    if (!item) throw new Error('Item not found');
    if (transferQty <= 0) throw new Error('Transfer quantity must be greater than 0');

    let locs = item.stock_locations && item.stock_locations.length > 0
      ? [...item.stock_locations]
      : [{ location_name: 'Freezer 1 (Main)', qty: item.current_qty }];

    const fromIdx = locs.findIndex(l => l.location_name === fromLocation);
    if (fromIdx < 0 || locs[fromIdx].qty < transferQty) {
      throw new Error(`Insufficient stock in ${fromLocation} to transfer ${transferQty} ${item.unit}`);
    }

    // Deduct from source location
    locs[fromIdx].qty -= transferQty;

    // Add to target location
    const toIdx = locs.findIndex(l => l.location_name === toLocation);
    if (toIdx >= 0) {
      locs[toIdx].qty += transferQty;
    } else {
      locs.push({ location_name: toLocation, qty: transferQty });
    }

    const now = new Date().toISOString();
    const newTotal = computeTotalQtyFromLocations(locs);

    await db.items.update(itemId, {
      current_qty: newTotal,
      stock_locations: locs,
      updated_at: now,
    });

    await logTransaction(
      itemId,
      'MANUAL_CORRECTION',
      0,
      newTotal,
      item.latest_unit_cost,
      `Moved ${transferQty} ${item.unit} from [${fromLocation}] -> [${toLocation}]: ${reason}`
    );
  });
}

// Supplier Alias Lookup & Fuzzy Match Engine
export async function findMatchingItemForSupplierRow(
  _supplierName: string,
  supplierCode: string,
  rawDescription: string,
  sizeStr: string
): Promise<{
  matchedItemId: number | null;
  confidence: 'exact_code' | 'fuzzy_desc' | 'none';
  matchReason: string;
}> {
  // 1. Direct SKU Code or SupplierItemCode alias table check
  if (supplierCode) {
    const cleanCode = supplierCode.trim().toUpperCase();

    // Check direct match on items table sku_code
    const directItem = await db.items
      .where('sku_code')
      .equals(cleanCode)
      .first();

    if (directItem && directItem.id) {
      return {
        matchedItemId: directItem.id,
        confidence: 'exact_code',
        matchReason: `Exact matched SKU "${cleanCode}" to ${directItem.name} (${directItem.size})`,
      };
    }

    // Check alias table
    const alias = await db.supplierItemCodes
      .where('supplier_code')
      .equals(cleanCode)
      .first();

    if (alias) {
      const item = await db.items.get(alias.item_id);
      if (item) {
        return {
          matchedItemId: item.id!,
          confidence: 'exact_code',
          matchReason: `Matched alias code "${supplierCode}" to ${item.name} (${item.size})`,
        };
      }
    }
  }

  // 2. Fuzzy Description + Size match
  const allItems = await db.items.toArray();
  const normalizedRawDesc = rawDescription.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalizedSize = sizeStr.toLowerCase().replace(/[^a-z0-9]/g, '');

  let bestMatch: Item | null = null;
  let highestScore = 0;

  for (const item of allItems) {
    const itemNameNorm = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const itemSizeNorm = item.size.toLowerCase().replace(/[^a-z0-9]/g, '');
    const itemSkuNorm = item.sku_code.toLowerCase().replace(/[^a-z0-9]/g, '');

    let score = 0;
    if (supplierCode && (itemSkuNorm === supplierCode.toLowerCase() || itemSkuNorm.includes(supplierCode.toLowerCase()))) {
      score += 60;
    }
    if (normalizedRawDesc.includes(itemNameNorm) || itemNameNorm.includes(normalizedRawDesc)) {
      score += 50;
    }
    if (normalizedSize && (normalizedSize === itemSizeNorm || normalizedRawDesc.includes(itemSizeNorm))) {
      score += 40;
    }

    if (score > highestScore && score >= 40) {
      highestScore = score;
      bestMatch = item;
    }
  }

  if (bestMatch && bestMatch.id) {
    return {
      matchedItemId: bestMatch.id,
      confidence: 'fuzzy_desc',
      matchReason: `Fuzzy matched description "${rawDescription}" -> ${bestMatch.name} (${bestMatch.size})`,
    };
  }

  return {
    matchedItemId: null,
    confidence: 'none',
    matchReason: 'No existing SKU match found. Will create new item candidate.',
  };
}

// Seed Reference Data (Full CDO Frozen Meat Products Catalog with QTY = 0)
export async function seedDatabaseIfEmpty() {
  const count = await db.items.count();

  // Reference List of Registered CDO Frozen Meat Products (All QTY = 0 initially)
  const frozenMeatData: Omit<Item, 'id'>[] = [
    // --- HOTDOGS & CHEESEDOGS ---
    { sku_code: '4460', name: 'IDOL Cdog Reg. x 24', category: 'Hotdog', unit: 'BOX', size: '250G', pcs_per_box: 24, latest_unit_cost: 1212.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '4462', name: 'IDOL Cdog Jumbo x 10', category: 'Hotdog', unit: 'BOX', size: '500G', pcs_per_box: 10, latest_unit_cost: 1010.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '4463', name: 'IDOL Cdog Jumbo x 12', category: 'Hotdog', unit: 'BOX', size: '1KG', pcs_per_box: 12, latest_unit_cost: 2028.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '4464', name: 'IDOL Cdog Super Jumbo x 10', category: 'Hotdog', unit: 'BOX', size: '1KG', pcs_per_box: 10, latest_unit_cost: 2050.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '1435', name: 'Bingo Hotdog Mini FW x 24', category: 'Hotdog', unit: 'BOX', size: '250G', pcs_per_box: 24, latest_unit_cost: 792.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '5105', name: 'BT Negosyo Cheesedog KS', category: 'Hotdog', unit: 'BOX', size: '1KG', pcs_per_box: 10, latest_unit_cost: 1248.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '5098', name: 'BT Negosyo King-size X 16+1', category: 'Hotdog', unit: 'BOX', size: '1.1KG', pcs_per_box: 17, latest_unit_cost: 1184.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '3786', name: 'BT Cheesedog Flong x 14', category: 'Hotdog', unit: 'BOX', size: '1KG', pcs_per_box: 14, latest_unit_cost: 1530.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '1116', name: 'Hol. Cdog Flong x 10', category: 'Hotdog', unit: 'BOX', size: '1KG', pcs_per_box: 10, latest_unit_cost: 1570.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '1118', name: 'Holiday Footlong x 14', category: 'Hotdog', unit: 'BOX', size: '1.0KG', pcs_per_box: 14, latest_unit_cost: 1570.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '3176', name: 'BT Chicken Hotdog KS x 12', category: 'Hotdog', unit: 'BOX', size: '1.1KG', pcs_per_box: 12, latest_unit_cost: 1968.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '3175', name: 'CDO Bibbo! Hotdog Classic 1KG', category: 'Hotdog', unit: 'BOX', size: '1KG', pcs_per_box: 10, latest_unit_cost: 1850.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '3177', name: 'CDO Bibbo! Cheesedog Classic 1KG', category: 'Hotdog', unit: 'BOX', size: '1KG', pcs_per_box: 10, latest_unit_cost: 1900.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },

    // --- TOCINO & BARBECUE ---
    { sku_code: '474', name: 'Funtastyk YP Tocino x 36', category: 'Tocino', unit: 'BOX', size: '225G', pcs_per_box: 36, latest_unit_cost: 2196.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '475', name: 'Funtastyk YP Tocino 450G', category: 'Tocino', unit: 'BOX', size: '450G', pcs_per_box: 20, latest_unit_cost: 2450.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '476', name: 'Funtastyk YP Tocino FATLESS', category: 'Tocino', unit: 'BOX', size: '225G', pcs_per_box: 36, latest_unit_cost: 2250.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '477', name: 'Funtastyk YP Tocino CHILI', category: 'Tocino', unit: 'BOX', size: '225G', pcs_per_box: 36, latest_unit_cost: 2250.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '478', name: 'Funtastyk YP Barbecue 450G', category: 'Tocino', unit: 'BOX', size: '450G', pcs_per_box: 20, latest_unit_cost: 2400.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '479', name: 'Funtastyk Chicken Tocino 450G', category: 'Tocino', unit: 'BOX', size: '450G', pcs_per_box: 20, latest_unit_cost: 2350.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },

    // --- LONGGANISA & TAPA ---
    { sku_code: '5009', name: 'Funtastyk Longganisa FW x 25', category: 'Longganisa', unit: 'BOX', size: '240G', pcs_per_box: 25, latest_unit_cost: 1850.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '5010', name: 'CDO Skinless Longganisa 250G', category: 'Longganisa', unit: 'BOX', size: '250G', pcs_per_box: 24, latest_unit_cost: 1750.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '5011', name: 'CDO Hamonado Longganisa 250G', category: 'Longganisa', unit: 'BOX', size: '250G', pcs_per_box: 24, latest_unit_cost: 1750.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '5012', name: 'CDO Beef Longganisa 250G', category: 'Longganisa', unit: 'BOX', size: '250G', pcs_per_box: 24, latest_unit_cost: 1800.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '5013', name: 'CDO Chicken Longganisa 250G', category: 'Longganisa', unit: 'BOX', size: '250G', pcs_per_box: 24, latest_unit_cost: 1700.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '5014', name: 'CDO Beef Tapa 250G', category: 'Other', unit: 'BOX', size: '250G', pcs_per_box: 24, latest_unit_cost: 1950.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },

    // --- SIOMAI & DUMPLINGS ---
    { sku_code: '3912', name: 'Holiday Pork Siomai x 18', category: 'Siomai', unit: 'BOX', size: '240G', pcs_per_box: 18, latest_unit_cost: 756.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '3913', name: 'Hol. Pork Siomai x9', category: 'Siomai', unit: 'BOX', size: '960G', pcs_per_box: 9, latest_unit_cost: 1269.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '4292', name: 'Hol. Chicken Siomai x9', category: 'Siomai', unit: 'BOX', size: '960G', pcs_per_box: 9, latest_unit_cost: 1269.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '4979', name: 'Holiday Beef Siomai x 9', category: 'Siomai', unit: 'BOX', size: '960G', pcs_per_box: 9, latest_unit_cost: 1269.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },

    // --- BURGERS & NUGGETS ---
    { sku_code: '4721', name: 'CDO Chicken Cripy Burger', category: 'Burger', unit: 'BOX', size: '228G', pcs_per_box: 20, latest_unit_cost: 1144.50, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '4395', name: 'CDO Crispy Burger x 21', category: 'Burger', unit: 'BOX', size: '228G', pcs_per_box: 21, latest_unit_cost: 1123.50, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '4455', name: 'Ulam Burger C-A-P Reg.', category: 'Burger', unit: 'BOX', size: '912G', pcs_per_box: 20, latest_unit_cost: 1588.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '403', name: 'Ulam Burger Reg. Bulkpack', category: 'Burger', unit: 'BOX', size: '3.04KG', pcs_per_box: 1, latest_unit_cost: 640.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '404', name: 'CDO Ulam Burger Mini 225G', category: 'Burger', unit: 'BOX', size: '225G', pcs_per_box: 24, latest_unit_cost: 1250.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '405', name: 'CDO Ulam Burger Big 900G', category: 'Burger', unit: 'BOX', size: '900G', pcs_per_box: 10, latest_unit_cost: 1650.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '406', name: 'CDO Ulam Burger Cheesy 228G', category: 'Burger', unit: 'BOX', size: '228G', pcs_per_box: 20, latest_unit_cost: 1200.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '407', name: 'CDO Chicken Burger 228G', category: 'Burger', unit: 'BOX', size: '228G', pcs_per_box: 20, latest_unit_cost: 1180.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '3179', name: 'Highlands Beef Patties 452G', category: 'Burger', unit: 'BOX', size: '452G', pcs_per_box: 20, latest_unit_cost: 2100.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },

    // --- FRANKS & SAUSAGES ---
    { sku_code: '4392', name: 'Cheesy Chicken Franks Jbo x 10', category: 'Sausage', unit: 'BOX', size: '500G', pcs_per_box: 10, latest_unit_cost: 1015.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '4391', name: 'CDO Chicken Franks Classic 1KG', category: 'Sausage', unit: 'BOX', size: '1KG', pcs_per_box: 10, latest_unit_cost: 1850.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '4393', name: 'CDO Chicken Franks Honey BBQ 500G', category: 'Sausage', unit: 'BOX', size: '500G', pcs_per_box: 20, latest_unit_cost: 1100.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '4394', name: 'CDO Beef Franks Classic 1KG', category: 'Sausage', unit: 'BOX', size: '1KG', pcs_per_box: 10, latest_unit_cost: 1950.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '3178', name: 'Highlands Gold Beef Franks 500G', category: 'Sausage', unit: 'BOX', size: '500G', pcs_per_box: 20, latest_unit_cost: 2200.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },

    // --- BACON ---
    { sku_code: '2001', name: 'CDO Young Pork Bacon Smoked 400G', category: 'Bacon', unit: 'BOX', size: '400G', pcs_per_box: 20, latest_unit_cost: 2600.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '2002', name: 'CDO Young Pork Bacon Uncured 400G', category: 'Bacon', unit: 'BOX', size: '400G', pcs_per_box: 20, latest_unit_cost: 2700.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '2003', name: 'CDO Young Pork Bacon Honeycured 200G', category: 'Bacon', unit: 'BOX', size: '200G', pcs_per_box: 30, latest_unit_cost: 2200.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '2004', name: 'CDO Young Pork Baconettes Thick-Cut', category: 'Bacon', unit: 'BOX', size: '200G', pcs_per_box: 30, latest_unit_cost: 2150.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '2005', name: 'CDO Bacon Toppings 250G', category: 'Bacon', unit: 'BOX', size: '250G', pcs_per_box: 24, latest_unit_cost: 1900.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },

    // --- HAMS & DELI ---
    { sku_code: '5409', name: 'Savers Sweet Ham', category: 'Ham', unit: 'BOX', size: '250G', pcs_per_box: 24, latest_unit_cost: 1760.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '5410', name: 'CDO Holiday Ham Whole 1KG', category: 'Ham', unit: 'BOX', size: '1KG', pcs_per_box: 10, latest_unit_cost: 3200.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '5411', name: 'CDO Hawaiian Ham 1KG', category: 'Ham', unit: 'BOX', size: '1KG', pcs_per_box: 10, latest_unit_cost: 2800.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '5412', name: 'CDO Jamon de Bola 1KG', category: 'Ham', unit: 'BOX', size: '1KG', pcs_per_box: 10, latest_unit_cost: 2900.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '5413', name: 'CDO Chicken Ham 1KG', category: 'Ham', unit: 'BOX', size: '1KG', pcs_per_box: 10, latest_unit_cost: 2600.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '5414', name: 'CDO American Ham 500G', category: 'Ham', unit: 'BOX', size: '500G', pcs_per_box: 20, latest_unit_cost: 1950.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '5415', name: 'CDO Pear-Shaped Ham 800G', category: 'Ham', unit: 'BOX', size: '800G', pcs_per_box: 12, latest_unit_cost: 2400.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '5416', name: 'CDO Sweet Ham 250G', category: 'Ham', unit: 'BOX', size: '250G', pcs_per_box: 24, latest_unit_cost: 1800.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },

    // --- KATSU, EMBUTIDO & SPECIALTIES ---
    { sku_code: '4801', name: 'CDO Premium Tonkatsu 420G', category: 'Other', unit: 'BOX', size: '420G', pcs_per_box: 15, latest_unit_cost: 2200.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '4802', name: 'CDO Premium Torikatsu 420G', category: 'Other', unit: 'BOX', size: '420G', pcs_per_box: 15, latest_unit_cost: 2150.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '4803', name: 'CDO Premium Cheesy Tonkatsu', category: 'Other', unit: 'BOX', size: '420G', pcs_per_box: 15, latest_unit_cost: 2300.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { sku_code: '5015', name: 'CDO Native Favorites Embutido', category: 'Other', unit: 'BOX', size: '400G', pcs_per_box: 20, latest_unit_cost: 1850.00, current_qty: 0, low_stock_threshold: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  ];

  // If table is empty, bulk add all CDO reference items
  if (count === 0) {
    const itemIds = await db.items.bulkAdd(frozenMeatData, { allKeys: true });

    // Seed Aliases
    frozenMeatData.forEach((item, idx) => {
      db.supplierItemCodes.add({
        item_id: itemIds[idx],
        supplier_name: 'CDO Foodsphere Inc.',
        supplier_code: item.sku_code,
        created_at: new Date().toISOString(),
      });
    });
  } else {
    // Upsert missing reference SKUs so existing database gets full reference catalog
    const existingSkus = new Set((await db.items.toArray()).map(i => i.sku_code));
    const now = new Date().toISOString();

    for (const item of frozenMeatData) {
      if (!existingSkus.has(item.sku_code)) {
        const newId = await db.items.add(item);
        await db.supplierItemCodes.add({
          item_id: newId,
          supplier_name: 'CDO Foodsphere Inc.',
          supplier_code: item.sku_code,
          created_at: now,
        });
      }
    }
  }

  // Seed Clients if empty
  const clientCount = await db.clients.count();
  if (clientCount === 0) {
    const now = new Date().toISOString();
    await db.clients.bulkAdd([
      { name: 'Kiko Meat Retail Shop (Main)', contact_info: '0917-555-0192', address: 'Market Stall #14', created_at: now },
      { name: 'Aling Nena Store', contact_info: '0918-444-9921', address: 'Brgy 5 Poblacion', created_at: now },
      { name: 'Sizzling Grill Carinderia', contact_info: '0922-888-3312', address: 'Arcade Unit 3', created_at: now },
    ]);
  }
}
