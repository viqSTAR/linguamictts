"use client";

import React, { useState, useEffect } from 'react';
import { motion, useScroll } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function Navbar() {
  const { scrollY } = useScroll();
  const [isScrolled, setIsScrolled] = useState(false);
  const [ctaHref, setCtaHref] = useState('/register');

  useEffect(() => {
    return scrollY.onChange((latest) => {
      setIsScrolled(latest > 20);
    });
  }, [scrollY]);

  useEffect(() => {
    const updateCtaHref = () => {
      if (typeof window === 'undefined') return;
      const token = localStorage.getItem('token');
      setCtaHref(token ? '/studio' : '/register');
    };

    updateCtaHref();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'token') {
        updateCtaHref();
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return (
    <div className="fixed top-6 left-0 right-0 z-50 flex justify-center px-6 pointer-events-none">
      <motion.div 
        className="flex items-center pointer-events-auto rounded-full overflow-hidden"
        initial={false}
        animate={isScrolled ? "scrolled" : "top"}
        variants={{
          top: { 
            gap: "100px", 
            backgroundColor: "rgba(255, 255, 255, 0)",
            backdropFilter: "blur(0px) saturate(100%)",
            boxShadow: "0 0 0 rgba(0,0,0,0), inset 0 0 0 rgba(255,255,255,0)",
            border: "1px solid rgba(0,0,0,0)"
          },
          scrolled: { 
            gap: "0px", 
            backgroundColor: "rgba(255, 255, 255, 0.35)",
            backdropFilter: "blur(24px) saturate(180%)",
            boxShadow: "0 24px 48px -12px rgba(0,0,0,0.1), inset 0 1px 1px rgba(255,255,255,0.9), inset 0 -1px 1px rgba(255,255,255,0.4)",
            border: "1px solid rgba(255, 255, 255, 0.6)"
          }
        }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Logo Section */}
        <motion.div 
          className="h-14 flex items-center justify-center px-6"
          variants={{
            top: { 
              backgroundColor: "rgba(255, 255, 255, 1)", 
              borderRadius: "9999px",
              border: "1px solid rgba(0,0,0,0.05)",
              boxShadow: "0 12px 30px -10px rgba(0,0,0,0.08), 0 0 24px rgba(249, 115, 22, 0.15)"
            },
            scrolled: { 
              backgroundColor: "rgba(255, 255, 255, 0)", 
              borderRadius: "9999px",
              border: "1px solid rgba(0,0,0,0)",
              boxShadow: "0 4px 12px rgba(0,0,0,0)"
            }
          }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight hover:opacity-70 transition-opacity">
             <div className="w-5 h-5 bg-black rounded-sm" />
             VOICEFORGE
          </Link>
        </motion.div>

        {/* Links Section */}
        <motion.div 
          className="h-14 hidden md:flex items-center px-8"
          variants={{
            top: { 
              backgroundColor: "rgba(255, 255, 255, 1)", 
              borderRadius: "9999px",
              border: "1px solid rgba(0,0,0,0.05)",
              boxShadow: "0 12px 30px -10px rgba(0,0,0,0.08), 0 0 24px rgba(249, 115, 22, 0.15)"
            },
            scrolled: { 
              backgroundColor: "rgba(255, 255, 255, 0)", 
              borderRadius: "9999px",
              border: "1px solid rgba(0,0,0,0)",
              boxShadow: "0 4px 12px rgba(0,0,0,0)"
            }
          }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-center gap-8 font-medium text-sm text-[#444]">
            <Link href="/#use-cases" className="hover:text-black transition-colors">Use Cases</Link>
            <Link href="/samples" className="hover:text-black transition-colors">Voices</Link>
            <Link href="/pricing" className="hover:text-black transition-colors">Pricing</Link>
            <Link href="/contact" className="hover:text-black transition-colors">Contact</Link>
            <Link href="/studio" className="hover:text-black transition-colors">Studio</Link>
          </div>
        </motion.div>

        {/* CTA Section */}
        <motion.div 
          className="h-14 flex items-center justify-center"
          variants={{
            top: { 
              backgroundColor: "rgba(255, 255, 255, 1)", 
              borderRadius: "9999px",
              border: "1px solid rgba(0,0,0,0.05)",
              boxShadow: "0 12px 30px -10px rgba(0,0,0,0.08), 0 0 24px rgba(249, 115, 22, 0.15)",
              padding: "0 0.5rem"
            },
            scrolled: { 
              backgroundColor: "rgba(255, 255, 255, 0)", 
              borderRadius: "9999px",
              border: "1px solid rgba(0,0,0,0)",
              boxShadow: "0 4px 12px rgba(0,0,0,0)",
              padding: "0 1.5rem"
            }
          }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <Link href={ctaHref} className="h-10 px-5 rounded-full bg-black text-white font-semibold text-sm flex items-center gap-2 hover:bg-neutral-800 transition-colors">
            Get Started <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}
