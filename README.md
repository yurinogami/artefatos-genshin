# Artefatos Genshin

Site pessoal que roda no navegador: você cadastra seus artefatos, e ele mostra, para cada personagem 5★ e 4★, quais peças trocar e quais vale a pena upar. Tudo fica salvo no próprio navegador (IndexedDB); não há servidor nem login.

## Como rodar

Precisa do Node.js 22 ou mais novo.

```bash
npm install
npm run dev      # abre em http://localhost:5173
npm test         # testes do cálculo de nota e dos perfis
npm run build    # gera a versão final em dist/
```

## Como usar

1. **Artefatos:** cadastre cada peça com set, raridade, peça, main stat, nível, os substats e em quem ela está equipada. Se o 4º substat ainda aparece apagado no jogo (peça abaixo do +4), marque a caixa "bloqueado".
2. **Personagens:** escolha um personagem (e a build, quando houver mais de uma). A tela tem quatro abas:
   - **Build atual:** o que está equipado e as trocas sugeridas por peça.
   - **Melhor com meus artefatos:** a melhor combinação do inventário inteiro: 4 peças de um set recomendado + 1 peça livre (sem 4 peças de nenhum set, monta sem set e avisa). Mostra peças que sairiam de outro personagem e equipa tudo com um clique.
   - **Vale upar?:** peças abaixo do nível máximo que podem superar a peça do mesmo slot na melhor build.
   - **Build ideal:** a meta, sem olhar o inventário: set, main stat e os 4 substats ideais de cada peça, com nota alvo (peça muito boa) e máxima (perfeita), comparadas com a sua melhor peça.
3. **Backup:** exporte um arquivo JSON de vez em quando; limpar os dados do navegador apaga o inventário.

## Cadastrar pelo print

Na aba **Artefatos**, cole um print da tela de detalhe do artefato (**Ctrl+V**), arraste a imagem ou clique em **Escolher imagem**. O app lê o texto com OCR (tesseract.js, no próprio navegador) e preenche o formulário; confira e clique em **Adicionar artefato**.

- Funciona com o jogo em português ou inglês. Pode ser só o painel do artefato (Win+Shift+S) ou a tela inteira.
- Na primeira leitura o navegador baixa os dados de idioma do OCR (alguns MB); depois ficam em cache.
- O app avisa quando algo não bate: valor de substat impossível, nível que não combina com os valores, peça +4 ou maior com só 3 substats lidos.
- "Equipado por ..." vira o campo **Equipado em** quando o personagem tem perfil.
- Em testes com 46 prints de flores (PT-BR), 42 saíram idênticos ao jogo; nos outros faltou um substat, e em metade desses casos o app avisou. Sempre confira os valores antes de salvar.

## Como a nota funciona

A nota é medida em **rolls úteis**: quantos rolls máximos de 5★ a peça tem em stats que o personagem usa, multiplicados pelo peso de cada stat no perfil.

- Exemplo: 7,8% de Dano Crít. com peso 1 vale 1,0 roll útil; 5,8% de PV% com peso 0,8 vale 0,8.
- Uma peça +20 boa costuma ter 5 ou mais rolls úteis; uma perfeita chega perto de 9.
- **Trocas** só sugerem peças já no nível máximo, com main stat aceita pelo perfil e nota maior que a equipada.
- **Vale upar?** projeta a nota no nível máximo. Cada upgrade sorteia um dos 4 substats com chance de 1 em 4 e soma em média 85% do roll máximo. Se o 4º substat está bloqueado, o primeiro upgrade só o ativa. O veredito compara a nota esperada com a da peça que o personagem usa hoje (ou 5,0 se não houver nenhuma).

## Perfis de build

Ficam em `src/perfis/perfis.json`. Cada perfil tem:

```json
{
  "id": "hu-tao",
  "nome": "Hu Tao",
  "elemento": "Pyro",
  "funcao": "DPS principal",
  "sets": ["Crimson Witch of Flames"],
  "mainStats": { "sands": ["hp_", "eleMas"], "goblet": ["pyro_dmg_"], "circlet": ["critRate_", "critDMG_"] },
  "pesos": { "critRate_": 1, "critDMG_": 1, "hp_": 0.8, "eleMas": 0.6 }
}
```

Um personagem pode ter mais de uma build com `"rotulo"` e `"variantes"` (veja Mavuika): cada variante só precisa trazer o que muda em relação à build principal.

As chaves de stats seguem o formato GOOD: `hp`, `atk`, `def`, `hp_`, `atk_`, `def_`, `eleMas`, `enerRech_`, `critRate_`, `critDMG_`; e nas main stats também `heal_` e `<elemento>_dmg_`. Os testes (`npm test`) avisam se um perfil usar uma main stat que não existe na peça, um peso fora de 0 a 1 ou um set fora de `src/dominio/sets.ts`.

Os perfis desta versão são um primeiro rascunho, escritos a partir do consenso da comunidade (Genshin Impact Helper Team e KQM). Ajuste os pesos ao seu jeito de jogar.

**Já incluídos (30):** Alhaitham, Andarilho, Arlecchino, Baizhu, Citlali, Clorinde, Durin, Eula, Furina, Ganyu, Hu Tao, Ineffa, Kaedehara Kazuha, Kamisato Ayaka, Mavuika, Nahida, Navia, Neuvillette, Nicole, Nilou, Odette, Raiden Shogun, Sangonomiya Kokomi, Shenhe, Venti, Xiao, Xilonen, Yelan, Yumemizuki Mizuki, Zhongli. Mavuika tem três builds (DPS, Sub-DPS e Suporte).

**Faltam:** o restante dos 5★, incluindo os lançados em 2025–2026.

## Estrutura

```
src/
  dominio/        regras do jogo e cálculo (sem React; testável)
    leitorPrint.ts  interpreta o texto do OCR (set, peça, nível, substats, "A ser ativado")
    rolls.ts        valores de substat possíveis e se o nível combina
    sets-dados.json sets e peças em PT/EN, gerado por scripts/gerar-sets.mjs (genshin-db)
    sets-extras.json sets novos que o genshin-db ainda não tem
  ocr/            leitura do print com tesseract.js
    tipos.ts      tipos de artefato e perfil
    stats.ts      valores máximos de roll, nomes em português, main stats por peça
    sets.ts       lista de sets 5★ para o autocompletar
    pontuacao.ts  nota, projeção, recomendação de troca, validação
  perfis/         perfis de build em JSON
  armazenamento/  IndexedDB
  componentes/    cartão de artefato e barra de rolls
  telas/          Personagens, Artefatos (com formulário) e Backup
```

## Hospedagem (Cloudflare Pages)

O site é estático: o Cloudflare roda `npm run build` e publica a pasta `dist/`. Cada pessoa que abre o link tem os próprios dados, salvos no navegador dela; para mostrar o seu inventário a alguém, use **Backup → Exportar** e a pessoa importa o arquivo.

Configuração do projeto no Cloudflare (Workers & Pages → Create → Pages → Connect to Git):

| Campo | Valor |
| --- | --- |
| Framework preset | Vite (ou None) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Variável de ambiente | `NODE_VERSION` = `22` (o arquivo `.node-version` já pede isso) |

Depois disso, todo `git push` na branch `main` publica uma versão nova; pushes em outras branches geram um link de prévia.
