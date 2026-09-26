import { z } from 'zod';

export const HandoffPhaseSchema = z.enum(['planning', 'implementation', 'review', 'debugging']);
export type HandoffPhase = z.infer<typeof HandoffPhaseSchema>;

export const HandoffSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  sessionId: z.string().uuid().nullable().optional(),
  fromAgent: z.string().min(1, 'fromAgent is required'),
  toAgent: z.string().min(1, 'toAgent is required'),
  targetPhase: HandoffPhaseSchema.default('implementation'),
  markdownPayload: z.string().min(1, 'markdownPayload is required'),
  createdAt: z.string().datetime().default(() => new Date().toISOString()),
});

export type Handoff = z.infer<typeof HandoffSchema>;

export const CreateHandoffInputSchema = HandoffSchema.omit({
  id: true,
  createdAt: true,
}).extend({
  id: z.string().uuid().optional(),
  targetPhase: HandoffPhaseSchema.optional().default('implementation'),
  sessionId: z.string().uuid().nullable().optional(),
});

export type CreateHandoffInput = z.infer<typeof CreateHandoffInputSchema>;
