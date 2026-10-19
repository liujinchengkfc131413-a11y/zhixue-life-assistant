const dayMilliseconds = 86_400_000;

export interface ParsedRecurrenceRule {
  readonly frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  readonly interval: number;
  readonly byDay: readonly ('MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU')[];
  readonly count?: number | undefined;
  readonly until?: number | undefined;
}

export interface RecurrenceOccurrence {
  readonly recurrenceKey: string;
  readonly scheduledAt: number;
}

const dayCodes = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;
const supportedKeys = new Set(['FREQ', 'INTERVAL', 'BYDAY', 'COUNT', 'UNTIL']);

const parseUntil = (value: string): number => {
  if (/^\d{8}T\d{6}Z$/.test(value)) {
    return Date.UTC(
      Number(value.slice(0, 4)),
      Number(value.slice(4, 6)) - 1,
      Number(value.slice(6, 8)),
      Number(value.slice(9, 11)),
      Number(value.slice(11, 13)),
      Number(value.slice(13, 15)),
    );
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error('INVALID_RRULE_UNTIL');
  return parsed;
};

export const parseRecurrenceRule = (rrule: string): ParsedRecurrenceRule => {
  const entries = new Map<string, string>();
  for (const component of rrule.replace(/^RRULE:/, '').split(';')) {
    const [key, value] = component.split('=');
    if (key === undefined || value === undefined || !supportedKeys.has(key) || entries.has(key)) {
      throw new Error('INVALID_RRULE');
    }
    entries.set(key, value);
  }
  const frequency = entries.get('FREQ');
  if (
    frequency !== 'DAILY' &&
    frequency !== 'WEEKLY' &&
    frequency !== 'MONTHLY' &&
    frequency !== 'YEARLY'
  ) {
    throw new Error('INVALID_RRULE_FREQUENCY');
  }
  const interval = Number(entries.get('INTERVAL') ?? 1);
  const count = entries.has('COUNT') ? Number(entries.get('COUNT')) : undefined;
  if (!Number.isInteger(interval) || interval < 1 || interval > 366)
    throw new Error('INVALID_RRULE_INTERVAL');
  if (count !== undefined && (!Number.isInteger(count) || count < 1 || count > 10_000)) {
    throw new Error('INVALID_RRULE_COUNT');
  }
  const byDay = (entries.get('BYDAY')?.split(',') ?? []) as ParsedRecurrenceRule['byDay'];
  if (byDay.some((value) => !dayCodes.includes(value))) throw new Error('INVALID_RRULE_BYDAY');
  return {
    frequency,
    interval,
    byDay,
    count,
    until: entries.has('UNTIL') ? parseUntil(entries.get('UNTIL') ?? '') : undefined,
  };
};

const localTimestamp = (localDateTime: string): number => {
  const normalized = localDateTime.length === 16 ? `${localDateTime}:00` : localDateTime;
  const timestamp = Date.parse(`${normalized}+08:00`);
  if (!Number.isFinite(timestamp)) throw new Error('INVALID_LOCAL_DATE_TIME');
  return timestamp;
};

const localParts = (
  timestamp: number,
): { date: string; dateTime: string; day: number; month: number; year: number } => {
  const shifted = new Date(timestamp + 8 * 3_600_000);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth() + 1;
  const day = shifted.getUTCDate();
  const hours = shifted.getUTCHours();
  const minutes = shifted.getUTCMinutes();
  const date = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return {
    date,
    dateTime: `${date}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
    day,
    month,
    year,
  };
};

const matchesFrequency = (
  rule: ParsedRecurrenceRule,
  start: ReturnType<typeof localParts>,
  candidate: ReturnType<typeof localParts>,
  dayOffset: number,
): boolean => {
  switch (rule.frequency) {
    case 'DAILY':
      return dayOffset % rule.interval === 0;
    case 'WEEKLY':
      return Math.floor(dayOffset / 7) % rule.interval === 0;
    case 'MONTHLY':
      return (
        (candidate.year * 12 + candidate.month - (start.year * 12 + start.month)) %
          rule.interval ===
          0 && candidate.day === start.day
      );
    case 'YEARLY':
      return (
        (candidate.year - start.year) % rule.interval === 0 &&
        candidate.month === start.month &&
        candidate.day === start.day
      );
  }
};

export const expandRecurrence = (input: {
  readonly rrule: string;
  readonly dtstartLocal: string;
  readonly rangeEnd: number;
  readonly rangeStart?: number | undefined;
}): readonly RecurrenceOccurrence[] => {
  const rule = parseRecurrenceRule(input.rrule);
  const startTimestamp = localTimestamp(input.dtstartLocal);
  const start = localParts(startTimestamp);
  const output: RecurrenceOccurrence[] = [];
  const hardEnd = Math.min(input.rangeEnd, rule.until ?? Number.POSITIVE_INFINITY);
  for (let offset = 0; ; offset += 1) {
    const timestamp = startTimestamp + offset * dayMilliseconds;
    if (timestamp > hardEnd || output.length >= (rule.count ?? Number.POSITIVE_INFINITY)) break;
    const candidate = localParts(timestamp);
    const dayCode =
      dayCodes[new Date(Date.UTC(candidate.year, candidate.month - 1, candidate.day)).getUTCDay()];
    const startDayCode =
      dayCodes[new Date(Date.UTC(start.year, start.month - 1, start.day)).getUTCDay()];
    const byDayMatches =
      rule.byDay.length > 0
        ? dayCode !== undefined && rule.byDay.includes(dayCode)
        : rule.frequency !== 'WEEKLY' || dayCode === startDayCode;
    if (
      matchesFrequency(rule, start, candidate, offset) &&
      byDayMatches &&
      timestamp >= (input.rangeStart ?? startTimestamp)
    ) {
      output.push({ recurrenceKey: candidate.dateTime, scheduledAt: timestamp });
    }
    if (offset > 36_600) throw new Error('RRULE_EXPANSION_LIMIT');
  }
  return output;
};
