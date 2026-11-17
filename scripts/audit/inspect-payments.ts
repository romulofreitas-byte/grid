/**
 * Read-only payment_events dump for a profile. No writes.
 */
import { Client } from "pg";
import { getDatabaseUrl } from "../ingest/config";

async function main(): Promise<void> {
  const profileId = process.argv[2]?.trim();
  if (!profileId) {
    console.error("usage: pnpm exec tsx scripts/audit/inspect-payments.ts <profileId>");
    process.exit(1);
  }
  const url = getDatabaseUrl();
  if (!url) {
    console.error("DATABASE_URL is not set");
    process.exit(2);
  }
  const host = new URL(url).hostname;
  const local = host === "localhost" || host === "127.0.0.1" || host === "::1";
  const client = new Client({
    connectionString: url,
    ssl: local ? undefined : { rejectUnauthorized: false },
  });
  await client.connect();
  const events = await client.query(
    `select provider, provider_event_id, created_at,
            left(payload::text, 400) as payload_head
       from payment_events
      where payload::text ilike '%' || $1 || '%'
         or payload::text ilike '%sub_whcm5wj47uvgo9hw%'
         or payload::text ilike '%fcbfed55-7dd8-49ff-84ab-9ac9e3bd673a%'
      order by created_at desc
      limit 40`,
    [profileId],
  );
  console.log(JSON.stringify({ n: events.rows.length, events: events.rows }, null, 2));
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
