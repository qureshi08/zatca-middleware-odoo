'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useBankAuthStore } from '@/store/bankAuthStore';
import InvoiceForm from '@/components/bank/InvoiceForm';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function BankNewInvoicePage() {
  const router = useRouter();
  const { sessionToken, role } = useBankAuthStore();
  const [customers, setCustomers] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [invoices, setInvoices] = useState<any[]>([]);

  useEffect(() => {
    if (!sessionToken) return;
    if (role !== 'Admin' && role !== 'Maker') {
      router.push('/bank/invoices');
      return;
    }
    Promise.all([
      fetch('/api/bank/product/customers', { headers: { 'x-session-token': sessionToken } }).then(res => res.json()),
      fetch('/api/bank/product/invoices', { headers: { 'x-session-token': sessionToken } }).then(res => res.json())
    ])
      .then(([customersData, invoicesData]) => {
        setCustomers(customersData.customers || []);
        // Only show cleared or reported invoices for credit/debit notes
        const validInvoices = (invoicesData.invoices || []).filter((inv: any) => 
          ['cleared', 'reported'].includes(inv.status)
        );
        setInvoices(validInvoices);
      })
      .catch(() => undefined);
  }, [sessionToken, role, router]);

  const handleSave = async (formData: any) => {
    if (!sessionToken) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/bank/product/invoices', {
        method: 'POST',
        headers: {
          'x-session-token': sessionToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create invoice');
        return;
      }
      router.push(`/bank/invoices/${data.invoice.id}`);
    } catch (e) {
      setError('A network error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="animate-pro max-w-4xl mx-auto">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/bank/invoices" className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="h1">New Invoice Draft</h1>
          <p className="text-small">Begin the ZATCA compliance workflow by creating a local draft.</p>
        </div>
      </div>

      {error && (
        <div className="bank-alert-error mb-6 flex items-center justify-between">
          <span>{error}</span>
        </div>
      )}

      <div className="card-pro p-6">
        <InvoiceForm 
          customers={customers} 
          invoices={invoices}
          onSave={handleSave} 
          isSaving={isSaving} 
        />
      </div>
    </div>
  );
}
