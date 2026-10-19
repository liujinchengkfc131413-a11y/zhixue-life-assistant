import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

/**
 * 便携发布的纯逻辑核心：Schema 版本提取、文件收集、SHA-256、
 * 清单构建与发布内容安全检查。可被发布脚本与单元测试复用。
 */

export const computeSchemaVersion = (migrationsSource) => {
  const versions = [...migrationsSource.matchAll(/defineMigration\(\s*(\d+)/g)].map((match) =>
    Number(match[1]),
  );
  return versions.length === 0 ? 0 : Math.max(...versions);
};

export const sha256Buffer = (content) => createHash('sha256').update(content).digest('hex');

/** 递归收集目录下所有文件的相对路径（统一为正斜杠分隔，字典序）。 */
export const collectRelativeFiles = async (root, excludeNames = []) => {
  const output = [];
  const visit = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (excludeNames.includes(entry.name)) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) output.push(relative(root, path).split(sep).join('/'));
    }
  };
  await visit(root);
  return output.sort();
};

/** 依据发布目录实际文件构建 package-manifest.json（不含清单自身）。 */
export const buildManifest = async (releaseRoot, meta) => {
  const paths = await collectRelativeFiles(releaseRoot, ['package-manifest.json']);
  const files = [];
  for (const rel of paths) {
    const content = await readFile(join(releaseRoot, rel));
    files.push({
      path: rel.split(sep).join('/'),
      sha256: sha256Buffer(content),
      size: content.length,
    });
  }
  return { ...meta, formatVersion: 1, fileCount: files.length, files };
};

/** 发布内容安全检查：拒绝源码映射、绝对源码路径与疑似密钥。 */
export const findForbiddenContent = (text, forbiddenPaths) => {
  const hits = [];
  if (/sourceMappingURL=.*\.map/.test(text)) hits.push('sourceMappingURL');
  for (const pattern of ['sk-[A-Za-z0-9]{16,}', 'Bearer [A-Za-z0-9]{16,}']) {
    if (new RegExp(pattern).test(text)) hits.push(`疑似密钥：${pattern}`);
  }
  for (const path of forbiddenPaths) {
    if (path.length > 0 && text.includes(path)) hits.push(`绝对路径：${path}`);
  }
  return hits;
};

/** 判断单个文件名是否应排除在发布之外（源码映射 / 调试符号 / 测试产物）。 */
export const isExcludedReleaseFile = (name) =>
  name.endsWith('.map') ||
  name.endsWith('.pdb') ||
  name.endsWith('.log') ||
  name.includes('test-results') ||
  name.includes('playwright-report');
