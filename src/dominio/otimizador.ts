// Melhor build possível com o inventário atual.
// Regra (decidida pelo usuário): 4 peças de um mesmo set recomendado + 1 peça livre;
// se nenhum set recomendado tiver 4 peças utilizáveis, monta sem set e avisa.
import { PECAS } from "./stats";
import { mainStatAceita, notaAtual } from "./pontuacao";
import type { Artefato, Peca, PerfilBuild } from "./tipos";
import { avaliarBuild, type Arma, type Avaliacao, type BasePersonagem } from "./build";
import type { Bonus } from "./bonus-sets";

export interface PecaEscolhida {
  artefato: Artefato;
  nota: number;
  doSet: boolean; // conta para o bônus de 4 peças
  conflito: string | null; // id do personagem de quem a peça teria que sair
}

export interface ResultadoSet {
  set: string;
  nota: number | null; // null = não há 4 peças utilizáveis desse set
  faltam: Peca[]; // peças do set que não existem no inventário (com main stat aceita)
  valor?: number; // com arma cadastrada: valor da build inteira (dano estimado ou rolls de suporte)
}

export interface MelhorBuild {
  set: string | null; // null = sem bônus de set
  pecas: Partial<Record<Peca, PecaEscolhida>>;
  nota: number; // soma da nota individual (rolls úteis) das peças escolhidas
  porSet: ResultadoSet[];
  avaliacao?: Avaliacao; // com arma cadastrada: a build foi escolhida pela nota da build inteira
}

export interface ContextoBuild {
  base: BasePersonagem;
  arma: Arma;
  extras?: Bonus; // passiva da arma no refinamento escolhido + constelações desbloqueadas
}

interface Opcao {
  artefato: Artefato;
  nota: number;
}

function melhor(lista: Opcao[]): Opcao | undefined {
  return lista.reduce<Opcao | undefined>((m, o) => (!m || o.nota > m.nota ? o : m), undefined);
}

/**
 * Melhor build com o inventário.
 * Sem contexto (arma): soma da nota individual de cada peça, o critério antigo.
 * Com contexto: escolhe as peças pela build inteira (stats somados, bônus de set, Taxa limitada a 100%,
 * meta de Recarga), testando trocas peça a peça até não haver melhora.
 */
export function melhorBuild(perfil: PerfilBuild, inventario: Artefato[], ctx?: ContextoBuild): MelhorBuild {
  if (ctx) return melhorBuildInteira(perfil, inventario, ctx);
  const porPeca: Record<Peca, Opcao[]> = { flower: [], plume: [], sands: [], goblet: [], circlet: [] };
  for (const a of inventario) if (mainStatAceita(a, perfil)) porPeca[a.peca].push({ artefato: a, nota: notaAtual(a, perfil) });

  const melhorQualquer = Object.fromEntries(PECAS.map((p) => [p, melhor(porPeca[p])])) as Record<Peca, Opcao | undefined>;

  const montar = (escolha: Partial<Record<Peca, Opcao>>, set: string | null): MelhorBuild["pecas"] =>
    Object.fromEntries(
      Object.entries(escolha).map(([p, o]) => [
        p,
        {
          artefato: o!.artefato,
          nota: o!.nota,
          doSet: set !== null && o!.artefato.set === set,
          conflito: o!.artefato.equipadoEm && o!.artefato.equipadoEm !== perfil.id ? o!.artefato.equipadoEm : null,
        },
      ]),
    );

  let vencedor: { set: string; escolha: Partial<Record<Peca, Opcao>>; nota: number } | null = null;
  const porSet: ResultadoSet[] = [];

  for (const set of perfil.sets) {
    const doSet = Object.fromEntries(
      PECAS.map((p) => [p, melhor(porPeca[p].filter((o) => o.artefato.set === set))]),
    ) as Record<Peca, Opcao | undefined>;
    const faltam = PECAS.filter((p) => !doSet[p]);
    let melhorAqui: { escolha: Partial<Record<Peca, Opcao>>; nota: number } | null = null;
    // A peça livre pode ficar em qualquer slot; as outras 4 precisam ser do set.
    for (const livre of PECAS) {
      if (PECAS.some((p) => p !== livre && !doSet[p])) continue;
      const escolha: Partial<Record<Peca, Opcao>> = {};
      for (const p of PECAS) {
        const o = p === livre ? melhorQualquer[p] : doSet[p];
        if (o) escolha[p] = o;
      }
      const nota = Object.values(escolha).reduce((s, o) => s + o!.nota, 0);
      if (!melhorAqui || nota > melhorAqui.nota) melhorAqui = { escolha, nota };
    }
    porSet.push({ set, nota: melhorAqui?.nota ?? null, faltam });
    // Em empate, fica o set que vem antes na lista (o mais recomendado).
    if (melhorAqui && (!vencedor || melhorAqui.nota > vencedor.nota + 1e-9)) vencedor = { set, ...melhorAqui };
  }

  if (vencedor) return { set: vencedor.set, pecas: montar(vencedor.escolha, vencedor.set), nota: vencedor.nota, porSet };

  const escolha: Partial<Record<Peca, Opcao>> = {};
  for (const p of PECAS) if (melhorQualquer[p]) escolha[p] = melhorQualquer[p];
  const nota = Object.values(escolha).reduce((s, o) => s + o!.nota, 0);
  return { set: null, pecas: montar(escolha, null), nota, porSet };
}

// ---------- Build inteira ----------

const CANDIDATOS_POR_NOTA = 25;
const CANDIDATOS_POR_STAT = 5;

/** Corta a lista de um slot: as melhores pela nota individual + as melhores em cada stat de crítico/Recarga. */
function cortar(lista: Opcao[]): Opcao[] {
  if (lista.length <= CANDIDATOS_POR_NOTA) return lista;
  const escolhidas = new Set(lista.slice().sort((a, b) => b.nota - a.nota).slice(0, CANDIDATOS_POR_NOTA));
  for (const chave of ["critRate_", "critDMG_", "enerRech_"] as const) {
    const valor = (o: Opcao) => o.artefato.substats.find((s) => s.chave === chave)?.valor ?? 0;
    for (const o of lista.slice().sort((a, b) => valor(b) - valor(a)).slice(0, CANDIDATOS_POR_STAT)) escolhidas.add(o);
  }
  return [...escolhidas];
}

function melhorBuildInteira(perfil: PerfilBuild, inventario: Artefato[], ctx: ContextoBuild): MelhorBuild {
  const porPeca: Record<Peca, Opcao[]> = { flower: [], plume: [], sands: [], goblet: [], circlet: [] };
  for (const a of inventario) if (mainStatAceita(a, perfil)) porPeca[a.peca].push({ artefato: a, nota: notaAtual(a, perfil) });
  for (const p of PECAS) porPeca[p] = cortar(porPeca[p]);

  const avaliar = (e: Partial<Record<Peca, Opcao>>) =>
    avaliarBuild(Object.values(e).map((o) => o!.artefato), perfil, ctx.base, ctx.arma, ctx.extras).valor;

  /** Busca local: começa pela melhor peça de cada slot e troca uma peça por vez enquanto melhorar. */
  const buscar = (opcoes: Record<Peca, Opcao[]>) => {
    const escolha: Partial<Record<Peca, Opcao>> = {};
    for (const p of PECAS) {
      const m = melhor(opcoes[p]);
      if (m) escolha[p] = m;
    }
    let atual = avaliar(escolha);
    for (let passo = 0; passo < 8; passo++) {
      let mudou = false;
      for (const p of PECAS) {
        for (const o of opcoes[p]) {
          if (o === escolha[p]) continue;
          const teste = { ...escolha, [p]: o };
          const val = avaliar(teste);
          if (val > atual + 1e-9) {
            escolha[p] = o;
            atual = val;
            mudou = true;
          }
        }
      }
      if (!mudou) break;
    }
    return { escolha, valor: atual };
  };

  const montar = (escolha: Partial<Record<Peca, Opcao>>, set: string | null): MelhorBuild["pecas"] =>
    Object.fromEntries(
      Object.entries(escolha).map(([p, o]) => [
        p,
        {
          artefato: o!.artefato,
          nota: o!.nota,
          doSet: set !== null && o!.artefato.set === set,
          conflito: o!.artefato.equipadoEm && o!.artefato.equipadoEm !== perfil.id ? o!.artefato.equipadoEm : null,
        },
      ]),
    );

  let vencedor: { set: string; escolha: Partial<Record<Peca, Opcao>>; valor: number } | null = null;
  const porSet: ResultadoSet[] = [];
  for (const set of perfil.sets) {
    const doSet = Object.fromEntries(PECAS.map((p) => [p, porPeca[p].filter((o) => o.artefato.set === set)])) as Record<Peca, Opcao[]>;
    const faltam = PECAS.filter((p) => doSet[p].length === 0);
    let melhorAqui: { escolha: Partial<Record<Peca, Opcao>>; valor: number } | null = null;
    for (const livre of PECAS) {
      if (PECAS.some((p) => p !== livre && doSet[p].length === 0)) continue;
      const opcoes = Object.fromEntries(PECAS.map((p) => [p, p === livre ? porPeca[p] : doSet[p]])) as Record<Peca, Opcao[]>;
      const r = buscar(opcoes);
      if (!melhorAqui || r.valor > melhorAqui.valor) melhorAqui = r;
    }
    const soma = melhorAqui ? Object.values(melhorAqui.escolha).reduce((s, o) => s + o!.nota, 0) : null;
    porSet.push({ set, nota: soma, faltam, valor: melhorAqui?.valor });
    if (melhorAqui && (!vencedor || melhorAqui.valor > vencedor.valor + 1e-9)) vencedor = { set, ...melhorAqui };
  }

  const fechar = (escolha: Partial<Record<Peca, Opcao>>, set: string | null): MelhorBuild => {
    const pecas = Object.values(escolha).map((o) => o!.artefato);
    return {
      set,
      pecas: montar(escolha, set),
      nota: Object.values(escolha).reduce((s, o) => s + o!.nota, 0),
      porSet,
      avaliacao: avaliarBuild(pecas, perfil, ctx.base, ctx.arma, ctx.extras),
    };
  };
  if (vencedor) return fechar(vencedor.escolha, vencedor.set);
  return fechar(buscar(porPeca).escolha, null);
}
