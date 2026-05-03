import type { CanvasWorld, GameState, Stage, StageMechanicId } from '../types';

export interface MechanicContext {
  state: GameState | null;
  stage: Stage;
  now: number;
  progress01: number;
  x?: number;
  y?: number;
}

export interface MechanicTickResult {
  quantaDelta?: number;
  entropyDelta?: number;
  mechanicChargeDelta?: number;
  mechanicStep?: number;
  trigger?: boolean;
  note?: string;
}

export interface MechanicClickResult {
  consumed: boolean;
  gainMultiplier?: number;
  gainFlat?: number;
  quantaDelta?: number;
  entropyDelta?: number;
  forceCrit?: boolean;
  mechanicChargeDelta?: number;
  mechanicStep?: number;
  trigger?: boolean;
  note?: string;
}

export interface MechanicSpec {
  id: StageMechanicId;
  tutorial: string;
  onTick?: (context: MechanicContext) => MechanicTickResult | null;
  onClick?: (context: MechanicContext) => MechanicClickResult;
  draw?: (
    ctx: CanvasRenderingContext2D,
    context: MechanicContext,
    world: CanvasWorld,
    width: number,
    height: number,
  ) => void;
  init?: (world: CanvasWorld) => void;
}
