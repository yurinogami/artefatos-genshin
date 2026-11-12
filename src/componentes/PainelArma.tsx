import { useState, type FormEvent } from "react";
import type { ChaveMainStat, PerfilBuild } from "../dominio/tipos";
import type { Arma } from "../dominio/build";
import { NOME_STAT } from "../dominio/stats";
import { ARMAS_DADOS, bonusDaPassiva, dadoDaArma } from "../dominio/extras";
import { salvarArma } from "../armazenamento/db";
import { BASE_PERSONAGEM } from "../perfis/base";
import { formatarStat } from "./Artefato";
import { IcoAviso } from "./Icones";
import { IconeArma } from "./Imagens";
import { ChipsBonus } from "./TextoBonus";

const NOME_TIPO: Record<string, string> = {
  espada: "Espada",
  espadao: "Espadão",
  lanca: "Lança",
  catalisador: "Catalisador",
  arco: "Arco",
};

const SECUNDARIOS: ChaveMainStat[] = ["critRate_", "critDMG_", "atk_", "hp_", "def_", "eleMas", "enerRech_", "physical_dmg_"];

/** Mostra a arma do personagem; sem arma, abre o formulário (a arma entra no cálculo da build inteira). */
export function PainelArma({ perfil, arma, aoMudar }: { perfil: PerfilBuild; arma?: Arma; aoMudar: () => void }) {
  const [editando, setEditando] = useState(false);
  const [verPassiva, setVerPassiva] = useState(false);
  if (arma && !editando) {
    const dado = dadoDaArma(arma);
    const r = arma.refinamento ?? 1;
    return (
      <div className="arma">
        <span className={`arma-icone r${dado?.raridade ?? 4}`}>
          <IconeArma arquivo={dado?.icone} nome={arma.nome} />
        </span>
        <div className="arma-texto">
          <span className="arma-rotulo">Arma</span>
          <strong>
            {arma.nome} <span className="arma-ref">R{r}</span>
          </strong>
          <span className="sub">
            ATQ base {arma.atk}
            {arma.secundario && ` · ${NOME_STAT[arma.secundario.chave]} ${formatarStat(arma.secundario.chave, arma.secundario.valor)}`}
          </span>
          {dado?.passiva && (
            <>
              <button className="link arma-passiva-botao" aria-expanded={verPassiva} onClick={() => setVerPassiva((v) => !v)}>
                Passiva: {dado.passiva.nome}
              </button>
              {verPassiva && <p className="arma-passiva">{dado.passiva.textos[r - 1] ?? dado.passiva.textos[0]}</p>}
              <ChipsBonus bonus={bonusDaPassiva(arma)} vazio="nada da passiva vira stat fixo (efeito de time, de um ataque só ou baseado em outro stat)" />
            </>
          )}
        </div>
        <button className="link arma-trocar" onClick={() => setEditando(true)}>
          Trocar arma
        </button>
      </div>
    );
  }
  return (
    <div className={arma ? "arma aberta" : "arma aberta falta"}>
      {!arma && (
        <p className="arma-falta">
          <IcoAviso />
          Cadastre a arma de {perfil.nome} para a melhor build ser calculada pela build inteira (Taxa e Dano Crítico
          juntos, bônus de set, passiva, Recarga).
        </p>
      )}
      <FormArma
        perfil={perfil}
        inicial={arma}
        aoSalvar={() => {
          setEditando(false);
          aoMudar();
        }}
        aoCancelar={arma ? () => setEditando(false) : undefined}
      />
    </div>
  );
}

function FormArma({
  perfil,
  inicial,
  aoSalvar,
  aoCancelar,
}: {
  perfil: PerfilBuild;
  inicial?: Arma;
  aoSalvar: () => void;
  aoCancelar?: () => void;
}) {
  const tipo = BASE_PERSONAGEM[perfil.id]?.arma;
  const opcoes = ARMAS_DADOS.filter((a) => !tipo || a.tipo === tipo);
  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [en, setEn] = useState(inicial?.en);
  const [refinamento, setRefinamento] = useState(inicial?.refinamento ?? 1);
  const [atk, setAtk] = useState(String(inicial?.atk ?? ""));
  const [chave, setChave] = useState<ChaveMainStat | "">(inicial?.secundario?.chave ?? "");
  const [valor, setValor] = useState(inicial?.secundario ? String(inicial.secundario.valor).replace(".", ",") : "");
  const [erro, setErro] = useState("");
  const dado = dadoDaArma({ en, nome });

  function escolher(texto: string) {
    setNome(texto);
    const achada = opcoes.find((a) => a.pt.toLowerCase() === texto.toLowerCase() || a.en.toLowerCase() === texto.toLowerCase());
    setEn(achada?.en);
    if (!achada) return;
    setAtk(String(achada.atk));
    setChave(achada.secundario?.chave ?? "");
    setValor(achada.secundario ? String(achada.secundario.valor).replace(".", ",") : "");
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const atkN = Number(atk.replace(",", "."));
    const valorN = Number(valor.replace(",", "."));
    if (!nome.trim()) return setErro("Informe o nome da arma.");
    if (!(atkN > 0)) return setErro("Informe o ATQ base da arma.");
    if (chave && !(valorN > 0)) return setErro("Informe o valor do stat secundário.");
    await salvarArma({
      personagem: perfil.id,
      nome: nome.trim(),
      en,
      refinamento,
      atk: atkN,
      secundario: chave ? { chave, valor: valorN } : null,
    });
    aoSalvar();
  }

  const listaId = `armas-${perfil.id}`;
  return (
    <form className="form-arma" onSubmit={enviar}>
      <div className="campo largo form-arma-nome">
        <span className={`arma-icone pequeno r${dado?.raridade ?? 4}`}>
          <IconeArma arquivo={dado?.icone} nome={nome || "?"} />
        </span>
        <label className="campo">
          <span>Arma{tipo ? ` (${NOME_TIPO[tipo]})` : ""}</span>
          <input list={listaId} value={nome} onChange={(e) => escolher(e.target.value)} placeholder="Comece a digitar o nome" />
          <datalist id={listaId}>
            {opcoes.map((a) => (
              <option key={a.en} value={a.pt} label={`${a.raridade}★`} />
            ))}
          </datalist>
        </label>
      </div>
      <label className="campo">
        <span>Refinamento</span>
        <select value={refinamento} onChange={(e) => setRefinamento(Number(e.target.value))}>
          {[1, 2, 3, 4, 5].map((r) => (
            <option key={r} value={r}>
              R{r}
            </option>
          ))}
        </select>
      </label>
      <label className="campo">
        <span>ATQ base</span>
        <input inputMode="numeric" value={atk} onChange={(e) => setAtk(e.target.value)} />
      </label>
      <label className="campo">
        <span>Stat secundário</span>
        <select value={chave} onChange={(e) => setChave(e.target.value as ChaveMainStat | "")}>
          <option value="">Nenhum</option>
          {SECUNDARIOS.map((c) => (
            <option key={c} value={c}>
              {NOME_STAT[c]}
            </option>
          ))}
        </select>
      </label>
      <label className="campo">
        <span>Valor</span>
        <input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} disabled={!chave} />
      </label>
      {dado?.passiva && (
        <div className="campo largo arma-passiva-previa">
          <strong>{dado.passiva.nome}</strong>
          <p>{dado.passiva.textos[refinamento - 1] ?? dado.passiva.textos[0]}</p>
        </div>
      )}
      <p className="sub arma-dica">
        Ao escolher da lista, os valores vêm no nível 90. Se a sua estiver em outro nível, ajuste. Da passiva, só entram
        na conta as partes que viram stat fixo para o próprio personagem.
      </p>
      {erro && (
        <p className="erros" role="alert">
          {erro}
        </p>
      )}
      <div className="acoes">
        <button type="submit" className="primario">
          Salvar arma
        </button>
        {aoCancelar && (
          <button type="button" onClick={aoCancelar}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
