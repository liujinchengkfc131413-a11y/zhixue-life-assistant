import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import fastifyStatic from '@fastify/static';
import multipart from '@fastify/multipart';
import { GetSystemStatus, type RuntimeProbe } from '@life-assistant/application';
import {
  buildOpenApiDocument,
  SystemStatusEnvelopeSchema,
  SystemStatusSchema,
} from '@life-assistant/contracts';
import { SystemClock, type Clock } from '@life-assistant/kernel';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  hasZodFastifySchemaValidationErrors,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';

import { registerLocalSecurity, type LocalSecurityOptions } from './local-security.js';
import { registerM1Routes } from './m1-routes.js';
import { registerM2Routes } from './m2-routes.js';
import { registerM3Routes } from './m3-routes.js';
import { registerM4Routes } from './m4-routes.js';
import { registerM5Routes } from './m5-routes.js';
import { registerM6Routes } from './m6-routes.js';
import { registerM7Routes } from './m7-routes.js';
import { registerM8Routes } from './m8-routes.js';
import type { LocalRuntime } from './runtime-probe.js';
import { BootstrapRuntimeProbe } from './runtime-probe.js';

export interface BuildAppOptions {
  readonly appVersion?: string;
  readonly clock?: Clock;
  readonly logger?: boolean | { level?: string; stream?: NodeJS.WritableStream };
  readonly runtimeProbe?: RuntimeProbe;
  readonly runtime?: LocalRuntime;
  readonly security?: LocalSecurityOptions;
  readonly webRoot?: string;
}

export const buildApp = async (options: BuildAppOptions = {}): Promise<FastifyInstance> => {
  const app = Fastify({
    logger: options.logger ?? false,
    requestIdHeader: 'x-request-id',
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  await registerLocalSecurity(app, options.security ?? { enabled: false, port: 43120 });
  await app.register(multipart, { limits: { files: 1, fileSize: 2_147_483_648 } });

  // 必须在任何路由注册之前设置错误处理器：Fastify 在路由注册后的 after 钩子中
  // 捕获 this[kErrorHandler]，若 setErrorHandler 晚于路由注册（尤其晚于
  // await app.register(fastifyStatic) 冲刷 after 队列），已注册路由会被钉在默认错误处理器上，
  // 生产模式（带 webRoot）下所有 API 错误都会退化为 500 默认格式，而非 428/404/409/422 problem+json。
  app.setErrorHandler((error, request, reply) => {
    const isValidation = hasZodFastifySchemaValidationErrors(error);
    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    const isPrecondition = message === 'PRECONDITION_REQUIRED';
    const aiErrorCodes = new Set([
      'AI_UNAVAILABLE',
      'AI_AUTHENTICATION_FAILED',
      'AI_RATE_LIMITED',
      'AI_TIMEOUT',
      'AI_CAPABILITY_UNAVAILABLE',
      'CREDENTIAL_STORE_UNAVAILABLE',
      'CREDENTIAL_SECRET_TOO_LARGE',
    ]);
    const aiErrorCode = aiErrorCodes.has(message) ? message : undefined;
    const isNotFound = message.endsWith('_NOT_FOUND');
    const isConflict =
      message === 'VERSION_CONFLICT' ||
      message === 'SCHEDULE_CONFLICT' ||
      message === 'DEPENDENCY_CYCLE' ||
      message === 'ROUTINE_SEGMENT_OVERLAP' ||
      message === 'APP_NOT_INITIALIZED' ||
      message === 'CONFIRMATION_INVALID' ||
      message.startsWith('CHANGE_SET_') ||
      message.startsWith('RESTORE_CONFLICT:') ||
      message === 'ENTITY_VERSION_UNVERIFIED' ||
      message === 'ENTITY_HISTORY_UNSUPPORTED' ||
      message.includes('UNIQUE constraint failed');
    const isDomainValidation =
      message.startsWith('INVALID_') ||
      message === 'TIME_NOT_GRID_ALIGNED' ||
      message === 'SUBTASK_DEPTH_EXCEEDED' ||
      message === 'CATEGORY_AREA_MISMATCH';
    const status =
      message === 'AI_AUTHENTICATION_FAILED'
        ? 401
        : message === 'AI_RATE_LIMITED'
          ? 429
          : message === 'AI_TIMEOUT'
            ? 504
            : message === 'AI_CAPABILITY_UNAVAILABLE' ||
                message === 'AI_UNAVAILABLE' ||
                message === 'CREDENTIAL_STORE_UNAVAILABLE'
              ? 503
              : message === 'CREDENTIAL_SECRET_TOO_LARGE'
                ? 422
                : isValidation || isDomainValidation
                  ? 422
                  : isPrecondition
                    ? 428
                    : isNotFound
                      ? 404
                      : isConflict
                        ? 409
                        : 500;
    const code = isValidation
      ? 'VALIDATION_ERROR'
      : (aiErrorCode ??
        (message === 'VERSION_CONFLICT'
          ? 'VERSION_CONFLICT'
          : isPrecondition
            ? 'PRECONDITION_REQUIRED'
            : message === 'SCHEDULE_CONFLICT'
              ? 'SCHEDULE_CONFLICT'
              : message === 'APP_NOT_INITIALIZED'
                ? 'APP_NOT_INITIALIZED'
                : message === 'CONFIRMATION_INVALID'
                  ? 'CONFIRMATION_INVALID'
                  : message.startsWith('RESTORE_CONFLICT:')
                    ? 'RESTORE_CONFLICT'
                    : message === 'ENTITY_VERSION_UNVERIFIED'
                      ? 'ENTITY_VERSION_UNVERIFIED'
                      : isConflict
                        ? 'DUPLICATE_VALUE'
                        : 'INTERNAL_ERROR'));

    return reply
      .status(status)
      .type('application/problem+json')
      .send({
        type: `https://local.life-assistant/errors/${code.toLowerCase()}`,
        title:
          aiErrorCode !== undefined && status === 401
            ? 'AI 凭据验证失败'
            : aiErrorCode !== undefined && status === 429
              ? 'AI 服务请求过于频繁'
              : aiErrorCode !== undefined && status === 504
                ? 'AI 服务响应超时'
                : aiErrorCode !== undefined && status === 503
                  ? 'AI 服务不可用'
                  : status === 422
                    ? '请求参数不正确'
                    : status === 409 || status === 428
                      ? '请求状态冲突'
                      : status === 404
                        ? '资源不存在'
                        : '本地服务发生错误',
        status,
        detail:
          aiErrorCode !== undefined
            ? 'AI 服务当前无法完成该请求，请检查本地配置后重试。'
            : status === 422
              ? '请求没有通过契约校验。'
              : status === 409 || status === 428
                ? '数据尚未初始化、版本已变化或名称重复。'
                : status === 404
                  ? '请求的对象不存在或已被删除。'
                  : '请查看本地诊断日志。',
        code,
        instance: request.url,
        requestId: request.id,
      });
  });

  const getSystemStatus = new GetSystemStatus(
    options.clock ?? new SystemClock(),
    options.runtime ?? options.runtimeProbe ?? new BootstrapRuntimeProbe(),
    options.appVersion ?? '0.1.0',
  );

  app.get('/health/live', () => ({ status: 'ok' }));

  app.get('/health/ready', { schema: { response: { 200: SystemStatusSchema } } }, () =>
    getSystemStatus.execute(),
  );

  app.get(
    '/api/v1/system/status',
    { schema: { response: { 200: SystemStatusEnvelopeSchema } } },
    (request) => ({
      data: getSystemStatus.execute(),
      meta: { requestId: request.id },
    }),
  );

  app.get('/api/openapi.json', () => buildOpenApiDocument());

  if (options.runtime !== undefined) {
    registerM1Routes(app, options.runtime);
    registerM2Routes(app, options.runtime);
    registerM3Routes(app, options.runtime);
    registerM4Routes(app, options.runtime);
    registerM5Routes(app, options.runtime);
    registerM6Routes(app, options.runtime);
    registerM7Routes(app, options.runtime);
    registerM8Routes(app, options.runtime);
  }

  const webRoot = options.webRoot === undefined ? undefined : resolve(options.webRoot);

  if (webRoot !== undefined && existsSync(resolve(webRoot, 'index.html'))) {
    await app.register(fastifyStatic, {
      root: webRoot,
      prefix: '/',
      wildcard: false,
    });

    app.setNotFoundHandler((request, reply) => {
      if (request.method === 'GET' && request.headers.accept?.includes('text/html')) {
        return reply.sendFile('index.html');
      }

      return reply.code(404).send({
        type: 'https://local.life-assistant/errors/not-found',
        title: '资源不存在',
        status: 404,
        detail: '请求的本地资源不存在。',
        code: 'NOT_FOUND',
        instance: request.url,
        requestId: request.id,
      });
    });
  } else {
    app.get('/', () => ({
      name: '个人生活助手',
      message: 'Web 开发服务器尚未由本地服务托管。',
    }));
  }

  return app;
};
