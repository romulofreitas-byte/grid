import type { NichePreset, NichePresetCnae, RefCnae } from "@/lib/types";

export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

export function resolveCnaesFromKeywords(
  keywords: string[],
  exclusoes: string[],
  refCnaes: RefCnae[],
): RefCnae[] {
  const kws = keywords.map(normalizeText).filter(Boolean);
  const exs = exclusoes.map(normalizeText).filter(Boolean);

  return refCnaes.filter((c) => {
    const desc = normalizeText(c.descricao);
    const hit = kws.some((k) => desc.includes(k));
    if (!hit) return false;
    if (exs.some((e) => desc.includes(e))) return false;
    return true;
  });
}

/** Merge typeahead CNAEs with segment/intent scope without breaking refine. */
export function combineActivityCnaes(
  explicit: string[],
  scoped: Set<string> | null,
): Set<string> | null {
  const picked = [...new Set(explicit.map((c) => c.trim()).filter(Boolean))];
  if (!picked.length) return scoped;
  if (!scoped || scoped.has("__none__")) return new Set(picked);

  const extras = picked.filter((c) => !scoped.has(c));
  const fromScope = picked.filter((c) => scoped.has(c));
  if (extras.length && fromScope.length) {
    return new Set([...fromScope, ...extras]);
  }
  if (extras.length) return new Set([...scoped, ...extras]);
  if (fromScope.length) return new Set(fromScope);
  return scoped;
}

export function resolvePresetCnaes(
  preset: NichePreset,
  curated: NichePresetCnae[],
  refCnaes: RefCnae[],
): string[] {
  if (preset.curado) {
    const included = curated
      .filter((c) => c.preset_id === preset.id && c.incluido)
      .map((c) => c.cnae);
    if (included.length) return included;
  }
  return resolveCnaesFromKeywords(
    preset.keywords,
    preset.exclusoes,
    refCnaes,
  ).map((c) => c.codigo);
}

export type NicheSeedNode = {
  slug: string;
  nome: string;
  grupo: "b2c_local" | "b2b_industria";
  perfil_score: "b2c_local" | "b2b_industria";
  keywords: string[];
  exclusoes: string[];
  name_stems: string[];
  ordem: number;
  segments: Array<{
    slug: string;
    nome: string;
    keywords: string[];
    exclusoes: string[];
    name_stems: string[];
    ordem: number;
  }>;
};

export type NichePresetSeed = Omit<NichePreset, "id" | "curado" | "parent_id"> & {
  parent_slug: string | null;
};

export const TAXONOMY: NicheSeedNode[] = [
  {
    slug: "estetica-e-beleza", nome: "Estética e beleza", grupo: "b2c_local", perfil_score: "b2c_local",
    keywords: ["estetica e outros servicos de cuidados com a beleza", "cabeleireiros", "manicure e pedicure"],
    exclusoes: [], name_stems: ["ESTETICA", "BELEZA"], ordem: 1,
    segments: [
      { slug: "clinicas-estetica", nome: "Clínicas de estética", keywords: ["estetica e outros servicos de cuidados com a beleza"], exclusoes: [], name_stems: ["ESTETICA", "DERMA"], ordem: 1 },
      { slug: "harmonizacao-facial", nome: "Harmonização facial", keywords: ["estetica e outros servicos de cuidados com a beleza"], exclusoes: [], name_stems: ["HARMON", "FACIAL"], ordem: 2 },
      { slug: "depilacao-laser", nome: "Depilação a laser", keywords: ["estetica e outros servicos de cuidados com a beleza"], exclusoes: [], name_stems: ["LASER", "DEPIL"], ordem: 3 },
      { slug: "saloes-premium", nome: "Salões premium", keywords: ["cabeleireiros"], exclusoes: [], name_stems: ["SALAO", "HAIR"], ordem: 4 },
      { slug: "micropigmentacao", nome: "Micropigmentação", keywords: ["estetica e outros servicos de cuidados com a beleza"], exclusoes: [], name_stems: ["MICRO", "PIGMENT"], ordem: 5 },
      { slug: "manicure-podologia", nome: "Manicure e podologia", keywords: ["cabeleireiros, manicure e pedicure", "atividades de podologia"], exclusoes: [], name_stems: ["NAILS", "PODO"], ordem: 6 },
      { slug: "spa-bem-estar", nome: "Spa e bem-estar", keywords: ["atividades de sauna e banhos", "estetica e outros servicos de cuidados com a beleza"], exclusoes: [], name_stems: ["SPA", "WELL"], ordem: 7 },
    ],
  },
  {
    slug: "saude-e-clinicas", nome: "Saúde e clínicas", grupo: "b2c_local", perfil_score: "b2c_local",
    keywords: ["atividade medica ambulatorial", "atividade odontologica", "atividades de fisioterapia"],
    exclusoes: [], name_stems: ["CLINICA", "SAUDE"], ordem: 2,
    segments: [
      { slug: "ortopedia", nome: "Ortopedia", keywords: ["atividade medica ambulatorial"], exclusoes: [], name_stems: ["ORTO", "OSSO"], ordem: 1 },
      { slug: "dermatologia", nome: "Dermatologia", keywords: ["atividade medica ambulatorial"], exclusoes: [], name_stems: ["DERMA", "PELE"], ordem: 2 },
      { slug: "odontologia", nome: "Odontologia", keywords: ["atividade odontologica"], exclusoes: [], name_stems: ["ODONTO", "DENTAL"], ordem: 3 },
      { slug: "oftalmologia", nome: "Oftalmologia", keywords: ["atividade medica ambulatorial"], exclusoes: [], name_stems: ["OFTALMO", "VISAO"], ordem: 4 },
      { slug: "fisioterapia", nome: "Fisioterapia", keywords: ["atividades de fisioterapia"], exclusoes: [], name_stems: ["FISIO", "REAB"], ordem: 5 },
      { slug: "nutricao", nome: "Nutrição", keywords: ["atividades de profissionais da nutricao"], exclusoes: [], name_stems: ["NUTRI", "DIET"], ordem: 6 },
      { slug: "psicologia", nome: "Psicologia", keywords: ["atividades de psicologia e psicanalise"], exclusoes: [], name_stems: ["PSICO", "MENTE"], ordem: 7 },
      { slug: "tricologia", nome: "Tricologia", keywords: ["atividade medica ambulatorial", "estetica e outros servicos de cuidados com a beleza"], exclusoes: [], name_stems: ["TRICO", "CAPIL"], ordem: 8 },
      { slug: "medicina-integrativa", nome: "Medicina integrativa", keywords: ["atividade medica ambulatorial"], exclusoes: [], name_stems: ["INTEGRA", "VITA"], ordem: 9 },
    ],
  },
  {
    slug: "pet", nome: "Pet", grupo: "b2c_local", perfil_score: "b2c_local",
    keywords: ["atividades veterinarias", "artigos para animais de estimacao", "higiene e embelezamento de animais"],
    exclusoes: [], name_stems: ["PET", "VET"], ordem: 3,
    segments: [
      { slug: "clinicas-veterinarias", nome: "Clínicas veterinárias", keywords: ["atividades veterinarias"], exclusoes: [], name_stems: ["VET", "PETCARE"], ordem: 1 },
      { slug: "pet-shops", nome: "Pet shops", keywords: ["artigos para animais de estimacao", "animais vivos"], exclusoes: [], name_stems: ["PETSHOP", "PET"], ordem: 2 },
      { slug: "banho-e-tosa", nome: "Banho e tosa", keywords: ["higiene e embelezamento de animais"], exclusoes: [], name_stems: ["TOSA", "PETSPA"], ordem: 3 },
      { slug: "hotelaria-animal", nome: "Hotelaria animal", keywords: ["atividades veterinarias", "higiene e embelezamento de animais"], exclusoes: [], name_stems: ["PET HOTEL", "HOSPET"], ordem: 4 },
      { slug: "adestramento", nome: "Adestramento", keywords: ["atividades veterinarias"], exclusoes: [], name_stems: ["ADESTRA", "CANINO"], ordem: 5 },
    ],
  },
  {
    slug: "automotivo", nome: "Automotivo", grupo: "b2c_local", perfil_score: "b2c_local",
    keywords: ["veiculos automotores", "motocicletas", "manutencao e reparacao mecanica de veiculos"],
    exclusoes: [], name_stems: ["AUTO", "MOTOR"], ordem: 4,
    segments: [
      { slug: "concessionarias", nome: "Concessionárias", keywords: ["automoveis, camionetas e utilitarios novos"], exclusoes: [], name_stems: ["MOTORS", "AUTO"], ordem: 1 },
      { slug: "seminovos", nome: "Seminovos", keywords: ["automoveis, camionetas e utilitarios usados"], exclusoes: [], name_stems: ["SEMI", "USADOS"], ordem: 2 },
      { slug: "oficinas-mecanicas", nome: "Oficinas mecânicas", keywords: ["manutencao e reparacao mecanica de veiculos automotores"], exclusoes: [], name_stems: ["OFICINA", "MECAN"], ordem: 3 },
      { slug: "funilaria-pintura", nome: "Funilaria e pintura", keywords: ["lanternagem ou funilaria e pintura de veiculos automotores"], exclusoes: [], name_stems: ["FUNIL", "PINT"], ordem: 4 },
      { slug: "som-acessorios", nome: "Som e acessórios", keywords: ["pecas e acessorios novos para veiculos automotores", "pecas e acessorios para motocicletas"], exclusoes: [], name_stems: ["SOM", "ACESS"], ordem: 5 },
      { slug: "estetica-automotiva", nome: "Estética automotiva", keywords: ["lavagem, lubrificacao e polimento de veiculos automotores"], exclusoes: [], name_stems: ["DETAIL", "POLISH"], ordem: 6 },
    ],
  },
  {
    slug: "imobiliario", nome: "Imobiliário", grupo: "b2c_local", perfil_score: "b2c_local",
    keywords: ["corretagem na compra e venda", "incorporacao de empreendimentos imobiliarios", "administracao da propriedade imobiliaria"],
    exclusoes: [], name_stems: ["IMOB", "IMOVEIS"], ordem: 5,
    segments: [
      { slug: "imobiliarias", nome: "Imobiliárias", keywords: ["corretagem na compra e venda e avaliacao de imoveis"], exclusoes: [], name_stems: ["IMOB", "REALTY"], ordem: 1 },
      { slug: "corretoras-imoveis", nome: "Corretoras de imóveis", keywords: ["corretagem na compra e venda e avaliacao de imoveis"], exclusoes: [], name_stems: ["CORRET", "BROKER"], ordem: 2 },
      { slug: "incorporadoras-varejo", nome: "Incorporadoras (varejo)", keywords: ["incorporacao de empreendimentos imobiliarios"], exclusoes: [], name_stems: ["INCORP", "URBAN"], ordem: 3 },
      { slug: "administradoras-condominio", nome: "Administradoras de condomínio", keywords: ["gestao e administracao da propriedade imobiliaria"], exclusoes: [], name_stems: ["CONDOM", "ADMIN"], ordem: 4 },
      { slug: "avaliacao-pericia", nome: "Avaliação e perícia", keywords: ["corretagem na compra e venda e avaliacao de imoveis"], exclusoes: [], name_stems: ["AVALIA", "LAUDO"], ordem: 5 },
    ],
  },
  {
    slug: "varejo", nome: "Varejo", grupo: "b2c_local", perfil_score: "b2c_local",
    keywords: ["comercio varejista de artigos do vestuario", "comercio varejista de calcados", "comercio varejista de artigos de optica"],
    exclusoes: [], name_stems: ["VAREJO", "LOJA"], ordem: 6,
    segments: [
      { slug: "moda-vestuario", nome: "Moda e vestuário", keywords: ["comercio varejista de artigos do vestuario"], exclusoes: [], name_stems: ["MODA", "FASHION"], ordem: 1 },
      { slug: "calcados", nome: "Calçados", keywords: ["comercio varejista de calcados"], exclusoes: [], name_stems: ["CALCADO", "SHOES"], ordem: 2 },
      { slug: "oticas", nome: "Óticas", keywords: ["comercio varejista de artigos de optica"], exclusoes: [], name_stems: ["OPTICA", "VISUAL"], ordem: 3 },
      { slug: "joalherias", nome: "Joalherias", keywords: ["comercio varejista de artigos de joalheria", "relojoaria"], exclusoes: [], name_stems: ["JOIA", "GOLD"], ordem: 4 },
      { slug: "moveis-decoracao", nome: "Móveis e decoração", keywords: ["comercio varejista de moveis", "comercio varejista de artigos de colchoaria"], exclusoes: [], name_stems: ["MOVEIS", "DECOR"], ordem: 5 },
      { slug: "eletrodomesticos", nome: "Eletrodomésticos", keywords: ["eletrodomesticos e equipamentos de audio e video"], exclusoes: [], name_stems: ["ELETRO", "HOME"], ordem: 6 },
      { slug: "artigos-esportivos", nome: "Artigos esportivos", keywords: ["comercio varejista de artigos esportivos"], exclusoes: [], name_stems: ["SPORT", "FIT"], ordem: 7 },
      { slug: "perfumaria-cosmeticos", nome: "Perfumaria e cosméticos", keywords: ["comercio varejista de cosmeticos, produtos de perfumaria e de higiene pessoal"], exclusoes: [], name_stems: ["PERFUM", "COSM"], ordem: 8 },
    ],
  },
  {
    slug: "alimentacao-fora-do-lar", nome: "Alimentação fora do lar", grupo: "b2c_local", perfil_score: "b2c_local",
    keywords: ["restaurantes e similares", "lanchonetes, casas de cha", "bares e outros estabelecimentos especializados em servir bebidas"],
    exclusoes: [], name_stems: ["FOOD", "GOURMET"], ordem: 7,
    segments: [
      { slug: "restaurantes", nome: "Restaurantes", keywords: ["restaurantes e similares"], exclusoes: ["lanchonetes"], name_stems: ["REST", "CHEF"], ordem: 1 },
      { slug: "pizzarias", nome: "Pizzarias", keywords: ["restaurantes e similares"], exclusoes: ["lanchonetes"], name_stems: ["PIZZA", "FORNO"], ordem: 2 },
      { slug: "hamburguerias", nome: "Hamburguerias", keywords: ["lanchonetes, casas de cha, de sucos e similares", "restaurantes e similares"], exclusoes: [], name_stems: ["BURGER", "GRILL"], ordem: 3 },
      { slug: "buffets", nome: "Buffets", keywords: ["servicos de alimentacao para eventos e recepcoes - bufe"], exclusoes: [], name_stems: ["BUFFET", "EVENT"], ordem: 4 },
      { slug: "lanchonetes", nome: "Lanchonetes", keywords: ["lanchonetes, casas de cha, de sucos e similares"], exclusoes: [], name_stems: ["LANCH", "SNACK"], ordem: 5 },
      { slug: "bares", nome: "Bares", keywords: ["bares e outros estabelecimentos especializados em servir bebidas"], exclusoes: [], name_stems: ["BAR", "DRINK"], ordem: 6 },
    ],
  },
  {
    slug: "educacao", nome: "Educação", grupo: "b2c_local", perfil_score: "b2c_local",
    keywords: ["ensino fundamental", "ensino medio", "ensino de idiomas", "formacao de condutores"],
    exclusoes: [], name_stems: ["EDU", "ESCOLA"], ordem: 8,
    segments: [
      { slug: "escolas-particulares", nome: "Escolas particulares", keywords: ["ensino fundamental", "ensino medio"], exclusoes: [], name_stems: ["COLEGIO", "ESCOLA"], ordem: 1 },
      { slug: "cursos-livres", nome: "Cursos livres", keywords: ["treinamento em desenvolvimento profissional e gerencial", "educacao profissional de nivel tecnico"], exclusoes: [], name_stems: ["CURSO", "TRAIN"], ordem: 2 },
      { slug: "idiomas", nome: "Idiomas", keywords: ["ensino de idiomas"], exclusoes: [], name_stems: ["IDIOMA", "LANG"], ordem: 3 },
      { slug: "pre-vestibular", nome: "Pré-vestibular", keywords: ["cursos preparatorios para concursos"], exclusoes: [], name_stems: ["PREVEST", "CURSINHO"], ordem: 4 },
      { slug: "autoescolas", nome: "Autoescolas", keywords: ["formacao de condutores"], exclusoes: [], name_stems: ["AUTOESC", "CNH"], ordem: 5 },
    ],
  },
  {
    slug: "turismo-e-hotelaria", nome: "Turismo e hotelaria", grupo: "b2c_local", perfil_score: "b2c_local",
    keywords: ["hoteis", "agencias de viagens", "locacao de automoveis sem condutor"],
    exclusoes: [], name_stems: ["TURISMO", "HOTEL"], ordem: 9,
    segments: [
      { slug: "hoteis", nome: "Hotéis", keywords: ["hoteis"], exclusoes: ["apart-hoteis"], name_stems: ["HOTEL", "INN"], ordem: 1 },
      { slug: "pousadas", nome: "Pousadas", keywords: ["pensoes (alojamento)", "albergues", "apart-hoteis"], exclusoes: [], name_stems: ["POUSADA", "HOST"], ordem: 2 },
      { slug: "agencias-viagem", nome: "Agências de viagem", keywords: ["agencias de viagens", "operadores turisticos"], exclusoes: [], name_stems: ["VIAGEM", "TRAVEL"], ordem: 3 },
      { slug: "receptivos-turismo", nome: "Receptivos de turismo", keywords: ["servicos de reservas e outros servicos de turismo"], exclusoes: [], name_stems: ["RECEPT", "TOUR"], ordem: 4 },
      { slug: "locadoras-turismo", nome: "Locadoras turísticas", keywords: ["locacao de automoveis sem condutor"], exclusoes: [], name_stems: ["RENT", "LOCADORA"], ordem: 5 },
    ],
  },
  {
    slug: "industria", nome: "Indústria", grupo: "b2b_industria", perfil_score: "b2b_industria",
    keywords: ["fabricacao", "siderurgia", "metalurgia"],
    exclusoes: [], name_stems: ["INDUST", "FAB"], ordem: 10,
    segments: [
      { slug: "metalurgia", nome: "Metalurgia", keywords: ["metalurgia de metais nao-ferrosos", "fundicao", "forjaria, estamparia, metalurgia do po e servicos de tratamento termico"], exclusoes: [], name_stems: ["METAL MG", "METALURG", "ACO FORTE", "SIDERTEC", "FERROBRAS", "USIMEC", "FORJATEC", "LIGAMETAL"], ordem: 1 },
      { slug: "quimica-industrial", nome: "Química industrial", keywords: ["fabricacao de produtos quimicos"], exclusoes: [], name_stems: ["QUIMICA MINAS", "QUIMIBRAS", "POLIQUIM", "SINTESE QUIMICA", "NORTE QUIMICA", "OXICORP", "ALCHEM MG", "QUIMITEC", "BRASILQUIM", "VITALQUIM"], ordem: 2 },
      { slug: "plasticos-industrial", nome: "Plásticos industrial", keywords: ["fabricacao de artefatos de material plastico"], exclusoes: [], name_stems: ["PLASTEC", "POLIMER", "INJETPLAS", "BRASPLAST", "TERMOPLAS", "PLASNORTE", "MASTERPLAS"], ordem: 3 },
      { slug: "alimentos-industrializados", nome: "Alimentos industrializados", keywords: ["fabricacao de alimentos"], exclusoes: ["alimentos para animais"], name_stems: ["ALIM", "FOOD IND"], ordem: 4 },
      { slug: "textil-industrial", nome: "Têxtil industrial", keywords: ["fiacao", "tecelagem", "fabricacao de artefatos texteis"], exclusoes: [], name_stems: ["TEXTIL", "TECIDO"], ordem: 5 },
      { slug: "embalagens-industrial", nome: "Embalagens industrial", keywords: ["fabricacao de embalagens de material plastico", "fabricacao de embalagens de papelao"], exclusoes: [], name_stems: ["EMBAL", "PACK"], ordem: 6 },
      { slug: "moveleira-industrial", nome: "Moveleira industrial", keywords: ["fabricacao de moveis"], exclusoes: [], name_stems: ["MOVELEIR", "MOBILI"], ordem: 7 },
      { slug: "siderurgia", nome: "Siderurgia", keywords: ["producao de ferro-gusa", "laminados planos de aco", "laminados longos de aco"], exclusoes: [], name_stems: ["SIDER", "ACO"], ordem: 8 },
    ],
  },
  {
    slug: "construcao-civil", nome: "Construção civil", grupo: "b2b_industria", perfil_score: "b2b_industria",
    keywords: ["construcao de edificios", "obras de engenharia civil", "servicos de engenharia", "servicos de arquitetura"],
    exclusoes: [], name_stems: ["CONSTR", "OBRAS"], ordem: 11,
    segments: [
      { slug: "construtoras-reformas", nome: "Construtoras e reformas", keywords: ["construcao de edificios"], exclusoes: [], name_stems: ["CONSTR", "BUILD"], ordem: 1 },
      { slug: "incorporadoras-obras", nome: "Incorporadoras de obras", keywords: ["incorporacao de empreendimentos imobiliarios"], exclusoes: [], name_stems: ["INCORP", "URBAN"], ordem: 2 },
      { slug: "empreiteiras", nome: "Empreiteiras", keywords: ["obras de engenharia civil", "construcao de edificios"], exclusoes: [], name_stems: ["EMPREIT", "OBRAS"], ordem: 3 },
      { slug: "engenharia-projetos", nome: "Engenharia e projetos", keywords: ["servicos de engenharia"], exclusoes: [], name_stems: ["ENG", "PROJET"], ordem: 4 },
      { slug: "arquitetura-projetos", nome: "Arquitetura e projetos", keywords: ["servicos de arquitetura"], exclusoes: [], name_stems: ["ARQ", "DESIGN"], ordem: 5 },
    ],
  },
  {
    slug: "insumos-para-construcao", nome: "Insumos para construção", grupo: "b2b_industria", perfil_score: "b2b_industria",
    keywords: ["aparelhamento de placas", "comercio varejista de ferragens", "esquadrias"],
    exclusoes: [], name_stems: ["CONSTR", "MATERIAIS"], ordem: 12,
    segments: [
      { slug: "marmorarias", nome: "Marmorarias", keywords: ["trabalhos em marmore, granito", "aparelhamento de pedras para construcao"], exclusoes: [], name_stems: ["MARMOR", "GRANITO"], ordem: 1 },
      { slug: "vidracarias", nome: "Vidraçarias", keywords: ["comercio varejista de vidros", "servicos de instalacao de vidros"], exclusoes: [], name_stems: ["VIDRO", "GLASS"], ordem: 2 },
      { slug: "esquadrias", nome: "Esquadrias", keywords: ["fabricacao de esquadrias de metal", "fabricacao de esquadrias de madeira"], exclusoes: [], name_stems: ["ESQUAD", "ALUMIN"], ordem: 3 },
      { slug: "depositos-material-construcao", nome: "Depósitos de material de construção", keywords: ["materiais de construcao em geral", "materiais de construcao nao especificados", "comercio varejista de ferragens e ferramentas"], exclusoes: [], name_stems: ["DEPOS", "MATCON"], ordem: 4 },
      { slug: "serralherias", nome: "Serralherias", keywords: ["serralheria, exceto esquadrias", "fabricacao de estruturas metalicas"], exclusoes: [], name_stems: ["SERRAL", "FERRO"], ordem: 5 },
      { slug: "acabamentos-revestimentos", nome: "Acabamentos e revestimentos", keywords: ["comercio varejista de material de construcao", "comercio varejista de pedras para revestimento"], exclusoes: [], name_stems: ["REVEST", "ACAB"], ordem: 6 },
    ],
  },
  {
    slug: "contabilidade-e-juridico", nome: "Contabilidade e jurídico", grupo: "b2b_industria", perfil_score: "b2b_industria",
    keywords: ["atividades de contabilidade", "servicos advocaticios", "consultoria em gestao empresarial"],
    exclusoes: [], name_stems: ["CONTAB", "JURID"], ordem: 13,
    segments: [
      { slug: "escritorios-contabeis", nome: "Escritórios contábeis", keywords: ["atividades de contabilidade"], exclusoes: [], name_stems: ["CONTAB", "FISCAL"], ordem: 1 },
      { slug: "advocacia", nome: "Advocacia", keywords: ["servicos advocaticios"], exclusoes: [], name_stems: ["ADV", "JURID"], ordem: 2 },
      { slug: "consultoria-empresarial", nome: "Consultoria empresarial", keywords: ["consultoria em gestao empresarial"], exclusoes: [], name_stems: ["CONSULT", "GESTAO"], ordem: 3 },
    ],
  },
  {
    slug: "tech-e-software", nome: "Tech e software", grupo: "b2b_industria", perfil_score: "b2b_industria",
    keywords: ["programas de computador", "tecnologia da informacao", "tratamento de dados"],
    exclusoes: [], name_stems: ["TECH", "SOFT"], ordem: 14,
    segments: [
      { slug: "desenvolvimento-sob-encomenda", nome: "Desenvolvimento sob encomenda", keywords: ["desenvolvimento de programas de computador sob encomenda"], exclusoes: [], name_stems: ["DEV", "SOFT"], ordem: 1 },
      { slug: "saas-plataformas", nome: "SaaS e plataformas", keywords: ["licenciamento de programas de computador", "provedores de servicos de aplicacao"], exclusoes: [], name_stems: ["SAAS", "CLOUD"], ordem: 2 },
      { slug: "ti-suporte", nome: "TI e suporte", keywords: ["consultoria em tecnologia da informacao", "suporte tecnico, manutencao e outros servicos em tecnologia da informacao"], exclusoes: [], name_stems: ["TI", "SUPORTE"], ordem: 3 },
      { slug: "hospedagem-dados", nome: "Hospedagem e dados", keywords: ["tratamento de dados, provedores de servicos de aplicacao e servicos de hospedagem na internet"], exclusoes: [], name_stems: ["HOST", "DATA"], ordem: 4 },
    ],
  },
  {
    slug: "logistica-e-transporte", nome: "Logística e transporte", grupo: "b2b_industria", perfil_score: "b2b_industria",
    keywords: ["transporte rodoviario de carga", "armazens gerais", "comercio atacadista", "servicos de entrega rapida"],
    exclusoes: [], name_stems: ["LOG", "TRANS"], ordem: 15,
    segments: [
      { slug: "transportadoras-carga", nome: "Transportadoras de carga", keywords: ["transporte rodoviario de carga"], exclusoes: [], name_stems: ["TRANS", "CARGA"], ordem: 1 },
      { slug: "armazenagem", nome: "Armazenagem", keywords: ["armazens gerais", "depositos de mercadorias para terceiros"], exclusoes: [], name_stems: ["ARMAZ", "WMS"], ordem: 2 },
      { slug: "distribuidoras-atacado", nome: "Distribuidoras atacado", keywords: ["comercio atacadista"], exclusoes: [], name_stems: ["DISTRI", "ATAC"], ordem: 3 },
      { slug: "last-mile-entregas", nome: "Last mile e entregas", keywords: ["servicos de entrega rapida", "servicos de malote nao realizados pelo correio nacional"], exclusoes: [], name_stems: ["DELIVERY", "LASTMILE"], ordem: 4 },
    ],
  },
  {
    slug: "financeiro-e-seguros", nome: "Financeiro e seguros", grupo: "b2b_industria", perfil_score: "b2b_industria",
    keywords: ["corretores e agentes de seguros", "sociedades de fomento mercantil", "sociedades de credito"],
    exclusoes: [], name_stems: ["FIN", "SEGURO"], ordem: 16,
    segments: [
      { slug: "corretoras-seguros", nome: "Corretoras de seguros", keywords: ["corretores e agentes de seguros"], exclusoes: [], name_stems: ["SEGURO", "CORRET"], ordem: 1 },
      { slug: "assessorias-investimento", nome: "Assessorias de investimento", keywords: ["agentes de investimentos em aplicacoes financeiras", "administracao de fundos por contrato ou comissao"], exclusoes: [], name_stems: ["INVEST", "WEALTH"], ordem: 2 },
      { slug: "credito-fomento", nome: "Crédito e fomento", keywords: ["sociedades de credito, financiamento e investimento", "sociedades de fomento mercantil"], exclusoes: [], name_stems: ["CRED", "FOMENTO"], ordem: 3 },
      { slug: "factoring", nome: "Factoring", keywords: ["sociedades de fomento mercantil - factoring"], exclusoes: [], name_stems: ["FACTOR", "RECEB"], ordem: 4 },
    ],
  },
];

export function buildPresetSeedList(): NichePresetSeed[] {
  const out: NichePresetSeed[] = [];
  for (const niche of TAXONOMY) {
    out.push({
      slug: niche.slug,
      nome: niche.nome,
      grupo: niche.grupo,
      perfil_score: niche.perfil_score,
      parent_slug: null,
      keywords: niche.keywords,
      exclusoes: niche.exclusoes,
      name_stems: niche.name_stems,
      ordem: niche.ordem,
    });
    for (const seg of niche.segments) {
      out.push({
        slug: seg.slug,
        nome: seg.nome,
        grupo: niche.grupo,
        perfil_score: niche.perfil_score,
        parent_slug: niche.slug,
        keywords: seg.keywords,
        exclusoes: seg.exclusoes,
        name_stems: seg.name_stems,
        ordem: niche.ordem * 100 + seg.ordem,
      });
    }
  }
  return out;
}

export const PRESET_SEED = buildPresetSeedList();

export function getSegmentsForNiche(slug: string): NicheSeedNode["segments"] {
  return TAXONOMY.find((n) => n.slug === slug)?.segments ?? [];
}

export function getNichesByGrupo(
  grupo: "b2c_local" | "b2b_industria",
): NicheSeedNode[] {
  return TAXONOMY.filter((n) => n.grupo === grupo);
}
