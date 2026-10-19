import type { PressureVisualState } from '../../pressure-visual-state.js';
import type {
  FountainArea,
  FountainDomainParams,
  FountainLightingParams,
  FountainPoolParams,
  FountainPressureParams,
  FountainSceneModel,
  FountainStreamParams,
  FountainTaskSignal,
  FountainVisualState,
  FountainVisualStateInput,
  LandingPoint,
} from './fountain-types.js';
import { buildFountainVisualState } from './fountain-visual-state.js';

/**
 * 今日喷泉数据模型（T3）。
 * 把 today 数据（压力状态 / 时间分布 / 当前任务）映射为喷泉参数，
 * 输出完全确定：相同输入 → 相同输出。渲染层只消费 FountainSceneModel。
 *
 * 映射（设计书 §7.4 / 实施计划 §8）：
 *   压力     → 水柱高度/粗细、展开范围、湍流、喷溅、流速
 *   工作占比 → MID 层水弧组活跃度（青绿）
 *   生活占比 → FRONT 层水弧组活跃度（暖金）
 *   空闲占比 → 水体平静度与留白
 *   任务     → 水流节点信号（优先级 → 脉冲强度）
 *   当前时刻 → 仅存 nowMinute，精确定位交给横向时间轴（T3-09）
 */

export interface FountainModelInput {
  readonly pressure: PressureVisualState;
  readonly totals: {
    readonly sleepMinutes: number;
    readonly workMinutes: number;
    readonly lifeMinutes: number;
    readonly freeMinutes: number;
  };
  readonly activeArea: FountainArea;
  readonly nowMinute: number;
  readonly tasks?: readonly { id: string; priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' }[];
}

const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));

const share = (part: number, total: number): number => (total <= 0 ? 0 : part / total);

const buildDomainParams = (
  area: FountainArea,
  visualState: FountainVisualState,
): FountainDomainParams => {
  const modeFlow =
    area === 'WORK' ? 0.1 : area === 'LIFE' ? 0.03 : area === 'SLEEP' ? -0.07 : -0.12;
  const modeBreathing =
    area === 'FREE' ? 0.18 : area === 'SLEEP' ? 0.1 : area === 'LIFE' ? 0.04 : 0;
  const mistBoost = area === 'SLEEP' ? 0.12 : area === 'FREE' ? 0.04 : area === 'LIFE' ? 0.02 : 0;

  return {
    area,
    streamFocus: clamp(1 - visualState.streamSpread * 0.72, 0.18, 0.92),
    jetStability: visualState.stability,
    rhythm: 0.88 + visualState.streamSpeed * 0.24,
    warmth: visualState.warmth,
    mistBoost,
    flowScale: clamp(0.72 + visualState.streamDensity * 0.24 + modeFlow, 0.48, 1.08),
    breathingSpace: clamp(1 - visualState.streamDensity * 0.72 + modeBreathing, 0.08, 0.94),
    rippleSoftness: clamp(1 - visualState.rippleStrength * 0.62, 0.22, 0.94),
  };
};

const buildPressureParams = (
  pressure: PressureVisualState,
  visualState: FountainVisualState,
): FountainPressureParams => {
  const score = clamp(pressure.score, 0, 100);
  return {
    score,
    level: pressure.level,
    columnHeight: visualState.mainJetHeight,
    columnWidth: visualState.mainJetWidth,
    crownSpread: visualState.streamSpread,
    turbulence: clamp(1 - visualState.stability),
    spray: visualState.dropletRate,
    flowSpeed: visualState.streamSpeed,
    mistDensity: visualState.mistDensity,
    glowIntensity: visualState.lightingIntensity,
    highlightIntensity: clamp(0.34 + visualState.lightingIntensity * 0.66),
    particleBudget: Math.round(
      clamp(165 + visualState.streamDensity * 330 + visualState.dropletRate * 330, 200, 1000),
    ),
  };
};

interface StreamLayerSpec {
  readonly role: 'PRIMARY_ARC' | 'MID_STREAM' | 'FINE_STREAM';
  readonly layer: 'BACK' | 'MID' | 'FRONT';
  readonly widthBase: number;
  readonly opacityBase: number;
  readonly startY: number;
  readonly land: number;
}

// 六圈水弧共同组成喷泉冠部。每圈仍由 Today 数据驱动，但拥有独立的
// 起点、落点与厚度，避免 V1 那种“每侧三根发光线”的符号化外观。
const STREAM_LAYERS: readonly StreamLayerSpec[] = [
  {
    role: 'PRIMARY_ARC',
    layer: 'BACK',
    widthBase: 0.82,
    opacityBase: 0.9,
    startY: 0.1,
    land: 0.94,
  },
  {
    role: 'MID_STREAM',
    layer: 'BACK',
    widthBase: 0.54,
    opacityBase: 0.72,
    startY: 0.2,
    land: 0.84,
  },
  {
    role: 'MID_STREAM',
    layer: 'MID',
    widthBase: 0.62,
    opacityBase: 0.78,
    startY: 0.09,
    land: 0.75,
  },
  {
    role: 'MID_STREAM',
    layer: 'MID',
    widthBase: 0.52,
    opacityBase: 0.7,
    startY: 0.22,
    land: 0.65,
  },
  {
    role: 'FINE_STREAM',
    layer: 'FRONT',
    widthBase: 0.3,
    opacityBase: 0.62,
    startY: 0.15,
    land: 0.56,
  },
  {
    role: 'FINE_STREAM',
    layer: 'FRONT',
    widthBase: 0.22,
    opacityBase: 0.54,
    startY: 0.29,
    land: 0.47,
  },
];

const buildStreams = (
  totals: FountainModelInput['totals'],
  pressure: FountainPressureParams,
  domain: FountainDomainParams,
  visualState: FountainVisualState,
): FountainStreamParams[] => {
  const total = Math.max(
    1,
    totals.sleepMinutes + totals.workMinutes + totals.lifeMinutes + totals.freeMinutes,
  );
  const sleepRatio = share(totals.sleepMinutes, total);
  const workRatio = share(totals.workMinutes, total);
  const lifeRatio = share(totals.lifeMinutes, total);
  const freeRatio = share(totals.freeMinutes, total);
  const streams: FountainStreamParams[] = [];
  for (const spec of STREAM_LAYERS) {
    for (const side of ['LEFT', 'RIGHT'] as const) {
      const isActiveLayer =
        (spec.layer === 'BACK' && (domain.area === 'SLEEP' || domain.area === 'FREE')) ||
        (spec.layer === 'MID' && domain.area === 'WORK') ||
        (spec.layer === 'FRONT' && domain.area === 'LIFE');
      const activeBoost = isActiveLayer ? 0.16 : 0;
      const ratioActivity =
        spec.layer === 'BACK'
          ? 0.22 + freeRatio * 0.3 + sleepRatio * 0.26 + activeBoost
          : spec.layer === 'MID'
            ? 0.2 + workRatio * 0.82 + activeBoost
            : 0.2 + lifeRatio * 0.82 + activeBoost;
      const activity = clamp(ratioActivity * (0.68 + visualState.streamDensity * 0.46), 0.1, 1);
      streams.push({
        role: spec.role,
        layer: spec.layer,
        side,
        startY: spec.startY,
        landX: clamp(
          spec.land * (1 - domain.streamFocus * 0.18 + domain.breathingSpace * 0.1),
          0.42,
          1,
        ),
        width: clamp(
          spec.widthBase * (0.72 + pressure.columnWidth * 0.34 + activity * 0.22),
          0.25,
          1,
        ),
        opacity: clamp(
          spec.opacityBase * (0.56 + activity * 0.68) * (0.7 + domain.flowScale * 0.3),
          0.1,
          1,
        ),
        colorHint: spec.layer === 'MID' ? 'WORK' : spec.layer === 'FRONT' ? 'LIFE' : 'NEUTRAL',
        activity: clamp(activity, 0.1, 1),
      });
    }
  }
  return streams;
};

const buildLandingPoints = (streams: readonly FountainStreamParams[]): readonly LandingPoint[] =>
  streams.map((stream) => ({
    x: stream.side === 'LEFT' ? -stream.landX : stream.landX,
    layer: stream.layer,
    intensity: stream.activity,
  }));

const buildPool = (
  totals: FountainModelInput['totals'],
  streams: readonly FountainStreamParams[],
  domain: FountainDomainParams,
  visualState: FountainVisualState,
): FountainPoolParams => {
  const total = Math.max(
    1,
    totals.sleepMinutes + totals.workMinutes + totals.lifeMinutes + totals.freeMinutes,
  );
  const sleepRatio = share(totals.sleepMinutes, total);
  const freeRatio = share(totals.freeMinutes, total);
  const calmness = clamp(visualState.stability + freeRatio * 0.04 + sleepRatio * 0.05, 0.22, 0.96);
  const rippleStrength = visualState.rippleStrength;
  const rippleFrequency = clamp(
    (0.08 + visualState.streamSpeed * 0.32 + visualState.dropletRate * 0.52) * domain.rhythm,
    0,
    1,
  );
  return {
    calmness,
    rippleStrength,
    rippleFrequency,
    waveSpeed: clamp((0.18 + visualState.streamSpeed * 0.7) * domain.rhythm, 0.08, 1),
    reflectionIntensity: clamp(
      0.2 + visualState.lightingIntensity * 0.58 + visualState.warmth * 0.08,
    ),
    distortion: clamp(
      0.04 + (1 - visualState.stability) * 0.62 + visualState.dropletRate * 0.18,
      0.02,
      0.92,
    ),
    activeLandingPoints: buildLandingPoints(streams),
  };
};

const buildLighting = (
  pool: FountainPoolParams,
  visualState: FountainVisualState,
): FountainLightingParams => ({
  keyLight: visualState.lightingIntensity,
  ambientLight: clamp(
    0.18 + visualState.lightingIntensity * 0.48 + (1 - visualState.streamDensity) * 0.1,
  ),
  reflectedLight: clamp(pool.reflectionIntensity * (0.72 + pool.rippleStrength * 0.28), 0, 1),
  warmth: visualState.warmth,
});

const PRIORITY_PULSE: Record<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT', number> = {
  LOW: 0.25,
  NORMAL: 0.45,
  HIGH: 0.7,
  URGENT: 1,
};

const PRIORITY_INDEX: Record<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT', number> = {
  URGENT: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};

const buildTaskSignals = (tasks: NonNullable<FountainModelInput['tasks']>): FountainTaskSignal[] =>
  tasks.map((task) => ({
    id: task.id,
    positionY: clamp(0.55 + PRIORITY_INDEX[task.priority] * 0.12, 0.55, 0.95),
    priority: task.priority,
    pulse: PRIORITY_PULSE[task.priority],
  }));

const buildVisualStateInput = (input: FountainModelInput): FountainVisualStateInput => {
  const total = Math.max(
    1,
    input.totals.sleepMinutes +
      input.totals.workMinutes +
      input.totals.lifeMinutes +
      input.totals.freeMinutes,
  );
  return {
    pressure: input.pressure.score,
    workRatio: share(input.totals.workMinutes, total),
    lifeRatio: share(input.totals.lifeMinutes, total),
    sleepRatio: share(input.totals.sleepMinutes, total),
    freeRatio: share(input.totals.freeMinutes, total),
    currentMode: input.activeArea,
    timeProgress: clamp(input.nowMinute / 1_440, 0, 1),
    priorityState: Math.max(0, ...(input.tasks ?? []).map((task) => PRIORITY_PULSE[task.priority])),
  };
};

export const buildFountainSceneModel = (input: FountainModelInput): FountainSceneModel => {
  const visualState = buildFountainVisualState(buildVisualStateInput(input));
  const pressure = buildPressureParams(input.pressure, visualState);
  const domain = buildDomainParams(input.activeArea, visualState);
  const streams = buildStreams(input.totals, pressure, domain, visualState);
  const pool = buildPool(input.totals, streams, domain, visualState);
  const lighting = buildLighting(pool, visualState);
  return {
    visualState,
    pressure,
    domain,
    lighting,
    streams,
    pool,
    time: { nowMinute: clamp(input.nowMinute, 0, 1_440), activeArea: input.activeArea },
    taskSignals: buildTaskSignals(input.tasks ?? []),
  };
};
