// Melhor arma para uma build: lista pesquisada (em ordem) + dano estimado de cada arma do tipo.
// O cálculo usa as mesmas peças para todas as armas (a melhor build com seus artefatos), troca só a arma
// e soma a parte da passiva que vira stat fixo no refinamento considerado.
import recomendadas from "../perfis/armas-recomendadas.json";
import { avaliarBuild, type Arma, type BasePersonagem, type ConfigPersonagem } from "./build";
import { ARMAS_DADOS, bonusDaPassiva, bonusDasConstelacoes, somarBonus, type DadoArma } from "./extras";
import type { Artefato, PerfilBuild } from "./tipos";

export interface ArmaPossuida {
  en: string;
  refinamento: number;
}

export interface ListaPesquisa {
  fonte?: string;
  tipo: "pesquisa" | "rascunho";
  armas: { en: string; nota?: string }[];
}

const LISTAS = recomendadas as unknown as Record<string, ListaPesquisa>;

/** Lista da build (ex.: "mavuika:subdps"); sem lista própria, usa a do personagem. */
export function listaPesquisa(chaveBuild: string): ListaPesquisa | undefined {
  return LISTAS[chaveBuild] ?? LISTAS[chaveBuild.split(":")[0]];
}

/** R1 para 5★; R5 para 4★ e 3★ (as mais fáceis de refinar). A sua, se marcada, vale mais. */
export function refinamentoConsiderado(dado: DadoArma, possuidas: ArmaPossuida[]): number {
  return possuidas.find((p) => p.en === dado.en)?.refinamento ?? (dado.raridade >= 5 ? 1 : 5);
}

export function comoArma(dado: DadoArma, personagem: string, refinamento: number): Arma {
  return { personagem, nome: dado.pt, en: dado.en, refinamento, atk: dado.atk, secundario: dado.secundario };
}

export interface ArmaAvaliada {
  dado: DadoArma;
  refinamento: number;
  possui: boolean;
  valor: number; // dano estimado da build com esta arma
  relativo: number; // 1 = melhor arma do tipo no cálculo
}

export function avaliarArmas(
  perfil: PerfilBuild,
  base: BasePersonagem,
  config: ConfigPersonagem | undefined,
  pecas: Artefato[],
  possuidas: ArmaPossuida[],
): ArmaAvaliada[] {
  const constelacoes = bonusDasConstelacoes(base, config);
  const lista = ARMAS_DADOS.filter((d) => !base.arma || d.tipo === base.arma).map((dado) => {
    const refinamento = refinamentoConsiderado(dado, possuidas);
    const arma = comoArma(dado, perfil.id, refinamento);
    const av = avaliarBuild(pecas, perfil, base, arma, somarBonus(bonusDaPassiva(arma), constelacoes));
    return { dado, refinamento, possui: possuidas.some((p) => p.en === dado.en), valor: av.valor, relativo: 0 };
  });
  const max = Math.max(...lista.map((x) => x.valor), 1e-9);
  for (const x of lista) x.relativo = x.valor / max;
  return lista.sort((a, b) => b.valor - a.valor);
}
