import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detalharNota,
  notaAtual,
  probabilidadePeloMenos,
  projetar,
  recomendarTroca,
  upgradesRestantes,
  validarArtefato,
  vereditoInvestimento,
} from "./pontuacao";
import type { Artefato, PerfilBuild } from "./tipos";

const perfil: PerfilBuild = {
  id: "teste",
  nome: "Teste",
  elemento: "Pyro",
  funcao: "DPS",
  sets: ["Crimson Witch of Flames"],
  mainStats: { sands: ["hp_"], goblet: ["pyro_dmg_"], circlet: ["critRate_", "critDMG_"] },
  pesos: { critRate_: 1, critDMG_: 1, hp_: 0.8, eleMas: 0.5 },
};

function art(parcial: Partial<Artefato>): Artefato {
  return {
    id: Math.random().toString(36),
    set: "Crimson Witch of Flames",
    raridade: 5,
    peca: "flower",
    mainStat: "hp",
    nivel: 20,
    substats: [],
    quartoAtivo: true,
    equipadoEm: null,
    criadoEm: 0,
    ...parcial,
  };
}

test("um roll máximo de Dano Crít. vale 1 roll útil", () => {
  const a = art({ substats: [{ chave: "critDMG_", valor: 7.77 }] });
  assert.ok(Math.abs(notaAtual(a, perfil) - 1) < 1e-9);
});

test("stat sem peso não conta", () => {
  const a = art({ substats: [{ chave: "def", valor: 23.15 }] });
  assert.equal(notaAtual(a, perfil), 0);
});

test("4º substat inativo não conta na nota atual", () => {
  const a = art({
    nivel: 0,
    quartoAtivo: false,
    substats: [
      { chave: "critRate_", valor: 3.89 },
      { chave: "atk", valor: 19.45 },
      { chave: "def", valor: 23.15 },
      { chave: "critDMG_", valor: 7.77 },
    ],
  });
  assert.ok(Math.abs(notaAtual(a, perfil) - 1) < 1e-9);
});

test("upgrades restantes: 5★ +0 tem 5, +16 tem 1, 4★ +0 tem 4", () => {
  assert.equal(upgradesRestantes(art({ nivel: 0 })), 5);
  assert.equal(upgradesRestantes(art({ nivel: 16 })), 1);
  assert.equal(upgradesRestantes(art({ nivel: 0, raridade: 4 })), 4);
});

test("projeção de um 4-liner +0 com todos os stats úteis", () => {
  const a = art({
    nivel: 0,
    substats: [
      { chave: "critRate_", valor: 3.89 },
      { chave: "critDMG_", valor: 7.77 },
      { chave: "hp_", valor: 5.83 },
      { chave: "eleMas", valor: 23.31 },
    ],
  });
  const p = projetar(a, perfil);
  // atual = 1 + 1 + 0,8 + 0,5 = 3,3 ; peso médio = 0,825 ; 5 rolls × 0,85 × 0,825
  assert.ok(Math.abs(p.notaAtual - 3.3) < 1e-9);
  assert.ok(Math.abs(p.notaEsperada - (3.3 + 5 * 0.85 * 0.825)) < 1e-9);
  assert.equal(p.rollsRestantes, 5);
});

test("4º inativo gasta o primeiro upgrade", () => {
  const a = art({
    nivel: 0,
    quartoAtivo: false,
    substats: [
      { chave: "critRate_", valor: 3.89 },
      { chave: "critDMG_", valor: 7.77 },
      { chave: "atk", valor: 19.45 },
      { chave: "def", valor: 23.15 },
    ],
  });
  assert.equal(projetar(a, perfil).rollsRestantes, 4);
});

test("binomial: P(X>=1) com n=1, p=0,5 é 0,5", () => {
  assert.ok(Math.abs(probabilidadePeloMenos(1, 0.5, 1) - 0.5) < 1e-9);
  assert.ok(Math.abs(probabilidadePeloMenos(4, 0.5, 0) - 1) < 1e-9);
});

test("recomendação ignora main stat errada e ordena pela diferença", () => {
  const equipado = art({ id: "eq", peca: "sands", mainStat: "hp_", substats: [{ chave: "critRate_", valor: 3.89 }] });
  const melhor = art({ id: "b", peca: "sands", mainStat: "hp_", substats: [{ chave: "critRate_", valor: 11.67 }] });
  const errado = art({ id: "c", peca: "sands", mainStat: "atk_", substats: [{ chave: "critRate_", valor: 19 }] });
  const r = recomendarTroca(perfil, "sands", [equipado, melhor, errado], equipado);
  assert.equal(r.length, 1);
  assert.equal(r[0].artefato.id, "b");
});

test("veredito: peça +0 ruim é descartada, boa vale upar", () => {
  const ruim = art({
    nivel: 0,
    substats: [
      { chave: "atk", valor: 19.45 },
      { chave: "def", valor: 23.15 },
      { chave: "def_", valor: 7.29 },
      { chave: "enerRech_", valor: 6.48 },
    ],
  });
  assert.equal(vereditoInvestimento(ruim, perfil, 5).veredito, "descartar");
  const boa = art({
    nivel: 0,
    substats: [
      { chave: "critRate_", valor: 3.89 },
      { chave: "critDMG_", valor: 7.77 },
      { chave: "hp_", valor: 5.83 },
      { chave: "atk", valor: 19.45 },
    ],
  });
  assert.equal(vereditoInvestimento(boa, perfil, 5).veredito, "upar");
});

test("validação pega substat igual à main stat e valor impossível", () => {
  const erros = validarArtefato({
    set: "X",
    raridade: 5,
    peca: "circlet",
    mainStat: "critRate_",
    nivel: 20,
    substats: [
      { chave: "critRate_", valor: 3.9 },
      { chave: "critDMG_", valor: 99 },
    ],
    quartoAtivo: true,
    equipadoEm: null,
  });
  assert.ok(erros.some((e) => e.includes("main stat")));
  assert.ok(erros.some((e) => e.includes("acima do possível")));
});

test("detalhe da nota mostra quanto cada substat soma e com quantos rolls", () => {
  const a = art({
    nivel: 20,
    substats: [
      { chave: "critDMG_", valor: 20.2 },
      { chave: "critRate_", valor: 7.4 },
      { chave: "atk", valor: 19 },
      { chave: "hp_", valor: 10.5 },
    ],
  });
  const d = detalharNota(a, perfil);
  assert.deepEqual(d.map((x) => x.rolls), [[3], [2], [1], [2]]);
  assert.ok(Math.abs(d[0].contribuicao - 20.2 / 7.77) < 1e-9);
  assert.equal(d[2].contribuicao, 0); // ATQ fixo sem peso no perfil de teste
  const soma = d.reduce((s, x) => s + x.contribuicao, 0);
  assert.ok(Math.abs(soma - notaAtual(a, perfil)) < 1e-9);
});

test("detalhe: 4º substat bloqueado não soma", () => {
  const a = art({
    nivel: 0,
    quartoAtivo: false,
    substats: [
      { chave: "critRate_", valor: 3.9 },
      { chave: "atk", valor: 19 },
      { chave: "def", valor: 23 },
      { chave: "critDMG_", valor: 7.8 },
    ],
  });
  const d = detalharNota(a, perfil);
  assert.equal(d[3].ativo, false);
  assert.equal(d[3].contribuicao, 0);
});

test("distribuição: soma 1, média bate com a projeção e chance faz sentido", async () => {
  const { distribuicaoNota, chanceDeSuperar, faixasDistribuicao } = await import("./pontuacao");
  const a = art({
    nivel: 0,
    substats: [
      { chave: "critRate_", valor: 3.89 },
      { chave: "critDMG_", valor: 7.77 },
      { chave: "hp_", valor: 5.83 },
      { chave: "eleMas", valor: 23.31 },
    ],
  });
  const d = distribuicaoNota(a, perfil);
  const total = d.reduce((s, p) => s + p.prob, 0);
  assert.ok(Math.abs(total - 1) < 1e-9);
  const media = d.reduce((s, p) => s + p.nota * p.prob, 0);
  assert.ok(Math.abs(media - projetar(a, perfil).notaEsperada) < 1e-6);
  assert.equal(chanceDeSuperar(d, 0), 1);
  assert.equal(chanceDeSuperar(d, 100), 0);
  const faixas = faixasDistribuicao(d);
  assert.ok(Math.abs(faixas.reduce((s, f) => s + f.prob, 0) - 1) < 1e-9);
});

test("distribuição: peça +20 tem um único resultado", async () => {
  const { distribuicaoNota } = await import("./pontuacao");
  const d = distribuicaoNota(art({ nivel: 20, substats: [{ chave: "critRate_", valor: 7.78 }] }), perfil);
  assert.equal(d.length, 1);
  assert.equal(d[0].prob, 1);
});

test("distribuição: substat novo desconhecido também soma 1", async () => {
  const { distribuicaoNota } = await import("./pontuacao");
  const a = art({ nivel: 0, substats: [{ chave: "critRate_", valor: 3.89 }, { chave: "atk", valor: 19.45 }, { chave: "def", valor: 23.15 }] });
  const d = distribuicaoNota(a, perfil);
  assert.ok(Math.abs(d.reduce((s, p) => s + p.prob, 0) - 1) < 1e-9);
});
