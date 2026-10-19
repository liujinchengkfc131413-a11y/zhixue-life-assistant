import { describe, expect, it } from 'vitest';

import {
  ActionRepository,
  ConsistencyRepository,
  SharedRepository,
  SqliteDatabase,
} from '@life-assistant/database';
import { FixedClock } from '@life-assistant/kernel';

import { RecurrenceService } from './recurrence-service.js';

const clock = new FixedClock(new Date('2026-09-03T00:00:00.000Z'));

const setup = () => {
  const database = new SqliteDatabase(':memory:', clock);
  database.migrate();
  const consistency = new ConsistencyRepository(database, clock);
  const actions = new ActionRepository(database, clock, consistency);
  const shared = new SharedRepository(database, clock);
  shared.seedDefaults();
  const category = shared.listCategories().find((item) => item.parentArea === 'LIFE');
  if (category === undefined) throw new Error('测试缺少生活分类。');
  const event = actions.createEvent({
    categoryId: category.id,
    title: '每日散步',
    startAt: Date.parse('2026-09-03T01:00:00.000Z'),
    endAt: Date.parse('2026-09-03T01:30:00.000Z'),
    eventType: 'GENERAL',
    priority: 'NORMAL',
    isImmovable: false,
    allowOverlap: false,
  });
  const recurrences = new RecurrenceService(database, actions, clock);
  const rule = recurrences.createRule({
    targetType: 'EVENT_TEMPLATE',
    targetEntityId: event.id,
    rrule: 'FREQ=DAILY',
    dtstartLocal: '2026-09-03T09:00',
    generationHorizonDays: 30,
  });
  return { database, actions, recurrences, event, rule };
};

describe('A4 recurrence modification semantics', () => {
  it('reuses the source as the first occurrence and supports only-this plus skip-once idempotently', () => {
    const { database, actions, recurrences, event, rule } = setup();
    const initial = recurrences.listOccurrences(rule.id);
    expect(initial[0]).toMatchObject({
      recurrenceKey: '2026-09-03T09:00',
      generatedEntityId: event.id,
      status: 'GENERATED',
    });
    expect(new Set(initial.map((item) => item.generatedEntityId)).size).toBe(initial.length);

    const first = initial[0];
    const third = initial[2];
    if (first?.generatedEntityId === null || first === undefined || third === undefined)
      throw new Error('测试缺少重复实例。');
    const afterOverride = recurrences.modify(rule.id, rule.version, {
      action: 'ONLY_THIS',
      recurrenceKey: first.recurrenceKey,
      override: { title: '只改这次散步' },
    });
    expect(actions.getEvent(first.generatedEntityId)?.title).toBe('只改这次散步');
    expect(
      database.raw
        .prepare(
          'SELECT exception_type FROM recurrence_exceptions WHERE rule_id=? AND recurrence_key=?',
        )
        .get(rule.id, first.recurrenceKey),
    ).toEqual({ exception_type: 'OVERRIDE' });

    database.raw
      .prepare('UPDATE recurrence_rules SET generation_horizon_days=60 WHERE id=?')
      .run(rule.id);
    expect(recurrences.generate(rule.id)).toBeGreaterThan(0);
    const generatedAfterSourceOverride = recurrences.listOccurrences(rule.id).at(-1);
    expect(actions.getEvent(generatedAfterSourceOverride?.generatedEntityId ?? '')?.title).toBe(
      '每日散步',
    );

    const skippedEntityId = third.generatedEntityId;
    const afterSkip = recurrences.modify(rule.id, afterOverride.version, {
      action: 'SKIP_ONCE',
      recurrenceKey: third.recurrenceKey,
    });
    expect(
      recurrences
        .listOccurrences(rule.id)
        .find((item) => item.recurrenceKey === third.recurrenceKey),
    ).toMatchObject({ status: 'SKIPPED', generatedEntityId: skippedEntityId });
    expect(actions.getEvent(skippedEntityId ?? '')).toBeUndefined();
    expect(recurrences.generate(rule.id)).toBe(0);
    expect(() =>
      recurrences.modify(rule.id, afterOverride.version, {
        action: 'SKIP_ONCE',
        recurrenceKey: third.recurrenceKey,
      }),
    ).toThrow(/VERSION_CONFLICT/);
    expect(afterSkip.version).toBe(rule.version + 2);
    database.close();
  });

  it('splits this-and-future into a new traceable rule without rewriting past instances', () => {
    const { database, recurrences, rule } = setup();
    const before = recurrences.listOccurrences(rule.id);
    const split = before[1];
    if (split === undefined) throw new Error('测试缺少切分实例。');
    const future = recurrences.modify(rule.id, rule.version, {
      action: 'THIS_AND_FUTURE',
      recurrenceKey: split.recurrenceKey,
      rrule: 'FREQ=WEEKLY',
    });
    expect(future.id).not.toBe(rule.id);
    expect(future.dtstartLocal).toBe(split.recurrenceKey);
    expect(future.rrule).toBe('FREQ=WEEKLY');
    expect(recurrences.listOccurrences(rule.id)[0]?.status).toBe('GENERATED');
    expect(
      recurrences
        .listOccurrences(rule.id)
        .filter((item) => Date.parse(item.scheduledAt) >= Date.parse(split.scheduledAt))
        .every((item) => item.status === 'CANCELLED'),
    ).toBe(true);
    expect(recurrences.generate(rule.id)).toBe(0);
    expect(recurrences.listOccurrences(future.id)[0]?.recurrenceKey).toBe(split.recurrenceKey);
    database.close();
  });

  it('rebuilds only non-past instances for the entire series and can end future generation', () => {
    const { database, recurrences, rule } = setup();
    const initial = recurrences.listOccurrences(rule.id);
    const effective = initial[1];
    if (effective === undefined) throw new Error('测试缺少系列修改实例。');
    const pastId = initial[0]?.generatedEntityId;
    const replacedFutureIds = initial
      .slice(1)
      .map((item) => item.generatedEntityId)
      .filter((id): id is string => id !== null);
    const weekly = recurrences.modify(rule.id, rule.version, {
      action: 'ENTIRE_SERIES',
      recurrenceKey: effective.recurrenceKey,
      rrule: 'FREQ=WEEKLY',
    });
    expect(weekly).toMatchObject({ id: rule.id, rrule: 'FREQ=WEEKLY', version: rule.version + 1 });
    const rebuilt = recurrences.listOccurrences(rule.id);
    expect(rebuilt[0]?.generatedEntityId).toBe(pastId);
    expect(rebuilt.some((item) => replacedFutureIds.includes(item.generatedEntityId ?? ''))).toBe(
      false,
    );
    expect(rebuilt.map((item) => item.recurrenceKey)).toEqual([
      '2026-09-03T09:00',
      '2026-09-10T09:00',
      '2026-09-17T09:00',
      '2026-09-24T09:00',
      '2026-10-01T09:00',
    ]);

    const endAt = rebuilt[1];
    if (endAt === undefined) throw new Error('测试缺少结束重复实例。');
    const ended = recurrences.modify(rule.id, weekly.version, {
      action: 'END_RECURRENCE',
      recurrenceKey: endAt.recurrenceKey,
    });
    expect(ended.isActive).toBe(false);
    expect(recurrences.generate(rule.id)).toBe(0);
    expect(
      recurrences
        .listOccurrences(rule.id)
        .filter((item) => Date.parse(item.scheduledAt) > Date.parse(endAt.scheduledAt))
        .every((item) => item.status === 'CANCELLED'),
    ).toBe(true);
    database.close();
  });
});
