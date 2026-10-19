import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildApp } from './app.js';
import { LocalRuntime } from './runtime-probe.js';

const currentDirectory = dirname(fileURLToPath(import.meta.url));

/** 开发布局为 web/dist，便携发布布局为 app/web；取第一个存在 index.html 的位置。 */
const resolveWebRoot = (): string | undefined => {
  const candidates = [
    resolve(currentDirectory, '../../web/dist'), // dev: apps/server/dist -> apps/web/dist
    resolve(currentDirectory, '../web'), // release: app/server -> app/web
    resolve(currentDirectory, '../../web'),
  ];
  return candidates.find((candidate) => existsSync(resolve(candidate, 'index.html')));
};

const main = async (): Promise<void> => {
  const port = Number.parseInt(process.env.LIFE_ASSISTANT_PORT ?? '43120', 10);
  const host = '127.0.0.1';
  const webRoot = resolveWebRoot();
  const launchToken = process.env.LIFE_ASSISTANT_LAUNCH_TOKEN;
  const runtime = new LocalRuntime();
  await runtime.start();

  const logStream = runtime.getLogStream();
  const app = await buildApp({
    logger: logStream === undefined ? true : { level: 'info', stream: logStream },
    ...(webRoot === undefined ? {} : { webRoot }),
    runtime,
    security:
      launchToken === undefined ? { enabled: false, port } : { enabled: true, launchToken, port },
  });

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, '正在安全停止本地服务');
    await app.close();
    runtime.close();
    process.exit(0);
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  try {
    await app.listen({ host, port });
  } catch (error) {
    app.log.error(error, '本地服务启动失败');
    process.exit(1);
  }
};

void main();
