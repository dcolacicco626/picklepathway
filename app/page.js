export const dynamic = "force-dynamic";

import Link from "next/link";
import Nav from "./components/Nav";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f7fbf8] text-slate-800">
      <Nav />

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-5 py-16 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <h1 className="text-4xl font-extrabold leading-tight">
            Run leagues in minutes. <br/> Emails, standings, subs—handled.
          </h1>
          <p className="mt-4 text-slate-600">
            Spin up divisions fast. Automate weekly emails, capture subs, publish standings, and keep data isolated per club.
          </p>
          <div className="mt-6 flex gap-3">
            <Link href="/signup" className="px-4 py-2 rounded-lg bg-[#0ea568] text-white">
              Create account
            </Link>
            <Link href="/pricing" className="px-4 py-2 rounded-lg border border-[#0ea568] text-[#0ea568]">
              See pricing
            </Link>
          </div>
        </div>
        <div className="rounded-2xl overflow-hidden shadow-sm ring-1 ring-slate-200 bg-white p-2">
          {/* Replace with a real screenshot/demo image */}
          <img src="/demo.png" alt="Dashboard demo" className="w-full h-auto rounded-xl" />
        </div>
      </section>

      {/* Benefits (note: NO branding/domains mention) */}
      <section className="max-w-6xl mx-auto px-5 py-12 grid md:grid-cols-3 gap-6">
        {[
          { t: "Automations", d: "Weekly emails, reminders, and results workflows." },
          { t: "Player portal", d: "Public pages for schedules, standings, and subs." },
          { t: "CSV export", d: "One click exports for admins and staff." },
          { t: "RLS isolation", d: "Each club’s data is isolated at the database level." },
          { t: "Fast setup", d: "Create a club and start a league the same day." },
          { t: "Mobile friendly", d: "Works great for admins on the go." },
        ].map((b) => (
          <div key={b.t} className="bg-white p-5 rounded-2xl ring-1 ring-slate-200">
            <div className="font-semibold">{b.t}</div>
            <div className="text-slate-600 text-sm mt-1">{b.d}</div>
          </div>
        ))}
      </section>

      {/* Social proof (stub) */}
      <section className="max-w-6xl mx-auto px-5 py-12">
        <h2 className="text-2xl font-bold mb-4">Trusted by clubs</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-2xl ring-1 ring-slate-200">
            “We stood up 6 divisions in under an hour.”
          </div>
          <div className="bg-white p-5 rounded-2xl ring-1 ring-slate-200">
            “Sub requests basically run themselves.”
          </div>
          <div className="bg-white p-5 rounded-2xl ring-1 ring-slate-200">
            “Standings are clear and players love it.”
          </div>
        </div>
      </section>

      {/* Pricing (no “free migration” mention) */}
      <section className="max-w-6xl mx-auto px-5 py-12">
        <h2 className="text-2xl font-bold mb-4">Pricing</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { name: "Starter", price: "$39/mo", inc: ["Up to 3 divisions", "Email automations", "Player portal"] },
            { name: "Pro", price: "$99/mo", inc: ["Up to 12 divisions", "CSV export", "Priority support"] },
            { name: "Enterprise", price: "Contact us", inc: ["Custom limits", "SLA support", "Implementation help"] },
          ].map((p) => (
            <div key={p.name} className="bg-white p-6 rounded-2xl ring-1 ring-slate-200">
              <div className="font-semibold">{p.name}</div>
              <div className="text-3xl font-extrabold mt-2">{p.price}</div>
              <ul className="mt-4 text-sm text-slate-600 space-y-1">
                {p.inc.map((i) => <li key={i}>• {i}</li>)}
              </ul>
              <Link href="/signup" className="mt-5 inline-block px-4 py-2 rounded-lg bg-[#0ea568] text-white">
                Get started
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Footer CTA */}
      <section className="max-w-6xl mx-auto px-5 py-12 text-center">
        <Link href="/signup" className="px-6 py-3 rounded-xl bg-[#0ea568] text-white">Create account</Link>
        <p className="text-xs text-slate-500 mt-4">
          Minimal cookies for analytics only. © {new Date().getFullYear()} Pickle Pathway.
        </p>
      </section>
    </main>
  );
}
