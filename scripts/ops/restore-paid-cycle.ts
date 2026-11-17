/**
 * Restore a paid Asaas cycle that GRID failed to renew.
 *   pnpm exec tsx scripts/ops/restore-paid-cycle.ts <profileId>
 */
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { getDatabaseUrl } from "../ingest/config";

async function main(): Promise<void> {
  const profileId = process.argv[2]?.trim();
  if (!profileId) {
    console.error("usage: pnpm exec tsx scripts/ops/restore-paid-cycle.ts <profileId>");
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
  await client.query("begin");
  try {
    const { rows: subs } = await client.query(
      `select * from billing_subscriptions where profile_id=$1
         order by current_period_end desc limit 1`,
      [profileId],
    );
    const sub = subs[0];
    if (!sub) throw new Error("no subscription");
    const start = new Date("2026-11-14T14:34:54.672Z");
    const end = new Date(start.getTime());
    end.setUTCMonth(end.getUTCMonth() + 1);
    const startIso = start.toISOString();
    const endIso = end.toISOString();
    const now = new Date().toISOString();

    const expired = await client.query(
      `update credit_lots
          set remaining = 0, expires_at = $2
        where profile_id = $1
          and source in ('plan_grant', 'platform')
          and remaining > 0
        returning id, remaining, source`,
      [profileId, startIso],
    );

    await client.query(
      `update billing_subscriptions
          set status = 'active',
              current_period_start = $2,
              current_period_end = $3,
              cancel_at_period_end = false
        where id = $1`,
      [sub.id, startIso, endIso],
    );

    const lotId = randomUUID();
    await client.query(
      `insert into credit_lots (
         id, profile_id, qty, remaining, source, expires_at, order_id, created_at
       ) values ($1,$2,900,900,'plan_grant',$3,null,$4)`,
      [lotId, profileId, endIso, now],
    );
    await client.query(
      `insert into credit_ledger (
         id, profile_id, type, amount, reason, ref, lot_id, created_at
       ) values ($1,$2,'grant',900,'plan_renew_piloto',$3,$4,$5)`,
      [randomUUID(), profileId, String(sub.provider_sub_id ?? "restore"), lotId, now],
    );
    await client.query(
      `update profiles set plano = 'piloto', creditos = 900 where id = $1`,
      [profileId],
    );
    await client.query("commit");
    console.log(
      JSON.stringify(
        {
          ok: true,
          profileId,
          subscriptionId: sub.id,
          periodStart: startIso,
          periodEnd: endIso,
          expiredLots: expired.rowCount,
        },
        null,
        2,
      ),
    );
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
