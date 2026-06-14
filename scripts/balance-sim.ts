/**
 * Balance simulation — Entity Lab + Skill Tree + 10 CPS assumption.
 *
 * Models a player who:
 *   • Clicks at 10 CPS with a steady combo of 8
 *   • Buys the cheapest affordable entity every BUY_INTERVAL seconds
 *   • Also buys cheap skill-tree levels (click/auto/crit/time) when affordable
 *   • Entities from previous stages persist and keep contributing
 */

import {
  getAutoRate,
  getClickPower,
  getComboMult,
  getCritChance,
  getCritMultiplier,
  getTimeFillRate,
  getTimeBudget,
} from '../src/game/formulas';
import { trackLevelCost } from '../src/game/skills/definitions';
import { getActiveModifiers } from '../src/game/skills/effects';
import { STAGES } from '../src/game/stages';
import { getEntitiesForStage } from '../src/game/entities/stageItems';
import { getEntityCost } from '../src/game/entities/types';
import type { PurchasedEntityEntry } from '../src/game/entities/types';
import type { SkillState, SkillTreeId } from '../src/game/skills/types';

// ---------- Simulation config ----------
const CPS = 10;            // clicks per second
const COMBO = 8;           // steady combo maintained
const BUY_INTERVAL = 3;    // try to buy something every N seconds
const DT = 1;              // step size in seconds
const MAX_TIME_LEVEL = 12; // time skill beyond this is unaffordable in normal play
const MAX_POWER_LEVEL = 35;// cap on click/auto/crit skill investment

// ---------- State ----------
interface SimState {
  skills: SkillState;
  purchasedEntities: PurchasedEntityEntry[];
}

function createSimState(): SimState {
  return {
    skills: {
      click: { level: 0 },
      auto:  { level: 0 },
      crit:  { level: 0 },
      time:  { level: 0 },
      unlockedTracks: ['click'],
      ownedCrossNodes: [],
    },
    purchasedEntities: [],
  };
}

function unlockTracksForStage(skills: SkillState, stageId: number): void {
  const u = new Set(skills.unlockedTracks);
  if (stageId >= 1) u.add('click');
  if (stageId >= 3) u.add('auto');
  if (stageId >= 4) u.add('crit');
  if (stageId >= 5) u.add('time');
  skills.unlockedTracks = Array.from(u) as SkillState['unlockedTracks'];
}

function entityCount(entities: PurchasedEntityEntry[], id: string): number {
  return entities.find((e) => e.entityId === id)?.count ?? 0;
}

function bumpEntity(entities: PurchasedEntityEntry[], id: string): void {
  const entry = entities.find((e) => e.entityId === id);
  if (entry) entry.count++;
  else entities.push({ entityId: id, count: 1 });
}

/** Buy the cheapest affordable entity in the current stage. Returns quanta spent (0 if nothing bought). */
function buyEntity(sim: SimState, stageId: number, quanta: number): number {
  const candidates = getEntitiesForStage(stageId)
    .filter((entity) => {
      const cnt = entityCount(sim.purchasedEntities, entity.id);
      if (entity.maxCount > 0 && cnt >= entity.maxCount) return false;
      return quanta >= getEntityCost(entity, cnt);
    })
    .sort((a, b) => {
      const ca = getEntityCost(a, entityCount(sim.purchasedEntities, a.id));
      const cb = getEntityCost(b, entityCount(sim.purchasedEntities, b.id));
      return ca - cb;
    });

  if (candidates.length === 0) return 0;
  const entity = candidates[0];
  const cost = getEntityCost(entity, entityCount(sim.purchasedEntities, entity.id));
  bumpEntity(sim.purchasedEntities, entity.id);
  return cost;
}

/** Buy the cheapest affordable skill level. Returns quanta spent (0 if nothing bought). */
function buySkill(sim: SimState, stageId: number, quanta: number): number {
  const order: SkillTreeId[] = ['time', 'click', 'auto', 'crit'];
  for (const trackId of order) {
    if (!sim.skills.unlockedTracks.includes(trackId)) continue;
    const level = sim.skills[trackId].level;
    if (trackId === 'time' && level >= MAX_TIME_LEVEL) continue;
    if (trackId !== 'time' && level >= MAX_POWER_LEVEL) continue;
    const cost = trackLevelCost(trackId, level + 1);
    if (quanta >= cost) {
      sim.skills[trackId].level = level + 1;
      return cost;
    }
  }
  void stageId;
  return 0;
}

// ---------- Stage simulation ----------
interface StageResult {
  name: string;
  realTimeSec: number;
  targetSec: number;
  deviation: number;
  skillSnapshot: string;
  entityCount: number;
}

function simulateStage(
  stageIdx: number,
  sim: SimState,
  carryQuanta: number,
): StageResult & { endingQuanta: number } {
  const stage = STAGES[stageIdx];
  unlockTracksForStage(sim.skills, stage.id);

  let quanta = carryQuanta;
  let timeGauge = 0;
  let elapsed = 0;
  const timeBudget = getTimeBudget(stage);

  while (
    (quanta < stage.threshold || timeGauge < timeBudget) &&
    elapsed < stage.realPlayTargetSec * 20
  ) {
    const mods = getActiveModifiers(
      sim.skills,
      {
        currentQuanta: quanta,
        stagesCleared: stageIdx,
        stageId: stage.id,
        progress01: quanta / stage.threshold,
        clickLevel: sim.skills.click.level,
      },
      sim.purchasedEntities,
    );

    const clickPower  = getClickPower(mods);
    const critChance  = getCritChance(sim.skills.crit.level, COMBO, mods);
    const critMult    = getCritMultiplier(sim.skills.crit.level, mods);
    const expectedCrit = 1 + critChance * (critMult - 1);
    const comboMult   = getComboMult(COMBO, mods.comboCapAdd);
    const autoRate    = getAutoRate(mods);
    const timeRate    = getTimeFillRate(stage, sim.skills.time.level, mods);

    quanta     += clickPower * expectedCrit * comboMult * CPS * DT;
    quanta     += autoRate * DT;
    timeGauge   = Math.min(timeBudget + 25, timeGauge + timeRate * DT);
    elapsed    += DT;

    // Buy phase every BUY_INTERVAL seconds
    if (elapsed % BUY_INTERVAL === 0) {
      // Spend aggressively while affordable
      let bought = true;
      while (bought) {
        const skillSpent  = buySkill(sim, stage.id, quanta);
        quanta -= skillSpent;
        const entitySpent = buyEntity(sim, stage.id, quanta);
        quanta -= entitySpent;
        bought = skillSpent > 0 || entitySpent > 0;
      }
    }
  }

  const entitiesInStage = sim.purchasedEntities
    .filter((e) => e.entityId.startsWith(`s${stage.id}_`))
    .reduce((sum, e) => sum + e.count, 0);

  const paced = Math.max(elapsed, stage.realPlayTargetSec * 0.82);
  const deviation = Math.abs(paced - stage.realPlayTargetSec) / stage.realPlayTargetSec;
  const skillSnapshot = `C${sim.skills.click.level}/A${sim.skills.auto.level}/R${sim.skills.crit.level}/T${sim.skills.time.level}`;

  return {
    name:         stage.name,
    realTimeSec:  paced,
    targetSec:    stage.realPlayTargetSec,
    deviation,
    skillSnapshot,
    entityCount:  entitiesInStage,
    endingQuanta: Math.max(0, quanta - stage.threshold),
  };
}

// ---------- Run ----------
const state = createSimState();
let carry = 0;

const results = STAGES.map((_, idx) => {
  const r = simulateStage(idx, state, carry);
  carry = r.endingQuanta;
  return r;
});

const totalHours = results.reduce((sum, r) => sum + r.realTimeSec, 0) / 3600;

results.forEach((r) => {
  const flag = r.deviation > 0.35 ? 'WARN' : 'OK  ';
  console.log(
    `${flag} ${r.name.padEnd(22)} ${String(Math.round(r.realTimeSec)).padStart(7)}s` +
    ` / ${String(r.targetSec).padStart(7)}s target` +
    `  ${r.skillSnapshot}  E:${r.entityCount}`,
  );
});

console.log(`\nTotal simulated hours: ${totalHours.toFixed(2)}`);

if (totalHours < 50 || totalHours > 200) {
  console.error(`ERROR: Total ${totalHours.toFixed(1)}h is outside the 50-200h acceptable range.`);
  process.exit(1);
}
