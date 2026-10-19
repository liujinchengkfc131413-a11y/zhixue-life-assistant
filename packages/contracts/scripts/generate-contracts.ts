import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import openapiTS, { astToString } from 'openapi-typescript';

import { buildOpenApiDocument } from '../src/openapi.js';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(currentDirectory, '../../..');
const specificationPath = resolve(repositoryRoot, 'docs/api/openapi.json');
const typesPath = resolve(currentDirectory, '../src/generated/openapi.d.ts');
const checkOnly = process.argv.includes('--check');

const document = buildOpenApiDocument();
const specification = `${JSON.stringify(document, null, 2)}\n`;
const generatedTypes = `${astToString(
  await openapiTS(document as unknown as Parameters<typeof openapiTS>[0]),
)}\n`;

const assertUnchanged = async (path: string, nextContent: string): Promise<void> => {
  let currentContent: string;
  try {
    currentContent = await readFile(path, 'utf8');
  } catch {
    throw new Error(`缺少生成文件：${path}`);
  }

  if (currentContent !== nextContent) {
    throw new Error(`生成文件已过期：${path}。请运行 pnpm contracts:generate。`);
  }
};

if (checkOnly) {
  await Promise.all([
    assertUnchanged(specificationPath, specification),
    assertUnchanged(typesPath, generatedTypes),
  ]);
} else {
  await Promise.all([
    writeFile(specificationPath, specification, 'utf8'),
    writeFile(typesPath, generatedTypes, 'utf8'),
  ]);
}
