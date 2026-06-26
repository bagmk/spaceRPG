import { describe, expect, it } from 'vitest';
import { computeHexBingo } from '../entities/hexBingo';
import { STAGE_ENTITIES } from '../entities/stageItems';
import { getEquipSetKey, getEquipCategory } from '../entities/effects';
import { HEX_BINGO_LINES, HEX_BONUS_CAP, HEX_BOARD_TIERS } from '../balance';
import type { EquipCategory } from '../entities/types';

/** Find 3 entity ids that share an equip family within one category (for a pure line). */
function threeSameFamily(category: EquipCategory): string[] | null {
  const byFam = new Map<string, string[]>();
  for (const e of STAGE_ENTITIES) {
    if (getEquipCategory(e) !== category) continue;
    const fam = getEquipSetKey(e);
    if (!fam) continue;
    const arr = byFam.get(fam) ?? [];
    arr.push(e.id);
    byFam.set(fam, arr);
  }
  for (const arr of byFam.values()) if (arr.length >= 3) return arr.slice(0, 3);
  return null;
}

const EMPTY7 = [null, null, null, null, null, null, null] as (string | null)[];
const PURE_CLICK_LINE = HEX_BINGO_LINES.findIndex((l) => l.kind === 'pureClick');

describe('#44 hexagon bingo bonus', () => {
  it('an empty board grants no bonus', () => {
    const r = computeHexBingo(EMPTY7);
    expect(r.clickMult).toBe(1);
    expect(r.autoMult).toBe(1);
    expect(r.completedLines).toEqual([]);
  });

  it('a pure-click arc (slots 0,1,2 same family) boosts the CLICK lane only', () => {
    const trio = threeSameFamily('click');
    expect(trio).not.toBeNull();
    const board = [...EMPTY7];
    board[0] = trio![0]; board[1] = trio![1]; board[2] = trio![2];
    const r = computeHexBingo(board);
    expect(r.clickMult).toBeGreaterThan(1);
    expect(r.autoMult).toBe(1);
    expect(r.completedLines).toContain(PURE_CLICK_LINE);
  });

  it('a partial line (only 2 of 3 filled) completes nothing', () => {
    const trio = threeSameFamily('click')!;
    const board = [...EMPTY7];
    board[0] = trio[0]; board[1] = trio[1]; // slot 2 left empty
    const r = computeHexBingo(board);
    expect(r.clickMult).toBe(1);
    expect(r.completedLines).toEqual([]);
  });

  it('the bonus is capped (never runs away)', () => {
    // Fill all 7 with the same click family — many lines fire, but each lane is capped.
    const fam = (() => {
      const byFam = new Map<string, string[]>();
      for (const e of STAGE_ENTITIES) {
        const f = getEquipSetKey(e);
        if (!f) continue;
        const a = byFam.get(f) ?? []; a.push(e.id); byFam.set(f, a);
      }
      let best: string[] = [];
      for (const a of byFam.values()) if (a.length > best.length) best = a;
      return best;
    })();
    const board = Array.from({ length: 7 }, (_, i) => fam[i % fam.length] ?? null);
    const r = computeHexBingo(board);
    // The LANE sum stays capped (≤ 1+HEX_BONUS_CAP); the BOARD tier multiplies on top but is
    // still bounded by the largest tier — so it escalates without running away.
    const maxBoard = HEX_BOARD_TIERS[HEX_BOARD_TIERS.length - 1];
    expect(r.clickMult).toBeLessThanOrEqual((1 + HEX_BONUS_CAP) * maxBoard);
    expect(r.autoMult).toBeLessThanOrEqual((1 + HEX_BONUS_CAP) * maxBoard);
    // A fully-matched board completes many lines → the board tier lifts it past the lane cap.
    expect(r.completedLines.length).toBeGreaterThan(2);
    expect(r.clickMult).toBeGreaterThan(1 + HEX_BONUS_CAP);
  });
});
