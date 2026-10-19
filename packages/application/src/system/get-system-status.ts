import type {
  BackgroundJobSummary,
  DiskSpaceSummary,
  SystemStatus,
} from '@life-assistant/contracts';
import { resolveRuntimeState } from '@life-assistant/domain';
import type { Clock } from '@life-assistant/kernel';

export interface RuntimeProbe {
  isDatabaseConnected(): boolean;
  isDataDirectoryConfigured(): boolean;
  isAiConfigured(): boolean;
  isSchedulerAvailable(): boolean;
  getBackgroundJobSummary(): BackgroundJobSummary;
  getDiskSpace(): DiskSpaceSummary;
}

export class GetSystemStatus {
  constructor(
    private readonly clock: Clock,
    private readonly probe: RuntimeProbe,
    private readonly appVersion: string,
  ) {}

  execute(): SystemStatus {
    const databaseConnected = this.probe.isDatabaseConnected();
    const dataDirectoryConfigured = this.probe.isDataDirectoryConfigured();

    return {
      state: resolveRuntimeState({
        serverStarted: true,
        databaseConnected,
        dataDirectoryConfigured,
      }),
      appVersion: this.appVersion,
      serverTime: this.clock.now().toISOString(),
      timeZone: 'Asia/Shanghai',
      database: { connected: databaseConnected, dataDirectoryConfigured },
      capabilities: {
        aiConfigured: this.probe.isAiConfigured(),
        schedulerAvailable: this.probe.isSchedulerAvailable(),
      },
      backgroundJobs: this.probe.getBackgroundJobSummary(),
      disk: this.probe.getDiskSpace(),
    };
  }
}
