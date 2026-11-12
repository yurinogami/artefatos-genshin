import type { Bonus, ChaveBonus } from "../dominio/bonus-sets";
import { NOME_STAT } from "../dominio/stats";
import { formatarStat } from "./Artefato";

const NOMES: Partial<Record<ChaveBonus, string>> = {
  def: "DEF",
  dano_: "Bônus de dano%",
  atkBase: "ATQ base",
};

/** "Vida +20%", "Taxa Crít.% +8%"... para mostrar o que entrou na conta. */
export function textoBonus(b: Bonus): string[] {
  return Object.entries(b).map(([k, v]) => {
    const chave = k as ChaveBonus;
    const nome = NOMES[chave] ?? NOME_STAT[chave as keyof typeof NOME_STAT] ?? chave;
    return `${nome.replace("%", "")} +${k.endsWith("_") ? formatarStat("x_", v!) : Math.round(v!)}`;
  });
}

export function ChipsBonus({ bonus, vazio }: { bonus: Bonus; vazio: string }) {
  const itens = textoBonus(bonus);
  return (
    <p className="chips-bonus">
      <span>Na conta:</span>
      {itens.length ? itens.map((t) => <span key={t} className="chip-bonus">{t}</span>) : <span className="sub">{vazio}</span>}
    </p>
  );
}
