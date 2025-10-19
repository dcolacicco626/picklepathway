export const dynamic = "force-dynamic";

import Link from "next/link";

export const metadata = {
  title: "Contact – Pickle Pathway",
  description: "Get in touch with the Pickle Pathway team."
};

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-[#f7fbf8] text-slate-800">
      <section className="max-w-3xl mx-auto px-5 py-16 text-center">
        <h1 className="text-4xl font-extrabold mb-4">Contact Us</h1>
        <p className="text-slate-600 mb-8">
          Have questions or need support? We’d love to hear from you.
        </p>
        <a
          href="mailto:support@picklepathway.com"
          className="px-6 py-3 rounded-xl bg-[#0ea568] text-white inline-block"
        >
          Email Support
        </a>
        <p className="text-xs text-slate-500 mt-6">
         Prefer a call? <Link href="/contact#schedule" className="underline">Schedule a demo</Link>.
        </p>
      </section>
    </main>
  );
}
