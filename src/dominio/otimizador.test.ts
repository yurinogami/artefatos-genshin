import { test } from "node:test";
import assert from "node:assert/strict";
import { melhorBuild } from "./otimizador";
import type { Artefato, Peca, PerfilBuild } from "./tipos";

const perfil: PerfilBuild = {
  id: "eu",
  nome: "Eu",
  elemento: "Pyro",
  funcao: "DPS",
  sets: ["Set A", "Set B"],
  mainStats: { sands: ["atk_"], goblet: ["pyro_dmg_"], circlet: ["critRate_"] },
  pesos: { critRate_: 1, critDMG_: 1 },
};

const MAIN: Record<Peca, Artefato["mainStat"]> = {
  flower: "hp",
  plume: "atk",
  sands: "atk_",
  goblet: "pyro_dmg_",
  circlet: "critRate_",
};

let n = 0;
function art(set: string, peca: Peca, rollsCrit: number, extra: Partial<Artefato> = {}): Artefato {
  return {
    id: `a${n++}`,
    set,
    raridade: 5,
    peca,
    mainStat: MAIN[peca],
    nivel: 20,
    substats: [{ chave: "critDMG_", valor: 7.77 * rollsCrit }],
    quartoAtivo: true,
    equipadoEm: null,
    criadoEm: 0,
    ...extra,
  };
}

test("4 do set + a melhor peça livre", () => {
  const inv = [
    art("Set A", "flower", 2),
    art("Set A", "plume", 2),
    art("Set A", "sands", 2),
    art("Set A", "goblet", 2),
    art("Set A", "circlet", 1),
    art("Outro", "circlet", 5), // melhor tiara, fora do set: vira a peça livre
  ];
  const r = melhorBuild(perfil, inv);
  assert.equal(r.set, "Set A");
  assert.ok(Math.abs(r.nota - 13) < 1e-6);
  assert.equal(r.pecas.circlet!.artefato.set, "Outro");
  assert.equal(r.pecas.circlet!.doSet, false);
  assert.equal(r.pecas.flower!.doSet, true);
});

test("a peça livre vai para o slot onde a diferença é maior", () => {
  const inv = [
    art("Set A", "flower", 1),
    art("Set A", "plume", 3),
    art("Set A", "sands", 3),
    art("Set A", "goblet", 3),
    art("Set A", "circlet", 3),
    art("Outro", "flower", 6),
    art("Outro", "plume", 4),
  ];
  const r = melhorBuild(perfil, inv);
  assert.equal(r.pecas.flower!.artefato.set, "Outro");
  assert.ok(Math.abs(r.nota - 18) < 1e-6);
});

test("main stat errada não entra; set sem 4 peças cai para o próximo", () => {
  const inv = [
    art("Set A", "flower", 3),
    art("Set A", "plume", 3),
    art("Set A", "sands", 3, { mainStat: "hp_" }), // ampulheta de Vida%: não serve
    art("Set B", "flower", 1),
    art("Set B", "plume", 1),
    art("Set B", "sands", 1),
    art("Set B", "goblet", 1),
  ];
  const r = melhorBuild(perfil, inv);
  assert.equal(r.set, "Set B");
  const a = r.porSet.find((s) => s.set === "Set A")!;
  assert.equal(a.nota, null);
  assert.deepEqual(a.faltam, ["sands", "goblet", "circlet"]);
});

test("sem 4 peças de nenhum set: monta sem set", () => {
  const r = melhorBuild(perfil, [art("Outro", "flower", 2), art("Set A", "plume", 1)]);
  assert.equal(r.set, null);
  assert.equal(Object.keys(r.pecas).length, 2);
});

test("avisa quando a peça está com outro personagem", () => {
  const inv = [
    art("Set A", "flower", 1, { equipadoEm: "outro" }),
    art("Set A", "plume", 1, { equipadoEm: "eu" }),
    art("Set A", "sands", 1),
    art("Set A", "goblet", 1),
  ];
  const r = melhorBuild(perfil, inv);
  assert.equal(r.pecas.flower!.conflito, "outro");
  assert.equal(r.pecas.plume!.conflito, null);
});
