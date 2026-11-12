import { useState, type FormEvent } from "react";
import type { Artefato } from "../dominio/tipos";
import { PECAS, NOME_PECA } from "../dominio/stats";
import { nomeSet } from "../dominio/sets";
import { notaAtual } from "../dominio/pontuacao";
import { avaliarBuild, type Avaliacao } from "../dominio/build";
import type { ContextoBuild } from "../dominio/otimizador";
import { compartilhadas, estaEquipada, nomeSugerido, pecasDaBuild, resumoSets, type BuildSalva } from "../dominio/buildsSalvas";
import { marcarPossui, novoId, removerBuildSalva, salvarArtefato, salvarBuildSalva } from "../armazenamento/db";
import { BUILD_POR_CHAVE, PERFIL_POR_ID, nomeBuild, type Build } from "../perfis";
import { IconeArtefato } from "../componentes/Imagens";
import { IcoAviso, IcoCheck } from "../componentes/Icones";

const fmt = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pct = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;

export function AbaBuildsSalvas({
  perfil,
  artefatos,
  buildsSalvas,
  ctx,
  aoMudar,
}: {
  perfil: Build; // estilo aberto agora (DPS, Sub-DPS...)
  artefatos: Artefato[];
  buildsSalvas: BuildSalva[];
  ctx?: ContextoBuild;
  aoMudar: () => void;
}) {
  const minhas = buildsSalvas.filter((b) => b.personagem === perfil.id);
  const equipadas = artefatos.filter((a) => a.equipadoEm === perfil.id);
  const [nome, setNome] = useState("");
  const sugestao = nomeSugerido(equipadas, nomeSet, minhas.length);
  const avaliar = (pecas: Artefato[], estilo: Build): Avaliacao | undefined =>
    ctx ? avaliarBuild(pecas, estilo, ctx.base, ctx.arma, ctx.extras) : undefined;
  const hoje = avaliar(equipadas, perfil);

  async function salvarEquipada(e: FormEvent) {
    e.preventDefault();
    if (equipadas.length === 0) return;
    await salvarBuildSalva({
      id: novoId(),
      personagem: perfil.id,
      chaveBuild: perfil.chave,
      nome: nome.trim() || sugestao,
      pecas: Object.fromEntries(equipadas.map((a) => [a.peca, a.id])),
      criadaEm: Date.now(),
    });
    setNome("");
    aoMudar();
  }

  return (
    <section className="aba-conteudo builds-salvas">
      <form className="salvar-build" onSubmit={salvarEquipada}>
        <div>
          <h3>Salvar a build equipada</h3>
          <p className="sub">
            {equipadas.length === 0
              ? `${perfil.nome} não tem nenhuma peça equipada agora.`
              : `Guarda as ${equipadas.length} peças que ${perfil.nome} está usando (${resumoSets(equipadas, nomeSet)}), no estilo ${perfil.rotulo ?? perfil.funcao}.`}
          </p>
        </div>
        <label className="campo">
          <span>Nome</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder={sugestao} disabled={equipadas.length === 0} />
        </label>
        <button type="submit" className="primario" disabled={equipadas.length === 0}>
          Salvar build
        </button>
      </form>

      {minhas.length === 0 ? (
        <p className="vazio">
          Nenhuma build salva para {perfil.nome}. Monte e equipe uma build (por exemplo, com o set escolhido em "Melhor com meus
          artefatos") e salve aqui; depois monte outra e salve de novo.
        </p>
      ) : (
        <ul className="lista-builds">
          {minhas.map((b) => (
            <li key={b.id}>
              <CartaoBuild
                b={b}
                artefatos={artefatos}
                todas={buildsSalvas}
                equipadas={equipadas}
                hoje={hoje}
                avaliar={avaliar}
                aoMudar={aoMudar}
              />
            </li>
          ))}
        </ul>
      )}
      <p className="sub">
        Uma peça pode estar em mais de uma build. Ao equipar, o app avisa se alguma peça vai sair de outro personagem.
        {ctx ? "" : " Cadastre a arma do personagem para ver o dano estimado de cada build."}
      </p>
    </section>
  );
}

function CartaoBuild({
  b,
  artefatos,
  todas,
  equipadas,
  hoje,
  avaliar,
  aoMudar,
}: {
  b: BuildSalva;
  artefatos: Artefato[];
  todas: BuildSalva[];
  equipadas: Artefato[];
  hoje?: Avaliacao;
  avaliar: (pecas: Artefato[], estilo: Build) => Avaliacao | undefined;
  aoMudar: () => void;
}) {
  const [renomeando, setRenomeando] = useState(false);
  const [novoNome, setNovoNome] = useState(b.nome);
  const estilo = BUILD_POR_CHAVE[b.chaveBuild] ?? BUILD_POR_CHAVE[b.personagem];
  const { pecas, apagadas } = pecasDaBuild(b, artefatos);
  const lista = PECAS.map((p) => pecas[p]).filter((a): a is Artefato => Boolean(a));
  const rolls = estilo ? lista.reduce((s, a) => s + notaAtual(a, estilo), 0) : 0;
  const av = estilo ? avaliar(lista, estilo) : undefined;
  const equipada = estaEquipada(b, artefatos);
  const foraDele = lista.filter((a) => a.equipadoEm && a.equipadoEm !== b.personagem);
  const repetidas = compartilhadas(b, todas);

  async function equipar() {
    if (
      foraDele.length &&
      !confirm(
        `Isso tira ${foraDele.length} peça(s) de outros personagens: ${foraDele
          .map((a) => `${NOME_PECA[a.peca]} de ${PERFIL_POR_ID[a.equipadoEm!]?.nome ?? a.equipadoEm}`)
          .join(", ")}. Continuar?`,
      )
    )
      return;
    for (const p of PECAS) {
      const nova = pecas[p];
      if (!nova) continue; // slot sem peça salva: fica como está
      const atual = equipadas.find((a) => a.peca === p);
      if (atual?.id === nova.id) continue;
      if (atual) await salvarArtefato({ ...atual, equipadoEm: null });
      await salvarArtefato({ ...nova, equipadoEm: b.personagem });
    }
    await marcarPossui([b.personagem]);
    aoMudar();
  }

  async function atualizar() {
    if (!confirm(`Trocar as peças de "${b.nome}" pelas que ${PERFIL_POR_ID[b.personagem]?.nome ?? ""} está usando agora?`)) return;
    await salvarBuildSalva({ ...b, pecas: Object.fromEntries(equipadas.map((a) => [a.peca, a.id])) });
    aoMudar();
  }

  async function excluir() {
    if (!confirm(`Excluir a build "${b.nome}"? As peças continuam no inventário.`)) return;
    await removerBuildSalva(b.id);
    aoMudar();
  }

  async function renomear(e: FormEvent) {
    e.preventDefault();
    if (novoNome.trim()) await salvarBuildSalva({ ...b, nome: novoNome.trim() });
    setRenomeando(false);
    aoMudar();
  }

  return (
    <article className={equipada ? "cartao-build equipada" : "cartao-build"}>
      <header>
        {renomeando ? (
          <form className="renomear" onSubmit={renomear}>
            <input aria-label="Novo nome" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} autoFocus />
            <button type="submit">Salvar</button>
          </form>
        ) : (
          <h3>{b.nome}</h3>
        )}
        <span className="sub">
          {estilo ? nomeBuild(estilo) : b.chaveBuild} · {resumoSets(lista, nomeSet)}
        </span>
        {equipada && (
          <span className="lote-salvo">
            <IcoCheck tamanho={14} /> Equipada agora
          </span>
        )}
      </header>

      <ul className="build-pecas">
        {PECAS.map((p) => {
          const a = pecas[p];
          return (
            <li key={p} title={a ? `${NOME_PECA[p]} · ${nomeSet(a.set)} · +${a.nivel}` : `${NOME_PECA[p]}: vazio`}>
              {a ? (
                <span className={`candidata-icone r${a.raridade}`}>
                  <IconeArtefato set={a.set} peca={p} />
                </span>
              ) : (
                <span className="candidata-icone vazio">{apagadas.includes(p) ? "!" : "–"}</span>
              )}
              <small>{a ? `+${a.nivel}` : apagadas.includes(p) ? "apagada" : "vazio"}</small>
            </li>
          );
        })}
      </ul>

      <dl className="build-numeros">
        <div>
          <dt>Rolls úteis</dt>
          <dd>{fmt(rolls)}</dd>
        </div>
        {av && hoje && av.config.modelo === "dano" && (
          <div>
            <dt>Dano vs. equipada</dt>
            <dd>{hoje.valor > 0 ? `${Math.round((av.valor / hoje.valor) * 100)}%` : "—"}</dd>
          </div>
        )}
        {av && (
          <>
            <div>
              <dt>Taxa / Dano Crít.</dt>
              <dd>
                {pct(av.totais.critRate_ ?? 0)} / {pct(av.totais.critDMG_ ?? 0)}
              </dd>
            </div>
            <div>
              <dt>Recarga</dt>
              <dd>{pct(av.totais.enerRech_ ?? 0)}</dd>
            </div>
          </>
        )}
      </dl>

      {(foraDele.length > 0 || repetidas.length > 0 || apagadas.length > 0) && (
        <ul className="build-avisos">
          {foraDele.map((a) => (
            <li key={a.id}>
              <IcoAviso tamanho={14} /> {NOME_PECA[a.peca]} está com {PERFIL_POR_ID[a.equipadoEm!]?.nome ?? a.equipadoEm} agora
            </li>
          ))}
          {repetidas.map((r) => (
            <li key={r.build.id}>
              {r.pecas.map((p) => NOME_PECA[p]).join(", ")} também {r.pecas.length > 1 ? "estão" : "está"} na build "{r.build.nome}"
              {r.build.personagem !== b.personagem && ` de ${PERFIL_POR_ID[r.build.personagem]?.nome ?? r.build.personagem}`}
            </li>
          ))}
          {apagadas.length > 0 && <li>{apagadas.map((p) => NOME_PECA[p]).join(", ")}: peça apagada do inventário</li>}
        </ul>
      )}

      <div className="acoes">
        {!equipada && (
          <button className="primario" onClick={equipar} disabled={lista.length === 0}>
            Equipar esta build
          </button>
        )}
        <button onClick={atualizar} disabled={equipadas.length === 0}>
          Atualizar com a equipada
        </button>
        <button onClick={() => setRenomeando((v) => !v)}>Renomear</button>
        <button className="perigo" onClick={excluir}>
          Excluir
        </button>
      </div>
    </article>
  );
}
