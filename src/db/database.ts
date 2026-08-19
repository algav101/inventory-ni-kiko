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

// Reset ALL inventory to ZERO (User requested feature)
export async function resetAllInventoryToZero() {
  return db.transaction('rw', [db.items, db.transactions], async () => {
    const allItems = await db.items.toArray();
    const now = new Date().toISOString();

    for (const item of allItems) {
      if (item.id && item.current_qty !== 0) {
        const oldQty = item.current_qty;
        await db.items.update(item.id, {
          current_qty: 0,
          updated_at: now,
        });

        await logTransaction(
          item.id,
          'STOCK_RESET',
          -oldQty,
          0,
          item.latest_unit_cost,
          `Global Inventory Reset: cleared count from ${oldQty} to 0`
        );
      }
    }
  });
}

// Atomic Stock Correction
export async function correctStockQuantity(
  itemId: number,
  newQuantity: number,
  reason: string
) {
  return db.transaction('rw', [db.items, db.transactions], async () => {
    const item = await db.items.get(itemId);
    if (!item) throw new Error('Item not found');

    const qtyDelta = newQuantity - item.current_qty;
    const now = new Date().toISOString();

    await db.items.update(itemId, {
      current_qty: newQuantity,
      updated_at: now,
    });

    await logTransaction(
      itemId,
      'MANUAL_CORRECTION',
      qtyDelta,
      newQuantity,
      item.latest_unit_cost,
      reason
    );
  });
}

// Receive Stock (Add vs Reset/Overwrite)
export async function receiveStock(
  itemId: number,
  qtyValue: number,
  mode: 'ADD' | 'RESET',
  unitCost: number | null,
  reason: string = 'Stock intake'
) {
  return db.transaction('rw', [db.items, db.transactions], async () => {
    const item = await db.items.get(itemId);
    if (!item) throw new Error('Item not found');

    const oldQty = item.current_qty;
    const newQty = mode === 'ADD' ? oldQty + qtyValue : qtyValue;
    const delta = mode === 'ADD' ? qtyValue : newQty - oldQty;
    const now = new Date().toISOString();
    const type: TransactionType = mode === 'ADD' ? 'STOCK_ADD' : 'STOCK_RESET';

    await db.items.update(itemId, {
      current_qty: newQty,
      latest_unit_cost: unitCost !== null && unitCost > 0 ? unitCost : item.latest_unit_cost,
      updated_at: now,
    });

    await logTransaction(
      itemId,
      type,
      delta,
      newQty,
      unitCost ?? item.latest_unit_cost,
      mode === 'ADD' ? `Received +${qtyValue} ${item.unit}: ${reason}` : `Reset stock from ${oldQty} to ${newQty} ${item.unit}: ${reason}`
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
  // 1. Check SupplierItemCode alias table
  if (supplierCode) {
    const cleanCode = supplierCode.trim().toUpperCase();
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
          matchReason: `Matched code "${supplierCode}" to ${item.name} (${item.size})`,
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

// Seed Reference Data (All Initial Quantities set to ZERO as requested)
export async function seedDatabaseIfEmpty() {
  const count = await db.items.count();
  if (count > 0) return;

  const now = new Date().toISOString();

  // Initial Reference Items based on user supplier invoice photo (ALL QTY = 0)
  const itemsData: Omit<Item, 'id'>[] = [
    { sku_code: '4460', name: 'IDOL Cdog Reg. x 24', category: 'Hotdog', unit: 'BOX', size: '250G', pcs_per_box: 24, latest_unit_cost: 1212.00, current_qty: 0, low_stock_threshold: 5, created_at: now, updated_at: now },
    { sku_code: '4462', name: 'IDOL Cdog Jumbo x 10', category: 'Hotdog', unit: 'BOX', size: '500G', pcs_per_box: 10, latest_unit_cost: 1010.00, current_qty: 0, low_stock_threshold: 5, created_at: now, updated_at: now },
    { sku_code: '4463', name: 'IDOL Cdog Jumbo x 12', category: 'Hotdog', unit: 'BOX', size: '1KG', pcs_per_box: 12, latest_unit_cost: 2028.00, current_qty: 0, low_stock_threshold: 5, created_at: now, updated_at: now },
    { sku_code: '1435', name: 'Bingo Hotdog Mini FW x 24', category: 'Hotdog', unit: 'BOX', size: '250G', pcs_per_box: 24, latest_unit_cost: 792.00, current_qty: 0, low_stock_threshold: 5, created_at: now, updated_at: now },
    { sku_code: '5105', name: 'BT Negosyo Cheesedog KS', category: 'Hotdog', unit: 'BOX', size: '1KG', pcs_per_box: 10, latest_unit_cost: 1248.00, current_qty: 0, low_stock_threshold: 5, created_at: now, updated_at: now },
    { sku_code: '5098', name: 'BT Negosyo King-size X 16+1', category: 'Hotdog', unit: 'BOX', size: '1.1KG', pcs_per_box: 17, latest_unit_cost: 1184.00, current_qty: 0, low_stock_threshold: 5, created_at: now, updated_at: now },
    { sku_code: '3786', name: 'BT Cheesedog Flong x 14', category: 'Hotdog', unit: 'BOX', size: '1KG', pcs_per_box: 14, latest_unit_cost: 1530.00, current_qty: 0, low_stock_threshold: 5, created_at: now, updated_at: now },
    { sku_code: '1116', name: 'Hol. Cdog Flong x 10', category: 'Hotdog', unit: 'BOX', size: '1KG', pcs_per_box: 10, latest_unit_cost: 1570.00, current_qty: 0, low_stock_threshold: 5, created_at: now, updated_at: now },
    { sku_code: '1118', name: 'Holiday Footlong x 14', category: 'Hotdog', unit: 'BOX', size: '1.0KG', pcs_per_box: 14, latest_unit_cost: 1570.00, current_qty: 0, low_stock_threshold: 5, created_at: now, updated_at: now },
    { sku_code: '3176', name: 'BT Chicken Hotdog KS x 12', category: 'Hotdog', unit: 'BOX', size: '1.1KG', pcs_per_box: 12, latest_unit_cost: 1968.00, current_qty: 0, low_stock_threshold: 5, created_at: now, updated_at: now },
    { sku_code: '4392', name: 'Cheesy Chicken Franks Jbo x 10', category: 'Sausage', unit: 'BOX', size: '500G', pcs_per_box: 10, latest_unit_cost: 1015.00, current_qty: 0, low_stock_threshold: 5, created_at: now, updated_at: now },
    { sku_code: '474', name: 'Funtastyk YP Tocino x 36', category: 'Tocino', unit: 'BOX', size: '225G', pcs_per_box: 36, latest_unit_cost: 2196.00, current_qty: 0, low_stock_threshold: 5, created_at: now, updated_at: now },
    { sku_code: '5009', name: 'Funtastyk Longganisa FW x 25', category: 'Longganisa', unit: 'BOX', size: '240G', pcs_per_box: 25, latest_unit_cost: 1850.00, current_qty: 0, low_stock_threshold: 5, created_at: now, updated_at: now },
    { sku_code: '3912', name: 'Holiday Pork Siomai x 18', category: 'Siomai', unit: 'BOX', size: '240G', pcs_per_box: 18, latest_unit_cost: 756.00, current_qty: 0, low_stock_threshold: 5, created_at: now, updated_at: now },
    { sku_code: '3913', name: 'Hol. Pork Siomai x9', category: 'Siomai', unit: 'BOX', size: '960G', pcs_per_box: 9, latest_unit_cost: 1269.00, current_qty: 0, low_stock_threshold: 5, created_at: now, updated_at: now },
    { sku_code: '4292', name: 'Hol. Chicken Siomai x9', category: 'Siomai', unit: 'BOX', size: '960G', pcs_per_box: 9, latest_unit_cost: 1269.00, current_qty: 0, low_stock_threshold: 5, created_at: now, updated_at: now },
    { sku_code: '4721', name: 'CDO Chicken Cripy Burger', category: 'Burger', unit: 'BOX', size: '228G', pcs_per_box: 20, latest_unit_cost: 1144.50, current_qty: 0, low_stock_threshold: 5, created_at: now, updated_at: now },
    { sku_code: '4395', name: 'CDO Crispy Burger x 21', category: 'Burger', unit: 'BOX', size: '228G', pcs_per_box: 21, latest_unit_cost: 1123.50, current_qty: 0, low_stock_threshold: 5, created_at: now, updated_at: now },
    { sku_code: '4979', name: 'Holiday Beef Siomai x 9', category: 'Siomai', unit: 'BOX', size: '960G', pcs_per_box: 9, latest_unit_cost: 1269.00, current_qty: 0, low_stock_threshold: 5, created_at: now, updated_at: now },
    { sku_code: '4455', name: 'Ulam Burger C-A-P Reg.', category: 'Burger', unit: 'BOX', size: '912G', pcs_per_box: 20, latest_unit_cost: 1588.00, current_qty: 0, low_stock_threshold: 5, created_at: now, updated_at: now },
    { sku_code: '403', name: 'Ulam Burger Reg. Bulkpack', category: 'Burger', unit: 'BOX', size: '3.04KG', pcs_per_box: 1, latest_unit_cost: 640.00, current_qty: 0, low_stock_threshold: 5, created_at: now, updated_at: now },
    { sku_code: '5409', name: 'Savers Sweet Ham', category: 'Ham', unit: 'BOX', size: '250G', pcs_per_box: 24, latest_unit_cost: 1760.00, current_qty: 0, low_stock_threshold: 5, created_at: now, updated_at: now },
  ];

  const itemIds = await db.items.bulkAdd(itemsData, { allKeys: true });

  // Seed Aliases
  itemsData.forEach((item, idx) => {
    db.supplierItemCodes.add({
      item_id: itemIds[idx],
      supplier_name: 'CDO / Holiday / Funtastyk Supplier',
      supplier_code: item.sku_code,
      created_at: now,
    });
  });

  // Seed Clients
  await db.clients.bulkAdd([
    { name: 'Kiko Meat Retail Shop (Main)', contact_info: '0917-555-0192', address: 'Market Stall #14', created_at: now },
    { name: 'Aling Nena Store', contact_info: '0918-444-9921', address: 'Brgy 5 Poblacion', created_at: now },
    { name: 'Sizzling Grill Carinderia', contact_info: '0922-888-3312', address: 'Arcade Unit 3', created_at: now },
  ]);
}
