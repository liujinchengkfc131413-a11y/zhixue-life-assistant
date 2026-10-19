import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/main.ts'],
  // CJS 输出：@fastify/* 等 CJS 插件含动态 require，ESM 打包会失败；
  // CJS 运行时天然支持，便携发布仍只需随附 better-sqlite3 原生二进制。
  format: ['cjs'],
  outExtension: () => ({ js: '.cjs' }),
  shims: true,
  sourcemap: true,
  clean: true,
  // 打包全部运行时依赖，仅保留 better-sqlite3（原生二进制）作为外部依赖。
  noExternal: [/^(?!better-sqlite3$)/],
  external: ['better-sqlite3'],
});
