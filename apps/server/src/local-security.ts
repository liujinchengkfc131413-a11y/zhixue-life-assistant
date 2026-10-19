import { randomBytes, timingSafeEqual } from 'node:crypto';

import cookie from '@fastify/cookie';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const SESSION_COOKIE = 'life_assistant_session';
const SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000;
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

interface Session {
  readonly csrfToken: string;
  readonly expiresAt: number;
}

export interface LocalSecurityOptions {
  readonly enabled: boolean;
  readonly launchToken?: string;
  readonly port: number;
}

const tokenEquals = (expected: string, actual: string): boolean => {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return (
    expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer)
  );
};

const sendSecurityError = (
  reply: FastifyReply,
  request: FastifyRequest,
  status: 401 | 403,
  code: string,
  detail: string,
) =>
  reply
    .status(status)
    .type('application/problem+json')
    .send({
      type: `https://local.life-assistant/errors/${code.toLowerCase()}`,
      title: status === 401 ? '需要本地启动会话' : '请求来源被拒绝',
      status,
      detail,
      code,
      instance: request.url,
      requestId: request.id,
    });

export const registerLocalSecurity = async (
  app: FastifyInstance,
  options: LocalSecurityOptions,
): Promise<void> => {
  await app.register(cookie);
  const sessions = new Map<string, Session>();
  const allowedOrigins = new Set([
    `http://127.0.0.1:${String(options.port)}`,
    `http://localhost:${String(options.port)}`,
  ]);
  const developmentSession: Session = {
    csrfToken: 'development-csrf-token-0000000000000000',
    expiresAt: Date.now() + SESSION_LIFETIME_MS,
  };

  app.get('/launch', (request, reply) => {
    const token = (request.query as { token?: unknown }).token;
    if (
      !options.enabled ||
      typeof token !== 'string' ||
      options.launchToken === undefined ||
      !tokenEquals(options.launchToken, token)
    ) {
      return sendSecurityError(
        reply,
        request,
        401,
        'INVALID_LAUNCH_TOKEN',
        '启动令牌无效或已失效。',
      );
    }
    const sessionId = randomBytes(32).toString('base64url');
    const session: Session = {
      csrfToken: randomBytes(32).toString('base64url'),
      expiresAt: Date.now() + SESSION_LIFETIME_MS,
    };
    sessions.set(sessionId, session);
    reply.setCookie(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: 'strict',
      secure: false,
      path: '/',
      maxAge: SESSION_LIFETIME_MS / 1000,
    });
    return reply.redirect('/');
  });

  app.addHook('onRequest', (request, reply, done) => {
    const host = request.headers.host?.split(':')[0]?.toLowerCase();
    if (host !== '127.0.0.1' && host !== 'localhost') {
      void sendSecurityError(reply, request, 403, 'INVALID_HOST', '只允许从本机地址访问。');
      return;
    }
    if (
      !options.enabled ||
      request.url.startsWith('/launch') ||
      request.url.startsWith('/health/')
    ) {
      done();
      return;
    }
    const sessionId = request.cookies[SESSION_COOKIE];
    const session = sessionId === undefined ? undefined : sessions.get(sessionId);
    if (session === undefined || session.expiresAt <= Date.now()) {
      void sendSecurityError(
        reply,
        request,
        401,
        'LOCAL_SESSION_REQUIRED',
        '请通过桌面快捷方式重新打开应用。',
      );
      return;
    }
    if (!SAFE_METHODS.has(request.method)) {
      const origin = request.headers.origin;
      const csrfToken = request.headers['x-csrf-token'];
      if (
        origin === undefined ||
        !allowedOrigins.has(origin) ||
        typeof csrfToken !== 'string' ||
        !tokenEquals(session.csrfToken, csrfToken)
      ) {
        void sendSecurityError(
          reply,
          request,
          403,
          'CSRF_VALIDATION_FAILED',
          '写入请求缺少有效的同源证明。',
        );
        return;
      }
    }
    done();
  });

  app.get('/api/v1/session', (request) => {
    const sessionId = request.cookies[SESSION_COOKIE];
    const session = options.enabled
      ? sessionId === undefined
        ? undefined
        : sessions.get(sessionId)
      : developmentSession;
    if (session === undefined) throw new Error('本地会话不存在。');
    return {
      data: { csrfToken: session.csrfToken, expiresAt: new Date(session.expiresAt).toISOString() },
      meta: { requestId: request.id },
    };
  });
};
