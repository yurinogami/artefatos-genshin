import { useState, type FormEvent } from "react";
import type { Artefato, ChaveMainStat, ChaveSubstat, Peca, Raridade } from "../dominio/tipos";
import { MAIN_STATS_POR_PECA, NIVEL_MAXIMO, NOME_PECA, NOME_STAT, PECAS, SUBSTATS } from "../dominio/stats";
import { SETS } from "../dominio/sets";
import { validarArtefato } from "../dominio/pontuacao";
import { marcarPossui, novoId, salvarArtefato } from "../armazenamento/db";
import { PERFIS } from "../perfis";
import { acharPersonagem, type LeituraPrint } from "../dominio/leitorPrint";
import { ZonaPrint } from "./ZonaPrint";

interface LinhaSub {
  chave: ChaveSubstat | "";
  valor: string;
}

const LINHAS_VAZIAS: LinhaSub[] = [
  { chave: "", valor: "" },
  { chave: "", valor: "" },
  { chave: "", valor: "" },
  { chave: "", valor: "" },
];

export function FormArtefato({
  inicial,
  aoSalvar,
  aoCancelar,
  aoVarios,
}: {
  inicial?: Artefato;
  aoSalvar: () => void;
  aoCancelar?: () => void;
  aoVarios?: (arquivos: File[]) => void;
}) {
  const [set, setSet] = useState(inicial?.set ?? "");
  const [raridade, setRaridade] = useState<Raridade>(inicial?.raridade ?? 5);
  const [peca, setPeca] = useState<Peca>(inicial?.peca ?? "flower");
  const [mainStat, setMainStat] = useState<ChaveMainStat>(inicial?.mainStat ?? "hp");
  const [nivel, setNivel] = useState(String(inicial?.nivel ?? 0));
  const [linhas, setLinhas] = useState<LinhaSub[]>(
    inicial
      ? LINHAS_VAZIAS.map((v, i) =>
          inicial.substats[i] ? { chave: inicial.substats[i].chave, valor: String(inicial.substats[i].valor) } : v,
        )
      : LINHAS_VAZIAS,
  );
  const [quartoAtivo, setQuartoAtivo] = useState(inicial?.quartoAtivo ?? true);
  const [equipadoEm, setEquipadoEm] = useState(inicial?.equipadoEm ?? "");
  const [erros, setErros] = useState<string[]>([]);

  function aplicarLeitura(l: LeituraPrint) {
    if (l.set) setSet(l.set);
    if (l.raridade) setRaridade(l.raridade);
    if (l.peca) setPeca(l.peca);
    if (l.mainStat) setMainStat(l.mainStat);
    else if (l.peca) setMainStat(MAIN_STATS_POR_PECA[l.peca][0]);
    if (l.nivel !== undefined) setNivel(String(l.nivel));
    setLinhas(LINHAS_VAZIAS.map((v, i) => (l.substats[i] ? { chave: l.substats[i].chave, valor: String(l.substats[i].valor) } : v)));
    setQuartoAtivo(l.quartoAtivo);
    const perfil = l.equipadoPor ? acharPersonagem(l.equipadoPor, PERFIS) : undefined;
    setEquipadoEm(perfil?.id ?? "");
    // Os avisos aparecem na área do print.
    if (l.equipadoPor && !perfil) l.avisos.push(`Equipado por ${l.equipadoPor}, que ainda não tem perfil: ficou como "Ninguém".`);
    setErros([]);
  }

  function trocarPeca(p: Peca) {
    setPeca(p);
    if (!MAIN_STATS_POR_PECA[p].includes(mainStat)) setMainStat(MAIN_STATS_POR_PECA[p][0]);
  }

  function mudarLinha(i: number, campo: keyof LinhaSub, valor: string) {
    setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, [campo]: valor } : l)));
  }

  // No jogo o 4º substat só pode estar bloqueado antes do +4.
  const podeBloquear = linhas[3].chave !== "" && Number(nivel) < 4;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const substats = linhas
      .filter((l) => l.chave !== "")
      .map((l) => ({ chave: l.chave as ChaveSubstat, valor: Number(l.valor.replace(",", ".")) }));
    const dados = {
      set: set.trim(),
      raridade,
      peca,
      mainStat,
      nivel: Number(nivel),
      substats,
      quartoAtivo: podeBloquear ? quartoAtivo : true,
      equipadoEm: equipadoEm || null,
    };
    const problemas = validarArtefato(dados);
    setErros(problemas);
    if (problemas.length) return;
    await salvarArtefato({ ...dados, id: inicial?.id ?? novoId(), criadoEm: inicial?.criadoEm ?? Date.now() });
    // Peça equipada em alguém = você tem esse personagem.
    await marcarPossui([dados.equipadoEm]);
    if (!inicial) {
      setLinhas(LINHAS_VAZIAS);
      setNivel("0");
      setQuartoAtivo(true);
    }
    aoSalvar();
  }

  return (
    <form className="form" onSubmit={enviar}>
      {!inicial && <ZonaPrint aoLer={aplicarLeitura} aoVarios={aoVarios} />}
      <div className="form-grade">
        <label className="campo largo">
          <span>Set</span>
          <input list="sets" value={set} onChange={(e) => setSet(e.target.value)} placeholder="Ex.: Crimson Witch of Flames" />
          <datalist id="sets">
            {SETS.map((s) => (
              <option key={s.en} value={s.en} label={s.pt} />
            ))}
          </datalist>
        </label>

        <fieldset className="campo">
          <legend>Raridade</legend>
          <div className="segmentado">
            {([5, 4] as Raridade[]).map((r) => (
              <button type="button" key={r} className={raridade === r ? "ativo" : ""} onClick={() => setRaridade(r)}>
                {r}★
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="campo largo">
          <legend>Peça</legend>
          <div className="segmentado">
            {PECAS.map((p) => (
              <button type="button" key={p} className={peca === p ? "ativo" : ""} onClick={() => trocarPeca(p)}>
                {NOME_PECA[p]}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="campo">
          <span>Main stat</span>
          <select value={mainStat} onChange={(e) => setMainStat(e.target.value as ChaveMainStat)}>
            {MAIN_STATS_POR_PECA[peca].map((m) => (
              <option key={m} value={m}>
                {NOME_STAT[m]}
              </option>
            ))}
          </select>
        </label>

        <label className="campo">
          <span>Nível (0 a {NIVEL_MAXIMO[raridade]})</span>
          <input type="number" min={0} max={NIVEL_MAXIMO[raridade]} value={nivel} onChange={(e) => setNivel(e.target.value)} />
        </label>
      </div>

      <fieldset className="subs">
        <legend>Substats</legend>
        {linhas.map((l, i) => (
          <div className="sub-linha" key={i}>
            <select
              aria-label={`Substat ${i + 1}`}
              value={l.chave}
              onChange={(e) => mudarLinha(i, "chave", e.target.value)}
            >
              <option value="">{i === 3 ? "— sem 4º substat —" : "— escolha —"}</option>
              {SUBSTATS.map((s) => (
                <option key={s} value={s}>
                  {NOME_STAT[s]}
                </option>
              ))}
            </select>
            <input
              aria-label={`Valor do substat ${i + 1}`}
              inputMode="decimal"
              placeholder="valor"
              value={l.valor}
              onChange={(e) => mudarLinha(i, "valor", e.target.value)}
            />
          </div>
        ))}
        {podeBloquear && (
          <label className="checar">
            <input type="checkbox" checked={!quartoAtivo} onChange={(e) => setQuartoAtivo(!e.target.checked)} />
            O 4º substat ainda está bloqueado (aparece apagado no jogo)
          </label>
        )}
      </fieldset>

      <label className="campo">
        <span>Equipado em</span>
        <select value={equipadoEm} onChange={(e) => setEquipadoEm(e.target.value)}>
          <option value="">Ninguém</option>
          {PERFIS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      </label>

      {erros.length > 0 && (
        <ul className="erros" role="alert">
          {erros.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <div className="acoes">
        <button type="submit" className="primario">
          {inicial ? "Salvar alterações" : "Adicionar artefato"}
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
