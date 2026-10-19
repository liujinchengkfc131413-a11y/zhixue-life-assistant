import { describe, expect, it } from 'vitest';

import { expandRecurrence, parseRecurrenceRule } from './recurrence.js';

describe('RFC 5545 recurrence subset', () => {
  it('parses supported fields and rejects unsupported input', () => {
    expect(parseRecurrenceRule('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;COUNT=4')).toMatchObject({
      frequency: 'WEEKLY',
      interval: 2,
      byDay: ['MO', 'WE'],
      count: 4,
    });
    expect(() => parseRecurrenceRule('FREQ=HOURLY')).toThrow('INVALID_RRULE_FREQUENCY');
  });

  it('expands a weekly rule into stable local recurrence keys', () => {
    const values = expandRecurrence({
      rrule: 'FREQ=WEEKLY;BYDAY=MO,WE;COUNT=4',
      dtstartLocal: '2026-08-10T09:00',
      rangeEnd: Date.parse('2026-09-01T00:00:00+08:00'),
    });
    expect(values.map((value) => value.recurrenceKey)).toEqual([
      '2026-08-10T09:00',
      '2026-08-12T09:00',
      '2026-08-17T09:00',
      '2026-08-19T09:00',
    ]);
  });

  it('uses the start weekday when a weekly rule omits BYDAY', () => {
    const values = expandRecurrence({
      rrule: 'FREQ=WEEKLY;COUNT=3',
      dtstartLocal: '2026-09-03T09:00',
      rangeEnd: Date.parse('2026-10-01T00:00:00+08:00'),
    });
    expect(values.map((value) => value.recurrenceKey)).toEqual([
      '2026-09-03T09:00',
      '2026-09-10T09:00',
      '2026-09-17T09:00',
    ]);
  });
});
