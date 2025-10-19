export const dynamic = "force-dynamic";

export const metadata = {
  title: "Terms of Service – Pickle Pathway",
  description: "The rules for using Pickle Pathway."
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#f7fbf8] text-slate-800">
      <section className="max-w-3xl mx-auto px-5 py-16">
        <h1 className="text-4xl font-extrabold mb-4">Terms of Service</h1>
        <p className="text-slate-600 leading-relaxed">
          By using Pickle Pathway, you agree to our acceptable use and billing terms. Subscriptions renew monthly unless
          canceled. You may cancel anytime from your admin dashboard. Use of the service must comply with applicable laws
          and respect the privacy of players and other users.
        </p>
        <h2 className="text-xl font-semibold mt-6">Billing</h2>
        <p className="text-slate-600">Plans are billed monthly; refunds are not guaranteed for partial periods.</p>
        <h2 className="text-xl font-semibold mt-6">Acceptable Use</h2>
        <p className="text-slate-600">No abuse, spam, or unlawful use. We may suspend accounts for violations.</p>
      </section>
    </main>
  );
}
