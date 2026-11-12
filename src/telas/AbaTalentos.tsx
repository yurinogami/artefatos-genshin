import { useState } from "react";
import type { PerfilBuild } from "../dominio/tipos";
import type { Avaliacao, ConfigPersonagem } from "../dominio/build";
import { niveisEfetivos } from "../dominio/extras";
import { calcularGolpes, type DadosTalento } from "../dominio/golpes";
import { salvarConfig } from "../armazenamento/db";
import { BASE_PERSONAGEM } from "../perfis/base";
import talentosJson from "../perfis/talentos.json";
import { ChipsBonus } from "../componentes/TextoBonus";
import { IcoAviso } from "../componentes/Icones";

const TALENTOS = talentosJson as Record<string, Partial<Record<"normal" | "skill" | "burst", DadosTalento>>>;
const QUAIS = [
  { id: "normal", rotulo: "Ataque Normal" },
  { id: "skill", rotulo: "Habilidade Elemental" },
  { id: "burst", rotulo: "Supremo" },
] as const;
const PADRAO: ConfigPersonagem["talentos"] = { normal: 6, skill: 9, burst: 9 };
const inteiro = (n: number) => Math.round(n).toLocaleString("pt-BR");

export function AbaTalentos({
  perfil,
  config,
  atual,
  melhor,
  aoMudar,
}: {
  perfil: PerfilBuild;
  config?: ConfigPersonagem;
  atual?: Avaliacao;
  melhor?: Avaliacao;
  aoMudar: () => void;
}) {
  const base = BASE_PERSONAGEM[perfil.id];
  const cfg = { constelacao: 0, ...config, personagem: perfil.id, talentos: config?.talentos ?? PADRAO } as Required<
    Pick<ConfigPersonagem, "personagem" | "constelacao" | "talentos">
  > &
    ConfigPersonagem;
  const [qual, setQual] = useState<"atual" | "melhor">("atual");
  const [aberta, setAberta] = useState<number | null>(null);
  if (!base) return <p className="vazio">Sem dados de talentos para {perfil.nome}.</p>;
  const niveis = niveisEfetivos(base, cfg);
  const av = qual === "melhor" && melhor ? melhor : atual;

  async function salvar(novo: Partial<ConfigPersonagem>) {
    await salvarConfig({ ...cfg, ...novo });
    aoMudar();
  }

  return (
    <section className="aba-conteudo talentos">
      {config?.talentos === undefined && config?.constelacao === undefined && (
        <p className="aviso-sem-arma">
          <IcoAviso />
          Ainda não salvo: valendo C0 e talentos 6/9/9. Mude abaixo para os seus.
        </p>
      )}

      <div className="painel-talentos">
        <fieldset className="campo">
          <legend>Constelação</legend>
          <div className="segmentado" role="radiogroup" aria-label="Constelação">
            {[0, 1, 2, 3, 4, 5, 6].map((c) => (
              <button
                key={c}
                role="radio"
                aria-checked={cfg.constelacao === c}
                className={cfg.constelacao === c ? "ativo" : ""}
                onClick={() => salvar({ constelacao: c })}
              >
                C{c}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="niveis">
          {QUAIS.map((q) => (
            <label key={q.id} className="campo">
              <span>{(TALENTOS[(perfil as { chave?: string }).chave ?? perfil.id] ?? TALENTOS[perfil.id])?.[q.id]?.nome ?? q.rotulo}</span>
              <span className="nivel-linha">
                <select
                  value={cfg.talentos[q.id]}
                  onChange={(e) => salvar({ talentos: { ...cfg.talentos, [q.id]: Number(e.target.value) } })}
                >
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      Nível {n}
                    </option>
                  ))}
                </select>
                {niveis[q.id] > cfg.talentos[q.id] && <span className="chip-bonus">+3 → {niveis[q.id]}</span>}
              </span>
            </label>
          ))}
        </div>
      </div>

      <ol className="constelacoes">
        {(base.constelacoes ?? []).map((c, i) => {
          const ativa = i < cfg.constelacao;
          return (
            <li key={c.nome} className={ativa ? "ativa" : undefined}>
              <button className="constelacao-cabeca" aria-expanded={aberta === i} onClick={() => setAberta(aberta === i ? null : i)}>
                <span className="constelacao-num">C{i + 1}</span>
                <strong>{c.nome}</strong>
                <span className="sub">{ativa ? "desbloqueada" : "bloqueada"}</span>
              </button>
              {aberta === i && <p className="constelacao-texto">{c.texto}</p>}
              {ativa &&
                (c.talento ? (
                  <p className="chips-bonus">
                    <span>Na conta:</span>
                    <span className="chip-bonus">+3 em {QUAIS.find((q) => q.id === c.talento)?.rotulo}</span>
                  </p>
                ) : (
                  <ChipsBonus bonus={c.bonus} vazio="nada vira stat fixo (efeito de habilidade, de time ou condicional complexo)" />
                ))}
            </li>
          );
        })}
      </ol>

      <div className="golpes-cabeca">
        <h3>Dano de cada golpe</h3>
        {melhor && atual && (
          <div className="segmentado" role="radiogroup" aria-label="Qual build">
            <button role="radio" aria-checked={qual === "atual"} className={qual === "atual" ? "ativo" : ""} onClick={() => setQual("atual")}>
              Build equipada
            </button>
            <button role="radio" aria-checked={qual === "melhor"} className={qual === "melhor" ? "ativo" : ""} onClick={() => setQual("melhor")}>
              Melhor build
            </button>
          </div>
        )}
      </div>
      {!av ? (
        <p className="aviso-sem-arma">
          <IcoAviso />
          Cadastre a arma de {perfil.nome} (acima) para calcular o dano dos golpes.
        </p>
      ) : (
        QUAIS.map((q) => {
          const t = (TALENTOS[(perfil as { chave?: string }).chave ?? perfil.id] ?? TALENTOS[perfil.id])?.[q.id];
          if (!t || t.golpes.length === 0) return null;
          const golpes = calcularGolpes(t, niveis[q.id], av);
          return (
            <div key={q.id} className="tabela-rolagem">
              <table className="tabela-ideal tabela-golpes">
                <caption>
                  {q.rotulo}: {t.nome} (nível {niveis[q.id]})
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Golpe</th>
                    <th scope="col">Multiplicador</th>
                    <th scope="col">Sem crítico</th>
                    <th scope="col">Crítico</th>
                    <th scope="col">Média</th>
                  </tr>
                </thead>
                <tbody>
                  {golpes.map((g) => (
                    <tr key={g.rotulo}>
                      <th scope="row">{g.rotulo}</th>
                      <td>{g.multiplicador}</td>
                      <td>{inteiro(g.semCritico)}</td>
                      <td>{inteiro(g.critico)}</td>
                      <td>
                        <strong>{inteiro(g.media)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })
      )}
      <p className="sub">
        Contra um inimigo nível 90 com 10% de resistência, sem reações e sem buffs de time. Usa o bônus de dano do elemento
        de {perfil.nome} em todos os golpes (ataques físicos de espada, espadão, lança e arco podem ser diferentes). Efeitos de
        habilidade que mudam o dano (ex.: bônus por acúmulo) não entram.
      </p>
    </section>
  );
}
