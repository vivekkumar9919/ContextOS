# ContextOS: Phase-Wise Development Plan & Verification Checklist

| Metadata | Details |
| :--- | :--- |
| **Project** | **ContextOS** |
| **Document** | Development Plan & Verification Checklist |
| **Version** | `1.0.0` |
| **Status** | Active Execution Plan |
| **Target Runtime** | Node.js 20+ / TypeScript (ES2022) / SQLite 3 |

---

## Roadmap Overview

```
Phase 0: Workspace Scaffolding & Tooling
   ↓
Phase 1: Core Domain Models & SQLite Storage Engine
   ↓
Phase 2: Git Integration & Secret Screening Engine
   ↓
Phase 3: Context Builder & Token-Budgeted Handoff Engine
   ↓
Phase 4: Standalone CLI Application (`contextos`)
   ↓
Phase 5: Model Context Protocol (MCP) Server
   ↓
Phase 6: End-to-End Workflow Validation (Claude ➔ Codex Loop)
```

---

## Phase 0: Workspace Scaffolding & Tooling

### Objectives
* Establish the pnpm monorepo structure.
* Configure strict TypeScript settings, shared configs, and the test runner (Vitest).

### Deliverables
- [ ] Root `package.json` with workspace scripts (`build`, `test`, `lint`, `format`).
- [ ] `pnpm-workspace.yaml` defining `packages/*` and `apps/*`.
- [ ] `tsconfig.base.json` (strict type-checking, ES2022 target, NodeNext module resolution).
- [ ] Package skeletons:
  - `packages/core`
  - `packages/storage`
  - `packages/git`
  - `packages/context-builder`
  - `packages/mcp`
  - `apps/cli`

### Phase 0 Verification Checklist
- [ ] `pnpm install` succeeds without dependency errors or peer conflicts.
- [ ] `pnpm build` executes cleanly across all package skeletons.
- [ ] Vitest test runner executes and reports 0 failed suites.

---

## Phase 1: Core Domain Models & SQLite Storage Engine

### Objectives
* Implement pure TypeScript domain entities and Zod validation schemas.
* Build the zero-config SQLite connection singleton with WAL mode and auto-migration runner.
* Implement repository layer for Tasks, Decisions, and Projects with DAG-based decision supersession.

### Deliverables
- [ ] **`@contextos/core`**:
  - `Project`, `Session`, `Task`, `Decision`, `Issue`, `FileChange`, `Handoff` models.
  - Zod schemas with strict validation rules.
  - Domain error types (`ValidationError`, `EntityNotFoundError`, `CycleDetectedError`).
- [ ] **`@contextos/storage`**:
  - `connection.ts`: `getDatabase()` singleton with `WAL` mode, `foreign_keys = ON`, `busy_timeout = 5000`.
  - Path resolver: Auto-detecting `~/.contextos/` or local `.contextos/`.
  - `migrator.ts`: `_migrations` tracking table and `001_initial_schema.sql`.
  - `ProjectRepository`: CRUD + lookup by `root_path`.
  - `TaskRepository`: Active task management, status transitions, checklist updates.
  - `DecisionRepository`: Decision insertion, active filter, and cyclic-free supersession (`superseded_by_id`).

### Phase 1 Verification Checklist
```bash
pnpm --filter @contextos/storage test
pnpm --filter @contextos/core test
```
- [ ] **Schema Auto-Creation**: Deleting `~/.contextos/context.db` and running test auto-creates database and applies `001_initial_schema` without errors.
- [ ] **WAL Mode Active**: `PRAGMA journal_mode;` returns `wal`.
- [ ] **Foreign Key Enforcement**: Deleting a project cascades and deletes associated tasks and decisions.
- [ ] **Task Status Invariant**: Tasks enforce valid statuses (`BACKLOG`, `IN_PROGRESS`, `BLOCKED`, `COMPLETED`).
- [ ] **Decision Supersession DAG**:
  - Creating Decision A, then Decision B (superseding A) sets Decision A to `SUPERSEDED` and Decision B to `ACTIVE`.
  - Attempting to make Decision A supersede Decision B throws `CycleDetectedError`.

---

## Phase 2: Git Integration & Secret Screening Engine

### Objectives
* Reconcile conceptual task state with the physical working tree.
* Implement intelligent noise filtering for lockfiles, minified bundles, and build outputs.
* Screen diffs and code references for sensitive secrets before saving.

### Deliverables
- [ ] **`@contextos/git`**:
  - `GitClient`: Fast execution of `git status --porcelain`, `git diff`, `git rev-parse`.
  - `DiffFilter`: Exclusion glob matcher (ignoring `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `dist/`, `.next/`, `*.map`).
  - Line truncation logic: Individual file diffs capped at 150 lines; total diffs capped at 1,000 lines with statistical fallback summary (`+X lines, -Y lines`).
  - `SecretScreen`: High-entropy regex scanner identifying API keys (OpenAI, GitHub, AWS, private keys) and redacting them with `[REDACTED SECRET DETECTED]`.

### Phase 2 Verification Checklist
```bash
pnpm --filter @contextos/git test
```
- [ ] **Dirty State Detection**: Modifying a test file is accurately reported with branch name and HEAD commit hash.
- [ ] **Noise Filter**: Modifying `package-lock.json` alongside `src/index.ts` excludes `package-lock.json` from the output diff.
- [ ] **Diff Budget Capping**: A simulated diff of 500 lines on a single file is truncated with summary statistics.
- [ ] **Secret Redaction**: Passing a string containing `sk-abcdef12345678901234567890` or `-----BEGIN RSA PRIVATE KEY-----` replaces the secret with `[REDACTED SECRET DETECTED]`.

---

## Phase 3: Context Builder & Token-Budgeted Handoff Engine

### Objectives
* Build the deterministic relevance engine and markdown compiler.
* Package structured state into a bounded, high-density handoff document.

### Deliverables
- [ ] **`@contextos/context-builder`**:
  - `BudgetAllocator`: Tiered budget priority ladder (Tier 0 mandatory to Tier 3 enrichers, 4,000 token target).
  - `MarkdownFormatter`: Formats task specification, invariants, active decisions, git diff, and blockers into `.contextos/handoffs/latest.md`.
  - Handoff archiver: Saves timestamped snapshot (e.g., `2026-09-26T14-30-00_claude_to_codex.md`).

### Phase 3 Verification Checklist
```bash
pnpm --filter @contextos/context-builder test
```
- [ ] **Markdown Compliance**: Generated `latest.md` strictly adheres to the format specified in TRD Section 5.2.
- [ ] **Superseded Invariant**: Superseded decisions are never included under "Active Architectural Decisions".
- [ ] **Budget Adherence**: A heavy context with 20 issues and long diffs is trimmed to remain under the 4,000-token budget ceiling without losing Tier 0 items.

---

## Phase 4: Standalone CLI Application (`apps/cli`)

### Objectives
* Provide developer-friendly terminal commands with zero configuration.
* Enable clipboard integration for seamless pasting into web chats.

### Deliverables
- [ ] `contextos` executable binary (`commander` or `cac` CLI framework).
- [ ] CLI Commands:
  - `contextos init [--local]`: Initializes local or global ContextOS home.
  - `contextos status`: Shows current active project, task, and git branch.
  - `contextos task <create|update|complete|clear>`: Manages task lifecycle.
  - `contextos decision <add|supersede|list>`: Manages architectural decisions.
  - `contextos handoff [--from <agent>] [--to <agent>]`: Compiles `latest.md` and copies to system clipboard.
  - `contextos clean [--project|--all]`: Manages data deletion and cleanup.

### Phase 4 Verification Checklist
```bash
contextos --help
```
- [ ] `contextos init` creates `~/.contextos/` and initializes `context.db`.
- [ ] `contextos task create --title "Auth Feature" --goal "JWT Auth"` stores the task and sets status to `IN_PROGRESS`.
- [ ] `contextos handoff` writes `.contextos/handoffs/latest.md` and populates the OS clipboard (`pbcopy` / system clipboard).
- [ ] `contextos clean --project` wipes only the active project without corrupting other registered projects.

---

## 5. Phase 5: Model Context Protocol (MCP) Server

### Objectives
* Allow autonomous coding agents (Claude Code, Cursor, Codex) to interact directly with ContextOS via standard I/O.

### Deliverables
- [ ] **`@contextos/mcp`**:
  - Stdio JSON-RPC transport implementation via `@modelcontextprotocol/sdk`.
  - Tool Handlers:
    - `get_current_task`
    - `save_context`
    - `record_decision`
    - `create_handoff`
    - `get_git_context`
  - Graceful connection handling and SQLite transaction wrapping.

### Phase 5 Verification Checklist
```bash
npx @modelcontextprotocol/inspector node packages/mcp/dist/index.js
```
- [ ] MCP Inspector connects over stdio and lists all 5 tools.
- [ ] Calling `save_context` with `{ title: "New Task" }` creates record in SQLite.
- [ ] Calling `get_current_task` returns the newly created task.
- [ ] Calling `create_handoff` returns the markdown payload and token estimate.

---

## Phase 6: End-to-End Workflow Validation (Claude ➔ Codex Loop)

### Objectives
* Validate the complete, real-world multi-agent handoff loop without relying on paid APIs or manual explanation.

### Execution Scenario:
1. **Planning with Claude**:
   - Claude plans a feature refactor.
   - Claude registers 1 task, 2 constraints, and 1 architectural decision via `save_context` (or user runs `contextos save`).
2. **Handoff Generation**:
   - User triggers `contextos handoff`.
   - `.contextos/handoffs/latest.md` is generated in < 200ms and copied to clipboard.
3. **Execution with Codex**:
   - User pastes handoff into Codex (or references `@.contextos/handoffs/latest.md`).
   - Codex implements code conforming to the constraints.
   - User runs tests.
4. **Return Handoff & Review**:
   - User runs `contextos handoff --from codex --to claude`.
   - User pastes into Claude for code review. Claude audits changes against original constraints.

### Phase 6 Verification Checklist
- [ ] Downstream agent adheres to invariants specified in Phase 1 without manual prompt reminders.
- [ ] Git diff accurately reflects files modified during the session.
- [ ] Token usage for the handoff remains under 1,000 tokens for average feature tasks.
- [ ] Zero database lock errors occurred across CLI, MCP, and editor processes.
