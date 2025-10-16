"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

export default function SubsSignupPage() {
  const { slug } = useParams();
  const router = useRouter();

  const [league, setLeague] = useState(null);
  const [loadingLeague, setLoadingLeague] = useState(true);
  const [error, setError] = useState("");

  // form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Fetch the league data
  const loadLeague = useCallback(async () => {
    setLoadingLeague(true);
    setError("");
    const { data, error } = await supabase
      .from("league")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      setError(error.message);
    } else if (!data) {
      setError(`Division "${slug}" not found.`);
    } else {
      setLeague(data);
    }
    setLoadingLeague(false);
  }, [slug]);

  useEffect(() => {
    loadLeague();
  }, [loadLeague]);

  // Submit handler
  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      setError("Please enter your name.");
      return;
    }
    if (trimmedEmail && !/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!league?.id) {
      setError("League not loaded yet. Please try again.");
      return;
    }

    setSubmitting(true);
    const { error: insertErr } = await supabase.from("subs_pool").insert({
      league_id: league.id,
      name: trimmedName,
      phone: trimmedPhone || null,
      email: trimmedEmail || null,
    });

    setSubmitting(false);

    if (insertErr) {
      setError(insertErr.message);
      return;
    }

    setDone(true);
    setName("");
    setPhone("");
    setEmail("");
  };

  const Title = () => (
    <div className="text-center mb-6">
      <h1 className="text-3xl font-bold text-slate-800">Substitute Player Signup</h1>
      {league ? (
        <p className="text-slate-600 mt-1">
          Division: <span className="font-medium">{league.division || league.slug}</span>
        </p>
      ) : null}
    </div>
  );

  return (
    <main className="min-h-screen bg-[#f7fbf8] text-slate-800 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <Title />

        {loadingLeague && <p className="text-center text-slate-600">Loading…</p>}

        {!loadingLeague && error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loadingLeague && league && !done && (
          <form
            onSubmit={onSubmit}
            className="bg-white shadow-sm rounded-2xl p-6 space-y-5 ring-1 ring-slate-200"
          >
            <div>
              <label className="block text-sm font-medium text-slate-600">Name *</label>
              <input
                className="mt-1 w-full border rounded-xl px-3 py-2 focus:ring-2 focus:ring-[#0ea568] outline-none"
                placeholder="Your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600">
                Phone (optional)
              </label>
              <input
                className="mt-1 w-full border rounded-xl px-3 py-2 focus:ring-2 focus:ring-[#0ea568] outline-none"
                placeholder="(###) ###-####"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600">
                Email (optional)
              </label>
              <input
                type="email"
                className="mt-1 w-full border rounded-xl px-3 py-2 focus:ring-2 focus:ring-[#0ea568] outline-none"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className={`w-full py-2.5 rounded-xl font-medium text-white transition ${
                submitting
                  ? "bg-gray-400"
                  : "bg-[#0ea568] hover:bg-[#0b8857]"
              }`}
            >
              {submitting ? "Submitting…" : "Join the Sub List"}
            </button>

            <p className="text-xs text-slate-500">
              By submitting, you agree to be contacted about sub opportunities for this division.
              Your info is only visible to league admins.
            </p>
          </form>
        )}

        {!loadingLeague && league && done && (
          <div className="bg-white rounded-2xl shadow-sm p-6 text-center ring-1 ring-slate-200">
            <div className="text-[#0ea568] font-semibold mb-2">
              Thanks! You’re on the sub list.
            </div>
            <p className="text-sm text-slate-700">
              We’ll reach out if a spot is needed for{" "}
              <span className="font-medium">{league.division || league.slug}</span>.
            </p>
            <div className="flex gap-3 justify-center mt-4">
              <button
                onClick={() => setDone(false)}
                className="px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-50"
              >
                Add another
              </button>
              <button
                onClick={() => router.push(`/admin/${league.slug}`)}
                className="px-3 py-2 rounded-xl bg-[#0ea568] text-white hover:bg-[#0b8857]"
              >
                Back to Admin
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
