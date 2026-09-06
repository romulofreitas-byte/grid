# Pedido de aval — API4COM (Software / CRM próprio)

Enviar pelo [Portal do Parceiro](https://www.api4com.com/) (trilha **Software / CRM próprio**) e, se pedirem, no WhatsApp técnico. Anexar [kit.md](kit.md) + os três prints.

## Assunto

Parceria nativa Grid ↔ API4COM — gateway `grid-podium`

## Texto

Olá, time API4COM —

Somos o **Grid** (Mundo Podium): geramos e qualificamos a lista de cold call. A API4COM executa a ligação no clique (VoIP), com token por vendedor. Já temos adapter em produção de código (`POST /dialer`, webhook de answer/hangup).

Pedimos o aval para listar a integração dos dois lados.

**Pedidos**

1. Cadastro como parceiro tipo **software / CRM próprio** (CNPJ da empresa do Grid).
2. Homologar o gateway **`grid-podium`**. Se o slug oficial for outro, avisem antes de reabrirmos a UI.
3. Confirmar a versão de webhook: a doc pública cita **`1.8`** (`channel-answer`, `channel-hangup`). O Grid registra `PATCH /integrations` com `webhookUrl` HTTPS pública.
4. Permissão de marca: logo no catálogo Conexões e a frase “Integra com API4COM”.
5. Listagem recíproca: card **Grid** no painel/marketplace de vocês (modelo NectarCRM — o cliente ativa o card e cola o token).
6. Conta ou crédito de homologação e um contato técnico (WhatsApp).

**Como funciona no Grid**

- Cada Piloto cola o próprio token + ramal. Nada de API key global.
- Ligar na ficha → `POST /api/v1/dialer` com `metadata.gateway = grid-podium`, `cnpj`, `search_id`, `connection_id`.
- Inbound: `POST {app}/api/webhooks/voip/api4com/{connectionId}`.
- Sem CPF no payload. Sem mailing em lote — isso é discador (3C Plus), não VoIP.

Bonificação de canal (50% no 1º mês) podemos alinhar depois; não bloqueia a homologação técnica.

Obrigado.
