import {
  STRIPE_PRICES,
  stripeEnvironment,
  isStripeConfigured,
} from "../src/lib/stripe.js";
import { getCheckoutPrice } from "../src/lib/stripePrices.js";
if (!isStripeConfigured) {
  console.error(
    "Configure STRIPE_SECRET_KEY no backend antes de validar os preços.",
  );
  process.exitCode = 1;
} else {
  console.log(
    `Verificando preços na conta Stripe do backend (${stripeEnvironment}). Nenhum produto ou pagamento será criado.`,
  );
  for (const [plan, cycles] of Object.entries(STRIPE_PRICES)) {
    for (const cycle of Object.keys(cycles)) {
      try {
        const id = await getCheckoutPrice(plan, cycle);
        console.log(`OK ${plan}/${cycle}: ${id}`);
      } catch (error: any) {
        console.error(`ERRO ${plan}/${cycle}: ${error.message}`);
        process.exitCode = 1;
      }
    }
  }
}
