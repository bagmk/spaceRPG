type Track = 'click' | 'auto' | 'crit' | 'time';

interface StageInput {
  id: number;
  name: string;
  targetSec: number;
  mechanic: string;
}

interface Skills {
  click: number;
  auto: number;
  crit: number;
  time: number;
  crossNodes: Set<string>;
  sp: number;
}

const stages: StageInput[] = [
  { id: 1, name: 'Inflation', targetSec: 30, mechanic: 'click_basic' },
  { id: 2, name: 'Baryogenesis', targetSec: 120, mechanic: 'matter_asymmetry' },
  { id: 3, name: 'Quark-Gluon Plasma', targetSec: 300, mechanic: 'click_basic' },
  { id: 4, name: 'Nucleosynthesis', targetSec: 360, mechanic: 'fusion_window' },
  { id: 5, name: 'Recombination', targetSec: 540, mechanic: 'recombination' },
  { id: 6, name: 'Cosmic Dark Age', targetSec: 1800, mechanic: 'dark_age' },
  { id: 7, name: 'First Stars', targetSec: 3600, mechanic: 'first_stars' },
  { id: 8, name: 'Reionization', targetSec: 5400, mechanic: 'reionization' },
  { id: 9, name: 'Galaxy Formation', targetSec: 7200, mechanic: 'galaxy_weaving' },
  { id: 10, name: 'Solar System', targetSec: 10800, mechanic: 'planet_formation' },
  { id: 11, name: 'Life on Earth', targetSec: 14400, mechanic: 'life_evolution' },
  { id: 12, name: 'Death of Star', targetSec: 21600, mechanic: 'red_giant' },
  { id: 13, name: 'Stelliferous End', targetSec: 36000, mechanic: 'remnant_cooling' },
  { id: 14, name: 'Degenerate Era', targetSec: 54000, mechanic: 'proton_decay' },
  { id: 15, name: 'Black Hole Era', targetSec: 86400, mechanic: 'hawking_radiation' },
  { id: 16, name: 'The End', targetSec: 117450, mechanic: 'ending_choice' },
];

const tracks: Track[] = ['click', 'auto', 'crit', 'time'];
const targetLevelByStage = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 29, 29, 29, 29, 29, 30];
const spOnAdvance = [1, 1, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 5, 5, 6];
const crossSPCost: Record<number, number> = { 5: 1, 10: 1, 15: 2, 20: 2, 25: 3, 30: 3 };
const crossMults: Record<number, Record<Track, number>> = {
  5: { click: 1.4, auto: 1.4, crit: 1.15, time: 1.25 },
  10: { click: 1.8, auto: 1.8, crit: 1.3, time: 1.6 },
  15: { click: 2.4, auto: 2.4, crit: 1.5, time: 2.1 },
  20: { click: 3.2, auto: 3.2, crit: 1.75, time: 2.8 },
  25: { click: 4.4, auto: 4.4, crit: 2.05, time: 3.6 },
  30: { click: 6, auto: 6, crit: 2.5, time: 5 },
};

const mechanicClickBoost: Record<string, number> = {
  matter_asymmetry: 1.2,
  fusion_window: 1.3,
  recombination: 1.2,
  reionization: 1.4,
  galaxy_weaving: 1.3,
  planet_formation: 1.2,
  life_evolution: 1.5,
  red_giant: 1.5,
  remnant_cooling: 1,
  proton_decay: 2.4,
  hawking_radiation: 3.5,
  ending_choice: 1,
  click_basic: 1,
  dark_age: 1,
  first_stars: 1,
};

function trackCost(track: Track, nextLevel: number): number {
  return Math.floor(Math.pow(track === 'time' ? 3 : 2, nextLevel - 1));
}

function ownedAllCrossNodes(skills: Skills): boolean {
  return skills.crossNodes.size >= tracks.length * 6;
}

function mods(skills: Skills) {
  let clickMult = Math.pow(2, skills.click);
  let autoRate = skills.auto > 0 ? Math.pow(2, skills.auto) : 0;
  let critMultMult = 1;
  let timeMultMult = 1;
  for (const node of skills.crossNodes) {
    const [track, levelPart] = node.split('_lv') as [Track, string];
    const tier = Number(levelPart);
    const mult = crossMults[tier][track];
    if (track === 'click') clickMult *= mult;
    if (track === 'auto') autoRate *= mult;
    if (track === 'crit') critMultMult *= mult;
    if (track === 'time') timeMultMult *= mult;
  }
  const apex = ownedAllCrossNodes(skills) ? 2 : 1;
  return { clickMult, autoRate, critMultMult, timeMultMult, apex };
}

function quantaPerSecond(skills: Skills, stage: StageInput): number {
  const m = mods(skills);
  const combo = 100;
  const comboMult = 1 + Math.min(7, Math.floor(combo / 10) * 0.4);
  const critChance = Math.min(0.4, skills.crit * 0.015 + combo * 0.003);
  const critMult = Math.max(1.5, 1.5 + skills.crit * 0.5) * m.critMultMult * m.apex;
  const expectedCrit = 1 + critChance * (critMult - 1);
  const click = 10 * m.clickMult * (mechanicClickBoost[stage.mechanic] ?? 1) * expectedCrit * comboMult;
  return click + m.autoRate;
}

function timePerSecond(skills: Skills): number {
  const m = mods(skills);
  return Math.pow(10, skills.time) * m.timeMultMult * m.apex;
}

function buyCrossNodes(skills: Skills): void {
  for (const tier of [5, 10, 15, 20, 25, 30]) {
    for (const track of tracks) {
      const id = `${track}_lv${tier}`;
      if (skills.crossNodes.has(id)) continue;
      if (skills[track] < tier) continue;
      const cost = crossSPCost[tier];
      if (skills.sp < cost) continue;
      skills.sp -= cost;
      skills.crossNodes.add(id);
    }
  }
}

function trackUnlocked(track: Track, stageId: number): boolean {
  if (track === 'click') return true;
  if (track === 'auto' || track === 'time') return stageId >= 2;
  if (track === 'crit') return stageId >= 3;
  return false;
}

function nextTrackToBuy(skills: Skills, targetLevel: number, stageId: number): Track | null {
  if (stageId === 1) return null;
  const available = tracks.filter((track) => trackUnlocked(track, stageId));
  const underTarget = available.filter((track) => skills[track] < targetLevel);
  if (underTarget.length === 0) return null;
  return underTarget.sort((a, b) => {
    const byLevel = skills[a] - skills[b];
    if (byLevel !== 0) return byLevel;
    return trackCost(a, skills[a] + 1) - trackCost(b, skills[b] + 1);
  })[0];
}

function runDesignedStage(stage: StageInput, skills: Skills, carry: number, cosmicStart: number) {
  const targetLevel = targetLevelByStage[stage.id - 1];
  let quanta = carry;
  let cosmic = cosmicStart;
  const target = stage.targetSec;
  const dt = 0.25;
  let nextBuyAt = 0;
  for (let elapsed = 0; elapsed < target; elapsed += dt) {
    buyCrossNodes(skills);
    quanta += quantaPerSecond(skills, stage) * dt;
    cosmic += timePerSecond(skills) * dt;
    if (elapsed >= nextBuyAt) {
      let bought = true;
      while (bought) {
        bought = false;
        const track = nextTrackToBuy(skills, targetLevel, stage.id);
        if (track === null) break;
        const cost = trackCost(track, skills[track] + 1);
        if (quanta >= cost) {
          quanta -= cost;
          skills[track] += 1;
          bought = true;
          buyCrossNodes(skills);
        }
      }
      nextBuyAt += 1;
    }
  }
  buyCrossNodes(skills);
  return {
    threshold: quanta,
    cosmicTimeSec: cosmic,
    skills: { click: skills.click, auto: skills.auto, crit: skills.crit, time: skills.time },
    sp: skills.sp,
    nodes: skills.crossNodes.size,
  };
}

const skills: Skills = { click: 0, auto: 0, crit: 0, time: 0, crossNodes: new Set(), sp: 0 };
let carry = 0;
let cosmic = 1e-34;
const rows = [];
for (const stage of stages) {
  const result = runDesignedStage(stage, skills, carry, cosmic);
  rows.push({ stage, result });
  carry = result.threshold;
  cosmic = result.cosmicTimeSec;
  if (stage.id < stages.length) {
    skills.sp += spOnAdvance[stage.id - 1];
    buyCrossNodes(skills);
  }
}

let total = 0;
for (const { stage, result } of rows) {
  total += stage.targetSec;
  console.log(
    `${String(stage.id).padStart(2)} ${stage.name.padEnd(20)} ${String(stage.targetSec).padStart(7)}s ` +
      `Q=${result.threshold.toExponential(6)} T=${result.cosmicTimeSec.toExponential(6)} ` +
      `L=${result.skills.click}/${result.skills.auto}/${result.skills.crit}/${result.skills.time} ` +
      `SP=${result.sp} nodes=${result.nodes}`,
  );
}
console.log(`Total ${total}s ${(total / 3600).toFixed(3)}h`);
console.log(`Final SP available/remaining ${skills.sp}, nodes ${skills.crossNodes.size}`);

function rounded(value: number): number {
  if (value === 0) return 0;
  const exp = Math.floor(Math.log10(Math.abs(value)));
  const scale = Math.pow(10, exp - 3);
  return Math.round(value / scale) * scale;
}

const scientificCosmic = [
  1e-32,
  1e-12,
  1e-6,
  180,
  6.8e12,
  3.15e15,
  6.3e15,
  1.6e16,
  3.15e16,
  2.9e17,
  4.35e17,
  5.83e17,
  3.15e21,
  2.29e34,
  3.89e35,
  5.01e37,
];

const verificationStages = rows.map(({ stage, result }, index) => ({
  ...stage,
  threshold: rounded(result.threshold),
  cosmicTimeSec: scientificCosmic[index],
}));

function simulateForward() {
  const verifySkills: Skills = { click: 0, auto: 0, crit: 0, time: 0, crossNodes: new Set(), sp: 0 };
  let cosmicClock = 1e-34;
  let carry = 0;
  const output = [];
  for (const stage of verificationStages) {
    const targetLevel = targetLevelByStage[stage.id - 1];
    let quanta = carry;
    let elapsed = 0;
    let nextBuyAt = 0;
    while ((quanta < stage.threshold || cosmicClock < stage.cosmicTimeSec) && elapsed < stage.targetSec * 5) {
      buyCrossNodes(verifySkills);
      quanta += quantaPerSecond(verifySkills, stage) * 0.25;
      cosmicClock += timePerSecond(verifySkills) * 0.25;
      if (elapsed >= nextBuyAt) {
        let bought = true;
        while (bought) {
          bought = false;
          const track = nextTrackToBuy(verifySkills, targetLevel, stage.id);
          if (track === null) break;
          const cost = trackCost(track, verifySkills[track] + 1);
          if (quanta >= cost) {
            quanta -= cost;
            verifySkills[track] += 1;
            bought = true;
            buyCrossNodes(verifySkills);
          }
        }
        nextBuyAt += 1;
      }
      elapsed += 0.25;
    }
    output.push({
      stage,
      elapsed,
      deviation: (elapsed - stage.targetSec) / stage.targetSec,
      levels: `${verifySkills.click}/${verifySkills.auto}/${verifySkills.crit}/${verifySkills.time}`,
      sp: verifySkills.sp,
      nodes: verifySkills.crossNodes.size,
      quantaOK: quanta >= stage.threshold,
      timeOK: cosmicClock >= stage.cosmicTimeSec,
    });
    carry = quanta;
    if (stage.id < stages.length) {
      verifySkills.sp += spOnAdvance[stage.id - 1];
      buyCrossNodes(verifySkills);
    }
  }
  return output;
}

console.log('\nVerification with rounded thresholds and science-preserving early cosmic gates');
let verifyTotal = 0;
const verification = simulateForward();
let maxAbsDeviation = 0;
for (const row of verification) {
  verifyTotal += row.elapsed;
  maxAbsDeviation = Math.max(maxAbsDeviation, Math.abs(row.deviation));
  console.log(
    `${String(row.stage.id).padStart(2)} ${row.stage.name.padEnd(20)} ` +
      `${String(Math.round(row.elapsed)).padStart(7)}s target=${String(row.stage.targetSec).padStart(7)}s ` +
      `dev=${(row.deviation * 100).toFixed(2).padStart(7)}% ` +
      `L=${row.levels} SP=${row.sp} nodes=${row.nodes} ${row.quantaOK ? 'Q' : '!Q'}${row.timeOK ? 'T' : '!T'}`,
  );
}
console.log(`Verify total ${verifyTotal}s ${(verifyTotal / 3600).toFixed(3)}h`);
const final = verification[verification.length - 1];
if (Math.abs(verifyTotal - 360_000) > 360 || maxAbsDeviation > 0.1 || final.nodes !== 24 || final.levels !== '30/30/30/30') {
  console.error('Balance verification failed.');
  process.exit(1);
}
