import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  ProjectSchema,
  TaskSchema,
  DecisionSchema,
  IssueSchema,
  CycleDetectedError,
} from '../src/index.js';

describe('@contextos/core Model Validations', () => {
  it('validates a valid Project entity', () => {
    const valid = ProjectSchema.parse({
      id: randomUUID(),
      name: 'ContextOS',
      rootPath: '/Users/test/projects/ContextOS',
      createdAt: new Date().toISOString(),
    });

    expect(valid.name).toBe('ContextOS');
  });

  it('rejects an invalid Task status', () => {
    expect(() => {
      TaskSchema.parse({
        id: randomUUID(),
        projectId: randomUUID(),
        title: 'Fix issue',
        goal: 'Fix bug',
        status: 'INVALID_STATUS' as any,
      });
    }).toThrow();
  });

  it('validates a Task with default values', () => {
    const task = TaskSchema.parse({
      id: randomUUID(),
      projectId: randomUUID(),
      title: 'Order Routing',
      goal: 'Route orders to warehouses',
    });

    expect(task.status).toBe('IN_PROGRESS');
    expect(task.constraints).toEqual([]);
    expect(task.completedItems).toEqual([]);
    expect(task.remainingItems).toEqual([]);
  });

  it('validates a Decision entity', () => {
    const decision = DecisionSchema.parse({
      id: randomUUID(),
      projectId: randomUUID(),
      title: 'Use Strategy Pattern',
      rationale: 'Allows extensible warehouse allocation',
      relatedFiles: ['src/router.ts'],
    });

    expect(decision.status).toBe('ACTIVE');
    expect(decision.supersededById).toBeUndefined();
    expect(decision.relatedFiles).toEqual(['src/router.ts']);
  });

  it('throws CycleDetectedError with proper messaging', () => {
    const error = new CycleDetectedError('dec-1', 'dec-2');
    expect(error.name).toBe('CycleDetectedError');
    expect(error.message).toContain("'dec-2' cannot supersede 'dec-1'");
  });
});
