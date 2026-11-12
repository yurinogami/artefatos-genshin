// Chaves de stats no mesmo padrão do formato GOOD (facilita um importador no futuro).
export type ChaveSubstat =
  | "hp"
  | "atk"
  | "def"
  | "hp_"
  | "atk_"
  | "def_"
  | "eleMas"
  | "enerRech_"
  | "critRate_"
  | "critDMG_";

export type ChaveMainStat =
  | "hp"
  | "atk"
  | "hp_"
  | "atk_"
  | "def_"
  | "eleMas"
  | "enerRech_"
  | "critRate_"
  | "critDMG_"
  | "heal_"
  | "physical_dmg_"
  | "pyro_dmg_"
  | "hydro_dmg_"
  | "electro_dmg_"
  | "cryo_dmg_"
  | "anemo_dmg_"
  | "geo_dmg_"
  | "dendro_dmg_";

export type Peca = "flower" | "plume" | "sands" | "goblet" | "circlet";

export type Raridade = 4 | 5;

export interface Substat {
  chave: ChaveSubstat;
  valor: number;
}

export interface Artefato {
  id: string;
  set: string; // nome do set em inglês, ex.: "Crimson Witch of Flames"
  raridade: Raridade;
  peca: Peca;
  mainStat: ChaveMainStat;
  nivel: number; // 0 a 20 (5★) ou 0 a 16 (4★)
  substats: Substat[]; // até 4; o 4º pode estar inativo
  quartoAtivo: boolean; // false = 4º substat ainda bloqueado (ativa no próximo upgrade)
  equipadoEm: string | null; // id do perfil de personagem
  criadoEm: number;
}

export interface PerfilBuild {
  id: string; // ex.: "hu-tao"
  nome: string; // nome exibido
  elemento: string;
  funcao: string; // ex.: "DPS principal", "Suporte"
  sets: string[]; // sets recomendados, do melhor para o pior
  mainStats: {
    sands: ChaveMainStat[];
    goblet: ChaveMainStat[];
    circlet: ChaveMainStat[];
  };
  pesos: Partial<Record<ChaveSubstat, number>>; // 0 a 1
  notas?: string;
  rotulo?: string; // nome da build principal quando há variantes, ex.: "DPS"
  rascunho?: boolean; // perfil montado só pela leitura do kit (personagem que ainda não tem guia conhecido)
  variantes?: VarianteBuild[]; // outras formas de montar o mesmo personagem
}

/** Outra build do mesmo personagem; o que não for informado vem da build principal. */
export interface VarianteBuild {
  id: string; // ex.: "subdps"
  rotulo: string; // ex.: "Sub-DPS"
  funcao?: string;
  elemento?: string; // Viajante: cada variante é um elemento
  sets?: string[];
  mainStats?: PerfilBuild["mainStats"];
  pesos?: PerfilBuild["pesos"];
  notas?: string;
}
