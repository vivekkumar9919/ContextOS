# ContextOS: Product Requirements Document (PRD)

| Metadata | Details |
| :--- | :--- |
| **Project Name** | **ContextOS** |
| **Document Type** | Product Requirements Document (PRD) |
| **Version** | `1.0.0-MVP` |
| **Status** | Approved for MVP Implementation |
| **Target Milestone** | Local-First Developer Handoff Engine (Claude ➔ Codex) |

---

## 1. Executive Summary

**ContextOS** is an open-source, local-first **context and handoff layer for AI coding agents**.

Modern software engineering with AI is increasingly multi-agent: developers leverage distinct frontier models for different stages of the development cycle (e.g., Claude for planning and system architecture, Codex/GPT for code generation and testing, Claude for code review, Gemini for documentation). 

Today, moving between these tools requires tedious, lossy, manual explanation—copying raw chat snippets, repeating architectural invariants, summarizing touched files, and debugging context drift.

ContextOS eliminates this handoff friction. It maintains a **deterministic, model-independent representation of active software tasks, decisions, code changes, and blockers**, and packages that state into compact, high-density briefings for downstream agents.

---

## 2. Core Philosophy & Product Positioning

### 2.1 Core Principle
> **"The context belongs to the developer and the project, not to a particular AI provider."**

ContextOS does **not** compete with or replace Claude, Codex, Cursor, Copilot, or ChatGPT. It operates alongside them as an infrastructure layer.

### 2.2 What It Is NOT ("Not AI Memory")
ContextOS is **explicitly not marketed or built as an "AI Memory" chatbot**.
- **Chatbot Memory** typically stores sprawling conversational transcripts full of greetings, polite replies, and dead-end brainstorming.
- **ContextOS** maintains a **structured project state** (Active Tasks, Checklists, Architectural Decisions, Git Diffs, Known Issues).

```
┌────────────────────────────────────────────────────────┐
│                      ContextOS                         │
│   A Local Context Layer for AI Coding Agents           │
└────────────────────────────────────────────────────────┘
  • Deterministic State Layer, NOT conversational memory
  • Model-agnostic & provider-independent
  • Local-first & zero-cloud dependency
  • Token-budgeted & noise-filtered
```

---

## 3. Problem Statement & User Personas

### 3.1 The Problem
When a developer switches between AI tools during a single task:
1. **Context Fragmentation**: Architectural decisions made in Claude are lost when moving to Codex.
2. **Context Poisoning / Bloat**: Copying full conversation histories exhausts context windows and injects outdated ideas or hallucinations.
3. **Manual Cognitive Load**: Developers waste time manually composing context prompts ("Here is the task, here is what we did, here is the error, do not modify this interface...").
4. **Invariant Regression**: Implementing agents inadvertently violate constraints established during the architectural phase.

### 3.2 Target Persona
* **The Multi-Agent Developer**: Engineers using Claude Code/Claude chat for reasoning and architecture, alongside Cursor/Codex/Copilot for inline code writing.
* **Privacy-Conscious Software Teams**: Developers working in environments that prohibit third-party cloud memory, centralized context aggregation, or telemetry.

---

## 4. MVP Scope & The Core Workflow

The MVP focuses on mastering one critical workflow loop:

```text
Claude (Planner)
      ↓ 1. Analyzes task, defines decisions & constraints
  ContextOS
      ↓ 2. Compiles compact handoff document (.contextos/handoffs/latest.md)
Codex (Implementer)
      ↓ 3. Consumes handoff, writes code, executes tests, reports issues
  ContextOS
      ↓ 4. Saves state & git diff
Claude (Reviewer)
      ↓ 5. Audits implementation against original invariants
```

### 4.1 Primary Use Case: Claude Code ➔ ContextOS ➔ Codex
1. **Planning with Claude**: Developer asks Claude to design a feature or plan a bug fix. Claude records decisions and task items into ContextOS.
2. **Handoff Generation**: Developer triggers `ContextOS: Create Handoff` (via VS Code, CLI, or MCP). ContextOS compiles active decisions, current task status, and relevant git changes into `.contextos/handoffs/latest.md`.
3. **Execution with Codex**: Developer passes `@.contextos/handoffs/latest.md` to Codex (or Codex queries MCP). Codex implements the task conforming strictly to the stated constraints.
4. **State Update & Review**: Codex updates task progress. Claude reviews the resulting code against the original architectural invariants.

---

## 5. Functional Requirements (FR)

### FR-1: Task & State Tracking
* **FR-1.1**: The system must track active software tasks with fields: `Title`, `Goal`, `Status` (`BACKLOG`, `IN_PROGRESS`, `BLOCKED`, `COMPLETED`), `Constraints`, `Completed Items`, `Remaining Items`, and `Current Blocker`.
* **FR-1.2**: Exactly one task can be flagged as `ACTIVE` per workspace at any given time.
* **FR-1.3**: Checklist items must transition deterministically between remaining and completed.

### FR-2: Architectural Decisions & Invariant Management
* **FR-2.1**: The system must record decisions with `Title`, `Rationale`, `Related Files`, and `Status` (`ACTIVE`, `SUPERSEDED`, `DEPRECATED`).
* **FR-2.2 (Decision Supersession)**: When an architectural pivot occurs, the system must allow a new decision to supersede an existing one (`superseded_by_id`). Superseded decisions must be excluded from active handoff briefings while retaining historical auditability.

### FR-3: Git State Awareness & Diff Filtering
* **FR-3.1**: ContextOS must inspect local Git state: active branch, HEAD commit hash, uncommitted file statuses (modified, added, deleted).
* **FR-3.2 (Noise Exclusion)**: ContextOS must automatically exclude lockfiles (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `Cargo.lock`), minified bundles, build outputs (`dist/`, `.next/`), and generated assets from Git diffs.
* **FR-3.3 (Diff Budgeting)**: File diffs exceeding configurable thresholds (default: 250 lines) must be truncated to statistical summaries (`+X lines, -Y lines`) to avoid blowing agent context limits.

### FR-4: Context Builder & Handoff Engine
* **FR-4.1**: ContextOS must assemble a structured, human-readable Markdown handoff document.
* **FR-4.2**: The generated handoff must be written to `.contextos/handoffs/latest.md` and archived under timestamped snapshots (e.g., `2026-09-26_1430_claude-to-codex.md`).
* **FR-4.3**: Handoff creation must support token-budgeted section prioritization:
  - *Tier 0 (Mandatory)*: Task goal, status, constraints, blocker, recommended next action.
  - *Tier 1 (High)*: Active decisions, open blockers, git status summary.
  - *Tier 2 (Medium)*: Filtered git diff of primary source files.
  - *Tier 3 (Low)*: Recent commit logs, general observations.

### FR-5: Model Context Protocol (MCP) Interface
* **FR-5.1**: Provide a local MCP server that any MCP-compliant agent (Claude Code, Cursor, Codex client) can invoke over standard I/O (stdio).
* **FR-5.2**: Provide standard tool endpoints: `get_project_context`, `get_current_task`, `get_recent_decisions`, `get_open_issues`, `get_git_context`, `save_context`, and `create_handoff`.

### FR-6: Developer Experience & Interfaces
* **FR-6.1 (VS Code Extension)**:
  - Command Palette integration: `ContextOS: Initialize`, `ContextOS: Save Context`, `ContextOS: Create Handoff`, `ContextOS: Load Handoff`, `ContextOS: View Current Task`.
  - Non-intrusive status bar indicator showing active task status.
  - Copy-to-clipboard shortcut for latest handoff markdown.
* **FR-6.2 (CLI Interface)**:
  - Standalone terminal commands: `contextos init`, `contextos save`, `contextos handoff`, `contextos status`.

### FR-7: Security & Secret Protection
* **FR-7.1**: Automatic blocklist preventing sensitive files (`.env*`, `*credentials*`, `*id_rsa*`, `*.pem`, `*.key`) from ever being read, summarized, or embedded in handoff documents.
* **FR-7.2**: High-entropy secret scanning (detecting API keys, bearer tokens) on all diffs before compilation.
* **FR-7.3**: `.contextos/` directory added to `.gitignore` automatically upon initialization.

---

## 6. Non-Functional Requirements (NFR)

| ID | Category | Requirement |
| :--- | :--- | :--- |
| **NFR-1** | **Local-First** | 100% of data and compute must execute locally. Zero outbound network calls, zero mandatory cloud accounts, zero centralized telemetry. |
| **NFR-2** | **Zero Infrastructure** | No database servers (no Redis, no PostgreSQL, no Docker daemon). Uses embedded SQLite with WAL mode. |
| **NFR-3** | **Zero Mandatory LLM Cost** | The core context layer and handoff generator must function completely without calling an LLM API. Handoff generation is deterministic. |
| **NFR-4** | **Latency & Performance** | Handoff generation and SQLite queries must execute in < 250ms for repos under 100,000 files. |
| **NFR-5** | **Storage Footprint** | SQLite database file and metadata should remain lightweight (< 25MB for typical multi-month projects). |
| **NFR-6** | **Model Neutrality** | Output artifacts must be formatted in plain GitHub Flavored Markdown and standard JSON, consumable by any current or future LLM. |

---

## 7. Out of Scope (Explicitly NOT in MVP)

To maintain focus and rapid delivery, the following are strictly excluded from v1:
- ❌ Vector databases, embeddings, and semantic similarity engines.
- ❌ Autonomous multi-agent orchestration (agents triggering other agents autonomously).
- ❌ Web scraping or browser automation of AI web chats.
- ❌ Cloud synchronization or team collaboration backends.
- ❌ Custom LLM API gateway / proxy features.
- ❌ Automated model benchmarking or quality scoring.

---

## 8. Success Criteria & Verification

The MVP will be deemed successful when the following scenario executes flawlessly:

1. **Setup**: Developer runs `contextos init` in a repository.
2. **Session 1 (Claude)**: Claude plans an authentication refactor, calls `save_context()` to register 3 tasks, 2 invariants, and 1 architectural decision.
3. **Handoff Generation**: Developer executes `ContextOS: Create Handoff`. A clean 250-token Markdown file is produced at `.contextos/handoffs/latest.md`.
4. **Session 2 (Codex)**: Developer references `@.contextos/handoffs/latest.md` in Codex. Codex writes code and tests conforming strictly to the constraints without the developer typing any explanatory prompt.
5. **Session 3 (Claude Review)**: Developer generates a return handoff. Claude reviews the code diff specifically checking against the invariants established in Session 1.
