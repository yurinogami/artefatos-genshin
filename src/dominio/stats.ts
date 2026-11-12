import type { ChaveMainStat, ChaveSubstat, Peca, Raridade } from "./tipos";

// Valor máximo de UM roll de substat, por raridade (tier mais alto: 100%).
// Os quatro tiers possíveis são 70%, 80%, 90% e 100% deste valor.
export const ROLL_MAXIMO: Record<Raridade, Record<ChaveSubstat, number>> = {
  5: {
    hp: 298.75,
    atk: 19.45,
    def: 23.15,
    hp_: 5.83,
    atk_: 5.83,
    def_: 7.29,
    eleMas: 23.31,
    enerRech_: 6.48,
    critRate_: 3.89,
    critDMG_: 7.77,
  },
  4: {
    hp: 239,
    atk: 15.56,
    def: 18.52,
    hp_: 4.66,
    atk_: 4.66,
    def_: 5.83,
    eleMas: 18.65,
    enerRech_: 5.18,
    critRate_: 3.11,
    critDMG_: 6.22,
  },
};

// Média de um roll: (70 + 80 + 90 + 100) / 4 = 85% do máximo.
export const FRACAO_MEDIA_ROLL = 0.85;

export const NIVEL_MAXIMO: Record<Raridade, number> = { 5: 20, 4: 16 };

export const SUBSTATS: ChaveSubstat[] = [
  "critRate_",
  "critDMG_",
  "atk_",
  "hp_",
  "def_",
  "eleMas",
  "enerRech_",
  "atk",
  "hp",
  "def",
];

export const NOME_STAT: Record<ChaveMainStat | ChaveSubstat, string> = {
  hp: "Vida",
  atk: "ATQ",
  def: "DEF",
  hp_: "Vida%",
  atk_: "ATQ%",
  def_: "DEF%",
  eleMas: "Proficiência",
  enerRech_: "Recarga%",
  critRate_: "Taxa Crít.%",
  critDMG_: "Dano Crít.%",
  heal_: "Bônus de Cura%",
  physical_dmg_: "Dano Físico%",
  pyro_dmg_: "Dano Pyro%",
  hydro_dmg_: "Dano Hydro%",
  electro_dmg_: "Dano Electro%",
  cryo_dmg_: "Dano Cryo%",
  anemo_dmg_: "Dano Anemo%",
  geo_dmg_: "Dano Geo%",
  dendro_dmg_: "Dano Dendro%",
};

export const NOME_PECA: Record<Peca, string> = {
  flower: "Flor",
  plume: "Pena",
  sands: "Ampulheta",
  goblet: "Cálice",
  circlet: "Tiara",
};

export const PECAS: Peca[] = ["flower", "plume", "sands", "goblet", "circlet"];

export const MAIN_STATS_POR_PECA: Record<Peca, ChaveMainStat[]> = {
  flower: ["hp"],
  plume: ["atk"],
  sands: ["hp_", "atk_", "def_", "eleMas", "enerRech_"],
  goblet: [
    "hp_",
    "atk_",
    "def_",
    "eleMas",
    "pyro_dmg_",
    "hydro_dmg_",
    "electro_dmg_",
    "cryo_dmg_",
    "anemo_dmg_",
    "geo_dmg_",
    "dendro_dmg_",
    "physical_dmg_",
  ],
  circlet: ["hp_", "atk_", "def_", "eleMas", "critRate_", "critDMG_", "heal_"],
};

export function ehPercentual(chave: string): boolean {
  return chave.endsWith("_");
}
