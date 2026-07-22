# Architecture

Runwise should be built as a local-first harness with thin agent adapters and an optional cloud control plane.

## Layers

```text
Agent Surfaces
  Codex
  Pi
  WorkBuddy
  Claude Code
  Cursor Agent

Agent Adapters
  Runwise for Codex
  Runwise for Pi
  Runwise for WorkBuddy
  Generic MCP / CLI Adapter

Local Layer
  Runwise CLI
  Runwise Runner / Local Daemon
  Project Scanner
  Local Memory Index
  Local Test Executor
  Final Gate
  .runwise Ledger

Cloud Layer
  Workspace
  Project
  Requirement Runs
  Stage State
  Artifact Metadata
  Team Dashboard
  Integrations
  Billing
  Audit

External Systems
  GitHub
  Linear
  Jira
  Slack
  OpenViking
  CI
```

## Core

The core package should define:

- workflow stages
- run state model
- artifact contracts
- policy and red-line contracts
- final gate checks
- local ledger format

The core should not depend on any specific agent.

## CLI

The CLI should provide deterministic operations:

```bash
runwise init
runwise connect
runwise scan
runwise sync
runwise status
runwise start
runwise test-plan
runwise run-tests
runwise final-gate
```

The CLI should be callable by both humans and agents.

## Local Runner

The local runner is responsible for:

- scanning the repository
- generating project context
- storing local memory
- executing local tests
- maintaining `.runwise/runs`
- enforcing final gate checks
- syncing approved metadata to cloud

## Agent Adapters

Adapters should be thin. They connect agent-specific capabilities to Runwise core.

Examples:

- Pi adapter: Pi extension, tools, commands, skills, prompt templates
- Codex adapter: Codex skill/plugin and CLI bridge
- WorkBuddy adapter: native workflow integration
- Generic adapter: MCP or CLI wrapper

## Cloud

The cloud layer is for team collaboration:

- workspace
- members
- projects
- hosted run registry
- dashboard
- artifact metadata
- archive links
- policy configuration
- audit log
- billing

The cloud should not require source code upload by default.

## External Integrations

Initial integrations:

- GitHub for issues, PRs, commits, checks
- Linear for requirements and design docs
- Slack for notifications and approvals
- OpenViking for optional experience memory
- CI for test evidence

## Recommended First Milestone

The first milestone should include:

- core workflow contracts
- local CLI
- `.runwise` ledger
- project scanner
- final gate
- Pi adapter
- Codex skill adapter

