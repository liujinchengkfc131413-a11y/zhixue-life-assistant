export interface HolidayDefinition {
  readonly localDate: string;
  readonly name: string;
  readonly dayType: 'HOLIDAY' | 'MAKEUP_WORKDAY';
}

export interface HolidayProvider {
  readonly providerId: string;
  fetchYear(year: number): Promise<readonly HolidayDefinition[]>;
}

/**
 * M2 的可替换本地实现。M8 接入真实联网来源时，只需实现相同端口；
 * 数据落库与用户覆盖优先级不受 Provider 变化影响。
 */
export class FixtureHolidayProvider implements HolidayProvider {
  public readonly providerId = 'local-fixture';

  public constructor(private readonly records: readonly HolidayDefinition[] = []) {}

  public fetchYear(year: number): Promise<readonly HolidayDefinition[]> {
    return Promise.resolve(
      this.records.filter((record) => record.localDate.startsWith(`${String(year)}-`)),
    );
  }
}
