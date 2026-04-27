'use client';

import { useState, useEffect } from 'react';
import { Trash2, Plus, AlertCircle } from 'lucide-react';

interface InvoiceFormProps {
  initialData?: any;
  customers: any[];
  invoices?: any[];
  onSave: (data: any) => Promise<void>;
  isSaving?: boolean;
}

export default function InvoiceForm({ initialData, customers, invoices, onSave, isSaving }: InvoiceFormProps) {
  const [form, setForm] = useState({
    invoiceNumber: '',
    customerId: '',
    type: 'simplified',
    documentType: '388',
    currency: 'SAR',
    originalInvoiceId: '',
    creditReason: '',
    items: [{ name: '', quantity: 1, unitPrice: 0, vatRate: 15, vatCategory: 'S' }],
  });

  useEffect(() => {
    if (initialData) {
      setForm({
        invoiceNumber: initialData.invoiceNumber || '',
        customerId: initialData.customerId || '',
        type: initialData.type || 'simplified',
        documentType: initialData.documentType || '388',
        currency: initialData.currency || 'SAR',
        originalInvoiceId: initialData.originalInvoiceId || '',
        creditReason: initialData.creditReason || '',
        items: initialData.items?.length > 0 ? initialData.items : [{ name: '', quantity: 1, unitPrice: 0, vatRate: 15, vatCategory: 'S' }],
      });
    }
  }, [initialData]);

  const addItem = () => {
    setForm(f => ({
      ...f,
      items: [...f.items, { name: '', quantity: 1, unitPrice: 0, vatRate: 15, vatCategory: 'S' }]
    }));
  };

  const removeItem = (index: number) => {
    if (form.items.length <= 1) return;
    setForm(f => ({
      ...f,
      items: f.items.filter((_, i) => i !== index)
    }));
  };

  const updateItem = (index: number, field: string, value: any) => {
    const nextItems = [...form.items];
    nextItems[index] = { ...nextItems[index], [field]: value };
    setForm(f => ({ ...f, items: nextItems }));
  };

  // Helper for "zero disappears" behavior
  const handleNumericFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (parseFloat(e.target.value) === 0) {
      e.target.value = '';
    }
  };

  const handleNumericBlur = (e: React.FocusEvent<HTMLInputElement>, index: number, field: string) => {
    if (e.target.value === '') {
      updateItem(index, field, 0);
    }
  };

  const totals = form.items.reduce((acc, item) => {
    const lineTotal = item.quantity * item.unitPrice;
    const lineVat = lineTotal * (item.vatRate / 100);
    return {
      total: acc.total + lineTotal + lineVat,
      vat: acc.vat + lineVat
    };
  }, { total: 0, vat: 0 });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  const handleParentInvoiceSelect = (parentId: string) => {
    const parent = invoices?.find(inv => inv.id === parentId);
    if (parent) {
      setForm(f => ({
        ...f,
        originalInvoiceId: parentId,
        customerId: parent.customerId || parent.customerSnapshot?.id || '',
        type: parent.type || 'simplified', // Match simplified/standard based on parent
        items: parent.items?.length > 0 ? parent.items : [{ name: '', quantity: 1, unitPrice: 0, vatRate: 15, vatCategory: 'S' }]
      }));
    } else {
      setForm(f => ({ ...f, originalInvoiceId: parentId }));
    }
  };

  const isCreditDebit = form.documentType === '381' || form.documentType === '383';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bank-form-group">
          <label className="bank-form-label uppercase tracking-tighter font-black text-gray-400 text-[10px]">Invoice Number</label>
          <input 
            className="input-pro bg-gray-100 text-gray-500 cursor-not-allowed" 
            value={initialData?.invoiceNumber || 'System Generated (ZATCA)'}
            disabled 
          />
        </div>
        <div className="bank-form-group">
          <label className="bank-form-label uppercase tracking-tighter font-black text-gray-400 text-[10px]">Type</label>
          <select 
            className="input-pro"
            value={form.documentType}
            onChange={e => setForm(f => ({ 
              ...f, 
              documentType: e.target.value,
              // If switching back to normal invoice, clear reason and parent
              ...(e.target.value === '388' && { originalInvoiceId: '', creditReason: '' })
            }))}
          >
            <option value="388">Tax Invoice</option>
            <option value="381">Credit Note</option>
            <option value="383">Debit Note</option>
          </select>
        </div>
        <div className="bank-form-group">
          <label className="bank-form-label uppercase tracking-tighter font-black text-gray-400 text-[10px]">Customer</label>
          <select 
            className="input-pro"
            value={form.customerId}
            onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}
            required
            disabled={isCreditDebit} // Disabled if it's auto-filled from parent
          >
            <option value="">Select Buyer...</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.registrationName} ({c.customerCode})</option>
            ))}
          </select>
        </div>
      </div>

      {isCreditDebit && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-amber-50/50 p-4 rounded-xl border border-amber-100/50">
          <div className="bank-form-group">
            <label className="bank-form-label uppercase tracking-tighter font-black text-amber-700 text-[10px]">Original Reference Invoice</label>
            <select 
              className="input-pro border-amber-200 focus:border-amber-400"
              value={form.originalInvoiceId}
              onChange={e => handleParentInvoiceSelect(e.target.value)}
              required
            >
              <option value="">Select an Approved/Cleared Invoice...</option>
              {invoices?.map(inv => (
                <option key={inv.id} value={inv.id}>{inv.invoiceNumber} - SAR {inv.totalAmount.toLocaleString()}</option>
              ))}
            </select>
          </div>
          <div className="bank-form-group">
            <label className="bank-form-label uppercase tracking-tighter font-black text-amber-700 text-[10px]">{form.documentType === '381' ? 'Credit' : 'Debit'} Reason</label>
            <input 
              className="input-pro border-amber-200 focus:border-amber-400" 
              placeholder={`Reason for ${form.documentType === '381' ? 'Credit' : 'Debit'} Note...`}
              value={form.creditReason}
              onChange={e => setForm(f => ({ ...f, creditReason: e.target.value }))}
              required 
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bank-form-group">
          <label className="bank-form-label uppercase tracking-tighter font-black text-gray-400 text-[10px]">Transaction Type</label>
          <select 
            className="input-pro"
            value={form.type}
            onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
          >
            <option value="simplified">Simplified (B2C)</option>
            <option value="standard">Standard (B2B)</option>
          </select>
        </div>
        <div className="col-span-2"></div>
      </div>

      <div className="card-pro overflow-hidden border-gray-100 shadow-sm bg-gray-50/20">
        <div className="grid grid-cols-12 gap-2 p-2 bg-gray-100/50 border-b border-gray-100">
          <div className="col-span-5 text-[9px] font-black uppercase text-gray-500 px-1">Description</div>
          <div className="col-span-2 text-[9px] font-black uppercase text-gray-500 px-1">Qty</div>
          <div className="col-span-2 text-[9px] font-black uppercase text-gray-500 px-1 text-right">Unit Price</div>
          <div className="col-span-2 text-[9px] font-black uppercase text-gray-500 px-1 text-right">VAT %</div>
          <div className="col-span-1"></div>
        </div>

        <div className="p-1 space-y-1">
          {form.items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 group">
              <div className="col-span-5">
                <input 
                  className="input-pro h-8 text-[11px] bg-white border-transparent focus:border-blue-500/10" 
                  placeholder="Service or Product name..."
                  value={item.name}
                  onChange={e => updateItem(idx, 'name', e.target.value)}
                  required
                />
              </div>
              <div className="col-span-2">
                <input 
                  type="number"
                  className="input-pro h-8 text-[11px] bg-white border-transparent focus:border-blue-500/10" 
                  value={item.quantity === 0 ? '' : item.quantity}
                  onFocus={handleNumericFocus}
                  onBlur={e => handleNumericBlur(e, idx, 'quantity')}
                  onChange={e => {
                    const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                    if (val >= 0) updateItem(idx, 'quantity', val);
                  }}
                  min="1"
                  required
                />
              </div>
              <div className="col-span-2">
                <input 
                  type="number"
                  step="0.01"
                  className="input-pro h-8 text-[11px] bg-white border-transparent focus:border-blue-500/10 text-right" 
                  value={item.unitPrice === 0 ? '' : item.unitPrice}
                  onFocus={handleNumericFocus}
                  onBlur={e => handleNumericBlur(e, idx, 'unitPrice')}
                  onChange={e => {
                    const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                    if (val >= 0) updateItem(idx, 'unitPrice', val);
                  }}
                  required
                />
              </div>
              <div className="col-span-2">
                <div className="relative">
                  <input 
                    type="number"
                    className="input-pro h-8 text-[11px] bg-white border-transparent focus:border-blue-500/10 text-right pr-6" 
                    value={item.vatRate}
                    onChange={e => {
                      const val = parseFloat(e.target.value);
                      if (val >= 0 && val <= 100) updateItem(idx, 'vatRate', val);
                    }}
                    required
                  />
                  <span className="absolute right-2 top-2 text-[10px] text-gray-400">%</span>
                </div>
              </div>
              <div className="col-span-1 flex items-center justify-center">
                <button 
                  type="button"
                  onClick={() => removeItem(idx)}
                  className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
                  disabled={form.items.length <= 1}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
          <button 
            type="button" 
            onClick={addItem}
            className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase text-blue-600 hover:text-blue-700 bg-blue-50/50 px-2.5 py-1.5 rounded-lg border border-blue-100/50 transition-all"
          >
            <Plus size={12} />
            Add New Item
          </button>
          
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">VAT Amount</p>
              <p className="text-[13px] font-black text-gray-700">SAR {totals.vat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Total Payable</p>
              <p className="text-[15px] font-black text-blue-700">SAR {totals.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
        <AlertCircle size={14} className="text-blue-500 mt-0.5 shrink-0" />
        <p className="text-[10px] text-blue-800 leading-relaxed">
          <strong>Review Policy:</strong> Once saved as draft, you must submit it to the <strong>Checker</strong> for initial verification. Following that, it requires <strong>Approver</strong> authorization before final ZATCA transmission.
        </p>
      </div>

      <div className="pt-2">
        <button type="submit" className="btn-pro h-10 px-8" disabled={isSaving}>
          {isSaving ? 'Processing...' : (initialData ? 'Update & Keep as Draft' : 'Create Invoice Draft')}
        </button>
      </div>
    </form>
  );
}
