"use client";
import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '../../../components/Navbar';
import { Loader2, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';

// Lands here after Dodo's hosted checkout redirects back. The webhook is the
// authoritative source for credit/plan grants — this page just polls the
// user record until it observes the change (or times out) so the user gets
// immediate feedback that "yes, your payment landed".
//
// Why poll instead of trust the redirect: redirect can happen before the
// webhook fires (network race), and a successful redirect doesn't guarantee
// a successful payment.

type Phase = 'waiting' | 'success' | 'timeout';

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 15; // ~30s total

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function BillingReturnPage() {
  return (
    <Suspense fallback={<ReturnLoading />}>
      <BillingReturn />
    </Suspense>
  );
}

function ReturnLoading() {
  return (
    <div className="min-h-screen bg-[#FCFCFD] font-sans">
      <Navbar />
      <main className="pt-28 sm:pt-36 pb-20 sm:pb-28 px-4 sm:px-6 max-w-2xl mx-auto flex flex-col items-center">
        <div className="w-full bg-white/70 border border-black/5 rounded-[1.75rem] sm:rounded-[2rem] p-6 sm:p-10 flex flex-col items-center text-center">
          <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
        </div>
      </main>
    </div>
  );
}

type ApiUser = {
  creditsBalance: number;
  subscriptions?: Array<{ id: string; planKey: string; status: string }>;
};

const activeSubCount = (u: ApiUser): number =>
  Array.isArray(u.subscriptions)
    ? u.subscriptions.filter(s => s.status === 'ACTIVE' || s.status === 'CANCELED' || s.status === 'ON_HOLD').length
    : 0;

function BillingReturn() {
  const searchParams = useSearchParams();
  const kind = searchParams.get('kind'); // 'topup' | 'plan' | null
  const [phase, setPhase] = useState<Phase>('waiting');
  const [latestPlanKey, setLatestPlanKey] = useState<string>('');
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/login';
      return;
    }

    // Pre-checkout snapshot saved by /pricing right before redirecting. We
    // CANNOT snapshot on the first poll here because Dodo's webhook usually
    // fires before this page mounts — the first /auth/me already returns the
    // post-payment state, so a self-snapshot would never observe a "change".
    let pre: { balance?: number; subCount?: number; ts?: number } | null = null;
    try {
      const raw = sessionStorage.getItem('dodo_pre_checkout');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.ts === 'number' && Date.now() - parsed.ts < 30 * 60 * 1000) {
          pre = parsed;
        }
      }
    } catch { /* ignore parse errors */ }

    let cancelled = false;
    let polls = 0;

    const fetchMe = (): Promise<{ user?: ApiUser } | null> =>
      fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .catch(() => null);

    // Success conditions:
    //   plan  → subscription count grew vs. pre-checkout snapshot (any new
    //           sub means the activation webhook landed). If no snapshot,
    //           fall back to "at least one active sub exists".
    //   topup → balance strictly greater than the pre-checkout snapshot
    //           (or first poll if no snapshot).
    const isSuccess = (u: ApiUser, firstSeenBalance: number | null, firstSeenSubCount: number): boolean => {
      if (kind === 'plan') {
        const now = activeSubCount(u);
        if (pre && typeof pre.subCount === 'number') return now > pre.subCount;
        return now > firstSeenSubCount;
      }
      if (kind === 'topup') {
        if (pre && typeof pre.balance === 'number') return u.creditsBalance > pre.balance;
        if (firstSeenBalance !== null) return u.creditsBalance > firstSeenBalance;
        return false;
      }
      return false;
    };

    let firstSeenBalance: number | null = null;
    let firstSeenSubCount = 0;

    const tick = async () => {
      if (cancelled) return;
      const me = await fetchMe();
      if (cancelled) return;
      const u = me?.user;
      if (!u) {
        polls += 1;
        if (polls >= MAX_POLLS) setPhase('timeout');
        else setTimeout(tick, POLL_INTERVAL_MS);
        return;
      }
      if (firstSeenBalance === null) {
        firstSeenBalance = u.creditsBalance;
        firstSeenSubCount = activeSubCount(u);
      }

      if (isSuccess(u, firstSeenBalance, firstSeenSubCount)) {
        // For the plan flow, surface the newest sub's planKey in the success
        // copy ("You're now on PRO"). Newest = highest createdAt by index.
        if (kind === 'plan' && Array.isArray(u.subscriptions) && u.subscriptions.length > 0) {
          const newest = u.subscriptions[u.subscriptions.length - 1];
          setLatestPlanKey(newest.planKey);
        }
        setBalance(u.creditsBalance);
        setPhase('success');
        try { sessionStorage.removeItem('dodo_pre_checkout'); } catch { /* ignore */ }
        return;
      }
      polls += 1;
      if (polls >= MAX_POLLS) {
        setBalance(u.creditsBalance);
        setPhase('timeout');
      } else {
        setTimeout(tick, POLL_INTERVAL_MS);
      }
    };

    tick();
    return () => { cancelled = true; };
  }, [kind]);

  return (
    <div className="min-h-screen bg-[#FCFCFD] font-sans">
      <Navbar />
      <main className="pt-28 sm:pt-36 pb-20 sm:pb-28 px-4 sm:px-6 max-w-2xl mx-auto flex flex-col items-center">
        <div className="w-full bg-white/70 border border-black/5 rounded-[1.75rem] sm:rounded-[2rem] p-6 sm:p-10 shadow-[0_18px_50px_-30px_rgba(0,0,0,0.35)] flex flex-col items-center text-center">
          {phase === 'waiting' && (
            <>
              <div className="w-20 h-20 bg-white border border-black/5 shadow-lg rounded-2xl flex items-center justify-center mb-6">
                <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
              </div>
              <h1 className="text-2xl font-bold text-neutral-900 mb-2">Confirming your payment</h1>
              <p className="text-neutral-500 max-w-md">
                We&apos;re finalizing your transaction with our secure payment processor. This usually takes a few seconds.
              </p>
            </>
          )}

          {phase === 'success' && (
            <>
              <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(16,185,129,0.3)] text-white">
                <CheckCircle2 className="w-12 h-12" strokeWidth={3} />
              </div>
              <h1 className="text-3xl font-bold text-neutral-900 mb-2">
                {kind === 'plan' ? 'You’re all set' : 'Credits added'}
              </h1>
              <p className="text-neutral-500 mb-6 max-w-md">
                {kind === 'plan'
                  ? `Your ${latestPlanKey || 'new'} plan is now active. Any new credits stack on top of your existing balance.`
                  : 'Your top-up credits are now available in your account.'}
              </p>
              {balance !== null && (
                <div className="bg-green-50 text-green-800 font-semibold px-4 py-2 rounded-xl mb-8 border border-green-200">
                  Current balance: {balance.toLocaleString()} credits
                </div>
              )}
              <Link
                href="/studio"
                className="bg-gradient-to-r from-orange-500 to-amber-500 text-white h-14 px-8 rounded-2xl font-semibold shadow-[0_8px_20px_rgba(249,115,22,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
              >
                Go to Studio <ArrowRight className="w-5 h-5" />
              </Link>
            </>
          )}

          {phase === 'timeout' && (
            <>
              <div className="w-20 h-20 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center mb-6">
                <AlertCircle className="w-10 h-10 text-amber-600" />
              </div>
              <h1 className="text-2xl font-bold text-neutral-900 mb-2">Still confirming</h1>
              <p className="text-neutral-500 mb-6 max-w-md">
                Your payment is taking a little longer than usual to settle. Refresh this page in a minute, or head to the studio — your credits will appear automatically once confirmed.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => window.location.reload()}
                  className="bg-neutral-900 text-white h-12 px-6 rounded-2xl font-semibold hover:bg-neutral-800 transition-all"
                >
                  Refresh
                </button>
                <Link
                  href="/studio"
                  className="bg-white border border-black/10 text-neutral-900 h-12 px-6 rounded-2xl font-semibold hover:bg-neutral-50 transition-all flex items-center gap-2"
                >
                  Go to Studio <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </>
          )}

          <p className="text-xs text-neutral-400 mt-8 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" strokeWidth={2.25} /> Secured end-to-end by Linguamic
          </p>
        </div>
      </main>
    </div>
  );
}
