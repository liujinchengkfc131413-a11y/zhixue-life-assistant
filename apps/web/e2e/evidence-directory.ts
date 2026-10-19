import { resolve } from 'node:path';

export const evidenceDirectoryFor = (trackedDirectory: string) => {
  if (process.env.LIFE_ASSISTANT_UPDATE_BASELINES === '1') {
    return resolve(trackedDirectory);
  }

  return resolve('test-results/evidence', trackedDirectory.replace(/^docs[\\/]design[\\/]?/, ''));
};
