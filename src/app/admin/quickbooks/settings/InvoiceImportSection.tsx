'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Download,
  Eye,
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
} from 'lucide-react';

type ZatcaStatus = 'pending' | 'submitted' | 'cleared' | 'failed';

interface InvoiceRow {
  id: string;
  qb_invoice_id: string;
  qb_doc_number: string | null;
  invoice_date: string | null;
  customer_name: string | null;
  total_amount: number | null;
  currency: string | null;
  zatca_status: ZatcaStatus;
  zatca_error: string | null;
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
  const [monthFilter, setMonthFilter] = useState<string>('');
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
      if (monthFilter) params.set('month', monthFilter);
      const res = await fetch(`/api/quickbooks/invoices?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load invoices');
      setInvoices(data.invoices ?? []);
    } catch (e: any) {
      flashToast('error', e.message);
    } finally {
      setLoading(false);
    }
  }, [orgId, monthFilter]);

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
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-slate-400" />
          <input
            type="month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          {monthFilter && (
            <button
              onClick={() => setMonthFilter('')}
              className="text-[11px] text-slate-500 hover:text-slate-700 underline"
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
        <button
          onClick={handleImport}
          disabled={importing}
          className="px-4 py-2 text-sm rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-2 shadow-sm disabled:opacity-50"
        >
          {importing ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          {importing ? 'Importing…' : 'Import from QuickBooks'}
        </button>
      </div>

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
              <th className="px-3 py-2 w-8">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  disabled={selectableIds.length === 0}
                  aria-label="Select all"
                />
              </th>
              <th className="px-3 py-2 text-left">QB ID</th>
              <th className="px-3 py-2 text-left">Doc #</th>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Customer</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.length === 0 && !loading && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-slate-400 text-sm">
                  No invoices yet. Click <span className="font-semibold">Import from QuickBooks</span> to pull them in.
                </td>
              </tr>
            )}
            {invoices.map((inv) => {
              const isCleared = inv.zatca_status === 'cleared';
              const isFailed = inv.zatca_status === 'failed';
              const checked = selectedIds.has(inv.id);
              return (
                <tr key={inv.id} className="hover:bg-slate-50/60">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelect(inv.id, inv.zatca_status)}
                      disabled={isCleared}
                      title={isCleared ? 'Already cleared' : ''}
                    />
                  </td>
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
                    <StatusBadge status={inv.zatca_status} error={inv.zatca_error} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {isFailed && (
                        <button
                          onClick={() => setResubmitTarget(inv)}
                          className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600"
                          title="Resubmit or edit"
                        >
                          <RefreshCw size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => openDetail(inv.id)}
                        className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600"
                        title="View details"
                      >
                        <Eye size={14} />
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
      {selectedIds.size > 0 && (
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
              className="px-4 py-1.5 text-sm rounded-lg bg-blue-600 hover:bg-blue-500 font-semibold flex items-center gap-2 disabled:opacity-50"
            >
              {clearing ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
              Submit Selected to ZATCA
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
              Submit <span className="font-bold">{selectedIds.size}</span> invoice(s) to the ZATCA
              Compliance Simulator? Each will be permanently marked as <em>cleared</em> or{' '}
              <em>failed</em>. Cleared invoices cannot be re-submitted without explicit
              confirmation.
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
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-lg bg-white shadow-2xl overflow-y-auto relative">
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

        <div className="relative p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800">Invoice Details</h3>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100">
              <X size={18} />
            </button>
          </div>

          {loading && (
            <div className="py-8 flex items-center justify-center text-slate-400">
              <Loader2 className="animate-spin" />
            </div>
          )}

          {invoice && !loading && (
            <>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Field label="QB ID" value={invoice.qb_invoice_id} />
                <Field label="Doc #" value={invoice.qb_doc_number ?? '—'} />
                <Field label="Date" value={invoice.invoice_date ?? '—'} />
                <Field
                  label="Customer"
                  value={invoice.customer_name ?? '(unnamed)'}
                />
                <Field
                  label="Total"
                  value={
                    invoice.total_amount != null
                      ? `${invoice.total_amount.toFixed(2)} ${invoice.currency ?? ''}`.trim()
                      : '—'
                  }
                />
                <Field label="ZATCA Status" value={invoice.zatca_status} />
                {invoice.zatca_cleared_at && (
                  <Field
                    label="Cleared At"
                    value={new Date(invoice.zatca_cleared_at).toLocaleString()}
                  />
                )}
                {invoice.zatca_submitted_at && (
                  <Field
                    label="Last Submission"
                    value={new Date(invoice.zatca_submitted_at).toLocaleString()}
                  />
                )}
              </div>

              {invoice.zatca_qr && (
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">
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
                  <div className="text-[11px] uppercase tracking-wide text-red-600 mb-2">
                    Failure Reason
                  </div>
                  <div className="text-[12px] font-mono p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 break-words">
                    {invoice.zatca_error}
                  </div>
                </div>
              )}

              <details className="rounded-xl border border-slate-200 p-3 bg-slate-50/40">
                <summary className="cursor-pointer text-[12px] font-semibold text-slate-700">
                  Raw QuickBooks payload
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-slate-800 font-medium break-words">{value}</div>
    </div>
  );
}
