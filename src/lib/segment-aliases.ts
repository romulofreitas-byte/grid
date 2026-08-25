import { normalizeText } from "@/lib/normalize-text";

/** Commercial findability terms keyed by segment (or niche) slug. */
export const SEGMENT_ALIASES: Record<string, string[]> = {
  // Estética
  "clinicas-estetica": ["clinica de estetica", "estetica", "beleza"],
  "harmonizacao-facial": ["harmonizacao", "preenchimento", "botox", "acido hialuronico"],
  "depilacao-laser": ["depilacao", "laser", "depilacao definitiva"],
  "saloes-premium": ["salao de beleza", "salao", "cabeleireiro", "cabeleireiros", "hair"],
  barbearias: ["barbearia", "barbearias", "barbeiro", "barbeiros", "barbershop"],
  "estudio-tatuagem": ["tatuagem", "tattoo", "estudio de tatuagem", "piercing"],
  "micropigmentacao": ["micropigmentacao", "design de sobrancelha", "dermopigmentacao"],
  "manicure-podologia": ["manicure", "pedicure", "unhas", "podologia"],
  "spa-bem-estar": ["spa", "day spa", "massagem", "bem estar"],
  "sobrancelhas-design": ["sobrancelha", "design de sobrancelhas", "brow"],
  "maquiagem-profissional": ["maquiagem", "make", "maquiador"],
  "bronzeamento": ["bronze", "bronzeamento artificial"],
  "estetica-intima": ["estetica intima", "clareamento intimo"],
  "massagem-terapeutica": ["massagem", "massoterapeuta", "quiropraxia"],

  // Saúde
  "clinicas-medicas": [
    "clinica medica",
    "clinica geral",
    "consultorio medico",
    "medicina",
  ],
  ortopedia: ["ortopedista", "traumatologia", "osso"],
  dermatologia: ["dermatologista", "pele"],
  odontologia: ["dentista", "odontologo", "clinica odontologica", "ortodontia"],
  oftalmologia: ["oftalmologista", "oculista", "olho"],
  fisioterapia: ["fisioterapeuta", "fisio", "reabilitacao"],
  nutricao: ["nutricionista", "nutri"],
  psicologia: ["psicologo", "terapia", "psicoterapia"],
  tricologia: ["tricologista", "queda de cabelo", "capilar"],
  "medicina-integrativa": ["integrativa", "holistica", "medicina funcional"],
  cardiologia: ["cardiologista", "coracao"],
  ginecologia: ["ginecologista", "obstetricia"],
  pediatria: ["pediatra", "crianca"],
  psiquiatria: ["psiquiatra", "saude mental"],
  fonoaudiologia: ["fono", "fonoaudiologo"],
  enfermagem: ["enfermeiro", "tecnico de enfermagem"],
  "laboratorios-analises": ["laboratorio", "exames", "analises clinicas"],
  "clinicas-vacina": ["vacina", "imunizacao", "vacinacao"],
  "home-care": ["homecare", "atendimento domiciliar", "home care"],

  // Pet
  "clinicas-veterinarias": ["veterinario", "vet", "clinica vet"],
  "pet-shops": ["petshop", "pet shop", "loja pet"],
  "banho-e-tosa": ["banho e tosa", "tosa", "pet spa"],
  "hotelaria-animal": ["hotel pet", "creche pet", "pet hotel"],
  adestramento: ["adestrador", "treino canino"],
  "pet-food-racao": ["racao", "pet food", "alimento pet"],
  "cremacao-pet": ["cremacao", "funeraria pet"],
  "fisioterapia-animal": ["fisio pet", "reabilitacao animal"],
  "pet-taxi": ["pet taxi", "transporte pet"],

  // Automotivo
  concessionarias: ["concessionaria", "revenda de carros novos"],
  seminovos: ["seminovos", "carros usados", "usados"],
  "oficinas-mecanicas": ["oficina", "mecanica", "mecanico"],
  "funilaria-pintura": ["funilaria", "lanternagem", "pintura automotiva"],
  "som-acessorios": ["som automotivo", "acessorios automotivos"],
  "estetica-automotiva": ["detailing", "polimento", "estetica automotiva"],
  borracharia: ["borracharia", "pneu", "pneus", "camara de ar"],
  autoeletrica: ["auto eletrica", "eletricista automotivo"],
  autopecas: ["autopecas", "pecas de carro", "pecas automotivas"],
  "lavagem-rapida": ["lava rapido", "lavagem de carro"],
  blindagem: ["blindagem", "carro blindado"],
  "oficinas-motos": ["oficina de moto", "motopecas", "motocicleta"],
  guincho: ["guincho", "reboque", "guincho 24h"],
  "postos-combustivel": ["posto", "posto de gasolina", "posto de combustivel", "combustivel"],

  // Imobiliário
  imobiliarias: ["imobiliaria", "imoveis", "corretor de imoveis", "corretora", "corretoras"],
  "incorporadoras-varejo": ["incorporadora", "incorporacao", "incorporadora de obras"],
  "administradoras-condominio": ["administradora de condominio", "condominio"],
  "avaliacao-pericia": ["avaliacao de imoveis", "pericia imobiliaria"],
  "locacao-residencial": ["aluguel", "locacao", "aluguel residencial"],
  "locacao-comercial": ["ponto comercial", "aluguel comercial"],
  "home-staging": ["home staging", "preparacao de imovel"],
  "sindicos-profissionais": ["sindico", "sindico profissional"],
  "leiloes-imoveis": ["leilao", "leilao de imoveis"],

  // Varejo
  "moda-vestuario": ["roupa", "loja de roupa", "moda", "vestuario"],
  calcados: ["calcado", "sapataria", "tenis"],
  oticas: ["otica", "oculos", "lentes"],
  joalherias: ["joalheria", "joias", "relojoaria"],
  "moveis-decoracao": ["moveis", "decoracao", "mobiliario"],
  eletrodomesticos: ["eletrodomestico", "eletro", "loja de eletro"],
  "artigos-esportivos": ["esporte", "loja esportiva", "artigos esportivos"],
  "perfumaria-cosmeticos": ["perfumaria", "cosmeticos", "beleza varejo"],
  "informatica-celulares": ["informatica", "celular", "smartphone", "assistencia celular", "loja de celular"],
  papelaria: ["papelaria", "material escolar"],
  brinquedos: ["brinquedo", "loja de brinquedos"],
  "casa-jardim": ["jardinagem", "floricultura", "plantas", "flores"],
  colchoes: ["colchao", "colchoaria"],
  "utensilios-domesticos": ["cama mesa banho", "utensilios", "armarinho"],
  "farmacias-drogarias": ["farmacia", "farmacias", "drogaria", "drogarias", "drugstore"],
  supermercados: ["supermercado", "supermercados", "hipermercado", "mercado", "mercearia"],

  // Alimentação
  restaurantes: ["restaurante", "comida"],
  pizzarias: ["pizzaria", "pizza"],
  hamburguerias: ["hamburgueria", "burger", "hamburguer"],
  buffets: ["buffet", "bufe", "festas"],
  lanchonetes: ["lanchonete", "lanche", "fast food"],
  bares: ["bar", "boteco", "pub"],
  cafeterias: ["cafeteria", "cafe", "coffee shop"],
  "sorveterias-acai": ["sorveteria", "acai", "gelateria"],
  padarias: ["padaria", "confeitaria", "panificadora", "panificadoras"],
  "food-trucks": ["food truck", "trailer de comida"],
  "dark-kitchen": ["dark kitchen", "cozinha fantasma", "delivery only"],
  churrascarias: ["churrascaria", "churrasco"],

  // Educação
  "escolas-particulares": ["escola particular", "colegio"],
  "cursos-livres": ["curso livre", "curso profissionalizante"],
  idiomas: ["escola de idiomas", "ingles", "curso de ingles"],
  "pre-vestibular": ["cursinho", "pre vestibular", "enem"],
  autoescolas: ["autoescola", "cnh", "habilitacao"],
  "ensino-infantil": ["creche", "pre escola", "educacao infantil"],
  "reforco-escolar": ["reforco", "aula particular", "reforco escolar"],
  "musica-artes": ["aula de musica", "escola de musica", "artes"],
  "concursos-publicos": ["concurso", "concurso publico"],
  "ead-cursos-online": ["ead", "curso online", "ensino a distancia"],
  "coaching-educacional": ["coaching", "mentor educacional"],

  // Turismo
  hoteis: ["hotel", "hospedagem"],
  pousadas: ["pousada", "hostel pequeno"],
  "agencias-viagem": ["agencia de viagem", "turismo"],
  "receptivos-turismo": ["receptivo", "turismo receptivo"],
  "locadoras-turismo": ["locadora", "aluguel de carro", "locadora de veiculos", "rent a car"],
  resorts: ["resort", "all inclusive"],
  hostels: ["hostel", "albergue"],
  "turismo-aventura": ["turismo de aventura", "radical", "rafting"],
  "guias-locais": ["guia de turismo", "guia local"],
  "eventos-turismo": ["destino de casamento", "wedding destination", "evento turistico"],

  // Indústria
  metalurgia: ["metalurgica", "fundicao", "forjaria"],
  "quimica-industrial": ["industria quimica", "quimica"],
  "plasticos-industrial": ["plastico", "industria de plastico", "injecao plastica"],
  "alimentos-industrializados": [
    "industria alimenticia",
    "alimentos industrializados",
    "produtos alimenticios",
  ],
  "textil-industrial": ["textil", "tecelagem", "confeccao industrial"],
  "embalagens-industrial": ["embalagem", "industria de embalagens", "packaging", "fabrica de embalagens"],
  "moveleira-industrial": ["industria moveleira", "fabrica de moveis"],
  siderurgia: ["siderurgica", "aco", "ferro gusa"],
  "borracha-industrial": ["borracha", "artefatos de borracha"],
  "papel-celulose": ["celulose", "papel", "industria de papel"],
  farmaceutica: ["farmaceutica", "laboratorio farmaceutico", "medicamentos"],
  "bebidas-industrial": [
    "bebidas",
    "industria de bebidas",
    "fabrica de bebidas",
  ],
  "aguas-envasadas": [
    "agua",
    "aguas",
    "agua mineral",
    "aguas envasadas",
    "envasadora de agua",
    "envasadoras de agua",
    "engarrafadora de agua",
    "agua envasada",
    "industria de agua",
  ],
  cervejarias: ["cervejaria", "cerveja", "craft beer", "cervejas"],
  "refrigerantes-sucos": [
    "refrigerante",
    "refrigerantes",
    "suco",
    "sucos",
    "refresco",
    "energetico",
  ],
  "autopecas-industrial": ["autopecas industria", "pecas automotivas fabricacao", "oem", "fabricacao de autopecas"],
  "mineracao-beneficiamento": ["mineracao", "mineradora", "beneficiamento"],
  "envasamento-empacotamento": [
    "co packing",
    "copacking",
    "empacotamento sob contrato",
    "envase sob contrato",
    "terceirizacao de envase",
    "envasamento sob contrato",
  ],

  // Construção
  "construtoras-reformas": ["construtora", "construcao", "reforma", "incorporadora de obras"],
  empreiteiras: ["empreiteira", "empreiteiro"],
  "engenharia-projetos": ["engenharia", "escritorio de engenharia", "projetos de engenharia"],
  "arquitetura-projetos": ["arquitetura", "arquiteto", "escritorio de arquitetura"],
  "reformas-residenciais": ["reforma residencial", "reforma de casa"],
  "obras-industriais": ["galpao", "obra industrial"],
  terraplanagem: ["terraplanagem", "movimento de terra"],
  pavimentacao: ["pavimentacao", "asfalto", "asfaltamento"],
  fundacoes: ["fundacao", "estaca", "contencao"],
  "instalacoes-hidraulicas": ["hidraulica", "encanador", "instalacao hidraulica"],
  "instalacoes-eletricas": ["eletrica predial", "eletricista", "instalacao eletrica"],
  "impermeabilizacao-vazamentos": [
    "impermeabilizacao",
    "vazamento",
    "vazamentos",
    "infiltracao",
  ],
  "pintura-predial": ["pintura predial", "pintor"],
  "gesso-drywall": ["gesso", "drywall", "forro de gesso"],
  climatizacao: ["ar condicionado", "climatizacao", "hvac"],
  topografia: ["topografia", "topografo", "geotecnia"],
  paisagismo: ["paisagismo", "paisagista", "jardim"],
  "design-interiores": ["design de interiores", "decorador", "interior design"],
  "laudos-pericias-engenharia": ["laudo de engenharia", "pericia de engenharia"],
  "calculo-estrutural": ["calculo estrutural", "projeto estrutural", "estruturas"],

  // Insumos
  marmorarias: ["marmoraria", "marmore", "granito"],
  vidracarias: ["vidracaria", "vidro temperado"],
  esquadrias: ["esquadria", "aluminio", "janela de aluminio"],
  "depositos-material-construcao": [
    "deposito de materiais",
    "material de construcao",
    "loja de materiais",
  ],
  serralherias: ["serralheria", "serralheiro", "estrutura metalica"],
  "acabamentos-revestimentos": ["acabamento", "revestimento", "revestimentos"],
  "pre-moldados-concreto": ["pre moldado", "premoldado", "concreto", "artefato de concreto"],
  "blocos-tijolos": ["bloco", "blocos", "tijolo", "tijolos", "bloco de concreto"],
  "ceramica-argila-telhas": ["ceramica", "argila", "telha ceramica", "olaria"],
  "cimento-agregados": ["cimento", "agregado"],
  "areia-brita": ["areia", "brita", "pedreira"],
  "tintas-vernizes": ["tinta", "verniz", "loja de tinta"],
  "pisos-porcelanatos": ["piso", "porcelanato", "ceramica de piso"],
  "loucas-metais-sanitarios": ["louca sanitaria", "metais sanitarios", "torneira"],
  "madeira-compensados": ["madeira", "compensado", "madeireira"],
  "telhas-coberturas": ["telha", "cobertura", "telhado"],
  "argamassas-rejunte": ["argamassa", "rejunte"],
  "drywall-placas": ["placa de gesso", "drywall"],
  "portas-portoes": ["porta", "portao", "portoes"],
  "ferragens-parafusos": ["ferragens", "parafuso", "loja de ferragens"],
  "isolamento-termico": ["isolamento", "isolamento termico", "isolamento acustico"],
  "epis-obra": ["epi", "epis", "equipamento de protecao", "capacete de obra", "seguranca do trabalho"],

  // Contabilidade / jurídico
  "escritorios-contabeis": ["contabilidade", "contador", "escritorio contabil"],
  advocacia: ["advogado", "escritorio de advocacia", "juridico"],
  "consultoria-empresarial": ["consultoria", "consultor empresarial"],
  cartorios: ["cartorio", "tabelionato", "tabeliao"],
  "dp-folha": ["dp", "folha de pagamento", "departamento pessoal"],
  "compliance-lgpd": ["compliance", "lgpd", "privacidade"],
  "mediacao-arbitragem": ["mediacao", "arbitragem"],

  // Tech
  "desenvolvimento-sob-encomenda": ["software house", "desenvolvimento de software"],
  "saas-plataformas": ["saas", "software as a service", "plataforma"],
  "ti-suporte": ["ti", "suporte de ti", "help desk", "msp"],
  "hospedagem-dados": ["hospedagem", "datacenter", "cloud hosting"],
  "apps-mobile": ["app", "aplicativo", "mobile"],
  "ecommerce-plataformas": ["ecommerce", "e-commerce", "loja virtual"],
  ciberseguranca: ["ciberseguranca", "seguranca da informacao", "cybersecurity"],
  "automacao-rpa": ["rpa", "automacao", "automacao de processos"],

  // Marketing
  "marketing-e-publicidade": ["marketing", "publicidade", "agencia"],
  "marketing-digital": ["marketing digital", "trafego pago", "performance", "agencia digital", "agencia de publicidade"],

  // Logística
  "transportadoras-carga": ["transportadora", "frete", "carga"],
  armazenagem: ["armazem", "armazenagem", "galpao logistico"],
  "last-mile-entregas": ["last mile", "entrega rapida", "courier"],
  "frota-locacao-comercial": ["locacao de frota", "frota", "locacao b2b", "frota b2b"],
  "cross-docking": ["cross docking", "crossdocking"],
  mudancas: ["mudanca", "empresa de mudancas"],
  "courier-motoboy": ["motoboy", "motofrete", "courier"],
  "logistica-reversa": ["logistica reversa", "reciclagem logistica", "coleta de residuos"],

  // Atacado
  "atacado-e-distribuicao": ["atacado", "distribuicao", "distribuidora"],
  "distribuidoras-atacado": ["distribuidora", "atacado", "atacadista"],

  // Financeiro
  "corretoras-seguros": ["corretora de seguros", "seguro"],
  "assessorias-investimento": ["assessoria de investimentos", "aai", "investimentos"],
  "credito-fomento": ["credito", "fomento", "financiamento"],
  factoring: ["factoring", "fomento mercantil"],
  consorcios: ["consorcio", "administradora de consorcio"],
  "previdencia-planos": ["previdencia", "plano de previdencia"],
  cambio: ["cambio", "corretora de cambio"],
  "fintech-pagamentos": ["fintech", "meios de pagamento", "gateway de pagamento"],
  "cobranca-extrajudicial": ["cobranca", "cobranca extrajudicial", "recuperacao de credito", "assessoria de cobranca"],

  // Pais (busca pelo nicho amplo)
  "estetica-e-beleza": ["estetica", "beleza"],
  "saude-e-clinicas": ["saude", "clinica medica"],
  pet: ["pet", "pets"],
  automotivo: ["automotivo", "auto"],
  imobiliario: ["imobiliario", "imoveis"],
  varejo: ["varejo", "loja"],
  "alimentacao-fora-do-lar": ["alimentacao", "food service"],
  educacao: ["educacao", "ensino"],
  "turismo-e-hotelaria": ["turismo", "hotelaria"],
  "esporte-e-fitness": ["esporte", "fitness", "academia"],
  academias: ["academia", "academias", "gym", "musculacao", "crossfit", "box de crossfit"],
  "servicos-locais": ["servicos locais", "servico local"],
  lavanderias: ["lavanderia", "lavanderias", "lavandaria", "tinturaria"],
  industria: ["industria", "fabrica"],
  "construcao-civil": ["construcao civil", "construcao"],
  "insumos-para-construcao": ["insumos", "material de construcao"],
  "contabilidade-e-juridico": ["contabilidade e juridico"],
  "tech-e-software": ["tech", "software"],
  "logistica-e-transporte": ["logistica", "transporte"],
  "financeiro-e-seguros": ["financeiro", "seguros"],
};

export function aliasesForSlug(slug: string): string[] {
  return SEGMENT_ALIASES[slug] ?? [];
}

export type SearchablePreset = {
  nome: string;
  slug?: string;
  aliases?: string[];
  keywords?: string[];
  parentNome?: string;
};

const QUERY_STOPWORDS = new Set([
  "a",
  "as",
  "o",
  "os",
  "um",
  "uma",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "em",
  "no",
  "na",
  "nos",
  "nas",
  "para",
  "com",
  "ou",
  "por",
]);

/** Ignore reverse alias hits like "barbearia" matching alias "bar". */
const REVERSE_ALIAS_MIN = 4;

function resolvedAliases(preset: SearchablePreset): string[] {
  return [
    ...(preset.aliases ?? []),
    ...(preset.slug ? aliasesForSlug(preset.slug) : []),
  ];
}

function fieldHitsQuery(field: string, q: string): boolean {
  const n = normalizeText(field);
  if (!n) return false;
  if (n.includes(q)) return true;
  return q.includes(n) && n.length >= REVERSE_ALIAS_MIN;
}

/** Accent-folded tokens, stopwords dropped. Min length 3 except when the whole query is short. */
export function queryTokens(rawQuery: string): string[] {
  const q = normalizeText(rawQuery);
  if (q.length < 2) return [];
  const parts = q
    .split(/[^a-z0-9]+/g)
    .filter((t) => t.length >= 3 && !QUERY_STOPWORDS.has(t));
  if (parts.length) return [...new Set(parts)];
  return [q];
}

export function searchableDocument(preset: SearchablePreset): string {
  return [
    preset.nome,
    preset.parentNome ?? "",
    ...resolvedAliases(preset),
    ...(preset.keywords ?? []),
  ]
    .map(normalizeText)
    .filter(Boolean)
    .join(" ");
}

/** True when every query token appears in the text (or the whole phrase is a substring). */
export function textMatchesQuery(text: string, rawQuery: string): boolean {
  const q = normalizeText(rawQuery);
  if (q.length < 2) return false;
  const doc = normalizeText(text);
  if (doc.includes(q)) return true;
  const tokens = queryTokens(rawQuery);
  if (!tokens.length) return false;
  return tokens.every((t) => doc.includes(t));
}

export function cnaeMatchesQuery(
  codigo: string,
  descricao: string,
  rawQuery: string,
): boolean {
  const q = normalizeText(rawQuery);
  if (q.length < 2) return false;
  const digits = rawQuery.replace(/\D/g, "");
  if (digits.length >= 2 && codigo.includes(digits)) return true;
  return textMatchesQuery(descricao, rawQuery);
}

export function rankTextMatch(text: string, rawQuery: string): number {
  const q = normalizeText(rawQuery);
  if (!q) return 0;
  const d = normalizeText(text);
  if (d === q) return 100;
  if (d.startsWith(q)) return 90;
  if (d.includes(q)) return 80;
  if (textMatchesQuery(text, rawQuery)) return 55;
  return 0;
}

/** True when query matches display name, commercial aliases, or CNAE keywords. */
export function presetMatchesQuery(
  preset: SearchablePreset,
  rawQuery: string,
): boolean {
  const q = normalizeText(rawQuery);
  if (q.length < 2) return false;
  if (normalizeText(preset.nome).includes(q)) return true;
  if (preset.parentNome && normalizeText(preset.parentNome).includes(q)) return true;
  if (resolvedAliases(preset).some((a) => fieldHitsQuery(a, q))) return true;
  if ((preset.keywords ?? []).some((k) => fieldHitsQuery(k, q))) return true;
  const tokens = queryTokens(rawQuery);
  if (!tokens.length) return false;
  const doc = searchableDocument(preset);
  return tokens.every((t) => doc.includes(t));
}

export function rankPresetMatch(preset: SearchablePreset, rawQuery: string): number {
  const q = normalizeText(rawQuery);
  if (!q) return 0;
  const nome = normalizeText(preset.nome);
  const aliases = resolvedAliases(preset).map(normalizeText);
  if (nome === q) return 100;
  if (aliases.some((a) => a === q)) return 95;
  if (nome.startsWith(q)) return 90;
  if (aliases.some((a) => a.startsWith(q) || (q.startsWith(a) && a.length >= REVERSE_ALIAS_MIN))) {
    return 85;
  }
  if (nome.includes(q)) return 80;
  if (preset.parentNome && normalizeText(preset.parentNome).includes(q)) return 75;
  if (aliases.some((a) => a.includes(q) || (q.includes(a) && a.length >= REVERSE_ALIAS_MIN))) {
    return 70;
  }
  const tokens = queryTokens(rawQuery);
  const doc = searchableDocument(preset);
  if (tokens.length && tokens.every((t) => doc.includes(t))) return 55;
  if ((preset.keywords ?? []).some((k) => normalizeText(k).includes(q))) return 40;
  return 0;
}
