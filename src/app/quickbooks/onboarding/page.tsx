'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import {
    startOnboarding,
    runComplianceChecks,
    finalizeOnboarding,
} from '@/lib/zatca/onboarding';
import { getOnboardingStatus, type OnboardingStatus } from '@/lib/zatca/onboarding-storage';

/**
 * QuickBooks-flavoured ZATCA onboarding.
 *
 * Same backend actions as the bank-side /onboarding page, but presented
 * as a single guided page with one button per step and friendly,
 * plain-English explanations of what each step does and why it matters.
 *
 * Sandbox-only for now: OTP defaults to "123456" which the backend
 * recognizes as the simulator path and stubs the ZATCA response.
 */
export default function QuickbooksOnboardingPage() {
    const router = useRouter();
    const { activeBank, isLoading: contextLoading } = useApp();
    const [status, setStatus] = useState<OnboardingStatus | null>(null);
    const [otp, setOtp] = useState('123456');
    const [step1Loading, setStep1Loading] = useState(false);
    const [step2Loading, setStep2Loading] = useState(false);
    const [step3Loading, setStep3Loading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (contextLoading) return;
        if (!activeBank) {
            router.replace('/login?next=/quickbooks/onboarding');
            return;
        }
        getOnboardingStatus(activeBank.id).then(setStatus);
    }, [contextLoading, activeBank, router]);

    const refresh = async () => {
        if (!activeBank) return;
        const s = await getOnboardingStatus(activeBank.id);
        setStatus(s);
        return s;
    };

    const handleStep1 = async () => {
        if (!activeBank) return;
        setStep1Loading(true);
        setError(null);
        const res = await startOnboarding(otp, activeBank.id);
        if (!res.success) setError(res.error || 'Failed to register with ZATCA');
        await refresh();
        setStep1Loading(false);
    };

    const handleStep2 = async () => {
        if (!activeBank) return;
        setStep2Loading(true);
        setError(null);
        const res = await runComplianceChecks(activeBank.id);
        if (!res.success) setError(res.error || 'Compliance test failed');
        await refresh();
        setStep2Loading(false);
    };

    const handleStep3 = async () => {
        if (!activeBank) return;
        setStep3Loading(true);
        setError(null);
        const res = await finalizeOnboarding(activeBank.id);
        if (!res.success) {
            setError(res.error || 'Failed to activate production');
            setStep3Loading(false);
            return;
        }
        const fresh = await refresh();
        setStep3Loading(false);
        if (fresh?.productionCSID) {
            // All three steps complete → bounce back to the QB setup hub
            setTimeout(() => router.push('/quickbooks/setup'), 1500);
        }
    };

    if (contextLoading || !activeBank || !status) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const step1Done = !!status.complianceCSID;
    const step2Done = ['compliance_complete', 'production_received'].includes(status.step || '');
    const step3Done = !!status.productionCSID;

    return (
        <div className="animate-pro">
            <section className="section-pro border-b border-gray-100 bg-gradient-to-b from-emerald-50/40 to-transparent">
                <div className="container max-w-3xl mx-auto py-12 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest mb-4">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        ZATCA Onboarding · Sandbox
                    </div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 mb-2">
                        Get {activeBank.name} ZATCA-compliant
                    </h1>
                    <p className="text-[13px] text-gray-500 max-w-xl mx-auto">
                        Three steps to register your business with ZATCA so invoices from QuickBooks
                        can be cleared automatically. About one minute total.
                    </p>
                </div>
            </section>

            <section className="section-pro">
                <div className="container max-w-2xl mx-auto py-10 space-y-4">
                    {/* Sandbox notice */}
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 text-amber-800 text-[11px] flex gap-3 items-start">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        <div className="leading-relaxed">
                            <span className="font-extrabold">Sandbox mode.</span> Running against ZATCA's
                            Compliance Simulator. OTP <code className="font-mono bg-amber-100 px-1 rounded">123456</code> is
                            pre-filled and auto-passes — no real Fatoora portal interaction needed.
                            In production you'd enter a real 6-digit OTP from your ZATCA Fatoora portal.
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-[12px] flex items-start gap-2">
                            <span className="font-bold shrink-0">✗</span>
                            <span>{error}</span>
                        </div>
                    )}

                    <StepCard
                        index={1}
                        state={step1Done ? 'done' : 'current'}
                        title="Register with ZATCA"
                        body={
                            <>
                                We'll generate a cryptographic identity for your business — a <strong>Certificate
                                Signing Request</strong> (CSR) — and submit it to ZATCA. In return ZATCA issues you a
                                <strong> Compliance CSID</strong>, your initial certificate. This is what proves invoices
                                you submit actually come from your business and haven't been tampered with.
                            </>
                        }
                        loading={step1Loading}
                        onCta={handleStep1}
                        ctaLabel="Register with ZATCA"
                        doneLabel="Compliance CSID received"
                        extras={
                            !step1Done && (
                                <div className="mt-1 mb-4">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1.5">
                                        Fatoora Portal OTP
                                    </label>
                                    <input
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value)}
                                        className="h-10 w-32 px-3 rounded-lg border border-gray-200 text-center font-mono text-[14px] focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
                                        maxLength={6}
                                        inputMode="numeric"
                                    />
                                    <p className="text-[10px] text-gray-400 mt-1">
                                        Use <code className="font-mono">123456</code> for sandbox. In production, get this from the ZATCA Fatoora portal.
                                    </p>
                                </div>
                            )
                        }
                    />

                    <StepCard
                        index={2}
                        state={step2Done ? 'done' : step1Done ? 'current' : 'pending'}
                        title="Run compliance tests"
                        body={
                            <>
                                ZATCA requires us to submit <strong>6 sample invoices</strong> — 3 standard (B2B) +
                                3 simplified (B2C), each with a regular invoice, debit note, and credit note —
                                to verify our integration produces invoices that pass their validation rules. Fully
                                automatic, takes about 30 seconds. If anything fails ZATCA returns specific errors
                                and we surface them here.
                            </>
                        }
                        loading={step2Loading}
                        onCta={handleStep2}
                        ctaLabel="Run compliance tests"
                        doneLabel="6 / 6 tests passed"
                    />

                    <StepCard
                        index={3}
                        state={step3Done ? 'done' : step2Done ? 'current' : 'pending'}
                        title="Activate production"
                        body={
                            <>
                                Final step. We exchange your Compliance CSID for a <strong>Production CSID</strong> —
                                the certificate that signs real invoices destined for clearance (B2B standard) or reporting
                                (B2C simplified). Once this lands, every new QuickBooks invoice flows automatically:
                                QB → ZATCA → cleared, with the QR code pushed back to QB.
                            </>
                        }
                        loading={step3Loading}
                        onCta={handleStep3}
                        ctaLabel="Activate production"
                        doneLabel="Production CSID active"
                    />

                    {step3Done && (
                        <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
                            <p className="text-[14px] text-emerald-800 font-bold mb-1">
                                You're ZATCA-compliant ✓
                            </p>
                            <p className="text-[12px] text-emerald-700/80">
                                Taking you to QuickBooks setup…
                            </p>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}

type StepState = 'done' | 'current' | 'pending';

function StepCard({
    index,
    state,
    title,
    body,
    loading,
    onCta,
    ctaLabel,
    doneLabel,
    extras,
}: {
    index: number;
    state: StepState;
    title: string;
    body: React.ReactNode;
    loading: boolean;
    onCta: () => void;
    ctaLabel: string;
    doneLabel: string;
    extras?: React.ReactNode;
}) {
    const isDone = state === 'done';
    const isCurrent = state === 'current';
    const isPending = state === 'pending';

    return (
        <div
            className={`card-pro p-6 border transition-all ${
                isDone
                    ? 'bg-white border-emerald-100'
                    : isCurrent
                    ? 'bg-white border-emerald-300 ring-2 ring-emerald-100'
                    : 'bg-gray-50/60 border-gray-100 opacity-75'
            }`}
        >
            <div className="flex items-start gap-4">
                <div
                    className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center font-black text-[14px] ${
                        isDone
                            ? 'bg-emerald-600 text-white'
                            : isCurrent
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-gray-200 text-gray-400'
                    }`}
                >
                    {isDone ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                    ) : (
                        index
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-[15px] font-extrabold text-gray-900">{title}</h3>
                        <span
                            className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${
                                isDone
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : isCurrent
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-gray-100 text-gray-400'
                            }`}
                        >
                            {isDone ? 'Done' : isCurrent ? 'Next' : 'Locked'}
                        </span>
                    </div>
                    <p className="text-[12px] text-gray-500 leading-relaxed mb-4">{body}</p>

                    {extras}

                    {isDone && (
                        <span className="inline-flex items-center gap-2 text-[12px] font-bold text-emerald-700">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                            {doneLabel}
                        </span>
                    )}
                    {isCurrent && (
                        <button
                            onClick={onCta}
                            disabled={loading}
                            className="h-10 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[12px] disabled:opacity-60 transition-all inline-flex items-center gap-2"
                        >
                            {loading && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                            {loading ? 'Working…' : ctaLabel}
                            {!loading && <span aria-hidden>→</span>}
                        </button>
                    )}
                    {isPending && (
                        <span className="inline-flex items-center text-[11px] font-bold text-gray-400">
                            Complete the previous step to unlock
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
