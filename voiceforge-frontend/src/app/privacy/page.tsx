import React from 'react';
import Navbar from '../../components/Navbar';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-[#FCFCFD] font-sans">
      <Navbar />
      <div className="pt-40 pb-32 px-6 max-w-3xl mx-auto">
        <h1 className="text-4xl font-semibold mb-4 text-neutral-900">Privacy Policy</h1>
        <p className="text-neutral-500 mb-12">Last updated: October 2023</p>
        
        <div className="prose prose-neutral max-w-none text-neutral-600 space-y-6">
          <h2 className="text-2xl font-medium text-neutral-900 mt-8 mb-4">1. Information We Collect</h2>
          <p>We collect information you provide directly to us, such as when you create or modify your account, request on-demand services, contact customer support, or otherwise communicate with us.</p>
          
          <h2 className="text-2xl font-medium text-neutral-900 mt-8 mb-4">2. Audio Data</h2>
          <p>VoiceForge processes text to generate audio. We do not permanently store the generated audio on our servers unless explicitly requested by the user. Generated audio is cached temporarily for performance reasons and automatically deleted.</p>
          
          <h2 className="text-2xl font-medium text-neutral-900 mt-8 mb-4">3. Third-Party Services</h2>
          <p>We use Google OAuth for authentication. Your use of Google Auth is subject to Google's Privacy Policy. We only retrieve your email and basic profile information necessary to create your account.</p>
        </div>
      </div>
    </div>
  );
}
