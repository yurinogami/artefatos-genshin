// Quais valores um substat pode ter de verdade, dado o número de rolls.
// Cada roll soma 70%, 80%, 90% ou 100% do roll máximo; o jogo mostra a soma arredondada.
import { ROLL_MAXIMO, ehPercentual } from "./stats";
import type { ChaveSubstat, Raridade, Substat } from "./tipos";

const TIERS = [0.7, 0.8, 0.9, 1];
const MAX_ROLLS = 6; // 1 inicial + 5 upgrades

const cache = new Map<string, number[][]>();

/** Somas possíveis (sem arredondar) para 1..6 rolls. Índice 0 = 1 roll. */
function somasPossiveis(chave: ChaveSubstat, raridade: Raridade): number[][] {
  const id = `${chave}:${raridade}`;
  const pronto = cache.get(id);
  if (pronto) return pronto;
  const max = ROLL_MAXIMO[raridade][chave];
  const porK: number[][] = [];
  let atual = new Set<number>([0]);
  for (let k = 1; k <= MAX_ROLLS; k++) {
    const prox = new Set<number>();
    for (const s of atual) for (const t of TIERS) prox.add(Math.round((s + t) * 100) / 100);
    atual = prox;
    porK.push([...atual].map((f) => f * max));
  }
  cache.set(id, porK);
  return porK;
}

/** Números de rolls (1..6) que explicam o valor mostrado. Vazio = valor impossível (provável erro de leitura). */
export function rollsPossiveis(s: Substat, raridade: Raridade = 5): number[] {
  const tol = ehPercentual(s.chave) ? 0.06 : 0.6;
  return somasPossiveis(s.chave, raridade)
    .map((somas, i) => (somas.some((v) => Math.abs(v - s.valor) <= tol) ? i + 1 : 0))
    .filter(Boolean);
}

export function valorPossivel(s: Substat, raridade: Raridade = 5): boolean {
  return rollsPossiveis(s, raridade).length > 0;
}

/**
 * O nível bate com os valores? No total a peça tem (3 ou 4) + upgrades rolls,
 * contando o 4º substat (mesmo bloqueado) como 1 roll.
 */
export function nivelCombina(substats: Substat[], nivel: number, raridade: Raridade = 5): boolean {
  const opcoes = substats.map((s) => rollsPossiveis(s, raridade));
  if (opcoes.some((o) => o.length === 0)) return true; // valor ilegível: não dá para julgar o nível
  const upgrades = Math.floor(nivel / 4);
  const alvos = substats.length === 4 ? [3 + upgrades, 4 + upgrades] : [3 + upgrades];
  let somas = new Set<number>([0]);
  for (const o of opcoes) {
    const prox = new Set<number>();
    for (const s of somas) for (const k of o) prox.add(s + k);
    somas = prox;
  }
  // Com 3 substats lidos pode faltar um: aceita somas até 1 roll menores... e o que faltou pode ter vários.
  if (substats.length < 4) return [...somas].some((s) => s <= Math.max(...alvos));
  return alvos.some((a) => somas.has(a));
}
