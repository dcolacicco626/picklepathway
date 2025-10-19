export const dynamic = "force-dynamic";

import Link from "next/link";

export const metadata = {
  title: "Pricing – Pickle Pathway",
  description: "Simple pricing with a free 2‑week trial for pickleball leagues."
};

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[#f7fbf8] text-slate-800">
      <section className="max-w-4xl mx-auto px-5 py-16 text-center">
        <h1 className="text-4xl font-extrabold mb-6">Pricing</h1>
        <p className="text-slate-600 mb-12">
          Pickle Pathway keeps it simple — all plans include automation, player portal, and free support.
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { name: "Starter", price: "$39/mo", inc: ["Up to 3 divisions", "Email automations", "Player portal"] },
            { name: "Pro", price: "$99/mo", inc: ["Up to 12 divisions", "CSV export", "Priority support"] },
            { name: "Enterprise", price: "Contact us", inc: ["Custom limits", "SLA support", "Implementation help"] },
          ].map((p) => (
            <div key={p.name} className="bg-white p-6 rounded-2xl ring-1 ring-slate-200 relative">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs bg-emerald-600 text-white px-2 py-1 rounded-full shadow">
                Free 2‑week trial
              </span>
              <div className="font-semibold">{p.name}</div>
              <div className="text-3xl font-extrabold mt-2">{p.price}</div>
              <ul className="mt-4 text-sm text-slate-600 space-y-1">
                {p.inc.map((i) => <li key={i}>• {i}</li>)}
              </ul>
              <Link href="/signup" className="mt-5 inline-block px-4 py-2 rounded-lg bg-[#0ea568] text-white">
                Try free for 2 weeks
              </Link>
            </div>
          ))}
        </div>
        <p className="mt-8 text-xs text-slate-500">No credit card required • Cancel anytime</p>
      </section>
    </main>
  );
}
