# ContextOS: Future Architectural Plan & Technical Roadmap

> **From a deterministic context handoff tool to a persistent, intelligent local knowledge and governance plane for AI-assisted engineering.**

---

## 📌 Executive Summary

ContextOS currently provides a local-first SQLite engine and an 11-tool Model Context Protocol (MCP) suite that eliminates "chat hoarding", enables seamless model hopping (Claude ➔ Codex ➔ Cursor ➔ Antigravity), and cuts prompt token usage by up to 90%+.

The next evolutionary leap transforms ContextOS into a **persistent engineering memory and guardrail system**. This document details the architectural specifications, data structures, and phased implementation plans for these upcoming capabilities.

```text
                               ┌─────────────────────────────────┐
                               │       Global Guardrails         │
                               │   (Zero-config, machine-wide)   │
                               └────────────────┬────────────────┘
                                                │
┌──────────────────────────┐   ┌────────────────▼────────────────┐   ┌──────────────────────────┐
│   Context Provenance     │   │      ContextOS Core Engine      │   │   Code-Aware Context     │
│ (Jira, Slack, RFCs, PRs) │──▶│   • Working Memory (Active)     │◀──│ (Tree-Sitter AST Slices) │
└──────────────────────────┘   │   • Episodic Memory (FTS5)      │   └──────────────────────────┘
                               └────────────────┬────────────────┘
                                                │
                               ┌────────────────▼────────────────┐
                               │   Role-Tailored Multi-Agent     │
                               │   Planner ➔ Dev ➔ Reviewer      │
                               └─────────────────────────────────┘
```

---

## 1. Global Guardrails & Zero-Config Policy Engine

### Problem
Developers currently define instructions repeatedly in every repository via `.cursorrules`, `CLAUDE.md`, or custom system prompts. When working across 20+ microservices or repos, maintaining consistent engineering policies is tedious and error-prone.

### Architectural Solution
ContextOS will introduce a **hierarchical policy inheritance model** where global policies defined once at `~/.contextos` automatically cascade to every repository without modifying any repo files.

```text
Machine-Global Invariants (~/.contextos)
   ├── "Never commit or log private keys, .env, or credentials"
   ├── "All new endpoints require automated integration tests"
   └── "No destructive git commands (push --force, reset --hard)"
            ↓ inherits & merges
Repo-Local Invariants (<repo>/.contextos)
   └── "Use PostgreSQL JSONB for flexible event payloads"
```

### Technical Design
* **Storage**: A `guardrails` table in SQLite (`id`, `scope` ['global'|'local'], `rule_type` ['invariant'|'forbidden_pattern'|'verification_gate'], `content`, `severity` ['blocker'|'warning']).
* **New MCP Tools**:
  * `get_guardrails`: Returns the merged set of active global and local constraints.
  * `check_guardrails`: Accepts an agent's proposed plan, command, or file diff and validates it against active policies before execution.
* **Pre-Flight Verification Gates**: Commands that an agent must execute and pass (e.g. `npm run lint`, `npm test`) before a task can transition to `COMPLETED`.

---

## 2. Context Provenance & Decision Traceability

### Problem
Current AI assistants remember *what* was decided, but lose *why* it was decided and *where* the requirement originated. Six months later, team members cannot trace why a critical architectural decision was made.

### Architectural Solution
Every architectural decision (ADR) and task in ContextOS will support structured **Provenance Metadata**:

```text
Decision: "Migrate Webhook Ingestion to HMAC-SHA256"
   │
   ├── [Jira Ticket]    PROJ-1048: Webhook Replay Vulnerability
   ├── [Slack Thread]   #architecture-security (link + summary)
   ├── [Design Doc]     RFC-042: Idempotent Event Delivery
   └── [GitHub PR]      https://github.com/org/repo/pull/312
```

### Technical Design
* **Schema Extension**:
  ```sql
  CREATE TABLE provenance_sources (
    id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL,         -- decision_id or task_id
    entity_type TEXT NOT NULL,       -- 'DECISION' | 'TASK'
    source_type TEXT NOT NULL,       -- 'JIRA' | 'SLACK' | 'RFC' | 'PR' | 'FIGMA' | 'DOC'
    url TEXT NOT NULL,
    label TEXT NOT NULL,
    metadata_json TEXT,
    created_at TEXT NOT NULL
  );
  ```
* **Impact**: Agents can explain the exact historical rationale and cite real links when questioned about codebase decisions.

---

## 3. Role-Tailored Context for Multi-Agent Pipelines

### Problem
Passing the exact same context dump to every agent is wasteful and noisy:
* A **Planner** needs high-level architecture, epics, constraints, and dependencies.
* An **Implementer** needs specific function signatures, failing unit tests, and target files.
* A **Reviewer** needs invariant compliance checklists, secret scan reports, and unified diffs.
* A **Debugger** needs error stack traces, recent git regressions, and local runtime state.

### Architectural Solution
Introduce structured **Agent Persona Views** into the ContextOS context compiler:

```text
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     PLANNER     │ ────▶ │   IMPLEMENTER   │ ────▶ │    REVIEWER     │ ────▶ │    DEBUGGER     │
│  Architecture,  │       │  Target files,  │       │   Invariants,   │       │   Stacktrace,   │
│   Constraints   │       │  Tests, Specs   │       │   Diff audit    │       │  Regressions    │
└─────────────────┘       └─────────────────┘       └─────────────────┘       └─────────────────┘
```

### Technical Design
* Extend `create_handoff` and `get_status` with `targetRole: 'planner' | 'implementer' | 'reviewer' | 'debugger'`.
* **Autonomous Handoff Verification Gates**:
  * Before handing off from Implementer to Reviewer, ContextOS verifies that git working tree changes exist and build/lint commands exit cleanly.
  * If verification fails, the handoff is rejected with actionable diagnostic errors.

---

## 4. Semantic & Code-Aware Context (Tree-Sitter AST Slicing)

### Problem
Raw `git diff` output includes syntax noise, import reshuffling, and boilerplate. When diffs exceed 500 lines, token costs spike and LLMs lose focus on the actual logic changes.

### Architectural Solution
Integrate **Tree-Sitter AST Parsers** directly into `packages/git` to extract semantic code slices rather than raw text diffs.

### Technical Design
* **AST Slicing Engine**:
  * Parse modified files before and after changes into ASTs.
  * Extract only:
    1. Modified function and method bodies.
    2. Changed type signatures, interfaces, and exported schemas.
    3. Call hierarchy: which functions call or are called by the changed code.
* **Token Savings**: Reduces code diff token payloads by **60% to 80%** while providing higher semantic density to LLMs.

---

## 5. Dual Memory Model: Working vs. Episodic Memory (SQLite FTS5)

### Problem
As projects mature, ContextOS accumulates hundreds of past tasks, completed items, and superseded decisions. Loading all of them slows down queries and bloats prompts. Conversely, completely deleting them destroys project memory.

### Architectural Solution
Partition ContextOS storage into a **Dual Memory Architecture**:

```text
┌────────────────────────────────────────────────────────┐
│                      ContextOS                         │
├───────────────────────────┬────────────────────────────┤
│      Working Memory       │      Episodic Memory       │
│  (Active SQLite Tables)   │    (SQLite FTS5 Index)     │
├───────────────────────────┼────────────────────────────┤
│ • Current active task     │ • Historical tasks         │
│ • Active checklist items  │ • Archived handoffs        │
│ • Active ADR invariants   │ • Resolved blockers        │
│ • Current git diffs       │ • Past commit summaries    │
│                           │ • Superseded decisions     │
└───────────────────────────┴────────────────────────────┘
```

### Technical Design
* **SQLite FTS5 Virtual Tables**:
  ```sql
  CREATE VIRTUAL TABLE episodic_knowledge_fts USING fts5(
    entity_id,
    entity_type,
    title,
    content,
    project_id,
    jira_id,
    tokenize = 'porter unicode61'
  );
  ```
* **New MCP Tool**: `search_knowledge`
  * Sub-millisecond keyword and BM25 search across all past projects, handoffs, and resolved blockers.
  * Example prompt: *"Search ContextOS: How did we handle webhook deduplication in the payments service last month?"*

---

## 6. Multi-Repository Workspaces (Cross-Repo Epics)

### Problem
Modern software features rarely touch a single repository. A single Jira ticket often spans:
* `frontend-web`
* `backend-api`
* `shared-types`
* `infra-terraform`

Currently, local databases are isolated to a single repo root.

### Architectural Solution
Support **Workspace Epics** that link multiple local repository databases under a shared global ticket identifier.

### Technical Design
* Global DB tracks the **Epic Hierarchy**:
  ```text
  Global Epic: PROJ-500 ("Add Passkey Authentication")
     ├── Repo: frontend-web     (Local Task: F-01: Add WebAuthn UI)
     ├── Repo: backend-api      (Local Task: B-01: FIDO2 Token Verification)
     └── Repo: shared-types     (Local Task: S-01: Passkey DTO Schemas)
  ```
* Each repository maintains its isolated local `.contextos/context.db` for private diffs and file paths, while syncing overarching milestone completion to the global Epic.

---

## 7. Deep Two-Way Issue Tracker Integration (Jira & Linear)

### Problem
Developers currently manually mirror ticket descriptions, acceptance criteria, and status updates between their issue tracker and ContextOS.

### Architectural Solution
Provide native, zero-cloud API synchronization with **Jira Cloud** and **Linear**:

### Technical Design
* Configured once via machine-local environment variables:
  `CONTEXTOS_JIRA_TOKEN`, `CONTEXTOS_LINEAR_API_KEY`.
* Capabilities:
  1. **Pull on Init**: `contextos task create --jira PROJ-100` auto-populates task title, description, constraints, and checklist from acceptance criteria.
  2. **Push on Completion**: When `save_context({ status: 'COMPLETED' })` is called, ContextOS can optionally add a clean handoff summary comment to the Jira ticket and advance the workflow state.

---

## 8. Performance & Infrastructure Optimizations

| Optimization | Current State | Target State | Impact |
| :--- | :--- | :--- | :--- |
| **Tool Response Latency** | ~120ms (Node.js boot per CLI run) | **< 5ms** via persistent Unix Domain Socket daemon (`contextos daemon`) | Instantaneous MCP tool roundtrips. |
| **Secret Sanitization** | Basic regex scanner | **High-entropy Shannon entropy scanner** detecting AWS, Stripe, JWT, and private keys | Zero risk of leaking secrets into agent prompts. |
| **Token Budgeting** | Static ~4,000 token handoff ceiling | **Adaptive context budget** tailored to target LLM (Claude 200k vs GPT-4o 128k vs local 8k) | Optimal context-to-cost ratio. |
| **Stale Task Archival** | Manual cleanup | **Automated background TTL**: Tasks inactive for >14 days auto-archive to Episodic Memory | Keeps active status dashboards uncluttered. |

---

## 🗺️ Implementation Phasing & Milestones

### Phase 1: Near-Term (Foundations & Intelligence)
- [ ] Implement `guardrails` schema and inheritance in `packages/storage`.
- [ ] Add `check_guardrails` and `get_guardrails` tools to `packages/mcp`.
- [ ] Implement SQLite `fts5` full-text search and `search_knowledge` tool.
- [ ] Automated high-entropy secret redaction in `packages/git`.

### Phase 2: Mid-Term (Semantic Code & Provenance)
- [ ] Integrate Tree-Sitter AST parser for semantic code diff slicing in `packages/git`.
- [ ] Implement `provenance_sources` schema and link decisions to external URLs.
- [ ] Implement adaptive token budgeting based on target model context windows.

### Phase 3: Advanced (Workspaces & Roles)
- [ ] Role-specific handoff views (`planner`, `implementer`, `reviewer`, `debugger`).
- [ ] Multi-repository Workspace Epic tracking across distinct repositories.
- [ ] Pre-handoff verification gates (automated test & lint checks).

### Phase 4: Integrations & Daemon (Enterprise Scale)
- [ ] Two-way Jira and Linear API synchronization.
- [ ] Optional background Unix Domain Socket daemon for sub-5ms latency.
- [ ] Webhook / CI/CD pipeline verification runner.

---

## 💡 The Guiding North Star

> **ContextOS ensures that AI coding agents never operate with amnesia, never violate established architecture, and never waste developer time or token budgets re-learning what the team already solved.**
