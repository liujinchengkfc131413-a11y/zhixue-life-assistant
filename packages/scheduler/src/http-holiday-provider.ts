import type { HolidayDefinition, HolidayProvider } from './holiday-provider.js';

export interface HolidayFeedItem {
  readonly date: unknown;
  readonly name: unknown;
  readonly dayType: unknown;
}

/**
 * 联网节假日 Provider：从可配置 URL 获取 JSON 节假日安排。
 *
 * - 数据格式：`{ "holidays": [{ "date": "2026-10-01", "name": "国庆节", "dayType": "HOLIDAY" }] }`
 * - 离线或来源异常时抛出稳定错误码，调用方保留本地现有数据，不删除。
 * - 只接受标准日期与枚举值，防止脏数据写入 holiday_calendar。
 */
export class HttpHolidayProvider implements HolidayProvider {
  public readonly providerId = 'http-holiday-feed';

  public constructor(
    private readonly url: string,
    private readonly fetcher: (url: string) => Promise<unknown> = defaultFetcher,
  ) {}

  public async fetchYear(year: number): Promise<readonly HolidayDefinition[]> {
    let payload: unknown;
    try {
      payload = await this.fetcher(this.url);
    } catch {
      throw new Error('HOLIDAY_FETCH_FAILED');
    }
    return parseHolidayFeed(payload, year);
  }
}

const defaultFetcher = async (url: string): Promise<unknown> => {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);
  return (await response.json()) as unknown;
};

export const parseHolidayFeed = (payload: unknown, year: number): readonly HolidayDefinition[] => {
  if (typeof payload !== 'object' || payload === null) throw new Error('HOLIDAY_FEED_INVALID');
  const items = (payload as { holidays?: unknown }).holidays;
  if (!Array.isArray(items)) throw new Error('HOLIDAY_FEED_INVALID');
  const prefix = `${String(year)}-`;
  const result: HolidayDefinition[] = [];
  for (const item of items) {
    if (typeof item !== 'object' || item === null) throw new Error('HOLIDAY_FEED_INVALID');
    const { date, name, dayType } = item as HolidayFeedItem;
    if (
      typeof date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      typeof name !== 'string' ||
      name.trim().length === 0 ||
      (dayType !== 'HOLIDAY' && dayType !== 'MAKEUP_WORKDAY')
    ) {
      throw new Error('HOLIDAY_FEED_INVALID');
    }
    if (!date.startsWith(prefix)) continue;
    result.push({ localDate: date, name: name.trim(), dayType });
  }
  return result;
};
