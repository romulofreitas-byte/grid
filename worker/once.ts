#!/usr/bin/env tsx
import "../src/lib/polyfill-file";
import "../src/lib/load-env";
import { getDataSource, getRepo } from "../src/lib/data";
import { processJob } from "../src/lib/enrichment/process-job";
import { endPool } from "../src/lib/data/pg";

async function main() {
  const cnpj = process.argv.find((a) => a.startsWith("--cnpj="))?.slice(7);
  const repo = getRepo();
  if (cnpj) {
    await repo.enqueueEnrichment({
      cnpjs: [cnpj],
      userId: "worker",
      searchId: null,
      priority: true,
    });
  }
  const job = await repo.claimEnrichmentJob();
  if (!job) {
    console.log(JSON.stringify({ event: "no_job" }));
    return;
  }
  await processJob(job);
}

async function run() {
  try {
    await main();
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    if (getDataSource() !== "mock") {
      await endPool();
    }
  }
}

void run();
