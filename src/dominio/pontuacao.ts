import {
  FRACAO_MEDIA_ROLL,
  MAIN_STATS_POR_PECA,
  NIVEL_MAXIMO,
  ROLL_MAXIMO,
} from "./stats";
import type { Artefato, ChaveSubstat, Peca, PerfilBuild, Substat } from "./tipos";
import { rollsPossiveis } from "./rolls";

// A nota é medida em "rolls úteis": quantos rolls máximos de 5★ em stats que o
// personagem usa o artefato carrega, ponderados pelo peso de cada stat.
// Ex.: uma peça com 7,77 de Dano Crít. e peso 1 vale 1,0 roll útil.
// Valores sempre divididos pelo roll máximo de 5★, para que um 4★ fique abaixo
// de um 5★ equivalente.

export function valorEmRolls(sub: Substat): number {
  return sub.valor / ROLL_MAXIMO[5][sub.chave];
}

function peso(perfil: PerfilBuild, chave: ChaveSubstat): number {
  return perfil.pesos[chave] ?? 0;
}

/** Substats que contam hoje (o 4º só conta depois de ativado). */
export function substatsAtivos(a: Artefato): Substat[] {
  if (a.substats.length === 4 && !a.quartoAtivo) return a.substats.slice(0, 3);
  return a.substats;
}

/** Nota atual: só substats já ativos. */
export function notaAtual(a: Artefato, perfil: PerfilBuild): number {
  return substatsAtivos(a).reduce(
    (soma, s) => soma + valorEmRolls(s) * peso(perfil, s.chave),
    0,
  );
}

/** Quantos upgrades (+4, +8, ...) ainda faltam até o nível máximo. */
export function upgradesRestantes(a: Artefato): number {
  const max = NIVEL_MAXIMO[a.raridade];
  return Math.max(0, Math.floor(max / 4) - Math.floor(a.nivel / 4));
}

export interface Projecao {
  notaAtual: number;
  notaEsperada: number; // nota média esperada no nível máximo
  notaMaximaPossivel: number; // se todos os rolls restantes caírem no melhor stat com 100%
  rollsRestantes: number; // rolls que de fato aumentam um substat
  chanceMetadeUteis: number; // chance de pelo menos metade dos rolls restantes caírem em stats com peso >= 0,5
}

/**
 * Projeta a nota no nível máximo.
 * Regras do jogo usadas:
 * - Cada +4 sorteia um dos 4 substats com chance igual (1 em 4) e soma 70% a 100% do roll máximo.
 * - Se o 4º substat está inativo, o próximo upgrade só o ativa (não soma roll extra).
 * - Uma peça com menos de 4 substats ganha um substat novo e desconhecido no próximo upgrade;
 *   aqui ele é estimado pelo peso médio dos substats que o personagem usa (aproximação).
 */
export function projetar(a: Artefato, perfil: PerfilBuild): Projecao {
  const atual = notaAtual(a, perfil);
  let upgrades = upgradesRestantes(a);
  const raridade = a.raridade;
  const mediaRoll = (ROLL_MAXIMO[raridade].critDMG_ / ROLL_MAXIMO[5].critDMG_) * FRACAO_MEDIA_ROLL;
  const maxRoll = ROLL_MAXIMO[raridade].critDMG_ / ROLL_MAXIMO[5].critDMG_;

  let esperado = atual;
  let maximo = atual;
  const pesos: number[] = a.substats.map((s) => peso(perfil, s.chave));

  // 4º substat bloqueado: o primeiro upgrade apenas o ativa.
  if (a.substats.length === 4 && !a.quartoAtivo && upgrades > 0) {
    const quarto = valorEmRolls(a.substats[3]) * pesos[3];
    esperado += quarto;
    maximo += quarto;
    upgrades -= 1;
  }

  // Peça com 3 substats sem o 4º informado: o primeiro upgrade cria um substat novo.
  if (a.substats.length < 4 && upgrades > 0) {
    const mediaPesos = mediaDosPesosUteis(perfil, a);
    esperado += mediaRoll * mediaPesos;
    maximo += maxRoll * maiorPesoDisponivel(perfil, a);
    pesos.push(mediaPesos);
    upgrades -= 1;
  }

  const n = pesos.length || 1;
  const pesoMedio = pesos.reduce((s, p) => s + p, 0) / n;
  const melhorPeso = Math.max(0, ...pesos);

  esperado += upgrades * mediaRoll * pesoMedio;
  maximo += upgrades * maxRoll * melhorPeso;

  const uteis = pesos.filter((p) => p >= 0.5).length;
  const p = uteis / n;
  const chanceMetadeUteis = upgrades === 0 ? 1 : probabilidadePeloMenos(upgrades, p, Math.ceil(upgrades / 2));

  return {
    notaAtual: atual,
    notaEsperada: esperado,
    notaMaximaPossivel: maximo,
    rollsRestantes: upgrades,
    chanceMetadeUteis,
  };
}

function statsDisponiveisParaNovoSub(a: Artefato): ChaveSubstat[] {
  const usados = new Set<string>([a.mainStat, ...a.substats.map((s) => s.chave)]);
  return (Object.keys(ROLL_MAXIMO[5]) as ChaveSubstat[]).filter((c) => !usados.has(c));
}

function mediaDosPesosUteis(perfil: PerfilBuild, a: Artefato): number {
  const disponiveis = statsDisponiveisParaNovoSub(a);
  if (disponiveis.length === 0) return 0;
  return disponiveis.reduce((s, c) => s + peso(perfil, c), 0) / disponiveis.length;
}

function maiorPesoDisponivel(perfil: PerfilBuild, a: Artefato): number {
  return Math.max(0, ...statsDisponiveisParaNovoSub(a).map((c) => peso(perfil, c)));
}

/** P(X >= k) com X ~ Binomial(n, p). */
export function probabilidadePeloMenos(n: number, p: number, k: number): number {
  let total = 0;
  for (let i = k; i <= n; i++) total += combinacao(n, i) * p ** i * (1 - p) ** (n - i);
  return Math.min(1, Math.max(0, total));
}

function combinacao(n: number, k: number): number {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

export function mainStatAceita(a: Artefato, perfil: PerfilBuild): boolean {
  if (a.peca === "flower" || a.peca === "plume") return true;
  return perfil.mainStats[a.peca].includes(a.mainStat);
}

export function setRecomendado(a: Artefato, perfil: PerfilBuild): boolean {
  return perfil.sets.some((s) => s.toLowerCase() === a.set.toLowerCase());
}

export interface Candidato {
  artefato: Artefato;
  nota: number;
  setOk: boolean;
  diferenca: number; // nota do candidato - nota da peça atual
  motivo: string;
}

/**
 * Para uma peça (slot), lista os artefatos do inventário melhores que o equipado.
 * Só entram peças já no nível máximo e com main stat aceita pelo perfil;
 * peças ainda por upar aparecem na análise "vale upar?".
 */
export function recomendarTroca(
  perfil: PerfilBuild,
  peca: Peca,
  inventario: Artefato[],
  equipado: Artefato | undefined,
): Candidato[] {
  const notaEquipado = equipado ? notaAtual(equipado, perfil) : 0;
  return inventario
    .filter(
      (a) =>
        a.peca === peca &&
        a.id !== equipado?.id &&
        a.nivel >= NIVEL_MAXIMO[a.raridade] &&
        mainStatAceita(a, perfil),
    )
    .map((a) => {
      const nota = notaAtual(a, perfil);
      const setOk = setRecomendado(a, perfil);
      const diferenca = nota - notaEquipado;
      const partes = [`+${diferenca.toFixed(1)} rolls úteis`];
      if (setOk) partes.push("set recomendado");
      if (equipado && setRecomendado(equipado, perfil) && !setOk) partes.push("atenção: sai de um set recomendado");
      if (a.equipadoEm && a.equipadoEm !== perfil.id) partes.push("está equipado em outro personagem");
      return { artefato: a, nota, setOk, diferenca, motivo: partes.join("; ") };
    })
    .filter((c) => c.diferenca > 0.05)
    .sort((x, y) => y.diferenca - x.diferenca);
}

export type Veredito = "upar" | "talvez" | "descartar" | "pronto";

/** Decide se vale investir num artefato que ainda não está no nível máximo. */
export function vereditoInvestimento(
  a: Artefato,
  perfil: PerfilBuild,
  notaReferencia: number,
): { veredito: Veredito; projecao: Projecao } {
  const projecao = projetar(a, perfil);
  if (projecao.rollsRestantes === 0 && a.nivel >= NIVEL_MAXIMO[a.raridade]) {
    return { veredito: "pronto", projecao };
  }
  if (!mainStatAceita(a, perfil)) return { veredito: "descartar", projecao };
  if (projecao.notaEsperada > notaReferencia) return { veredito: "upar", projecao };
  if (projecao.notaMaximaPossivel > notaReferencia) return { veredito: "talvez", projecao };
  return { veredito: "descartar", projecao };
}

/** Referência quando não há peça equipada: uma peça "boa" de +20 tem ~5 rolls úteis. */
export const NOTA_REFERENCIA_PADRAO = 5;

export function validarArtefato(a: Omit<Artefato, "id" | "criadoEm">): string[] {
  const erros: string[] = [];
  if (!a.set.trim()) erros.push("Informe o set.");
  if (!MAIN_STATS_POR_PECA[a.peca].includes(a.mainStat)) erros.push("Main stat não existe nessa peça.");
  const max = NIVEL_MAXIMO[a.raridade];
  if (a.nivel < 0 || a.nivel > max || !Number.isInteger(a.nivel)) erros.push(`Nível deve ser de 0 a ${max}.`);
  if (a.substats.length < 1 || a.substats.length > 4) erros.push("Informe de 1 a 4 substats.");
  const chaves = a.substats.map((s) => s.chave);
  if (new Set(chaves).size !== chaves.length) erros.push("Substats repetidos.");
  if (chaves.includes(a.mainStat as ChaveSubstat)) erros.push("Um substat não pode ser igual à main stat.");
  for (const s of a.substats) {
    if (!(s.valor > 0)) erros.push(`Valor inválido em ${s.chave}.`);
    // Maior valor possível: roll inicial + todos os upgrades no mesmo stat.
    const teto = ROLL_MAXIMO[a.raridade][s.chave] * (Math.floor(max / 4) + 1) * 1.01;
    if (s.valor > teto) erros.push(`Valor de ${s.chave} acima do possível (${teto.toFixed(1)}).`);
  }
  if (a.nivel >= 4 && a.substats.length === 4 && !a.quartoAtivo)
    erros.push("A partir do +4 o 4º substat já está ativo.");
  return erros;
}

export interface LinhaDetalhe {
  chave: ChaveSubstat;
  valor: number;
  rolls: number[]; // quantos rolls esse substat pode ter recebido (1 = só o inicial)
  peso: number;
  contribuicao: number; // rolls úteis que esse substat soma na nota
  ativo: boolean; // false = 4º substat ainda bloqueado
}

/** De onde vem a nota: quanto cada substat soma, com quantos rolls e qual peso. */
export function detalharNota(a: Artefato, perfil: PerfilBuild): LinhaDetalhe[] {
  const ativos = new Set(substatsAtivos(a));
  return a.substats.map((s) => {
    const ativo = ativos.has(s);
    const p = peso(perfil, s.chave);
    return {
      chave: s.chave,
      valor: s.valor,
      rolls: rollsPossiveis(s, a.raridade),
      peso: p,
      contribuicao: ativo ? valorEmRolls(s) * p : 0,
      ativo,
    };
  });
}

// ---------- Distribuição da nota no nível máximo ----------

/** Frações do roll máximo que um upgrade pode somar (o jogo sorteia uma das quatro). */
const FRACOES_ROLL = [0.7, 0.8, 0.9, 1];

export interface PontoDistribuicao {
  nota: number; // nota final no nível máximo
  prob: number;
}

type Dist = Map<number, number>; // nota (arredondada a 0,001) -> probabilidade

const chaveNota = (n: number) => Math.round(n * 1000) / 1000;

function somarEm(d: Dist, nota: number, p: number) {
  const k = chaveNota(nota);
  d.set(k, (d.get(k) ?? 0) + p);
}

/** Aplica `upgrades` sorteios: cada um escolhe um substat (1 em n) e uma das 4 frações do roll. */
function aplicarUpgrades(base: number, pesos: number[], upgrades: number, roll: number): Dist {
  let d: Dist = new Map([[chaveNota(base), 1]]);
  if (pesos.length === 0) return d;
  const pSub = 1 / pesos.length;
  const pFr = 1 / FRACOES_ROLL.length;
  for (let u = 0; u < upgrades; u++) {
    const prox: Dist = new Map();
    for (const [nota, p] of d)
      for (const w of pesos) for (const f of FRACOES_ROLL) somarEm(prox, nota + f * roll * w, p * pSub * pFr);
    d = prox;
  }
  return d;
}

/**
 * Todas as notas possíveis no nível máximo, com a chance de cada uma.
 * Usa as mesmas regras de `projetar`: 1 em 4 para o substat, 70% a 100% do roll máximo,
 * 4º substat bloqueado gasta o primeiro upgrade só para ativar. Um substat novo e
 * desconhecido é sorteado entre os stats disponíveis com chance igual (aproximação).
 */
export function distribuicaoNota(a: Artefato, perfil: PerfilBuild): PontoDistribuicao[] {
  let upgrades = upgradesRestantes(a);
  const roll = ROLL_MAXIMO[a.raridade].critDMG_ / ROLL_MAXIMO[5].critDMG_;
  let base = notaAtual(a, perfil);
  const pesos = a.substats.map((s) => peso(perfil, s.chave));

  if (a.substats.length === 4 && !a.quartoAtivo && upgrades > 0) {
    base += valorEmRolls(a.substats[3]) * pesos[3];
    upgrades -= 1;
  }

  const final: Dist = new Map();
  if (a.substats.length < 4 && upgrades > 0) {
    const novos = statsDisponiveisParaNovoSub(a);
    for (const c of novos) {
      const w = peso(perfil, c);
      for (const f of FRACOES_ROLL) {
        const parcial = aplicarUpgrades(base + f * roll * w, [...pesos, w], upgrades - 1, roll);
        const pIni = 1 / (novos.length * FRACOES_ROLL.length);
        for (const [nota, p] of parcial) somarEm(final, nota, p * pIni);
      }
    }
  } else {
    for (const [nota, p] of aplicarUpgrades(base, pesos, upgrades, roll)) somarEm(final, nota, p);
  }

  return [...final].map(([nota, prob]) => ({ nota, prob })).sort((x, y) => x.nota - y.nota);
}

/** Chance de a nota final passar de `referencia`. */
export function chanceDeSuperar(dist: PontoDistribuicao[], referencia: number): number {
  return dist.reduce((s, p) => s + (p.nota > referencia + 1e-9 ? p.prob : 0), 0);
}

export interface FaixaDistribuicao {
  de: number;
  ate: number;
  prob: number;
}

/** Agrupa a distribuição em faixas de largura fixa (em rolls úteis), para o gráfico. */
export function faixasDistribuicao(dist: PontoDistribuicao[], largura = 1, origem = 0): FaixaDistribuicao[] {
  if (dist.length === 0) return [];
  // `origem` vira uma das bordas: assim nenhuma faixa fica metade abaixo e metade acima da referência.
  const ini = origem + Math.floor((dist[0].nota - origem) / largura) * largura;
  const fim = dist[dist.length - 1].nota;
  const faixas: FaixaDistribuicao[] = [];
  for (let de = ini; de <= fim + 1e-9; de += largura) faixas.push({ de, ate: de + largura, prob: 0 });
  for (const p of dist) {
    const i = Math.min(faixas.length - 1, Math.floor((p.nota - ini) / largura + 1e-9));
    faixas[i].prob += p.prob;
  }
  return faixas;
}
