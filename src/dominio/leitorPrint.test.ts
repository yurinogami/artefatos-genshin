import { test } from "node:test";
import assert from "node:assert/strict";
import { lerNumero, lerTextoDoPrint } from "./leitorPrint";

test("números: vírgula decimal, milhar e confusões do OCR", () => {
  assert.equal(lerNumero("3,9"), 3.9);
  assert.equal(lerNumero("7.0"), 7);
  assert.equal(lerNumero("4.780"), 4780);
  assert.equal(lerNumero("7,O"), 7);
  assert.equal(lerNumero("l9"), 19);
});

test("flor +20 em português", () => {
  const r = lerTextoDoPrint(`Flor de Labareda da Bruxa
Flor da Vida
PV
4.780
+20
• Taxa Crítica+10,5%
• Dano Crítico+14,8%
• PV+5,3%
• DEF+19
A Bruxa das Chamas Carmesim:
2 Peças: Bônus de Dano Pyro +15%.
4 Peças: Aumenta o Dano de Sobrecarga e Queima em 40%.`);
  assert.equal(r.set, "Crimson Witch of Flames");
  assert.equal(r.peca, "flower");
  assert.equal(r.mainStat, "hp");
  assert.equal(r.nivel, 20);
  assert.equal(r.raridade, 5);
  assert.deepEqual(r.substats, [
    { chave: "critRate_", valor: 10.5 },
    { chave: "critDMG_", valor: 14.8 },
    { chave: "hp_", valor: 5.3 },
    { chave: "def", valor: 19 },
  ]);
  assert.equal(r.quartoAtivo, true);
  assert.deepEqual(r.avisos, []);
});

test("ampulheta +0 em inglês com 4º substat não ativado", () => {
  const r = lerTextoDoPrint(`Witch's End Time
Sands of Eon
HP
7.0%
+0
· CRIT Rate+3.5%
· CRIT DMG+7.0%
· ATK+16 (unactivated)
· Elemental Mastery+19
Crimson Witch of Flames:
2-Piece Set: Pyro DMG Bonus +15%`);
  assert.equal(r.peca, "sands");
  assert.equal(r.mainStat, "hp_");
  assert.equal(r.nivel, 0);
  assert.equal(r.quartoAtivo, false);
  assert.deepEqual(r.substats.map((s) => s.chave), ["critRate_", "critDMG_", "eleMas", "atk"]);
});

test("cálice em português com bônus elemental e texto com ruído", () => {
  const r = lerTextoDoPrint(`algo estranho
Cálice de Eonothem
Bônus de Dano Pyro
46,6%
+ 20
e Taxa Critica+3,9%
« Dano Critico+2l,O%
* ATQ+5,8%
- Recarga de Energia+11,O%
A Bruxa das Chamas Carmesim
2 Peças: Bônus de Dano Pyro +15%.`);
  assert.equal(r.peca, "goblet");
  assert.equal(r.mainStat, "pyro_dmg_");
  assert.equal(r.nivel, 20);
  assert.deepEqual(r.substats, [
    { chave: "critRate_", valor: 3.9 },
    { chave: "critDMG_", valor: 21 },
    { chave: "atk_", valor: 5.8 },
    { chave: "enerRech_", valor: 11 },
  ]);
});

test("texto sem nada útil gera avisos e nenhum substat", () => {
  const r = lerTextoDoPrint("Paimon\nMenu\n");
  assert.equal(r.substats.length, 0);
  assert.ok(r.avisos.length >= 4);
});

test("sets novos cadastrados à mão (ex.: Prova Escarlate)", () => {
  const r = lerTextoDoPrint(`Algo
Tiara de Logos
Taxa Crítica
31,1%
+20
• ATQ+10,5%
• Dano Crítico+13,2%
• Proficiência Elemental+42
• Recarga de Energia+5,2%
Prova Scarlate:
2 Peças: ATQ +18%.`);
  assert.equal(r.set, "Scarlet Proof");
  assert.equal(r.peca, "circlet");
  assert.equal(r.mainStat, "critRate_");
});

// Textos reais do OCR (tesseract) sobre prints do jogo em PT-BR, com os erros de leitura que aparecem.
import { readFileSync } from "node:fs";
import { acharPersonagem } from "./leitorPrint";
const amostra = (id: string) => readFileSync(new URL(`./amostras-ocr/${id}.txt`, import.meta.url), "utf8");

test("print real: Dádiva Celestial +0 com ATQ% a ser ativado", () => {
  const r = lerTextoDoPrint(amostra("213433"));
  assert.equal(r.set, "Celestial Gift");
  assert.equal(r.peca, "flower");
  assert.equal(r.nivel, 0);
  assert.deepEqual(r.substats, [
    { chave: "critDMG_", valor: 7.8 },
    { chave: "enerRech_", valor: 6.5 },
    { chave: "def_", valor: 7.3 },
    { chave: "atk_", valor: 4.7 },
  ]);
  assert.equal(r.quartoAtivo, false);
  assert.equal(r.equipadoPor, "Mona");
});

test("print real: Fúria do Trovão +20 com ruído antes de Taxa Crítica", () => {
  const r = lerTextoDoPrint(amostra("213108"));
  assert.equal(r.set, "Thundering Fury");
  assert.equal(r.nivel, 20);
  assert.deepEqual(r.substats.map((s) => [s.chave, s.valor]), [
    ["def_", 6.6],
    ["atk_", 16.3],
    ["critRate_", 7.4],
    ["critDMG_", 15.5],
  ]);
  assert.equal(r.equipadoPor, "Fischl");
});

test("print real: 'Damo-Critico' e '(A ser / ativado)' quebrado em duas linhas", () => {
  const r = lerTextoDoPrint(amostra("213343"));
  assert.equal(r.set, "Obsidian Codex");
  assert.deepEqual(r.substats.map((s) => s.chave), ["critRate_", "atk", "def_", "critDMG_"]);
  assert.equal(r.quartoAtivo, false);
});

test("acha o personagem mesmo com erro de leitura", () => {
  const perfis = [
    { id: "xingqiu", nome: "Xingqiu" },
    { id: "kazuha", nome: "Kaedehara Kazuha" },
  ];
  assert.equal(acharPersonagem("Xinggiu", perfis)?.id, "xingqiu");
  assert.equal(acharPersonagem("Kazuha", perfis)?.id, "kazuha");
  assert.equal(acharPersonagem("Nicole", perfis), undefined);
});

test("cálice/ampulheta: 'Recargade Energia' sem espaço e 'ATQ+I8' com I no lugar de 1", () => {
  const r = lerTextoDoPrint(amostra("relogio-11"));
  assert.equal(r.mainStat, "enerRech_");
  assert.deepEqual(r.substats.at(-1), { chave: "atk", valor: 18 });
  assert.deepEqual(r.avisos, []);
});

test("'+18%' do texto do set não vira nível; sem nível lido, '(A ser ativado)' quer dizer +0", () => {
  const r = lerTextoDoPrint(amostra("relogio-48"));
  assert.equal(r.nivel, 0);
  assert.equal(r.substats.length, 4);
  assert.equal(r.chaveInativa, "atk_");
  assert.deepEqual(r.avisos, []);
});
