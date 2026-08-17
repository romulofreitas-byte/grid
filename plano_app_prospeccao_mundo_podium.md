# GRID — Plano de Execução
### Aplicativo de criação de lista e qualificação de leads · Mundo Pódium
**Versão 2.0 · 12/08/2026 · Rômulo Freitas**
*Nome definido: **GRID**. Faixa de preço aprovada. Presets de nicho e validação de contato incorporados nesta versão.*

---

## 0. O QUE A PESQUISA MUDOU (leia isso primeiro)

Três descobertas mexem no desenho. Melhor descobrir agora do que depois de 6 semanas no Cursor.

### 0.1 — Google Maps não pode ser a fonte da lista exportável

Os Termos do Google Maps Platform proíbem armazenar ou cachear conteúdo do Places API. A única exceção é latitude/longitude, por até 30 dias corridos. Nome, telefone, endereço e site vindos do Maps **não podem** ser gravados em banco nem exportados. O Google audita o cumprimento uma vez por ano.

Um app que extrai do Maps e devolve planilha é exatamente o caso proibido. É por isso que as ferramentas de scraping de Maps aparecem e somem.

**Existe um uso limpo do Maps**, e ele entra no produto: um botão no dossiê que **abre o Google Maps já buscando a empresa**, sem API, sem armazenamento. O Piloto confere com o olho durante o Minuto de Ouro. Isso é 100% permitido — é só um link.

### 0.2 — A base da Receita já entrega o Nível 3 pronto

O processo manual que você descreve — registro.br → Receita → QSA → sócio-administrador — some. O arquivo **SÓCIOS** dos Dados Abertos traz nome, qualificação, data de entrada e faixa etária. O decisor sai na mesma consulta da lista.

| Arquivo | Campos que interessam |
|---|---|
| **EMPRESAS** | CNPJ básico, razão social, natureza jurídica, capital social, porte |
| **ESTABELECIMENTOS** | CNPJ completo, nome fantasia, situação cadastral, data de início, **CNAE principal e secundárias**, endereço completo, CEP, UF, município, **DDD1+Tel1, DDD2+Tel2**, **e-mail** |
| **SÓCIOS** | **Nome**, CPF mascarado, **qualificação**, data de entrada, faixa etária |
| **SIMPLES** | Opção pelo Simples, opção pelo MEI |

Atualização mensal. ~60 milhões de registros. Custo de licença: zero.

### 0.3 — "Tem anúncio rodando?" não tem API oficial no Brasil

A API da Meta Ad Library só devolve anúncio comercial entregue na UE e no Reino Unido. Anúncio comercial brasileiro não sai pela API.

**No MVP:** proxy técnico — **Meta Pixel** instalado no site e tag de conversão do **Google Ads (AW-)** são sinal forte de investimento em mídia. Mais um botão que abre a Biblioteca de Anúncios já filtrada por nome + Brasil + ativos. O campo fica marcado como **"não verificado automaticamente"**.

---

## 1. O PRODUTO EM UMA FRASE

Um app que transforma "escolhi meu nicho e minha região" em **uma lista com telefone verificado, nome do decisor e diagnóstico digital** — na ordem certa de quem ligar primeiro.

Não é um extrator de dados. É a pré-venda inteira do Método Pódium em uma tela, do nicho até o Minuto de Ouro.

---

## 2. O PROBLEMA DO TELEFONE DA CONTABILIDADE

Você levantou o ponto mais importante da conversa toda. **Uma lista com o telefone do contador não é uma lista — é uma armadilha.** O Piloto liga, cai no escritório de contabilidade, leva não, e o não nem era do lead. Frustração sem aprendizado.

A boa notícia: dá pra resolver, e a parte mais forte da solução **não custa nada**.

### CAMADA A · Detecção interna — grátis, sai da própria base

O telefone da contabilidade tem uma assinatura óbvia: **ele se repete em dezenas de CNPJs diferentes**. Um contador que atende 80 empresas colocou o mesmo número em 80 cadastros.

Isso é uma consulta SQL sobre a base inteira, feita uma vez por carga mensal:

```sql
-- Quantos CNPJs distintos compartilham o mesmo telefone?
create materialized view phone_usage as
select ddd1, telefone1, count(distinct cnpj_basico) as qtd_empresas
from establishments
where telefone1 is not null
group by 1, 2;
```

**Regra:** telefone presente em 3 ou mais CNPJs básicos distintos → marcado como `COMPARTILHADO — provável contabilidade`. O app mostra **em quantas empresas** aquele número aparece. Quando o Piloto vê "este telefone aparece em 47 empresas", ele entende na hora o que é.

O mesmo vale para:
- **E-mail** repetido entre CNPJs
- **Endereço** repetido (logradouro + número + CEP) → escritório de contabilidade, coworking ou endereço fiscal
- **Domínio de e-mail** com `contab`, `contabil`, `assessoria`, `escritorio`, `fiscal` no nome
- **E-mail gratuito** (gmail, hotmail, uol, bol, yahoo, outlook) → não é contato corporativo confiável

Nenhum concorrente faz isso. Econodata e Speedio te vendem o telefone do contador pelo mesmo preço do telefone certo.

### CAMADA B · Verificação externa — o site da própria empresa

O site da empresa é a fonte de ouro: é a própria empresa publicando o próprio telefone, para ser contatada. Dado público, atual, legalmente limpo de armazenar e exportar.

Cascata do worker de enriquecimento:

1. **Descobrir o domínio**
   - E-mail da Receita com domínio próprio (`@empresa.com.br`) → pronto, custo zero
   - Senão, busca em search API por razão social + nome fantasia + município → primeiro resultado que não seja diretório
   - Não achou → `SEM SITE IDENTIFICADO` (que é lead quente, não lead ruim)

2. **Rastrear as páginas certas**
   `/`, `/contato`, `/fale-conosco`, `/contact`, `/sobre` — nada além disso. Respeitando `robots.txt`.

3. **Extrair todo contato encontrado**
   - Links `tel:` e `mailto:`
   - Links `wa.me/` e `api.whatsapp.com` → **número de WhatsApp confirmado**, o mais valioso de todos
   - Marcação estruturada **schema.org LocalBusiness** (campo `telephone`) — quando existe, é o dado mais confiável do site
   - Regex de telefone brasileiro no texto visível do rodapé e da página de contato

4. **Normalizar e comparar** (formato E.164, deduplicar) com o que veio da Receita

### CAMADA C · Confirmação cruzada — OpenStreetMap

O OSM tem tags `phone`, `contact:phone` e `website` em boa parte dos negócios de rua nas capitais brasileiras. A API Overpass é gratuita (até 10 mil consultas/dia na instância pública) e os dados são ODbL.

**Atenção jurídica:** a ODbL tem cláusula de compartilhamento (*share-alike*) para bases derivadas. Se você **exportar** o telefone do OSM dentro do CSV do cliente, dá pra argumentar que criou uma base derivada — e aí a licença exigiria que você abrisse a base sob ODbL também.

**Solução limpa:** usar o OSM **só como confirmação booleana**, nunca como fornecedor do número. Se o OSM tem o mesmo telefone que o site → confiança sobe. Se tem um diferente → marca divergência para conferência manual. **O número do OSM nunca é exportado.** Legalmente seguro e ainda assim útil.

### CAMADA D · O selo

Cada lead sai com um selo, visível na lista e no export:

| Selo | Significado | O que o Piloto faz |
|---|---|---|
| **CONFIRMADO** | Telefone da Receita bate com o do site oficial | Disca com confiança |
| **ATUALIZADO** | O site tem outro número; o app promove o do site e guarda o da Receita | Disca no do site |
| **COMPARTILHADO** | O número aparece em N outros CNPJs — provável contabilidade | Só usa se não houver outro |
| **NÃO CONFIRMADO** | Só o dado da Receita, sem site para conferir | Disca sabendo do risco |

**Filtro na busca — este é o item matador:** *"Ocultar telefones compartilhados (provável contabilidade)"*, ligado por padrão. Custo de implementação: uma cláusula WHERE. Valor pro Piloto: enorme.

**No export**, três colunas separadas — `Telefone Principal` (o de maior confiança), `Telefone Receita`, `Telefone Site` — mais a coluna `Confiança`. O Piloto nunca é enganado sobre a origem do dado.

### Custo real disso

| Item | Custo |
|---|---|
| Detecção de compartilhamento (Camada A) | R$ 0 — é SQL |
| Descoberta de domínio via search API | ~US$ 1 por 1.000 buscas (Serper), e só ~60% dos leads precisam |
| Crawl do site | infra própria, fração de centavo |
| OSM Overpass | gratuito |
| **Total por lead enriquecido** | **abaixo de R$ 0,01** |

Cobrando 2 créditos pelo enriquecimento, a margem é confortável. Validação de linha via Twilio Lookup (US$ 0,008/consulta) ficou de fora: ela diz se o número é fixo ou móvel e qual operadora, mas **não diz se o número é da empresa** — que é a pergunta que importa. Fica como opção futura.

---

## 3. OS NICHOS DE ESTREIA

Você listou os que o pessoal de marketing prospecta hoje. Organizei em 16 presets, com 5 sugestões minhas marcadas.

**Grupo B2C local** — onde a dor digital pesa mais, porque o negócio vive de ser encontrado:

| Preset | Alvos |
|---|---|
| **Estética e beleza** | clínicas de estética, harmonização facial, depilação a laser, salões premium, micropigmentação |
| **Saúde e clínicas** | ortopedia, dermatologia, tricologia, odontologia, oftalmologia, fisioterapia, nutrição |
| **Pet** | clínicas veterinárias, pet shops, banho e tosa, hotelaria animal |
| **Automotivo** | concessionárias, revendas de seminovos, oficinas, funilaria, som e acessórios, estética automotiva |
| **Imobiliário** | imobiliárias, corretoras, incorporadoras, administradoras de condomínio |
| **Varejo** | moda, calçados, óticas, joalherias, móveis, eletro, materiais esportivos |
| **Alimentação fora do lar** *(sugestão)* | restaurantes, pizzarias, hamburguerias, buffets, franquias de alimentação |
| **Educação** *(sugestão)* | escolas particulares, cursos livres, idiomas, pré-vestibular, autoescolas |
| **Turismo e hotelaria** *(sugestão)* | hotéis, pousadas, agências de viagem, receptivos |

**Grupo B2B e indústria** — onde o que pesa é porte, ticket e estrutura:

| Preset | Alvos |
|---|---|
| **Indústria** | alimentos, metalurgia, química, plásticos, têxtil, moveleira, embalagens |
| **Construção civil** | construtoras, incorporadoras, empreiteiras, engenharia, arquitetura |
| **Insumos para construção** | marmorarias, vidraçarias, esquadrias, depósitos, lojas de acabamento, serralherias |
| **Contabilidade e jurídico** | escritórios contábeis, advocacia, consultoria empresarial |
| **Tech e software** | desenvolvimento sob encomenda, SaaS, TI, suporte, hospedagem |
| **Logística e transporte** *(sugestão)* | transportadoras, armazenagem, distribuidoras, last mile |
| **Financeiro e seguros** *(sugestão)* | corretoras de seguros, assessorias de investimento, crédito, factoring |

### Como os presets vão funcionar tecnicamente

**Não vou entregar uma lista de códigos CNAE decorada, e você não deve deixar o Cursor inventar uma.** CNAE errado = lista errada = Piloto ligando pra empresa que não é o alvo. É o tipo de erro que destrói confiança no produto.

O desenho correto tem três partes:

1. **O preset é definido por palavras-chave**, não por códigos. `Estética e beleza` guarda os termos `estética`, `beleza`, `depilação`, `cabeleireiro`, `podologia`.
2. **Na hora da busca**, o app resolve essas palavras contra a tabela `ref_cnae` que veio da própria Receita — busca por similaridade de texto. Os códigos sempre vêm da fonte oficial, nunca de memória.
3. **Tela de Curadoria de Nichos** no admin: você vê os CNAEs que cada preset capturou, com a contagem de empresas de cada um, e marca quais entram e quais saem. A curadoria fica salva.

Essa terceira parte transforma o seu conhecimento de mercado em ativo do produto. Ninguém consegue copiar um preset curado por quem prospecta há 12 anos.

**Sugestão operacional:** monte a curadoria dos 3 primeiros nichos você mesmo, junto com um Piloto do Acelerador. Vira aula e vira produto ao mesmo tempo.

---

## 4. O GRID DE LARGADA (score 0–100)

**FIT — 0 a 30**
CNAE bate com o nicho (0–12) · porte compatível com o ticket (0–8) · capital social na faixa (0–6) · ativa há mais de 3 anos (0–4)

**CONTATABILIDADE — 0 a 25** *(agora ponderada pelo selo de confiança)*
Telefone CONFIRMADO ou ATUALIZADO (+15) · telefone NÃO CONFIRMADO (+5) · telefone COMPARTILHADO (**−5**, é penalidade) · WhatsApp encontrado no site (+5) · e-mail de domínio próprio (+5) · **decisor identificado no QSA (+7)**

**DOR DIGITAL — 0 a 45** *(invertida: quanto pior o digital, maior a oportunidade)*
Sem site ou site fora do ar (+12) · site sem pixel e sem GTM (+10) · nenhum sinal de mídia paga (+8) · Instagram inexistente (+8) · sem WhatsApp nem canal de atendimento claro (+7)

Tradução direta da sua tese: *empresa com ativos negligenciados = dor que ela ainda não articulou.*

### Dois perfis de peso, não um

Um preset de indústria e um preset de estética não podem usar a mesma régua. Indústria pesada com site feio não é oportunidade de marketing digital — é empresa que vende por representante.

- **Perfil B2C local:** dor digital vale até 45 pontos
- **Perfil B2B/indústria:** dor digital cai para o máximo de 20, e fit + porte sobem para 55

Cada preset carrega o perfil que usa. Configurável no admin.

**Exibição:** posições **P1, P2, P3…** — Pole (85+), Grid da frente (70–84), Grid do meio (50–69), Fundo do grid (<50). O Piloto liga de cima pra baixo. Ele não escolhe: o app já escolheu.

Todos os pesos são chute educado até os Pilotos gerarem número real de conversão. **Todos configuráveis no admin desde o dia 1.** Volume é rei também aqui.

---

## 5. O MINUTO DE OURO AUTOMÁTICO

No dossiê do lead, um bloco pronto para discar:

```
┌────────────────────────────────────────────┐
│  P3 · METALÚRGICA XYZ LTDA                 │
│  Fale com: JOÃO CARLOS SILVA               │
│  Sócio-Administrador · sócio há 11 anos    │
│                                            │
│  (31) 3XXX-XXXX   ✅ CONFIRMADO            │
│     confere com o site oficial             │
│  (31) 9XXXX-XXXX  💬 WhatsApp no site      │
├────────────────────────────────────────────┤
│  CONTEXTO PARA A ABERTURA                  │
│  • Site no ar, mas sem pixel e sem GTM     │
│  • Rodapé com copyright de 2021            │
│  • Instagram existe, sem link no site      │
├────────────────────────────────────────────┤
│  ABERTURA SUGERIDA                         │
│  "Olá João Carlos, aqui é o Rômulo da      │
│  Combustível de BH, tudo bem? Nós somos    │
│  especializados no ramo industrial na      │
│  parte de vendas — e eu vi que vocês têm   │
│  um site bem estruturado, mas notei alguns │
│  pontos no comercial que dá pra melhorar.  │
│  Queria te apresentar numa reunião de 20   │
│  minutos. Como está sua agenda?"           │
│                        [copiar]  [editar]  │
└────────────────────────────────────────────┘
```

Os 4 passos do seu discurso montados com os dados reais do lead. É o que amarra o app ao método e torna ele insubstituível pra quem passou pelo WDL.

---

## 6. TELAS

Mobile-first no layout, desktop-first no fluxo pesado. Busca e export são de desktop; consulta de lead e dossiê no celular, antes de discar.

1. **Entrada** — Supabase Auth (magic link + Google)
2. **Box** — créditos, últimas buscas, listas salvas
3. **Nova largada** — wizard de 3 passos (nicho → região → filtros) com **painel de contagem ao vivo** atualizando a cada mudança de filtro
4. **Grid de resultados** — ordenado por posição, com selo de confiança em cada telefone. **Campo vazio nunca fica em branco: mostra `NÃO ENCONTRADO`**
5. **Dossiê do lead** — cadastro, decisor, auditoria digital, Minuto de Ouro, botões para site / Instagram / Biblioteca de Anúncios / WhatsApp / **abrir no Google Maps**
6. **Exportação** — XLSX no branding, CSV mapeado pro CRM, PDF de dossiê
7. **Minhas listas** — histórico, reexportar sem gastar crédito de novo
8. **Curadoria de nichos** (admin) — onde você afina os CNAEs de cada preset
9. **Conta** — plano, créditos, faturas

---

## 7. CRÉDITOS E PLANOS *(faixa aprovada)*

**Regra central: buscar e ver é grátis. Crédito só queima ao exportar ou enriquecer.**

- 1 crédito = 1 lead exportado (cadastro + decisor)
- 2 créditos = 1 lead com validação de contato + auditoria digital

| Plano | Preço | Inclui |
|---|---|---|
| **Treino livre** | Grátis | 25 leads/mês, sem enriquecimento |
| **Piloto** | R$ 97/mês | 500 leads + 200 enriquecimentos |
| **Piloto Pro** | R$ 197/mês | 2.000 leads + 1.000 enriquecimentos |
| **Escuderia** | R$ 397/mês | 6.000 leads, 5 usuários |
| **Membro da Plataforma** | incluso nos R$ 89,90 | Nível Piloto liberado |

**A cunha de mercado:**

| Concorrente | Preço/mês | Custo por lead |
|---|---|---|
| Econodata Premium | R$ 590 – 890 | ~R$ 0,49/contato |
| Speedio Entry | R$ 719 (300 empresas) | ~R$ 2,40 |
| Speedio Avançado | R$ 1.379 (1.000 empresas) | ~R$ 1,38 |
| **GRID Piloto** | **R$ 97 (500 leads)** | **~R$ 0,19** |

Nenhum dos dois publica preço no site — venda consultiva, formulário, fidelidade de 12 meses. Você entra com **preço público, self-service, Pix e sem fidelidade**, num nicho que já confia em você. E nenhum entrega selo de confiança de telefone, auditoria digital nem script de abertura.

**A jogada anti-churn:** liberar o nível Piloto dentro dos R$ 89,90 da Plataforma. A assinatura deixa de ser "acesso a conteúdo" e vira **ferramenta que o cara abre toda segunda de manhã**. Quem cancela perde a lista.

**Pagamento:** Pix é obrigatório. Asaas (recorrência em Pix/boleto sem fricção) ou Stripe.

---

## 8. STACK E INFRA

| Camada | Escolha |
|---|---|
| App | Next.js 15 (App Router) + TypeScript |
| UI | Tailwind v4 + shadcn/ui + Framer Motion |
| Auth / DB / Storage | Supabase (Postgres + RLS) |
| Deploy | Vercel |
| Fila de enriquecimento | Trigger.dev ou Upstash QStash |
| Worker de crawl | serviço separado (Railway ou Fly.io) — Cheerio + undici; Playwright só como fallback |
| Descoberta de domínio | Serper.dev (~US$ 1/1.000, com 2.500 buscas grátis pra testar) |
| Confirmação cruzada | Overpass API (OpenStreetMap), gratuito |
| Export | ExcelJS, @react-pdf/renderer |
| Pagamento | Asaas ou Stripe |

**Custo de infra.** Base RF filtrada: 12–18 GB no Postgres com índices. Supabase Pro ~US$ 25 + storage ~US$ 1,50, mas busca em 20 milhões de linhas pede compute **Medium (US$ 60)**. Faixa realista: **US$ 90–150/mês**.

Se apertar, mover a base RF para VPS dedicado (Hetzner CCX, ~€25/mês) e manter Supabase pro app. **Não faça isso agora.** Começa tudo no Supabase, mede, migra depois. Complexidade prematura mata projeto.

**Crawler não roda na Vercel** — timeout de serverless não aguenta. Worker separado, sempre.

---

## 9. ROADMAP

| Fase | Entrega | Prazo |
|---|---|---|
| **0 · Ingestão** | Download + parse + carga da base RF, schema, índices, **views de compartilhamento de telefone/e-mail/endereço**. Sem UI. | 1 semana |
| **1 · Grid seco** | Login, busca, contagem ao vivo, resultados, decisor do QSA, **selo COMPARTILHADO já funcionando** (é SQL, não precisa de crawler), export XLSX/CSV. **Já é vendável.** | 2 semanas |
| **2 · Validação e enriquecimento** | Fila + crawler + selo CONFIRMADO/ATUALIZADO + auditoria digital + score completo + Minuto de Ouro. | 2–3 semanas |
| **3 · Monetização** | Créditos, planos, Asaas, PDF branded, admin de pesos e curadoria de nichos. | 1 semana |
| **4 · Operação** | Cron mensal de atualização, integração CRM, API. | contínuo |

**Repare que o selo COMPARTILHADO entra na Fase 1.** Ele não depende de crawler nenhum — é consulta na própria base. Ou seja, **a primeira versão já resolve o problema da contabilidade**, que é o mais doloroso. O resto da validação refina.

**Valide na Fase 1.** Coloca na mão de 10 Pilotos. Se a lista seca com decisor e sem telefone de contador já economiza duas horas por semana deles, o produto está de pé.

---

## 10. LGPD E CONFORMIDADE

Base legal: **art. 7º, §4º** (dados manifestamente públicos) com **art. 7º, IX** (legítimo interesse). Dado de PJ não é dado pessoal; **nome de sócio é**.

Obrigatório, não opcional:

1. **Aviso de privacidade** com origem (Dados Abertos da RFB), finalidade (prospecção comercial B2B) e base legal
2. **Canal de oposição** — formulário público, processamento em até 15 dias, blocklist permanente
3. **Nunca exibir nem exportar CPF**, mesmo mascarado
4. **Registro de proveniência** por campo: de onde veio, quando foi coletado
5. **Termos de uso** proibindo revenda da base bruta
6. Crawler respeitando `robots.txt`, User-Agent identificado, rate limit por domínio
7. **Atribuição ao OpenStreetMap** onde o sinal do OSM for usado (exigência da ODbL)

Isso é informativo. **Passe por um advogado de proteção de dados antes de abrir venda pública** — o modelo é defensável, mas quem assina o risco é você.

---

## 11. RISCOS

| Risco | Mitigação |
|---|---|
| RFB mudar o layout (mudou em jan/2026) | Mapeamento de colunas em arquivo de config, nunca hardcoded |
| CNAE errado no preset gerando lista errada | Curadoria humana obrigatória antes de publicar cada preset |
| Sites com Cloudflare bloqueando o crawler | Timeout curto, marcar `NÃO VERIFICADO`, seguir. Nunca travar a fila |
| Busca ampla derrubar o banco | Teto de 1.000 resultados + paginação por cursor |
| ODbL do OSM contaminar o export | OSM só como sinal booleano, número nunca exportado |
| Instagram/Meta quebrarem a extração | Desenhado como sinal opcional, não como dependência |
| Piloto exportar 50 mil leads e queimar seu custo | Créditos resolvem por construção |

---

## 12. PRÓXIMO PASSO

O prompt mestre atualizado está em `prompt_cursor_grid.md`, pronto pra colar no Cursor. Cobre Fase 0 e Fase 1 — incluindo o selo de telefone compartilhado, que é o que resolve a sua dor imediata.

Quando a Fase 1 estiver de pé, me chama que eu escrevo o prompt da Fase 2 (crawler e validação externa) em cima do código que já existir.

**Uma coisa pra você fazer em paralelo, sem depender de código:** liste, pra 3 nichos, quais tipos de empresa você **não** quer na lista. Ex.: em "saúde", entra clínica particular mas não entra posto de saúde nem hospital público. Essa lista de exclusão é tão valiosa quanto a de inclusão e vai direto pra curadoria.

---

## FONTES

- [Dados Abertos CNPJ — Receita Federal](https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/dados-abertos/cadastros)
- [Layout oficial dos Dados Abertos do CNPJ (PDF)](https://www.gov.br/receitafederal/dados/cnpj-metadados.pdf)
- [rictom/cnpj-sqlite — volumetria e mudança de layout jan/2026](https://github.com/rictom/cnpj-sqlite)
- [aphonsoar/Receita_Federal_Dados_Publicos_CNPJ — estrutura das tabelas](https://github.com/aphonsoar/Receita_Federal_do_Brasil_-_Dados_Publicos_CNPJ/)
- [Google Maps Platform Service Specific Terms — regra de caching](https://cloud.google.com/maps-platform/terms/maps-service-terms)
- [Políticas do Places API](https://developers.google.com/maps/documentation/places/web-service/policies)
- [Meta Ad Library API — acesso e limites](https://swipekit.app/articles/meta-ad-library-api)
- [Overpass API — limites de uso e instância própria](https://wiki.openstreetmap.org/wiki/Overpass_API)
- [LocalBusiness structured data — Google Search Central](https://developers.google.com/search/docs/appearance/structured-data/local-business)
- [Serper.dev — preços 2026](https://apiserpent.com/blog/serper-pricing-credits-explained)
- [Twilio Lookup — preços 2026](https://www.1lookup.io/compare/twilio-lookup)
- [Econodata — preços e planos 2026](https://leadjet.com.br/econodata-o-que-e/)
- [Speedio — preços e planos 2026](https://leadjet.com.br/speedio-o-que-e/)
- [Supabase Pricing 2026](https://makerkit.dev/blog/saas/supabase-pricing)
- [LGPD na prospecção B2B](https://leadcnpj.com.br/blog/lgpd-na-prospeccao-b2b/)
