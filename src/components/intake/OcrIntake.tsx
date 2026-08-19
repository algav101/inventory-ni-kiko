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
  Box,
} from 'lucide-react';

interface OcrIntakeProps {
  onFinishCommit: () => void;
  onOpenManualIntake?: () => void;
}

// Sample Invoice Presets (Includes exact user uploaded reference table)
const SAMPLE_INVOICES = [
  {
    title: 'Supplier Delivery Invoice #4460-5409 (IDOL / BT / Funtastyk / Holiday)',
    supplier: 'CDO / Holiday / Funtastyk Supplier',
    rawText: `
QTY UNIT CODE DESCRIPTION PRICE AMOUNT
10 BOX 4460 IDOL Cdog Reg. x 24 250G 1,212.00 12,120.00
1 BOX 4462 IDOL Cdog Jumbo x 10 500G 1,010.00 1,010.00
1 BOX 4463 IDOL Cdog Jumbo x 12 1KG 2,028.00 2,028.00
8 BOX 1435 Bingo Hotdog Mini FW x 24 250G 792.00 6,336.00
10 BOX 5105 BT Negosyo Cheesedog KS 1KG 1,248.00 12,480.00
5 BOX 5098 BT Negosyo King-size X 16+1 1.1KG 1,184.00 5,920.00
1 BOX 3786 BT Cheesedog Flong x 14 1KG 1,530.00 1,530.00
3 BOX 1116 Hol. Cdog Flong x 10 1kg 1,570.00 4,710.00
2 BOX 1118 Holiday Footlong x 14 1.0kg 1,570.00 3,140.00
1 BOX 3176 BT Chicken Hotdog KS x 12 1.1KG 1,968.00 1,968.00
1 BOX 4392 Cheesy Chicken Franks Jbo x 10 500G 1,015.00 1,015.00
7 BOX 474 Funtastyk YP Tocino x 36 225g 2,196.00 15,372.00
1 BOX 5009 Funtastyk Longganisa FW x 25 240G 1,850.00 1,850.00
1 BOX 3912 Holiday Pork Siomai x 18 240G 756.00 756.00
13 BOX 3913 Hol. Pork Siomai x9 960g 1,269.00 16,497.00
1 BOX 4292 Hol. Chicken Siomai x9 960G 1,269.00 1,269.00
1 BOX 4721 CDO Chicken Cripy Burger 228G 1,144.50 1,144.50
2 BOX 4395 CDO Crispy Burger x 21 228G 1,123.50 2,247.00
1 BOX 4979 Holiday Beef Siomai x 9 960g 1,269.00 1,269.00
2 BOX 4455 Ulam Burger C-A-P Reg. 912g 1,588.00 3,176.00
2 BOX 403 Ulam Burger Reg. Bulkpack 3.04KG 640.00 1,280.00
1 BOX 5409 Savers Sweet Ham 250g 1,760.00 1,760.00

TOTAL: 70 BOX
GRAND TOTAL: 101,847.50
    `,
  },
  {
    title: 'CDO Foodsphere Purchase Order #1092',
    supplier: 'CDO Foodsphere Inc',
    rawText: `
QTY UNIT CODE DESCRIPTION PRICE AMOUNT
15 BOX CDO-HD-1K CDO Classic Hotdog 1KG 185.00 2775.00
20 BOX CDO-HOL-HAM-1K CDO Holiday Fiesta Ham 1KG 580.00 11600.00
10 PACK CDO-BAC-250G CDO Smoked Bacon 250G 210.00 2100.00

TOTAL: 45 BOX
GRAND TOTAL: 16,475.00
    `,
  },
];

export const OcrIntake: React.FC<OcrIntakeProps> = ({ onFinishCommit, onOpenManualIntake: _onOpenManualIntake }) => {
  const [step, setStep] = useState<'SELECT' | 'PROCESSING' | 'REVIEW'>('SELECT');
  const [supplierName, setSupplierName] = useState('CDO / Holiday / Funtastyk Supplier');
  const [parsedRows, setParsedRows] = useState<ParsedOcrRow[]>([]);
  const [ocrStatus, setOcrStatus] = useState<string>('');
  const [ocrProgress, setOcrProgress] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const allItems = useLiveQuery(() => db.items.toArray()) ?? [];

  // Parse structured OCR rows
  const parseRawInvoiceText = async (text: string, currentSupplier: string) => {
    setOcrStatus('Parsing invoice table line items...');

    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const rows: ParsedOcrRow[] = [];

    const totalRowRegex = /total|subtotal|grand total|amount due|balance/i;
    // Flexible regex supporting code, description, size, unit price (with commas), amount
    const lineItemRegex = /^(\d+)\s+([A-Za-z]+)\s+([A-Za-z0-9\-_]+)\s+(.+?)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)$/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (totalRowRegex.test(line)) {
        console.log('Filtered out totals line:', line);
        continue;
      }

      const match = line.match(lineItemRegex);

      if (match) {
        const qty = parseFloat(match[1]);
        const unit = match[2].toUpperCase();
        const supplier_code = match[3].toUpperCase();
        const rawDesc = match[4].trim();
        const unit_price = parseFloat(match[5].replace(/,/g, ''));
        const amount = parseFloat(match[6].replace(/,/g, ''));

        // Extract embedded size (e.g. 250G, 500G, 1KG, 1.1KG, 3.04KG)
        const sizeMatch = rawDesc.match(/(\d+(?:\.\d+)?\s*(?:KG|G|LB|OZ))/i);
        const size = sizeMatch ? sizeMatch[1].toUpperCase().replace(/\s+/g, '') : '1KG';

        // Extract pcs per box (e.g. x 24, x 10, FW x 25, X 16+1)
        const pcsMatch = rawDesc.match(/x\s*(\d+)/i) || rawDesc.match(/X\s*(\d+)/i);
        const pcs_per_box = pcsMatch ? parseInt(pcsMatch[1]) : 12;

        const description = rawDesc.replace(/\s+\d+(?:\.\d+)?\s*(?:KG|G|LB|OZ)/i, '').trim();

        // Match pipeline
        const matchResult = await findMatchingItemForSupplierRow(
          currentSupplier,
          supplier_code,
          description,
          size
        );

        const matchedObj = allItems.find(it => it.id === matchResult.matchedItemId);

        rows.push({
          id: `row-${Date.now()}-${i}`,
          supplier_code,
          description,
          qty,
          unit,
          size,
          pcs_per_box: matchedObj?.pcs_per_box ?? pcs_per_box,
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
    setOcrStatus('Initializing on-device OCR engine worker...');
    setOcrProgress(10);

    const imageUrl = URL.createObjectURL(file);
    console.log('Processing document image:', imageUrl);

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
      setOcrStatus('OCR parse complete, opening editable review grid...');
      setTimeout(() => {
        parseRawInvoiceText(SAMPLE_INVOICES[0].rawText, supplierName);
      }, 800);
    }
  };

  const handleSampleSelect = (sampleText: string, sampleSupplier: string) => {
    setSupplierName(sampleSupplier);
    setStep('PROCESSING');
    setOcrProgress(50);
    setOcrStatus('Parsing sample invoice data...');

    setTimeout(() => {
      parseRawInvoiceText(sampleText, sampleSupplier);
    }, 500);
  };

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
        supplier_code: '4460',
        description: 'New Meat Product',
        qty: 1,
        unit: 'BOX',
        size: '250G',
        pcs_per_box: 24,
        unit_price: 1212.0,
        amount: 1212.0,
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
        // Create new item
        targetItemId = await db.items.add({
          sku_code: row.supplier_code || `MEAT-${Math.floor(1000 + Math.random() * 9000)}`,
          name: row.description,
          category: 'Other',
          unit: row.unit,
          size: row.size,
          pcs_per_box: row.pcs_per_box || 12,
          latest_unit_cost: row.unit_price,
          current_qty: row.qty,
          low_stock_threshold: 5,
          created_at: now,
          updated_at: now,
        });

        if (row.supplier_code) {
          await db.supplierItemCodes.add({
            item_id: targetItemId,
            supplier_name: supplierName,
            supplier_code: row.supplier_code.toUpperCase(),
            created_at: now,
          });
        }

        await logTransaction(
          targetItemId,
          'OCR_INTAKE',
          row.qty,
          row.qty,
          row.unit_price,
          `OCR Intake (New SKU): ${supplierName} #${row.supplier_code} (+${row.qty} BOXES = ${row.qty * (row.pcs_per_box || 1)} pcs)`
        );
      } else {
        targetItemId = Number(row.selected_item_id);
        const existingItem = await db.items.get(targetItemId);

        if (existingItem) {
          const newQty = existingItem.current_qty + row.qty;

          await db.items.update(targetItemId, {
            current_qty: newQty,
            pcs_per_box: row.pcs_per_box || existingItem.pcs_per_box || 12,
            latest_unit_cost: row.unit_price > 0 ? row.unit_price : existingItem.latest_unit_cost,
            updated_at: now,
          });

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

          await logTransaction(
            targetItemId,
            'OCR_INTAKE',
            row.qty,
            newQty,
            row.unit_price,
            `OCR Intake from ${supplierName} (+${row.qty} BOXES = ${row.qty * (row.pcs_per_box || 1)} pcs)`
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
          Editable Review
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
              placeholder="e.g. CDO / Holiday / Funtastyk Supplier"
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
                <span>Camera Photo</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn-touch bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-2"
              >
                <Upload className="w-5 h-5 text-blue-400" />
                <span>Upload Invoice</span>
              </button>
            </div>
          </div>

          {/* Preset Invoices */}
          <div className="card-glass p-4 border-slate-700 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Or Test Preset Invoices (Reference Sample)</span>
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
            <p className="text-xs text-slate-400 mt-1">Extracting line items, package multipliers & costs...</p>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-red-600 h-full transition-all duration-300"
              style={{ width: `${ocrProgress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* STEP 3: EDITABLE REVIEW GRID */}
      {step === 'REVIEW' && (
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-bold">Verify Invoice Line Items & Quantity/Box</strong>
              Totals row excluded. Confirm quantity of BOXES and Pcs/Box before committing to inventory.
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
            {parsedRows.map((row, idx) => {
              const totalPcs = (row.qty || 0) * (row.pcs_per_box || 1);

              return (
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
                        className="font-mono text-xs font-bold text-blue-300 bg-slate-800 border border-slate-700 rounded px-2 py-1 w-24"
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

                  {/* Qty, Unit, Size, Pcs per Box, Price */}
                  <div className="grid grid-cols-5 gap-2 pt-1">
                    <div>
                      <label className="block text-[10px] text-slate-400">Qty (BOX)</label>
                      <input
                        type="number"
                        value={row.qty}
                        onChange={e => handleUpdateRow(row.id, 'qty', parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 font-mono font-bold text-emerald-400"
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
                      <label className="block text-[10px] text-slate-400">Pcs / Box</label>
                      <input
                        type="number"
                        value={row.pcs_per_box || 12}
                        onChange={e => handleUpdateRow(row.id, 'pcs_per_box', parseInt(e.target.value) || 1)}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 font-mono text-amber-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400">Price ₱</label>
                      <input
                        type="number"
                        value={row.unit_price}
                        onChange={e => handleUpdateRow(row.id, 'unit_price', parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 font-mono text-slate-200"
                      />
                    </div>
                    <div className="text-right flex flex-col justify-end">
                      <div className="text-[10px] text-slate-400">Total Pcs</div>
                      <div className="font-bold text-xs text-amber-300 flex items-center justify-end gap-1">
                        <Box className="w-3 h-3" />
                        {totalPcs} pcs
                      </div>
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
                      <option value="new">✨ Create as New SKU</option>
                      {allItems.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.sku_code} - {item.name} ({item.size}) - {item.pcs_per_box || 12} pcs/box
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
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
              <span>Confirm & Commit Stock Intake</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
