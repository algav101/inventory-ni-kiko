export type MeatCategory = 'Hotdog' | 'Tocino' | 'Longganisa' | 'Ham' | 'Bacon' | 'Sausage' | 'Other';

export interface Item {
  id?: number;
  sku_code: string; // Internal stable SKU e.g. "MEAT-HD-001"
  name: string;
  category: MeatCategory;
  unit: string; // e.g. "BOX", "PACK", "KG"
  size: string; // e.g. "1KG", "500G", "250G", "450G"
  latest_unit_cost: number | null;
  current_qty: number;
  low_stock_threshold: number;
  created_at: string;
  updated_at: string;
}

export interface SupplierItemCode {
  id?: number;
  item_id: number;
  supplier_name: string;
  supplier_code: string; // Printed code on supplier invoice e.g. "CDO-HD-1K"
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
  source_reference?: string | null; // delivery_id / bo_id / invoice_num
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
  created_at: string;
  confirmed_at?: string | null;
}

export interface DeliveryLineItem {
  id?: number;
  delivery_plan_id: number;
  item_id: number;
  item_name?: string;
  unit?: string;
  qty_planned: number;
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
  unit_price: number;
  amount: number;
  matched_item_id?: number | null;
  match_confidence: 'exact_code' | 'fuzzy_desc' | 'none';
  match_reason?: string;
  is_new_item?: boolean;
  selected_item_id?: number | 'new' | null;
}
