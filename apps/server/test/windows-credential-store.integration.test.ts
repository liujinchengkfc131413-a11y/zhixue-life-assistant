import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { WindowsCredentialStore } from '../src/windows-credential-store.js';

describe.skipIf(process.platform !== 'win32')('WindowsCredentialStore platform integration', () => {
  it('persists Unicode, long, and special-character secrets across adapter instances then removes them', async () => {
    const reference = `life-assistant:test:${randomUUID()}`;
    const secret = `知雪🔐 !@#$%^&*()_+-=[]{};':",.<>/?| ${'长密钥'.repeat(50)}`;
    const writer = new WindowsCredentialStore();
    try {
      await writer.set(reference, secret);
      const reader = new WindowsCredentialStore();
      await expect(reader.get(reference)).resolves.toBe(secret);
      await expect(reader.has(reference)).resolves.toBe(true);

      await reader.remove(reference);
      await expect(new WindowsCredentialStore().get(reference)).resolves.toBeUndefined();
      await expect(new WindowsCredentialStore().has(reference)).resolves.toBe(false);
    } finally {
      await new WindowsCredentialStore().remove(reference);
    }
  }, 60_000);
});
