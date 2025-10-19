export const dynamic = "force-dynamic";

export const metadata = {
  title: "Privacy Policy – Pickle Pathway",
  description: "Our commitment to privacy and responsible data practices."
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f7fbf8] text-slate-800">
      <section className="max-w-3xl mx-auto px-5 py-16">
        <h1 className="text-4xl font-extrabold mb-4">Privacy Policy</h1>
        <p className="text-slate-600 leading-relaxed">
          Pickle Pathway collects minimal information — just what’s needed for account setup, email automation,
          and analytics. We do not sell or share your data with third parties. We retain data only as long as
          necessary to provide services and comply with legal obligations.
        </p>
        <h2 className="text-xl font-semibold mt-8">What we collect</h2>
        <ul className="list-disc pl-6 text-slate-600">
          <li>Account info (name, email)</li>
          <li>Club and league configuration data</li>
          <li>Operational logs for reliability and security</li>
        </ul>
        <h2 className="text-xl font-semibold mt-6">Your choices</h2>
        <p className="text-slate-600">You can request deletion of your account data at any time.</p>
      </section>
    </main>
  );
}
