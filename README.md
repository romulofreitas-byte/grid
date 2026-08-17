# GRID · Mundo Pódium

SaaS de criação de lista e qualificação de leads para cold call.

**Estado:** app liga em Postgres via `DATABASE_URL` (`DATA_SOURCE=postgres`). Docker é opcional para desenvolvimento local. O projeto Supabase é [smroraizzrbbrkwpaukh](https://smroraizzrbbrkwpaukh.supabase.co).

Briefing: [`briefing_claude_proximo_passo.md`](./briefing_claude_proximo_passo.md). Plano original: `plano_app_prospeccao_mundo_podium.md`.

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS v4 · Framer Motion · lucide-react · Sora
- Design: base **navy** `#0B1A2E` + accent amarelo `#F5B301`
- Dados: `DATA_SOURCE=mock` **ou** `postgres`/`supabase` com `DATABASE_URL` (SQL via `pg`, não PostgREST)
- Worker de enriquecimento: `pnpm worker:dev` / `pnpm worker:once`
- Export: ExcelJS (XLSX/CSV) · PDF simplificado

## Começar (mock, sem banco)

```bash
pnpm install
pnpm dev
```

Abra [http://localhost:3000](http://localhost:3000) → **Entrar** (mock) → **Box** → **Nova largada**.

Mock atual: **5.000** empresas em **27 UFs**, **5.571** municípios IBGE, **106** nós de taxonomia (16 nichos + ~90 segmentos). Cluster de **grupo econômico** nos índices 200–207 (mesmo sócio, telefone `3222-1111`). Telefone de escritório `3333-4444` em dezenas de CNPJs com sócios disjuntos.

## Scripts

| Comando | Função |
|---------|--------|
| `pnpm dev` | App local |
| `pnpm build` | Build produção |
| `pnpm test` | Vitest (telefone, selos, domínio, extração, robots, Minuto de Ouro) |
| `pnpm worker:dev` | Worker de enriquecimento em loop |
| `pnpm worker:once -- --cnpj=...` | Processa um job e sai |
| `pnpm validate:phones` | Relatório `reports/phone-sharing.md` |
| `pnpm ingest` | Pipeline RF (precisa `DATABASE_URL` + zips) |
| `pnpm seed:presets` | SQL/seed dos 16 presets (upsert por slug) |
| `pnpm seed:mock` | Resumo do store mock |
| `pnpm audit:segments` | Relatório `reports/segment-coverage.md` |
| `pnpm db:dump-supabase` | Dump do Postgres local para restaurar no Supabase |

## Ligar o Supabase (sair do Docker)

Projeto: `https://smroraizzrbbrkwpaukh.supabase.co`

A base RF de MG+SP costuma passar dos **500 MB do Free** — o plano Pro é o caminho mais seguro. Use a **conexão direta (porta 5432)**, não o pooler transaction (6543).

1. No dashboard: copiar anon key, service role e a senha do `postgres`.
2. Conferir o tamanho local: `psql postgresql://grid:grid@127.0.0.1:5432/grid -c "\l+"`.
3. Dump: `pnpm db:dump-supabase`
4. Restore: definir `SUPABASE_DB_URL=postgresql://postgres.[SENHA]@db.smroraizzrbbrkwpaukh.supabase.co:5432/postgres?sslmode=require` e `pnpm db:dump-supabase -- --restore`
   (ou os comandos `pg_restore` / `psql … post-restore.sql` que o script imprime)
5. `pnpm seed:presets`
6. `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL=https://smroraizzrbbrkwpaukh.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=…`
   - `DATABASE_URL=…sslmode=require` (direct 5432)
   - `DATA_SOURCE=postgres`
7. `pnpm dev` — se o grid abrir, o `docker compose` local pode ser desligado.

Ingestão nova da RF também pode apontar para o mesmo `DATABASE_URL` (`pnpm ingest --ufs=MG,SP`).

Auth: e-mail + senha (1 confirmação no cadastro) e Google quando as chaves existem. Sem chaves, `/entrar` continua no mock.

Docker (`docker compose up -d`) fica só para dev/offline.

## Fase 2 — o que está no código

- Selos reais via `deriveSeal` (CONFIRMADO / ATUALIZADO / Contabilidade / Grupo / Não confirmado). Sorteio só com `MOCK_PREVIEW_SEALS=1` **e** mock
- Fila `enrichment_jobs` + worker (8 em paralelo, robots.txt, UA `GridBot/1.0`)
- Auditoria digital na ficha, Minuto de Ouro determinístico, dor digital no score
- Grid: enriquecer 50 / lista, progresso por polling, marcador “sem auditoria”
- `/bot` e aviso de crawl + ODbL em `/privacidade`

## Relatório de telefone compartilhado

`reports/phone-sharing.md` — nesta máquina está rotulado **MOCK**. O limiar de 3 CNPJs **não foi validado** contra MG/SP reais. No mock, a regra de sócios separa o cluster 200–207 (Grupo) do telefone de escritório (Contabilidade).

## Regras do produto

- Sem Google Places API (link Maps permitido)
- Sem CPF em banco, UI ou export
- Campo vazio → `NÃO ENCONTRADO` / `NÃO VERIFICADO`
- CNAEs só via `ref_cnae` + keywords (nunca literais nos presets)
- OSM só confirma número já conhecido — o número do OSM não vai para o export
- Sem LLM no Minuto de Ouro
- Sem cobrança (Fase 3)

Para passar o estado a outra sessão, use `briefing_claude_proximo_passo.md`.
