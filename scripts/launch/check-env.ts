#!/usr/bin/env tsx
import "../../src/lib/load-env";
import { collectLaunchEnvIssues } from "../../src/lib/env/deploy";

const issues = collectLaunchEnvIssues();
if (!issues.length) {
  console.log("OK — nenhum problema de env detectado.");
  process.exit(0);
}

for (const issue of issues) {
  console.log(`[${issue.level.toUpperCase()}] ${issue.message}`);
}

const failed = issues.some((i) => i.level === "error");
process.exit(failed ? 1 : 0);
