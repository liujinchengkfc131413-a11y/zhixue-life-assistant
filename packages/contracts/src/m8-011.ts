import { z } from 'zod';

import { RequestMetaSchema } from './m1.js';
import { BackgroundJobSummarySchema, DiskSpaceSummarySchema } from './system-status.js';

const envelope = <T extends z.ZodType>(schema: T) =>
  z.object({ data: schema, meta: RequestMetaSchema });

export const LogFileInfoSchema = z.object({
  name: z.string().min(1),
  bytes: z.number().int().nonnegative(),
});

/** 诊断信息：默认隐藏个人内容与密钥，日志仅返回脱敏后的尾部。 */
export const DiagnosticInfoSchema = z.object({
  appVersion: z.string().min(1),
  schemaVersion: z.number().int().nonnegative(),
  dataDirectoryId: z.string().min(1),
  generatedAt: z.iso.datetime(),
  uptimeSeconds: z.number().int().nonnegative(),
  backgroundJobs: BackgroundJobSummarySchema,
  disk: DiskSpaceSummarySchema,
  logs: z.array(LogFileInfoSchema),
  logTail: z.string(),
});

export const DiagnosticInfoEnvelopeSchema = envelope(DiagnosticInfoSchema);

export const DiagnosticExportSchema = z.object({
  path: z.string().min(1),
});

export const DiagnosticExportEnvelopeSchema = envelope(DiagnosticExportSchema);

export type DiagnosticInfo = z.infer<typeof DiagnosticInfoSchema>;
export type DiagnosticInfoEnvelope = z.infer<typeof DiagnosticInfoEnvelopeSchema>;
export type LogFileInfo = z.infer<typeof LogFileInfoSchema>;
