import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import {
  createDatabaseConnection,
  ProjectRepository,
  TaskRepository,
  DecisionRepository,
  IssueRepository,
  HandoffRepository,
} from '../src/index.js';
import { CycleDetectedError } from '@contextos/core';

describe('@contextos/storage Test Suite', () => {
  let db: Database.Database;
  let projectRepo: ProjectRepository;
  let taskRepo: TaskRepository;
  let decisionRepo: DecisionRepository;
  let issueRepo: IssueRepository;
  let handoffRepo: HandoffRepository;

  beforeEach(() => {
    db = createDatabaseConnection({ inMemory: true });
    projectRepo = new ProjectRepository(db);
    taskRepo = new TaskRepository(db);
    decisionRepo = new DecisionRepository(db);
    issueRepo = new IssueRepository(db);
    handoffRepo = new HandoffRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('Migrations & Pragmas', () => {
    it('applies initial schema and tracks it in _migrations', () => {
      const rows = db.prepare('SELECT id, name FROM _migrations').all() as any[];
      expect(rows.length).toBeGreaterThanOrEqual(1);
      expect(rows[0].id).toBe('001');
      expect(rows[0].name).toBe('initial_schema');
    });

    it('enforces foreign keys', () => {
      const fk = db.pragma('foreign_keys', { simple: true });
      expect(fk).toBe(1);
    });
  });

  describe('Project & Foreign Key Cascades', () => {
    it('creates and retrieves a project', () => {
      const proj = projectRepo.create({
        name: 'ContextOS',
        rootPath: '/Users/test/ContextOS',
      });

      expect(proj.id).toBeDefined();
      expect(proj.name).toBe('ContextOS');

      const found = projectRepo.findById(proj.id);
      expect(found).not.toBeNull();
      expect(found?.rootPath).toBe('/Users/test/ContextOS');
    });

    it('cascades deletion to tasks and decisions', () => {
      const proj = projectRepo.create({ name: 'P1', rootPath: '/p1' });
      const task = taskRepo.create({
        projectId: proj.id,
        title: 'Task 1',
        goal: 'Goal 1',
      });
      const dec = decisionRepo.create({
        projectId: proj.id,
        title: 'Dec 1',
        rationale: 'Rat 1',
      });

      expect(taskRepo.findById(task.id)).not.toBeNull();
      expect(decisionRepo.findById(dec.id)).not.toBeNull();

      projectRepo.delete(proj.id);

      expect(taskRepo.findById(task.id)).toBeNull();
      expect(decisionRepo.findById(dec.id)).toBeNull();
    });
  });

  describe('Task Lifecycle', () => {
    it('manages task progress, checklists, and active task query', () => {
      const proj = projectRepo.create({ name: 'App', rootPath: '/app' });

      const task = taskRepo.create({
        projectId: proj.id,
        title: 'Auth feature',
        goal: 'Implement JWT',
        constraints: ['Zero external services'],
        remainingItems: ['Token generator', 'Middleware validator'],
      });

      expect(task.status).toBe('IN_PROGRESS');

      const active = taskRepo.findActiveByProject(proj.id);
      expect(active?.id).toBe(task.id);

      const updated = taskRepo.update(task.id, {
        addCompletedItems: ['Token generator'],
        blocker: 'Waiting on secret rotation',
        status: 'BLOCKED',
      });

      expect(updated.status).toBe('BLOCKED');
      expect(updated.completedItems).toContain('Token generator');
      expect(updated.remainingItems).not.toContain('Token generator');
      expect(updated.remainingItems).toContain('Middleware validator');
      expect(updated.blocker).toBe('Waiting on secret rotation');
    });

    it('stores optional Jira ticket ID and retrieves task by Jira ID case-insensitively', () => {
      const proj = projectRepo.create({ name: 'JiraApp', rootPath: '/jira-app' });

      const task = taskRepo.create({
        projectId: proj.id,
        title: 'Payment Webhook',
        goal: 'Ingest Stripe webhooks',
        jiraId: 'PAY-402',
      });

      expect(task.jiraId).toBe('PAY-402');

      const foundUpper = taskRepo.findByJiraId(proj.id, 'PAY-402');
      expect(foundUpper).not.toBeNull();
      expect(foundUpper?.id).toBe(task.id);

      const foundLower = taskRepo.findByJiraId(proj.id, 'pay-402');
      expect(foundLower).not.toBeNull();
      expect(foundLower?.id).toBe(task.id);

      const notFound = taskRepo.findByJiraId(proj.id, 'NONEXISTENT-999');
      expect(notFound).toBeNull();
    });
  });

  describe('Decision Supersession DAG', () => {
    it('records decisions and allows active decisions filtering', () => {
      const proj = projectRepo.create({ name: 'App', rootPath: '/app' });

      decisionRepo.create({
        projectId: proj.id,
        title: 'Use Strategy Pattern',
        rationale: 'Modular routing',
      });

      const active = decisionRepo.listActiveByProject(proj.id);
      expect(active.length).toBe(1);
      expect(active[0].title).toBe('Use Strategy Pattern');
    });

    it('supersedes an older decision cleanly', () => {
      const proj = projectRepo.create({ name: 'App', rootPath: '/app' });

      const decA = decisionRepo.create({
        projectId: proj.id,
        title: 'Use Kafka',
        rationale: 'Event broker',
      });

      const decB = decisionRepo.create({
        projectId: proj.id,
        title: 'Use Redis Streams',
        rationale: 'Lower latency and local friendly',
      });

      decisionRepo.supersede(decA.id, decB.id);

      const refreshedA = decisionRepo.findById(decA.id);
      const refreshedB = decisionRepo.findById(decB.id);

      expect(refreshedA?.status).toBe('SUPERSEDED');
      expect(refreshedA?.supersededById).toBe(decB.id);
      expect(refreshedB?.status).toBe('ACTIVE');

      const active = decisionRepo.listActiveByProject(proj.id);
      expect(active.length).toBe(1);
      expect(active[0].id).toBe(decB.id);
    });

    it('prevents cycle in decision supersession (A supersedes B -> B cannot supersede A)', () => {
      const proj = projectRepo.create({ name: 'App', rootPath: '/app' });

      const decA = decisionRepo.create({
        projectId: proj.id,
        title: 'Decision A',
        rationale: 'Rationale A',
      });

      const decB = decisionRepo.create({
        projectId: proj.id,
        title: 'Decision B',
        rationale: 'Rationale B',
      });

      decisionRepo.supersede(decA.id, decB.id);

      expect(() => {
        decisionRepo.supersede(decB.id, decA.id);
      }).toThrowError(CycleDetectedError);
    });
  });

  describe('Issues and Handoffs', () => {
    it('creates, lists open issues, and resolves them', () => {
      const proj = projectRepo.create({ name: 'App', rootPath: '/app' });
      const task = taskRepo.create({ projectId: proj.id, title: 'T1', goal: 'G1' });

      const issue = issueRepo.create({
        taskId: task.id,
        title: 'Tests failing on warehouse split',
        severity: 'BLOCKER',
      });

      expect(issue.status).toBe('OPEN');
      const openIssues = issueRepo.listOpenByTask(task.id);
      expect(openIssues.length).toBe(1);

      issueRepo.resolve(issue.id);
      expect(issueRepo.listOpenByTask(task.id).length).toBe(0);
    });

    it('creates and fetches latest handoff for a task', () => {
      const proj = projectRepo.create({ name: 'App', rootPath: '/app' });
      const task = taskRepo.create({ projectId: proj.id, title: 'T1', goal: 'G1' });

      handoffRepo.create({
        taskId: task.id,
        fromAgent: 'claude',
        toAgent: 'codex',
        targetPhase: 'implementation',
        markdownPayload: '# Handoff to Codex',
      });

      const latest = handoffRepo.findLatestByTask(task.id);
      expect(latest).not.toBeNull();
      expect(latest?.fromAgent).toBe('claude');
      expect(latest?.toAgent).toBe('codex');
      expect(latest?.markdownPayload).toBe('# Handoff to Codex');
    });
  });
});
