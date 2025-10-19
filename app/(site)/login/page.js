"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (error) throw error;
      router.replace("/admin");
    } catch (e) {
      setMsg(e?.message || String(e));
    }
  }

return (
  <div className="max-w-md mx-auto px-5 py-12">
    <h1 className="text-2xl font-bold mb-4">Sign in</h1>

    <form onSubmit={onSubmit} className="grid gap-3">
      <input
        className="px-3 py-2 rounded-md border"
        type="email"
        placeholder="you@example.com"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className="px-3 py-2 rounded-md border"
        type="password"
        placeholder="Password"
        required
        value={pw}
        onChange={(e) => setPw(e.target.value)}
      />
      <button className="px-4 py-2 rounded-md bg-[#0ea568] text-white">
        Sign in
      </button>
    </form>

    {/* ---- Forgot Password ---- */}
    <div className="mt-4 text-sm">
      <button
        onClick={async () => {
          if (!email) {
            setMsg("Enter your email above first.");
            return;
          }
          const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
          });
          setMsg(
            error
              ? error.message
              : "Password reset email sent! Check your inbox."
          );
        }}
        className="text-[#0ea568] hover:underline"
      >
        Forgot password?
      </button>
    </div>

    {msg && <p className="text-sm text-slate-600 mt-3">{msg}</p>}
  </div>
);
}