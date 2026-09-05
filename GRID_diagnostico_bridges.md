# GRID — Diagnóstico: bridge de CRM (`qualify_bridge` / `catchup_bridge`)

**Data:** 05/09/2026  
**Escopo:** um tema. Sem `/metas`, sem import, sem automações, sem mudança de código.  
**Consulta:** Postgres de produção 15:03 UTC + leitura do repo.

Não são duas fontes de lead. É **a mesma cópia** Lista salva → deal no kanban (`bridgeQualifiedLeadsToCrm` em `src/lib/crm/bridge.ts`). O dado vem da **Receita + `saved_leads` + CNPJ já qualificado**. Não é planilha, webhook nem scraping.

A etiqueta no `meta.source` só diz **qual gatilho ganhou a corrida**.

---

## `qualify_bridge` (150 deals)

Disparo: `POST /api/enrich`, **depois** de cobrar o crédito e enfileirar o worker. Só se a busca estiver **salva**. Roda em `after()` (fundo). A API **sempre** devolve `crmBridge: null` — o Grid não espera o resultado dessa cópia.

Por isso o Piloto vê “entrando na pista” e o browser chama o catch-up em seguida. Se o `after()` chegar primeiro, o deal nasce `qualify_bridge`. Se perder ou falhar, o catch-up cria com a outra etiqueta.

**Produção:** primeiro deal 21/08; último **05/09 01:41 UTC** (ainda vivo). 7 dias: 66. Pagantes: Rômulo 15, romulocsfreitas 24.

**Soft spots:** falha no `after()` vira só `crm_qualify_bridge_error` no log; crédito já saiu. Sem match por nome (já tem CNPJ). Sem histórico de run. Se não achar brief/dossiê ou não criar deal → `skipped`, sem toast de erro nessa via.

---

## `catchup_bridge` (477 deals)

Mesma função, carimbo diferente. Três portas:

1. **Grid, na hora de qualificar** — como o enrich não devolve o bridge, a UI manda `POST /api/session/catch-up` com `searchId` + CNPJs. Este é o caminho **principal ao vivo**, não um backfill antigo.
2. **Salvar a lista** — `onSearchSaved` (PATCH da busca / pista) + de novo o catch-up no Grid.
3. **Login** — `CatchUpRunner` (uma vez por aba) varre CNPJs qualificados em listas salvas que **ainda não** têm deal (`user_catchup_state`, lotes de 150).

**Produção:** primeiro 25/08; último **04/09 19:21 UTC**. 7 dias: 350 (222 membros + 128 piloto). 24h: 20. Pagantes: Rômulo 58, romulocsfreitas 70. Catch-up de conta rodou hoje (Rômulo, 14:55 UTC, 0 created — fila vazia).

Por isso 477 ≫ 150: **o browser ganha a corrida** na maior parte das qualificações. Não é “job histórico que populou o CRM uma vez”.

**Soft spots (os que importam):**
- Mesmo skip silencioso (sem dossiê / `createCrmDeal` null).
- Erro ao salvar lista: `crm_save_bridge_error`, PATCH da busca já respondeu ok.
- Catch-up de **conta** usa lock; o de **lista** (`searchId`) **não**. `alanis_mendes` está `running` desde **26/08** no lock da conta (crash sem `finishCatchUp`). Qualificar pelo Grid ainda funciona. `CatchUpRunner` que pegar `busy` marca a sessão `done` com 0 — backfill da conta não tenta de novo naquela aba.
- Toast só se `created > 0`. Skip não avisa.

---

## Ativo vs histórico

**Ativo**, nos dois carimbos, inclusive nos 2 Pilotos pagantes (7 dias: 128 catchup + 29 qualify no plano `piloto`).

Fila ainda aberta (qualificado em lista salva, sem deal): **19** linhas (flp44337 10, romulo.freitas 6, mais 3). Vazamento pequeno, não zero. Nenhum deal de bridge sem CNPJ.

`crmAllowed` corta catch-up de quem não tem CRM; contas `free` ainda disparam o runner e saem 0/0.

---

## Resposta objetiva

O CRM dos Pilotos **é** esse bridge. Import e webhook são ruído. O risco parecido com o import não é nome ambíguo — é **qualificou, pagou, card pode não aparecer**, com a rede de segurança do catch-up tapando a maior parte. Os 19 de fila + 1 lock preso são o residual mensurável; o resto do silêncio está no log da Vercel (`crm_qualify_bridge_error`), não numa tabela de runs.

Insumo para priorizar depois: tratar isto como domínio **live** (Grid → CRM), não como migração morta. Não junta com `/metas`.
