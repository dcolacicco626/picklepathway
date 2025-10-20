"use client";
export default function BillingButtons() {
  const goCheckout = async (priceId) => {
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceId }),
    });
    const { url, error } = await res.json();
    if (error) { alert(error); return; }
    window.location.href = url;
  };

  const openPortal = async () => {
    const res = await fetch("/api/billing/portal", { method: "POST" });
    const { url, error } = await res.json();
    if (error) { alert(error); return; }
    window.location.href = url;
  };

  return (
    <div className="flex gap-3">
      <button onClick={() => goCheckout(process.env.NEXT_PUBLIC_PRICE_STARTER)}>Choose Starter</button>
      <button onClick={() => goCheckout(process.env.NEXT_PUBLIC_PRICE_PRO)}>Choose Pro</button>
      <button onClick={openPortal}>Manage Billing</button>
    </div>
  );
}
