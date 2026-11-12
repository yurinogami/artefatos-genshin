import { test } from "node:test";
import assert from "node:assert/strict";
import { projetarArtefato } from "./projecao";
import { notaAtual, projetar } from "./pontuacao";
import type { Artefato, PerfilBuild } from "./tipos";

const perfil: PerfilBuild = {
  id: "x", nome: "X", elemento: "Pyro", funcao: "DPS", sets: [],
  mainStats: { sands: ["atk_"], goblet: ["pyro_dmg_"], circlet: ["critDMG_"] },
  pesos: { critRate_: 1, critDMG_: 1, atk_: 0.75 },
};
const base: Artefato = {
  id: "a", set: "Obsidian Codex", raridade: 5, peca: "goblet", mainStat: "pyro_dmg_", nivel: 4, quartoAtivo: true, equipadoEm: null, criadoEm: 0,
  substats: [{ chave: "critRate_", valor: 3.9 }, { chave: "critDMG_", valor: 7.8 }, { chave: "atk_", valor: 5.8 }, { chave: "def", valor: 23 }],
};

test("projeção: vira +20 e a nota bate com a média esperada do 'Vale upar?'", () => {
  const p = projetarArtefato(base);
  assert.equal(p.nivel, 20);
  assert.equal(p.id, "a");
  assert.ok(Math.abs(notaAtual(p, perfil) - projetar(base, perfil).notaEsperada) < 1e-6);
});

test("projeção: peça no nível máximo fica igual; 4º bloqueado é ativado", () => {
  const max = { ...base, nivel: 20 };
  assert.equal(projetarArtefato(max), max);
  const zero = projetarArtefato({ ...base, nivel: 0, quartoAtivo: false });
  assert.equal(zero.quartoAtivo, true);
});
