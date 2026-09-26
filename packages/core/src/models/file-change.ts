import { z } from 'zod';

export const ChangeTypeSchema = z.enum(['MODIFIED', 'ADDED', 'DELETED']);
export type ChangeType = z.infer<typeof ChangeTypeSchema>;

export const FileChangeSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  filePath: z.string().min(1, 'File path is required'),
  changeType: ChangeTypeSchema,
  summary: z.string().nullable().optional(),
});

export type FileChange = z.infer<typeof FileChangeSchema>;

export const CreateFileChangeInputSchema = FileChangeSchema.omit({
  id: true,
}).extend({
  id: z.string().uuid().optional(),
  summary: z.string().nullable().optional(),
});

export type CreateFileChangeInput = z.infer<typeof CreateFileChangeInputSchema>;
