# Primeiro contato — 3C Plus (Integra Aí)

Não há portal de parceiro equivalente ao da API4COM. O caminho é **Integra Aí** (comercial + CS), no mesmo molde de Agilus / Venda Mais.

Referências:

- [API e integração](https://alo.3cplusnow.com/help/api-e-integra%C3%A7%C3%A3o)
- [Envio de listas / mailing](https://alo.3cplusnow.com/help/guia-b%C3%A1sico-de-integra%C3%A7%C3%A3o-envio-de-listas-de-mailing-3c-plus-help-center)
- [Integração completa](https://alo.3cplusnow.com/help/integra%C3%A7%C3%A3o-com-o-3c-plus-completo-3c-plus-help-center)
- Swagger: `https://app.3c.plus/api/v1/swagger.json`

Anexar [kit.md](kit.md).

## Assunto

Integra Aí — Grid (lista ranqueada → campanha 3C Plus)

## Texto

Olá, time 3C Plus —

Somos o **Grid**: geramos a lista de cold call (CNPJ, telefone, score, ficha). Queremos entrar no **Integra Aí** para o gestor enviar mailing à campanha e, na ficha, disparar 1 ligação manual no ramal do agente.

Não faremos sync bidirecional de CRM. Identifier do mailing = **CNPJ**. Nunca CPF.

**O que precisamos para homologar**

1. Tenant sandbox (`empresa.3c.plus`) com campanha de teste, lista, agente e ramal.
2. Token de **gestor** (campanhas + mailing) e token de **agente** (click-to-call). Confirmamos na doc que o token do gestor não discar em nome do agente.
3. Swagger/API v1 atual (domínio pós 02/03/2025) e permissão de usar a API num SaaS multi-tenant (cada cliente cola o próprio token).
4. Permissão de logo no catálogo Discador do Grid.
5. Artigo Integra Aí “Grid” no help center, no molde dos outros CRMs.
6. **Ponto crítico:** a doc pública diz que vocês **não disparam webhook HTTP** — tabulação chega por Socket.io. O Grid roda em Next/Vercel e **não** mantém Socket persistente. Precisamos de uma URL HTTP de qualificação (mailing identifier / CNPJ + disposition) **ou** um evento que dê para poll. Sem isso a tabulação não volta para o lead.
7. Confirmar `POST /agent/manual_call/dial` (form `phone`) e se o agente precisa já estar logado na campanha.

**O que o Grid já faz do nosso lado**

- `push_list` → `POST /campaigns/{id}/lists` + `.../mailing.json` + `updateWeight`.
- `originate_call` → `POST /agent/manual_call/dial`.
- Inbound HTTP: `POST {app}/api/webhooks/dialer/3cplus/{connectionId}` — aceitamos JSON com `identifier`/`cnpj` e nome da qualificação.

Obrigado.
