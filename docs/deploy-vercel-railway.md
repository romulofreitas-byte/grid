# Deploy GRID — Vercel + Supabase + Railway

Guia passo a passo para colocar o GRID em produção com:

- **App Next.js** → Vercel
- **Postgres + Auth** → Supabase
- **Worker de enrichment** → Railway (processo always-on)
- **Cache / rate limit** → Upstash Redis (recomendado)

---

## Visão geral

```
Usuário → Vercel (Next.js)
              ↓ DATABASE_URL (5432 direct)
         Supabase Postgres
              ↑
         Railway worker (pnpm worker:dev)

Billing webhooks → Vercel /api/billing/webhooks/*
Auth → Supabase Auth
Count cache + rate limit → Upstash Redis
```

### Estado atual (projeto já linkado)

- App Vercel: **https://grid-podium.vercel.app** (org Mundo Pódium, projeto `grid-podium`).
- Já na Production: `DATA_SOURCE`, `DATABASE_URL`, Supabase public, `INTEGRATION_KMS_KEY`, cupom, WhatsApp, `GRID_ENV`.
- **Não** defina `GRID_MOCK_AUTH` na Vercel (hoje não está lá — mantenha assim).
- Domínio custom `grid.mundopodium.com.br` ainda **não** está neste projeto (0 domains no team). Use o `.vercel.app` até o DNS.
- URLs de webhook/auth: `pnpm launch:webhooks`.

---

## Pré-requisitos

- Conta [Supabase](https://supabase.com) (Pro recomendado para ~68M estabelecimentos)
- Conta [Vercel](https://vercel.com) (Pro se precisar de `maxDuration=60` estável)
- Conta [Railway](https://railway.app) para o worker
- Conta [Upstash](https://upstash.com) Redis (serverless, ~US$10/mês)
- Domínio apontando para Vercel (ex.: `grid.mundopodium.com.br`)
- Dados RF ingeridos (`pnpm ingest -- --ufs=ALL`) ou dump restaurado no Supabase

---

## Parte 1 — Supabase (banco + auth)

### 1.1 Projeto e conexão

1. Crie ou use o projeto Supabase (`NEXT_PUBLIC_SUPABASE_URL` no `.env.example`).
2. Em **Settings → Database**, copie a connection string **Direct** (porta **5432**).
3. **Não use** o pooler 6543 para count/runSearch pesados.

```
DATABASE_URL=postgresql://postgres.[ref]:[SENHA]@db.[ref].supabase.co:5432/postgres?sslmode=require
```

### 1.2 Auth

1. **Authentication → URL configuration**
   - Site URL: `https://grid.mundopodium.com.br`
   - Redirect URLs: `https://grid.mundopodium.com.br/auth/callback`
2. Copie **anon key** e **service role key** para a Vercel.
3. Em produção: **não** defina `GRID_MOCK_AUTH`.

### 1.3 Schema e migrations

Na máquina local (com `DATABASE_URL` apontando para Supabase):

```bash
# Schema RF + app (se banco vazio)
pnpm db:setup

# Migrations additive (billing, integrations, abuse limits, establishments_search)
pnpm db:apply-app
```

Após **ingest completo** ou restore de dump:

```bash
# Índices + refresh MVs (ver scripts/db/post-restore.sql)
# Depois populate da tabela flat:
pnpm db:populate-search
```

### 1.4 Ingest Brasil inteiro (uma vez por mês RF)

```bash
pnpm ingest:download          # baixa zips RF (pode levar horas)
pnpm ingest -- --ufs=ALL      # COPY + índices + MVs + establishments_search
pnpm seed:presets
```

Validar volumetria (~68M `establishments`, ~28M `companies`).

---

## Parte 2 — Upstash Redis

1. Crie um database Redis na Upstash (região próxima ao Supabase).
2. Copie **UPSTASH_REDIS_REST_URL** e **UPSTASH_REDIS_REST_TOKEN**.
3. Usado para: cache de count (10 min) e rate limit distribuído entre instâncias Vercel.

---

## Parte 3 — Vercel (app Next.js)

### 3.1 Importar repositório

1. Vercel → **Add New Project** → importe o repo Git.
2. Framework: **Next.js** (detectado automaticamente).
3. Build: `pnpm build` | Output: padrão Next.js.

### 3.2 Variáveis de ambiente (Production)

| Variável | Valor |
|----------|--------|
| `DATA_SOURCE` | `postgres` |
| `DATABASE_URL` | connection string 5432 Supabase |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | service role (server only) |
| `NEXT_PUBLIC_SITE_URL` | `https://grid.mundopodium.com.br` |
| `GRID_ENV` | `production` |
| `GRID_ADMIN_EMAILS` | e-mails admin separados por vírgula |
| `INTEGRATION_KMS_KEY` | string aleatória 32+ chars |
| `UPSTASH_REDIS_REST_URL` | Upstash |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash |
| `ASAAS_API_KEY` | produção Asaas |
| `ASAAS_WEBHOOK_TOKEN` | token que você define no webhook Asaas |
| `STRIPE_SECRET_KEY` | opcional internacional |
| `STRIPE_WEBHOOK_SECRET` | whsec_... |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | pk_live_... |
| `BILLING_PLATFORM_COUPON` | `PILOTOPODIUM` |
| `NEXT_PUBLIC_SUPPORT_WHATSAPP` | E.164 sem + |

**Não definir:** `GRID_MOCK_AUTH`, `BILLING_STORE=memory`.

### 3.3 Domínio

1. Vercel → Project → **Domains** → adicione `grid.mundopodium.com.br`.
2. Configure DNS (CNAME) conforme instruções Vercel.

### 3.4 Deploy e smoke test

Após deploy:

```bash
pnpm launch:check   # local, com .env espelhando prod
```

Manual:

1. Login Supabase (magic link / OTP)
2. `/largada` → count em <5s (com `establishments_search` populada)
3. runSearch → grid com leads
4. Checkout teste → webhook → créditos
5. Export debita crédito

---

## Parte 4 — Railway (worker de enrichment)

O crawl Cheerio **não roda na Vercel** (timeout serverless). Use um serviço always-on.

### 4.1 Novo serviço

O repo inclui `railway.toml` com `startCommand = pnpm worker:dev` (não sobe o Next.js).

1. Railway → **New Project** → **Deploy from GitHub repo** (mesmo repo).
2. Confirme que o start command é `pnpm worker:dev` (Settings → Deploy).
   - Não use o comando de start da Vercel (`next start`).

### 4.2 Variáveis (mesmas do app, subset)

| Variável | Obrigatório |
|----------|-------------|
| `DATABASE_URL` | sim |
| `DATA_SOURCE` | `postgres` |
| `ENRICH_CONCURRENCY` | `8` (ajuste conforme RAM) |
| `SERPER_API_KEY` | opcional (busca domínio) |
| `GRID_ENV` | `production` |

O worker usa `assertWorkerEnv()` — falha no boot se `DATABASE_URL` ausente.

### 4.3 Healthcheck

- Logs devem mostrar: `{"event":"worker_start","concurrency":8}`
- Enfileire um enrich na ficha de um CNPJ pago → job deve sair de `pending` em minutos.

### 4.4 Recursos

- Mínimo recomendado: **1 vCPU, 2 GB RAM** com `ENRICH_CONCURRENCY=4–8`
- Scale horizontal: **um** worker basta na v1; evite dois workers competindo sem fila externa

---

## Parte 5 — Webhooks de billing

Registre nos dashboards dos providers (URLs públicas HTTPS). Até o domínio custom:

| Provider | URL (agora) |
|----------|-------------|
| Asaas | `https://grid-podium.vercel.app/api/billing/webhooks/asaas` |
| Stripe | `https://grid-podium.vercel.app/api/billing/webhooks/stripe` |
| Circle | `https://grid-podium.vercel.app/api/billing/webhooks/circle` |

Quando `grid.mundopodium.com.br` estiver no ar, atualize os endpoints **e** `NEXT_PUBLIC_SITE_URL`.

`pnpm launch:webhooks` imprime as URLs a partir do site público (não usa `localhost`).

Em produção, secrets são **obrigatórios** — webhooks sem token são rejeitados.

### Asaas

1. Painel Asaas → Integrações → Webhooks
2. Eventos: pagamento confirmado / recebido
3. Header `asaas-access-token` = valor de `ASAAS_WEBHOOK_TOKEN`

### Stripe

1. Developers → Webhooks → endpoint acima
2. Eventos: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`
3. Signing secret → `STRIPE_WEBHOOK_SECRET`

---

## Parte 6 — Pós-deploy

### Checklist

- [ ] `pnpm launch:check` sem `[ERROR]`
- [ ] `select count(*) from establishments_search` > 0 no Supabase
- [ ] Login real (sem mock auth)
- [ ] Admin só para e-mails em `GRID_ADMIN_EMAILS`
- [ ] Worker processando jobs
- [ ] Webhook teste (Asaas sandbox ou Stripe test mode)
- [ ] `platform_subscribers` populado para cupom `PILOTOPODIUM`
- [ ] Upstash recebendo keys `count:v1:*` e `rl:v1:*`

### Comandos úteis

```bash
pnpm db:apply-app          # migrations app
pnpm db:populate-search    # rebuild flat table (pós-ingest)
pnpm launch:check          # validação env
pnpm launch:smoke          # tempo do count/runSearch na tabela flat
pnpm worker:dev            # worker local
pnpm billing:sweep         # tesouraria Circle (se configurado)
```

### Rollback ingest

- Restaurar snapshot Supabase antes do ingest
- Re-run `post-restore.sql` + `pnpm db:populate-search`

---

## Estimativa de custo mensal (v1)

| Serviço | Faixa |
|---------|--------|
| Supabase Pro | ~US$25–100+ (storage 80–120 GB) |
| Vercel Pro | ~US$20 |
| Railway worker | ~US$5–20 |
| Upstash Redis | ~US$10 |
| **Total** | **~R$400–800/mês** |

---

## Troubleshooting

| Sintoma | Causa provável | Ação |
|---------|----------------|------|
| Count >30s | `establishments_search` vazia | `pnpm db:populate-search` |
| App em mock | `DATA_SOURCE` ausente ou sem `DATABASE_URL` | Corrigir env Vercel |
| Créditos somem | `BILLING_STORE=memory` | Remover var; usar Postgres |
| Enrich não roda | Worker parado ou mock mode | Railway logs + `DATA_SOURCE=postgres` |
| 401 webhook | Secret errado | Conferir token no provider vs env |
| Admin aberto para todos | `GRID_ADMIN_EMAILS` vazio | Definir allowlist |
| Rate limit inconsistente | Sem Upstash | Configurar Redis REST |

---

## Ordem recomendada de execução

1. Supabase: schema + ingest (ou restore dump)
2. `pnpm db:apply-app` + `pnpm db:populate-search`
3. Upstash Redis
4. Vercel deploy + env + domínio
5. Railway worker
6. Webhooks Asaas/Stripe
7. `pnpm launch:check` + smoke test manual
8. Abrir comunidade
