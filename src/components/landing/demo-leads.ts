/** Marketing-only mock rows — fictional; not real platform or Receita data. */
export const LANDING_LEADS = [
  {
    pos: 1,
    empresa: "Clínica Aurora Saúde",
    cidade: "Curitiba · PR",
    telefone: "(41) 3332-1900",
    socio: "Rafael Pinho",
    flag: null as string | null,
  },
  {
    pos: 2,
    empresa: "Odonto Serra",
    cidade: "Curitiba · PR",
    telefone: "(41) 3078-4410",
    socio: "Marina Lopes",
    flag: null,
  },
  {
    pos: 3,
    empresa: "Lab Vida Diagnósticos",
    cidade: "Curitiba · PR",
    telefone: "(41) 3024-1188",
    socio: "—",
    flag: "Contabilidade",
  },
  {
    pos: 4,
    empresa: "Fisio Alto da XV",
    cidade: "Curitiba · PR",
    telefone: "(41) 3244-9072",
    socio: "Helena Vargas",
    flag: null,
  },
  {
    pos: 5,
    empresa: "Centro Médico Batel",
    cidade: "Curitiba · PR",
    telefone: "(41) 3016-5520",
    socio: "Diego Ramos",
    flag: null,
  },
] as const;

export const LANDING_AURORA = LANDING_LEADS[0];
export const LANDING_SERRA = LANDING_LEADS[1];

export type LandingQualifyAsset = {
  label: string;
  value: string;
  /** Operational pill; null = no seal (telefone). Ignored when `missing`. */
  seal: string | null;
  missing?: boolean;
};

export type LandingQualifyScene = {
  id: "qualified" | "opportunity";
  empresa: string;
  cidade: string;
  assets: LandingQualifyAsset[];
};

/** Marketing-only qualification previews — fictional; not real audit data. */
export const LANDING_QUALIFY_SCENES: LandingQualifyScene[] = [
  {
    id: "qualified",
    empresa: LANDING_AURORA.empresa,
    cidade: LANDING_AURORA.cidade,
    assets: [
      { label: "Telefone", value: LANDING_AURORA.telefone, seal: null },
      { label: "Site", value: "aurorasaude.com.br", seal: "No ar" },
      { label: "Instagram", value: "@clinicaaurora", seal: "Ativo" },
      { label: "Google", value: "Perfil do negócio", seal: "Atualizado" },
    ],
  },
  {
    id: "opportunity",
    empresa: LANDING_SERRA.empresa,
    cidade: LANDING_SERRA.cidade,
    assets: [
      { label: "Telefone", value: LANDING_SERRA.telefone, seal: null },
      { label: "Site", value: "—", seal: null, missing: true },
      { label: "Instagram", value: "—", seal: null, missing: true },
      { label: "Google", value: "Perfil do negócio", seal: "Atualizado" },
    ],
  },
];
