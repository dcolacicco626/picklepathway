"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

function toSlug(s) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
}

export default function SignupPage() {
  const router = useRouter();
  const [clubName, setClubName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("");
    try {
      const { data: sign, error: signErr } = await supabase.auth.signUp({
        email,
        password: pw,
      });
      if (signErr) throw signErr;

      // If your Supabase project requires email confirmation, the user might not be signed in yet.
      // For staging, you can disable email confirmations in Auth settings.
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setMsg("Check your email to confirm your account, then sign in.");
        return;
      }

      const slug = toSlug(clubName);
      // Create org
      const { data: org, error: orgErr } = await supabase
        .from("orgs")
        .insert({ name: clubName, slug, plan: "Starter" })
        .select("id, slug")
        .maybeSingle();
      if (orgErr) throw orgErr;

// Link membership (owner)
const { error: memErr } = await supabase
  .from("memberships")
  .insert({ user_id: user.id, org_id: org.id, role: "owner" }); // match your DB constraint
if (memErr && !String(memErr.message).includes("duplicate")) throw memErr;

// ✅ Step 2 — set active org cookie
await fetch("/api/admin/active-org", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ orgId: org.id }),
});

// ✅ Redirect to admin dashboard
router.replace(`/admin`);

    } catch (e) {
      setMsg(e?.message || String(e));
    }
  }

  return (
    <div className="max-w-md mx-auto px-5 py-12">
      <h1 className="text-2xl font-bold mb-4">Create Your Free Club Account</h1>
      <form onSubmit={onSubmit} className="grid gap-3">
        <input className="px-3 py-2 rounded-md border" placeholder="Club name" required
          value={clubName} onChange={(e)=>setClubName(e.target.value)} />
        <input className="px-3 py-2 rounded-md border" type="email" placeholder="you@example.com" required
          value={email} onChange={(e)=>setEmail(e.target.value)} />
        <input className="px-3 py-2 rounded-md border" type="password" placeholder="Password" required
          value={pw} onChange={(e)=>setPw(e.target.value)} />
        <button className="px-4 py-2 rounded-md bg-[#0ea568] text-white">Create account</button>
      </form>
      {msg && <p className="text-sm text-slate-600 mt-3">{msg}</p>}
    </div>
  );
}
