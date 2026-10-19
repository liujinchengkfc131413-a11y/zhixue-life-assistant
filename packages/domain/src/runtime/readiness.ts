export type RuntimeState = 'STARTING' | 'READY' | 'DEGRADED';

export interface RuntimeReadinessInput {
  readonly serverStarted: boolean;
  readonly databaseConnected: boolean;
  readonly dataDirectoryConfigured: boolean;
}

export const resolveRuntimeState = (input: RuntimeReadinessInput): RuntimeState => {
  if (!input.serverStarted) {
    return 'STARTING';
  }

  if (!input.databaseConnected || !input.dataDirectoryConfigured) {
    return 'DEGRADED';
  }

  return 'READY';
};
