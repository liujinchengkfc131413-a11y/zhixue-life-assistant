import type {
  FountainVisualProfileName,
  FountainVisualState,
  FountainVisualStateInput,
} from './fountain-types.js';

type FountainVisualProfile = Omit<
  FountainVisualState,
  'profile' | 'lowerProfile' | 'upperProfile' | 'blend'
> & {
  readonly name: FountainVisualProfileName;
  readonly anchor: number;
};

const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));

const lerp = (from: number, to: number, amount: number): number => from + (to - from) * amount;

const smoothstep = (value: number): number => {
  const normalized = clamp(value);
  return normalized * normalized * (3 - 2 * normalized);
};

export const FOUNTAIN_VISUAL_PROFILES: readonly FountainVisualProfile[] = [
  {
    name: 'CALM',
    anchor: 12,
    mainJetHeight: 0.58,
    mainJetWidth: 0.45,
    streamDensity: 0.42,
    streamSpread: 0.38,
    streamSpeed: 0.32,
    dropletRate: 0.12,
    mistDensity: 0.14,
    rippleStrength: 0.16,
    lightingIntensity: 0.42,
    warmth: 0.14,
    stability: 0.92,
  },
  {
    name: 'BALANCED',
    anchor: 37,
    mainJetHeight: 0.72,
    mainJetWidth: 0.62,
    streamDensity: 0.64,
    streamSpread: 0.54,
    streamSpeed: 0.52,
    dropletRate: 0.34,
    mistDensity: 0.26,
    rippleStrength: 0.36,
    lightingIntensity: 0.6,
    warmth: 0.18,
    stability: 0.82,
  },
  {
    name: 'BUSY',
    anchor: 62,
    mainJetHeight: 0.86,
    mainJetWidth: 0.79,
    streamDensity: 0.82,
    streamSpread: 0.7,
    streamSpeed: 0.76,
    dropletRate: 0.64,
    mistDensity: 0.46,
    rippleStrength: 0.64,
    lightingIntensity: 0.78,
    warmth: 0.22,
    stability: 0.6,
  },
  {
    name: 'INTENSE',
    anchor: 87,
    mainJetHeight: 0.96,
    mainJetWidth: 0.94,
    streamDensity: 1,
    streamSpread: 0.88,
    streamSpeed: 0.98,
    dropletRate: 0.92,
    mistDensity: 0.68,
    rippleStrength: 0.9,
    lightingIntensity: 0.92,
    warmth: 0.26,
    stability: 0.36,
  },
];

const numericKeys = [
  'mainJetHeight',
  'mainJetWidth',
  'streamDensity',
  'streamSpread',
  'streamSpeed',
  'dropletRate',
  'mistDensity',
  'rippleStrength',
  'lightingIntensity',
  'warmth',
  'stability',
] as const;

const profileNameForScore = (score: number): FountainVisualProfileName =>
  score < 25 ? 'CALM' : score < 50 ? 'BALANCED' : score < 75 ? 'BUSY' : 'INTENSE';

const interpolateProfiles = (
  lower: FountainVisualProfile,
  upper: FountainVisualProfile,
  amount: number,
): Record<(typeof numericKeys)[number], number> =>
  Object.fromEntries(
    numericKeys.map((key) => [key, lerp(lower[key], upper[key], amount)]),
  ) as Record<(typeof numericKeys)[number], number>;

export const buildFountainVisualState = (input: FountainVisualStateInput): FountainVisualState => {
  const pressure = clamp(input.pressure, 0, 100);
  const upperIndex = FOUNTAIN_VISUAL_PROFILES.findIndex((profile) => profile.anchor >= pressure);
  const resolvedUpperIndex = upperIndex < 0 ? FOUNTAIN_VISUAL_PROFILES.length - 1 : upperIndex;
  const upper = FOUNTAIN_VISUAL_PROFILES[resolvedUpperIndex];
  const lower = FOUNTAIN_VISUAL_PROFILES[Math.max(0, resolvedUpperIndex - 1)];
  if (lower === undefined || upper === undefined)
    throw new Error('Fountain visual profiles are required');
  const linearBlend = clamp((pressure - lower.anchor) / Math.max(1, upper.anchor - lower.anchor));
  const blend = smoothstep(linearBlend);
  const base = interpolateProfiles(lower, upper, blend);

  const workRatio = clamp(input.workRatio);
  const lifeRatio = clamp(input.lifeRatio);
  const sleepRatio = clamp(input.sleepRatio);
  const freeRatio = clamp(input.freeRatio);
  const priority = clamp(input.priorityState);
  const daylight = 1 - Math.abs(clamp(input.timeProgress) - 0.5) * 2;
  const workMode = input.currentMode === 'WORK' ? 1 : 0;
  const lifeMode = input.currentMode === 'LIFE' ? 1 : 0;
  const sleepMode = input.currentMode === 'SLEEP' ? 1 : 0;
  const freeMode = input.currentMode === 'FREE' ? 1 : 0;

  return {
    profile: profileNameForScore(pressure),
    lowerProfile: lower.name,
    upperProfile: upper.name,
    blend,
    mainJetHeight: clamp(base.mainJetHeight + workMode * 0.018 - sleepMode * 0.022, 0.34, 0.96),
    mainJetWidth: clamp(base.mainJetWidth + workRatio * 0.025 + priority * 0.018, 0.3, 0.94),
    streamDensity: clamp(
      base.streamDensity + workRatio * 0.06 - freeRatio * 0.08 - freeMode * 0.04,
    ),
    streamSpread: clamp(
      base.streamSpread + lifeRatio * 0.08 + freeRatio * 0.045 - workMode * 0.035,
    ),
    streamSpeed: clamp(base.streamSpeed + workMode * 0.055 - sleepMode * 0.08 - freeMode * 0.045),
    dropletRate: clamp(base.dropletRate + priority * 0.08 + workMode * 0.025),
    mistDensity: clamp(base.mistDensity + sleepRatio * 0.1 + sleepMode * 0.08),
    rippleStrength: clamp(
      base.rippleStrength + priority * 0.06 - lifeMode * 0.025 - sleepMode * 0.04,
    ),
    lightingIntensity: clamp(base.lightingIntensity + priority * 0.035 + daylight * 0.025),
    warmth: clamp(base.warmth + lifeRatio * 0.22 + lifeMode * 0.12 + freeMode * 0.025),
    stability: clamp(base.stability + workMode * 0.045 + sleepRatio * 0.04 - priority * 0.035),
  };
};

export const interpolateFountainVisualState = (
  from: FountainVisualState,
  to: FountainVisualState,
  amount: number,
): FountainVisualState => {
  if (amount <= 0) return from;
  if (amount >= 1) return to;
  const eased = smoothstep(amount);
  const values = Object.fromEntries(
    numericKeys.map((key) => [key, lerp(from[key], to[key], eased)]),
  ) as Record<(typeof numericKeys)[number], number>;
  return {
    profile: eased < 0.5 ? from.profile : to.profile,
    lowerProfile: eased < 0.5 ? from.lowerProfile : to.lowerProfile,
    upperProfile: eased < 0.5 ? from.upperProfile : to.upperProfile,
    blend: lerp(from.blend, to.blend, eased),
    ...values,
  };
};
