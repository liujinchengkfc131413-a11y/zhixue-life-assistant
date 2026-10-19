import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'win32') {
  process.stdout.write('Launcher crash-restart check skipped: Windows only.\n');
  process.exit(0);
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..', '..');
const launcherDll = path.join(
  repositoryRoot,
  'apps',
  'launcher',
  'bin',
  'Release',
  'net8.0-windows',
  'LifeAssistant.dll',
);
const runDotnet = path.join(repositoryRoot, 'scripts', 'run-dotnet.mjs');

if (!existsSync(launcherDll)) {
  throw new Error('Launcher Release build is missing. Run pnpm launcher:build first.');
}

const reservePort = async () =>
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        server.close();
        reject(new Error('Unable to reserve a launcher test port.'));
        return;
      }
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });

const waitFor = async (predicate, timeoutMs, description) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${description}.`);
};

const temporaryDirectory = await mkdtemp(
  path.join(os.tmpdir(), 'life-assistant-launcher-restart-'),
);
const serverEntry = path.join(temporaryDirectory, 'crash-once-server.cjs');
const counterPath = path.join(temporaryDirectory, 'starts.txt');
const logPath = path.join(temporaryDirectory, 'launcher.log');
const port = await reservePort();
const instanceSuffix = `restart-check-${process.pid}-${Date.now()}`;
let launcher;
let launcherExited = false;
let launcherOutput = '';

try {
  await writeFile(
    serverEntry,
    `const fs = require('node:fs');
const http = require('node:http');
const counterPath = process.env.LIFE_ASSISTANT_TEST_COUNTER;
const starts = fs.existsSync(counterPath) ? Number(fs.readFileSync(counterPath, 'utf8')) + 1 : 1;
fs.writeFileSync(counterPath, String(starts));
if (starts <= 2) {
  setTimeout(() => process.exit(71), 180);
} else {
  const port = Number(process.env.LIFE_ASSISTANT_PORT);
  http.createServer((request, response) => {
    response.writeHead(request.url === '/health/ready' ? 200 : 404, { 'content-type': 'application/json' });
    response.end(request.url === '/health/ready' ? '{"status":"ready"}' : '{"status":"missing"}');
  }).listen(port, '127.0.0.1');
}
`,
    'utf8',
  );

  const environment = {
    ...process.env,
    LIFE_ASSISTANT_FIXED_PORT: String(port),
    LIFE_ASSISTANT_INSTANCE_SUFFIX: instanceSuffix,
    LIFE_ASSISTANT_LAUNCHER_LOG_PATH: logPath,
    LIFE_ASSISTANT_RESTART_DELAY_MS: '150',
    LIFE_ASSISTANT_SKIP_BROWSER: '1',
    LIFE_ASSISTANT_SKIP_SHORTCUT: '1',
    LIFE_ASSISTANT_TEST_COUNTER: counterPath,
  };

  launcher = spawn(process.execPath, [runDotnet, launcherDll, '--server', serverEntry], {
    cwd: repositoryRoot,
    env: environment,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  launcher.stdout.on('data', (chunk) => {
    launcherOutput += chunk.toString();
  });
  launcher.stderr.on('data', (chunk) => {
    launcherOutput += chunk.toString();
  });
  launcher.once('exit', () => {
    launcherExited = true;
  });

  await waitFor(
    async () => {
      const log = await readFile(logPath, 'utf8').catch(() => '');
      return log.includes('server.restart-scheduled') && log.includes('server.ready');
    },
    20_000,
    'an automatic restart followed by READY',
  );

  const starts = Number(await readFile(counterPath, 'utf8'));
  if (starts !== 3) throw new Error(`Expected exactly 3 server starts, received ${starts}.`);

  const shutdown = spawnSync(process.execPath, [runDotnet, launcherDll, '--shutdown'], {
    cwd: repositoryRoot,
    env: environment,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (shutdown.status !== 0) {
    throw new Error(`Launcher shutdown command failed: ${shutdown.stderr || shutdown.stdout}`);
  }

  await waitFor(() => launcherExited, 10_000, 'the launcher to exit after the shutdown command');
  const log = await readFile(logPath, 'utf8');
  if (!log.includes('"expected":false'))
    throw new Error('Unexpected server exit was not recorded as unexpected.');
  if (!log.includes('"automatic":true'))
    throw new Error('Automatic restart was not recorded in the launcher log.');

  const restartEvents = log.match(/server\.restart-scheduled/g) ?? [];
  if (restartEvents.length !== 2)
    throw new Error(`Expected 2 automatic restart events, received ${restartEvents.length}.`);

  process.stdout.write(
    'Launcher crash-restart check passed: two consecutive unexpected exits, two automatic restarts, READY restored.\n',
  );
} catch (error) {
  if (launcherOutput.trim() !== '') process.stderr.write(`${launcherOutput.trim()}\n`);
  throw error;
} finally {
  if (launcher && !launcherExited) {
    spawnSync('taskkill', ['/PID', String(launcher.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
  }
  await rm(temporaryDirectory, { force: true, recursive: true });
}
