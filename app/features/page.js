export const dynamic = "force-dynamic";

export const metadata = {
  title: "Features – Pickle Pathway",
  description: "Automated emails, player portal, CSV export, and more for pickleball leagues."
};

export default function FeaturesPage() {
  return (
    <main className="min-h-screen bg-[#f7fbf8] text-slate-800">
      <section className="max-w-5xl mx-auto px-5 py-16">
        <h1 className="text-4xl font-extrabold mb-8 text-center">Features</h1>
        <div className="grid md:grid-cols-2 gap-8">
          {[
            { t: "Automated Emails", d: "Reminders and results sent automatically each week." },
            { t: "Player Portal", d: "Public schedules, standings, and sub requests in one place." },
            { t: "Admin Dashboard", d: "Easily create divisions, track results, and export CSV in clicks." },
            { t: "Multi-Club Isolation", d: "Organization-level data isolation (RLS) for security." },
            { t: "Fast Setup", d: "Create a club and start a league the same day." },
            { t: "Mobile Friendly", d: "Run your club from any device." },
          ].map((f) => (
            <div key={f.t} className="bg-white p-6 rounded-2xl ring-1 ring-slate-200">
              <h2 className="font-semibold mb-1">{f.t}</h2>
              <p className="text-slate-600 text-sm">{f.d}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <a href="/pricing" className="inline-block px-6 py-3 rounded-xl bg-[#0ea568] text-white">
            See pricing & start free trial
          </a>
        </div>
      </section>
    </main>
  );
}
