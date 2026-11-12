import type { Artefato } from "../dominio/tipos";
import type { Arma, ConfigPersonagem } from "../dominio/build";
import type { ArmaPossuida } from "../dominio/armasRecomendacao";
import type { BuildSalva } from "../dominio/buildsSalvas";

// Armazenamento local no IndexedDB do navegador. Nada sai do seu computador.
const NOME_BANCO = "artefatos-genshin";
const VERSAO = 5; // 2: arma de cada personagem; 3: constelação e talentos; 4: armas que você tem; 5: builds salvas
const ARTEFATOS = "artefatos";
const ARMAS = "armas";
const PERSONAGENS = "personagens";
const ARMAS_POSSUIDAS = "armasPossuidas";
const BUILDS_SALVAS = "buildsSalvas";

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(NOME_BANCO, VERSAO);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ARTEFATOS)) db.createObjectStore(ARTEFATOS, { keyPath: "id" });
      if (!db.objectStoreNames.contains(ARMAS)) db.createObjectStore(ARMAS, { keyPath: "personagem" });
      if (!db.objectStoreNames.contains(PERSONAGENS)) db.createObjectStore(PERSONAGENS, { keyPath: "personagem" });
      if (!db.objectStoreNames.contains(ARMAS_POSSUIDAS)) db.createObjectStore(ARMAS_POSSUIDAS, { keyPath: "en" });
      if (!db.objectStoreNames.contains(BUILDS_SALVAS)) db.createObjectStore(BUILDS_SALVAS, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function transacao<T>(
  loja: string,
  modo: IDBTransactionMode,
  fn: (loja: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await abrir();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(loja, modo);
    const req = fn(tx.objectStore(loja));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
  });
}

export async function listarArtefatos(): Promise<Artefato[]> {
  const todos = (await transacao(ARTEFATOS, "readonly", (l) => l.getAll() as IDBRequest<Artefato[]>)) ?? [];
  return todos.sort((a, b) => b.criadoEm - a.criadoEm);
}

export async function salvarArtefato(a: Artefato): Promise<void> {
  await transacao(ARTEFATOS, "readwrite", (l) => {
    l.put(a);
  });
}

export async function removerArtefato(id: string): Promise<void> {
  await transacao(ARTEFATOS, "readwrite", (l) => {
    l.delete(id);
  });
}

export async function substituirTudo(lista: Artefato[]): Promise<void> {
  await transacao(ARTEFATOS, "readwrite", (l) => {
    l.clear();
    for (const a of lista) l.put(a);
  });
}

export async function listarArmas(): Promise<Arma[]> {
  return (await transacao(ARMAS, "readonly", (l) => l.getAll() as IDBRequest<Arma[]>)) ?? [];
}

export async function salvarArma(a: Arma): Promise<void> {
  await transacao(ARMAS, "readwrite", (l) => {
    l.put(a);
  });
}

export async function substituirArmas(lista: Arma[]): Promise<void> {
  await transacao(ARMAS, "readwrite", (l) => {
    l.clear();
    for (const a of lista) l.put(a);
  });
}

export async function listarConfigs(): Promise<ConfigPersonagem[]> {
  return (await transacao(PERSONAGENS, "readonly", (l) => l.getAll() as IDBRequest<ConfigPersonagem[]>)) ?? [];
}

export async function salvarConfig(c: ConfigPersonagem): Promise<void> {
  await transacao(PERSONAGENS, "readwrite", (l) => {
    l.put(c);
  });
}

/** Marca personagens como seus sem mexer no resto da configuração (constelação, talentos). */
export async function marcarPossui(ids: (string | null | undefined)[], possui = true): Promise<void> {
  const unicos = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (unicos.length === 0) return;
  const atuais = new Map((await listarConfigs()).map((c) => [c.personagem, c]));
  await transacao(PERSONAGENS, "readwrite", (l) => {
    for (const id of unicos) l.put({ ...atuais.get(id), personagem: id, possui });
  });
}

/** Guarda (ou limpa, com null) o set escolhido de uma build, sem mexer no resto da configuração. */
export async function salvarSetEscolhido(personagem: string, chaveBuild: string, set: string | null): Promise<void> {
  const atual = (await listarConfigs()).find((c) => c.personagem === personagem);
  const escolhas = { ...atual?.setEscolhido };
  if (set) escolhas[chaveBuild] = set;
  else delete escolhas[chaveBuild];
  await salvarConfig({ ...atual, personagem, setEscolhido: escolhas });
}

export async function substituirConfigs(lista: ConfigPersonagem[]): Promise<void> {
  await transacao(PERSONAGENS, "readwrite", (l) => {
    l.clear();
    for (const c of lista) l.put(c);
  });
}

export async function listarArmasPossuidas(): Promise<ArmaPossuida[]> {
  return (await transacao(ARMAS_POSSUIDAS, "readonly", (l) => l.getAll() as IDBRequest<ArmaPossuida[]>)) ?? [];
}

export async function salvarArmaPossuida(a: ArmaPossuida): Promise<void> {
  await transacao(ARMAS_POSSUIDAS, "readwrite", (l) => {
    l.put(a);
  });
}

export async function removerArmaPossuida(en: string): Promise<void> {
  await transacao(ARMAS_POSSUIDAS, "readwrite", (l) => {
    l.delete(en);
  });
}

export async function substituirArmasPossuidas(lista: ArmaPossuida[]): Promise<void> {
  await transacao(ARMAS_POSSUIDAS, "readwrite", (l) => {
    l.clear();
    for (const a of lista) l.put(a);
  });
}

export async function listarBuildsSalvas(): Promise<BuildSalva[]> {
  const todas = (await transacao(BUILDS_SALVAS, "readonly", (l) => l.getAll() as IDBRequest<BuildSalva[]>)) ?? [];
  return todas.sort((a, b) => a.criadaEm - b.criadaEm);
}

export async function salvarBuildSalva(b: BuildSalva): Promise<void> {
  await transacao(BUILDS_SALVAS, "readwrite", (l) => {
    l.put(b);
  });
}

export async function removerBuildSalva(id: string): Promise<void> {
  await transacao(BUILDS_SALVAS, "readwrite", (l) => {
    l.delete(id);
  });
}

export async function substituirBuildsSalvas(lista: BuildSalva[]): Promise<void> {
  await transacao(BUILDS_SALVAS, "readwrite", (l) => {
    l.clear();
    for (const b of lista) l.put(b);
  });
}

export function novoId(): string {
  return crypto.randomUUID();
}
