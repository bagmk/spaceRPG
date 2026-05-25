import type { CSSProperties, ReactNode } from 'react';
import type { EntityGlyph as EntityGlyphKind, StageEntity } from '../game/entities/types';

interface EntityGlyphProps {
  entity: StageEntity;
  color?: string;
}

const RARITY_DETAIL_COUNT = {
  common: 2,
  rare: 3,
  epic: 4,
  legendary: 6,
} as const;

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function unit(seed: number, salt: number): number {
  const x = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function pick<T>(items: T[], seed: number, salt: number): T {
  return items[Math.floor(unit(seed, salt) * items.length)] ?? items[0];
}

function dots(count: number): ReactNode {
  return Array.from({ length: count }, (_, index) => (
    <span key={index} className={`entity-glyph__dot entity-glyph__dot--${index + 1}`} />
  ));
}

function detailLayers(entity: StageEntity, seed: number): ReactNode {
  const count = RARITY_DETAIL_COUNT[entity.rarity];
  const satellites = Array.from({ length: count }, (_, index) => {
    const angle = Math.round(unit(seed, index + 1) * 360);
    const radius = Math.round(18 + unit(seed, index + 9) * (entity.rarity === 'legendary' ? 20 : 14));
    const size = Math.round(2 + unit(seed, index + 17) * (entity.rarity === 'legendary' ? 5 : 3));
    const speed = (2.8 + unit(seed, index + 25) * 5.2).toFixed(2);
    const delay = (unit(seed, index + 33) * 5).toFixed(2);
    const style = {
      '--satellite-angle': `${angle}deg`,
      '--satellite-radius': `${radius}px`,
      '--satellite-size': `${size}px`,
      '--satellite-speed': `${speed}s`,
      '--satellite-delay': `-${delay}s`,
    } as CSSProperties & Record<string, string | number>;

    return (
      <span
        key={`satellite-${index}`}
        className={`entity-glyph__satellite entity-glyph__satellite--${index % 3}`}
        style={style}
      />
    );
  });

  const traceCount = entity.rarity === 'common' ? 2 : entity.rarity === 'legendary' ? 5 : 3;
  const traces = Array.from({ length: traceCount }, (_, index) => {
    const angle = Math.round(unit(seed, index + 41) * 360);
    const length = Math.round(15 + unit(seed, index + 49) * 28);
    const offset = Math.round(4 + unit(seed, index + 57) * 15);
    const speed = (1.8 + unit(seed, index + 65) * 4).toFixed(2);
    const style = {
      '--trace-angle': `${angle}deg`,
      '--trace-length': `${length}px`,
      '--trace-offset': `${offset}px`,
      '--trace-speed': `${speed}s`,
      '--trace-delay': `-${(unit(seed, index + 73) * 4).toFixed(2)}s`,
    } as CSSProperties & Record<string, string | number>;

    return <span key={`trace-${index}`} className="entity-glyph__trace" style={style} />;
  });

  return (
    <>
      <span className={`entity-glyph__aura entity-glyph__aura--${seed % 8}`} />
      <span className={`entity-glyph__cut entity-glyph__cut--${Math.floor(unit(seed, 81) * 6)}`} />
      {traces}
      {satellites}
    </>
  );
}

function glyphShape(glyph: EntityGlyphKind): ReactNode {
  switch (glyph) {
    case 'quantum':
      return (
        <>
          <span className="entity-glyph__ring entity-glyph__ring--a" />
          <span className="entity-glyph__spark entity-glyph__spark--a" />
          <span className="entity-glyph__spark entity-glyph__spark--b" />
          {dots(4)}
        </>
      );
    case 'field':
      return (
        <>
          <span className="entity-glyph__ring entity-glyph__ring--a" />
          <span className="entity-glyph__ring entity-glyph__ring--b" />
          <span className="entity-glyph__wave entity-glyph__wave--a" />
          <span className="entity-glyph__core" />
        </>
      );
    case 'wave':
      return (
        <>
          <span className="entity-glyph__wave entity-glyph__wave--a" />
          <span className="entity-glyph__wave entity-glyph__wave--b" />
          {dots(3)}
        </>
      );
    case 'antiparticle':
      return (
        <>
          <span className="entity-glyph__orbit entity-glyph__orbit--a" />
          <span className="entity-glyph__core" />
          <span className="entity-glyph__anti-core" />
        </>
      );
    case 'quark':
      return (
        <>
          <span className="entity-glyph__bond entity-glyph__bond--a" />
          <span className="entity-glyph__bond entity-glyph__bond--b" />
          <span className="entity-glyph__bond entity-glyph__bond--c" />
          {dots(3)}
        </>
      );
    case 'lepton':
      return (
        <>
          <span className="entity-glyph__orbit entity-glyph__orbit--a" />
          <span className="entity-glyph__core" />
          <span className="entity-glyph__electron" />
        </>
      );
    case 'boson':
      return (
        <>
          <span className="entity-glyph__wave entity-glyph__wave--a" />
          <span className="entity-glyph__wave entity-glyph__wave--b" />
          <span className="entity-glyph__core entity-glyph__core--hollow" />
        </>
      );
    case 'nucleus':
      return (
        <>
          <span className="entity-glyph__cluster entity-glyph__cluster--a" />
          <span className="entity-glyph__cluster entity-glyph__cluster--b" />
          <span className="entity-glyph__cluster entity-glyph__cluster--c" />
          <span className="entity-glyph__cluster entity-glyph__cluster--d" />
        </>
      );
    case 'atom':
      return (
        <>
          <span className="entity-glyph__orbit entity-glyph__orbit--a" />
          <span className="entity-glyph__orbit entity-glyph__orbit--b" />
          <span className="entity-glyph__core" />
          <span className="entity-glyph__electron" />
        </>
      );
    case 'molecule':
      return (
        <>
          <span className="entity-glyph__bond entity-glyph__bond--a" />
          <span className="entity-glyph__bond entity-glyph__bond--b" />
          <span className="entity-glyph__molecule-node entity-glyph__molecule-node--a" />
          <span className="entity-glyph__molecule-node entity-glyph__molecule-node--b" />
          <span className="entity-glyph__molecule-node entity-glyph__molecule-node--c" />
        </>
      );
    case 'plasma':
      return (
        <>
          <span className="entity-glyph__heat entity-glyph__heat--a" />
          <span className="entity-glyph__heat entity-glyph__heat--b" />
          {dots(5)}
        </>
      );
    case 'radiation':
      return (
        <>
          <span className="entity-glyph__core" />
          <span className="entity-glyph__ray entity-glyph__ray--a" />
          <span className="entity-glyph__ray entity-glyph__ray--b" />
          <span className="entity-glyph__ray entity-glyph__ray--c" />
          <span className="entity-glyph__ray entity-glyph__ray--d" />
        </>
      );
    case 'cloud':
      return (
        <>
          <span className="entity-glyph__cloud entity-glyph__cloud--a" />
          <span className="entity-glyph__cloud entity-glyph__cloud--b" />
          <span className="entity-glyph__cloud entity-glyph__cloud--c" />
        </>
      );
    case 'halo':
      return (
        <>
          <span className="entity-glyph__ring entity-glyph__ring--a" />
          <span className="entity-glyph__ring entity-glyph__ring--b" />
          {dots(3)}
        </>
      );
    case 'star':
      return (
        <>
          <span className="entity-glyph__star-rays" />
          <span className="entity-glyph__core" />
        </>
      );
    case 'supernova':
      return (
        <>
          <span className="entity-glyph__burst" />
          <span className="entity-glyph__ring entity-glyph__ring--a" />
          <span className="entity-glyph__core" />
        </>
      );
    case 'remnant':
      return (
        <>
          <span className="entity-glyph__ring entity-glyph__ring--a" />
          <span className="entity-glyph__shell" />
          <span className="entity-glyph__core" />
        </>
      );
    case 'black_hole':
      return (
        <>
          <span className="entity-glyph__disk" />
          <span className="entity-glyph__horizon" />
          <span className="entity-glyph__lens" />
        </>
      );
    case 'galaxy':
      return (
        <>
          <span className="entity-glyph__spiral entity-glyph__spiral--a" />
          <span className="entity-glyph__spiral entity-glyph__spiral--b" />
          <span className="entity-glyph__core" />
        </>
      );
    case 'planet':
      return (
        <>
          <span className="entity-glyph__planet" />
          <span className="entity-glyph__planet-ring" />
        </>
      );
    case 'water':
      return (
        <>
          <span className="entity-glyph__drop" />
          <span className="entity-glyph__ripple entity-glyph__ripple--a" />
          <span className="entity-glyph__ripple entity-glyph__ripple--b" />
        </>
      );
    case 'life':
      return (
        <>
          <span className="entity-glyph__leaf entity-glyph__leaf--a" />
          <span className="entity-glyph__leaf entity-glyph__leaf--b" />
          <span className="entity-glyph__stem" />
        </>
      );
    case 'cell':
      return (
        <>
          <span className="entity-glyph__cell-wall" />
          <span className="entity-glyph__nucleus" />
          {dots(2)}
        </>
      );
    case 'dna':
      return (
        <>
          <span className="entity-glyph__helix entity-glyph__helix--a" />
          <span className="entity-glyph__helix entity-glyph__helix--b" />
          <span className="entity-glyph__rung entity-glyph__rung--a" />
          <span className="entity-glyph__rung entity-glyph__rung--b" />
          <span className="entity-glyph__rung entity-glyph__rung--c" />
        </>
      );
    case 'neuron':
      return (
        <>
          <span className="entity-glyph__neuron-core" />
          <span className="entity-glyph__branch entity-glyph__branch--a" />
          <span className="entity-glyph__branch entity-glyph__branch--b" />
          <span className="entity-glyph__branch entity-glyph__branch--c" />
        </>
      );
    case 'entropy':
      return (
        <>
          <span className="entity-glyph__ring entity-glyph__ring--a" />
          {dots(5)}
        </>
      );
    case 'void':
      return (
        <>
          <span className="entity-glyph__void" />
          <span className="entity-glyph__ring entity-glyph__ring--a" />
        </>
      );
    case 'singularity':
      return (
        <>
          <span className="entity-glyph__ring entity-glyph__ring--a" />
          <span className="entity-glyph__ring entity-glyph__ring--b" />
          <span className="entity-glyph__horizon" />
        </>
      );
    case 'bounce':
      return (
        <>
          <span className="entity-glyph__bounce-ring" />
          <span className="entity-glyph__core" />
          <span className="entity-glyph__spark entity-glyph__spark--a" />
        </>
      );
    case 'meson':
      // Quark-antiquark pair: two cores connected by a vibrating string-ish ring.
      return (
        <>
          <span className="entity-glyph__ring entity-glyph__ring--a" />
          <span className="entity-glyph__dot entity-glyph__dot--1" />
          <span className="entity-glyph__dot entity-glyph__dot--2" />
        </>
      );
    case 'accretion':
      // Gas inflow: outer ring + ray streams + tight bright core.
      return (
        <>
          <span className="entity-glyph__ring entity-glyph__ring--b" />
          <span className="entity-glyph__ray entity-glyph__ray--a" />
          <span className="entity-glyph__ray entity-glyph__ray--b" />
          <span className="entity-glyph__ray entity-glyph__ray--c" />
          <span className="entity-glyph__core" />
        </>
      );
    case 'envelope':
      // Bloated red-giant envelope: large cloud layers + tiny hot core.
      return (
        <>
          <span className="entity-glyph__cloud entity-glyph__cloud--a" />
          <span className="entity-glyph__cloud entity-glyph__cloud--b" />
          <span className="entity-glyph__cloud entity-glyph__cloud--c" />
          <span className="entity-glyph__core" />
        </>
      );
    case 'nebula':
      // Planetary nebula: bipolar cloud lobes + equatorial ring + bright core.
      return (
        <>
          <span className="entity-glyph__cloud entity-glyph__cloud--a" />
          <span className="entity-glyph__cloud entity-glyph__cloud--b" />
          <span className="entity-glyph__ring entity-glyph__ring--a" />
          <span className="entity-glyph__core" />
        </>
      );
    case 'crystal':
      // Crystalline lattice: faceted ring + scattered glints + center gem.
      return (
        <>
          <span className="entity-glyph__ring entity-glyph__ring--a" />
          <span className="entity-glyph__ring entity-glyph__ring--b" />
          {dots(5)}
          <span className="entity-glyph__core" />
        </>
      );
    case 'particle':
    default:
      return (
        <>
          <span className="entity-glyph__orbit entity-glyph__orbit--a" />
          <span className="entity-glyph__core" />
          {dots(2)}
        </>
      );
  }
}

export function EntityGlyph({ entity, color }: EntityGlyphProps) {
  const glyph = entity.visual.glyph;
  const seed = hashString(`${entity.stageId}:${entity.id}:${entity.name}`);
  const radius = pick(
    [
      '50%',
      '42% 58% 47% 53%',
      '55% 45% 62% 38%',
      '46% 54% 35% 65%',
      '32% 68% 54% 46%',
      '62% 38% 48% 52%',
    ],
    seed,
    1,
  );
  const shapeScale = entity.rarity === 'legendary' ? 1.08 : 0.88 + unit(seed, 2) * 0.24;
  const shapeStretch = 0.86 + unit(seed, 3) * 0.32;
  const driftX = Math.round(unit(seed, 7) * 6 - 3);
  const driftY = Math.round(unit(seed, 8) * 6 - 3);
  const style = {
    '--entity-color': color ?? entity.visual.color,
    '--entity-glow': entity.visual.glowColor,
    '--entity-radius': radius,
    '--entity-speed': `${2.2 + unit(seed, 4) * 4.8}s`,
    '--entity-tilt': `${Math.round(unit(seed, 5) * 40 - 20)}deg`,
    '--entity-shape-rotate': `${Math.round(unit(seed, 6) * 80 - 40)}deg`,
    '--entity-shape-scale-x': shapeStretch.toFixed(2),
    '--entity-shape-scale-y': shapeScale.toFixed(2),
    '--entity-drift-x': `${driftX}px`,
    '--entity-drift-y': `${driftY}px`,
    '--entity-drift-x-neg': `${-driftX}px`,
    '--entity-drift-y-neg': `${-driftY}px`,
    '--entity-drift-x-soft': `${Math.round(-driftX * 0.6)}px`,
    '--entity-drift-y-soft': `${Math.round(-driftY * 0.8)}px`,
  } as CSSProperties & Record<string, string | number>;

  return (
    <div
      aria-hidden="true"
      className={[
        'entity-glyph',
        `entity-glyph--${glyph}`,
        `entity-glyph--${entity.rarity}`,
        `entity-glyph--${entity.visual.motion}`,
        `entity-glyph--${entity.visual.size}`,
        `entity-glyph--variant-${seed % 9}`,
      ].join(' ')}
      data-glyph={glyph}
      style={style}
    >
      <span className="entity-glyph__stage" />
      {detailLayers(entity, seed)}
      <span className="entity-glyph__shape">{glyphShape(glyph)}</span>
      <span className="entity-glyph__formula">{entity.formula}</span>
    </div>
  );
}
