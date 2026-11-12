import { useEffect, useRef, useState } from "react";
import type { LeituraPrint } from "../dominio/leitorPrint";

type Estado =
  | { tipo: "parado" }
  | { tipo: "lendo"; fracao: number; etapa: string }
  | { tipo: "pronto"; avisos: string[]; texto: string }
  | { tipo: "erro"; mensagem: string };

/** Área para colar (Ctrl+V), arrastar ou escolher um print; lê o artefato e repassa o resultado. */
export function ZonaPrint({
  aoLer,
  aoVarios,
}: {
  aoLer: (l: LeituraPrint) => void;
  aoVarios?: (arquivos: File[]) => void; // mais de uma imagem: vai para o cadastro em lote
}) {
  const [estado, setEstado] = useState<Estado>({ tipo: "parado" });
  const [previa, setPrevia] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [verTexto, setVerTexto] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  const aoLerRef = useRef(aoLer);
  aoLerRef.current = aoLer;

  async function processar(arquivo: Blob) {
    setPrevia((antiga) => {
      if (antiga) URL.revokeObjectURL(antiga);
      return URL.createObjectURL(arquivo);
    });
    setEstado({ tipo: "lendo", fracao: 0, etapa: "Preparando o leitor" });
    try {
      const { lerPrint } = await import("../ocr/ocr");
      const { texto, leitura } = await lerPrint(arquivo, (fracao, etapa) =>
        setEstado({ tipo: "lendo", fracao, etapa }),
      );
      aoLerRef.current(leitura);
      setEstado({ tipo: "pronto", avisos: leitura.avisos, texto });
    } catch (e) {
      setEstado({
        tipo: "erro",
        mensagem: `Não consegui ler o print (${(e as Error).message}). Na primeira vez o leitor precisa de internet para baixar os dados de idioma.`,
      });
    }
  }

  const processarRef = useRef(processar);
  processarRef.current = processar;

  useEffect(() => {
    function aoColar(e: ClipboardEvent) {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/"));
      const arquivo = item?.getAsFile();
      if (!arquivo) return;
      e.preventDefault();
      void processarRef.current(arquivo);
    }
    window.addEventListener("paste", aoColar);
    return () => window.removeEventListener("paste", aoColar);
  }, []);

  return (
    <div
      className={`zona-print${arrastando ? " arrastando" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setArrastando(true);
      }}
      onDragLeave={() => setArrastando(false)}
      onDrop={(e) => {
        e.preventDefault();
        setArrastando(false);
        const imagens = [...e.dataTransfer.files].filter((f) => f.type.startsWith("image/"));
        if (imagens.length > 1 && aoVarios) aoVarios(imagens);
        else if (imagens[0]) void processar(imagens[0]);
      }}
    >
      {previa && <img className="zona-previa" src={previa} alt="Print colado" />}
      <div className="zona-texto">
        {estado.tipo === "lendo" ? (
          <p role="status">
            {estado.etapa}… {Math.round(estado.fracao * 100)}%
          </p>
        ) : estado.tipo === "pronto" ? (
          <>
            <p role="status" className={estado.avisos.length ? "" : "ok"}>
              {estado.avisos.length
                ? "Preenchi o que consegui. Confira estes pontos:"
                : "Print lido. Confira os valores e salve."}
            </p>
            {estado.avisos.length > 0 && (
              <ul className="avisos-print">
                {estado.avisos.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            )}
            <button type="button" className="link" onClick={() => setVerTexto((v) => !v)}>
              {verTexto ? "Esconder" : "Ver"} texto lido
            </button>
            {verTexto && <pre className="texto-lido">{estado.texto}</pre>}
          </>
        ) : estado.tipo === "erro" ? (
          <p role="alert" className="erro-print">
            {estado.mensagem}
          </p>
        ) : (
          <p>
            Cole um print do artefato com <kbd>Ctrl</kbd>+<kbd>V</kbd> ou arraste a imagem aqui.
            {aoVarios && " Para cadastrar vários de uma vez, arraste ou escolha várias imagens."}
          </p>
        )}
        <button type="button" onClick={() => entrada.current?.click()} disabled={estado.tipo === "lendo"}>
          {aoVarios ? "Escolher imagens" : "Escolher imagem"}
        </button>
        <input
          ref={entrada}
          type="file"
          accept="image/*"
          multiple={Boolean(aoVarios)}
          hidden
          onChange={(e) => {
            const imagens = [...(e.target.files ?? [])];
            if (imagens.length > 1 && aoVarios) aoVarios(imagens);
            else if (imagens[0]) void processar(imagens[0]);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
