import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIdeal, pecaIdeal } from "./ideal";
import type { PerfilBuild } from "./tipos";

const dps: PerfilBuild = {
  id: "dps",
  nome: "DPS",
  elemento: "Pyro",
  funcao: "DPS",
  sets: ["Set A", "Set B"],
  mainStats: { sands: ["atk_"], goblet: ["pyro_dmg_"], circlet: ["critRate_", "critDMG_"] },
  pesos: { critRate_: 1, critDMG_: 1, atk_: 0.75, eleMas: 0.5, atk: 0.3 },
};

test("tiara de Taxa Crít. não repete Taxa Crít. nos substats", () => {
  const t = pecaIdeal(dps, "circlet");
  assert.equal(t.mainStat, "critRate_");
  assert.deepEqual(t.substats, ["critDMG_", "atk_", "eleMas", "atk"]);
});

test("notas máxima e alvo da flor", () => {
  const f = pecaIdeal(dps, "flower");
  assert.deepEqual(f.substats, ["critRate_", "critDMG_", "atk_", "eleMas"]);
  // 4 iniciais (1 + 1 + 0,75 + 0,5) + 5 upgrades no melhor (peso 1)
  assert.ok(Math.abs(f.notaMaxima - 8.25) < 1e-9);
  // 85% × (3,25 + 5 × média 0,8125)
  assert.ok(Math.abs(f.notaAlvo - 0.85 * (3.25 + 5 * 0.8125)) < 1e-9);
});

test("ampulheta de ATQ% tira ATQ% dos substats; build usa o 1º set", () => {
  const b = buildIdeal(dps);
  assert.equal(b.set, "Set A");
  assert.deepEqual(b.pecas.find((p) => p.peca === "sands")!.substats, ["critRate_", "critDMG_", "eleMas", "atk"]);
  assert.equal(b.pecas.length, 5);
});

test("perfil com só 2 stats úteis (Proficiência e Recarga)", () => {
  const suporte: PerfilBuild = { ...dps, mainStats: { sands: ["eleMas"], goblet: ["eleMas"], circlet: ["eleMas"] }, pesos: { eleMas: 1, enerRech_: 0.8 } };
  const s = pecaIdeal(suporte, "sands");
  assert.deepEqual(s.substats, ["enerRech_"]);
  assert.ok(Math.abs(s.notaMaxima - (0.8 + 5 * 0.8)) < 1e-9);
});
