import { test } from "node:test";
import assert from "node:assert/strict";
import { nivelCombina, rollsPossiveis, valorPossivel } from "./rolls";

test("valores possíveis de Taxa Crítica 5★", () => {
  assert.deepEqual(rollsPossiveis({ chave: "critRate_", valor: 3.9 }), [1]);
  assert.deepEqual(rollsPossiveis({ chave: "critRate_", valor: 7.4 }), [2]);
  assert.ok(valorPossivel({ chave: "critRate_", valor: 10.5 }));
});

test("valores impossíveis são pegos (erro de leitura)", () => {
  assert.equal(valorPossivel({ chave: "enerRech_", valor: 5 }), false); // era 5,2
  assert.equal(valorPossivel({ chave: "eleMas", valor: 2 }), false);
  assert.equal(valorPossivel({ chave: "atk", valor: 4 }), false);
});

test("nível: +0 com valores de 1 roll combina; lido como +20 não", () => {
  const subs = [
    { chave: "critRate_" as const, valor: 3.1 },
    { chave: "enerRech_" as const, valor: 5.2 },
    { chave: "critDMG_" as const, valor: 7 },
    { chave: "atk" as const, valor: 19 },
  ];
  assert.equal(nivelCombina(subs, 0), true);
  assert.equal(nivelCombina(subs, 20), false);
});

test("nível: +20 típico combina", () => {
  const subs = [
    { chave: "critDMG_" as const, valor: 20.2 },
    { chave: "critRate_" as const, valor: 7.4 },
    { chave: "atk" as const, valor: 19 },
    { chave: "atk_" as const, valor: 10.5 },
  ];
  assert.equal(nivelCombina(subs, 20), true);
});
