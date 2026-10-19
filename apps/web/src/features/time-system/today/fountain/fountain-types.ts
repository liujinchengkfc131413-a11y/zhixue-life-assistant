/**
 * 今日喷泉共享类型（T3）。
 * 喷泉为「由今日数据驱动的实时状态可视化组件」，本文件定义数据模型、
 * 几何与渲染之间的稳定契约。精确时间定位由横向时间轴承担（T3-09），
 * 喷泉内不包含纵向 24h 轨道。
 */

export type FountainArea = 'WORK' | 'LIFE' | 'SLEEP' | 'FREE';
export type FountainLayer = 'BACK' | 'MID' | 'FRONT';
export type FountainSide = 'LEFT' | 'RIGHT';
export type FountainColorHint = 'WORK' | 'LIFE' | 'NEUTRAL';
export type FountainStreamRole = 'PRIMARY_ARC' | 'MID_STREAM' | 'FINE_STREAM';
export type FountainVisualProfileName = 'CALM' | 'BALANCED' | 'BUSY' | 'INTENSE';

export interface FountainVisualStateInput {
  readonly pressure: number;
  readonly workRatio: number;
  readonly lifeRatio: number;
  readonly sleepRatio: number;
  readonly freeRatio: number;
  readonly currentMode: FountainArea;
  readonly timeProgress: number;
  readonly priorityState: number;
}

/** V3 Phase 6 的统一视觉状态；Renderer 不再自行解释 Today 原始数据。 */
export interface FountainVisualState {
  readonly profile: FountainVisualProfileName;
  readonly lowerProfile: FountainVisualProfileName;
  readonly upperProfile: FountainVisualProfileName;
  readonly blend: number;
  readonly mainJetHeight: number;
  readonly mainJetWidth: number;
  readonly streamDensity: number;
  readonly streamSpread: number;
  readonly streamSpeed: number;
  readonly dropletRate: number;
  readonly mistDensity: number;
  readonly rippleStrength: number;
  readonly lightingIntensity: number;
  readonly warmth: number;
  readonly stability: number;
}

/** 压力 → 水柱与整体水体参数（T3-01 / T3-06）。 */
export interface FountainPressureParams {
  readonly score: number;
  readonly level: 'RELAXED' | 'COMFORTABLE' | 'ELEVATED' | 'HIGH_PRESSURE';
  /** 水柱高度 0-1（越大越高） */
  readonly columnHeight: number;
  /** 水柱粗细 0-1 */
  readonly columnWidth: number;
  /** 展开点冠状展开范围 0-1 */
  readonly crownSpread: number;
  /** 湍流 0-1 */
  readonly turbulence: number;
  /** 喷溅 0-1 */
  readonly spray: number;
  /** 流速 0-1 */
  readonly flowSpeed: number;
  /** 水雾密度 0-1 */
  readonly mistDensity: number;
  /** 水体环境辉光 0-1 */
  readonly glowIntensity: number;
  /** 水体高光强度 0-1 */
  readonly highlightIntensity: number;
  /** 当前视觉状态的总粒子预算（普通 200–500，高压力最高 1000） */
  readonly particleBudget: number;
}

/** 单束弧形水流的参数（T3-03 / T3-04）。 */
export interface FountainStreamParams {
  /** Phase 4 水束几何职责：主弧 / 中层 / 细流。 */
  readonly role: FountainStreamRole;
  readonly layer: FountainLayer;
  readonly side: FountainSide;
  /** 起点相对展开点向下的归一化偏移 0-1 */
  readonly startY: number;
  /** 落点相对水池半径的归一化距离 0-1 */
  readonly landX: number;
  /** 归一化宽度 0-1 */
  readonly width: number;
  /** 不透明度 0-1 */
  readonly opacity: number;
  readonly colorHint: FountainColorHint;
  /** 活跃度 0-1（工作/生活/空闲数据驱动） */
  readonly activity: number;
}

export interface LandingPoint {
  /** 归一化 x（-1..1，相对池中心） */
  readonly x: number;
  readonly layer: FountainLayer;
  readonly intensity: number;
}

/** 水池与水面参数（T3-05）。 */
export interface FountainPoolParams {
  /** 水面平静度 0-1（越高越平静） */
  readonly calmness: number;
  /** 波纹强度 0-1 */
  readonly rippleStrength: number;
  /** 波纹产生频率 0-1 */
  readonly rippleFrequency: number;
  /** 水面连续波动速度 0-1 */
  readonly waveSpeed: number;
  /** 环境与主柱在水面的反射亮度 0-1 */
  readonly reflectionIntensity: number;
  /** 水面折线/波峰扰动 0-1（Canvas 2D 近似） */
  readonly distortion: number;
  readonly activeLandingPoints: readonly LandingPoint[];
}

/** 当前生活领域对喷泉“性格”的映射，不直接使用类别纯色。 */
export interface FountainDomainParams {
  readonly area: FountainArea;
  /** 水束向中央收拢程度 0-1 */
  readonly streamFocus: number;
  /** 主柱稳定程度 0-1 */
  readonly jetStability: number;
  /** 动画节奏倍率 */
  readonly rhythm: number;
  /** 暖光占比 0-1 */
  readonly warmth: number;
  /** 领域额外水雾 0-1 */
  readonly mistBoost: number;
  /** 整体流量倍率 */
  readonly flowScale: number;
  /** 留白与呼吸感 0-1 */
  readonly breathingSpace: number;
  /** 波纹柔和程度 0-1 */
  readonly rippleSoftness: number;
}

export interface FountainLightingParams {
  readonly keyLight: number;
  readonly ambientLight: number;
  readonly reflectedLight: number;
  readonly warmth: number;
}

export interface FountainTaskSignal {
  readonly id: string;
  /** 喷泉内归一化位置 0-1（信号位置，不承担时间定位） */
  readonly positionY: number;
  readonly priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  /** 脉冲强度 0-1 */
  readonly pulse: number;
}

export interface FountainTimeState {
  readonly nowMinute: number;
  readonly activeArea: FountainArea;
}

/** 喷泉场景模型（T3 数据输出，实施计划 §8.2）。 */
export interface FountainSceneModel {
  readonly visualState: FountainVisualState;
  readonly pressure: FountainPressureParams;
  readonly domain: FountainDomainParams;
  readonly lighting: FountainLightingParams;
  readonly streams: readonly FountainStreamParams[];
  readonly pool: FountainPoolParams;
  readonly time: FountainTimeState;
  readonly taskSignals: readonly FountainTaskSignal[];
}
