// Bônus que vêm de fora dos artefatos: passiva da arma (no refinamento escolhido) e constelações.
import armasDados from "./armas-dados.json";
import type { Bonus } from "./bonus-sets";
import type { Arma, BasePersonagem, ConfigPersonagem } from "./build";
import type { ChaveMainStat } from "./tipos";

export interface DadoArma {
  en: string;
  pt: string;
  tipo: string;
  raridade: number;
  atk: number;
  secundario: { chave: ChaveMainStat; valor: number } | null;
  icone?: string;
  passiva: { nome: string; textos: string[]; bonus: Bonus[] } | null;
}

export const ARMAS_DADOS = armasDados as DadoArma[];
const POR_EN = new Map(ARMAS_DADOS.map((a) => [a.en.toLowerCase(), a]));

export function dadoDaArma(arma: Pick<Arma, "en" | "nome">): DadoArma | undefined {
  return (
    (arma.en ? POR_EN.get(arma.en.toLowerCase()) : undefined) ??
    ARMAS_DADOS.find((a) => a.pt.toLowerCase() === arma.nome.toLowerCase() || a.en.toLowerCase() === arma.nome.toLowerCase())
  );
}

export function bonusDaPassiva(arma: Arma): Bonus {
  const p = dadoDaArma(arma)?.passiva;
  if (!p) return {};
  const r = Math.min(Math.max(arma.refinamento ?? 1, 1), p.bonus.length);
  return p.bonus[r - 1] ?? {};
}

export function bonusDasConstelacoes(base: BasePersonagem, c?: ConfigPersonagem): Bonus {
  const total: Bonus = {};
  for (const con of (base.constelacoes ?? []).slice(0, c?.constelacao ?? 0))
    for (const [k, v] of Object.entries(con.bonus)) total[k as keyof Bonus] = (total[k as keyof Bonus] ?? 0) + v!;
  return total;
}

export function somarBonus(...bs: Bonus[]): Bonus {
  const t: Bonus = {};
  for (const b of bs) for (const [k, v] of Object.entries(b)) t[k as keyof Bonus] = (t[k as keyof Bonus] ?? 0) + v!;
  return t;
}

/** Nível de cada talento já com o +3 das constelações desbloqueadas (máximo 15). */
export function niveisEfetivos(base: BasePersonagem, c?: ConfigPersonagem) {
  const n = { normal: 1, skill: 1, burst: 1, ...c?.talentos };
  for (const con of (base.constelacoes ?? []).slice(0, c?.constelacao ?? 0)) if (con.talento) n[con.talento] = Math.min(15, n[con.talento] + 3);
  return n;
}
