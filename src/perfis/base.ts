import bruto from "./base-personagens.json";
import type { BasePersonagem } from "../dominio/build";

// Stats no nível 90 e bônus de ascensão (gerado do genshin-db: npm run gerar-dados).
export const BASE_PERSONAGEM = bruto as Record<string, BasePersonagem>;
