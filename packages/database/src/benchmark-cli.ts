import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SystemClock } from '@life-assistant/kernel';

import {
  BenchmarkDataGenerator,
  type BenchmarkConfig,
  type BenchmarkTargets,
} from './benchmark-data-generator.js';
import { SqliteDatabase } from './sqlite-database.js';

interface CliOptions {
  readonly out: string;
  readonly seed?: number;
  readonly scale: number;
  readonly rebuildSearch: boolean;
  readonly verbose: boolean;
}

const parseArguments = (argv: readonly string[]): CliOptions => {
  let out: string | undefined;
  let seed: number | undefined;
  let scale = 1;
  let rebuildSearch = true;
  let verbose = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === undefined) continue;
    const next = argv[index + 1];
    if (argument === '--out' && next !== undefined) {
      out = next;
      index += 1;
    } else if (argument === '--seed' && next !== undefined) {
      seed = Number(next);
      index += 1;
    } else if (argument === '--scale' && next !== undefined) {
      scale = Number(next);
      index += 1;
    } else if (argument === '--no-search') {
      rebuildSearch = false;
    } else if (argument === '--verbose') {
      verbose = true;
    } else {
      throw new Error(`未知参数：${argument}`);
    }
  }
  if (out === undefined) throw new Error('缺少 --out 输出路径。');
  if (!Number.isFinite(scale) || scale <= 0) throw new Error('--scale 必须为正数。');
  return {
    out,
    ...(seed === undefined ? {} : { seed }),
    scale,
    rebuildSearch,
    verbose,
  };
};

const scaleTargets = (targets: BenchmarkTargets, scale: number): BenchmarkTargets => ({
  tasks: Math.max(1, Math.round(targets.tasks * scale)),
  chatSessions: Math.max(1, Math.round(targets.chatSessions * scale)),
  messagesPerSession: targets.messagesPerSession,
  goals: Math.max(1, Math.round(targets.goals * scale)),
  plans: Math.max(1, Math.round(targets.plans * scale)),
  events: Math.max(1, Math.round(targets.events * scale)),
  notes: Math.max(1, Math.round(targets.notes * scale)),
  selfMediaContents: Math.max(1, Math.round(targets.selfMediaContents * scale)),
  devProjects: Math.max(1, Math.round(targets.devProjects * scale)),
  learningResources: Math.max(1, Math.round(targets.learningResources * scale)),
  shoppingItems: Math.max(1, Math.round(targets.shoppingItems * scale)),
  recipes: Math.max(1, Math.round(targets.recipes * scale)),
  mealRecords: Math.max(1, Math.round(targets.mealRecords * scale)),
  exerciseCatalog: Math.max(1, Math.round(targets.exerciseCatalog * scale)),
  workoutSessions: Math.max(1, Math.round(targets.workoutSessions * scale)),
  entertainmentItems: Math.max(1, Math.round(targets.entertainmentItems * scale)),
  inboxItems: Math.max(1, Math.round(targets.inboxItems * scale)),
});

const loadConfig = (workspaceRoot: string): BenchmarkConfig => {
  const configPath = resolve(workspaceRoot, 'fixtures', 'performance', 'benchmark.config.json');
  if (!existsSync(configPath)) throw new Error(`找不到基准配置：${configPath}`);
  const parsed = JSON.parse(readFileSync(configPath, 'utf8')) as Partial<BenchmarkConfig>;
  if (typeof parsed.seed !== 'number' || parsed.targets === undefined) {
    throw new Error(`基准配置格式不正确：${configPath}`);
  }
  return { seed: parsed.seed, targets: parsed.targets };
};

export const runBenchmarkCli = (argv: readonly string[]): void => {
  const options = parseArguments(argv);
  const currentDirectory = dirname(fileURLToPath(import.meta.url));
  const workspaceRoot = resolve(currentDirectory, '..', '..', '..');
  const config = loadConfig(workspaceRoot);
  const seed = options.seed ?? config.seed;
  const targets = scaleTargets(config.targets, options.scale);
  const clock = new SystemClock();
  const startedAt = Date.now();

  const database = new SqliteDatabase(options.out, clock);
  try {
    database.migrate();
    const generator = new BenchmarkDataGenerator(database, clock, seed);
    generator.generate(targets);
    if (options.rebuildSearch) {
      const documentCount = generator.rebuildSearchIndex();
      if (options.verbose) console.log(`搜索投影重建：${String(documentCount)} 条`);
    }
    const verification = generator.verify();
    const elapsedMs = Date.now() - startedAt;
    console.log(
      JSON.stringify(
        {
          out: options.out,
          seed,
          scale: options.scale,
          elapsedMs,
          quickCheck: verification.quickCheck,
          foreignKeyViolations: verification.foreignKeyViolations.length,
          counts: verification.counts,
        },
        null,
        2,
      ),
    );
    if (verification.quickCheck.some((line) => line !== 'ok')) {
      throw new Error(`数据库完整性检查失败：${verification.quickCheck.join('; ')}`);
    }
    if (verification.foreignKeyViolations.length > 0) {
      throw new Error(`外键约束违反 ${String(verification.foreignKeyViolations.length)} 条。`);
    }
    if (verification.counts.tasks !== targets.tasks) {
      throw new Error(
        `任务数不匹配：期望 ${String(targets.tasks)}，实际 ${String(verification.counts.tasks)}。`,
      );
    }
    if (verification.counts.chatMessages !== targets.chatSessions * targets.messagesPerSession) {
      throw new Error(
        `聊天消息数不匹配：期望 ${String(targets.chatSessions * targets.messagesPerSession)}，实际 ${String(verification.counts.chatMessages)}。`,
      );
    }
  } finally {
    database.close();
  }
};

const isDirectRun = (): boolean => {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  return resolve(entry) === fileURLToPath(import.meta.url);
};

if (isDirectRun()) {
  try {
    runBenchmarkCli(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
