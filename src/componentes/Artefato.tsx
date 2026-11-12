import type { ReactNode } from "react";
import type { Artefato, PerfilBuild } from "../dominio/tipos";
import { NOME_PECA, NOME_STAT, ehPercentual } from "../dominio/stats";
import { PERFIL_POR_ID } from "../perfis";
import { IconeArtefato } from "./Imagens";
import { nomeSet } from "../dominio/sets";

export function formatarStat(chave: string, valor: number): string {
  // Vírgula decimal, como no jogo em português.
  return ehPercentual(chave)
    ? `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
    : Math.round(valor).toString();
}

/** Barra de rolls úteis: cheia = 9 rolls úteis (peça perfeita). A parte clara é a nota esperada no nível máximo. */
export function BarraRolls({ nota, esperada, max = 9 }: { nota: number; esperada?: number; max?: number }) {
  const pct = (n: number) => `${Math.max(0, Math.min(100, (n / max) * 100))}%`;
  const fmt = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const titulo =
    esperada === undefined
      ? `${fmt(nota)} rolls úteis de ${max}`
      : `${fmt(nota)} rolls úteis agora, ${fmt(esperada)} esperados no nível máximo`;
  return (
    <div className="barra" role="img" aria-label={titulo} title={titulo}>
      <span className="barra-trilho">
        {esperada !== undefined && <span className="barra-prevista" style={{ width: pct(esperada) }} />}
        <span className="barra-cheia" style={{ width: pct(nota) }} />
      </span>
      <strong className="barra-num">{fmt(nota)}</strong>
    </div>
  );
}

export function CartaoArtefato({
  a,
  children,
  destaque,
  perfil,
  selo,
}: {
  a: Artefato;
  children?: ReactNode;
  destaque?: boolean;
  perfil?: PerfilBuild; // quando informado, marca os substats que o personagem usa bem
  selo?: string; // etiqueta no topo do cartão, ex.: "Nova"
}) {
  const dono = a.equipadoEm ? PERFIL_POR_ID[a.equipadoEm]?.nome : null;
  return (
    <article className={`cartao r${a.raridade}${destaque ? " destaque" : ""}`}>
      <header className="cartao-topo">
        <IconeArtefato set={a.set} peca={a.peca} />
        <span className="cartao-nivel">+{a.nivel}</span>
        {selo && <span className="cartao-selo">{selo}</span>}
      </header>
      <p className="cartao-set">
        {NOME_PECA[a.peca]}, {nomeSet(a.set)}
      </p>
      <p className="cartao-main">{NOME_STAT[a.mainStat]}</p>
      <ul className={perfil ? "cartao-subs com-marca" : "cartao-subs"}>
        {a.substats.map((s, i) => {
          const inativo = i === 3 && !a.quartoAtivo;
          return (
            <li
              key={s.chave}
              className={[inativo && "inativo", perfil && (perfil.pesos[s.chave] ?? 0) >= 0.5 && "util"].filter(Boolean).join(" ") || undefined}
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
      {dono && <p className="cartao-dono">Com {dono}</p>}
      {children}
    </article>
  );
}
