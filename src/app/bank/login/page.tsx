'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBankAuthStore } from '@/store/bankAuthStore';
import Link from 'next/link';

export default function BankLoginPage() {
  const router = useRouter();
  const { setAuth } = useBankAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter email and password.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/bank/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Login failed.');
        return;
      }
      setAuth({
        sessionToken: data.sessionToken,
        bankName: data.organization?.name || 'Z3C Bank Demo',
        role: data.user.role,
        userName: data.user.fullName,
        email: data.user.email,
        passwordExpiresAt: data.user.passwordExpiresAt || null,
        integrationConfigured: !!data.integrationConfigured,
      });
      router.push('/bank/dashboard');
    } catch {
      setError('Failed to login.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bank-login-page">
      <div className="bank-login-container">
        <div className="bank-login-brand">
          <div className="bank-login-logo">
            <span>Z3</span>
          </div>
          <h1 className="bank-login-title">Z3C Bank Product</h1>
          <p className="bank-login-subtitle">Middleware Integration Demo</p>
        </div>

        <form onSubmit={onSubmit} className="bank-login-form">
          <h2 className="text-[16px] font-bold text-gray-900 mb-1">Secure Login</h2>
          <p className="text-[11px] text-gray-400 mb-5">Sign in with product credentials</p>

          {error && (
            <div className="bank-login-error">{error}</div>
          )}

          <div className="bank-form-group">
            <label className="bank-form-label">Email</label>
            <input
              type="email"
              className="input-pro"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@z3c.local"
              required
            />
          </div>

          <div className="bank-form-group">
            <label className="bank-form-label">Password</label>
            <input
              type="password"
              className="input-pro"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="bank-login-hint">
            Use your registered bank admin credentials to access your organization workspace.
          </div>

          <button type="submit" className="btn-pro w-full h-9 mt-2" disabled={isLoading}>
            {isLoading ? 'Signing in...' : 'Login to Bank Demo'}
          </button>

          <Link href="/" className="bank-login-back">← Back to Middleware Hub</Link>
        </form>
      </div>
    </div>
  );
}
