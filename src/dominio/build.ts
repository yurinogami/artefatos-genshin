// Avaliação da build inteira: soma os stats do personagem, da arma, das 5 peças e dos bônus de set
// e estima o dano (DPS) ou a utilidade (suporte). Complementa a nota de cada peça (rolls úteis),
// que continua existindo e aparecendo na tela.
import type { Artefato, ChaveMainStat, ChaveSubstat, PerfilBuild } from "./tipos";
import { notaAtual, substatsAtivos } from "./pontuacao";
import { FRACAO_MEDIA_ROLL, ROLL_MAXIMO } from "./stats";
import { BONUS_SETS, type Bonus, type ChaveBonus } from "./bonus-sets";

export interface Arma {
  personagem: string; // id do perfil
  nome: string;
  en?: string; // nome em inglês quando escolhida da lista (liga a arma à passiva)
  refinamento?: number; // 1 a 5
  atk: number; // ATQ base da arma
  secundario: { chave: ChaveMainStat; valor: number } | null;
}

/** Constelação e níveis de talento que o jogador tem em cada personagem. */
export interface ConfigPersonagem {
  personagem: string;
  constelacao?: number; // 0 a 6
  talentos?: { normal: number; skill: number; burst: number }; // 1 a 10 (sem contar o +3 das constelações)
  possui?: boolean; // true/false = marcado pelo jogador; ausente = deduzido (tem peça equipada?)
  setEscolhido?: Record<string, string>; // chave da build ("mavuika", "mavuika:subdps") → set que o jogador decidiu usar
}

export interface Constelacao {
  nome: string;
  texto: string;
  bonus: Bonus;
  talento: "normal" | "skill" | "burst" | null; // C3/C5: +3 neste talento
}

export interface BasePersonagem {
  hp: number;
  atk: number;
  def: number;
  ascensao: { chave: ChaveMainStat; valor: number } | null;
  arma?: string;
  constelacoes?: Constelacao[];
}

// Main stat: valor no +0 e no nível máximo (5★: +20, 4★: +16). Entre os dois o jogo sobe quase em linha reta.
const MAIN: Record<4 | 5, Partial<Record<ChaveMainStat, [number, number]>>> = {
  5: {
    hp: [717, 4780], atk: [47, 311], hp_: [7, 46.6], atk_: [7, 46.6], def_: [8.7, 58.3], eleMas: [28, 186.5],
    enerRech_: [7.8, 51.8], critRate_: [4.7, 31.1], critDMG_: [9.3, 62.2], heal_: [5.4, 35.9], physical_dmg_: [8.7, 58.3],
    pyro_dmg_: [7, 46.6], hydro_dmg_: [7, 46.6], electro_dmg_: [7, 46.6], cryo_dmg_: [7, 46.6],
    anemo_dmg_: [7, 46.6], geo_dmg_: [7, 46.6], dendro_dmg_: [7, 46.6],
  },
  4: {
    hp: [645, 3571], atk: [42, 232], hp_: [6.3, 34.8], atk_: [6.3, 34.8], def_: [7.9, 43.5], eleMas: [25.2, 139.3],
    enerRech_: [7, 38.7], critRate_: [4.2, 23.2], critDMG_: [8.4, 46.4], heal_: [4.8, 26.8], physical_dmg_: [7.9, 43.5],
    pyro_dmg_: [6.3, 34.8], hydro_dmg_: [6.3, 34.8], electro_dmg_: [6.3, 34.8], cryo_dmg_: [6.3, 34.8],
    anemo_dmg_: [6.3, 34.8], geo_dmg_: [6.3, 34.8], dendro_dmg_: [6.3, 34.8],
  },
};

export function valorMainStat(a: Pick<Artefato, "raridade" | "mainStat" | "nivel">): number {
  const [ini, fim] = MAIN[a.raridade][a.mainStat] ?? [0, 0];
  const max = a.raridade === 5 ? 20 : 16;
  return ini + ((fim - ini) * Math.min(a.nivel, max)) / max;
}

export type Totais = Record<ChaveBonus, number>;

const ELEMENTO: Record<string, ChaveMainStat> = {
  Pyro: "pyro_dmg_", Hydro: "hydro_dmg_", Electro: "electro_dmg_", Cryo: "cryo_dmg_",
  Anemo: "anemo_dmg_", Geo: "geo_dmg_", Dendro: "dendro_dmg_",
};

export interface ConfigCalculo {
  modelo: "dano" | "suporte";
  escala: "atk" | "hp" | "def"; // stat que o dano usa
  tipoDano: ChaveMainStat; // bônus de dano que conta (elemento do personagem ou físico)
  pesoReacao: number; // 0 a 1: quanto do dano vem de reações que a Proficiência aumenta
  metaRecarga: number; // % de Recarga que a build precisa ter
}

/** Como calcular cada perfil. Sai dos pesos do perfil; um perfil pode sobrescrever com o campo `calculo`. */
export function configCalculo(perfil: PerfilBuild): ConfigCalculo {
  const p = perfil.pesos;
  const w = (k: keyof typeof p) => p[k] ?? 0;
  const modelo = w("critDMG_") >= 0.75 && w("critRate_") >= 0.5 ? "dano" : "suporte";
  const escalas: ["atk" | "hp" | "def", number][] = [["atk", w("atk_")], ["hp", w("hp_")], ["def", w("def_")]];
  const escala = escalas.reduce((m, e) => (e[1] > m[1] ? e : m))[0];
  const el = ELEMENTO[perfil.elemento];
  const goblet = perfil.mainStats.goblet;
  const tipoDano = goblet.includes(el) || !goblet.includes("physical_dmg_") ? el : "physical_dmg_";
  const er = w("enerRech_");
  const metaRecarga = er >= 0.8 ? 180 : er >= 0.5 ? 150 : er >= 0.25 ? 120 : 100;
  const extra = (perfil as PerfilBuild & { calculo?: Partial<ConfigCalculo> }).calculo ?? {};
  return { modelo, escala, tipoDano, pesoReacao: w("eleMas"), metaRecarga, ...extra };
}

/** Sets com bônus ativo: 2 ou 4 peças do mesmo set. */
export function setsAtivos(pecas: Artefato[]): { set: string; pecas: 2 | 4 }[] {
  const conta = new Map<string, number>();
  for (const a of pecas) conta.set(a.set, (conta.get(a.set) ?? 0) + 1);
  return [...conta]
    .filter(([, n]) => n >= 2)
    .map(([set, n]) => ({ set, pecas: (n >= 4 ? 4 : 2) as 2 | 4 }));
}

/** Soma de tudo: personagem (nível 90), arma, main stats, substats ativos e bônus de set. */
export function somarTotais(pecas: Artefato[], base: BasePersonagem, arma: Arma, extras?: Bonus): Totais {
  const t = {} as Totais;
  const add = (k: ChaveBonus, v: number) => (t[k] = (t[k] ?? 0) + v);
  add("critRate_", 5);
  add("critDMG_", 50);
  add("enerRech_", 100);
  if (base.ascensao) add(base.ascensao.chave, base.ascensao.valor);
  if (arma.secundario) add(arma.secundario.chave, arma.secundario.valor);
  for (const a of pecas) {
    add(a.mainStat, valorMainStat(a));
    for (const s of substatsAtivos(a)) add(s.chave, s.valor);
  }
  for (const [k, val] of Object.entries(extras ?? {})) add(k as ChaveBonus, val!);
  for (const { set, pecas: n } of setsAtivos(pecas)) {
    const b = BONUS_SETS[set];
    for (const nivel of [2, 4] as const) {
      if (n < nivel || !b?.[nivel]) continue;
      for (const [k, v] of Object.entries(b[nivel]!)) add(k as ChaveBonus, v!);
    }
  }
  return t;
}

const v = (t: Totais, k: ChaveBonus) => t[k] ?? 0;

export interface Avaliacao {
  config: ConfigCalculo;
  totais: Totais;
  final: { atk: number; hp: number; def: number }; // stats finais (base × % + fixo)
  valor: number; // o que o otimizador maximiza (dano estimado ou rolls úteis com teto de Recarga)
  rolls: number; // soma da nota individual das peças (rolls úteis)
  multCrit?: number;
  fatorRecarga: number;
  taxaDesperdicada: number; // % de Taxa Crítica acima de 100
  avisos: string[];
}

export function avaliarBuild(
  pecas: Artefato[],
  perfil: PerfilBuild,
  base: BasePersonagem,
  arma: Arma,
  extras?: Bonus, // passiva da arma + constelações
): Avaliacao {
  const config = configCalculo(perfil);
  const t = somarTotais(pecas, base, arma, extras);
  const final = finais(t, base, arma);
  const rolls = pecas.reduce((s, a) => s + notaAtual(a, perfil), 0);
  const er = v(t, "enerRech_");
  const fatorRecarga = er >= config.metaRecarga ? 1 : Math.max(0.5, er / config.metaRecarga);
  const taxa = v(t, "critRate_");
  const avisos: string[] = [];
  if (er < config.metaRecarga - 0.5)
    avisos.push(`Recarga em ${er.toFixed(0)}%, abaixo da meta de ${config.metaRecarga}% deste perfil.`);

  if (config.modelo === "suporte") {
    // Suporte: continua valendo a soma dos rolls úteis, mas Recarga acima da meta não conta mais.
    let valor = rolls;
    const excesso = er - config.metaRecarga;
    const pesoER = perfil.pesos.enerRech_ ?? 0;
    if (excesso > 0 && pesoER > 0) {
      const subsER = pecas.reduce(
        (s, a) => s + substatsAtivos(a).filter((x) => x.chave === "enerRech_").reduce((z, x) => z + x.valor, 0),
        0,
      );
      valor -= (Math.min(excesso, subsER) / ROLL_MAXIMO[5].enerRech_) * pesoER;
    }
    return { config, totais: t, final, valor, rolls, fatorRecarga, taxaDesperdicada: 0, avisos };
  }

  const taxaDesperdicada = Math.max(0, taxa - 100);
  if (taxaDesperdicada > 0.5) avisos.push(`Taxa Crítica em ${taxa.toFixed(1)}%: ${taxaDesperdicada.toFixed(1)}% passam de 100% e não valem nada.`);
  const { valor, multCrit } = danoEstimado(t, base, arma, config);
  return { config, totais: t, final, valor, rolls, multCrit, fatorRecarga, taxaDesperdicada, avisos };
}

function finais(t: Totais, base: BasePersonagem, arma: Arma) {
  return {
    atk: (base.atk + arma.atk + v(t, "atkBase")) * (1 + v(t, "atk_") / 100) + v(t, "atk"),
    hp: base.hp * (1 + v(t, "hp_") / 100) + v(t, "hp"),
    def: base.def * (1 + v(t, "def_") / 100) + v(t, "def"),
  };
}

/** Dano estimado a partir dos stats somados (modelo de DPS). */
function danoEstimado(t: Totais, base: BasePersonagem, arma: Arma, config: ConfigCalculo) {
  const er = v(t, "enerRech_");
  const fatorRecarga = er >= config.metaRecarga ? 1 : Math.max(0.5, er / config.metaRecarga);
  const taxaUtil = Math.min(100, Math.max(0, v(t, "critRate_")));
  const multCrit = 1 + (taxaUtil / 100) * (v(t, "critDMG_") / 100);
  const bonusDano = 1 + (v(t, config.tipoDano) + v(t, "dano_")) / 100;
  const em = v(t, "eleMas");
  // Reação amplificadora: bônus da Proficiência = 2,78 × EM / (EM + 1400), aplicado à parte do dano que reage.
  const multReacao = 1 + config.pesoReacao * 0.5 * ((2.78 * em) / (em + 1400));
  return { valor: finais(t, base, arma)[config.escala] * multCrit * bonusDano * multReacao * fatorRecarga, multCrit };
}

/**
 * Quanto 1 roll médio a mais de um substat aumentaria o dano estimado desta build (em %).
 * Mostra o que falta: com Taxa sobrando, um roll de Dano Crítico vale mais, e vice-versa.
 */
export function ganhoDeUmRoll(av: Avaliacao, base: BasePersonagem, arma: Arma, chave: ChaveSubstat): number {
  if (av.config.modelo !== "dano" || av.valor <= 0) return 0;
  const t = { ...av.totais, [chave]: (av.totais[chave] ?? 0) + ROLL_MAXIMO[5][chave] * FRACAO_MEDIA_ROLL };
  return (danoEstimado(t, base, arma, av.config).valor / av.valor - 1) * 100;
}
