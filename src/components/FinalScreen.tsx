import { getCondensedMassReward, getEchoReward, getUniverseBoost, formatDuration, formatWhole } from '../game/formulas';
import { STAGES } from '../game/stages';
import type { GameState, SingularityUnlockId } from '../game/types';
import { SingularityTree } from './SingularityTree';
import { t, type Lang } from '../i18n';

interface FinalScreenProps {
  state: GameState;
  language: Lang;
  onPrestige: () => void;
  onUnlock: (unlockId: SingularityUnlockId) => void;
  onOpenAtlas: () => void;
}

export function FinalScreen({ state, language, onPrestige, onUnlock, onOpenAtlas }: FinalScreenProps) {
  const finalStage = STAGES[STAGES.length - 1];
  const universeBoost = getUniverseBoost(state.entropy);
  const resolvedEndingId = state.selectedEndingId ?? state.lastEndingId;
  const condensedMassReward =
    resolvedEndingId !== null
      ? getCondensedMassReward(state.entropy, resolvedEndingId, state.universeCount)
      : 0;
  const echoReward =
    resolvedEndingId && state.endingsCompleted.includes(resolvedEndingId)
      ? 0
      : getEchoReward(Math.max(0, state.endingsCompleted.length - 1));

  return (
    <section className="final-screen">
      <div className="final-card">
        <div className="q-stage">{`${t(language, 'finalUniverse')} #${state.universeCount}`}</div>
        <h1>"{finalStage.quote}"</h1>
        <p className="final-attr">{finalStage.quoteAttr}</p>
        <div className="final-stats">
          <div>
            <strong>{formatWhole(state.entropy)}</strong>
            <span>{t(language, 'finalTotalEntropy')}</span>
          </div>
          <div>
            <strong>{formatWhole(state.totalClicks)}</strong>
            <span>{t(language, 'finalTotalClicks')}</span>
          </div>
          <div>
            <strong>{formatWhole(state.collisions)}</strong>
            <span>{t(language, 'finalEncounters')}</span>
          </div>
          <div>
            <strong>{formatDuration(state.totalTimePlayed)}</strong>
            <span>{t(language, 'finalTimeElapsed')}</span>
          </div>
        </div>
        <div className="final-summary">{`${t(language, 'finalUniverse')} #${state.universeCount} ${t(language, 'finalCompleted')}`}</div>
        <div className="final-boost">{`${t(language, 'finalAtlasName')}: ${state.currentUniverseSeed.atlasName}`}</div>
        <div className="final-boost">{`${t(language, 'finalPrestigeReward')}: +${formatWhole(universeBoost)} ${t(language, 'finalUniverseBoost')}`}</div>
        <div className="final-boost">{`${t(language, 'finalCompletionReward')}: +${formatWhole(condensedMassReward)} ${t(language, 'finalCondensedMass')}`}</div>
        {echoReward > 0 ? (
          <div className="final-boost">{`${t(language, 'finalNewEndingReward')}: +${formatWhole(echoReward)} ${t(language, 'finalEchoes')}`}</div>
        ) : null}
        <SingularityTree
          condensedMass={state.condensedMass}
          unlocks={state.singularityUnlocks}
          onUnlock={onUnlock}
        />
        <button className="q-continue final-button" type="button" onClick={onPrestige}>
          {t(language, 'finalNextBigBang')}
        </button>
        <button className="mini-button atlas-back" type="button" onClick={onOpenAtlas}>
          {t(language, 'finalOpenAtlas')}
        </button>
      </div>
    </section>
  );
}
