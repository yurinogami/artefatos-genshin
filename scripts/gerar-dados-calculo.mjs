// Gera os dados usados no cálculo da build inteira (genshin-db):
//  - src/perfis/base-personagens.json: stats base no nível 90 e bônus de ascensão de cada perfil
//  - src/dominio/armas-dados.json: armas 3★ a 5★ com ATQ base e stat secundário no nível 90
//  - src/perfis/talentos.json: multiplicadores de cada golpe (nível 1 a 15)
//  - src/dominio/textos-sets.json: efeitos de 2 e 4 peças em português
// Passivas de arma e constelações também saem daqui, com a parte que vira stat já lida (lerEfeitos.ts).
// Rode de novo quando atualizar o genshin-db: npm run gerar-dados
import gdb from "genshin-db";
import { readFileSync, writeFileSync } from "node:fs";
import { lerBonus, lerGolpe, talentoMais3 } from "../src/dominio/lerEfeitos.ts";

const PT = { resultLanguage: "Portuguese" };
const limpar = (t) => (t ?? "").replace(/\*\*/g, "").replace(/<[^>]+>/g, "").trim();

const PROP = {
  FIGHT_PROP_CRITICAL: "critRate_",
  FIGHT_PROP_CRITICAL_HURT: "critDMG_",
  FIGHT_PROP_ATTACK_PERCENT: "atk_",
  FIGHT_PROP_HP_PERCENT: "hp_",
  FIGHT_PROP_DEFENSE_PERCENT: "def_",
  FIGHT_PROP_ELEMENT_MASTERY: "eleMas",
  FIGHT_PROP_CHARGE_EFFICIENCY: "enerRech_",
  FIGHT_PROP_PHYSICAL_ADD_HURT: "physical_dmg_",
  FIGHT_PROP_FIRE_ADD_HURT: "pyro_dmg_",
  FIGHT_PROP_WATER_ADD_HURT: "hydro_dmg_",
  FIGHT_PROP_ELEC_ADD_HURT: "electro_dmg_",
  FIGHT_PROP_ICE_ADD_HURT: "cryo_dmg_",
  FIGHT_PROP_WIND_ADD_HURT: "anemo_dmg_",
  FIGHT_PROP_ROCK_ADD_HURT: "geo_dmg_",
  FIGHT_PROP_GRASS_ADD_HURT: "dendro_dmg_",
  FIGHT_PROP_HEAL_ADD: "heal_",
};
const TIPO = { WEAPON_SWORD_ONE_HAND: "espada", WEAPON_CLAYMORE: "espadao", WEAPON_POLE: "lanca", WEAPON_CATALYST: "catalisador", WEAPON_BOW: "arco" };
const pct = (chave, v) => (chave === "eleMas" ? Math.round(v * 10) / 10 : Math.round(v * 1000) / 10);

const perfis = JSON.parse(readFileSync(new URL("../src/perfis/perfis.json", import.meta.url)));
const NOMES_EN = { andarilho: "Wanderer", viajante: "Lumine" };
const base = {};
const talentos = {};
for (const p of perfis) {
  const c = gdb.characters(NOMES_EN[p.id] ?? p.nome) ?? gdb.characters(p.id.replace(/-/g, " "));
  if (!c) {
    console.warn("sem dados de personagem:", p.nome);
    continue;
  }
  const s = c.stats(90, "+");
  const chave = PROP[c.substatType];
  // Para Taxa/Dano Crít., o valor "specialized" já inclui a base de todo personagem (5% / 50%).
  const extra = chave === "critRate_" ? 0.05 : chave === "critDMG_" ? 0.5 : 0;
  // Viajante: talentos e constelações mudam com o elemento (um por variante, chave "viajante:geo").
  const nomeT = (el) => (p.id === "viajante" ? `Traveler (${el})` : c.name);
  const t = gdb.talents(nomeT(p.elemento));
  const tPt = gdb.talents(nomeT(p.elemento), PT);
  const QUAL = { combat1: "normal", combat2: "skill", combat3: "burst" };
  const nomesTalento = Object.fromEntries(Object.entries(QUAL).map(([k, q]) => [t?.[k]?.name, q]));
  const con = gdb.constellations(nomeT(p.elemento));
  const conPt = gdb.constellations(nomeT(p.elemento), PT);
  const constelacoes = ["c1", "c2", "c3", "c4", "c5", "c6"].map((k) => {
    const mais3 = con ? talentoMais3(con[k].description) : null;
    return {
      nome: conPt?.[k]?.name ?? con?.[k]?.name ?? k.toUpperCase(),
      texto: limpar(conPt?.[k]?.description ?? con?.[k]?.description),
      bonus: con && !mais3 ? lerBonus(con[k].description) : {},
      talento: mais3 ? (nomesTalento[mais3] ?? null) : null,
    };
  });
  base[p.id] = {
    hp: Math.round(s.hp),
    atk: Math.round(s.attack),
    def: Math.round(s.defense),
    ascensao: chave ? { chave, valor: pct(chave, s.specialized - extra) } : null,
    arma: TIPO[c.weaponType],
    constelacoes,
  };
  const chavesT = [[p.id, t, tPt], ...(p.id === "viajante" ? (p.variantes ?? []).map((v) => [`${p.id}:${v.id}`, gdb.talents(nomeT(v.elemento)), gdb.talents(nomeT(v.elemento), PT)]) : [])];
  for (const [chaveT, t, tPt] of chavesT) {
  talentos[chaveT] = {};
  for (const [k, q] of Object.entries(QUAL)) {
    const at = t?.[k]?.attributes;
    if (!at) continue;
    const golpes = [];
    at.labels.forEach((rotulo, i) => {
      const partes = lerGolpe(rotulo);
      if (!partes) return;
      golpes.push({
        rotulo: (tPt?.[k]?.attributes?.labels?.[i] ?? rotulo).split("|")[0],
        partes: partes.map((x) => ({ escala: x.escala, vezes: x.vezes, valores: at.parameters[x.param].map((v) => Math.round(v * 1e5) / 1e5) })),
      });
    });
    talentos[chaveT][q] = { nome: tPt?.[k]?.name ?? t[k].name, golpes };
  }
  }
}
writeFileSync(new URL("../src/perfis/talentos.json", import.meta.url), JSON.stringify(talentos) + "\n");
writeFileSync(new URL("../src/perfis/base-personagens.json", import.meta.url), JSON.stringify(base, null, 1) + "\n");
console.log(Object.keys(base).length, "de", perfis.length, "personagens com stats base");

const armas = [];
for (const nome of gdb.weapons("names", { matchCategories: true })) {
  const w = gdb.weapons(nome);
  if (!w || w.rarity < 3) continue;
  const wpt = gdb.weapons(nome, PT);
  const pt = wpt?.name ?? w.name;
  const refs = ["r1", "r2", "r3", "r4", "r5"].filter((r) => w[r]);
  const s = w.stats(90, "+");
  const chave = PROP[w.mainStatType];
  armas.push({
    en: w.name,
    pt,
    tipo: TIPO[w.weaponType],
    raridade: w.rarity,
    atk: Math.round(s.attack),
    secundario: chave ? { chave, valor: pct(chave, s.specialized) } : null,
    icone: w.images?.filename_icon,
    passiva: refs.length
      ? {
          nome: wpt?.effectName ?? w.effectName,
          textos: refs.map((r) => limpar(wpt?.[r]?.description ?? w[r].description)),
          bonus: refs.map((r) => lerBonus(w[r].description)),
        }
      : null,
  });
}
armas.sort((a, b) => b.raridade - a.raridade || a.pt.localeCompare(b.pt, "pt-BR"));
writeFileSync(new URL("../src/dominio/armas-dados.json", import.meta.url), JSON.stringify(armas) + "\n");
console.log(armas.length, "armas");

const textos = {};
for (const nome of gdb.artifacts("names", { matchCategories: true })) {
  const a = gdb.artifacts(nome);
  const p = gdb.artifacts(nome, PT);
  if (!a) continue;
  textos[a.name] = { 2: limpar(p?.effect2Pc ?? a.effect2Pc) || undefined, 4: limpar(p?.effect4Pc ?? a.effect4Pc) || undefined };
}
writeFileSync(new URL("../src/dominio/textos-sets.json", import.meta.url), JSON.stringify(textos) + "\n");
console.log(Object.keys(textos).length, "sets com texto");

// Domínios de artefato: cada entrada (ex.: "Corte Tingida de Bordo") dá 2 sets 5★ no nível mais alto.
const porEntrada = new Map();
for (const nome of gdb.domains("names", { matchCategories: true })) {
  const d = gdb.domains(nome);
  if (!d || d.domainType !== "UI_ABYSSUS_RELIC" || !d.entranceName) continue;
  const atual = porEntrada.get(d.entranceName);
  if (!atual || d.recommendedLevel > atual.recommendedLevel) porEntrada.set(d.entranceName, d);
}
const dominios = [];
for (const [entrada, d] of porEntrada) {
  const sets = (d.rewardPreview ?? [])
    .map((r) => gdb.artifacts(r.name))
    .filter((a) => a && a.rarityList?.includes(5))
    .map((a) => a.name);
  if (sets.length === 0) continue;
  const pt = gdb.domains(d.name, PT);
  dominios.push({ en: entrada, pt: pt?.entranceName ?? entrada, regiao: pt?.regionName ?? d.regionName, sets: [...new Set(sets)] });
}
// O genshin-db lista um set em quase todos os domínios (prévia de evento); ele só fica onde completa os 2 sets.
const conta = new Map();
for (const d of dominios) for (const s of d.sets) conta.set(s, (conta.get(s) ?? 0) + 1);
for (const d of dominios) {
  const filtrado = d.sets.filter((s) => conta.get(s) <= dominios.length / 2);
  d.sets = filtrado.length >= 2 ? filtrado : d.sets.slice(0, 2).length === 2 ? [...filtrado, ...d.sets.filter((s) => !filtrado.includes(s))].slice(0, 2) : d.sets;
}
dominios.sort((a, b) => a.pt.localeCompare(b.pt, "pt-BR"));
writeFileSync(new URL("../src/dominio/dominios.json", import.meta.url), JSON.stringify(dominios, null, 1) + "\n");
console.log(dominios.length, "domínios de artefato");
