// Lê os textos (em inglês) de passivas de arma e constelações do genshin-db e tira as partes
// que viram stat simples ("HP increased by 20%", "gains 40% ATK"). É uma aproximação:
// efeitos condicionais entram como ativos, acúmulos contam uma vez, e o que depende de outro
// stat (ex.: "ATK Bonus based on 0.8% of Max HP") ou só vale para um tipo de ataque fica de fora.
import type { Bonus, ChaveBonus } from "./bonus-sets";

const STAT = "(ATK|HP|DEF|CRIT Rate|CRIT DMG|Elemental Mastery|Energy Recharge|All Elemental DMG Bonus|Elemental DMG Bonus|DMG Bonus|DMG)";

function chave(stat: string, pct: boolean): ChaveBonus | null {
  switch (stat.toLowerCase()) {
    case "atk":
      return pct ? "atk_" : "atk";
    case "hp":
      return pct ? "hp_" : "hp";
    case "def":
      return pct ? "def_" : "def";
    case "crit rate":
      return "critRate_";
    case "crit dmg":
      return "critDMG_";
    case "elemental mastery":
      return "eleMas";
    case "energy recharge":
      return "enerRech_";
    default:
      return pct ? "dano_" : null; // bônus de dano geral
  }
}

// Frases que não são um stat do próprio personagem para a build inteira.
const IGNORAR = /party|other characters|opponent|enemies|nearby|team|shield|healing|Base ATK|based on/i;
// "Elemental Skill DMG increased by 16%" vale só para um tipo de ataque: fica de fora.
const SO_UM_ATAQUE = /(Normal|Charged|Plunging|Skill|Burst|Attack|Reaction|Bloom|Swirl|Lunar[- ]\w+)\s*$/i;

export function lerBonus(texto: string): Bonus {
  const b: Bonus = {};
  const add = (k: ChaveBonus | null, v: number) => {
    if (k && !(k in b) && v > 0) b[k] = v;
  };
  for (const frase of texto.replace(/\n/g, " ").split(/(?<=[.;])\s+/)) {
    if (IGNORAR.test(frase)) continue;
    const padroes: RegExp[] = [
      new RegExp(`\\b${STAT}\\s+(?:is\\s+)?increased\\s+by\\s+([\\d.]+)(%?)`, "gi"),
      new RegExp(`\\bIncreases?\\s+(?:\\w+'s\\s+)?${STAT}\\s+by\\s+([\\d.]+)(%?)`, "gi"),
      new RegExp(`\\b(?:gain|gains|obtain|obtains|grants?)\\s+(?:an?\\s+)?(?:additional\\s+)?([\\d.]+)(%)\\s+${STAT}`, "gi"),
    ];
    padroes.forEach((re, i) => {
      for (const m of frase.matchAll(re)) {
        const [stat, num, pct] = i === 2 ? [m[3], m[1], m[2]] : [m[1], m[2], m[3]];
        if (SO_UM_ATAQUE.test(frase.slice(0, m.index))) continue;
        // "ATK increased by 28% of Energy Recharge": conversão de outro stat, fica de fora.
        if (/^\s*of\b/i.test(frase.slice(m.index! + m[0].length))) continue;
        add(chave(stat, pct === "%"), Number(num));
      }
    });
  }
  const base = texto.match(/Base ATK is increased by ([\d.]+)(?!%)/i);
  if (base) b.atkBase = Number(base[1]);
  return b;
}

/** "Increases the Level of Hour of Burning Skies by 3" → nome do talento. */
export function talentoMais3(texto: string): string | null {
  return texto.match(/Increases the Level of (.+?) by 3/i)?.[1]?.trim() ?? null;
}

export interface ParteGolpe {
  param: string;
  escala: "atk" | "hp" | "def" | "em";
  vezes: number;
}

/**
 * Rótulo de talento do genshin-db, ex.: "3-Hit DMG|{param3:F1P}×3" ou
 * "Tri-Karma Purification DMG|{param3:F1P} ATK+{param4:F1P} Elemental Mastery".
 * Devolve as partes que formam o dano, ou null se a linha não é um golpe (custo, duração, bônus...).
 */
export function lerGolpe(rotulo: string): ParteGolpe[] | null {
  const [nome, formato = ""] = rotulo.split("|");
  // Linhas que não são dano: cura, custo, duração, bônus etc. O resto com multiplicador em % é golpe
  // (inclui nomes sem "DMG", como "Charged Attack: Equitable Judgment").
  if (/Bonus|Reduction|Increase|Stamina|Absorption|Shield|Heal|Restor|Regenerat|Loss|Cost|Duration|Interval|Limit|Energy|CD|Res\b|Decrease|Consum|Gain|Conversion/i.test(nome)) return null;
  const primeira = formato.split("/")[0]; // "Low/High Plunge": fica com a primeira
  const partes: ParteGolpe[] = [];
  const re = /\{(param\d+):([A-Z0-9]+)\}\s*(?:[×x*]\s*(\d+))?\s*(Max HP|ATK|DEF|Elemental Mastery)?/g;
  for (const m of primeira.matchAll(re)) {
    if (!m[2].includes("P")) continue; // só multiplicadores em %
    const escala = m[4] === "Max HP" ? "hp" : m[4] === "DEF" ? "def" : m[4] === "Elemental Mastery" ? "em" : "atk";
    partes.push({ param: m[1], escala, vezes: m[3] ? Number(m[3]) : 1 });
  }
  if (/per |for each/i.test(primeira)) return null;
  return partes.length ? partes : null;
}
