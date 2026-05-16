"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Navbar from "./Navbar";

type NavItem = {
  label: string;
  href: string;
};

type DocsLayoutProps = {
  title: string;
  subtitle: string;
  effectiveDate?: string;
  children: React.ReactNode;
};

type DocSectionProps = {
  number?: string;
  title: string;
  children: React.ReactNode;
};

const navItems: NavItem[] = [
  { label: "Terms", href: "/terms" },
  { label: "Privacy", href: "/privacy" },
  { label: "About", href: "/about" },
  { label: "Attributions", href: "/attributions" },
];

export function DocSection({ number, title, children }: DocSectionProps) {
  return (
    <section className="space-y-4 border-b border-neutral-200 pb-8 last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-3">
        {number ? (
          <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-orange-600">
            {number}
          </span>
        ) : null}
        <h2 className="text-xl font-semibold text-neutral-900">{title}</h2>
      </div>
      <div className="space-y-4 text-neutral-600 leading-relaxed">{children}</div>
    </section>
  );
}

export default function DocsLayout({ title, subtitle, effectiveDate, children }: DocsLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#FCFCFD] font-sans">
      <Navbar />

      <header className="relative overflow-hidden pt-24 sm:pt-36 pb-8 sm:pb-12">
        <div className="absolute inset-0">
          <div className="absolute -top-32 right-10 h-64 w-64 rounded-full bg-orange-200/40 blur-3xl" />
          <div className="absolute -bottom-24 left-6 h-48 w-48 rounded-full bg-orange-100/60 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[10px] sm:text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500 shadow-sm">
            Documentation
          </span>
          <h1 className="mt-4 text-3xl sm:text-4xl md:text-5xl font-semibold text-neutral-900">{title}</h1>
          {effectiveDate ? <p className="mt-3 text-xs sm:text-sm text-neutral-400">Effective: {effectiveDate}</p> : null}
          <p className="mt-3 sm:mt-4 max-w-3xl text-base sm:text-lg text-neutral-600">{subtitle}</p>

          <div className="mt-5 sm:mt-6 flex flex-wrap gap-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    "rounded-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition-colors " +
                    (isActive
                      ? "bg-orange-500 text-white"
                      : "bg-white text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900")
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 sm:px-6 pb-20 sm:pb-24">
        <div className="rounded-[1.5rem] sm:rounded-[2rem] border border-neutral-200 bg-white p-5 sm:p-6 shadow-sm md:p-10">
          <div className="space-y-8 sm:space-y-10">{children}</div>
        </div>
      </main>
    </div>
  );
}
