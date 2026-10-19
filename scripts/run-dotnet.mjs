import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import process from 'node:process';
import { join } from 'node:path';

const candidates = [
  'dotnet',
  process.platform === 'win32'
    ? join(process.env.ProgramFiles ?? 'C:\\Program Files', 'dotnet', 'dotnet.exe')
    : undefined,
].filter(Boolean);

for (const executable of candidates) {
  if (executable !== 'dotnet' && !existsSync(executable)) continue;
  const result = spawnSync(executable, process.argv.slice(2), { stdio: 'inherit' });
  if (result.error?.code === 'ENOENT') continue;
  process.exit(result.status ?? 1);
}

throw new Error('未找到 .NET SDK 8。请安装 Microsoft.DotNet.SDK.8。');
