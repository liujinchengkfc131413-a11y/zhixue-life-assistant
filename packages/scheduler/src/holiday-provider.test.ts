import { describe, expect, it } from 'vitest';

import { FixtureHolidayProvider } from './holiday-provider.js';

describe('FixtureHolidayProvider', () => {
  it('returns only records from the requested year', async () => {
    const provider = new FixtureHolidayProvider([
      { localDate: '2026-01-01', name: '元旦', dayType: 'HOLIDAY' },
      { localDate: '2027-01-01', name: '元旦', dayType: 'HOLIDAY' },
    ]);

    await expect(provider.fetchYear(2026)).resolves.toEqual([
      { localDate: '2026-01-01', name: '元旦', dayType: 'HOLIDAY' },
    ]);
  });
});
