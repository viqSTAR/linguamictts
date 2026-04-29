import React from 'react';
import Navbar from '../../components/Navbar';

export default function Terms() {
  return (
    <div className="min-h-screen bg-[#FCFCFD] font-sans">
      <Navbar />
      <div className="pt-40 pb-32 px-6 max-w-3xl mx-auto">
        <h1 className="text-4xl font-semibold mb-4 text-neutral-900">Terms of Service</h1>
        <p className="text-neutral-500 mb-12">Last updated: October 2023</p>
        
        <div className="prose prose-neutral max-w-none text-neutral-600 space-y-6">
          <h2 className="text-2xl font-medium text-neutral-900 mt-8 mb-4">1. Acceptance of Terms</h2>
          <p>By accessing and using VoiceForge, you accept and agree to be bound by the terms and provision of this agreement.</p>
          
          <h2 className="text-2xl font-medium text-neutral-900 mt-8 mb-4">2. Use License</h2>
          <p>Permission is granted to temporarily download one copy of the materials (information or software) on VoiceForge's website for personal, non-commercial transitory viewing only.</p>
          
          <h2 className="text-2xl font-medium text-neutral-900 mt-8 mb-4">3. API Usage</h2>
          <p>You agree to not abuse the VoiceForge API. Rate limits are enforced. Any attempt to bypass rate limits or abuse the 12,000 free credits tier by creating multiple accounts will result in immediate termination of all associated accounts.</p>
        </div>
      </div>
    </div>
  );
}
