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
   - [The Fundamental Rule: Terminal CLI vs. AI Agent Chat](#41-the-fundamental-rule-terminal-cli-vs-ai-agent-chat)
   - [Cross-Database Lookup (Zero Repo Pollution)](#42-cross-database-lookup-zero-repo-pollution)
   - [Configuring Across AI IDEs & Clients](#43-configuring-across-ai-ides--clients)
   - [Tool Reference: When to Use & Descriptions](#44-tool-reference-when-to-use--descriptions)
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

### 3.7 `contextos guardrail`
**Description:** Manages hierarchical engineering guardrails, code invariants, action blockers, and verification gates. Evaluates regex/glob file patterns and shell commands against decoupled bypass policies.

#### Subcommands

#### 1. `contextos guardrail add`
Registers a new guardrail.
```bash
# Add an architectural invariant rule
contextos guardrail add "All SQL statements must use parameterized bindings" \
  --title "SQL Injection Prevention" \
  --type INVARIANT \
  --severity BLOCKER \
  --policy p-human-only

# Add a pre-flight action block rule for sensitive file paths
contextos guardrail add "Never touch production AWS credentials" \
  --title "Protect AWS Credentials" \
  --type ACTION_BLOCK \
  --pattern ".*aws/credentials.*" \
  --severity BLOCKER \
  --policy p-never \
  --remediation "Use IAM roles or AWS SSM Parameter Store"

# Add a machine-wide global guardrail
contextos guardrail add "Never commit private keys or certificates" \
  --title "Block Private Keys" \
  --type ACTION_BLOCK \
  --pattern ".*id_rsa.*" \
  --policy p-never \
  --global
```

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `rule` (arg1) | string | **Required** | The explicit guardrail rule or instruction |
| `--title` | string | `rule.slice(0, 40)` | Short headline for the rule |
| `--type` | string | `INVARIANT` | `INVARIANT`, `ACTION_BLOCK`, or `VERIFICATION_GATE` |
| `--severity` | string | `BLOCKER` | `BLOCKER` (hard stop) or `WARNING` (audit log only) |
| `--policy` | string | `p-human-only` | Reusable policy ID (`p-never`, `p-human-only`, `p-trusted-agents`, `p-permissive`, or custom) |
| `--pattern` | string | `undefined` | Regex pattern tested against touched files or command strings |
| `--remediation` | string | `undefined` | Guidance or suggested alternative when blocked |
| `--global` | boolean | `false` | Save to machine-wide global storage (`~/.contextos/context.db`) |

#### 2. `contextos guardrail list`
Lists all active guardrails. When run inside a repository, displays both repository-local guardrails and inherited machine-wide global guardrails.
```bash
# List all active guardrails for current repository
contextos guardrail list

# Filter by type
contextos guardrail list --type ACTION_BLOCK

# View global guardrails only
contextos guardrail list --global
```

#### 3. `contextos guardrail check`
Evaluates touched files or shell commands against all active guardrails and bypass policies. Returns exit code 0 if permitted; exits with code 1 and violation details if blocked.
```bash
# Check files modified by an AI agent
contextos guardrail check --files "src/index.ts,README.md" --agent "codex"

# Check with human bypass reason (bypasses HUMAN_ONLY policies)
contextos guardrail check --files ".env.local" --agent human --bypass "Emergency local debugging"

# Check a bash command string
contextos guardrail check --command "git push --force origin main" --agent "codex"
```

#### 4. `contextos guardrail remove`
Removes a guardrail by ID.
```bash
contextos guardrail remove g-1f2c9046
contextos guardrail remove g-32466ef1 --global
```

---

### 3.8 `contextos policy`
**Description:** Manages reusable bypass policies that define which agents or roles are permitted to bypass specific guardrail rules.

#### Subcommands

#### 1. `contextos policy list`
Lists all registered bypass policies.
```bash
contextos policy list
contextos policy list --global
```

#### 2. `contextos policy add`
Creates a new reusable bypass policy profile.
```bash
contextos policy add "Release Bot Override" \
  --type SPECIFIC_AGENTS \
  --agents "release-bot,devops-agent" \
  --description "Allows CI release bots to bypass changelog rules"
```

| Policy Type | Description |
| :--- | :--- |
| `NEVER` | Zero exceptions. Neither AI agents nor humans can bypass. |
| `HUMAN_ONLY` | AI agents cannot self-exempt. Human confirmation required via terminal. |
| `SPECIFIC_AGENTS` | Only designated models (e.g., `claude`, `antigravity`) can bypass with user reason. |
| `ANY_AGENT` | Any agent can bypass if requested by user with documented rationale. |

#### 3. `contextos policy update`
Updates policy metadata, policy type, or allowed agents.
```bash
# Add a single agent to an existing policy
contextos policy update p-ce9ca3e8 --add-agent "claude"

# Replace entire allowed agents list
contextos policy update p-ce9ca3e8 --agents "claude,antigravity,codex"
```

#### 4. `contextos policy remove`
Deletes a custom policy.
```bash
contextos policy remove p-ce9ca3e8
```

---

## 4. Model Context Protocol (MCP) Server Guide

ContextOS includes a built-in MCP server (`packages/mcp/dist/index.js`) communicating over `stdio` adhering to MCP specification `2024-11-05`.

Autonomous coding agents (Claude Code, Cursor, Codex, Windsurf, Claude Desktop) can invoke ContextOS tools directly without human intervention.

### 4.1 The Fundamental Rule: Terminal CLI vs. AI Agent Chat

When working across multiple repositories and global context (`~/.contextos/context.db`):
- **In Your Terminal Shell**: Always run the CLI (`contextos status --global`, `contextos task get --jira <id>`, `contextos handoff`). Your shell has full operating system permissions.
- **Inside AI Agent Chat (Codex, Cursor, Claude, Antigravity)**: Agents run inside **sandboxed workspace containers**. When an agent tries to run terminal or bash scripts against `~/.contextos/context.db`, the sandbox blocks the operation with `SQLITE_CANTOPEN`.
- **The Solution**: In chat, agents must **use MCP tools directly** (`get_current_task`, `save_context`, `record_decision`). The MCP server runs on the host OS outside the sandbox, allowing unrestricted read/write access to both local and global databases.

---

### 4.2 Cross-Database Lookup (Zero Repo Pollution)

You can configure ContextOS MCP **once globally** on your machine and have it available across every repository without creating any configuration files in those repositories.
When an agent calls `get_current_task({ jiraId: "TEST-100" })`:
1. It inspects the local repository's `.contextos/context.db`.
2. If not found or if the project has no local database, it **automatically falls back to `~/.contextos/context.db`**.

---

### 4.3 Configuring Across AI IDEs & Clients

#### 1. Codex (VS Code Extension, Codex CLI, Desktop)
Codex reads configuration from `~/.codex/config.toml` (user-level, global across all workspaces):

- **CLI One-Liner (Recommended)**:
  ```bash
  codex mcp add contextos -- node /ABSOLUTE_PATH/ContextOS/packages/mcp/dist/index.js
  ```
  *(Or if linked globally: `codex mcp add contextos -- contextos mcp`)*

- **Or manual `~/.codex/config.toml`**:
  ```toml
  [mcp_servers.contextos]
  command = "node"
  args = ["/ABSOLUTE_PATH/ContextOS/packages/mcp/dist/index.js"]
  ```

- **Verification**: Run `codex mcp list` in terminal to confirm `contextos` is enabled, or type `/mcp` in Codex chat.

#### 2. Cursor IDE
- **Global User Setup (Zero files in repos)**:
  1. Open Cursor **Settings** (`⌘ + ,`) ➔ **Features** ➔ **MCP**.
  2. Click **+ Add New MCP Server**:
     - Name: `contextos`
     - Type: `command`
     - Command: `node /ABSOLUTE_PATH/ContextOS/packages/mcp/dist/index.js`
  3. Verify a **green status dot** appears next to `contextos`.
- **Project-Level Setup**: Add to `.cursor/mcp.json`:
  ```json
  {
    "mcpServers": {
      "contextos": {
        "command": "node",
        "args": ["/ABSOLUTE_PATH/ContextOS/packages/mcp/dist/index.js"]
      }
    }
  }
  ```

#### 3. Google Antigravity
Add to Antigravity's MCP configuration:
```json
{
  "mcpServers": {
    "contextos": {
      "command": "node",
      "args": ["/ABSOLUTE_PATH/ContextOS/packages/mcp/dist/index.js"]
    }
  }
}
```
- **Verification**: In Antigravity chat, inspect the active tools list to confirm `get_current_task`, `save_context`, and `record_decision` are loaded.

#### 4. Claude Desktop & Claude Code
- **Claude Desktop**: Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:
  ```json
  {
    "mcpServers": {
      "contextos": {
        "command": "node",
        "args": ["/ABSOLUTE_PATH/ContextOS/packages/mcp/dist/index.js"]
      }
    }
  }
  ```
  *Verification:* Click the 🔨 hammer icon in Claude Desktop chat.
- **Claude Code CLI**:
  ```bash
  claude mcp add contextos -- node /ABSOLUTE_PATH/ContextOS/packages/mcp/dist/index.js
  ```
  *Verification:* Run `claude mcp list`.

---

### 4.4 Tool Reference: When to Use & Descriptions

ContextOS exposes **15 standard tools** over JSON-RPC:

| Tool Name | When to Use | Description |
| :--- | :--- | :--- |
| **`get_status`** | Status Overview | Returns consolidated project state, storage mode, git branch, task, and decisions. |
| **`get_current_task`** | At session start | Agent reads active task goal, invariants, blockers, and completed checklist items. |
| **`save_context`** | After completing work | Agent marks checklist items as completed, logs next remaining steps, or registers blockers. |
| **`record_decision`** | Making architectural choices | Agent locks in architectural patterns, library selections, or supersedes older decisions. |
| **`create_handoff`** | Session completion | Compiles bounded `latest.md` and timestamped archive for downstream handoff. |
| **`get_git_context`** | Before editing code | Retrieves Git branch, modified files, and noise-filtered, secret-scanned diffs. |
| **`get_guardrails`** | Pre-flight discovery | Discovers active local and inherited global invariants, action blockers, and bypass policies. |
| **`check_guardrails`** | Pre/post-flight check | Evaluates files and commands against patterns and bypass policies. Hard-stops violations. |
| **`record_guardrail`** | Registering invariants | Records an invariant, action blocker, or verification gate with a bypass policy. |
| **`remove_guardrail`** | Decommissioning rules | Decommissions obsolete guardrail rules by ID. |
| **`list_tasks`** | Task review | Lists all tasks for current project with status and Jira ticket tags. |
| **`list_decisions`** | Architecture audit | Lists all active and superseded architectural decisions. |
| **`list_projects`** | Multi-repo discovery | Lists all registered projects across local and global storage. |
| **`clean_context`** | State reset | Safely cleans project tasks and decisions without corrupting other workspaces. |

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

#### Tool 6: `get_guardrails`
- **When to Use**: Call upon starting work to discover all active local and inherited machine-wide invariants, forbidden file patterns, and bypass rules.
- **Input Parameters**:
  ```json
  {
    "type": "INVARIANT | ACTION_BLOCK | VERIFICATION_GATE (optional)",
    "includeGlobal": true
  }
  ```
- **Example Response**:
  ```json
  {
    "total": 2,
    "guardrails": [
      {
        "id": "g-1f2c9046",
        "title": "SQL Injection Prevention",
        "rule": "All SQL statements must be prepared statements",
        "type": "INVARIANT",
        "severity": "BLOCKER",
        "scope": "LOCAL",
        "policyId": "p-human-only"
      }
    ]
  }
  ```

---

#### Tool 7: `check_guardrails`
- **When to Use**: Mandatory pre-flight and post-flight check before modifying sensitive files or running commands.
- **Input Parameters**:
  ```json
  {
    "files": ["array of files about to be modified"],
    "command": "string (optional shell command about to be run)",
    "agentName": "codex | claude | antigravity",
    "bypassReason": "string (optional user-provided justification)"
  }
  ```
- **Example Response (Pass)**:
  ```json
  {
    "allowed": true,
    "violations": [],
    "bypassed": false,
    "summary": "All guardrails passed."
  }
  ```
- **Example Response (Blocked)**:
  ```json
  {
    "allowed": false,
    "violations": [
      {
        "guardrailId": "g-a2bd7faf",
        "title": "Protect AWS Credentials",
        "severity": "BLOCKER",
        "message": "File '.aws/credentials.json' matches protected pattern '.*aws/credentials.*'. Rule policy is 'NEVER'.",
        "remediation": "Use IAM roles or AWS SSM Parameter Store"
      }
    ],
    "bypassed": false,
    "summary": "Action blocked by 1 guardrail(s)."
  }
  ```

---

#### Tool 8: `record_guardrail`
- **When to Use**: Call to establish a new architectural invariant, action blocker, or verification gate for the project or globally.
- **Input Parameters**:
  ```json
  {
    "title": "string (required)",
    "rule": "string (required: engineering rule or constraint)",
    "type": "INVARIANT | ACTION_BLOCK | VERIFICATION_GATE",
    "severity": "BLOCKER | WARNING",
    "pattern": "string (regex pattern for files or commands)",
    "remediation": "string (suggested alternative when blocked)",
    "policyId": "string (e.g. p-never, p-human-only, p-trusted-agents)",
    "global": false
  }
  ```

---

#### Tool 9: `remove_guardrail`
- **When to Use**: Call to decommission an obsolete guardrail rule by ID.
- **Input Parameters**:
  ```json
  {
    "id": "string (required: guardrail ID)"
  }
  ```

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
All **104 tests** across 9 test suites should report green (`✓ passed`).

### Q: How do I check or switch between Local and Global storage modes?
**Answer:**
- **Check current mode:** Run `contextos status`. The `--- Project Overview ---` header displays `Mode: Local workspace (.contextos/)` or `Mode: Global system (~/.contextos/)`.
- **Switch to Global mode:** Run `contextos init --global` (or `contextos clean --all`). The local database is removed and ContextOS points to `~/.contextos/context.db`.
- **Switch to Local mode:** Run `contextos init --local`. Creates a standalone `.contextos/context.db` inside your current repository.
