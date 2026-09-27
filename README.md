# ContextOS

> **A deterministic, local-first context and handoff layer for AI coding agents.**  
> Effortlessly transition between **Claude** (planning), **Codex** (implementation), **Cursor** (editing), and **Antigravity** (review) without lossy prompt engineering or token bloat.

---

## The Problem ContextOS Solves

Developers routinely switch AI models depending on the task:
* **Claude / Sonnet** → Architecture, high-level planning, and system design.
* **Codex / GPT** → Implementation, test scaffolding, and repetitive code changes.
* **Cursor / Windsurf** → Inline editing and interactive debugging.
* **Antigravity / Gemini** → Comprehensive analysis and multi-turn workflows.

When switching models, developers currently resort to manual copy-pasting, re-explaining invariants, or losing track of architectural decisions. 

**ContextOS maintains a structured, model-independent representation of active software tasks, decisions, code diffs, and blockers.**

```
Claude (Planner)
      ↓ 1. Records architecture decisions & sets constraints
  ContextOS (Host Storage & MCP)
      ↓ 2. Supplies bounded context snapshot
Codex / Cursor (Implementer)
      ↓ 3. Reads context via MCP, writes code, completes checklist
  ContextOS (Host Storage & MCP)
      ↓ 4. Generates review handoff (.contextos/handoffs/latest.md)
Claude (Reviewer)
      ↓ 5. Audits implementation against original invariants
```

---

## Key Invariants

1. **Local-First & Zero Cloud**: Everything lives in local SQLite databases (either in your repository at `.contextos/context.db` or globally at `~/.contextos/context.db`). No servers, no accounts, no cloud sync.
2. **Deterministic Token Budgeting**: Handoffs are strictly budgeted (~4,000 tokens) using a 4-tier relevance ladder.
3. **The Terminal vs. AI Chat Rule**:
   - **Terminal Shell**: Run CLI commands (`contextos status`, `contextos task get --jira <id>`).
   - **Inside AI Chat**: Agents use **MCP tools directly** (`get_current_task`, `save_context`, `record_decision`). MCP runs on the host outside the agent's sandbox, avoiding `SQLITE_CANTOPEN`.
4. **Cross-Database Resolution**: ContextOS MCP automatically searches the local workspace first, and seamlessly falls back to global storage (`~/.contextos/context.db`). You can configure MCP once globally and use it across every repository with zero configuration in those repositories.

---

## Quick Start

### 1. Build the Monorepo
```bash
git clone https://github.com/vivekkumar9919/ContextOS.git
cd ContextOS
npm install
npm run build
```

### 2. Initialize ContextOS Storage
```bash
# Global storage in ~/.contextos (Recommended)
node apps/cli/dist/index.js init --global

# Or local workspace storage in .contextos
node apps/cli/dist/index.js init --local
```

### 3. Optional: Link CLI Globally
```bash
npm link --workspace=contextos
# Now you can run `contextos <command>` from anywhere!
```

---

## MCP Setup Across AI IDEs & Agents

Configure ContextOS **once globally** on your machine. All repositories will immediately have access to your tasks and decisions without creating any files in those repositories.

### 1. Codex (VS Code Extension & CLI)
```bash
# One-liner to register globally in ~/.codex/config.toml:
codex mcp add contextos -- node /ABSOLUTE_PATH/ContextOS/packages/mcp/dist/index.js
```
*Verification:* Run `codex mcp list` or type `/mcp` in Codex chat.

### 2. Cursor IDE
Open **Settings** (`⌘ + ,`) ➔ **Features** ➔ **MCP** ➔ **+ Add New MCP Server**:
* **Name**: `contextos`
* **Type**: `command`
* **Command**: `node /ABSOLUTE_PATH/ContextOS/packages/mcp/dist/index.js`  
*Verification:* Confirm the green status dot next to `contextos`.

### 3. Google Antigravity
Add to your Antigravity MCP configuration:
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
*Verification:* Inspect active MCP tools in chat.

### 4. Claude Desktop & Claude Code
* **Claude Desktop**: Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:
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
* **Claude Code CLI**:
  ```bash
  claude mcp add contextos -- node /ABSOLUTE_PATH/ContextOS/packages/mcp/dist/index.js
  ```

---

## MCP Tools Reference

| Tool | When to Use | Sample Chat Prompt |
| :--- | :--- | :--- |
| **`get_current_task`** | Starting work or loading a Jira ticket | *"Use ContextOS `get_current_task` with jiraId 'TEST-100' to fetch requirements."* |
| **`save_context`** | Checking off items or recording blockers | *"Mark 'Verify lookup' as complete using ContextOS `save_context`."* |
| **`record_decision`** | Locking in architecture patterns | *"Record decision in ContextOS: Title 'Use SQLite WAL', Rationale 'High concurrency'."* |
| **`get_git_context`** | Checking branch & noise-filtered diff | *"Use `get_git_context` to check modified files and branch status."* |
| **`create_handoff`** | Handing off to reviewer or next agent | *"Create a handoff for Claude review using ContextOS `create_handoff`."* |

---

## Instant Clipboard Handoff (Zero Setup)

If you are chatting with an agent that does not have MCP configured:
```bash
contextos handoff --jira TEST-100 --from antigravity --to codex
```
ContextOS compiles a compact Markdown brief and **automatically copies it to your OS clipboard**. Paste it directly into the chat prompt.

---

## Documentation

* [📖 Multi-IDE MCP & Global Context Guide](docs/MCP_GUIDE.md) — Comprehensive guide covering Codex, Cursor, Antigravity, and Claude.
* [📘 End-to-End Setup & Usage Guide](docs/SETUP_AND_USAGE_GUIDE.md) — Complete CLI reference, storage architecture, token budgeting, and workflows.
* [📋 Product Requirements Document (PRD)](docs/PRD.md)
* [🏗️ Technical Requirements Document (TRD)](docs/TRD.md)
