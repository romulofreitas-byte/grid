# GRID — Auditoria de uso real (produção)

**Data da consulta:** 05/09/2026 14:52 UTC  
**Base:** Supabase Postgres (pooler `aws-0-us-west-2`, porta 5432)  
**Escopo:** somente leitura. Sem mudança de schema, lógica, Largada/Grid/Ficha, créditos, VoIP.  
**Cole este arquivo no Claude junto com `GRID_handoff_claude.md`.**

Critério de **Piloto pagante ativo:** `billing_subscriptions.status in ('active','trialing')` e `plan in ('piloto','piloto_pro','escuderia')`.  
**Membro da Plataforma** (cupom, 900 créditos / 30 dias) é reportado à parte — tem CRM, não é R$ 97.

---

## 1. Créditos — qualificar vs exportar

Modelo vigente no código: **1 = qualificar (`reason=enrich`)**, **50 = exportar**.  
Contagem de ações = `billed_cnpjs` (1 linha por CNPJ). Gasto = `credit_ledger` débito.

| Recorte | Qualificar (ações) | Exportar (ações) | Créditos qualify | Créditos export |
|---|---:|---:|---:|---:|
| Toda a base | 1.148 | 53 | 1.943 | 200 |
| **2 Pilotos pagantes** | **166** | **4** | **223** | **151** |
| 13 Membros da Plataforma | 950 | 49 | 1.688 | 49 |

**Proporção (pagantes):** 166 : 4 ações (**97,6% / 2,4%**). Em créditos: 223 : 151 (**60% / 40%**) — o preço 50× já pesa no tanque mesmo com 4 CNPJs exportados.

**Assinaturas agora:** 2× `piloto` active · 0 Pro · 0 Escuderia · 12× `membro_plataforma` trialing · 1× membro active (`administracao`). Pedidos pagos: 2× Piloto R$ 97 + 1 pack 100. 24 contas `free`.

**Perto do limite do plano?** Não, nos pagantes.

| Conta | Plano | Tanque plano | Cota | % restante |
|---|---|---:|---:|---:|
| romulocsfreitas | Piloto (paga) | 683 | 900 | 76% |
| Rômulo Freitas | Piloto (paga) + pack 100 | 743 + 100 | 900 | 83% |
| alanis_mendes | Membro (trial → 24/09) | 294 | 900 | 33% — maior consumo |
| administracao | Membro active → 18/09 | 389 | 900 | 43% |

Nenhum pagante abaixo de 10% da cota nem abaixo de 50 créditos. Treino livre no fundo do poço (Anderson 4, Alisson 15) não é plano pago.

**Achado extra (não suposição):** export dos membros bate 1 crédito por CNPJ no ledger (maycon 31=31, alanis 18=18) — preço antigo ou débito anterior à regra 50. Nos 2 Pilotos pagos o 50× está valendo (2+2 CNPJs → 100+51 créditos). `billed_cnpjs` enrich (1.148) < ledger enrich (1.943): há re-qualificação (`forceCharge`) em cima do mesmo CNPJ.

---

## 2. Import — taxa de silêncio

Tabela `crm_import_runs` **existe em produção.** Volume: **2 runs**, ambos 05/09, arquivo `mapa-teste.csv`, pipeline “Estética automotiva” (teste do founder, não de piloto).

| | n |
|---|---:|
| Runs | 2 |
| Deals criados (soma) | 2 |
| Skips “Já estava no quadro” | 2 |
| Erros em issue | 2 (1 “Linha vazia”, 1 “CNPJ inválido”) |
| Issues “nome ambíguo ignorado” | **0** |
| Runs com `created>0` e `error_count>0` | 1 |
| Deals `source=import` | 3, **todos sem CNPJ** |

O silêncio de nome ambíguo **não é mensurável nesta tabela**: o match (`pickUniqueCompanyHit`) não grava issue quando o hit não é único. 0 no log ≠ 0 na vida. Proxy: 3/3 deals de import sem CNPJ — pode ser planilha sem CNPJ, match falho ou ambíguo; o histórico não distingue.

O outro soft spot (HTTP 200 com falha ao gravar o run) **não apareceu nestes 2 runs** — os dois persistiram. Se a tabela faltasse, o repo engole `42P01` e devolve sucesso sem linha; hoje a tabela está lá. Sem acesso a logs Vercel `import_run_persist_error`, a taxa real desse segundo silêncio é **desconhecida, amostra n=2**.

**Uso de piloto: zero.** Não há sinal de import em contas pagantes.

---

## 3. Automações — uso real

| Métrica | Número |
|---|---|
| Campanhas (`crm_inbound_endpoints`) | **4** |
| Contas donas | **1** (Rômulo Freitas, testes 05/09) |
| Deals `source=inbound` (30 dias) | **0** |
| Eventos inbound | 2, ambos **erro 401** (“Token ausente”, “Token inválido”) |
| Tokens sem nenhum evento | **3 / 4** |
| Token com evento recente | 1 (“teste site”) — só falha de auth |

Colunas `nome` / `lead_kind` / `channel` e a tabela `crm_inbound_events` **já estão em produção.**  
Nenhum Piloto pagante tem campanha. Integração Make/site **não está conectada** fora do teste do founder (3 URLs nunca receberam POST autenticado).

---

## 4. `schema-app.sql` vs estado real em produção

Não existe `supabase_migrations.schema_migrations` (schema sobe via `pnpm db:apply-app`, não CLI Supabase). Diff = `information_schema` vs snapshot vs pasta `supabase/migrations/`.

**Produção está à frente do snapshot em deals** (o buraco do handoff):

| Coluna em `crm_deals` | Produção | `schema-app.sql` |
|---|---|---|
| `cnpj`, `meta`, `outcome`, `people` | **tem** | **falta** |
| `amount_cents` | tem | tem |
| `crm_stages.canonical_key` | tem | falta |
| `lead_enrichment.gmb` / `discarded_domains` | tem | falta |
| `enrichment_jobs.payload` + `priority` | tem | payload falta; priority tem |

**Snapshot está à frente da produção em metas:**

| Objeto | Snapshot / migration local | Produção |
|---|---|---|
| tabela `metas` | sim (`20260916`, untracked) | **não** |
| `profiles.active_meta_id` | sim | **não** (`funnel_plan` existe) |
| `crm_import_runs` / `crm_inbound_events` / colunas de campanha | sim | **sim** (já aplicadas) |
| índices `credit_lots_one_open_period` / `one_per_order` (`20260911`) | sim em `schema-billing.sql` | **não** (só `credit_lots_open_idx` + pkey) |

Tabelas de app em produção que o snapshot não cria: `crm_events`, `search_jobs`, `user_catchup_state`, `platform_subscribers`, `integration_*`, billing (arquivo separado).

Risco se alguém bootstrapar banco novo só com `schema-app.sql`: deals sem `meta`/`cnpj` (import e inbound quebram). Risco inverso: código de `/metas` contra prod **sem** tabela `metas`.

---

## Insumo para a próxima fatia (não decidir aqui)

1. **Planos / preço de export** — nos 2 pagantes o 50× já é 40% do crédito gasto com 4 empresas. Qualificar domina ações. Ninguém pagante está no limite. Membros ainda exportaram barato (1 crédito); se a regra 50 pegar essa coorte, alanis (294 restantes) sente primeiro.
2. **Import silencioso** — não é bug visto em piloto; é código que não registra ambíguo + 2 CSVs de teste. Corrigir o log é barato; não há volume que justifique priorizar por “taxa”.
3. **Automações / editar pipeline** — 0 deals inbound, 0 campanhas de cliente. UI de destino é dívida de produto, não de operação. Tokens mortos = testes do founder, não integração quebrada de piloto.

**Dado na mão:** o piloto real hoje é **qualificação + CRM via bridge** (`catchup_bridge` 477 deals, `qualify_bridge` 150), não import e não webhook.
