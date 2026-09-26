import { z } from 'zod';

export const IssueStatusSchema = z.enum(['OPEN', 'RESOLVED', 'WONT_FIX']);
export type IssueStatus = z.infer<typeof IssueStatusSchema>;

export const IssueSeveritySchema = z.enum(['BLOCKER', 'HIGH', 'LOW']);
export type IssueSeverity = z.infer<typeof IssueSeveritySchema>;

export const IssueSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  title: z.string().min(1, 'Issue title is required'),
  description: z.string().nullable().optional(),
  status: IssueStatusSchema.default('OPEN'),
  severity: IssueSeveritySchema.default('HIGH'),
  createdAt: z.string().datetime().default(() => new Date().toISOString()),
});

export type Issue = z.infer<typeof IssueSchema>;

export const CreateIssueInputSchema = IssueSchema.omit({
  id: true,
  createdAt: true,
}).extend({
  id: z.string().uuid().optional(),
  status: IssueStatusSchema.optional().default('OPEN'),
  severity: IssueSeveritySchema.optional().default('HIGH'),
  description: z.string().nullable().optional(),
});

export type CreateIssueInput = z.infer<typeof CreateIssueInputSchema>;
