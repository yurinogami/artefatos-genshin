// Builds salvas: conjuntos de peças com nome, como os "conjuntos" do jogo.
// Guardam os ids das peças; a mesma peça pode estar em várias builds (o app avisa ao equipar).
import { PECAS } from "./stats";
import type { Artefato, Peca } from "./tipos";

export interface BuildSalva {
  id: string;
  personagem: string; // id do perfil
  chaveBuild: string; // estilo (ex.: "mavuika" ou "mavuika:subdps")
  nome: string;
  pecas: Partial<Record<Peca, string>>; // slot → id do artefato
  criadaEm: number;
}

/** Peças da build que ainda existem no inventário (e quais foram apagadas). */
export function pecasDaBuild(b: BuildSalva, inventario: Artefato[]) {
  const porId = new Map(inventario.map((a) => [a.id, a]));
  const pecas: Partial<Record<Peca, Artefato>> = {};
  const apagadas: Peca[] = [];
  for (const p of PECAS) {
    const id = b.pecas[p];
    if (!id) continue;
    const a = porId.get(id);
    if (a) pecas[p] = a;
    else apagadas.push(p);
  }
  return { pecas, apagadas };
}

/** Nome sugerido: o set com mais peças (ex.: "Ascensão Zéfira"), ou "Build N". */
export function nomeSugerido(pecas: Artefato[], nomeSet: (en: string) => string, existentes: number): string {
  const conta = new Map<string, number>();
  for (const a of pecas) conta.set(a.set, (conta.get(a.set) ?? 0) + 1);
  const [set, n] = [...conta].sort((a, b) => b[1] - a[1])[0] ?? [];
  return set && n! >= 2 ? nomeSet(set) : `Build ${existentes + 1}`;
}

/** Resumo de sets: "4 Ascensão Zéfira + 1 livre", "2 X + 2 Y + 1 livre". */
export function resumoSets(pecas: Artefato[], nomeSet: (en: string) => string): string {
  const conta = new Map<string, number>();
  for (const a of pecas) conta.set(a.set, (conta.get(a.set) ?? 0) + 1);
  const ativos = [...conta].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]);
  const usados = ativos.reduce((s, [, n]) => s + (n >= 4 ? 4 : 2), 0);
  const partes = ativos.map(([s, n]) => `${n >= 4 ? 4 : 2} ${nomeSet(s)}`);
  const livres = pecas.length - usados;
  if (partes.length === 0) return "sem bônus de set";
  return livres > 0 ? `${partes.join(" + ")} + ${livres} livre${livres > 1 ? "s" : ""}` : partes.join(" + ");
}

/** Está equipada agora: todas as peças salvas estão no personagem. */
export function estaEquipada(b: BuildSalva, inventario: Artefato[]): boolean {
  const { pecas, apagadas } = pecasDaBuild(b, inventario);
  const lista = Object.values(pecas);
  return apagadas.length === 0 && lista.length > 0 && lista.every((a) => a!.equipadoEm === b.personagem);
}

/** Outras builds salvas que usam alguma peça desta (de qualquer personagem). */
export function compartilhadas(b: BuildSalva, todas: BuildSalva[]): { build: BuildSalva; pecas: Peca[] }[] {
  const ids = new Set(Object.values(b.pecas));
  return todas
    .filter((o) => o.id !== b.id)
    .map((o) => ({ build: o, pecas: PECAS.filter((p) => o.pecas[p] && ids.has(o.pecas[p]!)) }))
    .filter((x) => x.pecas.length > 0);
}
