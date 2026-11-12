import { test } from "node:test";
import assert from "node:assert/strict";
import { BUILDS, PERFIS } from "../perfis/index";
import { MAIN_STATS_POR_PECA, ROLL_MAXIMO } from "./stats";
import { SETS_5_ESTRELAS } from "./sets";

test("ids dos perfis são únicos", () => {
  const ids = PERFIS.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("perfis (e variantes) só usam main stats que existem em cada peça", () => {
  for (const p of BUILDS) {
    for (const peca of ["sands", "goblet", "circlet"] as const) {
      assert.ok(p.mainStats[peca].length > 0, `${p.nome}: ${peca} vazio`);
      for (const m of p.mainStats[peca]) {
        assert.ok(MAIN_STATS_POR_PECA[peca].includes(m), `${p.nome}: ${m} não existe em ${peca}`);
      }
    }
  }
});

test("pesos entre 0 e 1 e em substats válidos", () => {
  for (const p of BUILDS) {
    for (const [chave, peso] of Object.entries(p.pesos)) {
      assert.ok(chave in ROLL_MAXIMO[5], `${p.nome}: substat ${chave} inválido`);
      assert.ok(peso! >= 0 && peso! <= 1, `${p.nome}: peso ${chave}=${peso}`);
    }
  }
});

test("sets dos perfis estão na lista de sets", () => {
  for (const p of BUILDS) {
    for (const s of p.sets) assert.ok(SETS_5_ESTRELAS.includes(s), `${p.nome}: set "${s}" fora da lista`);
  }
});

test("variantes herdam do perfil e mantêm o id do personagem", () => {
  const sub = BUILDS.find((b) => b.chave === "mavuika:subdps")!;
  assert.equal(sub.id, "mavuika");
  assert.equal(sub.rotulo, "Sub-DPS");
  assert.deepEqual(sub.sets, ["Scroll of the Hero of Cinder City", "Obsidian Codex"]);
  assert.equal(sub.pesos.critRate_, 1); // herdado da build DPS
  assert.equal(BUILDS.filter((b) => b.id === "mavuika").length, 3);
  assert.equal(PERFIS.filter((p) => p.id === "mavuika").length, 1);
});
