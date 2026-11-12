// Leitura de print com OCR (tesseract.js), rodando inteiramente no navegador.
// Na primeira vez baixa os dados de idioma (português e inglês, alguns MB) e guarda em cache.
import { createWorker, type Worker } from "tesseract.js";
import { combinarLeituras, lerTextoDoPrint, type LeituraPrint } from "../dominio/leitorPrint";

let trabalhador: Promise<Worker> | null = null;
let aoProgresso: ((fracao: number, etapa: string) => void) | null = null;

function obterTrabalhador(): Promise<Worker> {
  trabalhador ??= createWorker(["por", "eng"], 1, {
    logger: (m: { status: string; progress: number }) => {
      const etapa = m.status.includes("recogn") ? "Lendo o texto" : "Preparando o leitor";
      aoProgresso?.(m.progress, etapa);
    },
  }).catch((e) => {
    trabalhador = null;
    throw e;
  });
  return trabalhador;
}

/**
 * Recorta o painel de detalhe quando o print é da tela inteira e reduz/amplia para ~1000 px de largura.
 * Depois isola o texto: no painel do jogo o texto é branco (ou verde, no nome do set) sobre fundo roxo
 * com brilhos, então "texto" = pixels quase brancos ou bem verdes. Sai texto preto em fundo branco.
 * Gera duas versões com limiares diferentes (normal e mais rígido), lidas e combinadas depois.
 */
export async function prepararImagem(imagem: Blob): Promise<HTMLCanvasElement[]> {
  const bmp = await createImageBitmap(imagem);
  let { width: w, height: h } = bmp;
  let x = 0;
  let y = 0;
  // Tela inteira (16:9 ou 16:10): o painel de detalhe fica no terço direito.
  if (w / h > 1.5) {
    x = Math.round(w * 0.66);
    y = Math.round(h * 0.08);
    w = Math.round(bmp.width * 0.33);
    h = Math.round(bmp.height * 0.86);
  }
  const escala = Math.min(3, Math.max(1, 1000 / w));
  const largura = Math.round(w * escala);
  const altura = Math.round(h * escala);
  const base = document.createElement("canvas");
  base.width = largura;
  base.height = altura;
  const ctx = base.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, x, y, w, h, 0, 0, largura, altura);
  bmp.close();
  const original = ctx.getImageData(0, 0, largura, altura).data;

  return LIMIARES.map(([inicio, faixa]) => {
    const canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = altura;
    const c = canvas.getContext("2d")!;
    const saida = c.createImageData(largura, altura);
    const p = saida.data;
    for (let i = 0; i < original.length; i += 4) {
      const r = original[i];
      const g = original[i + 1];
      const b = original[i + 2];
      const branco = Math.min(r, g, b);
      const verde = g - Math.max(r, b) > 50 ? 255 : 0;
      const texto = Math.max(branco, verde);
      const v = Math.min(1, Math.max(0, (texto - inicio) / faixa));
      p[i] = p[i + 1] = p[i + 2] = Math.round(255 * (1 - v));
      p[i + 3] = 255;
    }
    c.putImageData(saida, 0, 0);
    return canvas;
  });
}

// [início, largura] da rampa de "brancura" que vira texto. Ajustados com 46 prints reais (PT-BR).
const LIMIARES: [number, number][] = [
  [100, 70],
  [140, 60],
];

export async function lerPrint(
  imagem: Blob,
  progresso?: (fracao: number, etapa: string) => void,
): Promise<{ texto: string; leitura: LeituraPrint }> {
  const [w, canvases] = await Promise.all([obterTrabalhador(), prepararImagem(imagem)]);
  const textos: string[] = [];
  for (let i = 0; i < canvases.length; i++) {
    aoProgresso = (f, etapa) => progresso?.((i + f) / canvases.length, etapa);
    const { data } = await w.recognize(canvases[i]);
    textos.push(data.text);
  }
  aoProgresso = null;
  const leitura = combinarLeituras(lerTextoDoPrint(textos[0]), lerTextoDoPrint(textos[1]));
  return { texto: textos[0], leitura };
}
