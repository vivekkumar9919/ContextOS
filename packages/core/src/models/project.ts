import { z } from 'zod';

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Project name is required'),
  rootPath: z.string().min(1, 'Project root path is required'),
  createdAt: z.string().datetime().default(() => new Date().toISOString()),
});

export type Project = z.infer<typeof ProjectSchema>;

export const CreateProjectInputSchema = ProjectSchema.omit({
  id: true,
  createdAt: true,
}).extend({
  id: z.string().uuid().optional(),
});

export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;
