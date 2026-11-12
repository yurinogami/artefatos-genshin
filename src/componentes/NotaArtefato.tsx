import { useState } from "react";
import type { Artefato, PerfilBuild } from "../dominio/tipos";
import { detalharNota, notaAtual } from "../dominio/pontuacao";
import { NOME_STAT } from "../dominio/stats";
import { BarraRolls, formatarStat } from "./Artefato";

const fmt = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Barra de rolls úteis com a opção de abrir de onde vem cada roll. */
export function NotaArtefato({
  a,
  perfil,
  esperada,
}: {
  a: Artefato;
  perfil: PerfilBuild;
  esperada?: number;
}) {
  const [aberto, setAberto] = useState(false);
  const nota = notaAtual(a, perfil);
  const linhas = detalharNota(a, perfil);
  const rollsTotais = linhas.reduce((s, l) => s + (l.ativo ? Math.min(...l.rolls, 1e9) : 0), 0);
  const rollsUteis = linhas.reduce((s, l) => s + (l.ativo && l.peso >= 0.5 ? Math.min(...l.rolls, 1e9) : 0), 0);
  const conhecido = linhas.every((l) => l.rolls.length > 0);

  return (
    <div className="nota">
      <BarraRolls nota={nota} esperada={esperada} />
      <button type="button" className="link nota-botao" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>
        {aberto ? "Esconder rolls" : "Ver rolls"}
      </button>
      {aberto && (
        <div className="detalhe-rolls">
          <table>
            <thead>
              <tr>
                <th scope="col">Substat</th>
                <th scope="col" title="Quantos rolls caíram nesse substat (1 = só o inicial)">
                  Rolls
                </th>
                <th scope="col" title={`Peso do substat para ${perfil.nome}`}>
                  Peso
                </th>
                <th scope="col" title="Rolls úteis que esse substat soma na nota">
                  Soma
                </th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.chave} className={!l.ativo ? "bloqueado" : l.peso === 0 ? "inutil" : undefined}>
                  <th scope="row" title={formatarStat(l.chave, l.valor)}>
                    {NOME_STAT[l.chave]}
                  </th>
                  <td>{l.rolls.length === 0 ? "?" : l.rolls.length === 1 ? l.rolls[0] : `${l.rolls[0]}–${l.rolls.at(-1)}`}</td>
                  <td>{l.peso === 0 ? "—" : fmt(l.peso)}</td>
                  <td>
                    {!l.ativo ? (
                      <small>bloqueado</small>
                    ) : (
                      <>
                        {fmt(l.contribuicao)}
                        <span className="mini" style={{ width: `${Math.min(100, (l.contribuicao / 6) * 100)}%` }} />
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {conhecido && (
            <p className="detalhe-resumo">
              {rollsUteis} de {rollsTotais} rolls caíram em stats que {perfil.nome} usa bem (peso 0,5 ou mais).
            </p>
          )}
        </div>
      )}
    </div>
  );
}
