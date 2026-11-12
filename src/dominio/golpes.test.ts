import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularGolpes, MULT_DEF, MULT_RES } from "./golpes";
import { niveisEfetivos, bonusDasConstelacoes } from "./extras";
import type { Avaliacao, BasePersonagem } from "./build";

const av = {
  config: { modelo: "dano", escala: "atk", tipoDano: "pyro_dmg_", pesoReacao: 0, metaRecarga: 100 },
  totais: { critRate_: 50, critDMG_: 100, pyro_dmg_: 46.6, eleMas: 100 },
  final: { atk: 2000, hp: 20000, def: 800 },
} as unknown as Avaliacao;

test("golpe: 100% ATQ com 46,6% de bônus, 50% de Taxa e 100% de Dano Crít.", () => {
  const [g] = calcularGolpes({ nome: "x", golpes: [{ rotulo: "Golpe", partes: [{ escala: "atk", vezes: 1, valores: [1] }] }] }, 1, av);
  const esperado = 2000 * 1.466 * MULT_DEF * MULT_RES;
  assert.ok(Math.abs(g.semCritico - esperado) < 1e-6);
  assert.ok(Math.abs(g.critico - esperado * 2) < 1e-6);
  assert.ok(Math.abs(g.media - esperado * 1.5) < 1e-6);
});

test("golpe: ATQ + Proficiência somam; ×3 multiplica", () => {
  const [g] = calcularGolpes(
    { nome: "x", golpes: [{ rotulo: "G", partes: [{ escala: "atk", vezes: 3, valores: [0.5] }, { escala: "em", vezes: 1, valores: [1] }] }] },
    1,
    av,
  );
  assert.ok(Math.abs(g.semCritico - (2000 * 0.5 * 3 + 100) * 1.466 * MULT_DEF * MULT_RES) < 1e-6);
});

test("constelações: C3 dá +3 no talento e C1 soma bônus", () => {
  const base = {
    hp: 1, atk: 1, def: 1, ascensao: null,
    constelacoes: [
      { nome: "C1", texto: "", bonus: { atk_: 40 }, talento: null },
      { nome: "C2", texto: "", bonus: {}, talento: null },
      { nome: "C3", texto: "", bonus: {}, talento: "burst" },
    ],
  } as BasePersonagem;
  const cfg = { personagem: "x", constelacao: 3, talentos: { normal: 6, skill: 9, burst: 10 } };
  assert.deepEqual(niveisEfetivos(base, cfg), { normal: 6, skill: 9, burst: 13 });
  assert.deepEqual(bonusDasConstelacoes(base, cfg), { atk_: 40 });
  assert.deepEqual(bonusDasConstelacoes(base, { ...cfg, constelacao: 0 }), {});
});
