"use client";

import Link from "next/link";
import { useState } from "react";

export default function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b border-slate-200">
      <nav className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
        {/* Logo / Brand */}
        <Link href="/" className="font-extrabold text-slate-900 tracking-tight">
          Pickle Pathway
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          <Link href="/features" className="text-slate-700 hover:text-slate-900">Features</Link>
          <Link href="/pricing"  className="text-slate-700 hover:text-slate-900">Pricing</Link>
          <Link href="/contact"  className="text-slate-700 hover:text-slate-900">Contact</Link>

          <Link href="/signin" className="text-slate-700 hover:text-slate-900">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="px-4 py-2 rounded-xl border border-[#0ea568] text-[#0ea568] hover:bg-[#e9f7f0]"
          >
            Create account
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden inline-flex items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-slate-700"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-menu"
        >
          <span className="sr-only">Toggle menu</span>
          ☰
        </button>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div id="mobile-menu" className="md:hidden border-t border-slate-200 bg-white/95">
          <div className="max-w-6xl mx-auto px-5 py-3 flex flex-col gap-2">
            <Link href="/features" className="py-2 text-slate-700" onClick={() => setOpen(false)}>Features</Link>
            <Link href="/pricing"  className="py-2 text-slate-700" onClick={() => setOpen(false)}>Pricing</Link>
            <Link href="/contact"  className="py-2 text-slate-700" onClick={() => setOpen(false)}>Contact</Link>
            <Link href="/signin"   className="py-2 text-slate-700" onClick={() => setOpen(false)}>Sign in</Link>
            <Link
              href="/signup"
              className="py-2 px-4 rounded-xl border border-[#0ea568] text-[#0ea568] w-max"
              onClick={() => setOpen(false)}
            >
              Create account
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
