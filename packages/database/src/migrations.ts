import { createHash } from 'node:crypto';

export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly sql: string;
  readonly checksum: string;
  /** 已发布过且确认与当前迁移语义等价的历史校验值。 */
  readonly acceptedChecksums?: readonly string[];
}

const defineMigration = (version: number, name: string, sql: string): Migration => ({
  version,
  name,
  sql,
  checksum: createHash('sha256').update(sql).digest('hex'),
});

const migration001 = defineMigration(
  1,
  'system-and-shared-data',
  `
CREATE TABLE app_metadata (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL CHECK(json_valid(value_json)),
  updated_at INTEGER NOT NULL
);
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK(scope IN ('SYSTEM','USER')),
  value_json TEXT NOT NULL CHECK(json_valid(value_json)),
  value_type TEXT NOT NULL CHECK(value_type IN ('STRING','NUMBER','BOOLEAN','OBJECT','ARRAY')),
  updated_at INTEGER NOT NULL
);
CREATE TABLE entity_index (
  id TEXT PRIMARY KEY CHECK(length(id) = 26),
  entity_type TEXT NOT NULL,
  owner_id TEXT NOT NULL DEFAULT 'local-user',
  version INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  purge_after INTEGER,
  demo_batch_id TEXT
);
CREATE INDEX entity_index_type_active_idx ON entity_index(entity_type, deleted_at, updated_at DESC);
CREATE INDEX entity_index_owner_active_idx ON entity_index(owner_id, deleted_at);
CREATE INDEX entity_index_demo_idx ON entity_index(demo_batch_id);
CREATE INDEX entity_index_purge_idx ON entity_index(purge_after) WHERE deleted_at IS NOT NULL;

CREATE TABLE change_sets (
  id TEXT PRIMARY KEY CHECK(length(id) = 26),
  source TEXT NOT NULL CHECK(source IN ('USER','RULE_ENGINE','AI','SYSTEM')),
  source_ref TEXT,
  summary TEXT NOT NULL,
  risk_level TEXT NOT NULL CHECK(risk_level IN ('READ_ONLY','LOW_WRITE','HIGH_WRITE')),
  status TEXT NOT NULL CHECK(status IN ('PENDING','APPLIED','REVERTED','FAILED')),
  reversible_until INTEGER,
  created_at INTEGER NOT NULL,
  applied_at INTEGER,
  reverted_at INTEGER
);
CREATE TABLE change_operations (
  id TEXT PRIMARY KEY CHECK(length(id) = 26),
  change_set_id TEXT NOT NULL REFERENCES change_sets(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  entity_id TEXT REFERENCES entity_index(id),
  operation TEXT NOT NULL CHECK(operation IN ('CREATE','UPDATE','SOFT_DELETE','RESTORE','PURGE')),
  before_json TEXT CHECK(before_json IS NULL OR json_valid(before_json)),
  after_json TEXT CHECK(after_json IS NULL OR json_valid(after_json)),
  UNIQUE(change_set_id, sequence)
);
CREATE TABLE entity_versions (
  id TEXT PRIMARY KEY CHECK(length(id) = 26),
  entity_id TEXT NOT NULL REFERENCES entity_index(id) ON DELETE CASCADE,
  entity_version INTEGER NOT NULL,
  change_set_id TEXT REFERENCES change_sets(id),
  source TEXT NOT NULL CHECK(source IN ('USER','RULE_ENGINE','AI','SYSTEM')),
  actor_ref TEXT,
  snapshot_json TEXT CHECK(snapshot_json IS NULL OR json_valid(snapshot_json)),
  patch_json TEXT NOT NULL CHECK(json_valid(patch_json)),
  created_at INTEGER NOT NULL,
  UNIQUE(entity_id, entity_version)
);
CREATE TABLE idempotency_records (
  key TEXT PRIMARY KEY,
  request_hash TEXT NOT NULL,
  status_code INTEGER,
  response_json TEXT CHECK(response_json IS NULL OR json_valid(response_json)),
  state TEXT NOT NULL CHECK(state IN ('PROCESSING','COMPLETED','FAILED')),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE domain_events (
  id TEXT PRIMARY KEY CHECK(length(id) = 26),
  event_type TEXT NOT NULL,
  aggregate_id TEXT REFERENCES entity_index(id),
  aggregate_version INTEGER,
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
  status TEXT NOT NULL CHECK(status IN ('PENDING','PROCESSING','DONE','FAILED')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  processed_at INTEGER
);
CREATE INDEX domain_events_pending_idx ON domain_events(status, next_attempt_at);
CREATE TABLE background_jobs (
  id TEXT PRIMARY KEY CHECK(length(id) = 26),
  job_type TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
  state TEXT NOT NULL CHECK(state IN ('PENDING','RUNNING','SUCCEEDED','FAILED','CANCELLED')),
  run_at INTEGER NOT NULL,
  locked_at INTEGER,
  lock_expires_at INTEGER,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  finished_at INTEGER
);
CREATE INDEX background_jobs_due_idx ON background_jobs(state, run_at, lock_expires_at);
CREATE TABLE confirmations (
  id TEXT PRIMARY KEY CHECK(length(id) = 26),
  operation_type TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  preview_json TEXT NOT NULL CHECK(json_valid(preview_json)),
  token_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('PENDING','CONFIRMED','EXECUTED','EXPIRED','CANCELLED')),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE categories (
  id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE,
  parent_area TEXT NOT NULL CHECK(parent_area IN ('WORK','LIFE')),
  module_type TEXT NOT NULL CHECK(module_type IN ('SELF_MEDIA','DEVELOPMENT','LEARNING','SHOPPING','DIET','FITNESS','ENTERTAINMENT','GENERIC')),
  name TEXT NOT NULL COLLATE NOCASE CHECK(length(name) BETWEEN 1 AND 80),
  description TEXT,
  sort_order INTEGER NOT NULL CHECK(sort_order >= 0),
  is_archived INTEGER NOT NULL DEFAULT 0 CHECK(is_archived IN (0,1)),
  archived_at INTEGER
);
CREATE UNIQUE INDEX categories_area_name_active_idx ON categories(parent_area, name) WHERE is_archived = 0;
CREATE INDEX categories_area_order_idx ON categories(parent_area, is_archived, sort_order);
CREATE TABLE category_order_versions (
  parent_area TEXT PRIMARY KEY CHECK(parent_area IN ('WORK','LIFE')),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1)
);
CREATE TABLE tags (
  id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE,
  name TEXT NOT NULL COLLATE NOCASE CHECK(length(name) BETWEEN 1 AND 40),
  color_token TEXT,
  description TEXT
);
CREATE UNIQUE INDEX tags_name_idx ON tags(name);
CREATE TABLE tag_links (
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  entity_id TEXT NOT NULL REFERENCES entity_index(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(tag_id, entity_id)
);
CREATE INDEX tag_links_entity_idx ON tag_links(entity_id);
CREATE TABLE entity_links (
  source_entity_id TEXT NOT NULL REFERENCES entity_index(id) ON DELETE CASCADE,
  target_entity_id TEXT NOT NULL REFERENCES entity_index(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(source_entity_id, target_entity_id, relation_type)
);

CREATE TABLE attachments (
  id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  safe_name TEXT NOT NULL,
  media_type TEXT NOT NULL,
  extension TEXT,
  size_bytes INTEGER NOT NULL CHECK(size_bytes >= 0),
  sha256 TEXT NOT NULL CHECK(length(sha256) = 64),
  storage_key TEXT NOT NULL UNIQUE,
  description TEXT,
  status TEXT NOT NULL CHECK(status IN ('UPLOADING','READY','MISSING','QUARANTINED'))
);
CREATE TABLE attachment_links (
  attachment_id TEXT NOT NULL REFERENCES attachments(id) ON DELETE CASCADE,
  entity_id TEXT NOT NULL REFERENCES entity_index(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('GENERAL','MATERIAL','DOCUMENT','COVER')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY(attachment_id, entity_id)
);
CREATE TABLE backup_records (
  id TEXT PRIMARY KEY CHECK(length(id) = 26),
  backup_type TEXT NOT NULL CHECK(backup_type IN ('MANUAL','SCHEDULED','PRE_MIGRATION','PRE_RESTORE')),
  status TEXT NOT NULL CHECK(status IN ('RUNNING','SUCCEEDED','FAILED','DELETED')),
  file_path TEXT,
  manifest_json TEXT CHECK(manifest_json IS NULL OR json_valid(manifest_json)),
  checksum TEXT,
  created_at INTEGER NOT NULL,
  finished_at INTEGER,
  error TEXT
);
CREATE TABLE maintenance_records (
  id TEXT PRIMARY KEY CHECK(length(id) = 26),
  operation TEXT NOT NULL,
  status TEXT NOT NULL,
  detail_json TEXT NOT NULL CHECK(json_valid(detail_json)),
  created_at INTEGER NOT NULL,
  finished_at INTEGER
);
`,
);

const migration002 = defineMigration(
  2,
  'bootstrap-order-versions',
  `
INSERT OR IGNORE INTO category_order_versions(parent_area, version) VALUES ('WORK', 1), ('LIFE', 1);
CREATE INDEX IF NOT EXISTS entity_versions_created_idx ON entity_versions(entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS backup_records_created_idx ON backup_records(created_at DESC);
`,
);

const migration003 = defineMigration(
  3,
  'm2-core-time-system',
  `
CREATE TABLE goals (
  id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id),
  title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
  description TEXT,
  goal_type TEXT NOT NULL CHECK(goal_type IN ('OUTCOME','HABIT')),
  status TEXT NOT NULL CHECK(status IN ('DRAFT','ACTIVE','PAUSED','COMPLETED','CANCELLED')),
  start_date TEXT NOT NULL,
  end_date TEXT,
  horizon TEXT NOT NULL CHECK(horizon IN ('SHORT_TERM','LONG_TERM')),
  auto_progress REAL NOT NULL DEFAULT 0 CHECK(auto_progress BETWEEN 0 AND 100),
  manual_progress REAL CHECK(manual_progress BETWEEN 0 AND 100),
  progress_mode TEXT NOT NULL DEFAULT 'AUTO' CHECK(progress_mode IN ('AUTO','MANUAL_OVERRIDE')),
  display_progress REAL NOT NULL DEFAULT 0 CHECK(display_progress BETWEEN 0 AND 100),
  completed_at INTEGER,
  CHECK(end_date IS NULL OR end_date >= start_date)
);
CREATE INDEX goals_status_horizon_idx ON goals(status, horizon, end_date);
CREATE TABLE goal_metrics (
  id TEXT PRIMARY KEY CHECK(length(id) = 26),
  goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  metric_type TEXT NOT NULL CHECK(metric_type IN ('NUMBER','COUNT','DURATION','PERCENTAGE','BOOLEAN')),
  unit TEXT,
  start_value REAL,
  target_value REAL NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('INCREASE','DECREASE','MAINTAIN')),
  weight REAL NOT NULL DEFAULT 1 CHECK(weight > 0)
);
CREATE TABLE goal_progress_entries (
  id TEXT PRIMARY KEY CHECK(length(id) = 26),
  goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  metric_id TEXT REFERENCES goal_metrics(id) ON DELETE SET NULL,
  value REAL NOT NULL,
  recorded_at INTEGER NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('USER','TASKS','HEALTH','SYSTEM','AI')),
  source_entity_id TEXT REFERENCES entity_index(id),
  note TEXT
);
CREATE INDEX goal_progress_entries_goal_idx ON goal_progress_entries(goal_id, recorded_at DESC);

CREATE TABLE plans (
  id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE,
  goal_id TEXT REFERENCES goals(id),
  category_id TEXT NOT NULL REFERENCES categories(id),
  title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
  description TEXT,
  status TEXT NOT NULL CHECK(status IN ('DRAFT','ACTIVE','PAUSED','COMPLETED','CANCELLED')),
  priority TEXT NOT NULL CHECK(priority IN ('LOW','NORMAL','HIGH','URGENT')),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  auto_progress REAL NOT NULL DEFAULT 0 CHECK(auto_progress BETWEEN 0 AND 100),
  manual_progress REAL CHECK(manual_progress BETWEEN 0 AND 100),
  progress_mode TEXT NOT NULL DEFAULT 'AUTO' CHECK(progress_mode IN ('AUTO','MANUAL_OVERRIDE')),
  display_progress REAL NOT NULL DEFAULT 0 CHECK(display_progress BETWEEN 0 AND 100),
  CHECK(end_date >= start_date)
);
CREATE INDEX plans_goal_status_idx ON plans(goal_id, status);
CREATE INDEX plans_category_status_idx ON plans(category_id, status, end_date);
CREATE TABLE milestones (
  id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_at INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('PENDING','AT_RISK','ACHIEVED','MISSED')),
  achieved_at INTEGER
);
CREATE TABLE milestone_links (
  milestone_id TEXT NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  entity_id TEXT NOT NULL REFERENCES entity_index(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(milestone_id, entity_id)
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id),
  plan_id TEXT REFERENCES plans(id),
  goal_id TEXT REFERENCES goals(id),
  parent_task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 300),
  description TEXT,
  status TEXT NOT NULL CHECK(status IN ('TODO','IN_PROGRESS','COMPLETED','CANCELLED')),
  priority TEXT NOT NULL CHECK(priority IN ('LOW','NORMAL','HIGH','URGENT')),
  due_at INTEGER NOT NULL,
  estimated_minutes INTEGER NOT NULL CHECK(estimated_minutes > 0 AND estimated_minutes % 15 = 0),
  is_flexible INTEGER NOT NULL CHECK(is_flexible IN (0,1)),
  is_splittable INTEGER NOT NULL DEFAULT 0 CHECK(is_splittable IN (0,1)),
  preferred_area TEXT NOT NULL CHECK(preferred_area IN ('WORK','LIFE')),
  completed_at INTEGER,
  cancelled_at INTEGER,
  recurrence_rule_id TEXT,
  occurrence_id TEXT,
  CHECK(parent_task_id IS NULL OR plan_id IS NULL),
  CHECK((status = 'COMPLETED') = (completed_at IS NOT NULL)),
  CHECK((status = 'CANCELLED') = (cancelled_at IS NOT NULL))
);
CREATE INDEX tasks_status_due_idx ON tasks(status, due_at);
CREATE INDEX tasks_category_status_due_idx ON tasks(category_id, status, due_at);
CREATE INDEX tasks_plan_status_idx ON tasks(plan_id, status);
CREATE INDEX tasks_goal_status_idx ON tasks(goal_id, status);
CREATE INDEX tasks_priority_due_active_idx ON tasks(priority, due_at) WHERE status IN ('TODO','IN_PROGRESS');
CREATE INDEX tasks_parent_idx ON tasks(parent_task_id);
CREATE TABLE task_dependencies (
  predecessor_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  successor_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL DEFAULT 'FINISH_TO_START' CHECK(dependency_type = 'FINISH_TO_START'),
  created_at INTEGER NOT NULL,
  PRIMARY KEY(predecessor_task_id, successor_task_id),
  CHECK(predecessor_task_id <> successor_task_id)
);

CREATE TABLE events (
  id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id),
  title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 300),
  description TEXT,
  start_at INTEGER NOT NULL,
  end_at INTEGER NOT NULL,
  time_zone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
  event_type TEXT NOT NULL CHECK(event_type IN ('GENERAL','MEETING','MEDICAL','TRAVEL','REST')),
  priority TEXT NOT NULL CHECK(priority IN ('LOW','NORMAL','HIGH','URGENT')),
  is_immovable INTEGER NOT NULL CHECK(is_immovable IN (0,1)),
  allow_overlap INTEGER NOT NULL DEFAULT 0 CHECK(allow_overlap IN (0,1)),
  status TEXT NOT NULL CHECK(status IN ('SCHEDULED','COMPLETED','CANCELLED')),
  recurrence_rule_id TEXT,
  occurrence_id TEXT,
  CHECK(end_at > start_at),
  CHECK(start_at % 900000 = 0 AND end_at % 900000 = 0)
);
CREATE INDEX events_range_idx ON events(start_at, end_at, status);

CREATE TABLE recurrence_rules (
  id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK(target_type IN ('TASK_TEMPLATE','EVENT_TEMPLATE')),
  target_entity_id TEXT NOT NULL REFERENCES entity_index(id) ON DELETE CASCADE,
  rrule TEXT NOT NULL,
  dtstart_local TEXT NOT NULL,
  time_zone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
  until_at INTEGER,
  count_limit INTEGER,
  generation_horizon_days INTEGER NOT NULL DEFAULT 60 CHECK(generation_horizon_days BETWEEN 1 AND 366),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1))
);
CREATE TABLE recurrence_occurrences (
  id TEXT PRIMARY KEY CHECK(length(id) = 26),
  rule_id TEXT NOT NULL REFERENCES recurrence_rules(id) ON DELETE CASCADE,
  recurrence_key TEXT NOT NULL,
  scheduled_at INTEGER NOT NULL,
  generated_entity_id TEXT REFERENCES entity_index(id),
  status TEXT NOT NULL CHECK(status IN ('GENERATED','SKIPPED','CANCELLED')),
  created_at INTEGER NOT NULL,
  UNIQUE(rule_id, recurrence_key)
);
CREATE TABLE recurrence_exceptions (
  id TEXT PRIMARY KEY CHECK(length(id) = 26),
  rule_id TEXT NOT NULL REFERENCES recurrence_rules(id) ON DELETE CASCADE,
  recurrence_key TEXT NOT NULL,
  exception_type TEXT NOT NULL CHECK(exception_type IN ('SKIP','OVERRIDE')),
  override_json TEXT CHECK(override_json IS NULL OR json_valid(override_json)),
  created_at INTEGER NOT NULL,
  UNIQUE(rule_id, recurrence_key)
);

CREATE TABLE routine_templates (
  id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 80),
  template_type TEXT NOT NULL CHECK(template_type IN ('WORKDAY','WEEKEND','HOLIDAY','CUSTOM')),
  is_default INTEGER NOT NULL DEFAULT 0 CHECK(is_default IN (0,1)),
  time_zone TEXT NOT NULL DEFAULT 'Asia/Shanghai'
);
CREATE UNIQUE INDEX routine_default_type_idx ON routine_templates(template_type) WHERE is_default = 1;
CREATE TABLE routine_segments (
  id TEXT PRIMARY KEY CHECK(length(id) = 26),
  template_id TEXT NOT NULL REFERENCES routine_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  segment_type TEXT NOT NULL CHECK(segment_type IN ('SLEEP','WORK','LIFE','REST')),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  is_immovable INTEGER NOT NULL CHECK(is_immovable IN (0,1)),
  sort_order INTEGER NOT NULL
);
CREATE INDEX routine_segments_template_idx ON routine_segments(template_id, sort_order);
CREATE TABLE date_routine_overrides (
  id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE,
  local_date TEXT NOT NULL UNIQUE,
  template_id TEXT REFERENCES routine_templates(id),
  segments_json TEXT CHECK(segments_json IS NULL OR json_valid(segments_json)),
  note TEXT,
  CHECK(template_id IS NOT NULL OR segments_json IS NOT NULL)
);
CREATE TABLE holiday_calendar (
  local_date TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  day_type TEXT NOT NULL CHECK(day_type IN ('HOLIDAY','MAKEUP_WORKDAY')),
  source TEXT NOT NULL CHECK(source IN ('SYSTEM_UPDATE','USER_OVERRIDE')),
  source_url TEXT,
  fetched_at INTEGER,
  updated_at INTEGER NOT NULL
);

CREATE TABLE schedule_runs (
  id TEXT PRIMARY KEY CHECK(length(id) = 26),
  range_start INTEGER NOT NULL,
  range_end INTEGER NOT NULL,
  trigger_type TEXT NOT NULL,
  rule_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('RUNNING','APPLIED','FAILED','NO_CHANGE')),
  input_hash TEXT NOT NULL,
  summary_json TEXT NOT NULL CHECK(json_valid(summary_json)),
  created_at INTEGER NOT NULL,
  finished_at INTEGER,
  CHECK(range_end > range_start)
);
CREATE TABLE schedule_blocks (
  id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE,
  target_entity_id TEXT REFERENCES entity_index(id),
  block_type TEXT NOT NULL CHECK(block_type IN ('TASK','EVENT','SLEEP','REST')),
  area TEXT NOT NULL CHECK(area IN ('WORK','LIFE','SLEEP')),
  start_at INTEGER NOT NULL,
  end_at INTEGER NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('MANUAL','RULE_ENGINE','AI','ROUTINE')),
  is_locked INTEGER NOT NULL DEFAULT 0 CHECK(is_locked IN (0,1)),
  schedule_run_id TEXT REFERENCES schedule_runs(id),
  reason_code TEXT,
  reason_json TEXT CHECK(reason_json IS NULL OR json_valid(reason_json)),
  cross_area_warning INTEGER NOT NULL DEFAULT 0 CHECK(cross_area_warning IN (0,1)),
  CHECK(end_at > start_at),
  CHECK(start_at % 900000 = 0 AND end_at % 900000 = 0)
);
CREATE INDEX schedule_blocks_range_idx ON schedule_blocks(start_at, end_at);
CREATE INDEX schedule_blocks_target_idx ON schedule_blocks(target_entity_id);
CREATE TABLE schedule_warnings (
  id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE,
  schedule_run_id TEXT NOT NULL REFERENCES schedule_runs(id) ON DELETE CASCADE,
  entity_id TEXT REFERENCES entity_index(id),
  warning_type TEXT NOT NULL CHECK(warning_type IN ('UNSCHEDULED','CROSS_AREA','OVERLAP','DEPENDENCY_BLOCKED','DEADLINE_RISK')),
  severity TEXT NOT NULL CHECK(severity IN ('INFO','WARNING','CRITICAL')),
  message TEXT NOT NULL,
  details_json TEXT NOT NULL CHECK(json_valid(details_json)),
  resolved_at INTEGER
);
CREATE INDEX schedule_warnings_run_idx ON schedule_warnings(schedule_run_id, resolved_at);
`,
);

const migration004 = defineMigration(
  4,
  'm4-work-modules',
  `
CREATE TABLE self_media_contents (
  id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id),
  title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
  idea TEXT,
  script TEXT,
  content_type TEXT NOT NULL CHECK(content_type IN ('VIDEO','ARTICLE','AUDIO','IMAGE','OTHER')),
  platform TEXT,
  production_status TEXT NOT NULL CHECK(production_status IN ('IDEA','PLANNING','CREATING','READY','PUBLISHED','ARCHIVED')),
  planned_publish_at INTEGER,
  published_at INTEGER,
  calendar_event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  CHECK(production_status <> 'PUBLISHED' OR published_at IS NOT NULL)
);

CREATE INDEX self_media_contents_status_idx ON self_media_contents(category_id, production_status, planned_publish_at);
CREATE TABLE self_media_metrics (
  id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE,
  content_id TEXT NOT NULL REFERENCES self_media_contents(id) ON DELETE CASCADE,
  recorded_date TEXT NOT NULL,
  platform TEXT NOT NULL,
  views INTEGER CHECK(views IS NULL OR views >= 0),
  likes INTEGER CHECK(likes IS NULL OR likes >= 0),
  comments INTEGER CHECK(comments IS NULL OR comments >= 0),
  favorites INTEGER CHECK(favorites IS NULL OR favorites >= 0),
  shares INTEGER CHECK(shares IS NULL OR shares >= 0),
  follower_delta INTEGER,
  custom_metrics_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(custom_metrics_json)),
  created_at INTEGER NOT NULL
);
CREATE INDEX self_media_metrics_content_date_idx ON self_media_metrics(content_id, recorded_date DESC);

CREATE TABLE dev_projects (
  id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id),
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 200),
  summary TEXT,
  status TEXT NOT NULL CHECK(status IN ('PLANNING','ACTIVE','PAUSED','COMPLETED','ARCHIVED')),
  start_date TEXT,
  target_date TEXT,
  plan_id TEXT REFERENCES plans(id) ON DELETE SET NULL,
  CHECK(target_date IS NULL OR start_date IS NULL OR target_date >= start_date)
);
CREATE INDEX dev_projects_status_idx ON dev_projects(category_id, status, target_date);
CREATE TABLE dev_features (
  id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES dev_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
  description TEXT,
  status TEXT NOT NULL CHECK(status IN ('BACKLOG','PLANNED','IN_PROGRESS','DONE','CANCELLED')),
  priority TEXT NOT NULL CHECK(priority IN ('LOW','NORMAL','HIGH','URGENT')),
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  milestone_id TEXT REFERENCES milestones(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK(sort_order >= 0)
);
CREATE INDEX dev_features_project_idx ON dev_features(project_id, status, sort_order);
CREATE TABLE dev_defects (
  id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES dev_projects(id) ON DELETE CASCADE,
  feature_id TEXT REFERENCES dev_features(id) ON DELETE SET NULL,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
  description TEXT,
  reproduction_steps TEXT,
  severity TEXT NOT NULL CHECK(severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  status TEXT NOT NULL CHECK(status IN ('OPEN','CONFIRMED','FIXING','RESOLVED','CLOSED','WONT_FIX')),
  found_version TEXT,
  resolved_version TEXT,
  resolved_at INTEGER
);
CREATE INDEX dev_defects_project_idx ON dev_defects(project_id, status, severity);
CREATE TABLE repository_links (
  id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES dev_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 100),
  url TEXT NOT NULL CHECK(url LIKE 'http://%' OR url LIKE 'https://%'),
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK(sort_order >= 0)
);

CREATE TABLE learning_resources (
  id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id),
  title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
  resource_type TEXT NOT NULL CHECK(resource_type IN ('COURSE','BOOK','ARTICLE','VIDEO','DOCUMENT','OTHER')),
  author TEXT,
  source_url TEXT CHECK(source_url IS NULL OR source_url LIKE 'http://%' OR source_url LIKE 'https://%'),
  status TEXT NOT NULL CHECK(status IN ('PLANNED','IN_PROGRESS','COMPLETED','PAUSED','ABANDONED')),
  progress_current REAL,
  progress_total REAL,
  progress_unit TEXT,
  started_at INTEGER,
  completed_at INTEGER,
  CHECK(progress_current IS NULL OR progress_current >= 0),
  CHECK(progress_total IS NULL OR progress_total > 0),
  CHECK(progress_current IS NULL OR progress_total IS NULL OR progress_current <= progress_total)
);
CREATE INDEX learning_resources_status_idx ON learning_resources(category_id, status);
CREATE TABLE learning_plan_resources (
  plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  resource_id TEXT NOT NULL REFERENCES learning_resources(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK(sort_order >= 0),
  PRIMARY KEY(plan_id, resource_id)
);
CREATE TABLE learning_sessions (
  id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE,
  resource_id TEXT REFERENCES learning_resources(id) ON DELETE SET NULL,
  plan_id TEXT REFERENCES plans(id) ON DELETE SET NULL,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  session_date TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK(duration_minutes > 0),
  progress_delta REAL,
  summary TEXT,
  CHECK(resource_id IS NOT NULL OR plan_id IS NOT NULL OR task_id IS NOT NULL)
);
CREATE INDEX learning_sessions_date_idx ON learning_sessions(session_date);
CREATE INDEX learning_sessions_resource_idx ON learning_sessions(resource_id, session_date DESC);
`,
);

const migration005 = defineMigration(
  5,
  'm4-work-links-and-milestones',
  `
CREATE TABLE notes (
  id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id),
  title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
  editor_mode TEXT NOT NULL DEFAULT 'MARKDOWN' CHECK(editor_mode IN ('RICH_TEXT','MARKDOWN')),
  rich_content_json TEXT CHECK(rich_content_json IS NULL OR json_valid(rich_content_json)),
  markdown_content TEXT,
  plain_text TEXT NOT NULL,
  summary TEXT,
  CHECK((editor_mode = 'MARKDOWN' AND markdown_content IS NOT NULL) OR (editor_mode = 'RICH_TEXT' AND rich_content_json IS NOT NULL))
);

CREATE INDEX notes_category_idx ON notes(category_id, title);
CREATE TABLE work_note_links (
  entity_id TEXT NOT NULL REFERENCES entity_index(id) ON DELETE CASCADE,
  note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('SCRIPT','TECHNICAL','KNOWLEDGE','MATERIAL','OTHER')),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK(sort_order >= 0),
  PRIMARY KEY(entity_id, note_id)
);

CREATE INDEX work_note_links_note_idx ON work_note_links(note_id);
CREATE TABLE dev_project_milestones (
  id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES dev_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
  description TEXT,
  due_at INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('PENDING','AT_RISK','ACHIEVED','MISSED')),
  achieved_at INTEGER,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  CHECK((status = 'ACHIEVED') = (achieved_at IS NOT NULL))
);
CREATE INDEX dev_project_milestones_project_idx ON dev_project_milestones(project_id, status, due_at);
`,
);

const migration006 = defineMigration(
  6,
  'm5-shopping-and-life-overview',
  `
CREATE TABLE budgets (
  id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE,
  category_id TEXT REFERENCES categories(id),
  module_type TEXT CHECK(module_type IN ('SHOPPING','DIET','ENTERTAINMENT')),
  period_type TEXT NOT NULL CHECK(period_type IN ('MONTH','QUARTER','YEAR','CUSTOM')),
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK(amount_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'CNY',
  alert_threshold_percent REAL NOT NULL DEFAULT 80 CHECK(alert_threshold_percent > 0 AND alert_threshold_percent <= 100),
  CHECK(period_start <= period_end)
);

CREATE INDEX budgets_period_idx ON budgets(period_start, period_end, module_type);
CREATE TABLE shopping_items (
  id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id),
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 200),
  product_category TEXT,
  quantity REAL NOT NULL DEFAULT 1 CHECK(quantity > 0),
  unit TEXT,
  planned_unit_price_minor INTEGER CHECK(planned_unit_price_minor IS NULL OR planned_unit_price_minor >= 0),
  budget_amount_minor INTEGER CHECK(budget_amount_minor IS NULL OR budget_amount_minor >= 0),
  priority TEXT NOT NULL CHECK(priority IN ('LOW','NORMAL','HIGH','URGENT')),
  status TEXT NOT NULL CHECK(status IN ('WANTED','RESEARCHING','READY','PURCHASED','CANCELLED')),
  purchase_channel TEXT,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL
);
CREATE INDEX shopping_items_status_idx ON shopping_items(status, priority);
CREATE TABLE expense_entries (
  id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE,
  module_type TEXT NOT NULL CHECK(module_type IN ('SHOPPING','DIET','ENTERTAINMENT')),
  category_id TEXT NOT NULL REFERENCES categories(id),
  source_entity_id TEXT NOT NULL UNIQUE REFERENCES entity_index(id),
  occurred_at INTEGER NOT NULL,
  amount_minor INTEGER NOT NULL CHECK(amount_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'CNY',
  merchant TEXT,
  note TEXT
);
CREATE INDEX expense_entries_period_idx ON expense_entries(occurred_at, module_type);
CREATE TABLE purchase_records (
  id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE,
  shopping_item_id TEXT REFERENCES shopping_items(id) ON DELETE SET NULL,
  category_id TEXT NOT NULL REFERENCES categories(id),
  product_name TEXT NOT NULL,
  quantity REAL NOT NULL CHECK(quantity > 0),
  unit_price_minor INTEGER NOT NULL CHECK(unit_price_minor >= 0),
  total_amount_minor INTEGER NOT NULL CHECK(total_amount_minor >= 0),
  planned_total_minor INTEGER CHECK(planned_total_minor IS NULL OR planned_total_minor >= 0),
  purchased_at INTEGER NOT NULL,
  channel TEXT,
  expense_entry_id TEXT NOT NULL UNIQUE REFERENCES expense_entries(id)
);
CREATE INDEX purchase_records_date_idx ON purchase_records(purchased_at DESC);
`,
);

const migration007 = defineMigration(
  7,
  'm5-diet',
  `
CREATE TABLE recipes (
  id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id),
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 200),
  description TEXT,
  servings REAL NOT NULL DEFAULT 1 CHECK(servings > 0),
  calories_kcal REAL CHECK(calories_kcal IS NULL OR calories_kcal >= 0),
  protein_g REAL CHECK(protein_g IS NULL OR protein_g >= 0),
  carbs_g REAL CHECK(carbs_g IS NULL OR carbs_g >= 0),
  fat_g REAL CHECK(fat_g IS NULL OR fat_g >= 0)
);

CREATE INDEX recipes_category_idx ON recipes(category_id, name);
CREATE TABLE recipe_ingredients (id TEXT PRIMARY KEY, recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE, name TEXT NOT NULL, amount REAL, unit TEXT, sort_order INTEGER NOT NULL DEFAULT 0 CHECK(sort_order >= 0));
CREATE TABLE meal_plans (
  id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE, category_id TEXT NOT NULL REFERENCES categories(id), meal_date TEXT NOT NULL,
  meal_type TEXT NOT NULL CHECK(meal_type IN ('BREAKFAST','LUNCH','DINNER','SNACK')), planned_at INTEGER, recipe_id TEXT REFERENCES recipes(id) ON DELETE SET NULL,
  title TEXT NOT NULL, event_id TEXT REFERENCES events(id) ON DELETE SET NULL, task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK(status IN ('PLANNED','COMPLETED','SKIPPED'))
);
CREATE INDEX meal_plans_date_idx ON meal_plans(meal_date, meal_type);
CREATE TABLE meal_records (
  id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE, category_id TEXT NOT NULL REFERENCES categories(id), meal_plan_id TEXT UNIQUE REFERENCES meal_plans(id) ON DELETE SET NULL,
  meal_type TEXT NOT NULL CHECK(meal_type IN ('BREAKFAST','LUNCH','DINNER','SNACK')), title TEXT NOT NULL, eaten_at INTEGER NOT NULL,
  calories_kcal REAL CHECK(calories_kcal IS NULL OR calories_kcal >= 0), protein_g REAL CHECK(protein_g IS NULL OR protein_g >= 0), carbs_g REAL CHECK(carbs_g IS NULL OR carbs_g >= 0),
  fat_g REAL CHECK(fat_g IS NULL OR fat_g >= 0), fiber_g REAL CHECK(fiber_g IS NULL OR fiber_g >= 0), sodium_mg REAL CHECK(sodium_mg IS NULL OR sodium_mg >= 0),
  other_nutrition_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(other_nutrition_json)), expense_entry_id TEXT UNIQUE REFERENCES expense_entries(id)
);
CREATE INDEX meal_records_date_idx ON meal_records(eaten_at, meal_type);
CREATE TABLE hydration_records (id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE, recorded_at INTEGER NOT NULL, amount_ml INTEGER NOT NULL CHECK(amount_ml > 0), note TEXT);
CREATE INDEX hydration_records_date_idx ON hydration_records(recorded_at);
CREATE TABLE dietary_preferences (
  id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE,
  preference_type TEXT NOT NULL CHECK(preference_type IN ('LIKE','DISLIKE','ALLERGY','INTOLERANCE','RESTRICTION')),
  name TEXT NOT NULL, severity TEXT, note TEXT, is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1))
);
CREATE INDEX dietary_preferences_active_idx ON dietary_preferences(is_active, preference_type);
`,
);

const migration008 = defineMigration(
  8,
  'm5-fitness',
  `
CREATE TABLE exercise_catalog (id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE, name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 200), exercise_type TEXT NOT NULL CHECK(exercise_type IN ('STRENGTH','CARDIO','MOBILITY','SPORT','OTHER')), muscle_groups_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(muscle_groups_json)), default_unit TEXT, instructions TEXT);
CREATE TABLE workout_plans (id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE, category_id TEXT NOT NULL REFERENCES categories(id), name TEXT NOT NULL, description TEXT, goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL, status TEXT NOT NULL CHECK(status IN ('DRAFT','ACTIVE','PAUSED','COMPLETED')));
CREATE TABLE workout_plan_items (id TEXT PRIMARY KEY, workout_plan_id TEXT NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE, exercise_id TEXT NOT NULL REFERENCES exercise_catalog(id), sets_target INTEGER, reps_target TEXT, weight_target REAL, duration_seconds_target INTEGER, distance_target REAL, sort_order INTEGER NOT NULL DEFAULT 0);
CREATE TABLE workout_sessions (id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE, category_id TEXT NOT NULL REFERENCES categories(id), workout_plan_id TEXT REFERENCES workout_plans(id) ON DELETE SET NULL, task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL, started_at INTEGER NOT NULL, ended_at INTEGER NOT NULL, duration_minutes INTEGER NOT NULL CHECK(duration_minutes >= 0), calories_burned REAL CHECK(calories_burned IS NULL OR calories_burned >= 0), perceived_effort INTEGER CHECK(perceived_effort IS NULL OR perceived_effort BETWEEN 1 AND 10), note TEXT);
CREATE INDEX workout_sessions_date_idx ON workout_sessions(started_at DESC);
CREATE TABLE workout_sets (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE, exercise_id TEXT NOT NULL REFERENCES exercise_catalog(id), set_number INTEGER NOT NULL CHECK(set_number > 0), reps INTEGER, weight REAL, duration_seconds INTEGER, distance REAL, completed INTEGER NOT NULL DEFAULT 1 CHECK(completed IN (0,1)));
CREATE TABLE body_measurements (id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE, measured_at INTEGER NOT NULL, weight_kg REAL, body_fat_percent REAL, waist_cm REAL, chest_cm REAL, hip_cm REAL, other_measurements_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(other_measurements_json)), note TEXT);
CREATE INDEX body_measurements_date_idx ON body_measurements(measured_at DESC);
CREATE TABLE personal_records (id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE, exercise_id TEXT REFERENCES exercise_catalog(id) ON DELETE SET NULL, record_type TEXT NOT NULL CHECK(record_type IN ('WEIGHT','REPS','DURATION','DISTANCE','SPEED','OTHER')), value REAL NOT NULL, unit TEXT NOT NULL, achieved_at INTEGER NOT NULL, workout_session_id TEXT REFERENCES workout_sessions(id) ON DELETE SET NULL);
CREATE TABLE recovery_records (id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE, recorded_date TEXT NOT NULL, recovery_level INTEGER NOT NULL CHECK(recovery_level BETWEEN 1 AND 5), soreness_level INTEGER CHECK(soreness_level IS NULL OR soreness_level BETWEEN 1 AND 5), energy_level INTEGER CHECK(energy_level IS NULL OR energy_level BETWEEN 1 AND 5), note TEXT);
CREATE INDEX recovery_records_date_idx ON recovery_records(recorded_date DESC);
`,
);

const migration009 = defineMigration(
  9,
  'm5-entertainment',
  `
CREATE TABLE entertainment_items (
  id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE, category_id TEXT NOT NULL REFERENCES categories(id), title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
  item_type TEXT NOT NULL CHECK(item_type IN ('MOVIE','SERIES','BOOK','COMIC','GAME','ACTIVITY','TRIP','OTHER')),
  list_type TEXT NOT NULL CHECK(list_type IN ('WANT_TO_WATCH','WANT_TO_PLAY','WANT_TO_GO','OTHER')),
  status TEXT NOT NULL CHECK(status IN ('WISHLIST','PLANNED','IN_PROGRESS','COMPLETED','DROPPED')),
  progress_current REAL, progress_total REAL, progress_unit TEXT, started_at INTEGER, completed_at INTEGER, rating REAL CHECK(rating IS NULL OR rating BETWEEN 0 AND 10), note TEXT
);
CREATE INDEX entertainment_items_status_idx ON entertainment_items(status,item_type);
CREATE TABLE entertainment_sessions (
  id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE, item_id TEXT NOT NULL REFERENCES entertainment_items(id) ON DELETE CASCADE,
  session_date TEXT NOT NULL, duration_minutes INTEGER NOT NULL CHECK(duration_minutes >= 0), progress_delta REAL, note TEXT
);
CREATE INDEX entertainment_sessions_date_idx ON entertainment_sessions(session_date DESC);
CREATE TABLE activity_trip_details (
  entertainment_item_id TEXT PRIMARY KEY REFERENCES entertainment_items(id) ON DELETE CASCADE, start_at INTEGER, end_at INTEGER, location TEXT,
  event_id TEXT REFERENCES events(id) ON DELETE SET NULL, task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL, details_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(details_json))
);
CREATE TABLE entertainment_expenses (expense_entry_id TEXT PRIMARY KEY REFERENCES expense_entries(id) ON DELETE CASCADE, entertainment_item_id TEXT NOT NULL REFERENCES entertainment_items(id) ON DELETE CASCADE);
`,
);

const migration010 = defineMigration(
  10,
  'm6-quick-capture-and-inbox',
  `
CREATE TABLE inbox_items (
  id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE,
  raw_text TEXT NOT NULL CHECK(length(raw_text) BETWEEN 1 AND 10000),
  status TEXT NOT NULL DEFAULT 'UNPROCESSED' CHECK(status IN ('UNPROCESSED','PROCESSING','PROCESSED','ARCHIVED')),
  capture_mode TEXT NOT NULL CHECK(capture_mode IN ('INBOX_ONLY','AI_PROCESS')),
  processed_change_set_id TEXT REFERENCES change_sets(id),
  processed_at INTEGER
);
CREATE INDEX inbox_items_status_updated_idx ON inbox_items(status, id DESC);
CREATE TABLE inbox_item_results (
  inbox_item_id TEXT NOT NULL REFERENCES inbox_items(id) ON DELETE CASCADE,
  entity_id TEXT NOT NULL REFERENCES entity_index(id) ON DELETE CASCADE,
  result_type TEXT NOT NULL CHECK(result_type IN ('TASK','SHOPPING_ITEM')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY(inbox_item_id, entity_id)
);
CREATE INDEX inbox_item_results_entity_idx ON inbox_item_results(entity_id);
`,
);

const migration011 = defineMigration(
  11,
  'm6-notes-drafts-and-attachment-experience',
  `
CREATE TABLE drafts (
  id TEXT PRIMARY KEY CHECK(length(id) = 26),
  draft_key TEXT NOT NULL UNIQUE,
  entity_id TEXT REFERENCES entity_index(id) ON DELETE CASCADE,
  form_type TEXT NOT NULL,
  content_json TEXT NOT NULL CHECK(json_valid(content_json)),
  updated_at INTEGER NOT NULL,
  expires_at INTEGER
);
CREATE INDEX drafts_entity_updated_idx ON drafts(entity_id, updated_at DESC);
CREATE INDEX drafts_expiry_idx ON drafts(expires_at) WHERE expires_at IS NOT NULL;
`,
);

const migration012 = defineMigration(
  12,
  'm6-search-history-and-recycle-bin',
  `
CREATE TABLE search_documents (
  entity_id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  category_id TEXT,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  keywords TEXT NOT NULL DEFAULT '',
  event_at INTEGER,
  updated_at INTEGER NOT NULL
);
CREATE INDEX search_documents_filter_idx ON search_documents(entity_type, category_id, updated_at DESC);
CREATE VIRTUAL TABLE search_fts USING fts5(
  title,
  body,
  keywords,
  content='search_documents',
  content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 2'
);
CREATE TRIGGER search_documents_ai AFTER INSERT ON search_documents BEGIN
  INSERT INTO search_fts(rowid,title,body,keywords) VALUES (new.rowid,new.title,new.body,new.keywords);
END;
CREATE TRIGGER search_documents_ad AFTER DELETE ON search_documents BEGIN
  INSERT INTO search_fts(search_fts,rowid,title,body,keywords) VALUES ('delete',old.rowid,old.title,old.body,old.keywords);
END;
CREATE TRIGGER search_documents_au AFTER UPDATE ON search_documents BEGIN
  INSERT INTO search_fts(search_fts,rowid,title,body,keywords) VALUES ('delete',old.rowid,old.title,old.body,old.keywords);
  INSERT INTO search_fts(rowid,title,body,keywords) VALUES (new.rowid,new.title,new.body,new.keywords);
END;
`,
);

const migration013 = defineMigration(
  13,
  'm7-ai-provider-configurations',
  `
CREATE TABLE ai_provider_configs (
  id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE,
  provider_type TEXT NOT NULL CHECK(provider_type IN ('OPENAI','ANTHROPIC','GOOGLE','OPENAI_COMPATIBLE')),
  display_name TEXT NOT NULL CHECK(length(display_name) BETWEEN 1 AND 100),
  base_url TEXT,
  model_id TEXT NOT NULL CHECK(length(model_id) BETWEEN 1 AND 200),
  credential_ref TEXT NOT NULL UNIQUE,
  capabilities_json TEXT NOT NULL CHECK(json_valid(capabilities_json)),
  is_default INTEGER NOT NULL DEFAULT 0 CHECK(is_default IN (0,1)),
  last_verified_at INTEGER,
  last_error TEXT
);
CREATE UNIQUE INDEX ai_provider_configs_default_idx ON ai_provider_configs(is_default) WHERE is_default = 1;
CREATE INDEX ai_provider_configs_type_idx ON ai_provider_configs(provider_type);
`,
);

const migration014 = defineMigration(
  14,
  'm7-chat-sessions-and-runs',
  `
CREATE TABLE chat_sessions (id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE, title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200), provider_config_id TEXT NOT NULL REFERENCES ai_provider_configs(id), status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','ARCHIVED')), last_message_at INTEGER);
CREATE INDEX chat_sessions_list_idx ON chat_sessions(status,last_message_at DESC);
CREATE TABLE chat_messages (id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE, session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE, role TEXT NOT NULL CHECK(role IN ('USER','ASSISTANT','TOOL','SYSTEM')), content_json TEXT NOT NULL CHECK(json_valid(content_json)), plain_text TEXT NOT NULL DEFAULT '', model_id TEXT, status TEXT NOT NULL CHECK(status IN ('PENDING','STREAMING','COMPLETED','FAILED','CANCELLED')), completed_at INTEGER);
CREATE INDEX chat_messages_session_idx ON chat_messages(session_id, id);
CREATE TABLE ai_runs (id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE, session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE, user_message_id TEXT NOT NULL REFERENCES chat_messages(id), assistant_message_id TEXT NOT NULL REFERENCES chat_messages(id), provider_config_id TEXT NOT NULL REFERENCES ai_provider_configs(id), status TEXT NOT NULL CHECK(status IN ('QUEUED','RUNNING','AWAITING_TOOL','AWAITING_CONFIRMATION','COMPLETED','FAILED','CANCELLED')), web_search_used INTEGER NOT NULL DEFAULT 0 CHECK(web_search_used IN (0,1)), started_at INTEGER, finished_at INTEGER, error_code TEXT);
CREATE INDEX ai_runs_session_idx ON ai_runs(session_id,id DESC);
CREATE INDEX ai_runs_status_idx ON ai_runs(status,id);
CREATE TABLE ai_web_sources (id TEXT PRIMARY KEY, message_id TEXT NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE, title TEXT NOT NULL, url TEXT NOT NULL, publisher TEXT, published_at INTEGER, retrieved_at INTEGER NOT NULL, citation_order INTEGER NOT NULL);
CREATE UNIQUE INDEX ai_web_sources_order_idx ON ai_web_sources(message_id,citation_order);
`,
);

const migration015 = defineMigration(
  15,
  'm7-reminders-and-notifications',
  `
CREATE TABLE reminders (id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE, target_entity_id TEXT NOT NULL REFERENCES entity_index(id), trigger_mode TEXT NOT NULL CHECK(trigger_mode IN ('ABSOLUTE','OFFSET_BEFORE_START','OFFSET_BEFORE_DUE')), trigger_at INTEGER, offset_minutes INTEGER, is_enabled INTEGER NOT NULL CHECK(is_enabled IN (0,1)));
CREATE TABLE notifications (id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE, notification_type TEXT NOT NULL CHECK(notification_type IN ('REMINDER','SYSTEM','AI_SUGGESTION','SCHEDULE_WARNING')), target_entity_id TEXT REFERENCES entity_index(id), title TEXT NOT NULL, body TEXT NOT NULL, severity TEXT NOT NULL CHECK(severity IN ('INFO','WARNING','CRITICAL')), scheduled_at INTEGER NOT NULL, delivered_at INTEGER, read_at INTEGER, snoozed_until INTEGER, dedupe_key TEXT);
CREATE INDEX notifications_read_scheduled_idx ON notifications(read_at,scheduled_at DESC);
CREATE UNIQUE INDEX notifications_dedupe_key_idx ON notifications(dedupe_key) WHERE dedupe_key IS NOT NULL;
`,
);

const migration016 = defineMigration(
  16,
  'm7-ai-pending-actions',
  `
CREATE TABLE ai_actions (id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE, action_type TEXT NOT NULL CHECK(action_type IN ('REPLACE_LONG_TERM_GOAL')), request_json TEXT NOT NULL CHECK(json_valid(request_json)), preview_json TEXT NOT NULL CHECK(json_valid(preview_json)), confirmation_id TEXT NOT NULL UNIQUE REFERENCES confirmations(id), status TEXT NOT NULL CHECK(status IN ('AWAITING_CONFIRMATION','CONFIRMED','CANCELLED','EXECUTED','EXPIRED')), executed_at INTEGER, cancelled_at INTEGER);
CREATE INDEX ai_actions_status_idx ON ai_actions(status,id);
`,
);

const migration017 = defineMigration(
  17,
  'm7-ai-memories',
  `
CREATE TABLE ai_memories (id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE, memory_type TEXT NOT NULL CHECK(memory_type IN ('PREFERENCE','CONSTRAINT','ROUTINE_HINT','DECISION_STYLE')), content TEXT NOT NULL, confidence REAL NOT NULL CHECK(confidence >= 0 AND confidence <= 1), source_session_id TEXT REFERENCES chat_sessions(id), last_used_at INTEGER, is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)));
CREATE INDEX ai_memories_active_idx ON ai_memories(is_active, memory_type);
`,
);

const migration018 = defineMigration(
  18,
  'business-operation-context',
  `
ALTER TABLE change_sets ADD COLUMN actor_ref TEXT;
CREATE INDEX change_sets_source_ref_idx ON change_sets(source, source_ref);
`,
);

const migration019 = defineMigration(
  19,
  'a15-ai-tool-call-attribution',
  `
CREATE TABLE ai_tool_calls (
  id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL REFERENCES ai_runs(id) ON DELETE CASCADE,
  provider_config_id TEXT NOT NULL REFERENCES ai_provider_configs(id),
  model_id TEXT NOT NULL,
  user_message_id TEXT NOT NULL REFERENCES chat_messages(id),
  assistant_message_id TEXT NOT NULL REFERENCES chat_messages(id),
  provider_call_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  arguments_json TEXT NOT NULL CHECK(json_valid(arguments_json)),
  user_intent_reference TEXT,
  risk_level TEXT NOT NULL CHECK(risk_level IN ('READ_ONLY','LOW_WRITE','HIGH_WRITE')),
  status TEXT NOT NULL CHECK(status IN ('RUNNING','SUCCEEDED','FAILED')),
  change_set_id TEXT REFERENCES change_sets(id),
  result_json TEXT CHECK(result_json IS NULL OR json_valid(result_json)),
  error_code TEXT,
  finished_at INTEGER,
  UNIQUE(run_id, provider_call_id)
);

CREATE INDEX ai_tool_calls_run_idx ON ai_tool_calls(run_id, id);
CREATE INDEX ai_tool_calls_change_set_idx ON ai_tool_calls(change_set_id) WHERE change_set_id IS NOT NULL;
CREATE TABLE ai_action_execution_contexts (
  action_id TEXT PRIMARY KEY REFERENCES ai_actions(id) ON DELETE CASCADE,
  context_json TEXT NOT NULL CHECK(json_valid(context_json))
);
`,
);

const migration020 = defineMigration(
  20,
  'a16-generic-high-risk-actions',
  `
ALTER TABLE ai_action_execution_contexts RENAME TO ai_action_execution_contexts_legacy;
ALTER TABLE ai_actions RENAME TO ai_actions_legacy;
DROP INDEX ai_actions_status_idx;
CREATE TABLE ai_actions (
  id TEXT PRIMARY KEY REFERENCES entity_index(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK(action_type IN ('REPLACE_LONG_TERM_GOAL','DELETE_RECORD','BULK_UPDATE_RECORDS','CLEAR_AI_MEMORY','EMPTY_RECYCLE_BIN','REQUEST_RESCHEDULE')),
  request_json TEXT NOT NULL CHECK(json_valid(request_json)),
  preview_json TEXT NOT NULL CHECK(json_valid(preview_json)),
  confirmation_id TEXT NOT NULL UNIQUE REFERENCES confirmations(id),
  status TEXT NOT NULL CHECK(status IN ('AWAITING_CONFIRMATION','CONFIRMED','EXECUTING','EXECUTED','FAILED','CANCELLED','EXPIRED')),
  expires_at INTEGER,
  executed_at INTEGER,
  cancelled_at INTEGER,
  result_json TEXT CHECK(result_json IS NULL OR json_valid(result_json)),
  error_code TEXT
);

INSERT INTO ai_actions(id,action_type,request_json,preview_json,confirmation_id,status,executed_at,cancelled_at)
SELECT id,action_type,request_json,preview_json,confirmation_id,status,executed_at,cancelled_at FROM ai_actions_legacy;
CREATE INDEX ai_actions_status_idx ON ai_actions(status,id);
CREATE TABLE ai_action_execution_contexts (
  action_id TEXT PRIMARY KEY REFERENCES ai_actions(id) ON DELETE CASCADE,
  context_json TEXT NOT NULL CHECK(json_valid(context_json))
);
INSERT INTO ai_action_execution_contexts(action_id,context_json)
SELECT action_id,context_json FROM ai_action_execution_contexts_legacy;
DROP TABLE ai_action_execution_contexts_legacy;
DROP TABLE ai_actions_legacy;
`,
);

// RC3 前的候选构建曾以少一个空行的等价 SQL 执行 migration 20，并把该校验值写入
// 用户数据库。该构建的表结构与正式 migration 20 完全一致；保留精确哈希以兼容升级，
// 仍拒绝任何其他未知内容，避免把迁移漂移检查整体放宽。
const migration020WithCompatibility: Migration = {
  ...migration020,
  acceptedChecksums: ['5279dd2aaa730d8ad474898f3af7c4f9ad9bb830a6bbfc0cd3c5852d6658604f'],
};

const migration021 = defineMigration(
  21,
  'a19-inbox-goal-results',
  `
ALTER TABLE inbox_item_results RENAME TO inbox_item_results_legacy;
DROP INDEX inbox_item_results_entity_idx;
CREATE TABLE inbox_item_results (
  inbox_item_id TEXT NOT NULL REFERENCES inbox_items(id) ON DELETE CASCADE,
  entity_id TEXT NOT NULL REFERENCES entity_index(id),
  result_type TEXT NOT NULL CHECK(result_type IN ('TASK','SHOPPING_ITEM','GOAL')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY(inbox_item_id, entity_id)
);
INSERT INTO inbox_item_results(inbox_item_id,entity_id,result_type,created_at)
SELECT inbox_item_id,entity_id,result_type,created_at FROM inbox_item_results_legacy;
DROP TABLE inbox_item_results_legacy;
CREATE INDEX inbox_item_results_entity_idx ON inbox_item_results(entity_id);
`,
);

export const migrations: readonly Migration[] = [
  migration001,
  migration002,
  migration003,
  migration004,
  migration005,
  migration006,
  migration007,
  migration008,
  migration009,
  migration010,
  migration011,
  migration012,
  migration013,
  migration014,
  migration015,
  migration016,
  migration017,
  migration018,
  migration019,
  migration020WithCompatibility,
  migration021,
];
