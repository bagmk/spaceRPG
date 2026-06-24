import { useEffect } from 'react';
import { t, type Lang } from '../i18n';
import { findCodexSubsetById, codexSubsetLabel, codexSetLabel, codexRewardLabel } from '../game/entities/codexSets';

interface Props {
  subsetId: string;
  /** True when this claim completed every subset of its parent set (the bigger milestone). */
  isFullSet: boolean;
  language: Lang;
  onDismiss: () => void;
}

const DISMISS_MS = 2800;
const DISMISS_MS_SET = 3600;

/**
 * Persona L: the collection-peak celebration. Completing a codex sub-collection
 * was silent — claiming it just applied a % bonus. This fires the satisfying
 * "닫히는 순간" reward-loop close:
 *  - SUBSET claim → a top-center toast (mirrors DropDiscoveryToast styling) with
 *    the subset name + the permanent % bonus it unlocked.
 *  - FULL SET (isFullSet) → a fuller-screen gold-burst overlay (the bigger
 *    milestone), reusing the quest-claim-rollup overlay shell.
 * Auto-dismisses + click-to-dismiss, like the other reveals. The triumphant
 * sound is played by the claim site (GameScreen), mirroring lastDropEvent.
 */
export function CodexClaimCelebration({ subsetId, isFullSet, language, onDismiss }: Props) {
  useEffect(() => {
    const dismiss = window.setTimeout(onDismiss, isFullSet ? DISMISS_MS_SET : DISMISS_MS);
    return () => window.clearTimeout(dismiss);
  }, [onDismiss, isFullSet]);

  const found = findCodexSubsetById(subsetId);
  if (!found) return null;
  const { set, subset } = found;
  const subsetName = codexSubsetLabel(subset, language);
  const subsetBonus = codexRewardLabel(subset.reward, language);

  if (isFullSet) {
    // Bigger milestone — a fuller-screen gold-burst overlay. The set bonus is the
    // headline reward; the just-completed subset's bonus rides underneath.
    const setName = codexSetLabel(set, language);
    const setBonus = codexRewardLabel(set.reward, language);
    return (
      <div className="codex-claim-burst" role="status" onClick={onDismiss}>
        <div className="codex-claim-burst__ring" aria-hidden="true" />
        <div className="codex-claim-burst__card" style={{ ['--codex-accent' as string]: set.accent }}>
          <div className="codex-claim-burst__icon" aria-hidden="true">{set.icon}</div>
          <div className="codex-claim-burst__tag">{t(language, 'codexSetCompleteTag')}</div>
          <div className="codex-claim-burst__title">
            {t(language, 'codexSetComplete').replace('{name}', setName)}
          </div>
          <div className="codex-claim-burst__bonus">{setBonus}</div>
          <div className="codex-claim-burst__sub">{`${subsetName} · ${subsetBonus}`}</div>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="codex-claim-toast"
      style={{ ['--codex-accent' as string]: set.accent }}
      role="status"
      onClick={onDismiss}
      aria-label={`${t(language, 'codexSubsetCompleteTag')} ${subsetName} ${subsetBonus}`}
    >
      <span className="codex-claim-toast__tag">{t(language, 'codexSubsetCompleteTag')}</span>
      <span className="codex-claim-toast__icon" aria-hidden="true">{set.icon}</span>
      <span className="codex-claim-toast__name">
        {t(language, 'codexSubsetComplete').replace('{name}', subsetName)}
      </span>
      <span className="codex-claim-toast__bonus">{subsetBonus}</span>
    </button>
  );
}
