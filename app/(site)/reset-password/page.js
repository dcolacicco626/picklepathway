"use client";
import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return setMsg(error.message);
    setMsg("Password updated! Redirecting...");
    setTimeout(() => router.replace("/login"), 1500);
  }

  return (
    <div className="max-w-md mx-auto px-5 py-12">
      <h1 className="text-2xl font-bold mb-4">Reset Password</h1>
      <form onSubmit={onSubmit} className="grid gap-3">
        <input
          type="password"
          placeholder="New password"
          required
          className="px-3 py-2 rounded-md border"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />
        <button className="px-4 py-2 rounded-md bg-[#0ea568] text-white">
          Update Password
        </button>
      </form>
      {msg && <p className="text-sm text-slate-600 mt-3">{msg}</p>}
    </div>
  );
}
