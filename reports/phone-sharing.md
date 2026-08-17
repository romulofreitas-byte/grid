# Relatório — telefones compartilhados

Gerado em 2026-08-13.

> **MOCK — ingestão MG/SP da Receita não foi executada.**
> Não há `DATABASE_URL` com a base real. Os números abaixo vêm do store
> sintético (5.000 estabelecimentos). O limiar de 3 CNPJs **não está**
> validado contra dado real. Rode de novo depois de `pnpm ingest --ufs=MG,SP`.

## 1. Distribuição

Total de números distintos: **4345**.

| CNPJs por telefone | Quantidade de telefones |
| --- | ---: |
| 1 | 4317 |
| 2 | 0 |
| 3 | 0 |
| 4-5 | 0 |
| 6-10 | 1 |
| 11-50 | 27 |
| 50+ | 0 |

## 2. Limiar recomendado

No mock, o corte atual de **3 CNPJs** separa o telefone do escritório (centenas de CNPJs, sócios disjuntos) do telefone próprio. **Não dá para recomendar 3, 4 ou 8 com esta amostra.** A hipótese central do produto continua não verificada contra MG/SP reais.

## 3. Contabilidade × grupo econômico

- Compartilhados (≥3): **28**
- Verdict `contabilidade`: **27**
- Verdict `grupo_economico`: **1**
- Selos que mudam com a regra de sócios: **1** telefones deixam de ser Contabilidade e passam a Grupo.

Caso demonstrado (mesmo sócio, vários CNPJs):

- (31) 3222-1111 em 8 empresas
  - ADESTRA INOCENCI 62 EIRELI · Inocência/MS
  - AUTO FORTDE 04 LTDA · Fortaleza de Minas/MG
  - SEMI SALVATER 27 S/A · Salvaterra/PA
  - MECAN SAOJOSE 54 S/A · São José do Bonfim/PB
  - FUNIL CURITIBA 83 S/A · Curitiba/PR
  - ACESS IGUARACY 38 S/A · Iguaracy/PE
  - DETAIL TERESINA 36 LTDA · Teresina/PI
  - REALTY PORTREAL 04 S/A · Porto Real/RJ

No mock este cluster é o intervalo de índices 200–207 (sócia Helena Vargas Silva, telefone 3222-1111).

## 4. Falsos positivos previsíveis (checagem manual)

Além de grupo econômico, a amostra dos 50 deve ser lida olhando para:

- Rede de franquias com central de atendimento
- Condomínio empresarial / shopping com telefone único
- Call center terceirizado

Esses casos **não** são separados automaticamente pela sobreposição de sócios.

## 5. Amostra dos 50 telefones mais compartilhados

### 1. (89) 3333-4444 — 36 CNPJs · `contabilidade`
  - GOLD BOCAINA 16 S/A · Bocaina/PI · Fabricacao de joias e artigos de joalheria
  - TI BERTOLIN 66 S/A · Bertolínia/PI · Suporte tecnico em ti e consultoria
  - SNACK BAIXGRAN 46 LTDA · Baixa Grande do Ribeiro/PI · Pizzaria e esfiharia lanchonete
  - ESQUAD TERESINA 15 EIRELI · Teresina/PI · Fabricacao de esquadrias de aluminio e pvc
  - JOIA BOAHORA 42 LTDA · Boa Hora/PI · Fabricacao de joias e artigos de joalheria
  - DETAIL SIMPMEND 22 EIRELI · Simplício Mendes/PI · Estetica automotiva polimento e vitrificacao
  - TI DOMIMOUR 19 EIRELI · Domingos Mourão/PI · Suporte tecnico em ti e consultoria
  - GOLD TERESINA 30 S/A · Teresina/PI · Fabricacao de joias e artigos de joalheria
  - LANCH TERESINA 63 LTDA · Teresina/PI · Pizzaria e esfiharia lanchonete
  - TRAVEL TERESINA 25 S/A · Teresina/PI · Agencia de viagens operadora de turismo

### 2. (77) 3333-4444 — 30 CNPJs · `contabilidade`
  - MENTE JUCURUCU 82 LTDA · Jucuruçu/BA · Atividades de psicologia e psicoterapia
  - PREVEST SALVADOR 87 S/A · Salvador/BA · Curso livre treinamento profissionalizante
  - MICRO ALCOBACA 48 S/A · Alcobaça/BA · Atividades de estética e beleza com clinica de estetica
  - DELIVERY ANGICAL 66 S/A · Angical/BA · Serviços de entregas rapidas last mile
  - AVALIA AURELEAL 02 LTDA · Aurelino Leal/BA · Serviços de laudo de avaliacao imobiliaria
  - USADOS TERRNOVA 63 LTDA · Terra Nova/BA · Comercio de veiculos usados e seminovos
  - CURSINHO SALVADOR 58 LTDA · Salvador/BA · Curso livre treinamento profissionalizante
  - ADV NOVOHORI 39 S/A · Novo Horizonte/BA · Consultoria juridica e servicos advocaticios
  - REST PINDOBAC 13 EIRELI · Pindobaçu/BA · Restaurante e servico de alimentacao completo
  - DELIVERY SALVADOR 43 LTDA · Salvador/BA · Serviços de entregas rapidas last mile

### 3. (92) 3333-4444 — 29 CNPJs · `contabilidade`
  - COSM MANAUS 56 LTDA · Manaus/AM · Comercio varejista de cosmeticos e perfumaria
  - ATAC RIOPRET 86 S/A · Rio Preto da Eva/AM · Comercio atacadista distribuidora de mercadorias
  - LANG BARCELOS 30 S/A · Barcelos/AM · Ensino de idiomas escola de linguas
  - LANG BORBA 32 EIRELI · Borba/AM · Ensino de idiomas escola de linguas
  - HAIR MANAUS 30 S/A · Manaus/AM · Cabeleireiros e salao de beleza premium
  - QUIMIBRAS APUI 43 S/A · Apuí/AM · Fabricacao de produtos quimicos industriais
  - PERFUM MANAUS 62 LTDA · Manaus/AM · Comercio varejista de cosmeticos e perfumaria
  - SINTESE QUIMICA CAREIRO 14 EIRELI · Careiro/AM · Fabricacao de produtos quimicos industriais
  - COSM MANAUS 21 S/A · Manaus/AM · Comercio varejista de cosmeticos e perfumaria
  - OBRAS CARAUARI 09 S/A · Carauari/AM · Empreiteira execucao de obras

### 4. (94) 3333-4444 — 29 CNPJs · `contabilidade`
  - LASTMILE AUGUCORR 51 S/A · Augusto Corrêa/PA · Serviços de entregas rapidas last mile
  - PROJET BELEM 50 S/A · Belém/PA · Consultoria em engenharia civil
  - SEMI BELEM 33 LTDA · Belém/PA · Comercio de veiculos usados e seminovos
  - CURSINHO OUREM 72 EIRELI · Ourém/PA · Curso livre treinamento profissionalizante
  - PIGMENT BELEM 44 EIRELI · Belém/PA · Atividades de estética e beleza com clinica de estetica
  - ADV SANTMARI 10 EIRELI · Santa Maria das Barreiras/PA · Consultoria juridica e servicos advocaticios
  - DELIVERY BELEM 35 LTDA · Belém/PA · Serviços de entregas rapidas last mile
  - SEMI BELEM 82 EIRELI · Belém/PA · Comercio de veiculos usados e seminovos
  - PREVEST SAOCAET 87 S/A · São Caetano de Odivelas/PA · Curso livre treinamento profissionalizante
  - REST TERRSANT 76 S/A · Terra Santa/PA · Restaurante e servico de alimentacao completo

### 5. (79) 3333-4444 — 28 CNPJs · `contabilidade`
  - VET MACAMBIR 44 LTDA · Macambira/SE · Clinica veterinaria e atendimento veterinario
  - VIDRO ARAUA 41 S/A · Arauá/SE · Vidracaria instalacao de vidros comercio de vidros planos
  - SAAS SIMADIAS 62 EIRELI · Simão Dias/SE · Desenvolvimento de plataforma digital SaaS
  - PETCARE ARACAJU 54 S/A · Aracaju/SE · Clinica veterinaria e atendimento veterinario
  - VET ARACAJU 02 LTDA · Aracaju/SE · Clinica veterinaria e atendimento veterinario
  - VET ARACAJU 27 EIRELI · Aracaju/SE · Clinica veterinaria e atendimento veterinario
  - GLASS CARMOPOL 58 S/A · Carmópolis/SE · Vidracaria instalacao de vidros comercio de vidros planos
  - ACESS CAMPDO 61 EIRELI · Campo do Brito/SE · Instalacao de acessorios automotivos e som automotivo
  - CLOUD ARACAJU 15 S/A · Aracaju/SE · Desenvolvimento de plataforma digital SaaS
  - GLASS ARACAJU 61 S/A · Aracaju/SE · Vidracaria instalacao de vidros comercio de vidros planos

### 6. (84) 3333-4444 — 28 CNPJs · `contabilidade`
  - PET HOTEL TOUROS 11 EIRELI · Touros/RN · Banho e tosa higiene e embelezamento de animais
  - FERRO NATAL 68 EIRELI · Natal/RN · Serralheria fabricacao de estruturas metalicas
  - HOME MAXARANG 60 S/A · Maxaranguape/RN · Comercio varejista de eletroeletronicos varejo
  - RENT SAOFERN 09 LTDA · São Fernando/RN · Locacao de veiculos turismo rent a car
  - HOME NATAL 17 LTDA · Natal/RN · Comercio varejista de eletroeletronicos varejo
  - FACIAL NATAL 69 EIRELI · Natal/RN · Atividades de estética e beleza com clinica de estetica
  - CARGA MESSTARG 35 S/A · Messias Targino/RN · Transporte rodoviario de carga frete rodoviario
  - CONSTR NATAL 23 EIRELI · Natal/RN · Construcao de edificios construtora e reformas
  - OFTALMO ACARI 12 EIRELI · Acari/RN · Clinica oftalmologica e serviços de oftalmologia
  - BUILD NATAL 24 S/A · Natal/RN · Construcao de edificios construtora e reformas

### 7. (63) 3333-4444 — 28 CNPJs · `contabilidade`
  - ESQUAD OLIVDE 11 EIRELI · Oliveira de Fátima/TO · Fabricacao de esquadrias de aluminio e pvc
  - DERMA ANGICO 62 LTDA · Angico/TO · Serviços de dermatologia e medicina estetica ambulatorial
  - RECEB ARAGUACE 38 LTDA · Araguacema/TO · Concessao de credito fomento mercantil
  - SNACK TALISMA 35 S/A · Talismã/TO · Pizzaria e esfiharia lanchonete
  - TRAVEL MONTDO 70 EIRELI · Monte do Carmo/TO · Agencia de viagens operadora de turismo
  - SNACK PIUM 17 EIRELI · Pium/TO · Pizzaria e esfiharia lanchonete
  - PET PALMAS 50 EIRELI · Palmas/TO · Comercio varejista de racoes e acessorios pet
  - DERMA PALMAS 62 LTDA · Palmas/TO · Serviços de dermatologia e medicina estetica ambulatorial
  - JOIA LIZARDA 50 LTDA · Lizarda/TO · Fabricacao de joias e artigos de joalheria
  - FACTOR COUTMAGA 53 EIRELI · Couto Magalhães/TO · Concessao de credito fomento mercantil

### 8. (95) 3333-4444 — 27 CNPJs · `contabilidade`
  - CURSINHO ALTOALEG 16 EIRELI · Alto Alegre/RR · Curso livre treinamento profissionalizante
  - ENG UIRAMUTA 84 EIRELI · Uiramutã/RR · Consultoria em engenharia civil
  - LAUDO RORAINOP 76 LTDA · Rorainópolis/RR · Serviços de laudo de avaliacao imobiliaria
  - USADOS IRACEMA 89 S/A · Iracema/RR · Comercio de veiculos usados e seminovos
  - JURID BOAVIST 04 EIRELI · Boa Vista/RR · Consultoria juridica e servicos advocaticios
  - CURSINHO BOAVIST 55 EIRELI · Boa Vista/RR · Curso livre treinamento profissionalizante
  - JURID SAOJOAO 27 S/A · São João da Baliza/RR · Consultoria juridica e servicos advocaticios
  - PIGMENT PACARAIM 13 S/A · Pacaraima/RR · Atividades de estética e beleza com clinica de estetica
  - LASTMILE BOAVIST 76 EIRELI · Boa Vista/RR · Serviços de entregas rapidas last mile
  - DELIVERY ALTOALEG 02 LTDA · Alto Alegre/RR · Serviços de entregas rapidas last mile

### 9. (85) 3333-4444 — 26 CNPJs · `contabilidade`
  - NAILS FORTALEZ 01 S/A · Fortaleza/CE · Atividades de estética e beleza com clinica de estetica
  - FASHION TURURU 35 S/A · Tururu/CE · Confeccao varejo e artigos do vestuario
  - GESTAO FORTALEZ 45 EIRELI · Fortaleza/CE · Consultoria em gestao empresarial assessoria empresarial
  - PODO CAMOCIM 73 S/A · Camocim/CE · Cabeleireiros e salao de beleza premium
  - TRICO JAGUARET 63 S/A · Jaguaretama/CE · Atividades de tratamento de beleza capilar
  - DESIGN ERERE 07 S/A · Ereré/CE · Serviços de laudo de avaliacao imobiliaria
  - MODA BARREIRA 07 LTDA · Barreira/CE · Confeccao varejo e artigos do vestuario
  - CORRET VARJOTA 71 LTDA · Varjota/CE · Corretagem de seguros corretora de seguros
  - TRICO FORTALEZ 27 EIRELI · Fortaleza/CE · Atividades de tratamento de beleza capilar
  - CNH ITAITING 53 LTDA · Itaitinga/CE · Autoescola ensino para habilitacao

### 10. (87) 3333-4444 — 26 CNPJs · `contabilidade`
  - VET CUSTODIA 65 LTDA · Custódia/PE · Clinica veterinaria e atendimento veterinario
  - VIDRO SANTTERE 69 EIRELI · Santa Terezinha/PE · Vidracaria instalacao de vidros comercio de vidros planos
  - CRED RECIFE 47 EIRELI · Recife/PE · Concessao de credito fomento mercantil
  - PETCARE OROBO 39 S/A · Orobó/PE · Clinica veterinaria e atendimento veterinario
  - OPTICA RECIFE 84 EIRELI · Recife/PE · Optica e comercio de lentes oftalmicas
  - PACK VERDEJAN 18 LTDA · Verdejante/PE · Fabricacao de artefatos de plastico industrial
  - BUFFET RECIFE 17 S/A · Recife/PE · Buffet fornecimento de alimentos preparados para eventos
  - ORTO BOMJARD 67 EIRELI · Bom Jardim/PE · Cirurgia ortopedica ambulatorial especializada
  - OPTICA LAGODO 01 EIRELI · Lagoa do Carro/PE · Optica e comercio de lentes oftalmicas
  - HOST RECIFE 14 EIRELI · Recife/PE · Pousada e hospedagem turistica

### 11. (19) 3333-4444 — 26 CNPJs · `contabilidade`
  - FUNIL MONTMOR 56 EIRELI · Monte Mor/SP · Funilaria pintura de veiculos e lanternagem automotiva
  - TEXTIL BORA 20 LTDA · Borá/SP · Fabricacao de artefatos texteis confecao industrial
  - FUNIL SAOPAUL 72 LTDA · São Paulo/SP · Funilaria pintura de veiculos e lanternagem automotiva
  - SOFT LAGOINHA 25 LTDA · Lagoinha/SP · Desenvolvimento de sistemas software sob medida
  - PINT OCAUCU 54 EIRELI · Ocauçu/SP · Funilaria pintura de veiculos e lanternagem automotiva
  - VITA UBARANA 16 S/A · Ubarana/SP · Consultorio de dermatologista
  - HOTEL SAOPAUL 04 LTDA · São Paulo/SP · Hoteis hotelaria e hospedagem hotel
  - INTEGRA SAOPAUL 68 LTDA · São Paulo/SP · Consultorio de dermatologista
  - SPA BEBEDOUR 55 S/A · Bebedouro/SP · Spa day spa e massagem relaxante
  - INN LUIZIANI 71 EIRELI · Luiziânia/SP · Hoteis hotelaria e hospedagem hotel

### 12. (82) 3333-4444 — 25 CNPJs · `contabilidade`
  - HARMON JUNDIA 07 EIRELI · Jundiá/AL · Atividades de estética e beleza com clinica de estetica
  - COLEGIO MACEIO 25 EIRELI · Maceió/AL · Educacao infantil escola particular
  - BUILD MACEIO 69 LTDA · Maceió/AL · Construcao de edificios construtora e reformas
  - HARMON MACEIO 16 S/A · Maceió/AL · Atividades de estética e beleza com clinica de estetica
  - BROKER PINDOBA 09 EIRELI · Pindoba/AL · Imobiliaria compra e venda de imoveis
  - RENT CRAIBAS 74 S/A · Craíbas/AL · Locacao de veiculos turismo rent a car
  - HARMON OLHOD'AG 83 S/A · Olho d'Água Grande/AL · Atividades de estética e beleza com clinica de estetica
  - TRANS MARAGOGI 41 EIRELI · Maragogi/AL · Transporte rodoviario de carga frete rodoviario
  - COLEGIO MACEIO 84 EIRELI · Maceió/AL · Educacao infantil escola particular
  - BROKER ROTEIRO 24 EIRELI · Roteiro/AL · Imobiliaria compra e venda de imoveis

### 13. (27) 3333-4444 — 25 CNPJs · `contabilidade`
  - ORTO VILAVALE 48 LTDA · Vila Valério/ES · Cirurgia ortopedica ambulatorial especializada
  - GLASS MUCURICI 39 S/A · Mucurici/ES · Vidracaria instalacao de vidros comercio de vidros planos
  - OSSO BREJETUB 17 S/A · Brejetuba/ES · Cirurgia ortopedica ambulatorial especializada
  - FOMENTO VITORIA 43 S/A · Vitória/ES · Concessao de credito fomento mercantil
  - VISUAL VITORIA 37 EIRELI · Vitória/ES · Optica e comercio de lentes oftalmicas
  - CLOUD VITORIA 36 EIRELI · Vitória/ES · Desenvolvimento de plataforma digital SaaS
  - BUFFET VITORIA 03 LTDA · Vitória/ES · Buffet fornecimento de alimentos preparados para eventos
  - EVENT ITAGUACU 10 S/A · Itaguaçu/ES · Buffet fornecimento de alimentos preparados para eventos
  - GLASS DIVIDE 49 LTDA · Divino de São Lourenço/ES · Vidracaria instalacao de vidros comercio de vidros planos
  - CLOUD NOVAVENE 79 EIRELI · Nova Venécia/ES · Desenvolvimento de plataforma digital SaaS

### 14. (22) 3333-4444 — 25 CNPJs · `contabilidade`
  - PETSPA TRESRIOS 88 S/A · Três Rios/RJ · Banho e tosa higiene e embelezamento de animais
  - PETSPA SAQUAREM 60 LTDA · Saquarema/RJ · Banho e tosa higiene e embelezamento de animais
  - RECEPT NILOPOLI 74 EIRELI · Nilópolis/RJ · Receptivo turistico guia de turismo
  - ODONTO AREAL 05 LTDA · Areal/RJ · Clinica odontologica e atividade odontologica
  - IMOB RIODE 63 EIRELI · Rio de Janeiro/RJ · Imobiliaria compra e venda de imoveis
  - TOUR RIODE 14 LTDA · Rio de Janeiro/RJ · Receptivo turistico guia de turismo
  - DATA MACUCO 19 LTDA · Macuco/RJ · Hospedagem na internet processamento de dados data center
  - DRINK JAPERI 45 S/A · Japeri/RJ · Bar servico de bebidas e casas noturnas
  - RECEPT BOMJARD 24 LTDA · Bom Jardim/RJ · Receptivo turistico guia de turismo
  - DATA CANTAGAL 01 EIRELI · Cantagalo/RJ · Hospedagem na internet processamento de dados data center

### 15. (67) 3333-4444 — 25 CNPJs · `contabilidade`
  - URBAN COROSAPU 02 EIRELI · Coronel Sapucaia/MS · Incorporacao de empreendimentos imobiliarios
  - FIT AGUACLAR 66 EIRELI · Água Clara/MS · Comercio varejista de artigos esportivos
  - METALURG BONITO 51 LTDA · Bonito/MS · Metalurgia fundicao de metais e forjaria
  - ARMAZ CAMPGRAN 58 LTDA · Campo Grande/MS · Armazenamento guarda de mercadorias operador logistico armazem
  - REAB CAARAPO 86 LTDA · Caarapó/MS · Clinica de podologia e cuidados com os pes
  - METAL MG CAMAPUA 40 S/A · Camapuã/MS · Metalurgia fundicao de metais e forjaria
  - ARMAZ TACURU 64 S/A · Tacuru/MS · Armazenamento guarda de mercadorias operador logistico armazem
  - FIT AGUACLAR 32 LTDA · Água Clara/MS · Comercio varejista de artigos esportivos
  - CANINO CAMPGRAN 19 S/A · Campo Grande/MS · Banho e tosa higiene e embelezamento de animais
  - INCORP NOVAANDR 07 LTDA · Nova Andradina/MS · Incorporacao de empreendimentos imobiliarios

### 16. (64) 3333-4444 — 25 CNPJs · `contabilidade`
  - FACTOR GOIANIA 49 S/A · Goiânia/GO · Concessao de credito fomento mercantil
  - VIAGEM FAZENOVA 80 EIRELI · Fazenda Nova/GO · Agencia de viagens operadora de turismo
  - RECEB GOIANIA 44 EIRELI · Goiânia/GO · Concessao de credito fomento mercantil
  - PETSHOP RIANAPOL 10 LTDA · Rianápolis/GO · Comercio varejista de racoes e acessorios pet
  - PELE SANTRITA 53 S/A · Santa Rita do Araguaia/GO · Serviços de dermatologia e medicina estetica ambulatorial
  - PETSHOP GOIANIA 86 S/A · Goiânia/GO · Comercio varejista de racoes e acessorios pet
  - GOLD BONOPOLI 21 EIRELI · Bonópolis/GO · Fabricacao de joias e artigos de joalheria
  - GOLD GOIANIA 43 EIRELI · Goiânia/GO · Fabricacao de joias e artigos de joalheria
  - DETAIL MOIPORA 85 EIRELI · Moiporá/GO · Estetica automotiva polimento e vitrificacao
  - TRAVEL GOIANIA 86 S/A · Goiânia/GO · Agencia de viagens operadora de turismo

### 17. (61) 3333-4444 — 24 CNPJs · `contabilidade`
  - CALCADO BRASILIA 68 S/A · Brasília/DF · Comercio varejista de calcados e acessorios
  - WEALTH BRASILIA 43 S/A · Brasília/DF · Assessoria de investimentos consultoria financeira
  - MARMOR BRASILIA 77 EIRELI · Brasília/DF · Marmore e granito beneficiamento marmoraria
  - TECIDO BRASILIA 18 S/A · Brasília/DF · Fabricacao de artefatos texteis confecao industrial
  - INVEST BRASILIA 26 S/A · Brasília/DF · Assessoria de investimentos consultoria financeira
  - HOTEL BRASILIA 12 LTDA · Brasília/DF · Hoteis hotelaria e hospedagem hotel
  - INTEGRA BRASILIA 60 EIRELI · Brasília/DF · Consultorio de dermatologista
  - DEV BRASILIA 45 LTDA · Brasília/DF · Desenvolvimento de sistemas software sob medida
  - TEXTIL BRASILIA 20 S/A · Brasília/DF · Fabricacao de artefatos texteis confecao industrial
  - CALCADO BRASILIA 06 EIRELI · Brasília/DF · Comercio varejista de calcados e acessorios

### 18. (69) 3333-4444 — 24 CNPJs · `contabilidade`
  - CONTAB PORTVELH 20 S/A · Porto Velho/RO · Pericia contabil e serviços contabeis
  - DIET PORTVELH 60 EIRELI · Porto Velho/RO · Atividades de nutricionista e consultoria nutricional
  - SALAO ALVOD'OE 33 LTDA · Alvorada D'Oeste/RO · Cabeleireiros e salao de beleza premium
  - OXICORP PRESMEDI 48 S/A · Presidente Médici/RO · Fabricacao de produtos quimicos industriais
  - MOTORS COSTMARQ 40 LTDA · Costa Marques/RO · Concessionaria de veiculos automotores novos
  - FISCAL JI-PARAN 84 LTDA · Ji-Paraná/RO · Auditoria contabil e serviços contabeis
  - EMPREIT NOVAUNIA 60 LTDA · Nova União/RO · Empreiteira execucao de obras
  - DIET ESPID'OE 26 EIRELI · Espigão D'Oeste/RO · Atividades de nutricionista e consultoria nutricional
  - NUTRI PORTVELH 80 S/A · Porto Velho/RO · Atividades de nutricionista e consultoria nutricional
  - ATAC ALTAFLOR 75 EIRELI · Alta Floresta D'Oeste/RO · Comercio atacadista distribuidora de mercadorias

### 19. (65) 3333-4444 — 24 CNPJs · `contabilidade`
  - BROKER CUIABA 59 EIRELI · Cuiabá/MT · Imobiliaria compra e venda de imoveis
  - VISAO CUIABA 38 LTDA · Cuiabá/MT · Clinica oftalmologica e serviços de oftalmologia
  - TRANS RONDOLAN 66 S/A · Rondolândia/MT · Transporte rodoviario de carga frete rodoviario
  - VISAO GUIRATIN 82 S/A · Guiratinga/MT · Clinica oftalmologica e serviços de oftalmologia
  - RENT CUIABA 05 LTDA · Cuiabá/MT · Locacao de veiculos turismo rent a car
  - PET HOTEL LUCIARA 19 EIRELI · Luciara/MT · Banho e tosa higiene e embelezamento de animais
  - RENT PEIXDE 22 EIRELI · Peixoto de Azevedo/MT · Locacao de veiculos turismo rent a car
  - HOSPET BOAESPE 77 EIRELI · Boa Esperança do Norte/MT · Banho e tosa higiene e embelezamento de animais
  - CORRET CASTANHE 73 LTDA · Castanheira/MT · Imobiliaria compra e venda de imoveis
  - RENT NOVAOLIM 21 EIRELI · Nova Olímpia/MT · Locacao de veiculos turismo rent a car

### 20. (96) 3333-4444 — 24 CNPJs · `contabilidade`
  - TRAIN MACAPA 28 S/A · Macapá/AP · Cursos tecnicos livres e treinamento
  - ACAB SANTANA 39 EIRELI · Santana/AP · Acabamentos para construcao revestimentos
  - ARMAZ MACAPA 19 EIRELI · Macapá/AP · Armazenamento guarda de mercadorias operador logistico armazem
  - URBAN MACAPA 75 LTDA · Macapá/AP · Incorporacao de empreendimentos imobiliarios
  - INCORP MACAPA 35 S/A · Macapá/AP · Incorporacao de empreendimentos imobiliarios
  - URBAN MACAPA 08 S/A · Macapá/AP · Incorporacao de empreendimentos imobiliarios
  - REVEST VITODO 59 EIRELI · Vitória do Jari/AP · Acabamentos para construcao revestimentos
  - ACO FORTE MACAPA 75 EIRELI · Macapá/AP · Metalurgia fundicao de metais e forjaria
  - FISIO VITODO 19 LTDA · Vitória do Jari/AP · Clinica de podologia e cuidados com os pes
  - LASER MACAPA 62 S/A · Macapá/AP · Serviços de dermatologia e medicina estetica ambulatorial

### 21. (51) 3333-4444 — 23 CNPJs · `contabilidade`
  - ADESTRA BOMJESU 08 S/A · Bom Jesus/RS · Banho e tosa higiene e embelezamento de animais
  - FISIO PORTMAUA 20 LTDA · Porto Mauá/RS · Clinica de podologia e cuidados com os pes
  - LASER SANTCRUZ 36 S/A · Santa Cruz do Sul/RS · Serviços de dermatologia e medicina estetica ambulatorial
  - CANINO PORTALEG 67 EIRELI · Porto Alegre/RS · Banho e tosa higiene e embelezamento de animais
  - TRAIN RELVADO 19 EIRELI · Relvado/RS · Cursos tecnicos livres e treinamento
  - REVEST ILOPOLIS 88 S/A · Ilópolis/RS · Acabamentos para construcao revestimentos
  - REVEST PORTALEG 23 LTDA · Porto Alegre/RS · Acabamentos para construcao revestimentos
  - URBAN PORTALEG 59 S/A · Porto Alegre/RS · Incorporacao de empreendimentos imobiliarios
  - FIT PORTALEG 46 LTDA · Porto Alegre/RS · Comercio varejista de artigos esportivos
  - REAB PORTALEG 81 S/A · Porto Alegre/RS · Clinica de podologia e cuidados com os pes

### 22. (46) 3333-4444 — 22 CNPJs · `contabilidade`
  - MARMOR CURITIBA 20 EIRELI · Curitiba/PR · Marmore e granito beneficiamento marmoraria
  - WELL SERRDO 18 S/A · Serranópolis do Iguaçu/PR · Spa day spa e massagem relaxante
  - BURGER CURITIBA 58 LTDA · Curitiba/PR · Pizzaria e esfiharia lanchonete
  - GRANITO TERRRICA 77 LTDA · Terra Rica/PR · Marmore e granito beneficiamento marmoraria
  - TEXTIL IRACDO 70 EIRELI · Iracema do Oeste/PR · Fabricacao de artefatos texteis confecao industrial
  - WEALTH CURITIBA 23 LTDA · Curitiba/PR · Assessoria de investimentos consultoria financeira
  - WEALTH CURITIBA 42 S/A · Curitiba/PR · Assessoria de investimentos consultoria financeira
  - SOFT CURITIBA 63 EIRELI · Curitiba/PR · Desenvolvimento de sistemas software sob medida
  - GRILL BARRDO 68 S/A · Barra do Jacaré/PR · Pizzaria e esfiharia lanchonete
  - TEXTIL CURITIBA 56 S/A · Curitiba/PR · Fabricacao de artefatos texteis confecao industrial

### 23. (68) 3333-4444 — 20 CNPJs · `contabilidade`
  - PETSPA RIOBRAN 71 S/A · Rio Branco/AC · Banho e tosa higiene e embelezamento de animais
  - MOVEIS ACRELAND 61 EIRELI · Acrelândia/AC · Comercio varejista de moveis e decoracao
  - ACO RIOBRAN 63 LTDA · Rio Branco/AC · Producao de tubos de aco siderurgia
  - ACO MANOURBA 78 LTDA · Manoel Urbano/AC · Laminacao de aco siderurgia
  - HOST CAPIXABA 57 EIRELI · Capixaba/AC · Hospedagem na internet processamento de dados data center
  - DEPOS BRASILEI 10 EIRELI · Brasiléia/AC · Comercio varejista de material de construcao
  - DRINK MANOURBA 73 EIRELI · Manoel Urbano/AC · Bar servico de bebidas e casas noturnas
  - DECOR BUJARI 32 LTDA · Bujari/AC · Comercio varejista de moveis e decoracao
  - REALTY BUJARI 90 LTDA · Bujari/AC · Administradora de imoveis e condominios
  - DENTAL SENAGUIO 86 S/A · Senador Guiomard/AC · Clinica odontologica e atividade odontologica

### 24. (49) 3333-4444 — 20 CNPJs · `contabilidade`
  - PODO FLORIANO 27 S/A · Florianópolis/SC · Cabeleireiros e salao de beleza premium
  - CONSULT IPUACU 38 LTDA · Ipuaçu/SC · Consultoria em gestao empresarial assessoria empresarial
  - ALIM FLORIANO 29 LTDA · Florianópolis/SC · Industria alimenticia processamento de alimentos
  - MECAN SOMBRIO 34 S/A · Sombrio/SC · Oficina mecanica manutencao e reparacao de veiculos
  - CNH FLORDO 08 LTDA · Flor do Sertão/SC · Autoescola ensino para habilitacao
  - DESIGN FLORIANO 80 S/A · Florianópolis/SC · Serviços de laudo de avaliacao imobiliaria
  - PODO AGUAMORN 66 EIRELI · Águas Mornas/SC · Cabeleireiros e salao de beleza premium
  - OFICINA FLORIANO 31 LTDA · Florianópolis/SC · Oficina mecanica manutencao e reparacao de veiculos
  - CAPIL ORLEANS 40 S/A · Orleans/SC · Atividades de tratamento de beleza capilar
  - OFICINA BALNPICA 36 S/A · Balneário Piçarras/SC · Oficina mecanica manutencao e reparacao de veiculos

### 25. (34) 3333-4444 — 20 CNPJs · `contabilidade`
  - FISCAL PEDRAZUL 55 EIRELI · Pedra Azul/MG · Auditoria contabil e serviços contabeis
  - BRASILQUIM BELOHORI 31 LTDA · Belo Horizonte/MG · Fabricacao de produtos quimicos industriais
  - FISCAL DIVISOPO 38 EIRELI · Divisópolis/MG · Pericia contabil e serviços contabeis
  - BRASILQUIM BELOHORI 51 S/A · Belo Horizonte/MG · Fabricacao de produtos quimicos industriais
  - DISTRI IGUATAMA 23 LTDA · Iguatama/MG · Comercio atacadista distribuidora de mercadorias
  - EMPREIT BELOHORI 64 EIRELI · Belo Horizonte/MG · Empreiteira execucao de obras
  - SALAO ALEMPARA 83 LTDA · Além Paraíba/MG · Cabeleireiros e salao de beleza premium
  - OBRAS DIVIDE 20 EIRELI · Divinolândia de Minas/MG · Empreiteira execucao de obras
  - CONDOM ARCOS 53 EIRELI · Arcos/MG · Administracao de condominios e gestao condominial
  - ATAC SANTANTO 50 LTDA · Santo Antônio do Retiro/MG · Comercio atacadista distribuidora de mercadorias

### 26. (98) 3333-4444 — 19 CNPJs · `contabilidade`
  - DENTAL SAOLUIS 41 LTDA · São Luís/MA · Clinica odontologica e atividade odontologica
  - DERMA GRACARAN 75 EIRELI · Graça Aranha/MA · Atividades de estética e beleza com clinica de estetica
  - ACO TRIZDO 35 LTDA · Trizidela do Vale/MA · Laminacao de aco siderurgia
  - DERMA SAOLUIS 01 LTDA · São Luís/MA · Atividades de estética e beleza com clinica de estetica
  - TOUR SAOBENT 32 LTDA · São Bento/MA · Receptivo turistico guia de turismo
  - DEPOS SAOLUIS 15 LTDA · São Luís/MA · Comercio varejista de material de construcao
  - ACO GOVEEDIS 62 S/A · Governador Edison Lobão/MA · Producao de tubos de aco siderurgia
  - DECOR SAOFRAN 88 S/A · São Francisco do Brejão/MA · Comercio varejista de moveis e decoracao
  - IMOB SAOLUIS 55 EIRELI · São Luís/MA · Administradora de imoveis e condominios
  - DECOR BELAVIST 44 LTDA · Bela Vista do Maranhão/MA · Comercio varejista de moveis e decoracao

### 27. (83) 3333-4444 — 17 CNPJs · `contabilidade`
  - TRICO COREMAS 44 LTDA · Coremas/PB · Atividades de tratamento de beleza capilar
  - CORRET CALDBRAN 61 S/A · Caldas Brandão/PB · Corretagem de seguros corretora de seguros
  - GESTAO BORBOREM 22 S/A · Borborema/PB · Consultoria em gestao empresarial assessoria empresarial
  - CAPIL JOAOPESS 41 EIRELI · João Pessoa/PB · Atividades de tratamento de beleza capilar
  - ALIM JOAOPESS 10 EIRELI · João Pessoa/PB · Fabricacao de acucar industria alimenticia
  - PIZZA PASSAGEM 37 S/A · Passagem/PB · Restaurante e servico de alimentacao completo
  - CORRET BARRDE 10 EIRELI · Barra de Santa Rosa/PB · Corretagem de seguros corretora de seguros
  - MECAN JOAOPESS 89 S/A · João Pessoa/PB · Oficina mecanica manutencao e reparacao de veiculos
  - CNH JOAOPESS 13 LTDA · João Pessoa/PB · Autoescola ensino para habilitacao
  - TRICO JOAOPESS 83 LTDA · João Pessoa/PB · Atividades de tratamento de beleza capilar

### 28. (31) 3222-1111 — 8 CNPJs · `grupo_economico`
  - ADESTRA INOCENCI 62 EIRELI · Inocência/MS · Banho e tosa higiene e embelezamento de animais
  - AUTO FORTDE 04 LTDA · Fortaleza de Minas/MG · Concessionaria de veiculos automotores novos
  - SEMI SALVATER 27 S/A · Salvaterra/PA · Comercio de veiculos usados e seminovos
  - MECAN SAOJOSE 54 S/A · São José do Bonfim/PB · Oficina mecanica manutencao e reparacao de veiculos
  - FUNIL CURITIBA 83 S/A · Curitiba/PR · Funilaria pintura de veiculos e lanternagem automotiva
  - ACESS IGUARACY 38 S/A · Iguaracy/PE · Instalacao de acessorios automotivos e som automotivo
  - DETAIL TERESINA 36 LTDA · Teresina/PI · Estetica automotiva polimento e vitrificacao
  - REALTY PORTREAL 04 S/A · Porto Real/RJ · Administradora de imoveis e condominios

### 29. (68) 90611-5662 — 1 CNPJs · `proprio`
  - ESTETICA ACRELAND 09 S/A · Acrelândia/AC · Atividades de estética e beleza com clinica de estetica

### 30. (96) 90843-2470 — 1 CNPJs · `proprio`
  - LASER SANTANA 86 EIRELI · Santana/AP · Serviços de dermatologia e medicina estetica ambulatorial

### 31. (97) 90190-7237 — 1 CNPJs · `proprio`
  - SALAO CAREIRO 20 EIRELI · Careiro/AM · Cabeleireiros e salao de beleza premium

### 32. (71) 90368-3166 — 1 CNPJs · `proprio`
  - PIGMENT SANTESTE 06 EIRELI · Santo Estêvão/BA · Atividades de estética e beleza com clinica de estetica

### 33. (61) 90080-0294 — 1 CNPJs · `proprio`
  - SPA BRASILIA 51 LTDA · Brasília/DF · Spa day spa e massagem relaxante

### 34. (64) 3856-0130 — 1 CNPJs · `proprio`
  - PELE GOIANIA 66 S/A · Goiânia/GO · Serviços de dermatologia e medicina estetica ambulatorial

### 35. (99) 3908-6810 — 1 CNPJs · `proprio`
  - ODONTO ALDEALTA 69 LTDA · Aldeias Altas/MA · Clinica odontologica e atividade odontologica

### 36. (65) 90788-2497 — 1 CNPJs · `proprio`
  - OFTALMO APIACAS 52 S/A · Apiacás/MT · Clinica oftalmologica e serviços de oftalmologia

### 37. (67) 3759-6436 — 1 CNPJs · `proprio`
  - FISIO ANAURILA 58 LTDA · Anaurilândia/MS · Clinica de podologia e cuidados com os pes

### 38. (38) 90386-9365 — 1 CNPJs · `proprio`
  - DIET BELOHORI 36 S/A · Belo Horizonte/MG · Atividades de nutricionista e consultoria nutricional

### 39. (94) 3771-4621 — 1 CNPJs · `proprio`
  - MENTE BREJGRAN 61 S/A · Brejo Grande do Araguaia/PA · Atividades de psicologia e psicoterapia

### 40. (44) 90104-2347 — 1 CNPJs · `proprio`
  - VITA CURITIBA 58 EIRELI · Curitiba/PR · Consultorio de dermatologista

### 41. (86) 90688-1708 — 1 CNPJs · `proprio`
  - PETSHOP TERESINA 59 LTDA · Teresina/PI · Comercio varejista de racoes e acessorios pet

### 42. (84) 3291-9011 — 1 CNPJs · `proprio`
  - PET HOTEL NATAL 43 S/A · Natal/RN · Banho e tosa higiene e embelezamento de animais

### 43. (69) 90039-4247 — 1 CNPJs · `proprio`
  - MOTORS COLODO 29 LTDA · Colorado do Oeste/RO · Concessionaria de veiculos automotores novos

### 44. (95) 90372-3236 — 1 CNPJs · `proprio`
  - SEMI BOAVIST 30 EIRELI · Boa Vista/RR · Comercio de veiculos usados e seminovos

### 45. (47) 3680-3668 — 1 CNPJs · `proprio`
  - OFICINA AGUADE 61 LTDA · Águas de Chapecó/SC · Oficina mecanica manutencao e reparacao de veiculos

### 46. (79) 3801-0370 — 1 CNPJs · `proprio`
  - ACESS ARACAJU 41 EIRELI · Aracaju/SE · Instalacao de acessorios automotivos e som automotivo

### 47. (63) 90180-0542 — 1 CNPJs · `proprio`
  - POLISH GOIATINS 53 EIRELI · Goiatins/TO · Estetica automotiva polimento e vitrificacao

### 48. (68) 90516-9945 — 1 CNPJs · `proprio`
  - IMOB SENAGUIO 21 EIRELI · Senador Guiomard/AC · Imobiliaria compra e venda de imoveis

### 49. (82) 90666-9006 — 1 CNPJs · `proprio`
  - BROKER MACEIO 35 S/A · Maceió/AL · Imobiliaria compra e venda de imoveis

### 50. (96) 90687-0752 — 1 CNPJs · `proprio`
  - INCORP CUTIAS 49 LTDA · Cutias/AP · Incorporacao de empreendimentos imobiliarios

