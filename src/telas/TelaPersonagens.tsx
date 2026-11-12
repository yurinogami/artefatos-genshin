import { useMemo, useState } from "react";
import type { Artefato, ChaveSubstat, Peca, PerfilBuild } from "../dominio/tipos";
import { NOME_PECA, NOME_STAT, PECAS } from "../dominio/stats";
import {
  NOTA_REFERENCIA_PADRAO,
  chanceDeSuperar,
  distribuicaoNota,
  faixasDistribuicao,
  notaAtual,
  recomendarTroca,
  vereditoInvestimento,
  type Veredito,
} from "../dominio/pontuacao";
import { marcarPossui, salvarArtefato } from "../armazenamento/db";
import { ordenarPorPosse, possuiPersonagem } from "../dominio/posse";
import { inventarioProjetado } from "../dominio/projecao";
import { NIVEL_MAXIMO } from "../dominio/stats";
import { melhorBuild, type ContextoBuild, type MelhorBuild } from "../dominio/otimizador";
import { avaliarBuild, ganhoDeUmRoll, type Arma, type Avaliacao, type ConfigPersonagem } from "../dominio/build";
import { bonusDaPassiva, bonusDasConstelacoes, somarBonus } from "../dominio/extras";
import textosSets from "../dominio/textos-sets.json";
import { AbaTalentos } from "./AbaTalentos";
import { AbaArmas } from "./AbaArmas";
import { AbaBuildsSalvas } from "./AbaBuildsSalvas";
import type { BuildSalva } from "../dominio/buildsSalvas";
import type { ArmaPossuida } from "../dominio/armasRecomendacao";
import { temBonusConhecido } from "../dominio/bonus-sets";
import { BASE_PERSONAGEM } from "../perfis/base";
import { PainelArma } from "../componentes/PainelArma";
import { buildIdeal } from "../dominio/ideal";
import { nomeSet } from "../dominio/sets";
import { PERFIS, PERFIL_POR_ID, buildsDe, comSetEscolhido } from "../perfis";
import { SeletorSet } from "../componentes/SeletorSet";
import { CartaoArtefato, formatarStat } from "../componentes/Artefato";
import { NotaArtefato } from "../componentes/NotaArtefato";
import { IconeArtefato, IconePersonagem } from "../componentes/Imagens";
import { IcoAviso, IcoCheck, IcoInfo, IcoMais, IcoSetaCima, IcoX } from "../componentes/Icones";

type Aba = "atual" | "melhor" | "salvas" | "upar" | "ideal" | "armas" | "talentos";
const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "atual", rotulo: "Build atual" },
  { id: "melhor", rotulo: "Melhor com meus artefatos" },
  { id: "salvas", rotulo: "Builds salvas" },
  { id: "upar", rotulo: "Vale upar?" },
  { id: "ideal", rotulo: "Build ideal" },
  { id: "armas", rotulo: "Melhor arma" },
  { id: "talentos", rotulo: "Talentos e constelações" },
];

const normalizarBusca = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const fmt = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const TEXTO_VEREDITO: Record<Veredito, string> = {
  upar: "Vale upar",
  talvez: "Só se tiver sorte",
  descartar: "Não vale",
  pronto: "No nível máximo",
};

export function TelaPersonagens({
  artefatos,
  armas,
  configs,
  armasPossuidas,
  buildsSalvas,
  aoMudar,
  irParaArtefatos,
}: {
  buildsSalvas: BuildSalva[];
  artefatos: Artefato[];
  armas: Arma[];
  configs: ConfigPersonagem[];
  armasPossuidas: ArmaPossuida[];
  aoMudar: () => void;
  irParaArtefatos: () => void;
}) {
  const tem = (id: string) => possuiPersonagem(id, configs, artefatos);
  // Sem nenhum personagem marcado ainda, ninguém fica apagado (só aparece a dica).
  const algumMarcado = PERFIS.some((p) => tem(p.id));
  const [perfilId, setPerfilId] = useState(() => (PERFIS.find((p) => tem(p.id)) ?? PERFIS[0])?.id ?? "");
  const [chaveBuild, setChaveBuild] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>("atual");
  const [busca, setBusca] = useState("");
  const [soComTroca, setSoComTroca] = useState(false);

  // Personagens cuja melhor build (na build principal) passa a equipada: ganham a seta na lista.
  const comTroca = useMemo(() => {
    const ids = new Set<string>();
    for (const p of PERFIS) {
      const principal = buildsDe(p)[0] && comSetEscolhido(buildsDe(p)[0], configs);
      if (!principal) continue;
      const doPersonagem = artefatos.filter((a) => a.equipadoEm === p.id);
      // Sem nada equipado não há "troca": o personagem só não foi montado ainda.
      if (doPersonagem.length === 0) continue;
      const ctx = contexto(p.id, armas, configs);
      if (ctx) {
        const m = melhorBuild(principal, artefatos, ctx);
        const hoje = avaliarBuild(doPersonagem, principal, ctx.base, ctx.arma, ctx.extras).valor;
        if (m.avaliacao!.valor > hoje * 1.005) ids.add(p.id);
      } else {
        const equipada = doPersonagem.reduce((s, a) => s + notaAtual(a, principal), 0);
        if (melhorBuild(principal, artefatos).nota > equipada + 0.05) ids.add(p.id);
      }
    }
    return ids;
  }, [artefatos, armas, configs]);
  const personagem = PERFIL_POR_ID[perfilId];
  const builds = personagem ? buildsDe(personagem) : [];
  // A build escolhida (DPS, Sub-DPS...) define sets, main stats e pesos; o personagem é o mesmo.
  const perfilBase = builds.find((b) => b.chave === chaveBuild) ?? builds[0];
  // Com set escolhido pelo jogador, o site todo usa só esse set para a build.
  const setEscolhido = configs.find((c) => c.personagem === perfilId)?.setEscolhido?.[perfilBase?.chave ?? ""];
  const perfil = useMemo(() => (perfilBase ? comSetEscolhido(perfilBase, configs) : perfilBase), [perfilBase, configs]);

  const equipados = useMemo(() => {
    const m: Partial<Record<Peca, Artefato>> = {};
    for (const a of artefatos) if (a.equipadoEm === perfilId) m[a.peca] = a;
    return m;
  }, [artefatos, perfilId]);

  const ctx = useMemo(() => (perfil ? contexto(perfil.id, armas, configs) : undefined), [perfil, armas, configs]);
  const melhor = useMemo(() => (perfil ? melhorBuild(perfil, artefatos, ctx) : null), [perfil, artefatos, ctx]);
  const pecasDaMelhor = useMemo(() => (melhor ? (Object.values(melhor.pecas).map((e) => e!.artefato) as Artefato[]) : []), [melhor]);
  const avaliacaoAtual = useMemo(
    () =>
      perfil && ctx ? avaliarBuild(Object.values(equipados) as Artefato[], perfil, ctx.base, ctx.arma, ctx.extras) : undefined,
    [perfil, ctx, equipados],
  );

  if (!perfil || !melhor) return <p className="vazio">Nenhum perfil de personagem cadastrado.</p>;

  const total = PECAS.reduce((s, p) => s + (equipados[p] ? notaAtual(equipados[p]!, perfil) : 0), 0);

  async function equipar(candidato: Artefato, peca: Peca) {
    const atual = equipados[peca];
    if (atual) await salvarArtefato({ ...atual, equipadoEm: null });
    await salvarArtefato({ ...candidato, equipadoEm: perfil.id });
    await marcarPossui([perfil.id]);
    aoMudar();
  }

  async function equiparBuild(m: MelhorBuild) {
    const conflitos = Object.values(m.pecas).filter((p) => p!.conflito);
    if (
      conflitos.length &&
      !confirm(
        `Isso tira ${conflitos.length} peça(s) de outros personagens (${conflitos
          .map((c) => PERFIL_POR_ID[c!.conflito!]?.nome ?? c!.conflito)
          .join(", ")}). Continuar?`,
      )
    )
      return;
    for (const peca of PECAS) {
      // Na projeção a peça vem com valores estimados: salva sempre a peça real (mesmo id).
      const id = m.pecas[peca]?.artefato.id;
      const escolhida = artefatos.find((a) => a.id === id);
      const atual = equipados[peca];
      if (!escolhida || escolhida.id === atual?.id) continue;
      if (atual) await salvarArtefato({ ...atual, equipadoEm: null });
      await salvarArtefato({ ...escolhida, equipadoEm: perfil.id });
    }
    await marcarPossui([perfil.id]);
    aoMudar();
  }

  return (
    <div className="tela-personagens">
      <aside className="lista-personagens" aria-label="Personagens">
        <label className="busca">
          Buscar personagem
          <input type="search" placeholder="Ex.: Furina" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </label>
        <div className="filtro-troca" role="group" aria-label="Filtrar personagens">
          <button aria-pressed={!soComTroca} onClick={() => setSoComTroca(false)}>
            Todos
          </button>
          <button aria-pressed={soComTroca} onClick={() => setSoComTroca(true)}>
            Com troca sugerida ({comTroca.size})
          </button>
        </div>
        <div className="grade-personagens">
          {ordenarPorPosse(
            PERFIS.filter(
              (p) => normalizarBusca(p.nome).includes(normalizarBusca(busca)) && (!soComTroca || comTroca.has(p.id)),
            ),
            tem,
          ).map((p) => (
            <button
              key={p.id}
              className={["personagem", p.id === perfilId && "ativo", algumMarcado && !tem(p.id) && "nao-tenho"]
                .filter(Boolean)
                .join(" ")}
              aria-pressed={p.id === perfilId}
              aria-label={`${p.nome}${algumMarcado && !tem(p.id) ? " (não tenho)" : ""}`}
              title={`${p.nome}, ${p.elemento}${algumMarcado && !tem(p.id) ? ". Você não tem" : ""}${comTroca.has(p.id) ? ". Tem troca que melhora a build" : ""}`}
              onClick={() => {
                setPerfilId(p.id);
                setChaveBuild(null);
              }}
            >
              <span className="personagem-icone">
                <IconePersonagem id={p.id} nome={p.nome} className="icone-personagem moldura" />
                {comTroca.has(p.id) && (
                  <span className="seta-troca">
                    <IcoSetaCima tamanho={12} />
                  </span>
                )}
              </span>
              <span className="personagem-nome">{p.nome}</span>
            </button>
          ))}
        </div>
        <p className="dica-troca">
          <span className="seta-troca">
            <IcoSetaCima tamanho={11} />
          </span>
          tem uma troca que melhora a build
        </p>
        <p className="dica-troca">
          {algumMarcado
            ? "Apagados: personagens que você não tem."
            : 'Abra um personagem e use "Tenho este personagem" para separar os seus.'}
        </p>
      </aside>

      <section className="detalhe">
        <header className="detalhe-topo">
          <IconePersonagem id={perfil.id} nome={perfil.nome} className="icone-personagem moldura grande" />
          <div className="detalhe-titulo">
            <h2>{perfil.nome}</h2>
            <p className="sub">
              {perfil.funcao}, {perfil.elemento}
            </p>
            {perfil.rascunho && (
              <p className="aviso-rascunho">
                <IcoAviso tamanho={14} /> Perfil rascunho: montado lendo o kit do personagem, sem guia de build conhecido. Revise os sets e
                pesos quando sair um guia.
              </p>
            )}
            <p className="melhores-sets">
              <span className="sub">Melhores sets:</span>
              {perfilBase.sets.slice(0, 2).map((s, i) => (
                <span key={s} className={s === setEscolhido ? "chip-set escolhido" : "chip-set"}>
                  {i > 0 && <span className="sub">ou </span>}
                  {nomeSet(s)}
                </span>
              ))}
            </p>
            <SeletorSet build={perfilBase} escolhido={setEscolhido} aoMudar={aoMudar} />
            <button
              type="button"
              className={tem(perfil.id) ? "botao-tenho marcado" : "botao-tenho"}
              aria-pressed={tem(perfil.id)}
              onClick={async () => {
                await marcarPossui([perfil.id], !tem(perfil.id));
                aoMudar();
              }}
            >
              {tem(perfil.id) ? <IcoCheck tamanho={16} /> : <IcoMais tamanho={16} />}
              {tem(perfil.id) ? "Tenho este personagem" : "Não tenho: marcar como meu"}
            </button>
            {builds.length > 1 && (
              <div className="segmentado builds" role="group" aria-label="Build">
                {builds.map((b) => (
                  <button
                    key={b.chave}
                    className={b.chave === perfil.chave ? "ativo" : ""}
                    aria-pressed={b.chave === perfil.chave}
                    onClick={() => setChaveBuild(b.chave)}
                  >
                    {b.rotulo ?? "Principal"}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Placar
            atual={total}
            melhor={melhor.nota}
            perfeita={buildIdeal(perfil).notaMaxima}
            ganhoBuild={avaliacaoAtual && melhor.avaliacao ? ganhoTexto(avaliacaoAtual, melhor.avaliacao) : undefined}
          />
        </header>

        <PainelArma key={perfil.id} perfil={perfil} arma={ctx?.arma} aoMudar={aoMudar} />

        <ResumoPerfil perfil={perfilBase} />

        {artefatos.length === 0 && (
          <p className="vazio">
            Cadastre seus artefatos para ver recomendações.{" "}
            <button className="link" onClick={irParaArtefatos}>
              Ir para Artefatos
            </button>
          </p>
        )}

        <div className="segmentado abas-personagem" role="tablist" aria-label="Visões da build">
          {ABAS.map((a) => (
            <button
              key={a.id}
              role="tab"
              aria-selected={aba === a.id}
              className={aba === a.id ? "ativo" : ""}
              onClick={() => setAba(a.id)}
            >
              {a.rotulo}
            </button>
          ))}
        </div>

        {aba === "atual" && (
          <div className="slots">
            {PECAS.map((peca) => {
              const atual = equipados[peca];
              const trocas = recomendarTroca(perfil, peca, artefatos, atual).slice(0, 3);
              return (
                <div className="slot" key={peca}>
                  <h3>{NOME_PECA[peca]}</h3>
                  {atual ? (
                    <CartaoArtefato a={atual} perfil={perfil}>
                      <NotaArtefato a={atual} perfil={perfil} />
                    </CartaoArtefato>
                  ) : (
                    <p className="slot-vazio">Nada equipado</p>
                  )}
                  {trocas.length > 0 ? (
                    <div className="trocas">
                      <p className="trocas-titulo">Trocar por</p>
                      {trocas.map((c) => (
                        <CartaoArtefato key={c.artefato.id} a={c.artefato} destaque perfil={perfil}>
                          <NotaArtefato a={c.artefato} perfil={perfil} />
                          <p className="motivo">{c.motivo}</p>
                          <button className="primario" onClick={() => equipar(c.artefato, peca)}>
                            Equipar
                          </button>
                        </CartaoArtefato>
                      ))}
                    </div>
                  ) : (
                    atual && <p className="sem-troca">Nenhuma peça melhor no inventário</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {aba === "atual" && <LegendaSubs perfil={perfil} />}
        {aba === "melhor" && (
          <MelhorComInventario
            perfil={perfil}
            artefatos={artefatos}
            melhor={melhor}
            equipados={equipados}
            totalAtual={total}
            ctx={ctx}
            avaliacaoAtual={avaliacaoAtual}
            aoEquipar={equiparBuild}
          />
        )}
        {aba === "upar" && <ValeUpar perfil={perfil} artefatos={artefatos} melhor={melhor} />}
        {aba === "ideal" && <BuildIdealView perfil={perfil} melhor={melhor} />}
        {aba === "salvas" && (
          <AbaBuildsSalvas perfil={perfil} artefatos={artefatos} buildsSalvas={buildsSalvas} ctx={ctx} aoMudar={aoMudar} />
        )}
        {aba === "armas" && (
          <AbaArmas
            perfil={perfil}
            pecas={pecasDaMelhor}
            armaAtual={ctx?.arma}
            config={configs.find((c) => c.personagem === perfil.id)}
            possuidas={armasPossuidas}
            aoMudar={aoMudar}
          />
        )}
        {aba === "talentos" && (
          <AbaTalentos
            perfil={perfil}
            config={configs.find((c) => c.personagem === perfil.id)}
            atual={avaliacaoAtual}
            melhor={melhor.avaliacao}
            aoMudar={aoMudar}
          />
        )}
      </section>
    </div>
  );
}

function ResumoPerfil({ perfil }: { perfil: PerfilBuild }) {
  const pesos = Object.entries(perfil.pesos)
    .filter(([, p]) => (p ?? 0) > 0)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
  return (
    <dl className="resumo">
      <div>
        <dt>Sets</dt>
        <dd>{perfil.sets.map(nomeSet).join(", ")}</dd>
      </div>
      <div>
        <dt>Ampulheta / Cálice / Tiara</dt>
        <dd>
          {perfil.mainStats.sands.map((m) => NOME_STAT[m]).join(" ou ")} /{" "}
          {perfil.mainStats.goblet.map((m) => NOME_STAT[m]).join(" ou ")} /{" "}
          {perfil.mainStats.circlet.map((m) => NOME_STAT[m]).join(" ou ")}
        </dd>
      </div>
      <div>
        <dt>Pesos dos substats</dt>
        <dd className="pesos">
          {pesos.map(([chave, p]) => (
            <span key={chave} className="peso" style={{ ["--p" as string]: p }}>
              {NOME_STAT[chave as keyof typeof NOME_STAT]} {p}
            </span>
          ))}
        </dd>
      </div>
      {perfil.notas && (
        <div>
          <dt>Nota</dt>
          <dd>{perfil.notas}</dd>
        </div>
      )}
    </dl>
  );
}

/** Personagem com arma cadastrada e stats base conhecidos: dá para calcular a build inteira. */
function contexto(id: string, armas: Arma[], configs: ConfigPersonagem[]): ContextoBuild | undefined {
  const arma = armas.find((a) => a.personagem === id);
  const base = BASE_PERSONAGEM[id];
  if (!arma || !base) return undefined;
  const cfg = configs.find((c) => c.personagem === id);
  return { arma, base, extras: somarBonus(bonusDaPassiva(arma), bonusDasConstelacoes(base, cfg)) };
}

/** "+18% de dano estimado" (DPS) ou "+2,3 rolls úteis na build" (suporte); null quando não há ganho. */
function ganhoTexto(hoje: Avaliacao, melhor: Avaliacao): string | null {
  if (melhor.config.modelo === "dano") {
    if (hoje.valor <= 0) return "monte a build para comparar";
    const g = (melhor.valor / hoje.valor - 1) * 100;
    return g > 0.5 ? `+${Math.round(g)}% de dano estimado` : null;
  }
  const g = melhor.valor - hoje.valor;
  return g > 0.05 ? `+${fmt(g)} rolls úteis na build` : null;
}

function Placar({
  atual,
  melhor,
  perfeita,
  ganhoBuild,
}: {
  atual: number;
  melhor: number;
  perfeita: number;
  ganhoBuild?: string | null; // com arma: ganho da build inteira ("+18% de dano estimado"); null = já é a melhor
}) {
  const pct = (n: number) => `${Math.max(0, Math.min(100, (n / perfeita) * 100))}%`;
  const ganho = melhor - atual;
  return (
    <div className="placar-barra">
      <div className="placar-linha">
        <span className="sub">Rolls úteis da build</span>
        {ganhoBuild !== undefined ? (
          ganhoBuild ? (
            <span className="ganho">{ganhoBuild}</span>
          ) : (
            <span className="sub">já é a melhor com seus artefatos</span>
          )
        ) : ganho > 0.05 ? (
          <span className="ganho">+{fmt(ganho)} possível</span>
        ) : (
          <span className="sub">já é a melhor com seus artefatos</span>
        )}
      </div>
      <div
        className="placar-trilho"
        role="img"
        aria-label={`Equipada ${fmt(atual)}, melhor possível ${fmt(melhor)}, de ${fmt(perfeita)} numa build perfeita`}
      >
        <span className="placar-atual" style={{ width: pct(atual) }} />
        {ganho > 0.05 && (
          <span className="placar-ganho" style={{ left: pct(atual), width: `calc(${pct(melhor)} - ${pct(atual)})` }} />
        )}
      </div>
      <div className="placar-linha placar-numeros">
        <span>
          <strong>{fmt(atual)}</strong> equipada
        </span>
        <span className="melhor">
          <strong>{fmt(melhor)}</strong> melhor possível
        </span>
      </div>
      <span className="placar-nota">de {fmt(perfeita)} rolls úteis numa build perfeita</span>
    </div>
  );
}

function LegendaSubs({ perfil }: { perfil: PerfilBuild }) {
  return (
    <p className="legenda">
      <span>
        <span className="ponto" />
        Substat útil para {perfil.nome}
      </span>
      <span>
        <span className="ponto vazio" />
        Não conta
      </span>
      <span>Barra: rolls úteis da peça (9 = perfeita)</span>
    </p>
  );
}

interface Analise {
  a: Artefato;
  notaRef: number;
  refDescricao: string;
  coringa: boolean; // peça de outro set: só pode entrar como a 5ª peça (livre)
  veredito: Veredito;
  projecao: ReturnType<typeof vereditoInvestimento>["projecao"];
}

const ORDEM_VEREDITO: Record<Veredito, number> = { upar: 0, talvez: 1, descartar: 2, pronto: 3 };

function ValeUpar({ perfil, artefatos, melhor }: { perfil: PerfilBuild; artefatos: Artefato[]; melhor: MelhorBuild }) {
  const naMelhor = new Set(Object.values(melhor.pecas).map((p) => p!.artefato.id));
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [mostrarDescartes, setMostrarDescartes] = useState(false);

  // Set da build (o escolhido, se houver). Peças de outros sets são "coringas": só valem como a peça livre.
  const setBuild = melhor.set;
  const livre = PECAS.find((p) => melhor.pecas[p] && !melhor.pecas[p]!.doSet);
  const melhorDoSet = (q: Peca) =>
    Math.max(
      0,
      ...artefatos.filter((x) => x.set === setBuild && x.peca === q && mainStatAceitaParaLista(x, perfil)).map((x) => notaAtual(x, perfil)),
    );
  const analises: Analise[] = artefatos
    .filter((a) => a.nivel < (a.raridade === 5 ? 20 : 16) && !naMelhor.has(a.id) && mainStatAceitaParaLista(a, perfil))
    .map((a) => {
      // Compara com a peça desse slot na melhor build possível com o inventário.
      const ref = melhor.pecas[a.peca];
      const coringa = Boolean(setBuild && a.set !== setBuild);
      let notaRef = ref?.nota ?? NOTA_REFERENCIA_PADRAO;
      let refDescricao = ref ? `${NOME_PECA[a.peca].toLowerCase()} da melhor build` : "uma peça boa de +20";
      if (coringa && ref && livre && livre !== a.peca && melhor.pecas[livre]) {
        // Para virar a peça livre neste slot, o slot livre de hoje precisa voltar a ter uma peça do set:
        // a coringa tem que compensar também essa perda.
        notaRef = ref.nota + Math.max(0, melhor.pecas[livre]!.nota - melhorDoSet(livre));
        refDescricao = `${NOME_PECA[a.peca].toLowerCase()} da melhor build, contando a troca da peça livre (${NOME_PECA[livre].toLowerCase()})`;
      } else if (coringa && ref) {
        refDescricao = `peça livre (${NOME_PECA[a.peca].toLowerCase()}) da melhor build`;
      }
      return { a, notaRef, refDescricao, coringa, ...vereditoInvestimento(a, perfil, notaRef) };
    })
    .sort(
      (x, y) => ORDEM_VEREDITO[x.veredito] - ORDEM_VEREDITO[y.veredito] || y.projecao.notaEsperada - x.projecao.notaEsperada,
    );

  const visiveis = analises.filter((x) => mostrarDescartes || x.veredito !== "descartar");
  const descartes = analises.length - analises.filter((x) => x.veredito !== "descartar").length;
  const atual = analises.find((x) => x.a.id === selecionada) ?? visiveis[0] ?? analises[0];

  if (analises.length === 0)
    return (
      <section className="aba-conteudo">
        <p className="vazio">Nenhuma peça abaixo do nível máximo serve para {perfil.nome} (main stat ou peça).</p>
      </section>
    );

  return (
    <section className="aba-conteudo">
      <div className="upar">
        <aside className="upar-lista" aria-labelledby="t-candidatas">
          <h3 id="t-candidatas">Peças abaixo do nível máximo que servem para {perfil.nome}</h3>
          {setBuild && (
            <p className="sub">
              Set da build: <strong>{nomeSet(setBuild)}</strong>. Peças de outros sets aparecem como coringa (5ª peça).
            </p>
          )}
          <ul>
            {visiveis.map((x) => (
              <li key={x.a.id}>
                <button className="candidata" aria-pressed={x.a.id === atual.a.id} onClick={() => setSelecionada(x.a.id)}>
                  <span className={`candidata-icone r${x.a.raridade}`}>
                    <IconeArtefato set={x.a.set} peca={x.a.peca} />
                  </span>
                  <span className="candidata-texto">
                    <strong>
                      {NOME_PECA[x.a.peca]} · {NOME_STAT[x.a.mainStat]}
                    </strong>
                    <small>
                      +{x.a.nivel} · {nomeSet(x.a.set)}
                    </small>
                    <span className="chips-linha">
                      <span className={`chip v-${x.veredito}`}>{TEXTO_VEREDITO[x.veredito]}</span>
                      {x.coringa && <span className="chip coringa">Coringa</span>}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {descartes > 0 && (
            <button className="link" onClick={() => setMostrarDescartes((v) => !v)}>
              {mostrarDescartes ? "Esconder" : "Mostrar"} {descartes} {descartes === 1 ? "peça que não vale" : "peças que não valem"}
            </button>
          )}
        </aside>

        {atual && <DetalheUpar perfil={perfil} x={atual} />}
      </div>
    </section>
  );
}

/** A lista do "Vale upar?" só mostra peças que o personagem poderia usar (main stat aceita). */
function mainStatAceitaParaLista(a: Artefato, perfil: PerfilBuild) {
  return a.peca === "flower" || a.peca === "plume" || perfil.mainStats[a.peca].includes(a.mainStat);
}

const ICONE_VEREDITO: Record<Veredito, (p: { tamanho?: number }) => React.ReactNode> = {
  upar: IcoCheck,
  talvez: IcoInfo,
  descartar: IcoX,
  pronto: IcoCheck,
};

function DetalheUpar({ perfil, x }: { perfil: PerfilBuild; x: Analise }) {
  const { a, notaRef, refDescricao, veredito, projecao } = x;
  const dist = useMemo(() => distribuicaoNota(a, perfil), [a, perfil]);
  const chance = chanceDeSuperar(dist, notaRef);
  const faixas = faixasDistribuicao(dist, 1, notaRef);
  const maiorProb = Math.max(...faixas.map((f) => f.prob), 0.0001);
  const ini = faixas[0]?.de ?? 0;
  const fim = faixas.at(-1)?.ate ?? 1;
  const posRef = Math.max(0, Math.min(100, ((notaRef - ini) / (fim - ini)) * 100));
  const falta = notaRef - projecao.notaAtual;
  const Icone = ICONE_VEREDITO[veredito];
  const pct = (p: number) => (p > 0 && p < 0.005 ? "<1%" : `${Math.round(p * 100)}%`);
  const colunas = { gridTemplateColumns: `repeat(${faixas.length}, minmax(0, 1fr))` };

  const frase =
    veredito === "upar"
      ? `Na média ela termina em ${fmt(projecao.notaEsperada)}, acima da ${refDescricao} (${fmt(notaRef)}).`
      : veredito === "talvez"
        ? `Para passar a ${refDescricao} (${fmt(notaRef)}), os ${projecao.rollsRestantes} upgrades que faltam precisam somar ${fmt(falta)} rolls úteis; na média somam ${fmt(projecao.notaEsperada - projecao.notaAtual)}.`
        : `Nem com todos os upgrades no melhor substat ela passa a ${refDescricao} (${fmt(notaRef)}).`;

  return (
    <div className="upar-detalhe">
      <section className="upar-topo" aria-labelledby="t-veredito">
        <div className={`upar-peca r${a.raridade}`}>
          <IconeArtefato set={a.set} peca={a.peca} />
          <span className="cartao-nivel">+{a.nivel}</span>
        </div>
        <div className="upar-texto">
          <span className="sub">
            {NOME_PECA[a.peca]} · {nomeSet(a.set)} · {NOME_STAT[a.mainStat]}
            {x.coringa && " · coringa: fora do set da build, só entra como a peça livre"}
          </span>
          <h3 id="t-veredito" className={`v-${veredito}`}>
            <Icone tamanho={26} />
            {TEXTO_VEREDITO[veredito]}
          </h3>
          <p>{frase}</p>
          <ul className="cartao-subs com-marca">
            {a.substats.map((s, i) => {
              const inativo = i === 3 && !a.quartoAtivo;
              return (
                <li
                  key={s.chave}
                  className={[inativo && "inativo", (perfil.pesos[s.chave] ?? 0) >= 0.5 && "util"].filter(Boolean).join(" ") || undefined}
                >
                  <span>{NOME_STAT[s.chave]}</span>
                  <span>
                    {formatarStat(s.chave, s.valor)}
                    {inativo && <small> (bloqueado)</small>}
                  </span>
                </li>
              );
            })}
          </ul>
          <NotaArtefato a={a} perfil={perfil} esperada={projecao.notaEsperada} />
        </div>
        <dl className="upar-numeros">
          <div>
            <dt>Nota agora</dt>
            <dd>{fmt(projecao.notaAtual)}</dd>
          </div>
          <div>
            <dt>Média no +{a.raridade === 5 ? 20 : 16}</dt>
            <dd>{fmt(projecao.notaEsperada)}</dd>
          </div>
          <div className="alvo">
            <dt>Peça a bater</dt>
            <dd>
              {fmt(notaRef)}
              <small>{refDescricao}</small>
            </dd>
          </div>
          <div>
            <dt>Chance de bater</dt>
            <dd>{pct(chance)}</dd>
          </div>
        </dl>
      </section>

      <section className="grafico" aria-labelledby="t-grafico">
        <div className="grafico-cabeca">
          <h3 id="t-grafico">Onde a nota pode parar no +{a.raridade === 5 ? 20 : 16}</h3>
          <span>chance de cada resultado, em rolls úteis</span>
        </div>
        <div
          className="grafico-area"
          style={colunas}
          role="img"
          aria-label={`Distribuição da nota final: ${faixas
            .map((f) => `de ${fmt(f.de)} a ${fmt(f.ate)}, ${pct(f.prob)}`)
            .join("; ")}. A peça a bater tem ${fmt(notaRef)}.`}
        >
          {faixas.map((f) => (
            <div className="grafico-col" key={f.de}>
              <span>{pct(f.prob)}</span>
              <i className={f.de >= notaRef ? "passa" : undefined} style={{ height: `${(f.prob / maiorProb) * 150}px` }} />
            </div>
          ))}
          <span className={`grafico-linha${posRef > 70 ? " virar" : ""}`} style={{ left: `${posRef}%` }} aria-hidden="true">
            <span>peça a bater · {fmt(notaRef)}</span>
          </span>
        </div>
        <div className="grafico-eixo" style={colunas} aria-hidden="true">
          {faixas.map((f) => (
            <span key={f.de}>
              {fmt(f.de)}–{fmt(f.ate)}
            </span>
          ))}
        </div>
        <p className="legenda">
          <span>
            <span className="quad" style={{ background: "var(--neutro)" }} />
            Não passa a peça a bater
          </span>
          <span>
            <span className="quad" style={{ background: "var(--ouro-texto)" }} />
            Passa
          </span>
        </p>
      </section>
    </div>
  );
}

function MelhorComInventario({
  perfil,
  artefatos,
  melhor: melhorComTudo,
  equipados,
  totalAtual,
  ctx,
  avaliacaoAtual,
  aoEquipar,
}: {
  perfil: PerfilBuild;
  artefatos: Artefato[];
  melhor: MelhorBuild;
  equipados: Partial<Record<Peca, Artefato>>;
  totalAtual: number;
  ctx?: ContextoBuild;
  avaliacaoAtual?: Avaliacao;
  aoEquipar: (m: MelhorBuild) => void;
}) {
  const [semConflito, setSemConflito] = useState(false);
  const [modo, setModo] = useState<"atual" | "projetado">("atual");
  const projetando = modo === "projetado";
  // Projeção: peças não upadas entram como se estivessem no nível máximo (valores médios esperados).
  const inventario = useMemo(() => (projetando ? inventarioProjetado(artefatos) : artefatos), [projetando, artefatos]);
  const melhorProjetado = useMemo(
    () => (projetando ? melhorBuild(perfil, inventario, ctx) : melhorComTudo),
    [projetando, perfil, inventario, ctx, melhorComTudo],
  );
  const baseModo = projetando ? melhorProjetado : melhorComTudo;
  // Versão que só usa peças livres ou já do personagem.
  const melhorSemConflito = useMemo(
    () => melhorBuild(perfil, inventario.filter((a) => !a.equipadoEm || a.equipadoEm === perfil.id), ctx),
    [perfil, inventario, ctx],
  );
  const temConflito = Object.values(baseModo.pecas).some((p) => p!.conflito);
  const melhor = semConflito ? melhorSemConflito : baseModo;
  const original = new Map(artefatos.map((a) => [a.id, a]));
  const pecasAUpar = PECAS.map((p) => melhor.pecas[p])
    .map((e) => (e ? original.get(e.artefato.id) : undefined))
    .filter((a): a is Artefato => Boolean(a && a.nivel < NIVEL_MAXIMO[a.raridade]));

  const projetada = (id: string) => {
    const o = original.get(id);
    return projetando && o !== undefined && o.nivel < NIVEL_MAXIMO[o.raridade];
  };

  const subAbas = (
    <div className="segmentado sub-abas" role="tablist" aria-label="Como contar as peças não upadas">
      <button role="tab" aria-selected={!projetando} className={!projetando ? "ativo" : ""} onClick={() => setModo("atual")}>
        Com os níveis atuais
      </button>
      <button role="tab" aria-selected={projetando} className={projetando ? "ativo" : ""} onClick={() => setModo("projetado")}>
        Projetando as não upadas
      </button>
    </div>
  );

  const escolhidas = PECAS.filter((p) => melhor.pecas[p]);
  if (escolhidas.length === 0)
    return (
      <section className="aba-conteudo">
        {subAbas}
        <p className="vazio">Nenhum artefato do inventário serve para {perfil.nome} (main stat ou peça).</p>
      </section>
    );
  const jaEquipada = escolhidas.every((p) => melhor.pecas[p]!.artefato.equipadoEm === perfil.id);
  const trocas = escolhidas.filter((p) => melhor.pecas[p]!.artefato.equipadoEm !== perfil.id).length;
  const ganho = melhor.nota - totalAtual;

  // Quanto cada personagem perde se a peça sair dele (nota da peça na build principal dele).
  const conflitos = escolhidas
    .map((p) => melhor.pecas[p]!)
    .filter((e) => e.conflito)
    .map((e) => {
      const outro = PERFIL_POR_ID[e.conflito!];
      const principal = outro ? buildsDe(outro)[0] : undefined;
      return {
        peca: NOME_PECA[e.artefato.peca].toLowerCase(),
        nome: outro?.nome ?? e.conflito!,
        perda: principal ? notaAtual(e.artefato, principal) : null,
      };
    });

  return (
    <section className="aba-conteudo">
      {subAbas}
      {projetando && (
        <p className="aviso-projecao">
          Peças abaixo do nível máximo entram como se já estivessem upadas, com os valores esperados em média (cada upgrade
          cai em 1 dos 4 substats com rolls de 85%). É uma estimativa: no jogo pode sair melhor ou pior.
          {pecasAUpar.length > 0
            ? ` Nesta build, falta upar: ${pecasAUpar.map((a) => `${NOME_PECA[a.peca]} (+${a.nivel} → +${NIVEL_MAXIMO[a.raridade]})`).join(", ")}.`
            : " Nesta build todas as peças já estão no nível máximo."}
        </p>
      )}
      {!ctx && (
        <p className="aviso-sem-arma">
          <IcoAviso />
          Sem arma cadastrada, a escolha é pela soma da nota de cada peça (não vê a proporção de Taxa e Dano Crítico nem
          os bônus de set). Cadastre a arma acima.
        </p>
      )}
      <div className="faixa-acao">
        <div>
          <p>
            {melhor.set ? (
              <>
                4 peças de <strong>{nomeSet(melhor.set)}</strong> + 1 peça livre. Total de{" "}
                <strong>{fmt(melhor.nota)}</strong> rolls úteis
              </>
            ) : (
              <>
                Nenhum set recomendado tem 4 peças utilizáveis no inventário, então esta build não tem bônus de set. Total
                de <strong>{fmt(melhor.nota)}</strong> rolls úteis
              </>
            )}
            {jaEquipada
              ? ", e é a build que já está equipada."
              : melhor.avaliacao && avaliacaoAtual
                ? `. ${(ganhoTexto(avaliacaoAtual, melhor.avaliacao) ?? "mesmo resultado da build atual").replace(/^./, (c) => c.toUpperCase())} com a build inteira. Troca ${trocas} ${trocas === 1 ? "peça" : "peças"}.`
                : `${ganho > 0.05 ? `, ${fmt(ganho)} a mais que a atual` : ""}. Troca ${trocas} ${trocas === 1 ? "peça" : "peças"}.`}
          </p>
          {conflitos.map((c) => (
            <p className="aviso-conflito" key={c.peca}>
              <IcoAviso />
              <span>
                A {c.peca} sai de {c.nome}.
                {c.perda !== null && ` A build de ${c.nome} perde ${fmt(c.perda)} rolls úteis.`}
              </span>
            </p>
          ))}
        </div>
        <div className="botoes">
          {(temConflito || semConflito) && (
            <button className="contorno" aria-pressed={semConflito} onClick={() => setSemConflito((v) => !v)}>
              Sem tirar de ninguém
            </button>
          )}
          {!jaEquipada && (
            <button className="primario" onClick={() => aoEquipar(melhor)}>
              Equipar esta build
            </button>
          )}
        </div>
      </div>

      <div className="slots">
        {PECAS.map((peca) => {
          const e = melhor.pecas[peca];
          const doPersonagem = e?.artefato.equipadoEm === perfil.id;
          const antes = equipados[peca];
          const delta = e && !doPersonagem ? e.nota - (antes ? notaAtual(antes, perfil) : 0) : 0;
          const sufixo = delta > 0.05 ? ` · +${fmt(delta)}` : "";
          return (
            <div className="slot" key={peca}>
              <h3>
                {NOME_PECA[peca]}
                {e && melhor.set && !e.doSet && <span className="etiqueta"> peça livre</span>}
              </h3>
              {e ? (
                <CartaoArtefato
                  a={e.artefato}
                  destaque={!doPersonagem}
                  perfil={perfil}
                  selo={projetada(e.artefato.id) ? "Projeção" : doPersonagem ? undefined : "Nova"}
                >
                  <NotaArtefato a={e.artefato} perfil={perfil} />
                  {projetada(e.artefato.id) && (
                    <p className="origem projecao">
                      Hoje +{original.get(e.artefato.id)!.nivel}: precisa upar até +{NIVEL_MAXIMO[e.artefato.raridade]}
                    </p>
                  )}
                  {doPersonagem ? (
                    <p className="origem">Já está equipada</p>
                  ) : e.conflito ? (
                    <p className="origem conflito">
                      <IcoAviso tamanho={14} />
                      Sai de {PERFIL_POR_ID[e.conflito]?.nome ?? e.conflito}
                      {sufixo}
                    </p>
                  ) : (
                    <p className="origem nova">Livre no inventário{sufixo}</p>
                  )}
                </CartaoArtefato>
              ) : (
                <p className="slot-vazio">Nenhuma peça com main stat aceita</p>
              )}
            </div>
          );
        })}
      </div>
      <LegendaSubs perfil={perfil} />

      {melhor.avaliacao && avaliacaoAtual && (
        <TotaisBuild
          perfil={perfil}
          hoje={avaliacaoAtual}
          nova={melhor.avaliacao}
          ctx={ctx!}
          pecas={escolhidas.map((p) => melhor.pecas[p]!.artefato)}
        />
      )}

      <table className="tabela-sets">
        <caption>Melhor resultado com cada set recomendado</caption>
        <thead>
          <tr>
            <th scope="col">Set</th>
            {melhor.avaliacao && (
              <th scope="col">{melhor.avaliacao.config.modelo === "dano" ? "Dano estimado" : "Build inteira"}</th>
            )}
            <th scope="col">Rolls úteis</th>
            <th scope="col">Faltam peças</th>
          </tr>
        </thead>
        <tbody>
          {melhor.porSet.map((s) => (
            <tr key={s.set} className={s.set === melhor.set ? "escolhido" : undefined}>
              <th scope="row">{nomeSet(s.set)}</th>
              {melhor.avaliacao && (
                <td>
                  {s.valor === undefined
                    ? "—"
                    : melhor.avaliacao.config.modelo === "dano"
                      ? `${Math.round((s.valor / melhor.avaliacao.valor) * 100)}%`
                      : fmt(s.valor)}
                </td>
              )}
              <td>{s.nota === null ? "—" : fmt(s.nota)}</td>
              <td>{s.faltam.length ? s.faltam.map((p) => NOME_PECA[p]).join(", ") : "nenhuma"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="sub">
        Só contam peças com main stat aceita para {perfil.nome}. Um set precisa de 4 peças para entrar na comparação.
      </p>
    </section>
  );
}

function BuildIdealView({ perfil, melhor }: { perfil: PerfilBuild; melhor: MelhorBuild }) {
  const ideal = buildIdeal(perfil);
  const suaTotal = melhor.nota;
  return (
    <section className="aba-conteudo">
      <p>
        {ideal.set ? (
          <>
            4 peças de <strong>{nomeSet(ideal.set)}</strong>. A 5ª pode ser de qualquer set; normalmente vale usá-la no cálice ou
            na tiara, onde é mais difícil achar a main stat certa.
          </>
        ) : (
          "Sem set recomendado para este perfil."
        )}
      </p>
      <div className="tabela-rolagem">
        <table className="tabela-ideal">
          <thead>
            <tr>
              <th scope="col">Peça</th>
              <th scope="col">Main stat</th>
              <th scope="col">Substats ideais</th>
              <th scope="col" title="Peça muito boa: rolls médios espalhados pelos 4 substats ideais">
                Alvo
              </th>
              <th scope="col" title="Todos os rolls no máximo e os 5 upgrades no melhor substat">
                Máximo
              </th>
              <th scope="col">Sua melhor</th>
            </tr>
          </thead>
          <tbody>
            {ideal.pecas.map((p) => {
              const sua = melhor.pecas[p.peca];
              const pct = sua ? Math.round((sua.nota / p.notaAlvo) * 100) : null;
              return (
                <tr key={p.peca}>
                  <th scope="row">{NOME_PECA[p.peca]}</th>
                  <td>{NOME_STAT[p.mainStat]}</td>
                  <td>{p.substats.map((c) => NOME_STAT[c]).join(", ")}</td>
                  <td>{fmt(p.notaAlvo)}</td>
                  <td>{fmt(p.notaMaxima)}</td>
                  <td className={pct === null ? "" : pct >= 100 ? "bom" : pct >= 70 ? "medio" : "fraco"}>
                    {sua ? `${fmt(sua.nota)} (${pct}%)` : "—"}
                    {sua && sua.artefato.mainStat !== p.mainStat && (
                      <small>main stat {NOME_STAT[sua.artefato.mainStat]}</small>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={3}>
                Total
              </th>
              <td>{fmt(ideal.notaAlvo)}</td>
              <td>{fmt(ideal.notaMaxima)}</td>
              <td>
                {fmt(suaTotal)} ({Math.round((suaTotal / ideal.notaAlvo) * 100)}%)
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="sub">
        Alvo é uma peça muito boa e realista (rolls médios espalhados pelos 4 substats ideais). Máximo é a peça perfeita,
        com todos os rolls no valor máximo e os 5 upgrades no melhor substat. "Sua melhor" vem da aba Melhor com meus
        artefatos.
      </p>
    </section>
  );
}

const pct1 = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;
const inteiro = (n: number) => Math.round(n).toLocaleString("pt-BR");

/** Stats somados da build: equipada x escolhida. A nota de cada peça continua nos cartões acima. */
function TotaisBuild({
  perfil,
  hoje,
  nova,
  ctx,
  pecas,
}: {
  perfil: PerfilBuild;
  hoje: Avaliacao;
  nova: Avaliacao;
  ctx: ContextoBuild;
  pecas: Artefato[];
}) {
  const c = nova.config;
  const t0 = hoje.totais;
  const t1 = nova.totais;
  const g = (t: Avaliacao["totais"], k: keyof Avaliacao["totais"]) => t[k] ?? 0;
  const nomeEscala = { atk: "ATQ", hp: "Vida", def: "DEF" }[c.escala];
  const linhas: { rotulo: string; a: number; b: number; f: (n: number) => string }[] = [
    { rotulo: `${nomeEscala} total`, a: hoje.final[c.escala], b: nova.final[c.escala], f: inteiro },
    { rotulo: "Taxa Crítica", a: g(t0, "critRate_"), b: g(t1, "critRate_"), f: pct1 },
    { rotulo: "Dano Crítico", a: g(t0, "critDMG_"), b: g(t1, "critDMG_"), f: pct1 },
    {
      rotulo: `Bônus de dano (${NOME_STAT[c.tipoDano].replace("%", "")} + geral)`,
      a: g(t0, c.tipoDano) + g(t0, "dano_"),
      b: g(t1, c.tipoDano) + g(t1, "dano_"),
      f: pct1,
    },
    { rotulo: "Proficiência Elemental", a: g(t0, "eleMas"), b: g(t1, "eleMas"), f: inteiro },
    { rotulo: `Recarga de Energia (meta ${c.metaRecarga}%)`, a: g(t0, "enerRech_"), b: g(t1, "enerRech_"), f: pct1 },
  ];
  // O que um roll a mais renderia nesta build: diz qual stat está faltando.
  const candidatos: ChaveSubstat[] = ["critRate_", "critDMG_", c.escala === "atk" ? "atk_" : c.escala === "hp" ? "hp_" : "def_"];
  if (c.pesoReacao > 0) candidatos.push("eleMas");
  if (g(t1, "enerRech_") < c.metaRecarga) candidatos.push("enerRech_");
  const ganhos = candidatos
    .map((k) => ({ k, g: ganhoDeUmRoll(nova, ctx.base, ctx.arma, k) }))
    .sort((a, b) => b.g - a.g);
  const semBonus = [...new Set(pecas.map((a) => a.set))].filter((s) => pecas.filter((a) => a.set === s).length >= 2 && !temBonusConhecido(s));
  const classe = (a: number, b: number) => (b > a + 0.05 ? "melhorou" : b < a - 0.05 ? "piorou" : undefined);

  return (
    <section className="totais" aria-labelledby="t-totais">
      <h3 id="t-totais">Build inteira: stats somados</h3>
      <div className="tabela-rolagem">
        <table>
          <thead>
            <tr>
              <th scope="col">Stat</th>
              <th scope="col">Equipada hoje</th>
              <th scope="col">Esta build</th>
            </tr>
          </thead>
          <tbody>
            {c.modelo === "dano" ? (
              <tr className="destaque">
                <th scope="row">Dano estimado</th>
                <td>100%</td>
                <td className={classe(hoje.valor, nova.valor)}>
                  {hoje.valor > 0 ? `${Math.round((nova.valor / hoje.valor) * 100)}%` : "—"}
                </td>
              </tr>
            ) : (
              <tr className="destaque">
                <th scope="row">Rolls úteis (Recarga até a meta)</th>
                <td>{fmt(hoje.valor)}</td>
                <td className={classe(hoje.valor, nova.valor)}>{fmt(nova.valor)}</td>
              </tr>
            )}
            {linhas.map((l) => (
              <tr key={l.rotulo}>
                <th scope="row">{l.rotulo}</th>
                <td>{l.f(l.a)}</td>
                <td className={classe(l.a, l.b)}>{l.f(l.b)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {c.modelo === "dano" && (
        <p className="proporcao">
          Nesta build, 1 roll a mais de{" "}
          {ganhos.map((x, i) => (
            <span key={x.k}>
              {i > 0 && (i === ganhos.length - 1 ? " ou " : ", ")}
              <strong>{NOME_STAT[x.k]}</strong> daria +{fmt(x.g)}%
            </span>
          ))}{" "}
          de dano. O primeiro é o que mais falta.
        </p>
      )}
      {nova.avisos.length > 0 && (
        <ul>
          {nova.avisos.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}
      <SetsDaBuild pecas={pecas} />
      <p className="sub">
        {c.modelo === "dano"
          ? `Dano estimado = ${nomeEscala} × (1 + Taxa × Dano Crítico) × bônus de dano${c.pesoReacao > 0 ? " × reações (Proficiência)" : ""}, com Taxa até 100% e penalidade se a Recarga ficar abaixo da meta.`
          : `${perfil.nome} é calculado como suporte: vale a soma dos rolls úteis, e Recarga acima de ${c.metaRecarga}% deixa de contar.`}{" "}
        Conta stats do personagem no nível 90, arma, a parte da passiva e das constelações que vira stat fixo, main
        stats, substats e bônus de set.
        {semBonus.length > 0 && ` O bônus de ${semBonus.map(nomeSet).join(", ")} ainda não está na conta.`}
      </p>
    </section>
  );
}

const TEXTOS_SETS = textosSets as Record<string, { 2?: string; 4?: string }>;

/** Efeitos dos sets ativos na build, em português, para conferir o que a conta considerou. */
function SetsDaBuild({ pecas }: { pecas: Artefato[] }) {
  const conta = new Map<string, number>();
  for (const a of pecas) conta.set(a.set, (conta.get(a.set) ?? 0) + 1);
  const ativos = [...conta].filter(([, n]) => n >= 2);
  if (ativos.length === 0) return null;
  return (
    <details className="sets-texto">
      <summary>Efeito dos sets desta build</summary>
      {ativos.map(([set, n]) => (
        <div key={set}>
          <strong>
            {nomeSet(set)} ({n >= 4 ? 4 : 2} peças)
          </strong>
          {TEXTOS_SETS[set]?.[2] && <p>2 peças: {TEXTOS_SETS[set][2]}</p>}
          {n >= 4 && TEXTOS_SETS[set]?.[4] && <p>4 peças: {TEXTOS_SETS[set][4]}</p>}
          {!TEXTOS_SETS[set] && <p className="sub">Texto ainda não disponível no genshin-db.</p>}
        </div>
      ))}
    </details>
  );
}
