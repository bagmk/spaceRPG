/**
 * Pure daily check-in / streak resolution (extracted from useGameState's offline
 * catch-up so it is unit-testable). A streak continues ONLY on consecutive days;
 * a gap — or the first-ever check-in — resets it to 1. The check-in grants an
 * escalating 강화석 reward so returning after a break is actually rewarded.
 *
 * The caller passes today's + yesterday's day keys (derived from `now`) so this
 * stays pure and clock-free.
 */
import { dailyCheckInStones } from './balance';

export interface DailyCheckInState {
  lastDayKey: string;
  streakDays: number;
}

export interface DailyCheckInResult {
  /** Is today a new check-in day (vs. already checked in today)? */
  isCheckIn: boolean;
  /** The streak after this resolution. */
  newStreak: number;
  /** 강화석 granted by this check-in (0 when not a new day). */
  stones: number;
  /** The next persisted check-in state (unchanged when not a new day). */
  next: DailyCheckInState;
}

export function computeDailyCheckIn(
  prev: DailyCheckInState,
  todayKey: string,
  yesterdayKey: string,
): DailyCheckInResult {
  const isCheckIn = prev.lastDayKey !== todayKey;
  if (!isCheckIn) {
    return { isCheckIn: false, newStreak: prev.streakDays, stones: 0, next: prev };
  }
  // Consecutive day → extend the streak; any gap (or first-ever) → reset to 1.
  const newStreak = prev.lastDayKey === yesterdayKey ? prev.streakDays + 1 : 1;
  return {
    isCheckIn: true,
    newStreak,
    stones: dailyCheckInStones(newStreak),
    next: { lastDayKey: todayKey, streakDays: newStreak },
  };
}
