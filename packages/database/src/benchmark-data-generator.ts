import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import type { Clock } from '@life-assistant/kernel';

import { ConsistencyRepository } from './consistency-repository.js';
import { InformationRepository } from './information-repository.js';
import { SharedRepository } from './shared-repository.js';
import { SqliteDatabase } from './sqlite-database.js';

/**
 * M8-007：10 万记录、5 万消息基准数据生成配置。
 * 默认值来自 fixtures/performance/benchmark.config.json，作为唯一默认配置来源。
 */
export interface BenchmarkTargets {
  readonly tasks: number;
  readonly chatSessions: number;
  readonly messagesPerSession: number;
  readonly goals: number;
  readonly plans: number;
  readonly events: number;
  readonly notes: number;
  readonly selfMediaContents: number;
  readonly devProjects: number;
  readonly learningResources: number;
  readonly shoppingItems: number;
  readonly recipes: number;
  readonly mealRecords: number;
  readonly exerciseCatalog: number;
  readonly workoutSessions: number;
  readonly entertainmentItems: number;
  readonly inboxItems: number;
}

export interface BenchmarkConfig {
  readonly seed: number;
  readonly targets: BenchmarkTargets;
}

export interface BenchmarkCounts {
  readonly tasks: number;
  readonly chatMessages: number;
  readonly chatSessions: number;
  readonly goals: number;
  readonly plans: number;
  readonly events: number;
  readonly notes: number;
  readonly selfMediaContents: number;
  readonly devProjects: number;
  readonly learningResources: number;
  readonly shoppingItems: number;
  readonly recipes: number;
  readonly mealRecords: number;
  readonly exerciseCatalog: number;
  readonly workoutSessions: number;
  readonly entertainmentItems: number;
  readonly inboxItems: number;
  readonly searchDocuments: number;
}

export interface BenchmarkVerification {
  readonly quickCheck: readonly string[];
  readonly foreignKeyViolations: readonly unknown[];
  readonly counts: BenchmarkCounts;
}

const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
const TASK_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
const EVENT_TYPES = ['GENERAL', 'MEETING', 'MEDICAL', 'TRAVEL', 'REST'] as const;
const NOTE_TITLES = [
  '项目周报草稿',
  '接口设计备忘',
  '学习笔记：SQLite 索引',
  '购物清单补充',
  '健身动作要点',
  '食谱灵感',
  '发布复盘',
  '需求评审记录',
  '代码审查清单',
  '读书摘录',
] as const;

const WORK_TASK_TITLES = [
  '整理项目文档',
  '完成接口联调',
  '编写测试用例',
  '修复缺陷',
  '推进需求评审',
  '更新周报',
  '撰写技术方案',
  '审阅代码变更',
  '同步开发进度',
  '复盘发布结果',
] as const;

const LIFE_TASK_TITLES = [
  '采购生活用品',
  '准备晚餐食材',
  '完成今日训练',
  '记录饮食',
  '整理房间',
  '预约体检',
  '观看收藏影片',
  '规划周末活动',
  '补充饮水',
  '阅读休闲书籍',
] as const;

const CHAT_SESSION_TITLES = [
  '日常规划讨论',
  '工作事项梳理',
  '生活安排咨询',
  '学习计划讨论',
  '健康与健身',
  '娱乐推荐',
  '项目开发问答',
  '目标拆解',
  '旅行规划',
  '预算与消费',
] as const;

const USER_MESSAGES = [
  '帮我整理一下今天的安排。',
  '这个任务应该怎么拆分？',
  '明天有哪些重要事项？',
  '帮我规划本周的学习时间。',
  '最近的健身计划执行得怎么样？',
  '有哪些需要优先处理的任务？',
  '帮我检查一下本周的预算。',
  '这个项目接下来要做什么？',
  '周末有什么值得安排的活动？',
  '提醒我按时完成这个任务。',
  '帮我记录一条新的购物需求。',
  '分析一下本周的时间分布。',
] as const;

const ASSISTANT_MESSAGES = [
  '好的，我已经整理好今天的安排，核心任务优先排在工作时段。',
  '这个任务建议拆成三个步骤，每步约 30 分钟。',
  '明天上午有两项紧急任务需要优先完成。',
  '本周学习时间已安排，每天预留一小时专注时段。',
  '健身计划执行良好，本周已完成三次训练。',
  '当前有三项高优先级任务需要尽快处理。',
  '本周预算仍在范围内，娱乐支出略高于计划。',
  '项目下一步是完成接口联调并补充测试用例。',
  '建议周末安排半天休息时间，可以加入一次短途活动。',
  '已为你设置任务提醒，到期前十分钟通知。',
  '已记录购物需求并加入待购清单。',
  '本周工作占比略高，建议增加生活时段缓冲。',
] as const;

const GOAL_TITLES = [
  '完成季度学习目标',
  '养成规律运动习惯',
  '推进核心项目交付',
  '建立稳定的阅读节奏',
  '优化每日时间管理',
  '提升内容创作产出',
  '控制月度消费预算',
  '完成技能提升计划',
] as const;

const PLAN_TITLES = [
  '本月重点工作',
  '学习阶段安排',
  '健身周期计划',
  '内容发布计划',
  '项目里程碑计划',
  '阅读清单计划',
] as const;

const GRID_ALIGN_MS = 15 * 60 * 1000;

/** mulberry32：固定种子的确定性伪随机数生成器。 */
const createPrng = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

const encodeBase32 = (value: bigint, length: number): string => {
  let remaining = value;
  let encoded = '';
  for (let index = 0; index < length; index += 1) {
    const character = CROCKFORD[Number(remaining & 31n)];
    if (character === undefined) throw new Error('Crockford 编码失败。');
    encoded = character + encoded;
    remaining >>= 5n;
  }
  return encoded;
};

/** 生成确定性 ULID：48 位时间戳 + 80 位 PRNG 随机部分。 */
const createIdFactory = (prng: () => number, baseTime: number) => {
  let tick = 0;
  return (): string => {
    const timeMs = baseTime + tick;
    tick += 1;
    const timePart = encodeBase32(BigInt(timeMs) & ((1n << 48n) - 1n), 10);
    const randomBits =
      (BigInt(Math.floor(prng() * 0x100000000)) << 64n) |
      (BigInt(Math.floor(prng() * 0x100000000)) << 32n) |
      BigInt(Math.floor(prng() * 0x100000000));
    return timePart + encodeBase32(randomBits & ((1n << 80n) - 1n), 16);
  };
};

const pick = <T>(prng: () => number, values: readonly T[]): T => {
  const index = Math.floor(prng() * values.length);
  const value = values[index];
  if (value === undefined) throw new Error('PRNG 选取失败：数组为空。');
  return value;
};

const pad = (value: number, length: number): string => String(value).padStart(length, '0');

/**
 * M8-007 基准数据生成器。
 * 使用真实 Schema（迁移）与真实引导数据（默认分类/设置），
 * 以固定种子与固定时钟生成可完全重放的 10 万记录 / 5 万消息基准数据库。
 */
export class BenchmarkDataGenerator {
  private readonly database: SqliteDatabase;
  private readonly clock: Clock;
  private readonly seed: number;

  public constructor(database: SqliteDatabase, clock: Clock, seed = 20260814) {
    this.database = database;
    this.clock = clock;
    this.seed = seed;
  }

  /** 在目标路径创建数据库、迁移并生成基准数据，返回校验结果。 */
  public static createAt(
    path: string,
    clock: Clock,
    config: BenchmarkConfig,
  ): BenchmarkVerification {
    mkdirSync(dirname(path), { recursive: true });
    const database = new SqliteDatabase(path, clock);
    try {
      database.migrate();
      const generator = new BenchmarkDataGenerator(database, clock, config.seed);
      generator.generate(config.targets);
      return generator.verify();
    } finally {
      database.close();
    }
  }

  /** 生成基准数据。生成后可调用 verify() 获得完整性校验结果。 */
  public generate(targets: BenchmarkTargets): void {
    const now = this.clock.now().getTime();
    const prng = createPrng(this.seed);
    const id = createIdFactory(prng, now);

    const shared = new SharedRepository(this.database, this.clock);
    shared.seedDefaults();

    this.database.transaction(() => {
      const categories = shared.listCategories();
      const workCategories = categories.filter((category) => category.parentArea === 'WORK');
      const lifeCategories = categories.filter((category) => category.parentArea === 'LIFE');
      if (workCategories.length === 0 || lifeCategories.length === 0) {
        throw new Error('基准数据需要工作与生活分类。');
      }
      const workCategoryIds = workCategories.map((category) => category.id);
      const lifeCategoryIds = lifeCategories.map((category) => category.id);
      const allCategoryIds = categories.map((category) => category.id);

      this.insertProvider(id, now);

      const goalIds = this.insertGoals(id, prng, now, targets.goals, allCategoryIds);
      const planRows = this.insertPlans(id, prng, now, targets.plans, goalIds, allCategoryIds);
      this.insertTasks(id, prng, now, targets.tasks, planRows, workCategoryIds, lifeCategoryIds);
      this.insertEvents(id, prng, now, targets.events, allCategoryIds);
      this.insertNotes(id, prng, now, targets.notes, allCategoryIds);
      this.insertSelfMedia(id, prng, now, targets.selfMediaContents, workCategoryIds);
      this.insertDevProjects(id, prng, now, targets.devProjects, workCategoryIds);
      this.insertLearningResources(id, prng, now, targets.learningResources, workCategoryIds);
      this.insertShoppingItems(id, prng, now, targets.shoppingItems, lifeCategoryIds);
      this.insertRecipes(id, prng, now, targets.recipes, lifeCategoryIds);
      this.insertMealRecords(id, prng, now, targets.mealRecords, lifeCategoryIds);
      this.insertExerciseCatalog(id, prng, now, targets.exerciseCatalog);
      this.insertWorkoutSessions(id, prng, now, targets.workoutSessions, lifeCategoryIds);
      this.insertEntertainmentItems(id, prng, now, targets.entertainmentItems, lifeCategoryIds);
      this.insertInboxItems(id, prng, now, targets.inboxItems);
      this.insertChatData(id, prng, now, targets.chatSessions, targets.messagesPerSession);
    });
  }

  /** 重建搜索投影，保证基准数据可被全局搜索查询。 */
  public rebuildSearchIndex(): number {
    const consistency = new ConsistencyRepository(this.database, this.clock);
    return new InformationRepository(this.database, this.clock, consistency).rebuildSearchIndex();
  }

  /** 校验数据库完整性与基准记录数。 */
  public verify(): BenchmarkVerification {
    const quickCheck = this.database.quickCheck();
    const foreignKeyViolations = this.database.foreignKeyCheck();
    return { quickCheck, foreignKeyViolations, counts: this.counts() };
  }

  public counts(): BenchmarkCounts {
    const count = (table: string): number =>
      (
        this.database.raw.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as {
          count: number;
        }
      ).count;
    return {
      tasks: count('tasks'),
      chatMessages: count('chat_messages'),
      chatSessions: count('chat_sessions'),
      goals: count('goals'),
      plans: count('plans'),
      events: count('events'),
      notes: count('notes'),
      selfMediaContents: count('self_media_contents'),
      devProjects: count('dev_projects'),
      learningResources: count('learning_resources'),
      shoppingItems: count('shopping_items'),
      recipes: count('recipes'),
      mealRecords: count('meal_records'),
      exerciseCatalog: count('exercise_catalog'),
      workoutSessions: count('workout_sessions'),
      entertainmentItems: count('entertainment_items'),
      inboxItems: count('inbox_items'),
      searchDocuments: count('search_documents'),
    };
  }

  private insertEntity(id: string, entityType: string, now: number): void {
    this.database.raw
      .prepare('INSERT INTO entity_index(id,entity_type,created_at,updated_at) VALUES (?,?,?,?)')
      .run(id, entityType, now, now);
  }

  private insertProvider(id: () => string, now: number): void {
    const providerId = id();
    this.insertEntity(providerId, 'AI_PROVIDER_CONFIG', now);
    this.database.raw
      .prepare(
        `INSERT INTO ai_provider_configs(
           id,provider_type,display_name,model_id,credential_ref,capabilities_json,is_default
         ) VALUES (?,?,?,?,?,?,1)`,
      )
      .run(
        providerId,
        'OPENAI_COMPATIBLE',
        '基准数据模型',
        'benchmark-model',
        'life-assistant:benchmark:provider',
        JSON.stringify({
          chat: true,
          streaming: true,
          toolCalling: true,
          nativeWebSearch: false,
        }),
      );
  }

  private insertGoals(
    id: () => string,
    prng: () => number,
    now: number,
    count: number,
    categoryIds: readonly string[],
  ): readonly string[] {
    const goalIds: string[] = [];
    const insertEntity = this.database.raw.prepare(
      'INSERT INTO entity_index(id,entity_type,created_at,updated_at) VALUES (?,?,?,?)',
    );
    const insertGoal = this.database.raw.prepare(
      `INSERT INTO goals(id,category_id,title,description,goal_type,status,start_date,end_date,horizon)
       VALUES (?,?,?,?,?,?,?,?,?)`,
    );
    for (let index = 0; index < count; index += 1) {
      const goalId = id();
      const created = now - Math.floor(prng() * 400 * 86_400_000);
      insertEntity.run(goalId, 'GOAL', created, created);
      const categoryId = pick(prng, categoryIds);
      const title = `${pick(prng, GOAL_TITLES)} #${pad(index + 1, 4)}`;
      const startDate = this.isoDate(new Date(created));
      const endDate = this.isoDate(new Date(created + Math.floor(prng() * 300 + 30) * 86_400_000));
      const status = prng() < 0.8 ? 'ACTIVE' : prng() < 0.9 ? 'PAUSED' : 'COMPLETED';
      insertGoal.run(
        goalId,
        categoryId,
        title,
        `基准目标：${title}`,
        prng() < 0.5 ? 'OUTCOME' : 'HABIT',
        status,
        startDate,
        endDate,
        prng() < 0.5 ? 'SHORT_TERM' : 'LONG_TERM',
      );
      goalIds.push(goalId);
    }
    return goalIds;
  }

  private insertPlans(
    id: () => string,
    prng: () => number,
    now: number,
    count: number,
    goalIds: readonly string[],
    categoryIds: readonly string[],
  ): readonly { id: string; categoryId: string; startMs: number; endMs: number }[] {
    const planRows: { id: string; categoryId: string; startMs: number; endMs: number }[] = [];
    const insertEntity = this.database.raw.prepare(
      'INSERT INTO entity_index(id,entity_type,created_at,updated_at) VALUES (?,?,?,?)',
    );
    const insertPlan = this.database.raw.prepare(
      `INSERT INTO plans(id,goal_id,category_id,title,description,status,priority,start_date,end_date)
       VALUES (?,?,?,?,?,?,?,?,?)`,
    );
    for (let index = 0; index < count; index += 1) {
      const planId = id();
      const created = now - Math.floor(prng() * 300 * 86_400_000);
      insertEntity.run(planId, 'PLAN', created, created);
      const categoryId = pick(prng, categoryIds);
      const goalId = prng() < 0.5 ? pick(prng, goalIds) : null;
      const startMs = created;
      const endMs = startMs + Math.floor(prng() * 60 + 7) * 86_400_000;
      insertPlan.run(
        planId,
        goalId,
        categoryId,
        `${pick(prng, PLAN_TITLES)} #${pad(index + 1, 4)}`,
        `基准计划：阶段安排`,
        prng() < 0.7 ? 'ACTIVE' : 'DRAFT',
        pick(prng, TASK_PRIORITIES),
        this.isoDate(new Date(startMs)),
        this.isoDate(new Date(endMs)),
      );
      planRows.push({ id: planId, categoryId, startMs, endMs });
    }
    return planRows;
  }

  private insertTasks(
    id: () => string,
    prng: () => number,
    now: number,
    count: number,
    plans: readonly { id: string; categoryId: string; startMs: number; endMs: number }[],
    workCategoryIds: readonly string[],
    lifeCategoryIds: readonly string[],
  ): void {
    const insertEntity = this.database.raw.prepare(
      'INSERT INTO entity_index(id,entity_type,created_at,updated_at) VALUES (?,?,?,?)',
    );
    const insertTask = this.database.raw.prepare(
      `INSERT INTO tasks(
         id,category_id,plan_id,title,description,status,priority,due_at,
         estimated_minutes,is_flexible,is_splittable,preferred_area,completed_at,cancelled_at
       ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    );
    const titles = [...WORK_TASK_TITLES, ...LIFE_TASK_TITLES];
    const batchSize = 2000;
    for (let batchStart = 0; batchStart < count; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize, count);
      this.database.transaction(() => {
        for (let index = batchStart; index < batchEnd; index += 1) {
          const taskId = id();
          const created = now - Math.floor(prng() * 540 * 86_400_000);
          insertEntity.run(taskId, 'TASK', created, created);
          const isWork = prng() < 0.55;
          const categoryId = isWork ? pick(prng, workCategoryIds) : pick(prng, lifeCategoryIds);
          const plan = plans.length > 0 && prng() < 0.15 ? pick(prng, plans) : undefined;
          const status = pick(prng, TASK_STATUSES);
          const dueMs = created + Math.floor(prng() * 30 + 1) * 86_400_000;
          const estimatedMinutes = pick(prng, [15, 30, 45, 60, 90, 120, 180, 240]);
          insertTask.run(
            taskId,
            categoryId,
            plan?.id ?? null,
            `${pick(prng, titles)} #${pad(index + 1, 6)}`,
            `基准任务：${pick(prng, titles)}`,
            status,
            pick(prng, TASK_PRIORITIES),
            dueMs,
            estimatedMinutes,
            prng() < 0.7 ? 1 : 0,
            prng() < 0.15 ? 1 : 0,
            isWork ? 'WORK' : 'LIFE',
            status === 'COMPLETED' ? dueMs : null,
            status === 'CANCELLED' ? dueMs : null,
          );
        }
      });
    }
  }

  private insertEvents(
    id: () => string,
    prng: () => number,
    now: number,
    count: number,
    categoryIds: readonly string[],
  ): void {
    const insertEntity = this.database.raw.prepare(
      'INSERT INTO entity_index(id,entity_type,created_at,updated_at) VALUES (?,?,?,?)',
    );
    const insertEvent = this.database.raw.prepare(
      `INSERT INTO events(
         id,category_id,title,description,start_at,end_at,event_type,priority,is_immovable,allow_overlap,status
       ) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    );
    for (let index = 0; index < count; index += 1) {
      const eventId = id();
      const created = now - Math.floor(prng() * 540 * 86_400_000);
      insertEntity.run(eventId, 'EVENT', created, created);
      const startAt = Math.floor(created / GRID_ALIGN_MS) * GRID_ALIGN_MS;
      const durationMs = pick(prng, [30, 45, 60, 90, 120]) * 60 * 1000;
      const endAt = startAt + durationMs;
      insertEvent.run(
        eventId,
        pick(prng, categoryIds),
        `固定日程 ${pad(index + 1, 5)}`,
        '基准固定日程',
        startAt,
        endAt,
        pick(prng, EVENT_TYPES),
        pick(prng, TASK_PRIORITIES),
        prng() < 0.3 ? 1 : 0,
        0,
        prng() < 0.85 ? 'SCHEDULED' : 'COMPLETED',
      );
    }
  }

  private insertNotes(
    id: () => string,
    prng: () => number,
    now: number,
    count: number,
    categoryIds: readonly string[],
  ): void {
    const insertEntity = this.database.raw.prepare(
      'INSERT INTO entity_index(id,entity_type,created_at,updated_at) VALUES (?,?,?,?)',
    );
    const insertNote = this.database.raw.prepare(
      `INSERT INTO notes(id,category_id,title,editor_mode,markdown_content,plain_text,summary)
       VALUES (?,?,?,'MARKDOWN',?,?,?)`,
    );
    for (let index = 0; index < count; index += 1) {
      const noteId = id();
      const created = now - Math.floor(prng() * 540 * 86_400_000);
      insertEntity.run(noteId, 'NOTE', created, created);
      const title = `${pick(prng, NOTE_TITLES)} #${pad(index + 1, 4)}`;
      const body = `# ${title}\n\n基准笔记正文：记录关键信息与后续行动。`;
      insertNote.run(
        noteId,
        pick(prng, categoryIds),
        title,
        body,
        body,
        `基准笔记摘要 ${pad(index + 1, 4)}`,
      );
    }
  }

  private insertSelfMedia(
    id: () => string,
    prng: () => number,
    now: number,
    count: number,
    workCategoryIds: readonly string[],
  ): void {
    const insertEntity = this.database.raw.prepare(
      'INSERT INTO entity_index(id,entity_type,created_at,updated_at) VALUES (?,?,?,?)',
    );
    const insertContent = this.database.raw.prepare(
      `INSERT INTO self_media_contents(
         id,category_id,title,idea,content_type,platform,production_status,planned_publish_at,published_at
       ) VALUES (?,?,?,?,?,?,?,?,?)`,
    );
    const statuses = ['IDEA', 'PLANNING', 'CREATING', 'READY', 'PUBLISHED', 'ARCHIVED'] as const;
    for (let index = 0; index < count; index += 1) {
      const contentId = id();
      const created = now - Math.floor(prng() * 540 * 86_400_000);
      insertEntity.run(contentId, 'SELF_MEDIA_CONTENT', created, created);
      const status = pick(prng, statuses);
      const planned = created + Math.floor(prng() * 60) * 86_400_000;
      insertContent.run(
        contentId,
        pick(prng, workCategoryIds),
        `内容选题 ${pad(index + 1, 4)}`,
        '基准选题灵感',
        pick(prng, ['VIDEO', 'ARTICLE', 'AUDIO', 'IMAGE', 'OTHER'] as const),
        prng() < 0.5 ? '个人博客' : '视频平台',
        status,
        planned,
        status === 'PUBLISHED' ? planned : null,
      );
    }
  }

  private insertDevProjects(
    id: () => string,
    prng: () => number,
    now: number,
    count: number,
    workCategoryIds: readonly string[],
  ): void {
    const insertEntity = this.database.raw.prepare(
      'INSERT INTO entity_index(id,entity_type,created_at,updated_at) VALUES (?,?,?,?)',
    );
    const insertProject = this.database.raw.prepare(
      `INSERT INTO dev_projects(id,category_id,name,summary,status,start_date,target_date)
       VALUES (?,?,?,?,?,?,?)`,
    );
    const statuses = ['PLANNING', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'] as const;
    for (let index = 0; index < count; index += 1) {
      const projectId = id();
      const created = now - Math.floor(prng() * 540 * 86_400_000);
      insertEntity.run(projectId, 'DEV_PROJECT', created, created);
      const startDate = this.isoDate(new Date(created));
      insertProject.run(
        projectId,
        pick(prng, workCategoryIds),
        `开发项目 ${pad(index + 1, 4)}`,
        '基准开发项目',
        pick(prng, statuses),
        startDate,
        this.isoDate(new Date(created + Math.floor(prng() * 180 + 30) * 86_400_000)),
      );
    }
  }

  private insertLearningResources(
    id: () => string,
    prng: () => number,
    now: number,
    count: number,
    workCategoryIds: readonly string[],
  ): void {
    const insertEntity = this.database.raw.prepare(
      'INSERT INTO entity_index(id,entity_type,created_at,updated_at) VALUES (?,?,?,?)',
    );
    const insertResource = this.database.raw.prepare(
      `INSERT INTO learning_resources(
         id,category_id,title,resource_type,author,status,progress_current,progress_total,progress_unit,started_at
       ) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    );
    const statuses = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'PAUSED', 'ABANDONED'] as const;
    for (let index = 0; index < count; index += 1) {
      const resourceId = id();
      const created = now - Math.floor(prng() * 540 * 86_400_000);
      insertEntity.run(resourceId, 'LEARNING_RESOURCE', created, created);
      const status = pick(prng, statuses);
      const total = Math.floor(prng() * 40 + 5);
      insertResource.run(
        resourceId,
        pick(prng, workCategoryIds),
        `学习资料 ${pad(index + 1, 4)}`,
        pick(prng, ['COURSE', 'BOOK', 'ARTICLE', 'VIDEO', 'DOCUMENT', 'OTHER'] as const),
        '基准作者',
        status,
        status === 'PLANNED' ? 0 : Math.floor(prng() * total),
        total,
        '章节',
        created,
      );
    }
  }

  private insertShoppingItems(
    id: () => string,
    prng: () => number,
    now: number,
    count: number,
    lifeCategoryIds: readonly string[],
  ): void {
    const insertEntity = this.database.raw.prepare(
      'INSERT INTO entity_index(id,entity_type,created_at,updated_at) VALUES (?,?,?,?)',
    );
    const insertItem = this.database.raw.prepare(
      `INSERT INTO shopping_items(
         id,category_id,name,product_category,quantity,unit,planned_unit_price_minor,priority,status
       ) VALUES (?,?,?,?,?,?,?,?,?)`,
    );
    const statuses = ['WANTED', 'RESEARCHING', 'READY', 'PURCHASED', 'CANCELLED'] as const;
    for (let index = 0; index < count; index += 1) {
      const itemId = id();
      const created = now - Math.floor(prng() * 540 * 86_400_000);
      insertEntity.run(itemId, 'SHOPPING_ITEM', created, created);
      insertItem.run(
        itemId,
        pick(prng, lifeCategoryIds),
        `待购商品 ${pad(index + 1, 5)}`,
        '生活用品',
        1,
        '件',
        Math.floor(prng() * 20000 + 500),
        pick(prng, TASK_PRIORITIES),
        pick(prng, statuses),
      );
    }
  }

  private insertRecipes(
    id: () => string,
    prng: () => number,
    now: number,
    count: number,
    lifeCategoryIds: readonly string[],
  ): void {
    const insertEntity = this.database.raw.prepare(
      'INSERT INTO entity_index(id,entity_type,created_at,updated_at) VALUES (?,?,?,?)',
    );
    const insertRecipe = this.database.raw.prepare(
      `INSERT INTO recipes(id,category_id,name,description,servings,calories_kcal,protein_g,carbs_g,fat_g)
       VALUES (?,?,?,?,?,?,?,?,?)`,
    );
    for (let index = 0; index < count; index += 1) {
      const recipeId = id();
      const created = now - Math.floor(prng() * 540 * 86_400_000);
      insertEntity.run(recipeId, 'RECIPE', created, created);
      insertRecipe.run(
        recipeId,
        pick(prng, lifeCategoryIds),
        `家常食谱 ${pad(index + 1, 4)}`,
        '基准食谱',
        2,
        Math.floor(prng() * 600 + 200),
        Math.floor(prng() * 30 + 5),
        Math.floor(prng() * 60 + 20),
        Math.floor(prng() * 25 + 5),
      );
    }
  }

  private insertMealRecords(
    id: () => string,
    prng: () => number,
    now: number,
    count: number,
    lifeCategoryIds: readonly string[],
  ): void {
    const insertEntity = this.database.raw.prepare(
      'INSERT INTO entity_index(id,entity_type,created_at,updated_at) VALUES (?,?,?,?)',
    );
    const insertMeal = this.database.raw.prepare(
      `INSERT INTO meal_records(
         id,category_id,meal_type,title,eaten_at,calories_kcal,protein_g,carbs_g,fat_g
       ) VALUES (?,?,?,?,?,?,?,?,?)`,
    );
    const mealTypes = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] as const;
    for (let index = 0; index < count; index += 1) {
      const mealId = id();
      const created = now - Math.floor(prng() * 540 * 86_400_000);
      insertEntity.run(mealId, 'MEAL_RECORD', created, created);
      insertMeal.run(
        mealId,
        pick(prng, lifeCategoryIds),
        pick(prng, mealTypes),
        `基准餐食 ${pad(index + 1, 5)}`,
        created,
        Math.floor(prng() * 700 + 150),
        Math.floor(prng() * 40 + 5),
        Math.floor(prng() * 80 + 20),
        Math.floor(prng() * 30 + 5),
      );
    }
  }

  private insertExerciseCatalog(
    id: () => string,
    prng: () => number,
    now: number,
    count: number,
  ): void {
    const insertEntity = this.database.raw.prepare(
      'INSERT INTO entity_index(id,entity_type,created_at,updated_at) VALUES (?,?,?,?)',
    );
    const insertExercise = this.database.raw.prepare(
      `INSERT INTO exercise_catalog(id,name,exercise_type,muscle_groups_json,default_unit,instructions)
       VALUES (?,?,?,?,?,?)`,
    );
    const types = ['STRENGTH', 'CARDIO', 'MOBILITY', 'SPORT', 'OTHER'] as const;
    for (let index = 0; index < count; index += 1) {
      const exerciseId = id();
      insertEntity.run(exerciseId, 'EXERCISE', now, now);
      insertExercise.run(
        exerciseId,
        `训练动作 ${pad(index + 1, 3)}`,
        pick(prng, types),
        JSON.stringify(['胸部', '背部', '腿部', '核心'].slice(0, Math.floor(prng() * 4) + 1)),
        'kg',
        '基准动作说明',
      );
    }
  }

  private insertWorkoutSessions(
    id: () => string,
    prng: () => number,
    now: number,
    count: number,
    lifeCategoryIds: readonly string[],
  ): void {
    const insertEntity = this.database.raw.prepare(
      'INSERT INTO entity_index(id,entity_type,created_at,updated_at) VALUES (?,?,?,?)',
    );
    const insertSession = this.database.raw.prepare(
      `INSERT INTO workout_sessions(
         id,category_id,started_at,ended_at,duration_minutes,calories_burned,perceived_effort,note
       ) VALUES (?,?,?,?,?,?,?,?)`,
    );
    for (let index = 0; index < count; index += 1) {
      const sessionId = id();
      const startedAt = now - Math.floor(prng() * 540 * 86_400_000);
      insertEntity.run(sessionId, 'WORKOUT_SESSION', startedAt, startedAt);
      const duration = Math.floor(prng() * 60 + 20);
      insertSession.run(
        sessionId,
        pick(prng, lifeCategoryIds),
        startedAt,
        startedAt + duration * 60 * 1000,
        duration,
        Math.floor(prng() * 400 + 100),
        Math.floor(prng() * 10 + 1),
        '基准训练记录',
      );
    }
  }

  private insertEntertainmentItems(
    id: () => string,
    prng: () => number,
    now: number,
    count: number,
    lifeCategoryIds: readonly string[],
  ): void {
    const insertEntity = this.database.raw.prepare(
      'INSERT INTO entity_index(id,entity_type,created_at,updated_at) VALUES (?,?,?,?)',
    );
    const insertItem = this.database.raw.prepare(
      `INSERT INTO entertainment_items(
         id,category_id,title,item_type,list_type,status,progress_current,progress_total,progress_unit,rating,note
       ) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    );
    const itemTypes = [
      'MOVIE',
      'SERIES',
      'BOOK',
      'COMIC',
      'GAME',
      'ACTIVITY',
      'TRIP',
      'OTHER',
    ] as const;
    const statuses = ['WISHLIST', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'DROPPED'] as const;
    for (let index = 0; index < count; index += 1) {
      const itemId = id();
      const created = now - Math.floor(prng() * 540 * 86_400_000);
      insertEntity.run(itemId, 'ENTERTAINMENT_ITEM', created, created);
      const total = Math.floor(prng() * 24 + 1);
      insertItem.run(
        itemId,
        pick(prng, lifeCategoryIds),
        `娱乐条目 ${pad(index + 1, 4)}`,
        pick(prng, itemTypes),
        pick(prng, ['WANT_TO_WATCH', 'WANT_TO_PLAY', 'WANT_TO_GO', 'OTHER'] as const),
        pick(prng, statuses),
        Math.floor(prng() * total),
        total,
        '集',
        prng() < 0.5 ? null : Math.floor(prng() * 100) / 10,
        '基准娱乐条目',
      );
    }
  }

  private insertInboxItems(id: () => string, prng: () => number, now: number, count: number): void {
    const insertEntity = this.database.raw.prepare(
      'INSERT INTO entity_index(id,entity_type,created_at,updated_at) VALUES (?,?,?,?)',
    );
    const insertInbox = this.database.raw.prepare(
      `INSERT INTO inbox_items(id,raw_text,status,capture_mode) VALUES (?,?,?,?)`,
    );
    const statuses = ['UNPROCESSED', 'PROCESSING', 'PROCESSED', 'ARCHIVED'] as const;
    for (let index = 0; index < count; index += 1) {
      const inboxId = id();
      const created = now - Math.floor(prng() * 90 * 86_400_000);
      insertEntity.run(inboxId, 'INBOX_ITEM', created, created);
      insertInbox.run(
        inboxId,
        `基准收集箱输入 ${pad(index + 1, 5)}：请整理并安排。`,
        pick(prng, statuses),
        prng() < 0.5 ? 'INBOX_ONLY' : 'AI_PROCESS',
      );
    }
  }

  private insertChatData(
    id: () => string,
    prng: () => number,
    now: number,
    sessionCount: number,
    messagesPerSession: number,
  ): void {
    const providerId = (
      this.database.raw
        .prepare('SELECT id FROM ai_provider_configs WHERE is_default = 1 LIMIT 1')
        .get() as { id: string }
    ).id;
    const insertEntity = this.database.raw.prepare(
      'INSERT INTO entity_index(id,entity_type,created_at,updated_at) VALUES (?,?,?,?)',
    );
    const insertSession = this.database.raw.prepare(
      `INSERT INTO chat_sessions(id,title,provider_config_id,status,last_message_at)
       VALUES (?,?,?,?,?)`,
    );
    const insertMessage = this.database.raw.prepare(
      `INSERT INTO chat_messages(id,session_id,role,content_json,plain_text,status,completed_at)
       VALUES (?,?,?,?,?,?,?)`,
    );
    const insertRun = this.database.raw.prepare(
      `INSERT INTO ai_runs(
         id,session_id,user_message_id,assistant_message_id,provider_config_id,status,started_at,finished_at
       ) VALUES (?,?,?,?,?,?,?,?)`,
    );
    for (let sessionIndex = 0; sessionIndex < sessionCount; sessionIndex += 1) {
      const sessionId = id();
      const sessionCreated = now - Math.floor(prng() * 540 * 86_400_000);
      insertEntity.run(sessionId, 'CHAT_SESSION', sessionCreated, sessionCreated);
      let lastMessageAt = sessionCreated;
      insertSession.run(
        sessionId,
        `${pick(prng, CHAT_SESSION_TITLES)} #${pad(sessionIndex + 1, 3)}`,
        providerId,
        'ACTIVE',
        lastMessageAt,
      );
      const messageIds: string[] = [];
      for (let messageIndex = 0; messageIndex < messagesPerSession; messageIndex += 1) {
        const messageId = id();
        const messageAt = lastMessageAt + Math.floor(prng() * 3600 + 30) * 1000;
        lastMessageAt = messageAt;
        const isUser = messageIndex % 2 === 0;
        const text = isUser ? pick(prng, USER_MESSAGES) : pick(prng, ASSISTANT_MESSAGES);
        insertEntity.run(messageId, 'CHAT_MESSAGE', messageAt, messageAt);
        insertMessage.run(
          messageId,
          sessionId,
          isUser ? 'USER' : 'ASSISTANT',
          JSON.stringify([{ type: 'text', text }]),
          text,
          'COMPLETED',
          messageAt,
        );
        messageIds.push(messageId);
      }
      // 每对（用户消息, 助手消息）对应一条已完成的运行，保证会话消息总数精确匹配目标。
      for (let pairIndex = 0; pairIndex + 1 < messageIds.length; pairIndex += 2) {
        const userMessageId = messageIds[pairIndex];
        const assistantMessageId = messageIds[pairIndex + 1];
        if (userMessageId === undefined || assistantMessageId === undefined) continue;
        const runId = id();
        const runAt = lastMessageAt;
        insertEntity.run(runId, 'AI_RUN', runAt, runAt);
        insertRun.run(
          runId,
          sessionId,
          userMessageId,
          assistantMessageId,
          providerId,
          'COMPLETED',
          runAt,
          runAt,
        );
      }
      this.database.raw
        .prepare('UPDATE chat_sessions SET last_message_at=? WHERE id=?')
        .run(lastMessageAt, sessionId);
    }
  }

  private isoDate(date: Date): string {
    const year = date.getUTCFullYear();
    const month = pad(date.getUTCMonth() + 1, 2);
    const day = pad(date.getUTCDate(), 2);
    return `${String(year)}-${month}-${day}`;
  }
}
