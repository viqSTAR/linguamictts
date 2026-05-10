import { NavLink } from "react-router";
import type { ReactNode } from "react";

type NavItem = {
  label: string;
  to: string;
};

type DocsLayoutProps = {
  title: string;
  subtitle: string;
  effectiveDate?: string;
  children: ReactNode;
};

const navItems: NavItem[] = [
  { label: "Terms & Conditions", to: "/" },
  { label: "Privacy Policy", to: "/privacy-policy" },
  { label: "About Us", to: "/about-us" },
  { label: "Attributions", to: "/attributions" },
];

export function DocSection({
  number,
  title,
  children,
}: {
  number?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 border-b border-slate-200 pb-8 last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-3">
        {number ? (
          <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-orange-600">
            {number}
          </span>
        ) : null}
        <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="space-y-4 text-slate-600 leading-relaxed">{children}</div>
    </section>
  );
}

export default function DocsLayout({ title, subtitle, effectiveDate, children }: DocsLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="border-b border-slate-200 bg-white">
        <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-6 py-5 text-sm">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  "rounded-full px-4 py-2 font-medium transition-colors",
                  isActive
                    ? "bg-orange-100 text-orange-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                ].join(" ")
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <header className="border-b border-slate-200 bg-gradient-to-br from-white via-orange-50 to-white">
        <div className="mx-auto max-w-5xl px-6 py-12">
          <span className="inline-flex items-center gap-2 rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-orange-600">
            Documentation
          </span>
          <h1 className="mt-4 text-4xl font-semibold text-slate-900 md:text-5xl">{title}</h1>
          {effectiveDate ? (
            <p className="mt-3 text-sm text-slate-500">Effective: {effectiveDate}</p>
          ) : null}
          <p className="mt-4 max-w-3xl text-lg text-slate-600">{subtitle}</p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-10">
          <div className="space-y-10">{children}</div>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-6 text-sm text-slate-500">
          <p>LinguaMic Documentation</p>
          <a
            href="mailto:company@linguamic.com"
            className="font-medium text-orange-600 transition-colors hover:text-orange-700"
          >
            company@linguamic.com
          </a>
        </div>
      </footer>
    </div>
  );
}
