// Build ideal ("meta") de um perfil, sem olhar o inventário: a peça que você gostaria de ter em cada slot.
import { FRACAO_MEDIA_ROLL, PECAS } from "./stats";
import type { ChaveMainStat, ChaveSubstat, Peca, PerfilBuild } from "./tipos";

export interface PecaIdeal {
  peca: Peca;
  mainStat: ChaveMainStat;
  substats: ChaveSubstat[]; // os 4 melhores para o perfil, do mais para o menos importante
  notaMaxima: number; // todos os rolls no máximo (100%) e os 5 upgrades no melhor substat
  notaAlvo: number; // peça muito boa e realista: rolls médios (85%) espalhados pelos 4 substats ideais
}

export interface BuildIdeal {
  set: string | null;
  pecas: PecaIdeal[];
  notaAlvo: number;
  notaMaxima: number;
}

const MAIN_FIXA: Partial<Record<Peca, ChaveMainStat>> = { flower: "hp", plume: "atk" };
const UPGRADES = 5;

export function substatsIdeais(perfil: PerfilBuild, mainStat: ChaveMainStat): ChaveSubstat[] {
  return (Object.entries(perfil.pesos) as [ChaveSubstat, number][])
    .filter(([chave, peso]) => peso > 0 && chave !== mainStat)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([chave]) => chave);
}

export function pecaIdeal(perfil: PerfilBuild, peca: Peca): PecaIdeal {
  const mainStat = MAIN_FIXA[peca] ?? perfil.mainStats[peca as "sands" | "goblet" | "circlet"][0];
  const substats = substatsIdeais(perfil, mainStat);
  const pesos = substats.map((c) => perfil.pesos[c] ?? 0);
  // Se o perfil usa menos de 4 stats, os substats que faltam não somam nada.
  const somaInicial = pesos.reduce((s, p) => s + p, 0);
  const media = somaInicial / 4;
  const melhor = Math.max(0, ...pesos);
  return {
    peca,
    mainStat,
    substats,
    notaMaxima: somaInicial + UPGRADES * melhor,
    notaAlvo: FRACAO_MEDIA_ROLL * (somaInicial + UPGRADES * media),
  };
}

export function buildIdeal(perfil: PerfilBuild): BuildIdeal {
  const pecas = PECAS.map((p) => pecaIdeal(perfil, p));
  return {
    set: perfil.sets[0] ?? null,
    pecas,
    notaAlvo: pecas.reduce((s, p) => s + p.notaAlvo, 0),
    notaMaxima: pecas.reduce((s, p) => s + p.notaMaxima, 0),
  };
}
