#!/usr/bin/env tsx
import "../src/lib/polyfill-file";
import "../src/lib/load-env";
import { assertWorkerEnv } from "../src/lib/env/deploy";
import {
  enrichConcurrency,
  runGridWorker,
} from "../src/lib/enrichment/process-job";
import { searchJobConcurrency } from "../src/lib/search-jobs";

async function main() {
  assertWorkerEnv();
  const searchConcurrency = searchJobConcurrency();
  const concurrency = enrichConcurrency();
  const serper = Boolean(process.env.SERPER_API_KEY?.trim());
  console.log(
    JSON.stringify({
      event: "worker_start",
      searchConcurrency,
      concurrency,
      serper,
      warning: serper
        ? undefined
        : "SERPER_API_KEY ausente — domínio só via e-mail da RF",
    }),
  );
  await runGridWorker({ searchConcurrency, enrichConcurrency: concurrency });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
