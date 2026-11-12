import { useMemo, useState } from "react";
import type { Artefato, Peca } from "../dominio/tipos";
import { NOME_PECA, PECAS } from "../dominio/stats";
import { mainStatAceita, notaAtual } from "../dominio/pontuacao";
import { removerArtefato } from "../armazenamento/db";
import { BUILDS, BUILD_POR_CHAVE, nomeBuild } from "../perfis";
import { nomeSet } from "../dominio/sets";
import { CartaoArtefato } from "../componentes/Artefato";
import { NotaArtefato } from "../componentes/NotaArtefato";
import { FormArtefato } from "./FormArtefato";
import { CadastroLote } from "./CadastroLote";

export function TelaArtefatos({ artefatos, aoMudar }: { artefatos: Artefato[]; aoMudar: () => void }) {
  const [filtroPeca, setFiltroPeca] = useState<Peca | "">("");
  const [filtroSet, setFiltroSet] = useState("");
  // Só os sets que existem no inventário, em ordem alfabética do nome em português, com a quantidade.
  const setsNoInventario = useMemo(() => {
    const conta = new Map<string, number>();
    for (const a of artefatos) conta.set(a.set, (conta.get(a.set) ?? 0) + 1);
    return [...conta].sort((a, b) => nomeSet(a[0]).localeCompare(nomeSet(b[0]), "pt-BR"));
  }, [artefatos]);
  const [perfilId, setPerfilId] = useState(BUILDS[0]?.chave ?? "");
  const [editando, setEditando] = useState<Artefato | null>(null);
  const [lote, setLote] = useState<File[] | null>(null);
  const perfil = BUILD_POR_CHAVE[perfilId];

  const visiveis = useMemo(() => {
    const lista = artefatos.filter((a) => (!filtroPeca || a.peca === filtroPeca) && (!filtroSet || a.set === filtroSet));
    if (!perfil) return lista;
    return lista
      .map((a) => ({ a, nota: mainStatAceita(a, perfil) ? notaAtual(a, perfil) : -1 }))
      .sort((x, y) => y.nota - x.nota)
      .map((x) => x.a);
  }, [artefatos, filtroPeca, filtroSet, perfil]);

  async function excluir(a: Artefato) {
    if (!confirm(`Excluir ${NOME_PECA[a.peca]} de ${a.set}? Não dá para desfazer.`)) return;
    await removerArtefato(a.id);
    aoMudar();
  }

  return (
    <div className="tela-artefatos">
      {lote && (
        <CadastroLote
          arquivos={lote}
          artefatos={artefatos}
          aoMudar={aoMudar}
          aoFechar={() => setLote(null)}
        />
      )}
      <section className="painel">
        <h2>{editando ? "Editar artefato" : "Novo artefato"}</h2>
        <FormArtefato
          key={editando?.id ?? "novo"}
          inicial={editando ?? undefined}
          aoSalvar={() => {
            setEditando(null);
            aoMudar();
          }}
          aoCancelar={editando ? () => setEditando(null) : undefined}
          aoVarios={lote ? undefined : setLote}
        />
      </section>

      <section className="painel inventario">
        <div className="filtros">
          <h2>Inventário</h2>
          <label>
            Peça{" "}
            <select value={filtroPeca} onChange={(e) => setFiltroPeca(e.target.value as Peca | "")}>
              <option value="">Todas</option>
              {PECAS.map((p) => (
                <option key={p} value={p}>
                  {NOME_PECA[p]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Set{" "}
            <select value={filtroSet} onChange={(e) => setFiltroSet(e.target.value)}>
              <option value="">Todos</option>
              {setsNoInventario.map(([set, n]) => (
                <option key={set} value={set}>
                  {nomeSet(set)} ({n})
                </option>
              ))}
            </select>
          </label>
          <label>
            Nota para{" "}
            <select value={perfilId} onChange={(e) => setPerfilId(e.target.value)}>
              {BUILDS.map((b) => (
                <option key={b.chave} value={b.chave}>
                  {nomeBuild(b)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {visiveis.length === 0 ? (
          <p className="vazio">
            {artefatos.length === 0
              ? "Nenhum artefato aqui ainda. Cadastre o primeiro no formulário ao lado."
              : "Nenhum artefato com esses filtros."}
          </p>
        ) : (
          <div className="grade-cartoes">
            {visiveis.map((a) => (
              <CartaoArtefato key={a.id} a={a} perfil={perfil}>
                {perfil &&
                  (mainStatAceita(a, perfil) ? (
                    <NotaArtefato a={a} perfil={perfil} />
                  ) : (
                    <p className="aviso">Main stat não serve para {perfil.nome}</p>
                  ))}
                <div className="cartao-acoes">
                  <button onClick={() => setEditando(a)}>Editar</button>
                  <button className="perigo" onClick={() => excluir(a)}>
                    Excluir
                  </button>
                </div>
              </CartaoArtefato>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
