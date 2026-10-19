import { useState, type SyntheticEvent } from 'react';

import {
  shanghaiDayRange,
  useCreateRoutine,
  useRemoveRoutineOverride,
  useRoutineOverride,
  useRoutines,
  useSaveRoutineOverride,
  useUpdateRoutine,
} from './api.js';

type SegmentType = 'SLEEP' | 'WORK' | 'LIFE' | 'REST';

interface SegmentDraft {
  name: string;
  segmentType: SegmentType;
  startTime: string;
  endTime: string;
  isImmovable: boolean;
}

interface RoutineDraft {
  id: string;
  version: number;
  name: string;
  templateType: 'WORKDAY' | 'WEEKEND' | 'HOLIDAY' | 'CUSTOM';
  isDefault: boolean;
  segments: readonly SegmentDraft[];
}

const defaultOverrideSegments: readonly SegmentDraft[] = [
  {
    name: '睡眠',
    segmentType: 'SLEEP',
    startTime: '23:00',
    endTime: '07:00',
    isImmovable: true,
  },
  {
    name: '白天',
    segmentType: 'WORK',
    startTime: '09:00',
    endTime: '18:00',
    isImmovable: false,
  },
  {
    name: '晚间',
    segmentType: 'LIFE',
    startTime: '19:00',
    endTime: '22:30',
    isImmovable: false,
  },
];

const RoutineEditor = ({ routine }: { routine: RoutineDraft }) => {
  const updateRoutine = useUpdateRoutine();
  const [name, setName] = useState(routine.name);
  const [segments, setSegments] = useState<SegmentDraft[]>([...routine.segments]);

  const updateSegment = (index: number, value: Partial<SegmentDraft>) => {
    setSegments((current) =>
      current.map((segment, segmentIndex) =>
        segmentIndex === index ? { ...segment, ...value } : segment,
      ),
    );
  };

  return (
    <article className="routine-card">
      <div className="section-heading">
        <div>
          <input
            className="routine-card__name"
            value={name}
            aria-label={`${routine.name}模板名称`}
            onChange={(event) => {
              setName(event.target.value);
            }}
          />
          <p>
            {routine.templateType} {routine.isDefault ? '· 当前默认' : ''}
          </p>
        </div>
        <button
          className="button button--small"
          type="button"
          disabled={updateRoutine.isPending || name.trim() === ''}
          onClick={() => {
            updateRoutine.mutate({ id: routine.id, version: routine.version, name, segments });
          }}
        >
          {updateRoutine.isPending ? '保存中…' : '保存模板'}
        </button>
      </div>
      <div className="routine-segments">
        {segments.map((segment, index) => (
          <div className="routine-segment" key={`${segment.name}-${String(index)}`}>
            <input
              value={segment.name}
              aria-label="时段名称"
              onChange={(event) => {
                updateSegment(index, { name: event.target.value });
              }}
            />
            <select
              value={segment.segmentType}
              aria-label="时段类型"
              onChange={(event) => {
                updateSegment(index, { segmentType: event.target.value as SegmentType });
              }}
            >
              <option value="SLEEP">睡眠</option>
              <option value="WORK">工作</option>
              <option value="LIFE">生活</option>
              <option value="REST">休息</option>
            </select>
            <input
              type="time"
              step="900"
              value={segment.startTime}
              aria-label={`${segment.name}开始时间`}
              onChange={(event) => {
                updateSegment(index, { startTime: event.target.value });
              }}
            />
            <span>至</span>
            <input
              type="time"
              step="900"
              value={segment.endTime}
              aria-label={`${segment.name}结束时间`}
              onChange={(event) => {
                updateSegment(index, { endTime: event.target.value });
              }}
            />
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={segment.isImmovable}
                onChange={(event) => {
                  updateSegment(index, { isImmovable: event.target.checked });
                }}
              />
              不可移动
            </label>
          </div>
        ))}
      </div>
      {updateRoutine.isError ? (
        <p className="form-error">模板保存失败，请检查时段是否重叠且对齐 15 分钟。</p>
      ) : null}
    </article>
  );
};

const RoutineOverrideEditor = ({
  date,
  routines,
  initialOverride,
}: {
  readonly date: string;
  readonly routines: readonly RoutineDraft[];
  readonly initialOverride: {
    readonly id: string;
    readonly templateId: string | null;
    readonly segments: readonly SegmentDraft[] | null;
    readonly note: string | null;
  } | null;
}) => {
  const saveOverride = useSaveRoutineOverride();
  const removeOverride = useRemoveRoutineOverride();
  const [mode, setMode] = useState<'TEMPLATE' | 'CUSTOM'>(
    initialOverride?.segments ? 'CUSTOM' : 'TEMPLATE',
  );
  const [templateId, setTemplateId] = useState(
    initialOverride?.templateId ?? routines[0]?.id ?? '',
  );
  const [note, setNote] = useState(initialOverride?.note ?? '');
  const [segments, setSegments] = useState<SegmentDraft[]>(
    initialOverride?.segments === null || initialOverride?.segments === undefined
      ? defaultOverrideSegments.map((segment) => ({ ...segment }))
      : initialOverride.segments.map((segment) => ({ ...segment })),
  );

  const updateSegment = (index: number, value: Partial<SegmentDraft>) => {
    setSegments((current) =>
      current.map((segment, segmentIndex) =>
        segmentIndex === index ? { ...segment, ...value } : segment,
      ),
    );
  };

  return (
    <form
      className="routine-card"
      onSubmit={(event) => {
        event.preventDefault();
        saveOverride.mutate({
          date,
          override:
            mode === 'TEMPLATE'
              ? { templateId, ...(note.trim() === '' ? {} : { note }) }
              : { segments, ...(note.trim() === '' ? {} : { note }) },
        });
      }}
    >
      <div className="routine-segments">
        <select
          aria-label="覆盖方式"
          value={mode}
          onChange={(event) => {
            setMode(event.target.value as 'TEMPLATE' | 'CUSTOM');
          }}
        >
          <option value="TEMPLATE">使用现有模板</option>
          <option value="CUSTOM">当天自定义时段</option>
        </select>
        {mode === 'TEMPLATE' ? (
          <select
            aria-label="覆盖作息模板"
            value={templateId}
            required
            onChange={(event) => {
              setTemplateId(event.target.value);
            }}
          >
            {routines.map((routine) => (
              <option key={routine.id} value={routine.id}>
                {routine.name}
              </option>
            ))}
          </select>
        ) : (
          <>
            {segments.map((segment, index) => (
              <div className="routine-segment" key={index}>
                <input
                  aria-label={`覆盖时段 ${String(index + 1)} 名称`}
                  value={segment.name}
                  required
                  onChange={(event) => {
                    updateSegment(index, { name: event.target.value });
                  }}
                />
                <select
                  aria-label={`覆盖时段 ${String(index + 1)} 类型`}
                  value={segment.segmentType}
                  onChange={(event) => {
                    updateSegment(index, { segmentType: event.target.value as SegmentType });
                  }}
                >
                  <option value="SLEEP">睡眠</option>
                  <option value="WORK">工作</option>
                  <option value="LIFE">生活</option>
                  <option value="REST">休息</option>
                </select>
                <input
                  aria-label={`覆盖时段 ${String(index + 1)} 开始时间`}
                  type="time"
                  step="900"
                  value={segment.startTime}
                  required
                  onChange={(event) => {
                    updateSegment(index, { startTime: event.target.value });
                  }}
                />
                <span>至</span>
                <input
                  aria-label={`覆盖时段 ${String(index + 1)} 结束时间`}
                  type="time"
                  step="900"
                  value={segment.endTime}
                  required
                  onChange={(event) => {
                    updateSegment(index, { endTime: event.target.value });
                  }}
                />
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={segment.isImmovable}
                    onChange={(event) => {
                      updateSegment(index, { isImmovable: event.target.checked });
                    }}
                  />
                  不可移动
                </label>
                <button
                  className="button button--small"
                  type="button"
                  disabled={segments.length === 1}
                  onClick={() => {
                    setSegments((current) => current.filter((_, itemIndex) => itemIndex !== index));
                  }}
                >
                  删除时段
                </button>
              </div>
            ))}
            <button
              className="button button--small"
              type="button"
              onClick={() => {
                setSegments((current) => [
                  ...current,
                  {
                    name: '新时段',
                    segmentType: 'REST',
                    startTime: '12:00',
                    endTime: '13:00',
                    isImmovable: false,
                  },
                ]);
              }}
            >
              新增时段
            </button>
          </>
        )}
        <input
          aria-label="覆盖备注"
          value={note}
          maxLength={500}
          placeholder="备注（可选）"
          onChange={(event) => {
            setNote(event.target.value);
          }}
        />
      </div>
      <div className="row-actions">
        <button
          className="button"
          type="submit"
          disabled={saveOverride.isPending || (mode === 'TEMPLATE' && templateId === '')}
        >
          {initialOverride === null ? '新增日期覆盖' : '保存日期覆盖'}
        </button>
        {initialOverride !== null ? (
          <button
            className="button button--danger"
            type="button"
            disabled={removeOverride.isPending}
            onClick={() => {
              removeOverride.mutate(date);
            }}
          >
            删除日期覆盖
          </button>
        ) : null}
      </div>
      {saveOverride.isError ? (
        <p className="form-error">覆盖保存失败，请检查时段是否重叠且对齐 15 分钟。</p>
      ) : null}
    </form>
  );
};

export const RoutineOverrideSettings = () => {
  const routines = useRoutines();
  const [date, setDate] = useState(shanghaiDayRange().localDate);
  const override = useRoutineOverride(date);
  const value = override.data ?? null;

  return (
    <section className="settings-section">
      <div className="section-heading">
        <div>
          <h2>日期作息覆盖</h2>
          <p>只修改指定日期，可选现有模板或直接设置当天时段。</p>
        </div>
      </div>
      <label>
        选择日期
        <input
          aria-label="作息覆盖日期"
          type="date"
          value={date}
          onChange={(event) => {
            setDate(event.target.value);
          }}
        />
      </label>
      {override.isLoading || routines.isLoading ? (
        <p>正在读取日期覆盖…</p>
      ) : (
        <RoutineOverrideEditor
          key={`${date}:${JSON.stringify(value)}`}
          date={date}
          routines={routines.data ?? []}
          initialOverride={value}
        />
      )}
    </section>
  );
};

export const RoutineSettings = () => {
  const routines = useRoutines();
  const createRoutine = useCreateRoutine();
  const [newName, setNewName] = useState('我的作息');

  const create = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    createRoutine.mutate({
      name: newName,
      templateType: 'CUSTOM',
      segments: [
        {
          name: '睡眠',
          segmentType: 'SLEEP',
          startTime: '23:00',
          endTime: '07:00',
          isImmovable: true,
        },
        {
          name: '白天',
          segmentType: 'WORK',
          startTime: '09:00',
          endTime: '18:00',
          isImmovable: false,
        },
        {
          name: '晚间',
          segmentType: 'LIFE',
          startTime: '19:00',
          endTime: '22:30',
          isImmovable: false,
        },
      ],
    });
  };

  return (
    <>
      <section className="settings-section">
        <div className="section-heading">
          <div>
            <h2>作息模板</h2>
            <p>工作日、周末与节假日分别生效；跨午夜睡眠会自动识别。</p>
          </div>
        </div>
        <div className="routine-list">
          {routines.data?.map((routine) => (
            <RoutineEditor key={`${routine.id}:${String(routine.version)}`} routine={routine} />
          ))}
        </div>
        <form className="inline-create" onSubmit={create}>
          <input
            value={newName}
            aria-label="新作息模板名称"
            onChange={(event) => {
              setNewName(event.target.value);
            }}
            required
          />
          <button className="button" type="submit" disabled={createRoutine.isPending}>
            新增自定义模板
          </button>
        </form>
      </section>
      <RoutineOverrideSettings />
    </>
  );
};
