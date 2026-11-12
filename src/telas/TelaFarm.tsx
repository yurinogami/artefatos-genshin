import { useMemo, useState } from "react";
import type { Artefato } from "../dominio/tipos";
import type { ConfigPersonagem } from "../dominio/build";
import { rankingFarm, type RankingDominio, type RankingSet } from "../dominio/farm";
import { possuiPersonagem } from "../dominio/posse";
import { NOME_PECA, NOME_STAT } from "../dominio/stats";
import { nomeSet } from "../dominio/sets";
import { PERFIS, buildsDe, comSetEscolhido } from "../perfis";
import { SeletorSet } from "../componentes/SeletorSet";
import { IconeArtefato, IconePersonagem } from "../componentes/Imagens";
import { IcoAviso } from "../componentes/Icones";

const fmt = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const POSICAO = ["set principal", "2ª opção", "3ª opção", "4ª opção"];

export function TelaFarm({
  artefatos,
  configs,
  irParaPersonagens,
  aoMudar,
}: {
  artefatos: Artefato[];
  configs: ConfigPersonagem[];
  irParaPersonagens: () => void;
  aoMudar: () => void;
}) {
  // Build principal de cada personagem seu; sem a escolha aplicada (para o seletor mostrar todos os sets do perfil).
  const meusBase = useMemo(
    () => PERFIS.filter((p) => possuiPersonagem(p.id, configs, artefatos)).map((p) => buildsDe(p)[0]),
    [configs, artefatos],
  );
  // Com set escolhido, só ele conta no Farmar (como set principal).
  const meus = useMemo(() => meusBase.map((b) => comSetEscolhido(b, configs)), [meusBase, configs]);
  const escolhidos = new Set(meusBase.filter((b) => configs.find((c) => c.personagem === b.id)?.setEscolhido?.[b.chave]).map((b) => b.id));
  const ranking = useMemo(() => rankingFarm(meus, artefatos), [meus, artefatos]);
  const [aberto, setAberto] = useState<string | null>(null);

  if (meus.length === 0)
    return (
      <section className="painel estreito">
        <h2>Onde farmar</h2>
        <p className="aviso-sem-arma">
          <IcoAviso />
          Marque os personagens que você tem para ver a recomendação.
        </p>
        <button className="primario" onClick={irParaPersonagens}>
          Ir para Personagens
        </button>
      </section>
    );

  const maximo = ranking[0]?.pontos ?? 1;
  const [primeiro, ...resto] = ranking;

  return (
    <div className="tela-farm">
      <section className="farm-cabeca">
        <h2>Onde farmar</h2>
        <p className="sub">
          Considera seus {meus.length} personagens ({meus.map((p) => p.nome).join(", ")}). Para cada um, compara suas melhores
          peças de cada set recomendado com a build ideal; o set principal do perfil pesa mais, e um set secundário quase não
          conta se a build do personagem já está boa.
        </p>
      </section>

      <details className="farm-escolhas">
        <summary>
          <strong>Set escolhido por personagem</strong>{" "}
          <span className="sub">
            ({meusBase.filter((b) => configs.find((c) => c.personagem === b.id)?.setEscolhido?.[b.chave]).length} de {meusBase.length}{" "}
            escolhidos; sem escolha, o Farmar compara os sets do perfil)
          </span>
        </summary>
        <ul>
          {meusBase.map((b) => (
            <li key={b.chave}>
              <IconePersonagem id={b.id} nome={b.nome} className="icone-personagem moldura mini" />
              <div>
                <strong>{b.nome}</strong>
                <SeletorSet
                  build={b}
                  escolhido={configs.find((c) => c.personagem === b.id)?.setEscolhido?.[b.chave]}
                  aoMudar={aoMudar}
                  rotulo=""
                />
              </div>
            </li>
          ))}
        </ul>
      </details>

      {!primeiro ? (
        <p className="vazio">Seus personagens já estão perto da build ideal em todos os sets recomendados.</p>
      ) : (
        <>
          <article className="farm-destaque" aria-labelledby="farm-1">
            <div className="farm-destaque-topo">
              <span className="farm-posicao">1º</span>
              <div>
                <h3 id="farm-1">{primeiro.dominio?.pt ?? "Fora de domínio"}</h3>
                <span className="sub">{primeiro.dominio ? primeiro.dominio.regiao : "Chefes e Altar de Transmutação"}</span>
              </div>
              <span className="farm-pontos">
                <strong>{fmt(primeiro.pontos)}</strong> rolls úteis a ganhar
              </span>
            </div>
            <div className="farm-sets">
              {primeiro.sets.map((s) => (
                <BlocoSet key={s.set} s={s} escolhidos={escolhidos} />
              ))}
            </div>
          </article>

          {resto.length > 0 && (
            <ol className="farm-lista" start={2}>
              {resto.map((d, i) => {
                const chave = d.dominio?.en ?? "fora";
                return (
                  <li key={chave}>
                    <LinhaDominio
                      escolhidos={escolhidos}
                      d={d}
                      posicao={i + 2}
                      maximo={maximo}
                      aberto={aberto === chave}
                      alternar={() => setAberto(aberto === chave ? null : chave)}
                    />
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}
      <p className="sub">
        "Rolls úteis a ganhar" é uma estimativa: soma, por personagem, quanto suas peças desse set ficam abaixo da peça alvo
        da aba Build ideal, ponderado pela posição do set no perfil. Só conta a build principal de cada personagem.
      </p>
    </div>
  );
}

function LinhaDominio({
  escolhidos,
  d,
  posicao,
  maximo,
  aberto,
  alternar,
}: {
  escolhidos: Set<string>;
  d: RankingDominio;
  posicao: number;
  maximo: number;
  aberto: boolean;
  alternar: () => void;
}) {
  const nomes = [...new Set(d.sets.flatMap((s) => s.ganhos.map((g) => g.nome)))];
  return (
    <div className={aberto ? "farm-linha aberta" : "farm-linha"}>
      <button className="farm-linha-cabeca" aria-expanded={aberto} onClick={alternar}>
        <span className="farm-posicao pequena">{posicao}º</span>
        <span className="farm-linha-nome">
          <strong>{d.dominio?.pt ?? "Fora de domínio"}</strong>
          <small>{d.sets.map((s) => nomeSet(s.set)).join(" + ")}</small>
        </span>
        <span className="farm-linha-quem">{nomes.join(", ")}</span>
        <span className="farm-barra" aria-hidden="true">
          <span style={{ width: `${(d.pontos / maximo) * 100}%` }} />
        </span>
        <span className="farm-linha-pontos">{fmt(d.pontos)}</span>
      </button>
      {aberto && (
        <div className="farm-sets">
          {d.sets.map((s) => (
            <BlocoSet key={s.set} s={s} escolhidos={escolhidos} />
          ))}
        </div>
      )}
    </div>
  );
}

function BlocoSet({ s, escolhidos }: { s: RankingSet; escolhidos: Set<string> }) {
  return (
    <section className="farm-set">
      <h4>
        <span className="candidata-icone r5">
          <IconeArtefato set={s.set} peca="flower" />
        </span>
        <span>
          {nomeSet(s.set)}
          <small>{s.pontos > 0.05 ? `${fmt(s.pontos)} rolls úteis a ganhar` : "nenhum dos seus personagens ganha muito"}</small>
        </span>
      </h4>
      {s.ganhos.length > 0 && (
        <ul>
          {s.ganhos.map((g) => (
            <li key={g.personagem}>
              <IconePersonagem id={g.personagem} nome={g.nome} className="icone-personagem moldura mini" />
              <div>
                <p>
                  <strong>{g.nome}</strong>{" "}
                  <span className="sub">
                    · {escolhidos.has(g.personagem) ? "set escolhido" : (POSICAO[g.posicao] ?? `${g.posicao + 1}ª opção`)}
                  </span>{" "}
                  <span className="chip-bonus">+{fmt(g.contribuicao)}</span>
                </p>
                {g.procurar.length > 0 && (
                  <p className="farm-procurar">
                    Procurar:{" "}
                    {g.procurar
                      .slice(0, 3)
                      .map((f) => `${NOME_PECA[f.peca]}${f.peca === "flower" || f.peca === "plume" ? "" : ` de ${NOME_STAT[f.mainStat]}`}${f.tem ? "" : " (não tem)"}`)
                      .join(", ")}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
