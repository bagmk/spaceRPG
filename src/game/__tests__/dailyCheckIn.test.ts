import { describe, expect, it } from 'vitest';
import { computeDailyCheckIn } from '../dailyCheckIn';
import { dailyCheckInStones } from '../balance';

describe('C-P2 daily check-in / streak', () => {
  it('is a no-op when already checked in today (no stones, state unchanged)', () => {
    const prev = { lastDayKey: '2026-06-20', streakDays: 4 };
    const r = computeDailyCheckIn(prev, '2026-06-20', '2026-06-19');
    expect(r).toMatchObject({ isCheckIn: false, newStreak: 4, stones: 0 });
    expect(r.next).toBe(prev); // same reference, no churn
  });

  it('extends the streak on a consecutive day', () => {
    const r = computeDailyCheckIn({ lastDayKey: '2026-06-19', streakDays: 4 }, '2026-06-20', '2026-06-19');
    expect(r.isCheckIn).toBe(true);
    expect(r.newStreak).toBe(5);
    expect(r.stones).toBe(dailyCheckInStones(5));
    expect(r.next).toEqual({ lastDayKey: '2026-06-20', streakDays: 5 });
  });

  it('resets the streak to 1 after a gap (non-consecutive day)', () => {
    const r = computeDailyCheckIn({ lastDayKey: '2026-06-10', streakDays: 9 }, '2026-06-20', '2026-06-19');
    expect(r.newStreak).toBe(1);
    expect(r.stones).toBe(dailyCheckInStones(1));
    expect(r.next).toEqual({ lastDayKey: '2026-06-20', streakDays: 1 });
  });

  it('treats a first-ever check-in (no prior day) as streak 1', () => {
    const r = computeDailyCheckIn({ lastDayKey: '', streakDays: 0 }, '2026-06-20', '2026-06-19');
    expect(r.isCheckIn).toBe(true);
    expect(r.newStreak).toBe(1);
  });

  it('rewards escalate with the streak (monotonic up to the cap)', () => {
    const day = (n: number) => dailyCheckInStones(n);
    expect(day(2)).toBeGreaterThan(day(1));
    expect(day(7)).toBeGreaterThanOrEqual(day(6));
  });
});
