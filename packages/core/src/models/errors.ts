export class ContextOSError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContextOSError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends ContextOSError {
  public readonly issues: unknown[];

  constructor(message: string, issues: unknown[] = []) {
    super(message);
    this.name = 'ValidationError';
    this.issues = issues;
  }
}

export class EntityNotFoundError extends ContextOSError {
  public readonly entityType: string;
  public readonly id: string;

  constructor(entityType: string, id: string) {
    super(`${entityType} with ID '${id}' was not found.`);
    this.name = 'EntityNotFoundError';
    this.entityType = entityType;
    this.id = id;
  }
}

export class CycleDetectedError extends ContextOSError {
  public readonly fromId: string;
  public readonly toId: string;

  constructor(fromId: string, toId: string) {
    super(`Cycle detected in decision supersession DAG: '${toId}' cannot supersede '${fromId}'.`);
    this.name = 'CycleDetectedError';
    this.fromId = fromId;
    this.toId = toId;
  }
}
