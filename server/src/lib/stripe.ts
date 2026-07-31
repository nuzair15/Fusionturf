import Stripe from "stripe";
import { config } from "../config/index.js";

let stripeClient: Stripe | null = null;
let attempted = false;

/**
 * Returns a configured Stripe client, or null if STRIPE_SECRET_KEY isn't
 * set. Callers must handle the null case (e.g. by returning a clear 503)
 * rather than assuming payments are always configured — this keeps local
 * development and preview environments able to boot without live keys.
 */
export function getStripeClient(): Stripe | null {
  if (!attempted) {
    attempted = true;
    if (config.stripe.secretKey) {
      stripeClient = new Stripe(config.stripe.secretKey);
    }
  }
  return stripeClient;
}
