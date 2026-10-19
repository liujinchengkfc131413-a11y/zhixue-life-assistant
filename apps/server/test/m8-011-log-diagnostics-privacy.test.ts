import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import AdmZip from 'adm-zip';
import { InMemoryCredentialStore } from '@life-assistant/ai-adapters';
import {
  DiagnosticExportEnvelopeSchema,
  DiagnosticInfoEnvelopeSchema,
} from '@life-assistant/contracts';
import { migrations } from '@life-assistant/database';
import { createTestDataDirectory } from '@life-assistant/test-support';
import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { LogManager, redactSensitiveText } from '../src/log-manager.js';
import { LocalRuntime } from '../src/runtime-probe.js';

const cleanups: (() => Promise<void>)[] = [];
const latestSchemaVersion = migrations.at(-1)?.version ?? 0;

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

const readAllLogs = (logsDir: string): string =>
  readdirSync(logsDir)
    .filter((name) => name.startsWith('app.log'))
    .map((name) => readFileSync(join(logsDir, name), 'utf8'))
    .join('\n');

describe('M8-011 log rotation, diagnostics and privacy', () => {
  it('redacts API keys, bearer tokens and credential references', () => {
    expect(redactSensitiveText('key=sk-0123456789abcdef0123456789abcdef end')).toBe(
      'key=sk-[REDACTED] end',
    );
    expect(redactSensitiveText('Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456')).toBe(
      'Authorization: Bearer [REDACTED]',
    );
    expect(redactSensitiveText('x-api-key: qwerty1234567890')).toBe('x-api-key: [REDACTED]');
    expect(redactSensitiveText('credential_ref: some-ref-value-12345')).toBe(
      'credential_ref: [REDACTED]',
    );
    expect(redactSensitiveText('正常日志文本没有秘密')).toBe('正常日志文本没有秘密');
  });

  it('rotates log files by size and keeps at most the configured count', async () => {
    const temporary = await createTestDataDirectory();
    cleanups.push(() => temporary.cleanup());
    const logsDir = join(temporary.path, 'logs');
    const manager = new LogManager(logsDir, { maxBytes: 1024, maxFiles: 2, level: 'debug' });
    try {
      const payload = 'x'.repeat(300);
      for (let i = 1; i <= 20; i += 1) {
        manager.write('database', 'info', `第 ${String(i)} 行 ${payload}`);
      }
      const files = manager.listFiles().map((file) => file.name);
      expect(files[0]).toBe('app.log');
      expect(files).toContain('app.log.1');
      expect(files).toContain('app.log.2');
      // 保留数量上限：当前文件 + 2 个轮换文件。
      expect(files).toHaveLength(3);

      const all = readAllLogs(logsDir);
      expect(all).toContain('第 20 行');
      expect(all).toContain('"category":"database"');
    } finally {
      manager.close();
    }
  });

  it('writes sanitized category logs and redacts secrets before persisting', async () => {
    const temporary = await createTestDataDirectory();
    cleanups.push(() => temporary.cleanup());
    const manager = new LogManager(join(temporary.path, 'logs'));
    try {
      manager.write('ai', 'error', '调用失败 Authorization: Bearer sk-secret-0123456789abcdef');
      manager.write('backup', 'info', '自动备份完成', { path: 'C:\\tmp\\backup.zip' });
      const content = readAllLogs(join(temporary.path, 'logs'));
      expect(content).toContain('Bearer [REDACTED]');
      expect(content).not.toContain('sk-secret-0123456789abcdef');
      expect(content).toContain('"category":"backup"');
      expect(manager.tail()).toContain('自动备份完成');
    } finally {
      manager.close();
    }
  });

  it('exposes diagnostics and an export bundle through the API', async () => {
    const temporary = await createTestDataDirectory();
    cleanups.push(() => temporary.cleanup());
    const runtime = new LocalRuntime({
      bootstrapPath: join(temporary.path, 'bootstrap.json'),
      suggestedDataDirectory: join(temporary.path, 'suggested'),
    });
    const app = await buildApp({ runtime });
    try {
      await app.inject({
        method: 'POST',
        url: '/api/v1/setup/initialize',
        payload: { dataDirectory: join(temporary.path, 'chosen-data') },
      });

      const diagnostics = await app.inject({ method: 'GET', url: '/api/v1/system/diagnostics' });
      expect(diagnostics.statusCode).toBe(200);
      const info = DiagnosticInfoEnvelopeSchema.parse(diagnostics.json()).data;
      expect(info.appVersion).toBe('0.1.0');
      expect(info.schemaVersion).toBe(latestSchemaVersion);
      expect(info.dataDirectoryId).toHaveLength(26);
      expect(info.logs.length).toBeGreaterThan(0);
      // 诊断信息只包含脱敏日志尾部，不包含完整数据目录绝对路径。
      expect(info.logTail).toContain('数据服务已打开');
      expect(JSON.stringify(info)).not.toContain('chosen-data');

      const exported = await app.inject({
        method: 'POST',
        url: '/api/v1/system/diagnostics:export',
      });
      expect(exported.statusCode).toBe(200);
      const result = DiagnosticExportEnvelopeSchema.parse(exported.json()).data;
      expect(result.path.endsWith('.zip')).toBe(true);
      expect(existsSync(result.path)).toBe(true);

      const zip = new AdmZip(result.path);
      const entries = zip.getEntries().map((entry) => entry.entryName);
      expect(entries).toContain('diagnostics.json');
      expect(entries.some((name) => name.startsWith('logs/app.log'))).toBe(true);
      const bundleText = zip
        .getEntries()
        .map((entry) => entry.getData().toString('utf8'))
        .join('\n');
      expect(bundleText).toContain('"dataDirectoryId"');
      expect(bundleText).not.toContain('chosen-data');
    } finally {
      await app.close();
      runtime.close();
    }
  });

  it('keeps secrets out of logs, backups, diagnostics and API responses', async () => {
    const temporary = await createTestDataDirectory();
    cleanups.push(() => temporary.cleanup());
    const secret = 'sk-privacy-0123456789abcdef0123456789abcdef';
    const bearer = 'abcdefghijklmnopqrstuvwxyz123456';
    const runtime = new LocalRuntime({
      bootstrapPath: join(temporary.path, 'bootstrap.json'),
      suggestedDataDirectory: join(temporary.path, 'suggested'),
      credentialStore: new InMemoryCredentialStore(),
    });
    const app = await buildApp({ runtime });
    try {
      await app.inject({
        method: 'POST',
        url: '/api/v1/setup/initialize',
        payload: { dataDirectory: join(temporary.path, 'chosen-data') },
      });
      await runtime.credentials.set('credential:openai', secret);
      // 故意写入含密钥与 Bearer 的日志行，验证脱敏器在落盘前生效。
      runtime.log('ai', 'error', `请求失败 Authorization: Bearer ${bearer} 密钥 ${secret}`);

      const backup = await runtime.backups?.createManualBackup('privacy-drill');
      if (backup === undefined) throw new Error('备份未生成');
      const diagnostics = runtime.getDiagnostics();
      const exported = await runtime.exportDiagnostics();

      const layout = runtime.getLayout();
      if (layout === undefined) throw new Error('数据目录未初始化');
      const logContent = readAllLogs(layout.logs);
      const backupBytes = readFileSync(backup.path);
      const bundleBytes = readFileSync(exported.path);
      const databaseBytes = readFileSync(layout.database);
      const providerResponse = await app.inject({ method: 'GET', url: '/api/v1/ai/providers' });

      expect(logContent).not.toContain(secret);
      expect(logContent).not.toContain(bearer);
      expect(logContent).toContain('[REDACTED]');
      expect(backupBytes.includes(secret)).toBe(false);
      expect(backupBytes.includes(bearer)).toBe(false);
      expect(bundleBytes.includes(secret)).toBe(false);
      expect(bundleBytes.includes(bearer)).toBe(false);
      expect(databaseBytes.includes(secret)).toBe(false);
      expect(JSON.stringify(diagnostics)).not.toContain(secret);
      expect(JSON.stringify(providerResponse.json())).not.toContain(secret);
    } finally {
      await app.close();
      runtime.close();
    }
  });

  it('keeps category logs available across a runtime restart', async () => {
    const temporary = await createTestDataDirectory();
    cleanups.push(() => temporary.cleanup());
    const bootstrapPath = join(temporary.path, 'bootstrap.json');
    const first = new LocalRuntime({ bootstrapPath });
    await first.initialize(join(temporary.path, 'data'), {
      includeDemoData: false,
      backupFrequency: 'MANUAL',
      backupRetentionCount: 3,
      quickCaptureDefaultAction: 'INBOX',
    });
    first.log('startup', 'info', '第一次启动完成');
    first.close();

    const second = new LocalRuntime({ bootstrapPath });
    await second.start();
    try {
      expect(second.logs).not.toBeUndefined();
      const layout = second.getLayout();
      if (layout === undefined) throw new Error('数据目录未初始化');
      const content = readAllLogs(layout.logs);
      expect(content).toContain('第一次启动完成');
      expect(content).toContain('数据服务已打开');
    } finally {
      second.close();
    }
  });
});
