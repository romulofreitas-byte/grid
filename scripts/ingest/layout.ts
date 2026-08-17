/**
 * Column index maps for Receita Federal CNPJ open-data CSV files.
 *
 * Format: ISO-8859-1, semicolon separator, no header row, fields double-quoted.
 * Indices are 0-based (official PDF layout is 1-based — subtract 1 here).
 *
 * IMPORTANT: RF revised file paths and occasionally column order in Jan/2026.
 * When layouts change, update ONLY this file — do not scatter magic numbers in parse/ingest code.
 *
 * @see https://www.gov.br/receitafederal/dados/cnpj-metadados.pdf
 */

export type ColumnMap = Record<string, number>;

/** Empresas — razão social and company-level attributes */
export const EMPRESAS: ColumnMap = {
  cnpj_basico: 0,
  razao_social: 1,
  natureza_id: 2,
  qualificacao_responsavel: 3,
  capital_social: 4,
  porte: 5,
  ente_federativo: 6,
};

/** Estabelecimentos — branch / address / contact data */
export const ESTABELECIMENTOS: ColumnMap = {
  cnpj_basico: 0,
  cnpj_ordem: 1,
  cnpj_dv: 2,
  identificador_matriz_filial: 3,
  nome_fantasia: 4,
  situacao: 5,
  data_situacao: 6,
  motivo_situacao: 7,
  nome_cidade_exterior: 8,
  pais: 9,
  data_inicio: 10,
  cnae_principal: 11,
  cnae_secundarios: 12,
  tipo_logradouro: 13,
  logradouro: 14,
  numero: 15,
  complemento: 16,
  bairro: 17,
  cep: 18,
  uf: 19,
  municipio_id: 20,
  ddd1: 21,
  telefone1: 22,
  ddd2: 23,
  telefone2: 24,
  ddd_fax: 25,
  fax: 26,
  email: 27,
  situacao_especial: 28,
  data_situacao_especial: 29,
};

/**
 * Sócios — partner records.
 * CPF/CNPJ column (official index 4, 0-based 3) is deliberately omitted from this map.
 */
export const SOCIOS: ColumnMap = {
  cnpj_basico: 0,
  identificador_socio: 1,
  nome: 2,
  // cpf_cnpj_socio: 3 — intentionally excluded (privacy / schema)
  qualificacao_id: 4,
  data_entrada: 5,
  pais: 6,
  representante_legal: 7,
  nome_representante: 8,
  qualificacao_representante: 9,
  faixa_etaria: 10,
};

/** Opção Simples / MEI */
export const SIMPLES: ColumnMap = {
  cnpj_basico: 0,
  opcao_simples: 1,
  data_opcao_simples: 2,
  data_exclusao_simples: 3,
  opcao_mei: 4,
  data_opcao_mei: 5,
  data_exclusao_mei: 6,
};

export const CNAE: ColumnMap = {
  codigo: 0,
  descricao: 1,
};

export const MUNICIPIOS: ColumnMap = {
  id: 0,
  nome: 1,
};

export const NATUREZAS: ColumnMap = {
  id: 0,
  descricao: 1,
};

export const QUALIFICACOES: ColumnMap = {
  id: 0,
  descricao: 1,
};

export const LAYOUT_VERSION = "2026-01";
