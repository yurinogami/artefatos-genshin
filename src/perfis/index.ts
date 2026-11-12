import bruto from "./perfis.json";
import type { PerfilBuild } from "../dominio/tipos";

// Perfis próprios. Cada um traz sets, main stats aceitas e pesos de 0 a 1 por substat.
// Ajuste os pesos aqui conforme seu jeito de jogar.
export const PERFIS: PerfilBuild[] = (bruto as PerfilBuild[]).slice().sort((a, b) =>
  a.nome.localeCompare(b.nome, "pt-BR"),
);

export const PERFIL_POR_ID: Record<string, PerfilBuild> = Object.fromEntries(PERFIS.map((p) => [p.id, p]));

/**
 * Uma build "pronta para calcular": o perfil com a variante aplicada.
 * O `id` continua sendo o do personagem (é o que fica em "Equipado em");
 * `chave` identifica a build ("mavuika" ou "mavuika:subdps").
 */
export interface Build extends PerfilBuild {
  chave: string;
}

export function buildsDe(p: PerfilBuild): Build[] {
  const principal: Build = { ...p, chave: p.id };
  const outras = (p.variantes ?? []).map(
    ({ id, ...v }): Build => ({ ...p, ...v, id: p.id, chave: `${p.id}:${id}`, variantes: undefined }),
  );
  return [principal, ...outras];
}

export const BUILDS: Build[] = PERFIS.flatMap(buildsDe);
export const BUILD_POR_CHAVE: Record<string, Build> = Object.fromEntries(BUILDS.map((b) => [b.chave, b]));

/**
 * Build com o set que o jogador escolheu: o otimizador, o Farmar e a build ideal passam a usar só esse set
 * (4 peças dele + 1 peça livre). Sem escolha, compara todos os sets do perfil.
 */
export function comSetEscolhido(b: Build, configs: { personagem: string; setEscolhido?: Record<string, string> }[]): Build {
  const set = configs.find((c) => c.personagem === b.id)?.setEscolhido?.[b.chave];
  return set ? { ...b, sets: [set] } : b;
}

export function nomeBuild(b: Build): string {
  return b.rotulo ? `${b.nome} (${b.rotulo})` : b.nome;
}
