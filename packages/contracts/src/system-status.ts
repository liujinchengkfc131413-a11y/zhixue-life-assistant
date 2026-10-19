import { z } from 'zod';

export const RuntimeStateSchema = z.enum(['STARTING', 'READY', 'DEGRADED']);

export const BackgroundJobSummarySchema = z.object({
  pending: z.number().int().nonnegative(),
  running: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
});

export const DiskSpaceSummarySchema = z.object({
  freeBytes: z.number().int().nonnegative(),
  totalBytes: z.number().int().nonnegative(),
});

export const SystemStatusSchema = z.object({
  state: RuntimeStateSchema,
  appVersion: z.string().min(1),
  serverTime: z.iso.datetime(),
  timeZone: z.literal('Asia/Shanghai'),
  database: z.object({
    connected: z.boolean(),
    dataDirectoryConfigured: z.boolean(),
  }),
  capabilities: z.object({
    aiConfigured: z.boolean(),
    schedulerAvailable: z.boolean(),
  }),
  backgroundJobs: BackgroundJobSummarySchema,
  disk: DiskSpaceSummarySchema,
});

export const SystemStatusEnvelopeSchema = z.object({
  data: SystemStatusSchema,
  meta: z.object({
    requestId: z.string().min(1),
  }),
});

export type SystemStatus = z.infer<typeof SystemStatusSchema>;
export type SystemStatusEnvelope = z.infer<typeof SystemStatusEnvelopeSchema>;
export type BackgroundJobSummary = z.infer<typeof BackgroundJobSummarySchema>;
export type DiskSpaceSummary = z.infer<typeof DiskSpaceSummarySchema>;
