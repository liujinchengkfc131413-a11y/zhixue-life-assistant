import { useNavigate } from '@tanstack/react-router';
import { useState, type SyntheticEvent } from 'react';

import { useInitialize, useSetupStatus } from './api.js';

type SetupStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;
type ProviderType = 'OPENAI' | 'ANTHROPIC' | 'GOOGLE' | 'OPENAI_COMPATIBLE';
type RoutineType = 'WORKDAY' | 'WEEKEND' | 'HOLIDAY';

interface SetupRoutine {
  readonly templateType: RoutineType;
  readonly label: string;
  sleepStart: string;
  sleepEnd: string;
  activeStart: string;
  activeEnd: string;
}

const initialRoutines: readonly SetupRoutine[] = [
  {
    templateType: 'WORKDAY',
    label: '工作日',
    sleepStart: '23:00',
    sleepEnd: '07:00',
    activeStart: '09:00',
    activeEnd: '18:00',
  },
  {
    templateType: 'WEEKEND',
    label: '周末',
    sleepStart: '00:00',
    sleepEnd: '08:00',
    activeStart: '09:00',
    activeEnd: '22:30',
  },
  {
    templateType: 'HOLIDAY',
    label: '节假日',
    sleepStart: '00:00',
    sleepEnd: '08:00',
    activeStart: '09:00',
    activeEnd: '22:30',
  },
] as const;

const setupSteps: readonly { step: SetupStep; label: string }[] = [
  { step: 1, label: '数据目录' },
  { step: 2, label: '作息' },
  { step: 3, label: '七个模块' },
  { step: 4, label: '自动备份' },
  { step: 5, label: 'AI（可选）' },
  { step: 6, label: '快速记录' },
  { step: 7, label: '完成' },
];

const moduleLabels = ['自媒体', '开发', '学习', '购物', '饮食', '健身', '娱乐'] as const;

export const SetupPage = () => {
  const setup = useSetupStatus();
  const initialize = useInitialize();
  const navigate = useNavigate();
  const [step, setStep] = useState<SetupStep>(1);
  const [dataDirectory, setDataDirectory] = useState('');
  const [includeDemoData, setIncludeDemoData] = useState(true);
  const [routines, setRoutines] = useState<SetupRoutine[]>(() =>
    initialRoutines.map((routine) => ({ ...routine })),
  );
  const [backupFrequency, setBackupFrequency] = useState<'DAILY' | 'WEEKLY' | 'MANUAL'>('WEEKLY');
  const [backupRetentionCount, setBackupRetentionCount] = useState(8);
  const [configureAi, setConfigureAi] = useState(false);
  const [providerType, setProviderType] = useState<ProviderType>('OPENAI');
  const [providerName, setProviderName] = useState('OpenAI');
  const [baseUrl, setBaseUrl] = useState('');
  const [modelId, setModelId] = useState('gpt-5');
  const [apiKey, setApiKey] = useState('');
  const [quickCaptureDefaultAction, setQuickCaptureDefaultAction] = useState<'INBOX' | 'AI'>(
    'INBOX',
  );

  const suggestedDataDirectory = setup.data?.suggestedDataDirectory ?? '';
  const selectedDataDirectory = dataDirectory || suggestedDataDirectory;

  const updateRoutine = (index: number, patch: Partial<SetupRoutine>) => {
    setRoutines((current) =>
      current.map((routine, routineIndex) =>
        routineIndex === index ? { ...routine, ...patch } : routine,
      ),
    );
  };

  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    initialize.mutate(
      {
        dataDirectory: selectedDataDirectory,
        includeDemoData,
        backupFrequency,
        backupRetentionCount,
        quickCaptureDefaultAction,
        routineTemplates: routines.map((routine) => ({
          templateType: routine.templateType,
          segments: [
            {
              name: '睡眠',
              segmentType: 'SLEEP' as const,
              startTime: routine.sleepStart,
              endTime: routine.sleepEnd,
              isImmovable: true,
            },
            {
              name: routine.templateType === 'WORKDAY' ? '工作' : '生活',
              segmentType:
                routine.templateType === 'WORKDAY' ? ('WORK' as const) : ('LIFE' as const),
              startTime: routine.activeStart,
              endTime: routine.activeEnd,
              isImmovable: false,
            },
          ],
        })),
        ...(configureAi
          ? {
              aiProvider: {
                providerType,
                displayName: providerName,
                modelId,
                apiKey,
                ...(baseUrl.trim() === '' ? {} : { baseUrl }),
              },
            }
          : {}),
      },
      {
        onSuccess: () => {
          void navigate({ to: '/' });
        },
      },
    );
  };

  if (setup.data?.initialized) return null;

  return (
    <main className="page setup-page">
      <header className="page__header">
        <h1>开始使用生活助手</h1>
        <p>数据只保存在你选择的电脑目录中；AI 配置可以跳过并稍后设置。</p>
      </header>

      <ol className="setup-progress" aria-label="初始化进度">
        {setupSteps.map((item) => (
          <li key={item.step} aria-current={step === item.step ? 'step' : undefined}>
            {item.step}. {item.label}
          </li>
        ))}
      </ol>

      <form className="settings-section settings-form" onSubmit={submit}>
        {step === 1 ? (
          <>
            <h2>数据目录</h2>
            <label htmlFor="data-directory">本地数据保存位置</label>
            <input
              id="data-directory"
              value={selectedDataDirectory}
              onChange={(event) => {
                setDataDirectory(event.target.value);
              }}
              required
              autoFocus
            />
            <p className="field-hint">
              将创建 database、attachments、backups、logs 和 cache 子目录；此项不可跳过。
            </p>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h2>工作日、周末与节假日作息</h2>
            {routines.map((routine, index) => (
              <fieldset className="routine-card" key={routine.templateType}>
                <legend>{routine.label}</legend>
                <label>
                  睡眠开始
                  <input
                    aria-label={`${routine.label}睡眠开始`}
                    type="time"
                    step="900"
                    value={routine.sleepStart}
                    onChange={(event) => {
                      updateRoutine(index, { sleepStart: event.target.value });
                    }}
                  />
                </label>
                <label>
                  睡眠结束
                  <input
                    aria-label={`${routine.label}睡眠结束`}
                    type="time"
                    step="900"
                    value={routine.sleepEnd}
                    onChange={(event) => {
                      updateRoutine(index, { sleepEnd: event.target.value });
                    }}
                  />
                </label>
                <label>
                  主要时段开始
                  <input
                    aria-label={`${routine.label}主要时段开始`}
                    type="time"
                    step="900"
                    value={routine.activeStart}
                    onChange={(event) => {
                      updateRoutine(index, { activeStart: event.target.value });
                    }}
                  />
                </label>
                <label>
                  主要时段结束
                  <input
                    aria-label={`${routine.label}主要时段结束`}
                    type="time"
                    step="900"
                    value={routine.activeEnd}
                    onChange={(event) => {
                      updateRoutine(index, { activeEnd: event.target.value });
                    }}
                  />
                </label>
              </fieldset>
            ))}
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h2>初始化七个专属模块</h2>
            <p>首次启动会创建下列稳定模块；以后可以重命名、排序或归档分类。</p>
            <ul className="record-list">
              {moduleLabels.map((label) => (
                <li className="record-row" key={label}>
                  {label}
                </li>
              ))}
            </ul>
            <label className="choice-row">
              <input
                type="checkbox"
                checked={includeDemoData}
                onChange={(event) => {
                  setIncludeDemoData(event.target.checked);
                }}
              />
              <span>
                <strong>加载演示数据</strong>
                <small>模块始终创建；演示业务记录可稍后在设置中一键清空。</small>
              </span>
            </label>
          </>
        ) : null}

        {step === 4 ? (
          <>
            <h2>自动备份</h2>
            <label>
              自动备份频率
              <select
                aria-label="自动备份频率"
                value={backupFrequency}
                onChange={(event) => {
                  setBackupFrequency(event.target.value as 'DAILY' | 'WEEKLY' | 'MANUAL');
                }}
              >
                <option value="WEEKLY">每周</option>
                <option value="DAILY">每天</option>
                <option value="MANUAL">仅手动</option>
              </select>
            </label>
            <label>
              定时备份保留份数
              <input
                aria-label="定时备份保留份数"
                type="number"
                min="1"
                max="52"
                value={backupRetentionCount}
                onChange={(event) => {
                  setBackupRetentionCount(Number(event.target.value));
                }}
              />
            </label>
          </>
        ) : null}

        {step === 5 ? (
          <>
            <h2>AI 服务（可选）</h2>
            <label className="choice-row">
              <input
                type="checkbox"
                checked={configureAi}
                onChange={(event) => {
                  setConfigureAi(event.target.checked);
                }}
              />
              现在配置 AI；不勾选即可跳过
            </label>
            {configureAi ? (
              <>
                <label>
                  服务商
                  <select
                    aria-label="首次启动 AI 服务商"
                    value={providerType}
                    onChange={(event) => {
                      setProviderType(event.target.value as ProviderType);
                    }}
                  >
                    <option value="OPENAI">OpenAI</option>
                    <option value="ANTHROPIC">Anthropic</option>
                    <option value="GOOGLE">Google</option>
                    <option value="OPENAI_COMPATIBLE">OpenAI 兼容服务</option>
                  </select>
                </label>
                <label>
                  显示名称
                  <input
                    aria-label="首次启动 AI 显示名称"
                    value={providerName}
                    required
                    onChange={(event) => {
                      setProviderName(event.target.value);
                    }}
                  />
                </label>
                {providerType === 'OPENAI_COMPATIBLE' ? (
                  <label>
                    Base URL
                    <input
                      aria-label="首次启动 AI Base URL"
                      type="url"
                      value={baseUrl}
                      required
                      onChange={(event) => {
                        setBaseUrl(event.target.value);
                      }}
                    />
                  </label>
                ) : null}
                <label>
                  模型 ID
                  <input
                    aria-label="首次启动 AI 模型 ID"
                    value={modelId}
                    required
                    onChange={(event) => {
                      setModelId(event.target.value);
                    }}
                  />
                </label>
                <label>
                  API Key
                  <input
                    aria-label="首次启动 AI API Key"
                    type="password"
                    autoComplete="off"
                    value={apiKey}
                    required
                    onChange={(event) => {
                      setApiKey(event.target.value);
                    }}
                  />
                </label>
              </>
            ) : (
              <p className="field-hint">跳过后，本地任务、日历、模块和搜索功能仍可正常使用。</p>
            )}
          </>
        ) : null}

        {step === 6 ? (
          <>
            <h2>快速记录默认行为</h2>
            <label>
              默认处理方式
              <select
                aria-label="快速记录默认处理方式"
                value={quickCaptureDefaultAction}
                onChange={(event) => {
                  setQuickCaptureDefaultAction(event.target.value as 'INBOX' | 'AI');
                }}
              >
                <option value="INBOX">收集箱</option>
                <option value="AI">交给 AI</option>
              </select>
            </label>
            {quickCaptureDefaultAction === 'AI' && !configureAi ? (
              <p className="field-hint">尚未配置 AI 时，记录仍会安全保留在收集箱中。</p>
            ) : null}
          </>
        ) : null}

        {step === 7 ? (
          <>
            <h2>准备完成</h2>
            <p>将初始化本地目录、三类作息、七个模块、备份与快速记录偏好。</p>
            <p>{configureAi ? '同时保存所选 AI 配置。' : '已跳过 AI，可稍后在设置中配置。'}</p>
            {initialize.error ? <p className="form-error">{initialize.error.message}</p> : null}
          </>
        ) : null}

        <div className="form-actions">
          {step > 1 ? (
            <button
              className="button"
              type="button"
              onClick={() => {
                setStep((step - 1) as SetupStep);
              }}
            >
              返回
            </button>
          ) : null}
          {step < 7 ? (
            <button
              className="button button--primary"
              type="button"
              disabled={step === 1 && selectedDataDirectory.trim() === ''}
              onClick={(event) => {
                // React reuses this element as the submit button on the final step.
                event.preventDefault();
                setStep((step + 1) as SetupStep);
              }}
            >
              {step === 5 && !configureAi ? '跳过 AI' : '继续'}
            </button>
          ) : (
            <button
              className="button button--primary"
              type="submit"
              disabled={initialize.isPending}
            >
              {initialize.isPending ? '正在初始化…' : '完成并进入 Today'}
            </button>
          )}
        </div>
      </form>
    </main>
  );
};
