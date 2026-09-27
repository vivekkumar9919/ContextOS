# ContextOS: Complete End-to-End Setup & User Guide

> **A local-first, zero-cloud context and handoff layer for AI coding agents (Claude ➔ ContextOS ➔ Codex ➔ Claude).**  
> Zero cloud servers. Zero Redis/Postgres. Zero mandatory LLM API fees. Deterministic, token-budgeted Markdown handoffs.

---

## Table of Contents
1. [Overview & Architecture](#1-overview--architecture)
2. [Prerequisites & Quick Setup](#2-prerequisites--quick-setup)
3. [CLI Reference: All Commands & Options](#3-cli-reference-all-commands--options)
   - [`contextos init`](#31-contextos-init)
   - [`contextos status`](#32-contextos-status)
   - [`contextos task`](#33-contextos-task)
   - [`contextos decision`](#34-contextos-decision)
   - [`contextos handoff`](#35-contextos-handoff)
   - [`contextos clean`](#36-contextos-clean)
4. [Model Context Protocol (MCP) Server Guide](#4-model-context-protocol-mcp-server-guide)
   - [Configuring in AI Coding Agents](#41-configuring-in-ai-coding-agents)
   - [Tool Reference: When to Use & Descriptions](#42-tool-reference-when-to-use--descriptions)
5. [End-to-End Multi-Agent Handoff Workflow Walkthrough](#5-end-to-end-multi-agent-handoff-workflow-walkthrough)
6. [Security, Secret Redaction & Noise Filtering](#6-security-secret-redaction--noise-filtering)
7. [Storage Layout & Concurrency Invariants](#7-storage-layout--concurrency-invariants)
8. [Troubleshooting & FAQs](#8-troubleshooting--faqs)

---

## 1. Overview & Architecture

ContextOS solves the **"Lost in Translation"** problem when switching between AI coding agents (e.g., planning architectural changes in Claude and implementing code in Cursor or Codex). 

Without ContextOS, the human developer must manually summarize decisions, copy/paste file diffs, re-explain constraints, and remind the downstream model not to break earlier assumptions.

ContextOS replaces this with a structured local layer:
- **`@contextos/core`**: Zod domain models for Tasks, Decisions (DAG supersession), Issues, and Handoffs.
- **`@contextos/storage`**: Embedded SQLite singleton with Write-Ahead Logging (`WAL`), foreign keys, and zero-config migrations.
- **`@contextos/git`**: High-speed Git client with noise exclusion (lockfiles, bundles) and regex secret screening.
- **`@contextos/context-builder`**: 4-Tier token budget ladder (Tier 0 mandatory to Tier 3 enrichers, 4,000-token target) compiling deterministic Markdown.
- **`apps/cli` (`contextos`)**: Zero-dependency, sub-5ms terminal tool with OS clipboard integration (`pbcopy`, `xclip`, `wl-copy`, `clip`).
- **`@contextos/mcp` (`contextos-mcp`)**: Native Model Context Protocol server over `stdio` adhering to specification `2024-11-05`.

```
┌─────────────────────────────────────────────────────────────┐
│                       Developer / IDE                       │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
               ▼                               ▼
       Interactive CLI                    MCP Server
     $ contextos <cmd>                (Claude / Cursor)
               │                               │
               └───────────────┬───────────────┘
                               │
                               ▼
                    ContextOS Unified Engine
     ┌──────────────────────────────────────────────────┐
     │ • @contextos/storage (SQLite WAL Database)       │
     │ • @contextos/git (Diff noise filter & secrets)   │
     │ • @contextos/context-builder (4-tier ladder)     │
     └─────────────────────────┬────────────────────────┘
                               │
                               ▼
                  .contextos/handoffs/latest.md
                   (Auto-copied to OS Clipboard)
```

---

## 2. Prerequisites & Quick Setup

### System Requirements
- **Node.js**: `v20.0.0` or higher (`node -v`)
- **Git**: `2.30+` installed and configured on your system
- **Operating System**: macOS, Linux, or Windows (WSL/cmd/PowerShell)

### Installation & Build

1. **Clone the repository:**
   ```bash
   git clone https://github.com/vivekkumar9919/ContextOS.git
   cd ContextOS
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build all packages and binaries:**
   ```bash
   npm run build
   ```

4. **Verify the entire test suite (50/50 tests passing):**
   ```bash
   npm test
   ```

5. **Link the `contextos` CLI globally (Optional):**
   ```bash
   npm link --workspace=contextos
   ```
   *Now `contextos` is directly callable from anywhere in your terminal.*
   *(Alternatively, run via `node apps/cli/dist/index.js` or `npx contextos`).*

---

## 3. CLI Reference: All Commands & Options

ContextOS provides developer-friendly terminal commands with sub-5ms execution latency and automatic clipboard integration.

```bash
$ contextos --help
```

---

### 3.1 `contextos init`
**Description:** Initializes ContextOS storage for the current workspace or switches storage modes.
- Creates SQLite database and applies schema migrations automatically.
- Automatically appends `.contextos/` to your `.gitignore` to prevent database and handoff files from ever entering Git.
- Registers the current project in the `projects` table.

```bash
# Global mode: uses ~/.contextos/context.db (Default)
contextos init

# Explicitly switch current project to Global mode:
contextos init --global

# Local workspace mode: creates .contextos/ inside current repo
contextos init --local
```

| Flag | Type | Description |
| :--- | :--- | :--- |
| `--local` | boolean | Stores database inside `.contextos/` in the current project root instead of `~/.contextos/`. |
| `--global` | boolean | Switches the project to use the central `~/.contextos/context.db` storage and cleans up any local workspace database. |

#### Switching Between Modes Anytime:
- **Switch from Local ➔ Global:** Run `contextos init --global` (or `contextos clean --all`). The workspace immediately connects to `~/.contextos/context.db`.
- **Switch from Global ➔ Local:** Run `contextos init --local`. Creates a standalone `.contextos/context.db` isolated to this repository.

---

### 3.2 `contextos status`
**Description:** Displays a consolidated status dashboard showing active project info, active storage mode, Git branch, dirty files, active task progress, checklist status, and architectural decisions.

```bash
contextos status
```

**Example Output:**
```text
  ____            _            _    ___  ____  
 / ___|___  _ __ | |_ _____  _| |_ / _ \/ ___| 
| |   / _ \| '_ \| __/ _ \ \/ / __| | | \___ \ 
| |__| (_) | | | | ||  __/>  <| |_| |_| |___) |
 \____\___/|_| |_|\__\___/_/\_\\__|\___/|____/ 
  Deterministic Context & Handoff Layer for AI Agents

--- Project Overview ---
  Project: ContextOS
  Mode:    Local workspace (.contextos/)
  Root:    /Users/developer/ContextOS
  DB:      /Users/developer/ContextOS/.contextos/context.db

--- Git Working Tree ---
  Branch:  master
  HEAD:    a1b2c3d ("Initial commit")
  Dirty:   Yes
  Modified: src/payment/webhook.ts

--- Active Task ---
  Title:   Refactor Payment Gateway
  Status:  IN_PROGRESS
  Goal:    Migrate polling to idempotent webhook events
  Invariants/Constraints:
    - Idempotency key header (X-Idempotency-Key) must be verified
  Completed:
    ✔ Implement signature verification
  Remaining:
    ○ Add idempotent event deduplication

--- Active Architectural Decisions ---
  • Use HMAC-SHA256 for Stripe Webhook Signature Verification: Prevents replay attacks
```

---

### 3.3 `contextos task`
**Description:** Manages the active task lifecycle, architectural invariants, checklists, and blockers.

#### Subcommands

#### 1. `contextos task create`
Creates a new active task in `IN_PROGRESS` status (with optional Jira ticket ID).
```bash
contextos task create \
  --title "Payment Gateway Refactor" \
  --goal "Migrate polling to idempotent webhook events" \
  --jira "PROJ-123" \
  --constraints "Must use HMAC-SHA256,No raw card data logged" \
  --remaining "Verify signature,Deduplicate events,Add unit tests"
```
| Option | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `--title` | string | Short title of the task | **Yes** |
| `--goal` | string | Clear goal description | **Yes** |
| `--jira` / `--ticket` | string | Optional Jira ticket ID (e.g. `PROJ-123`) | No |
| `--constraints` | string | Comma-separated list of invariants/constraints | No |
| `--remaining` | string | Comma-separated list of initial checklist items | No |

#### 2. `contextos task update`
Updates metadata, status, or blockers on a task.
```bash
# Associate or update Jira ticket
contextos task update --jira "PROJ-123"

# Update blocker
contextos task update --blocker "Stripe test signing key not configured"

# Clear blocker
contextos task update --clear-blocker

# Transition status
contextos task update --status "BLOCKED"
```
| Option | Type | Description |
| :--- | :--- | :--- |
| `--id` | string | Target task ID (defaults to active task) |
| `--jira` | string | Target or update Jira ticket ID (e.g. `PROJ-123`) |
| `--title` | string | Update task title |
| `--goal` | string | Update task goal |
| `--status` | string | `BACKLOG`, `IN_PROGRESS`, `BLOCKED`, or `COMPLETED` |
| `--blocker` | string | Set an active blocker description |
| `--clear-blocker`| boolean | Remove active blocker |

#### 3. `contextos task get`
**Retrieves the complete context, checklist, invariants, and decisions for a specific Jira ticket or task ID.**
```bash
# Get context by Jira Ticket ID:
contextos task get --jira PROJ-123

# Get context by Task UUID:
contextos task get --id 9fdb6e08-305c-4fc4-a668-32c7a38d498b
```

#### 4. `contextos task complete`
Checks off an individual checklist item or marks the entire task as `COMPLETED`.
```bash
# Complete a specific checklist item
contextos task complete --item "Verify signature"

# Complete the entire task
contextos task complete
```
| Option | Type | Description |
| :--- | :--- | :--- |
| `--item` | string | Moves this item from remaining items to completed items |
| `--jira` | string | Target task by Jira ticket ID |
| `--id` | string | Target task ID (defaults to active task) |

#### 5. `contextos task clear`
Clears any blocker recorded on the active task.
```bash
contextos task clear
```

#### 6. `contextos task list`
Lists all recorded tasks for the active project, showing their status and Jira ticket tags.
```bash
contextos task list
```

---

### 3.4 `contextos decision`
**Description:** Manages architectural decisions and enforces the DAG cycle detection invariant when superseding.

#### Subcommands

#### 1. `contextos decision add`
Records an architectural invariant or decision.
```bash
contextos decision add \
  --title "Use HMAC-SHA256 Signatures" \
  --rationale "Prevents webhook payload tampering and replay attacks" \
  --files "src/payment/webhook.ts,src/payment/verifier.ts"
```
| Option | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `--title` | string | Decision headline | **Yes** |
| `--rationale` | string | Technical justification | **Yes** |
| `--files` | string | Comma-separated list of related source files | No |

#### 2. `contextos decision supersede`
Atomically marks an older decision as `SUPERSEDED` and points to the new decision while checking the Directed Acyclic Graph (DAG) for cycles.
```bash
contextos decision supersede --old "<OLD_DECISION_ID>" --new "<NEW_DECISION_ID>"
```
| Option | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `--old` | string | ID of the legacy decision | **Yes** |
| `--new` | string | ID of the newer superseding decision | **Yes** |

#### 3. `contextos decision list`
Lists all active and superseded architectural decisions.
```bash
contextos decision list
```

---

### 3.5 `contextos handoff`
**Description:** Triggers the Context Builder engine, compiles `.contextos/handoffs/latest.md` using the 4-tier token budget ladder, creates a timestamped archive, and automatically copies the Markdown payload to your system clipboard.

```bash
# Standard handoff: Claude (Planner) ➔ Codex (Implementer)
contextos handoff --from claude --to codex --phase implementation

# Compile handoff for a specific Jira ticket:
contextos handoff --jira PROJ-123 --from antigravity --to codex

# Return handoff for code review: Codex ➔ Claude
contextos handoff --from codex --to claude --phase review

# Generate without copying to clipboard
contextos handoff --no-copy
```

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `--jira` | string | `undefined` | Optional Jira ticket ID (e.g. `PROJ-123`) to compile handoff for |
| `--from` | string | `developer` | Name of the upstream agent creating handoff |
| `--to` | string | `assistant` | Name of the downstream agent receiving handoff |
| `--phase` | string | `implementation`| `planning`, `implementation`, or `review` |
| `--no-copy` | boolean | `false` | Skips copying to system clipboard |

---

### 3.6 `contextos clean`
**Description:** Safely wipes ContextOS data.

```bash
# Wipes current project and its tasks/decisions without affecting other projects
contextos clean --project

# Deletes the local .contextos workspace folder
contextos clean --all
```

---

## 4. Model Context Protocol (MCP) Server Guide

ContextOS includes a built-in MCP server (`packages/mcp/dist/index.js`) communicating over `stdio` adhering to MCP specification `2024-11-05`.

Autonomous coding agents (Claude Code, Cursor, Codex, Windsurf, Claude Desktop) can invoke ContextOS tools directly without human intervention.

### 4.1 Configuring in AI Coding Agents

#### Claude Desktop Configuration
Add ContextOS to your `claude_desktop_config.json`:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "contextos": {
      "command": "node",
      "args": ["/Users/YOUR_USER/Documents/projects/ContextOS/packages/mcp/dist/index.js"]
    }
  }
}
```

#### Cursor IDE Configuration
In Cursor settings:
1. Navigate to **Features ➔ MCP**.
2. Click **+ Add New MCP Server**.
3. Name: `contextos`
4. Type: `command`
5. Command: `node /ABSOLUTE_PATH/ContextOS/packages/mcp/dist/index.js`

---

### 4.2 Tool Reference: When to Use & Descriptions

ContextOS exposes **5 standard tools** over JSON-RPC:

| Tool Name | When to Use | Description |
| :--- | :--- | :--- |
| **`get_current_task`** | At session start | Agent reads active task goal, invariants, blockers, and completed checklist items. |
| **`save_context`** | After completing work | Agent marks checklist items as completed, logs next remaining steps, or registers blockers. |
| **`record_decision`** | Making architectural choices | Agent locks in architectural patterns, library selections, or supersedes older decisions. |
| **`create_handoff`** | Session completion | Compiles bounded `latest.md` and timestamped archive for downstream handoff. |
| **`get_git_context`** | Before editing code | Retrieves Git branch, modified files, and noise-filtered, secret-scanned diffs. |

---

#### Tool 1: `get_current_task`
- **When to Use**: Call immediately upon waking up to understand the active goal, critical constraints, or to fetch a specific Jira ticket's context.
- **Input Parameters**:
  ```json
  {
    "projectId": "string (optional: defaults to active project)",
    "jiraId": "string (optional: e.g. PROJ-123 to fetch context for a specific Jira ticket)"
  }
  ```
- **Example Response**:
  ```json
  {
    "id": "81ea9a71-a99d-4c14-a3a9-83ab9ce4b83a",
    "jiraId": "PROJ-123",
    "title": "Refactor Payment Gateway to Webhooks",
    "goal": "Migrate from polling payment status to idempotent webhook event ingestion",
    "status": "IN_PROGRESS",
    "constraints": [
      "Idempotency key header (X-Idempotency-Key) must be verified on all incoming webhook requests",
      "Raw credit card numbers and CVVs must never be logged or persisted in database records"
    ],
    "completedItems": [
      "Setup Stripe developer webhook endpoint"
    ],
    "remainingItems": [
      "Implement webhook endpoint with HMAC-SHA256 signature verification in src/payment/webhook.ts",
      "Add idempotent event deduplication in src/payment/deduplicator.ts"
    ],
    "blocker": null
  }
  ```

---

#### Tool 2: `save_context`
- **When to Use**: Call after modifying code or completing steps to record progress, note new constraints, associate Jira tickets, or update blockers.
- **Input Parameters**:
  ```json
  {
    "taskId": "string (optional)",
    "jiraId": "string (optional: e.g. PROJ-123 to associate with this task)",
    "title": "string (optional)",
    "goal": "string (optional)",
    "status": "IN_PROGRESS | BLOCKED | COMPLETED | BACKLOG",
    "newConstraints": ["array of strings"],
    "completedItems": ["array of strings to check off"],
    "remainingItems": ["array of strings for pending steps"],
    "blocker": "string or null to clear"
  }
  ```
- **Example Call**:
  ```json
  {
    "completedItems": ["Implement webhook endpoint with HMAC-SHA256 signature verification"],
    "remainingItems": ["Add idempotent event deduplication in src/payment/deduplicator.ts"],
    "status": "IN_PROGRESS"
  }
  ```

---

#### Tool 3: `record_decision`
- **When to Use**: Call when an architectural or structural decision is made that future agents must not undo.
- **Input Parameters**:
  ```json
  {
    "title": "string (required: Decision headline)",
    "rationale": "string (required: Technical justification)",
    "relatedFiles": ["array of relative file paths"],
    "supersedesDecisionId": "string (optional: ID of legacy decision being superseded)"
  }
  ```
- **Cycle Prevention Guarantee**: If `supersedesDecisionId` would create a circular reference in the decision DAG (e.g., A ➔ B ➔ A), an error is returned and the database remains unaltered.

---

#### Tool 4: `create_handoff`
- **When to Use**: Call at the end of a session before handing off execution to another agent.
- **Input Parameters**:
  ```json
  {
    "fromAgent": "string (required: e.g. claude)",
    "toAgent": "string (required: e.g. codex)",
    "targetPhase": "planning | implementation | review",
    "taskId": "string (optional)",
    "jiraId": "string (optional: e.g. PROJ-123)"
  }
  ```
- **Example Response**:
  ```json
  {
    "handoffPath": "/Users/developer/ContextOS/.contextos/handoffs/latest.md",
    "archivePath": "/Users/developer/ContextOS/.contextos/handoffs/archive/2026-09-27T11-30-00_claude_to_codex.md",
    "tokenCountEstimate": 482,
    "markdown": "# ContextOS Handoff: claude ➔ codex\n..."
  }
  ```

---

#### Tool 5: `get_git_context`
- **When to Use**: Call when the agent needs to inspect what files are modified or needs a diff without reading entire lockfiles.
- **Input Parameters**:
  ```json
  {
    "maxLines": 1000
  }
  ```
- **Example Response**:
  ```json
  {
    "branch": "master",
    "status": {
      "isDirty": true,
      "modified": ["src/payment/webhook.ts"],
      "added": ["src/payment/deduplicator.ts"],
      "deleted": []
    },
    "hasSecretsDetected": false,
    "secretFindings": [],
    "totalDiffLines": 42,
    "diffs": [ ... ]
  }
  ```

---

## 5. End-to-End Multi-Agent Handoff Workflow Walkthrough

Here is the exact real-world workflow between **Claude** (Architecture & Planning) and **Codex / Cursor** (Code Implementation):

### Step 1: Architectural Planning with Claude
1. Developer starts a feature session in Claude.
2. Claude uses MCP tool `save_context`:
   - Title: `Refactor Payment Gateway to Webhooks`
   - Goal: `Migrate from polling payment status to idempotent webhook event ingestion`
   - Invariants: `Must verify X-Idempotency-Key`, `Never log raw CVVs`
3. Claude uses MCP tool `record_decision`:
   - Title: `Use HMAC-SHA256 for Stripe Webhook Signature Verification`
   - Rationale: `Prevents replay attacks and verifies payload authenticity`

### Step 2: Handoff Generation
1. Developer runs in their terminal:
   ```bash
   contextos handoff --from claude --to codex --phase implementation
   ```
2. **ContextOS executes in < 10ms**:
   - Compiles `.contextos/handoffs/latest.md`.
   - Saves timestamped snapshot in `.contextos/handoffs/archive/`.
   - **Populates your OS clipboard automatically (`pbcopy` / `xclip`).**

### Step 3: Implementation with Codex / Cursor
1. Developer opens Codex or Cursor.
2. Developer presses `Cmd + V` (paste) or types:
   ```text
   Implement the next step based on @.contextos/handoffs/latest.md
   ```
3. Codex reads the Markdown document and immediately sees:
   - **Section 2 (MUST PRESERVE)**: Do not log CVVs and verify `X-Idempotency-Key`.
   - **Section 4 (CURRENT ITEM)**: Implement webhook endpoint with HMAC-SHA256.
4. Codex writes code conforming to constraints.

### Step 4: Return Handoff & Code Review
1. Developer runs return handoff:
   ```bash
   contextos handoff --from codex --to claude --phase review
   ```
2. Developer pastes back into Claude:
   ```text
   Review my implementation against our original invariants.
   ```
3. Claude reviews the unified Git diff and audits against the original Section 2 invariants.

---

## 6. Security, Secret Redaction & Noise Filtering

### Automatic Noise Exclusion
ContextOS automatically excludes high-noise files from Git diffs:
- **Lockfiles**: `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `Cargo.lock`, `poetry.lock`, `Gemfile.lock`.
- **Directories**: `node_modules/`, `dist/`, `build/`, `.next/`, `out/`, `target/`, `.contextos/`, `.git/`.
- **Minified & Binary**: `*.min.js`, `*.map`, `*.png`, `*.jpg`, `*.svg`, `*.wasm`, `*.zip`, `*.db`.

### Secret Scanner Regex Engine
Every line of code and Git diff passes through the entropy scanner:

| Secret Type | Pattern | Replacement |
| :--- | :--- | :--- |
| **OpenAI API Key** | `sk-[a-zA-Z0-9_\-]{20,}` | `[REDACTED SECRET DETECTED]` |
| **GitHub Token** | `(ghp\|gho\|ghu\|ghs\|ghr)_[A-Za-z0-9_]{36,}` | `[REDACTED SECRET DETECTED]` |
| **AWS Access Key** | `(A3T\|AKIA\|AGPA\|AROA\|AIPA\|ANPA\|ANVA\|ASIA)[A-Z0-9]{16}` | `[REDACTED SECRET DETECTED]` |
| **Private Keys** | `-----BEGIN (RSA\|EC)? PRIVATE KEY-----[\s\S]*?-----END ...-----` | `[REDACTED SECRET DETECTED: Private Key]` |
| **Generic Secrets** | `(api_key\|secret\|token\|password)\s*[:=]\s*['"][a-zA-Z0-9_\-]{16,}['"]` | `[REDACTED SECRET DETECTED]` |

---

## 7. Storage Layout & Concurrency Invariants

### File System Layout
```text
~/.contextos/                   # Global Storage (Default)
  └── context.db                # SQLite database with WAL mode
  └── context.db-wal            # WAL journal
  └── context.db-shm            # Shared memory index

workspace/                      # Your Project Repository
  ├── .contextos/               # Workspace Handoffs (Auto-ignored by Git)
  │     ├── handoffs/
  │     │     ├── latest.md     # Active handoff document
  │     │     └── archive/      # Timestamped immutable snapshots
  │     └── context.db          # (Only present if initialized with --local)
  └── ...
```

### Concurrency Invariant: Zero Database Locks
- Embedded SQLite is initialized with `PRAGMA journal_mode = WAL`.
- Readers never block writers, and writers never block readers.
- `PRAGMA busy_timeout = 5000` ensures that simultaneous operations across interactive CLI and background MCP server wait gracefully for sub-millisecond writes to complete.
- Stress-tested and verified with **30 concurrent operations** without a single `SQLITE_BUSY` error.

---

## 8. Troubleshooting & FAQs

### Q: Why do files in VS Code occasionally appear blank?
**Answer:** In VS Code, when an editor tab is opened before a file is written to disk or during an atomic write, VS Code caches an empty buffer in memory. If auto-save (`afterDelay`) is on, it may save 0 bytes.  
**Fix:** In VS Code, press `Cmd + Shift + P` ➔ **`File: Revert File`**, or close and reopen the tab. All files are safely preserved in Git index and `scratch/populate.js`.

### Q: Can I run ContextOS in an air-gapped / offline environment?
**Answer:** Yes. ContextOS makes **zero outbound network requests**, requires **zero cloud credentials**, and uses **zero external API calls**.

### Q: How do I verify my installation is working properly?
**Answer:** Run `npm test` from the repository root:
```bash
npm test
```
All **50 tests** across 7 test suites should report green (`✓ passed`).

### Q: How do I check or switch between Local and Global storage modes?
**Answer:**
- **Check current mode:** Run `contextos status`. The `--- Project Overview ---` header displays `Mode: Local workspace (.contextos/)` or `Mode: Global system (~/.contextos/)`.
- **Switch to Global mode:** Run `contextos init --global` (or `contextos clean --all`). The local database is removed and ContextOS points to `~/.contextos/context.db`.
- **Switch to Local mode:** Run `contextos init --local`. Creates a standalone `.contextos/context.db` inside your current repository.
