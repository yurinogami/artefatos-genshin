import { useLayoutEffect, useState } from "react";

// Temas do site. "padrao" é o Menu do Viajante (cores do :root); os outros trocam as variáveis de cor.
export const TEMAS = [
  { id: "padrao", nome: "Menu do Viajante" },
  { id: "noite", nome: "Noite Estrelada (escuro)" },
  { id: "abismo", nome: "Abismo (escuro)" },
  { id: "jade", nome: "Jade de Liyue" },
  { id: "fontaine", nome: "Fontaine" },
] as const;
type Tema = (typeof TEMAS)[number]["id"];

const CHAVE = "artefatos-genshin:tema";

function lerTema(): Tema {
  try {
    const t = localStorage.getItem(CHAVE);
    if (TEMAS.some((x) => x.id === t)) return t as Tema;
  } catch {
    // navegador sem armazenamento local: fica no padrão
  }
  return "padrao";
}

export function aplicarTema(t: Tema = lerTema()) {
  if (t === "padrao") delete document.documentElement.dataset.tema;
  else document.documentElement.dataset.tema = t;
}

export function SeletorTema() {
  const [tema, setTema] = useState<Tema>(lerTema);
  useLayoutEffect(() => {
    aplicarTema(tema);
    try {
      localStorage.setItem(CHAVE, tema);
    } catch {
      // sem armazenamento: o tema vale só até fechar a página
    }
  }, [tema]);
  return (
    <label className="seletor-tema">
      Tema
      <select value={tema} onChange={(e) => setTema(e.target.value as Tema)}>
        {TEMAS.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nome}
          </option>
        ))}
      </select>
    </label>
  );
}
