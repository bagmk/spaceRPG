/**
 * #44 Hexagon bingo set bonuses (pure). The 7-slot hex (0-2 click / 3-5 rift /
 * 6 wild) forms 9 lines of 3 (HEX_BINGO_LINES). A line "completes" when all
 * three slots are filled and share an equip FAMILY (getEquipSetKey); on the
 * three center lines the wild (slot 6) is a joker — it must be filled but its
 * family is ignored. Each completed line feeds an OFF-GATE multiplier for its
 * lane (click → clickMatterMult only, auto → flat-auto only), so the bonus is
 * strong yet never touches the entropy gate. A completed line whose items ALSO
 * share a rarity earns the HEX_HARMONY_BONUS "color match" kicker.
 *
 * Pure function of the 7-slot id array — easy to unit test and to mirror.
 */

import { HEX_BINGO_LINES, HEX_LINE_BONUS, HEX_PURE_LINE_MULT, HEX_HARMONY_BONUS, HEX_BONUS_CAP, HEX_BOARD_TIERS } from '../balance';
import { findEntityById } from './stageItems';
import { getEquipSetKey } from './effects';
import type { EntityRarity } from './types';

export interface HexBingoResult {
  /** Multiplier applied to the click matter channel (≥ 1). */
  clickMult: number;
  /** Multiplier applied to flat auto income (≥ 1). */
  autoMult: number;
  /** Indices into HEX_BINGO_LINES that completed (drives the UI line glow). */
  completedLines: number[];
}

function familyOf(slotId: string | null | undefined): string | null {
  if (!slotId) return null;
  const ent = findEntityById(slotId);
  return ent ? getEquipSetKey(ent) : null;
}
function rarityOf(slotId: string | null | undefined): EntityRarity | null {
  if (!slotId) return null;
  return findEntityById(slotId)?.rarity ?? null;
}

/** Score the hex bingo board. `hexSlots` is a length-7 array of equipped entity
 *  ids (null/empty for an empty slot). */
export function computeHexBingo(hexSlots: (string | null | undefined)[]): HexBingoResult {
  let clickSum = 0;
  let autoSum = 0;
  const completedLines: number[] = [];

  HEX_BINGO_LINES.forEach((line, idx) => {
    const [a, b, c] = line.slots;
    const fa = familyOf(hexSlots[a]);
    const fb = familyOf(hexSlots[b]);
    const fc = familyOf(hexSlots[c]);

    const complete = line.kind === 'center'
      // center: wild (b) is a joker — filled but family-agnostic; endpoints match.
      ? Boolean(hexSlots[b]) && fa !== null && fa === fc
      : fa !== null && fa === fb && fb === fc;
    if (!complete) return;
    completedLines.push(idx);

    const pure = line.kind === 'pureClick' || line.kind === 'pureRift';
    let amount = (pure ? HEX_PURE_LINE_MULT : 1) * HEX_LINE_BONUS;

    // Creative kicker: the completed line's items also share a rarity ("color match").
    const ra = rarityOf(hexSlots[a]);
    const harmonySlots = line.kind === 'center' ? [a, c] : [a, b, c];
    const sameRarity = ra !== null && harmonySlots.every((s) => rarityOf(hexSlots[s]) === ra);
    if (sameRarity) amount += HEX_HARMONY_BONUS;

    if (line.kind === 'center') { clickSum += amount / 2; autoSum += amount / 2; }
    else if (line.kind === 'pureClick' || line.kind === 'mixedClick') clickSum += amount;
    else autoSum += amount;
  });

  // BOARD escalation: more completed lines at once → a bigger multiplier on top of the (capped)
  // lane sum, so a near-full hexagon is a spectacular payoff rather than a flat per-line bonus.
  const boardTier = HEX_BOARD_TIERS[Math.min(completedLines.length, HEX_BOARD_TIERS.length - 1)] ?? 1;
  return {
    clickMult: (1 + Math.min(HEX_BONUS_CAP, clickSum)) * boardTier,
    autoMult: (1 + Math.min(HEX_BONUS_CAP, autoSum)) * boardTier,
    completedLines,
  };
}
