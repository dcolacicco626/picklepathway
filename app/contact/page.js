"use client";
import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e) {
    e.preventDefault();
    setErr("");
    const { error } = await supabase
      .from("contact_messages")
      .insert({ name, email, message });
    if (error) return setErr(error.message);
    setDone(true);
  }

  if (done) return <div className="max-w-md mx-auto px-5 py-12">Thanks—we’ll get back to you shortly.</div>;

  return (
    <div className="max-w-md mx-auto px-5 py-12">
      <h1 className="text-2xl font-bold mb-4">Contact</h1>
      <form onSubmit={submit} className="grid gap-3">
        <input className="px-3 py-2 rounded-md border" placeholder="Name"
          value={name} onChange={(e)=>setName(e.target.value)} />
        <input className="px-3 py-2 rounded-md border" type="email" placeholder="Email"
          value={email} onChange={(e)=>setEmail(e.target.value)} />
        <textarea className="px-3 py-2 rounded-md border" placeholder="Message" rows={5}
          value={message} onChange={(e)=>setMessage(e.target.value)} />
        <button className="px-4 py-2 rounded-md bg-[#0ea568] text-white">Send</button>
      </form>
      {err && <p className="text-sm text-red-600 mt-3">{err}</p>}
    </div>
  );
}
