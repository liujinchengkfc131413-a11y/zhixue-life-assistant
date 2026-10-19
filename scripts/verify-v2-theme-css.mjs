import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const workspaceRoot = process.cwd();
const auditedStyleRoots = ['components', 'pages'].map((directory) =>
  path.join(workspaceRoot, 'apps', 'web', 'src', 'styles', directory),
);
const allowlistPath = path.join(workspaceRoot, 'scripts', 'verify-v2-theme-css-allowlist.json');

const findCssFiles = async (directory) => {
  if (!existsSync(directory)) return [];
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) return findCssFiles(absolutePath);
      return entry.isFile() && entry.name.endsWith('.css') ? [absolutePath] : [];
    }),
  );
  return nested.flat();
};

const allowlist = JSON.parse(await readFile(allowlistPath, 'utf8'));
const cssFiles = (await Promise.all(auditedStyleRoots.map(findCssFiles))).flat();
const colorDeclaration =
  /(?<property>(?:background(?:-color)?|color|border(?:-[\w-]+)?-color|outline-color|caret-color|accent-color|fill|stroke))\s*:\s*(?<value>[^;}{]+)[;}]/giu;
const directColor = /(?:#[\da-f]{3,8}\b|\b(?:rgb|hsl|hwb|lab|lch|oklab|oklch|color)\s*\()/iu;
const violations = [];

for (const file of cssFiles) {
  const relativePath = path.relative(workspaceRoot, file).replaceAll('\\', '/');
  const source = (await readFile(file, 'utf8')).replaceAll(/\/\*[\s\S]*?\*\//gu, '');
  for (const match of source.matchAll(colorDeclaration)) {
    const property = match.groups?.property ?? '';
    const value = (match.groups?.value ?? '').trim();
    if (!directColor.test(value)) continue;
    const declaration = `${property}: ${value}`;
    if ((allowlist[relativePath] ?? []).includes(declaration)) continue;
    const line = source.slice(0, match.index).split('\n').length;
    violations.push(`${relativePath}:${String(line)} ${declaration}`);
  }
}

if (violations.length > 0) {
  process.stderr.write('V2 component/page CSS contains unregistered direct color values:\n');
  for (const violation of violations) process.stderr.write(`- ${violation}\n`);
  process.stderr.write(
    'Use a semantic theme token or register an intentional exception in the allowlist.\n',
  );
  process.exitCode = 1;
} else {
  process.stdout.write(
    `V2 theme CSS audit passed (${String(cssFiles.length)} component/page stylesheet(s) checked).\n`,
  );
}
