export type MeatCategory = 'Hotdog' | 'Tocino' | 'Longganisa' | 'Ham' | 'Bacon' | 'Sausage' | 'Siomai' | 'Burger' | 'Other';

export interface StockLocationQty {
  location_name: string; // e.g. "Freezer 1", "Freezer 2", "Day Delivery Temp Store", "Display Freezer"
  qty: number;
}

export interface Item {
  id?: number;
  sku_code: string; // Internal stable SKU e.g. "MEAT-HD-001" or supplier code "4460"
  name: string;
  category: MeatCategory;
  unit: string; // e.g. "BOX", "PACK", "KG"
  size: string; // e.g. "1KG", "500G", "250G", "450G"
  pcs_per_box?: number; // e.g. 24, 10, 12, 36 (packs/pcs inside 1 box)
  latest_unit_cost: number | null;
  current_qty: number; // Total Quantity in BOXES or primary unit across all freezers
  stock_locations?: StockLocationQty[];
  low_stock_threshold: number;
  created_at: string;
  updated_at: string;
}

export interface SupplierItemCode {
  id?: number;
  item_id: number;
  supplier_name: string;
  supplier_code: string; // Printed code on supplier invoice e.g. "4460", "5105"
  created_at: string;
}

export type TransactionType =
  | 'OCR_INTAKE'
  | 'MANUAL_INTAKE'
  | 'DELIVERY_DEDUCTION'
  | 'BO_FULFILLMENT'
  | 'STOCK_ADD'
  | 'STOCK_RESET'
  | 'MANUAL_CORRECTION';

export interface InventoryTransaction {
  id?: number;
  item_id: number;
  item_name?: string;
  type: TransactionType;
  qty_delta: number;
  resulting_qty: number;
  unit_cost_at_transaction: number | null;
  reason: string;
  source_reference?: string | null;
  created_by?: string;
  created_at: string;
}

export interface Client {
  id?: number;
  name: string;
  contact_info?: string;
  address?: string;
  created_at: string;
}

export type DeliveryStatus = 'DRAFT' | 'SCHEDULED' | 'DELIVERED' | 'CANCELLED';

export interface DeliveryPlan {
  id?: number;
  client_id: number;
  client_name?: string;
  delivery_date: string;
  status: DeliveryStatus;
  notes?: string;
  total_amount?: number;
  created_at: string;
  confirmed_at?: string | null;
}

export interface DeliveryLineItem {
  id?: number;
  delivery_plan_id: number;
  item_id: number;
  item_name?: string;
  unit?: string;
  pcs_per_box?: number;
  qty_planned: number;
  qty_type?: 'BOX' | 'PCS';
  unit_price?: number | null;
  price_type?: 'PER_BOX' | 'PER_PC';
  total_price?: number;
  qty_delivered: number;
}

export type BackOrderStatus = 'OPEN' | 'FULFILLED' | 'CANCELLED';

export interface BackOrder {
  id?: number;
  item_id: number;
  item_name?: string;
  client_id: number;
  client_name?: string;
  qty: number;
  pcs_per_box?: number;
  remarks: string;
  status: BackOrderStatus;
  created_at: string;
  fulfilled_at?: string | null;
  linked_delivery_id?: number | null;
}

export interface ParsedOcrRow {
  id: string;
  supplier_code: string;
  description: string;
  qty: number;
  unit: string;
  size: string;
  pcs_per_box?: number;
  unit_price: number;
  amount: number;
  matched_item_id?: number | null;
  match_confidence: 'exact_code' | 'fuzzy_desc' | 'none';
  match_reason?: string;
  is_new_item?: boolean;
  selected_item_id?: number | 'new' | null;
}
