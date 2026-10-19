import { describe, expect, it } from 'vitest';

import { FixedClock } from '@life-assistant/kernel';
import { createTestDataDirectory } from '@life-assistant/test-support';

import { AiRepository } from './ai-repository.js';
import { SqliteDatabase } from './sqlite-database.js';

describe('AiRepository', () => {
  it('persists configuration metadata but never a credential secret', async () => {
    const directory = await createTestDataDirectory();
    const clock = new FixedClock(new Date('2026-08-13T00:00:00.000Z'));
    const database = new SqliteDatabase(directory.databasePath, clock);
    database.migrate();
    try {
      const repository = new AiRepository(database, clock);
      const provider = repository.createProvider({
        providerType: 'OPENAI',
        displayName: '主模型',
        modelId: 'gpt-test',
      });

      expect(provider.credentialRef).toBe(`life-assistant:ai-provider:${provider.id}`);
      expect(database.raw.prepare('SELECT * FROM ai_provider_configs').get()).not.toHaveProperty(
        'api_key',
      );
      expect(repository.listProviders()).toHaveLength(1);
    } finally {
      database.close();
      await directory.cleanup();
    }
  });
});
