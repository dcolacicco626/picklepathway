export const dynamic = "force-dynamic";

import Link from "next/link";
import Image from "next/image";
import Nav from "./components/Nav";

// Optional: App Router supports metadata per page.
// If you already set this in layout.js, you can remove this block.
export const metadata = {
  title: "Pickle Pathway – Run Pickleball Leagues Effortlessly",
  description:
    "Pickleball league software that automates emails, standings, and subs. Built by club operators for clubs. Start a free 2-week trial.",
  openGraph: {
    title: "Pickle Pathway – Run Pickleball Leagues Effortlessly",
    description:
      "Pickleball league software that automates emails, standings, and subs. Built by club operators for clubs.",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pickle Pathway – Run Pickleball Leagues Effortlessly",
    description:
      "Pickleball league software that automates emails, standings, and subs.",
    images: ["/og.png"],
  },
};

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f7fbf8] text-slate-800">
      <Nav />

      {/* Trial announcement bar */}
      <div className="w-full border-b border-emerald-100 bg-emerald-50/70">
        <div className="max-w-6xl mx-auto px-5 py-2 text-center text-sm text-emerald-900">
          <strong className="font-semibold">New:</strong> Free 2-week trial. No credit card required.
          <Link href="#pricing" className="ml-2 underline underline-offset-4">See pricing</Link>
        </div>
      </div>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-5 pt-16 pb-10 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">
            Run pickleball leagues effortlessly.
          </h1>
          <p className="mt-5 text-lg text-slate-600">
            Automate weekly emails, capture subs, publish standings, and keep each club&apos;s data isolated.
            Launch your next league in minutes — not weeks.
          </p>
          <div className="mt-7 flex flex-col sm:flex-row gap-3">
            <Link
              href="/signup"
              className="px-5 py-3 rounded-xl bg-[#0ea568] text-white font-medium shadow-sm hover:opacity-95"
            >
              Start free 2-week trial
            </Link>
            <Link
              href="#pricing"
              className="px-5 py-3 rounded-xl border border-[#0ea568] text-[#0ea568] font-medium bg-white"
            >
              See pricing
            </Link>
          </div>
          <div className="mt-4 text-xs text-slate-500">No credit card required • Cancel anytime</div>
        </div>

        <div className="rounded-2xl overflow-hidden shadow-sm ring-1 ring-slate-200 bg-white p-2">
          {/* Replace demo.png with a real dashboard shot or short looping video/gif */}
          <Image
            src="/demo.png"
            alt="Pickle Pathway dashboard demo"
            width={1200}
            height={800}
            className="w-full h-auto rounded-xl"
            priority
          />
        </div>
      </section>



      {/* Feature grid */}
      <section id="features" className="max-w-6xl mx-auto px-5 py-12 grid md:grid-cols-3 gap-6">
        {[
          { t: "Automated emails", d: "Reminders and results sent automatically each week." },
          { t: "Player portal", d: "Public schedules, standings, and sub requests in one place." },
          { t: "Admin dashboard", d: "Create divisions, track results, and export CSV in clicks." },
          { t: "Multi-club isolation", d: "Organization-level data isolation (RLS)." },
          { t: "Fast setup", d: "Create a club and start a league the same day." },
          { t: "Mobile friendly", d: "Run your club from any device." },
        ].map((b) => (
          <div key={b.t} className="bg-white p-5 rounded-2xl ring-1 ring-slate-200">
            <div className="font-semibold">{b.t}</div>
            <div className="text-slate-600 text-sm mt-1">{b.d}</div>
          </div>
        ))}
      </section>

      {/* Testimonial */}
      <section className="max-w-6xl mx-auto px-5 py-8">
        <div className="bg-white p-6 rounded-2xl ring-1 ring-slate-200">
          <p className="text-lg italic">
            “We launched six divisions in under an hour — our players love the standings and weekly emails.”
          </p>
          <div className="mt-3 text-sm text-slate-600">— Club Manager, Dill Dinkers</div>
        </div>
      </section>

      {/* Pricing with trial */}
      <section id="pricing" className="max-w-6xl mx-auto px-5 py-12">
        <h2 className="text-2xl font-bold mb-4">Pricing</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { name: "Starter", price: "$39/mo", inc: ["Up to 3 divisions", "Email automations", "Player portal"] },
            { name: "Pro", price: "$99/mo", inc: ["Up to 12 divisions", "CSV export", "Priority support"] },
            { name: "Enterprise", price: "Contact us", inc: ["Custom limits", "SLA support", "Implementation help"] },
          ].map((p) => (
            <div key={p.name} className="bg-white p-6 rounded-2xl ring-1 ring-slate-200 relative">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs bg-emerald-600 text-white px-2 py-1 rounded-full shadow">
                Free 2-week trial
              </span>
              <div className="font-semibold">{p.name}</div>
              <div className="text-3xl font-extrabold mt-2">{p.price}</div>
              <ul className="mt-4 text-sm text-slate-600 space-y-1">
                {p.inc.map((i) => (
                  <li key={i}>• {i}</li>
                ))}
              </ul>
              <Link href="/signup" className="mt-5 inline-block px-4 py-2 rounded-lg bg-[#0ea568] text-white">
                Try free for 2 weeks
              </Link>
            </div>
          ))}
        </div>
        <div className="mt-4 text-xs text-slate-500">No credit card required • Cancel anytime</div>
      </section>

      {/* Footer CTA */}
      <section className="max-w-6xl mx-auto px-5 py-12 text-center">
        <Link href="/signup" className="px-6 py-3 rounded-xl bg-[#0ea568] text-white">
          Start free trial
        </Link>
        <p className="text-xs text-slate-500 mt-4">
          Minimal cookies for analytics only. © {new Date().getFullYear()} Pickle Pathway. •{" "}
          <Link href="/privacy" className="underline">Privacy</Link> •{" "}
          <Link href="/terms" className="underline">Terms</Link> •{" "}
          <Link href="/contact" className="underline">Contact</Link>
        </p>
      </section>
    </main>
  );
}
