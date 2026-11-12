// Gera src/perfis/icones.json: id do perfil → nome do arquivo do ícone do personagem (genshin-db).
// Rode de novo ao adicionar personagens: npm run gerar-icones
import gdb from "genshin-db";
import { readFileSync, writeFileSync } from "node:fs";

const perfis = JSON.parse(readFileSync(new URL("../src/perfis/perfis.json", import.meta.url)));
const NOMES_EN = { andarilho: "Wanderer", viajante: "Lumine" }; // perfis com nome traduzido
const icones = {};
for (const p of perfis) {
  const c = gdb.characters(NOMES_EN[p.id] ?? p.nome) ?? gdb.characters(p.id.replace(/-/g, " "));
  if (!c) {
    console.warn("sem ícone:", p.nome);
    continue;
  }
  if (!c.images) console.warn("sem imagem no genshin-db:", p.nome);
  icones[p.id] = { icone: c.images?.filename_icon, lateral: c.images?.filename_sideIcon, raridade: c.rarity };
}
writeFileSync(new URL("../src/perfis/icones.json", import.meta.url), JSON.stringify(icones, null, 1) + "\n");
console.log(Object.keys(icones).length, "de", perfis.length, "personagens com ícone");
