// Qual domínio de artefato farmar.
// Para cada personagem que você tem (build principal) e cada set recomendado a ele:
//  - "falta no set" = soma, peça a peça, do quanto sua melhor peça desse set fica abaixo da peça alvo da
//    build ideal (rolls úteis); a pior peça sai da conta, porque a 5ª peça pode ser de outro set.
//  - "falta no personagem" = quanto a melhor build atual (qualquer set) fica abaixo da build ideal.
//  - contribuição = peso da posição do set no perfil × menor das duas faltas.
//    Assim, um set secundário não pesa muito para quem já tem uma boa build no set principal.
// A pontuação de um domínio é a soma dos 2 sets que caem nele.
import dominiosJson from "./dominios.json";
import { PECAS } from "./stats";
import { mainStatAceita, notaAtual } from "./pontuacao";
import { melhorBuild } from "./otimizador";
import { buildIdeal } from "./ideal";
import type { Artefato, ChaveMainStat, Peca, PerfilBuild } from "./tipos";

export interface Dominio {
  en: string;
  pt: string;
  regiao: string;
  sets: string[];
}
export const DOMINIOS = dominiosJson as Dominio[];

/** Peso pela posição do set na lista do perfil (1º = recomendado principal). */
export const PESO_POSICAO = [1, 0.7, 0.5, 0.35];
const peso = (i: number) => PESO_POSICAO[i] ?? 0.25;

export interface FaltaPeca {
  peca: Peca;
  mainStat: ChaveMainStat; // main stat da peça ideal
  falta: number;
  tem: boolean; // existe alguma peça desse set nesse slot com main stat aceita
}

export interface Ganho {
  personagem: string; // id
  nome: string;
  set: string;
  posicao: number; // 0 = set principal do perfil
  faltaNoSet: number;
  faltaNoPersonagem: number;
  contribuicao: number;
  procurar: FaltaPeca[]; // slots que mais faltam, do pior para o melhor (sem a peça livre)
}

export function ganhosDoPersonagem(perfil: PerfilBuild, inventario: Artefato[]): Ganho[] {
  const ideal = buildIdeal(perfil);
  const alvo = Object.fromEntries(ideal.pecas.map((p) => [p.peca, p])) as Record<Peca, (typeof ideal.pecas)[number]>;
  const faltaNoPersonagem = Math.max(0, ideal.notaAlvo - melhorBuild(perfil, inventario).nota);
  return perfil.sets.map((set, posicao) => {
    const faltas: FaltaPeca[] = PECAS.map((peca) => {
      const notas = inventario
        .filter((a) => a.set === set && a.peca === peca && mainStatAceita(a, perfil))
        .map((a) => notaAtual(a, perfil));
      const melhor = notas.length ? Math.max(...notas) : 0;
      return { peca, mainStat: alvo[peca].mainStat, falta: Math.max(0, alvo[peca].notaAlvo - melhor), tem: notas.length > 0 };
    }).sort((a, b) => b.falta - a.falta);
    const procurar = faltas.slice(1); // a pior vira a peça livre
    const faltaNoSet = procurar.reduce((s, f) => s + f.falta, 0);
    return {
      personagem: perfil.id,
      nome: perfil.nome,
      set,
      posicao,
      faltaNoSet,
      faltaNoPersonagem,
      contribuicao: peso(posicao) * Math.min(faltaNoSet, faltaNoPersonagem),
      procurar: procurar.filter((f) => f.falta > 0.05),
    };
  });
}

export interface RankingSet {
  set: string;
  pontos: number;
  ganhos: Ganho[]; // por personagem, do maior para o menor
}

export interface RankingDominio {
  dominio: Dominio | null; // null = sets que não caem em domínio
  pontos: number;
  sets: RankingSet[];
}

export function rankingFarm(perfis: PerfilBuild[], inventario: Artefato[]): RankingDominio[] {
  const porSet = new Map<string, Ganho[]>();
  for (const p of perfis)
    for (const g of ganhosDoPersonagem(p, inventario)) porSet.set(g.set, [...(porSet.get(g.set) ?? []), g]);
  const rankSet = (set: string): RankingSet => {
    const ganhos = (porSet.get(set) ?? []).filter((g) => g.contribuicao > 0.05).sort((a, b) => b.contribuicao - a.contribuicao);
    return { set, pontos: ganhos.reduce((s, g) => s + g.contribuicao, 0), ganhos };
  };
  const comDominio = new Set(DOMINIOS.flatMap((d) => d.sets));
  const lista: RankingDominio[] = DOMINIOS.map((d) => {
    const sets = d.sets.map(rankSet).sort((a, b) => b.pontos - a.pontos);
    return { dominio: d, pontos: sets.reduce((s, x) => s + x.pontos, 0), sets };
  });
  const semDominio = [...porSet.keys()].filter((s) => !comDominio.has(s)).map(rankSet).filter((x) => x.pontos > 0);
  if (semDominio.length)
    lista.push({ dominio: null, pontos: semDominio.reduce((s, x) => s + x.pontos, 0), sets: semDominio.sort((a, b) => b.pontos - a.pontos) });
  return lista.filter((x) => x.pontos > 0.05).sort((a, b) => b.pontos - a.pontos);
}
