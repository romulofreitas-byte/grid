#!/usr/bin/env tsx
import "../src/lib/load-env";
import {
  enrichConcurrency,
  runEnrichmentWorker,
} from "../src/lib/enrichment/process-job";

async function main() {
  const concurrency = enrichConcurrency();
  console.log(JSON.stringify({ event: "worker_start", concurrency }));
  await runEnrichmentWorker({ concurrency });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
