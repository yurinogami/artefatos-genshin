import type { Build } from "../perfis";
import { SETS, nomeSet } from "../dominio/sets";
import { salvarSetEscolhido } from "../armazenamento/db";

/** Escolhe o set que o personagem vai usar (vale para o site todo); "automático" compara os sets do perfil. */
export function SeletorSet({
  build,
  escolhido,
  aoMudar,
  rotulo = "Set escolhido",
}: {
  build: Build; // a build original (lista completa de sets do perfil)
  escolhido?: string;
  aoMudar: () => void;
  rotulo?: string;
}) {
  const outros = SETS.filter((s) => !build.sets.includes(s.en)).sort((a, b) => a.pt.localeCompare(b.pt, "pt-BR"));
  return (
    <label className="seletor-set">
      <span>{rotulo}</span>
      <select
        value={escolhido ?? ""}
        onChange={async (e) => {
          await salvarSetEscolhido(build.id, build.chave, e.target.value || null);
          aoMudar();
        }}
      >
        <option value="">Automático (compara os sets do perfil)</option>
        <optgroup label="Recomendados no perfil">
          {build.sets.map((s, i) => (
            <option key={s} value={s}>
              {i + 1}º {nomeSet(s)}
            </option>
          ))}
        </optgroup>
        <optgroup label="Outros sets">
          {outros.map((s) => (
            <option key={s.en} value={s.en}>
              {s.pt}
            </option>
          ))}
        </optgroup>
      </select>
    </label>
  );
}
