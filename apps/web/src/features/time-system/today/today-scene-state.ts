import { getFountainSceneState, type FountainSceneState } from './fountain-scene-state.js';

export type TodayTimeState = 'morning' | 'day' | 'sunset' | 'night';

export interface TodaySceneState {
  readonly pressureState: FountainSceneState;
  readonly timeState: TodayTimeState;
}

export interface BuildTodaySceneStateInput {
  readonly pressure: number;
  readonly currentNow: number;
}

const MORNING_START_MINUTE = 5 * 60;
const DAY_START_MINUTE = 11 * 60;
const SUNSET_START_MINUTE = 17 * 60;
const NIGHT_START_MINUTE = 19 * 60 + 30;

export const getTodayTimeState = (currentNow: number): TodayTimeState => {
  const localNow = new Date(currentNow);
  const minuteOfDay = localNow.getHours() * 60 + localNow.getMinutes();

  if (minuteOfDay >= MORNING_START_MINUTE && minuteOfDay < DAY_START_MINUTE) {
    return 'morning';
  }
  if (minuteOfDay >= DAY_START_MINUTE && minuteOfDay < SUNSET_START_MINUTE) {
    return 'day';
  }
  if (minuteOfDay >= SUNSET_START_MINUTE && minuteOfDay < NIGHT_START_MINUTE) {
    return 'sunset';
  }
  return 'night';
};

export const buildTodaySceneState = ({
  pressure,
  currentNow,
}: BuildTodaySceneStateInput): TodaySceneState => ({
  pressureState: getFountainSceneState(pressure),
  timeState: getTodayTimeState(currentNow),
});
