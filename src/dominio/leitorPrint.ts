// Lê o texto extraído (OCR) de um print da tela de detalhe de artefato do Genshin
// e tenta montar os campos do formulário. Funciona com o jogo em português ou inglês.
// Nada aqui é definitivo: o resultado só pré-preenche o formulário para você conferir.
import { SETS } from "./sets";
import { NOME_STAT } from "./stats";
import { nivelCombina, valorPossivel } from "./rolls";
import type { ChaveMainStat, ChaveSubstat, Peca, Raridade, Substat } from "./tipos";

export interface LeituraPrint {
  set?: string; // nome em inglês
  peca?: Peca;
  mainStat?: ChaveMainStat;
  nivel?: number;
  raridade?: Raridade;
  substats: Substat[];
  quartoAtivo: boolean;
  equipadoPor?: string; // nome do personagem lido em "Equipado por ..."
  chaveInativa?: ChaveSubstat; // substat marcado como "(A ser ativado)", mesmo se faltar ler outro
  avisos: string[];
}

export function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[|]/g, "l")
    .replace(/[-_~]/g, " ") // "Recarga de-Energia
    .replace(/\s+/g, " ")
    .trim();
}

type Base = "hp" | "atk" | "def" | "crit" | "critDano" | "recarga" | "prof" | "cura" | `dano:${string}`;

// Do mais específico para o mais genérico: "bonus de dano pyro" precisa vir antes de "def"/"atq".
const NOMES_STATS: { base: Base; padrao: RegExp }[] = [
  // Variações comuns de erro do OCR: "Grítica", "Dario", "Dand".
  { base: "crit", padrao: /taxa (de )?[cg]r|crit(ical)? rate/ },
  { base: "critDano", padrao: /\b[db]a\w{1,3} cr[il1]t|crit(ical)? dmg/ },
  // "Recargade Energia": o OCR às vezes come o espaço.
  { base: "recarga", padrao: /recarga ?de ?energia|energy recharge/ },
  { base: "prof", padrao: /proficiencia ?elemental|elemental mastery/ },
  { base: "cura", padrao: /bonus de cura|healing bonus/ },
  { base: "dano:physical", padrao: /dano fisico|physical dmg/ },
  { base: "dano:pyro", padrao: /dano pyro|pyro dmg/ },
  { base: "dano:hydro", padrao: /dano hydro|hydro dmg/ },
  { base: "dano:electro", padrao: /dano electro|electro dmg/ },
  { base: "dano:cryo", padrao: /dano cryo|cryo dmg/ },
  { base: "dano:anemo", padrao: /dano anemo|anemo dmg/ },
  { base: "dano:geo", padrao: /dano geo|geo dmg/ },
  { base: "dano:dendro", padrao: /dano dendro|dendro dmg/ },
  { base: "hp", padrao: /\b(pv|hp|vida)\b/ },
  { base: "atk", padrao: /\b(atq|atk)\b/ },
  { base: "def", padrao: /\bdef\b/ },
];

function acharStat(linha: string): { base: Base; fim: number } | undefined {
  for (const { base, padrao } of NOMES_STATS) {
    const m = padrao.exec(linha);
    if (!m) continue;
    // Avança até o fim da palavra ("taxa crit" → "taxa critica").
    let fim = m.index + m[0].length;
    while (fim < linha.length && /[a-z]/.test(linha[fim])) fim++;
    return { base, fim };
  }
  return undefined;
}

function chaveDe(base: Base, percentual: boolean): ChaveMainStat | ChaveSubstat {
  switch (base) {
    case "hp":
      return percentual ? "hp_" : "hp";
    case "atk":
      return percentual ? "atk_" : "atk";
    case "def":
      return percentual ? "def_" : "def";
    case "crit":
      return "critRate_";
    case "critDano":
      return "critDMG_";
    case "recarga":
      return "enerRech_";
    case "prof":
      return "eleMas";
    case "cura":
      return "heal_";
    default:
      return `${base.slice(5)}_dmg_` as ChaveMainStat;
  }
}

/** Converte o número lido: "3,9" → 3.9; "1.793" (milhar) → 1793; corrige O→0 e l/I→1. */
export function lerNumero(bruto: string): number {
  let s = bruto.replace(/[oO]/g, "0").replace(/[lIi]/g, "1").replace(/\s/g, "");
  if (/^\d{1,3}[.,]\d{3}$/.test(s)) s = s.replace(/[.,]/, ""); // separador de milhar
  return Number(s.replace(",", "."));
}

// O texto chega em minúsculas (normalizar), então "I8" vira "i8": "i" também conta como 1.
const NUMERO = String.raw`([\doOlIi]+(?:[.,][\doOlIi]+)?)`;
// Depois do nome do stat: até 3 caracteres de sujeira, "+" (às vezes perdido pelo OCR), número e "%".
const RE_SUBSTAT = new RegExp(String.raw`^[^\w\d]{0,3}?(\+)?\s*${NUMERO}\s*(%)?`);
// "+18%." do texto do bônus de set não é nível: o número não pode vir seguido de %, vírgula ou ponto.
const RE_NIVEL = /(?:^|[^\w])\+\s?(\d{1,2})(?![\d%.,])/;
// PT-BR mostra "(A ser ativado)", às vezes quebrado em duas linhas.
const RE_INATIVO = /nao ativ|\(\s*a\s*\W?\s*\w?er\b|ser ativad|ativad[oa]\s*\)|inativ|unactivated|inactive|desativ/;
const RE_EQUIPADO = /equipado por\s+(.+)|equipped by\s+(.+)/;
const RE_FIM_SUBS = /\bpecas?\b|\bpiece|\bconjunto\b|\bset:/;

const PECA_POR_PALAVRA: [RegExp, Peca][] = [
  [/\bflor ?da ?vida|flower of life/, "flower"],
  [/\bpena ?da ?morte|plume of death/, "plume"],
  [/\bareias?\b|sands of eon|\bampulheta/, "sands"],
  [/\bcalice\b|goblet/, "goblet"],
  [/\btiara\b|circlet|\bcoroa\b/, "circlet"],
];

function distancia(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

function semelhanca(a: string, b: string): number {
  if (!a || !b) return 0;
  return 1 - distancia(a, b) / Math.max(a.length, b.length);
}

const soLetras = (s: string) => normalizar(s).replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();

interface Candidato {
  texto: string;
  set: string;
  peca?: Peca;
}

const CANDIDATOS: Candidato[] = SETS.flatMap((s) => [
  { texto: soLetras(s.en), set: s.en },
  { texto: soLetras(s.pt), set: s.en },
  ...Object.entries(s.pecas).flatMap(([peca, n]) => [
    { texto: soLetras(n!.en), set: s.en, peca: peca as Peca },
    { texto: soLetras(n!.pt), set: s.en, peca: peca as Peca },
  ]),
]);

/** Melhor candidato (set ou nome de peça) para as linhas, considerando também pares de linhas quebradas. */
function acharNomes(linhas: string[]): { set?: { valor: string; linha: number }; peca?: { valor: Peca; set: string } } {
  let melhorSet: { nota: number; valor: string; linha: number } | undefined;
  let melhorPeca: { nota: number; valor: Peca; set: string } | undefined;
  const trechos: { texto: string; linha: number }[] = [];
  linhas.forEach((l, i) => {
    trechos.push({ texto: soLetras(l), linha: i });
    if (i + 1 < linhas.length) trechos.push({ texto: soLetras(l + " " + linhas[i + 1]), linha: i });
  });
  for (const t of trechos) {
    if (t.texto.length < 6) continue;
    for (const c of CANDIDATOS) {
      const nota = semelhanca(t.texto, c.texto);
      if (nota < 0.8) continue;
      if (c.peca) {
        if (!melhorPeca || nota > melhorPeca.nota) melhorPeca = { nota, valor: c.peca, set: c.set };
      } else if (!melhorSet || nota > melhorSet.nota) {
        melhorSet = { nota, valor: c.set, linha: t.linha };
      }
    }
  }
  return { set: melhorSet, peca: melhorPeca };
}

export function lerTextoDoPrint(texto: string): LeituraPrint {
  const linhas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const norm = linhas.map(normalizar);
  const avisos: string[] = [];

  // Set e peça pelos nomes (o nome da peça identifica as duas coisas).
  // O tipo da peça escrito no jogo ("Flor da Vida", "Sands of Eon") vale mais que o nome da peça.
  const nomes = acharNomes(linhas);
  const set = nomes.set?.valor ?? nomes.peca?.set;
  let peca: Peca | undefined;
  for (const l of norm) {
    const achado = PECA_POR_PALAVRA.find(([re]) => re.test(l));
    if (achado) {
      peca = achado[1];
      break;
    }
  }
  peca ??= nomes.peca?.valor;

  // Nível: linha com "+NN" sem nome de stat.
  let nivel: number | undefined;
  let linhaNivel = -1;
  const inicioBonusSet = norm.findIndex((l) => RE_FIM_SUBS.test(l));
  norm.forEach((l, i) => {
    if (nivel !== undefined || acharStat(l)) return;
    if (inicioBonusSet >= 0 && i >= inicioBonusSet) return; // o nível fica antes do texto do set
    const m = RE_NIVEL.exec(l);
    if (m && Number(m[1]) <= 20) {
      nivel = Number(m[1]);
      linhaNivel = i;
    }
  });

  // Substats: "nome +valor", depois da linha do nível e até a linha do set ou do bônus de conjunto.
  const fimSubs = nomes.set && nomes.set.linha > linhaNivel ? nomes.set.linha : norm.length;
  const substats: (Substat & { inativo: boolean })[] = [];
  let primeiraSub = -1;
  for (let i = linhaNivel + 1; i < norm.length && substats.length < 4; i++) {
    const l = norm[i];
    if (i >= fimSubs || RE_FIM_SUBS.test(l)) {
      if (substats.length > 0) break;
      continue;
    }
    const stat = acharStat(l);
    if (!stat) continue;
    const m = RE_SUBSTAT.exec(l.slice(stat.fim));
    // Sem "+" e sem "%" pode ser a main stat ("Vida 4.780"), então só aceita depois do nível.
    if (!m || (!m[1] && !m[3] && linhaNivel < 0)) continue;
    let bruto = m[2];
    let temPorcento = Boolean(m[3]);
    // Percentuais têm 1 casa decimal; uma 2ª casa costuma ser o "%" lido como dígito ("5,27" → 5,2%).
    if (/^\d+[.,]\d\d$/.test(bruto)) {
      bruto = bruto.slice(0, -1);
      temPorcento = true;
    }
    const valor = lerNumero(bruto);
    if (!Number.isFinite(valor) || valor <= 0) continue;
    const percentual = temPorcento || (/[.,]/.test(bruto) && !/^\d{1,3}[.,]\d{3}$/.test(bruto));
    const chave = chaveDe(stat.base, percentual);
    if (!isSubstat(chave) || substats.some((s) => s.chave === chave)) continue;
    if (primeiraSub < 0) primeiraSub = i;
    const proxima = norm[i + 1] ?? "";
    const inativo = RE_INATIVO.test(l) || (RE_INATIVO.test(proxima) && !acharStat(proxima));
    substats.push({ chave, valor, inativo });

  }

  // Main stat: nome de stat sozinho, antes do nível e dos substats.
  let mainStat: ChaveMainStat | undefined;
  if (peca === "flower") mainStat = "hp";
  else if (peca === "plume") mainStat = "atk";
  else {
    const limite = [linhaNivel, primeiraSub].filter((x) => x >= 0).reduce((a, b) => Math.min(a, b), norm.length);
    for (let i = 0; i < limite; i++) {
      const stat = acharStat(norm[i]);
      if (!stat || /^[^\w\d]{0,3}\+/.test(norm[i].slice(stat.fim))) continue;
      const proxima = norm[i + 1] ?? "";
      const percentual =
        peca !== undefined || /%/.test(norm[i]) || /^[\doOlI.,\s]+%/.test(proxima) || !stat.base.match(/^(hp|atk|def)$/);
      const chave = chaveDe(stat.base, percentual);
      if (chave !== "def") mainStat = chave; // DEF fixa nunca é main stat
      break;
    }
  }

  // 4º substat bloqueado: o jogo mostra o substat marcado como não ativado.
  let quartoAtivo = true;
  const idxInativo = substats.findIndex((s) => s.inativo);
  const chaveInativa = idxInativo >= 0 ? substats[idxInativo].chave : undefined;
  if (idxInativo >= 0 && substats.length === 4) {
    const [inativo] = substats.splice(idxInativo, 1);
    substats.push(inativo);
    quartoAtivo = false;
  }

  // Substat "(A ser ativado)" só existe no +0: se o nível não foi lido, é +0.
  if (nivel === undefined && chaveInativa) nivel = 0;

  const raridade: Raridade | undefined = nivel !== undefined && nivel > 16 ? 5 : undefined;

  // "Equipado por Nicole" → nome do personagem, como aparece no jogo.
  let equipadoPor: string | undefined;
  for (const l of linhas) {
    const m = RE_EQUIPADO.exec(normalizar(l));
    if (m) {
      const original = l.slice(l.length - (m[1] ?? m[2]).length).replace(/[^\p{L} ]/gu, "").trim();
      if (original) equipadoPor = original;
    }
  }

  if (!set) avisos.push("Não reconheci o set.");
  if (!peca) avisos.push("Não reconheci a peça.");
  if (!mainStat) avisos.push("Não reconheci a main stat.");
  if (nivel === undefined) avisos.push("Não reconheci o nível.");
  if (substats.length < 3) avisos.push(`Só reconheci ${substats.length} substat(s).`);
  for (const sub of substats) if (!possivel(sub)) avisos.push(avisoValor(sub));

  return {
    set,
    peca,
    mainStat,
    nivel,
    raridade,
    substats: substats.map(({ chave, valor }) => ({ chave, valor })),
    quartoAtivo,
    equipadoPor,
    chaveInativa,
    avisos,
  };
}

const SUBSTATS_VALIDOS = new Set<string>([
  "hp", "atk", "def", "hp_", "atk_", "def_", "eleMas", "enerRech_", "critRate_", "critDMG_",
]);
function isSubstat(chave: string): chave is ChaveSubstat {
  return SUBSTATS_VALIDOS.has(chave);
}

// A raridade não aparece no texto; aceita valores possíveis em 5★ ou 4★.
const possivel = (s: Substat) => valorPossivel(s, 5) || valorPossivel(s, 4);
const avisoValor = (s: Substat) => `Confira ${NOME_STAT[s.chave]}: ${s.valor} não é um valor possível.`;

/**
 * Junta duas leituras do mesmo print feitas com tratamentos de imagem diferentes.
 * A primeira manda; a segunda corrige valores impossíveis, completa o que faltou e o nível.
 */
export function combinarLeituras(a: LeituraPrint, b: LeituraPrint): LeituraPrint {
  // "ATQ+4,1%" lido como "ATQ+4" muda a chave (atk_ → atk), então procura também a versão fixa/percentual.
  const mesmoStat = (x: string, y: string) => x.replace(/_$/, "") === y.replace(/_$/, "");
  const substats = a.substats.map((s) => {
    if (possivel(s)) return s;
    const alt = b.substats.find((x) => mesmoStat(x.chave, s.chave) && possivel(x));
    return alt && !a.substats.some((y) => y !== s && y.chave === alt.chave) ? alt : s;
  });
  for (const s of b.substats) {
    if (substats.length >= 4) break;
    if (!substats.some((x) => x.chave === s.chave) && possivel(s)) substats.push(s);
  }
  // O substat "(A ser ativado)" vai por último.
  const chaveInativa = a.chaveInativa ?? b.chaveInativa;
  let quartoAtivo = true;
  const i = substats.findIndex((x) => x.chave === chaveInativa);
  if (i >= 0 && substats.length === 4) {
    substats.push(...substats.splice(i, 1));
    quartoAtivo = false;
  }
  // Nível: fica com o que bate com os valores lidos.
  let nivel = a.nivel ?? b.nivel;
  if (nivel !== undefined && !nivelCombina(substats, nivel) && b.nivel !== undefined && nivelCombina(substats, b.nivel))
    nivel = b.nivel;
  const r: LeituraPrint = {
    set: a.set ?? b.set,
    peca: a.peca ?? b.peca,
    mainStat: a.mainStat ?? b.mainStat,
    nivel,
    raridade: nivel !== undefined && nivel > 16 ? 5 : undefined,
    equipadoPor: a.equipadoPor ?? b.equipadoPor,
    chaveInativa,
    substats,
    quartoAtivo,
    avisos: [],
  };
  if (!r.set) r.avisos.push("Não reconheci o set.");
  if (!r.peca) r.avisos.push("Não reconheci a peça.");
  if (!r.mainStat) r.avisos.push("Não reconheci a main stat.");
  if (nivel === undefined) r.avisos.push("Não reconheci o nível.");
  else if (!nivelCombina(substats, nivel)) r.avisos.push(`O nível +${nivel} não bate com os valores lidos: confira o nível e os substats.`);
  for (const s of substats) if (!possivel(s)) r.avisos.push(avisoValor(s));
  if (substats.length < 3) r.avisos.push(`Só reconheci ${substats.length} substat(s).`);
  else if (substats.length === 3 && (nivel ?? 0) >= 4)
    r.avisos.push("A partir do +4 a peça tem 4 substats: faltou ler um.");
  return r;
}

/** Acha o perfil cujo nome mais se parece com o lido no print ("Xinggiu" → Xingqiu). */
export function acharPersonagem<T extends { id: string; nome: string }>(lido: string, perfis: T[]): T | undefined {
  const alvo = soLetras(lido);
  let melhor: { nota: number; perfil: T } | undefined;
  for (const p of perfis) {
    const nomes = [p.nome, p.id.replace(/-/g, " "), p.nome.split(" ").pop() ?? ""];
    for (const n of nomes) {
      const nota = semelhanca(alvo, soLetras(n));
      if (nota >= 0.75 && (!melhor || nota > melhor.nota)) melhor = { nota, perfil: p };
    }
  }
  return melhor?.perfil;
}
