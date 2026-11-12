import { test } from "node:test";
import assert from "node:assert/strict";
import { compartilhadas, estaEquipada, nomeSugerido, pecasDaBuild, resumoSets, type BuildSalva } from "./buildsSalvas";
import type { Artefato, Peca } from "./tipos";

const nome = (s: string) => ({ "A Day Carved From Rising Winds": "Ascensão Zéfira", "Celestial Gift": "Dádiva Celestial" })[s] ?? s;
const art = (id: string, peca: Peca, set: string, dono: string | null = "durin") =>
  ({ id, peca, set, equipadoEm: dono }) as Artefato;
const inv = [
  art("f", "flower", "A Day Carved From Rising Winds"),
  art("p", "plume", "A Day Carved From Rising Winds"),
  art("s", "sands", "A Day Carved From Rising Winds"),
  art("g", "goblet", "A Day Carved From Rising Winds"),
  art("c", "circlet", "Celestial Gift"),
];
const zefiro: BuildSalva = { id: "b1", personagem: "durin", chaveBuild: "durin", nome: "Z", pecas: { flower: "f", plume: "p", sands: "s", goblet: "g", circlet: "c" }, criadaEm: 0 };

test("builds salvas: nome sugerido e resumo pelo set com mais peças", () => {
  assert.equal(nomeSugerido(inv, nome, 0), "Ascensão Zéfira");
  assert.equal(resumoSets(inv, nome), "4 Ascensão Zéfira + 1 livre");
  assert.equal(nomeSugerido([inv[0]], nome, 2), "Build 3");
});

test("builds salvas: equipada só se todas as peças estão no personagem; peça apagada é apontada", () => {
  assert.equal(estaEquipada(zefiro, inv), true);
  assert.equal(estaEquipada(zefiro, inv.map((a) => (a.id === "c" ? { ...a, equipadoEm: "nicole" } : a))), false);
  assert.deepEqual(pecasDaBuild(zefiro, inv.slice(0, 4)).apagadas, ["circlet"]);
});

test("builds salvas: aponta peças repetidas em outras builds", () => {
  const dadiva: BuildSalva = { ...zefiro, id: "b2", pecas: { circlet: "c", flower: "x" } };
  assert.deepEqual(compartilhadas(zefiro, [zefiro, dadiva]).map((x) => [x.build.id, x.pecas]), [["b2", ["circlet"]]]);
});
