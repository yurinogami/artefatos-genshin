import { useRef, useState } from "react";
import type { Artefato } from "../dominio/tipos";
import type { Arma, ConfigPersonagem } from "../dominio/build";
import type { ArmaPossuida } from "../dominio/armasRecomendacao";
import type { BuildSalva } from "../dominio/buildsSalvas";
import { validarArtefato } from "../dominio/pontuacao";
import { substituirArmas, substituirArmasPossuidas, substituirBuildsSalvas, substituirConfigs, substituirTudo } from "../armazenamento/db";

export function TelaBackup({
  artefatos,
  armas,
  configs,
  armasPossuidas,
  buildsSalvas,
  aoMudar,
}: {
  buildsSalvas: BuildSalva[];
  artefatos: Artefato[];
  armas: Arma[];
  configs: ConfigPersonagem[];
  armasPossuidas: ArmaPossuida[];
  aoMudar: () => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [mensagem, setMensagem] = useState("");

  function exportar() {
    const blob = new Blob([JSON.stringify({ versao: 5, artefatos, armas, personagens: configs, armasPossuidas, buildsSalvas }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `artefatos-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMensagem(`Backup exportado com ${artefatos.length} artefatos e ${armas.length} armas.`);
  }

  async function importar(arquivo: File) {
    try {
      const dados = JSON.parse(await arquivo.text());
      const lista: Artefato[] = Array.isArray(dados) ? dados : dados.artefatos;
      if (!Array.isArray(lista)) throw new Error("O arquivo não tem uma lista de artefatos.");
      const invalidos = lista.filter((a) => validarArtefato(a).length > 0);
      if (invalidos.length) throw new Error(`${invalidos.length} artefatos com dados inválidos.`);
      // Backups antigos (versão 1) não têm armas: as armas atuais ficam como estão.
      const novasArmas: Arma[] | undefined = Array.isArray(dados) ? undefined : dados.armas;
      const novasConfigs: ConfigPersonagem[] | undefined = Array.isArray(dados) ? undefined : dados.personagens;
      const novasPossuidas: ArmaPossuida[] | undefined = Array.isArray(dados) ? undefined : dados.armasPossuidas;
      const novasBuilds: BuildSalva[] | undefined = Array.isArray(dados) ? undefined : dados.buildsSalvas;
      if (!confirm(`Substituir os ${artefatos.length} artefatos atuais por ${lista.length} do arquivo?`)) return;
      await substituirTudo(lista);
      if (Array.isArray(novasArmas)) await substituirArmas(novasArmas);
      if (Array.isArray(novasConfigs)) await substituirConfigs(novasConfigs);
      if (Array.isArray(novasPossuidas)) await substituirArmasPossuidas(novasPossuidas);
      if (Array.isArray(novasBuilds)) await substituirBuildsSalvas(novasBuilds);
      setMensagem(`Backup importado: ${lista.length} artefatos${Array.isArray(novasArmas) ? ` e ${novasArmas.length} armas` : ""}.`);
      aoMudar();
    } catch (e) {
      setMensagem(`Não foi possível importar: ${(e as Error).message}`);
    }
  }

  return (
    <section className="painel estreito">
      <h2>Backup</h2>
      <p>
        Seus artefatos e armas ficam salvos só neste navegador. Exporte um arquivo de vez em quando para não perder nada ao
        limpar dados do navegador ou trocar de computador.
      </p>
      <div className="acoes">
        <button className="primario" onClick={exportar}>
          Exportar backup
        </button>
        <button onClick={() => entrada.current?.click()}>Importar backup</button>
        <input
          ref={entrada}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => e.target.files?.[0] && importar(e.target.files[0])}
        />
      </div>
      {mensagem && (
        <p className="mensagem" role="status">
          {mensagem}
        </p>
      )}
    </section>
  );
}
