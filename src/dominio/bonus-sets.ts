// Bônus de 2 e 4 peças usados no cálculo da build inteira.
// É uma aproximação: efeitos condicionais entram como "ativos na média" de um uso normal
// do set (ex.: Códice de Obsidiana conta os 40% de Taxa Crítica), e efeitos que não viram
// stat (cura, energia, buffs só de habilidades específicas) ficam de fora.
// "dano_" é bônus de dano geral; os elementais usam as mesmas chaves das main stats.
import type { ChaveMainStat } from "./tipos";

export type ChaveBonus = ChaveMainStat | "def" | "dano_" | "atkBase"; // atkBase: soma ao ATQ base (ex.: C2 da Mavuika)
export type Bonus = Partial<Record<ChaveBonus, number>>;

export const BONUS_SETS: Record<string, { 2?: Bonus; 4?: Bonus }> = {
  "Gladiator's Finale": { 2: { atk_: 18 } },
  "Wanderer's Troupe": { 2: { eleMas: 80 } },
  "Noblesse Oblige": { 4: { atk_: 20 } },
  "Bloodstained Chivalry": { 2: { physical_dmg_: 25 } },
  "Maiden Beloved": { 2: { heal_: 15 } },
  "Viridescent Venerer": { 2: { anemo_dmg_: 15 } },
  "Thundering Fury": { 2: { electro_dmg_: 15 } },
  "Crimson Witch of Flames": { 2: { pyro_dmg_: 15 }, 4: { pyro_dmg_: 7.5 } },
  "Heart of Depth": { 2: { hydro_dmg_: 15 } },
  "Blizzard Strayer": { 2: { cryo_dmg_: 15 }, 4: { critRate_: 30 } },
  "Archaic Petra": { 2: { geo_dmg_: 15 } },
  "Tenacity of the Millelith": { 2: { hp_: 20 }, 4: { atk_: 20 } },
  "Pale Flame": { 2: { physical_dmg_: 25 }, 4: { atk_: 18, physical_dmg_: 25 } },
  "Shimenawa's Reminiscence": { 2: { atk_: 18 } },
  "Emblem of Severed Fate": { 2: { enerRech_: 20 } },
  "Husk of Opulent Dreams": { 2: { def_: 30 }, 4: { def_: 24, geo_dmg_: 24 } },
  "Ocean-Hued Clam": { 2: { heal_: 15 } },
  "Vermillion Hereafter": { 2: { atk_: 18 }, 4: { atk_: 25 } },
  "Echoes of an Offering": { 2: { atk_: 18 } },
  "Deepwood Memories": { 2: { dendro_dmg_: 15 } },
  "Gilded Dreams": { 2: { eleMas: 80 }, 4: { eleMas: 50 } },
  "Desert Pavilion Chronicle": { 2: { anemo_dmg_: 15 } },
  "Flower of Paradise Lost": { 2: { eleMas: 80 } },
  "Nymph's Dream": { 2: { hydro_dmg_: 15 }, 4: { atk_: 18, hydro_dmg_: 12 } },
  "Vourukasha's Glow": { 2: { hp_: 20 } },
  "Marechaussee Hunter": { 2: { dano_: 15 }, 4: { critRate_: 36 } },
  "Golden Troupe": { 2: { dano_: 20 }, 4: { dano_: 25 } },
  "Song of Days Past": { 2: { heal_: 15 } },
  "Nighttime Whispers in the Echoing Woods": { 2: { atk_: 18 }, 4: { geo_dmg_: 20 } },
  "Fragment of Harmonic Whimsy": { 2: { atk_: 18 }, 4: { dano_: 36 } },
  "Unfinished Reverie": { 2: { atk_: 18 }, 4: { dano_: 30 } },
  "Scroll of the Hero of Cinder City": { 4: { dano_: 12 } },
  "Obsidian Codex": { 2: { dano_: 15 }, 4: { critRate_: 40 } },
  "Long Night's Oath": { 2: { dano_: 25 }, 4: { dano_: 30 } },
  "Finale of the Deep Galleries": { 2: { cryo_dmg_: 15 }, 4: { dano_: 30 } },
  "Silken Moon's Serenade": { 2: { enerRech_: 20 }, 4: { eleMas: 60 } },
  "Night of the Sky's Unveiling": { 2: { eleMas: 80 }, 4: { critRate_: 15 } },
  "A Day Carved From Rising Winds": { 2: { atk_: 18 }, 4: { atk_: 25 } },
  "Aubade of Morningstar and Moon": { 2: { eleMas: 80 } },
};

export const temBonusConhecido = (set: string) => set in BONUS_SETS;
