"use client";
import React from 'react';
import Navbar from '../../components/Navbar';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Check, Sparkles } from 'lucide-react';

export default function Pricing() {
  return (
    <div className="min-h-screen bg-[#FCFCFD] font-sans relative overflow-x-hidden selection:bg-orange-500/30">
      <Navbar />

      {/* Background Decor */}
      <div className="absolute inset-0 w-full h-full pointer-events-none z-0 flex justify-center">
        <div className="absolute top-[-10%] w-[120vw] h-[80vh] bg-gradient-to-br from-orange-400/20 via-orange-300/10 to-transparent blur-[140px]" />
      </div>

      <main className="pt-40 pb-32 px-6 max-w-7xl mx-auto relative z-10 flex flex-col items-center">
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h1 className="text-5xl md:text-6xl font-medium tracking-tight text-[#0A0A0A] mb-6">Simple, transparent pricing.</h1>
          <p className="text-xl text-neutral-500 max-w-2xl mx-auto font-light">Start building for free, then scale alongside your audience with our flexible premium tiers.</p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl w-full">
          {/* Free Tier */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-white/60 backdrop-blur-2xl border border-black/5 rounded-[2rem] p-8 md:p-12 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.08)] transition-all flex flex-col"
          >
            <h3 className="text-2xl font-semibold text-neutral-900 mb-2">Hobbyist</h3>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-5xl font-bold tracking-tight text-neutral-900">$0</span>
              <span className="text-neutral-500 font-medium">/month</span>
            </div>
            <p className="text-neutral-500 mb-8 font-light">Perfect for testing the API and personal projects.</p>
            
            <Link href="/register" className="w-full h-14 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 rounded-full font-semibold flex items-center justify-center transition-colors mb-10">
              Start for free
            </Link>

            <ul className="space-y-4 mt-auto">
              {['12,000 text-to-speech credits per month', 'Access to 10 standard voices', 'Standard API access', 'Community Support'].map((feature, i) => (
                <li key={i} className="flex items-center gap-3 text-neutral-700">
                  <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 text-green-600" strokeWidth={3} />
                  </div>
                  {feature}
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Pro Tier */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-black text-white rounded-[2rem] p-8 md:p-12 shadow-[0_30px_60px_-15px_rgba(249,115,22,0.3)] relative overflow-hidden flex flex-col"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/30 rounded-full blur-[80px]" />
            <div className="absolute inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/20 text-orange-400 text-xs font-semibold top-8 right-8 border border-orange-500/30">
              <Sparkles className="w-3 h-3" /> Most Popular
            </div>
            
            <h3 className="text-2xl font-semibold mb-2 relative z-10">Creator Pro</h3>
            <div className="flex items-baseline gap-1 mb-6 relative z-10">
              <span className="text-5xl font-bold tracking-tight">$29</span>
              <span className="text-neutral-400 font-medium">/month</span>
            </div>
            <p className="text-neutral-400 mb-8 font-light relative z-10">For serious creators who need premium cinematic quality.</p>
            
            <Link href="/register" className="w-full h-14 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-full font-semibold flex items-center justify-center transition-all hover:scale-[1.02] active:scale-[0.98] mb-10 shadow-lg relative z-10">
              Upgrade to Pro
            </Link>

            <ul className="space-y-4 mt-auto relative z-10">
              {['250,000 text-to-speech credits per month', 'Access to all 120+ premium cinematic voices', 'Commercial usage rights', 'Ultra-low latency API', 'Priority 24/7 Email Support'].map((feature, i) => (
                <li key={i} className="flex items-center gap-3 text-neutral-300">
                  <div className="w-5 h-5 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 text-orange-500" strokeWidth={3} />
                  </div>
                  {feature}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

      </main>
    </div>
  );
}
