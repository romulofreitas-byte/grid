#!/usr/bin/env tsx
import "../../src/lib/load-env";

const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "";
const site = (raw && !raw.includes("localhost")
  ? raw
  : "https://grid-podium.vercel.app"
).replace(/\/$/, "");

console.log(`Site: ${site}\n`);
console.log("Supabase Auth → URL configuration");
console.log(`  Site URL:        ${site}`);
console.log(`  Redirect URLs:   ${site}/auth/callback\n`);
console.log("Webhooks (HTTPS público → Vercel)");
console.log(`  Asaas:   ${site}/api/billing/webhooks/asaas`);
console.log(`  Stripe:  ${site}/api/billing/webhooks/stripe`);
console.log(`  Circle:  ${site}/api/billing/webhooks/circle\n`);
console.log("Asaas: header asaas-access-token = ASAAS_WEBHOOK_TOKEN (mesmo valor na Vercel).");
console.log("Stripe: eventos checkout.session.completed, invoice.paid, invoice.payment_failed.");
console.log("Em produção GRID_ENV=production os secrets são obrigatórios (401 se faltar).");
