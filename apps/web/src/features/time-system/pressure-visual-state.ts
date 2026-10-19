/**
 * 压力指数 → 喷泉视觉状态映射（P4）。
 *
 * 数据层：今日接口返回 pressure（score 0–100 / level / factors）。
 * 状态层：把压力映射为水流视觉参数（强度、湍流、喷溅、流速），供
 * 「今日动态喷泉」（P3）消费；在喷泉落地前本模块独立可测。
 *
 * 等级语义（设计书 §7.5 + 验收方向）：
 *   轻松 RELAXED    0–24  → 水流平缓、柔和
 *   舒适 COMFORTABLE 25–49 → 水流稳定、规律
 *   偏高 ELEVATED    50–74 → 水流增强、波动加大
 *   高压 HIGH_PRESSURE 75–100 → 水流紊乱、喷溅增加
 */

export type PressureLevel = 'RELAXED' | 'COMFORTABLE' | 'ELEVATED' | 'HIGH_PRESSURE';

export interface PressureVisualState {
  readonly level: PressureLevel;
  readonly score: number;
  /** 水流强度 0–1 */
  readonly intensity: number;
  /** 波动/湍流程度 0–1 */
  readonly turbulence: number;
  /** 喷溅量 0–1 */
  readonly spray: number;
  /** 流速 0–1 */
  readonly flowSpeed: number;
  /** 等级中文标签 */
  readonly label: string;
  /** 状态描述（水流表达） */
  readonly description: string;
}

interface LevelProfile {
  readonly label: string;
  readonly description: string;
  readonly intensity: number;
  readonly turbulence: number;
  readonly spray: number;
  readonly flowSpeed: number;
  /** 等级内分数越高时各参数在基准上的增强幅度 */
  readonly ramp: number;
}

const LEVEL_RANGES: Record<PressureLevel, readonly [number, number]> = {
  RELAXED: [0, 24],
  COMFORTABLE: [25, 49],
  ELEVATED: [50, 74],
  HIGH_PRESSURE: [75, 100],
};

const LEVEL_PROFILES: Record<PressureLevel, LevelProfile> = {
  RELAXED: {
    label: '轻松',
    description: '水流平缓、柔和',
    intensity: 0.2,
    turbulence: 0.05,
    spray: 0,
    flowSpeed: 0.35,
    ramp: 0.08,
  },
  COMFORTABLE: {
    label: '舒适',
    description: '水流稳定、规律',
    intensity: 0.45,
    turbulence: 0.25,
    spray: 0.05,
    flowSpeed: 0.55,
    ramp: 0.1,
  },
  ELEVATED: {
    label: '偏高',
    description: '水流增强、波动加大',
    intensity: 0.7,
    turbulence: 0.6,
    spray: 0.25,
    flowSpeed: 0.75,
    ramp: 0.1,
  },
  HIGH_PRESSURE: {
    label: '高压',
    description: '水流紊乱、喷溅增加',
    intensity: 0.95,
    turbulence: 0.9,
    spray: 0.5,
    flowSpeed: 0.95,
    ramp: 0.05,
  },
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const toPressureVisualState = (score: number, level: PressureLevel): PressureVisualState => {
  const clampedScore = clamp(Math.round(score), 0, 100);
  const profile = LEVEL_PROFILES[level];
  const [min, max] = LEVEL_RANGES[level];
  const within = clamp((clampedScore - min) / Math.max(1, max - min), 0, 1);
  return {
    level,
    score: clampedScore,
    intensity: clamp(profile.intensity + within * profile.ramp, 0, 1),
    turbulence: clamp(profile.turbulence + within * profile.ramp, 0, 1),
    spray: clamp(profile.spray + within * profile.ramp, 0, 1),
    flowSpeed: clamp(profile.flowSpeed + within * profile.ramp, 0, 1),
    label: profile.label,
    description: profile.description,
  };
};

export const pressureLevelLabel = (level: PressureLevel): string => LEVEL_PROFILES[level].label;

export const pressureLevelDescription = (level: PressureLevel): string =>
  LEVEL_PROFILES[level].description;
