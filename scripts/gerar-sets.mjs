// Gera src/dominio/sets-dados.json a partir do genshin-db (nomes de sets e peças em inglês e português).
// Rode de novo quando sair versão nova do jogo: npm update genshin-db && npm run gerar-sets
import gdb from "genshin-db";
import { writeFileSync } from "node:fs";

const PECAS = ["flower", "plume", "sands", "goblet", "circlet"];
const nomes = gdb.artifacts("names", { matchCategories: true, resultLanguage: "English" });
const sets = [];
for (const nome of nomes) {
  const en = gdb.artifacts(nome, { resultLanguage: "English" });
  const pt = gdb.artifacts(nome, { resultLanguage: "Portuguese" });
  if (!en || !pt || !en.rarityList?.includes(5)) continue;
  const pecas = {};
  for (const p of PECAS)
    if (en[p]) pecas[p] = { en: en[p].name, pt: pt[p]?.name ?? en[p].name, icone: en.images?.[`filename_${p}`] };
  sets.push({ en: en.name, pt: pt.name, pecas });
}
sets.sort((a, b) => a.en.localeCompare(b.en));
writeFileSync(new URL("../src/dominio/sets-dados.json", import.meta.url), JSON.stringify(sets, null, 1) + "\n");
console.log(`${sets.length} sets 5★ gravados`);
