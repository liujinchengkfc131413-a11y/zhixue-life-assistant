import { ulid } from 'ulid';

import type { Clock } from '@life-assistant/kernel';

import type { SqliteDatabase } from './sqlite-database.js';

export type ParentArea = 'WORK' | 'LIFE';
export type ModuleType =
  | 'SELF_MEDIA'
  | 'DEVELOPMENT'
  | 'LEARNING'
  | 'SHOPPING'
  | 'DIET'
  | 'FITNESS'
  | 'ENTERTAINMENT'
  | 'GENERIC';

export interface CategoryRecord {
  readonly id: string;
  readonly parentArea: ParentArea;
  readonly moduleType: ModuleType;
  readonly name: string;
  readonly description: string | null;
  readonly sortOrder: number;
  readonly isArchived: boolean;
  readonly version: number;
}

export interface TagRecord {
  readonly id: string;
  readonly name: string;
  readonly colorToken: string | null;
  readonly description: string | null;
  readonly version: number;
}

export interface SettingRecord {
  readonly key: string;
  readonly value: unknown;
  readonly valueType: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'OBJECT' | 'ARRAY';
  readonly updatedAt: string;
}

const valueTypeOf = (value: unknown): SettingRecord['valueType'] => {
  if (Array.isArray(value)) return 'ARRAY';
  if (value !== null && typeof value === 'object') return 'OBJECT';
  if (typeof value === 'boolean') return 'BOOLEAN';
  if (typeof value === 'number') return 'NUMBER';
  return 'STRING';
};

export class SharedRepository {
  public constructor(
    private readonly database: SqliteDatabase,
    private readonly clock: Clock,
  ) {}

  public seedDefaults(): void {
    const defaults: Readonly<Record<string, unknown>> = {
      'general.time_zone': 'Asia/Shanghai',
      'general.week_starts_on': 1,
      'quick_capture.default_action': 'INBOX',
      'attachments.max_size_bytes': 2_147_483_648,
      'backup.frequency': 'WEEKLY',
      'backup.retention_count': 8,
      'reminders.default_offset_minutes': 10,
    };
    const categorySeeds: readonly [ParentArea, ModuleType, string][] = [
      ['WORK', 'SELF_MEDIA', '自媒体'],
      ['WORK', 'DEVELOPMENT', '开发项目'],
      ['WORK', 'LEARNING', '学习'],
      ['LIFE', 'SHOPPING', '购物'],
      ['LIFE', 'DIET', '饮食'],
      ['LIFE', 'FITNESS', '健身'],
      ['LIFE', 'ENTERTAINMENT', '娱乐'],
    ];
    this.database.transaction(() => {
      for (const [key, value] of Object.entries(defaults)) this.setSetting(key, value);
      for (const area of ['WORK', 'LIFE'] as const) {
        this.database.raw
          .prepare(
            'INSERT OR IGNORE INTO category_order_versions(parent_area, version) VALUES (?, 1)',
          )
          .run(area);
      }
      for (const [area, moduleType, name] of categorySeeds) {
        const exists = this.database.raw
          .prepare('SELECT 1 FROM categories WHERE module_type = ? LIMIT 1')
          .get(moduleType);
        if (exists === undefined) this.createCategory({ parentArea: area, moduleType, name });
      }
    });
  }

  public listSettings(): readonly SettingRecord[] {
    const rows = this.database.raw
      .prepare('SELECT key, value_json, value_type, updated_at FROM settings ORDER BY key')
      .all() as {
      key: string;
      value_json: string;
      value_type: SettingRecord['valueType'];
      updated_at: number;
    }[];
    return rows.map((row) => ({
      key: row.key,
      value: JSON.parse(row.value_json) as unknown,
      valueType: row.value_type,
      updatedAt: new Date(row.updated_at).toISOString(),
    }));
  }

  public setSetting(key: string, value: unknown): SettingRecord {
    if (key.toLowerCase().includes('api_key')) throw new Error('敏感凭据不能写入设置数据库。');
    const now = this.clock.now().getTime();
    const valueType = valueTypeOf(value);
    this.database.raw
      .prepare(
        `INSERT INTO settings(key, scope, value_json, value_type, updated_at)
         VALUES (?, 'USER', ?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, value_type = excluded.value_type, updated_at = excluded.updated_at`,
      )
      .run(key, JSON.stringify(value), valueType, now);
    return { key, value, valueType, updatedAt: new Date(now).toISOString() };
  }

  public listCategories(includeArchived = false): readonly CategoryRecord[] {
    const rows = this.database.raw
      .prepare(
        `SELECT c.id, c.parent_area, c.module_type, c.name, c.description, c.sort_order, c.is_archived, e.version
         FROM categories c JOIN entity_index e ON e.id = c.id
         WHERE (? = 1 OR c.is_archived = 0) AND e.deleted_at IS NULL
         ORDER BY c.parent_area, c.sort_order, c.name`,
      )
      .all(includeArchived ? 1 : 0) as {
      id: string;
      parent_area: ParentArea;
      module_type: ModuleType;
      name: string;
      description: string | null;
      sort_order: number;
      is_archived: 0 | 1;
      version: number;
    }[];
    return rows.map((row) => this.mapCategory(row));
  }

  public createCategory(input: {
    readonly parentArea: ParentArea;
    readonly moduleType: ModuleType;
    readonly name: string;
    readonly description?: string | undefined;
  }): CategoryRecord {
    const id = ulid();
    const now = this.clock.now().getTime();
    return this.database.transaction(() => {
      const order = this.database.raw
        .prepare(
          'SELECT COALESCE(MAX(sort_order), -1) + 1 AS value FROM categories WHERE parent_area = ?',
        )
        .get(input.parentArea) as { value: number };
      this.database.raw
        .prepare(
          `INSERT INTO entity_index(id, entity_type, created_at, updated_at) VALUES (?, 'CATEGORY', ?, ?)`,
        )
        .run(id, now, now);
      this.database.raw
        .prepare(
          `INSERT INTO categories(id, parent_area, module_type, name, description, sort_order)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          input.parentArea,
          input.moduleType,
          input.name.trim(),
          input.description ?? null,
          order.value,
        );
      return this.getCategory(id);
    });
  }

  public getCategory(id: string): CategoryRecord {
    const row = this.database.raw
      .prepare(
        `SELECT c.id, c.parent_area, c.module_type, c.name, c.description, c.sort_order, c.is_archived, e.version
         FROM categories c JOIN entity_index e ON e.id = c.id WHERE c.id = ? AND e.deleted_at IS NULL`,
      )
      .get(id) as
      | {
          id: string;
          parent_area: ParentArea;
          module_type: ModuleType;
          name: string;
          description: string | null;
          sort_order: number;
          is_archived: 0 | 1;
          version: number;
        }
      | undefined;
    if (row === undefined) throw new Error('分类不存在。');
    return this.mapCategory(row);
  }

  public updateCategory(
    id: string,
    expectedVersion: number,
    patch: {
      readonly name?: string | undefined;
      readonly description?: string | null | undefined;
    },
  ): CategoryRecord {
    const now = this.clock.now().getTime();
    return this.database.transaction(() => {
      const current = this.getCategory(id);
      if (current.version !== expectedVersion) throw new Error('VERSION_CONFLICT');
      this.database.raw
        .prepare('UPDATE categories SET name = ?, description = ? WHERE id = ?')
        .run(
          patch.name?.trim() ?? current.name,
          patch.description === undefined ? current.description : patch.description,
          id,
        );
      this.database.raw
        .prepare(
          'UPDATE entity_index SET version = version + 1, updated_at = ? WHERE id = ? AND version = ?',
        )
        .run(now, id, expectedVersion);
      return this.getCategory(id);
    });
  }

  public setCategoryArchived(
    id: string,
    archived: boolean,
    expectedVersion: number,
  ): CategoryRecord {
    const now = this.clock.now().getTime();
    return this.database.transaction(() => {
      const current = this.getCategory(id);
      if (current.version !== expectedVersion) throw new Error('VERSION_CONFLICT');
      this.database.raw
        .prepare('UPDATE categories SET is_archived = ?, archived_at = ? WHERE id = ?')
        .run(archived ? 1 : 0, archived ? now : null, id);
      this.database.raw
        .prepare('UPDATE entity_index SET version = version + 1, updated_at = ? WHERE id = ?')
        .run(now, id);
      return this.getCategory(id);
    });
  }

  public reorderCategories(
    area: ParentArea,
    ids: readonly string[],
    expectedOrderVersion: number,
  ): number {
    return this.database.transaction(() => {
      const current = this.database.raw
        .prepare('SELECT version FROM category_order_versions WHERE parent_area = ?')
        .get(area) as { version: number };
      if (current.version !== expectedOrderVersion) throw new Error('VERSION_CONFLICT');
      const actualIds = this.listCategories(true)
        .filter((category) => category.parentArea === area)
        .map((category) => category.id);
      if (ids.length !== actualIds.length || ids.some((id) => !actualIds.includes(id))) {
        throw new Error('排序请求必须包含该区域的完整分类列表。');
      }
      const update = this.database.raw.prepare('UPDATE categories SET sort_order = ? WHERE id = ?');
      ids.forEach((id, index) => update.run(index, id));
      this.database.raw
        .prepare('UPDATE category_order_versions SET version = version + 1 WHERE parent_area = ?')
        .run(area);
      return expectedOrderVersion + 1;
    });
  }

  public getCategoryOrderVersion(area: ParentArea): number {
    return (
      this.database.raw
        .prepare('SELECT version FROM category_order_versions WHERE parent_area = ?')
        .get(area) as { version: number }
    ).version;
  }

  public listTags(): readonly TagRecord[] {
    const rows = this.database.raw
      .prepare(
        `SELECT t.id, t.name, t.color_token, t.description, e.version
         FROM tags t JOIN entity_index e ON e.id = t.id WHERE e.deleted_at IS NULL ORDER BY t.name`,
      )
      .all() as {
      id: string;
      name: string;
      color_token: string | null;
      description: string | null;
      version: number;
    }[];
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      colorToken: row.color_token,
      description: row.description,
      version: row.version,
    }));
  }

  public createTag(input: {
    readonly name: string;
    readonly colorToken?: string | undefined;
    readonly description?: string | undefined;
  }): TagRecord {
    const id = ulid();
    const now = this.clock.now().getTime();
    return this.database.transaction(() => {
      this.database.raw
        .prepare(
          `INSERT INTO entity_index(id, entity_type, created_at, updated_at) VALUES (?, 'TAG', ?, ?) `,
        )
        .run(id, now, now);
      this.database.raw
        .prepare('INSERT INTO tags(id, name, color_token, description) VALUES (?, ?, ?, ?)')
        .run(id, input.name.trim(), input.colorToken ?? null, input.description ?? null);
      return this.requireTag(id);
    });
  }

  public updateTag(
    id: string,
    expectedVersion: number,
    patch: {
      readonly name?: string | undefined;
      readonly colorToken?: string | null | undefined;
      readonly description?: string | null | undefined;
    },
  ): TagRecord {
    const current = this.listTags().find((tag) => tag.id === id);
    if (current === undefined) throw new Error('标签不存在。');
    if (current.version !== expectedVersion) throw new Error('VERSION_CONFLICT');
    this.database.transaction(() => {
      this.database.raw
        .prepare('UPDATE tags SET name = ?, color_token = ?, description = ? WHERE id = ?')
        .run(
          patch.name?.trim() ?? current.name,
          patch.colorToken === undefined ? current.colorToken : patch.colorToken,
          patch.description === undefined ? current.description : patch.description,
          id,
        );
      this.database.raw
        .prepare('UPDATE entity_index SET version = version + 1, updated_at = ? WHERE id = ?')
        .run(this.clock.now().getTime(), id);
    });
    return this.requireTag(id);
  }

  public softDeleteTag(id: string, expectedVersion: number): void {
    const current = this.listTags().find((tag) => tag.id === id);
    if (current === undefined) throw new Error('标签不存在。');
    if (current.version !== expectedVersion) throw new Error('VERSION_CONFLICT');
    const now = this.clock.now().getTime();
    this.database.raw
      .prepare(
        `UPDATE entity_index SET version = version + 1, updated_at = ?, deleted_at = ?, purge_after = ? WHERE id = ?`,
      )
      .run(now, now, now + 30 * 86_400_000, id);
  }

  private requireTag(id: string): TagRecord {
    const tag = this.listTags().find((item) => item.id === id);
    if (tag === undefined) throw new Error('标签不存在。');
    return tag;
  }

  private mapCategory(row: {
    id: string;
    parent_area: ParentArea;
    module_type: ModuleType;
    name: string;
    description: string | null;
    sort_order: number;
    is_archived: 0 | 1;
    version: number;
  }): CategoryRecord {
    return {
      id: row.id,
      parentArea: row.parent_area,
      moduleType: row.module_type,
      name: row.name,
      description: row.description,
      sortOrder: row.sort_order,
      isArchived: row.is_archived === 1,
      version: row.version,
    };
  }
}
