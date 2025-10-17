"use client";
import Link from "next/link";

export default function Nav() {
  return (
    <header className="border-b bg-white">
      <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between">
        <Link href="/" className="font-extrabold">Pickle Pathway</Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/services">Services</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/about">About</Link>
          <Link href="/faq">FAQ</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/login" className="opacity-80">Sign in</Link>
          <Link href="/signup" className="px-3 py-2 rounded-md border">Create account</Link>
        </nav>
      </div>
    </header>
  );
}
