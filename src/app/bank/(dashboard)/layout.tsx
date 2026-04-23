'use client';

import BankHeader from '@/components/bank/BankHeader';
import { useBankAuthStore } from '@/store/bankAuthStore';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function BankDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated } = useBankAuthStore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!isAuthenticated()) {
      router.push('/bank/login');
    }
  }, [isAuthenticated, router]);

  if (!mounted) return null;

  if (!isAuthenticated()) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-1 bg-slate-50">
      <div className="flex flex-col flex-1 min-w-0">
        <BankHeader />
        <main className="flex-1 p-6">
          <div className="max-w-[1200px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
