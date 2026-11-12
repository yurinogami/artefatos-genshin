// Peças não upadas "como se estivessem no nível máximo", com os valores esperados em média.
// Cada upgrade que falta sorteia 1 dos 4 substats (1 em 4) e soma 85% do roll máximo, em média;
// então cada substat ganha (upgrades × 1/4 × 85% do roll máximo). O 4º substat bloqueado é ativado.
// Peça com só 3 substats: o 4º ainda é desconhecido e não entra (a projeção fica um pouco baixa).
import { FRACAO_MEDIA_ROLL, NIVEL_MAXIMO, ROLL_MAXIMO } from "./stats";
import { upgradesRestantes } from "./pontuacao";
import type { Artefato } from "./tipos";

export function projetarArtefato(a: Artefato): Artefato {
  const max = NIVEL_MAXIMO[a.raridade];
  if (a.nivel >= max) return a;
  let upgrades = upgradesRestantes(a);
  if (a.substats.length === 4 && !a.quartoAtivo && upgrades > 0) upgrades -= 1; // o 1º só ativa o 4º
  if (a.substats.length < 4 && upgrades > 0) upgrades -= 1; // o 1º cria o substat desconhecido
  const porSub = (upgrades * FRACAO_MEDIA_ROLL) / 4;
  return {
    ...a,
    nivel: max,
    quartoAtivo: true,
    substats: a.substats.map((s) => ({ ...s, valor: s.valor + porSub * ROLL_MAXIMO[a.raridade][s.chave] })),
  };
}

/** Inventário com as peças não upadas trocadas pela projeção (mesmo id). */
export function inventarioProjetado(inv: Artefato[]): Artefato[] {
  return inv.map(projetarArtefato);
}
