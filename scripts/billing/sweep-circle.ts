#!/usr/bin/env tsx
import { sweepPendingTreasury } from "../../src/lib/billing/treasury";

async function main() {
  const n = await sweepPendingTreasury();
  console.log(`Circle sweep: ${n} transferências pendentes processadas`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
