# Upcoming Features

ContextOS is evolving from a context and handoff layer into a **persistent knowledge layer for AI-assisted development**.

---

### 🔗 Context Sources & Provenance

Keep track of where important project knowledge came from.

* Jira tickets
* Slack threads
* Design documents
* GitHub PRs
* Architecture documents
* Other relevant links

Instead of remembering only *what* was decided, ContextOS will also remember **where that decision came from**.

```text
Decision
   │
   ├── Jira ticket
   ├── Slack thread
   ├── Design document
   └── GitHub PR
```

This makes important decisions traceable even months later.

---

### 🤖 Agent Roles & Workflows

Support structured workflows such as:

```text
Planner → Implementer → Reviewer → Debugger
```

Different agents can work on different stages while sharing the same project context.

---

### 🧠 Smarter Context Selection

Automatically select the most relevant context for the current task instead of loading everything.

ContextOS will consider:

* Current task
* Related decisions
* Relevant files
* Previous handoffs
* Related Jira/issues
* Important external sources

---

### 🔍 Context Search

Make project knowledge searchable across:

* Tasks
* Decisions
* Handoffs
* Jira references
* External documents
* Slack threads
* Git history

---

### 📁 Multi-Repository Context

Track related repositories as a single development workspace while keeping repository-specific context separated.

---

### 🔄 Issue Tracker Integration

Expand beyond Jira tags toward deeper integrations with:

* Jira
* Linear
* Other issue trackers

The goal is to connect project work with the context and decisions surrounding it.

---

### 🌳 Code-Aware Context

Use AST / Tree-sitter based analysis to provide more precise code context when an AI agent needs to understand or modify a part of a large codebase.

---

### ⚡ Adaptive Context Budgets

Dynamically control how much context is included in a handoff based on the task and available token budget.

---

The long-term goal is simple:

> **ContextOS should remember not only what your project knows, but why it knows it and where that knowledge came from.**
