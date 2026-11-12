import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./estilos.css";
import { aplicarTema } from "./componentes/SeletorTema";

// Aplica o tema salvo antes de desenhar, para não piscar o tema padrão.
aplicarTema();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
