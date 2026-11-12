import { test } from "node:test";
import assert from "node:assert/strict";
import { avaliarBuild, configCalculo, ganhoDeUmRoll, setsAtivos, somarTotais, valorMainStat, type Arma, type BasePersonagem } from "./build";
import { melhorBuild } from "./otimizador";
import type { Artefato, ChaveMainStat, Peca, PerfilBuild, Substat } from "./tipos";

const perfil: PerfilBuild = {
  id: "teste",
  nome: "Teste",
  elemento: "Pyro",
  funcao: "DPS",
  sets: ["Celestial Gift"], // set sem bônus na tabela: o teste mede só os substats
  mainStats: { sands: ["atk_"], goblet: ["pyro_dmg_"], circlet: ["critDMG_", "critRate_"] },
  pesos: { critRate_: 1, critDMG_: 1, atk_: 0.75 },
};
const base: BasePersonagem = { hp: 12000, atk: 300, def: 700, ascensao: null };
const arma: Arma = { personagem: "teste", nome: "Arma", atk: 600, secundario: null };
const MAIN: Record<Peca, ChaveMainStat> = { flower: "hp", plume: "atk", sands: "atk_", goblet: "pyro_dmg_", circlet: "critDMG_" };

let n = 0;
function art(peca: Peca, substats: Substat[], extra: Partial<Artefato> = {}): Artefato {
  return {
    id: `a${n++}`, set: "Celestial Gift", raridade: 5, peca, mainStat: MAIN[peca], nivel: 20,
    substats, quartoAtivo: true, equipadoEm: null, criadoEm: 0, ...extra,
  };
}

test("main stat: ATQ% 5★ no +20 vale 46,6 e no +0 vale 7", () => {
  assert.equal(valorMainStat({ raridade: 5, mainStat: "atk_", nivel: 20 }), 46.6);
  assert.equal(valorMainStat({ raridade: 5, mainStat: "atk_", nivel: 0 }), 7);
});

test("perfil DPS de crítico usa o modelo de dano; suporte de Recarga não", () => {
  assert.equal(configCalculo(perfil).modelo, "dano");
  assert.equal(configCalculo({ ...perfil, pesos: { hp_: 1, enerRech_: 0.8 } }).modelo, "suporte");
  assert.equal(configCalculo({ ...perfil, pesos: { hp_: 1, enerRech_: 0.8 } }).metaRecarga, 180);
});

test("sinergia: 5 peças só de Dano Crít. perdem para uma build com Taxa, mesmo somando mais rolls", () => {
  const soDano = (p: Peca) => art(p, [{ chave: "critDMG_", valor: 31.1 }]); // 4 rolls
  const soTaxa = (p: Peca) => art(p, [{ chave: "critRate_", valor: 11.7 }]); // 3 rolls
  const pecas: Peca[] = ["flower", "plume", "sands", "goblet", "circlet"];
  const inventario = pecas.flatMap((p) => [soDano(p), soTaxa(p)]);
  const antigo = melhorBuild(perfil, inventario); // soma de rolls: pega só Dano Crít.
  const novo = melhorBuild(perfil, inventario, { base, arma });
  const taxas = Object.values(novo.pecas).filter((e) => e!.artefato.substats[0].chave === "critRate_").length;
  assert.ok(taxas >= 2, `esperava peças de Taxa, veio ${taxas}`);
  assert.ok(antigo.nota > novo.nota, "a build nova soma menos rolls...");
  const valorAntigo = avaliarBuild(Object.values(antigo.pecas).map((e) => e!.artefato), perfil, base, arma).valor;
  assert.ok(novo.avaliacao!.valor > valorAntigo * 1.2, "...mas dá bem mais dano");
});

test("Taxa Crítica acima de 100% não conta", () => {
  const muita = ["flower", "plume", "sands", "goblet", "circlet"].map((p) =>
    art(p as Peca, [{ chave: "critRate_", valor: 31.1 }]),
  );
  const a = avaliarBuild(muita, perfil, base, arma);
  assert.ok(a.taxaDesperdicada > 50);
  assert.ok(a.avisos.some((x) => x.includes("100%")));
});

test("bônus de set: 4 peças de Códice de Obsidiana somam 40% de Taxa", () => {
  const pecas = (["flower", "plume", "sands", "goblet"] as Peca[]).map((p) => art(p, [], { set: "Obsidian Codex" }));
  assert.deepEqual(setsAtivos(pecas), [{ set: "Obsidian Codex", pecas: 4 }]);
  const t = somarTotais(pecas, base, arma);
  assert.equal(t.critRate_, 45);
  assert.equal(t.dano_, 15);
});

test("suporte: Recarga acima da meta não soma na nota da build", () => {
  const sup: PerfilBuild = { ...perfil, mainStats: { ...perfil.mainStats, sands: ["enerRech_"] }, pesos: { hp_: 1, enerRech_: 0.8 } };
  const muitaRecarga = art("sands", [{ chave: "enerRech_", valor: 25.9 }], { mainStat: "enerRech_" }); // 4 rolls
  const a = avaliarBuild([muitaRecarga], sup, base, { ...arma, secundario: { chave: "enerRech_", valor: 61.3 } });
  assert.ok(a.totais.enerRech_ > 180);
  assert.ok(a.valor < a.rolls, "o excesso de Recarga sai da conta");
});

test("ganho de 1 roll: com Taxa alta, Dano Crítico vale mais; com Taxa baixa, o contrário", () => {
  const pecas = (t: number, d: number) => [art("circlet", [{ chave: "critRate_", valor: t }, { chave: "critDMG_", valor: d }])];
  const taxaAlta = avaliarBuild(pecas(80, 20), perfil, base, arma);
  assert.ok(ganhoDeUmRoll(taxaAlta, base, arma, "critDMG_") > ganhoDeUmRoll(taxaAlta, base, arma, "critRate_"));
  const taxaBaixa = avaliarBuild(pecas(0, 150), perfil, base, arma);
  assert.ok(ganhoDeUmRoll(taxaBaixa, base, arma, "critRate_") > ganhoDeUmRoll(taxaBaixa, base, arma, "critDMG_"));
});
