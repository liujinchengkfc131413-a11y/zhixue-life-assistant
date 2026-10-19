/* global console, process */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const packageVersion = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')).version;
const { productVersion } = JSON.parse(readFileSync(join(repoRoot, 'release.json'), 'utf8'));
const releaseDir = join(repoRoot, 'distribution', `LifeAssistant-${packageVersion}`);
const zipName = `LifeAssistant-v${productVersion}-win-x64.zip`;
const zipPath = join(repoRoot, 'distribution', zipName);

if (!existsSync(join(releaseDir, 'LifeAssistant.exe'))) {
  console.error(`发布目录不存在：${releaseDir}`);
  process.exit(1);
}

const escapedReleaseDir = releaseDir.replaceAll("'", "''");
const escapedZipPath = zipPath.replaceAll("'", "''");
const archive = spawnSync(
  'powershell',
  [
    '-NoProfile',
    '-Command',
    `Compress-Archive -LiteralPath '${escapedReleaseDir}' -DestinationPath '${escapedZipPath}' -CompressionLevel Optimal -Force`,
  ],
  { cwd: repoRoot, encoding: 'utf8' },
);
if (archive.status !== 0) {
  console.error(archive.stderr.trim() || '生成 Windows ZIP 失败。');
  process.exit(1);
}

const hash = createHash('sha256');
await new Promise((resolveHash, reject) => {
  const input = createReadStream(zipPath);
  input.on('data', (chunk) => hash.update(chunk));
  input.on('error', reject);
  input.on('end', resolveHash);
});
console.log(`Windows RC artifact：${zipPath}`);
console.log(`  size=${String(statSync(zipPath).size)} sha256=${hash.digest('hex')}`);
