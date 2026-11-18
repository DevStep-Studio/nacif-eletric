import { checkHealth } from "./start-backend-prod.mjs";

const origin = process.argv[2] || "https://nacifenergy.com.br";
const result = await checkHealth(3001, origin);
if (!result.ok) {
  console.error(`[API publicada] ${result.reason}`);
  process.exitCode = 1;
} else {
  console.log(`[API publicada] ${new URL(origin).origin}: backend com teste grátis de 7 dias (${result.data.billingApiVersion}).`);
}
