# GRID — Handoff para o Claude

**Arquivo para upload.** Baixe este `.md` e anexe no Claude (chat ou Project). O Claude **não precisa** do repositório: tudo o que importa para avaliar a estrutura e atualizar o plano está aqui.

**Data:** 05/09/2026  
**Produto:** GRID · Mundo Pódium  
**Repo:** `grid-podium` (GitHub privado)  
**App:** https://grid-podium.vercel.app  
**Domínio custom:** `grid.mundopodium.com.br` — ainda **não** apontado no projeto Vercel

**Anexo de uso real (mesmo dia):** `GRID_auditoria_uso_real.md` — números de produção (créditos, import, automações, schema). Anexe os dois arquivos.

---

## Pedido (cole isto na primeira mensagem, com este arquivo anexado)

Você é um arquiteto de produto/engenharia. Este arquivo é o estado real do GRID em 05/09/2026 — **não** o briefing de agosto e **não** o prompt original do Cursor.

Faça três entregas, nesta ordem:

1. **Diagnóstico da estrutura** — o que está sólido, o que está inchado/duplicado, o que é WIP vs. o que já é produto. Seja honesto. Não elogie o que é só catálogo.
2. **Plano atualizado** — fases do que *já foi entregue* vs. o que falta. Priorize o que destrava um piloto com ~10 Pilotos. Uma fatia por vez. Não reabra Largada/Grid/Ficha. Não invente um rewrite.
3. **Próximo passo executável** — a primeira tarefa concreta (arquivos, risco, critério de pronto). Algo que um agente no Cursor consiga fazer sem contradizer as regras deste doc.

Restrições:

- Não reimplementar ingestão RF, busca, grid, ficha, worker, billing, kanban CRM.
- Não propor shadcn/ui, Prisma, Clerk, i18n, fundo preto `#0D0D0F`.
- Não tratar Automações como motor de workflow genérico. Hoje é só webhook → deal no CRM.
- Não reabrir VoIP sem dizer explicitamente “desligar `CONNECTIONS_STANDBY`”.
- Não usar o modelo antigo de créditos (1 = export, 2 = enrich). O vigente é **1 = qualificar, 50 = exportar**.
- Não sugerir Places API, CPF, CNAE hardcoded, número OSM no export, ou LLM no Minuto de Ouro.

Escreva em pt-BR.

---

## 1. O produto

SaaS brasileiro de **criação de lista, qualificação de leads e CRM** para cold call. O usuário é o **Piloto** (aluno do Mundo Pódium, escola de cold call ao vivo).

Fluxo na UI: **Box → Largada → Grid → Ficha → CRM**.

Promessa atual:

> Monte a lista, encontre quem decide e ligue — com CRM incluído.

Não é extrator de Google Maps. A lista vem dos **Dados Abertos do CNPJ** (Receita Federal): empresa, telefone, CNAE, endereço, sócio/QSA (decisor). Ranqueada por quem ligar primeiro. Qualificação digital (site, selos de telefone, Minuto de Ouro) entra via worker. CRM nativo, importação de planilha e automações inbound já existem no código.

O diferencial histórico: **não vender o telefone do contador**. Telefone que se repete em vários CNPJs é marcado (selo Contabilidade / compartilhado). Nenhum concorrente tipo lista de CNPJ trata isso como produto.

---

## 2. Regras inegociáveis

1. Nunca Google Places / Maps API. Link que *abre* o Maps no browser é permitido.
2. Campo vazio na UI → texto `NÃO ENCONTRADO` ou `NÃO VERIFICADO`. Silêncio é bug.
3. Nunca CPF em banco, UI, export ou payload de integração.
4. Interface em pt-BR. Código, variáveis e comentários em inglês.
5. Campo enriquecido carrega proveniência `{ valor, fonte, coletado_em }`.
6. Nunca CNAE literal no código. Tudo vem da tabela `ref_cnae` + keywords do preset.
7. OSM só confirma (booleano). Número do OSM nunca vai para export.
8. Crawler: `robots.txt`, UA `GridBot/1.0`, rate limit por domínio.
9. Buscar e ver é grátis. Crédito queima em **qualificar (1)** e **exportar (50 por empresa já qualificada)**. Ligar da ficha é grátis.
10. Produção proíbe: mock auth, `DATA_SOURCE=mock`, billing em memória, selos sorteados (`MOCK_PREVIEW_SEALS`).
11. Dados RF e enriquecimento só pelas APIs autenticadas do Next.js — nunca PostgREST / anon key no browser.
12. Repo privado. Nunca `.env` no git.

### Design vigente (não o prompt de agosto)

```
--podium-navy:    #0B1A2E   /* fundo oficial */
--podium-panel:   #12263F
--podium-panel-2: #183250
--podium-yellow:  #F5B301   /* único accent */
--podium-white:   #FFFFFF
--podium-gray:    #C5CDD8
--podium-muted:   #7A8494
--podium-success: #22C55E   /* só prova confirmada */
```

Amarelo nunca decorativo. Sem shadcn. Componentes próprios. Fonte Sora. Tema escuro sempre. Logo horizontal (`lockup.png`) alinhada à esquerda, sem corte/animação da marca.

---

## 3. O que os docs antigos diziam — e o que o código é hoje

Havia um briefing (13/08/2026) que dizia: Fase 1 pronta, Fase 2 (enriquecimento) é o próximo passo, Fases 3–4 (créditos e CRM) fora. **Isso está errado hoje.**

| Agosto/2026 | 05/09/2026 |
|---|---|
| Worker e selos reais = próximo passo | **Feito.** Fila `enrichment_jobs`, worker no Railway, selos reais, auditoria, Minuto de Ouro |
| Créditos = Fase 3, UI cosmética | **Feito.** Catálogo, Asaas, Stripe, Circle (tesouraria), webhooks, tanque |
| CRM / API = Fase 4 | **Feito.** Kanban nativo, import, inbound, console ops |
| Auth só mock | **Supabase Auth** (e-mail/senha + Google). Mock só sem keys ou `GRID_MOCK_AUTH=1` |
| PDF stub | **PDF branded** (`@react-pdf/renderer`) |
| 1 crédito = export, 2 = enrich | **1 = qualificar, 50 = exportar** |
| Fundo preto, shadcn, Prisma no prompt | Navy, componentes próprios, SQL via `pg`, sem Prisma |

Os arquivos `plano_app_prospeccao_mundo_podium.md` e `prompt_cursor_grid.md` continuam úteis como **intenção**. Não são spec da UI nem do backlog atual.

---

## 4. Status por domínio

Legenda: **live** = usável (mock ou Postgres). **paywall** = existe, só com plano pago (`enrichAllowed`). **standby** = código existe, flag desliga a UI. **WIP** = nesta árvore de trabalho, pode não estar committed/em produção. **stub** = catálogo / “em breve”.

| Domínio | Status | O que é |
|---|---|---|
| Ingestão RF | live (código) | Pipeline TypeScript: zips da Receita → COPY no Postgres. Carga real precisa de `DATABASE_URL` + zips. Volume MG/SP+ **não validado** neste handoff |
| Largada / Grid / Ficha / Listas / Empresas | live | Fluxo principal. Mock: 5.000 empresas, 27 UFs, taxonomia nicho→segmento |
| Selos de telefone | live | CONFIRMADO, ATUALIZADO, Contabilidade (compartilhado), Grupo econômico, Não confirmado |
| Worker de enriquecimento | live | Descobre domínio (e-mail RF ou Serper), crawl do site, OSM só confirma, pixel/ads como sinal de dor digital |
| Export CSV / XLSX / PDF | live | Só leads **qualificados**. 50 créditos por CNPJ. Push webhook conta como export |
| Auth | live | Supabase SSR + middleware nas rotas logadas |
| Billing | live | Planos, packs, checkout, webhooks |
| CRM nativo | paywall | Pipeline, colunas (cadência padrão ~11 estágios), cards, histórico, briefing, ligar |
| Importações CSV/XLSX | paywall / **WIP** | Parse → mapear colunas → match CNPJ (só hit único) → criar deals → histórico |
| Automações | paywall / **WIP** | Campanha: URL + Bearer → POST → deal no CRM. **Não** é “se mudou de coluna, manda e-mail” |
| Conexões VoIP / CRM externo | **standby** | Flag `CONNECTIONS_STANDBY = true`. Ligar abre o telefone do aparelho. Adapters no código: webhook, API4COM, Zenvia, Twilio, Telnyx. CRM HubSpot/Pipedrive/etc. = catálogo |
| Painel | live | Métricas de busca, ligação, CRM |
| Calculadora + Metas | live | Funil comercial do método |
| Ops (`/ops`) | live | Console interno (crédito, trial, cancelar). Login próprio, não é o do Piloto |
| Admin de nichos | live | E-mails em `GRID_ADMIN_EMAILS` |
| Cron mensal RF | stub | Ingestão existe; agendar carga mensal em produção **não** é o foco agora |
| Vários usuários na Escuderia | stub | Copy: um usuário nesta versão |

---

## 5. Arquitetura

```
Piloto
  → Vercel (Next.js 15 App Router)
       → Supabase Auth
       → getRepo()
            ├─ DATA_SOURCE=mock → 5k empresas em memória
            └─ postgres/supabase/live + DATABASE_URL → SQL via pg (porta 5432 directa)
       → getBillingStore()  (Postgres ou memória no dev)
       → Upstash Redis (cache / rate limit)
  → Railway: worker de enriquecimento (mesmo Postgres)
  → Asaas / Stripe → /api/billing/webhooks/*
  → Make / site / ads → /api/webhooks/leads → CRM
```

Pontos de desenho:

- **Sem Prisma.** SQL na mão. Interface `GridRepo`. CRM entra como mixin mock/pg.
- Billing é store **separado** do repo de busca.
- Pedir live sem `DATABASE_URL` **quebra** — não cai no mock em silêncio.
- Produção: `assertProdEnv()` no boot.
- Docker Compose é opcional (Postgres local). Produção é Supabase Pro (base RF estoura o Free).

Fluxo de busca: Largada (filtros) → job assíncrono → Grid → ficha → qualificar (1 crédito + fila) → export/CRM.

---

## 6. Stack

- Node ≥ 20, **pnpm**
- Next.js 15.5, React 19, TypeScript 5, Tailwind v4
- Framer Motion, lucide-react, react-hook-form, Zod 4, TanStack Query, dnd-kit (CRM)
- `pg`, `@supabase/ssr`
- exceljs + `@react-pdf/renderer`
- cheerio / undici no crawl; yauzl nos zips da Receita
- Vitest (~173 testes colocalizados). **Sem Playwright**
- **Não:** Prisma, shadcn, Clerk, next-intl

Copy da UI: um arquivo só (`src/lib/copy.ts`), pt-BR.

---

## 7. Mapa de telas e APIs

**Telas:** `/` landing · `/entrar` · `/box` home · `/painel` · `/largada` · `/grid/[id]` · `/lead/[cnpj]` · `/listas` · `/empresas` · `/crm` · `/importacoes` · `/automacoes` · `/conexoes` · `/conta` `/setup` · `/calculadora` `/metas` · `/planos` `/pagar` · `/admin/nichos` · `/ops` · legais (`/bot` `/privacidade` `/termos` `/opt-out` `/duvidas`).

**APIs em grupos:** auth/session · search/grid/lead/enrich/export · niches/CNAE/municípios · profile/painel/metas · billing+webhooks PSP · CRM (pipelines, stages, deals, events) · import parse/run · inbound endpoints+events · webhooks públicos de lead · integrations (connections, call, push) · ops.

**SQL:** ~36 migrations em `supabase/migrations/` (20260812 → 20260917). Isso é a fonte de verdade. Existe um `schema-app.sql` de bootstrap **mais magro** que as migrations (faltam colunas de deal). Quem sobe banco novo deve aplicar migrations, não só o snapshot.

---

## 8. WIP atual (import + automações)

O kanban CRM já estava maduro. A onda recente fecha **planilha → CRM** e **webhook → CRM**.

### Import

Planilha CSV/XLSX (máx. 2 MB, 500 linhas) → parse → o Piloto mapeia colunas (empresa, telefone, e-mail, CNPJ…) → opcionalmente casa nome com CNPJ da base **só se o hit for único** → cria deals na coluna Entrada (`source: import`) → pode qualificar (gasta crédito) → grava um “run” no histórico.

Soft spots: nome ambíguo é ignorado em silêncio; se o histórico falhar ao gravar, o import ainda pode responder sucesso.

### Automações

Até 10 campanhas por conta. Cada uma tem URL pública + token Bearer (o token em claro aparece **uma vez**; no banco só o hash SHA-256). POST JSON (Make, Zapier, formulário do site, ads) vira deal (`source: inbound`) com log dos últimos eventos.

A API aceita mudar pipeline/coluna depois; a UI hoje só cria, copia chave, rotaciona e apaga.

---

## 9. Dinheiro (vigente)

| Plano | Preço | Créditos / mês | CRM e enrich |
|---|---|---|---|
| Treino livre | R$ 0 | 25 qualifies | **não** |
| Piloto | R$ 97 | 900 | sim |
| Piloto Pro | R$ 197 | 4.000 | sim |
| Escuderia | R$ 397 | 6.000 | sim; 1 usuário nesta versão |
| Membro da Plataforma | cupom (assinatura Mundo Pódium) | 900 / 30 dias | sim |
| Packs | avulso | 100 / 500 / 2000 | — |

- Qualificar = 1 crédito.
- Exportar (arquivo ou webhook de lista) = 50 por CNPJ já qualificado. Não cobra de novo o mesmo CNPJ.
- Ligar e receber tabulação = grátis.
- Pix obrigatório no desenho original; Asaas cobre Pix/boleto/cartão BR; Stripe cartão internacional.

---

## 10. Gaps reais (é disto que o plano novo deve falar)

Não volte a listar “ligar Supabase”, “PDF de verdade”, “auth mock” — isso já saiu do caminho.

1. **DNS** — `grid.mundopodium.com.br` ainda não está no Vercel. OAuth, Site URL e webhooks no guia de deploy assumem esse host.
2. **VoIP pausado** — `CONNECTIONS_STANDBY`. Decisão de produto, não bug.
3. **CRM externo** — HubSpot etc. são vitrine. O que funciona para mandar lista: webhook genérico.
4. **Base RF em volume** — limiar “telefone em 3+ CNPJs = contabilidade” precisa de revalidação em MG/SP reais. Aceite antigo (Lighthouse 90, busca &lt; 2s na RF) **não foi medido** em produção.
5. **Exclusões de nicho** magras (clínica vs posto, etc.).
6. **schema-app.sql** desatualizado vs. migrations.
7. **Sem teste e2e** de UI (só Vitest).
8. **Cron RF** e **vários seats** = próxima etapa consciente.
9. Conferir se as tabelas de histórico de import e eventos inbound estão aplicadas em **todos** os ambientes.
10. Adapter de integração não registrado explode com “not implemented” — esperado enquanto o catálogo for maior que o registry.

---

## 11. O que o Claude não deve recomendar

- Reescrever o GRID seco (Largada/tabela/ficha).
- Trocar navy por preto, instalar shadcn, Prisma, Clerk.
- Motor de automação tipo “se estágio X então e-mail”.
- Reabrir o hub VoIP no meio do piloto, salvo prioridade explícita.
- Places API, CPF, CNAE no código, OSM no Excel, LLM gerando o Minuto de Ouro.
- Créditos 1/2 do briefing antigo.

---

## 12. Perguntas que o plano atualizado tem de responder

1. Para **~10 Pilotos reais**, o que falta de operação (DNS, worker, webhooks de pagamento, RF carregada, migrations) vs. polish de tela?
2. O que vem **primeiro**: ops/DNS, fechar import/automações, ou outra coisa? Por quê?
3. O que deste WIP ainda pode estar só na máquina local (não committed / não em produção) e precisa ir para o git antes de tratar como “já lançado”?
4. Há dívida de estrutura que atrapalha o próximo passo (repo único gigante, schema snapshot vs migrations, Conexões congeladas no Box)?
5. Confirmar fora de escopo até o piloto: seats Escuderia, CRM HubSpot nativo, workflow genérico, cron mensal da Receita.

Critério de um bom plano: a próxima sessão no Cursor executa **uma** fatia sem reabrir o produto e sem quebrar créditos, navy ou as regras inegociáveis.

---

## 13. Como o time sobe o app (contexto)

```bash
pnpm install
pnpm dev
```

localhost:3000 → Entrar (mock se não houver keys) → Box → Nova largada.

Live: `DATA_SOURCE=postgres`, `DATABASE_URL` na porta **5432** (não o pooler 6543), keys Supabase. Worker: `pnpm worker:dev`. Checklist de produção: `pnpm launch:check` / `launch:ready`.

---

## 14. Auditoria de uso (05/09/2026)

Consulta read-only no Postgres de produção. Relatório completo: **`GRID_auditoria_uso_real.md`**. Resumo:

1. **Créditos** — 2 Pilotos pagantes: 166 qualifies vs 4 exports (97,6% / 2,4% das ações); em créditos 223 vs 151 (o 50× já é 40% do gasto). Ninguém pagante perto do limite (683 e 743 de 900). 13 membros plataforma; alanis com 294 restantes é o tanque mais baixo. Export de membro ainda debitou 1 crédito/CNPJ; pagante debitou 50.
2. **Import** — 2 runs de teste do founder, 0 issue de nome ambíguo (o código não grava isso), 3 deals import todos sem CNPJ. Zero uso de piloto.
3. **Automações** — 4 campanhas, todas do founder; 0 deals inbound; 3/4 tokens sem evento; 2 POSTs 401.
4. **Schema** — produção tem colunas de deal (`cnpj`/`meta`/`people`/`outcome`) que o `schema-app.sql` não tem. Produção **não** tem tabela `metas` nem `active_meta_id`. Índices de idempotência de `credit_lots` (`20260911`) não estão em prod.

O fluxo real do piloto hoje é **qualificar + CRM via bridge** (`catchup_bridge` 477, `qualify_bridge` 150), não planilha nem webhook. Mapa fechado em **`GRID_diagnostico_bridges.md`**: mesma função, dois carimbos; o Grid dispara catch-up porque `/api/enrich` devolve `crmBridge: null`; os dois ainda rodam nos pagantes. `/metas` ficou de fora deste recorte.

---

Fim do handoff. Diagnóstico → plano atualizado → primeiro passo executável. Sem rewrite. Sem reabrir agosto. Use os números da §14 / do anexo; não invente volume.
