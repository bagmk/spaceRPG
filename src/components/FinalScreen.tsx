import { getCondensedMassReward, getEchoReward, getUniverseBoost, formatDuration, formatWhole } from '../game/formulas';
import { STAGES } from '../game/stages';
import type { GameState, SingularityUnlockId } from '../game/types';
import { SingularityTree } from './SingularityTree';

interface FinalScreenProps {
  state: GameState;
  onPrestige: () => void;
  onUnlock: (unlockId: SingularityUnlockId) => void;
}

export function FinalScreen({ state, onPrestige, onUnlock }: FinalScreenProps) {
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
        <div className="q-stage">{`UNIVERSE #${state.universeCount}`}</div>
        <h1>"{finalStage.quote}"</h1>
        <p className="final-attr">{finalStage.quoteAttr}</p>
        <div className="final-stats">
          <div>
            <strong>{formatWhole(state.entropy)}</strong>
            <span>Total entropy gained this run</span>
          </div>
          <div>
            <strong>{formatWhole(state.totalClicks)}</strong>
            <span>Total clicks</span>
          </div>
          <div>
            <strong>{formatWhole(state.collisions)}</strong>
            <span>Encounters survived</span>
          </div>
          <div>
            <strong>{formatDuration(state.totalTimePlayed)}</strong>
            <span>Time elapsed</span>
          </div>
        </div>
        <div className="final-summary">{`Universe #${state.universeCount} completed.`}</div>
        <div className="final-boost">{`Prestige reward: +${formatWhole(universeBoost)} universe boost`}</div>
        <div className="final-boost">{`Completion reward: +${formatWhole(condensedMassReward)} condensed mass`}</div>
        {echoReward > 0 ? (
          <div className="final-boost">{`New ending reward: +${formatWhole(echoReward)} echoes`}</div>
        ) : null}
        <SingularityTree
          condensedMass={state.condensedMass}
          unlocks={state.singularityUnlocks}
          onUnlock={onUnlock}
        />
        <button className="q-continue final-button" type="button" onClick={onPrestige}>
          INITIATE NEXT BIG BANG
        </button>
      </div>
    </section>
  );
}
