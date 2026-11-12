import { useCallback, useEffect, useState } from "react";
import type { Artefato } from "./dominio/tipos";
import type { Arma, ConfigPersonagem } from "./dominio/build";
import { listarArmas, listarArmasPossuidas, listarArtefatos, listarBuildsSalvas, listarConfigs } from "./armazenamento/db";
import type { BuildSalva } from "./dominio/buildsSalvas";
import type { ArmaPossuida } from "./dominio/armasRecomendacao";
import { TelaPersonagens } from "./telas/TelaPersonagens";
import { TelaArtefatos } from "./telas/TelaArtefatos";
import { TelaBackup } from "./telas/TelaBackup";
import { TelaFarm } from "./telas/TelaFarm";
import { IcoMais } from "./componentes/Icones";
import { SeletorTema } from "./componentes/SeletorTema";

type Aba = "personagens" | "artefatos" | "farmar" | "backup";

const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "personagens", rotulo: "Personagens" },
  { id: "artefatos", rotulo: "Artefatos" },
  { id: "farmar", rotulo: "Farmar" },
  { id: "backup", rotulo: "Backup" },
];

export function App() {
  const [aba, setAba] = useState<Aba>("personagens");
  const [artefatos, setArtefatos] = useState<Artefato[]>([]);
  const [armas, setArmas] = useState<Arma[]>([]);
  const [configs, setConfigs] = useState<ConfigPersonagem[]>([]);
  const [armasPossuidas, setArmasPossuidas] = useState<ArmaPossuida[]>([]);
  const [buildsSalvas, setBuildsSalvas] = useState<BuildSalva[]>([]);
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(async () => {
    const [a, w, c, p, bs] = await Promise.all([
      listarArtefatos(),
      listarArmas(),
      listarConfigs(),
      listarArmasPossuidas(),
      listarBuildsSalvas(),
    ]);
    setBuildsSalvas(bs);
    setArmasPossuidas(p);
    setArtefatos(a);
    setArmas(w);
    setConfigs(c);
    setCarregando(false);
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return (
    <div className="app">
      <header className="topo">
        <h1 className="marca">Artefatos</h1>
        <nav className="abas" aria-label="Seções">
          {ABAS.map((a) => (
            <button
              key={a.id}
              className={aba === a.id ? "aba ativa" : "aba"}
              aria-current={aba === a.id ? "page" : undefined}
              onClick={() => setAba(a.id)}
            >
              {a.rotulo}
            </button>
          ))}
        </nav>
        <button className="atalho-print" onClick={() => setAba("artefatos")}>
          <IcoMais tamanho={18} />
          Cadastrar por print
        </button>
        <span className="contagem">{artefatos.length} no inventário</span>
        <SeletorTema />
      </header>

      <main className="conteudo">
        {carregando ? (
          <p className="vazio">Carregando inventário…</p>
        ) : aba === "personagens" ? (
          <TelaPersonagens artefatos={artefatos} armas={armas} configs={configs} armasPossuidas={armasPossuidas} buildsSalvas={buildsSalvas} aoMudar={recarregar} irParaArtefatos={() => setAba("artefatos")} />
        ) : aba === "farmar" ? (
          <TelaFarm artefatos={artefatos} configs={configs} irParaPersonagens={() => setAba("personagens")} aoMudar={recarregar} />
        ) : aba === "artefatos" ? (
          <TelaArtefatos artefatos={artefatos} aoMudar={recarregar} />
        ) : (
          <TelaBackup artefatos={artefatos} armas={armas} configs={configs} armasPossuidas={armasPossuidas} buildsSalvas={buildsSalvas} aoMudar={recarregar} />
        )}
      </main>
    </div>
  );
}
