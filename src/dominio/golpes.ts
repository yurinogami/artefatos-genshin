// Dano de cada golpe dos talentos, com os stats da build. Fórmula do jogo simplificada:
// stat × multiplicador × (1 + bônus de dano) × DEF do inimigo × RES do inimigo, sem reações.
// Inimigo de referência: nível 90 com 10% de resistência; personagem nível 90.
import type { Avaliacao } from "./build";

export interface DadosGolpe {
  rotulo: string;
  partes: { escala: "atk" | "hp" | "def" | "em"; vezes: number; valores: number[] }[];
}
export interface DadosTalento {
  nome: string;
  golpes: DadosGolpe[];
}

export const MULT_DEF = (90 + 100) / (90 + 100 + (90 + 100)); // 0,5
export const MULT_RES = 1 - 0.1;

export interface Golpe {
  rotulo: string;
  multiplicador: string; // ex.: "80,0% ATQ ×3"
  semCritico: number;
  critico: number;
  media: number;
}

const NOME_ESCALA = { atk: "ATQ", hp: "Vida", def: "DEF", em: "Proficiência" };

export function calcularGolpes(t: DadosTalento, nivel: number, av: Avaliacao): Golpe[] {
  const i = Math.min(Math.max(nivel, 1), 15) - 1;
  const stat = { ...av.final, em: av.totais.eleMas ?? 0 };
  const bonus = 1 + ((av.totais[av.config.tipoDano] ?? 0) + (av.totais.dano_ ?? 0)) / 100;
  const taxa = Math.min(100, Math.max(0, av.totais.critRate_ ?? 0)) / 100;
  const dc = (av.totais.critDMG_ ?? 0) / 100;
  return t.golpes.map((g) => {
    const base = g.partes.reduce((s, p) => s + stat[p.escala] * (p.valores[i] ?? 0) * p.vezes, 0);
    const semCritico = base * bonus * MULT_DEF * MULT_RES;
    return {
      rotulo: g.rotulo,
      multiplicador: g.partes
        .map(
          (p) =>
            `${((p.valores[i] ?? 0) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}% ${NOME_ESCALA[p.escala]}${p.vezes > 1 ? ` ×${p.vezes}` : ""}`,
        )
        .join(" + "),
      semCritico,
      critico: semCritico * (1 + dc),
      media: semCritico * (1 + taxa * dc),
    };
  });
}
