'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { getOnboardingStatus, type OnboardingStatus } from '@/lib/zatca/onboarding-storage';

type StepState = 'done' | 'current' | 'pending';

interface QbConfig {
    is_connected?: boolean;
    client_id?: string;
}

export default function QuickbooksSetupPage() {
    const router = useRouter();
    const { activeBank, isLoading: contextLoading } = useApp();
    const [zatca, setZatca] = useState<OnboardingStatus | null>(null);
    const [qb, setQb] = useState<QbConfig | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (contextLoading) return;
        if (!activeBank) {
            router.replace('/login?next=/quickbooks/setup');
            return;
        }

        let cancelled = false;
        (async () => {
            try {
                const [zatcaStatus, qbResp] = await Promise.all([
                    getOnboardingStatus(activeBank.id),
                    fetch(`/api/quickbooks/config?orgId=${activeBank.id}`).then((r) =>
                        r.ok ? r.json() : { config: null }
                    ),
                ]);
                if (cancelled) return;
                setZatca(zatcaStatus);
                setQb(qbResp?.config ?? null);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [contextLoading, activeBank, router]);

    if (contextLoading || loading || !activeBank) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const zatcaDone = !!zatca?.productionCSID;
    const zatcaPartial = !zatcaDone && !!zatca?.complianceCSID;
    const qbDone = !!qb?.is_connected;

    // Step states
    const step1State: StepState = 'done';
    const step2State: StepState = zatcaDone ? 'done' : 'current';
    const step3State: StepState = zatcaDone ? (qbDone ? 'done' : 'current') : 'pending';

    const allDone = zatcaDone && qbDone;

    return (
        <div className="animate-pro">
            <section className="section-pro border-b border-gray-100 bg-gradient-to-b from-emerald-50/40 to-transparent">
                <div className="container max-w-4xl mx-auto py-12">
                    <div className="text-center mb-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest mb-4">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            QuickBooks Setup · {activeBank.name}
                        </div>
                        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 mb-2">
                            {allDone ? 'You\'re all set' : 'Finish setting up QuickBooks'}
                        </h1>
                        <p className="text-[13px] text-gray-500 max-w-xl mx-auto">
                            {allDone
                                ? 'Your QuickBooks account is connected and ZATCA is ready. Invoices created in QB will be cleared automatically.'
                                : 'Two more steps before invoices from QuickBooks flow through to ZATCA.'}
                        </p>
                    </div>
                </div>
            </section>

            <section className="section-pro">
                <div className="container max-w-3xl mx-auto py-10 space-y-4">
                    <StepCard
                        index={1}
                        state={step1State}
                        title="Business Registration"
                        body={`${activeBank.name} is registered as a tenant on the middleware.`}
                        meta={
                            <>
                                <Detail label="VAT" value={activeBank.vat_number || '—'} />
                                <Detail label="Tax ID" value={activeBank.tax_number || '—'} />
                            </>
                        }
                    />

                    <StepCard
                        index={2}
                        state={step2State}
                        title="ZATCA Compliance Onboarding"
                        body={
                            zatcaDone
                                ? 'CSR generated, Compliance CSID issued, 6-document compliance suite passed, Production CSID active.'
                                : zatcaPartial
                                ? 'Compliance CSID issued. Continue to run the compliance test suite and request your Production CSID.'
                                : 'Generate your CSR, register with ZATCA, run the 6-document compliance suite, and receive your Production CSID. Required before any invoice can be cleared.'
                        }
                        ctaHref="/quickbooks/onboarding"
                        ctaLabel={zatcaPartial ? 'Resume onboarding →' : 'Start ZATCA onboarding →'}
                    />

                    <StepCard
                        index={3}
                        state={step3State}
                        title="Connect QuickBooks Online"
                        body={
                            qbDone
                                ? `Connected to QuickBooks (Client ID ending …${(qb?.client_id || '').slice(-4) || '—'}). Invoices auto-sync.`
                                : step3State === 'pending'
                                ? 'Will unlock once ZATCA compliance is complete.'
                                : 'Paste your Intuit Client ID and Secret, then authorize the middleware to read invoices from your QuickBooks Online account.'
                        }
                        ctaHref="/admin/quickbooks/settings"
                        ctaLabel={qbDone ? 'Manage connection →' : 'Connect QuickBooks →'}
                        disabled={step3State === 'pending'}
                    />

                    {allDone && (
                        <div className="mt-6 p-6 rounded-2xl bg-emerald-50 border border-emerald-100 text-center">
                            <p className="text-[13px] text-emerald-800 font-bold mb-2">
                                Setup complete. Issue an invoice in QuickBooks to test the end-to-end flow.
                            </p>
                            <Link href="/" className="text-[12px] font-bold text-emerald-700 hover:underline">
                                Back to dashboard →
                            </Link>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}

function StepCard({
    index,
    state,
    title,
    body,
    meta,
    ctaHref,
    ctaLabel,
    disabled,
}: {
    index: number;
    state: StepState;
    title: string;
    body: string;
    meta?: React.ReactNode;
    ctaHref?: string;
    ctaLabel?: string;
    disabled?: boolean;
}) {
    const isDone = state === 'done';
    const isCurrent = state === 'current';
    const isPending = state === 'pending';

    return (
        <div
            className={`card-pro p-6 border ${
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
                    <div className="flex items-center gap-2 mb-1">
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
                    <p className="text-[12px] text-gray-500 leading-relaxed mb-3">{body}</p>

                    {meta && (
                        <div className="flex flex-wrap gap-x-6 gap-y-1 mb-3">{meta}</div>
                    )}

                    {ctaHref && !disabled && (isCurrent || isDone) && (
                        <Link
                            href={ctaHref}
                            className={`inline-flex items-center text-[12px] font-bold ${
                                isCurrent ? 'text-emerald-700 hover:text-emerald-800' : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            {ctaLabel}
                        </Link>
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

function Detail({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <span className="block text-[9px] font-black text-gray-400 uppercase tracking-widest">{label}</span>
            <span className="text-[12px] font-bold text-gray-700">{value}</span>
        </div>
    );
}
