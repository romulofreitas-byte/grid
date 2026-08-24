#!/usr/bin/env tsx
import "../src/lib/polyfill-file";
import "../src/lib/load-env";
import { assertWorkerEnv } from "../src/lib/env/deploy";
import {
  enrichConcurrency,
  runEnrichmentWorker,
} from "../src/lib/enrichment/process-job";

async function main() {
  assertWorkerEnv();
  const concurrency = enrichConcurrency();
  const serper = Boolean(process.env.SERPER_API_KEY?.trim());
  console.log(
    JSON.stringify({
      event: "worker_start",
      concurrency,
      serper,
      warning: serper
        ? undefined
        : "SERPER_API_KEY ausente — domínio só via e-mail da RF",
    }),
  );
  await runEnrichmentWorker({ concurrency });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
