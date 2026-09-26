import { z } from 'zod';

export const AgentRoleSchema = z.enum(['planner', 'implementer', 'reviewer', 'debugger', 'general']);
export type AgentRole = z.infer<typeof AgentRoleSchema>;

export const SessionSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  agentName: z.string().min(1, 'Agent name is required'),
  agentRole: AgentRoleSchema,
  startedAt: z.string().datetime().default(() => new Date().toISOString()),
  endedAt: z.string().datetime().nullable().optional(),
});

export type Session = z.infer<typeof SessionSchema>;

export const CreateSessionInputSchema = SessionSchema.omit({
  id: true,
  startedAt: true,
}).extend({
  id: z.string().uuid().optional(),
});

export type CreateSessionInput = z.infer<typeof CreateSessionInputSchema>;
