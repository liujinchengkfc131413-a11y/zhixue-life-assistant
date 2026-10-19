import { useState, type SyntheticEvent } from 'react';

import {
  useArchiveCategory,
  useCategories,
  useCreateBackup,
  useBackups,
  usePreviewBackupRestore,
  useExecuteBackupRestore,
  useCreateCategory,
  useCreateTag,
  useDeleteTag,
  useDemoData,
  usePreviewClearDemoData,
  useClearDemoData,
  useExecuteDataDirectoryMigration,
  usePreviewDataDirectoryMigration,
  usePreviewDeleteTag,
  useReorderCategories,
  useSaveSettings,
  useSettings,
  useSetupStatus,
  useTags,
  useUpdateCategory,
  useUpdateTag,
  usePreviewClearAiMemory,
  useClearAiMemory,
  useHolidays,
  useRemoveHolidayOverride,
  useUpdateHolidays,
} from './api.js';
import { SetupPage } from './setup-page.js';
import { AiProviderSettings } from './ai-provider-settings.js';
import { RoutineSettings } from '../time-system/routine-settings.js';
import { SystemStatusPanel } from '../../widgets/system-status-panel.js';
import { DiagnosticsPanel } from '../../widgets/diagnostics-panel.js';
import { formatDateTime } from '../../shared/format.js';
import { useSystemStatus } from '../../entities/system/use-system-status.js';

interface EditableRecord {
  readonly id: string;
  readonly name: string;
  readonly version: number;
}

const categoryTemplateOptions = [
  { value: 'SELF_MEDIA', label: '自媒体' },
  { value: 'DEVELOPMENT', label: '开发' },
  { value: 'LEARNING', label: '学习' },
  { value: 'SHOPPING', label: '购物' },
  { value: 'DIET', label: '饮食' },
  { value: 'FITNESS', label: '健身' },
  { value: 'ENTERTAINMENT', label: '娱乐' },
  { value: 'GENERIC', label: '通用' },
] as const;

type CategoryModuleType = (typeof categoryTemplateOptions)[number]['value'];

interface CategoryCreateInput {
  readonly parentArea: 'WORK' | 'LIFE';
  readonly moduleType: CategoryModuleType;
  readonly name: string;
}

export const CategoryCreateForm = ({
  onCreate,
  isPending = false,
}: {
  readonly onCreate: (input: CategoryCreateInput, onSuccess: () => void) => void;
  readonly isPending?: boolean;
}) => {
  const [name, setName] = useState('');
  const [parentArea, setParentArea] = useState<'WORK' | 'LIFE'>('WORK');
  const [moduleType, setModuleType] = useState<CategoryModuleType>('GENERIC');

  return (
    <form
      className="inline-create"
      onSubmit={(event) => {
        event.preventDefault();
        onCreate({ parentArea, moduleType, name }, () => {
          setName('');
        });
      }}
    >
      <select
        aria-label="所属区域"
        value={parentArea}
        onChange={(event) => {
          setParentArea(event.target.value as 'WORK' | 'LIFE');
        }}
      >
        <option value="WORK">工作</option>
        <option value="LIFE">生活</option>
      </select>
      <select
        aria-label="分类模板"
        value={moduleType}
        onChange={(event) => {
          setModuleType(event.target.value as CategoryModuleType);
        }}
      >
        {categoryTemplateOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <input
        aria-label="新分类名称"
        value={name}
        onChange={(event) => {
          setName(event.target.value);
        }}
        placeholder="新分类名称"
        required
      />
      <button className="button" type="submit" disabled={isPending}>
        新增分类
      </button>
    </form>
  );
};

type SettingsSectionId =
  'general' | 'ai' | 'schedule' | 'reminders' | 'data' | 'categories' | 'advanced' | 'about';

const settingsNavigation: readonly {
  readonly id: SettingsSectionId;
  readonly label: string;
  readonly group: 'primary' | 'secondary';
}[] = [
  { id: 'general', label: '常规', group: 'primary' },
  { id: 'ai', label: 'AI 与模型', group: 'primary' },
  { id: 'schedule', label: '作息与日历', group: 'primary' },
  { id: 'reminders', label: '提醒', group: 'primary' },
  { id: 'data', label: '数据与备份', group: 'primary' },
  { id: 'categories', label: '分类与标签', group: 'primary' },
  { id: 'advanced', label: '高级', group: 'secondary' },
  { id: 'about', label: '关于', group: 'secondary' },
];

const EditableName = ({
  record,
  onSave,
}: {
  record: EditableRecord;
  onSave: (name: string) => void;
}) => {
  const [name, setName] = useState(record.name);
  return (
    <div className="inline-edit">
      <input
        value={name}
        onChange={(event) => {
          setName(event.target.value);
        }}
        aria-label={`重命名 ${record.name}`}
      />
      <button
        className="button button--small"
        type="button"
        disabled={name.trim() === '' || name === record.name}
        onClick={() => {
          onSave(name);
        }}
      >
        保存名称
      </button>
    </div>
  );
};

export const SettingsPage = () => {
  const setup = useSetupStatus();
  const settings = useSettings();
  const systemStatus = useSystemStatus();
  const categories = useCategories();
  const tags = useTags();
  const saveSettings = useSaveSettings();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const archiveCategory = useArchiveCategory();
  const reorderCategories = useReorderCategories();
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();
  const deleteTagPreview = usePreviewDeleteTag();
  const backup = useCreateBackup();
  const demo = useDemoData();
  const clearDemoPreview = usePreviewClearDemoData();
  const clearDemo = useClearDemoData();
  const backups = useBackups();
  const restorePreview = usePreviewBackupRestore();
  const restoreBackup = useExecuteBackupRestore();
  const migrationPreview = usePreviewDataDirectoryMigration();
  const migration = useExecuteDataDirectoryMigration();
  const clearMemoryPreview = usePreviewClearAiMemory();
  const clearMemory = useClearAiMemory();
  const [holidayYear, setHolidayYear] = useState(new Date().getFullYear());
  const holidays = useHolidays(holidayYear);
  const updateHolidays = useUpdateHolidays();
  const removeHolidayOverride = useRemoveHolidayOverride();
  const [formOverrides, setForm] = useState<Record<string, string | number | boolean>>({});
  const [newTag, setNewTag] = useState('');
  const [migrationPath, setMigrationPath] = useState('');
  const [restorePath, setRestorePath] = useState('');
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('general');

  if (setup.isLoading) return <main className="page">正在读取本地配置…</main>;
  if (!setup.data?.initialized) return <SetupPage />;

  const storedForm = Object.fromEntries(
    (settings.data ?? []).map((setting) => [setting.key, setting.value]),
  ) as Record<string, string | number | boolean>;
  const form = { ...storedForm, ...formOverrides };

  const addTag = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    createTag.mutate(newTag, {
      onSuccess: () => {
        setNewTag('');
      },
    });
  };

  const moveCategory = (area: 'WORK' | 'LIFE', id: string, direction: -1 | 1) => {
    if (categories.data === undefined) return;
    const areaItems = categories.data.data.filter((category) => category.parentArea === area);
    const index = areaItems.findIndex((category) => category.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= areaItems.length) return;
    const ids = areaItems.map((category) => category.id);
    const currentId = ids.at(index);
    const targetId = ids.at(target);
    const expectedOrderVersion = categories.data.meta.orderVersions[area];
    if (currentId === undefined || targetId === undefined || expectedOrderVersion === undefined)
      return;
    ids[index] = targetId;
    ids[target] = currentId;
    reorderCategories.mutate({
      parentArea: area,
      ids,
      expectedOrderVersion,
    });
  };

  return (
    <main className="page settings-page">
      <header className="page__header">
        <h1>设置</h1>
        <p>管理日常偏好、AI、提醒和本地数据。工程信息集中在高级设置中。</p>
      </header>

      <div className="settings-layout">
        <nav className="settings-navigation" aria-label="设置分类">
          {(['primary', 'secondary'] as const).map((group) => (
            <div className="settings-navigation__group" data-group={group} key={group}>
              {settingsNavigation
                .filter((item) => item.group === group)
                .map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    data-selected={activeSection === item.id}
                    aria-current={activeSection === item.id ? 'page' : undefined}
                    onClick={() => {
                      setActiveSection(item.id);
                    }}
                  >
                    {item.label}
                  </button>
                ))}
            </div>
          ))}
        </nav>

        <div className="settings-content">
          {activeSection === 'advanced' ? (
            <>
              <SystemStatusPanel />
              <DiagnosticsPanel />
            </>
          ) : null}

          {activeSection === 'ai' ? <AiProviderSettings /> : null}

          {activeSection === 'data' ? (
            <section className="settings-section" id="local-data">
              <div className="section-heading">
                <div>
                  <h2>本地数据</h2>
                  <p>{setup.data.dataDirectory}</p>
                </div>
                <button
                  className="button"
                  type="button"
                  disabled={backup.isPending}
                  onClick={() => {
                    backup.mutate();
                  }}
                >
                  {backup.isPending ? '正在备份…' : '立即备份'}
                </button>
              </div>
              {backup.data ? <p className="form-success">备份已生成：{backup.data.path}</p> : null}
              <div className="settings-grid settings-grid--compact">
                <label>
                  自动备份频率
                  <select
                    value={String(form['backup.frequency'] ?? 'WEEKLY')}
                    onChange={(event) => {
                      setForm((value) => ({ ...value, 'backup.frequency': event.target.value }));
                    }}
                  >
                    <option value="DAILY">每天</option>
                    <option value="WEEKLY">每周</option>
                    <option value="MANUAL">仅手动</option>
                  </select>
                </label>
                <label>
                  备份保留份数
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={Number(form['backup.retention_count'] ?? 8)}
                    onChange={(event) => {
                      setForm((value) => ({
                        ...value,
                        'backup.retention_count': Number(event.target.value),
                      }));
                    }}
                  />
                </label>
                <label className="settings-grid__wide">
                  自动备份目录
                  <input
                    type="text"
                    value={String(form['backup.destination'] ?? '')}
                    placeholder="留空表示使用数据目录内 backups 文件夹"
                    onChange={(event) => {
                      setForm((value) => ({ ...value, 'backup.destination': event.target.value }));
                    }}
                  />
                </label>
              </div>
              <button
                className="button button--primary"
                type="button"
                disabled={saveSettings.isPending}
                onClick={() => {
                  saveSettings.mutate(form);
                }}
              >
                保存备份设置
              </button>
              <div className="backup-history">
                <h3>最近备份</h3>
                {(backups.data ?? []).slice(0, 5).map((item) => (
                  <div className="backup-row" key={item.id}>
                    <div>
                      <strong>
                        {{
                          MANUAL: '手动备份',
                          SCHEDULED: '自动备份',
                          PRE_MIGRATION: '迁移前备份',
                          PRE_RESTORE: '恢复前备份',
                        }[item.backupType] ?? item.backupType}
                      </strong>
                      <span>
                        {{
                          RUNNING: '进行中',
                          SUCCEEDED: '已完成',
                          FAILED: '失败',
                          DELETED: '已清理',
                        }[item.status] ?? item.status}{' '}
                        · {formatDateTime(item.createdAt)}
                      </span>
                    </div>
                    <span>{item.path ?? '已轮换清理'}</span>
                  </div>
                ))}
              </div>
              <div className="settings-danger-zone">
                <div>
                  <p className="eyebrow">危险区域</p>
                  <h3>清理、恢复与迁移</h3>
                  <p>以下操作会移除或切换本地数据。系统会在恢复和迁移前保留可回退备份。</p>
                </div>
                <div className="migration-control">
                  <h3>演示数据</h3>
                  <p>
                    {demo.data?.exists
                      ? `当前有 ${String(demo.data.recordCount)} 条演示业务记录。清空不会删除你的真实数据、默认分类或设置。`
                      : '当前为干净空间，没有演示业务记录。'}
                  </p>
                  {demo.data?.exists ? (
                    <button
                      className="button button--danger"
                      type="button"
                      disabled={clearDemoPreview.isPending}
                      onClick={() => {
                        clearDemoPreview.mutate();
                      }}
                    >
                      清空演示数据
                    </button>
                  ) : null}
                  {clearDemoPreview.data ? (
                    <div className="confirmation-panel">
                      <p>
                        将永久移除 {String(clearDemoPreview.data.recordCount)}{' '}
                        条演示业务记录，此操作不会影响你自己创建的数据。
                      </p>
                      <button
                        className="button button--danger"
                        type="button"
                        disabled={clearDemo.isPending}
                        onClick={() => {
                          clearDemo.mutate({
                            confirmationId: clearDemoPreview.data.confirmation.id,
                            confirmationToken: clearDemoPreview.data.confirmation.token,
                          });
                        }}
                      >
                        {clearDemo.isPending ? '正在清空…' : '确认清空演示数据'}
                      </button>
                    </div>
                  ) : null}
                </div>
                <div className="migration-control">
                  <label htmlFor="restore-path">从完整备份恢复</label>
                  <div className="inline-create">
                    <input
                      id="restore-path"
                      value={restorePath}
                      onChange={(event) => {
                        setRestorePath(event.target.value);
                      }}
                      placeholder="输入 .lifeassistant-backup 文件路径"
                    />
                    <button
                      className="button"
                      type="button"
                      disabled={restorePath.trim() === '' || restorePreview.isPending}
                      onClick={() => {
                        restorePreview.mutate(restorePath);
                      }}
                    >
                      恢复预检
                    </button>
                  </div>
                  {restorePreview.data ? (
                    <div className="confirmation-panel">
                      <p>
                        备份生成于 {formatDateTime(restorePreview.data.generatedAt)}
                        ，Schema v{restorePreview.data.schemaVersion}，包含{' '}
                        {restorePreview.data.fileCount}{' '}
                        个受校验文件。执行前会自动创建当前数据的恢复前备份。
                      </p>
                      <button
                        className="button button--danger"
                        type="button"
                        disabled={restoreBackup.isPending}
                        onClick={() => {
                          restoreBackup.mutate({
                            path: restorePath,
                            confirmationId: restorePreview.data.confirmation.id,
                            confirmationToken: restorePreview.data.confirmation.token,
                          });
                        }}
                      >
                        {restoreBackup.isPending ? '正在恢复…' : '确认恢复并重启数据服务'}
                      </button>
                    </div>
                  ) : null}
                </div>
                <div className="migration-control">
                  <label htmlFor="migration-path">迁移到新数据目录</label>
                  <div className="inline-create">
                    <input
                      id="migration-path"
                      value={migrationPath}
                      onChange={(event) => {
                        setMigrationPath(event.target.value);
                      }}
                      placeholder="输入一个新的空目录路径"
                    />
                    <button
                      className="button"
                      type="button"
                      disabled={migrationPath.trim() === '' || migrationPreview.isPending}
                      onClick={() => {
                        migrationPreview.mutate(migrationPath);
                      }}
                    >
                      迁移预检
                    </button>
                  </div>
                  {migrationPreview.data ? (
                    <div className="confirmation-panel">
                      <p>
                        将复制 {migrationPreview.data.fileCount} 个文件，共{' '}
                        {Math.ceil(migrationPreview.data.totalBytes / 1024)}{' '}
                        KB。原目录会保留作为回退副本。
                      </p>
                      <button
                        className="button button--danger"
                        type="button"
                        disabled={migration.isPending}
                        onClick={() => {
                          migration.mutate({
                            dataDirectory: migrationPath,
                            confirmationId: migrationPreview.data.confirmation.id,
                            confirmationToken: migrationPreview.data.confirmation.token,
                          });
                        }}
                      >
                        {migration.isPending ? '正在迁移…' : '确认迁移并切换'}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}

          {activeSection === 'schedule' ? (
            <>
              <RoutineSettings />

              <section className="settings-section">
                <div className="section-heading">
                  <div>
                    <h2>中国法定节假日</h2>
                    <p>节假日影响作息模板的生效日；联网更新不会覆盖你手动维护的日期。</p>
                  </div>
                  <div className="inline-create">
                    <label>
                      年份
                      <input
                        type="number"
                        min="2000"
                        max="2100"
                        value={holidayYear}
                        onChange={(event) => {
                          setHolidayYear(Number(event.target.value));
                        }}
                      />
                    </label>
                    <button
                      className="button"
                      type="button"
                      disabled={updateHolidays.isPending}
                      onClick={() => {
                        updateHolidays.mutate(holidayYear);
                      }}
                    >
                      {updateHolidays.isPending ? '正在更新…' : '联网更新'}
                    </button>
                  </div>
                </div>
                {updateHolidays.isSuccess ? (
                  <p className="form-success">
                    已应用 {String(updateHolidays.data.applied)} 条安排
                    {updateHolidays.data.preservedUserOverrides > 0
                      ? `，保留 ${String(updateHolidays.data.preservedUserOverrides)} 条手动覆盖`
                      : ''}
                    。
                  </p>
                ) : null}
                {updateHolidays.isError ? (
                  <p className="form-error">节假日来源当前不可用，已保留本地数据。请稍后重试。</p>
                ) : null}
                {holidays.isLoading ? <p>正在读取节假日…</p> : null}
                {holidays.data && holidays.data.length === 0 ? (
                  <p className="field-hint">该年份暂无节假日数据，可点击“联网更新”获取。</p>
                ) : null}
                <ul className="record-list">
                  {(holidays.data ?? []).map((item) => (
                    <li className="record-row" key={item.localDate}>
                      <span className="record-meta">{item.localDate}</span>
                      <strong>{item.name}</strong>
                      <span className="record-meta">
                        {item.dayType === 'HOLIDAY' ? '假日' : '调休上班'}
                        {item.source === 'USER_OVERRIDE' ? ' · 手动维护' : ''}
                      </span>
                      {item.source === 'USER_OVERRIDE' ? (
                        <button
                          className="button button--small"
                          type="button"
                          disabled={removeHolidayOverride.isPending}
                          onClick={() => {
                            removeHolidayOverride.mutate(item.localDate);
                          }}
                        >
                          移除手动维护
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            </>
          ) : null}

          {activeSection === 'general' ? (
            <section className="settings-section">
              <div className="section-heading">
                <div>
                  <h2>基础偏好</h2>
                  <p>这些规则不依赖 AI。</p>
                </div>
              </div>
              <div className="settings-grid">
                <label>
                  每周起始日
                  <select
                    value={String(form['general.week_starts_on'] ?? 1)}
                    onChange={(event) => {
                      setForm((value) => ({
                        ...value,
                        'general.week_starts_on': Number(event.target.value),
                      }));
                    }}
                  >
                    <option value="1">周一</option>
                    <option value="7">周日</option>
                  </select>
                </label>
                <label>
                  快速记录默认动作
                  <select
                    value={String(form['quick_capture.default_action'] ?? 'INBOX')}
                    onChange={(event) => {
                      setForm((value) => ({
                        ...value,
                        'quick_capture.default_action': event.target.value,
                      }));
                    }}
                  >
                    <option value="INBOX">放入收集箱</option>
                    <option value="AI">交给 AI</option>
                  </select>
                </label>
              </div>
              <button
                className="button button--primary"
                type="button"
                disabled={saveSettings.isPending}
                onClick={() => {
                  saveSettings.mutate(form);
                }}
              >
                保存偏好
              </button>
            </section>
          ) : null}

          {activeSection === 'reminders' ? (
            <section className="settings-section">
              <div className="section-heading">
                <div>
                  <h2>提醒偏好</h2>
                  <p>设置新提醒默认提前多久触发。</p>
                </div>
              </div>
              <div className="settings-grid settings-grid--compact">
                <label>
                  默认提醒提前分钟
                  <input
                    type="number"
                    min="0"
                    max="10080"
                    value={Number(form['reminders.default_offset_minutes'] ?? 10)}
                    onChange={(event) => {
                      setForm((value) => ({
                        ...value,
                        'reminders.default_offset_minutes': Number(event.target.value),
                      }));
                    }}
                  />
                </label>
              </div>
              <button
                className="button button--primary"
                type="button"
                disabled={saveSettings.isPending}
                onClick={() => {
                  saveSettings.mutate(form);
                }}
              >
                保存提醒偏好
              </button>
            </section>
          ) : null}

          {activeSection === 'ai' ? (
            <section className="settings-section">
              <div className="section-heading">
                <div>
                  <h2>AI 数据</h2>
                  <p>长期记忆仅保存在本地，可随时一键清空全部记忆。</p>
                </div>
              </div>
              <div className="migration-control">
                <p>
                  {clearMemoryPreview.data !== undefined
                    ? `将移除 ${String(clearMemoryPreview.data.count)} 条已保存的长期记忆。`
                    : '清空后 AI 将不再使用此前保存的偏好与约束记忆。'}
                </p>
                {clearMemoryPreview.data === undefined && !clearMemory.isSuccess ? (
                  <button
                    className="button button--danger"
                    type="button"
                    disabled={clearMemoryPreview.isPending}
                    onClick={() => {
                      clearMemoryPreview.mutate();
                    }}
                  >
                    清空 AI 记忆
                  </button>
                ) : null}
                {clearMemoryPreview.data !== undefined && !clearMemory.isSuccess ? (
                  <div className="confirmation-panel">
                    <p>确认后立即删除全部长期记忆，此操作不可撤销。</p>
                    <button
                      className="button button--danger"
                      type="button"
                      disabled={clearMemory.isPending}
                      onClick={() => {
                        clearMemory.mutate({
                          confirmationId: clearMemoryPreview.data.confirmationId,
                          count: clearMemoryPreview.data.count,
                        });
                      }}
                    >
                      {clearMemory.isPending ? '正在清空…' : '确认清空全部记忆'}
                    </button>
                  </div>
                ) : null}
                {clearMemory.isSuccess ? (
                  <p className="form-success">已清空 {String(clearMemory.data.cleared)} 条记忆。</p>
                ) : null}
              </div>
            </section>
          ) : null}

          {activeSection === 'categories' ? (
            <>
              <section className="settings-section">
                <div className="section-heading">
                  <div>
                    <h2>分类</h2>
                    <p>专属模块可以重命名、排序和归档；新增分类时可选择业务模板。</p>
                  </div>
                </div>
                {(['WORK', 'LIFE'] as const).map((area) => (
                  <div className="record-group" key={area}>
                    <h3>{area === 'WORK' ? '工作分类' : '生活分类'}</h3>
                    <ul className="record-list">
                      {categories.data?.data
                        .filter((category) => category.parentArea === area)
                        .map((category, index, items) => (
                          <li
                            key={category.id}
                            className={
                              category.isArchived ? 'record-row record-row--muted' : 'record-row'
                            }
                          >
                            <EditableName
                              key={`${category.id}:${String(category.version)}`}
                              record={category}
                              onSave={(name) => {
                                updateCategory.mutate({
                                  id: category.id,
                                  expectedVersion: category.version,
                                  name,
                                });
                              }}
                            />
                            <span className="record-meta">
                              {category.moduleType === 'GENERIC' ? '通用' : '专属'}
                            </span>
                            <div className="row-actions">
                              <button
                                className="button button--small"
                                type="button"
                                disabled={index === 0}
                                onClick={() => {
                                  moveCategory(area, category.id, -1);
                                }}
                              >
                                上移
                              </button>
                              <button
                                className="button button--small"
                                type="button"
                                disabled={index === items.length - 1}
                                onClick={() => {
                                  moveCategory(area, category.id, 1);
                                }}
                              >
                                下移
                              </button>
                              <button
                                className="button button--small"
                                type="button"
                                onClick={() => {
                                  archiveCategory.mutate({
                                    id: category.id,
                                    expectedVersion: category.version,
                                    archive: !category.isArchived,
                                  });
                                }}
                              >
                                {category.isArchived ? '恢复' : '归档'}
                              </button>
                            </div>
                          </li>
                        ))}
                    </ul>
                  </div>
                ))}
                <CategoryCreateForm
                  isPending={createCategory.isPending}
                  onCreate={(input, onSuccess) => {
                    createCategory.mutate(input, { onSuccess });
                  }}
                />
              </section>

              <section className="settings-section">
                <div className="section-heading">
                  <div>
                    <h2>全局标签</h2>
                    <p>标签只用于关联和筛选，不改变事项归属。</p>
                  </div>
                </div>
                <ul className="record-list">
                  {tags.data?.map((tag) => (
                    <li className="record-row" key={tag.id}>
                      <EditableName
                        key={`${tag.id}:${String(tag.version)}`}
                        record={tag}
                        onSave={(name) => {
                          updateTag.mutate({ id: tag.id, expectedVersion: tag.version, name });
                        }}
                      />
                      {deleteTagPreview.data?.tagId === tag.id ? (
                        <div className="row-confirmation">
                          <span>{deleteTagPreview.data.summary}</span>
                          <button
                            className="button button--small button--danger"
                            type="button"
                            onClick={() => {
                              const preview = deleteTagPreview.data;
                              if (preview?.tagId !== tag.id) return;
                              deleteTag.mutate({
                                id: tag.id,
                                expectedVersion: tag.version,
                                confirmationId: preview.confirmation.id,
                                confirmationToken: preview.confirmation.token,
                              });
                            }}
                          >
                            确认删除
                          </button>
                        </div>
                      ) : (
                        <button
                          className="button button--small button--danger"
                          type="button"
                          onClick={() => {
                            deleteTagPreview.mutate({ id: tag.id, expectedVersion: tag.version });
                          }}
                        >
                          删除
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                <form className="inline-create" onSubmit={addTag}>
                  <input
                    value={newTag}
                    onChange={(event) => {
                      setNewTag(event.target.value);
                    }}
                    placeholder="新标签名称"
                    required
                  />
                  <button className="button" type="submit">
                    新增标签
                  </button>
                </form>
              </section>
            </>
          ) : null}

          {activeSection === 'about' ? (
            <section className="settings-section settings-about">
              <p className="eyebrow">ABOUT</p>
              <h2>生活助手 V2</h2>
              <p>一个本地优先、帮助你组织时间、工作与生活的个人生活操作系统。</p>
              <dl>
                <div>
                  <dt>应用版本</dt>
                  <dd>{systemStatus.data?.appVersion ?? '正在读取…'}</dd>
                </div>
                <div>
                  <dt>当前阶段</dt>
                  <dd>V2 收尾整合与体验修正</dd>
                </div>
                <div>
                  <dt>数据原则</dt>
                  <dd>业务数据保存在本机；模型密钥由 Windows 凭据管理器保存</dd>
                </div>
              </dl>
              <p className="field-hint">完整的服务、数据库与诊断状态可在“高级”中查看。</p>
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
};
