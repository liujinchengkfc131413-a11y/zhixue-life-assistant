import { ulid } from 'ulid';

import type { Clock } from '@life-assistant/kernel';

import type { SqliteDatabase } from './sqlite-database.js';

export type RoutineTemplateType = 'WORKDAY' | 'WEEKEND' | 'HOLIDAY' | 'CUSTOM';
export type RoutineSegmentType = 'SLEEP' | 'WORK' | 'LIFE' | 'REST';

export interface RoutineSegmentRecord {
  readonly id: string;
  readonly name: string;
  readonly segmentType: RoutineSegmentType;
  readonly startTime: string;
  readonly endTime: string;
  readonly isImmovable: boolean;
  readonly sortOrder: number;
}

export interface RoutineTemplateRecord {
  readonly id: string;
  readonly version: number;
  readonly name: string;
  readonly templateType: RoutineTemplateType;
  readonly isDefault: boolean;
  readonly timeZone: string;
  readonly segments: readonly RoutineSegmentRecord[];
}

export interface HolidayRecord {
  readonly localDate: string;
  readonly name: string;
  readonly dayType: 'HOLIDAY' | 'MAKEUP_WORKDAY';
  readonly source: 'SYSTEM_UPDATE' | 'USER_OVERRIDE';
}

export interface RoutineOverrideRecord {
  readonly id: string;
  readonly localDate: string;
  readonly templateId: string | null;
  readonly segments: readonly SegmentInput[] | null;
  readonly note: string | null;
}

interface SegmentInput {
  readonly name: string;
  readonly segmentType: RoutineSegmentType;
  readonly startTime: string;
  readonly endTime: string;
  readonly isImmovable?: boolean | undefined;
}

const timePattern = /^(?:[01]\d|2[0-3]):(?:00|15|30|45)$/;

const timeToMinutes = (value: string): number => {
  if (!timePattern.test(value)) throw new Error('INVALID_ROUTINE_TIME');
  const [hoursText, minutesText] = value.split(':');
  return Number(hoursText) * 60 + Number(minutesText);
};

const validateSegments = (segments: readonly SegmentInput[]): void => {
  const occupied: { start: number; end: number }[] = [];
  for (const segment of segments) {
    const start = timeToMinutes(segment.startTime);
    const end = timeToMinutes(segment.endTime);
    if (start === end) throw new Error('INVALID_ROUTINE_SEGMENT');
    const parts =
      end > start
        ? [{ start, end }]
        : [
            { start, end: 1440 },
            { start: 0, end },
          ];
    for (const part of parts) {
      if (occupied.some((other) => part.start < other.end && other.start < part.end)) {
        throw new Error('ROUTINE_SEGMENT_OVERLAP');
      }
      occupied.push(part);
    }
  }
};

export class RoutineRepository {
  public constructor(
    private readonly database: SqliteDatabase,
    private readonly clock: Clock,
  ) {}

  public seedDefaults(): void {
    const count = this.database.raw
      .prepare('SELECT COUNT(*) AS count FROM routine_templates')
      .get() as {
      count: number;
    };
    if (count.count > 0) return;
    this.createTemplate({
      name: '默认工作日',
      templateType: 'WORKDAY',
      isDefault: true,
      segments: [
        {
          name: '睡眠',
          segmentType: 'SLEEP',
          startTime: '23:00',
          endTime: '07:00',
          isImmovable: true,
        },
        { name: '工作', segmentType: 'WORK', startTime: '09:00', endTime: '18:00' },
        { name: '生活', segmentType: 'LIFE', startTime: '19:00', endTime: '22:30' },
      ],
    });
    this.createTemplate({
      name: '默认周末',
      templateType: 'WEEKEND',
      isDefault: true,
      segments: [
        {
          name: '睡眠',
          segmentType: 'SLEEP',
          startTime: '00:00',
          endTime: '08:00',
          isImmovable: true,
        },
        { name: '生活', segmentType: 'LIFE', startTime: '09:00', endTime: '22:30' },
      ],
    });
    this.createTemplate({
      name: '默认节假日',
      templateType: 'HOLIDAY',
      isDefault: true,
      segments: [
        {
          name: '睡眠',
          segmentType: 'SLEEP',
          startTime: '00:00',
          endTime: '08:00',
          isImmovable: true,
        },
        { name: '生活', segmentType: 'LIFE', startTime: '09:00', endTime: '22:30' },
      ],
    });
  }

  public createTemplate(input: {
    name: string;
    templateType: RoutineTemplateType;
    isDefault?: boolean | undefined;
    segments: readonly SegmentInput[];
  }): RoutineTemplateRecord {
    validateSegments(input.segments);
    const id = ulid();
    const now = this.clock.now().getTime();
    this.database.transaction(() => {
      if (input.isDefault === true) this.clearDefault(input.templateType);
      this.database.raw
        .prepare(
          `INSERT INTO entity_index(id, entity_type, created_at, updated_at) VALUES (?, 'ROUTINE_TEMPLATE', ?, ?)`,
        )
        .run(id, now, now);
      this.database.raw
        .prepare(
          `INSERT INTO routine_templates(id, name, template_type, is_default) VALUES (?, ?, ?, ?)`,
        )
        .run(id, input.name.trim(), input.templateType, input.isDefault === true ? 1 : 0);
      this.replaceSegments(id, input.segments);
    });
    return this.requireTemplate(id);
  }

  public listTemplates(): readonly RoutineTemplateRecord[] {
    const rows = this.database.raw
      .prepare(
        `SELECT template.*, entity.version FROM routine_templates template
         JOIN entity_index entity ON entity.id = template.id AND entity.deleted_at IS NULL
         ORDER BY template.template_type, template.is_default DESC, template.name`,
      )
      .all() as {
      id: string;
      version: number;
      name: string;
      template_type: RoutineTemplateType;
      is_default: number;
      time_zone: string;
    }[];
    return rows.map((row) => ({
      id: row.id,
      version: row.version,
      name: row.name,
      templateType: row.template_type,
      isDefault: row.is_default === 1,
      timeZone: row.time_zone,
      segments: this.listSegments(row.id),
    }));
  }

  public updateTemplate(
    id: string,
    expectedVersion: number,
    input: { name?: string | undefined; segments?: readonly SegmentInput[] | undefined },
  ): RoutineTemplateRecord {
    const current = this.requireTemplate(id);
    if (current.version !== expectedVersion) throw new Error('VERSION_CONFLICT');
    if (input.segments !== undefined) validateSegments(input.segments);
    this.database.transaction(() => {
      if (input.name !== undefined) {
        this.database.raw
          .prepare('UPDATE routine_templates SET name = ? WHERE id = ?')
          .run(input.name.trim(), id);
      }
      if (input.segments !== undefined) this.replaceSegments(id, input.segments);
      this.database.raw
        .prepare('UPDATE entity_index SET version = version + 1, updated_at = ? WHERE id = ?')
        .run(this.clock.now().getTime(), id);
    });
    return this.requireTemplate(id);
  }

  public setDefault(id: string): RoutineTemplateRecord {
    const current = this.requireTemplate(id);
    this.database.transaction(() => {
      this.clearDefault(current.templateType);
      this.database.raw.prepare('UPDATE routine_templates SET is_default = 1 WHERE id = ?').run(id);
    });
    return this.requireTemplate(id);
  }

  public resolveTemplate(localDate: string): RoutineTemplateRecord {
    const override = this.database.raw
      .prepare(
        `SELECT override.id, override.template_id, override.segments_json, entity.version
         FROM date_routine_overrides override
         JOIN entity_index entity ON entity.id = override.id
         WHERE override.local_date = ?`,
      )
      .get(localDate) as
      | { id: string; template_id: string | null; segments_json: string | null; version: number }
      | undefined;
    if (override?.template_id !== null && override?.template_id !== undefined) {
      return this.requireTemplate(override.template_id);
    }
    if (override?.segments_json !== null && override?.segments_json !== undefined) {
      const segments = JSON.parse(override.segments_json) as SegmentInput[];
      return {
        id: override.id,
        version: override.version,
        name: `${localDate} 自定义作息`,
        templateType: 'CUSTOM',
        isDefault: false,
        timeZone: 'Asia/Shanghai',
        segments: segments.map((segment, index) => ({
          ...segment,
          id: `${override.id}:${String(index)}`,
          isImmovable: segment.isImmovable === true,
          sortOrder: index,
        })),
      };
    }
    const holiday = this.getHoliday(localDate);
    const [year, month, day] = localDate.split('-').map(Number);
    const weekday = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1)).getUTCDay();
    const type: RoutineTemplateType =
      holiday?.dayType === 'HOLIDAY'
        ? 'HOLIDAY'
        : holiday?.dayType === 'MAKEUP_WORKDAY'
          ? 'WORKDAY'
          : weekday === 0 || weekday === 6
            ? 'WEEKEND'
            : 'WORKDAY';
    const template = this.listTemplates().find(
      (item) => item.templateType === type && item.isDefault,
    );
    if (template === undefined) throw new Error('DEFAULT_ROUTINE_NOT_FOUND');
    return template;
  }

  public getDateOverride(localDate: string): RoutineOverrideRecord | null {
    const row = this.database.raw
      .prepare(
        `SELECT id, local_date, template_id, segments_json, note
         FROM date_routine_overrides WHERE local_date = ?`,
      )
      .get(localDate) as
      | {
          id: string;
          local_date: string;
          template_id: string | null;
          segments_json: string | null;
          note: string | null;
        }
      | undefined;
    if (row === undefined) return null;
    return {
      id: row.id,
      localDate: row.local_date,
      templateId: row.template_id,
      segments:
        row.segments_json === null ? null : (JSON.parse(row.segments_json) as SegmentInput[]),
      note: row.note,
    };
  }

  public setDateOverride(
    localDate: string,
    input:
      | { templateId: string; note?: string | undefined }
      | { segments: readonly SegmentInput[]; note?: string | undefined },
  ): RoutineOverrideRecord {
    const templateId = 'templateId' in input ? input.templateId : null;
    const segments = 'segments' in input ? input.segments : null;
    if (templateId !== null) this.requireTemplate(templateId);
    if (segments !== null) validateSegments(segments);
    const existing = this.database.raw
      .prepare('SELECT id FROM date_routine_overrides WHERE local_date = ?')
      .get(localDate) as { id: string } | undefined;
    const now = this.clock.now().getTime();
    if (existing === undefined) {
      const id = ulid();
      this.database.transaction(() => {
        this.database.raw
          .prepare(
            `INSERT INTO entity_index(id, entity_type, created_at, updated_at) VALUES (?, 'ROUTINE_OVERRIDE', ?, ?)`,
          )
          .run(id, now, now);
        this.database.raw
          .prepare(
            `INSERT INTO date_routine_overrides(id, local_date, template_id, segments_json, note)
             VALUES (?, ?, ?, ?, ?)`,
          )
          .run(
            id,
            localDate,
            templateId,
            segments === null ? null : JSON.stringify(segments),
            input.note ?? null,
          );
      });
      const created = this.getDateOverride(localDate);
      if (created === null) throw new Error('ROUTINE_OVERRIDE_WRITE_FAILED');
      return created;
    }
    this.database.transaction(() => {
      this.database.raw
        .prepare(
          'UPDATE date_routine_overrides SET template_id = ?, segments_json = ?, note = ? WHERE id = ?',
        )
        .run(
          templateId,
          segments === null ? null : JSON.stringify(segments),
          input.note ?? null,
          existing.id,
        );
      this.database.raw
        .prepare('UPDATE entity_index SET version = version + 1, updated_at = ? WHERE id = ?')
        .run(now, existing.id);
    });
    const updated = this.getDateOverride(localDate);
    if (updated === null) throw new Error('ROUTINE_OVERRIDE_WRITE_FAILED');
    return updated;
  }

  public removeDateOverride(localDate: string): boolean {
    const existing = this.getDateOverride(localDate);
    if (existing === null) return false;
    this.database.raw.prepare('DELETE FROM entity_index WHERE id = ?').run(existing.id);
    return true;
  }

  public upsertHoliday(input: HolidayRecord): void {
    const existing = this.getHoliday(input.localDate);
    if (existing?.source === 'USER_OVERRIDE' && input.source === 'SYSTEM_UPDATE') return;
    this.database.raw
      .prepare(
        `INSERT INTO holiday_calendar(local_date, name, day_type, source, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(local_date) DO UPDATE SET name = excluded.name, day_type = excluded.day_type,
           source = excluded.source, updated_at = excluded.updated_at`,
      )
      .run(input.localDate, input.name, input.dayType, input.source, this.clock.now().getTime());
  }

  public applySystemHolidays(
    records: readonly {
      localDate: string;
      name: string;
      dayType: 'HOLIDAY' | 'MAKEUP_WORKDAY';
    }[],
    sourceUrl: string,
  ): { applied: number; preservedUserOverrides: number } {
    let applied = 0;
    let preservedUserOverrides = 0;
    this.database.transaction(() => {
      const now = this.clock.now().getTime();
      for (const record of records) {
        const existing = this.getHoliday(record.localDate);
        if (existing?.source === 'USER_OVERRIDE') {
          preservedUserOverrides += 1;
          continue;
        }
        this.database.raw
          .prepare(
            `INSERT INTO holiday_calendar(local_date, name, day_type, source, source_url, fetched_at, updated_at)
             VALUES (?, ?, ?, 'SYSTEM_UPDATE', ?, ?, ?)
             ON CONFLICT(local_date) DO UPDATE SET name = excluded.name, day_type = excluded.day_type,
               source = excluded.source, source_url = excluded.source_url, fetched_at = excluded.fetched_at,
               updated_at = excluded.updated_at`,
          )
          .run(record.localDate, record.name, record.dayType, sourceUrl, now, now);
        applied += 1;
      }
    });
    return { applied, preservedUserOverrides };
  }

  public removeHolidayOverride(localDate: string): boolean {
    const existing = this.getHoliday(localDate);
    if (existing?.source !== 'USER_OVERRIDE') return false;
    this.database.raw.prepare('DELETE FROM holiday_calendar WHERE local_date = ?').run(localDate);
    return true;
  }

  public listHolidays(year: number): readonly HolidayRecord[] {
    return this.database.raw
      .prepare(
        `SELECT local_date AS localDate, name, day_type AS dayType, source
         FROM holiday_calendar WHERE local_date >= ? AND local_date < ? ORDER BY local_date`,
      )
      .all(
        `${String(year).padStart(4, '0')}-01-01`,
        `${String(year + 1).padStart(4, '0')}-01-01`,
      ) as HolidayRecord[];
  }

  private getHoliday(localDate: string): HolidayRecord | undefined {
    return this.database.raw
      .prepare(
        `SELECT local_date AS localDate, name, day_type AS dayType, source FROM holiday_calendar WHERE local_date = ?`,
      )
      .get(localDate) as HolidayRecord | undefined;
  }

  private listSegments(templateId: string): readonly RoutineSegmentRecord[] {
    const rows = this.database.raw
      .prepare(
        `SELECT id, name, segment_type, start_time, end_time, is_immovable, sort_order
         FROM routine_segments WHERE template_id = ? ORDER BY sort_order`,
      )
      .all(templateId) as {
      id: string;
      name: string;
      segment_type: RoutineSegmentType;
      start_time: string;
      end_time: string;
      is_immovable: number;
      sort_order: number;
    }[];
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      segmentType: row.segment_type,
      startTime: row.start_time,
      endTime: row.end_time,
      isImmovable: row.is_immovable === 1,
      sortOrder: row.sort_order,
    }));
  }

  private replaceSegments(templateId: string, segments: readonly SegmentInput[]): void {
    this.database.raw.prepare('DELETE FROM routine_segments WHERE template_id = ?').run(templateId);
    const insert = this.database.raw.prepare(
      `INSERT INTO routine_segments(id, template_id, name, segment_type, start_time, end_time, is_immovable, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    segments.forEach((segment, index) => {
      insert.run(
        ulid(),
        templateId,
        segment.name.trim(),
        segment.segmentType,
        segment.startTime,
        segment.endTime,
        segment.isImmovable === true || segment.segmentType === 'SLEEP' ? 1 : 0,
        index,
      );
    });
  }

  private clearDefault(type: RoutineTemplateType): void {
    this.database.raw
      .prepare('UPDATE routine_templates SET is_default = 0 WHERE template_type = ?')
      .run(type);
  }

  private requireTemplate(id: string): RoutineTemplateRecord {
    const value = this.listTemplates().find((item) => item.id === id);
    if (value === undefined) throw new Error('ROUTINE_TEMPLATE_NOT_FOUND');
    return value;
  }
}
