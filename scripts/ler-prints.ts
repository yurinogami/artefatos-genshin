// Uso (desenvolvimento): npx tsx scripts/ler-prints.ts <pasta com imagens já preparadas>
import { createWorker } from "tesseract.js";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { lerTextoDoPrint } from "../src/dominio/leitorPrint";

const pasta = process.argv[2];
const w = await createWorker(["por", "eng"]);
for (const nome of readdirSync(pasta).filter((n) => n.endsWith(".png")).sort()) {
  const { data } = await w.recognize(join(pasta, nome));
  console.log(`\n===== ${nome} =====\n${data.text}\n----- leitura -----`);
  console.log(JSON.stringify(lerTextoDoPrint(data.text)));
}
await w.terminate();
