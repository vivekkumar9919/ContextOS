import { z } from 'zod';

export const TaskStatusSchema = z.enum(['BACKLOG', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED']);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  title: z.string().min(1, 'Task title is required'),
  goal: z.string().min(1, 'Task goal is required'),
  status: TaskStatusSchema.default('IN_PROGRESS'),
  constraints: z.array(z.string()).default([]),
  completedItems: z.array(z.string()).default([]),
  remainingItems: z.array(z.string()).default([]),
  blocker: z.string().nullable().optional(),
  createdAt: z.string().datetime().default(() => new Date().toISOString()),
  updatedAt: z.string().datetime().default(() => new Date().toISOString()),
});

export type Task = z.infer<typeof TaskSchema>;

export const CreateTaskInputSchema = TaskSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  id: z.string().uuid().optional(),
  status: TaskStatusSchema.optional().default('IN_PROGRESS'),
  constraints: z.array(z.string()).optional().default([]),
  completedItems: z.array(z.string()).optional().default([]),
  remainingItems: z.array(z.string()).optional().default([]),
  blocker: z.string().nullable().optional(),
});

export type CreateTaskInput = z.infer<typeof CreateTaskInputSchema>;

export const UpdateTaskInputSchema = z.object({
  title: z.string().min(1).optional(),
  goal: z.string().min(1).optional(),
  status: TaskStatusSchema.optional(),
  constraints: z.array(z.string()).optional(),
  addConstraints: z.array(z.string()).optional(),
  completedItems: z.array(z.string()).optional(),
  addCompletedItems: z.array(z.string()).optional(),
  remainingItems: z.array(z.string()).optional(),
  addRemainingItems: z.array(z.string()).optional(),
  blocker: z.string().nullable().optional(),
});

export type UpdateTaskInput = z.infer<typeof UpdateTaskInputSchema>;
