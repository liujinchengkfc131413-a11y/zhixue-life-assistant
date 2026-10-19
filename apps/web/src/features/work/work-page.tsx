import { Link } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useCategories } from '../settings/api.js';
import { formatDateTime } from '../../shared/format.js';
import { useFormDraft } from '../../shared/form-draft.js';
import { readEntityDetailTarget } from '../../shared/entity-detail-target.js';
import { LocalDateInput, ProductFilePicker } from '../../shared/product-fields.js';
import {
  useContents,
  useCreateContent,
  useTransitionContent,
  useCreateMetric,
  useWorkOverview,
  type WorkRange,
  useDevProjects,
  useCreateDevProject,
  useFeatures,
  useCreateFeature,
  useDefects,
  useCreateDefect,
  useRepositories,
  useCreateRepository,
  useLearningResources,
  useCreateLearningResource,
  useLearningSessions,
  useCreateLearningSession,
  useAttachments,
  useCreateMilestone,
  useDeleteContent,
  useDeleteDefect,
  useDeleteDevProject,
  useDeleteFeature,
  useDeleteLearningResource,
  useDeleteLearningSession,
  useDeleteMilestone,
  useDeleteNote,
  useDeleteRepository,
  useMilestones,
  useNotes,
  useSelfMediaTrend,
  useUnlinkAttachment,
  useUpdateContent,
  useUpdateDefect,
  useUpdateDevProject,
  useUpdateFeature,
  useUpdateLearningResource,
  useUpdateMilestone,
  useUploadAttachment,
} from './api.js';
import { NoteComposer } from './note-composer.js';

export type WorkSection = 'overview' | 'self-media' | 'development' | 'learning';
const links = [
  ['overview', '/work', '工作总览'],
  ['self-media', '/work/self-media', '自媒体'],
  ['development', '/work/development', '开发项目'],
  ['learning', '/work/learning', '学习'],
] as const;
const statusText: Record<string, string> = {
  IDEA: '灵感',
  PLANNING: '策划中',
  CREATING: '创作中',
  READY: '待发布',
  PUBLISHED: '已发布',
  ARCHIVED: '已归档',
  ACTIVE: '进行中',
  PAUSED: '暂停',
  COMPLETED: '已完成',
  IN_PROGRESS: '进行中',
  PLANNED: '计划中',
  BACKLOG: '待规划',
  DONE: '完成',
  OPEN: '待处理',
  CONFIRMED: '已确认',
  FIXING: '修复中',
  RESOLVED: '已解决',
  CLOSED: '已关闭',
  WONT_FIX: '不修复',
  ABANDONED: '已放弃',
  PENDING: '待达成',
  AT_RISK: '有风险',
  ACHIEVED: '已达成',
  MISSED: '已错过',
  CANCELLED: '已取消',
};

type ContentType = 'VIDEO' | 'ARTICLE' | 'AUDIO' | 'IMAGE' | 'OTHER';

interface SelfMediaCreateDraft {
  readonly title: string;
  readonly contentType: ContentType;
  readonly platform: string;
  readonly idea: string;
}

interface SelfMediaEditDraft {
  readonly title: string;
  readonly platform: string;
  readonly plannedPublishAt: string;
  readonly idea: string;
  readonly script: string;
}

interface SelfMediaEditableItem {
  readonly id: string;
  readonly version: number;
  readonly title: string;
  readonly plannedPublishAt: string | null;
  readonly idea: string | null;
  readonly script: string | null;
  readonly platform: string | null;
}

const contentTypes: readonly ContentType[] = ['VIDEO', 'ARTICLE', 'AUDIO', 'IMAGE', 'OTHER'];

const parseSelfMediaCreateDraft = (value: unknown): SelfMediaCreateDraft | undefined => {
  if (typeof value !== 'object' || value === null) return undefined;
  const draft = value as Record<string, unknown>;
  if (
    typeof draft.title !== 'string' ||
    typeof draft.contentType !== 'string' ||
    !contentTypes.includes(draft.contentType as ContentType) ||
    typeof draft.platform !== 'string' ||
    typeof draft.idea !== 'string'
  ) {
    return undefined;
  }
  return {
    title: draft.title,
    contentType: draft.contentType as ContentType,
    platform: draft.platform,
    idea: draft.idea,
  };
};

const parseSelfMediaEditDraft = (value: unknown): SelfMediaEditDraft | undefined => {
  if (typeof value !== 'object' || value === null) return undefined;
  const draft = value as Record<string, unknown>;
  if (
    typeof draft.title !== 'string' ||
    typeof draft.platform !== 'string' ||
    typeof draft.plannedPublishAt !== 'string' ||
    typeof draft.idea !== 'string' ||
    typeof draft.script !== 'string'
  ) {
    return undefined;
  }
  return {
    title: draft.title,
    platform: draft.platform,
    plannedPublishAt: draft.plannedPublishAt,
    idea: draft.idea,
    script: draft.script,
  };
};

export const SelfMediaCreateForm = ({
  visible,
  categoryId,
  isPending,
  onCreate,
  onClose,
}: {
  readonly visible: boolean;
  readonly categoryId?: string;
  readonly isPending: boolean;
  readonly onCreate: (
    input: SelfMediaCreateDraft & { categoryId: string },
    onSuccess: () => void,
  ) => void;
  readonly onClose: () => void;
}) => {
  const [title, setTitle] = useState('');
  const [contentType, setContentType] = useState<ContentType>('VIDEO');
  const [platform, setPlatform] = useState('');
  const [idea, setIdea] = useState('');
  const [dirty, setDirty] = useState(false);
  const [restoredAt, setRestoredAt] = useState<string>();
  const wasVisible = useRef(visible);
  const draftValue = useMemo(
    () => ({ title, contentType, platform, idea }),
    [contentType, idea, platform, title],
  );
  const restoreDraft = useCallback((draft: SelfMediaCreateDraft, updatedAt: string) => {
    setTitle(draft.title);
    setContentType(draft.contentType);
    setPlatform(draft.platform);
    setIdea(draft.idea);
    setDirty(true);
    setRestoredAt(updatedAt);
  }, []);
  const formDraft = useFormDraft({
    formType: 'SELF_MEDIA_CONTENT',
    mode: 'create',
    enabled: visible,
    dirty,
    value: draftValue,
    parse: parseSelfMediaCreateDraft,
    onRestore: restoreDraft,
  });

  const reset = useCallback(() => {
    setTitle('');
    setContentType('VIDEO');
    setPlatform('');
    setIdea('');
    setDirty(false);
    setRestoredAt(undefined);
  }, []);

  useEffect(() => {
    if (wasVisible.current && !visible) formDraft.saveNow();
    wasVisible.current = visible;
  }, [formDraft, visible]);

  if (!visible) return null;

  return (
    <form
      className="inline-work-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (categoryId === undefined) return;
        onCreate({ ...draftValue, categoryId }, () => {
          formDraft.clear();
          reset();
          onClose();
        });
      }}
    >
      {restoredAt === undefined ? null : (
        <p className="draft-restored">已恢复 {formatDateTime(restoredAt)} 的未保存草稿</p>
      )}
      <input
        aria-label="内容标题"
        placeholder="选题或内容标题"
        value={title}
        required
        onChange={(event) => {
          setTitle(event.target.value);
          setDirty(true);
        }}
      />
      <select
        aria-label="内容类型"
        value={contentType}
        onChange={(event) => {
          setContentType(event.target.value as ContentType);
          setDirty(true);
        }}
      >
        <option value="VIDEO">视频</option>
        <option value="ARTICLE">文章</option>
        <option value="AUDIO">音频</option>
        <option value="IMAGE">图文</option>
        <option value="OTHER">其他</option>
      </select>
      <input
        aria-label="发布平台"
        placeholder="发布平台（可选）"
        value={platform}
        onChange={(event) => {
          setPlatform(event.target.value);
          setDirty(true);
        }}
      />
      <textarea
        aria-label="选题灵感"
        placeholder="选题灵感"
        value={idea}
        onChange={(event) => {
          setIdea(event.target.value);
          setDirty(true);
        }}
      />
      <div className="form-actions">
        <button className="button button--primary" disabled={categoryId === undefined || isPending}>
          创建内容
        </button>
        {dirty || formDraft.hasDraft ? (
          <button
            className="button"
            type="button"
            onClick={() => {
              formDraft.clear();
              reset();
              onClose();
            }}
          >
            丢弃草稿
          </button>
        ) : null}
      </div>
    </form>
  );
};

export const SelfMediaContentEditor = ({
  item,
  isPending,
  onSave,
  onDelete,
}: {
  readonly item: SelfMediaEditableItem;
  readonly isPending: boolean;
  readonly onSave: (
    input: SelfMediaEditDraft & { id: string; version: number },
    onSuccess: () => void,
  ) => void;
  readonly onDelete: (input: { id: string; version: number }, onSuccess: () => void) => void;
}) => {
  const [title, setTitle] = useState(item.title);
  const [platform, setPlatform] = useState(item.platform ?? '');
  const [plannedPublishAt, setPlannedPublishAt] = useState(
    item.plannedPublishAt?.slice(0, 10) ?? '',
  );
  const [idea, setIdea] = useState(item.idea ?? '');
  const [script, setScript] = useState(item.script ?? '');
  const [dirty, setDirty] = useState(false);
  const [restoredAt, setRestoredAt] = useState<string>();
  const draftValue = useMemo(
    () => ({ title, platform, plannedPublishAt, idea, script }),
    [idea, plannedPublishAt, platform, script, title],
  );
  const restoreDraft = useCallback((draft: SelfMediaEditDraft, updatedAt: string) => {
    setTitle(draft.title);
    setPlatform(draft.platform);
    setPlannedPublishAt(draft.plannedPublishAt);
    setIdea(draft.idea);
    setScript(draft.script);
    setDirty(true);
    setRestoredAt(updatedAt);
  }, []);
  const formDraft = useFormDraft({
    formType: 'SELF_MEDIA_CONTENT',
    mode: 'edit',
    entityId: item.id,
    enabled: true,
    dirty,
    value: draftValue,
    parse: parseSelfMediaEditDraft,
    onRestore: restoreDraft,
  });

  return (
    <form
      className="compact-form compact-form--flush"
      data-version={item.version}
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ ...draftValue, id: item.id, version: item.version }, () => {
          formDraft.clear();
          setDirty(false);
          setRestoredAt(undefined);
        });
      }}
    >
      <h2>内容详情</h2>
      {restoredAt === undefined ? null : (
        <p className="draft-restored">已恢复 {formatDateTime(restoredAt)} 的未保存草稿</p>
      )}
      <input
        aria-label="编辑内容标题"
        value={title}
        required
        onChange={(event) => {
          setTitle(event.target.value);
          setDirty(true);
        }}
      />
      <input
        aria-label="编辑发布平台"
        value={platform}
        placeholder="平台"
        onChange={(event) => {
          setPlatform(event.target.value);
          setDirty(true);
        }}
      />
      <LocalDateInput
        aria-label="计划发布日期"
        value={plannedPublishAt}
        onChange={(event) => {
          setPlannedPublishAt(event.target.value);
          setDirty(true);
        }}
      />
      <textarea
        aria-label="编辑选题说明"
        value={idea}
        placeholder="选题说明"
        onChange={(event) => {
          setIdea(event.target.value);
          setDirty(true);
        }}
      />
      <textarea
        aria-label="编辑脚本正文"
        value={script}
        placeholder="脚本正文"
        onChange={(event) => {
          setScript(event.target.value);
          setDirty(true);
        }}
      />
      <div className="form-actions">
        <button className="button button--primary" disabled={isPending}>
          保存修改
        </button>
        {dirty || formDraft.hasDraft ? (
          <button
            className="button"
            type="button"
            onClick={() => {
              formDraft.clear();
              setTitle(item.title);
              setPlatform(item.platform ?? '');
              setPlannedPublishAt(item.plannedPublishAt?.slice(0, 10) ?? '');
              setIdea(item.idea ?? '');
              setScript(item.script ?? '');
              setDirty(false);
              setRestoredAt(undefined);
            }}
          >
            丢弃草稿
          </button>
        ) : null}
        <button
          type="button"
          className="button button--danger"
          onClick={() => {
            if (window.confirm('确定删除这条内容？')) {
              onDelete({ id: item.id, version: item.version }, formDraft.clear);
            }
          }}
        >
          删除
        </button>
      </div>
    </form>
  );
};

type DevProjectStatus = 'PLANNING' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';

interface DevProjectCreateDraft {
  readonly name: string;
  readonly summary: string;
}

interface DevProjectEditDraft extends DevProjectCreateDraft {
  readonly status: DevProjectStatus;
  readonly targetDate: string;
}

interface DevProjectEditableItem {
  readonly id: string;
  readonly version: number;
  readonly name: string;
  readonly summary: string | null;
  readonly status: DevProjectStatus;
  readonly targetDate: string | null;
}

const devProjectStatuses: readonly DevProjectStatus[] = [
  'PLANNING',
  'ACTIVE',
  'PAUSED',
  'COMPLETED',
  'ARCHIVED',
];

const parseDevProjectCreateDraft = (value: unknown): DevProjectCreateDraft | undefined => {
  if (typeof value !== 'object' || value === null) return undefined;
  const draft = value as Record<string, unknown>;
  if (typeof draft.name !== 'string' || typeof draft.summary !== 'string') return undefined;
  return { name: draft.name, summary: draft.summary };
};

const parseDevProjectEditDraft = (value: unknown): DevProjectEditDraft | undefined => {
  if (typeof value !== 'object' || value === null) return undefined;
  const draft = value as Record<string, unknown>;
  if (
    typeof draft.name !== 'string' ||
    typeof draft.summary !== 'string' ||
    typeof draft.status !== 'string' ||
    !devProjectStatuses.includes(draft.status as DevProjectStatus) ||
    typeof draft.targetDate !== 'string'
  ) {
    return undefined;
  }
  return {
    name: draft.name,
    summary: draft.summary,
    status: draft.status as DevProjectStatus,
    targetDate: draft.targetDate,
  };
};

export const DevProjectCreateForm = ({
  categoryId,
  isPending,
  onCreate,
}: {
  readonly categoryId?: string;
  readonly isPending: boolean;
  readonly onCreate: (
    input: DevProjectCreateDraft & { categoryId: string },
    onSuccess: () => void,
  ) => void;
}) => {
  const [name, setName] = useState('');
  const [summary, setSummary] = useState('');
  const [dirty, setDirty] = useState(false);
  const [restoredAt, setRestoredAt] = useState<string>();
  const draftValue = useMemo(() => ({ name, summary }), [name, summary]);
  const restoreDraft = useCallback((draft: DevProjectCreateDraft, updatedAt: string) => {
    setName(draft.name);
    setSummary(draft.summary);
    setDirty(true);
    setRestoredAt(updatedAt);
  }, []);
  const formDraft = useFormDraft({
    formType: 'DEV_PROJECT',
    mode: 'create',
    enabled: true,
    dirty,
    value: draftValue,
    parse: parseDevProjectCreateDraft,
    onRestore: restoreDraft,
  });

  const reset = () => {
    setName('');
    setSummary('');
    setDirty(false);
    setRestoredAt(undefined);
  };

  return (
    <form
      className="inline-work-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (categoryId === undefined) return;
        onCreate({ ...draftValue, categoryId }, () => {
          formDraft.clear();
          reset();
        });
      }}
    >
      {restoredAt === undefined ? null : (
        <p className="draft-restored">已恢复 {formatDateTime(restoredAt)} 的未保存草稿</p>
      )}
      <input
        aria-label="新项目名称"
        placeholder="新项目名称"
        value={name}
        required
        onChange={(event) => {
          setName(event.target.value);
          setDirty(true);
        }}
      />
      <input
        aria-label="新项目概览"
        placeholder="一句话概览"
        value={summary}
        onChange={(event) => {
          setSummary(event.target.value);
          setDirty(true);
        }}
      />
      <div className="form-actions">
        <button className="button button--primary" disabled={categoryId === undefined || isPending}>
          新增项目
        </button>
        {dirty || formDraft.hasDraft ? (
          <button
            className="button"
            type="button"
            onClick={() => {
              formDraft.clear();
              reset();
            }}
          >
            丢弃草稿
          </button>
        ) : null}
      </div>
    </form>
  );
};

export const DevProjectEditor = ({
  project,
  isPending,
  onSave,
  onDelete,
}: {
  readonly project: DevProjectEditableItem;
  readonly isPending: boolean;
  readonly onSave: (
    input: DevProjectEditDraft & { id: string; version: number },
    onSuccess: () => void,
  ) => void;
  readonly onDelete: (input: { id: string; version: number }, onSuccess: () => void) => void;
}) => {
  const [name, setName] = useState(project.name);
  const [summary, setSummary] = useState(project.summary ?? '');
  const [status, setStatus] = useState<DevProjectStatus>(project.status);
  const [targetDate, setTargetDate] = useState(project.targetDate ?? '');
  const [dirty, setDirty] = useState(false);
  const [restoredAt, setRestoredAt] = useState<string>();
  const draftValue = useMemo(
    () => ({ name, summary, status, targetDate }),
    [name, status, summary, targetDate],
  );
  const restoreDraft = useCallback((draft: DevProjectEditDraft, updatedAt: string) => {
    setName(draft.name);
    setSummary(draft.summary);
    setStatus(draft.status);
    setTargetDate(draft.targetDate);
    setDirty(true);
    setRestoredAt(updatedAt);
  }, []);
  const formDraft = useFormDraft({
    formType: 'DEV_PROJECT',
    mode: 'edit',
    entityId: project.id,
    enabled: true,
    dirty,
    value: draftValue,
    parse: parseDevProjectEditDraft,
    onRestore: restoreDraft,
  });

  const reset = () => {
    setName(project.name);
    setSummary(project.summary ?? '');
    setStatus(project.status);
    setTargetDate(project.targetDate ?? '');
    setDirty(false);
    setRestoredAt(undefined);
  };

  return (
    <form
      className="project-edit"
      data-version={project.version}
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ ...draftValue, id: project.id, version: project.version }, () => {
          formDraft.clear();
          setDirty(false);
          setRestoredAt(undefined);
        });
      }}
    >
      {restoredAt === undefined ? null : (
        <p className="draft-restored">已恢复 {formatDateTime(restoredAt)} 的未保存草稿</p>
      )}
      <input
        aria-label="编辑项目名称"
        value={name}
        required
        onChange={(event) => {
          setName(event.target.value);
          setDirty(true);
        }}
      />
      <textarea
        aria-label="编辑项目概览"
        value={summary}
        placeholder="项目概览"
        onChange={(event) => {
          setSummary(event.target.value);
          setDirty(true);
        }}
      />
      <select
        aria-label="编辑项目状态"
        value={status}
        onChange={(event) => {
          setStatus(event.target.value as DevProjectStatus);
          setDirty(true);
        }}
      >
        {devProjectStatuses.map((value) => (
          <option key={value} value={value}>
            {statusText[value]}
          </option>
        ))}
      </select>
      <LocalDateInput
        aria-label="编辑项目目标日期"
        value={targetDate}
        onChange={(event) => {
          setTargetDate(event.target.value);
          setDirty(true);
        }}
      />
      <div className="form-actions">
        <button className="button button--primary" disabled={isPending}>
          保存项目
        </button>
        {dirty || formDraft.hasDraft ? (
          <button
            className="button"
            type="button"
            onClick={() => {
              formDraft.clear();
              reset();
            }}
          >
            丢弃草稿
          </button>
        ) : null}
        <button
          type="button"
          className="button button--danger"
          onClick={() => {
            if (window.confirm('确定删除这个开发项目？')) {
              onDelete({ id: project.id, version: project.version }, formDraft.clear);
            }
          }}
        >
          删除项目
        </button>
      </div>
    </form>
  );
};

type LearningResourceType = 'COURSE' | 'BOOK' | 'ARTICLE' | 'VIDEO' | 'DOCUMENT';
type LearningResourceStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'PAUSED' | 'ABANDONED';

interface LearningResourceCreateDraft {
  readonly title: string;
  readonly resourceType: LearningResourceType;
}

interface LearningResourceEditDraft {
  readonly title: string;
  readonly author: string;
  readonly status: LearningResourceStatus;
  readonly progressCurrent: string;
  readonly progressTotal: string;
  readonly progressUnit: string;
}

interface LearningResourceEditableItem {
  readonly id: string;
  readonly version: number;
  readonly title: string;
  readonly author: string | null;
  readonly status: LearningResourceStatus;
  readonly progressCurrent: number | null;
  readonly progressTotal: number | null;
  readonly progressUnit: string | null;
}

const learningResourceTypes: readonly LearningResourceType[] = [
  'COURSE',
  'BOOK',
  'ARTICLE',
  'VIDEO',
  'DOCUMENT',
];
const learningResourceStatuses: readonly LearningResourceStatus[] = [
  'PLANNED',
  'IN_PROGRESS',
  'COMPLETED',
  'PAUSED',
  'ABANDONED',
];

const parseLearningResourceCreateDraft = (
  value: unknown,
): LearningResourceCreateDraft | undefined => {
  if (typeof value !== 'object' || value === null) return undefined;
  const draft = value as Record<string, unknown>;
  if (
    typeof draft.title !== 'string' ||
    typeof draft.resourceType !== 'string' ||
    !learningResourceTypes.includes(draft.resourceType as LearningResourceType)
  ) {
    return undefined;
  }
  return { title: draft.title, resourceType: draft.resourceType as LearningResourceType };
};

const parseLearningResourceEditDraft = (value: unknown): LearningResourceEditDraft | undefined => {
  if (typeof value !== 'object' || value === null) return undefined;
  const draft = value as Record<string, unknown>;
  if (
    typeof draft.title !== 'string' ||
    typeof draft.author !== 'string' ||
    typeof draft.status !== 'string' ||
    !learningResourceStatuses.includes(draft.status as LearningResourceStatus) ||
    typeof draft.progressCurrent !== 'string' ||
    typeof draft.progressTotal !== 'string' ||
    typeof draft.progressUnit !== 'string'
  ) {
    return undefined;
  }
  return {
    title: draft.title,
    author: draft.author,
    status: draft.status as LearningResourceStatus,
    progressCurrent: draft.progressCurrent,
    progressTotal: draft.progressTotal,
    progressUnit: draft.progressUnit,
  };
};

export const LearningResourceCreateForm = ({
  categoryId,
  isPending,
  onCreate,
}: {
  readonly categoryId?: string;
  readonly isPending: boolean;
  readonly onCreate: (
    input: LearningResourceCreateDraft & { categoryId: string },
    onSuccess: () => void,
  ) => void;
}) => {
  const [title, setTitle] = useState('');
  const [resourceType, setResourceType] = useState<LearningResourceType>('COURSE');
  const [dirty, setDirty] = useState(false);
  const [restoredAt, setRestoredAt] = useState<string>();
  const draftValue = useMemo(() => ({ title, resourceType }), [resourceType, title]);
  const restoreDraft = useCallback((draft: LearningResourceCreateDraft, updatedAt: string) => {
    setTitle(draft.title);
    setResourceType(draft.resourceType);
    setDirty(true);
    setRestoredAt(updatedAt);
  }, []);
  const formDraft = useFormDraft({
    formType: 'LEARNING_RESOURCE',
    mode: 'create',
    enabled: true,
    dirty,
    value: draftValue,
    parse: parseLearningResourceCreateDraft,
    onRestore: restoreDraft,
  });

  const reset = () => {
    setTitle('');
    setResourceType('COURSE');
    setDirty(false);
    setRestoredAt(undefined);
  };

  return (
    <form
      className="inline-work-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (categoryId === undefined) return;
        onCreate({ ...draftValue, categoryId }, () => {
          formDraft.clear();
          reset();
        });
      }}
    >
      {restoredAt === undefined ? null : (
        <p className="draft-restored">已恢复 {formatDateTime(restoredAt)} 的未保存草稿</p>
      )}
      <input
        aria-label="新学习资源名称"
        placeholder="新增学习资源"
        value={title}
        required
        onChange={(event) => {
          setTitle(event.target.value);
          setDirty(true);
        }}
      />
      <select
        aria-label="新学习资源类型"
        value={resourceType}
        onChange={(event) => {
          setResourceType(event.target.value as LearningResourceType);
          setDirty(true);
        }}
      >
        <option value="COURSE">课程</option>
        <option value="BOOK">书籍</option>
        <option value="ARTICLE">文章</option>
        <option value="VIDEO">视频</option>
        <option value="DOCUMENT">资料</option>
      </select>
      <div className="form-actions">
        <button className="button button--primary" disabled={categoryId === undefined || isPending}>
          新增
        </button>
        {dirty || formDraft.hasDraft ? (
          <button
            className="button"
            type="button"
            onClick={() => {
              formDraft.clear();
              reset();
            }}
          >
            丢弃草稿
          </button>
        ) : null}
      </div>
    </form>
  );
};

export const LearningResourceEditor = ({
  resource,
  isPending,
  onSave,
  onDelete,
}: {
  readonly resource: LearningResourceEditableItem;
  readonly isPending: boolean;
  readonly onSave: (
    input: LearningResourceEditDraft & { id: string; version: number },
    onSuccess: () => void,
  ) => void;
  readonly onDelete: (input: { id: string; version: number }, onSuccess: () => void) => void;
}) => {
  const [title, setTitle] = useState(resource.title);
  const [author, setAuthor] = useState(resource.author ?? '');
  const [status, setStatus] = useState<LearningResourceStatus>(resource.status);
  const [progressCurrent, setProgressCurrent] = useState(
    resource.progressCurrent === null ? '' : String(resource.progressCurrent),
  );
  const [progressTotal, setProgressTotal] = useState(
    resource.progressTotal === null ? '' : String(resource.progressTotal),
  );
  const [progressUnit, setProgressUnit] = useState(resource.progressUnit ?? '');
  const [dirty, setDirty] = useState(false);
  const [restoredAt, setRestoredAt] = useState<string>();
  const draftValue = useMemo(
    () => ({ title, author, status, progressCurrent, progressTotal, progressUnit }),
    [author, progressCurrent, progressTotal, progressUnit, status, title],
  );
  const restoreDraft = useCallback((draft: LearningResourceEditDraft, updatedAt: string) => {
    setTitle(draft.title);
    setAuthor(draft.author);
    setStatus(draft.status);
    setProgressCurrent(draft.progressCurrent);
    setProgressTotal(draft.progressTotal);
    setProgressUnit(draft.progressUnit);
    setDirty(true);
    setRestoredAt(updatedAt);
  }, []);
  const formDraft = useFormDraft({
    formType: 'LEARNING_RESOURCE',
    mode: 'edit',
    entityId: resource.id,
    enabled: true,
    dirty,
    value: draftValue,
    parse: parseLearningResourceEditDraft,
    onRestore: restoreDraft,
  });

  const reset = () => {
    setTitle(resource.title);
    setAuthor(resource.author ?? '');
    setStatus(resource.status);
    setProgressCurrent(resource.progressCurrent === null ? '' : String(resource.progressCurrent));
    setProgressTotal(resource.progressTotal === null ? '' : String(resource.progressTotal));
    setProgressUnit(resource.progressUnit ?? '');
    setDirty(false);
    setRestoredAt(undefined);
  };

  return (
    <form
      className="compact-form compact-form--flush"
      data-version={resource.version}
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ ...draftValue, id: resource.id, version: resource.version }, () => {
          formDraft.clear();
          setDirty(false);
          setRestoredAt(undefined);
        });
      }}
    >
      <h2>学习资源详情</h2>
      {restoredAt === undefined ? null : (
        <p className="draft-restored">已恢复 {formatDateTime(restoredAt)} 的未保存草稿</p>
      )}
      <input
        aria-label="编辑学习资源名称"
        value={title}
        required
        onChange={(event) => {
          setTitle(event.target.value);
          setDirty(true);
        }}
      />
      <input
        aria-label="编辑作者或讲师"
        value={author}
        placeholder="作者 / 讲师"
        onChange={(event) => {
          setAuthor(event.target.value);
          setDirty(true);
        }}
      />
      <select
        aria-label="编辑学习资源状态"
        value={status}
        onChange={(event) => {
          setStatus(event.target.value as LearningResourceStatus);
          setDirty(true);
        }}
      >
        {learningResourceStatuses.map((value) => (
          <option key={value} value={value}>
            {statusText[value]}
          </option>
        ))}
      </select>
      <div className="form-grid">
        <input
          aria-label="编辑当前进度"
          type="number"
          min="0"
          step="0.1"
          value={progressCurrent}
          placeholder="当前进度"
          onChange={(event) => {
            setProgressCurrent(event.target.value);
            setDirty(true);
          }}
        />
        <input
          aria-label="编辑总进度"
          type="number"
          min="0.1"
          step="0.1"
          value={progressTotal}
          placeholder="总进度"
          onChange={(event) => {
            setProgressTotal(event.target.value);
            setDirty(true);
          }}
        />
        <input
          aria-label="编辑进度单位"
          value={progressUnit}
          placeholder="单位"
          onChange={(event) => {
            setProgressUnit(event.target.value);
            setDirty(true);
          }}
        />
      </div>
      <div className="form-actions">
        <button className="button button--primary" disabled={isPending}>
          保存资源
        </button>
        {dirty || formDraft.hasDraft ? (
          <button
            className="button"
            type="button"
            onClick={() => {
              formDraft.clear();
              reset();
            }}
          >
            丢弃草稿
          </button>
        ) : null}
        <button
          type="button"
          className="button button--danger"
          onClick={() => {
            if (window.confirm('确定删除这项学习资源？')) {
              onDelete({ id: resource.id, version: resource.version }, formDraft.clear);
            }
          }}
        >
          删除资源
        </button>
      </div>
    </form>
  );
};
const today = () => new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10);
const field = (form: FormData, name: string): string => {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
};
const optionalNumber = (form: FormData, name: string): number | null => {
  const value = field(form, name);
  return value === '' ? null : Number(value);
};
const WorkNav = ({ section }: { section: WorkSection }) => (
  <nav className="module-tabs work-tabs" aria-label="工作模块">
    {links.map(([id, to, label]) => (
      <Link key={id} to={to} className="work-tabs__link" data-selected={id === section}>
        {label}
      </Link>
    ))}
  </nav>
);
const ErrorLine = ({ error }: { error: Error | null }) =>
  error === null ? null : <p className="form-error">{error.message}</p>;

const RelatedKnowledge = ({
  entityId,
  categoryId,
  role,
  targetNoteId,
}: {
  entityId: string;
  categoryId: string;
  role: 'SCRIPT' | 'TECHNICAL' | 'KNOWLEDGE';
  targetNoteId?: string;
}) => {
  const notes = useNotes(entityId),
    deleteNote = useDeleteNote(),
    attachments = useAttachments(entityId),
    upload = useUploadAttachment(),
    unlink = useUnlinkAttachment();
  const [editingNoteId, setEditingNoteId] = useState<string | null>(targetNoteId ?? 'new');
  return (
    <section className="related-knowledge">
      <h3>笔记与附件</h3>
      <ul className="work-list">
        {notes.data?.map((note) => (
          <li key={note.id}>
            <button
              className="note-list__content"
              onClick={() => {
                setEditingNoteId(note.id);
              }}
              type="button"
            >
              <strong>{note.title}</strong>
              <small>{note.plainText || '空笔记'}</small>
            </button>
            <button
              className="text-button text-button--danger"
              onClick={() => {
                deleteNote.mutate({ id: `${entityId}:${note.id}`, version: note.version });
              }}
            >
              删除
            </button>
          </li>
        ))}
      </ul>
      {editingNoteId === null ? (
        <button
          className="button button--small"
          onClick={() => {
            setEditingNoteId('new');
          }}
          type="button"
        >
          新建笔记
        </button>
      ) : (
        <NoteComposer
          entityId={entityId}
          categoryId={categoryId}
          role={role}
          note={
            editingNoteId === 'new'
              ? undefined
              : notes.data?.find((item) => item.id === editingNoteId)
          }
          onDone={() => {
            setEditingNoteId(null);
          }}
        />
      )}
      <ul className="work-list attachment-list">
        {attachments.data?.map((item) => (
          <li key={item.id}>
            <a href={`/api/v1/attachments/${item.id}/content`} rel="noreferrer" target="_blank">
              {item.originalName}
            </a>
            <button
              className="text-button text-button--danger"
              onClick={() => {
                unlink.mutate({ entityId, attachmentId: item.id });
              }}
            >
              取消关联
            </button>
          </li>
        ))}
      </ul>
      <ProductFilePicker
        label="上传并关联附件"
        disabled={upload.isPending}
        onSelect={(file) => {
          upload.mutate({ entityId, file, role: role === 'SCRIPT' ? 'MATERIAL' : 'DOCUMENT' });
        }}
      />
    </section>
  );
};

const Overview = () => {
  const [range, setRange] = useState<WorkRange>('WEEK');
  const [from, setFrom] = useState(`${String(new Date().getFullYear())}-01-01`);
  const [to, setTo] = useState(today());
  const query = useWorkOverview(
    range,
    range === 'CUSTOM' ? from : undefined,
    range === 'CUSTOM' ? to : undefined,
  );
  const value = query.data;
  return (
    <>
      <div className="module-toolbar work-toolbar">
        <div className="range-control" aria-label="统计范围">
          {(['WEEK', 'MONTH', 'QUARTER', 'YEAR', 'CUSTOM'] as const).map((item) => (
            <button
              key={item}
              className="button button--small"
              data-selected={range === item}
              onClick={() => {
                setRange(item);
              }}
            >
              {
                (
                  {
                    WEEK: '本周',
                    MONTH: '本月',
                    QUARTER: '本季度',
                    YEAR: '本年',
                    CUSTOM: '自定义',
                  } as const
                )[item]
              }
            </button>
          ))}
        </div>
        {range === 'CUSTOM' && (
          <div className="date-range" aria-label="自定义统计日期">
            <LocalDateInput
              aria-label="开始日期"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
              }}
            />
            <span>至</span>
            <LocalDateInput
              aria-label="结束日期"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
              }}
            />
          </div>
        )}
        <span>
          {value?.range.from} — {value?.range.to}
        </span>
      </div>
      {query.isLoading ? (
        <p className="status-line">正在汇总工作数据…</p>
      ) : query.error ? (
        <ErrorLine error={query.error} />
      ) : (
        value && (
          <>
            <section className="metric-strip work-metrics" aria-label="工作核心指标">
              <article>
                <span>任务完成率</span>
                <strong>{value.tasks.completionRate}%</strong>
                <small>
                  {value.tasks.completed} / {value.tasks.total} 项
                </small>
              </article>
              <article>
                <span>逾期任务</span>
                <strong>{value.tasks.overdue}</strong>
                <small>可进入今日页调整</small>
              </article>
              <article>
                <span>学习投入</span>
                <strong>{value.learning.minutes}</strong>
                <small>分钟</small>
              </article>
              <article>
                <span>开放缺陷</span>
                <strong>{value.development.openDefects}</strong>
                <small>{value.development.criticalDefects} 个严重</small>
              </article>
            </section>
            <div className="work-overview-grid overview-grid">
              <section className="work-module module-surface">
                <div className="section-heading">
                  <h2>自媒体</h2>
                  <Link to="/work/self-media">进入明细</Link>
                </div>
                <p className="work-module__number">{value.selfMedia.published} 篇已发布</p>
                <dl>
                  <div>
                    <dt>内容总数</dt>
                    <dd>{value.selfMedia.contents}</dd>
                  </div>
                  <div>
                    <dt>播放 / 阅读</dt>
                    <dd>{value.selfMedia.views.toLocaleString('zh-CN')}</dd>
                  </div>
                </dl>
              </section>
              <section className="work-module module-surface">
                <div className="section-heading">
                  <h2>开发项目</h2>
                  <Link to="/work/development">进入明细</Link>
                </div>
                <p className="work-module__number">{value.development.projects} 个活跃项目</p>
                <dl>
                  <div>
                    <dt>功能完成率</dt>
                    <dd>{value.development.featureCompletionRate}%</dd>
                  </div>
                  <div>
                    <dt>严重缺陷</dt>
                    <dd>{value.development.criticalDefects}</dd>
                  </div>
                </dl>
              </section>
              <section className="work-module module-surface">
                <div className="section-heading">
                  <h2>学习</h2>
                  <Link to="/work/learning">进入明细</Link>
                </div>
                <p className="work-module__number">{value.learning.activeResources} 项正在学习</p>
                <dl>
                  <div>
                    <dt>投入时长</dt>
                    <dd>{value.learning.minutes} 分钟</dd>
                  </div>
                  <div>
                    <dt>完成资源</dt>
                    <dd>{value.learning.completedResources}</dd>
                  </div>
                </dl>
              </section>
            </div>
          </>
        )
      )}
    </>
  );
};

const SelfMedia = ({
  targetId,
  targetNoteId,
}: {
  readonly targetId?: string;
  readonly targetNoteId?: string;
}) => {
  const categories = useCategories().data?.data ?? [];
  const category = categories.find((x) => x.moduleType === 'SELF_MEDIA' && !x.isArchived);
  const [statusFilter, setStatusFilter] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');
  const [view, setView] = useState<'PIPELINE' | 'CALENDAR' | 'TREND'>('PIPELINE');
  const [showCreate, setShowCreate] = useState(false);
  const contents = useContents(statusFilter);
  const trend = useSelfMediaTrend('MONTH');
  const create = useCreateContent();
  const transition = useTransitionContent();
  const metric = useCreateMetric();
  const update = useUpdateContent();
  const remove = useDeleteContent();
  const [selected, setSelected] = useState<string | undefined>(targetId);
  const filtered =
    contents.data?.filter((x) => !platformFilter || x.platform === platformFilter) ?? [];
  const platforms = [
    ...new Set(contents.data?.map((x) => x.platform).filter(Boolean) ?? []),
  ] as string[];
  const selectedItem = filtered.find((x) => x.id === selected) ?? filtered[0];
  return (
    <div className="master-detail-layout work-split">
      <section>
        <div className="section-heading">
          <h2>内容管线</h2>
          <div className="row-actions">
            <span>{filtered.length} 条内容</span>
            <button
              className="button button--small"
              onClick={() => {
                setShowCreate((x) => !x);
              }}
            >
              {showCreate ? '收起' : '新增内容'}
            </button>
          </div>
        </div>
        <div className="work-filterbar">
          <select
            aria-label="内容状态筛选"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
            }}
          >
            <option value="">全部状态</option>
            {['IDEA', 'PLANNING', 'CREATING', 'READY', 'PUBLISHED', 'ARCHIVED'].map((x) => (
              <option key={x} value={x}>
                {statusText[x]}
              </option>
            ))}
          </select>
          <select
            aria-label="平台筛选"
            value={platformFilter}
            onChange={(e) => {
              setPlatformFilter(e.target.value);
            }}
          >
            <option value="">全部平台</option>
            {platforms.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <div className="range-control">
            {(['PIPELINE', 'CALENDAR', 'TREND'] as const).map((x) => (
              <button
                key={x}
                className="button button--small"
                data-selected={view === x}
                onClick={() => {
                  setView(x);
                }}
              >
                {x === 'PIPELINE' ? '管线' : x === 'CALENDAR' ? '日历' : '趋势'}
              </button>
            ))}
          </div>
        </div>
        <SelfMediaCreateForm
          visible={showCreate}
          {...(category === undefined ? {} : { categoryId: category.id })}
          isPending={create.isPending}
          onClose={() => {
            setShowCreate(false);
          }}
          onCreate={(input, onSuccess) => {
            create.mutate(input, { onSuccess });
          }}
        />
        {view === 'PIPELINE' ? (
          <div className="pipeline">
            {(['IDEA', 'PLANNING', 'CREATING', 'READY', 'PUBLISHED'] as const).map((status) => (
              <div key={status}>
                <h3>{statusText[status]}</h3>
                {filtered
                  .filter((x) => x.productionStatus === status)
                  .map((item) => (
                    <button
                      className="pipeline-item"
                      data-selected={selectedItem?.id === item.id}
                      key={item.id}
                      onClick={() => {
                        setSelected(item.id);
                      }}
                    >
                      <strong>{item.title}</strong>
                      <span>{item.platform ?? '未指定平台'}</span>
                    </button>
                  ))}
              </div>
            ))}
          </div>
        ) : view === 'CALENDAR' ? (
          <div className="calendar-list">
            {filtered
              .filter((x) => x.plannedPublishAt !== null || x.publishedAt !== null)
              .sort((a, b) =>
                (a.plannedPublishAt ?? a.publishedAt ?? '').localeCompare(
                  b.plannedPublishAt ?? b.publishedAt ?? '',
                ),
              )
              .map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setSelected(item.id);
                  }}
                >
                  <time>{(item.plannedPublishAt ?? item.publishedAt)?.slice(0, 10)}</time>
                  <strong>{item.title}</strong>
                  <span>{statusText[item.productionStatus]}</span>
                </button>
              ))}
          </div>
        ) : (
          <div className="trend-chart" aria-label="近月内容表现趋势">
            {trend.data?.map((point) => (
              <div key={point.date}>
                <span>{point.date.slice(5)}</span>
                <i
                  style={{ height: `${String(Math.max(4, Math.min(120, point.views / 10)))}px` }}
                  title={`${String(point.views)} 播放`}
                />
                <strong>{point.views}</strong>
              </div>
            ))}
          </div>
        )}
      </section>
      <aside className="work-editor">
        {selectedItem ? (
          <>
            <SelfMediaContentEditor
              key={`${selectedItem.id}:${String(selectedItem.version)}`}
              item={selectedItem}
              isPending={update.isPending}
              onSave={(input, onSuccess) => {
                update.mutate(
                  {
                    id: input.id,
                    version: input.version,
                    title: input.title,
                    idea: input.idea || null,
                    script: input.script || null,
                    platform: input.platform || null,
                    plannedPublishAt:
                      input.plannedPublishAt === ''
                        ? null
                        : new Date(`${input.plannedPublishAt}T12:00:00+08:00`).toISOString(),
                  },
                  { onSuccess },
                );
              }}
              onDelete={(input, onSuccess) => {
                remove.mutate(input, {
                  onSuccess: () => {
                    onSuccess();
                    setSelected(undefined);
                  },
                });
              }}
            />
            <label>
              制作状态
              <select
                value={selectedItem.productionStatus}
                disabled={update.isPending || transition.isPending}
                onChange={(e) => {
                  transition.mutate({
                    id: selectedItem.id,
                    version: selectedItem.version,
                    status: e.target.value as typeof selectedItem.productionStatus,
                  });
                }}
              >
                {['IDEA', 'PLANNING', 'CREATING', 'READY', 'PUBLISHED', 'ARCHIVED'].map((x) => (
                  <option key={x} value={x}>
                    {statusText[x]}
                  </option>
                ))}
              </select>
            </label>
            <form
              className="compact-form"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                metric.mutate({
                  id: selectedItem.id,
                  recordedDate: field(form, 'date'),
                  platform: field(form, 'platform'),
                  views: optionalNumber(form, 'views'),
                  likes: optionalNumber(form, 'likes'),
                });
                e.currentTarget.reset();
              }}
            >
              <h3>录入表现</h3>
              <LocalDateInput name="date" defaultValue={today()} required />
              <input
                name="platform"
                placeholder="平台"
                defaultValue={selectedItem.platform ?? ''}
                required
              />
              <input name="views" type="number" min="0" placeholder="播放 / 阅读" />
              <input name="likes" type="number" min="0" placeholder="点赞" />
              <button className="button" type="submit">
                保存表现
              </button>
            </form>
            {category && (
              <RelatedKnowledge
                entityId={selectedItem.id}
                categoryId={category.id}
                role="SCRIPT"
                {...(targetNoteId === undefined ? {} : { targetNoteId })}
              />
            )}
          </>
        ) : (
          <p>新增或选择一条内容后编辑详情。</p>
        )}
      </aside>
    </div>
  );
};

const Development = ({
  targetId,
  targetNoteId,
}: {
  readonly targetId?: string;
  readonly targetNoteId?: string;
}) => {
  const categories = useCategories().data?.data ?? [];
  const category = categories.find((x) => x.moduleType === 'DEVELOPMENT' && !x.isArchived);
  const [statusFilter, setStatusFilter] = useState('');
  const projects = useDevProjects(statusFilter);
  const createProject = useCreateDevProject();
  const updateProject = useUpdateDevProject(),
    deleteProject = useDeleteDevProject();
  const [selected, setSelected] = useState<string | undefined>(targetId);
  const project = projects.data?.find((x) => x.id === selected) ?? projects.data?.[0];
  const features = useFeatures(project?.id),
    defects = useDefects(project?.id),
    repos = useRepositories(project?.id),
    milestones = useMilestones(project?.id);
  const createFeature = useCreateFeature(),
    createDefect = useCreateDefect(),
    createRepo = useCreateRepository(),
    createMilestone = useCreateMilestone(),
    updateFeature = useUpdateFeature(),
    deleteFeature = useDeleteFeature(),
    updateDefect = useUpdateDefect(),
    deleteDefect = useDeleteDefect(),
    deleteRepo = useDeleteRepository(),
    updateMilestone = useUpdateMilestone(),
    deleteMilestone = useDeleteMilestone();
  return (
    <div className="master-detail-layout work-split work-split--project">
      <section>
        <div className="section-heading">
          <h2>开发项目</h2>
          <span>{projects.data?.length ?? 0} 个</span>
        </div>
        <select
          className="list-filter"
          aria-label="项目状态筛选"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
          }}
        >
          <option value="">全部状态</option>
          {['PLANNING', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'].map((x) => (
            <option key={x} value={x}>
              {statusText[x]}
            </option>
          ))}
        </select>
        <div className="project-list">
          {projects.data?.map((item) => (
            <button
              key={item.id}
              data-selected={project?.id === item.id}
              onClick={() => {
                setSelected(item.id);
              }}
            >
              <strong>{item.name}</strong>
              <span>
                {statusText[item.status]} · {item.targetDate ?? '未设目标日期'}
              </span>
            </button>
          ))}
        </div>
        <DevProjectCreateForm
          {...(category === undefined ? {} : { categoryId: category.id })}
          isPending={createProject.isPending}
          onCreate={(input, onSuccess) => {
            createProject.mutate(input, { onSuccess });
          }}
        />
      </section>
      <aside className="project-detail">
        {project ? (
          <>
            <DevProjectEditor
              key={`${project.id}:${String(project.version)}`}
              project={project}
              isPending={updateProject.isPending}
              onSave={(input, onSuccess) => {
                updateProject.mutate(
                  {
                    id: input.id,
                    version: input.version,
                    name: input.name,
                    summary: input.summary || null,
                    status: input.status,
                    targetDate: input.targetDate || null,
                  },
                  { onSuccess },
                );
              }}
              onDelete={(input, onSuccess) => {
                deleteProject.mutate(input, {
                  onSuccess: () => {
                    onSuccess();
                    setSelected(undefined);
                  },
                });
              }}
            />
            <section>
              <h3>里程碑 · {milestones.data?.length ?? 0}</h3>
              <ul className="work-list">
                {milestones.data?.map((x) => (
                  <li key={x.id}>
                    <span>
                      {x.title}
                      <small>{x.dueAt.slice(0, 10)}</small>
                    </span>
                    <span className="row-actions">
                      <select
                        aria-label={`${x.title}状态`}
                        value={x.status}
                        onChange={(e) => {
                          updateMilestone.mutate({
                            id: x.id,
                            version: x.version,
                            status: e.target.value as typeof x.status,
                          });
                        }}
                      >
                        {['PENDING', 'AT_RISK', 'ACHIEVED', 'MISSED'].map((s) => (
                          <option key={s} value={s}>
                            {statusText[s]}
                          </option>
                        ))}
                      </select>
                      <button
                        className="text-button text-button--danger"
                        onClick={() => {
                          deleteMilestone.mutate({ id: x.id, version: x.version });
                        }}
                      >
                        删除
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
              <form
                className="quick-add"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  createMilestone.mutate({
                    projectId: project.id,
                    title: field(f, 'title'),
                    dueAt: new Date(`${field(f, 'date')}T18:00:00+08:00`).toISOString(),
                  });
                  e.currentTarget.reset();
                }}
              >
                <input name="title" placeholder="新增里程碑" required />
                <LocalDateInput name="date" required />
                <button className="button button--small">添加</button>
              </form>
            </section>
            <section>
              <h3>
                功能清单 · {features.data?.filter((x) => x.status === 'DONE').length ?? 0}/
                {features.data?.length ?? 0}
              </h3>
              <ul className="work-list">
                {features.data?.map((x) => (
                  <li key={x.id}>
                    <span>{x.title}</span>
                    <span className="row-actions">
                      <select
                        aria-label={`${x.title}状态`}
                        value={x.status}
                        onChange={(e) => {
                          updateFeature.mutate({
                            id: x.id,
                            version: x.version,
                            title: x.title,
                            status: e.target.value as typeof x.status,
                          });
                        }}
                      >
                        {['BACKLOG', 'PLANNED', 'IN_PROGRESS', 'DONE', 'CANCELLED'].map((s) => (
                          <option key={s} value={s}>
                            {statusText[s]}
                          </option>
                        ))}
                      </select>
                      <button
                        className="text-button text-button--danger"
                        onClick={() => {
                          deleteFeature.mutate({ id: x.id, version: x.version });
                        }}
                      >
                        删除
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
              <QuickAdd
                label="新增功能"
                onSubmit={(value) => {
                  createFeature.mutate({ projectId: project.id, title: value, priority: 'NORMAL' });
                }}
              />
            </section>
            <section>
              <h3>缺陷 · {defects.data?.length ?? 0}</h3>
              <ul className="work-list">
                {defects.data?.map((x) => (
                  <li key={x.id}>
                    <span>{x.title}</span>
                    <span className="row-actions">
                      <small data-severity={x.severity}>{x.severity}</small>
                      <select
                        aria-label={`${x.title}状态`}
                        value={x.status}
                        onChange={(e) => {
                          updateDefect.mutate({
                            id: x.id,
                            version: x.version,
                            title: x.title,
                            status: e.target.value as typeof x.status,
                            severity: x.severity,
                          });
                        }}
                      >
                        {['OPEN', 'CONFIRMED', 'FIXING', 'RESOLVED', 'CLOSED', 'WONT_FIX'].map(
                          (s) => (
                            <option key={s} value={s}>
                              {statusText[s]}
                            </option>
                          ),
                        )}
                      </select>
                      <button
                        className="text-button text-button--danger"
                        onClick={() => {
                          deleteDefect.mutate({ id: x.id, version: x.version });
                        }}
                      >
                        删除
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
              <QuickAdd
                label="记录缺陷"
                onSubmit={(value) => {
                  createDefect.mutate({ projectId: project.id, title: value, severity: 'MEDIUM' });
                }}
              />
            </section>
            <section>
              <h3>仓库链接</h3>
              <ul className="work-list">
                {repos.data?.map((x) => (
                  <li key={x.id}>
                    <a href={x.url} target="_blank" rel="noreferrer">
                      {x.name}
                    </a>
                    <span className="row-actions">
                      <small>仅安全打开，不抓取内容</small>
                      <button
                        className="text-button text-button--danger"
                        onClick={() => {
                          deleteRepo.mutate({ id: x.id, version: x.version });
                        }}
                      >
                        删除
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
              <form
                className="quick-add"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  createRepo.mutate({
                    projectId: project.id,
                    name: field(f, 'name'),
                    url: field(f, 'url'),
                  });
                  e.currentTarget.reset();
                }}
              >
                <input name="name" placeholder="链接名称" required />
                <input name="url" type="url" placeholder="https://…" required />
                <button className="button button--small">添加</button>
              </form>
            </section>
            {category && (
              <RelatedKnowledge
                entityId={project.id}
                categoryId={category.id}
                role="TECHNICAL"
                {...(targetNoteId === undefined ? {} : { targetNoteId })}
              />
            )}
          </>
        ) : (
          <p>创建一个项目后开始管理功能与缺陷。</p>
        )}
      </aside>
    </div>
  );
};

const QuickAdd = ({ label, onSubmit }: { label: string; onSubmit: (value: string) => void }) => (
  <form
    className="quick-add"
    onSubmit={(e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      onSubmit(field(f, 'value'));
      e.currentTarget.reset();
    }}
  >
    <input name="value" placeholder={label} required />
    <button className="button button--small">添加</button>
  </form>
);

const Learning = ({
  targetId,
  targetNoteId,
}: {
  readonly targetId?: string;
  readonly targetNoteId?: string;
}) => {
  const categories = useCategories().data?.data ?? [];
  const category = categories.find((x) => x.moduleType === 'LEARNING' && !x.isArchived);
  const [statusFilter, setStatusFilter] = useState('');
  const resources = useLearningResources(statusFilter);
  const sessions = useLearningSessions();
  const createResource = useCreateLearningResource(),
    createSession = useCreateLearningSession(),
    updateResource = useUpdateLearningResource(),
    deleteResource = useDeleteLearningResource(),
    deleteSession = useDeleteLearningSession();
  const [selected, setSelected] = useState<string | undefined>(targetId);
  const resource = resources.data?.find((x) => x.id === selected) ?? resources.data?.[0];
  const totalMinutes = sessions.data?.reduce((n, x) => n + x.durationMinutes, 0) ?? 0;
  return (
    <div className="learning-layout">
      <section className="metric-strip learning-summary">
        <div>
          <span>累计学习</span>
          <strong>{totalMinutes}</strong>
          <small>分钟</small>
        </div>
        <div>
          <span>进行中资源</span>
          <strong>{resources.data?.filter((x) => x.status === 'IN_PROGRESS').length ?? 0}</strong>
          <small>项</small>
        </div>
        <div>
          <span>完成资源</span>
          <strong>{resources.data?.filter((x) => x.status === 'COMPLETED').length ?? 0}</strong>
          <small>项</small>
        </div>
      </section>
      <div className="master-detail-layout work-split">
        <section>
          <div className="section-heading">
            <h2>课程 / 书籍 / 资料</h2>
            <select
              aria-label="学习状态筛选"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
              }}
            >
              <option value="">全部状态</option>
              {['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'PAUSED', 'ABANDONED'].map((x) => (
                <option key={x} value={x}>
                  {statusText[x]}
                </option>
              ))}
            </select>
          </div>
          <div className="resource-list">
            {resources.data?.map((x) => {
              const progress =
                x.progressCurrent !== null && x.progressTotal !== null
                  ? Math.round((x.progressCurrent / x.progressTotal) * 100)
                  : 0;
              return (
                <button
                  key={x.id}
                  data-selected={resource?.id === x.id}
                  onClick={() => {
                    setSelected(x.id);
                  }}
                >
                  <div>
                    <strong>{x.title}</strong>
                    <span>
                      {x.author ?? x.resourceType} · {statusText[x.status]}
                    </span>
                  </div>
                  <progress max="100" value={progress} />
                  <small>{progress}%</small>
                </button>
              );
            })}
          </div>
          <LearningResourceCreateForm
            {...(category === undefined ? {} : { categoryId: category.id })}
            isPending={createResource.isPending}
            onCreate={(input, onSuccess) => {
              createResource.mutate(input, { onSuccess });
            }}
          />
        </section>
        <aside className="work-editor">
          {resource ? (
            <>
              <LearningResourceEditor
                key={`${resource.id}:${String(resource.version)}`}
                resource={resource}
                isPending={updateResource.isPending}
                onSave={(input, onSuccess) => {
                  updateResource.mutate(
                    {
                      id: input.id,
                      version: input.version,
                      title: input.title,
                      author: input.author || null,
                      status: input.status,
                      progressCurrent:
                        input.progressCurrent === '' ? null : Number(input.progressCurrent),
                      progressTotal:
                        input.progressTotal === '' ? null : Number(input.progressTotal),
                      progressUnit: input.progressUnit || null,
                    },
                    { onSuccess },
                  );
                }}
                onDelete={(input, onSuccess) => {
                  deleteResource.mutate(input, {
                    onSuccess: () => {
                      onSuccess();
                      setSelected(undefined);
                    },
                  });
                }}
              />
              <form
                className="compact-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  createSession.mutate({
                    resourceId: resource.id,
                    sessionDate: field(f, 'date'),
                    durationMinutes: Number(f.get('minutes')),
                    progressDelta: optionalNumber(f, 'progress'),
                    summary: field(f, 'summary'),
                  });
                  e.currentTarget.reset();
                }}
              >
                <h3>记录本次学习</h3>
                <LocalDateInput name="date" defaultValue={today()} required />
                <input name="minutes" type="number" min="1" placeholder="学习分钟" required />
                <input name="progress" type="number" step="0.1" placeholder="进度增量（可选）" />
                <textarea name="summary" placeholder="知识摘要 / 学习笔记" />
                <button className="button button--primary">保存记录</button>
              </form>
              <h3>最近记录</h3>
              <ul className="work-list">
                {sessions.data
                  ?.filter((x) => x.resourceId === resource.id)
                  .slice(0, 5)
                  .map((x) => (
                    <li key={x.id}>
                      <span>
                        {x.sessionDate} · {x.durationMinutes} 分钟
                        <small>{x.summary ?? '无摘要'}</small>
                      </span>
                      <button
                        className="text-button text-button--danger"
                        onClick={() => {
                          deleteSession.mutate({ id: x.id, version: x.version });
                        }}
                      >
                        删除
                      </button>
                    </li>
                  ))}
              </ul>
              {category && (
                <RelatedKnowledge
                  entityId={resource.id}
                  categoryId={category.id}
                  role="KNOWLEDGE"
                  {...(targetNoteId === undefined ? {} : { targetNoteId })}
                />
              )}
            </>
          ) : (
            <p>先添加一项学习资源。</p>
          )}
        </aside>
      </div>
    </div>
  );
};

export const WorkPage = ({ section = 'overview' }: { section?: WorkSection }) => {
  const target = readEntityDetailTarget(window.location.search);
  return (
    <div className="page work-page" data-work-section={section}>
      <header className="page__header">
        <p className="page__context">工作</p>
        <h1>{links.find(([id]) => id === section)?.[2]}</h1>
        <p className="page__positioning">我的工作正在怎么进行？</p>
        <p>把内容创作、开发项目与学习投入放在同一套本地数据和时间系统中。</p>
      </header>
      <WorkNav section={section} />
      {section === 'overview' ? (
        <Overview />
      ) : section === 'self-media' ? (
        <SelfMedia
          {...(target?.entityType === 'SELF_MEDIA_CONTENT'
            ? {
                targetId: target.entityId,
                ...(target.noteId === undefined ? {} : { targetNoteId: target.noteId }),
              }
            : {})}
        />
      ) : section === 'development' ? (
        <Development
          {...(target?.entityType === 'DEV_PROJECT'
            ? {
                targetId: target.entityId,
                ...(target.noteId === undefined ? {} : { targetNoteId: target.noteId }),
              }
            : {})}
        />
      ) : (
        <Learning
          {...(target?.entityType === 'LEARNING_RESOURCE'
            ? {
                targetId: target.entityId,
                ...(target.noteId === undefined ? {} : { targetNoteId: target.noteId }),
              }
            : {})}
        />
      )}
    </div>
  );
};
