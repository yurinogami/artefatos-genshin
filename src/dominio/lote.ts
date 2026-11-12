// Cadastro em lote: transforma a leitura de um print num artefato pronto para salvar
// e diz o que precisa ser conferido antes.
import type { Artefato, Raridade } from "./tipos";
import { MAIN_STATS_POR_PECA } from "./stats";
import { validarArtefato } from "./pontuacao";
import { acharPersonagem, type LeituraPrint } from "./leitorPrint";

export interface Rascunho {
  artefato: Artefato;
  problemas: string[]; // vazio = pode salvar sem conferir
  donoSemPerfil?: string; // "Equipado por X" lido, mas X não tem perfil: só informa, não impede salvar
}

/** Monta o artefato a partir da leitura. O que não foi lido vira um palpite, sempre marcado como problema. */
export function rascunhoDaLeitura(
  l: LeituraPrint,
  perfis: { id: string; nome: string }[],
  id: string,
  agora: number,
): Rascunho {
  const peca = l.peca ?? "flower";
  const raridade: Raridade = l.raridade ?? 5;
  const dono = l.equipadoPor ? acharPersonagem(l.equipadoPor, perfis) : undefined;
  const artefato: Artefato = {
    id,
    set: l.set ?? "",
    raridade,
    peca,
    mainStat: l.mainStat ?? MAIN_STATS_POR_PECA[peca][0],
    nivel: l.nivel ?? 0,
    substats: l.substats,
    quartoAtivo: l.quartoAtivo,
    equipadoEm: dono?.id ?? null,
    criadoEm: agora,
  };
  const problemas = [...l.avisos];
  for (const e of validarArtefato(artefato)) if (!problemas.includes(e)) problemas.push(e);
  return { artefato, problemas, donoSemPerfil: l.equipadoPor && !dono ? l.equipadoPor : undefined };
}

/** Identifica a mesma peça (para não cadastrar duas vezes o mesmo print ou uma peça que já está no inventário). */
export function chaveArtefato(a: Pick<Artefato, "set" | "peca" | "mainStat" | "nivel" | "substats">): string {
  const subs = a.substats
    .map((s) => `${s.chave}:${Math.round(s.valor * 10)}`)
    .sort()
    .join(",");
  return [a.set.toLowerCase(), a.peca, a.mainStat, a.nivel, subs].join("|");
}

/** Ao salvar uma peça equipada, quem estava no mesmo slot do mesmo personagem deixa de estar equipado. */
export function pecasParaDesequipar(nova: Artefato, inventario: Artefato[]): Artefato[] {
  if (!nova.equipadoEm) return [];
  return inventario.filter((a) => a.id !== nova.id && a.peca === nova.peca && a.equipadoEm === nova.equipadoEm);
}
