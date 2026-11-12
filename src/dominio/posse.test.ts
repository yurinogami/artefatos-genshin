import { test } from "node:test";
import assert from "node:assert/strict";
import { ordenarPorPosse, possuiPersonagem } from "./posse";
import type { Artefato } from "./tipos";

const equipadaEm = (id: string) => ({ equipadoEm: id }) as Artefato;

test("posse: marcação explícita vence; sem marcação, peça equipada conta como tem", () => {
  assert.equal(possuiPersonagem("mavuika", [], [equipadaEm("mavuika")]), true);
  assert.equal(possuiPersonagem("mavuika", [], []), false);
  assert.equal(possuiPersonagem("mavuika", [{ personagem: "mavuika", possui: false }], [equipadaEm("mavuika")]), false);
  assert.equal(possuiPersonagem("furina", [{ personagem: "furina", possui: true }], []), true);
});

test("posse: os seus primeiro, os outros no fim, sem mudar a ordem dentro de cada grupo", () => {
  const lista = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  const meus = new Set(["c", "a"]);
  assert.deepEqual(ordenarPorPosse(lista, (id) => meus.has(id)).map((p) => p.id), ["a", "c", "b", "d"]);
});
