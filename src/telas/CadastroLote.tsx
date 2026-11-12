import { useEffect, useMemo, useRef, useState } from "react";
import type { Artefato } from "../dominio/tipos";
import { NOME_PECA, NOME_STAT } from "../dominio/stats";
import { nomeSet } from "../dominio/sets";
import { validarArtefato } from "../dominio/pontuacao";
import { chaveArtefato, pecasParaDesequipar, rascunhoDaLeitura, type Rascunho } from "../dominio/lote";
import { marcarPossui, novoId, salvarArtefato } from "../armazenamento/db";
import { PERFIS, PERFIL_POR_ID } from "../perfis";
import { formatarStat } from "../componentes/Artefato";
import { IconeArtefato } from "../componentes/Imagens";
import { IcoAviso, IcoCheck } from "../componentes/Icones";
import { FormArtefato } from "./FormArtefato";

interface Item {
  id: string;
  nome: string;
  url: string;
  estado: "fila" | "lendo" | "pronto" | "erro" | "salvo";
  rascunho?: Rascunho;
  erro?: string;
  incluir: boolean;
  corrigindo: boolean;
}

type Situacao = "fila" | "lendo" | "erro" | "salvo" | "repetido" | "conferir" | "ok";

/** Lê vários prints em fila e mostra uma lista para revisar e salvar de uma vez. */
export function CadastroLote({
  arquivos,
  artefatos,
  aoMudar,
  aoFechar,
}: {
  arquivos: File[];
  artefatos: Artefato[];
  aoMudar: () => void;
  aoFechar: () => void;
}) {
  const [itens, setItens] = useState<Item[]>(() =>
    arquivos.map((f) => ({
      id: novoId(),
      nome: f.name,
      url: URL.createObjectURL(f),
      estado: "fila",
      incluir: false,
      corrigindo: false,
    })),
  );
  const [progressoAtual, setProgressoAtual] = useState(0);
  const [soConferir, setSoConferir] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const cancelado = useRef(false);

  const mudar = (id: string, f: (i: Item) => Partial<Item>) =>
    setItens((lista) => lista.map((i) => (i.id === id ? { ...i, ...f(i) } : i)));

  // Lê um print por vez (o leitor é um só e já fica carregado entre um e outro).
  useEffect(() => {
    cancelado.current = false;
    const ids = itens.map((i) => i.id);
    (async () => {
      const { lerPrint } = await import("../ocr/ocr");
      for (let n = 0; n < arquivos.length; n++) {
        if (cancelado.current) return;
        const id = ids[n];
        mudar(id, () => ({ estado: "lendo" }));
        setProgressoAtual(0);
        try {
          const { leitura } = await lerPrint(arquivos[n], (f) => setProgressoAtual(f));
          if (cancelado.current) return;
          const rascunho = rascunhoDaLeitura(leitura, PERFIS, novoId(), Date.now());
          mudar(id, () => ({ estado: "pronto", rascunho, incluir: rascunho.problemas.length === 0 }));
        } catch (e) {
          mudar(id, () => ({ estado: "erro", erro: (e as Error).message }));
        }
      }
    })();
    return () => {
      cancelado.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arquivos]);

  useEffect(() => () => itens.forEach((i) => URL.revokeObjectURL(i.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Repetidos: peça que já está no inventário, ou o mesmo print duas vezes no lote.
  const situacoes = useMemo(() => {
    const noInventario = new Set(artefatos.map(chaveArtefato));
    const vistos = new Set<string>();
    const m = new Map<string, { s: Situacao; repetidoDe?: string }>();
    for (const i of itens) {
      if (i.estado !== "pronto" || !i.rascunho) {
        m.set(i.id, { s: i.estado as Situacao });
        continue;
      }
      const chave = chaveArtefato(i.rascunho.artefato);
      if (noInventario.has(chave)) m.set(i.id, { s: "repetido", repetidoDe: "Já está no inventário" });
      else if (vistos.has(chave)) m.set(i.id, { s: "repetido", repetidoDe: "Print repetido neste lote" });
      else m.set(i.id, { s: i.rascunho.problemas.length ? "conferir" : "ok" });
      vistos.add(chave);
    }
    return m;
  }, [itens, artefatos]);

  const conta = (s: Situacao) => itens.filter((i) => situacoes.get(i.id)?.s === s).length;
  const lidos = itens.filter((i) => i.estado !== "fila" && i.estado !== "lendo").length;
  const lendo = lidos < itens.length;
  const paraSalvar = itens.filter((i) => {
    const s = situacoes.get(i.id)?.s;
    return i.incluir && (s === "ok" || s === "conferir") && i.rascunho && validarArtefato(i.rascunho.artefato).length === 0;
  });

  async function salvarSelecionados() {
    setSalvando(true);
    // Começa do inventário atual; cada peça salva entra na conta para a próxima.
    let inventario = [...artefatos];
    for (const i of paraSalvar) {
      const a = i.rascunho!.artefato;
      for (const velha of pecasParaDesequipar(a, inventario)) {
        const solta = { ...velha, equipadoEm: null };
        await salvarArtefato(solta);
        inventario = inventario.map((x) => (x.id === velha.id ? solta : x));
      }
      await salvarArtefato(a);
      inventario.push(a);
      mudar(i.id, () => ({ estado: "salvo", incluir: false }));
    }
    // "Equipado por X" nos prints = você tem X.
    await marcarPossui(paraSalvar.map((i) => i.rascunho!.artefato.equipadoEm));
    setSalvando(false);
    aoMudar();
  }

  function fechar() {
    const pendentes = conta("ok") + conta("conferir");
    if (pendentes > 0 && !confirm(`Fechar sem salvar ${pendentes} peça(s) lidas?`)) return;
    cancelado.current = true;
    aoFechar();
  }

  const visiveis = soConferir ? itens.filter((i) => ["conferir", "erro"].includes(situacoes.get(i.id)?.s ?? "")) : itens;

  return (
    <section className="painel lote" aria-labelledby="t-lote">
      <div className="lote-cabeca">
        <div>
          <h2 id="t-lote">Cadastro em lote</h2>
          <p className="sub" role="status">
            {lendo
              ? `Lendo ${Math.min(lidos + 1, itens.length)} de ${itens.length}… ${Math.round(progressoAtual * 100)}%`
              : `${itens.length} prints lidos.`}
          </p>
        </div>
        <button onClick={fechar}>Fechar</button>
      </div>

      <div className="lote-barra" aria-hidden="true">
        <span style={{ width: `${((lidos + (lendo ? progressoAtual : 0)) / itens.length) * 100}%` }} />
      </div>

      <div className="lote-resumo">
        <span className="chip-lote ok">
          <IcoCheck tamanho={14} /> {conta("ok")} ok
        </span>
        <span className="chip-lote conferir">
          <IcoAviso tamanho={14} /> {conta("conferir") + conta("erro")} para conferir
        </span>
        <span className="chip-lote">{conta("repetido")} repetidos</span>
        <span className="chip-lote">{conta("salvo")} salvos</span>
        <label className="checar">
          <input type="checkbox" checked={soConferir} onChange={(e) => setSoConferir(e.target.checked)} />
          Mostrar só os que precisam conferir
        </label>
      </div>

      <ul className="lote-lista">
        {visiveis.map((i) => {
          const sit = situacoes.get(i.id)!;
          const a = i.rascunho?.artefato;
          const bloqueado = a ? validarArtefato(a).length > 0 : true;
          return (
            <li key={i.id} className={`lote-item s-${sit.s}`}>
              <a href={i.url} target="_blank" rel="noreferrer" className="lote-print" title={`Abrir ${i.nome}`}>
                <img src={i.url} alt={`Print ${i.nome}`} loading="lazy" />
              </a>
              <div className="lote-info">
                {a ? (
                  <>
                    <p className="lote-titulo">
                      <span className={`candidata-icone r${a.raridade}`}>
                        <IconeArtefato set={a.set} peca={a.peca} />
                      </span>
                      <span>
                        <strong>
                          {NOME_PECA[a.peca]} · {NOME_STAT[a.mainStat]} · +{a.nivel}
                        </strong>
                        <small>{a.set ? nomeSet(a.set) : "set não reconhecido"}</small>
                      </span>
                    </p>
                    <p className="lote-subs">
                      {a.substats.map((s, k) => (
                        <span key={s.chave} className={k === 3 && !a.quartoAtivo ? "inativo" : undefined}>
                          {NOME_STAT[s.chave]} {formatarStat(s.chave, s.valor)}
                        </span>
                      ))}
                    </p>
                    <p className="lote-dono">
                      {a.equipadoEm
                        ? `Equipada em ${PERFIL_POR_ID[a.equipadoEm]?.nome ?? a.equipadoEm}`
                        : i.rascunho?.donoSemPerfil
                          ? `Equipada em ${i.rascunho.donoSemPerfil}, que ainda não tem perfil: vai sem dono`
                          : "Sem dono"}
                    </p>
                  </>
                ) : (
                  <p className="lote-titulo">
                    <span>
                      <strong>{i.nome}</strong>
                      <small>
                        {i.estado === "fila" ? "Na fila" : i.estado === "lendo" ? "Lendo…" : `Não consegui ler (${i.erro})`}
                      </small>
                    </span>
                  </p>
                )}
                {sit.s === "conferir" && (
                  <ul className="lote-problemas">
                    {i.rascunho!.problemas.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                )}
                {sit.repetidoDe && <p className="lote-repetido">{sit.repetidoDe}</p>}
              </div>
              <div className="lote-acoes">
                {sit.s === "salvo" ? (
                  <span className="lote-salvo">
                    <IcoCheck tamanho={16} /> Salvo
                  </span>
                ) : a ? (
                  <>
                    {!bloqueado && sit.s !== "repetido" && (
                      <label className="checar">
                        <input
                          type="checkbox"
                          checked={i.incluir}
                          onChange={(e) => mudar(i.id, () => ({ incluir: e.target.checked }))}
                        />
                        Salvar
                      </label>
                    )}
                    <button onClick={() => mudar(i.id, (x) => ({ corrigindo: !x.corrigindo }))} aria-expanded={i.corrigindo}>
                      {i.corrigindo ? "Fechar" : "Corrigir"}
                    </button>
                  </>
                ) : null}
              </div>
              {i.corrigindo && a && sit.s !== "salvo" && (
                <div className="lote-form">
                  <FormArtefato
                    inicial={a}
                    aoSalvar={() => {
                      mudar(i.id, () => ({ estado: "salvo", corrigindo: false, incluir: false }));
                      aoMudar();
                    }}
                    aoCancelar={() => mudar(i.id, () => ({ corrigindo: false }))}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="lote-rodape">
        <p className="sub">
          Peças "ok" já vêm marcadas. As que precisam conferir só vão se você marcar ou corrigir. Repetidas ficam de fora.
        </p>
        <button className="primario" disabled={paraSalvar.length === 0 || salvando} onClick={salvarSelecionados}>
          {salvando ? "Salvando…" : `Salvar ${paraSalvar.length} ${paraSalvar.length === 1 ? "peça" : "peças"}`}
        </button>
      </div>
    </section>
  );
}
