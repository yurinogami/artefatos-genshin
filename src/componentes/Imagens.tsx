// Ícones oficiais do jogo, carregados do CDN do Enka.Network (o app não guarda as imagens).
// Se a imagem não carregar (sem internet, personagem novo), mostra um substituto simples.
import { useState } from "react";
import icones from "../perfis/icones.json";
import { SETS } from "../dominio/sets";
import type { Peca } from "../dominio/tipos";
import { NOME_PECA } from "../dominio/stats";

const CDN = "https://enka.network/ui/";
const ICONES = icones as Record<string, { icone?: string; lateral?: string; raridade: number }>;
const ICONE_SET = new Map(SETS.map((s) => [s.en.toLowerCase(), s.pecas]));

function Img({ arquivo, alt, className, substituto }: { arquivo?: string; alt: string; className: string; substituto: string }) {
  const [falhou, setFalhou] = useState(false);
  if (!arquivo || falhou)
    return (
      <span className={`${className} img-substituta`} role="img" aria-label={alt}>
        {substituto}
      </span>
    );
  return <img className={className} src={`${CDN}${arquivo}.png`} alt={alt} loading="lazy" onError={() => setFalhou(true)} />;
}

export function IconePersonagem({ id, nome, className = "icone-personagem" }: { id: string; nome: string; className?: string }) {
  const r4 = ICONES[id]?.raridade === 4 ? " r4" : ""; // 4★: fundo roxo, como no jogo
  return <Img arquivo={ICONES[id]?.icone} alt={nome} className={className + r4} substituto={nome.slice(0, 1)} />;
}

export function IconeArtefato({ set, peca, className = "icone-artefato" }: { set: string; peca: Peca; className?: string }) {
  const arquivo = ICONE_SET.get(set.toLowerCase())?.[peca]?.icone;
  return <Img arquivo={arquivo} alt={`${NOME_PECA[peca]} de ${set}`} className={className} substituto={NOME_PECA[peca].slice(0, 1)} />;
}

export function IconeArma({ arquivo, nome, className = "icone-arma" }: { arquivo?: string; nome: string; className?: string }) {
  return <Img arquivo={arquivo} alt={nome} className={className} substituto={nome.slice(0, 1)} />;
}
