"use client";

import React, { useState, useEffect } from 'react';
import { motion, useScroll, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, Menu, X } from 'lucide-react';
import Image from 'next/image';
import logo from '@/assets/linguamicorange copy.png';

const NAV_LINKS: { href: string; label: string }[] = [
  { href: '/#use-cases', label: 'Use Cases' },
  { href: '/samples', label: 'Voices' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/contact', label: 'Contact' },
  { href: '/studio', label: 'Studio' },
];

export default function Navbar() {
  const { scrollY } = useScroll();
  const [isScrolled, setIsScrolled] = useState(false);
  const [ctaHref, setCtaHref] = useState('/register');
  const [mobileOpen, setMobileOpen] = useState(false);

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

  // Lock body scroll while the mobile drawer is open so the backdrop feels solid.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  return (
    <>
      <div className="fixed top-4 md:top-6 left-0 right-0 z-50 flex justify-center px-3 md:px-6 pointer-events-none">
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
            className="h-12 md:h-14 flex items-center justify-center px-4 md:px-6"
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
            <Link href="/" className="flex items-center gap-2 font-bold text-base md:text-lg tracking-tight hover:opacity-70 transition-opacity">
              <Image src={logo} alt="Linguamic Logo" className="w-5 h-5 md:w-6 md:h-6 object-contain" />
              LINGUAMIC
            </Link>
          </motion.div>

          {/* Desktop Links Section */}
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
              {NAV_LINKS.map(link => (
                <Link key={link.href} href={link.href} className="hover:text-black transition-colors">{link.label}</Link>
              ))}
            </div>
          </motion.div>

          {/* CTA Section (desktop only) */}
          <motion.div
            className="h-14 hidden md:flex items-center justify-center"
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

          {/* Mobile hamburger (replaces desktop links + CTA) */}
          <motion.button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="h-12 md:hidden flex items-center justify-center px-4"
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
            <Menu className="w-5 h-5 text-neutral-900" />
          </motion.button>
        </motion.div>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.button
              type="button"
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm md:hidden"
            />
            <motion.div
              key="drawer"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="fixed top-0 right-0 bottom-0 z-50 w-[78vw] max-w-xs bg-white shadow-2xl md:hidden flex flex-col"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-black/5">
                <Link href="/" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 font-bold text-base tracking-tight">
                  <Image src={logo} alt="Linguamic Logo" className="w-5 h-5 object-contain" />
                  LINGUAMIC
                </Link>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close menu"
                  className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-neutral-100 transition-colors"
                >
                  <X className="w-5 h-5 text-neutral-700" />
                </button>
              </div>
              <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
                {NAV_LINKS.map(link => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="px-3 py-3 rounded-xl text-sm font-medium text-neutral-700 hover:bg-orange-50 hover:text-orange-700 transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
              <div className="px-5 py-5 border-t border-black/5">
                <Link
                  href={ctaHref}
                  onClick={() => setMobileOpen(false)}
                  className="w-full h-11 rounded-full bg-black text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-neutral-800 transition-colors"
                >
                  Get Started <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
