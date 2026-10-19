import { z } from 'zod';

import { RequestMetaSchema } from './m1.js';

const envelope = <T extends z.ZodType>(schema: T) =>
  z.object({ data: schema, meta: RequestMetaSchema });

export const TriggerModeSchema = z.enum(['ABSOLUTE', 'OFFSET_BEFORE_START', 'OFFSET_BEFORE_DUE']);

export const ReminderSchema = z.object({
  id: z.string().length(26),
  targetEntityId: z.string().length(26),
  targetEntityType: z.enum(['TASK', 'EVENT']),
  triggerMode: TriggerModeSchema,
  triggerAt: z.iso.datetime().nullable(),
  offsetMinutes: z.number().int().min(1).max(525_600).nullable(),
  isEnabled: z.boolean(),
  version: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const CreateReminderRequestSchema = z
  .object({
    targetEntityId: z.string().length(26),
    triggerMode: TriggerModeSchema,
    triggerAt: z.iso.datetime().nullable().optional(),
    offsetMinutes: z.number().int().min(1).max(525_600).nullable().optional(),
  })
  .refine(
    (value) =>
      value.triggerMode === 'ABSOLUTE'
        ? value.triggerAt !== null && value.triggerAt !== undefined
        : value.offsetMinutes !== null && value.offsetMinutes !== undefined,
    { message: 'ABSOLUTE 提醒需要 triggerAt，偏移提醒需要 offsetMinutes。' },
  );

export const UpdateReminderRequestSchema = z.object({
  expectedVersion: z.number().int().positive(),
  triggerMode: TriggerModeSchema.optional(),
  triggerAt: z.iso.datetime().nullable().optional(),
  offsetMinutes: z.number().int().min(1).max(525_600).nullable().optional(),
  isEnabled: z.boolean().optional(),
});

export const SnoozeNotificationRequestSchema = z.object({
  snoozedUntil: z.iso.datetime(),
});

export const ReminderEnvelopeSchema = envelope(ReminderSchema);
export const RemindersEnvelopeSchema = envelope(z.array(ReminderSchema));

export const HolidayUpdateRequestSchema = z.object({
  year: z.number().int().min(2000).max(2100).optional(),
});
export const HolidayUpdateResultSchema = z.object({
  providerId: z.string(),
  year: z.number().int(),
  applied: z.number().int().nonnegative(),
  preservedUserOverrides: z.number().int().nonnegative(),
});
export const HolidayUpdateResultEnvelopeSchema = envelope(HolidayUpdateResultSchema);
export const HolidayOverrideRemoveSchema = z.object({
  removed: z.boolean(),
});
export const HolidayOverrideRemoveEnvelopeSchema = envelope(HolidayOverrideRemoveSchema);

export type ReminderDto = z.infer<typeof ReminderSchema>;
export type CreateReminderRequest = z.infer<typeof CreateReminderRequestSchema>;
export type UpdateReminderRequest = z.infer<typeof UpdateReminderRequestSchema>;
