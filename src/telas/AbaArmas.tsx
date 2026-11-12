import { useMemo, useState } from "react";
import type { Artefato } from "../dominio/tipos";
import type { Arma, ConfigPersonagem } from "../dominio/build";
import type { Build } from "../perfis";
import { avaliarArmas, comoArma, listaPesquisa, type ArmaAvaliada, type ArmaPossuida } from "../dominio/armasRecomendacao";
import { configCalculo } from "../dominio/build";
import { NOME_STAT } from "../dominio/stats";
import { removerArmaPossuida, salvarArma, salvarArmaPossuida } from "../armazenamento/db";
import { BASE_PERSONAGEM } from "../perfis/base";
import { formatarStat } from "../componentes/Artefato";
import { IconeArma } from "../componentes/Imagens";
import { IcoCheck } from "../componentes/Icones";

const NOME_TIPO: Record<string, string> = { espada: "espadas", espadao: "espadões", lanca: "lanças", catalisador: "catalisadores", arco: "arcos" };

export function AbaArmas({
  perfil,
  pecas,
  armaAtual,
  config,
  possuidas,
  aoMudar,
}: {
  perfil: Build;
  pecas: Artefato[]; // peças fixas para comparar as armas (melhor build com seus artefatos)
  armaAtual?: Arma;
  config?: ConfigPersonagem;
  possuidas: ArmaPossuida[];
  aoMudar: () => void;
}) {
  const base = BASE_PERSONAGEM[perfil.id];
  const [soMinhas, setSoMinhas] = useState(false);
  const [verTodas, setVerTodas] = useState(false);
  const avaliadas = useMemo(
    () => (base ? avaliarArmas(perfil, base, config, pecas, possuidas) : []),
    [perfil, base, config, pecas, possuidas],
  );
  if (!base) return <p className="vazio">Sem dados de {perfil.nome} para comparar armas.</p>;

  const dano = configCalculo(perfil).modelo === "dano";
  const porEn = new Map(avaliadas.map((a) => [a.dado.en, a]));
  const lista = listaPesquisa(perfil.chave);
  const recomendadas = (lista?.armas ?? [])
    .map((r, i) => ({ r, i, a: porEn.get(r.en) }))
    .filter((x): x is { r: { en: string; nota?: string }; i: number; a: ArmaAvaliada } => Boolean(x.a))
    .filter((x) => !soMinhas || x.a.possui);
  const ranking = avaliadas.filter((a) => !soMinhas || a.possui);
  const visiveis = verTodas ? ranking : ranking.slice(0, 12);
  const estilo = perfil.rotulo ?? perfil.funcao;

  return (
    <section className="aba-conteudo armas-rec">
      <div className="armas-topo">
        <p>
          Melhores armas para <strong>{perfil.nome}</strong> como <strong>{estilo}</strong>. Troque o estilo nos botões do
          topo.
        </p>
        <label className="checar">
          <input type="checkbox" checked={soMinhas} onChange={(e) => setSoMinhas(e.target.checked)} />
          Só as armas que eu tenho ({possuidas.filter((p) => porEn.has(p.en)).length})
        </label>
      </div>

      <div className="tabela-rolagem">
        <table className="tabela-ideal tabela-armas">
          <caption>
            Recomendadas pela pesquisa
            {lista?.fonte ? ` · ${lista.fonte}` : lista?.tipo === "rascunho" ? " · lista inicial, ainda sem pesquisa recente" : ""}
          </caption>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Arma</th>
              <th scope="col">Observação</th>
              {dano && <th scope="col">Dano estimado</th>}
              <th scope="col">Tenho</th>
              <th scope="col">
                <span className="sr">Ação</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {recomendadas.length === 0 ? (
              <tr>
                <td colSpan={6} className="vazio">
                  {soMinhas ? "Você não marcou nenhuma das armas recomendadas." : "Sem lista para este estilo."}
                </td>
              </tr>
            ) : (
              recomendadas.map(({ r, i, a }) => (
                <LinhaArma key={r.en} posicao={i + 1} a={a} nota={r.nota} dano={dano} perfil={perfil} armaAtual={armaAtual} aoMudar={aoMudar} />
              ))
            )}
          </tbody>
        </table>
      </div>

      {dano ? (
        <div className="tabela-rolagem">
          <table className="tabela-ideal tabela-armas">
            <caption>
              Todas as {NOME_TIPO[base.arma ?? ""] ?? "armas"} pelo cálculo ({ranking.length})
            </caption>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Arma</th>
                <th scope="col">Stat</th>
                <th scope="col">Dano estimado</th>
                <th scope="col">Tenho</th>
                <th scope="col">
                  <span className="sr">Ação</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((a, i) => (
                <LinhaArma
                  key={a.dado.en}
                  posicao={i + 1}
                  a={a}
                  nota={a.dado.secundario ? `${NOME_STAT[a.dado.secundario.chave]} ${formatarStat(a.dado.secundario.chave, a.dado.secundario.valor)}` : "—"}
                  dano
                  perfil={perfil}
                  armaAtual={armaAtual}
                  aoMudar={aoMudar}
                />
              ))}
            </tbody>
          </table>
          {ranking.length > 12 && (
            <button className="link" onClick={() => setVerTodas((v) => !v)}>
              {verTodas ? "Mostrar só as 12 primeiras" : `Mostrar todas as ${ranking.length}`}
            </button>
          )}
        </div>
      ) : (
        <p className="sub">
          {perfil.nome} como {estilo} é calculado como suporte: o valor dela vem de buffs, escudo, cura e energia, que a conta
          de dano não mede. Para este estilo, siga a lista da pesquisa.
        </p>
      )}

      <p className="sub">
        Dano estimado: a mesma build de artefatos (a melhor com seus artefatos) com cada arma, contando ATQ base, stat
        secundário e a parte da passiva que vira stat fixo. Armas 5★ em R1 e 4★/3★ em R5, ou o refinamento que você marcou.
        Passivas condicionais (muitas exclusivas) ficam subestimadas; por isso a ordem da pesquisa vem primeiro.
      </p>
    </section>
  );
}

function LinhaArma({
  posicao,
  a,
  nota,
  dano,
  perfil,
  armaAtual,
  aoMudar,
}: {
  posicao: number;
  a: ArmaAvaliada;
  nota?: string;
  dano: boolean;
  perfil: Build;
  armaAtual?: Arma;
  aoMudar: () => void;
}) {
  const emUso = armaAtual?.en === a.dado.en || armaAtual?.nome === a.dado.pt;
  async function marcar(tem: boolean, ref = a.refinamento) {
    if (tem) await salvarArmaPossuida({ en: a.dado.en, refinamento: ref });
    else await removerArmaPossuida(a.dado.en);
    aoMudar();
  }
  async function usar() {
    await salvarArma(comoArma(a.dado, perfil.id, a.refinamento));
    aoMudar();
  }
  return (
    <tr className={a.possui ? "tenho" : undefined}>
      <td>{posicao}</td>
      <th scope="row">
        <span className="arma-celula">
          <span className={`arma-icone mini r${a.dado.raridade}`}>
            <IconeArma arquivo={a.dado.icone} nome={a.dado.pt} />
          </span>
          <span>
            {a.dado.pt}
            <small>
              {a.dado.raridade}★ · R{a.refinamento}
            </small>
          </span>
        </span>
      </th>
      <td className="arma-nota">{nota ?? ""}</td>
      {dano && (
        <td>
          <span className="arma-dano">
            <span className="farm-barra" aria-hidden="true">
              <span style={{ width: `${a.relativo * 100}%` }} />
            </span>
            {Math.round(a.relativo * 100)}%
          </span>
        </td>
      )}
      <td>
        <span className="arma-tenho">
          <input
            type="checkbox"
            aria-label={`Tenho ${a.dado.pt}`}
            checked={a.possui}
            onChange={(e) => marcar(e.target.checked)}
          />
          {a.possui && (
            <select aria-label={`Refinamento de ${a.dado.pt}`} value={a.refinamento} onChange={(e) => marcar(true, Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((r) => (
                <option key={r} value={r}>
                  R{r}
                </option>
              ))}
            </select>
          )}
        </span>
      </td>
      <td>
        {emUso ? (
          <span className="lote-salvo">
            <IcoCheck tamanho={14} /> Em uso
          </span>
        ) : (
          <button className="botao-usar" onClick={usar}>
            Usar
          </button>
        )}
      </td>
    </tr>
  );
}
