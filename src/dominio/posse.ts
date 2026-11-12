// Quais personagens o jogador tem.
// Marcação explícita (botão "Tenho este personagem") vale sempre; sem marcação,
// conta como "tem" quem já usa alguma peça (equipada no jogo ou pelo app).
import type { Artefato } from "./tipos";
import type { ConfigPersonagem } from "./build";

export function possuiPersonagem(id: string, configs: ConfigPersonagem[], artefatos: Artefato[]): boolean {
  const marcado = configs.find((c) => c.personagem === id)?.possui;
  if (marcado !== undefined) return marcado;
  return artefatos.some((a) => a.equipadoEm === id);
}

/** Ordem da lista: os seus primeiro, os outros no fim (cada grupo na ordem original). */
export function ordenarPorPosse<T extends { id: string }>(lista: T[], tem: (id: string) => boolean): T[] {
  return [...lista.filter((p) => tem(p.id)), ...lista.filter((p) => !tem(p.id))];
}
