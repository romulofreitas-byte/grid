/** One-off generator for src/lib/data/cnae-catalog.ts — run: node scripts/gen-cnae-catalog.mjs */

import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Segment CNAE templates: descricao must include segment keywords (normalized matching).
const SEGMENT_CNAES = [
  // Estética e beleza
  ["clinicas-estetica", [
    ["9602502", "Atividades de estética e beleza com clinica de estetica"],
    ["8650006", "Serviços de dermatologia e medicina estetica ambulatorial"],
    ["9609206", "Serviços de depilacao e tratamentos esteticos"],
  ]],
  ["harmonizacao-facial", [
    ["8650006", "Harmonizacao facial e medicina estetica ambulatorial"],
    ["9602502", "Clinica de estetica com preenchimento facial"],
    ["8630506", "Procedimentos de harmonizacao facial ambulatorial"],
  ]],
  ["depilacao-laser", [
    ["9609206", "Depilacao a laser e depilacao definitiva"],
    ["9602502", "Clinica de estetica com fotodepilacao"],
    ["8650006", "Serviços de depilacao definitiva ambulatorial"],
  ]],
  ["saloes-premium", [
    ["9602501", "Cabeleireiros e salao de beleza premium"],
    ["9602502", "Salao de beleza com tratamento capilar"],
    ["9609208", "Atividades de tratamento de beleza capilar"],
  ]],
  ["barbearias", [
    ["9602501", "Cabeleireiros barbearia e barbeiro"],
    ["9602501", "Barbearia e salao masculino"],
    ["9602502", "Servicos de barbearia e corte masculino"],
  ]],
  ["estudio-tatuagem", [
    ["9609208", "Estudio de tatuagem e piercing"],
    ["9609208", "Atividades de tatuagem e body piercing"],
    ["9602502", "Tatuagem artistica e piercing"],
  ]],
  ["micropigmentacao", [
    ["9609206", "Micropigmentacao e dermopigmentacao estetica"],
    ["9602502", "Estudio de micropigmentacao de sobrancelhas"],
    ["9609208", "Serviços de micropigmentacao e design de sobrancelhas"],
  ]],
  ["manicure-podologia", [
    ["9602501", "Manicure pedicure e podologia"],
    ["9602502", "Atividades de manicure e podologia"],
    ["8650004", "Clinica de podologia e cuidados com os pes"],
  ]],
  ["spa-bem-estar", [
    ["9609207", "Spa day spa e massagem relaxante"],
    ["9602502", "Centro de spa e bem-estar"],
    ["9609208", "Serviços de spa e massagem terapeutica"],
  ]],
  // Saúde e clínicas
  ["ortopedia", [
    ["8630503", "Clinica de ortopedia e traumatologia ambulatorial"],
    ["8630501", "Cirurgia ortopedica ambulatorial especializada"],
    ["8650004", "Fisioterapia e reabilitacao ortopedica"],
  ]],
  ["dermatologia", [
    ["8630506", "Clinica de dermatologia e medicina dermatologica"],
    ["8650006", "Serviços de dermatologia ambulatorial"],
    ["8630502", "Consultorio de dermatologista"],
  ]],
  ["odontologia", [
    ["8630504", "Clinica odontologica e atividade odontologica"],
    ["8630505", "Serviços odontologicos especializados"],
    ["8630504", "Consultorio odontologico com procedimentos"],
  ]],
  ["oftalmologia", [
    ["8640203", "Clinica oftalmologica e serviços de oftalmologia"],
    ["8640202", "Atividade oftalmologica ambulatorial"],
    ["8640201", "Consultorio oftalmologico"],
  ]],
  ["fisioterapia", [
    ["8650004", "Atividades de fisioterapia e reabilitacao fisica"],
    ["8650004", "Clinica de fisioterapia e reabilitacao"],
    ["8650004", "Serviços fisioterapeuticos ambulatoriais"],
  ]],
  ["nutricao", [
    ["8650002", "Atividades de nutricionista e consultoria nutricional"],
    ["8650002", "Consultorio de nutricao e reeducacao alimentar"],
    ["8650002", "Serviços de nutricionista clinico"],
  ]],
  ["psicologia", [
    ["8650003", "Atividades de psicologia e psicoterapia"],
    ["8650003", "Consultorio de psicologo e psicoterapia"],
    ["8650003", "Clinica de psicologia clinica"],
  ]],
  ["tricologia", [
    ["8630506", "Clinica de tricologia e tratamento capilar clinico"],
    ["9602502", "Tricologia e tratamento de queda de cabelo"],
    ["9609208", "Serviços de tricologia capilar"],
  ]],
  ["medicina-integrativa", [
    ["8630501", "Clinica multidisciplinar de medicina integrativa"],
    ["8630502", "Medicina preventiva e clinica integrativa"],
    ["8630501", "Atividade medica ambulatorial integrativa"],
  ]],
  ["clinicas-medicas", [
    ["8630501", "Atividade medica ambulatorial clinica"],
    ["8630502", "Clinica medica geral e consultorio medico"],
    ["8630503", "Clinica medica ambulatorial com procedimentos"],
  ]],
  // Pet
  ["clinicas-veterinarias", [
    ["7500100", "Clinica veterinaria e atendimento veterinario"],
    ["7500100", "Atividades veterinarias para animais domesticos"],
    ["7500100", "Medicina veterinaria ambulatorial"],
  ]],
  ["pet-shops", [
    ["4789004", "Comercio varejista de racoes e acessorios pet"],
    ["4789004", "Pet shop comercio varejista de animais"],
    ["4789004", "Loja pet com artigos para animais domesticos"],
  ]],
  ["banho-e-tosa", [
    ["9609209", "Banho e tosa higiene e embelezamento de animais"],
    ["9609209", "Estetica animal banho e tosa"],
    ["9609209", "Serviços de higiene e embelezamento de animais domesticos"],
  ]],
  ["hotelaria-animal", [
    ["9609209", "Hotel para animais e hospedagem de animais"],
    ["9609209", "Creche pet e hotelaria animal"],
    ["9609209", "Hospedagem de animais domesticos"],
  ]],
  ["adestramento", [
    ["9609209", "Adestramento de caes e escola de adestramento"],
    ["9609209", "Serviços de comportamento animal e adestramento"],
    ["9609209", "Centro de adestramento de caes"],
  ]],
  // Automotivo
  ["concessionarias", [
    ["4511101", "Concessionaria de veiculos automotores novos"],
    ["4511102", "Representante comercial de veiculos automotores"],
    ["4511101", "Comercio de automoveis novos"],
  ]],
  ["seminovos", [
    ["4511103", "Comercio de veiculos usados e seminovos"],
    ["4511103", "Revenda de automoveis usados"],
    ["4511103", "Comercio varejista de veiculos seminovos"],
  ]],
  ["oficinas-mecanicas", [
    ["4520001", "Oficina mecanica manutencao e reparacao de veiculos"],
    ["4520001", "Serviços de mecanica automotiva"],
    ["4520002", "Serviços de manutencao de veiculos automotores"],
  ]],
  ["funilaria-pintura", [
    ["4520004", "Funilaria pintura de veiculos e lanternagem automotiva"],
    ["4520004", "Serviços de funilaria e pintura de veiculos"],
    ["4520004", "Lanternagem automotiva e funilaria"],
  ]],
  ["som-acessorios", [
    ["4530703", "Comercio varejista de acessorios para veiculos automotores"],
    ["4520007", "Instalacao de acessorios automotivos e som automotivo"],
    ["4530703", "Loja de som automotivo e acessorios"],
  ]],
  ["estetica-automotiva", [
    ["4520005", "Estetica automotiva polimento e vitrificacao"],
    ["4520005", "Serviços de higienizacao automotiva"],
    ["4520005", "Centro de estetica automotiva"],
  ]],
  ["postos-combustivel", [
    ["4731800", "Comercio varejista de combustiveis para veiculos"],
    ["4731800", "Posto de combustivel e gasolina"],
    ["4732600", "Comercio varejista de lubrificantes"],
  ]],
  // Imobiliário
  ["imobiliarias", [
    ["6821801", "Imobiliaria compra e venda de imoveis"],
    ["6821802", "Gestao e administracao de imoveis proprios"],
    ["6821801", "Intermediacao imobiliaria de imoveis"],
    ["6821801", "Corretagem de imoveis e corretor de imoveis"],
  ]],
  ["incorporadoras-varejo", [
    ["4110700", "Incorporacao de empreendimentos imobiliarios"],
    ["4110700", "Incorporadora imobiliaria residencial"],
    ["4110700", "Loteamento de imoveis e incorporacao"],
  ]],
  ["administradoras-condominio", [
    ["8112500", "Administracao de condominios e gestao condominial"],
    ["6822600", "Administradora de imoveis e condominios"],
    ["8112500", "Serviços de administracao de condominios"],
  ]],
  ["avaliacao-pericia", [
    ["6822600", "Avaliacao de imoveis e pericia imobiliaria"],
    ["7111100", "Serviços de laudo de avaliacao imobiliaria"],
    ["6822600", "Pericia imobiliaria e avaliacao patrimonial"],
  ]],
  // Varejo
  ["moda-vestuario", [
    ["4781400", "Comercio varejista de artigos do vestuario"],
    ["4781401", "Comercio varejista de moda feminina e masculina"],
    ["1412601", "Confeccao varejo e artigos do vestuario"],
  ]],
  ["calcados", [
    ["4782201", "Comercio varejista de calcados e acessorios"],
    ["4782201", "Sapataria e comercio de calcados"],
    ["1531901", "Fabricacao de calcados sob medida varejo"],
  ]],
  ["oticas", [
    ["4783101", "Comercio varejista de oculos optica e lentes oftalmicas"],
    ["4783102", "Optica e comercio de lentes oftalmicas"],
    ["4783101", "Loja de optica e artigos de optica"],
  ]],
  ["joalherias", [
    ["4789005", "Comercio varejista de joias joalheria e relojoaria"],
    ["4789005", "Joalheria e comercio de bijuterias"],
    ["3211601", "Fabricacao de joias e artigos de joalheria"],
  ]],
  ["moveis-decoracao", [
    ["4754701", "Comercio varejista de moveis e decoracao"],
    ["4754702", "Comercio varejista de artigos de mobiliario"],
    ["4754701", "Loja de moveis e artigos de decoracao"],
  ]],
  ["eletrodomesticos", [
    ["4755503", "Comercio varejista de eletrodomesticos e linha branca"],
    ["4753900", "Comercio varejista de eletroeletronicos varejo"],
    ["4755503", "Loja de eletrodomesticos e equipamentos"],
  ]],
  ["artigos-esportivos", [
    ["4763601", "Comercio varejista de artigos esportivos"],
    ["4763602", "Comercio varejista de artigos de camping"],
    ["4763601", "Loja de equipamentos esportivos"],
  ]],
  ["perfumaria-cosmeticos", [
    ["4772500", "Comercio varejista de cosmeticos e perfumaria"],
    ["4772500", "Perfumaria e produtos de higiene pessoal"],
    ["4772500", "Loja de cosmeticos e perfumaria"],
  ]],
  ["farmacias-drogarias", [
    ["4771701", "Comercio varejista de produtos farmaceuticos"],
    ["4771702", "Comercio varejista de produtos farmaceuticos homeopaticos"],
    ["4771701", "Farmacia e drogaria varejista"],
  ]],
  ["supermercados", [
    ["4711302", "Comercio varejista de mercadorias em geral supermercados"],
    ["4711301", "Hipermercados"],
    ["4712100", "Minimercados mercearias e armazens"],
  ]],
  ["academias", [
    ["9313100", "Atividades de condicionamento fisico academia"],
    ["9313100", "Academia de ginastica e musculacao"],
    ["9313100", "Centro de condicionamento fisico e gym"],
  ]],
  ["lavanderias", [
    ["9601701", "Lavanderias"],
    ["9601702", "Tinturarias"],
    ["9601703", "Toalheiros"],
  ]],
  // Alimentação
  ["restaurantes", [
    ["5611201", "Restaurante e servico de alimentacao completo"],
    ["5611201", "Restaurantes e refeicoes preparadas"],
    ["5611201", "Servico de alimentacao em restaurante"],
  ]],
  ["pizzarias", [
    ["5611201", "Pizzaria e fornecimento de pizza"],
    ["5611203", "Pizzaria e esfiharia lanchonete"],
    ["5611201", "Restaurante pizzaria"],
  ]],
  ["hamburguerias", [
    ["5611203", "Hamburgueria fast food hamburguer e lanches"],
    ["5611203", "Lanchonete hamburgueria"],
    ["5611203", "Lanches com hamburguer"],
  ]],
  ["buffets", [
    ["5620101", "Buffet fornecimento de alimentos preparados para eventos"],
    ["5620101", "Fornecimento de alimentos preparados self service"],
    ["5620101", "Buffet e catering para eventos"],
  ]],
  ["lanchonetes", [
    ["5611203", "Lanchonete sanduiches e salgados"],
    ["5611203", "Lanchonetes casas de sucos e lanches"],
    ["5611203", "Lanchonete e alimentacao rapida"],
  ]],
  ["bares", [
    ["5611204", "Bar servico de bebidas e casas noturnas"],
    ["5611204", "Bares e estabelecimentos de servir bebidas"],
    ["5611204", "Casa noturna e bar"],
  ]],
  // Educação
  ["escolas-particulares", [
    ["8513900", "Ensino fundamental ensino medio escola particular"],
    ["8511200", "Educacao infantil escola particular"],
    ["8513900", "Escola particular de ensino"],
  ]],
  ["cursos-livres", [
    ["8599604", "Curso livre treinamento profissionalizante"],
    ["8599605", "Cursos tecnicos livres e treinamento"],
    ["8599604", "Treinamento em desenvolvimento profissional"],
  ]],
  ["idiomas", [
    ["8591100", "Ensino de idiomas escola de linguas"],
    ["8591100", "Curso de ingles e ensino de idiomas"],
    ["8591100", "Escola de idiomas e linguas estrangeiras"],
  ]],
  ["pre-vestibular", [
    ["8599604", "Pre vestibular cursinho preparatorio"],
    ["8599604", "Preparacao para vestibular cursinho"],
    ["8599604", "Cursinho pre vestibular"],
  ]],
  ["autoescolas", [
    ["8599601", "Autoescola ensino para habilitacao"],
    ["8599601", "Centro de formacao de condutores autoescola"],
    ["8599601", "Autoescola e ensino de direcao"],
  ]],
  // Turismo
  ["hoteis", [
    ["5510801", "Hoteis hotelaria e hospedagem hotel"],
    ["5510802", "Hotel com serviços de hospedagem"],
    ["5510801", "Estabelecimento hoteleiro"],
  ]],
  ["pousadas", [
    ["5590601", "Pousada hospedagem pousada e alojamento turistico"],
    ["5590602", "Pousada e hospedagem turistica"],
    ["5590601", "Alojamento turistico pousada"],
  ]],
  ["agencias-viagem", [
    ["7911200", "Agencia de viagens operadora de turismo"],
    ["7911200", "Intermediacao turistica agencia de viagens"],
    ["7911200", "Agencia de viagens e turismo"],
  ]],
  ["receptivos-turismo", [
    ["7912100", "Receptivo turistico guia de turismo"],
    ["7912100", "Excursao passeios e receptivo turistico"],
    ["7912100", "Serviços de guia de turismo"],
  ]],
  ["locadoras-turismo", [
    ["7711000", "Locacao de veiculos turismo rent a car"],
    ["7711000", "Aluguel de veiculos para turistas"],
    ["7711000", "Locadora de veiculos turismo"],
  ]],
  // Indústria
  ["metalurgia", [
    ["2443100", "Metalurgia fundicao de metais e forjaria"],
    ["2599301", "Fabricacao de artefatos de metalurgia"],
    ["2539001", "Serviços de usinagem metalurgica industrial"],
  ]],
  ["quimica-industrial", [
    ["2062200", "Fabricacao de produtos quimicos industriais"],
    ["2063100", "Fabricacao de produtos quimicos de limpeza"],
    ["2019301", "Fabricacao de produtos quimicos organicos"],
  ]],
  ["plasticos-industrial", [
    ["2222600", "Fabricacao de artefatos de plastico industrial"],
    ["2229301", "Transformacao de plastico polimeros industriais"],
    ["2222600", "Industria de plastico e polimeros"],
  ]],
  ["alimentos-industrializados", [
    ["1096100", "Fabricacao de produtos alimenticios industrial"],
    ["1031700", "Industria alimenticia processamento de alimentos"],
    ["1099600", "Fabricacao de produtos alimenticios diversos"],
  ]],
  ["textil-industrial", [
    ["1412602", "Fabricacao de artefatos texteis confecao industrial"],
    ["1330800", "Fiacao e tecelagem industrial textil"],
    ["1412601", "Confecao industrial de vestuario"],
  ]],
  ["embalagens-industrial", [
    ["1731100", "Fabricacao de embalagens de papel industrial"],
    ["2222600", "Fabricacao de embalagens de plastico industrial"],
    ["1813001", "Fabricacao de rotulos e embalagens"],
  ]],
  ["moveleira-industrial", [
    ["3101200", "Fabricacao de moveis industria moveleira"],
    ["3103900", "Marcenaria industrial fabricacao de moveis"],
    ["3101200", "Industria moveleira e mobiliario"],
  ]],
  ["siderurgia", [
    ["2411300", "Siderurgia producao de aco"],
    ["2421100", "Laminacao de aco siderurgia"],
    ["2412100", "Producao de ferro gusa siderurgia"],
  ]],
  ["bebidas-industrial", [
    ["1121600", "Fabricacao de aguas envasadas industria de bebidas"],
    ["1113502", "Fabricacao de cervejas"],
    ["1122401", "Fabricacao de refrigerantes"],
  ]],
  ["aguas-envasadas", [
    ["1121600", "Fabricacao de aguas envasadas"],
    ["1121600", "Agua mineral envasada"],
    ["1121600", "Envasadora de agua mineral"],
  ]],
  ["cervejarias", [
    ["1113502", "Fabricacao de cervejas"],
    ["1113502", "Cervejaria artesanal"],
    ["1113501", "Fabricacao de malte"],
  ]],
  ["refrigerantes-sucos", [
    ["1122401", "Fabricacao de refrigerantes"],
    ["1122402", "Fabricacao de cha mate e outros chas prontos"],
    ["1122403", "Fabricacao de refrescos, xaropes e pos para refrescos"],
  ]],
  ["envasamento-empacotamento", [
    ["8299701", "Envasamento e empacotamento sob contrato"],
    ["8299701", "Empacotamento sob contrato"],
    ["8299701", "Servicos de envasamento sob contrato"],
  ]],
  // Construção civil
  ["construtoras-reformas", [
    ["4120400", "Construcao de edificios construtora e reformas"],
    ["4120400", "Construtora reformas e ampliacoes"],
    ["4399103", "Obras de acabamento em construcao civil"],
  ]],
  ["empreiteiras", [
    ["4399101", "Empreiteira execucao de obras"],
    ["4120400", "Subempreiteira de obras e construcao"],
    ["4399101", "Serviços de empreiteira de obras"],
  ]],
  ["engenharia-projetos", [
    ["7112000", "Serviços de engenharia projeto de engenharia civil"],
    ["7119701", "Consultoria em engenharia civil"],
    ["7112000", "Escritorio de engenharia e projetos"],
  ]],
  ["arquitetura-projetos", [
    ["7111100", "Serviços de arquitetura projeto arquitetonico"],
    ["7111100", "Escritorio de arquitetura e projetos"],
    ["7111100", "Projeto arquitetonico e arquitetura"],
  ]],
  ["reformas-residenciais", [
    ["4120400", "Construcao de edificios reformas residenciais"],
    ["4399103", "Obras de acabamento reformas residenciais"],
    ["4330404", "Obras de acabamento em pintura e reformas"],
  ]],
  ["obras-industriais", [
    ["4120400", "Construcao de edificios obras industriais e galpoes"],
    ["4299501", "Obras de engenharia civil industriais"],
    ["4211101", "Construcao de galpoes industriais"],
  ]],
  ["terraplanagem", [
    ["4313400", "Obras de terraplanagem"],
    ["4299501", "Obras de engenharia civil terraplanagem"],
    ["4313400", "Movimentacao de terra e terraplanagem"],
  ]],
  ["pavimentacao", [
    ["4211101", "Construcao de rodovias e ferrovias pavimentacao"],
    ["4292801", "Obras de urbanizacao asfalto e pavimentacao"],
    ["4211101", "Pavimentacao e asfalto"],
  ]],
  ["fundacoes", [
    ["4312600", "Obras de fundacoes"],
    ["4299501", "Obras de engenharia civil fundacoes e contencoes"],
    ["4312600", "Fundacoes profundas e estacas"],
  ]],
  ["instalacoes-hidraulicas", [
    ["4321500", "Instalacoes hidraulicas, sanitarias e de gas"],
    ["4322301", "Obras de instalacoes hidraulicas"],
    ["4321500", "Encanamento e instalacoes hidraulicas"],
  ]],
  ["instalacoes-eletricas", [
    ["4321300", "Instalacoes eletricas"],
    ["4322301", "Obras de instalacoes eletricas"],
    ["4321300", "Eletricista instalacoes eletricas prediais"],
  ]],
  ["impermeabilizacao-vazamentos", [
    ["4399102", "Impermeabilizacao em construcao civil"],
    ["4399103", "Obras de acabamento impermeabilizacao"],
    ["4321500", "Instalacoes hidraulicas sanitarias e de gas vazamentos"],
  ]],
  ["pintura-predial", [
    ["4330404", "Pintura para construcao civil"],
    ["4399103", "Obras de acabamento pintura predial"],
    ["4330404", "Pintura predial e fachadas"],
  ]],
  ["gesso-drywall", [
    ["4330405", "Obras de acabamento em gesso e estuque"],
    ["4399103", "Obras de acabamento gesso drywall"],
    ["4330405", "Instalacao de gesso e drywall"],
  ]],
  ["climatizacao", [
    ["4322302", "Instalacao e manutencao de sistemas centrais de ar condicionado"],
    ["4322303", "Instalacoes de sistema de ventilacao e refrigeracao"],
    ["4322302", "Climatizacao e ar condicionado predial"],
  ]],
  ["topografia", [
    ["7112000", "Serviços de engenharia topografia"],
    ["7119702", "Atividades tecnicas relacionadas a engenharia geotecnia"],
    ["7112000", "Topografia e geotecnia"],
  ]],
  ["paisagismo", [
    ["8130300", "Atividades paisagisticas"],
    ["7111100", "Serviços de arquitetura paisagismo"],
    ["8130300", "Projeto e execucao de paisagismo"],
  ]],
  ["design-interiores", [
    ["7410202", "Design de interiores"],
    ["7111100", "Serviços de arquitetura design de interiores"],
    ["7410202", "Projeto de interiores e decoracao"],
  ]],
  ["laudos-pericias-engenharia", [
    ["7112000", "Serviços de engenharia laudos e pericias"],
    ["7119702", "Atividades tecnicas relacionadas a engenharia pericias"],
    ["7112000", "Laudos tecnicos de engenharia"],
  ]],
  ["calculo-estrutural", [
    ["7112000", "Serviços de engenharia calculo estrutural"],
    ["7119701", "Consultoria em engenharia estrutural"],
    ["7112000", "Projeto estrutural e calculo"],
  ]],
  // Insumos construção
  ["marmorarias", [
    ["0810006", "Marmore e granito beneficiamento marmoraria"],
    ["2399101", "Marmoraria beneficiamento de pedras"],
    ["0810006", "Extracao e beneficiamento de marmore e granito"],
  ]],
  ["vidracarias", [
    ["4743100", "Vidracaria instalacao de vidros comercio de vidros planos"],
    ["2319200", "Fabricacao de vidros planos e vidracaria"],
    ["4743100", "Comercio varejista de vidros e esquadrias"],
  ]],
  ["esquadrias", [
    ["2512800", "Fabricacao de esquadrias de aluminio e pvc"],
    ["2512800", "Esquadrias de pvc e aluminio"],
    ["2512800", "Industria de esquadrias metalicas"],
  ]],
  ["depositos-material-construcao", [
    ["4744001", "Comercio varejista de material de construcao"],
    ["4744002", "Deposito de materiais de construcao"],
    ["4744001", "Comercio de materiais de construcao depot"],
  ]],
  ["serralherias", [
    ["2511000", "Serralheria fabricacao de estruturas metalicas"],
    ["2511000", "Fabricacao de portoes grades e serralheria"],
    ["2539001", "Serviços de serralheria industrial"],
  ]],
  ["acabamentos-revestimentos", [
    ["4744003", "Comercio de revestimentos ceramicos pisos e revestimentos"],
    ["2342701", "Fabricacao de revestimentos ceramicos"],
    ["4330403", "Acabamentos para construcao revestimentos"],
  ]],
  ["pre-moldados-concreto", [
    ["2330301", "Fabricacao de artefatos de concreto, cimento, fibrocimento, gesso e materiais semelhantes"],
    ["2330302", "Fabricacao de estruturas pre-moldadas de concreto armado"],
    ["2330301", "Pre-moldados e concreto para construcao"],
  ]],
  ["blocos-tijolos", [
    ["2330301", "Fabricacao de artefatos de concreto, cimento, fibrocimento, gesso e materiais semelhantes blocos"],
    ["2341900", "Fabricacao de produtos ceramicos nao-refratarios tijolos"],
    ["2330301", "Fabricacao de blocos e tijolos"],
  ]],
  ["ceramica-argila-telhas", [
    ["2341900", "Fabricacao de produtos ceramicos nao-refratarios para uso estrutural"],
    ["2342702", "Fabricacao de produtos ceramicos telhas e argila"],
    ["2341900", "Cerâmica telhas e argila"],
  ]],
  ["cimento-agregados", [
    ["2330305", "Fabricacao de cimento"],
    ["4671100", "Comercio atacadista de cimento"],
    ["2330305", "Cimento e agregados"],
  ]],
  ["areia-brita", [
    ["0810001", "Extracao de areia, cascalho ou pedregulho"],
    ["4744001", "Comercio varejista de materiais de construcao em geral areia brita"],
    ["0810001", "Areia e brita para construcao"],
  ]],
  ["tintas-vernizes", [
    ["4741500", "Comercio varejista de tintas e materiais para pintura"],
    ["2031200", "Fabricacao de tintas, vernizes, esmaltes"],
    ["4741500", "Tintas e vernizes para obra"],
  ]],
  ["pisos-porcelanatos", [
    ["4744003", "Comercio varejista de pedras para revestimento pisos"],
    ["4744001", "Comercio varejista de material de construcao porcelanato"],
    ["2342701", "Fabricacao de revestimentos ceramicos pisos"],
  ]],
  ["loucas-metais-sanitarios", [
    ["4744004", "Comercio varejista de materiais hidraulicos"],
    ["4744001", "Comercio varejista de material de construcao loucas"],
    ["4744004", "Loucas e metais sanitarios"],
  ]],
  ["madeira-compensados", [
    ["4744005", "Comercio varejista de madeiras e artefatos"],
    ["1610201", "Serrarias com desdobramento de madeira"],
    ["4744005", "Madeira e compensados para obra"],
  ]],
  ["telhas-coberturas", [
    ["2330303", "Fabricacao de artefatos de fibrocimento telhas"],
    ["4744001", "Comercio varejista de materiais de construcao em geral telhas"],
    ["2330303", "Telhas e coberturas"],
  ]],
  ["argamassas-rejunte", [
    ["2330301", "Fabricacao de artefatos de concreto, cimento, fibrocimento, gesso e materiais semelhantes argamassa"],
    ["4744001", "Comercio varejista de materiais de construcao em geral rejunte"],
    ["2330301", "Argamassas e rejunte"],
  ]],
  ["drywall-placas", [
    ["2330304", "Fabricacao de produtos de gesso"],
    ["4744001", "Comercio varejista de materiais de construcao em geral drywall"],
    ["2330304", "Drywall e placas de gesso"],
  ]],
  ["portas-portoes", [
    ["1622601", "Fabricacao de portas, janelas e outros elementos"],
    ["2511000", "Serralheria, exceto esquadrias portoes"],
    ["1622601", "Portas e portoes"],
  ]],
  ["ferragens-parafusos", [
    ["4744002", "Comercio varejista de ferragens e ferramentas"],
    ["4744002", "Ferragens e parafusos para construcao"],
    ["4744002", "Loja de ferragens"],
  ]],
  ["isolamento-termico", [
    ["2229301", "Fabricacao de produtos de material plastico isolamento"],
    ["4744001", "Comercio varejista de materiais de construcao em geral isolamento"],
    ["2229301", "Isolamento termico e acustico"],
  ]],
  ["epis-obra", [
    ["4781400", "Comercio varejista de artigos de vestuario epi"],
    ["4759801", "Comercio varejista de equipamentos e artigos de uso pessoal e domestico"],
    ["4781400", "EPIs de obra e seguranca"],
  ]],
  // Contabilidade e jurídico
  ["escritorios-contabeis", [
    ["6920601", "Contabilidade escritorio de contabilidade servicos contabeis"],
    ["6920602", "Auditoria contabil e serviços contabeis"],
    ["6920601", "Escritorio de contabilidade e auditoria"],
  ]],
  ["advocacia", [
    ["6911701", "Advocacia servicos advocaticios escritorio de advocacia"],
    ["6911702", "Consultoria juridica e servicos advocaticios"],
    ["6911701", "Escritorio de advocacia empresarial"],
  ]],
  ["consultoria-empresarial", [
    ["7020400", "Consultoria em gestao empresarial assessoria empresarial"],
    ["7020400", "Consultoria administrativa e gestao empresarial"],
    ["7020400", "Assessoria empresarial e consultoria"],
  ]],
  // Tech
  ["desenvolvimento-sob-encomenda", [
    ["6201501", "Desenvolvimento de programas de computador sob encomenda"],
    ["6201502", "Desenvolvimento de sistemas software sob medida"],
    ["6201501", "Software sob medida desenvolvimento de sistemas"],
  ]],
  ["saas-plataformas", [
    ["6202300", "Licenciamento de programas software como servico plataforma digital"],
    ["6203100", "Desenvolvimento de plataforma digital SaaS"],
    ["6202300", "Software como servico e licenciamento"],
  ]],
  ["ti-suporte", [
    ["6204000", "Consultoria em tecnologia da informacao suporte tecnico em ti"],
    ["9511800", "Manutencao de equipamentos de informatica suporte ti"],
    ["6209100", "Suporte tecnico em ti e consultoria"],
  ]],
  ["hospedagem-dados", [
    ["6311900", "Hospedagem na internet processamento de dados data center"],
    ["6319400", "Data center e cloud hospedagem de dados"],
    ["6311900", "Tratamento de dados e hospedagem na internet"],
  ]],
  // Logística
  ["transportadoras-carga", [
    ["4930202", "Transporte rodoviario de carga transportadora de cargas"],
    ["4930201", "Transporte rodoviario de carga frete rodoviario"],
    ["4930202", "Transportadora de cargas frete"],
  ]],
  ["armazenagem", [
    ["5211701", "Armazenamento guarda de mercadorias operador logistico armazem"],
    ["5211702", "Armazens gerais e armazenagem"],
    ["5211701", "Serviços de armazenagem logistica"],
  ]],
  ["distribuidoras-atacado", [
    ["4649408", "Comercio atacadista distribuidora de mercadorias"],
    ["4691500", "Atacado e distribuicao de produtos"],
    ["4649401", "Distribuidora atacado e distribuicao"],
  ]],
  ["last-mile-entregas", [
    ["5320201", "Entrega urbana de mercadorias last mile courier"],
    ["5320202", "Serviços de entregas rapidas last mile"],
    ["5320201", "Courier e entregas urbanas"],
  ]],
  // Financeiro
  ["corretoras-seguros", [
    ["6622300", "Corretagem de seguros corretora de seguros"],
    ["6622300", "Intermediacao de seguros corretora"],
    ["6622300", "Corretora de seguros empresariais"],
  ]],
  ["assessorias-investimento", [
    ["6619302", "Assessoria de investimentos consultoria financeira"],
    ["6619302", "Gestao de patrimonio consultoria financeira"],
    ["6619302", "Consultoria financeira e investimentos"],
  ]],
  ["credito-fomento", [
    ["6491300", "Concessao de credito fomento mercantil"],
    ["6491300", "Financiamento empresarial fomento mercantil"],
    ["6492100", "Sociedades de credito e fomento"],
  ]],
  ["factoring", [
    ["6491300", "Factoring antecipacao de recebiveis"],
    ["6491300", "Securitizacao de creditos factoring"],
    ["6491300", "Serviços de factoring empresarial"],
  ]],
];

// Extra generic CNAEs to reach ~280 unique codes
const EXTRA_CNAES = [
  ["9602501", "Cabeleireiros manicure pedicure e podologia"],
  ["8630501", "Atividade medica ambulatorial clinica"],
  ["4520003", "Serviços de borracharia para veiculos automotores"],
  ["4541201", "Comercio por atacado de motocicletas e motonetas"],
  ["4543900", "Comercio por atacado de motocicletas"],
  ["6810202", "Aluguel de imoveis proprios"],
  ["6821802", "Aluguel e gestao de imoveis"],
  ["4771701", "Comercio varejista de produtos farmaceuticos"],
  ["5611202", "Serviços de alimentacao para eventos"],
  ["8592903", "Ensino de artes e cultura"],
  ["5510803", "Apart-hotel e hospedagem"],
  ["2599302", "Serviços de tratamento termico de metais"],
  ["2013401", "Fabricacao de adubos e fertilizantes quimicos"],
  ["2229302", "Fabricacao de tubos e conexoes de plastico"],
  ["1071600", "Fabricacao de acucar industria alimenticia"],
  ["1351100", "Fabricacao de artefatos de malha textil"],
  ["1741901", "Fabricacao de embalagens de papelao"],
  ["3102100", "Fabricacao de colchoaria industria moveleira"],
  ["2422901", "Producao de tubos de aco siderurgia"],
  ["4211101", "Construcao de rodovias e ferrovias"],
  ["4399104", "Montagem e desmontagem de andaimes"],
  ["2391501", "Fabricacao de artefatos de cimento construcao"],
  ["4741500", "Comercio varejista de tintas e vernizes"],
  ["6920603", "Pericia contabil e serviços contabeis"],
  ["6911703", "Cartorios e servicos notariais"],
  ["6201503", "Desenvolvimento de aplicativos moveis"],
  ["6311901", "Provedores de acesso a internet"],
  ["4940000", "Transporte rodoviario de produtos perigosos"],
  ["5211799", "Deposito de mercadorias para terceiros"],
  ["6612601", "Administracao de cartoes de credito"],
  ["9609201", "Clinicas de estética e similares"],
  ["9609203", "Alojamento, higiene e embelezamento de animais"],
  ["9609207", "Alojamento de animais domésticos"],
  ["4330404", "Serviços de pintura de edifícios em geral"],
  ["4329105", "Tratamentos térmicos, acústicos ou de vibração"],
  ["4330401", "Impermeabilização em obras de engenharia civil"],
  ["3292201", "Fabricação de roupas de proteção e segurança e resistentes a fogo"],
  ["3292202", "Fabricação de equipamentos e acessórios para segurança pessoal e profissional"],
  ["4642702", "Comércio atacadista de roupas e acessórios para uso profissional e de segurança do trabalho"],
  ["6438701", "Bancos de câmbio"],
  ["7319003", "Marketing direto"],
  ["8011101", "Serviços de adestramento de cães de guarda"],
  ["4322302", "Instalação e manutenção de sistemas centrais de ar condicionado, de ventilação e refrigeração"],
];

const seen = new Set();
const entries = [];

function add(code, desc) {
  const key = code + "|" + desc;
  if (seen.has(key)) return;
  seen.add(key);
  entries.push({ codigo: code, descricao: desc });
}

for (const [, list] of SEGMENT_CNAES) {
  for (const [code, desc] of list) add(code, desc);
}
for (const [code, desc] of EXTRA_CNAES) add(code, desc);

console.error("Total CNAEs:", entries.length);

const out = `import type { RefCnae } from "@/lib/types";

/** ~${entries.length} CNAE codes aligned with TAXONOMY segment keywords. */
export const REF_CNAE: RefCnae[] = ${JSON.stringify(entries, null, 2)};

export type RefCnaeCode = (typeof REF_CNAE)[number]["codigo"];
`;

writeFileSync(join(__dirname, "../src/lib/data/cnae-catalog.ts"), out, "utf8");
console.error("Written cnae-catalog.ts");
