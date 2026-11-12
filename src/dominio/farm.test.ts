import { test } from "node:test";
import assert from "node:assert/strict";
import { DOMINIOS, ganhosDoPersonagem, rankingFarm } from "./farm";
import type { Artefato, ChaveMainStat, Peca, PerfilBuild } from "./tipos";

const perfil: PerfilBuild = {
  id: "teste",
  nome: "Teste",
  elemento: "Pyro",
  funcao: "DPS",
  sets: ["Obsidian Codex", "Marechaussee Hunter"],
  mainStats: { sands: ["atk_"], goblet: ["pyro_dmg_"], circlet: ["critDMG_"] },
  pesos: { critRate_: 1, critDMG_: 1, atk_: 0.75 },
};
const MAIN: Record<Peca, ChaveMainStat> = { flower: "hp", plume: "atk", sands: "atk_", goblet: "pyro_dmg_", circlet: "critDMG_" };
let n = 0;
const boa = (peca: Peca, set: string): Artefato => ({
  id: `a${n++}`, set, raridade: 5, peca, mainStat: MAIN[peca], nivel: 20, quartoAtivo: true, equipadoEm: null, criadoEm: 0,
  substats: [{ chave: "critRate_", valor: 14 }, { chave: "critDMG_", valor: 28 }, { chave: "atk_", valor: 5 }],
});

test("domínios: Códice de Obsidiana e Pergaminho do Herói caem no mesmo domínio", () => {
  const d = DOMINIOS.find((x) => x.sets.includes("Obsidian Codex"));
  assert.ok(d?.sets.includes("Scroll of the Hero of Cinder City"));
});

test("farm: sem nenhuma peça, o set principal pesa mais que o secundário", () => {
  const [codex, mare] = ganhosDoPersonagem(perfil, []);
  assert.ok(codex.contribuicao > mare.contribuicao);
  assert.equal(codex.procurar.length, 4); // 5 slots menos a peça livre
});

test("farm: com o set principal completo e bom, o secundário quase não conta", () => {
  const inv = (["flower", "plume", "sands", "goblet", "circlet"] as Peca[]).map((p) => boa(p, "Obsidian Codex"));
  const [codex, mare] = ganhosDoPersonagem(perfil, inv);
  assert.ok(codex.faltaNoSet < 1);
  assert.ok(mare.contribuicao < 1, `secundário ainda pesa ${mare.contribuicao}`);
});

test("farm: o domínio do set principal fica em 1º", () => {
  const r = rankingFarm([perfil], []);
  assert.ok(r[0].dominio?.sets.includes("Obsidian Codex"));
});
