# GRID — Briefing para o próximo passo (Claude)

**Data:** 13/08/2026  
**Produto:** GRID · Mundo Pódium  
**Repo:** `C:\Users\romul\grid-podium`  
**Fase atual:** 0–3 no código. `getRepo()` alterna mock ↔ Postgres: `DATA_SOURCE=postgres|supabase|live` **e** `DATABASE_URL` → live; sem URL com DATA_SOURCE live → **erro** (não cai mais no mock em silêncio). Default local sem env = mock. Produção: `assertProdEnv()` no boot (`instrumentation.ts`) + `pnpm launch:check`.  
**Fora de escopo ainda:** créditos / pagamento (Fase 3).

Este arquivo substitui o “estado mental” das sessões no Cursor. Os docs originais (`plano_app_prospeccao_mundo_podium.md` e `prompt_cursor_grid.md`) continuam válidos como **intenção de produto**; o que está abaixo é o **que realmente foi construído e o que mudou depois**.

---

## 0. O que pedir ao Claude nesta conversa

Cole este arquivo e peça:

> A Fase 1 está de pé. Escreva o **prompt mestre da Fase 2** para o Cursor (modo Agent), baseado no código e nas decisões deste briefing — não no prompt original isolado. Preserve as regras inegociáveis, o design navy/amarelo, a taxonomia nicho→segmento, a copy clara, os selos de contato e o fluxo Largada → Grid → Ficha. Não reabra Fases 0/1. Não implemente créditos/pagamento (isso é Fase 3).

Anexos úteis no repo (não copiar de novo, só apontar):

- Plano original: `plano_app_prospeccao_mundo_podium.md`
- Prompt Fases 0–1 (histórico): `prompt_cursor_grid.md`
- Schema: `supabase/migrations/20260812000000_grid_schema.sql`
- Motor de selos: `src/lib/contact-confidence.ts`
- Score: `src/lib/scoring.ts`
- Tipos: `src/lib/types.ts` (`LeadDossier.enrichment`, `ContactSeal` já com os 4 valores)

---

## 1. O produto, em uma frase

SaaS brasileiro de **criação de lista e qualificação de leads** para cold call. O usuário é o **Piloto** (aluno do Mundo Pódium).

Fluxo: escolhe nicho + região → sai uma lista ranqueada (quem ligar primeiro) com telefone, decisor (QSA) e selo de confiança do número. **Não é extrator de Maps.** Fonte: Dados Abertos do CNPJ (Receita Federal).

Promessa na UI atual (landing):

> Escolha o nicho. Saia com a lista na ordem de quem ligar — telefone da empresa e sócio que decide.

---

## 2. Regras inegociáveis (não relaxar na Fase 2)

1. **Nunca** Google Places / Maps API. Link `maps/search` no dossiê **é permitido**.
2. Campo vazio na UI → `NÃO ENCONTRADO` (cinza muted) ou `NÃO VERIFICADO`. Silêncio é bug.
3. **Nunca** CPF em banco, UI ou export.
4. Interface em **pt-BR**. Código/variáveis/comentários em inglês.
5. Todo campo enriquecido carrega proveniência `{ valor, fonte, coletado_em }`.
6. **Nunca** CNAE literal no código-fonte. Tudo vem de `ref_cnae` + keywords do preset.
7. OSM (quando entrar): **só sinal booleano**. Número do OSM **nunca** vai para export.
8. Crawler respeita `robots.txt`, User-Agent identificado, rate limit por domínio.
9. Buscar e ver é grátis. Crédito só na exportação/enriquecimento — **débito é Fase 3**, schema já tem `profiles.creditos`.

---

## 3. Roadmap e status

| Fase | Entrega | Status |
|---|---|---|
| **0 · Ingestão** | Pipeline RF, schema, índices, views de compartilhamento | **Código pronto.** Carga real **não rodou** (sem `DATABASE_URL` / zips). App usa mock. |
| **1 · Grid seco** | Login mock, Largada, Grid, Ficha, selos COMPARTILHADO / NÃO CONFIRMADO, export, legais, curadoria | **Entregue e refinada em UX.** Rodando em `localhost` com `DATA_SOURCE=mock`. |
| **2 · Validação e enriquecimento** | Fila + crawler + CONFIRMADO/ATUALIZADO reais + auditoria digital + score com dor digital + contexto do Minuto de Ouro | **Próximo passo.** UI já mostra os 4 selos no mock. |
| **3 · Monetização** | Débito de crédito, planos, Asaas/Stripe, PDF branded de verdade, admin de pesos | Fora. UI de créditos é cosmética. |
| **4 · Operação** | Cron mensal RF, CRM, API | Fora. |

**Validação de produto (do plano):** colocar a Fase 1 na mão de ~10 Pilotos. A lista seca com decisor e sem telefone de contador já é o diferencial. A Fase 2 refina, não inventa o produto.

---

## 4. Stack real (o que está no repo)

| Camada | Escolha real |
|---|---|
| App | Next.js 15.5 (App Router) + React 19 + TypeScript |
| UI | Tailwind CSS v4 + Framer Motion + lucide-react + Sora |
| **shadcn/ui** | **Não instalado.** Componentes próprios (`GlassCard`, `SectionTitle`, `Hint`, `ContactSeal`, `AppShell`…). |
| Dados agora | Dual-mode: `mockRepo` (default local) **ou** `supabaseRepo` via `pg` quando `DATA_SOURCE=postgres|supabase|live` + `DATABASE_URL` |
| Dados live | Postgres (Supabase ou Docker). Sem `DATABASE_URL` em modo live → throw (sem fallback silencioso). Banner “Dados de demonstração” no AppShell quando mock. |
| Auth agora | Supabase Auth quando keys existem; senão mock (`GRID_MOCK_AUTH` ou keys ausentes). Produção rejeita mock auth. |
| Export | ExcelJS (XLSX) + CSV UTF-8 BOM + PDF branded via `@react-pdf/renderer`. |
| Package manager | pnpm |
| Deploy | Vercel (app) + Railway (worker). `pnpm launch:check` / `assertProdEnv`. |

### Design — decisão posterior ao prompt original

O prompt pedia fundo **preto** `#0D0D0F`. O dono do produto pediu **navy** como base (marca Mundo Pódium, ferramenta de uso longo).

```
--podium-navy:    #0B1A2E   /* fundo — oficial */
--podium-panel:   #12263F
--podium-panel-2: #183250
--podium-yellow:  #F5B301   /* único accent */
--podium-white:   #FFFFFF
--podium-gray:    #C5CDD8
--podium-muted:   #7A8494
--podium-success: #22C55E   /* só prova confirmada */
```

Amarelo **nunca** decorativo. Sem roxo/azul/laranja/vermelho de destaque. Vermelho só em erro real (ex.: confirmar exclusão de lista).

Logos oficiais em `/public/brand/`:

- `lockup.png` — logo horizontal (oficial na maioria das telas)
- `mark.png` — símbolo (header mobile)
- `hero.png` — existe no componente, uso pontual

Lockup alinhado à esquerda. Não animar/cortar a logo principal.

---

## 5. Fase 0 — o que existe

Diretório `scripts/ingest/`:

- `config.ts` — `RF_CNPJ_BASE_URL` (default jan/2026), `BATCH_SIZE=5000`, filtros (situação `02`, telefone1 obrigatório, excluir MEI), `--ufs=MG,SP`, `--dry-run`
- `layout.ts` — mapeamento de colunas RF (layout mudou jan/2026; configurável)
- `parse.ts` — CSV ISO-8859-1, `;`, quoted, streaming
- `index.ts` — plano de carga + COPY em lotes + índices **depois** + `REFRESH` das views

Tabelas / views na migration:

`companies`, `establishments`, `partners` (sem CPF), `simples_nacional`, `ref_cnae`, `ref_municipio`, `ref_natureza`, `ref_qualificacao`, `profiles` (com especialidade/área/empresa/cidade), `searches`, `saved_leads.enrichment jsonb`, `opt_outs`, `ingest_runs`, MVs `phone_usage` / `email_usage` / `address_usage`, `niche_presets` (com `parent_id`, `name_stems`), `niche_preset_cnaes`.

RLS em `profiles`, `searches`, `saved_leads`.

**Não feito:** download real dos zips, carga em Postgres, validação manual de que os telefones mais repetidos da base RF são de contabilidade.

---

## 6. Fase 1 — o que o Piloto consegue fazer hoje

### Rotas

| Rota | Função |
|---|---|
| `/` | Landing Lights Out (atmosfera de pista, copy curta, 4 benefícios) |
| `/entrar` | Login mock + animação semáforo F1 → `/box` |
| `/box` | Dashboard: CTA sozinho “Nova largada”, créditos (cosmético), listas salvas, últimas buscas |
| `/largada` | Wizard 3 passos: nicho → região → qualidade |
| `/grid/[searchId]` | Resultados P1…Pn, selos, salvar/renomear lista, export |
| `/lead/[cnpj]` | Ficha: cadastro, telefones+selos, decisor, Minuto de Ouro, links, status, notas |
| `/listas` | Listas **salvas** (abrir grid, Excel, **excluir** com confirmação) |
| `/conta` | Nome, empresa, cidade, especialidade, área (alimentam o script) |
| `/admin/nichos` | Curadoria CNAE por **segmento** (não só pelo nicho raiz) |
| `/privacidade` `/termos` `/opt-out` | LGPD |

APIs: `POST /api/search/count`, `POST /api/search/run`, `GET/PATCH/DELETE /api/search/[id]`, `GET /api/grid/[id]`, `GET/PATCH /api/lead/[cnpj]`, `GET /api/export/[id]?format=xlsx\|csv\|pdf`, presets/CNAE, municípios, profile, opt-out.

### Largada (passo a passo real — divergiu do prompt)

**Passo 1 · Nicho** — taxonomia hierárquica, não 16 cards planos:

- 16 nichos raiz em dois grupos: **B2C local** e **B2B e indústria**
- Cada nicho abre **segmentos** (clínicas de estética, harmonização, depilação a laser, etc.)
- ~106 nós no total (16 + ~90 segmentos) em `src/lib/niches.ts` → `TAXONOMY` / `PRESET_SEED`
- Busca livre por **intenção** (`intentQuery`) resolve CNAEs por keyword
- Painel recolhido de CNAEs (“Refinar pelo tipo de atividade”) — não é o caminho principal
- Continuar exige pelo menos um segmento **ou** uma intenção

**Passo 2 · Região** — Brasil completo (27 UFs):

- Chips de UF
- Municípios em **menu recolhido** (fechado por padrão): “Refinar por município”
- Sem município = estado inteiro
- Labels `Nome/UF` (ex.: `Belo Horizonte/MG`)
- Botão “Selecionar capitais”

**Passo 3 · Qualidade do contato** (card amarelo, em cima):

- **Excluir números de escritório contábil** — ligado por padrão, badge **Recomendado**, pulso CSS `recommend-pulse`
- Copy: o mesmo telefone em 3+ empresas costuma ser da contabilidade. Desligar mostra a tag **Contabilidade**
- Ocultar e-mails gratuitos / endereços de escritório fiscal
- Porte ME/EPP/Demais, idade da empresa (0/3/5/10 anos), só matriz, excluir Simples, exigir e-mail próprio, exigir decisor
- **Slider de capital social:** existe no tipo/filtro/repo, **não está na UI**

Painel de contagem ao vivo (debounce ~400 ms): total, telefone/e-mail/decisor, top municípios.

### Grid

- Ordenado por `grid_score` desc. Teto 1.000. Cursor 50 em 50.
- Badges: POLE / GRID DA FRENTE / GRID DO MEIO / FUNDO DO GRID
- Coluna **Atividade** larga: descrição CNAE em texto visível + código `0000-0/00` abaixo
- Mobile: card com atividade, telefone, selo, decisor
- **Salvar lista** é explícito (não automático). Copy: *guardar não substitui ligar*
- Busca recém-rodada **não** aparece em `/listas` até o Piloto salvar (`searches.saved`)
- Export Excel / CSV / PDF (PDF ainda fake)

### Selos de contato (Camada A — SQL / mock)

| Selo | Fase real | UI |
|---|---|---|
| **Contabilidade** (`COMPARTILHADO`) | 1 | âmbar — “aparece em N empresas — provavelmente é do escritório” |
| **Não confirmado** (`NAO_CONFIRMADO`) | 1 | muted |
| **Confirmado** (`CONFIRMADO`) | 2 (hoje **sorteado no mock**) | verde |
| **Atualizado** (`ATUALIZADO`) | 2 (hoje **sorteado no mock**) | amarelo |

No mock, se o telefone **não** é compartilhado, `mockPhoneSeal()` distribui Confirmado / Atualizado / Não confirmado para o Piloto **ver as tags nesta versão**. Na base RF real, Fase 1 só deve emitir COMPARTILHADO ou NAO_CONFIRMADO até o crawler existir.

Regras: telefone 3+ CNPJs; e-mail 3+; endereço 5+; hints de domínio contábil; provedores grátis.

### Ficha (`/lead/[cnpj]`)

- Identificação + telefones com selo (nunca esconde número ruim)
- Decisor por prioridade de **descrição** em `ref_qualificacao` (`lib/decisor.ts`) — IDs não hardcoded
- Minuto de Ouro editável + copiar. `{contexto}` ainda é placeholder `[preencher no Minuto de Ouro]`
- Links: site e Instagram **desabilitados** (NÃO ENCONTRADO até Fase 2). Ads Library, WhatsApp, Maps (link simples) funcionam
- Status novo / ligando / reunião / descartado + notas

### Navegação “Voltar”

Mapa em `src/lib/back.ts`. Toda tela logada tem back com **rótulo da origem**:

- Grid ← Box / Largada / Listas (query `?from=`)
- Ficha ← Grid (`?searchId=&from=`)
- Listas / Conta / Largada / Admin ← Box
- Login ← início

### Copy / clareza (revisão 12–13/08)

Glossário curto em `src/lib/copy.ts`. Padrão: termo de corrida na nav (Box, Largada, Grid) + uma linha de gloss ao lado. Sem jargão solto (CNAE, decisor, score, Simples explicados com moderação via `<Hint>`).

Mensagem repetida de propósito: **salvar lista não resolve — tem que ligar, de cima para baixo.**

---

## 7. Mock de dados (ambiente atual)

`DATA_SOURCE=mock` (padrão local). Live: `DATA_SOURCE=postgres` + `DATABASE_URL`. Store singleton em memória, versão `MOCK_STORE_VERSION` (reinicia ao mudar). Banner de demo no AppShell.

| Item | Valor |
|---|---|
| Estabelecimentos | **5.000** |
| UFs | 27 |
| Municípios | IBGE ~5.571 (`src/data/ibge-municipios.json`) |
| Taxonomia | 16 nichos + segmentos (`PRESET_SEED`) |
| CNAEs | catálogo em `src/lib/data/cnae-catalog.ts` (não são códigos nos presets) |
| Telefone de contador | `33334444` compartilhado quando `hashMix(i+101) % 7 === 0` (~1/7 das linhas) |
| E-mail de escritório | `contato@assessoriacontabilidade.com.br` em parte das linhas |
| Endereço fiscal compartilhado | índices 120–139 |
| Perfil mock | Rômulo Freitas, plano `free`, 25 créditos, Combustível / BH |

Isso **não é a base da Receita**. É demo para UX e selos. A Fase 2 de crawler em produção depende da ingestão real (Fase 0 ligada).

---

## 8. Mapa de arquivos que a Fase 2 deve tocar / respeitar

```
src/lib/types.ts                 SearchFilters, ContactSeal (4 valores), LeadDossier, enrichment
src/lib/contact-confidence.ts    regras + mockPhoneSeal (remover sorteio quando crawler existir)
src/lib/scoring.ts               GRID_WEIGHTS; dorDigital ainda não pontua (includeDorDigital)
src/lib/decisor.ts               prioridade por descrição
src/lib/niches.ts                TAXONOMIA — não achatar de volta em 16 cards
src/lib/copy.ts                  glossário UI
src/lib/back.ts                  voltar com rótulo
src/lib/data/index.ts            getRepo() — mock ou supabaseRepo (fail se live sem DATABASE_URL)
src/lib/data/mock-repo.ts        busca, count, grid, dossiê, save/delete lista
src/lib/export/xlsx-csv.ts       CSV com Telefone Site / Whatsapp ainda vazios
src/components/ContactSeal.tsx   4 selos já desenhados
src/app/lead/[cnpj]/page.tsx     botões site/Instagram/WA; Minuto de Ouro
src/app/largada/page.tsx         filtro de contabilidade + pulso
supabase/migrations/…schema.sql  enrichment jsonb já existe; falta searches.saved
scripts/ingest/                  Fase 0 — não reescrever, só usar
```

---

## 9. Desvios do `prompt_cursor_grid.md` (Claude precisa saber)

Não tratar o prompt original como spec literal da UI atual.

| Original | O que ficou |
|---|---|
| Fundo preto `#0D0D0F` | Navy `#0B1A2E` |
| shadcn/ui | Componentes próprios |
| 16 presets planos | Nicho → **segmentos** + intenção livre |
| Região MG/SP no mock inicial | Brasil 27 UFs + IBGE |
| Auth Supabase | Login mock |
| Repo live | Sempre `mockRepo` |
| PDF `@react-pdf/renderer` | Stub de texto |
| Slider capital social na Largada | Só no backend |
| `searches` sem flag saved | App usa `saved: boolean` no mock; **migration não tem a coluna** |
| Selos Fase 1 só COMPARTILHADO / NAO_CONFIRMADO | Mock também mostra CONFIRMADO / ATUALIZADO para preview |
| Título do selo “COMPARTILHADO” | UI diz **Contabilidade** (mais claro) |
| Filtro “Ocultar telefones compartilhados” | “Excluir números de escritório contábil” + Recomendado + pulso |
| Box com créditos no hero | CTA **Nova largada** sozinho; créditos/listas em cards secundários |
| XLSX colunas completas do spec | XLSX mais curto; CSV segue o spec (Site/WhatsApp vazios até Fase 2) |

---

## 10. Débito técnico / gaps da Fase 1 (não bloquear Fase 2, mas listar)

1. Ligar Supabase de verdade: migration + ingest 2 UFs + trocar `getRepo()` + Auth.
2. Coluna `searches.saved boolean default false` na migration (e `DELETE` em cascade já existe via `saved_leads`).
3. PDF branded real (combinar com Fase 3 se quiser, ou puxar na 2 se o dossiê enriquecido precisar).
4. Slider de capital na Largada (filtro já funciona se a API receber os valores).
5. Exclusões humanas por nicho (posto de saúde vs clínica, etc.) — o plano pedia lista de exclusão; `exclusoes[]` existe nos seeds, pouco preenchido.
6. Admin de nichos sem autenticação real (rota aberta).
7. Persistência mock some no restart do servidor (esperado).
8. Critérios de aceite originais (Lighthouse 90, busca < 2s na base RF, CSV no Pipedrive) **não foram medidos em produção** — não há base RF carregada.

---

## 11. O que a Fase 2 deve entregar (do plano original, agora no código certo)

Camadas B e C do motor de confiança + auditoria digital. **Não** créditos.

### 11.1 Cascata de enriquecimento (por lead, assíncrona)

1. **Descobrir domínio**
   - E-mail da Receita com domínio próprio → usar
   - Senão, search API (Serper.dev) por razão social + fantasia + município
   - Falhou → `SEM SITE IDENTIFICADO` (lead quente, não lead ruim)
2. **Crawl** `/`, `/contato`, `/fale-conosco`, `/contact`, `/sobre` — Cheerio + undici; Playwright só fallback. **Worker fora da Vercel** (timeout). Fila: Trigger.dev ou Upstash QStash.
3. Extrair `tel:`, `mailto:`, `wa.me` / `api.whatsapp.com`, schema.org LocalBusiness, regex BR no rodapé.
4. Normalizar E.164 e comparar com a Receita.
5. OSM Overpass **só** como confirmação booleana + atribuição ODbL. Número OSM não exporta.

### 11.2 Selos reais (substituir `mockPhoneSeal`)

- **CONFIRMADO** — Receita = site oficial
- **ATUALIZADO** — site tem outro número; promove o do site, guarda o da Receita
- **COMPARTILHADO** — continua Camada A (já existe)
- **NÃO CONFIRMADO** — só Receita, sem site

Export: `Telefone Principal` (maior confiança) + `Telefone Receita` + `Telefone Site` + `Confianca` + `Whatsapp`. Célula COMPARTILHADO no XLSX já ganha fundo âmbar.

### 11.3 Auditoria digital (dor)

Proxy de mídia (não existe API BR da Ad Library para anúncio comercial):

- Pixel Meta / tag Google Ads (AW-) no HTML
- Botão Biblioteca de Anúncios **já existe** (filtro nome + BR + ativos)
- Instagram: abrir perfil se o domínio/handle for achado; não depender disso
- Campo “anúncio rodando” = **não verificado automaticamente** quando não houver sinal

Pontuar `dorDigital` em `computeGridScore` quando `includeDorDigital` for true. Normalizar 0–100 com o máximo da fase **incluindo** `dorDigitalMax` (45 B2C / 20 B2B).

### 11.4 Minuto de Ouro

Gerar `{contexto}` a partir do enriquecimento (ex.: site sem pixel, Instagram parado, telefone só na Receita). Template 4 passos já está na ficha. Não inventar fato que o crawl não viu.

### 11.5 UX que a Fase 2 **não deve desfazer**

- Navy + amarelo
- Taxonomia nicho/segmento
- Menu de municípios recolhido
- Voltar com rótulo
- Salvar lista explícito + excluir em `/listas`
- Copy “Contabilidade” / “Recomendado” / “salvar não substitui ligar”
- Coluna Atividade visível (descrição + CNAE)
- Preview dos 4 selos: na live, Confirmado/Atualizado só depois do worker; o filtro de escritório continua padrão ligado
- Hints curtos, sem manual de 3 parágrafos

### 11.6 Fora da Fase 2

Débito de crédito, Asaas/Stripe, CRM, API pública, cron mensal RF, Twilio Lookup. Schema pode ganhar colunas de job (`enrichment_status`, `enriched_at`), mas a cobrança fica na Fase 3.

---

## 12. Modelo de créditos (contexto, não implementar agora)

Regra: **buscar e ver grátis. Crédito queima ao exportar ou enriquecer.**

- 1 crédito = 1 lead exportado (cadastro + decisor)
- 2 créditos = 1 lead com validação + auditoria

Planos aprovados: Treino livre (25/mês), Piloto R$ 97, Piloto Pro R$ 197, Escuderia R$ 397, Membro da Plataforma incluso nos R$ 89,90. Pix obrigatório.

O Box já mostra créditos e avisa que buscar é grátis. Não precisa redesenhar isso na Fase 2.

---

## 13. Como o app sobe hoje

```bash
pnpm install
pnpm dev
```

http://localhost:3000 → Entrar (mock) → Box → Nova largada.

Ligar RF + Supabase (quando for a hora, pode ser paralelo à Fase 2): ver `README.md` seção “Ligar Supabase”.

---

## 14. Histórico curto das sessões (12–13/08/2026)

1. Execução do prompt Fases 0–1 **sem Supabase**, fundo navy.
2. Revisão estrutural: taxonomia segmentos, mock 5.000 / 27 UFs, Box com CTA isolado, CNAE visível.
3. Logos oficiais + login Lights Out (semáforo). Logo horizontal, sem corte, alinhada à esquerda.
4. Voltar em todas as telas logadas; filtro de contabilidade chamativo; **Salvar lista**.
5. Sigla UF ao lado do município (`Nome/UF`).
6. Municípios em acordeão fechado.
7. Revisão de linguagem: glossário, landing/login diretos, voltar com lógica de origem, tags Confirmado/Atualizado visíveis no mock com filtro desligado.
8. Excluir lista em Minhas listas; coluna Atividade mais larga e legível.

Fim do estado atual. A Fase 1 está utilizável como demo. A Fase 2 começa no worker de enriquecimento e nos selos reais, sem reabrir o desenho do GRID seco.
