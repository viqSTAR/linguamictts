import React from 'react';
import Navbar from '../../components/Navbar';
import { Mail, MapPin } from 'lucide-react';

export default function Contact() {
  return (
    <div className="min-h-screen bg-[#FCFCFD] font-sans">
      <Navbar />
      <div className="pt-28 sm:pt-40 pb-20 sm:pb-32 px-4 sm:px-6 max-w-3xl mx-auto text-center">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold mb-4 sm:mb-6 text-neutral-900 tracking-tight">Get in touch.</h1>
        <p className="text-base sm:text-xl text-neutral-500 mb-10 sm:mb-16 font-light">Questions about the API, custom pricing, or technical support? Real humans on our team will get back to you.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 text-left">
          <div className="bg-white border border-black/5 p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] shadow-sm">
            <div className="w-11 h-11 sm:w-12 sm:h-12 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center mb-5 sm:mb-6">
              <Mail className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold text-neutral-900 mb-2">Email us</h3>
            <p className="text-neutral-500 mb-4 text-sm">For product questions, billing, partnerships, or technical support.</p>
            <a href="mailto:company@linguamic.com" className="text-orange-600 font-medium hover:text-orange-700 transition-colors break-all">company@linguamic.com</a>
          </div>

          <div className="bg-white border border-black/5 p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] shadow-sm">
            <div className="w-11 h-11 sm:w-12 sm:h-12 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center mb-5 sm:mb-6">
              <MapPin className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold text-neutral-900 mb-2">Headquarters</h3>
            <p className="text-neutral-500 mb-4 text-sm">Patna, Bihar, India</p>
            <span className="text-neutral-400 font-medium text-sm">Building for a global audience</span>
          </div>
        </div>
      </div>
    </div>
  );
}
