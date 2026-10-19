import { describe, expect, it } from 'vitest';

import { HttpHolidayProvider, parseHolidayFeed } from './http-holiday-provider.js';

describe('parseHolidayFeed', () => {
  it('extracts valid holiday definitions for the requested year', () => {
    const result = parseHolidayFeed(
      {
        holidays: [
          { date: '2026-10-01', name: '国庆节', dayType: 'HOLIDAY' },
          { date: '2026-09-27', name: '国庆调休', dayType: 'MAKEUP_WORKDAY' },
          { date: '2027-01-01', name: '元旦', dayType: 'HOLIDAY' },
        ],
      },
      2026,
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      localDate: '2026-10-01',
      name: '国庆节',
      dayType: 'HOLIDAY',
    });
  });

  it('rejects malformed feed entries', () => {
    expect(() =>
      parseHolidayFeed({ holidays: [{ date: 'not-a-date', name: 'x', dayType: 'HOLIDAY' }] }, 2026),
    ).toThrow('HOLIDAY_FEED_INVALID');
    expect(() =>
      parseHolidayFeed({ holidays: [{ date: '2026-10-01', name: '', dayType: 'HOLIDAY' }] }, 2026),
    ).toThrow('HOLIDAY_FEED_INVALID');
    expect(() =>
      parseHolidayFeed({ holidays: [{ date: '2026-10-01', name: 'x', dayType: 'UNKNOWN' }] }, 2026),
    ).toThrow('HOLIDAY_FEED_INVALID');
  });

  it('fails with a stable error code when the source is unreachable', async () => {
    const provider = new HttpHolidayProvider('https://invalid.invalid/holidays.json', () =>
      Promise.reject(new Error('network down')),
    );
    await expect(provider.fetchYear(2026)).rejects.toThrow('HOLIDAY_FETCH_FAILED');
  });

  it('fetches and parses a live feed through the injected fetcher', async () => {
    const provider = new HttpHolidayProvider('https://example.test/holidays.json', () =>
      Promise.resolve({
        holidays: [{ date: '2026-05-01', name: '劳动节', dayType: 'HOLIDAY' }],
      }),
    );
    const result = await provider.fetchYear(2026);
    expect(result).toEqual([{ localDate: '2026-05-01', name: '劳动节', dayType: 'HOLIDAY' }]);
  });
});
