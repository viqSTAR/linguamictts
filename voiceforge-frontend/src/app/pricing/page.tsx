"use client";
import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../../components/Navbar';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Sparkles, Loader2, CreditCard, X, CheckCircle2, ArrowRight, Zap } from 'lucide-react';

type Subscription = {
  id: string;
  planKey: string;
  monthlyCredits: number;
  creditsRemaining: number;
  status: 'ACTIVE' | 'CANCELED' | 'ON_HOLD' | 'FAILED';
  autoRenew: boolean;
  currentPeriodEnd: string;
  canceledAt: string | null;
  createdAt: string;
};

const PLAN_DEFINITIONS = [
  {
    key: 'FREE',
    name: 'Free',
    price: '$0',
    priceNum: 0,
    cadence: '/month',
    credits: '10,000 credits / month',
    bonus: '12,000 credits first month',
    cta: 'Get started free',
    badge: 'Starter Pack',
    theme: 'bg-white/70 border-black/5',
    accent: 'text-emerald-600',
    highlight: 'bg-emerald-50',
    features: ['Text-to-speech API access', 'Standard voices', 'Community support', 'Usage dashboard'],
  },
  {
    key: 'STARTER',
    name: 'Starter',
    price: '$4.99',
    priceNum: 4.99,
    cadence: '/month',
    credits: '45,000 credits / month',
    bonus: 'Commercial usage rights',
    cta: 'Choose Starter',
    badge: 'Beginner',
    theme: 'bg-white/80 border-black/5',
    accent: 'text-orange-600',
    highlight: 'bg-orange-50',
    features: ['All Free features', 'Faster throughput tier', 'API key management', 'Email support'],
  },
  {
    key: 'CREATOR',
    name: 'Creator',
    price: '$18.99',
    priceNum: 18.99,
    cadence: '/month',
    credits: '210,000 credits / month',
    bonus: 'Priority model queue',
    cta: 'Choose Creator',
    badge: 'Most popular',
    theme: 'bg-black text-white border-black/80',
    accent: 'text-orange-300',
    highlight: 'bg-orange-500/15',
    features: ['Everything in Starter', 'Priority model queue', 'Team usage insights', 'Pro voice controls'],
  },
  {
    key: 'PRO',
    name: 'Pro',
    price: '$79.99',
    priceNum: 79.99,
    cadence: '/month',
    credits: '850,000 credits / month',
    bonus: 'High-volume creators',
    cta: 'Choose Pro',
    badge: 'Studio grade',
    theme: 'bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200/60',
    accent: 'text-orange-700',
    highlight: 'bg-orange-100',
    features: ['Everything in Creator', 'Higher concurrency', 'Premium voice catalog', 'Priority support'],
  },
];

const PLAN_CREDITS: Record<string, number> = {
  STARTER: 45000,
  CREATOR: 210000,
  PRO: 850000,
};

const TOPUP_TIERS = [
  { amountUSD: 1,  credits: 5000  },
  { amountUSD: 5,  credits: 25000 },
  { amountUSD: 10, credits: 55000 },
];

type ModalState = {
  open: boolean;
  step: 'confirm' | 'processing' | 'success';
  mode: 'topup' | 'plan';
  // topup
  amountUSD: number;
  creditsToAdd: number;
  // plan
  planKey: string;
  planName: string;
  planPrice: string;
  // result
  newBalance: number;
  newPlan: string;
};

const defaultModal: ModalState = {
  open: false, step: 'confirm', mode: 'topup',
  amountUSD: 0, creditsToAdd: 0,
  planKey: '', planName: '', planPrice: '',
  newBalance: 0, newPlan: '',
};

export default function Pricing() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [modal, setModal] = useState<ModalState>(defaultModal);
  // /billing/plans reports whether Dodo is wired up. Dummy/mock paths are
  // gone — if Dodo isn't enabled the buy buttons are disabled.
  const [dodoEnabled, setDodoEnabled] = useState(false);
  const [activeSubs, setActiveSubs] = useState<Subscription[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [subBusyId, setSubBusyId] = useState<string | null>(null);

  const fetchActiveSubs = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    setSubsLoading(true);
    try {
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000') + '/billing/subscriptions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.subscriptions)) setActiveSubs(data.subscriptions);
    } catch { /* non-fatal */ }
    finally { setSubsLoading(false); }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    setIsLoggedIn(!!token);
    if (token) fetchActiveSubs();
    fetch((process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000') + '/billing/plans')
      .then(r => r.json())
      .then(d => { if (typeof d.dodoEnabled === 'boolean') setDodoEnabled(d.dodoEnabled); })
      .catch(() => {});
  }, [fetchActiveSubs]);

  const performSubAction = async (subId: string, action: 'cancel' | 'resume' | 'autopay', body?: object) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    setSubBusyId(subId);
    try {
      const res = await fetch(
        (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000') +
          `/billing/subscriptions/${subId}/${action}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: body ? JSON.stringify(body) : undefined,
        },
      );
      const data = await res.json();
      if (!res.ok) alert(data.error || 'Action failed');
      await fetchActiveSubs();
    } catch {
      alert('Network error. Try again.');
    } finally {
      setSubBusyId(null);
    }
  };

  const openTopUp = (amountUSD: number, credits: number) => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login'; return; }
    setModal({ ...defaultModal, open: true, step: 'confirm', mode: 'topup', amountUSD, creditsToAdd: credits });
  };

  const openPlanUpgrade = (plan: typeof PLAN_DEFINITIONS[0]) => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login'; return; }
    setModal({
      ...defaultModal, open: true, step: 'confirm', mode: 'plan',
      planKey: plan.key, planName: plan.name, planPrice: plan.price,
      creditsToAdd: PLAN_CREDITS[plan.key] || 0,
    });
  };

  const closeModal = () => {
    if (modal.step === 'processing') return;
    setModal(defaultModal);
  };

  // Redirects the browser to a Dodo-hosted checkout. Credit/plan grants
  // happen on Dodo's webhook, not in this flow — when the user returns we
  // poll /auth/me on /billing/return to surface the new balance.
  const redirectToDodo = async (payload: { kind: 'topup'; amountUSD: number } | { kind: 'plan'; plan: string }) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    setModal(p => ({ ...p, step: 'processing' }));
    try {
      // Snapshot the user's pre-payment state so /billing/return can detect
      // the credit/plan change even if Dodo's webhook lands before our
      // first poll (which is the common case — webhook is faster than the
      // user's redirect back). Without this, the return page snapshots
      // the already-updated state and never sees a "change" → false timeout.
      try {
        const meRes = await fetch((process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000') + '/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const meData = await meRes.json();
        if (meData?.user) {
          const subCount = Array.isArray(meData.user.subscriptions)
            ? meData.user.subscriptions.filter((s: { status?: string }) =>
                s.status === 'ACTIVE' || s.status === 'CANCELED' || s.status === 'ON_HOLD').length
            : 0;
          sessionStorage.setItem('dodo_pre_checkout', JSON.stringify({
            balance: meData.user.creditsBalance,
            subCount,
            kind: payload.kind,
            ts: Date.now(),
          }));
        }
      } catch { /* non-fatal: return page has absolute-state fallback */ }

      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000') + '/billing/dodo/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      alert(`Error: ${data.error || 'Failed to start checkout'}`);
      setModal(defaultModal);
    } catch {
      alert('Network error while starting checkout.');
      setModal(defaultModal);
    }
  };

  const processTopUp = async () => {
    if (!dodoEnabled) {
      alert('Payments are temporarily unavailable. Please try again later.');
      return;
    }
    await redirectToDodo({ kind: 'topup', amountUSD: modal.amountUSD });
  };

  const processPlanUpgrade = async () => {
    if (!dodoEnabled) {
      alert('Payments are temporarily unavailable. Please try again later.');
      return;
    }
    await redirectToDodo({ kind: 'plan', plan: modal.planKey });
  };

  return (
    <div className="min-h-screen bg-[#FCFCFD] font-sans relative overflow-x-hidden selection:bg-orange-500/30">
      <Navbar />

      <div className="absolute inset-0 w-full h-full pointer-events-none z-0 flex justify-center">
        <div className="absolute top-[-10%] w-[120vw] h-[80vh] bg-gradient-to-br from-orange-400/20 via-orange-300/10 to-transparent blur-[140px]" />
      </div>

      <main className="pt-36 pb-28 px-6 max-w-7xl mx-auto relative z-10 flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h1 className="text-5xl md:text-6xl font-medium tracking-tight text-[#0A0A0A] mb-6">Pricing built for builders.</h1>
          <p className="text-xl text-neutral-500 max-w-2xl mx-auto font-light">Launch for free, then scale with a predictable credit system designed to stay 60% cheaper.</p>
        </motion.div>

        {/* Active subscriptions — only renders for logged-in users with at least one paid sub. */}
        {isLoggedIn && activeSubs.length > 0 && (
          <div className="w-full mb-12 bg-white/80 backdrop-blur-xl border border-black/5 rounded-[2rem] p-6 md:p-8 shadow-[0_18px_50px_-30px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-semibold text-neutral-900">Your active plans</h2>
              <span className="text-xs uppercase tracking-widest text-neutral-400">{activeSubs.length} active</span>
            </div>
            <div className="space-y-3">
              {activeSubs.map(s => {
                const periodEnd = new Date(s.currentPeriodEnd);
                const cancelled = s.status === 'CANCELED' || s.autoRenew === false;
                const onHold = s.status === 'ON_HOLD';
                const failed = s.status === 'FAILED';
                return (
                  <div key={s.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-2xl border border-black/5 bg-neutral-50/60">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-neutral-900">{s.planKey}</span>
                        <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full ${
                          failed ? 'bg-red-100 text-red-700' :
                          onHold ? 'bg-amber-100 text-amber-800' :
                          cancelled ? 'bg-neutral-200 text-neutral-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {failed ? 'Failed' : onHold ? 'On hold' : cancelled ? 'Auto-pay off' : 'Active'}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500 mt-1">
                        {s.creditsRemaining.toLocaleString()} / {s.monthlyCredits.toLocaleString()} credits
                        {' · '}
                        {cancelled ? 'Ends' : 'Renews'} {periodEnd.toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!cancelled && !failed && !onHold && (
                        <button
                          onClick={() => performSubAction(s.id, 'autopay', { enabled: false })}
                          disabled={subBusyId === s.id}
                          className="text-xs h-9 px-3 rounded-xl border border-neutral-200 hover:bg-neutral-100 transition-colors text-neutral-700 disabled:opacity-50"
                        >
                          Turn auto-pay off
                        </button>
                      )}
                      {cancelled && !failed && (
                        <button
                          onClick={() => performSubAction(s.id, 'autopay', { enabled: true })}
                          disabled={subBusyId === s.id}
                          className="text-xs h-9 px-3 rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 transition-colors disabled:opacity-50"
                        >
                          Re-enable auto-pay
                        </button>
                      )}
                      {!cancelled && !failed && (
                        <button
                          onClick={() => {
                            if (confirm(`Cancel your ${s.planKey} subscription? You keep access until ${periodEnd.toLocaleDateString()}.`)) {
                              performSubAction(s.id, 'cancel');
                            }
                          }}
                          disabled={subBusyId === s.id}
                          className="text-xs h-9 px-3 rounded-xl border border-red-200 text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {subsLoading && <p className="text-xs text-neutral-400 mt-3">Refreshing…</p>}
            <p className="text-xs text-neutral-400 mt-4">
              Credits drain from your oldest plan first, then newer plans, then permanent top-ups.
            </p>
          </div>
        )}

        <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-6 w-full">
          {PLAN_DEFINITIONS.map((plan, index) => {
            const isFreePlan = plan.key === 'FREE';
            const heldCount = activeSubs.filter(s => s.planKey === plan.key && (s.status === 'ACTIVE' || s.status === 'CANCELED')).length;

            let ctaButton;
            if (isFreePlan) {
              ctaButton = (
                <Link
                  href={isLoggedIn ? '/studio' : '/register'}
                  className={`w-full h-12 rounded-full font-semibold flex items-center justify-center transition-all mb-8 relative z-10 bg-neutral-900 text-white hover:bg-neutral-800`}
                >
                  {plan.cta}
                </Link>
              );
            } else if (isLoggedIn) {
              ctaButton = (
                <button
                  onClick={() => openPlanUpgrade(plan)}
                  className={`w-full h-12 rounded-full font-semibold flex items-center justify-center transition-all mb-8 relative z-10 ${
                    plan.key === 'CREATOR'
                      ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600'
                      : 'bg-neutral-900 text-white hover:bg-neutral-800'
                  }`}
                >
                  {heldCount > 0 ? `Buy another ${plan.name}` : plan.cta}
                </button>
              );
            } else {
              ctaButton = (
                <Link
                  href="/login"
                  className={`w-full h-12 rounded-full font-semibold flex items-center justify-center transition-all mb-8 relative z-10 ${
                    plan.key === 'CREATOR'
                      ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600'
                      : 'bg-neutral-900 text-white hover:bg-neutral-800'
                  }`}
                >
                  {plan.cta}
                </Link>
              );
            }

            return (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.1 + index * 0.05 }}
                className={`${plan.theme} backdrop-blur-2xl border rounded-[2rem] p-7 md:p-8 shadow-[0_18px_50px_-30px_rgba(0,0,0,0.35)] hover:-translate-y-1 transition-all flex flex-col relative overflow-hidden ${heldCount > 0 ? 'ring-2 ring-green-400/50' : ''}`}
              >
                <div className={`absolute -top-16 -right-12 h-32 w-32 rounded-full ${plan.highlight} blur-[60px] opacity-70`} />
                <div className="flex items-center justify-between mb-6 relative z-10">
                  <span className={`text-xs font-semibold uppercase tracking-widest ${plan.accent}`}>{plan.badge}</span>
                  {plan.key === 'CREATOR' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/20 text-orange-200 px-2.5 py-1 text-[10px] font-semibold uppercase">
                      <Sparkles className="w-3 h-3" /> Popular
                    </span>
                  )}
                  {heldCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-500/20 text-green-700 px-2.5 py-1 text-[10px] font-semibold uppercase">
                      <Check className="w-3 h-3" /> {heldCount > 1 ? `${heldCount} active` : 'Active'}
                    </span>
                  )}
                </div>
                <h3 className="text-2xl font-semibold mb-2 relative z-10">{plan.name}</h3>
                <div className="flex items-baseline gap-2 mb-3 relative z-10">
                  <span className="text-4xl font-bold tracking-tight">{plan.price}</span>
                  <span className="text-neutral-400 font-medium">{plan.cadence}</span>
                </div>
                <p className="text-sm text-neutral-500 mb-6 relative z-10">{plan.credits}</p>
                <div className={`text-xs font-semibold px-3 py-2 rounded-xl ${plan.highlight} ${plan.accent} mb-6 relative z-10`}>
                  {plan.bonus}
                </div>
                {ctaButton}
                <ul className="space-y-3 mt-auto relative z-10">
                  {plan.features.map(feature => (
                    <li key={feature} className="flex items-center gap-3 text-sm text-neutral-500">
                      <div className="w-5 h-5 rounded-full bg-black/5 flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 text-neutral-500" strokeWidth={3} />
                      </div>
                      {feature}
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>

        {/* Add-on Top-Ups */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-120px' }} transition={{ duration: 0.5 }}
          className="mt-14 w-full max-w-4xl"
        >
          <div className="bg-white/70 border border-black/5 rounded-[2rem] p-6 md:p-8 shadow-[0_18px_50px_-30px_rgba(0,0,0,0.35)] flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <h3 className="text-2xl font-semibold text-neutral-900 mb-2">Add-on credits</h3>
              <p className="text-neutral-500">Top up anytime for spikes or big launches.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {TOPUP_TIERS.map(t => (
                <button
                  key={t.amountUSD}
                  onClick={() => openTopUp(t.amountUSD, t.credits)}
                  className="px-5 py-3 rounded-2xl bg-neutral-900 hover:bg-black transition-colors text-white font-semibold flex items-center gap-2 min-w-[140px] justify-center"
                >
                  <Zap className="w-4 h-4 text-amber-400" />
                  ${t.amountUSD} → {(t.credits / 1000).toFixed(0)}k credits
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      </main>

      {/* Modal */}
      <AnimatePresence>
        {modal.open && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm"
              onClick={closeModal}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white/90 backdrop-blur-2xl border border-white/50 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] rounded-[2rem] overflow-hidden"
            >
              {modal.step !== 'processing' && modal.step !== 'success' && (
                <button onClick={closeModal} className="absolute top-4 right-4 p-2 text-neutral-400 hover:bg-neutral-100 rounded-full transition-colors z-10">
                  <X className="w-5 h-5" />
                </button>
              )}

              <div className="p-8 flex flex-col">
                {modal.step === 'confirm' && (
                  <>
                    <div className="flex items-center gap-3 mb-6 pb-6 border-b border-black/5">
                      <div className="w-12 h-12 bg-gradient-to-br from-orange-100 to-orange-50 rounded-xl border border-orange-200 flex items-center justify-center shadow-inner">
                        {modal.mode === 'plan' ? <Sparkles className="w-6 h-6 text-orange-500" /> : <CreditCard className="w-6 h-6 text-orange-500" />}
                      </div>
                      <div className="text-left">
                        <h2 className="text-xl font-bold text-neutral-900">
                          {modal.mode === 'plan' ? `Upgrade to ${modal.planName}` : 'Add Credits'}
                        </h2>
                        <p className="text-sm text-neutral-500">{modal.creditsToAdd.toLocaleString()} credits</p>
                      </div>
                    </div>

                    <div className="text-left mb-6 p-4 bg-neutral-50 border border-neutral-200 rounded-2xl">
                      <p className="text-sm text-neutral-700 mb-2 font-medium">Secure checkout by Dodo Payments</p>
                      <p className="text-xs text-neutral-500 leading-relaxed">
                        You&apos;ll be redirected to a hosted checkout page to complete payment.
                        {modal.mode === 'plan'
                          ? ' Your plan will activate and credits will appear after payment is confirmed.'
                          : ' Credits will appear in your account once payment is confirmed.'}
                      </p>
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t border-black/5 mb-6">
                      <span className="text-neutral-900 font-semibold">
                        {modal.mode === 'plan' ? modal.planName + ' Plan' : 'Total Due'}
                      </span>
                      <span className="text-2xl font-bold text-orange-600">
                        {modal.mode === 'plan' ? modal.planPrice : `$${modal.amountUSD.toFixed(2)}`}
                      </span>
                    </div>

                    <button
                      onClick={modal.mode === 'plan' ? processPlanUpgrade : processTopUp}
                      disabled={!dodoEnabled}
                      className="w-full bg-black text-white h-14 rounded-2xl font-semibold shadow-[0_8px_20px_rgba(0,0,0,0.15)] hover:bg-neutral-800 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {dodoEnabled ? 'Continue to secure checkout' : 'Payments temporarily unavailable'}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <p className="text-xs text-neutral-400 mt-4 flex items-center gap-1 justify-center">
                      <Sparkles className="w-3 h-3" /> Powered by Dodo Payments
                    </p>
                  </>
                )}

                {modal.step === 'processing' && (
                  <div className="py-12 flex flex-col items-center">
                    <div className="relative mb-8">
                      <div className="absolute inset-0 bg-orange-500 blur-xl opacity-20 rounded-full animate-pulse" />
                      <div className="w-20 h-20 bg-white border border-black/5 shadow-lg rounded-2xl flex items-center justify-center relative z-10">
                        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
                      </div>
                    </div>
                    <h2 className="text-xl font-bold text-neutral-900 mb-2">
                      {modal.mode === 'plan' ? 'Upgrading Plan...' : 'Processing Payment'}
                    </h2>
                    <p className="text-neutral-500 animate-pulse">
                      {dodoEnabled ? 'Opening secure checkout...' : 'Contacting dummy bank...'}
                    </p>
                  </div>
                )}

                {modal.step === 'success' && (
                  <div className="py-8 flex flex-col items-center">
                    <motion.div
                      initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.5 }}
                      className="w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(16,185,129,0.3)] text-white"
                    >
                      <CheckCircle2 className="w-12 h-12" strokeWidth={3} />
                    </motion.div>
                    <h2 className="text-3xl font-bold text-neutral-900 mb-2">
                      {modal.mode === 'plan' ? 'Plan Upgraded!' : 'Credits Added!'}
                    </h2>
                    <p className="text-neutral-500 mb-6 max-w-[260px] text-center">
                      {modal.mode === 'plan'
                        ? `You're now on the ${modal.newPlan} plan with ${modal.creditsToAdd.toLocaleString()} credits.`
                        : `${modal.creditsToAdd.toLocaleString()} credits have been added to your account.`}
                    </p>
                    <div className="bg-green-50 text-green-800 font-semibold px-4 py-2 rounded-xl mb-8 border border-green-200">
                      New Balance: {modal.newBalance.toLocaleString()} credits
                    </div>
                    <Link
                      href="/studio"
                      className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white h-14 rounded-2xl font-semibold shadow-[0_8px_20px_rgba(249,115,22,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                      Go to Studio <ArrowRight className="w-5 h-5" />
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

