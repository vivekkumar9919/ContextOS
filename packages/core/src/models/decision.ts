import { z } from 'zod';

export const DecisionStatusSchema = z.enum(['ACTIVE', 'SUPERSEDED', 'DEPRECATED']);
export type DecisionStatus = z.infer<typeof DecisionStatusSchema>;

export const DecisionSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  title: z.string().min(1, 'Decision title is required'),
  rationale: z.string().min(1, 'Decision rationale is required'),
  status: DecisionStatusSchema.default('ACTIVE'),
  supersededById: z.string().uuid().nullable().optional(),
  relatedFiles: z.array(z.string()).default([]),
  createdAt: z.string().datetime().default(() => new Date().toISOString()),
});

export type Decision = z.infer<typeof DecisionSchema>;

export const CreateDecisionInputSchema = DecisionSchema.omit({
  id: true,
  createdAt: true,
}).extend({
  id: z.string().uuid().optional(),
  status: DecisionStatusSchema.optional().default('ACTIVE'),
  supersededById: z.string().uuid().nullable().optional(),
  relatedFiles: z.array(z.string()).optional().default([]),
});

export type CreateDecisionInput = z.infer<typeof CreateDecisionInputSchema>;
