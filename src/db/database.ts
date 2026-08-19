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

    // Define tables & indices
    this.version(1).stores({
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
          matchReason: `Matched supplier code "${supplierCode}" to ${item.name} (${item.size})`,
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

    let score = 0;
    // Check key product words
    if (normalizedRawDesc.includes(itemNameNorm) || itemNameNorm.includes(normalizedRawDesc)) {
      score += 50;
    }

    // Check size match
    if (normalizedSize && (normalizedSize === itemSizeNorm || normalizedRawDesc.includes(itemSizeNorm))) {
      score += 40;
    }

    // Partial word overlap
    const rawTokens = rawDescription.toLowerCase().split(/\s+/);
    const itemTokens = item.name.toLowerCase().split(/\s+/);
    const matches = rawTokens.filter(t => t.length > 2 && itemTokens.some(it => it.includes(t) || t.includes(it)));
    score += matches.length * 10;

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

// Seed Initial Data (Processed Meat Inventory)
export async function seedDatabaseIfEmpty() {
  const count = await db.items.count();
  if (count > 0) return;

  const now = new Date().toISOString();

  // Initial Items
  const itemsData: Omit<Item, 'id'>[] = [
    {
      sku_code: 'MEAT-HD-001',
      name: 'CDO Classic Hotdog',
      category: 'Hotdog',
      unit: 'BOX',
      size: '1KG',
      latest_unit_cost: 185.00,
      current_qty: 42,
      low_stock_threshold: 15,
      created_at: now,
      updated_at: now,
    },
    {
      sku_code: 'MEAT-HD-002',
      name: 'Purefoods Tender Juicy Jumbo Hotdog',
      category: 'Hotdog',
      unit: 'BOX',
      size: '1KG',
      latest_unit_cost: 240.00,
      current_qty: 12, // Low stock
      low_stock_threshold: 20,
      created_at: now,
      updated_at: now,
    },
    {
      sku_code: 'MEAT-TOC-001',
      name: 'Pampanga\'s Best Sweet Pork Tocino',
      category: 'Tocino',
      unit: 'PACK',
      size: '450G',
      latest_unit_cost: 165.00,
      current_qty: 35,
      low_stock_threshold: 10,
      created_at: now,
      updated_at: now,
    },
    {
      sku_code: 'MEAT-LONG-001',
      name: 'Mekeni Garlic Skinless Longganisa',
      category: 'Longganisa',
      unit: 'PACK',
      size: '500G',
      latest_unit_cost: 145.00,
      current_qty: 28,
      low_stock_threshold: 10,
      created_at: now,
      updated_at: now,
    },
    {
      sku_code: 'MEAT-BAC-001',
      name: 'King Sue Smoked Bacon Slices',
      category: 'Bacon',
      unit: 'PACK',
      size: '250G',
      latest_unit_cost: 210.00,
      current_qty: 8, // Low stock
      low_stock_threshold: 15,
      created_at: now,
      updated_at: now,
    },
    {
      sku_code: 'MEAT-HAM-001',
      name: 'CDO Holiday Fiesta Ham',
      category: 'Ham',
      unit: 'BOX',
      size: '1KG',
      latest_unit_cost: 580.00,
      current_qty: 18,
      low_stock_threshold: 5,
      created_at: now,
      updated_at: now,
    },
    {
      sku_code: 'MEAT-SAU-001',
      name: 'Virginia Hungarian Sausage',
      category: 'Sausage',
      unit: 'PACK',
      size: '500G',
      latest_unit_cost: 225.00,
      current_qty: 25,
      low_stock_threshold: 10,
      created_at: now,
      updated_at: now,
    },
  ];

  const itemIds = await db.items.bulkAdd(itemsData, { allKeys: true });

  // Seed Supplier Codes (Alias table)
  await db.supplierItemCodes.bulkAdd([
    { item_id: itemIds[0], supplier_name: 'CDO Foodsphere Inc', supplier_code: 'CDO-HD-1K', created_at: now },
    { item_id: itemIds[1], supplier_name: 'San Miguel Foods', supplier_code: 'PF-TJ-JMB-1K', created_at: now },
    { item_id: itemIds[2], supplier_name: 'Pampanga Best Supplier', supplier_code: 'PB-TOC-SW-450', created_at: now },
    { item_id: itemIds[3], supplier_name: 'Mekeni Food Corp', supplier_code: 'MEK-LONG-GAR-500', created_at: now },
  ]);

  // Seed Clients
  const clientIds = await db.clients.bulkAdd([
    { name: 'Kiko Meat Retail Shop (Main Branch)', contact_info: '0917-555-0192', address: 'Public Market Stall #14', created_at: now },
    { name: 'Aling Nena Store & Carinderia', contact_info: '0918-444-9921', address: 'Brgy 5, Poblacion', created_at: now },
    { name: 'Sizzling Grill Restaurant', contact_info: '0922-888-3312', address: 'Commercial Arcade Unit 3', created_at: now },
  ], { allKeys: true });

  // Seed Initial Audit Transactions
  await db.transactions.bulkAdd([
    { item_id: itemIds[0], item_name: 'CDO Classic Hotdog (1KG)', type: 'MANUAL_INTAKE', qty_delta: 42, resulting_qty: 42, unit_cost_at_transaction: 185.00, reason: 'Initial inventory setup', created_at: now },
    { item_id: itemIds[1], item_name: 'Purefoods Tender Juicy Jumbo Hotdog (1KG)', type: 'MANUAL_INTAKE', qty_delta: 12, resulting_qty: 12, unit_cost_at_transaction: 240.00, reason: 'Initial inventory setup', created_at: now },
    { item_id: itemIds[2], item_name: 'Pampanga\'s Best Sweet Pork Tocino (450G)', type: 'MANUAL_INTAKE', qty_delta: 35, resulting_qty: 35, unit_cost_at_transaction: 165.00, reason: 'Initial inventory setup', created_at: now },
  ]);

  // Seed Back Order
  await db.backOrders.add({
    item_id: itemIds[1],
    item_name: 'Purefoods Tender Juicy Jumbo Hotdog (1KG)',
    client_id: clientIds[1],
    client_name: 'Aling Nena Store & Carinderia',
    qty: 10,
    remarks: 'Awaiting supplier restocking',
    status: 'OPEN',
    created_at: now,
  });

  // Seed Delivery Plan
  const planId = await db.deliveryPlans.add({
    client_id: clientIds[0],
    client_name: 'Kiko Meat Retail Shop (Main Branch)',
    delivery_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    status: 'SCHEDULED',
    notes: 'Morning delivery before 10 AM',
    created_at: now,
  });

  await db.deliveryLineItems.bulkAdd([
    { delivery_plan_id: planId, item_id: itemIds[0], item_name: 'CDO Classic Hotdog (1KG)', unit: 'BOX', qty_planned: 5, qty_delivered: 0 },
    { delivery_plan_id: planId, item_id: itemIds[2], item_name: 'Pampanga\'s Best Sweet Pork Tocino (450G)', unit: 'PACK', qty_planned: 4, qty_delivered: 0 },
  ]);
}
