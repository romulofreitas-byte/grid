# PROMPT MESTRE — CURSOR
### Projeto GRID · Mundo Pódium
**Cole isto inteiro na primeira mensagem do Cursor (modo Agent, com o repositório vazio aberto).**

---

## CONTEXTO

Você vai construir o **GRID**, um SaaS brasileiro de criação de lista e qualificação de leads para prospecção ativa B2B (cold call). O produto é do Mundo Pódium, escola de cold call ao vivo. O usuário final é chamado de **Piloto**.

O problema que resolve: hoje o vendedor gasta horas no Google Maps, no site da Receita e no QSA para montar uma lista de 50 empresas com telefone e nome do sócio-administrador. O GRID entrega isso em segundos, já ranqueado por quem vale mais a pena ligar primeiro, com um bloco de abertura de ligação pronto.

---

## REGRAS INEGOCIÁVEIS

1. **NUNCA use Google Maps / Places API.** Os Termos de Serviço do Google proíbem armazenar e exportar conteúdo do Places. A fonte de dados é exclusivamente a base de Dados Abertos do CNPJ da Receita Federal, que é pública e livre. (Um **link** que abre o Google Maps no navegador é permitido e está previsto — link não é API.)
2. **NUNCA deixe um campo vazio na interface.** Se um dado não foi encontrado, renderize o texto `NÃO ENCONTRADO` em cinza (`#7A7A80`). Se não foi verificado, renderize `NÃO VERIFICADO`. Silêncio na tela é bug.
3. **NUNCA exiba nem exporte CPF**, mesmo mascarado pela Receita.
4. **Português do Brasil em toda a interface.** Código, variáveis e comentários em inglês.
5. Todo campo enriquecido carrega **proveniência**: `{ valor, fonte, coletado_em }`.
6. **NUNCA invente códigos CNAE.** Todo código vem da tabela `ref_cnae`, carregada dos arquivos da própria Receita. Presets de nicho são definidos por palavras-chave e resolvidos contra essa tabela em tempo de execução — nunca por lista fixa de códigos escrita à mão.

---

## STACK

- Next.js 15 (App Router) + TypeScript strict
- Tailwind CSS v4 + shadcn/ui + Framer Motion + lucide-react
- Supabase: Auth (magic link + Google OAuth), Postgres com RLS, Storage
- Deploy: Vercel
- Export: `exceljs` (XLSX), `@react-pdf/renderer` (PDF)
- Validação: zod. Formulários: react-hook-form. Estado de servidor: TanStack Query
- Gerenciador: pnpm

---

## DESIGN SYSTEM — MUNDO PÓDIUM (obrigatório, não reinterprete)

### Cores
```css
--podium-black:   #0D0D0F;  /* fundo padrão */
--podium-panel:   #15151A;  /* painéis e cards */
--podium-yellow:  #F5B301;  /* SÓ destaque: CTA, vitória, palavra-chave. NUNCA decorativo */
--podium-white:   #FFFFFF;  /* texto e símbolo */
--podium-gray:    #CDCDD2;  /* texto secundário */
--podium-muted:   #7A7A80;  /* legendas, apoio, "NÃO ENCONTRADO" */
--podium-success: #22C55E;  /* RESERVADO: só prova de resultado confirmado */
```

**Regra de cor mais importante:** o amarelo é o único accent. Não introduza roxo, azul, laranja ou vermelho como cor de destaque em ícones ou cards. Estados de erro podem usar vermelho apenas em mensagens de erro reais.

### Tipografia
Fonte **Sora** (Google Fonts, variável). ExtraBold = títulos. Bold = subtítulos e números de destaque. Medium = legendas. Regular = texto corrido.

### Estilo visual
- **Tema escuro sempre.** Não construa light mode.
- **Fundo nunca chapado:** preto base com painéis angulares (polígonos diagonais) em tons de grafite ligeiramente mais claros/escuros. Implemente como um componente `<AngularBackground />` com SVG absoluto.
- **Glassmorfismo** nos cards e overlays: `bg-white/[0.04]`, `backdrop-blur-xl`, borda `border-white/[0.08]`, e nos cards de destaque borda amarela a ~15% de opacidade.
- **Âncora visual dos títulos:** barra amarela vertical fina (4px) à esquerda do título de seção. É o padrão da marca.
- **Sem ícones pictográficos customizados.** Use apenas lucide-react, discretos, em `--podium-gray`.
- Cantos: `rounded-2xl` em cards, `rounded-xl` em inputs e botões.

### Responsividade
**Mobile-first no CSS.** No mobile: cards empilhados, bottom sheet para filtros, navegação por bottom bar. No desktop (lg+): tabela densa com colunas fixas, filtros em sidebar esquerda, painel de contagem em sidebar direita.

---

## ESCOPO DESTA ENTREGA (Fases 0 e 1)

Construa **somente** o que está abaixo. Não implemente enriquecimento digital, créditos ou pagamento ainda — mas deixe o schema preparado para eles.

### FASE 0 — Ingestão da base da Receita Federal

Crie o diretório `scripts/ingest/` com um pipeline em TypeScript (executável via `tsx`) que:

1. Baixa os arquivos ZIP mais recentes dos Dados Abertos do CNPJ da Receita Federal. **Coloque as URLs base em `scripts/ingest/config.ts`** — a Receita mudou o caminho em janeiro de 2026, então isso precisa ser configurável, nunca hardcoded no meio do código.
2. Descompacta e faz streaming parse dos CSVs. Encoding **ISO-8859-1**, separador `;`, sem cabeçalho, campos entre aspas. Não carregue nada inteiro em memória.
3. **Mapeamento de colunas em arquivo de config separado** (`scripts/ingest/layout.ts`), com os nomes de campo do layout oficial da RFB.
4. **Filtra na ingestão** (crítico para performance):
   - `situacao_cadastral = '02'` (ativa)
   - telefone1 preenchido
   - excluir registros com opção pelo MEI = 'S'
5. Carrega em Postgres via `COPY` em lotes, com barra de progresso no terminal.
6. Cria os índices ao final da carga, nunca antes.
7. **Constrói as views de compartilhamento de contato** (ver seção MOTOR DE CONFIANÇA abaixo) — é a última etapa da carga.
8. Registra a execução em uma tabela `ingest_runs` (arquivo, linhas, duração, hash).

**Tabelas de referência** (carregar também): CNAEs, municípios, naturezas jurídicas, qualificações de sócio, motivos de situação cadastral. Vêm nos mesmos arquivos da RFB.

### SCHEMA

```sql
-- ============ BASE RECEITA FEDERAL ============

create table companies (
  cnpj_basico     char(8) primary key,
  razao_social    text not null,
  natureza_id     int,
  qualificacao_responsavel int,
  capital_social  numeric(18,2),
  porte           char(2),        -- 01 ME · 03 EPP · 05 Demais
  updated_at      timestamptz default now()
);

create table establishments (
  cnpj              char(14) primary key,
  cnpj_basico       char(8) not null references companies(cnpj_basico),
  is_matriz         boolean not null,
  nome_fantasia     text,
  situacao          char(2) not null,
  data_situacao     date,
  data_inicio       date,
  cnae_principal    char(7) not null,
  cnae_secundarios  text[],
  logradouro        text,
  numero            text,
  complemento       text,
  bairro            text,
  cep               char(8),
  uf                char(2) not null,
  municipio_id      int not null,
  ddd1              varchar(4),
  telefone1         varchar(10),
  ddd2              varchar(4),
  telefone2         varchar(10),
  email             text,
  -- não persistir fax
  updated_at        timestamptz default now()
);

create table partners (
  id                bigserial primary key,
  cnpj_basico       char(8) not null references companies(cnpj_basico),
  nome              text not null,
  qualificacao_id   int not null,
  data_entrada      date,
  faixa_etaria      smallint
  -- CPF DELIBERADAMENTE OMITIDO. Não ingerir, não armazenar, não exibir.
);

create table simples_nacional (
  cnpj_basico     char(8) primary key references companies(cnpj_basico),
  opcao_simples   boolean,
  opcao_mei       boolean
);

-- tabelas de referência
create table ref_cnae         (codigo char(7) primary key, descricao text not null);
create table ref_municipio    (id int primary key, nome text not null, uf char(2));
create table ref_natureza     (id int primary key, descricao text not null);
create table ref_qualificacao (id int primary key, descricao text not null);

-- ÍNDICES
create index idx_est_search on establishments (uf, municipio_id, cnae_principal);
create index idx_est_cnae   on establishments (cnae_principal);
create index idx_est_basico on establishments (cnpj_basico);
create index idx_part_basico on partners (cnpj_basico);
create extension if not exists pg_trgm;
create index idx_comp_razao on companies using gin (razao_social gin_trgm_ops);
create index idx_est_fantasia on establishments using gin (nome_fantasia gin_trgm_ops);
create index idx_cnae_desc on ref_cnae using gin (descricao gin_trgm_ops);

-- ============ APLICAÇÃO ============

create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nome        text,
  plano       text not null default 'free',
  creditos    int  not null default 25,
  created_at  timestamptz default now()
);

create table searches (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  nome        text not null,
  filtros     jsonb not null,
  total_found int,
  created_at  timestamptz default now()
);

create table saved_leads (
  id           uuid primary key default gen_random_uuid(),
  search_id    uuid not null references searches(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  cnpj         char(14) not null,
  grid_score   int,
  grid_position int,
  enrichment   jsonb,       -- preenchido na Fase 2
  status       text default 'novo',  -- novo · ligando · reuniao · descartado
  notas        text,
  created_at   timestamptz default now(),
  unique (search_id, cnpj)
);

create table opt_outs (
  id          uuid primary key default gen_random_uuid(),
  documento   text not null unique,
  motivo      text,
  created_at  timestamptz default now()
);

-- ============ MOTOR DE CONFIANÇA DO CONTATO ============
-- Telefone que aparece em muitos CNPJs distintos é quase sempre
-- do escritório de contabilidade, não da empresa.

create materialized view phone_usage as
select ddd1, telefone1, count(distinct cnpj_basico)::int as qtd_empresas
from establishments
where telefone1 is not null and length(telefone1) >= 8
group by 1, 2;
create unique index on phone_usage (ddd1, telefone1);

create materialized view email_usage as
select lower(email) as email, count(distinct cnpj_basico)::int as qtd_empresas
from establishments
where email is not null and email like '%@%'
group by 1;
create unique index on email_usage (email);

create materialized view address_usage as
select cep, logradouro, numero, count(distinct cnpj_basico)::int as qtd_empresas
from establishments
where cep is not null and numero is not null
group by 1, 2, 3;
create unique index on address_usage (cep, logradouro, numero);

-- ============ PRESETS DE NICHO ============

create table niche_presets (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  nome         text not null,
  grupo        text not null,          -- 'b2c_local' | 'b2b_industria'
  perfil_score text not null,          -- define os pesos do Grid
  keywords     text[] not null,        -- termos buscados em ref_cnae
  exclusoes    text[] default '{}',    -- termos que removem CNAEs do resultado
  curado       boolean default false,  -- true = revisado por humano
  ordem        int default 0
);

create table niche_preset_cnaes (
  preset_id  uuid not null references niche_presets(id) on delete cascade,
  cnae       char(7) not null,
  incluido   boolean not null default true,
  primary key (preset_id, cnae)
);
```

**RLS obrigatório** em `profiles`, `searches` e `saved_leads`: usuário só lê e escreve o que é dele. As tabelas da Receita são leitura pública para usuários autenticados.

---

## MOTOR DE CONFIANÇA DO CONTATO (feature central, não opcional)

**O problema:** ao abrir o CNPJ, muita empresa cadastra o telefone e o e-mail do escritório de contabilidade. Uma lista com o telefone do contador é pior que lista nenhuma — o Piloto liga, cai no contador, leva não, e o não nem era do lead.

**A solução nesta fase é 100% SQL**, sem crawler e sem API externa. O telefone do contador tem assinatura óbvia: se repete em dezenas de CNPJs.

Implemente em `lib/contact-confidence.ts`:

```ts
export const CONTACT_RULES = {
  sharedPhoneThreshold: 3,     // 3+ CNPJs distintos = compartilhado
  sharedEmailThreshold: 3,
  sharedAddressThreshold: 5,
  accountantDomainHints: ['contab', 'contabil', 'assessoria', 'escritorio', 'fiscal', 'tributar'],
  freeEmailProviders: ['gmail', 'hotmail', 'outlook', 'yahoo', 'uol', 'bol', 'terra', 'ig.com', 'live.com'],
} as const;

export type ContactSeal =
  | 'CONFIRMADO'      // Fase 2: bate com o site oficial
  | 'ATUALIZADO'      // Fase 2: site tem outro número, ele vira o principal
  | 'COMPARTILHADO'   // Fase 1: aparece em N outros CNPJs — provável contabilidade
  | 'NAO_CONFIRMADO'; // Fase 1: só o dado da Receita
```

Na Fase 1, todo lead recebe `COMPARTILHADO` ou `NAO_CONFIRMADO`. As Camadas de verificação externa entram na Fase 2 — deixe a interface preparada para os quatro selos desde já.

**Como o selo aparece:**

| Selo | Cor | Texto na interface |
|---|---|---|
| CONFIRMADO | verde `--podium-success` | "confere com o site oficial" |
| ATUALIZADO | amarelo | "número atualizado pelo site" |
| COMPARTILHADO | âmbar/alerta | **"este número aparece em {N} empresas — provável contabilidade"** |
| NAO_CONFIRMADO | muted | "não verificado" |

O número N precisa aparecer literalmente. Quando o Piloto lê "aparece em 47 empresas", ele entende na hora o que está olhando.

**Filtro obrigatório na busca, LIGADO POR PADRÃO:**
> ☑ Ocultar telefones compartilhados (provável contabilidade)

É uma cláusula `WHERE` contra `phone_usage.qtd_empresas < 3`. Custo de implementação: baixo. Valor: é o principal diferencial do produto.

Aplique a mesma lógica ao e-mail: e-mail compartilhado, de provedor gratuito, ou com domínio contendo os `accountantDomainHints` **não conta** como "e-mail de domínio próprio" no score.

### FASE 1 — Aplicação

#### Rotas

```
/                        landing (público)
/entrar                  auth
/box                     dashboard
/largada                 wizard de nova busca
/grid/[searchId]         resultados
/lead/[cnpj]             dossiê do lead
/listas                  buscas salvas
/conta                   plano e dados
/admin/nichos            curadoria de CNAE por preset (restrito)
/api/search/count        POST — contagem ao vivo (debounce)
/api/search/run          POST — executa e cria a search
/api/export/[searchId]   GET  — ?format=xlsx|csv|pdf
```

#### `/largada` — wizard de 3 passos

**Passo 1 · Nicho**

Duas formas de escolher, na mesma tela:

*a) Presets* — grade de cards clicáveis, agrupados em **B2C local** e **B2B e indústria**. Cada card mostra o nome do nicho e a contagem de empresas na região já selecionada (ou no Brasil, se ainda não escolheu região). Popule a tabela `niche_presets` via seed com estes 16, nesta ordem:

```ts
// scripts/seed/presets.ts
// grupo b2c_local  → perfil_score: 'b2c_local'
'Estética e beleza'      keywords: ['estética','beleza','depilação','cabeleireiro','podologia','manicure','maquiagem']
'Saúde e clínicas'       keywords: ['médica','odontologia','fisioterapia','ortopedia','dermatologia','oftalmologia','nutrição','psicologia']
'Pet'                    keywords: ['veterinária','animais domésticos','pet','higiene e embelezamento de animais']
'Automotivo'             keywords: ['automóveis','veículos automotores','motocicletas','manutenção e reparação de veículos','autopeças','funilaria']
'Imobiliário'            keywords: ['imóveis','imobiliári','corretagem','incorporação','condomínio']
'Varejo'                 keywords: ['comércio varejista','vestuário','calçados','óptica','joalheria','móveis','eletrodoméstico']
'Alimentação fora do lar' keywords: ['restaurante','lanchonete','pizzaria','bar','buffet','fornecimento de alimentos']
'Educação'               keywords: ['ensino','educação','curso','idiomas','escola','treinamento']
'Turismo e hotelaria'    keywords: ['hotéis','pousada','agência de viagens','turismo','hospedagem']

// grupo b2b_industria → perfil_score: 'b2b_industria'
'Indústria'              keywords: ['fabricação','metalurgia','indústria','produtos alimentícios','químic','plástico','têxtil','embalagem']
'Construção civil'       keywords: ['construção','obras','engenharia','arquitetura','incorporação de empreendimentos']
'Insumos para construção' keywords: ['mármore','granito','vidro','esquadria','serralheria','material de construção','madeira']
'Contabilidade e jurídico' keywords: ['contabilidade','auditoria','advocacia','jurídic','consultoria em gestão']
'Tech e software'        keywords: ['programas de computador','tecnologia da informação','desenvolvimento de sistemas','tratamento de dados','hospedagem']
'Logística e transporte' keywords: ['transporte rodoviário de carga','armazenamento','logística','distribuidora','carga']
'Financeiro e seguros'   keywords: ['seguros','corretagem de seguros','investimento','crédito','fomento mercantil']
```

**Como o preset vira CNAE:** ao ser aplicado, o app faz busca por similaridade (`pg_trgm`) das `keywords` contra `ref_cnae.descricao`, remove os que casam com `exclusoes`, e — se o preset já foi curado (`curado = true`) — usa a lista salva em `niche_preset_cnaes` em vez do resultado bruto. Os códigos **sempre** saem de `ref_cnae`. Nenhum código CNAE literal no código-fonte.

*b) Busca livre* — combobox com busca por texto sobre `ref_cnae.descricao`, seleção múltipla, chips removíveis, mostrando código + descrição + contagem de empresas.

Os dois modos alimentam a mesma lista final de CNAEs selecionados, sempre visível e sempre editável em chips.

**Tela de Curadoria de Nichos** (`/admin/nichos`, restrita): lista os presets; ao abrir um, mostra todos os CNAEs que as keywords capturaram, cada um com descrição e contagem de empresas no Brasil, e um switch incluir/excluir por linha. Salvar grava em `niche_preset_cnaes` e marca `curado = true`. Sem essa tela o produto entrega lista errada — ela não é opcional.

**Passo 2 · Região**
Select de UF (múltiplo) → carrega municípios daquelas UFs em combobox com busca e seleção múltipla. Botão "Selecionar capital". Nada de campo de texto livre para região.

**Passo 3 · Filtros**
Porte (checkbox ME/EPP/Demais) · faixa de capital social (slider duplo) · empresa aberta há mais de N anos (slider) · só matriz (switch) · excluir optantes do Simples (switch) · exigir e-mail de domínio próprio (switch) · exigir decisor identificado no QSA (switch).

**Bloco destacado "Qualidade do contato":**
- ☑ **Ocultar telefones compartilhados (provável contabilidade)** — *ligado por padrão*
- ☐ Ocultar e-mails de provedor gratuito
- ☐ Ocultar endereços compartilhados (escritório contábil / endereço fiscal)

Este bloco fica em um card com borda amarela, acima dos demais filtros. É o diferencial do produto — precisa estar visível, não escondido num acordeão.

**Painel de contagem ao vivo — obrigatório.**
Sidebar direita fixa no desktop, barra inferior fixa no mobile. Atualiza a cada mudança de filtro com debounce de 400 ms, chamando `/api/search/count`. Mostra:
- Número grande em amarelo: total de empresas encontradas
- Quebra por município (top 5) em barras horizontais
- Quantas têm telefone, e-mail e decisor identificado
- Estado de carregamento em skeleton, nunca spinner solto

Use um `count(*)` com o mesmo WHERE da busca principal, com `LIMIT 10000` interno para não travar em filtros muito amplos (exibir "10.000+" nesse caso).

#### `/grid/[searchId]` — resultados

Ordenado por `grid_score` desc. Cada linha mostra a **posição (P1, P2, P3…)** em um badge com a faixa:

| Faixa | Score | Cor do badge |
|---|---|---|
| POLE | 85+ | amarelo cheio, texto preto |
| GRID DA FRENTE | 70–84 | amarelo a 20%, texto amarelo |
| GRID DO MEIO | 50–69 | branco a 10%, texto cinza claro |
| FUNDO DO GRID | <50 | apenas borda, texto muted |

Colunas no desktop: Posição · Razão social (com nome fantasia embaixo, menor) · Município/UF · CNAE (descrição truncada) · Telefone · Decisor · Porte · Ações.
No mobile: card com posição no canto, razão social, telefone e decisor em destaque, o resto colapsado.

Teto de **1.000 resultados por busca**, paginação por cursor de 50 em 50.

#### Cálculo do Grid Score (Fase 1 — sem enriquecimento)

Implemente em `lib/scoring.ts` com **pesos exportados como constante editável**:

```ts
// Dois perfis: um preset de indústria e um de estética não usam a mesma régua.
// Indústria pesada com site feio não é oportunidade de marketing digital.
export const GRID_WEIGHTS = {
  b2c_local: {
    fit: { cnaeExato: 12, porteCompativel: 8, capitalNaFaixa: 6, idadeMinima: 4 },
    contatabilidade: {
      telefoneConfirmado: 15,     // selo CONFIRMADO ou ATUALIZADO (Fase 2)
      telefoneNaoConfirmado: 5,   // só dado da Receita
      telefoneCompartilhado: -5,  // PENALIDADE: provável contabilidade
      whatsappEncontrado: 5,      // Fase 2
      emailProprio: 5,
      decisorIdentificado: 7,
    },
    // dorDigital (máx. 45) entra na Fase 2
    dorDigitalMax: 45,
  },
  b2b_industria: {
    fit: { cnaeExato: 20, porteCompativel: 18, capitalNaFaixa: 12, idadeMinima: 5 },
    contatabilidade: {
      telefoneConfirmado: 15,
      telefoneNaoConfirmado: 5,
      telefoneCompartilhado: -5,
      whatsappEncontrado: 3,
      emailProprio: 5,
      decisorIdentificado: 7,
    },
    dorDigitalMax: 20,
  },
} as const;
```

O perfil vem de `niche_presets.perfil_score`. Se a busca foi por CNAE livre (sem preset), use `b2c_local` como padrão.

Na Fase 1, o bloco de dor digital ainda não pontua. **Normalize para 0–100** dividindo pelo máximo possível na fase atual, para que as faixas do badge funcionem desde já. O score pode ser negativo antes da normalização (telefone compartilhado) — nesse caso, trave em 0.

#### Prioridade do decisor

Em `lib/decisor.ts`, ordem de preferência por `qualificacao_id`:

```
Sócio-Administrador → Titular Pessoa Física → Administrador →
Presidente → Diretor → Sócio (o de data_entrada mais antiga)
```

**Não hardcode os números dos códigos.** Carregue de `ref_qualificacao` e faça o match pela descrição, com um mapa de prioridade em config. A tabela de qualificações vem junto com os dados da Receita e os códigos devem ser conferidos na ingestão.

#### `/lead/[cnpj]` — dossiê

Layout de duas colunas no desktop, empilhado no mobile:

**Esquerda — Identificação**
Badge de posição · razão social · nome fantasia · CNPJ formatado · CNAE principal com descrição · CNAEs secundários (chips) · situação e data · porte · capital social · data de abertura · endereço completo · e-mail (clicável, com aviso se for compartilhado ou de provedor gratuito).

**Bloco de telefones — o mais importante da tela.** Cada número em uma linha, clicável com `tel:`, e **logo abaixo o selo de confiança com a explicação em texto**:

```
(31) 3XXX-XXXX          ✅ CONFIRMADO
                        confere com o site oficial

(31) 3YYY-YYYY          ⚠️ COMPARTILHADO
                        este número aparece em 47 empresas —
                        provável contabilidade
```

Ordene por confiança, o melhor primeiro. Nunca esconda um número ruim — mostre com o alerta. O Piloto decide.

**Direita — Decisor e ação**
Card com borda amarela: **"Fale com: [NOME]"**, qualificação, tempo de sociedade, faixa etária.

Abaixo, card **MINUTO DE OURO** com um textarea editável pré-preenchido com o template de abertura em 4 passos:

```
Olá {primeiroNomeDecisor}, aqui é o {nomeUsuario} da {empresaUsuario} de {cidadeUsuario}, tudo bem?
Nós somos especializados em {especialidade} na parte de {area} —
e eu vi que vocês {contexto}.
Queria te apresentar numa reunião de 20 minutos. Como está sua agenda?
```

Os campos `{especialidade}`, `{area}`, `{empresaUsuario}` e `{cidadeUsuario}` vêm do perfil do usuário (adicione esses campos em `profiles`). O `{contexto}` fica com o placeholder `[preencher no Minuto de Ouro]` na Fase 1 — será gerado automaticamente pelo enriquecimento na Fase 2. Botão **copiar** com feedback visual.

Linha de botões (todos abrem em nova aba):
- **abrir site**
- **abrir Instagram**
- **Biblioteca de Anúncios** → `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q={razaoSocialEncoded}`
- **WhatsApp** → `https://wa.me/{numeroE164}`
- **conferir no Google Maps** → `https://www.google.com/maps/search/?api=1&query={razaoSocial}+{municipio}+{uf}`

O botão do Maps é um **link simples, sem API e sem armazenar nada** — é a forma permitida de usar o Maps. Serve para o Piloto bater o olho no telefone e no endereço durante o Minuto de Ouro. Deixe um texto de apoio: *"confira o telefone no Maps antes de discar"* quando o selo for `COMPARTILHADO` ou `NAO_CONFIRMADO`.

Botões cujo destino não é conhecido ficam desabilitados com tooltip `NÃO ENCONTRADO`.

Campo de notas (autosave) e seletor de status (novo / ligando / reunião / descartado).

#### Exportação

**XLSX** (`exceljs`) — cabeçalho com fundo `#0D0D0F`, texto branco, negrito, e barra amarela na primeira linha. Congelar cabeçalho, autofilter ligado, larguras ajustadas. Aba 1 "Grid", aba 2 "Resumo da busca" (filtros aplicados, data, total). Na aba Grid, a célula de telefone com selo `COMPARTILHADO` recebe **fundo âmbar** e comentário com o número de empresas que usam aquele telefone.

**CSV** — colunas mapeadas para importação em CRM, exatamente nesta ordem e com estes nomes:
```
Empresa;Nome Fantasia;CNPJ;Contato;Cargo;Telefone Principal;Confianca;
Telefone Receita;Telefone Site;Whatsapp;Email;Site;Endereco;Bairro;Cidade;
Estado;CEP;Setor;Porte;Origem;Score;Observacoes
```
`Telefone Principal` é sempre o de maior confiança. `Confianca` recebe o selo por extenso (`Confirmado`, `Atualizado`, `Compartilhado - provavel contabilidade`, `Nao confirmado`). O Piloto nunca pode ser enganado sobre a origem do número.

`Origem` preenchido com `GRID - Mundo Podium`. Encoding UTF-8 com BOM (Excel brasileiro exige).

**PDF** (`@react-pdf/renderer`) — dossiê de uma página por lead, tema escuro, logo do Mundo Pódium no topo, barra amarela, tipografia Sora. Máximo de 50 leads por PDF.

Toda exportação registra em `searches` e, na Fase 3, debita crédito.

---

## PÁGINAS LEGAIS (criar na Fase 1, não deixar para depois)

- `/privacidade` — origem dos dados (Dados Abertos da Receita Federal), finalidade (prospecção comercial B2B), base legal (LGPD art. 7º §4º e art. 7º IX), direitos do titular.
- `/opt-out` — formulário público para titular solicitar remoção. Grava em `opt_outs`. A query de busca **deve** excluir CNPJs e nomes presentes nessa tabela.
- `/termos` — proibição explícita de revenda da base bruta.

---

## ORDEM DE CONSTRUÇÃO

1. Setup do projeto, Tailwind, tema Pódium, componentes base (`AngularBackground`, `SectionTitle`, `GlassCard`, `PositionBadge`, `EmptyValue`, `ContactSeal`)
2. Supabase: projeto, schema, RLS, migrations
3. Pipeline de ingestão + carga de um subconjunto (2 UFs) para desenvolvimento
4. **Views de compartilhamento + `lib/contact-confidence.ts`** — valide com uma consulta manual que os telefones mais repetidos da base são mesmo de contabilidade antes de seguir
5. Seed dos 16 presets de nicho + tela `/admin/nichos`
6. Auth e `/box`
7. `/largada` com contagem ao vivo
8. `/grid` com scoring e paginação
9. `/lead` com dossiê, selos e Minuto de Ouro
10. Exportações
11. Páginas legais
12. Carga completa da base

---

## CRITÉRIOS DE ACEITE

- [ ] Busca com o preset "Indústria" em Minas Gerais retorna resultados em menos de 2 segundos
- [ ] O painel de contagem atualiza sem travar a interface ao mudar filtros rapidamente
- [ ] **O filtro "ocultar telefones compartilhados" vem ligado por padrão e muda o total exibido**
- [ ] **Um lead com telefone repetido mostra o selo COMPARTILHADO com o número exato de empresas**
- [ ] **Nenhum código CNAE literal existe no código-fonte** — todos vêm de `ref_cnae`
- [ ] A tela `/admin/nichos` permite incluir e excluir CNAEs de um preset e a curadoria persiste
- [ ] Nenhum campo da interface aparece vazio — sempre `NÃO ENCONTRADO` ou `NÃO VERIFICADO`
- [ ] Nenhum CPF aparece em tela, no export ou no banco
- [ ] Nenhuma chamada a API do Google Maps em todo o código (links para o site do Maps são permitidos)
- [ ] O XLSX abre no Excel com acentuação correta e cabeçalho no branding
- [ ] O CSV importa no Pipedrive e no Agendor sem ajuste manual de colunas
- [ ] Tudo utilizável com uma mão só em tela de 375px de largura
- [ ] Lighthouse mobile acima de 90 em performance e acessibilidade
- [ ] Contraste mínimo AA em todos os textos sobre fundo escuro

---

## O QUE **NÃO** FAZER AGORA

Deixe o schema preparado, mas não implemente: crawler de site, auditoria digital (pixel/GTM/Instagram), selos `CONFIRMADO` e `ATUALIZADO`, débito de créditos, integração de pagamento, integração com CRM. Isso é Fase 2 e 3.

**Mas implemente sim, nesta fase:** as views de compartilhamento, os selos `COMPARTILHADO` e `NAO_CONFIRMADO`, o filtro de telefone compartilhado, os presets de nicho e a tela de curadoria. Tudo isso é SQL e interface — não depende de crawler nenhum, e é o que resolve a dor principal do usuário logo na primeira versão.

---

**Comece confirmando o plano de arquivos que você vai criar antes de escrever código.**
