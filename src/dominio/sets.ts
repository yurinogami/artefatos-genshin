import dados from "./sets-dados.json";
import extras from "./sets-extras.json";

export interface DadosSet {
  en: string; // nome em inglês (usado nos perfis e no armazenamento)
  pt: string; // nome em português (como aparece no jogo em PT-BR)
  pecas: Partial<Record<"flower" | "plume" | "sands" | "goblet" | "circlet", { en: string; pt: string; icone?: string }>>;
}

// sets-dados.json é gerado por scripts/gerar-sets.mjs a partir do genshin-db.
// sets-extras.json tem sets novos que o genshin-db ainda não conhece, cadastrados à mão;
// quando o genshin-db passar a incluir um deles, a versão gerada prevalece.
const gerados = dados as DadosSet[];
const nomesGerados = new Set(gerados.map((s) => s.en));
export const SETS: DadosSet[] = [
  ...gerados,
  ...(extras as DadosSet[]).filter((s) => !nomesGerados.has(s.en)),
].sort((a, b) => a.en.localeCompare(b.en));

// O campo de set aceita qualquer texto, então um set que ainda não esteja aqui pode ser digitado à mão.
export const SETS_5_ESTRELAS: string[] = SETS.map((s) => s.en);

const NOME_PT = new Map(SETS.map((s) => [s.en.toLowerCase(), s.pt]));
/** Nome do set como aparece no jogo em português (guardamos em inglês). */
export function nomeSet(en: string): string {
  return NOME_PT.get(en.toLowerCase()) ?? en;
}
