# GRID — Handoff para o Claude

**Arquivo para upload.** Baixe este `.md` e anexe no Claude (chat ou Project). O Claude **não precisa** do repositório: tudo o que importa para avaliar a estrutura e atualizar o plano está aqui.

**Data:** 05/09/2026 (atualização da tarde)  
**Produto:** GRID · Mundo Pódium  
**Repo:** `grid-podium` (GitHub privado)  
**App:** https://grid-podium.vercel.app  
**Domínio custom:** `grid.mundopodium.com.br` — ainda **não** apontado no projeto Vercel

**Anexo de uso real (mesmo dia):** `GRID_auditoria_uso_real.md` — números de produção (créditos, import, automações, schema). Anexe os dois arquivos. Diagnóstico de CRM bridge: `GRID_diagnostico_bridges.md` (opcional).

---

## Pedido (cole isto na primeira mensagem, com este arquivo anexado)

Você é um arquiteto de produto/engenharia. Este arquivo é o estado real do GRID em 05/09/2026 (tarde) — **não** o briefing de agosto e **não** o prompt original do Cursor.

Faça três entregas, nesta ordem:

1. **Diagnóstico da estrutura** — o que está sólido, o que está inchado/duplicado, o que é WIP vs. o que já é produto. Seja honesto. Não elogie o que é só catálogo.
2. **Plano atualizado** — fases do que *já foi entregue* vs. o que falta. Priorize o que destrava um piloto com ~10 Pilotos. Uma fatia por vez. Não reabra Largada/Grid/Ficha. Não invente um rewrite.
3. **Próximo passo executável** — a primeira tarefa concreta (arquivos, risco, critério de pronto). Algo que um agente no Cursor consiga fazer sem contradizer as regras deste doc.

Restrições:

- Não reimplementar ingestão RF, busca, grid, ficha, worker, billing, kanban CRM.
- Não propor shadcn/ui, Prisma, Clerk, i18n, fundo preto `#0D0D0F`.
- Não tratar Automações como motor de workflow genérico. Hoje é só webhook → deal no CRM.
- **Não reabrir a escada de planos.** Preço, créditos e *o que cada SKU inclui* já foram decididos nesta data. Seats extras ficam só na Escuderia e **não se implementam agora**.
- Não pôr Automações no Piloto. Importação de planilha **é** do Piloto.
- Não desligar `CONNECTIONS_STANDBY` (hoje `true` no git) nem recongelar o hub sem decisão explícita — o reopen de VoIP/3C Plus ainda está **só na working tree**.
- Não usar o modelo antigo de créditos (1 = export, 2 = enrich). O vigente é **1 = qualificar, 50 = exportar**.
- Não sugerir Places API, CPF, CNAE hardcoded, número OSM no export, ou LLM no Minuto de Ouro.

Escreva em pt-BR.

---

## 1. O produto

SaaS brasileiro de **criação de lista, qualificação de leads e CRM** para cold call. O usuário é o **Piloto** (aluno do Mundo Pódium, escola de cold call ao vivo).

Fluxo na UI: **Painel (home logada) → Largada → Grid → Ficha → CRM**. Box ainda existe; Meta do dia alimenta o Painel.

Promessa atual:

> Monte a lista, encontre quem decide e ligue — com CRM incluído.

Não é extrator de Google Maps. A lista vem dos **Dados Abertos do CNPJ** (Receita Federal): empresa, telefone, CNAE, endereço, sócio/QSA (decisor). Ranqueada por quem ligar primeiro. Qualificação digital (site, selos de telefone, Minuto de Ouro) entra via worker. CRM nativo e importação de planilha existem no código **e no git**. Automações inbound existem no código, mas **não no plano Piloto**.

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

| Agosto/2026 | 05/09/2026 (tarde) |
|---|---|
| Worker e selos reais = próximo passo | **Feito.** Fila `enrichment_jobs`, worker no Railway, selos reais, auditoria, Minuto de Ouro |
| Créditos = Fase 3, UI cosmética | **Feito.** Catálogo, Asaas, Stripe, Circle (tesouraria), webhooks, tanque |
| CRM / API = Fase 4 | **Feito.** Kanban nativo, import no Piloto, inbound no Pro |
| Auth só mock | **Supabase Auth** (e-mail/senha + Google). Mock só sem keys ou `GRID_MOCK_AUTH=1` |
| PDF stub | **PDF branded** (`@react-pdf/renderer`) |
| 1 crédito = export, 2 = enrich | **1 = qualificar, 50 = exportar** |
| Fundo preto, shadcn, Prisma no prompt | Navy, componentes próprios, SQL via `pg`, sem Prisma |
| Escuderia = 5 usuários | Copy: um usuário nesta versão. Seats **não** nesta etapa |

Os arquivos `plano_app_prospeccao_mundo_podium.md` e `prompt_cursor_grid.md` continuam úteis como **intenção**. Não são spec da UI nem do backlog atual. `briefing_claude_proximo_passo.md` está **defasado**.

---

## 4. Escada de planos (decidida nesta data — não reabrir)

Fonte: `src/lib/billing/catalog.ts` (`planHasFeature`, `highlights` / `details` / `notes`). Cards em `/` e `/planos` usam `PlanCard` (quatro bullets + “Ver tudo”). **Preço não mudou.**

À venda agora (`SKUS_ON_SALE`): **Treino livre** (grátis), **Piloto**, cupom **PILOTO** (`membro_plataforma`), packs. **Piloto Pro e Escuderia = Em breve** (checkout recusa).

| Superfície | Treino livre | Piloto (+ cupom PILOTO) | Piloto Pro | Escuderia |
|---|---|---|---|---|
| Buscar / ver lista | sim | sim | sim | sim |
| Qualificar | 25/mês | 900 cr. | 4.000 + fila | 6.000 + fila |
| CRM, Painel, Meta, Ligar | não | sim | sim | sim |
| Exportar (50 cr./CNPJ) | não | sim | sim | sim |
| Importar planilha (`/importacoes`) | não | **sim** | sim | sim |
| Automações webhook (`/automacoes`) | não | **não** | **sim** | **sim** |
| Seats | — | — | — | prometido, **não nesta versão** |

Gate no código: `planHasFeature` + `assertAutomationsAccess` + `guardAutomationsApi`. Página `/automacoes` e POST público `/api/webhooks/leads` recusam plano `piloto` / `membro_plataforma` (403; o webhook grava evento de erro). Menu Automações **continua visível** e cai no paywall *“entra no Piloto Pro — em breve”* (CTA = Ver planos, **sem** checkout do Pro).

Efeito colateral consciente: ninguém compra Pro hoje, então Automações não tem SKU à venda. Quem testa (founder) precisa de assinatura `piloto_pro` no billing — sem flag secreta.

`membro_plataforma` = nível **Piloto** por 30 dias (CRM + import, sem Automações).

---

## 5. Status por domínio

Legenda: **live** = usável (mock ou Postgres), no git. **paywall** = existe, só com o plano que inclui. **standby** = código existe, flag desliga a UI. **WIP local** = na working tree, **não** committed. **stub** = catálogo / “em breve”.

| Domínio | Status | O que é |
|---|---|---|
| Ingestão RF | live (código) | Pipeline TypeScript: zips da Receita → COPY no Postgres. Carga real precisa de `DATABASE_URL` + zips. Volume MG/SP+ **não validado** neste handoff |
| Largada / Grid / Ficha / Listas / Empresas | live | Fluxo principal. Mock: 5.000 empresas, 27 UFs, taxonomia nicho→segmento |
| Selos de telefone | live | CONFIRMADO, ATUALIZADO, Contabilidade (compartilhado), Grupo econômico, Não confirmado |
| Worker de enriquecimento | live | Descobre domínio (e-mail RF ou Serper), crawl do site, OSM só confirma, pixel/ads como sinal de dor digital |
| Export CSV / XLSX / PDF | live | Só leads **qualificados**. 50 créditos por CNPJ. Push webhook conta como export |
| Auth | live | Supabase SSR + middleware nas rotas logadas. Google no `/entrar` |
| Billing / planos | live | Escada §4. Asaas, Stripe, Circle, cupom PILOTO. Cards alinhados + Ver tudo |
| CRM nativo | paywall (Piloto+) | Pipeline, colunas (~11 estágios), cards, histórico, briefing, ligar após confirmar |
| Importações CSV/XLSX | paywall (Piloto+) | Parse → mapear colunas (incl. notas) → match CNPJ **só hit único** → deals → histórico da última run + CSV de erros |
| Automações | paywall (**Pro+**) | Até 10 campanhas: URL + Bearer → POST → deal. **Não** é “se mudou de coluna, manda e-mail” |
| Conexões VoIP / discador | **standby no git** | `CONNECTIONS_STANDBY = true` no commit. Ligar abre o telefone do aparelho. **WIP local:** flag `false`, API4COM, 3C Plus (sandbox Integra Aí) — não tratar como lançado |
| CRM externo (HubSpot etc.) | stub | Catálogo. Lista sai por webhook genérico (e 3C Plus no WIP local) |
| Painel | live | Home comercial logada: busca, ligação, CRM |
| Metas (`/metas`, `/calculadora` redireciona) | live no git | Funil do método, aplica meta no Box. **Produção pode não ter tabela `metas`** (auditoria) |
| Ops (`/ops`) | live | Console interno (crédito, trial, cancelar, Hoje). Login próprio |
| Admin de nichos | live | E-mails em `GRID_ADMIN_EMAILS` |
| Cron mensal RF | stub | Ingestão existe; agendar carga mensal **não** é o foco agora |
| Vários usuários na Escuderia | stub | Copy + `notes`: seats em desenvolvimento. **Não implementar agora** |

---

## 6. Arquitetura

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
  → Make / site / ads → /api/webhooks/leads → CRM  (só se o dono do token for Pro/Escuderia)
```

Pontos de desenho:

- **Sem Prisma.** SQL na mão. Interface `GridRepo`. CRM entra como mixin mock/pg.
- Billing é store **separado** do repo de busca. Features de plano: `planHasFeature` no catálogo, não espalhar `if (plano === …)` na UI.
- Pedir live sem `DATABASE_URL` **quebra** — não cai no mock em silêncio.
- Produção: `assertProdEnv()` no boot.
- Docker Compose é opcional (Postgres local). Produção é Supabase Pro (base RF estoura o Free).

Fluxo de busca: Largada (filtros) → job assíncrono → Grid → ficha → qualificar (1 crédito + fila) → export/CRM.

---

## 7. Stack

- Node ≥ 20, **pnpm**
- Next.js 15.5, React 19, TypeScript 5, Tailwind v4
- Framer Motion, lucide-react, react-hook-form, Zod 4, TanStack Query, dnd-kit (CRM)
- `pg`, `@supabase/ssr`
- exceljs + `@react-pdf/renderer`
- cheerio / undici no crawl; yauzl nos zips da Receita
- Vitest (testes colocalizados). **Sem Playwright**
- **Não:** Prisma, shadcn, Clerk, next-intl

Copy da UI: um arquivo só (`src/lib/copy.ts`), pt-BR.

---

## 8. Mapa de telas e APIs

**Telas:** `/` landing · `/entrar` · `/painel` (home) · `/box` · `/largada` · `/grid/[id]` · `/lead/[cnpj]` · `/listas` · `/empresas` · `/crm` · `/importacoes` · `/automacoes` · `/conexoes` · `/conta` `/setup` · `/calculadora` → `/metas` · `/planos` `/pagar` · `/admin/nichos` · `/ops` · legais (`/bot` `/privacidade` `/termos` `/opt-out` `/duvidas`).

**APIs em grupos:** auth/session · search/grid/lead/enrich/export · niches/CNAE/municípios · profile/painel/metas · billing+webhooks PSP · CRM (pipelines, stages, deals, events) · import parse/run/histórico · inbound endpoints+events · webhooks públicos de lead · integrations (connections, call, push) · ops.

**SQL:** migrations em `supabase/migrations/` (20260812 → 20260917). Isso é a fonte de verdade. Existe um `schema-app.sql` de bootstrap **mais magro** que as migrations (faltam colunas de deal). Quem sobe banco novo deve aplicar migrations, não só o snapshot.

---

## 9. O que fechou nesta tarde (git) vs. o que ainda é local

**No git (tratar como produto, não como “próximo passo de import”):**

- Importações: mapeamento de colunas, match único de CNPJ, histórico da última run, baixar linhas com erro (`19c62da`, `4fb2890`).
- Automações: página `/automacoes`, campanhas, eventos, gate Pro (`c0bd72b` + `4fb2890`).
- Planos: todos os cards mostram benefícios; Pro/Escuderia *Em breve*; `planHasFeature` (`c0bd72b`, `b83c0da`).
- Metas no Box (código). Conferir tabela `metas` em **produção**.
- Dúvidas no Menu, sem botão flutuante (`05dedff`).

**Só na working tree (não chamar de lançado):**

- `CONNECTIONS_STANDBY = false` + adapters 3C Plus / dialer webhook / docs de parceiros.
- Ajustes em `docs/status-cloud.md` / `docs/integracoes.md`.

Se o Claude for priorizar Conexões, o primeiro passo é **commitar ou descartar** esse WIP — não planejar em cima de arquivo que não está no origin.

---

## 10. Import e Automações (já no git)

### Import (Piloto+)

Planilha CSV/XLSX (máx. 2 MB, 500 linhas) → parse → o Piloto mapeia colunas (empresa, nome, telefone, e-mail, CNPJ, notas) → opcionalmente casa nome com CNPJ da base **só se o hit for único** (ambíguo não grava) → cria deals na coluna Entrada (`source: import`) → pode qualificar (gasta crédito) → grava run + card da última importação.

Uso real: 2 runs de teste do founder, **zero piloto**. O fluxo do pagante é qualify + CRM via bridge, não planilha.

### Automações (Pro+)

Até 10 campanhas por conta. Cada uma tem URL pública + token Bearer (o token em claro aparece **uma vez**; no banco só o hash SHA-256). POST JSON (Make, Zapier, formulário, ads) vira deal (`source: inbound`) com log dos últimos envios.

Uso real: 4 campanhas do founder, **0 deals inbound**, 2 POSTs 401. Não há cliente nisso. Não priorizar polish de Automações para o piloto de ~10 pessoas no plano R$ 97.

---

## 11. Dinheiro (vigente)

| Plano | Preço | Créditos / mês | O que libera |
|---|---|---|---|
| Treino livre | R$ 0 | 25 qualifies | sem CRM |
| Piloto | R$ 97 | 900 | CRM, Meta, import, export |
| Piloto Pro | R$ 197 | 4.000 | tudo do Piloto + Automações + fila — **Em breve** |
| Escuderia | R$ 397 | 6.000 | tudo do Pro; 1 usuário — **Em breve** |
| Membro da Plataforma | cupom Mundo Pódium | 900 / 30 dias | = Piloto |
| Packs | avulso | 100 / 500 / 2000 | crédito extra; **não** reabre CRM |

- Qualificar = 1 crédito.
- Exportar (arquivo ou webhook de lista) = 50 por CNPJ já qualificado. Não cobra de novo o mesmo CNPJ.
- Ligar e receber tabulação = grátis.
- Pix obrigatório no desenho original; Asaas cobre Pix/boleto/cartão BR; Stripe cartão internacional.

Auditoria: nos 2 pagantes, 166 qualifies vs 4 exports; o 50× já é ~40% do crédito gasto. Ninguém pagante no limite. Membros ainda exportaram a 1 crédito/CNPJ (débito antigo).

---

## 12. Gaps reais (é disto que o plano novo deve falar)

Não volte a listar “ligar Supabase”, “PDF de verdade”, “auth mock”, “esconder Pro/Escuderia”, “Automações no Piloto” — isso já saiu do caminho.

1. **DNS** — `grid.mundopodium.com.br` ainda não está no Vercel. OAuth, Site URL e webhooks no guia de deploy assumem esse host.
2. **Conexões no git ainda standby.** WIP local de API4COM + 3C Plus: ou commita com critério de homologação, ou deixa quieto até o piloto de lista/CRM estar estável.
3. **CRM externo** — HubSpot etc. são vitrine. Lista sai por webhook genérico.
4. **Base RF em volume** — limiar “telefone em 3+ CNPJs = contabilidade” precisa de revalidação em MG/SP reais. Aceite antigo (Lighthouse 90, busca &lt; 2s na RF) **não foi medido** em produção.
5. **Exclusões de nicho** magras (clínica vs posto, etc.).
6. **schema-app.sql** desatualizado vs. migrations. Produção **pode não ter** `metas` / `active_meta_id`. Índices de idempotência de `credit_lots` (`20260911`) **não** estão em prod.
7. **Sem teste e2e** de UI (só Vitest).
8. **Cron RF** e **vários seats** = próxima etapa consciente. Seats **não** entram no plano do piloto.
9. Conferir se migrations de import/inbound/metas estão aplicadas em **todos** os ambientes.
10. Adapter de integração não registrado explode com “not implemented” — esperado enquanto o catálogo for maior que o registry.
11. **CRM bridge duplicado** — `catchup_bridge` + `qualify_bridge` (ver `GRID_diagnostico_bridges.md`). É o caminho real do piloto hoje (477 + 150 deals), não import/webhook.

---

## 13. O que o Claude não deve recomendar

- Reescrever o GRID seco (Largada/tabela/ficha).
- Trocar navy por preto, instalar shadcn, Prisma, Clerk.
- Motor de automação tipo “se estágio X então e-mail”.
- Colocar Automações no card ou no gate do Piloto.
- Implementar seats / multi-login da Escuderia nesta etapa.
- Mudar preços ou créditos da escada.
- Tratar o WIP de VoIP/3C Plus como se já estivesse em produção.
- Places API, CPF, CNAE no código, OSM no Excel, LLM gerando o Minuto de Ouro.
- Créditos 1/2 do briefing antigo.

---

## 14. Perguntas que o plano atualizado tem de responder

1. Para **~10 Pilotos reais no SKU Piloto**, o que falta de operação (DNS, worker, webhooks de pagamento, RF carregada, migration de `metas`) vs. polish de tela?
2. O que vem **primeiro**: ops/DNS, homologar discador (depois de commitar o WIP), ou a dívida do CRM bridge? Por quê?
3. O que ainda pode estar só na máquina local (Conexões/3C Plus) e precisa ir para o git — ou ser descartado — antes de tratar como “já lançado”?
4. Há dívida de estrutura que atrapalha o próximo passo (repo único, schema snapshot vs migrations, dois carimbos de bridge)?
5. Fora de escopo até o piloto: **seats Escuderia**, CRM HubSpot nativo, workflow genérico, cron mensal da Receita, **abrir venda de Pro/Escuderia**.

Critério de um bom plano: a próxima sessão no Cursor executa **uma** fatia sem reabrir o produto e sem contradizer créditos, navy, a escada de planos ou as regras inegociáveis.

---

## 15. Como o time sobe o app (contexto)

```bash
pnpm install
pnpm dev
```

localhost:3000 → Entrar (mock se não houver keys) → Painel → Nova largada.

Live: `DATA_SOURCE=postgres`, `DATABASE_URL` na porta **5432** (não o pooler 6543), keys Supabase. Worker: `pnpm worker:dev`. Checklist de produção: `pnpm launch:check` / `launch:ready`.

---

## 16. Auditoria de uso (05/09/2026)

Consulta read-only no Postgres de produção. Relatório completo: **`GRID_auditoria_uso_real.md`**. Resumo:

1. **Créditos** — 2 Pilotos pagantes: 166 qualifies vs 4 exports (97,6% / 2,4% das ações); em créditos 223 vs 151 (o 50× já é 40% do gasto). Ninguém pagante perto do limite (683 e 743 de 900). 13 membros plataforma; alanis com 294 restantes é o tanque mais baixo. Export de membro ainda debitou 1 crédito/CNPJ; pagante debitou 50.
2. **Import** — 2 runs de teste do founder, 0 issue de nome ambíguo (o código não grava isso), deals import sem CNPJ. Zero uso de piloto.
3. **Automações** — 4 campanhas, todas do founder; 0 deals inbound; 3/4 tokens sem evento; 2 POSTs 401. Depois do gate, conta Piloto **não** deve mais criar campanha nem aceitar POST.
4. **Schema** — produção tem colunas de deal (`cnpj`/`meta`/`people`/`outcome`) que o `schema-app.sql` não tem. Produção **não** tem tabela `metas` nem `active_meta_id`. Índices de idempotência de `credit_lots` (`20260911`) não estão em prod.

O fluxo real do piloto hoje é **qualificar + CRM via bridge** (`catchup_bridge` 477, `qualify_bridge` 150), não planilha nem webhook. Mapa em **`GRID_diagnostico_bridges.md`**: mesma função, dois carimbos; o Grid dispara catch-up porque `/api/enrich` devolve `crmBridge: null`; os dois ainda rodam nos pagantes.

Assinaturas na auditoria: 2× `piloto` active · **0 Pro · 0 Escuderia**.

---

Fim do handoff. Diagnóstico → plano atualizado → primeiro passo executável. Sem rewrite. Sem reabrir agosto. Sem reabrir a escada de planos. Use os números da §16 / do anexo; não invente volume.
