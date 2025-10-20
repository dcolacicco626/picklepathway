import Stripe from "stripe";

let stripeSingleton = null;

export function getStripe() {
  if (!stripeSingleton) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("Missing STRIPE_SECRET_KEY (check .env.local and restart dev server)");
    }
    stripeSingleton = new Stripe(key, { apiVersion: "2024-06-20" });
  }
  return stripeSingleton;
}
