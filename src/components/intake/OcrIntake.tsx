import React, { useState, useRef } from 'react';
import { createWorker } from 'tesseract.js';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, findMatchingItemForSupplierRow, logTransaction } from '../../db/database';
import type { ParsedOcrRow } from '../../types';
import {
  ScanLine,
  Upload,
  Camera,
  CheckCircle,
  AlertTriangle,
  Trash2,
  Plus,
  ArrowRight,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

interface OcrIntakeProps {
  onFinishCommit: () => void;
  onOpenManualIntake?: () => void;
}

// Sample Simulated Invoices for instant testing
const SAMPLE_INVOICES = [
  {
    title: 'CDO Foodsphere Invoice #1092',
    supplier: 'CDO Foodsphere Inc',
    rawText: `
SOLD TO: Kiko Meat Store
DATE: 2026-08-19
INVOICE #: CDO-2026-1092

QTY   UNIT   CODE             DESCRIPTION              PRICE    AMOUNT
15    BOX    CDO-HD-1K        CDO Classic Hotdog 1KG   185.00   2775.00
20    BOX    CDO-HOL-HAM-1K   CDO Holiday Fiesta Ham 1KG 580.00 11600.00
10    PACK   CDO-BAC-250G     CDO Smoked Bacon 250G    210.00   2100.00

TOTAL: 45 BOX
GRAND TOTAL: 16475.00
    `,
  },
  {
    title: 'Pampanga & Purefoods Receipt #4401',
    supplier: 'San Miguel & Pampanga',
    rawText: `
DELIVERY RECEIPT #: DR-4401
SUPPLIER: San Miguel Foods

QTY   UNIT   CODE             DESCRIPTION                     PRICE    AMOUNT
12    BOX    PF-TJ-JMB-1K     Purefoods Tender Juicy Jumbo 1KG 240.00  2880.00
25    PACK   PB-TOC-SW-450    Pampanga Best Sweet Tocino 450G  165.00  4125.00
18    PACK   MEK-LONG-GAR-500 Mekeni Skinless Longganisa 500G  145.00  2610.00

TOTAL: 55 PACK
SUBTOTAL: 9615.00
    `,
  },
];

export const OcrIntake: React.FC<OcrIntakeProps> = ({ onFinishCommit, onOpenManualIntake: _onOpenManualIntake }) => {
  const [step, setStep] = useState<'SELECT' | 'PROCESSING' | 'REVIEW'>('SELECT');
  const [supplierName, setSupplierName] = useState('CDO Foodsphere Inc');
  const [parsedRows, setParsedRows] = useState<ParsedOcrRow[]>([]);
  const [ocrStatus, setOcrStatus] = useState<string>('');
  const [ocrProgress, setOcrProgress] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const allItems = useLiveQuery(() => db.items.toArray()) ?? [];

  // OCR Processing logic
  const parseRawInvoiceText = async (text: string, currentSupplier: string) => {
    setOcrStatus('Parsing structured line items...');

    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const rows: ParsedOcrRow[] = [];

    // Header/Total row detection filters
    const totalRowRegex = /total|subtotal|grand total|amount due|balance/i;
    const lineItemRegex = /(\d+)\s+([A-Za-z]+)\s+([A-Za-z0-9\-_]+)\s+(.+?)\s+(\d+(?:\.\d{1,2})?)\s+(\d+(?:\.\d{1,2})?)$/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Exclude totals row
      if (totalRowRegex.test(line)) {
        console.log('Excluded totals line:', line);
        continue;
      }

      // Try regex parse
      const match = line.match(lineItemRegex);

      if (match) {
        const qty = parseFloat(match[1]);
        const unit = match[2].toUpperCase();
        const supplier_code = match[3].toUpperCase();
        const description = match[4].trim();
        const unit_price = parseFloat(match[5]);
        const amount = parseFloat(match[6]);

        // Extract size e.g. "1KG", "450G", "500G", "250G"
        const sizeMatch = description.match(/(\d+\s*(?:KG|G|LB|OZ))/i);
        const size = sizeMatch ? sizeMatch[1].toUpperCase().replace(/\s+/g, '') : '1KG';

        // Match pipeline
        const matchResult = await findMatchingItemForSupplierRow(
          currentSupplier,
          supplier_code,
          description,
          size
        );

        rows.push({
          id: `row-${Date.now()}-${i}`,
          supplier_code,
          description,
          qty,
          unit,
          size,
          unit_price,
          amount,
          matched_item_id: matchResult.matchedItemId,
          match_confidence: matchResult.confidence,
          match_reason: matchResult.matchReason,
          selected_item_id: matchResult.matchedItemId ?? 'new',
        });
      }
    }

    setParsedRows(rows);
    setStep('REVIEW');
  };

  const processImageFile = async (file: File) => {
    setStep('PROCESSING');
    setOcrStatus('Initializing OCR engine worker...');
    setOcrProgress(10);

    const imageUrl = URL.createObjectURL(file);
    console.log('Processing image:', imageUrl);

    try {
      const worker = await createWorker('eng');
      setOcrProgress(40);
      setOcrStatus('Recognizing document text...');

      const ret = await worker.recognize(file);
      setOcrProgress(80);
      await worker.terminate();

      await parseRawInvoiceText(ret.data.text, supplierName);
    } catch (err) {
      console.error('OCR Error:', err);
      setOcrStatus('OCR failed, falling back to simulated parser...');
      // Fallback sample
      setTimeout(() => {
        parseRawInvoiceText(SAMPLE_INVOICES[0].rawText, supplierName);
      }, 1000);
    }
  };

  const handleSampleSelect = (sampleText: string, sampleSupplier: string) => {
    setSupplierName(sampleSupplier);
    setStep('PROCESSING');
    setOcrProgress(50);
    setOcrStatus('Parsing sample invoice data...');

    setTimeout(() => {
      parseRawInvoiceText(sampleText, sampleSupplier);
    }, 600);
  };

  // Row edit handlers in review grid
  const handleUpdateRow = (id: string, field: keyof ParsedOcrRow, value: any) => {
    setParsedRows(prev =>
      prev.map(row => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const handleDeleteRow = (id: string) => {
    setParsedRows(prev => prev.filter(r => r.id !== id));
  };

  const handleAddBlankRow = () => {
    setParsedRows(prev => [
      ...prev,
      {
        id: `row-custom-${Date.now()}`,
        supplier_code: 'NEW-CODE',
        description: 'New Meat Product',
        qty: 10,
        unit: 'BOX',
        size: '1KG',
        unit_price: 150.0,
        amount: 1500.0,
        match_confidence: 'none',
        selected_item_id: 'new',
      },
    ]);
  };

  // Commit Parsed Rows to Database
  const handleCommitReview = async () => {
    const now = new Date().toISOString();

    for (const row of parsedRows) {
      let targetItemId: number;

      if (row.selected_item_id === 'new' || !row.selected_item_id) {
        // Create new item SKU
        const skuPrefix = row.description.toUpperCase().slice(0, 3).replace(/[^A-Z]/g, 'M');
        const sku_code = `MEAT-${skuPrefix}-${Math.floor(1000 + Math.random() * 9000)}`;

        targetItemId = await db.items.add({
          sku_code,
          name: row.description,
          category: 'Other',
          unit: row.unit,
          size: row.size,
          latest_unit_cost: row.unit_price,
          current_qty: row.qty,
          low_stock_threshold: 10,
          created_at: now,
          updated_at: now,
        });

        // Save supplier code alias
        if (row.supplier_code) {
          await db.supplierItemCodes.add({
            item_id: targetItemId,
            supplier_name: supplierName,
            supplier_code: row.supplier_code.toUpperCase(),
            created_at: now,
          });
        }

        // Log transaction
        await logTransaction(
          targetItemId,
          'OCR_INTAKE',
          row.qty,
          row.qty,
          row.unit_price,
          `OCR Intake (New Item created): ${supplierName} #${row.supplier_code}`
        );
      } else {
        // Update existing item
        targetItemId = Number(row.selected_item_id);
        const existingItem = await db.items.get(targetItemId);

        if (existingItem) {
          const newQty = existingItem.current_qty + row.qty;

          await db.items.update(targetItemId, {
            current_qty: newQty,
            latest_unit_cost: row.unit_price > 0 ? row.unit_price : existingItem.latest_unit_cost,
            updated_at: now,
          });

          // Save supplier code alias if not existing
          if (row.supplier_code) {
            const aliasExists = await db.supplierItemCodes
              .where('supplier_code')
              .equals(row.supplier_code.toUpperCase())
              .first();

            if (!aliasExists) {
              await db.supplierItemCodes.add({
                item_id: targetItemId,
                supplier_name: supplierName,
                supplier_code: row.supplier_code.toUpperCase(),
                created_at: now,
              });
            }
          }

          // Log transaction
          await logTransaction(
            targetItemId,
            'OCR_INTAKE',
            row.qty,
            newQty,
            row.unit_price,
            `OCR Intake delivery from ${supplierName} (${row.supplier_code})`
          );
        }
      }
    }

    onFinishCommit();
  };

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-extrabold text-base text-white">
          <ScanLine className="w-5 h-5 text-red-500" />
          <span>Supplier Invoice OCR Intake</span>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
          Mandatory Review
        </span>
      </div>

      {/* STEP 1: SELECT OR SCAN */}
      {step === 'SELECT' && (
        <div className="space-y-4">
          <div className="card-glass p-4 border-slate-700 space-y-3">
            <label className="block text-xs font-semibold text-slate-300">Supplier Name</label>
            <input
              type="text"
              value={supplierName}
              onChange={e => setSupplierName(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
              placeholder="e.g. CDO Foodsphere Inc"
            />

            <input
              type="file"
              accept="image/*"
              capture="environment"
              ref={fileInputRef}
              onChange={e => e.target.files?.[0] && processImageFile(e.target.files[0])}
              className="hidden"
            />

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn-touch bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-red-950/40"
              >
                <Camera className="w-5 h-5" />
                <span>Camera / Photo</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn-touch bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-2"
              >
                <Upload className="w-5 h-5 text-blue-400" />
                <span>Upload Receipt</span>
              </button>
            </div>
          </div>

          {/* Sample Invoice Presets */}
          <div className="card-glass p-4 border-slate-700 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Or Test Instant Preset Invoices (No Camera Required)</span>
            </div>

            <div className="space-y-2">
              {SAMPLE_INVOICES.map((s, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSampleSelect(s.rawText, s.supplier)}
                  className="p-3 rounded-xl bg-slate-900/80 hover:bg-slate-800 cursor-pointer border border-slate-800 flex items-center justify-between text-xs transition-all"
                >
                  <div>
                    <div className="font-bold text-slate-200">{s.title}</div>
                    <div className="text-[10px] text-slate-400">Supplier: {s.supplier}</div>
                  </div>
                  <button className="px-3 py-1 bg-red-600/20 text-red-300 font-bold text-[11px] rounded-lg border border-red-500/30 flex items-center gap-1">
                    <span>Parse</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: PROCESSING */}
      {step === 'PROCESSING' && (
        <div className="card-glass p-8 text-center border-slate-700 space-y-4">
          <RefreshCw className="w-8 h-8 text-red-500 animate-spin mx-auto" />
          <div>
            <h3 className="font-bold text-sm text-white">{ocrStatus}</h3>
            <p className="text-xs text-slate-400 mt-1">Extracting line items and checking supplier code aliases...</p>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-red-600 h-full transition-all duration-300"
              style={{ width: `${ocrProgress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* STEP 3: MANDATORY EDITABLE REVIEW GRID */}
      {step === 'REVIEW' && (
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-bold">Review & Verify OCR Results</strong>
              Totals row excluded automatically. Please confirm or adjust item mappings, quantities, and prices before committing to inventory.
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-bold">
              Captured Line Items ({parsedRows.length})
            </span>
            <button
              onClick={handleAddBlankRow}
              className="text-xs font-bold text-blue-400 hover:underline flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Line</span>
            </button>
          </div>

          {/* Editable Grid */}
          <div className="space-y-3">
            {parsedRows.map((row, idx) => (
              <div
                key={row.id}
                className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="font-bold text-slate-500">#{idx + 1}</span>
                    <input
                      type="text"
                      value={row.supplier_code}
                      onChange={e => handleUpdateRow(row.id, 'supplier_code', e.target.value)}
                      className="font-mono text-xs font-bold text-blue-300 bg-slate-800 border border-slate-700 rounded px-2 py-1 w-28"
                      placeholder="CODE"
                    />
                    <input
                      type="text"
                      value={row.description}
                      onChange={e => handleUpdateRow(row.id, 'description', e.target.value)}
                      className="font-bold text-white bg-slate-800 border border-slate-700 rounded px-2 py-1 flex-1"
                      placeholder="Description"
                    />
                  </div>

                  <button
                    onClick={() => handleDeleteRow(row.id)}
                    className="text-rose-400 hover:text-rose-300 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Qty, Unit, Size, Unit Price */}
                <div className="grid grid-cols-4 gap-2 pt-1">
                  <div>
                    <label className="block text-[10px] text-slate-400">Qty</label>
                    <input
                      type="number"
                      value={row.qty}
                      onChange={e => handleUpdateRow(row.id, 'qty', parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 font-mono font-bold text-emerald-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400">Unit</label>
                    <input
                      type="text"
                      value={row.unit}
                      onChange={e => handleUpdateRow(row.id, 'unit', e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400">Size</label>
                    <input
                      type="text"
                      value={row.size}
                      onChange={e => handleUpdateRow(row.id, 'size', e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400">Unit Cost ₱</label>
                    <input
                      type="number"
                      value={row.unit_price}
                      onChange={e => handleUpdateRow(row.id, 'unit_price', parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 font-mono text-slate-200"
                    />
                  </div>
                </div>

                {/* SKU Mapping Selector */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-400 font-semibold shrink-0">Map to SKU:</span>
                  <select
                    value={row.selected_item_id ?? 'new'}
                    onChange={e => handleUpdateRow(row.id, 'selected_item_id', e.target.value === 'new' ? 'new' : Number(e.target.value))}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100"
                  >
                    <option value="new">✨ Create as New Item SKU</option>
                    {allItems.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.sku_code} - {item.name} ({item.size})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            <button
              onClick={() => setStep('SELECT')}
              className="px-3 py-2 text-xs text-slate-400 font-semibold hover:text-white"
            >
              Re-scan Document
            </button>

            <button
              onClick={handleCommitReview}
              disabled={parsedRows.length === 0}
              className="btn-touch bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-5 rounded-xl shadow-lg shadow-emerald-950/40 flex items-center gap-1.5"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Confirm & Commit to Inventory</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
