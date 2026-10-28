import Stripe from "stripe";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.error("STRIPE_SECRET_KEY não definida nas variáveis de ambiente (.env).");
  process.exit(1);
}

const stripe = new Stripe(stripeSecretKey);

const plans = [
  {
    key: "VITE_STRIPE_LINK_ESTUDANTE_MONTHLY",
    plan: "estudante",
    cycle: "monthly",
    price: "price_1UVAQqJl6h9d8TBMRYFoOdBM",
  },
  {
    key: "VITE_STRIPE_LINK_ELETRICO_MONTHLY",
    plan: "eletrico",
    cycle: "monthly",
    price: "price_1UVAS5Jl6h9d8TBMQLt9F7nB",
  },
  {
    key: "VITE_STRIPE_LINK_ELETRICO_ANNUAL",
    plan: "eletrico",
    cycle: "annual",
    price: "price_1UVAfiJl6h9d8TBMcF6J01KS",
  },
  {
    key: "VITE_STRIPE_LINK_SOLAR_MONTHLY",
    plan: "solar",
    cycle: "monthly",
    price: "price_1UVAX2Jl6h9d8TBMkWZsDn0s",
  },
  {
    key: "VITE_STRIPE_LINK_SOLAR_ANNUAL",
    plan: "solar",
    cycle: "annual",
    price: "price_1UVAgGJl6h9d8TBMmK3sEsRZ",
  },
  {
    key: "VITE_STRIPE_LINK_COMPLETO_MONTHLY",
    plan: "completo",
    cycle: "monthly",
    price: "price_1UVAYaJl6h9d8TBMc8YTZsHp",
  },
  {
    key: "VITE_STRIPE_LINK_COMPLETO_ANNUAL",
    plan: "completo",
    cycle: "annual",
    price: "price_1UVAgoJl6h9d8TBMubc39FAP",
  },
];

async function main() {
  console.log("Criando Stripe Payment Links na conta da Stripe...");
  const envLines = [];

  for (const item of plans) {
    try {
      const paymentLink = await stripe.paymentLinks.create({
        line_items: [{ price: item.price, quantity: 1 }],
        allow_promotion_codes: true,
        billing_address_collection: "auto",
        after_completion: {
          type: "redirect",
          redirect: {
            url: `https://nacifenergy.com.br/subscription?checkout=success&plan=${item.plan}&cycle=${item.cycle}`,
          },
        },
        metadata: {
          plan: item.plan,
          cycle: item.cycle,
        },
      });

      const line = `${item.key}=${paymentLink.url}`;
      envLines.push(line);
      console.log(`[OK] ${item.plan} (${item.cycle}): ${paymentLink.url}`);
    } catch (err) {
      console.error(`[ERRO] ${item.plan} (${item.cycle}):`, err.message);
    }
  }

  console.log("\n--- COPIE PARA O SEU .env DA RAIZ ---\n");
  console.log(envLines.join("\n"));
}

main();
