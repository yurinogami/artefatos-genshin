import { test } from "node:test";
import assert from "node:assert/strict";
import { chaveArtefato, pecasParaDesequipar, rascunhoDaLeitura } from "./lote";
import type { LeituraPrint } from "./leitorPrint";
import type { Artefato } from "./tipos";

const perfis = [{ id: "mavuika", nome: "Mavuika" }, { id: "citlali", nome: "Citlali" }];

const leituraBoa: LeituraPrint = {
  set: "Obsidian Codex",
  peca: "plume",
  mainStat: "atk",
  nivel: 20,
  raridade: 5,
  substats: [
    { chave: "critDMG_", valor: 21.8 },
    { chave: "hp", valor: 209 },
    { chave: "critRate_", valor: 9.7 },
    { chave: "enerRech_", valor: 4.5 },
  ],
  quartoAtivo: true,
  equipadoPor: "Mavuka",
  avisos: [],
};

test("lote: leitura completa vira artefato sem problemas e acha o personagem", () => {
  const r = rascunhoDaLeitura(leituraBoa, perfis, "x", 1);
  assert.deepEqual(r.problemas, []);
  assert.equal(r.artefato.equipadoEm, "mavuika");
  assert.equal(r.artefato.raridade, 5);
});

test("lote: o que não foi lido vira problema", () => {
  const r = rascunhoDaLeitura({ ...leituraBoa, set: undefined, equipadoPor: "Fulano", avisos: ["Não reconheci o set."] }, perfis, "x", 1);
  assert.ok(r.problemas.includes("Não reconheci o set."));
  assert.equal(r.donoSemPerfil, "Fulano");
  assert.ok(!r.problemas.some((p) => p.includes("Fulano"))); // personagem sem perfil só informa
  assert.equal(r.artefato.equipadoEm, null);
});

test("lote: mesma peça tem a mesma chave, mesmo com substats em outra ordem", () => {
  const a = rascunhoDaLeitura(leituraBoa, perfis, "a", 1).artefato;
  const b = { ...a, id: "b", substats: [...a.substats].reverse() };
  assert.equal(chaveArtefato(a), chaveArtefato(b));
  assert.notEqual(chaveArtefato(a), chaveArtefato({ ...a, nivel: 16 }));
});

test("lote: peça equipada tira a antiga do mesmo slot", () => {
  const nova = rascunhoDaLeitura(leituraBoa, perfis, "nova", 1).artefato;
  const antiga = { ...nova, id: "antiga" } as Artefato;
  const outraPeca = { ...nova, id: "flor", peca: "flower" } as Artefato;
  assert.deepEqual(pecasParaDesequipar(nova, [antiga, outraPeca]).map((a) => a.id), ["antiga"]);
});
