import { test } from "node:test";
import assert from "node:assert/strict";
import { BUILD_POR_CHAVE, comSetEscolhido } from "../perfis";
import { rankingFarm } from "./farm";

test("set escolhido: a build passa a ter só esse set; sem escolha fica igual", () => {
  const nicole = BUILD_POR_CHAVE["nicole"];
  assert.ok(nicole.sets.length > 1);
  assert.deepEqual(comSetEscolhido(nicole, [{ personagem: "nicole", setEscolhido: { nicole: "Celestial Gift" } }]).sets, ["Celestial Gift"]);
  assert.equal(comSetEscolhido(nicole, []), nicole);
  // escolha de outra variante não afeta a principal
  const mav = BUILD_POR_CHAVE["mavuika"];
  assert.equal(comSetEscolhido(mav, [{ personagem: "mavuika", setEscolhido: { "mavuika:subdps": "Obsidian Codex" } }]), mav);
});

test("set escolhido: o Farmar para de recomendar os outros sets do perfil para ela", () => {
  const nicole = BUILD_POR_CHAVE["nicole"];
  const antes = rankingFarm([nicole], []).flatMap((d) => d.sets.map((s) => s.set));
  assert.ok(antes.includes("A Day Carved From Rising Winds"));
  const escolhida = comSetEscolhido(nicole, [{ personagem: "nicole", setEscolhido: { nicole: "Celestial Gift" } }]);
  const depois = rankingFarm([escolhida], []).flatMap((d) => d.sets.filter((s) => s.pontos > 0).map((s) => s.set));
  assert.deepEqual(depois, ["Celestial Gift"]);
});
