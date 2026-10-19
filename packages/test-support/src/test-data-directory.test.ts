import { access } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { createTestDataDirectory } from './test-data-directory.js';

describe('createTestDataDirectory', () => {
  it('creates and safely removes a directory below the dedicated test root', async () => {
    const directory = await createTestDataDirectory();
    await expect(access(directory.path)).resolves.toBeUndefined();

    await directory.cleanup();

    await expect(access(directory.path)).rejects.toThrow();
  });
});
