import type { TaskItem, TodayData, TodayPlanItem, WarningItem } from '../api.js';
import type { PressureVisualState } from '../pressure-visual-state.js';
import type { TodayAiContext } from '../../assistant/api.js';
import todaySceneEnvironmentAsset from '../../../assets/today/today-scene-environment-v3.png';
import { TodayAiComposer } from './today-ai-composer.js';
import { TodayEnvironmentHeader } from './today-environment-header.js';
import { TodayHorizontalTimeline } from './today-horizontal-timeline.js';
import { TodayPlanColumn } from './today-plan-column.js';
import { TodaySceneEnvironment, getTodaySceneEnvironmentStyle } from './today-scene-environment.js';
import { TodaySceneMedia } from './today-scene-media.js';
import { buildTodaySceneState } from './today-scene-state.js';
import { buildTodaySceneViewModel } from './today-scene-view-model.js';
import { TodayStateAxis } from './today-state-axis.js';
import { TodayStatusFloats } from './today-status-floats.js';
import type {
  TodayCategoryLike,
  TodayCreateEventApi,
  TodayCreateTaskApi,
} from './today-add-form.js';

/**
 * 今日沉浸式布局（T1 骨架）：
 *   顶部环境信息 → 中央喷泉场景（+ 时间分布）→ 右侧计划栏 → 底部横向时间轴 → 底部 AI 输入。
 * 数据由 today-page 获取后传入，视觉组件不直接调用 API。
 */

export interface TodayImmersiveLayoutProps {
  today?: TodayData | undefined;
  todayLoading: boolean;
  tasks?: TaskItem[] | undefined;
  warnings?: WarningItem[] | undefined;
  pressureVisual?: PressureVisualState | undefined;
  currentNow: number;
  range: { from: string; to: string; localDate: string };
  todayLabel: string;
  onSelectBlock: (id: string) => void;
  onSelectTask: (id: string) => void;
  onReschedule: () => void;
  reschedulePending: boolean;
  onCompleteTask: (id: string, version: number) => void;
  completingTaskId?: string | undefined;
  operationFeedback?:
    { readonly tone: 'progress' | 'success' | 'error'; readonly message: string } | undefined;
  categories: readonly TodayCategoryLike[];
  createTask: TodayCreateTaskApi;
  createEvent: TodayCreateEventApi;
  plan?: readonly TodayPlanItem[] | undefined;
}

export const TodayImmersiveLayout = (props: TodayImmersiveLayoutProps) => {
  const {
    today,
    todayLoading,
    tasks,
    warnings,
    pressureVisual,
    currentNow,
    range,
    todayLabel,
    onSelectBlock,
    onSelectTask,
    onReschedule,
    reschedulePending,
    onCompleteTask,
    completingTaskId,
    operationFeedback,
    categories,
    createTask,
    createEvent,
    plan,
  } = props;
  const dayStart = Date.parse(range.from);
  const sceneState =
    today === undefined
      ? undefined
      : buildTodaySceneState({
          pressure: today.pressure.score,
          currentNow: currentNow > 0 ? currentNow : Date.parse(today.serverNow),
        });
  const timeState = sceneState?.timeState ?? 'day';
  const scene = buildTodaySceneViewModel({
    today,
    pressureVisual,
    currentNow,
    dayStart,
    plan,
    tasks,
    warnings,
  });
  const gate2Preview =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('todayV3Gate') === '2';
  const v1CalibrationDebug =
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('todayV1Debug') === '1';
  const aiContext: TodayAiContext | undefined =
    today === undefined
      ? undefined
      : {
          source: 'TODAY',
          date: today.date,
          timeZone: today.timeZone,
          currentTime: new Date(currentNow).toISOString(),
          pressure: { score: today.pressure.score, level: today.pressure.level },
          totals: today.totals,
          currentBlock:
            scene.currentBlock === undefined
              ? null
              : {
                  title: scene.currentBlock.title,
                  kind: scene.currentBlock.blockType,
                  area: scene.currentBlock.area,
                  startAt: scene.currentBlock.startAt,
                  endAt: scene.currentBlock.endAt,
                },
          upcoming: scene.upcomingPlan.slice(0, 5).map((item) => ({
            title: item.title,
            kind: item.kind,
            area: item.area,
            startAt: item.startAt,
            endAt: item.endAt,
          })),
        };

  if (todayLoading && today === undefined) {
    return (
      <main className="today-immersive" aria-busy="true">
        <p className="today-immersive__loading">正在读取今日状态…</p>
      </main>
    );
  }

  return (
    <main
      className="today-immersive"
      data-today-v3-phase="9"
      data-today-v3-gate={gate2Preview ? '2' : undefined}
    >
      <div
        className="today-scene"
        data-composition="v3-desktop-adaptive"
        data-pressure-state={sceneState?.pressureState}
        data-time-state={timeState}
        style={getTodaySceneEnvironmentStyle(timeState)}
      >
        <img
          className="today-scene__backdrop"
          src={todaySceneEnvironmentAsset}
          alt=""
          aria-hidden="true"
          data-today-scene-layer="scene-backdrop"
        />
        <TodaySceneMedia pressureState={sceneState?.pressureState} />
        <TodaySceneEnvironment timeState={timeState} />
        <div className="today-scene__environment" data-today-scene-layer="environment">
          <TodayEnvironmentHeader todayLabel={todayLabel} statusSentence={scene.statusSentence} />
        </div>
        <div className="today-scene__stage" data-today-scene-layer="fountain">
          <TodayStatusFloats items={scene.statusItems} />
          <TodayStateAxis
            pressureVisual={pressureVisual}
            currentNow={currentNow}
            currentStateLabel={scene.currentStateLabel}
            pressureFactors={today?.pressure.factors}
          />
        </div>
        <div className="today-scene__plan" data-today-scene-layer="plan-rail">
          <TodayPlanColumn
            model={scene.planRail}
            onSelectBlock={onSelectBlock}
            onSelectTask={onSelectTask}
            onCompleteTask={onCompleteTask}
            completingTaskId={completingTaskId}
            categories={categories}
            createTask={createTask}
            createEvent={createEvent}
            onReschedule={onReschedule}
            reschedulePending={reschedulePending}
          />
        </div>
        <div className="today-scene__timeline" data-today-scene-layer="timeline">
          <TodayHorizontalTimeline
            dayStart={dayStart}
            serverNow={currentNow}
            blocks={today?.blocks ?? []}
            onSelect={onSelectBlock}
          />
        </div>
        <div className="today-scene__ai" data-today-scene-layer="ai-composer">
          <TodayAiComposer context={aiContext} />
        </div>
        {operationFeedback === undefined ? null : (
          <div
            className="today-operation-feedback"
            data-tone={operationFeedback.tone}
            role={operationFeedback.tone === 'error' ? 'alert' : 'status'}
            aria-live="polite"
          >
            {operationFeedback.message}
          </div>
        )}
        {v1CalibrationDebug ? (
          <div className="today-v1-debug" aria-hidden="true">
            <span data-line="scene-left" />
            <span data-line="focus" />
            <span data-line="right-rail" />
            <span data-line="timeline-left" />
            <span data-line="timeline-right" />
            <span data-line="ai-left" />
            <span data-line="ai-right" />
          </div>
        ) : null}
      </div>
    </main>
  );
};
