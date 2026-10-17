# ContextOS Guardrails & Governance Engine

> **A local-first, hierarchical policy and guardrail system for AI coding agents.**  
> Define engineering invariants once globally or per-repository. Enforce security, prevent destructive commands, mandate verification gates, and control bypass permissions across all AI models without per-repo configuration file bloat.

---

## 📌 Overview & Philosophy

Modern AI coding agents (Claude, Codex, Cursor, Antigravity) are powerful, but prone to:
1. **Accidental Destructive Actions**: Running `git push --force`, deleting lockfiles, or overwriting `.env` files.
2. **Violating Architectural Invariants**: Omitting HMAC signatures on webhooks, writing unparameterized SQL queries, or introducing forbidden dependencies.
3. **Skipping Quality Gates**: Marking tasks completed without verifying that unit tests or linters actually pass.
4. **Configuration Sprawl**: Developers having to duplicate `.cursorrules` or prompts across dozens of repositories.

ContextOS solves this by establishing a **Local-First, Hierarchical Guardrail Engine** backed by SQLite, governed by normalized **Bypass Policies**, and exposed over the **Model Context Protocol (MCP)** and terminal CLI.

```text
Machine-Global Invariants (~/.contextos/context.db)
   ├── Security: Never commit .env or private keys (Blocker)
   ├── Git: Never execute git push --force on main (Blocker)
   └── Quality: All APIs require automated integration tests (Warning)
            │
            ▼ inherits & merges automatically
Repo-Local Invariants (.contextos/context.db)
   ├── Architecture: Use PostgreSQL JSONB for event payloads (Blocker)
   └── Quality: Minimum 80% test coverage for auth module (Warning)
```

---

## 🛡️ The 3 Guardrail Archetypes

| Archetype | Level | Enforcement Mechanism | Example |
| :--- | :--- | :--- | :--- |
| **`INVARIANT`** | Cognitive (Prompt) | Injected into agent context snapshots & handoff briefs. | *"All database queries must use parameterized bindings."* |
| **`ACTION_BLOCK`** | Execution (Pre-Flight) | Evaluated via regex/glob patterns on commands and file paths. Hard-stops execution. | *"Block `git push --force`, `rm -rf`, and modifying `.env*`."* |
| **`VERIFICATION_GATE`** | Completion (Post-Flight) | Evaluated when marking tasks `COMPLETED` or compiling handoffs. | *"Run `npm test` and verify clean exit before task completion."* |

---

## 🔐 Reusable Policy Profiles (`bypass_policies`)

Rather than hardcoding agent names and bypass logic repeatedly on every individual guardrail, ContextOS decouples bypass rules into reusable **Policy Profiles**. Updating a policy updates all linked guardrails in one place.

```text
┌───────────────────────┐
│     Guardrail A       │───┐
└───────────────────────┘   │
┌───────────────────────┐   ├──▶ ┌──────────────────────────────────────────────┐
│     Guardrail B       │───┤    │ Policy Profile: "p-trusted-agents"           │
└───────────────────────┘   │    │ Type: SPECIFIC_AGENTS                        │
┌───────────────────────┐   │    │ Allowed: ["claude", "antigravity"]           │
│     Guardrail C       │───┘    └──────────────────────────────────────────────┘
└───────────────────────┘
```

### Supported Policy Types

1. **`NEVER`**: Absolute invariant. Zero exceptions. Neither AI agents nor humans can bypass.
2. **`HUMAN_ONLY`**: Autonomous AI agents cannot self-exempt. Only a human in the terminal CLI can approve a bypass.
3. **`SPECIFIC_AGENTS`**: Only designated trusted agents (e.g., Lead Architect / Claude) can bypass with a documented user reason. Junior/worker agents (e.g. Codex) are blocked.
4. **`ANY_AGENT`**: Any agent can bypass if explicitly requested by the user in chat with a rationale.

### Default Pre-Seeded Policies

ContextOS automatically initializes with 4 standard policies:

| Policy ID | Policy Name | Type | Allowed Agents | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **`p-never`** | Strict Invariant | `NEVER` | `[]` | Critical security (e.g., hardcoded secrets). Zero bypasses. |
| **`p-human-only`** | Human Approval Required | `HUMAN_ONLY` | `[]` | Destructive commands (e.g., `git push --force`). Human CLI only. |
| **`p-trusted-agents`** | Senior Agent Override | `SPECIFIC_AGENTS` | `["claude", "antigravity"]` | Architectural decisions. Trusted models can bypass with user reason. |
| **`p-permissive`** | Standard Review | `ANY_AGENT` | `["*"]` | Quality warnings. Any agent can bypass if user requests. |

---

## 🗄️ SQLite Database Schema

Created in both machine-global (`~/.contextos/context.db`) and local repository (`.contextos/context.db`):

```sql
-- Reusable Bypass Policies
CREATE TABLE IF NOT EXISTS bypass_policies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  policy_type TEXT NOT NULL,         -- 'NEVER' | 'HUMAN_ONLY' | 'SPECIFIC_AGENTS' | 'ANY_AGENT'
  allowed_agents TEXT,               -- JSON array: '["claude", "antigravity"]'
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Guardrails
CREATE TABLE IF NOT EXISTS guardrails (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  rule TEXT NOT NULL,
  type TEXT NOT NULL,                -- 'INVARIANT' | 'ACTION_BLOCK' | 'VERIFICATION_GATE'
  severity TEXT NOT NULL,            -- 'BLOCKER' | 'WARNING' | 'INFO'
  scope TEXT NOT NULL,               -- 'GLOBAL' | 'LOCAL'
  pattern TEXT,                      -- Regex or glob pattern for matching commands/files
  remediation TEXT,                  -- Actionable hint telling the agent what to do instead
  policy_id TEXT NOT NULL,           -- REFERENCES bypass_policies(id)
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

---

## 💡 Remediation Guidance: "Don't Just Block, Teach"

When a guardrail halts an agent, it doesn't just return an error. It provides an explicit **`remediation`** hint.

* **Violated Rule**: `Never execute git push --force on main`
* **Remediation**: `Do not force push. Create a clean revert commit using 'git revert <commit-hash>' instead.`

The agent immediately recognizes the approved alternative and self-corrects without getting stuck in a hallucination loop.

---

## 🛠️ CLI Reference

### Guardrail Commands
```bash
# Add a global security guardrail
contextos guardrail add "Never modify .env or credentials" \
  --title "Secret File Protection" \
  --type ACTION_BLOCK \
  --pattern "\.env.*|\.pem$" \
  --severity BLOCKER \
  --policy p-never \
  --remediation "Store secrets in environment variables or cloud secret managers" \
  --global

# Add a local architectural invariant
contextos guardrail add "All public API responses must omit internal user IDs" \
  --title "Sanitize API Responses" \
  --type INVARIANT \
  --severity BLOCKER \
  --policy p-trusted-agents

# List all active guardrails (merges global + local)
contextos guardrail list

# Remove a guardrail
contextos guardrail remove G-1 [--global]

# Pre-flight check a command
contextos guardrail check --command "git push --force origin main" --agent codex
```

### Policy Commands
```bash
# List available policies
contextos policy list

# Add a trusted agent to an existing policy
contextos policy update p-trusted-agents --add-agent "codex"

# Create a custom policy profile
contextos policy create "backend-leads-only" \
  --type SPECIFIC_AGENTS \
  --agents "claude,antigravity" \
  --description "Only backend lead models can bypass DB migration rules"
```

---

## 🤖 Model Context Protocol (MCP) Tools

The MCP server exposes 4 dedicated tools for AI chat integration:

### 1. `get_guardrails`
Fetches all active merged guardrails (both machine-global and project-local).
* **Input**: `{ includeGlobal?: boolean, type?: string }`
* **Output**: Array of active guardrails with policies, remediation tips, and severity.

### 2. `record_guardrail`
Allows agents or developers to record a permanent invariant or rule during chat.
* **Input**:
  ```json
  {
    "title": "Use SQLite WAL Mode",
    "rule": "All SQLite database connections must enable WAL journal mode for concurrency",
    "type": "INVARIANT",
    "severity": "BLOCKER",
    "policyId": "p-trusted-agents",
    "global": true
  }
  ```

### 3. `remove_guardrail`
Deletes a guardrail by ID.
* **Input**: `{ "id": "guardrail-uuid", "global": false }`

### 4. `check_guardrails`
Pre-flight verification tool called before running commands, creating files, or completing tasks.
* **Input**:
  ```json
  {
    "command": "git push --force",
    "files": ["src/server.ts"],
    "agentName": "codex",
    "bypassReason": "User explicitly told me to push"
  }
  ```
* **Output (Blocked)**:
  ```json
  {
    "allowed": false,
    "violations": [
      {
        "guardrailId": "g-101",
        "title": "No Force Push",
        "severity": "BLOCKER",
        "policy": "p-human-only",
        "message": "Bypass rejected: Agent 'codex' is not authorized to bypass human-only guardrails.",
        "remediation": "Do not force push. Create a clean revert commit using 'git revert <commit-hash>' instead."
      }
    ]
  }
  ```

---

## 🔄 Lifecycle Integration: Automatic Handoff Injection

When `create_handoff` is called in ContextOS, the compiler automatically retrieves all active `INVARIANT` guardrails and embeds them into `.contextos/handoffs/latest.md`:

```markdown
## 🛡️ Active Architectural Guardrails & Invariants
- [BLOCKER] All payment webhook handlers must verify HMAC signature (Policy: p-trusted-agents)
- [BLOCKER] Never commit .env or credentials (Policy: p-never)
- [WARNING] All exported functions must have explicit TypeScript return types
```

Downstream agents (e.g. Codex receiving a handoff from Claude) are immediately aligned with company invariants before generating their first line of code.
