"use client";
import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '../../../components/Navbar';
import { Loader2, CheckCircle2, AlertCircle, ArrowRight, Sparkles } from 'lucide-react';

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
      <main className="pt-36 pb-28 px-6 max-w-2xl mx-auto flex flex-col items-center">
        <div className="w-full bg-white/70 border border-black/5 rounded-[2rem] p-10 flex flex-col items-center text-center">
          <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
        </div>
      </main>
    </div>
  );
}

function BillingReturn() {
  const searchParams = useSearchParams();
  const kind = searchParams.get('kind'); // 'topup' | 'plan' | null
  const [phase, setPhase] = useState<Phase>('waiting');
  const [plan, setPlan] = useState<string>('');
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/login';
      return;
    }

    // Snapshot the user state at landing so we can detect any change.
    let initial: { plan: string; balance: number } | null = null;
    let cancelled = false;
    let polls = 0;

    const fetchMe = () =>
      fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .catch(() => null);

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

      if (!initial) {
        initial = { plan: u.plan, balance: u.creditsBalance };
        polls += 1;
        if (polls >= MAX_POLLS) setPhase('timeout');
        else setTimeout(tick, POLL_INTERVAL_MS);
        return;
      }

      const planChanged = kind === 'plan' && u.plan !== initial.plan;
      const balanceIncreased = kind === 'topup' && u.creditsBalance > initial.balance;
      if (planChanged || balanceIncreased) {
        setPlan(u.plan);
        setBalance(u.creditsBalance);
        setPhase('success');
        return;
      }
      polls += 1;
      if (polls >= MAX_POLLS) {
        setPlan(u.plan);
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
      <main className="pt-36 pb-28 px-6 max-w-2xl mx-auto flex flex-col items-center">
        <div className="w-full bg-white/70 border border-black/5 rounded-[2rem] p-10 shadow-[0_18px_50px_-30px_rgba(0,0,0,0.35)] flex flex-col items-center text-center">
          {phase === 'waiting' && (
            <>
              <div className="w-20 h-20 bg-white border border-black/5 shadow-lg rounded-2xl flex items-center justify-center mb-6">
                <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
              </div>
              <h1 className="text-2xl font-bold text-neutral-900 mb-2">Confirming your payment...</h1>
              <p className="text-neutral-500 max-w-md">
                We&apos;re waiting for confirmation from Dodo Payments. This usually takes a few seconds.
              </p>
            </>
          )}

          {phase === 'success' && (
            <>
              <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(16,185,129,0.3)] text-white">
                <CheckCircle2 className="w-12 h-12" strokeWidth={3} />
              </div>
              <h1 className="text-3xl font-bold text-neutral-900 mb-2">
                {kind === 'plan' ? 'Plan upgraded!' : 'Credits added!'}
              </h1>
              <p className="text-neutral-500 mb-6 max-w-md">
                {kind === 'plan'
                  ? `You're now on the ${plan} plan. Your credits are ready to use.`
                  : 'Your add-on credits have been added to your account.'}
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
              <h1 className="text-2xl font-bold text-neutral-900 mb-2">Still confirming...</h1>
              <p className="text-neutral-500 mb-6 max-w-md">
                Your payment may still be processing on Dodo&apos;s side. Refresh this page in a minute, or head to the studio — your credits will appear automatically once confirmed.
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
            <Sparkles className="w-3 h-3" /> Powered by Dodo Payments
          </p>
        </div>
      </main>
    </div>
  );
}
