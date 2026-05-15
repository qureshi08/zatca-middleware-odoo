'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Download,
  FileText,
  Filter,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  X,
  AlertTriangle,
  RefreshCw,
  Pencil,
  User,
  MapPin,
  Hash,
  Calendar,
  StickyNote,
} from 'lucide-react';

type ZatcaStatus = 'pending' | 'submitted' | 'cleared' | 'failed';
type ZatcaType = 'standard' | 'simplified';

interface ValidationMessage {
  code: string;
  category?: string;
  message: string;
  status?: 'ERROR' | 'WARNING';
}

interface InvoiceRow {
  id: string;
  qb_invoice_id: string;
  qb_doc_number: string | null;
  invoice_date: string | null;
  customer_name: string | null;
  total_amount: number | null;
  currency: string | null;
  zatca_status: ZatcaStatus;
  zatca_invoice_type: ZatcaType;
  zatca_error: string | null;
  zatca_validation_messages: ValidationMessage[] | null;
  zatca_cleared_at: string | null;
}

interface DetailInvoice extends InvoiceRow {
  raw_qb_payload: any;
  zatca_cleared_xml: string | null;
  zatca_qr: string | null;
  zatca_submitted_at: string | null;
}

interface Props {
  orgId: string;
  isConnected: boolean;
}

export default function InvoiceImportSection({ orgId, isConnected }: Props) {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [togglingTypeId, setTogglingTypeId] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [appliedRange, setAppliedRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [showConfirm, setShowConfirm] = useState(false);
  const [detail, setDetail] = useState<DetailInvoice | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [resubmitTarget, setResubmitTarget] = useState<InvoiceRow | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const flashToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchInvoices = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ orgId });
      if (appliedRange.from) params.set('from', appliedRange.from);
      if (appliedRange.to) params.set('to', appliedRange.to);
      const res = await fetch(`/api/quickbooks/invoices?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load invoices');
      setInvoices(data.invoices ?? []);
    } catch (e: any) {
      flashToast('error', e.message);
    } finally {
      setLoading(false);
    }
  }, [orgId, appliedRange]);

  const applyDateFilter = () => {
    if (fromDate && toDate && fromDate > toDate) {
      flashToast('error', 'Start date must be on or before end date.');
      return;
    }
    setAppliedRange({ from: fromDate, to: toDate });
  };

  const clearDateFilter = () => {
    setFromDate('');
    setToDate('');
    setAppliedRange({ from: '', to: '' });
  };

  const isFilterActive = !!(appliedRange.from || appliedRange.to);
  const hasUnappliedChanges =
    fromDate !== appliedRange.from || toDate !== appliedRange.to;

  useEffect(() => {
    if (isConnected) fetchInvoices();
  }, [isConnected, fetchInvoices]);

  const handleImport = async () => {
    setImporting(true);
    try {
      const res = await fetch('/api/quickbooks/invoices/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      flashToast(
        'success',
        `Imported ${data.imported} invoice(s). ${data.preserved} already-cleared row(s) preserved.`
      );
      await fetchInvoices();
    } catch (e: any) {
      flashToast('error', e.message);
    } finally {
      setImporting(false);
    }
  };

  const submitToZatca = async (ids: string[], force: boolean) => {
    setClearing(true);
    try {
      const res = await fetch('/api/quickbooks/invoices/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, invoiceIds: ids, force }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Clearance failed');
      const { cleared, failed, skipped } = data.summary;
      flashToast(
        failed > 0 ? 'error' : 'success',
        `${cleared} cleared, ${failed} failed, ${skipped} skipped.`
      );
      setSelectedIds(new Set());
      await fetchInvoices();
    } catch (e: any) {
      flashToast('error', e.message);
    } finally {
      setClearing(false);
    }
  };

  const handleConfirmedSubmit = async () => {
    setShowConfirm(false);
    await submitToZatca(Array.from(selectedIds), false);
  };

  const handleResubmit = async () => {
    if (!resubmitTarget) return;
    const id = resubmitTarget.id;
    setResubmitTarget(null);
    await submitToZatca([id], true);
  };

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/quickbooks/invoices/${id}?orgId=${orgId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load invoice');
      setDetail(data.invoice);
    } catch (e: any) {
      flashToast('error', e.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const toggleSelect = (id: string, status: ZatcaStatus) => {
    if (status === 'cleared') return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const enterSelectionMode = () => {
    setSelectionMode(true);
  };

  const cancelSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const toggleInvoiceType = async (inv: InvoiceRow) => {
    if (inv.zatca_status === 'cleared') {
      flashToast('error', 'Cannot change type after invoice has been cleared.');
      return;
    }
    const next: ZatcaType = inv.zatca_invoice_type === 'standard' ? 'simplified' : 'standard';
    setTogglingTypeId(inv.id);
    setInvoices((prev) =>
      prev.map((r) => (r.id === inv.id ? { ...r, zatca_invoice_type: next } : r))
    );
    try {
      const res = await fetch(`/api/quickbooks/invoices/${inv.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, zatca_invoice_type: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update type');
    } catch (e: any) {
      flashToast('error', e.message);
      setInvoices((prev) =>
        prev.map((r) =>
          r.id === inv.id ? { ...r, zatca_invoice_type: inv.zatca_invoice_type } : r
        )
      );
    } finally {
      setTogglingTypeId(null);
    }
  };

  const selectableIds = useMemo(
    () => invoices.filter((i) => i.zatca_status !== 'cleared').map((i) => i.id),
    [invoices]
  );

  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(selectableIds));
  };

  if (!isConnected) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2 mb-3">
          <Download size={20} className="text-slate-400" />
          Invoice Import &amp; ZATCA Clearance
        </h2>
        <p className="text-sm text-slate-500">
          Connect QuickBooks above to enable invoice import.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
      <div className="flex items-center justify-between border-b pb-4">
        <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
          <Download size={20} className="text-blue-500" />
          Invoice Import &amp; ZATCA Clearance
        </h2>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex items-end gap-2">
          <Filter size={16} className="text-slate-400 mb-2.5" />
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1">From</label>
            <input
              type="date"
              value={fromDate}
              max={toDate || undefined}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1">To</label>
            <input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <button
            onClick={applyDateFilter}
            disabled={!hasUnappliedChanges}
            className="px-3 py-2 text-sm rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Apply
          </button>
          {isFilterActive && (
            <button
              onClick={clearDateFilter}
              className="px-2 py-2 text-[11px] text-slate-500 hover:text-slate-700 underline"
            >
              Clear
            </button>
          )}
        </div>
        <div className="flex-1" />
        <button
          onClick={fetchInvoices}
          disabled={loading}
          className="px-3 py-2 text-sm rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center gap-2"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
        {!selectionMode ? (
          <button
            onClick={enterSelectionMode}
            disabled={invoices.length === 0}
            className="px-4 py-2 text-sm rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-2 shadow-sm disabled:opacity-40"
          >
            <ShieldCheck size={14} />
            Select for Clearance
          </button>
        ) : (
          <button
            onClick={cancelSelection}
            className="px-4 py-2 text-sm rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold flex items-center gap-2"
          >
            <X size={14} />
            Cancel Selection
          </button>
        )}
        <button
          onClick={handleImport}
          disabled={importing}
          className="px-4 py-2 text-sm rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-2 shadow-sm disabled:opacity-50"
        >
          {importing ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          {importing ? 'Importing…' : 'Import from QuickBooks'}
        </button>
      </div>

      {selectionMode && (
        <div className="px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[12px] flex items-center gap-2">
          <ShieldCheck size={14} className="shrink-0" />
          <span>
            <span className="font-semibold">Selection mode active.</span> Tick the invoices you
            want to submit to ZATCA, then click <span className="font-semibold">Clear Selected</span>.
            Already-cleared rows are not selectable.
          </span>
        </div>
      )}

      {isFilterActive && (
        <div className="text-[12px] text-slate-500">
          Showing invoices
          {appliedRange.from && <> from <span className="font-mono text-slate-700">{appliedRange.from}</span></>}
          {appliedRange.to && <> to <span className="font-mono text-slate-700">{appliedRange.to}</span></>}
          . <span className="text-slate-400">({invoices.length} match{invoices.length === 1 ? '' : 'es'})</span>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`p-3 rounded-xl text-sm flex items-start gap-2 ${
            toast.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
          ) : (
            <XCircle size={16} className="shrink-0 mt-0.5" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-[11px] uppercase tracking-wide">
            <tr>
              {selectionMode && (
                <th className="px-3 py-2 w-8">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    disabled={selectableIds.length === 0}
                    aria-label="Select all"
                  />
                </th>
              )}
              <th className="px-3 py-2 text-left">QB ID</th>
              <th className="px-3 py-2 text-left">Doc #</th>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Customer</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right w-32">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={selectionMode ? 9 : 8}
                  className="px-3 py-8 text-center text-slate-400 text-sm"
                >
                  No invoices yet. Click <span className="font-semibold">Import from QuickBooks</span> to pull them in.
                </td>
              </tr>
            )}
            {invoices.map((inv) => {
              const isCleared = inv.zatca_status === 'cleared';
              const isFailed = inv.zatca_status === 'failed';
              const checked = selectedIds.has(inv.id);
              const typeLoading = togglingTypeId === inv.id;
              return (
                <tr key={inv.id} className="hover:bg-slate-50/60">
                  {selectionMode && (
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSelect(inv.id, inv.zatca_status)}
                        disabled={isCleared}
                        title={isCleared ? 'Already cleared' : ''}
                      />
                    </td>
                  )}
                  <td className="px-3 py-2 font-mono text-[12px] text-slate-600">{inv.qb_invoice_id}</td>
                  <td className="px-3 py-2 text-slate-600">{inv.qb_doc_number ?? '—'}</td>
                  <td className="px-3 py-2 text-slate-600">{inv.invoice_date ?? '—'}</td>
                  <td className="px-3 py-2 text-slate-700">
                    {inv.customer_name ?? '(unnamed customer)'}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-slate-700">
                    {inv.total_amount != null
                      ? `${inv.total_amount.toFixed(2)} ${inv.currency ?? ''}`.trim()
                      : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <TypeBadge
                      type={inv.zatca_invoice_type}
                      loading={typeLoading}
                      locked={isCleared}
                      onToggle={() => toggleInvoiceType(inv)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={inv.zatca_status} error={inv.zatca_error} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {isFailed && (
                        <button
                          onClick={() => setResubmitTarget(inv)}
                          className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 flex items-center gap-1"
                          title="Resubmit or edit"
                        >
                          <RefreshCw size={11} />
                          Retry
                        </button>
                      )}
                      <button
                        onClick={() => openDetail(inv.id)}
                        className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 flex items-center gap-1"
                      >
                        <FileText size={11} />
                        Detail
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Bulk action bar */}
      {selectionMode && selectedIds.size > 0 && (
        <div className="sticky bottom-4 flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-900 text-white shadow-lg">
          <span className="text-sm">
            <span className="font-bold">{selectedIds.size}</span> invoice(s) selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 text-sm rounded-lg bg-slate-700 hover:bg-slate-600"
            >
              Clear
            </button>
            <button
              onClick={() => setShowConfirm(true)}
              disabled={clearing}
              className="px-4 py-1.5 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-500 font-semibold flex items-center gap-2 disabled:opacity-50"
            >
              {clearing ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
              Clear Selected
            </button>
          </div>
        </div>
      )}

      {/* Confirm modal */}
      {showConfirm && (
        <Modal onClose={() => setShowConfirm(false)}>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="text-amber-500" />
              <h3 className="text-lg font-bold text-slate-800">Confirm ZATCA Submission</h3>
            </div>
            <p className="text-sm text-slate-600">
              Submit <span className="font-bold">{selectedIds.size}</span> invoice(s) to ZATCA?
              Each row is processed using its own type — <span className="font-semibold">B2B → Clearance API</span>,{' '}
              <span className="font-semibold">B2C → Reporting API</span>. After this, each invoice
              is permanently marked as <em>cleared</em> or <em>failed</em>; the type can no
              longer be changed.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmedSubmit}
                className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                Confirm &amp; Submit
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Resubmit-or-edit prompt for failed rows */}
      {resubmitTarget && (
        <Modal onClose={() => setResubmitTarget(null)}>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="text-red-500" />
              <h3 className="text-lg font-bold text-slate-800">This invoice failed ZATCA clearance</h3>
            </div>
            <div className="p-3 rounded-xl bg-red-50 text-red-700 text-[12px] font-mono break-words">
              {resubmitTarget.zatca_error ?? 'Unknown error'}
            </div>
            <p className="text-sm text-slate-600">What would you like to do?</p>
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={handleResubmit}
                className="p-3 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-left flex items-start gap-3"
              >
                <RefreshCw size={18} className="text-blue-600 mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold text-slate-800">Resubmit as-is</div>
                  <div className="text-[11px] text-slate-500">
                    Run the same payload through ZATCA again. Useful for transient failures.
                  </div>
                </div>
              </button>
              <button
                onClick={() => setResubmitTarget(null)}
                className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-left flex items-start gap-3"
              >
                <Pencil size={18} className="text-slate-600 mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold text-slate-800">Edit in QuickBooks first</div>
                  <div className="text-[11px] text-slate-500">
                    Close this prompt, fix the invoice in QuickBooks, then re-import to refresh
                    the payload.
                  </div>
                </div>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Detail drawer */}
      {(detail || detailLoading) && (
        <DetailDrawer
          loading={detailLoading}
          invoice={detail}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

function TypeBadge({
  type,
  loading,
  locked,
  onToggle,
}: {
  type: ZatcaType;
  loading: boolean;
  locked: boolean;
  onToggle: () => void;
}) {
  const isB2B = type === 'standard';
  const tooltip = locked
    ? 'Type is locked once cleared'
    : `Click to switch to ${isB2B ? 'B2C (simplified)' : 'B2B (standard)'}`;
  return (
    <button
      onClick={onToggle}
      disabled={locked || loading}
      title={tooltip}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold border transition ${
        isB2B
          ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
          : 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100'
      } ${locked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'} ${
        loading ? 'opacity-50' : ''
      }`}
    >
      {loading && <Loader2 size={10} className="animate-spin" />}
      {isB2B ? 'B2B · Standard' : 'B2C · Simplified'}
    </button>
  );
}

function StatusBadge({ status, error }: { status: ZatcaStatus; error: string | null }) {
  if (status === 'cleared') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-green-50 text-green-700 border border-green-200">
        <ShieldCheck size={12} /> Cleared
      </span>
    );
  }
  if (status === 'submitted') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
        <Loader2 size={12} className="animate-spin" /> Submitting
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200"
        title={error ?? ''}
      >
        <XCircle size={12} /> Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
      <Clock size={12} /> Pending
    </span>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function DetailDrawer({
  invoice,
  loading,
  onClose,
}: {
  invoice: DetailInvoice | null;
  loading: boolean;
  onClose: () => void;
}) {
  const qb = invoice?.raw_qb_payload ?? {};
  const currency = qb.CurrencyRef?.value ?? invoice?.currency ?? '';
  const lines: any[] = Array.isArray(qb.Line) ? qb.Line : [];
  const itemLines = lines.filter((l) => l.DetailType === 'SalesItemLineDetail');
  const subtotalLine = lines.find((l) => l.DetailType === 'SubTotalLineDetail');
  const discountLine = lines.find((l) => l.DetailType === 'DiscountLineDetail');
  const taxDetail = qb.TxnTaxDetail ?? {};
  const taxLines: any[] = Array.isArray(taxDetail.TaxLine) ? taxDetail.TaxLine : [];

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-2xl bg-white shadow-2xl overflow-y-auto relative">
        {/* Watermark seal — only when cleared */}
        {invoice?.zatca_status === 'cleared' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
            <div
              className="border-8 border-green-600 rounded-2xl px-10 py-6 text-green-700"
              style={{ transform: 'rotate(-18deg)', opacity: 0.13 }}
            >
              <div className="flex items-center gap-3">
                <ShieldCheck size={56} />
                <div className="text-left">
                  <div className="text-3xl font-extrabold tracking-widest">ZATCA</div>
                  <div className="text-2xl font-bold tracking-widest">CLEARED</div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="relative p-6 space-y-6">
          <div className="flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur z-10 -mx-6 px-6 py-2 border-b">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Invoice Details</h3>
              <p className="text-[11px] text-slate-500">
                QB ID <span className="font-mono">{invoice?.qb_invoice_id}</span>
                {invoice?.qb_doc_number && (
                  <> · Doc <span className="font-mono">{invoice.qb_doc_number}</span></>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {invoice && <StatusBadge status={invoice.zatca_status} error={invoice.zatca_error} />}
              <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
          </div>

          {loading && (
            <div className="py-8 flex items-center justify-center text-slate-400">
              <Loader2 className="animate-spin" />
            </div>
          )}

          {invoice && !loading && (
            <>
              {/* Header / metadata */}
              <SectionCard title="Invoice Metadata" icon={<Hash size={14} />}>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Field label="QB Internal ID" value={invoice.qb_invoice_id} />
                  <Field label="Doc Number" value={invoice.qb_doc_number ?? '—'} />
                  <Field label="Issue Date" value={qb.TxnDate ?? invoice.invoice_date ?? '—'} />
                  <Field label="Due Date" value={qb.DueDate ?? '—'} />
                  <Field label="Currency" value={currency || '—'} />
                  <Field
                    label="Exchange Rate"
                    value={qb.ExchangeRate != null ? String(qb.ExchangeRate) : '—'}
                  />
                  {qb.SalesTermRef?.name && (
                    <Field label="Terms" value={qb.SalesTermRef.name} />
                  )}
                  {qb.PrintStatus && <Field label="Print Status" value={qb.PrintStatus} />}
                  {qb.EmailStatus && <Field label="Email Status" value={qb.EmailStatus} />}
                </div>
              </SectionCard>

              {/* Customer */}
              <SectionCard title="Customer" icon={<User size={14} />}>
                <div className="space-y-3 text-sm">
                  <Field
                    label="Name"
                    value={qb.CustomerRef?.name ?? invoice.customer_name ?? '—'}
                  />
                  {qb.BillEmail?.Address && (
                    <Field label="Email" value={qb.BillEmail.Address} />
                  )}
                  {qb.BillAddr && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-500 flex items-center gap-1 mb-1">
                        <MapPin size={11} /> Billing Address
                      </div>
                      <div className="text-slate-800 leading-relaxed">
                        {[
                          qb.BillAddr.Line1,
                          qb.BillAddr.Line2,
                          qb.BillAddr.Line3,
                          [qb.BillAddr.City, qb.BillAddr.CountrySubDivisionCode]
                            .filter(Boolean)
                            .join(', '),
                          qb.BillAddr.PostalCode,
                          qb.BillAddr.Country,
                        ]
                          .filter(Boolean)
                          .map((line, i) => (
                            <div key={i}>{line}</div>
                          ))}
                      </div>
                    </div>
                  )}
                  {qb.ShipAddr && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-500 flex items-center gap-1 mb-1">
                        <MapPin size={11} /> Shipping Address
                      </div>
                      <div className="text-slate-800 leading-relaxed">
                        {[
                          qb.ShipAddr.Line1,
                          qb.ShipAddr.Line2,
                          qb.ShipAddr.City,
                          qb.ShipAddr.PostalCode,
                          qb.ShipAddr.Country,
                        ]
                          .filter(Boolean)
                          .map((line, i) => (
                            <div key={i}>{line}</div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* Line items */}
              <SectionCard title={`Line Items (${itemLines.length})`} icon={<FileText size={14} />}>
                {itemLines.length === 0 ? (
                  <p className="text-sm text-slate-400">No line items.</p>
                ) : (
                  <div className="overflow-x-auto -mx-1">
                    <table className="w-full text-[12px]">
                      <thead className="text-slate-500 text-[10px] uppercase tracking-wide">
                        <tr>
                          <th className="px-2 py-1.5 text-left">#</th>
                          <th className="px-2 py-1.5 text-left">Item / Description</th>
                          <th className="px-2 py-1.5 text-right">Qty</th>
                          <th className="px-2 py-1.5 text-right">Unit Price</th>
                          <th className="px-2 py-1.5 text-left">Tax Code</th>
                          <th className="px-2 py-1.5 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {itemLines.map((line, idx) => {
                          const detail = line.SalesItemLineDetail ?? {};
                          const itemName =
                            detail.ItemRef?.name ?? line.Description ?? 'Item';
                          const desc =
                            line.Description && detail.ItemRef?.name !== line.Description
                              ? line.Description
                              : null;
                          return (
                            <tr key={line.Id ?? idx} className="align-top">
                              <td className="px-2 py-1.5 text-slate-400">{idx + 1}</td>
                              <td className="px-2 py-1.5">
                                <div className="font-medium text-slate-800">{itemName}</div>
                                {desc && <div className="text-[11px] text-slate-500">{desc}</div>}
                              </td>
                              <td className="px-2 py-1.5 text-right text-slate-700">
                                {detail.Qty ?? '—'}
                              </td>
                              <td className="px-2 py-1.5 text-right text-slate-700">
                                {detail.UnitPrice != null
                                  ? Number(detail.UnitPrice).toFixed(2)
                                  : '—'}
                              </td>
                              <td className="px-2 py-1.5 text-slate-600 text-[11px]">
                                {detail.TaxCodeRef?.value ?? '—'}
                              </td>
                              <td className="px-2 py-1.5 text-right font-medium text-slate-800">
                                {line.Amount != null ? Number(line.Amount).toFixed(2) : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </SectionCard>

              {/* Totals */}
              <SectionCard title="Totals" icon={<Calendar size={14} />}>
                <div className="space-y-1 text-sm">
                  {subtotalLine?.Amount != null && (
                    <TotalRow label="Subtotal" value={Number(subtotalLine.Amount)} currency={currency} />
                  )}
                  {discountLine?.Amount != null && (
                    <TotalRow
                      label="Discount"
                      value={-Math.abs(Number(discountLine.Amount))}
                      currency={currency}
                    />
                  )}
                  {taxLines.length > 0 && (
                    <div className="py-1">
                      <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Tax Breakdown</div>
                      {taxLines.map((tl: any, i: number) => {
                        const td = tl.TaxLineDetail ?? {};
                        const ratePct = td.TaxPercent;
                        return (
                          <div
                            key={i}
                            className="flex justify-between text-[12px] text-slate-600 pl-2"
                          >
                            <span>
                              {td.TaxRateRef?.name ?? 'Tax'}
                              {ratePct != null && <> · {ratePct}%</>}
                              {td.NetAmountTaxable != null && (
                                <span className="text-slate-400">
                                  {' '}
                                  on {Number(td.NetAmountTaxable).toFixed(2)}
                                </span>
                              )}
                            </span>
                            <span className="font-medium text-slate-700">
                              {Number(tl.Amount ?? 0).toFixed(2)} {currency}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {taxDetail.TotalTax != null && (
                    <TotalRow
                      label="Total Tax"
                      value={Number(taxDetail.TotalTax)}
                      currency={currency}
                    />
                  )}
                  {qb.TotalAmt != null && (
                    <TotalRow
                      label="Grand Total"
                      value={Number(qb.TotalAmt)}
                      currency={currency}
                      strong
                    />
                  )}
                  {qb.Balance != null && (
                    <TotalRow
                      label="Balance Due"
                      value={Number(qb.Balance)}
                      currency={currency}
                    />
                  )}
                  {qb.HomeTotalAmt != null && qb.HomeTotalAmt !== qb.TotalAmt && (
                    <TotalRow
                      label="Home Currency Total"
                      value={Number(qb.HomeTotalAmt)}
                      currency=""
                    />
                  )}
                </div>
              </SectionCard>

              {/* Notes / memos */}
              {(qb.PrivateNote || qb.CustomerMemo?.value) && (
                <SectionCard title="Notes" icon={<StickyNote size={14} />}>
                  <div className="space-y-2 text-sm">
                    {qb.CustomerMemo?.value && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-slate-500">
                          Customer Memo
                        </div>
                        <div className="text-slate-700 whitespace-pre-wrap">
                          {qb.CustomerMemo.value}
                        </div>
                      </div>
                    )}
                    {qb.PrivateNote && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-slate-500">
                          Private Note
                        </div>
                        <div className="text-slate-700 whitespace-pre-wrap">{qb.PrivateNote}</div>
                      </div>
                    )}
                  </div>
                </SectionCard>
              )}

              {/* Validation messages */}
              {invoice.zatca_validation_messages && invoice.zatca_validation_messages.length > 0 && (
                <SectionCard
                  title={`Validation Report (${invoice.zatca_validation_messages.length})`}
                  icon={<AlertTriangle size={14} />}
                >
                  <div className="space-y-2">
                    {invoice.zatca_validation_messages.map((m, i) => {
                      const isError = (m.status ?? 'ERROR') === 'ERROR';
                      return (
                        <div
                          key={i}
                          className={`p-3 rounded-xl border text-[12px] ${
                            isError
                              ? 'bg-red-50 border-red-200'
                              : 'bg-amber-50 border-amber-200'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                                isError
                                  ? 'bg-red-200 text-red-900'
                                  : 'bg-amber-200 text-amber-900'
                              }`}
                            >
                              {isError ? 'ERROR' : 'WARNING'}
                            </span>
                            <code className="text-[11px] font-bold text-slate-800">
                              {m.code}
                            </code>
                            {m.category && (
                              <span className="text-[10px] uppercase text-slate-500">
                                {m.category}
                              </span>
                            )}
                          </div>
                          <div className={isError ? 'text-red-800' : 'text-amber-800'}>
                            {m.message}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </SectionCard>
              )}

              {/* ZATCA section */}
              <SectionCard title="ZATCA Clearance" icon={<ShieldCheck size={14} />}>
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Status" value={invoice.zatca_status} />
                    <Field
                      label="Invoice Type"
                      value={
                        invoice.zatca_invoice_type === 'standard'
                          ? 'B2B · Standard (Clearance)'
                          : 'B2C · Simplified (Reporting)'
                      }
                    />
                    {invoice.zatca_submitted_at && (
                      <Field
                        label="Last Submission"
                        value={new Date(invoice.zatca_submitted_at).toLocaleString()}
                      />
                    )}
                    {invoice.zatca_cleared_at && (
                      <Field
                        label="Cleared At"
                        value={new Date(invoice.zatca_cleared_at).toLocaleString()}
                      />
                    )}
                  </div>

                  {invoice.zatca_qr && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">
                        ZATCA QR
                      </div>
                      {invoice.zatca_qr.startsWith('data:image') ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={invoice.zatca_qr}
                          alt="ZATCA QR"
                          className="w-40 h-40 rounded-xl border border-slate-200 p-2 bg-white"
                        />
                      ) : (
                        <code className="block text-[10px] break-all bg-slate-50 p-2 rounded">
                          {invoice.zatca_qr}
                        </code>
                      )}
                    </div>
                  )}

                  {invoice.zatca_error && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-red-600 mb-1">
                        Failure Reason
                      </div>
                      <div className="text-[12px] font-mono p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 break-words">
                        {invoice.zatca_error}
                      </div>
                    </div>
                  )}

                  {!invoice.zatca_qr && !invoice.zatca_error && invoice.zatca_status === 'pending' && (
                    <p className="text-[12px] text-slate-400">
                      Not yet submitted. Select this invoice in the table and click{' '}
                      <span className="font-semibold">Submit Selected to ZATCA</span>.
                    </p>
                  )}
                </div>
              </SectionCard>

              {/* Raw payloads — collapsed */}
              <details className="rounded-xl border border-slate-200 p-3 bg-slate-50/40">
                <summary className="cursor-pointer text-[12px] font-semibold text-slate-700">
                  Raw QuickBooks payload (debug)
                </summary>
                <pre className="mt-3 text-[10px] text-slate-600 overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(invoice.raw_qb_payload, null, 2)}
                </pre>
              </details>

              {invoice.zatca_cleared_xml && (
                <details className="rounded-xl border border-slate-200 p-3 bg-slate-50/40">
                  <summary className="cursor-pointer text-[12px] font-semibold text-slate-700">
                    Cleared ZATCA XML
                  </summary>
                  <pre className="mt-3 text-[10px] text-slate-600 overflow-x-auto whitespace-pre-wrap">
                    {invoice.zatca_cleared_xml}
                  </pre>
                </details>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white/70 p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide font-bold text-slate-600 mb-3">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function TotalRow({
  label,
  value,
  currency,
  strong = false,
}: {
  label: string;
  value: number;
  currency: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex justify-between py-1 ${
        strong
          ? 'border-t border-slate-200 mt-1 pt-2 text-slate-900 font-bold text-base'
          : 'text-slate-700'
      }`}
    >
      <span>{label}</span>
      <span className={strong ? '' : 'font-medium'}>
        {value.toFixed(2)} {currency}
      </span>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-slate-800 font-medium break-words">{value}</div>
    </div>
  );
}
