import { test } from "node:test";
import assert from "node:assert/strict";
import { lerBonus, lerGolpe, talentoMais3 } from "./lerEfeitos";

test("passiva: Homa dá Vida% e ignora o ATQ baseado em Vida", () => {
  const b = lerBonus("HP increased by 20%. Additionally, provides an ATK Bonus based on 0.8% of the wielder's Max HP. When the wielder's HP is less than 50%, this ATK Bonus is increased by an additional 1% of Max HP.");
  assert.deepEqual(b, { hp_: 20 });
});

test("passiva: Taxa Crítica e bônus de dano geral", () => {
  assert.deepEqual(lerBonus("CRIT Rate increased by 8%."), { critRate_: 8 });
  assert.deepEqual(lerBonus("Gain 12% All Elemental DMG Bonus."), { dano_: 12 });
  assert.deepEqual(lerBonus("Increases Elemental Mastery by 40."), { eleMas: 40 });
});

test("passiva: bônus só de um tipo de ataque e de time ficam de fora", () => {
  assert.deepEqual(lerBonus("Elemental Skill DMG increased by 16%."), {});
  assert.deepEqual(lerBonus("All party members gain 20% ATK."), {});
  assert.deepEqual(lerBonus("ATK increased by 28% of Energy Recharge over the base 100%."), {});
});

test("constelação: ATQ, ATQ base e talento +3", () => {
  assert.deepEqual(lerBonus("Additionally, she gains 40% ATK for 8s after gaining Fighting Spirit."), { atk_: 40 });
  assert.equal(lerBonus("When in the Nightsoul's Blessing State, Mavuika's Base ATK is increased by 200, and she obtains").atkBase, 200);
  assert.equal(talentoMais3("Increases the Level of Hour of Burning Skies by 3. Maximum upgrade level is 15."), "Hour of Burning Skies");
});

test("golpe: multiplicadores, repetições e escala por outro stat", () => {
  assert.deepEqual(lerGolpe("3-Hit DMG|{param3:F1P}×3"), [{ param: "param3", escala: "atk", vezes: 3 }]);
  assert.deepEqual(lerGolpe("Tri-Karma Purification DMG|{param3:F1P} ATK+{param4:F1P} Elemental Mastery"), [
    { param: "param3", escala: "atk", vezes: 1 },
    { param: "param4", escala: "em", vezes: 1 },
  ]);
  assert.deepEqual(lerGolpe("Charged Attack: Equitable Judgment|{param5:F2P} Max HP"), [{ param: "param5", escala: "hp", vezes: 1 }]);
  assert.equal(lerGolpe("HP Restored|{param7:F1P} Max HP/Droplet"), null);
  assert.equal(lerGolpe("Charged Attack Stamina Cost|{param6:F1}"), null);
  assert.equal(lerGolpe("Sunfell Slice DMG Bonus|{param3:F1P} ATK per Fighting Spirit"), null);
});
