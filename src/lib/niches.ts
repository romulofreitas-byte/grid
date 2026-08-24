import type { NichePreset, NichePresetCnae, RefCnae } from "@/lib/types";
import { aliasesForSlug } from "@/lib/segment-aliases";
import { normalizeText } from "@/lib/normalize-text";

export { normalizeText };

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
  aliases?: string[];
  segments: Array<{
    slug: string;
    nome: string;
    keywords: string[];
    exclusoes: string[];
    name_stems: string[];
    ordem: number;
    aliases?: string[];
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
      { slug: "sobrancelhas-design", nome: "Sobrancelhas e design", keywords: ["estetica e outros servicos de cuidados com a beleza"], exclusoes: [], name_stems: ["SOBRA", "BROW"], ordem: 8 },
      { slug: "maquiagem-profissional", nome: "Maquiagem profissional", keywords: ["estetica e outros servicos de cuidados com a beleza"], exclusoes: [], name_stems: ["MAKE", "BEAUTY"], ordem: 9 },
      { slug: "bronzeamento", nome: "Bronzeamento", keywords: ["estetica e outros servicos de cuidados com a beleza"], exclusoes: [], name_stems: ["BRONZE", "TAN"], ordem: 10 },
      { slug: "estetica-intima", nome: "Estética íntima", keywords: ["estetica e outros servicos de cuidados com a beleza"], exclusoes: [], name_stems: ["INTIMA", "LASER"], ordem: 11 },
      { slug: "massagem-terapeutica", nome: "Massagem terapêutica", keywords: ["atividades de sauna e banhos", "estetica e outros servicos de cuidados com a beleza"], exclusoes: [], name_stems: ["MASSAG", "TERAP"], ordem: 12 },
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
      { slug: "cardiologia", nome: "Cardiologia", keywords: ["atividade medica ambulatorial"], exclusoes: [], name_stems: ["CARDIO", "CORAC"], ordem: 10 },
      { slug: "ginecologia", nome: "Ginecologia", keywords: ["atividade medica ambulatorial"], exclusoes: [], name_stems: ["GINECO", "MULHER"], ordem: 11 },
      { slug: "pediatria", nome: "Pediatria", keywords: ["atividade medica ambulatorial"], exclusoes: [], name_stems: ["PEDIA", "INFANT"], ordem: 12 },
      { slug: "psiquiatria", nome: "Psiquiatria", keywords: ["atividade medica ambulatorial"], exclusoes: [], name_stems: ["PSIQ", "MENTAL"], ordem: 13 },
      { slug: "fonoaudiologia", nome: "Fonoaudiologia", keywords: ["atividades de fonoaudiologia"], exclusoes: [], name_stems: ["FONO", "FALA"], ordem: 14 },
      { slug: "enfermagem", nome: "Enfermagem", keywords: ["atividades de enfermagem"], exclusoes: [], name_stems: ["ENFERM", "CARE"], ordem: 15 },
      { slug: "laboratorios-analises", nome: "Laboratórios de análises", keywords: ["laboratorios de anatomia patologica e citologica", "laboratorios clinicos"], exclusoes: [], name_stems: ["LAB", "EXAME"], ordem: 16 },
      { slug: "clinicas-vacina", nome: "Clínicas de vacina", keywords: ["atividade medica ambulatorial"], exclusoes: [], name_stems: ["VACINA", "IMUNO"], ordem: 17 },
      { slug: "home-care", nome: "Home care", keywords: ["atividades de atendimento em regime residencial", "atividade medica ambulatorial"], exclusoes: [], name_stems: ["HOMECARE", "DOMIC"], ordem: 18 },
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
      { slug: "pet-food-racao", nome: "Pet food e ração", keywords: ["comercio varejista de artigos para animais de estimacao", "comercio varejista de produtos alimenticios em geral"], exclusoes: [], name_stems: ["RACAO", "PETFOOD"], ordem: 6 },
      { slug: "cremacao-pet", nome: "Cremação pet", keywords: ["atividades veterinarias"], exclusoes: [], name_stems: ["CREMA", "PET"], ordem: 7 },
      { slug: "fisioterapia-animal", nome: "Fisioterapia animal", keywords: ["atividades veterinarias"], exclusoes: [], name_stems: ["FISIO PET", "REAB PET"], ordem: 8 },
      { slug: "pet-taxi", nome: "Pet taxi", keywords: ["atividades veterinarias"], exclusoes: [], name_stems: ["PETTAXI", "TRANSPET"], ordem: 9 },
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
      { slug: "borracharia", nome: "Borracharia", keywords: ["comercio varejista de pneumaticos e de camaras-de-ar", "servicos de borracharia"], exclusoes: [], name_stems: ["BORRACH", "PNEU"], ordem: 7 },
      { slug: "autoeletrica", nome: "Autoelétrica", keywords: ["servicos de manutencao e reparacao eletrica de veiculos automotores"], exclusoes: [], name_stems: ["ELETRIC", "AUTO"], ordem: 8 },
      { slug: "autopecas", nome: "Autopeças", keywords: ["pecas e acessorios novos para veiculos automotores"], exclusoes: [], name_stems: ["PECAS", "AUTO"], ordem: 9 },
      { slug: "lavagem-rapida", nome: "Lavagem rápida", keywords: ["lavagem, lubrificacao e polimento de veiculos automotores"], exclusoes: [], name_stems: ["LAVA", "RAPIDO"], ordem: 10 },
      { slug: "blindagem", nome: "Blindagem automotiva", keywords: ["fabricacao de equipamentos e acessorios para veiculos", "manutencao e reparacao mecanica de veiculos automotores"], exclusoes: [], name_stems: ["BLIND", "SECURITY"], ordem: 11 },
      { slug: "oficinas-motos", nome: "Oficinas de motos", keywords: ["manutencao e reparacao de motocicletas e motonetas", "comercio varejista de pecas e acessorios para motocicletas"], exclusoes: [], name_stems: ["MOTO", "BIKE"], ordem: 12 },
      { slug: "guincho", nome: "Guincho e reboque", keywords: ["servicos de reboque de veiculos"], exclusoes: [], name_stems: ["GUINCHO", "REBOQUE"], ordem: 13 },
    ],
  },
  {
    slug: "imobiliario", nome: "Imobiliário", grupo: "b2c_local", perfil_score: "b2c_local",
    keywords: ["corretagem na compra e venda", "incorporacao de empreendimentos imobiliarios", "administracao da propriedade imobiliaria"],
    exclusoes: [], name_stems: ["IMOB", "IMOVEIS"], ordem: 5,
    segments: [
      { slug: "imobiliarias", nome: "Imobiliárias e corretoras", keywords: ["corretagem na compra e venda e avaliacao de imoveis"], exclusoes: [], name_stems: ["IMOB", "REALTY"], ordem: 1 },
      { slug: "incorporadoras-varejo", nome: "Incorporadoras", keywords: ["incorporacao de empreendimentos imobiliarios"], exclusoes: [], name_stems: ["INCORP", "URBAN"], ordem: 2 },
      { slug: "administradoras-condominio", nome: "Administradoras de condomínio", keywords: ["gestao e administracao da propriedade imobiliaria"], exclusoes: [], name_stems: ["CONDOM", "ADMIN"], ordem: 3 },
      { slug: "avaliacao-pericia", nome: "Avaliação e perícia", keywords: ["corretagem na compra e venda e avaliacao de imoveis"], exclusoes: [], name_stems: ["AVALIA", "LAUDO"], ordem: 4 },
      { slug: "locacao-residencial", nome: "Locação residencial", keywords: ["aluguel de imoveis proprios", "corretagem na compra e venda e avaliacao de imoveis"], exclusoes: [], name_stems: ["LOCAC", "ALUGUEL"], ordem: 5 },
      { slug: "locacao-comercial", nome: "Locação comercial", keywords: ["aluguel de imoveis proprios", "gestao e administracao da propriedade imobiliaria"], exclusoes: [], name_stems: ["COMERC", "SHOP"], ordem: 6 },
      { slug: "home-staging", nome: "Home staging", keywords: ["corretagem na compra e venda e avaliacao de imoveis", "servicos de arquitetura"], exclusoes: [], name_stems: ["STAGING", "DECOR"], ordem: 7 },
      { slug: "sindicos-profissionais", nome: "Síndicos profissionais", keywords: ["gestao e administracao da propriedade imobiliaria"], exclusoes: [], name_stems: ["SINDICO", "CONDOM"], ordem: 8 },
      { slug: "leiloes-imoveis", nome: "Leilões de imóveis", keywords: ["corretagem na compra e venda e avaliacao de imoveis"], exclusoes: [], name_stems: ["LEILAO", "AUCTION"], ordem: 9 },
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
      { slug: "informatica-celulares", nome: "Informática e celulares", keywords: ["equipamentos de informatica", "equipamentos de telefonia"], exclusoes: [], name_stems: ["INFO", "CELL"], ordem: 9 },
      { slug: "papelaria", nome: "Papelaria", keywords: ["comercio varejista de artigos de papelaria"], exclusoes: [], name_stems: ["PAPEL", "OFFICE"], ordem: 10 },
      { slug: "brinquedos", nome: "Brinquedos", keywords: ["comercio varejista de brinquedos e artigos recreativos"], exclusoes: [], name_stems: ["BRINQ", "TOY"], ordem: 11 },
      { slug: "casa-jardim", nome: "Floriculturas e jardinagem", keywords: ["comercio varejista de plantas e flores naturais"], exclusoes: [], name_stems: ["JARDIM", "GARDEN"], ordem: 12 },
      { slug: "colchoes", nome: "Colchões", keywords: ["comercio varejista de artigos de colchoaria"], exclusoes: [], name_stems: ["COLCHAO", "SLEEP"], ordem: 13 },
      { slug: "utensilios-domesticos", nome: "Utensílios domésticos", keywords: ["comercio varejista de artigos de cama, mesa e banho", "comercio varejista de artigos de armarinho"], exclusoes: [], name_stems: ["CASA", "HOME"], ordem: 14 },
    ],
  },
  {
    slug: "alimentacao-fora-do-lar", nome: "Alimentação", grupo: "b2c_local", perfil_score: "b2c_local",
    keywords: ["restaurantes e similares", "lanchonetes, casas de cha", "bares e outros estabelecimentos especializados em servir bebidas"],
    exclusoes: [], name_stems: ["FOOD", "GOURMET"], ordem: 7,
    segments: [
      { slug: "restaurantes", nome: "Restaurantes", keywords: ["restaurantes e similares"], exclusoes: ["lanchonetes"], name_stems: ["REST", "CHEF"], ordem: 1 },
      { slug: "pizzarias", nome: "Pizzarias", keywords: ["restaurantes e similares"], exclusoes: ["lanchonetes"], name_stems: ["PIZZA", "FORNO"], ordem: 2 },
      { slug: "hamburguerias", nome: "Hamburguerias", keywords: ["lanchonetes, casas de cha, de sucos e similares", "restaurantes e similares"], exclusoes: [], name_stems: ["BURGER", "GRILL"], ordem: 3 },
      { slug: "buffets", nome: "Buffets", keywords: ["servicos de alimentacao para eventos e recepcoes - bufe"], exclusoes: [], name_stems: ["BUFFET", "EVENT"], ordem: 4 },
      { slug: "lanchonetes", nome: "Lanchonetes", keywords: ["lanchonetes, casas de cha, de sucos e similares"], exclusoes: [], name_stems: ["LANCH", "SNACK"], ordem: 5 },
      { slug: "bares", nome: "Bares", keywords: ["bares e outros estabelecimentos especializados em servir bebidas"], exclusoes: [], name_stems: ["BAR", "DRINK"], ordem: 6 },
      { slug: "cafeterias", nome: "Cafeterias", keywords: ["lanchonetes, casas de cha, de sucos e similares"], exclusoes: [], name_stems: ["CAFE", "COFFEE"], ordem: 7 },
      { slug: "sorveterias-acai", nome: "Sorveterias e açaí", keywords: ["lanchonetes, casas de cha, de sucos e similares", "fabricacao de sorvetes e outros gelados comestiveis"], exclusoes: [], name_stems: ["SORVETE", "ACAI"], ordem: 8 },
      { slug: "padarias", nome: "Padarias e panificadoras", keywords: ["padaria e confeitaria com predominancia de revenda", "fabricacao de produtos de padaria e confeitaria"], exclusoes: [], name_stems: ["PADARIA", "PAO"], ordem: 9 },
      { slug: "food-trucks", nome: "Food trucks", keywords: ["servicos ambulantes de alimentacao", "lanchonetes, casas de cha, de sucos e similares"], exclusoes: [], name_stems: ["FOODTRUCK", "AMBUL"], ordem: 10 },
      { slug: "dark-kitchen", nome: "Dark kitchen / delivery", keywords: ["restaurantes e similares", "servicos de alimentacao para eventos e recepcoes - bufe"], exclusoes: [], name_stems: ["DARK", "DELIVERY"], ordem: 11 },
      { slug: "churrascarias", nome: "Churrascarias", keywords: ["restaurantes e similares"], exclusoes: ["lanchonetes"], name_stems: ["CHURRAS", "GRILL"], ordem: 12 },
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
      { slug: "ensino-infantil", nome: "Ensino infantil", keywords: ["educacao infantil - creche", "educacao infantil - pre-escola"], exclusoes: [], name_stems: ["CRECHE", "INFANTIL"], ordem: 6 },
      { slug: "reforco-escolar", nome: "Reforço escolar", keywords: ["atividades de apoio a educacao", "cursos preparatorios para concursos"], exclusoes: [], name_stems: ["REFORCO", "AULA"], ordem: 7 },
      { slug: "musica-artes", nome: "Música e artes", keywords: ["ensino de arte e cultura", "ensino de musica"], exclusoes: [], name_stems: ["MUSICA", "ARTE"], ordem: 8 },
      { slug: "concursos-publicos", nome: "Concursos públicos", keywords: ["cursos preparatorios para concursos"], exclusoes: [], name_stems: ["CONCURSO", "PREP"], ordem: 9 },
      { slug: "ead-cursos-online", nome: "EAD e cursos online", keywords: ["educacao a distancia", "treinamento em desenvolvimento profissional e gerencial"], exclusoes: [], name_stems: ["EAD", "ONLINE"], ordem: 10 },
      { slug: "coaching-educacional", nome: "Coaching educacional", keywords: ["treinamento em desenvolvimento profissional e gerencial", "consultoria em gestao empresarial"], exclusoes: [], name_stems: ["COACH", "MENTOR"], ordem: 11 },
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
      { slug: "locadoras-turismo", nome: "Locadoras de veículos (turismo)", keywords: ["locacao de automoveis sem condutor"], exclusoes: [], name_stems: ["RENT", "LOCADORA"], ordem: 5 },
      { slug: "resorts", nome: "Resorts", keywords: ["hoteis"], exclusoes: [], name_stems: ["RESORT", "LAZER"], ordem: 6 },
      { slug: "hostels", nome: "Hostels", keywords: ["albergues", "pensoes (alojamento)"], exclusoes: [], name_stems: ["HOSTEL", "BACK"], ordem: 7 },
      { slug: "turismo-aventura", nome: "Turismo de aventura", keywords: ["parques de diversao e temas", "servicos de reservas e outros servicos de turismo"], exclusoes: [], name_stems: ["AVENTURA", "RADICAL"], ordem: 8 },
      { slug: "guias-locais", nome: "Guias locais", keywords: ["atividades de guias de turismo", "servicos de reservas e outros servicos de turismo"], exclusoes: [], name_stems: ["GUIA", "LOCAL"], ordem: 9 },
      { slug: "eventos-turismo", nome: "Eventos e wedding destination", keywords: ["organizacao de eventos, exceto culturais e esportivos", "servicos de reservas e outros servicos de turismo"], exclusoes: [], name_stems: ["WEDDING", "EVENTO"], ordem: 10 },
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
      { slug: "alimentos-industrializados", nome: "Alimentos industrializados", keywords: ["fabricacao de alimentos", "produtos alimenticios", "laticinios", "conservas", "fabricacao de produtos de padaria"], exclusoes: ["alimentos para animais"], name_stems: ["ALIM", "FOOD IND"], ordem: 4 },
      { slug: "textil-industrial", nome: "Têxtil industrial", keywords: ["fiacao", "tecelagem", "fabricacao de artefatos texteis"], exclusoes: [], name_stems: ["TEXTIL", "TECIDO"], ordem: 5 },
      { slug: "embalagens-industrial", nome: "Embalagens industrial", keywords: ["fabricacao de embalagens de material plastico", "fabricacao de embalagens de papelao"], exclusoes: [], name_stems: ["EMBAL", "PACK"], ordem: 6 },
      { slug: "moveleira-industrial", nome: "Moveleira industrial", keywords: ["fabricacao de moveis"], exclusoes: [], name_stems: ["MOVELEIR", "MOBILI"], ordem: 7 },
      { slug: "siderurgia", nome: "Siderurgia", keywords: ["producao de ferro-gusa", "laminados planos de aco", "laminados longos de aco"], exclusoes: [], name_stems: ["SIDER", "ACO"], ordem: 8 },
      { slug: "borracha-industrial", nome: "Borracha industrial", keywords: ["fabricacao de artefatos de borracha"], exclusoes: [], name_stems: ["BORRACH", "RUBBER"], ordem: 9 },
      { slug: "papel-celulose", nome: "Papel e celulose", keywords: ["fabricacao de celulose e outras pastas para fabricacao de papel", "fabricacao de papel"], exclusoes: [], name_stems: ["PAPEL", "CELULOSE"], ordem: 10 },
      { slug: "farmaceutica", nome: "Farmacêutica", keywords: ["fabricacao de medicamentos", "produtos farmaceuticos"], exclusoes: ["uso veterinario"], name_stems: ["FARMA", "MED"], ordem: 11 },
      { slug: "bebidas-industrial", nome: "Bebidas industrial", keywords: ["fabricacao de bebidas", "aguas envasadas", "cervejas", "refrigerantes", "sucos", "refrescos", "aguardente", "vinhos"], exclusoes: [], name_stems: ["BEBIDA", "DRINK"], ordem: 12 },
      { slug: "aguas-envasadas", nome: "Águas envasadas", keywords: ["aguas envasadas", "agua mineral"], exclusoes: [], name_stems: ["AGUA", "MINERAL"], ordem: 13 },
      { slug: "cervejarias", nome: "Cervejarias", keywords: ["cervejas", "fabricacao de cervejas"], exclusoes: [], name_stems: ["CERVEJA", "BREW"], ordem: 14 },
      { slug: "refrigerantes-sucos", nome: "Refrigerantes e sucos", keywords: ["refrigerantes", "sucos", "refrescos", "bebidas isotonicas", "energeticos"], exclusoes: [], name_stems: ["REFRI", "SUCO"], ordem: 15 },
      { slug: "autopecas-industrial", nome: "Fabricação de autopeças (OEM)", keywords: ["pecas e acessorios para veiculos automotores"], exclusoes: [], name_stems: ["AUTOPEC", "OEM"], ordem: 16 },
      { slug: "mineracao-beneficiamento", nome: "Mineração e beneficiamento", keywords: ["extracao de minerais metalicos", "beneficiamento de minerais"], exclusoes: [], name_stems: ["MINERA", "ORE"], ordem: 17 },
      { slug: "envasamento-empacotamento", nome: "Co-packing (envase sob contrato)", keywords: ["envasamento e empacotamento"], exclusoes: [], name_stems: ["ENVASE", "PACK"], ordem: 18 },
    ],
  },
  {
    slug: "construcao-civil", nome: "Construção civil", grupo: "b2b_industria", perfil_score: "b2b_industria",
    keywords: ["construcao de edificios", "obras de engenharia civil", "servicos de engenharia", "servicos de arquitetura"],
    exclusoes: [], name_stems: ["CONSTR", "OBRAS"], ordem: 11,
    segments: [
      { slug: "construtoras-reformas", nome: "Construtoras e reformas", keywords: ["construcao de edificios"], exclusoes: [], name_stems: ["CONSTR", "BUILD"], ordem: 1 },
      { slug: "empreiteiras", nome: "Empreiteiras", keywords: ["obras de engenharia civil", "construcao de edificios"], exclusoes: [], name_stems: ["EMPREIT", "OBRAS"], ordem: 2 },
      { slug: "engenharia-projetos", nome: "Engenharia e projetos", keywords: ["servicos de engenharia"], exclusoes: [], name_stems: ["ENG", "PROJET"], ordem: 3 },
      { slug: "arquitetura-projetos", nome: "Arquitetura e projetos", keywords: ["servicos de arquitetura"], exclusoes: [], name_stems: ["ARQ", "DESIGN"], ordem: 4 },
      { slug: "reformas-residenciais", nome: "Reformas residenciais", keywords: ["construcao de edificios", "obras de acabamento"], exclusoes: [], name_stems: ["REFORMA", "HOME"], ordem: 5 },
      { slug: "obras-industriais", nome: "Obras industriais e galpões", keywords: ["construcao de edificios", "obras de engenharia civil"], exclusoes: [], name_stems: ["GALPAO", "INDUST"], ordem: 6 },
      { slug: "terraplanagem", nome: "Terraplanagem", keywords: ["obras de terraplanagem", "obras de engenharia civil"], exclusoes: [], name_stems: ["TERRA", "MOVIM"], ordem: 7 },
      { slug: "pavimentacao", nome: "Pavimentação e asfalto", keywords: ["obras de urbanizacao", "construcao de rodovias e ferrovias"], exclusoes: [], name_stems: ["ASFALTO", "PAVIM"], ordem: 8 },
      { slug: "fundacoes", nome: "Fundações e contenções", keywords: ["obras de fundacoes", "obras de engenharia civil"], exclusoes: [], name_stems: ["FUNDAC", "ESTACA"], ordem: 9 },
      { slug: "instalacoes-hidraulicas", nome: "Instalações hidráulicas", keywords: ["instalacoes hidraulicas, sanitarias e de gas", "obras de instalacoes"], exclusoes: [], name_stems: ["HIDRAUL", "ENCAN"], ordem: 10 },
      { slug: "instalacoes-eletricas", nome: "Instalações elétricas", keywords: ["instalacoes eletricas", "obras de instalacoes"], exclusoes: [], name_stems: ["ELETRIC", "INSTAL"], ordem: 11 },
      { slug: "impermeabilizacao-vazamentos", nome: "Impermeabilização e vazamentos", keywords: ["impermeabilizacao em construcao civil", "obras de acabamento", "instalacoes hidraulicas, sanitarias e de gas"], exclusoes: [], name_stems: ["IMPERM", "VAZA"], ordem: 12 },
      { slug: "pintura-predial", nome: "Pintura predial", keywords: ["pintura para construcao civil", "obras de acabamento"], exclusoes: [], name_stems: ["PINTURA", "PREDIO"], ordem: 13 },
      { slug: "gesso-drywall", nome: "Gesso e drywall", keywords: ["obras de acabamento em gesso e estuque", "obras de acabamento"], exclusoes: [], name_stems: ["GESSO", "DRYWALL"], ordem: 14 },
      { slug: "climatizacao", nome: "Climatização e ar-condicionado", keywords: ["instalacao e manutencao de sistemas centrais de ar condicionado", "instalacoes de sistema de ventilacao"], exclusoes: [], name_stems: ["CLIMA", "ARCOND"], ordem: 15 },
      { slug: "topografia", nome: "Topografia e geotecnia", keywords: ["servicos de engenharia", "atividades tecnicas relacionadas a engenharia"], exclusoes: [], name_stems: ["TOPO", "GEOTEC"], ordem: 16 },
      { slug: "paisagismo", nome: "Paisagismo", keywords: ["atividades paisagisticas", "servicos de arquitetura"], exclusoes: [], name_stems: ["PAISAG", "JARDIM"], ordem: 17 },
      { slug: "design-interiores", nome: "Design de interiores", keywords: ["design de interiores", "servicos de arquitetura"], exclusoes: [], name_stems: ["INTERIOR", "DECOR"], ordem: 18 },
      { slug: "laudos-pericias-engenharia", nome: "Laudos e perícias de engenharia", keywords: ["servicos de engenharia", "atividades tecnicas relacionadas a engenharia"], exclusoes: [], name_stems: ["LAUDO", "PERICIA"], ordem: 19 },
      { slug: "calculo-estrutural", nome: "Cálculo estrutural", keywords: ["servicos de engenharia"], exclusoes: [], name_stems: ["CALCULO", "ESTRUT"], ordem: 20 },
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
      { slug: "pre-moldados-concreto", nome: "Pré-moldados e concreto", keywords: ["fabricacao de artefatos de concreto, cimento, fibrocimento, gesso e materiais semelhantes", "fabricacao de estruturas pre-moldadas de concreto armado"], exclusoes: [], name_stems: ["PREMOLD", "CONCRETO"], ordem: 7 },
      { slug: "blocos-tijolos", nome: "Blocos e tijolos", keywords: ["fabricacao de artefatos de concreto, cimento, fibrocimento, gesso e materiais semelhantes", "fabricacao de produtos ceramicos nao-refratarios"], exclusoes: [], name_stems: ["BLOCO", "TIJOLO"], ordem: 8 },
      { slug: "ceramica-argila-telhas", nome: "Cerâmica, telhas e argila", keywords: ["fabricacao de produtos ceramicos nao-refratarios para uso estrutural", "fabricacao de produtos ceramicos"], exclusoes: [], name_stems: ["CERAM", "ARGILA"], ordem: 9 },
      { slug: "cimento-agregados", nome: "Cimento e agregados", keywords: ["fabricacao de cimento", "comercio atacadista de cimento"], exclusoes: [], name_stems: ["CIMENTO", "AGREG"], ordem: 10 },
      { slug: "areia-brita", nome: "Areia e brita", keywords: ["extracao de areia, cascalho ou pedregulho", "comercio varejista de materiais de construcao em geral"], exclusoes: [], name_stems: ["AREIA", "BRITA"], ordem: 11 },
      { slug: "tintas-vernizes", nome: "Tintas e vernizes", keywords: ["comercio varejista de tintas e materiais para pintura", "fabricacao de tintas, vernizes, esmaltes"], exclusoes: [], name_stems: ["TINTA", "VERNIZ"], ordem: 12 },
      { slug: "pisos-porcelanatos", nome: "Pisos e porcelanatos", keywords: ["comercio varejista de pedras para revestimento", "comercio varejista de material de construcao", "fabricacao de revestimentos ceramicos"], exclusoes: [], name_stems: ["PISO", "PORCEL"], ordem: 13 },
      { slug: "loucas-metais-sanitarios", nome: "Louças e metais sanitários", keywords: ["comercio varejista de materiais hidraulicos", "comercio varejista de material de construcao"], exclusoes: [], name_stems: ["LOUCA", "SANIT"], ordem: 14 },
      { slug: "madeira-compensados", nome: "Madeira e compensados", keywords: ["comercio varejista de madeiras e artefatos", "serrarias com desdobramento de madeira"], exclusoes: [], name_stems: ["MADEIRA", "COMPENS"], ordem: 15 },
      { slug: "telhas-coberturas", nome: "Telhas e coberturas", keywords: ["fabricacao de artefatos de fibrocimento", "comercio varejista de materiais de construcao em geral"], exclusoes: [], name_stems: ["TELHA", "COBERT"], ordem: 16 },
      { slug: "argamassas-rejunte", nome: "Argamassas e rejunte", keywords: ["fabricacao de artefatos de concreto, cimento, fibrocimento, gesso e materiais semelhantes", "comercio varejista de materiais de construcao em geral"], exclusoes: [], name_stems: ["ARGAM", "REJUNTE"], ordem: 17 },
      { slug: "drywall-placas", nome: "Drywall e placas", keywords: ["fabricacao de produtos de gesso", "comercio varejista de materiais de construcao em geral"], exclusoes: [], name_stems: ["DRYWALL", "PLACA"], ordem: 18 },
      { slug: "portas-portoes", nome: "Portas e portões", keywords: ["fabricacao de portas, janelas e outros elementos", "serralheria, exceto esquadrias"], exclusoes: [], name_stems: ["PORTA", "PORTAO"], ordem: 19 },
      { slug: "ferragens-parafusos", nome: "Ferragens e parafusos", keywords: ["comercio varejista de ferragens e ferramentas"], exclusoes: [], name_stems: ["FERRAG", "PARAF"], ordem: 20 },
      { slug: "isolamento-termico", nome: "Isolamento térmico e acústico", keywords: ["fabricacao de produtos de material plastico", "comercio varejista de materiais de construcao em geral"], exclusoes: [], name_stems: ["ISOLAM", "ACUST"], ordem: 21 },
      { slug: "epis-obra", nome: "EPIs e segurança para obra", keywords: ["artigos de armarinho", "comercio varejista de artigos de armarinho"], exclusoes: ["artigos do vestuario"], name_stems: ["EPI", "SEGUR"], ordem: 22 },
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
      { slug: "cartorios", nome: "Cartórios e tabelionatos", keywords: ["cartorios"], exclusoes: [], name_stems: ["CARTORIO", "TABEL"], ordem: 4 },
      { slug: "dp-folha", nome: "DP e folha terceirizada", keywords: ["atividades de contabilidade", "selecao e colocacao de mao-de-obra"], exclusoes: [], name_stems: ["FOLHA", "DP"], ordem: 5 },
      { slug: "compliance-lgpd", nome: "Compliance e LGPD", keywords: ["consultoria em gestao empresarial", "servicos advocaticios"], exclusoes: [], name_stems: ["COMPLI", "LGPD"], ordem: 6 },
      { slug: "mediacao-arbitragem", nome: "Mediação e arbitragem", keywords: ["servicos advocaticios", "atividades juridicas"], exclusoes: [], name_stems: ["MEDIAC", "ARBIT"], ordem: 7 },
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
      { slug: "apps-mobile", nome: "Apps mobile", keywords: ["desenvolvimento de programas de computador sob encomenda", "consultoria em tecnologia da informacao"], exclusoes: [], name_stems: ["APP", "MOBILE"], ordem: 5 },
      { slug: "ecommerce-plataformas", nome: "E-commerce e plataformas", keywords: ["portais, provedores de conteudo e outros servicos de informacao na internet", "licenciamento de programas de computador"], exclusoes: [], name_stems: ["ECOMM", "SHOP"], ordem: 6 },
      { slug: "ciberseguranca", nome: "Cibersegurança", keywords: ["consultoria em tecnologia da informacao", "suporte tecnico, manutencao e outros servicos em tecnologia da informacao"], exclusoes: [], name_stems: ["CYBER", "SEC"], ordem: 7 },
      { slug: "automacao-rpa", nome: "Automação e RPA", keywords: ["desenvolvimento de programas de computador sob encomenda", "consultoria em tecnologia da informacao"], exclusoes: [], name_stems: ["RPA", "AUTOMA"], ordem: 8 },
    ],
  },
  {
    slug: "marketing-e-publicidade", nome: "Marketing e publicidade", grupo: "b2b_industria", perfil_score: "b2b_industria",
    keywords: ["agencias de publicidade", "consultoria em publicidade"],
    exclusoes: [], name_stems: ["MKT", "ADS"], ordem: 15,
    segments: [
      { slug: "marketing-digital", nome: "Agências de marketing e performance", keywords: ["agencias de publicidade", "consultoria em publicidade"], exclusoes: [], name_stems: ["PERF", "ADS"], ordem: 1 },
    ],
  },
  {
    slug: "logistica-e-transporte", nome: "Logística e transporte", grupo: "b2b_industria", perfil_score: "b2b_industria",
    keywords: ["transporte rodoviario de carga", "armazens gerais", "servicos de entrega rapida"],
    exclusoes: [], name_stems: ["LOG", "TRANS"], ordem: 16,
    segments: [
      { slug: "transportadoras-carga", nome: "Transportadoras de carga", keywords: ["transporte rodoviario de carga"], exclusoes: [], name_stems: ["TRANS", "CARGA"], ordem: 1 },
      { slug: "armazenagem", nome: "Armazenagem", keywords: ["armazens gerais", "depositos de mercadorias para terceiros"], exclusoes: [], name_stems: ["ARMAZ", "WMS"], ordem: 2 },
      { slug: "last-mile-entregas", nome: "Last mile e entregas", keywords: ["servicos de entrega rapida", "servicos de malote nao realizados pelo correio nacional"], exclusoes: [], name_stems: ["DELIVERY", "LASTMILE"], ordem: 3 },
      { slug: "frota-locacao-comercial", nome: "Locação de frota B2B", keywords: ["locacao de automoveis sem condutor", "locacao de outros meios de transporte"], exclusoes: [], name_stems: ["FROTA", "RENT"], ordem: 4 },
      { slug: "cross-docking", nome: "Cross-docking", keywords: ["armazens gerais", "depositos de mercadorias para terceiros"], exclusoes: [], name_stems: ["CROSS", "DOCK"], ordem: 5 },
      { slug: "mudancas", nome: "Transporte de mudanças", keywords: ["transporte rodoviario de mudancas"], exclusoes: [], name_stems: ["MUDANCA", "MOVE"], ordem: 6 },
      { slug: "courier-motoboy", nome: "Courier e motoboy B2B", keywords: ["servicos de entrega rapida", "servicos de malote nao realizados pelo correio nacional"], exclusoes: [], name_stems: ["COURIER", "MOTO"], ordem: 7 },
      { slug: "logistica-reversa", nome: "Coleta e logística reversa", keywords: ["coleta de residuos nao-perigosos"], exclusoes: [], name_stems: ["REVERSA", "RECICLA"], ordem: 8 },
    ],
  },
  {
    slug: "atacado-e-distribuicao", nome: "Atacado e distribuição", grupo: "b2b_industria", perfil_score: "b2b_industria",
    keywords: ["comercio atacadista"],
    exclusoes: [], name_stems: ["ATAC", "DISTRI"], ordem: 17,
    segments: [
      { slug: "distribuidoras-atacado", nome: "Distribuidoras e atacado", keywords: ["comercio atacadista"], exclusoes: [], name_stems: ["DISTRI", "ATAC"], ordem: 1 },
    ],
  },
  {
    slug: "financeiro-e-seguros", nome: "Financeiro e seguros", grupo: "b2b_industria", perfil_score: "b2b_industria",
    keywords: ["corretores e agentes de seguros", "sociedades de fomento mercantil", "sociedades de credito"],
    exclusoes: [], name_stems: ["FIN", "SEGURO"], ordem: 18,
    segments: [
      { slug: "corretoras-seguros", nome: "Corretoras de seguros", keywords: ["corretores e agentes de seguros"], exclusoes: [], name_stems: ["SEGURO", "CORRET"], ordem: 1 },
      { slug: "assessorias-investimento", nome: "Assessorias de investimento", keywords: ["agentes de investimentos em aplicacoes financeiras", "administracao de fundos por contrato ou comissao"], exclusoes: [], name_stems: ["INVEST", "WEALTH"], ordem: 2 },
      { slug: "credito-fomento", nome: "Crédito e fomento", keywords: ["sociedades de credito, financiamento e investimento", "sociedades de fomento mercantil"], exclusoes: [], name_stems: ["CRED", "FOMENTO"], ordem: 3 },
      { slug: "factoring", nome: "Factoring", keywords: ["sociedades de fomento mercantil - factoring"], exclusoes: [], name_stems: ["FACTOR", "RECEB"], ordem: 4 },
      { slug: "consorcios", nome: "Consórcios", keywords: ["administracao de consorcios", "corretores e agentes de seguros"], exclusoes: [], name_stems: ["CONSOR", "CARTA"], ordem: 5 },
      { slug: "previdencia-planos", nome: "Previdência e planos", keywords: ["seguros de vida e previdencia", "corretores e agentes de seguros"], exclusoes: [], name_stems: ["PREV", "PLANO"], ordem: 6 },
      { slug: "cambio", nome: "Câmbio", keywords: ["corretoras de cambio", "intermediacao de cambio"], exclusoes: [], name_stems: ["CAMBIO", "FX"], ordem: 7 },
      { slug: "fintech-pagamentos", nome: "Fintech e meios de pagamento", keywords: ["correspondentes de instituicoes financeiras", "outras atividades auxiliares dos servicos financeiros"], exclusoes: [], name_stems: ["FINTECH", "PAY"], ordem: 8 },
      { slug: "cobranca-extrajudicial", nome: "Cobrança e recuperação de crédito", keywords: ["cobranca"], exclusoes: [], name_stems: ["COBRAN", "DEBT"], ordem: 9 },
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
      aliases: [...new Set([...(niche.aliases ?? []), ...aliasesForSlug(niche.slug)])],
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
        aliases: [...new Set([...(seg.aliases ?? []), ...aliasesForSlug(seg.slug)])],
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
