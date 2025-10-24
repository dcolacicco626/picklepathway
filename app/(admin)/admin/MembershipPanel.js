"use client";
import { useMemo, useState } from "react";

function daysRemaining(active_until) {
  if (!active_until) return 0;
  const end = new Date(active_until);
  const today = new Date();
  return Math.max(0, Math.ceil((end - today) / 86400000));
}

export default function MembershipPanel({ membership, activeOrgId }) {
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelOther, setCancelOther] = useState("");

  const plan = membership?.plan?.toLowerCase() || "trial";
  const remaining = useMemo(
    () => daysRemaining(membership?.active_until),
    [membership?.active_until]
  );

  const isTrial   = plan === "trial";
  const isStarter = plan === "starter";
  const isPro     = plan === "pro";

  async function upgradeTo(planName) {
    setBusy(true);
    try {
      // Ensure cookie set
      await fetch("/api/admin/active-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: activeOrgId }),
      });

      // Start checkout for chosen plan
      const r = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: activeOrgId, plan: planName }),
      });
      const j = await r.json();
      if (!r.ok || !j.url) {
        alert(j.error || "Could not start checkout.");
        return;
      }
      window.location.href = j.url;
    } finally {
      setBusy(false);
    }
  }

  async function changePlan(toPlan) {
    setBusy(true);
    try {
      const r = await fetch("/api/billing/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: activeOrgId, toPlan }),
      });
      const j = await r.json();
      if (!r.ok) {
        alert(j.error || "Could not change plan.");
        return;
      }
      alert("Plan updated.");
      // optional: refresh status in parent
      location.reload();
    } finally {
      setBusy(false);
    }
  }

  async function cancelNow() {
    if (!cancelReason && !cancelOther) {
      alert("Please choose a reason (or write one).");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: activeOrgId,
          reason: cancelReason === "other" ? cancelOther : cancelReason,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        alert(j.error || "Could not cancel.");
        return;
      }
      setCancelOpen(false);
      alert("Your subscription will be canceled at the period end.");
      location.reload();
    } finally {
      setBusy(false);
    }
  }

  function Card({ title, price, bullets, cta, onClick, muted, badge }) {
    return (
<div
  className={
    "flex-1 rounded-xl border p-5 shadow-[0_0_8px_rgba(16,185,129,0.15)] transition-shadow hover:shadow-[0_0_12px_rgba(16,185,129,0.25)] " +
    (muted ? "opacity-60" : "opacity-100")
  }
>

        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          {badge && (
            <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
              {badge}
            </span>
          )}
        </div>
        {price && <div className="text-2xl font-bold mt-2">{price}</div>}
        <ul className="mt-3 space-y-1 text-sm text-slate-600">
          {bullets.map((b, i) => (
            <li key={i}>• {b}</li>
          ))}
        </ul>
        {cta && (
          <button
            onClick={onClick}
            disabled={busy || muted}
            className="mt-4 w-full rounded-lg border px-3 py-2 hover:bg-slate-50 disabled:opacity-50"
          >
            {cta}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-4 flex-col md:flex-row">
 <Card
  title="Free"
  price="2-week free trial"
  bullets={[
    `${remaining} day${remaining === 1 ? "" : "s"} remaining`,
   
  ]}
  badge={isTrial ? "Current plan" : null}
  muted={!isTrial && !remaining}
/>


        {/* Starter */}
        <Card
          title="Starter"
          price="$39/mo"
          bullets={["Up to 3 divisions", "Email automations", "Player portal"]}
          badge={isStarter ? "Current plan" : null}
          muted={false}
          cta={
            isStarter ? "Upgrade to Pro" : isTrial ? "Upgrade to Starter" : (isPro ? "Downgrade to Starter" : "Upgrade to Starter")
          }
          onClick={() =>
            isPro ? changePlan("starter") : upgradeTo("starter")
          }
        />

        {/* Pro */}
        <Card
          title="Pro"
          price="$99/mo"
          bullets={["Up to 12 divisions", "CSV export", "Priority support"]}
          badge={isPro ? "Current plan" : null}
          muted={false}
          cta={isPro ? "Downgrade to Starter" : "Upgrade to Pro"}
          onClick={() =>
            isPro ? changePlan("starter") : upgradeTo("pro")
          }
        />
      </div>

{/* Cancel section — always visible */}
<div className="pt-3 border-t">
  {!cancelOpen ? (
    <button
      onClick={() => setCancelOpen(true)}
      className="text-red-600 hover:underline"
    >
      Cancel membership
    </button>
  ) : (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span>Reason:</span>
        <select
          className="border rounded-md px-2 py-1"
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
        >
          <option value="">Select…</option>
          <option value="too_expensive">Too expensive</option>
          <option value="features_missing">Missing features</option>
          <option value="hard_to_use">Hard to use</option>
          <option value="temporary_need">Temporary need ended</option>
          <option value="switching_tools">Switching tools</option>
          <option value="other">Other</option>
        </select>
      </div>
      {cancelReason === "other" && (
        <input
          className="border rounded-md px-2 py-1 w-full"
          placeholder="Tell us more (optional)"
          value={cancelOther}
          onChange={(e) => setCancelOther(e.target.value)}
        />
      )}
      <div className="flex gap-2">
        <button
          onClick={cancelNow}
          disabled={busy}
          className="px-3 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
        >
          Yes, cancel
        </button>
        <button
          onClick={() => setCancelOpen(false)}
          className="px-3 py-2 rounded-md border"
        >
          Never mind
        </button>
      </div>
    </div>
  )}
</div>

      )}
    </div>
  );
}
