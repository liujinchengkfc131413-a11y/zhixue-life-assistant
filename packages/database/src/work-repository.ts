import { ulid } from 'ulid';

import { assertContentTransition, assertProgressRange } from '@life-assistant/domain';
import type { Clock } from '@life-assistant/kernel';

import { CanonicalHistoryRepository } from './canonical-history-repository.js';
import { ConsistencyRepository } from './consistency-repository.js';
import type { OperationContext } from './operation-context.js';
import type { CanonicalEntitySnapshot } from './snapshot-contract.js';
import type { SqliteDatabase } from './sqlite-database.js';

type Patch<T> = { [K in keyof T]?: T[K] | undefined };
type ContentStatus = 'IDEA' | 'PLANNING' | 'CREATING' | 'READY' | 'PUBLISHED' | 'ARCHIVED';
type DevProjectStatus = 'PLANNING' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';
type FeatureStatus = 'BACKLOG' | 'PLANNED' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
type DefectStatus = 'OPEN' | 'CONFIRMED' | 'FIXING' | 'RESOLVED' | 'CLOSED' | 'WONT_FIX';
type LearningStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'PAUSED' | 'ABANDONED';
type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface WorkEntity {
  id: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface SelfMediaContent extends WorkEntity {
  categoryId: string;
  title: string;
  idea: string | null;
  script: string | null;
  contentType: 'VIDEO' | 'ARTICLE' | 'AUDIO' | 'IMAGE' | 'OTHER';
  platform: string | null;
  productionStatus: ContentStatus;
  plannedPublishAt: string | null;
  publishedAt: string | null;
  calendarEventId: string | null;
  taskId: string | null;
}

export interface SelfMediaMetric extends WorkEntity {
  contentId: string;
  recordedDate: string;
  platform: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  favorites: number | null;
  shares: number | null;
  followerDelta: number | null;
  customMetrics: Record<string, number>;
}

export interface DevProject extends WorkEntity {
  categoryId: string;
  name: string;
  summary: string | null;
  status: DevProjectStatus;
  startDate: string | null;
  targetDate: string | null;
  planId: string | null;
}

export interface DevFeature extends WorkEntity {
  projectId: string;
  title: string;
  description: string | null;
  status: FeatureStatus;
  priority: Priority;
  taskId: string | null;
  milestoneId: string | null;
  sortOrder: number;
}

export interface DevDefect extends WorkEntity {
  projectId: string;
  featureId: string | null;
  taskId: string | null;
  title: string;
  description: string | null;
  reproductionSteps: string | null;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: DefectStatus;
  foundVersion: string | null;
  resolvedVersion: string | null;
  resolvedAt: string | null;
}

export interface RepositoryLink extends WorkEntity {
  projectId: string;
  name: string;
  url: string;
  description: string | null;
  sortOrder: number;
}

export interface LearningResource extends WorkEntity {
  categoryId: string;
  title: string;
  resourceType: 'COURSE' | 'BOOK' | 'ARTICLE' | 'VIDEO' | 'DOCUMENT' | 'OTHER';
  author: string | null;
  sourceUrl: string | null;
  status: LearningStatus;
  progressCurrent: number | null;
  progressTotal: number | null;
  progressUnit: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface LearningSession extends WorkEntity {
  resourceId: string | null;
  planId: string | null;
  taskId: string | null;
  sessionDate: string;
  durationMinutes: number;
  progressDelta: number | null;
  summary: string | null;
}

export interface WorkNote extends WorkEntity {
  categoryId: string;
  title: string;
  editorMode: 'RICH_TEXT' | 'MARKDOWN';
  markdownContent: string | null;
  richContent: unknown;
  plainText: string;
  summary: string | null;
  role: 'SCRIPT' | 'TECHNICAL' | 'KNOWLEDGE' | 'MATERIAL' | 'OTHER';
}

export interface DevProjectMilestone extends WorkEntity {
  projectId: string;
  title: string;
  description: string | null;
  dueAt: string;
  status: 'PENDING' | 'AT_RISK' | 'ACHIEVED' | 'MISSED';
  achievedAt: string | null;
  taskId: string | null;
}

interface EntityRow {
  id: string;
  version: number;
  created_at: number;
  updated_at: number;
}
const base = (row: EntityRow): WorkEntity => ({
  id: row.id,
  version: row.version,
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString(),
});
const iso = (value: number | null): string | null =>
  value === null ? null : new Date(value).toISOString();
const mergeDefined = <T extends object>(current: T, patch: Patch<T>): T => {
  const merged = { ...current };
  for (const [key, value] of Object.entries(patch))
    if (value !== undefined) Object.assign(merged, { [key]: value });
  return merged;
};

export class WorkRepository {
  private readonly canonicalHistory: CanonicalHistoryRepository;

  public constructor(
    private readonly database: SqliteDatabase,
    private readonly clock: Clock,
    recorder: ConsistencyRepository = new ConsistencyRepository(database, clock),
  ) {
    this.canonicalHistory = new CanonicalHistoryRepository(database, clock, recorder);
  }

  public createContent(
    input: Omit<SelfMediaContent, keyof WorkEntity | 'productionStatus' | 'publishedAt'> & {
      productionStatus?: ContentStatus;
      publishedAt?: string | null;
    },
    context?: OperationContext,
  ): SelfMediaContent {
    this.assertCategory(input.categoryId, 'SELF_MEDIA');
    const status = input.productionStatus ?? 'IDEA';
    this.assertPublished(status, input.publishedAt ?? null);
    const id = this.createEntity('SELF_MEDIA_CONTENT');
    this.database.raw
      .prepare(
        `INSERT INTO self_media_contents(id, category_id, title, idea, script, content_type, platform, production_status, planned_publish_at, published_at, calendar_event_id, task_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.categoryId,
        input.title.trim(),
        input.idea ?? null,
        input.script ?? null,
        input.contentType,
        input.platform ?? null,
        status,
        this.time(input.plannedPublishAt),
        this.time(input.publishedAt),
        input.calendarEventId ?? null,
        input.taskId ?? null,
      );
    this.recordCreate(id, 'SelfMediaContentCreated', input, context);
    return this.requireContent(id);
  }

  public listContents(
    filter: { status?: ContentStatus; from?: string; to?: string } = {},
  ): readonly SelfMediaContent[] {
    const rows = this.database.raw
      .prepare(
        `SELECT item.*, entity.version, entity.created_at, entity.updated_at FROM self_media_contents item JOIN entity_index entity ON entity.id=item.id AND entity.deleted_at IS NULL
      WHERE (? IS NULL OR item.production_status=?) AND (? IS NULL OR item.planned_publish_at>=?) AND (? IS NULL OR item.planned_publish_at<?)
      ORDER BY COALESCE(item.planned_publish_at, entity.updated_at) DESC`,
      )
      .all(
        filter.status ?? null,
        filter.status ?? null,
        this.time(filter.from),
        this.time(filter.from),
        this.time(filter.to),
        this.time(filter.to),
      ) as (EntityRow & Record<string, unknown>)[];
    return rows.map((row) => this.mapContent(row));
  }

  public getContent(id: string): SelfMediaContent | undefined {
    return this.listContents().find((item) => item.id === id);
  }
  public updateContent(
    id: string,
    expectedVersion: number,
    patch: Patch<Omit<SelfMediaContent, keyof WorkEntity | 'categoryId'>>,
    context?: OperationContext,
  ): SelfMediaContent {
    const current = this.requireContent(id);
    this.assertVersion(current.version, expectedVersion);
    const status = patch.productionStatus ?? current.productionStatus;
    const publishedAt = patch.publishedAt === undefined ? current.publishedAt : patch.publishedAt;
    this.assertPublished(status, publishedAt);
    const before = this.captureBefore(id, context);
    this.database.raw
      .prepare(
        `UPDATE self_media_contents SET title=?, idea=?, script=?, content_type=?, platform=?, production_status=?, planned_publish_at=?, published_at=?, calendar_event_id=?, task_id=? WHERE id=?`,
      )
      .run(
        patch.title?.trim() ?? current.title,
        patch.idea === undefined ? current.idea : patch.idea,
        patch.script === undefined ? current.script : patch.script,
        patch.contentType ?? current.contentType,
        patch.platform === undefined ? current.platform : patch.platform,
        status,
        this.time(
          patch.plannedPublishAt === undefined ? current.plannedPublishAt : patch.plannedPublishAt,
        ),
        this.time(publishedAt),
        patch.calendarEventId === undefined ? current.calendarEventId : patch.calendarEventId,
        patch.taskId === undefined ? current.taskId : patch.taskId,
        id,
      );
    this.changed(id, 'SelfMediaContentUpdated', patch, before, context);
    return this.requireContent(id);
  }
  public transitionContent(
    id: string,
    expectedVersion: number,
    status: ContentStatus,
    publishedAt?: string | null,
    context?: OperationContext,
  ): SelfMediaContent {
    assertContentTransition(this.requireContent(id).productionStatus, status);
    return this.updateContent(
      id,
      expectedVersion,
      {
        productionStatus: status,
        publishedAt:
          publishedAt ?? (status === 'PUBLISHED' ? this.clock.now().toISOString() : null),
      },
      context,
    );
  }

  public createMetric(
    contentId: string,
    input: Omit<SelfMediaMetric, keyof WorkEntity | 'contentId'>,
  ): SelfMediaMetric {
    this.requireContent(contentId);
    this.assertMetric(input);
    const id = this.createEntity('SELF_MEDIA_METRIC');
    this.database.raw
      .prepare(
        `INSERT INTO self_media_metrics(id, content_id, recorded_date, platform, views, likes, comments, favorites, shares, follower_delta, custom_metrics_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        contentId,
        input.recordedDate,
        input.platform.trim(),
        input.views,
        input.likes,
        input.comments,
        input.favorites,
        input.shares,
        input.followerDelta,
        JSON.stringify(input.customMetrics),
        this.now(),
      );
    this.audit(id, 1, 'SelfMediaMetricCreated', input);
    return this.requireMetric(id);
  }
  public listMetrics(contentId?: string): readonly SelfMediaMetric[] {
    const rows = this.database.raw
      .prepare(
        `SELECT item.*, entity.version, entity.created_at, entity.updated_at FROM self_media_metrics item JOIN entity_index entity ON entity.id=item.id AND entity.deleted_at IS NULL WHERE (? IS NULL OR item.content_id=?) ORDER BY item.recorded_date DESC`,
      )
      .all(contentId ?? null, contentId ?? null) as (EntityRow & Record<string, unknown>)[];
    return rows.map((row) => this.mapMetric(row));
  }
  public updateMetric(
    id: string,
    expectedVersion: number,
    patch: Patch<Omit<SelfMediaMetric, keyof WorkEntity | 'contentId'>>,
  ): SelfMediaMetric {
    const current = this.requireMetric(id);
    this.assertVersion(current.version, expectedVersion);
    const value = mergeDefined(current, patch);
    this.assertMetric(value);
    this.database.raw
      .prepare(
        `UPDATE self_media_metrics SET recorded_date=?, platform=?, views=?, likes=?, comments=?, favorites=?, shares=?, follower_delta=?, custom_metrics_json=? WHERE id=?`,
      )
      .run(
        value.recordedDate,
        value.platform,
        value.views,
        value.likes,
        value.comments,
        value.favorites,
        value.shares,
        value.followerDelta,
        JSON.stringify(value.customMetrics),
        id,
      );
    this.changed(id, 'SelfMediaMetricUpdated', patch);
    return this.requireMetric(id);
  }

  public createProject(
    input: Omit<DevProject, keyof WorkEntity | 'status'> & { status?: DevProjectStatus },
    context?: OperationContext,
  ): DevProject {
    this.assertCategory(input.categoryId, 'DEVELOPMENT');
    const id = this.createEntity('DEV_PROJECT');
    this.database.raw
      .prepare(
        `INSERT INTO dev_projects(id, category_id, name, summary, status, start_date, target_date, plan_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.categoryId,
        input.name.trim(),
        input.summary ?? null,
        input.status ?? 'PLANNING',
        input.startDate ?? null,
        input.targetDate ?? null,
        input.planId ?? null,
      );
    this.recordCreate(id, 'DevProjectCreated', input, context);
    return this.requireProject(id);
  }
  public listProjects(status?: DevProjectStatus): readonly DevProject[] {
    const rows = this.database.raw
      .prepare(
        `SELECT item.*, entity.version, entity.created_at, entity.updated_at FROM dev_projects item JOIN entity_index entity ON entity.id=item.id AND entity.deleted_at IS NULL WHERE (? IS NULL OR item.status=?) ORDER BY item.status,item.target_date,item.name`,
      )
      .all(status ?? null, status ?? null) as (EntityRow & Record<string, unknown>)[];
    return rows.map((row) => this.mapProject(row));
  }
  public getProject(id: string): DevProject | undefined {
    return this.listProjects().find((item) => item.id === id);
  }
  public updateProject(
    id: string,
    expectedVersion: number,
    patch: Patch<Omit<DevProject, keyof WorkEntity | 'categoryId'>>,
    context?: OperationContext,
  ): DevProject {
    const current = this.requireProject(id);
    this.assertVersion(current.version, expectedVersion);
    const value = mergeDefined(current, patch);
    const before = this.captureBefore(id, context);
    this.database.raw
      .prepare(
        `UPDATE dev_projects SET name=?,summary=?,status=?,start_date=?,target_date=?,plan_id=? WHERE id=?`,
      )
      .run(
        value.name.trim(),
        value.summary,
        value.status,
        value.startDate,
        value.targetDate,
        value.planId,
        id,
      );
    this.changed(id, 'DevProjectUpdated', patch, before, context);
    return this.requireProject(id);
  }

  public createFeature(
    projectId: string,
    input: Omit<DevFeature, keyof WorkEntity | 'projectId'>,
  ): DevFeature {
    this.requireProject(projectId);
    const id = this.createEntity('DEV_FEATURE');
    this.database.raw
      .prepare(
        `INSERT INTO dev_features(id,project_id,title,description,status,priority,task_id,milestone_id,sort_order) VALUES (?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        id,
        projectId,
        input.title.trim(),
        input.description,
        input.status,
        input.priority,
        input.taskId,
        input.milestoneId,
        input.sortOrder,
      );
    this.audit(id, 1, 'DevFeatureCreated', input);
    return this.requireFeature(id);
  }
  public listFeatures(projectId?: string): readonly DevFeature[] {
    const rows = this.database.raw
      .prepare(
        `SELECT item.*,entity.version,entity.created_at,entity.updated_at FROM dev_features item JOIN entity_index entity ON entity.id=item.id AND entity.deleted_at IS NULL WHERE (? IS NULL OR item.project_id=?) ORDER BY item.sort_order,item.title`,
      )
      .all(projectId ?? null, projectId ?? null) as (EntityRow & Record<string, unknown>)[];
    return rows.map((row) => this.mapFeature(row));
  }
  public updateFeature(
    id: string,
    version: number,
    patch: Patch<Omit<DevFeature, keyof WorkEntity | 'projectId'>>,
  ): DevFeature {
    const current = this.requireFeature(id);
    this.assertVersion(current.version, version);
    const value = mergeDefined(current, patch);
    this.database.raw
      .prepare(
        `UPDATE dev_features SET title=?,description=?,status=?,priority=?,task_id=?,milestone_id=?,sort_order=? WHERE id=?`,
      )
      .run(
        value.title.trim(),
        value.description,
        value.status,
        value.priority,
        value.taskId,
        value.milestoneId,
        value.sortOrder,
        id,
      );
    this.changed(id, 'DevFeatureUpdated', patch);
    return this.requireFeature(id);
  }

  public createDefect(
    projectId: string,
    input: Omit<DevDefect, keyof WorkEntity | 'projectId' | 'resolvedAt'>,
  ): DevDefect {
    this.requireProject(projectId);
    const id = this.createEntity('DEV_DEFECT');
    const resolvedAt = ['RESOLVED', 'CLOSED'].includes(input.status) ? this.now() : null;
    this.database.raw
      .prepare(
        `INSERT INTO dev_defects(id,project_id,feature_id,task_id,title,description,reproduction_steps,severity,status,found_version,resolved_version,resolved_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        id,
        projectId,
        input.featureId,
        input.taskId,
        input.title.trim(),
        input.description,
        input.reproductionSteps,
        input.severity,
        input.status,
        input.foundVersion,
        input.resolvedVersion,
        resolvedAt,
      );
    this.audit(id, 1, 'DevDefectCreated', input);
    return this.requireDefect(id);
  }
  public listDefects(projectId?: string): readonly DevDefect[] {
    const rows = this.database.raw
      .prepare(
        `SELECT item.*,entity.version,entity.created_at,entity.updated_at FROM dev_defects item JOIN entity_index entity ON entity.id=item.id AND entity.deleted_at IS NULL WHERE (? IS NULL OR item.project_id=?) ORDER BY CASE item.severity WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,item.status`,
      )
      .all(projectId ?? null, projectId ?? null) as (EntityRow & Record<string, unknown>)[];
    return rows.map((row) => this.mapDefect(row));
  }
  public updateDefect(
    id: string,
    version: number,
    patch: Patch<Omit<DevDefect, keyof WorkEntity | 'projectId' | 'resolvedAt'>>,
  ): DevDefect {
    const current = this.requireDefect(id);
    this.assertVersion(current.version, version);
    const value = mergeDefined(current, patch);
    const resolvedAt = ['RESOLVED', 'CLOSED'].includes(value.status)
      ? current.resolvedAt === null
        ? this.now()
        : this.time(current.resolvedAt)
      : null;
    this.database.raw
      .prepare(
        `UPDATE dev_defects SET feature_id=?,task_id=?,title=?,description=?,reproduction_steps=?,severity=?,status=?,found_version=?,resolved_version=?,resolved_at=? WHERE id=?`,
      )
      .run(
        value.featureId,
        value.taskId,
        value.title.trim(),
        value.description,
        value.reproductionSteps,
        value.severity,
        value.status,
        value.foundVersion,
        value.resolvedVersion,
        resolvedAt,
        id,
      );
    this.changed(id, 'DevDefectUpdated', patch);
    return this.requireDefect(id);
  }

  public createRepositoryLink(
    projectId: string,
    input: Omit<RepositoryLink, keyof WorkEntity | 'projectId'>,
  ): RepositoryLink {
    this.requireProject(projectId);
    this.assertUrl(input.url);
    const id = this.createEntity('REPOSITORY_LINK');
    this.database.raw
      .prepare(
        `INSERT INTO repository_links(id,project_id,name,url,description,sort_order) VALUES (?,?,?,?,?,?)`,
      )
      .run(id, projectId, input.name.trim(), input.url, input.description, input.sortOrder);
    this.audit(id, 1, 'RepositoryLinkCreated', input);
    return this.requireRepositoryLink(id);
  }
  public listRepositoryLinks(projectId: string): readonly RepositoryLink[] {
    const rows = this.database.raw
      .prepare(
        `SELECT item.*,entity.version,entity.created_at,entity.updated_at FROM repository_links item JOIN entity_index entity ON entity.id=item.id AND entity.deleted_at IS NULL WHERE item.project_id=? ORDER BY item.sort_order,item.name`,
      )
      .all(projectId) as (EntityRow & Record<string, unknown>)[];
    return rows.map((row) => this.mapRepositoryLink(row));
  }
  public updateRepositoryLink(
    id: string,
    version: number,
    patch: Patch<Omit<RepositoryLink, keyof WorkEntity | 'projectId'>>,
  ): RepositoryLink {
    const current = this.requireRepositoryLink(id);
    this.assertVersion(current.version, version);
    const value = mergeDefined(current, patch);
    this.assertUrl(value.url);
    this.database.raw
      .prepare(`UPDATE repository_links SET name=?,url=?,description=?,sort_order=? WHERE id=?`)
      .run(value.name.trim(), value.url, value.description, value.sortOrder, id);
    this.changed(id, 'RepositoryLinkUpdated', patch);
    return this.requireRepositoryLink(id);
  }

  public createLearningResource(
    input: Omit<
      LearningResource,
      keyof WorkEntity | 'status' | 'progressCurrent' | 'startedAt' | 'completedAt'
    > & { status?: LearningStatus; progressCurrent?: number | null },
    context?: OperationContext,
  ): LearningResource {
    this.assertCategory(input.categoryId, 'LEARNING');
    if (input.sourceUrl !== null) this.assertUrl(input.sourceUrl);
    this.assertProgress(input.progressCurrent ?? null, input.progressTotal);
    const id = this.createEntity('LEARNING_RESOURCE');
    const status = input.status ?? 'PLANNED';
    this.database.raw
      .prepare(
        `INSERT INTO learning_resources(id,category_id,title,resource_type,author,source_url,status,progress_current,progress_total,progress_unit,started_at,completed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        id,
        input.categoryId,
        input.title.trim(),
        input.resourceType,
        input.author,
        input.sourceUrl,
        status,
        input.progressCurrent ?? null,
        input.progressTotal,
        input.progressUnit,
        status === 'IN_PROGRESS' ? this.now() : null,
        status === 'COMPLETED' ? this.now() : null,
      );
    this.recordCreate(id, 'LearningResourceCreated', input, context);
    return this.requireLearningResource(id);
  }
  public listLearningResources(status?: LearningStatus): readonly LearningResource[] {
    const rows = this.database.raw
      .prepare(
        `SELECT item.*,entity.version,entity.created_at,entity.updated_at FROM learning_resources item JOIN entity_index entity ON entity.id=item.id AND entity.deleted_at IS NULL WHERE (? IS NULL OR item.status=?) ORDER BY item.status,item.title`,
      )
      .all(status ?? null, status ?? null) as (EntityRow & Record<string, unknown>)[];
    return rows.map((row) => this.mapLearningResource(row));
  }
  public updateLearningResource(
    id: string,
    version: number,
    patch: Patch<
      Omit<LearningResource, keyof WorkEntity | 'categoryId' | 'startedAt' | 'completedAt'>
    >,
    context?: OperationContext,
  ): LearningResource {
    const current = this.requireLearningResource(id);
    this.assertVersion(current.version, version);
    const value = mergeDefined(current, patch);
    if (value.sourceUrl !== null) this.assertUrl(value.sourceUrl);
    this.assertProgress(value.progressCurrent, value.progressTotal);
    const startedAt =
      current.startedAt === null && value.status === 'IN_PROGRESS'
        ? this.now()
        : this.time(current.startedAt);
    const completedAt =
      value.status === 'COMPLETED' ? (this.time(current.completedAt) ?? this.now()) : null;
    const before = this.captureBefore(id, context);
    this.database.raw
      .prepare(
        `UPDATE learning_resources SET title=?,resource_type=?,author=?,source_url=?,status=?,progress_current=?,progress_total=?,progress_unit=?,started_at=?,completed_at=? WHERE id=?`,
      )
      .run(
        value.title.trim(),
        value.resourceType,
        value.author,
        value.sourceUrl,
        value.status,
        value.progressCurrent,
        value.progressTotal,
        value.progressUnit,
        startedAt,
        completedAt,
        id,
      );
    this.changed(id, 'LearningResourceUpdated', patch, before, context);
    return this.requireLearningResource(id);
  }
  public setLearningProgress(
    id: string,
    version: number,
    current: number,
    status?: LearningStatus,
    context?: OperationContext,
  ): LearningResource {
    return this.updateLearningResource(
      id,
      version,
      {
        progressCurrent: current,
        ...(status === undefined ? {} : { status }),
      },
      context,
    );
  }
  public createLearningSession(
    input: Omit<LearningSession, keyof WorkEntity>,
    context?: OperationContext,
  ): LearningSession {
    if (input.resourceId === null && input.planId === null && input.taskId === null)
      throw new Error('INVALID_SESSION_LINK');
    if (!Number.isInteger(input.durationMinutes) || input.durationMinutes <= 0)
      throw new Error('INVALID_DURATION');
    const id = this.createEntity('LEARNING_SESSION');
    this.database.raw
      .prepare(
        `INSERT INTO learning_sessions(id,resource_id,plan_id,task_id,session_date,duration_minutes,progress_delta,summary) VALUES (?,?,?,?,?,?,?,?)`,
      )
      .run(
        id,
        input.resourceId,
        input.planId,
        input.taskId,
        input.sessionDate,
        input.durationMinutes,
        input.progressDelta,
        input.summary,
      );
    if (context === undefined) this.audit(id, 1, 'LearningSessionCreated', input);
    if (input.resourceId !== null && input.progressDelta !== null) {
      const resource = this.requireLearningResource(input.resourceId);
      this.updateLearningResource(
        resource.id,
        resource.version,
        {
          progressCurrent: (resource.progressCurrent ?? 0) + input.progressDelta,
          status: 'IN_PROGRESS',
        },
        context,
      );
    }
    return this.requireLearningSession(id);
  }
  public listLearningSessions(from?: string, to?: string): readonly LearningSession[] {
    const rows = this.database.raw
      .prepare(
        `SELECT item.*,entity.version,entity.created_at,entity.updated_at FROM learning_sessions item JOIN entity_index entity ON entity.id=item.id AND entity.deleted_at IS NULL WHERE (? IS NULL OR item.session_date>=?) AND (? IS NULL OR item.session_date<=?) ORDER BY item.session_date DESC`,
      )
      .all(from ?? null, from ?? null, to ?? null, to ?? null) as (EntityRow &
      Record<string, unknown>)[];
    return rows.map((row) => this.mapLearningSession(row));
  }
  public updateLearningSession(
    id: string,
    version: number,
    patch: Patch<Omit<LearningSession, keyof WorkEntity>>,
  ): LearningSession {
    const current = this.requireLearningSession(id);
    this.assertVersion(current.version, version);
    const value = mergeDefined(current, patch);
    if (value.resourceId === null && value.planId === null && value.taskId === null)
      throw new Error('INVALID_SESSION_LINK');
    if (!Number.isInteger(value.durationMinutes) || value.durationMinutes <= 0)
      throw new Error('INVALID_DURATION');
    this.database.raw
      .prepare(
        `UPDATE learning_sessions SET resource_id=?,plan_id=?,task_id=?,session_date=?,duration_minutes=?,progress_delta=?,summary=? WHERE id=?`,
      )
      .run(
        value.resourceId,
        value.planId,
        value.taskId,
        value.sessionDate,
        value.durationMinutes,
        value.progressDelta,
        value.summary,
        id,
      );
    this.changed(id, 'LearningSessionUpdated', patch);
    return this.requireLearningSession(id);
  }
  public linkLearningResource(
    planId: string,
    resourceId: string,
    context?: OperationContext,
  ): void {
    this.requireLearningResource(resourceId);
    this.database.transaction(() => {
      const before = this.captureBefore(resourceId, context);
      const result = this.database.raw
        .prepare(
          `INSERT OR IGNORE INTO learning_plan_resources(plan_id,resource_id,sort_order) VALUES (?,?,COALESCE((SELECT MAX(sort_order)+1 FROM learning_plan_resources WHERE plan_id=?),0))`,
        )
        .run(planId, resourceId, planId);
      if (result.changes > 0)
        this.changed(resourceId, 'LearningResourceLinked', { planId }, before, context);
    });
  }
  public unlinkLearningResource(
    planId: string,
    resourceId: string,
    context?: OperationContext,
  ): void {
    this.database.transaction(() => {
      const before = this.captureBefore(resourceId, context);
      const result = this.database.raw
        .prepare('DELETE FROM learning_plan_resources WHERE plan_id=? AND resource_id=?')
        .run(planId, resourceId);
      if (result.changes > 0)
        this.changed(resourceId, 'LearningResourceUnlinked', { planId }, before, context);
    });
  }

  public createNoteForEntity(
    input: {
      entityId: string;
      categoryId: string;
      title: string;
      markdownContent: string;
      editorMode?: WorkNote['editorMode'];
      richContent?: unknown;
      summary?: string | null;
      role: WorkNote['role'];
    },
    context?: OperationContext,
  ): WorkNote {
    this.requireActiveEntity(input.entityId);
    const id = this.createEntity('NOTE');
    this.database.transaction(() => {
      this.database.raw
        .prepare(
          `INSERT INTO notes(id, category_id, title, editor_mode, rich_content_json, markdown_content, plain_text, summary)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          input.categoryId,
          input.title.trim(),
          input.editorMode ?? 'MARKDOWN',
          input.richContent === undefined || input.richContent === null
            ? null
            : JSON.stringify(input.richContent),
          input.editorMode === 'RICH_TEXT' ? null : input.markdownContent,
          input.markdownContent,
          input.summary ?? null,
        );
      this.database.raw
        .prepare(
          `INSERT INTO work_note_links(entity_id, note_id, role, sort_order)
           VALUES (?, ?, ?, COALESCE((SELECT MAX(sort_order) + 1 FROM work_note_links WHERE entity_id = ?), 0))`,
        )
        .run(input.entityId, id, input.role, input.entityId);
      this.recordCreate(id, 'WorkNoteCreated', input, context);
    });
    return this.requireNote(id, input.entityId);
  }

  public listNotes(entityId: string): readonly WorkNote[] {
    const rows = this.database.raw
      .prepare(
        `SELECT item.*, link.role, entity.version, entity.created_at, entity.updated_at
         FROM work_note_links link
         JOIN notes item ON item.id = link.note_id
         JOIN entity_index entity ON entity.id = item.id AND entity.deleted_at IS NULL
         WHERE link.entity_id = ? ORDER BY link.sort_order, entity.updated_at DESC`,
      )
      .all(entityId) as (EntityRow & Record<string, unknown>)[];
    return rows.map((row) => this.mapNote(row));
  }

  public updateNote(
    id: string,
    entityId: string,
    expectedVersion: number,
    patch: Patch<
      Pick<
        WorkNote,
        'title' | 'editorMode' | 'richContent' | 'markdownContent' | 'summary' | 'role'
      >
    >,
    context?: OperationContext,
  ): WorkNote {
    const current = this.requireNote(id, entityId);
    this.assertVersion(current.version, expectedVersion);
    const value = mergeDefined(current, patch);
    this.database.transaction(() => {
      const before = this.captureBefore(id, context);
      this.database.raw
        .prepare(
          `UPDATE notes SET title = ?, editor_mode = ?, rich_content_json = ?, markdown_content = ?, plain_text = ?, summary = ? WHERE id = ?`,
        )
        .run(
          value.title.trim(),
          value.editorMode,
          value.richContent === null ? null : JSON.stringify(value.richContent),
          value.editorMode === 'MARKDOWN' ? (value.markdownContent ?? '') : null,
          value.markdownContent ?? '',
          value.summary,
          id,
        );
      this.database.raw
        .prepare('UPDATE work_note_links SET role = ? WHERE entity_id = ? AND note_id = ?')
        .run(value.role, entityId, id);
      this.changed(id, 'WorkNoteUpdated', patch, before, context);
    });
    return this.requireNote(id, entityId);
  }

  public createProjectMilestone(
    projectId: string,
    input: {
      title: string;
      description?: string | null;
      dueAt: string;
      status?: DevProjectMilestone['status'];
      taskId?: string | null;
    },
  ): DevProjectMilestone {
    this.requireProject(projectId);
    const id = this.createEntity('DEV_PROJECT_MILESTONE');
    const status = input.status ?? 'PENDING';
    this.database.raw
      .prepare(
        `INSERT INTO dev_project_milestones(id, project_id, title, description, due_at, status, achieved_at, task_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        projectId,
        input.title.trim(),
        input.description ?? null,
        this.time(input.dueAt),
        status,
        status === 'ACHIEVED' ? this.now() : null,
        input.taskId ?? null,
      );
    this.audit(id, 1, 'DevProjectMilestoneCreated', input);
    return this.requireProjectMilestone(id);
  }

  public listProjectMilestones(projectId?: string): readonly DevProjectMilestone[] {
    const rows = this.database.raw
      .prepare(
        `SELECT item.*, entity.version, entity.created_at, entity.updated_at
         FROM dev_project_milestones item
         JOIN entity_index entity ON entity.id = item.id AND entity.deleted_at IS NULL
         WHERE (? IS NULL OR item.project_id = ?) ORDER BY item.due_at, item.title`,
      )
      .all(projectId ?? null, projectId ?? null) as (EntityRow & Record<string, unknown>)[];
    return rows.map((row) => this.mapProjectMilestone(row));
  }

  public updateProjectMilestone(
    id: string,
    expectedVersion: number,
    patch: Patch<Omit<DevProjectMilestone, keyof WorkEntity | 'projectId' | 'achievedAt'>>,
  ): DevProjectMilestone {
    const current = this.requireProjectMilestone(id);
    this.assertVersion(current.version, expectedVersion);
    const value = mergeDefined(current, patch);
    const achievedAt =
      value.status === 'ACHIEVED' ? (this.time(current.achievedAt) ?? this.now()) : null;
    this.database.raw
      .prepare(
        `UPDATE dev_project_milestones SET title = ?, description = ?, due_at = ?, status = ?, achieved_at = ?, task_id = ? WHERE id = ?`,
      )
      .run(
        value.title.trim(),
        value.description,
        this.time(value.dueAt),
        value.status,
        achievedAt,
        value.taskId,
        id,
      );
    this.changed(id, 'DevProjectMilestoneUpdated', patch);
    return this.requireProjectMilestone(id);
  }

  public softDelete(id: string, expectedVersion: number, context?: OperationContext): void {
    const row = this.database.raw
      .prepare('SELECT version,entity_type FROM entity_index WHERE id=? AND deleted_at IS NULL')
      .get(id) as { version: number; entity_type: string } | undefined;
    if (row === undefined) throw new Error('ENTITY_NOT_FOUND');
    this.assertVersion(row.version, expectedVersion);
    this.database.transaction(() => {
      const before =
        context === undefined || !this.canonicalHistory.supports(row.entity_type)
          ? undefined
          : this.canonicalHistory.captureCurrentState(id);
      const now = this.now();
      this.database.raw
        .prepare(
          'UPDATE entity_index SET version=version+1,updated_at=?,deleted_at=?,purge_after=? WHERE id=?',
        )
        .run(now, now, now + 30 * 86_400_000, id);
      if (context !== undefined && before !== undefined)
        this.canonicalHistory.recordLifecycleChange({
          entityId: id,
          before,
          context,
          summary: 'WorkEntityDeleted',
          operation: 'SOFT_DELETE',
        });
      else this.audit(id, expectedVersion + 1, 'WorkEntityDeleted', { id });
    });
  }

  public selfMediaTrend(
    from: string,
    to: string,
  ): readonly {
    date: string;
    views: number;
    likes: number;
    comments: number;
    favorites: number;
    shares: number;
    followerDelta: number;
  }[] {
    return this.database.raw
      .prepare(
        `SELECT recorded_date AS date,
                SUM(COALESCE(views, 0)) AS views,
                SUM(COALESCE(likes, 0)) AS likes,
                SUM(COALESCE(comments, 0)) AS comments,
                SUM(COALESCE(favorites, 0)) AS favorites,
                SUM(COALESCE(shares, 0)) AS shares,
                SUM(COALESCE(follower_delta, 0)) AS followerDelta
         FROM self_media_metrics metric
         JOIN entity_index entity ON entity.id = metric.id AND entity.deleted_at IS NULL
         WHERE recorded_date BETWEEN ? AND ? GROUP BY recorded_date ORDER BY recorded_date`,
      )
      .all(from, to) as readonly {
      date: string;
      views: number;
      likes: number;
      comments: number;
      favorites: number;
      shares: number;
      followerDelta: number;
    }[];
  }

  public overview(from: string, to: string) {
    const fromMs = Date.parse(`${from}T00:00:00+08:00`),
      toMs = Date.parse(`${to}T23:59:59.999+08:00`);
    const scalar = (sql: string, ...args: unknown[]) =>
      (this.database.raw.prepare(sql).get(...args) as { value: number | null }).value ?? 0;
    const taskTotal = scalar(
      `SELECT COUNT(*) value FROM tasks t WHERE t.preferred_area='WORK' AND t.due_at BETWEEN ? AND ?`,
      fromMs,
      toMs,
    );
    const taskCompleted = scalar(
      `SELECT COUNT(*) value FROM tasks t WHERE t.preferred_area='WORK' AND t.status='COMPLETED' AND t.completed_at BETWEEN ? AND ?`,
      fromMs,
      toMs,
    );
    const overdue = scalar(
      `SELECT COUNT(*) value FROM tasks t WHERE t.preferred_area='WORK' AND t.status IN ('TODO','IN_PROGRESS') AND t.due_at<?`,
      this.now(),
    );
    return {
      range: { from, to },
      tasks: {
        total: taskTotal,
        completed: taskCompleted,
        overdue,
        completionRate: taskTotal === 0 ? 0 : Math.round((taskCompleted / taskTotal) * 100),
      },
      selfMedia: {
        contents: this.listContents({
          from: new Date(fromMs).toISOString(),
          to: new Date(toMs + 1).toISOString(),
        }).length,
        published: scalar(
          `SELECT COUNT(*) value FROM self_media_contents c JOIN entity_index e ON e.id=c.id AND e.deleted_at IS NULL WHERE c.published_at BETWEEN ? AND ?`,
          fromMs,
          toMs,
        ),
        views: scalar(
          `SELECT SUM(COALESCE(m.views,0)) value FROM self_media_metrics m JOIN entity_index e ON e.id=m.id AND e.deleted_at IS NULL WHERE m.recorded_date BETWEEN ? AND ?`,
          from,
          to,
        ),
      },
      development: {
        projects: this.listProjects().filter((p) => p.status !== 'ARCHIVED').length,
        featureCompletionRate: this.featureRate(),
        openDefects: this.listDefects().filter(
          (d) => !['RESOLVED', 'CLOSED', 'WONT_FIX'].includes(d.status),
        ).length,
        criticalDefects: this.listDefects().filter(
          (d) =>
            d.severity === 'CRITICAL' && !['RESOLVED', 'CLOSED', 'WONT_FIX'].includes(d.status),
        ).length,
      },
      learning: {
        minutes: scalar(
          `SELECT SUM(duration_minutes) value FROM learning_sessions s JOIN entity_index e ON e.id=s.id AND e.deleted_at IS NULL WHERE s.session_date BETWEEN ? AND ?`,
          from,
          to,
        ),
        activeResources: this.listLearningResources('IN_PROGRESS').length,
        completedResources: this.listLearningResources('COMPLETED').length,
      },
    };
  }

  private featureRate(): number {
    const list = this.listFeatures();
    const active = list.filter((x) => x.status !== 'CANCELLED');
    return active.length === 0
      ? 0
      : Math.round((active.filter((x) => x.status === 'DONE').length / active.length) * 100);
  }
  private createEntity(type: string): string {
    const id = ulid(),
      now = this.now();
    this.database.raw
      .prepare('INSERT INTO entity_index(id,entity_type,created_at,updated_at) VALUES (?,?,?,?)')
      .run(id, type, now, now);
    return id;
  }
  private captureBefore(
    id: string,
    context: OperationContext | undefined,
  ): CanonicalEntitySnapshot | undefined {
    return context === undefined ? undefined : this.canonicalHistory.captureCurrentState(id);
  }
  private recordCreate(
    id: string,
    event: string,
    snapshot: unknown,
    context: OperationContext | undefined,
  ): void {
    if (context === undefined) this.audit(id, 1, event, snapshot);
    else this.canonicalHistory.recordCreate(id, context, event);
  }
  private changed(
    id: string,
    event: string,
    snapshot: unknown,
    before?: CanonicalEntitySnapshot,
    context?: OperationContext,
  ): void {
    const version = this.bump(id);
    if (context === undefined || before === undefined) this.audit(id, version, event, snapshot);
    else this.canonicalHistory.recordUpdate(id, before, context, event);
  }
  private bump(id: string): number {
    this.database.raw
      .prepare('UPDATE entity_index SET version=version+1,updated_at=? WHERE id=?')
      .run(this.now(), id);
    return (
      this.database.raw.prepare('SELECT version FROM entity_index WHERE id=?').get(id) as {
        version: number;
      }
    ).version;
  }
  private audit(id: string, version: number, event: string, snapshot: unknown): void {
    const now = this.now(),
      change = ulid();
    this.database.raw
      .prepare(
        `INSERT INTO change_sets(id,source,summary,risk_level,status,created_at,applied_at) VALUES (?,'USER',?,'LOW_WRITE','APPLIED',?,?)`,
      )
      .run(change, event, now, now);
    this.database.raw
      .prepare(
        `INSERT INTO entity_versions(id,entity_id,entity_version,change_set_id,source,snapshot_json,patch_json,created_at) VALUES (?,?,?,?, 'USER',?,'{}',?)`,
      )
      .run(ulid(), id, version, change, JSON.stringify(snapshot), now);
  }
  private assertVersion(actual: number, expected: number): void {
    if (actual !== expected) throw new Error('VERSION_CONFLICT');
  }
  private assertCategory(id: string, type: string): void {
    const row = this.database.raw
      .prepare('SELECT module_type,is_archived FROM categories WHERE id=?')
      .get(id) as { module_type: string; is_archived: number } | undefined;
    if (row === undefined || row.is_archived === 1) throw new Error('CATEGORY_NOT_FOUND');
    if (row.module_type !== type) throw new Error('CATEGORY_MODULE_MISMATCH');
  }
  private assertPublished(status: ContentStatus, publishedAt: string | null): void {
    if (status === 'PUBLISHED' && publishedAt === null) throw new Error('INVALID_PUBLISHED_AT');
  }
  private assertMetric(
    input: Pick<SelfMediaMetric, 'views' | 'likes' | 'comments' | 'favorites' | 'shares'>,
  ): void {
    for (const value of [input.views, input.likes, input.comments, input.favorites, input.shares])
      if (value !== null && (!Number.isInteger(value) || value < 0))
        throw new Error('INVALID_METRIC');
  }
  private assertProgress(current: number | null, total: number | null): void {
    assertProgressRange(current, total);
  }
  private assertUrl(value: string): void {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error('INVALID_URL');
    }
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('INVALID_URL');
  }
  private time(value: string | null | undefined): number | null {
    if (value === null || value === undefined) return null;
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) throw new Error('INVALID_DATE');
    return parsed;
  }
  private now(): number {
    return this.clock.now().getTime();
  }
  private requireContent(id: string): SelfMediaContent {
    const value = this.getContent(id);
    if (value === undefined) throw new Error('SELF_MEDIA_CONTENT_NOT_FOUND');
    return value;
  }
  private requireMetric(id: string): SelfMediaMetric {
    const value = this.listMetrics().find((x) => x.id === id);
    if (value === undefined) throw new Error('SELF_MEDIA_METRIC_NOT_FOUND');
    return value;
  }
  private requireProject(id: string): DevProject {
    const value = this.getProject(id);
    if (value === undefined) throw new Error('DEV_PROJECT_NOT_FOUND');
    return value;
  }
  private requireFeature(id: string): DevFeature {
    const value = this.listFeatures().find((x) => x.id === id);
    if (value === undefined) throw new Error('DEV_FEATURE_NOT_FOUND');
    return value;
  }
  private requireDefect(id: string): DevDefect {
    const value = this.listDefects().find((x) => x.id === id);
    if (value === undefined) throw new Error('DEV_DEFECT_NOT_FOUND');
    return value;
  }
  private requireRepositoryLink(id: string): RepositoryLink {
    for (const project of this.listProjects()) {
      const value = this.listRepositoryLinks(project.id).find((x) => x.id === id);
      if (value !== undefined) return value;
    }
    throw new Error('REPOSITORY_LINK_NOT_FOUND');
  }
  private requireLearningResource(id: string): LearningResource {
    const value = this.listLearningResources().find((x) => x.id === id);
    if (value === undefined) throw new Error('LEARNING_RESOURCE_NOT_FOUND');
    return value;
  }
  private requireLearningSession(id: string): LearningSession {
    const value = this.listLearningSessions().find((x) => x.id === id);
    if (value === undefined) throw new Error('LEARNING_SESSION_NOT_FOUND');
    return value;
  }
  private requireNote(id: string, entityId: string): WorkNote {
    const value = this.listNotes(entityId).find((item) => item.id === id);
    if (value === undefined) throw new Error('NOTE_NOT_FOUND');
    return value;
  }
  private requireProjectMilestone(id: string): DevProjectMilestone {
    const value = this.listProjectMilestones().find((item) => item.id === id);
    if (value === undefined) throw new Error('DEV_PROJECT_MILESTONE_NOT_FOUND');
    return value;
  }
  private requireActiveEntity(id: string): void {
    const row = this.database.raw
      .prepare('SELECT 1 FROM entity_index WHERE id = ? AND deleted_at IS NULL')
      .get(id);
    if (row === undefined) throw new Error('ENTITY_NOT_FOUND');
  }
  private mapContent(row: EntityRow & Record<string, unknown>): SelfMediaContent {
    return {
      ...base(row),
      categoryId: row.category_id as string,
      title: row.title as string,
      idea: row.idea as string | null,
      script: row.script as string | null,
      contentType: row.content_type as SelfMediaContent['contentType'],
      platform: row.platform as string | null,
      productionStatus: row.production_status as ContentStatus,
      plannedPublishAt: iso(row.planned_publish_at as number | null),
      publishedAt: iso(row.published_at as number | null),
      calendarEventId: row.calendar_event_id as string | null,
      taskId: row.task_id as string | null,
    };
  }
  private mapMetric(row: EntityRow & Record<string, unknown>): SelfMediaMetric {
    return {
      ...base(row),
      contentId: row.content_id as string,
      recordedDate: row.recorded_date as string,
      platform: row.platform as string,
      views: row.views as number | null,
      likes: row.likes as number | null,
      comments: row.comments as number | null,
      favorites: row.favorites as number | null,
      shares: row.shares as number | null,
      followerDelta: row.follower_delta as number | null,
      customMetrics: JSON.parse(row.custom_metrics_json as string) as Record<string, number>,
    };
  }
  private mapProject(row: EntityRow & Record<string, unknown>): DevProject {
    return {
      ...base(row),
      categoryId: row.category_id as string,
      name: row.name as string,
      summary: row.summary as string | null,
      status: row.status as DevProjectStatus,
      startDate: row.start_date as string | null,
      targetDate: row.target_date as string | null,
      planId: row.plan_id as string | null,
    };
  }
  private mapFeature(row: EntityRow & Record<string, unknown>): DevFeature {
    return {
      ...base(row),
      projectId: row.project_id as string,
      title: row.title as string,
      description: row.description as string | null,
      status: row.status as FeatureStatus,
      priority: row.priority as Priority,
      taskId: row.task_id as string | null,
      milestoneId: row.milestone_id as string | null,
      sortOrder: row.sort_order as number,
    };
  }
  private mapDefect(row: EntityRow & Record<string, unknown>): DevDefect {
    return {
      ...base(row),
      projectId: row.project_id as string,
      featureId: row.feature_id as string | null,
      taskId: row.task_id as string | null,
      title: row.title as string,
      description: row.description as string | null,
      reproductionSteps: row.reproduction_steps as string | null,
      severity: row.severity as DevDefect['severity'],
      status: row.status as DefectStatus,
      foundVersion: row.found_version as string | null,
      resolvedVersion: row.resolved_version as string | null,
      resolvedAt: iso(row.resolved_at as number | null),
    };
  }
  private mapRepositoryLink(row: EntityRow & Record<string, unknown>): RepositoryLink {
    return {
      ...base(row),
      projectId: row.project_id as string,
      name: row.name as string,
      url: row.url as string,
      description: row.description as string | null,
      sortOrder: row.sort_order as number,
    };
  }
  private mapLearningResource(row: EntityRow & Record<string, unknown>): LearningResource {
    return {
      ...base(row),
      categoryId: row.category_id as string,
      title: row.title as string,
      resourceType: row.resource_type as LearningResource['resourceType'],
      author: row.author as string | null,
      sourceUrl: row.source_url as string | null,
      status: row.status as LearningStatus,
      progressCurrent: row.progress_current as number | null,
      progressTotal: row.progress_total as number | null,
      progressUnit: row.progress_unit as string | null,
      startedAt: iso(row.started_at as number | null),
      completedAt: iso(row.completed_at as number | null),
    };
  }
  private mapLearningSession(row: EntityRow & Record<string, unknown>): LearningSession {
    return {
      ...base(row),
      resourceId: row.resource_id as string | null,
      planId: row.plan_id as string | null,
      taskId: row.task_id as string | null,
      sessionDate: row.session_date as string,
      durationMinutes: row.duration_minutes as number,
      progressDelta: row.progress_delta as number | null,
      summary: row.summary as string | null,
    };
  }
  private mapNote(row: EntityRow & Record<string, unknown>): WorkNote {
    return {
      ...base(row),
      categoryId: row.category_id as string,
      title: row.title as string,
      editorMode: row.editor_mode as WorkNote['editorMode'],
      markdownContent: row.markdown_content as string | null,
      richContent:
        row.rich_content_json === null
          ? null
          : (JSON.parse(row.rich_content_json as string) as unknown),
      plainText: row.plain_text as string,
      summary: row.summary as string | null,
      role: row.role as WorkNote['role'],
    };
  }
  private mapProjectMilestone(row: EntityRow & Record<string, unknown>): DevProjectMilestone {
    return {
      ...base(row),
      projectId: row.project_id as string,
      title: row.title as string,
      description: row.description as string | null,
      dueAt: new Date(row.due_at as number).toISOString(),
      status: row.status as DevProjectMilestone['status'],
      achievedAt: iso(row.achieved_at as number | null),
      taskId: row.task_id as string | null,
    };
  }
}
