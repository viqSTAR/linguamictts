import React from 'react';
import Navbar from '../../components/Navbar';
import { Mail, MapPin } from 'lucide-react';

export default function Contact() {
  return (
    <div className="min-h-screen bg-[#FCFCFD] font-sans">
      <Navbar />
      <div className="pt-40 pb-32 px-6 max-w-3xl mx-auto text-center">
        <h1 className="text-4xl md:text-5xl font-semibold mb-6 text-neutral-900 tracking-tight">Get in touch.</h1>
        <p className="text-xl text-neutral-500 mb-16 font-light">Have questions about our API, enterprise pricing, or need technical support? We're here to help.</p>
        
        <div className="grid md:grid-cols-2 gap-6 text-left">
          <div className="bg-white border border-black/5 p-8 rounded-[2rem] shadow-sm">
            <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center mb-6">
              <Mail className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold text-neutral-900 mb-2">Email Support</h3>
            <p className="text-neutral-500 mb-4 text-sm">For general inquiries and technical assistance.</p>
            <a href="mailto:support@voiceforge.ai" className="text-orange-600 font-medium hover:text-orange-700 transition-colors">support@voiceforge.ai</a>
          </div>

          <div className="bg-white border border-black/5 p-8 rounded-[2rem] shadow-sm">
            <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center mb-6">
              <MapPin className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold text-neutral-900 mb-2">Headquarters</h3>
            <p className="text-neutral-500 mb-4 text-sm">San Francisco, California</p>
            <span className="text-neutral-400 font-medium text-sm">Remote First Company</span>
          </div>
        </div>
      </div>
    </div>
  );
}
