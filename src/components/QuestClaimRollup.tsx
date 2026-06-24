import { useEffect, useRef, useState } from 'react';
import { t, type Lang } from '../i18n';
import { formatGameNumber } from '../game/formulas';

interface Props {
  /** Matter granted — rolls up like a slot machine. */
  matter: number;
  stones: number;
  /** Era-record name this claim unlocked. */
  title: string;
  language: Lang;
  onDone: () => void;
}

const ROLL_MS = 750;

/**
 * #42: slot-machine matter rollup shown when a milestone/era-record is claimed.
 * The matter number spins up (ease-out) over ~750ms, then lingers briefly. The
 * triumphant sound is played by the claim site; this is the visual payoff.
 */
export function QuestClaimRollup({ matter, stones, title, language, onDone }: Props) {
  const [shown, setShown] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const p = Math.min(1, (ts - startRef.current) / ROLL_MS);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setShown(matter * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    const dismiss = window.setTimeout(onDone, ROLL_MS + 1100);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      window.clearTimeout(dismiss);
    };
  }, [matter, onDone]);

  return (
    <div className="quest-claim-rollup" role="status" onClick={onDone}>
      <div className="quest-claim-rollup__card">
        <div className="quest-claim-rollup__tag">{t(language, 'questClaimUnlocked')}</div>
        <div className="quest-claim-rollup__title">✦ {title}</div>
        <div className="quest-claim-rollup__matter"><span className="qsym">⚛</span>{` ${formatGameNumber(shown)}`}</div>
        {stones > 0 ? <div className="quest-claim-rollup__stones">{`◆ ${stones}`}</div> : null}
      </div>
    </div>
  );
}
