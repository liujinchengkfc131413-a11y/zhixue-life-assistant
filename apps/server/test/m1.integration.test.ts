import { createTestDataDirectory } from '@life-assistant/test-support';
import {
  CategoriesEnvelopeSchema,
  BackupEnvelopeSchema,
  DemoDataClearPreviewEnvelopeSchema,
  DemoDataStatusEnvelopeSchema,
  BackupRestorePreviewEnvelopeSchema,
  CategoryEnvelopeSchema,
  DataDirectoryMigrationPreviewEnvelopeSchema,
  SessionEnvelopeSchema,
  SettingsEnvelopeSchema,
} from '@life-assistant/contracts';
import { InMemoryCredentialStore } from '@life-assistant/ai-adapters';
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { LocalRuntime } from '../src/runtime-probe.js';

describe('M1 local runtime API', () => {
  it('completes onboarding with routine preferences and optional AI credentials', async () => {
    const temporary = await createTestDataDirectory();
    const credentials = new InMemoryCredentialStore();
    const runtime = new LocalRuntime({
      bootstrapPath: `${temporary.path}/bootstrap.json`,
      suggestedDataDirectory: `${temporary.path}/suggested`,
      credentialStore: credentials,
    });
    const app = await buildApp({ runtime });
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/setup/initialize',
        payload: {
          dataDirectory: `${temporary.path}/chosen-data`,
          includeDemoData: false,
          backupFrequency: 'DAILY',
          backupRetentionCount: 5,
          quickCaptureDefaultAction: 'AI',
          routineTemplates: [
            {
              templateType: 'WORKDAY',
              segments: [
                {
                  name: '工作日睡眠',
                  segmentType: 'SLEEP',
                  startTime: '22:30',
                  endTime: '06:30',
                  isImmovable: true,
                },
                {
                  name: '工作',
                  segmentType: 'WORK',
                  startTime: '08:00',
                  endTime: '17:00',
                  isImmovable: false,
                },
              ],
            },
            {
              templateType: 'WEEKEND',
              segments: [
                {
                  name: '周末睡眠',
                  segmentType: 'SLEEP',
                  startTime: '00:00',
                  endTime: '08:30',
                  isImmovable: true,
                },
              ],
            },
            {
              templateType: 'HOLIDAY',
              segments: [
                {
                  name: '节假日睡眠',
                  segmentType: 'SLEEP',
                  startTime: '00:30',
                  endTime: '09:00',
                  isImmovable: true,
                },
              ],
            },
          ],
          aiProvider: {
            providerType: 'OPENAI',
            displayName: '首次启动 OpenAI',
            modelId: 'gpt-onboarding',
            apiKey: 'sk-onboarding-test',
          },
        },
      });
      expect(response.statusCode).toBe(200);
      expect(runtime.routines?.resolveTemplate('2026-09-07').segments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: '工作日睡眠', startTime: '22:30', endTime: '06:30' }),
        ]),
      );
      expect(
        runtime.shared?.listSettings().find((setting) => setting.key === 'backup.frequency')?.value,
      ).toBe('DAILY');
      expect(
        runtime.shared
          ?.listSettings()
          .find((setting) => setting.key === 'quick_capture.default_action')?.value,
      ).toBe('AI');
      expect(runtime.ai?.listProviders()).toEqual([
        expect.objectContaining({
          displayName: '首次启动 OpenAI',
          modelId: 'gpt-onboarding',
          isDefault: true,
        }),
      ]);
      expect(runtime.isAiConfigured()).toBe(true);
      expect(runtime.shared?.listCategories()).toHaveLength(7);
    } finally {
      await app.close();
      runtime.close();
      await temporary.cleanup();
    }
  });

  it('creates every category template and keeps module type stable when renamed', async () => {
    const temporary = await createTestDataDirectory();
    const runtime = new LocalRuntime({
      bootstrapPath: `${temporary.path}/bootstrap.json`,
      suggestedDataDirectory: `${temporary.path}/suggested`,
    });
    const app = await buildApp({ runtime });
    try {
      await app.inject({
        method: 'POST',
        url: '/api/v1/setup/initialize',
        payload: { dataDirectory: `${temporary.path}/chosen-data`, includeDemoData: false },
      });
      const moduleTypes = [
        'SELF_MEDIA',
        'DEVELOPMENT',
        'LEARNING',
        'SHOPPING',
        'DIET',
        'FITNESS',
        'ENTERTAINMENT',
        'GENERIC',
      ] as const;

      const created = await Promise.all(
        moduleTypes.map(async (moduleType) => {
          const response = await app.inject({
            method: 'POST',
            url: '/api/v1/categories',
            payload: { parentArea: 'WORK', moduleType, name: `${moduleType} 自定义分类` },
          });
          expect(response.statusCode).toBe(201);
          return CategoryEnvelopeSchema.parse(response.json()).data;
        }),
      );
      expect(created.map((category) => category.moduleType)).toEqual(moduleTypes);

      const diet = created.find((category) => category.moduleType === 'DIET');
      if (diet === undefined) throw new Error('测试未创建饮食模板分类。');
      const renamedResponse = await app.inject({
        method: 'PATCH',
        url: `/api/v1/categories/${diet.id}`,
        payload: { expectedVersion: diet.version, name: '我的饮食' },
      });
      expect(renamedResponse.statusCode).toBe(200);
      expect(CategoryEnvelopeSchema.parse(renamedResponse.json()).data).toMatchObject({
        name: '我的饮食',
        moduleType: 'DIET',
      });
    } finally {
      await app.close();
      runtime.close();
      await temporary.cleanup();
    }
  });

  it('initializes a data directory and exposes settings, categories and backups', async () => {
    const temporary = await createTestDataDirectory();
    const runtime = new LocalRuntime({
      bootstrapPath: `${temporary.path}/bootstrap.json`,
      suggestedDataDirectory: `${temporary.path}/suggested`,
    });
    const app = await buildApp({ runtime });
    try {
      expect(
        (await app.inject({ method: 'GET', url: '/api/v1/setup/status' })).json(),
      ).toMatchObject({
        data: { initialized: false },
      });
      const initialize = await app.inject({
        method: 'POST',
        url: '/api/v1/setup/initialize',
        payload: { dataDirectory: `${temporary.path}/chosen-data` },
      });
      expect(initialize.statusCode).toBe(200);
      expect(runtime.isAiConfigured()).toBe(false);
      expect(
        SettingsEnvelopeSchema.parse(
          (await app.inject({ method: 'GET', url: '/api/v1/settings' })).json(),
        ).data,
      ).toHaveLength(7);
      expect(
        CategoriesEnvelopeSchema.parse(
          (await app.inject({ method: 'GET', url: '/api/v1/categories' })).json(),
        ).data,
      ).toHaveLength(7);
      expect(
        DemoDataStatusEnvelopeSchema.parse(
          (await app.inject({ method: 'GET', url: '/api/v1/demo-data' })).json(),
        ).data,
      ).toMatchObject({ exists: true, recordCount: 10 });

      const category = await app.inject({
        method: 'POST',
        url: '/api/v1/categories',
        payload: { parentArea: 'WORK', moduleType: 'GENERIC', name: '个人项目' },
      });
      expect(category.statusCode).toBe(201);
      expect(category.json()).toMatchObject({ data: { name: '个人项目', version: 1 } });

      const backup = await app.inject({ method: 'POST', url: '/api/v1/backups' });
      expect(backup.statusCode).toBe(201);
      const backupData = BackupEnvelopeSchema.parse(backup.json()).data;
      expect(backupData).toMatchObject({ manifest: { formatVersion: 1 } });

      const postBackupCategory = await app.inject({
        method: 'POST',
        url: '/api/v1/categories',
        payload: { parentArea: 'LIFE', moduleType: 'GENERIC', name: '恢复后应消失的分类' },
      });
      expect(postBackupCategory.statusCode).toBe(201);
      const backupPath = backupData.path;
      const restorePreview = await app.inject({
        method: 'POST',
        url: '/api/v1/backups/restore-preview',
        payload: { path: backupPath },
      });
      expect(restorePreview.statusCode).toBe(200);
      const restoreConfirmation = BackupRestorePreviewEnvelopeSchema.parse(restorePreview.json())
        .data.confirmation;
      const restore = await app.inject({
        method: 'POST',
        url: '/api/v1/backups/restore',
        payload: {
          path: backupPath,
          confirmationId: restoreConfirmation.id,
          confirmationToken: restoreConfirmation.token,
        },
      });
      expect(restore.statusCode).toBe(200);
      const afterRestore = CategoriesEnvelopeSchema.parse(
        (await app.inject({ method: 'GET', url: '/api/v1/categories' })).json(),
      ).data;
      expect(afterRestore.some((item) => item.name === '恢复后应消失的分类')).toBe(false);
      expect(afterRestore.some((item) => item.name === '个人项目')).toBe(true);

      const clearPreview = DemoDataClearPreviewEnvelopeSchema.parse(
        (await app.inject({ method: 'POST', url: '/api/v1/demo-data/clear-preview' })).json(),
      ).data;
      const clear = await app.inject({
        method: 'POST',
        url: '/api/v1/demo-data/clear',
        payload: {
          confirmationId: clearPreview.confirmation.id,
          confirmationToken: clearPreview.confirmation.token,
        },
      });
      expect(clear.statusCode).toBe(200);
      expect(
        DemoDataStatusEnvelopeSchema.parse(
          (await app.inject({ method: 'GET', url: '/api/v1/demo-data' })).json(),
        ).data,
      ).toMatchObject({ exists: false, recordCount: 0 });
      expect(
        CategoriesEnvelopeSchema.parse(
          (await app.inject({ method: 'GET', url: '/api/v1/categories' })).json(),
        ).data,
      ).toHaveLength(8);

      const destination = `${temporary.path}/migrated-data`;
      const preview = await app.inject({
        method: 'POST',
        url: '/api/v1/settings/data-directory/migration-preview',
        payload: { dataDirectory: destination },
      });
      expect(preview.statusCode).toBe(200);
      const confirmation = DataDirectoryMigrationPreviewEnvelopeSchema.parse(preview.json()).data
        .confirmation;
      const migration = await app.inject({
        method: 'POST',
        url: '/api/v1/settings/data-directory/migrate',
        payload: {
          dataDirectory: destination,
          confirmationId: confirmation.id,
          confirmationToken: confirmation.token,
        },
      });
      expect(migration.statusCode).toBe(200);
      expect(runtime.getLayout()?.root).toBe(destination.replaceAll('/', '\\'));
      expect(existsSync(`${temporary.path}/chosen-data/database/life-assistant.db`)).toBe(true);
    } finally {
      await app.close();
      runtime.close();
      await temporary.cleanup();
    }
  });

  it('accepts an absolute backup destination and rejects invalid setting values', async () => {
    const temporary = await createTestDataDirectory();
    const runtime = new LocalRuntime({ bootstrapPath: `${temporary.path}/bootstrap.json` });
    const app = await buildApp({ runtime });
    try {
      await app.inject({
        method: 'POST',
        url: '/api/v1/setup/initialize',
        payload: { dataDirectory: `${temporary.path}/chosen-data` },
      });

      const invalid = await app.inject({
        method: 'PATCH',
        url: '/api/v1/settings',
        payload: { values: { 'backup.destination': 'relative/path' } },
      });
      expect(invalid.statusCode).toBe(422);

      const valid = await app.inject({
        method: 'PATCH',
        url: '/api/v1/settings',
        payload: { values: { 'backup.destination': `${temporary.path}/backup-out` } },
      });
      expect(valid.statusCode).toBe(200);
      const saved = SettingsEnvelopeSchema.parse(
        (await app.inject({ method: 'GET', url: '/api/v1/settings' })).json(),
      ).data;
      expect(saved.find((item) => item.key === 'backup.destination')?.value).toBe(
        `${temporary.path}/backup-out`,
      );

      const backup = await app.inject({ method: 'POST', url: '/api/v1/backups' });
      expect(backup.statusCode).toBe(201);
      const backupData = BackupEnvelopeSchema.parse(backup.json()).data;
      expect(backupData.path).toContain('backup-out');
      expect(existsSync(`${temporary.path}/backup-out`)).toBe(true);
    } finally {
      await app.close();
      runtime.close();
      await temporary.cleanup();
    }
  });

  it('exchanges a launch token and blocks writes without same-origin CSRF proof', async () => {
    const temporary = await createTestDataDirectory();
    const runtime = new LocalRuntime({ bootstrapPath: `${temporary.path}/bootstrap.json` });
    const app = await buildApp({
      runtime,
      security: { enabled: true, launchToken: 'launcher-secret', port: 43120 },
    });
    try {
      expect((await app.inject({ method: 'GET', url: '/api/v1/session' })).statusCode).toBe(401);
      const launch = await app.inject({ method: 'GET', url: '/launch?token=launcher-secret' });
      expect(launch.statusCode).toBe(302);
      const setCookie = launch.headers['set-cookie'];
      if (setCookie === undefined) throw new Error('启动响应缺少会话 Cookie。');
      const cookieHeader = Array.isArray(setCookie) ? setCookie.at(0) : setCookie;
      const cookie = cookieHeader?.split(';').at(0);
      if (cookie === undefined) throw new Error('启动响应的会话 Cookie 无效。');
      const session = await app.inject({
        method: 'GET',
        url: '/api/v1/session',
        headers: { cookie },
      });
      const csrfToken = SessionEnvelopeSchema.parse(session.json()).data.csrfToken;

      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/setup/initialize',
            headers: { cookie },
            payload: { dataDirectory: `${temporary.path}/blocked` },
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/setup/initialize',
            headers: {
              cookie,
              origin: 'http://127.0.0.1:43120',
              'x-csrf-token': csrfToken,
            },
            payload: { dataDirectory: `${temporary.path}/allowed` },
          })
        ).statusCode,
      ).toBe(200);
    } finally {
      await app.close();
      runtime.close();
      await temporary.cleanup();
    }
  });
});
