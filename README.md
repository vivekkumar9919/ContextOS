# ContextOS

> **Deterministic, local-first context and handoff layer for AI coding agents.**  
> Stop hoarding giant chats. Seamlessly jump between **Claude**, **Codex**, **Cursor**, and **Antigravity** without losing architectural constraints or burning thousands of unnecessary tokens.

---

## 💡 Why ContextOS? The Problems It Solves

Modern AI-assisted software engineering involves multiple specialized models and tools:
* **Claude / Gemini Pro** for system architecture, planning, and high-level reasoning.
* **Codex / GPT** for autonomous implementation, testing, and scaffolding.
* **Cursor / Windsurf** for inline file edits and interactive debugging.
* **Antigravity / Research agents** for deep multi-turn audits and complex workflows.

However, moving between these tools creates major friction:

### 1. The "Chat Hoarding" Dilemma & Massive Token Waste
Developers often keep massive, endless chat sessions alive for weeks simply because they **fear losing earlier context, architectural decisions, and requirements**. 
* **The Cost**: Every turn in a 50-message chat resends the entire thread history (often **50,000–100,000+ tokens per prompt**).
* **The Degradation**: Beyond burning API budget and hitting rate limits, models suffer from **"needle-in-a-haystack" degradation** and start hallucinating or violating constraints.
* **How ContextOS Solves It**: ContextOS extracts the high-signal kernel of your work (active tasks, checklist status, architectural invariants, git diffs) into a bounded, deterministic snapshot (**typically under 1,000 tokens**). You can confidently start a fresh chat anytime with **zero context loss and up to 90%+ token savings**.

### 2. Painless Model & Chat Switching (Zero Copy-Pasting)
Switching from a planning session in Claude to an implementation run in Codex traditionally meant copying long prompt summaries, re-explaining invariants, or losing track of progress. 
* With ContextOS MCP enabled globally, your new chat session instantly fetches the exact state, checklist, and architectural constraints with a single tool call:
  ```
  "Check ContextOS for current task context and continue implementation."
  ```

### 3. Jira / Ticket Context That Never Gets Lost
Ever wondered: *"Which chat was I working on for PROJ-245?"* or *"Did we decide to use Redis or PostgreSQL for caching?"*
* ContextOS indexes tasks and decisions by **Jira ticket ID / issue key**.
* No matter how many chats you have opened or closed, any agent in any IDE can instantly recall the state:
  ```
  "Fetch ContextOS context for Jira ticket PROJ-245."
  ```

### 4. Enforcing Architectural Invariants Across Agents
LLMs easily forget negative constraints (e.g., *"Never log raw card details"*, *"Preserve backwards-compatible REST endpoints"*). 
* ContextOS records **Architectural Invariants & Decisions (ADRs)** with strict DAG cycle checks.
* Every downstream agent is automatically fed these invariants before writing code.

---

## 💰 The Token Economics: Before vs. After ContextOS

| Metric | Without ContextOS (Chat Hoarding) | With ContextOS |
| :--- | :--- | :--- |
| **Tokens per Prompt** | 40,000 – 120,000+ tokens (re-sending history) | **< 1,000 – 2,500 tokens** (pure signal) |
| **Token Cost / Quota** | 💸 Heavy consumption, quick rate-limit throttling | ⚡ **Up to 90%+ token savings** |
| **Model Attention** | Suffers from distraction & lost instructions | Focused exclusively on active constraints |
| **Handoff Friction** | Manual markdown copy-paste or re-explaining | Instant, programmatic MCP tool calls |
| **Storage & Privacy** | Stored in proprietary remote chat logs | **100% Local SQLite** (`~/.contextos`) |

---

## ⚡ Current Features

* **11 First-Class MCP Tools (100% Terminal CLI Parity)**: Complete tool suite covering status dashboards, task lifecycles, checklists, decisions, project catalogs, git diff extraction, and cleanup.
* **Local-First, Global-Opt-In Architecture**:
  * **Local Workspace Storage** (`.contextos/context.db`): Isolated to the current repository.
  * **Machine-Global Storage** (`~/.contextos/context.db`): Centralized hub accessible across any folder or repo.
  * **Explicit Scope Control**: Tools support `global: true` to direct writes to machine-global scope from any session.
* **Automatic Cross-Storage Fallback**: If a Jira ticket isn't found locally, ContextOS seamlessly checks global storage.
* **Deterministic Bounded Handoffs**: Compiles strict Markdown briefs (`latest.md`) and automatically archives versioned handoffs with noise/lockfile pruning.
* **Architectural Decision Records (ADR)**: Invariant tracker with automated supersession DAG and cycle-prevention logic.
* **Noise-Filtered & Secret-Scanned Git Context**: Strips lockfiles, generated assets, binary blobs, and scans for high-entropy secrets before context reaches the LLM.
* **Zero-Setup Clipboard Handoff**: Run `contextos handoff` in terminal to instantly copy a compact brief straight to your OS clipboard.

---

## 🗺️ Roadmap & Upcoming Features

* [ ] **Global Guardrails Engine**: Define machine-wide or org-wide invariants once in `~/.contextos` (e.g., *"Never commit secrets"*, *"Strict TypeScript only"*). All repos and agents automatically inherit them with zero per-repo config.
* [ ] **AST & Tree-Sitter Semantic Diff Slicing**: Replace raw unified diffs with syntax-aware function-level slices for even leaner token payloads.
* [ ] **Dynamic Token Budget Allocator**: Automatically tailor handoff density to the destination model's exact context window (Claude 200k vs GPT-4o mini 8k).
* [ ] **SQLite FTS5 Full-Text Search**: Instant, sub-millisecond keyword retrieval across hundreds of past projects, archived handoffs, and decisions.
* [ ] **Multi-Repo Workspace Tracking (Epics)**: Coordinate tickets that span multiple independent git repositories under a unified global task.
* [ ] **Two-Way Issue Sync**: Direct read/write sync with Jira and Linear.

---

## 📚 Documentation & Guides

ContextOS is designed to be configured once globally so every AI agent on your machine can access it. Detailed setup and usage guides are available below:

* 🚀 **[Multi-IDE MCP & Global Context Guide](docs/MCP_GUIDE.md)**  
  Step-by-step instructions to connect ContextOS over MCP in **VS Code (Codex)**, **Cursor**, **Google Antigravity**, **Claude Desktop**, and **Claude Code CLI**.

* 📖 **[End-to-End Setup & Usage Guide](docs/SETUP_AND_USAGE_GUIDE.md)**  
  Complete manual for building the monorepo, CLI command references, storage modes, and best practices.

* 📋 **[Product Requirements Document (PRD)](docs/PRD.md)** & **[Technical Requirements Document (TRD)](docs/TRD.md)**

---

## 🤝 Contributing

ContextOS is open-source and built for the emerging multi-agent coding ecosystem. 

**Feel free to contribute!** We welcome:
* Ideas for new context optimization techniques.
* Integrations with additional IDEs, agents, or issue trackers.
* Bug reports, documentation polish, and pull requests.

Check out open issues, open a discussion, or submit a pull request!
