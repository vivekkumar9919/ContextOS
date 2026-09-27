# ContextOS: Multi-IDE MCP & Global Context Guide

> **Deterministic, zero-cloud context and handoff layer for AI coding agents across all IDEs and tools.**  
> Compatible with **Antigravity**, **Codex**, **Cursor**, **Claude Desktop**, and **Claude Code**.

---

## Table of Contents
1. [Core Architecture: The "Terminal vs. AI Chat" Rule](#1-core-architecture-the-terminal-vs-ai-chat-rule)
2. [Global Context & Cross-Database Resolution](#2-global-context--cross-database-resolution)
3. [Multi-IDE Setup & Verification](#3-multi-ide-setup--verification)
   - [3.1 Codex (VS Code Extension, Codex CLI, Desktop)](#31-codex-vs-code-extension-codex-cli-desktop)
   - [3.2 Cursor IDE](#32-cursor-ide)
   - [3.3 Google Antigravity](#33-google-antigravity)
   - [3.4 Claude Desktop & Claude Code](#34-claude-desktop--claude-code)
4. [MCP Tool Reference & Chat Prompting](#4-mcp-tool-reference--chat-prompting)
5. [Verification & Health Checks](#5-verification--health-checks)
6. [Troubleshooting & Common Issues](#6-troubleshooting--common-issues)

---

## 1. Core Architecture: The "Terminal vs. AI Chat" Rule

When working across multiple repositories and global context (`~/.contextos/context.db`), you will encounter a fundamental difference between running commands yourself in a terminal versus asking an AI agent in chat:

```
┌────────────────────────────────────────────────────────────────────────┐
│                          YOUR WORKSTATION                              │
│                                                                        │
│  ┌─────────────────────────┐            ┌───────────────────────────┐  │
│  │   Your Terminal Shell   │            │    AI Agent Chat Window   │  │
│  │    (zsh, bash, etc.)    │            │ (Codex, Cursor, Claude)   │  │
│  └────────────┬────────────┘            └─────────────┬─────────────┘  │
│               │ Full Host Access                      │ Sandboxed!     │
│               ▼                                       ▼                │
│    $ contextos <command>                  Cannot run sqlite3 directly  │
│    Works everywhere on host!              Fails with SQLITE_CANTOPEN!  │
│               │                                       │                │
│               │                                       ▼                │
│               │                         Must use MCP Tools via stdio:  │
│               │                        • get_current_task              │
│               │                        • save_context                  │
│               │                        • record_decision               │
│               │                                       │                │
│               ▼                                       ▼                │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                 ContextOS Engine & MCP Server                    │  │
│  │          (Runs on host, reads Local & Global Storage)            │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
│                                     │                                  │
│                   ┌─────────────────┴─────────────────┐                │
│                   ▼                                   ▼                │
│          Local Workspace DB                   Global System DB         │
│       (.contextos/context.db)              (~/.contextos/context.db)   │
└────────────────────────────────────────────────────────────────────────┘
```

### The Invariant:
1. **In Terminal**: Always use the CLI (`contextos status`, `contextos task get --jira <id>`, `contextos handoff`).
2. **In AI Chat**: Agents must **only invoke ContextOS MCP tools** (`get_current_task`, `save_context`, `record_decision`). Agents should never attempt to execute raw bash/sqlite queries against `~/.contextos/context.db`, as sandboxed agent environments block access to files outside the workspace.
3. **MCP runs on the host OS**: Because the MCP server process runs on your host machine outside the agent's sandbox, it has full, unrestricted access to both local and global databases.

---

## 2. Global Context & Cross-Database Resolution

ContextOS is designed so you can configure MCP **once globally** on your machine and have it work seamlessly in **every repository** without adding any configuration files (`.codex/`, `.cursor/`, `.vscode/`) to those repos.

### How Cross-Database Lookup Works
When an agent calls `get_current_task({ jiraId: "PROJ-123" })` or `handleGetCurrentTask()`:
1. **Local Check**: ContextOS inspects the current repository's `.contextos/context.db`.
2. **Global Fallback**: If no local database exists, or if the task/Jira ticket is not found locally, ContextOS automatically queries the global database at `~/.contextos/context.db`.
3. **Zero Configuration**: You can clone a brand new project (e.g. `webprototypes`) that has no ContextOS setup, and an agent in that project can immediately read your global Jira tasks (`TEST-100`) via MCP!

---

## 3. Multi-IDE Setup & Verification

### 3.1 Codex (VS Code Extension, Codex CLI, Desktop)

Codex shares its MCP server registry across its CLI, VS Code extension, and Desktop app via `~/.codex/config.toml`.

#### Option A: One-Line CLI Command (Recommended)
Run in your terminal:
```bash
codex mcp add contextos -- node /Users/YOUR_USER/Documents/projects/ContextOS/packages/mcp/dist/index.js
```
*(Or if `contextos` is linked globally: `codex mcp add contextos -- contextos mcp`)*

#### Option B: Manual Global Config (`~/.codex/config.toml`)
Add this to `/Users/YOUR_USER/.codex/config.toml`:
```toml
[mcp_servers.contextos]
command = "node"
args = ["/Users/YOUR_USER/Documents/projects/ContextOS/packages/mcp/dist/index.js"]
```

#### Option C: Project-Scoped Config (`.codex/config.toml`)
If you prefer a repository-specific configuration, create `.codex/config.toml` in your project root with the same content as Option B.

#### Verification for Codex:
1. Run in terminal:
   ```bash
   codex mcp list
   ```
   Output will display `contextos` with status `enabled`.
2. In Codex chat (VS Code or CLI), type `/mcp` to list active tools.
3. Test prompt in Codex chat:
   > *"Use ContextOS get_current_task to load task TEST-100."*

---

### 3.2 Cursor IDE

Cursor supports MCP at both the global User level (works across all workspaces) and the project level.

#### Option A: Global User Setup (Zero files in repos)
1. In Cursor, open **Settings** (`⌘ + ,` on macOS, `Ctrl + ,` on Windows/Linux).
2. Go to **Features** ➔ **MCP**.
3. Click **+ Add New MCP Server**:
   - **Name**: `contextos`
   - **Type**: `command`
   - **Command**: `node /Users/YOUR_USER/Documents/projects/ContextOS/packages/mcp/dist/index.js`
4. Click **Save**.

#### Option B: Project-Scoped Config (`.cursor/mcp.json`)
Create `.cursor/mcp.json` in the root of your workspace:
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

#### Verification for Cursor:
1. In **Settings ➔ Features ➔ MCP**, verify there is a **green status dot** next to `contextos`.
2. In Cursor Composer or Chat (`⌘ + L` / `⌘ + I`):
   > *"Call get_current_task from ContextOS for jiraId 'TEST-100'"*
3. You will see Composer execute the tool call and output the active task and invariants.

---

### 3.3 Google Antigravity

Antigravity natively integrates with MCP servers defined in your local Antigravity configuration directory (`~/.gemini/antigravity/mcp/`).

#### Global Configuration
In Antigravity's settings or MCP server definition file:
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
*(Or command `contextos`, args `["mcp"]`)*.

#### Verification for Antigravity:
1. Check that Antigravity lists `contextos` under active MCP servers with tools:
   - `get_current_task`
   - `save_context`
   - `record_decision`
   - `create_handoff`
   - `get_git_context`
2. Test prompt in Antigravity chat:
   > *"Query ContextOS MCP tool get_current_task for task TEST-100."*

---

### 3.4 Claude Desktop & Claude Code

#### A. Claude Desktop
Add ContextOS to your global Claude configuration file:
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

#### B. Claude Code CLI
Run in your terminal:
```bash
claude mcp add contextos -- node /Users/YOUR_USER/Documents/projects/ContextOS/packages/mcp/dist/index.js
```

#### Verification for Claude:
1. In Claude Desktop, open a new chat and look at the bottom right of the message composer. Click the **🔨 (Hammer icon)** to confirm the 5 ContextOS tools appear.
2. In Claude Code CLI, run:
   ```bash
   claude mcp list
   ```

---

## 4. MCP Tool Reference & Chat Prompting

Once registered in any of the above IDEs, your AI agents have access to these **5 tools**. Here is how to prompt agents to use them:

| Tool | When the Agent Uses It | Example Chat Prompt |
| :--- | :--- | :--- |
| **`get_current_task`** | Starting work or picking up a task | *"Use ContextOS `get_current_task` with jiraId 'TEST-100' to load my requirements."* |
| **`save_context`** | Completing checklist items or logging blockers | *"Mark 'Verify cross-database lookup' as complete using ContextOS `save_context`."* |
| **`record_decision`** | Choosing an architecture, library, or design invariant | *"Record an architectural decision in ContextOS: Title 'Use Redis for caching', Rationale 'Reduces database load'."* |
| **`get_git_context`** | Inspecting touched files, branch, and diff | *"Use `get_git_context` to see what code changes have been made in this branch."* |
| **`create_handoff`** | Handing off work to another agent or human review | *"Create a handoff for Claude review using ContextOS `create_handoff`."* |

---

## 5. Verification & Health Checks

You can run these verification steps from any terminal to ensure everything is functioning correctly:

### 1. Test MCP Server over `stdio`
Run the standalone server test:
```bash
node -e "
const { spawn } = require('child_process');
const proc = spawn('node', ['packages/mcp/dist/index.js']);
proc.stdout.on('data', data => console.log('MCP Output:', data.toString()));
proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) + '\n');
setTimeout(() => proc.kill(), 1000);
"
```
*Expected Result:* Returns JSON-RPC response listing all 5 tools (`get_current_task`, `save_context`, `record_decision`, `create_handoff`, `get_git_context`).

### 2. Verify Global Data from Terminal
Check your global task context:
```bash
contextos status --global
contextos task get --jira TEST-100 --global
```

### 3. Verify Cross-Project Lookup
Navigate to any other folder or repository on your machine:
```bash
cd /tmp
contextos task get --jira TEST-100
```
*Expected Result:* ContextOS automatically locates and displays the task from `~/.contextos/context.db`.

---

## 6. Troubleshooting & Common Issues

### Issue 1: `SQLITE_CANTOPEN` inside AI Agent Chat
- **Cause**: The agent attempted to execute a bash/terminal command (e.g. `sqlite3 ~/.contextos/context.db` or `ls ~/.contextos`) from within a sandboxed chat environment.
- **Fix**: Instruct the agent: *"Do not run shell commands against the database. Use your ContextOS MCP tools directly (`get_current_task`, `save_context`)."*

### Issue 2: Agent says "MCP tools not available in this session"
- **Cause**: The IDE or extension was not restarted after updating `config.toml` or `mcp.json`.
- **Fix**:
  1. Restart VS Code, Cursor, or Claude Desktop.
  2. For Codex: Run `codex mcp list` in terminal to ensure `contextos` is enabled.
  3. In chat, explicitly prompt: *"Use the MCP tool `get_current_task`"*.

### Issue 3: Zero-Setup Fallback (No MCP Required)
If you are on a restricted machine or in an ad-hoc session where MCP cannot be configured, use the **ContextOS Clipboard Handoff**:
```bash
contextos handoff --jira TEST-100 --from antigravity --to codex
```
This formats the complete task, architectural decisions, and invariants into a token-budgeted markdown block and copies it to your clipboard. Paste it directly into the agent's chat window.
