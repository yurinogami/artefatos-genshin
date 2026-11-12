import { test } from "node:test";
import assert from "node:assert/strict";
import { avaliarArmas, listaPesquisa, refinamentoConsiderado } from "./armasRecomendacao";
import { ARMAS_DADOS } from "./extras";
import type { BasePersonagem } from "./build";
import type { PerfilBuild } from "./tipos";

test("lista: variante usa a própria lista; sem lista própria, a do personagem", () => {
  assert.equal(listaPesquisa("mavuika:subdps")?.armas[1].en, "Verdict");
  assert.equal(listaPesquisa("hu-tao:qualquer")?.armas[0].en, "Staff of Homa");
});

test("refinamento: R1 para 5★, R5 para 4★, o seu quando marcado", () => {
  const homa = ARMAS_DADOS.find((a) => a.en === "Staff of Homa")!;
  const deathmatch = ARMAS_DADOS.find((a) => a.en === "Deathmatch")!;
  assert.equal(refinamentoConsiderado(homa, []), 1);
  assert.equal(refinamentoConsiderado(deathmatch, []), 5);
  assert.equal(refinamentoConsiderado(homa, [{ en: "Staff of Homa", refinamento: 3 }]), 3);
});

test("cálculo: só armas do tipo, ordenadas, a 1ª com relativo 1", () => {
  const perfil: PerfilBuild = {
    id: "x", nome: "X", elemento: "Pyro", funcao: "DPS", sets: [],
    mainStats: { sands: ["atk_"], goblet: ["pyro_dmg_"], circlet: ["critDMG_"] },
    pesos: { critRate_: 1, critDMG_: 1, atk_: 0.75 },
  };
  const base: BasePersonagem = { hp: 15000, atk: 350, def: 800, ascensao: null, arma: "lanca" };
  const r = avaliarArmas(perfil, base, undefined, [], []);
  assert.ok(r.every((x) => x.dado.tipo === "lanca"));
  assert.equal(r[0].relativo, 1);
  assert.ok(r[0].valor >= r[r.length - 1].valor);
  assert.equal(r[0].dado.raridade, 5);
});
